import { pgTable, serial, integer, text, date, index } from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { eventsTable } from "./events";
import { cyclesTable } from "./cycles";
import { usersTable } from "./users";

export const absencesTable = pgTable("absences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  eventId: integer("event_id").references(() => eventsTable.id),
  penaltyType: text("penalty_type").notNull().default("falta"),
  kind: text("kind").notNull().default("penalty"),
  points: integer("points").notNull().default(0),
  date: date("date").notNull(),
  cycleId: integer("cycle_id").notNull().references(() => cyclesTable.id),
  quantity: integer("quantity").notNull().default(1),
  reason: text("reason"),
  registeredByUserId: integer("registered_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamptz("created_at").notNull().default(sql`now()`),
}, (t) => ({
  employeeCycleIdx: index("absences_employee_cycle_idx").on(t.employeeId, t.cycleId),
}));

export const insertAbsenceSchema = createInsertSchema(absencesTable).omit({ id: true, createdAt: true });
export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;
export type Absence = typeof absencesTable.$inferSelect;
