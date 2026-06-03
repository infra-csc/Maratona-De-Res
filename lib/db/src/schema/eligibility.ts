import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

// Inelegibilidade trimestral: torna o colaborador inelegível em um trimestre
// específico (ex.: questões disciplinares). Resultado é calculado para histórico,
// mas bônus fica R$ 0.
export const employeeQuarterEligibilityTable = pgTable("employee_quarter_eligibility", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  quarter: integer("quarter").notNull(),
  eligible: boolean("eligible").notNull().default(true),
  reason: text("reason"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmployeeQuarterEligibilitySchema = createInsertSchema(employeeQuarterEligibilityTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmployeeQuarterEligibility = z.infer<typeof insertEmployeeQuarterEligibilitySchema>;
export type EmployeeQuarterEligibility = typeof employeeQuarterEligibilityTable.$inferSelect;
