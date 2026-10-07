import { db, eventsTable, cyclesTable } from "@workspace/db";
import { inArray, sql, type SQL } from "drizzle-orm";
import { isAfterCycleEnd } from "./cycle-rules.js";
import { isOpenForEvaluation, todayBR } from "./evaluation-dates.js";
import type { DbOrTx } from "./db-tx.js";

/**
 * EVENTO DO PRÓXIMO CICLO (decisão do dono, 06/10/2026 — achados A3+M1).
 *
 * Evento "fora do período" = data de INÍCIO depois do fim do ciclo em que está
 * guardado (eventPeriodPosition = "after"). Ele é do PRÓXIMO ciclo:
 *  - NÃO é liberado sozinho para avaliação (lib/evaluation-release.ts);
 *  - NÃO aceita avaliação, matriz nem link público — tela, my-area, link
 *    público e geração de link respondem 409 { code: "EVENT_NEXT_CYCLE" };
 *  - a PREPARAÇÃO continua livre: equipe, critérios, dados do evento, quem
 *    responde a matriz;
 *  - o POST /cycles o move para o ciclo novo; dali em diante vale a regra
 *    normal (liberação no dia seguinte ao fim do evento).
 */
export const NEXT_CYCLE_CODE = "EVENT_NEXT_CYCLE";
export const NEXT_CYCLE_ERROR = "Este evento é do próximo ciclo: abre para avaliação quando o ciclo novo for criado.";

/** Corpo padrão do 409 de evento do próximo ciclo. */
export function nextCycleBody(extra: Record<string, unknown> = {}) {
  return { error: NEXT_CYCLE_ERROR, code: NEXT_CYCLE_CODE, nextCycle: true, ...extra };
}

/** Quais destes eventos são do próximo ciclo (começam depois do fim do ciclo em que estão). */
export async function eventsInNextCycle(eventIds: number[], exec: DbOrTx = db): Promise<Set<number>> {
  const ids = [...new Set(eventIds.filter(n => Number.isInteger(n) && n > 0 && n <= 2_147_483_647))];
  if (ids.length === 0) return new Set();
  const rows = await exec.select({ id: eventsTable.id, startDate: eventsTable.startDate, endDate: cyclesTable.endDate })
    .from(eventsTable)
    .innerJoin(cyclesTable, sql`${cyclesTable.id} = ${eventsTable.cycleId}`)
    .where(inArray(eventsTable.id, ids));
  return new Set(rows.filter(r => isAfterCycleEnd(r, { endDate: r.endDate })).map(r => r.id));
}

export async function isEventInNextCycle(eventId: number, exec: DbOrTx = db): Promise<boolean> {
  return (await eventsInNextCycle([eventId], exec)).has(eventId);
}

/**
 * "ABERTO PARA AVALIAÇÃO" — a regra ÚNICA do app (Dashboard, Ciclos, lista de
 * Eventos, tela do avaliador). Um evento está aberto quando:
 *  1. não é histórico (importado com nota pronta);
 *  2. status do evento = "open";
 *  3. está DENTRO do período do ciclo (não é do próximo ciclo);
 *  4. o ciclo dele não está fechado;
 *  5. hoje (Brasília) já é o dia seguinte ao fim do evento ou depois.
 * (A confirmação dos critérios é feita sozinha no dia seguinte — lib/evaluation-release.ts.)
 */
export function isEventOpenForEvaluation(
  ev: { isHistorical: boolean; status: string; startDate: string | null; endDate: string | null },
  cycle: { status: string; endDate: string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  if (ev.isHistorical || ev.status !== "open") return false;
  if (!cycle || cycle.status === "closed") return false;
  if (isAfterCycleEnd(ev, cycle)) return false;
  return isOpenForEvaluation(ev, now);
}

/** A mesma regra em SQL (exige `events` na consulta). */
export function eventOpenForEvaluationSql(today: string = todayBR()): SQL {
  return sql`(NOT ${eventsTable.isHistorical} AND ${eventsTable.status} = 'open'
    AND coalesce(${eventsTable.endDate}, ${eventsTable.startDate}) < ${today}
    AND EXISTS (SELECT 1 FROM ${cyclesTable} co WHERE co.id = ${eventsTable.cycleId} AND co.status <> 'closed'
                  AND (co.end_date IS NULL OR ${eventsTable.startDate} <= co.end_date)))`;
}
