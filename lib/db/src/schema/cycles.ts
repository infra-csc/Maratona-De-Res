import { pgTable, serial, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
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
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCycleSchema = createInsertSchema(cyclesTable).omit({ id: true, createdAt: true });
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type Cycle = typeof cyclesTable.$inferSelect;
