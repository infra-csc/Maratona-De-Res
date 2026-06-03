import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const quarterlyResultsTable = pgTable("quarterly_results", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  year: integer("year").notNull(),
  quarter: integer("quarter").notNull(),
  eventsCount: integer("events_count").notNull().default(0),
  grossAverage: numeric("gross_average", { precision: 5, scale: 4 }).notNull().default("0"),
  totalAbsences: integer("total_absences").notNull().default(0),
  absencePenalty: numeric("absence_penalty", { precision: 5, scale: 4 }).notNull().default("0"),
  finalResult: numeric("final_result", { precision: 5, scale: 4 }).notNull().default("0"),
  platoon: text("platoon"),
  platoonColor: text("platoon_color"),
  bonusValue: numeric("bonus_value", { precision: 10, scale: 2 }).notNull().default("0"),
  closedAt: timestamp("closed_at"),
  closedByUserId: integer("closed_by_user_id").references(() => usersTable.id),
});

export const insertQuarterlyResultSchema = createInsertSchema(quarterlyResultsTable).omit({ id: true });
export type InsertQuarterlyResult = z.infer<typeof insertQuarterlyResultSchema>;
export type QuarterlyResult = typeof quarterlyResultsTable.$inferSelect;
