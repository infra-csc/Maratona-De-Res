import { pgTable, serial, integer, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { cyclesTable } from "./cycles";
import { usersTable } from "./users";

// Inelegibilidade por ciclo: torna o colaborador inelegível em um ciclo
// específico (ex.: questões disciplinares). Resultado é calculado para histórico,
// mas bônus fica R$ 0.
export const employeeCycleEligibilityTable = pgTable("employee_cycle_eligibility", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  cycleId: integer("cycle_id").notNull().references(() => cyclesTable.id),
  eligible: boolean("eligible").notNull().default(true),
  reason: text("reason"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  employeeCycleUq: uniqueIndex("employee_cycle_eligibility_employee_cycle_uq").on(t.employeeId, t.cycleId),
}));

export const insertEmployeeCycleEligibilitySchema = createInsertSchema(employeeCycleEligibilityTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployeeCycleEligibility = z.infer<typeof insertEmployeeCycleEligibilitySchema>;
export type EmployeeCycleEligibility = typeof employeeCycleEligibilityTable.$inferSelect;
