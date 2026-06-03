import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  externalId: text("external_id"),
  name: text("name").notNull(),
  document: text("document"),
  email: text("email"),
  phone: text("phone"),
  department: text("department").notNull().default("Geral"),
  functionName: text("function_name").notNull().default("Colaborador"),
  active: boolean("active").notNull().default(true),
  // Elegibilidade ao programa de bonificação
  eligibleForBonus: boolean("eligible_for_bonus").notNull().default(true),
  eligibilityStatus: text("eligibility_status").notNull().default("eligible"), // eligible | not_eligible | suspended | terminated
  eligibilityReason: text("eligibility_reason"),
  sourceType: text("source_type").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
