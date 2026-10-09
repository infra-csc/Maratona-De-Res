import { Router } from "express";
import { requireAuth, requireRole } from "../lib/auth.js";
import { getCurrentCycle, getMinEventsForEligibility, getGlobalMinEvents, eventWithinItsCycleSql } from "../lib/cycle.js";
import { validateCycleFields, parseCycleRules, eventPeriodPosition, formatBrDate } from "../lib/cycle-rules.js";
import { recomputeCycleResults } from "./results.js";
import { rankingScope } from "../lib/ranking-scope.js";
import {
  db, cyclesTable, eventsTable, quarterlyResultsTable, employeesTable, absencesTable, evaluationsTable,
  type Cycle,
} from "@workspace/db";
import { and, desc, eq, gt, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { audit } from "../lib/audit.js";
import { eventOpenForEvaluationSql } from "../lib/next-cycle.js";
import { plural } from "../lib/plural.js";

/**
 * Cadastro e histórico de ciclos.
 *
 * Ciclos NUNCA são excluídos (não existe DELETE): cada ciclo guarda seus
 * eventos, resultados (quarterly_results) e bônus por cycleId, e é isso que
 * forma o histórico. Só existe um ciclo atual por vez (isCurrent); é nele que
 * entram eventos novos, avaliações, sincronização e o "Fechar Ciclo".
 */
const router = Router();
router.use(requireAuth);

const MANAGERS = ["admin", "rh", "diretoria"] as const;
// Chave fixa do advisory lock que serializa "quem é o ciclo atual".
const CURRENT_CYCLE_LOCK = 734_120_001;

function toCycle(c: Cycle, globalMinEvents?: number) {
  return {
    minEvents: c.minEvents ?? null,
    paymentDate: c.paymentDate ?? null,
    conformityWithoutConduta: c.conformityWithoutConduta,
    areaEvaluation: c.areaEvaluation,
    ...(globalMinEvents != null ? { effectiveMinEvents: c.minEvents ?? globalMinEvents } : {}),
    id: c.id,
    name: c.name,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    isCurrent: c.isCurrent,
    closedAt: c.closedAt ? c.closedAt.toISOString() : null,
    createdAt: c.createdAt ? c.createdAt.toISOString() : null,
  };
}

const num = (v: string | number | null | undefined) => (v == null ? 0 : typeof v === "number" ? v : parseFloat(v) || 0);
const numOrNull = (v: string | number | null | undefined) => (v == null ? null : Math.round(num(v) * 100) / 100);

async function loadCycleStats(cycleIds: number[]) {
  const empty = {
    eventsTotal: 0, eventsAfterEnd: 0, eventsStored: 0, eventsConfirmed: 0, eventsOpen: 0, firstEventDate: null as string | null, lastEventDate: null as string | null,
    collaborators: 0, eligible: 0, withBonus: 0, bonusTotal: 0, bonusPaid: 0, avgFinalResult: null as number | null,
    // Avaliações enviadas no ciclo: com alguma, a avaliação por área não muda mais (D3).
    evaluationsSubmitted: 0,
  };
  const stats = new Map<number, typeof empty>(cycleIds.map(id => [id, { ...empty }]));
  if (cycleIds.length === 0) return stats;
  // Ciclo atual: mesmo recorte da tela de Resultados (só ativos). Anteriores: histórico completo.
  const currentId = (await getCurrentCycle())?.id ?? null;
  const inPeriod = eventWithinItsCycleSql();
  const openForEvaluation = eventOpenForEvaluationSql();

  const [eventRows, resultRows] = await Promise.all([
    // Só os eventos DO PERÍODO (data de início até o fim do ciclo — ver
    // eventPeriodPosition); os que começam depois vão à parte (eventsAfterEnd).
    db.select({
      cycleId: eventsTable.cycleId,
      total: sql<number>`(count(*) filter (where ${inPeriod}))::int`,
      afterEnd: sql<number>`(count(*) filter (where not ${inPeriod}))::int`,
      confirmed: sql<number>`(count(*) filter (where ${eventsTable.resultsConfirmed} and ${inPeriod}))::int`,
      // "Aberto" = ABERTO PARA AVALIAÇÃO, a regra única (lib/next-cycle.ts):
      // não histórico, status open, dentro do período, ciclo não fechado e já
      // no dia seguinte ao fim do evento.
      open: sql<number>`(count(*) filter (where ${openForEvaluation}))::int`,
      first: sql<string | null>`(min(${eventsTable.startDate}) filter (where ${inPeriod}))::text`,
      last: sql<string | null>`(max(${eventsTable.endDate}) filter (where ${inPeriod}))::text`,
    }).from(eventsTable)
      .where(inArray(eventsTable.cycleId, cycleIds))
      .groupBy(eventsTable.cycleId),
    db.select({
      cycleId: quarterlyResultsTable.cycleId,
      collaborators: sql<number>`count(*)::int`,
      eligible: sql<number>`(count(*) filter (where ${quarterlyResultsTable.eligible}))::int`,
      withBonus: sql<number>`(count(*) filter (where ${quarterlyResultsTable.eligible} and ${quarterlyResultsTable.bonusValue} > 0))::int`,
      bonusTotal: sql<string>`coalesce(sum(case when ${quarterlyResultsTable.eligible} then ${quarterlyResultsTable.bonusValue} else 0 end), 0)::text`,
      bonusPaid: sql<string>`coalesce(sum(case when ${quarterlyResultsTable.bonusStatus} = 'paid' then ${quarterlyResultsTable.bonusValue} else 0 end), 0)::text`,
      avgFinal: sql<string | null>`(avg(${quarterlyResultsTable.finalResult}) filter (where ${quarterlyResultsTable.eventsCount} > 0))::text`,
    }).from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      .where(and(inArray(quarterlyResultsTable.cycleId, cycleIds), rankingScope({ activeOnlyInCycleId: currentId })))
      .groupBy(quarterlyResultsTable.cycleId),
  ]);

  for (const r of eventRows) {
    const s = stats.get(r.cycleId);
    if (!s) continue;
    s.eventsTotal = r.total;
    s.eventsAfterEnd = r.afterEnd;
    // Contagem única do app: eventsStored = TODOS os eventos guardados no
    // ciclo = o que GET /events?cycleId= lista (e a Central usa) =
    // eventsTotal (do período, contam no resultado) + eventsAfterEnd.
    s.eventsStored = r.total + r.afterEnd;
    s.eventsConfirmed = r.confirmed;
    s.eventsOpen = r.open;
    s.firstEventDate = r.first;
    s.lastEventDate = r.last;
  }
  for (const r of resultRows) {
    const s = stats.get(r.cycleId);
    if (!s) continue;
    s.collaborators = r.collaborators;
    s.eligible = r.eligible;
    s.withBonus = r.withBonus;
    s.bonusTotal = num(r.bonusTotal);
    s.bonusPaid = num(r.bonusPaid);
    s.avgFinalResult = numOrNull(r.avgFinal);
  }
  const submittedRows = await db.select({ cycleId: eventsTable.cycleId, n: sql<number>`count(*)::int` })
    .from(evaluationsTable)
    .innerJoin(eventsTable, eq(evaluationsTable.eventId, eventsTable.id))
    .where(and(inArray(eventsTable.cycleId, cycleIds), eq(evaluationsTable.status, "submitted")))
    .groupBy(eventsTable.cycleId);
  for (const r of submittedRows) {
    const s = r.cycleId != null ? stats.get(r.cycleId) : undefined;
    if (s) s.evaluationsSubmitted = Number(r.n);
  }
  return stats;
}

function parseCycleId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

// Ciclo atual (período de referência). Usado em qualquer tela que mostra
// informação do ciclo, para exibir as datas que o ciclo está considerando.
router.get("/cycles/current", async (_req, res) => {
  const cycle = await getCurrentCycle();
  if (!cycle) { res.status(404).json({ error: "Nenhum ciclo ativo" }); return; }
  res.json(toCycle(cycle, await getMinEventsForEligibility(cycle.id)));
});

// Opções do seletor de ciclo (Resultados, Análises, Dashboard, Eventos): o
// atual primeiro e depois os anteriores, do mais recente ao mais antigo. Sem
// números (só nome, período e situação), por isso aberto a qualquer papel logado.
router.get("/cycles/options", async (_req, res) => {
  const cycles = await db.select().from(cyclesTable).orderBy(desc(cyclesTable.isCurrent), sql`${cyclesTable.startDate} DESC NULLS LAST`, desc(cyclesTable.id));
  const globalMin = await getGlobalMinEvents();
  res.json(cycles.map(c => toCycle(c, globalMin)));
});

// Todos os ciclos, do mais recente ao mais antigo, com os números de cada um.
router.get("/cycles",requireRole(...MANAGERS), async (_req, res) => {
  const cycles = await db.select().from(cyclesTable).orderBy(desc(cyclesTable.isCurrent), sql`${cyclesTable.startDate} DESC NULLS LAST`, desc(cyclesTable.id));
  const stats = await loadCycleStats(cycles.map(c => c.id));
  const globalMin = await getGlobalMinEvents();
  res.json(cycles.map(c => ({ ...toCycle(c, globalMin), stats: stats.get(c.id)! })));
});

// Histórico de um ciclo: números, ranking final (snapshot de quarterly_results)
// e eventos. Somente leitura; vale para o ciclo atual e para os anteriores.
router.get("/cycles/:id/history", requireRole(...MANAGERS), async (req, res) => {
  const id = parseCycleId(req.params.id);
  if (!id) { res.status(400).json({ error: "Ciclo inválido" }); return; }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, id)).limit(1);
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }

  const [stats, rows, events] = await Promise.all([
    loadCycleStats([id]),
    db.select({
      employeeId: quarterlyResultsTable.employeeId,
      employeeName: employeesTable.name,
      employeeActive: employeesTable.active,
      finalResult: quarterlyResultsTable.finalResult,
      platoon: quarterlyResultsTable.platoon,
      platoonColor: quarterlyResultsTable.platoonColor,
      bonusValue: quarterlyResultsTable.bonusValue,
      extraBonusValue: quarterlyResultsTable.extraBonusValue,
      eligible: quarterlyResultsTable.eligible,
      eligibilityReason: quarterlyResultsTable.eligibilityReason,
      eventsCount: quarterlyResultsTable.eventsCount,
      participatedEventsCount: quarterlyResultsTable.participatedEventsCount,
      totalAbsences: quarterlyResultsTable.totalAbsences,
      bonusStatus: quarterlyResultsTable.bonusStatus,
      paidAt: quarterlyResultsTable.paidAt,
    }).from(quarterlyResultsTable)
      .innerJoin(employeesTable, eq(quarterlyResultsTable.employeeId, employeesTable.id))
      .where(and(eq(quarterlyResultsTable.cycleId, id), rankingScope({ activeOnlyInCycleId: cycle.isCurrent ? id : null })))
      .orderBy(sql`${quarterlyResultsTable.finalResult} DESC`, employeesTable.name),
    db.select({
      id: eventsTable.id,
      name: eventsTable.name,
      clientName: eventsTable.clientName,
      city: eventsTable.city,
      state: eventsTable.state,
      startDate: eventsTable.startDate,
      endDate: eventsTable.endDate,
      status: eventsTable.status,
      resultsConfirmed: eventsTable.resultsConfirmed,
      isHistorical: eventsTable.isHistorical,
    }).from(eventsTable)
      .where(eq(eventsTable.cycleId, id))
      .orderBy(desc(eventsTable.startDate), eventsTable.name),
  ]);

  res.json({
    cycle: { ...toCycle(cycle, await getGlobalMinEvents()), stats: stats.get(id)! },
    ranking: rows.map((r, i) => {
      const eligible = r.eligible;
      return {
        position: i + 1,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        employeeActive: r.employeeActive,
        finalResult: num(r.finalResult),
        platoon: r.platoon,
        platoonColor: r.platoonColor,
        bonusValue: eligible ? num(r.bonusValue) : 0,
        extraBonusValue: eligible ? num(r.extraBonusValue) : 0,
        eligible,
        eligibilityReason: r.eligibilityReason,
        eventsCount: r.eventsCount,
        participatedEventsCount: r.participatedEventsCount,
        totalAbsences: r.totalAbsences,
        bonusStatus: r.bonusStatus,
        paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      };
    }),
    events,
  });
});

// Cria um novo ciclo e o marca como atual (só existe um ciclo corrente por vez).
// O ciclo atual precisa estar fechado antes (se tiver eventos): depois que
// outro ciclo vira o atual, o "Fechar Ciclo" não alcança mais o anterior e os
// resultados dele ficariam sem o fechamento oficial no histórico.
router.post("/cycles", requireRole("admin"), async (req, res) => {
  const { name, startDate, endDate } = req.body ?? {};
  const fields = { name: String(name ?? ""), startDate: String(startDate ?? ""), endDate: String(endDate ?? "") };
  const rules = parseCycleRules(req.body ?? {});
  if ("error" in rules) { res.status(400).json({ error: rules.error }); return; }
  const globalMin = await getGlobalMinEvents();

  class CreateCycleError extends Error {
    constructor(public status: number, public body: Record<string, unknown>) { super(String(body.error)); }
  }

  try {
    // TUDO dentro da trava: validação (nome/período), "o atual está fechado?",
    // troca do atual e a mudança dos eventos — dois cliques simultâneos não
    // criam dois ciclos nem movem eventos duas vezes.
    const { created, moved, movedAbsences, previous } = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${CURRENT_CYCLE_LOCK})`);
      const all = await tx.select().from(cyclesTable);
      const error = validateCycleFields(fields, all);
      if (error) throw new CreateCycleError(400, { error });

      const [current] = all.filter(c => c.isCurrent).length > 0
        ? all.filter(c => c.isCurrent)
        : [...all].sort((a, b) => b.id - a.id);
      if (current && current.status !== "closed") {
        // Só os eventos DO período contam como "ciclo com eventos": os de
        // depois do fim vão para o ciclo novo.
        const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(eventsTable)
          .where(and(eq(eventsTable.cycleId, current.id), current.endDate ? lte(eventsTable.startDate, current.endDate) : undefined));
        if (count > 0) {
          throw new CreateCycleError(409, {
            error: `O ciclo atual "${current.name}" ainda está aberto, com ${plural(count, "evento")}. Feche-o em Resultados & Ranking (botão "Fechar Ciclo") antes de criar o próximo, para os resultados dele ficarem guardados no histórico.`,
            requiresClose: true,
          });
        }
      }

      await tx.update(cyclesTable).set({ isCurrent: false }).where(eq(cyclesTable.isCurrent, true));
      // O mínimo de eventos que valeu no ciclo anterior fica gravado nele (se a
      // regra geral mudar depois, o histórico continua certo).
      if (current && current.minEvents == null) {
        await tx.update(cyclesTable).set({ minEvents: globalMin }).where(eq(cyclesTable.id, current.id));
      }
      const [row] = await tx.insert(cyclesTable).values({
        name: fields.name.trim(), startDate: fields.startDate, endDate: fields.endDate, status: "open", isCurrent: true,
        ...rules.values,
      }).returning();
      // Eventos do ciclo anterior que começam DEPOIS do fim dele (startDate —
      // o critério único, ver eventPeriodPosition) passam TODOS para o ciclo
      // novo (M2), junto com as faltas/méritos ligados a eles — não só os que
      // caem dentro do período novo (os demais ficavam presos no ciclo velho,
      // "fora do período", sem contar em ciclo nenhum). Os que ficam fora do
      // período do ciclo novo voltam listados em warnings. Ciclo anterior sem
      // data de fim: vale o período novo, como antes.
      const moveCond = current?.endDate
        ? and(eq(eventsTable.cycleId, current.id), gt(eventsTable.startDate, current.endDate))
        : current ? and(eq(eventsTable.cycleId, current.id), gte(eventsTable.startDate, fields.startDate), lte(eventsTable.startDate, fields.endDate)) : undefined;
      const movedRows = current
        ? await tx.update(eventsTable).set({ cycleId: row.id })
            .where(moveCond)
            .returning({ id: eventsTable.id, name: eventsTable.name, startDate: eventsTable.startDate, resultsConfirmed: eventsTable.resultsConfirmed })
        : [];
      const movedAbs = movedRows.length > 0
        ? await tx.update(absencesTable).set({ cycleId: row.id })
            .where(inArray(absencesTable.eventId, movedRows.map(e => e.id)))
            .returning({ id: absencesTable.id })
        : [];
      return { created: row, moved: movedRows, movedAbsences: movedAbs, previous: current ?? null };
    });

    await audit(req.user!.userId, "create", "cycles", created.id, previous ? { previousCurrentId: previous.id } : null,
      { ...created, movedEventIds: moved.map(e => e.id), movedAbsenceIds: movedAbsences.map(a => a.id) });
    // Evento já confirmado que veio junto conta no ciclo novo na hora.
    const warnings: string[] = [];
    const outsideNew = moved.filter(e => eventPeriodPosition(e, created) !== "inside");
    for (const e of outsideNew) {
      warnings.push(`Evento "${e.name}" (${formatBrDate(e.startDate)}) veio para "${created.name}" mas está fora do período dele (${formatBrDate(created.startDate)} a ${formatBrDate(created.endDate)}): confira a data do evento ou o período do ciclo.`);
    }
    // D1: evento movido que já tem critério com MAIS de uma resposta enviada
    // (avaliado antes, pela regra antiga) num ciclo novo POR ÁREA — a regra
    // nova fecha o critério na primeira resposta; a Central precisa revisar.
    if (created.areaEvaluation && moved.length > 0) {
      const multi = await db.execute<{ event_name: string; criterion_name: string; n: number }>(sql`
        SELECT e.name AS event_name, c.name AS criterion_name, count(*)::int AS n
          FROM evaluations ev
          JOIN events e ON e.id = ev.event_id
          JOIN criteria c ON c.id = ev.criterion_id
         WHERE ev.status = 'submitted' AND ev.event_id IN (${sql.join(moved.map(e => sql`${e.id}`), sql`, `)})
         GROUP BY e.id, e.name, c.id, c.name
        HAVING count(*) > 1
         ORDER BY e.name, c.name`);
      for (const r of multi.rows) {
        warnings.push(`Evento ${r.event_name}: critério ${r.criterion_name} tem ${r.n} respostas enviadas antes da regra por área — revisar na Central`);
      }
    }
    if (moved.some(e => e.resultsConfirmed)) {
      const r = await recomputeCycleResults(created.id, req.user!.userId);
      warnings.push(...r.warnings);
    }
    res.status(201).json({
      ...toCycle(created, await getMinEventsForEligibility(created.id)),
      movedEvents: moved.map(e => ({ id: e.id, name: e.name, outsidePeriod: eventPeriodPosition(e, created) !== "inside" })),
      movedAbsences: movedAbsences.length,
      warnings,
    });
  } catch (err) {
    if (err instanceof CreateCycleError) { res.status(err.status).json(err.body); return; }
    throw err;
  }
});

// Edita nome e período. Ciclo fechado só troca o nome: o período dele já
// gerou resultados oficiais e é referência do histórico.
router.patch("/cycles/:id", requireRole("admin"), async (req, res) => {
  const id = parseCycleId(req.params.id);
  if (!id) { res.status(400).json({ error: "Ciclo inválido" }); return; }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, id)).limit(1);
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }

  const body = req.body ?? {};
  const next = {
    name: body.name !== undefined ? String(body.name) : cycle.name,
    startDate: body.startDate !== undefined ? String(body.startDate) : (cycle.startDate ?? ""),
    endDate: body.endDate !== undefined ? String(body.endDate) : (cycle.endDate ?? ""),
  };
  const datesChanged = next.startDate !== (cycle.startDate ?? "") || next.endDate !== (cycle.endDate ?? "");
  if (cycle.status === "closed" && datesChanged) {
    res.status(409).json({ error: "Ciclo fechado: o período não pode mais ser alterado, só o nome." });
    return;
  }

  const others = await db.select().from(cyclesTable).where(ne(cyclesTable.id, id));
  const error = validateCycleFields(next, others);
  if (error) { res.status(400).json({ error }); return; }
  const rules = parseCycleRules(body);
  if ("error" in rules) { res.status(400).json({ error: rules.error }); return; }
  // Mínimo de eventos e Conduta mudam a nota/bônus: ciclo fechado já gerou o
  // resultado oficial — só a data de pagamento pode mudar.
  const scoringChanged = ("minEvents" in rules.values && rules.values.minEvents !== (cycle.minEvents ?? null))
    || ("conformityWithoutConduta" in rules.values && rules.values.conformityWithoutConduta !== cycle.conformityWithoutConduta)
    || ("areaEvaluation" in rules.values && rules.values.areaEvaluation !== cycle.areaEvaluation);
  if (cycle.status === "closed" && scoringChanged) {
    res.status(409).json({ error: "Ciclo fechado: o mínimo de eventos, a matriz de conformidade e a avaliação por área não podem mais mudar, só a data de pagamento." });
    return;
  }
  // D3: a avaliação por área muda QUEM responde e quando o critério fecha —
  // com resposta já enviada no ciclo, trocar a regra deixaria respostas
  // dadas por uma regra e contadas por outra.
  // B2 (4ª revisão): conferência e gravação na MESMA transação, com a linha do
  // ciclo travada (FOR UPDATE). O envio de avaliação (tela e link) trava a
  // mesma linha em modo compartilhado (lockEventCycleShared): um envio em
  // andamento termina antes da conferência, e um envio que chega depois já
  // vê a regra nova.
  const areaToggle = "areaEvaluation" in rules.values && rules.values.areaEvaluation !== cycle.areaEvaluation;
  const outcome = await db.transaction(async (tx) => {
    await tx.select({ id: cyclesTable.id }).from(cyclesTable).where(eq(cyclesTable.id, id)).for("update");
    if (areaToggle) {
      const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(evaluationsTable)
        .innerJoin(eventsTable, eq(evaluationsTable.eventId, eventsTable.id))
        .where(and(eq(eventsTable.cycleId, id), eq(evaluationsTable.status, "submitted")));
      if (count > 0) return { conflict: count } as const;
    }
    const [row] = await tx.update(cyclesTable)
      .set({ name: next.name.trim(), startDate: next.startDate, endDate: next.endDate, ...rules.values })
      .where(eq(cyclesTable.id, id))
      .returning();
    return { updated: row } as const;
  });
  if ("conflict" in outcome) {
    res.status(409).json({ error: `Este ciclo já tem ${plural(outcome.conflict ?? 0, "avaliação enviada", "avaliações enviadas")}: a avaliação por área não pode mais ser ligada nem desligada nele (as respostas já dadas seguiram a regra atual).`, code: "CYCLE_HAS_EVALUATIONS" });
    return;
  }
  const updated = outcome.updated;
  await audit(req.user!.userId, "update", "cycles", id, cycle, updated);
  // Regra que mexe na nota/bônus — ou o período, que decide quais eventos
  // contam (fora do período = próximo ciclo): recalcula o ciclo na hora.
  if (scoringChanged || datesChanged) await recomputeCycleResults(id, req.user!.userId);
  res.json(toCycle(updated, await getMinEventsForEligibility(updated.id)));
});

// Torna um ciclo ABERTO o atual (ex.: criaram o próximo por engano, ou é
// preciso voltar a um ciclo anterior para fechá-lo). Ciclo fechado não volta
// a ser atual: isso reabriria resultados oficiais já fechados.
router.post("/cycles/:id/set-current", requireRole("admin"), async (req, res) => {
  const id = parseCycleId(req.params.id);
  if (!id) { res.status(400).json({ error: "Ciclo inválido" }); return; }
  const [cycle] = await db.select().from(cyclesTable).where(eq(cyclesTable.id, id)).limit(1);
  if (!cycle) { res.status(404).json({ error: "Ciclo não encontrado" }); return; }
  if (cycle.status === "closed") {
    res.status(409).json({ error: "Ciclo fechado não pode voltar a ser o atual. O histórico dele continua disponível para consulta." });
    return;
  }
  if (cycle.isCurrent) { res.json(toCycle(cycle)); return; }

  const previous = await getCurrentCycle();
  const updated = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${CURRENT_CYCLE_LOCK})`);
    await tx.update(cyclesTable).set({ isCurrent: false }).where(eq(cyclesTable.isCurrent, true));
    const [row] = await tx.update(cyclesTable).set({ isCurrent: true }).where(eq(cyclesTable.id, id)).returning();
    return row;
  });
  await audit(req.user!.userId, "set_current", "cycles", id, previous ? { previousCurrentId: previous.id } : null, updated);
  res.json(toCycle(updated));
});

export default router;
