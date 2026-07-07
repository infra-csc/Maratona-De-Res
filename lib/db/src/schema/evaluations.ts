import { pgTable, serial, integer, numeric, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { employeesTable } from "./employees";
import { criteriaTable } from "./criteria";
import { usersTable } from "./users";

// Avaliação por TIME do evento: a nota é por (evento, critério, avaliador).
// O resultado do evento é aplicado a TODOS os participantes do time.
export const evaluationsTable = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  evaluatorUserId: integer("evaluator_user_id").notNull().references(() => usersTable.id),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  comments: text("comments"),
  audioUrl: text("audio_url"),
  commentVisibility: text("comment_visibility").notNull().default("internal"),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Calibração no nível do critério do evento/time (não por colaborador).
export const calibrationsTable = pgTable("calibrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  originalAverageScore: numeric("original_average_score", { precision: 5, scale: 2 }),
  calibratedScore: numeric("calibrated_score", { precision: 5, scale: 2 }).notNull(),
  calibrationReason: text("calibration_reason"),
  calibratedByUserId: integer("calibrated_by_user_id").notNull().references(() => usersTable.id),
  calibratedAt: timestamp("calibrated_at").notNull().defaultNow(),
});

// Resultado do evento gravado por colaborador (mesma nota para todos do time),
// para cálculo trimestral individual.
// Matriz de conformidade: 4 itens fixos preenchidos por RH/admin.
// Cada "não" remove 10 pts da nota de performance do evento.
export const eventConformitiesTable = pgTable("event_conformities", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  // null = PENDENTE (ainda não avaliado, sem penalidade)
  // true  = SIM (conforme)
  // false = NÃO (não conforme, -10 pts / -10% conformidade)
  epi: boolean("epi"),
  estaiamentos: boolean("estaiamentos"),
  guardaEquipamentos: boolean("guarda_equipamentos"),
  conduta: boolean("conduta"),
  epiComment: text("epi_comment"),
  estaiamentosComment: text("estaiamentos_comment"),
  guardaEquipamentosComment: text("guarda_equipamentos_comment"),
  condutaComment: text("conduta_comment"),
  // Cenografia — Q6: "Alguém faltou ou atrasou?" (texto livre, exibido na calibração)
  absencesReport: text("absences_report"),
  // Cenografia — Q7: "Destaque profissional?" (sim/não + justificativa → Fred/Frederico)
  standoutResponse: boolean("standout_response"),
  standoutJustification: text("standout_justification"),
  createdByUserId: integer("created_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  eventUq: uniqueIndex("event_conformities_event_uq").on(t.eventId),
}));

export const employeeEventResultsTable = pgTable("employee_event_results", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  eventScore: numeric("event_score", { precision: 6, scale: 2 }).notNull().default("0"),
  calibratedEventScore: numeric("calibrated_event_score", { precision: 6, scale: 2 }),
  finalEventScore: numeric("final_event_score", { precision: 6, scale: 2 }).notNull().default("0"),
  platoonProjected: text("platoon_projected"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEvaluationSchema = createInsertSchema(evaluationsTable).omit({ id: true, createdAt: true });
export const insertCalibrationSchema = createInsertSchema(calibrationsTable).omit({ id: true, calibratedAt: true });
export const insertEmployeeEventResultSchema = createInsertSchema(employeeEventResultsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventConformitySchema = createInsertSchema(eventConformitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const updateEventConformitySchema = createInsertSchema(eventConformitiesTable).omit({ id: true, eventId: true, createdByUserId: true, createdAt: true, updatedAt: true });
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluationsTable.$inferSelect;
export type Calibration = typeof calibrationsTable.$inferSelect;
export type EmployeeEventResult = typeof employeeEventResultsTable.$inferSelect;
export type EventConformity = typeof eventConformitiesTable.$inferSelect;
export type InsertEventConformity = z.infer<typeof insertEventConformitySchema>;
export type UpdateEventConformity = z.infer<typeof updateEventConformitySchema>;
