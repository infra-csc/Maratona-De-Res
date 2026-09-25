import { pgTable, serial, text, boolean, integer} from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { areasTable } from "./areas";
import { employeesTable } from "./employees";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique(),
  cpfLogin: text("cpf_login").unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("visualizador"),
  areaId: integer("area_id").references(() => areasTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  pinValue: text("pin_value").unique(),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamptz("locked_until"),
  // Versão das sessões: incrementada ao desativar, trocar papel ou senha. O JWT
  // carrega "tv"; se divergir do banco, requireAuth recusa o token.
  tokenVersion: integer("token_version").notNull().default(0),
  createdAt: timestamptz("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
