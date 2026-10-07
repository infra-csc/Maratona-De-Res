import { Router } from "express";
import {
  db, eventsTable, cyclesTable, areasTable, criteriaTable, eventCriteriaTable, evaluationsTable,
  eventCriterionAssignmentsTable, eventAreaAssignmentsTable, eventConformitiesTable,
  eventParticipantsTable, employeesTable,
} from "@workspace/db";
import { and, eq, inArray, or, sql, gte, lte, lt, ilike, desc, asc, type SQL } from "drizzle-orm";
import { autoReleaseSafely, autoReleaseDueEventsThrottled, todayBR, evaluationOpensOn } from "../lib/evaluation-release.js";
import { requireAuth, requireRole, isRole } from "../lib/auth.js";
import { getUserAreaId, loadClosures } from "../lib/area-evaluation.js";
import { areaModeEventIds } from "../lib/area-mode.js";
import { eventsWithoutConduta } from "../lib/cycle-data.js";
import { participantCountsForScore } from "../lib/participation.js";
import { eventWithinItsCycleSql } from "../lib/cycle.js";
import { conformityProgress } from "../lib/conformity-status.js";
import { isEventInNextCycle, isEventOpenForEvaluation } from "../lib/next-cycle.js";

const router = Router();
router.use(requireAuth);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /evaluations/my-area
 *
 * A tela do avaliador numa chamada só (sem N+1): os eventos com critérios
 * confirmados em que o usuário tem algo a responder — os DESIGNADOS a ele e,
 * só nos eventos de ciclo com avaliação por área (cycles.area_evaluation), os
 * critérios da ÁREA DO CADASTRO (a primeira resposta enviada fecha) — além da
 * Matriz de Conformidade quando ele é o responsável.
 *
 * Filtros: search (nome, cliente, cidade), status (pending | done | all),
 * from/to (YYYY-MM-DD, sobreposição com o período do evento), eventId (um só,
 * usado pela tela para abrir o evento da URL). Sem from/to/eventId, só o ciclo
 * atual. Admin/RH podem consultar outra área com ?areaId= (só a regra da área).
 *
 * `pending` de cada evento segue a regra ÚNICA de "aberto para avaliação"
 * (isEventOpenForEvaluation, M3 da 4ª revisão): ciclo fechado, evento
 * encerrado (status closed), histórico ou do próximo ciclo nunca é pendente.
 *
 * `upcoming` (só para o papel avaliador; admin/RH recebem []): eventos do
 * ciclo ATUAL (aberto), dentro do período dele, com algo do avaliador (mesma
 * regra de relevância da lista) e que AINDA NÃO ABRIRAM (hoje em Brasília <
 * dia seguinte ao fim) — { eventId, eventName, startDate, endDate, opensOn },
 * ordenados por opensOn, no máximo 30. Independe dos filtros da lista.
 */
const UPCOMING_LIMIT = 30;
router.get("/evaluations/my-area", requireRole("admin", "rh", "avaliador"), async (req, res) => {
  const user = req.user!;
  const isManager = isRole(user.role, "admin") || isRole(user.role, "rh");
  const isEvaluator = isRole(user.role, "avaliador");
  const me = user.userId;

  const qAreaId = req.query.areaId != null && req.query.areaId !== "" ? parseInt(String(req.query.areaId)) : null;
  if (qAreaId != null && Number.isNaN(qAreaId)) { res.status(400).json({ error: "areaId inválido" }); return; }
  const areaId = isManager && qAreaId != null ? qAreaId : await getUserAreaId(me);

  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const statusFilter = req.query.status === "pending" || req.query.status === "done" ? req.query.status : "all";
  const from = typeof req.query.from === "string" && ISO_DAY.test(req.query.from) ? req.query.from : null;
  const to = typeof req.query.to === "string" && ISO_DAY.test(req.query.to) ? req.query.to : null;
  const onlyEventId = req.query.eventId != null && req.query.eventId !== "" ? parseInt(String(req.query.eventId)) : null;
  if (onlyEventId != null && Number.isNaN(onlyEventId)) { res.status(400).json({ error: "eventId inválido" }); return; }

  // Eventos cuja avaliação abriu hoje (dia seguinte ao evento) entram sozinhos:
  // o evento pedido pela URL na hora; a varredura do ciclo, 1×/min. Erro na
  // liberação vira log — a lista nunca responde 500 por causa dela (M5).
  if (onlyEventId != null) await autoReleaseSafely({ eventIds: [onlyEventId] });
  else await autoReleaseDueEventsThrottled();

  const [area] = areaId != null
    ? await db.select({ id: areasTable.id, name: areasTable.name }).from(areasTable).where(eq(areasTable.id, areaId)).limit(1)
    : [];

  // ── 1. Eventos candidatos ────────────────────────────────────────────────
  // Critério "meu" no evento: designado a mim por critério, OU da área em que
  // fui designado no evento (fluxo antigo), OU — só no ciclo com avaliação por
  // área — da área do meu cadastro. O corte do redirecionamento é aplicado
  // depois, em memória, com as linhas carregadas. Admin/RH consultando uma
  // área veem os critérios dela em qualquer ciclo (é só consulta).
  const areaCond = areaId == null
    ? sql`false`
    : isEvaluator
      ? sql`(c.responsible_area_id = ${areaId} AND EXISTS (SELECT 1 FROM cycles cy WHERE cy.id = ${eventsTable.cycleId} AND cy.area_evaluation))`
      : sql`c.responsible_area_id = ${areaId}`;
  // Designação só vale no fluxo antigo: no modo por área só a área do
  // cadastro dá acesso (D2).
  const assignedCond = isEvaluator
    ? sql`(NOT EXISTS (SELECT 1 FROM cycles cy WHERE cy.id = ${eventsTable.cycleId} AND cy.area_evaluation)
           AND (EXISTS (SELECT 1 FROM event_criterion_assignments eca
                    WHERE eca.event_id = ec.event_id AND eca.criterion_id = ec.criterion_id AND eca.assigned_to_id = ${me})
           OR EXISTS (SELECT 1 FROM event_area_assignments eaa
                    WHERE eaa.event_id = ec.event_id AND eaa.area_id = c.responsible_area_id AND eaa.evaluator_user_id = ${me})))`
    : sql`false`;
  const relevant = sql`(EXISTS (SELECT 1 FROM event_criteria ec JOIN criteria c ON c.id = ec.criterion_id
                                 WHERE ec.event_id = ${eventsTable.id} AND ec.active AND (${areaCond} OR ${assignedCond}))
                        ${isEvaluator ? sql`OR ${eventsTable.conformityEvaluatorUserId} = ${me} OR ${eventsTable.conformityEvaluatorFerramentasUserId} = ${me}` : sql``})`;

  // Próximos (ainda não abriram) — só para o avaliador; ver o comentário da rota.
  const today = todayBR();
  const upcoming = !isEvaluator ? [] : (await db.select({
    eventId: eventsTable.id, eventName: eventsTable.name, startDate: eventsTable.startDate, endDate: eventsTable.endDate,
  })
    .from(eventsTable)
    .innerJoin(cyclesTable, eq(eventsTable.cycleId, cyclesTable.id))
    .where(and(
      eq(cyclesTable.isCurrent, true),
      sql`${cyclesTable.status} <> 'closed'`,
      eq(eventsTable.isHistorical, false),
      eq(eventsTable.status, "open"),
      eventWithinItsCycleSql(),
      sql`coalesce(${eventsTable.endDate}, ${eventsTable.startDate}) >= ${today}`,
      relevant,
    ))
    .orderBy(asc(sql`coalesce(${eventsTable.endDate}, ${eventsTable.startDate})`), asc(eventsTable.id))
    .limit(UPCOMING_LIMIT))
    .map(e => ({ ...e, opensOn: evaluationOpensOn(e) }));
  const empty = { areaId: area?.id ?? null, areaName: area?.name ?? null, totals: { pending: 0, done: 0 }, events: [], upcoming };

  const conds: SQL[] = [
    eq(eventsTable.criteriaConfirmed, true),
    // Avaliador só vê a partir do dia seguinte ao evento (Brasília).
    ...(isEvaluator && !isManager ? [lt(sql`coalesce(${eventsTable.endDate}, ${eventsTable.startDate})`, today)] : []),
    eq(eventsTable.isHistorical, false),
    inArray(eventsTable.status, ["open", "closed"]),
    // Evento "fora do período" é do PRÓXIMO ciclo: não aparece para avaliar
    // até ser movido para o ciclo novo (lib/next-cycle.ts).
    eventWithinItsCycleSql(),
    relevant,
  ];
  if (onlyEventId != null) conds.push(eq(eventsTable.id, onlyEventId));
  if (from) conds.push(gte(eventsTable.endDate, from));
  if (to) conds.push(lte(eventsTable.startDate, to));
  if (onlyEventId == null && !from && !to) {
    const [current] = await db.select({ id: cyclesTable.id }).from(cyclesTable).where(eq(cyclesTable.isCurrent, true)).limit(1);
    if (current) conds.push(eq(eventsTable.cycleId, current.id));
  }
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, m => `\\${m}`)}%`;
    conds.push(or(ilike(eventsTable.name, like), ilike(eventsTable.clientName, like), ilike(eventsTable.city, like))!);
  }

  const events = await db.select({
    id: eventsTable.id,
    name: eventsTable.name,
    clientName: eventsTable.clientName,
    city: eventsTable.city,
    state: eventsTable.state,
    location: eventsTable.location,
    startDate: eventsTable.startDate,
    endDate: eventsTable.endDate,
    status: eventsTable.status,
    feedbackReleased: eventsTable.feedbackReleased,
    cycleName: cyclesTable.name,
    cycleStatus: cyclesTable.status,
    cycleEndDate: cyclesTable.endDate,
    isHistorical: eventsTable.isHistorical,
    conformityEvaluatorUserId: eventsTable.conformityEvaluatorUserId,
    conformityEvaluatorFerramentasUserId: eventsTable.conformityEvaluatorFerramentasUserId,
  })
    .from(eventsTable)
    .leftJoin(cyclesTable, eq(eventsTable.cycleId, cyclesTable.id))
    .where(and(...conds))
    .orderBy(desc(eventsTable.startDate), desc(eventsTable.id));

  if (events.length === 0) {
    // O evento da URL não está disponível: se ele for DO avaliador (critério
    // da área/designado ou matriz), diz quando abre — "Abre em DD/MM" ou
    // "próximo ciclo". Evento de outra área segue sem nenhum dado.
    if (onlyEventId != null) {
      // Pela área do cadastro: ciclo por área, ou evento do próximo ciclo
      // (ainda guardado no ciclo antigo, sem a marca). No fluxo antigo só a
      // designação dá acesso — evento alheio não revela nome nem datas.
      const mineSoon = areaId == null && !isEvaluator
        ? sql`false`
        : sql`(EXISTS (SELECT 1 FROM event_criteria ec JOIN criteria c ON c.id = ec.criterion_id
                       WHERE ec.event_id = ${eventsTable.id} AND ec.active
                         AND (${areaId == null ? sql`false` : sql`(c.responsible_area_id = ${areaId} AND EXISTS (SELECT 1 FROM cycles cy WHERE cy.id = ${eventsTable.cycleId} AND (cy.area_evaluation OR (cy.end_date IS NOT NULL AND ${eventsTable.startDate} > cy.end_date))))`} OR ${assignedCond}))
               ${isEvaluator ? sql`OR ${eventsTable.conformityEvaluatorUserId} = ${me} OR ${eventsTable.conformityEvaluatorFerramentasUserId} = ${me}` : sql``})`;
      const [ev] = await db.select({ id: eventsTable.id, name: eventsTable.name, startDate: eventsTable.startDate, endDate: eventsTable.endDate })
        .from(eventsTable)
        .where(and(eq(eventsTable.id, onlyEventId), eq(eventsTable.isHistorical, false), inArray(eventsTable.status, ["open", "closed"]), mineSoon))
        .limit(1);
      if (ev) {
        res.json({ ...empty, unavailable: { eventId: ev.id, eventName: ev.name, startDate: ev.startDate, endDate: ev.endDate, nextCycle: await isEventInNextCycle(ev.id) } });
        return;
      }
    }
    res.json(empty);
    return;
  }
  const eventIds = events.map(e => e.id);

  // ── 2. Critérios, designações, avaliações (em lote) ──────────────────────
  const [criteriaRows, critAssignRows, myAreaAssignRows, partialRows, conformityRows, myEvalRows, participantRows] = await Promise.all([
    db.select({
      eventId: eventCriteriaTable.eventId,
      criterionId: criteriaTable.id,
      name: criteriaTable.name,
      description: criteriaTable.description,
      areaId: criteriaTable.responsibleAreaId,
      areaName: areasTable.name,
      eventScoped: criteriaTable.eventScoped,
      sourceCriterionId: criteriaTable.sourceCriterionId,
      displayOrder: criteriaTable.displayOrder,
      weight: sql<string>`coalesce(${eventCriteriaTable.weightOverride}, ${criteriaTable.defaultWeight}, '0')`,
    })
      .from(eventCriteriaTable)
      .innerJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
      .leftJoin(areasTable, eq(criteriaTable.responsibleAreaId, areasTable.id))
      .where(and(inArray(eventCriteriaTable.eventId, eventIds), eq(eventCriteriaTable.active, true))),
    db.select({ eventId: eventCriterionAssignmentsTable.eventId, criterionId: eventCriterionAssignmentsTable.criterionId, assignedToId: eventCriterionAssignmentsTable.assignedToId })
      .from(eventCriterionAssignmentsTable).where(inArray(eventCriterionAssignmentsTable.eventId, eventIds)),
    isEvaluator
      ? db.select({ eventId: eventAreaAssignmentsTable.eventId, areaId: eventAreaAssignmentsTable.areaId })
        .from(eventAreaAssignmentsTable)
        .where(and(inArray(eventAreaAssignmentsTable.eventId, eventIds), eq(eventAreaAssignmentsTable.evaluatorUserId, me)))
      : Promise.resolve([] as { eventId: number; areaId: number }[]),
    db.select({ eventId: eventCriteriaTable.eventId, last: sql<string | null>`max(${eventCriteriaTable.partialPublishedAt})` })
      .from(eventCriteriaTable)
      .where(and(inArray(eventCriteriaTable.eventId, eventIds), eq(eventCriteriaTable.active, true)))
      .groupBy(eventCriteriaTable.eventId),
    db.select({
      eventId: eventConformitiesTable.eventId, epi: eventConformitiesTable.epi, estaiamentos: eventConformitiesTable.estaiamentos,
      conduta: eventConformitiesTable.conduta, standoutResponse: eventConformitiesTable.standoutResponse, absencesResponse: eventConformitiesTable.absencesResponse,
      absencesReport: eventConformitiesTable.absencesReport, guardaEquipamentos: eventConformitiesTable.guardaEquipamentos,
    }).from(eventConformitiesTable).where(inArray(eventConformitiesTable.eventId, eventIds)),
    db.select({ eventId: evaluationsTable.eventId, criterionId: evaluationsTable.criterionId, status: evaluationsTable.status })
      .from(evaluationsTable)
      .where(and(inArray(evaluationsTable.eventId, eventIds), eq(evaluationsTable.evaluatorUserId, me))),
    // Participantes só quando a tela pede UM evento (cabeçalho "N part.").
    onlyEventId != null
      ? db.select({ eventId: eventParticipantsTable.eventId, functionName: eventParticipantsTable.functionName, employmentType: employeesTable.employmentType, employeeFunction: employeesTable.functionName })
        .from(eventParticipantsTable).leftJoin(employeesTable, eq(eventParticipantsTable.employeeId, employeesTable.id))
        .where(inArray(eventParticipantsTable.eventId, eventIds))
      : Promise.resolve([] as { eventId: number; functionName: string | null; employmentType: string | null; employeeFunction: string | null }[]),
  ]);

  const critAssign = new Map(critAssignRows.map(r => [`${r.eventId}:${r.criterionId}`, r.assignedToId]));
  const myAreaAssign = new Set(myAreaAssignRows.map(r => `${r.eventId}:${r.areaId}`));
  const [areaMode, noConduta] = await Promise.all([areaModeEventIds(eventIds), eventsWithoutConduta(eventIds)]);

  const isAssigned = (eventId: number, criterionId: number, critArea: number | null) => {
    // Modo por área: designação não dá acesso (D2).
    if (!isEvaluator || areaMode.has(eventId)) return false;
    const assignedTo = critAssign.get(`${eventId}:${criterionId}`);
    if (assignedTo != null) return assignedTo === me;
    return critArea != null && myAreaAssign.has(`${eventId}:${critArea}`);
  };

  const mine = criteriaRows
    .map(c => {
      const assigned = isAssigned(c.eventId, c.criterionId, c.areaId);
      // A área do cadastro só dá acesso no ciclo com avaliação por área.
      const byArea = areaId != null && c.areaId === areaId && (!isEvaluator || areaMode.has(c.eventId));
      return assigned || byArea ? { ...c, access: (assigned ? "assigned" : "area") as "assigned" | "area" } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.criterionId - b.criterionId);

  // Critério respondido por mais de uma área (o original e as cópias por área
  // com áreas diferentes): a tela avisa que outra área também responde.
  const areasByOrigin = new Map<string, Set<number | null>>();
  const originKey = (c: { eventId: number; criterionId: number; eventScoped: boolean | null; sourceCriterionId: number | null }) =>
    `${c.eventId}:${c.eventScoped && c.sourceCriterionId != null ? c.sourceCriterionId : c.criterionId}`;
  for (const c of criteriaRows) {
    const k = originKey(c);
    if (!areasByOrigin.has(k)) areasByOrigin.set(k, new Set());
    areasByOrigin.get(k)!.add(c.areaId);
  }

  const critIds = [...new Set(mine.map(c => c.criterionId))];
  const [closures, myClosures] = await Promise.all([
    loadClosures(db, eventIds, critIds),
    loadClosures(db, eventIds, critIds, { evaluatorUserId: me }),
  ]);
  const myEval = new Map(myEvalRows.map(r => [`${r.eventId}:${r.criterionId}`, r.status]));
  const partialByEvent = new Map(partialRows.map(r => [r.eventId, r.last]));
  const confByEvent = new Map(conformityRows.map(r => [r.eventId, r]));

  const out = events.map(ev => {
    const evAreaMode = areaMode.has(ev.id);
    const criteria = mine.filter(c => c.eventId === ev.id).map(c => {
      const key = `${ev.id}:${c.criterionId}`;
      const myStatus = myEval.get(key);
      const own = myClosures.get(key);
      const first = closures.get(key);
      // answered = eu (ou um link meu) já enviei; closed = no modo por área,
      // alguém já respondeu (a primeira resposta fecha para TODOS, designado
      // inclusive); open = posso responder. No fluxo antigo nada fecha.
      const state: "open" | "answered" | "closed" = myStatus === "submitted"
        ? "answered"
        : (evAreaMode && first ? "closed" : "open");
      const who = state === "answered" ? own : state === "closed" ? first : undefined;
      return {
        criterionId: c.criterionId,
        name: c.name,
        description: c.description ?? null,
        weight: parseFloat(c.weight),
        multiArea: (areasByOrigin.get(originKey(c))?.size ?? 0) > 1,
        areaId: c.areaId,
        areaName: c.areaName,
        eventScoped: c.eventScoped,
        sourceCriterionId: c.sourceCriterionId,
        access: c.access,
        state,
        answeredByName: who?.name ?? null,
        answeredByMe: state === "answered" && !(own?.viaLink ?? false),
        answeredViaLink: who?.viaLink ?? false,
        answeredAt: who?.submittedAt?.toISOString() ?? null,
        hasDraft: myStatus === "draft",
      };
    });

    const isCeno = isEvaluator && ev.conformityEvaluatorUserId === me;
    const isFerr = isEvaluator && ev.conformityEvaluatorFerramentasUserId === me;
    // Pendente/completa: a MESMA conta da lista de Eventos (B3,
    // lib/conformity-status.ts), com a Conduta conforme o ciclo do evento.
    const conf = conformityProgress(confByEvent.get(ev.id), { cenografia: isCeno, ferramentas: isFerr, withoutConduta: noConduta.has(ev.id) });
    const cenoPending = isCeno && !conf.cenoDone;
    const ferrPending = isFerr && !conf.ferrDone;

    const openCount = criteria.filter(c => c.state === "open").length;
    // M3: regra única de "aberto" — ciclo fechado ou evento encerrado nunca é pendente.
    const openNow = isEventOpenForEvaluation(ev, ev.cycleStatus != null ? { status: ev.cycleStatus, endDate: ev.cycleEndDate } : null);
    const pending = openNow && (openCount > 0 || cenoPending || ferrPending);
    const partial = partialByEvent.get(ev.id);
    return {
      id: ev.id,
      name: ev.name,
      clientName: ev.clientName,
      city: ev.city,
      state: ev.state,
      location: ev.location,
      startDate: ev.startDate,
      endDate: ev.endDate,
      status: ev.status,
      cycleName: ev.cycleName ?? null,
      participantCount: onlyEventId != null
        ? participantRows.filter(p => p.eventId === ev.id && participantCountsForScore(p)).length
        : null,
      published: ev.feedbackReleased ? "final" : partial ? "partial" : null,
      totalCriteria: criteria.length,
      answeredCount: criteria.length - openCount,
      openCount,
      draftCount: criteria.filter(c => c.hasDraft && c.state === "open").length,
      conformityCenografia: isCeno,
      conformityFerramentas: isFerr,
      conformityPending: cenoPending || ferrPending,
      conformityWithoutConduta: noConduta.has(ev.id),
      areaMode: evAreaMode,
      pending,
      criteria,
    };
  }).filter(e => e.criteria.length > 0 || e.conformityCenografia || e.conformityFerramentas);

  const totals = { pending: out.filter(e => e.pending).length, done: out.filter(e => !e.pending).length };
  const filtered = statusFilter === "all" ? out : out.filter(e => (statusFilter === "pending" ? e.pending : !e.pending));
  res.json({ areaId: area?.id ?? null, areaName: area?.name ?? null, totals, events: filtered, upcoming });
});

export default router;
