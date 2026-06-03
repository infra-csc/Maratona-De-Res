import { pgTable, serial, integer, text, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { eventsTable } from "./events";
import { usersTable } from "./users";

export const absencesTable = pgTable("absences", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  eventId: integer("event_id").references(() => eventsTable.id),
  date: date("date").notNull(),
  year: integer("year").notNull(),
  quarter: integer("quarter").notNull(),
  quantity: integer("quantity").notNull().default(1),
  reason: text("reason"),
  registeredByUserId: integer("registered_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAbsenceSchema = createInsertSchema(absencesTable).omit({ id: true, createdAt: true });
export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;
export type Absence = typeof absencesTable.$inferSelect;
