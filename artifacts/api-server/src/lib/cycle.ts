import { db, cyclesTable, rulesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

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
 * bônus. Configurável via Regras do Sistema (chave `min_events_eligibility`),
 * com padrão 8.
 */
export async function getMinEventsForEligibility(): Promise<number> {
  const [rule] = await db.select().from(rulesTable).where(eq(rulesTable.key, "min_events_eligibility")).limit(1);
  const parsed = rule ? parseInt(rule.value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_EVENTS_FOR_ELIGIBILITY;
}
