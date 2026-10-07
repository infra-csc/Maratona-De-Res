import { db, cyclesTable, rulesTable, eventsTable } from "@workspace/db";
import { eq, desc, inArray, sql, type SQL } from "drizzle-orm";
import { logger } from "./logger.js";

/**
 * B7: ciclo FECHADO sem min_events gravado. O fechamento (e a criação do
 * ciclo seguinte) grava o mínimo que valeu; um ciclo fechado antes disso fica
 * vazio e cairia na regra GERAL de hoje — que pode ter mudado. Não muda a
 * conta (seria reescrever o histórico sem saber o valor certo), mas deixa
 * registrado no log, uma vez por ciclo, para o dono gravar o valor.
 */
const warnedClosedWithoutMin = new Set<number>();
function warnClosedWithoutMin(cycle: { id: number; status?: string | null; minEvents?: number | null }, globalMin: number): void {
  if (cycle.status !== "closed" || (cycle.minEvents != null && cycle.minEvents > 0) || warnedClosedWithoutMin.has(cycle.id)) return;
  warnedClosedWithoutMin.add(cycle.id);
  logger.warn({ cycleId: cycle.id, globalMin }, "Ciclo FECHADO sem mínimo de eventos gravado (cycles.min_events): usando a regra geral de hoje. Grave o valor que valeu no fechamento.");
}

/**
 * Resolve o ciclo atual. Por enquanto só existe um ciclo (isCurrent = true).
 * Faz fallback para o ciclo mais recente caso a flag não esteja marcada.
 */
export async function getCurrentCycle() {
  const [current] = await db.select().from(cyclesTable).where(eq(cyclesTable.isCurrent, true)).limit(1);
  if (current) return current;
  const [latest] = await db.select().from(cyclesTable).orderBy(desc(cyclesTable.id)).limit(1);
  return latest ?? null;
}

export async function getCurrentCycleId(): Promise<number | null> {
  const c = await getCurrentCycle();
  return c?.id ?? null;
}

export const DEFAULT_MIN_EVENTS_FOR_ELIGIBILITY = 8;

/**
 * Mínimo de eventos PARTICIPADOS no ciclo para o colaborador ficar elegível ao
 * bônus. Primeiro o do CICLO (cycles.min_events, ex.: 7 no ciclo novo); vazio
 * = Regras do Sistema (chave `min_events_eligibility`), com padrão 8. Sem
 * cycleId, usa o ciclo atual.
 */
export async function getMinEventsForEligibility(cycleId?: number | null): Promise<number> {
  const cycle = cycleId != null
    ? (await db.select({ id: cyclesTable.id, status: cyclesTable.status, minEvents: cyclesTable.minEvents }).from(cyclesTable).where(eq(cyclesTable.id, cycleId)).limit(1))[0]
    : await getCurrentCycle();
  if (cycle?.minEvents != null && cycle.minEvents > 0) return cycle.minEvents;
  const global = await getGlobalMinEvents();
  if (cycle) warnClosedWithoutMin(cycle, global);
  return global;
}

/** Regra GERAL (Regras do Sistema, chave `min_events_eligibility`), padrão 8. */
export async function getGlobalMinEvents(): Promise<number> {
  const [rule] = await db.select().from(rulesTable).where(eq(rulesTable.key, "min_events_eligibility")).limit(1);
  const parsed = rule ? parseInt(rule.value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_EVENTS_FOR_ELIGIBILITY;
}

/**
 * Mínimo de eventos de VÁRIOS ciclos numa consulta só (+ a regra geral uma
 * vez): o do ciclo; vazio = regra geral. Todo id pedido aparece no Map.
 */
export async function getMinEventsByCycle(cycleIds: number[]): Promise<Map<number, number>> {
  const ids = [...new Set(cycleIds)];
  const out = new Map<number, number>();
  if (ids.length === 0) return out;
  const rows = await db.select({ id: cyclesTable.id, status: cyclesTable.status, minEvents: cyclesTable.minEvents }).from(cyclesTable).where(inArray(cyclesTable.id, ids));
  const global = await getGlobalMinEvents();
  for (const r of rows) warnClosedWithoutMin(r, global);
  const byId = new Map(rows.map(r => [r.id, r.minEvents]));
  for (const id of ids) {
    const own = byId.get(id);
    out.set(id, own != null && own > 0 ? own : global);
  }
  return out;
}

/**
 * Condição SQL: o evento NÃO começa depois do fim do seu ciclo — a mesma
 * regra de eventPeriodPosition (lib/cycle-rules.ts), para as consultas que
 * contam eventos do ciclo (fechamento, Análises, relatórios). Exige
 * `events` na consulta.
 */
export function eventWithinItsCycleSql(): SQL {
  return sql`NOT EXISTS (SELECT 1 FROM ${cyclesTable} cx WHERE cx.id = ${eventsTable.cycleId} AND cx.end_date IS NOT NULL AND ${eventsTable.startDate} > cx.end_date)`;
}
