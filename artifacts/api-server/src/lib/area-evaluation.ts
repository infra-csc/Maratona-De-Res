import {
  db, criteriaTable, usersTable, eventCriteriaTable, evaluationsTable, eventAreaAssignmentsTable,
  eventCriterionAssignmentsTable, publicEvalTokensTable, criterionRoutingTable,
  eventsTable, cyclesTable, eventConformitiesTable, auditLogsTable,
} from "@workspace/db";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { isRole } from "./auth.js";
import type { DbOrTx } from "./db-tx.js";
import { isOpenForEvaluation, opensLabel } from "./evaluation-dates.js";

/**
 * AVALIAÇÃO POR ÁREA (decisão do dono, 06/10/2026) — vale por CICLO
 * (cycles.area_evaluation; ver lib/area-mode.ts).
 *
 * Evento de ciclo COM a marca (modo por área):
 *  - responde SÓ quem é da área do critério: avaliador cuja área do cadastro
 *    (users.area_id) é a área do critério (o pai ou a cópia por área: cada
 *    cópia tem a própria responsible_area_id). Designação ou redirecionamento
 *    para alguém de outra área não dá direito (D2, 06/10/2026); admin/RH
 *    também NÃO respondem critério (M2, 4ª revisão: só o papel avaliador
 *    avalia — ajuste de nota é na Calibração; links de freela gerados por
 *    eles seguem valendo);
 *  - a PRIMEIRA resposta enviada (de QUALQUER um: designado, da área, freela
 *    por link) FECHA o critério naquele evento para TODOS. Rascunho não fecha.
 *
 * Evento de ciclo SEM a marca: exatamente o fluxo antigo — só designados
 * avaliam (a área do cadastro não dá acesso), nada fecha, e os designados da
 * mesma área somam na média.
 *
 * Contra corrida, todo envio trava a linha (evento, critério) em event_criteria
 * (SELECT … FOR UPDATE) antes de conferir e gravar: duas pessoas enviando
 * juntas → a segunda espera, vê a primeira já gravada e recebe 409.
 */

/**
 * O evento está no modo por área? Igual a isAreaModeEvent (lib/area-mode.ts),
 * mas usando o executor recebido — dentro de uma transação não se usa `db`.
 */
export async function eventAreaMode(eventId: number, exec: DbOrTx = db): Promise<boolean> {
  const [row] = await exec.select({ on: cyclesTable.areaEvaluation }).from(eventsTable)
    .innerJoin(cyclesTable, eq(eventsTable.cycleId, cyclesTable.id))
    .where(eq(eventsTable.id, eventId)).limit(1);
  return row?.on === true;
}

/** Área do cadastro do usuário (lida do banco: o JWT pode estar desatualizado). */
export async function getUserAreaId(userId: number, exec: DbOrTx = db): Promise<number | null> {
  const [u] = await exec.select({ areaId: usersTable.areaId }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return u?.areaId ?? null;
}

/**
 * Fluxo antigo: `userId` está designado para este critério neste evento?
 * Registro por critério com alguém designado manda (é o que faz o
 * redirecionamento tirar o acesso de quem redirecionou); sem ele, vale a
 * designação evento→área→avaliador.
 */
export async function isAssignedForCriterion(eventId: number, criterionId: number, userId: number, exec: DbOrTx = db): Promise<boolean> {
  const [criterionAssignment] = await exec
    .select({ assignedToId: eventCriterionAssignmentsTable.assignedToId })
    .from(eventCriterionAssignmentsTable)
    .where(and(
      eq(eventCriterionAssignmentsTable.eventId, eventId),
      eq(eventCriterionAssignmentsTable.criterionId, criterionId),
    ))
    .limit(1);
  // Linha "pending" sem ninguém designado não corta o fallback por área.
  if (criterionAssignment?.assignedToId != null) return criterionAssignment.assignedToId === userId;

  const [crit] = await exec
    .select({ areaId: criteriaTable.responsibleAreaId })
    .from(criteriaTable)
    .where(eq(criteriaTable.id, criterionId))
    .limit(1);
  if (!crit || crit.areaId == null) return false;
  const [areaAssignment] = await exec
    .select({ id: eventAreaAssignmentsTable.id })
    .from(eventAreaAssignmentsTable)
    .where(and(
      eq(eventAreaAssignmentsTable.eventId, eventId),
      eq(eventAreaAssignmentsTable.areaId, crit.areaId),
      eq(eventAreaAssignmentsTable.evaluatorUserId, userId),
    ))
    .limit(1);
  return !!areaAssignment;
}

/** O critério está ATIVO neste evento e é da área `areaId`? */
export async function isAreaCriterionInEvent(eventId: number, criterionId: number, areaId: number, exec: DbOrTx = db): Promise<boolean> {
  const [row] = await exec.select({ id: eventCriteriaTable.id })
    .from(eventCriteriaTable)
    .innerJoin(criteriaTable, eq(eventCriteriaTable.criterionId, criteriaTable.id))
    .where(and(
      eq(eventCriteriaTable.eventId, eventId),
      eq(eventCriteriaTable.criterionId, criterionId),
      eq(eventCriteriaTable.active, true),
      eq(criteriaTable.responsibleAreaId, areaId),
    ))
    .limit(1);
  return !!row;
}

export interface EvaluationAccess {
  allowed: boolean;
  /**
   * M2 (4ª revisão, decisão do dono "só o papel avaliador avalia"): admin/RH
   * recusados porque o evento é de ciclo por área — a recusa tem mensagem e
   * código próprios (AREA_MODE_EVALUATOR_ONLY).
   */
  managerBlocked?: boolean;
  /** Entrou pela área do cadastro (não designado). Só existe no modo por área. */
  viaArea: boolean;
  /**
   * Evento no modo por área: a primeira resposta enviada (de qualquer um)
   * fecha o critério para TODOS — designados, área, admin/RH e links.
   */
  firstAnswerCloses: boolean;
}

/**
 * Permissão para criar/editar/enviar a avaliação de `criterionId` no evento.
 *  - Fluxo antigo: admin e RH podem responder qualquer critério (como antes).
 *  - Modo por área (M2, 4ª revisão — decisão do dono "só o papel avaliador
 *    avalia"): admin e RH NÃO lançam nem enviam avaliação de critério; ajuste
 *    de nota é na Calibração. Links de freela gerados por eles seguem valendo
 *    (o link não passa por aqui).
 * Demais papéis que chegam aqui seguem o comportamento anterior: a rota decide.
 */
export async function evaluationAccess(
  eventId: number, criterionId: number, user: { userId: number; role: string }, exec: DbOrTx = db,
): Promise<EvaluationAccess> {
  const areaMode = await eventAreaMode(eventId, exec);
  if (!isRole(user.role, "avaliador")) {
    if (areaMode) return { allowed: false, managerBlocked: true, viaArea: false, firstAnswerCloses: true };
    return { allowed: true, viaArea: false, firstAnswerCloses: false };
  }
  // Fluxo antigo: só a designação dá acesso (a área do cadastro não).
  if (!areaMode) return { allowed: await isAssignedForCriterion(eventId, criterionId, user.userId, exec), viaArea: false, firstAnswerCloses: false };
  // D2 (06/10/2026): no modo por área, SÓ a área do cadastro dá acesso —
  // designação ou redirecionamento para alguém de outra área não dá direito.
  const areaId = await getUserAreaId(user.userId, exec);
  if (areaId != null && await isAreaCriterionInEvent(eventId, criterionId, areaId, exec)) return { allowed: true, viaArea: true, firstAnswerCloses: true };
  return { allowed: false, viaArea: false, firstAnswerCloses: true };
}

export const NO_ACCESS_MESSAGE = "Este critério não é da sua área e você não foi designado para ele neste evento.";
/** D2: no modo por área, a recusa diz o motivo certo (a designação não conta). */
export const NO_ACCESS_AREA_MODE_MESSAGE = "Este critério não é da sua área. Neste ciclo a avaliação é por área: só quem é da área do critério responde (designação ou redirecionamento para outra área não dá acesso).";
/** M2: admin/RH no evento de ciclo por área. */
export const AREA_MODE_EVALUATOR_ONLY_MESSAGE = "No ciclo por área, só o avaliador da área responde. Ajustes de nota são feitos na Calibração.";
export const AREA_MODE_EVALUATOR_ONLY_CODE = "AREA_MODE_EVALUATOR_ONLY";
export function noAccessMessage(access: EvaluationAccess): string {
  if (access.managerBlocked) return AREA_MODE_EVALUATOR_ONLY_MESSAGE;
  return access.firstAnswerCloses ? NO_ACCESS_AREA_MODE_MESSAGE : NO_ACCESS_MESSAGE;
}
/** Corpo do 403 de quem não pode avaliar o critério (com o código quando há um). */
export function noAccessBody(access: EvaluationAccess): { error: string; code?: string } {
  return access.managerBlocked
    ? { error: AREA_MODE_EVALUATOR_ONLY_MESSAGE, code: AREA_MODE_EVALUATOR_ONLY_CODE }
    : { error: noAccessMessage(access) };
}

/**
 * B2 (4ª revisão): trava COMPARTILHADA na linha do ciclo do evento, até o fim
 * da transação. O PATCH /cycles que liga/desliga a avaliação por área trava a
 * mesma linha com FOR UPDATE: envio e troca de regra nunca se cruzam — ou o
 * envio vê a regra nova, ou a troca vê o envio (e recusa com 409).
 */
export async function lockEventCycleShared(tx: DbOrTx, eventId: number): Promise<void> {
  await tx.execute(sql`SELECT c.id FROM cycles c JOIN events e ON e.cycle_id = c.id WHERE e.id = ${eventId} FOR SHARE OF c`);
}

/**
 * Trava (até o fim da transação) a linha do critério no evento. Todo envio
 * passa por aqui antes de conferir se já foi respondido, então dois envios
 * simultâneos do mesmo critério são serializados.
 */
export async function lockCriterionInEvent(tx: DbOrTx, eventId: number, criterionIds: number[]): Promise<void> {
  if (criterionIds.length === 0) return;
  // Ordem fixa evita deadlock entre envios com vários critérios.
  await tx.select({ id: eventCriteriaTable.id })
    .from(eventCriteriaTable)
    .where(and(eq(eventCriteriaTable.eventId, eventId), inArray(eventCriteriaTable.criterionId, [...new Set(criterionIds)])))
    .orderBy(asc(eventCriteriaTable.criterionId))
    .for("update");
}

export interface Closure {
  evaluationId: number;
  evaluatorUserId: number;
  /** Quem respondeu: o nome do freela quando veio por link, senão o do usuário. */
  name: string;
  viaLink: boolean;
  submittedAt: Date | null;
}

/**
 * Primeira avaliação ENVIADA de cada (evento, critério). A resposta por link
 * público é gravada em nome de quem gerou o link; aqui o nome exibido é o de
 * quem preencheu (vínculo evaluations.public_token_id — ver tokenSubmitterNameSql).
 */
export async function loadClosures(
  exec: DbOrTx, eventIds: number[], criterionIds?: number[], opts: { evaluatorUserId?: number; exceptEvaluationId?: number } = {},
): Promise<Map<string, Closure>> {
  const out = new Map<string, Closure>();
  if (eventIds.length === 0 || (criterionIds && criterionIds.length === 0)) return out;
  const conds = [inArray(evaluationsTable.eventId, eventIds), eq(evaluationsTable.status, "submitted")];
  if (criterionIds) conds.push(inArray(evaluationsTable.criterionId, criterionIds));
  if (opts.evaluatorUserId != null) conds.push(eq(evaluationsTable.evaluatorUserId, opts.evaluatorUserId));
  if (opts.exceptEvaluationId != null) conds.push(ne(evaluationsTable.id, opts.exceptEvaluationId));
  const rows = await exec.select({
    id: evaluationsTable.id,
    eventId: evaluationsTable.eventId,
    criterionId: evaluationsTable.criterionId,
    evaluatorUserId: evaluationsTable.evaluatorUserId,
    userName: usersTable.name,
    submittedAt: evaluationsTable.submittedAt,
    linkName: tokenSubmitterNameSql(),
  })
    .from(evaluationsTable)
    .leftJoin(usersTable, eq(evaluationsTable.evaluatorUserId, usersTable.id))
    .where(and(...conds))
    .orderBy(asc(evaluationsTable.submittedAt), asc(evaluationsTable.id));
  for (const r of rows) {
    const key = `${r.eventId}:${r.criterionId}`;
    if (out.has(key)) continue;
    out.set(key, {
      evaluationId: r.id,
      evaluatorUserId: r.evaluatorUserId,
      name: r.linkName ?? r.userName ?? "avaliador removido",
      viaLink: r.linkName != null,
      submittedAt: r.submittedAt,
    });
  }
  return out;
}

/**
 * Nome de quem preencheu pelo link público a avaliação da linha corrente de
 * `evaluations` (null = não veio por link): SÓ o vínculo explícito
 * evaluations.public_token_id (migração 0011) — sem adivinhar pelo horário.
 *  - envio pelo link desde a 0011: gravado no próprio envio;
 *  - envio ANTIGO pelo link: a 0011 preenche o vínculo uma vez (backfill:
 *    mesmo evento, mesmo avaliador, link que cobre o critério, usado entre
 *    1 s antes e 5 s depois do envio, candidato único, e sem a auditoria de
 *    envio pela TELA — B4, ver o topo da 0011). O código antigo NÃO
 *    gravava os dois instantes com o mesmo valor (eram relógios separados),
 *    por isso a busca exata pelo instante, usada antes, errava;
 *  - envio pela TELA: vínculo nulo, nunca atribuído a um freela.
 */
export function tokenSubmitterNameSql() {
  return sql<string | null>`(SELECT t.submitter_name FROM ${publicEvalTokensTable} t WHERE t.id = ${evaluationsTable.publicTokenId})`;
}

/** Primeira resposta enviada do critério no evento, sem contar a avaliação `exceptEvaluationId`. */
export async function findClosure(exec: DbOrTx, eventId: number, criterionId: number, exceptEvaluationId?: number): Promise<Closure | null> {
  const all = await loadClosures(exec, [eventId], [criterionId], { exceptEvaluationId });
  return all.get(`${eventId}:${criterionId}`) ?? null;
}

/**
 * Link público: quais critérios do token já estão FECHADOS para quem gerou.
 * O link responde em nome de quem o gerou:
 *  - modo por área: fechado se QUALQUER pessoa já enviou (primeira resposta
 *    fecha para todos, inclusive o designado e o link dele);
 *  - fluxo antigo: fechado só se quem gerou já enviou.
 * Devolve só os fechados (critério → quem respondeu).
 */
export async function tokenCriterionClosures(
  exec: DbOrTx, eventId: number, createdByUserId: number, criterionIds: number[],
): Promise<Map<number, Closure>> {
  const out = new Map<number, Closure>();
  if (criterionIds.length === 0) return out;
  // Em sequência: `exec` pode ser uma transação (um cliente só).
  const areaMode = await eventAreaMode(eventId, exec);
  const found = areaMode
    ? await loadClosures(exec, [eventId], criterionIds)
    : await loadClosures(exec, [eventId], criterionIds, { evaluatorUserId: createdByUserId });
  for (const id of criterionIds) {
    const c = found.get(`${eventId}:${id}`);
    if (c) out.set(id, c);
  }
  return out;
}

/** "05/10 14:30" no fuso de Brasília (independe do TZ do servidor). */
export function fmtBrDateTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`;
}

export function closedMessage(c: Closure): string {
  const quem = c.viaLink ? `${c.name} (pelo link de freela)` : c.name;
  const quando = c.submittedAt ? ` em ${fmtBrDateTime(c.submittedAt)}` : "";
  return `Já respondido por ${quem}${quando}. A primeira resposta enviada fecha o critério neste evento.`;
}

/**
 * Trava "só a partir do dia seguinte ao evento" (Brasília). Devolve a
 * mensagem de recusa, ou null quando a avaliação do evento já abriu.
 */
export async function dayAfterLockMessage(eventId: number, exec: DbOrTx = db): Promise<string | null> {
  const [ev] = await exec.select({ startDate: eventsTable.startDate, endDate: eventsTable.endDate })
    .from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
  if (!ev || isOpenForEvaluation(ev)) return null;
  return `A avaliação deste evento abre ${opensLabel(ev)} (dia seguinte ao evento).`;
}

/** Admin e RH podem sempre (sem a trava do dia seguinte). */
export function isAdminOrRh(role: string): boolean {
  return isRole(role, "admin") || isRole(role, "rh");
}

/**
 * O link público foi gerado por alguém sujeito à trava do dia seguinte?
 * Não: quem gerou é admin/RH, ou o link foi gerado por admin/RH em nome de um
 * avaliador (POST /events/:id/admin-public-token — a auditoria guarda quem).
 */
export async function tokenSubjectToDayLock(token: { id: string; createdByUserId: number | null }, exec: DbOrTx = db): Promise<boolean> {
  if (token.createdByUserId == null) return false;
  const [creator] = await exec.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, token.createdByUserId)).limit(1);
  if (creator && isAdminOrRh(creator.role)) return false;
  const [adminLink] = await exec.select({ role: usersTable.role })
    .from(auditLogsTable)
    .innerJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
    .where(and(
      eq(auditLogsTable.entity, "public_eval_tokens"),
      eq(auditLogsTable.entityId, token.id),
      eq(auditLogsTable.action, "create_admin_link"),
    ))
    .limit(1);
  return !(adminLink && isAdminOrRh(adminLink.role));
}

export interface ConformityAnswered {
  answered: boolean;
  /** Quem respondeu (nome gravado no envio), quando se sabe. */
  byName: string | null;
}

/**
 * A parte de Cenografia da Matriz de Conformidade já tem resposta? Qualquer
 * item já preenchido conta: o link combinado nunca sobrescreve o que o
 * responsável (ou outro link) já respondeu.
 */
export async function cenografiaConformityAnswered(eventId: number, exec: DbOrTx = db): Promise<ConformityAnswered> {
  const [row] = await exec.select({
    epi: eventConformitiesTable.epi, estaiamentos: eventConformitiesTable.estaiamentos, conduta: eventConformitiesTable.conduta,
    standoutResponse: eventConformitiesTable.standoutResponse, absencesReport: eventConformitiesTable.absencesReport,
    byName: eventConformitiesTable.cenografiaSubmittedByName, createdBy: usersTable.name,
  }).from(eventConformitiesTable)
    .leftJoin(usersTable, eq(eventConformitiesTable.createdByUserId, usersTable.id))
    .where(eq(eventConformitiesTable.eventId, eventId)).limit(1);
  if (!row) return { answered: false, byName: null };
  const answered = [row.epi, row.estaiamentos, row.conduta, row.standoutResponse].some(v => v != null) || !!row.absencesReport?.trim();
  return { answered, byName: answered ? (row.byName ?? row.createdBy ?? null) : null };
}

/**
 * A parte de Ferramentas (Guarda de Equipamentos) da Matriz já tem resposta?
 * Mesma regra da Cenografia: o link nunca sobrescreve o que já foi respondido.
 */
export async function ferramentasConformityAnswered(eventId: number, exec: DbOrTx = db): Promise<ConformityAnswered> {
  const [row] = await exec.select({
    guarda: eventConformitiesTable.guardaEquipamentos,
    byName: eventConformitiesTable.ferramentasSubmittedByName, createdBy: usersTable.name,
  }).from(eventConformitiesTable)
    .leftJoin(usersTable, eq(eventConformitiesTable.createdByUserId, usersTable.id))
    .where(eq(eventConformitiesTable.eventId, eventId)).limit(1);
  if (!row || row.guarda == null) return { answered: false, byName: null };
  return { answered: true, byName: row.byName ?? row.createdBy ?? null };
}

export function conformityClosedMessage(c: ConformityAnswered): string {
  return `A Matriz de Conformidade deste evento já foi respondida${c.byName ? ` por ${c.byName}` : ""}. A resposta que está lá foi mantida.`;
}

/** Erro de "critério já fechado pela área" lançado dentro das transações de envio. */
export class AreaClosedError extends Error {
  constructor(readonly closure: Closure) { super(closedMessage(closure)); }
}

/** Critério de origem (para cópias por área) → allowPublicLink do roteamento. */
export async function allowPublicLinkByCriterion(criterionIds: number[], exec: DbOrTx = db): Promise<Map<number, boolean>> {
  const out = new Map<number, boolean>();
  if (criterionIds.length === 0) return out;
  const crits = await exec.select({ id: criteriaTable.id, sourceId: criteriaTable.sourceCriterionId, eventScoped: criteriaTable.eventScoped })
    .from(criteriaTable).where(inArray(criteriaTable.id, criterionIds));
  const originOf = new Map(crits.map(c => [c.id, c.eventScoped && c.sourceId != null ? c.sourceId : c.id]));
  const origins = [...new Set(originOf.values())];
  const routings = await exec.select({ criterionId: criterionRoutingTable.criterionId, allow: criterionRoutingTable.allowPublicLink })
    .from(criterionRoutingTable).where(inArray(criterionRoutingTable.criterionId, origins));
  const allowByOrigin = new Map(routings.map(r => [r.criterionId, r.allow]));
  for (const id of criterionIds) out.set(id, allowByOrigin.get(originOf.get(id) ?? id) === true);
  return out;
}

/**
 * Critérios da área do usuário, ABERTOS (sem resposta enviada) e que permitem
 * link público, neste evento — o que um avaliador da área pode mandar para um
 * freela. Só eventos com critérios confirmados e abertos, e só no modo por
 * área (no fluxo antigo a área do cadastro não dá acesso).
 */
export async function areaLinkEligibleCriteria(
  eventId: number, user: { userId: number; role: string }, exec: DbOrTx = db,
): Promise<{ criterionId: number; criterionName: string }[]> {
  if (!isRole(user.role, "avaliador")) return [];
  const areaId = await getUserAreaId(user.userId, exec);
  if (areaId == null) return [];
  const rows = await exec.execute<{ criterion_id: number; name: string }>(sql`
    SELECT c.id AS criterion_id, c.name
      FROM event_criteria ec
      JOIN criteria c ON c.id = ec.criterion_id
      JOIN events e ON e.id = ec.event_id
      JOIN cycles cy ON cy.id = e.cycle_id
     WHERE ec.event_id = ${eventId} AND ec.active AND c.responsible_area_id = ${areaId}
       AND e.criteria_confirmed AND e.status = 'open' AND cy.area_evaluation
       AND NOT EXISTS (SELECT 1 FROM evaluations ev WHERE ev.event_id = ec.event_id AND ev.criterion_id = c.id AND ev.status = 'submitted')
     ORDER BY c.display_order, c.id`);
  const list = rows.rows.map(r => ({ criterionId: Number(r.criterion_id), criterionName: r.name }));
  const allow = await allowPublicLinkByCriterion(list.map(c => c.criterionId), exec);
  return list.filter(c => allow.get(c.criterionId));
}

export const AREA_MODE_LINK_REASON = "No ciclo por área, só o avaliador da área do critério responde — este link foi gerado em nome de alguém de outra área.";

/**
 * Ciclo por área: critérios (entre `criterionIds`) que `userId` NÃO pode
 * responder — ele não é avaliador ativo da área responsável pelo critério.
 * Vale para o link de freela (responde em nome de quem o gerou/recebeu): a
 * designação ou o link não dão direito a critério de outra área. Fora do
 * modo por área, devolve vazio (fluxo antigo intacto).
 */
export async function areaModeForeignCriteria(
  exec: DbOrTx, eventId: number, userId: number, criterionIds: number[],
): Promise<Set<number>> {
  const ids = [...new Set(criterionIds)];
  if (ids.length === 0 || !(await eventAreaMode(eventId, exec))) return new Set();
  const [u] = await exec.select({ areaId: usersTable.areaId, role: usersTable.role, active: usersTable.active })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const rows = await exec.select({ id: criteriaTable.id, areaId: criteriaTable.responsibleAreaId })
    .from(criteriaTable).where(inArray(criteriaTable.id, ids));
  const ok = !!u && u.active !== false && isRole(u.role, "avaliador") && u.areaId != null;
  return new Set(rows.filter(r => !ok || r.areaId !== u!.areaId).map(r => r.id));
}
