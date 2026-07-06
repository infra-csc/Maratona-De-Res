import { pgTable, serial, text, boolean, integer, numeric, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { cyclesTable } from "./cycles";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  name: text("name").notNull(),
  clientName: text("client_name"),
  location: text("location"),
  city: text("city"),
  state: text("state"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  cycleId: integer("cycle_id").notNull().references(() => cyclesTable.id),
  status: text("status").notNull().default("open"),
  forcedClosed: boolean("forced_closed").notNull().default(false),
  forcedCloseReason: text("forced_close_reason"),
  feedbackReleased: boolean("feedback_released").notNull().default(false),
  feedbackReleasedAt: timestamp("feedback_released_at"),
  criteriaConfirmed: boolean("criteria_confirmed").notNull().default(false),
  criteriaConfirmedAt: timestamp("criteria_confirmed_at"),
  // Evento histórico importado sem avaliação individual por critério: a nota
  // já vem pronta (calibrada) de uma planilha/fonte externa e é usada
  // diretamente como eventScore/calibratedEventScore/finalEventScore em
  // recomputeCycleResults, pulando computeEventTeamResult inteiramente.
  isHistorical: boolean("is_historical").notNull().default(false),
  importedScore: numeric("imported_score", { precision: 6, scale: 2 }),
  // Observações livres trazidas de uma importação em massa (ex.: planilha de
  // pesquisa com avaliadores) — texto de referência, nunca entra em cálculo.
  importedNotes: text("imported_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  externalIdUq: uniqueIndex("events_external_id_uq").on(t.externalId),
}));

export const eventParticipantsTable = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  functionName: text("function_name"),
  teamName: text("team_name"),
  confirmed: boolean("confirmed").notNull().default(true),
  // Diárias previstas — vêm da aba Escalação do Logística Interna (sync); nunca
  // editadas manualmente. Ausentes até o app externo expor esses campos.
  scheduledDiariaCount: integer("scheduled_diaria_count"),
  scheduledDiariaStart: date("scheduled_diaria_start"),
  scheduledDiariaEnd: date("scheduled_diaria_end"),
  // Diárias realmente cumpridas — preenchido manualmente por admin/RH dentro da
  // Maratona (o Logística Interna não informa comparecimento real). Nunca
  // sobrescrito pelo sync.
  actualDiariaCount: integer("actual_diaria_count"),
}, (t) => ({
  eventEmployeeUq: uniqueIndex("event_participants_event_employee_uq").on(t.eventId, t.employeeId),
}));

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export const insertEventParticipantSchema = createInsertSchema(eventParticipantsTable).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type EventParticipant = typeof eventParticipantsTable.$inferSelect;
