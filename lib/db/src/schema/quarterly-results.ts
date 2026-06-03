import { pgTable, serial, integer, numeric, text, timestamp, boolean, date } from "drizzle-orm/pg-core";
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
  grossAverage: numeric("gross_average", { precision: 6, scale: 2 }).notNull().default("0"),
  totalAbsences: integer("total_absences").notNull().default(0),
  absencePenalty: numeric("absence_penalty", { precision: 6, scale: 2 }).notNull().default("0"),
  finalResult: numeric("final_result", { precision: 6, scale: 2 }).notNull().default("0"),
  platoon: text("platoon"),
  platoonColor: text("platoon_color"),
  bonusValue: numeric("bonus_value", { precision: 10, scale: 2 }).notNull().default("0"),
  // Elegibilidade e pagamento do bônus
  eligible: boolean("eligible").notNull().default(true),
  eligibilityReason: text("eligibility_reason"),
  bonusStatus: text("bonus_status").notNull().default("projected"), // projected | approved | scheduled | paid | blocked | not_eligible
  paymentMethod: text("payment_method").notNull().default("Caju Saldo Livre"),
  paymentDueDate: date("payment_due_date"),
  paidAt: timestamp("paid_at"),
  paymentNotes: text("payment_notes"),
  closedAt: timestamp("closed_at"),
  closedByUserId: integer("closed_by_user_id").references(() => usersTable.id),
});

export const insertQuarterlyResultSchema = createInsertSchema(quarterlyResultsTable).omit({ id: true });
export type InsertQuarterlyResult = z.infer<typeof insertQuarterlyResultSchema>;
export type QuarterlyResult = typeof quarterlyResultsTable.$inferSelect;
