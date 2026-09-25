import { db, eventsTable, quarterlyResultsTable, employeesTable, eventParticipantsTable } from "@workspace/db";
import { and, eq, exists, ne, or, sql, type SQL } from "drizzle-orm";

/**
 * Quem entra no ranking de um ciclo — a MESMA regra de routes/ranking.ts, para
 * Resultados, Análises e Ciclos mostrarem os mesmos números:
 * - colaborador da casa (freela não concorre);
 * - cargo global fora de "Sup Ceno *" (participação informativa);
 * - ao menos uma participação que conta nota em evento do próprio ciclo.
 *
 * `activeOnlyInCycleId`: no ciclo atual o ranking mostra só ativos (como a
 * tela de Resultados). Nos ciclos anteriores o histórico mantém quem foi
 * desligado depois. Passe o id do ciclo atual para aplicar o filtro só nele.
 *
 * Exige `quarterly_results` e `employees` na consulta (join por employee_id).
 */
export function rankingScope(opts: { activeOnlyInCycleId?: number | null } = {}): SQL {
  const conditions: SQL[] = [
    eq(employeesTable.employmentType, "casa"),
    sql`(${employeesTable.functionName} IS NULL OR ${employeesTable.functionName} NOT ILIKE 'sup ceno%')`,
    exists(
      db.select({ one: sql`1` })
        .from(eventParticipantsTable)
        .innerJoin(eventsTable, eq(eventParticipantsTable.eventId, eventsTable.id))
        .where(and(
          eq(eventParticipantsTable.employeeId, employeesTable.id),
          eq(eventsTable.cycleId, quarterlyResultsTable.cycleId),
          sql`(${eventParticipantsTable.functionName} IS NULL OR ${eventParticipantsTable.functionName} NOT ILIKE 'sup ceno%')`,
        )),
    ),
  ];
  if (opts.activeOnlyInCycleId != null) {
    conditions.push(or(eq(employeesTable.active, true), ne(quarterlyResultsTable.cycleId, opts.activeOnlyInCycleId))!);
  }
  return and(...conditions)!;
}
