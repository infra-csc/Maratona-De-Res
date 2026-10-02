import { pgTable, serial, integer, numeric, text, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { timestamptz } from "./columns";
import { employeesTable } from "./employees";
import { cyclesTable } from "./cycles";
import { usersTable } from "./users";

/**
 * Linha do tempo da nota: cada recálculo do ciclo grava aqui, por colaborador,
 * o que mudou (nota final, faixa, bônus, eventos, elegibilidade) e o MOTIVO —
 * a ação que disparou o recálculo (ex.: calibração publicada, resultados
 * confirmados, falta lançada), lida do contexto da auditoria da requisição.
 */
export const scoreChangesTable = pgTable("score_changes", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").notNull().references(() => cyclesTable.id),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  changedAt: timestamptz("changed_at").notNull().default(sql`now()`),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  // Ação que disparou o recálculo (mesmos códigos da auditoria) e o registro afetado.
  causeAction: text("cause_action"),
  causeEntity: text("cause_entity"),
  causeEntityId: text("cause_entity_id"),
  /** JSON com o contexto da ação (eventId, criterionId, pontos…), já sem segredos. */
  causeDetail: text("cause_detail"),
  finalBefore: numeric("final_before", { precision: 5, scale: 2 }),
  finalAfter: numeric("final_after", { precision: 5, scale: 2 }),
  platoonBefore: text("platoon_before"),
  platoonAfter: text("platoon_after"),
  bonusBefore: numeric("bonus_before", { precision: 10, scale: 2 }),
  bonusAfter: numeric("bonus_after", { precision: 10, scale: 2 }),
  eventsBefore: integer("events_before"),
  eventsAfter: integer("events_after"),
  eligibleBefore: boolean("eligible_before"),
  eligibleAfter: boolean("eligible_after"),
}, (t) => ({
  employeeCycleIdx: index("score_changes_employee_cycle_idx").on(t.employeeId, t.cycleId, t.changedAt),
  // Linha do tempo do ciclo inteiro (sem filtro de colaborador).
  cycleChangedIdx: index("score_changes_cycle_changed_idx").on(t.cycleId, t.changedAt),
}));
