import { db, eventsTable, cyclesTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Avaliação POR ÁREA vale por CICLO (cycles.area_evaluation; decisão do dono,
 * 06/10/2026: só no ciclo novo). Num evento desses:
 *  - qualquer avaliador da área do critério responde (sem designação);
 *  - a PRIMEIRA resposta enviada da área fecha o critério para TODOS,
 *    inclusive designados e links de freela;
 *  - o critério conta como "avaliado" com UMA resposta enviada — a lista de
 *    avaliadores designados por área (event_area_assignments) não é exigida.
 * Ciclos sem a marca seguem exatamente o fluxo antigo (por designação).
 */
export async function areaModeEventIds(eventIds: number[]): Promise<Set<number>> {
  const ids = [...new Set(eventIds)];
  if (ids.length === 0) return new Set();
  const rows = await db.select({ id: eventsTable.id }).from(eventsTable)
    .innerJoin(cyclesTable, eq(eventsTable.cycleId, cyclesTable.id))
    .where(and(inArray(eventsTable.id, ids), eq(cyclesTable.areaEvaluation, true)));
  return new Set(rows.map(r => r.id));
}

export async function isAreaModeEvent(eventId: number): Promise<boolean> {
  return (await areaModeEventIds([eventId])).has(eventId);
}

/**
 * Para o status "avaliado": no modo por área, nenhum designado é exigido —
 * devolve a lista vazia (qualquer envio conta). Fora dele, a lista intacta.
 */
export function requiredAssignmentsFor<T>(assignments: T[], areaMode: boolean): T[] {
  return areaMode ? [] : assignments;
}
