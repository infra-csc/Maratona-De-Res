import { pgTable, serial, text, boolean, date} from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Ciclo da Maratona. Por enquanto só existe o ciclo atual (isCurrent = true).
// Substitui o antigo conceito de ano + trimestre como unidade de período.
export const cyclesTable = pgTable("cycles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("open"), // open | closed
  isCurrent: boolean("is_current").notNull().default(false),
  closedAt: timestamptz("closed_at"),
  createdAt: timestamptz("created_at").notNull().default(sql`now()`),
});

export const insertCycleSchema = createInsertSchema(cyclesTable).omit({ id: true, createdAt: true });
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type Cycle = typeof cyclesTable.$inferSelect;
