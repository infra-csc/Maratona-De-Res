import { pgTable, serial, text, boolean, integer, numeric, timestamp, date, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";

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
  year: integer("year").notNull(),
  quarter: integer("quarter").notNull(),
  status: text("status").notNull().default("open"),
  forcedClosed: boolean("forced_closed").notNull().default(false),
  forcedCloseReason: text("forced_close_reason"),
  feedbackReleased: boolean("feedback_released").notNull().default(false),
  feedbackReleasedAt: timestamp("feedback_released_at"),
  criteriaConfirmed: boolean("criteria_confirmed").notNull().default(false),
  criteriaConfirmedAt: timestamp("criteria_confirmed_at"),
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
}, (t) => ({
  eventEmployeeUq: uniqueIndex("event_participants_event_employee_uq").on(t.eventId, t.employeeId),
}));

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export const insertEventParticipantSchema = createInsertSchema(eventParticipantsTable).omit({ id: true });
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
export type EventParticipant = typeof eventParticipantsTable.$inferSelect;
