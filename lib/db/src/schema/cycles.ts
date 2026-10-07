import { pgTable, serial, text, boolean, date, integer } from "drizzle-orm/pg-core";
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
  // Regras POR CICLO (vazio = regra global de antes). O ciclo atual segue
  // exatamente como estava; o novo ciclo pode ter as próprias regras.
  // Mínimo de eventos participados para o bônus (vazio = regra global
  // "min_events_eligibility").
  minEvents: integer("min_events"),
  // Data prevista do pagamento do bônus deste ciclo.
  paymentDate: date("payment_date"),
  // "Conduta" fora da Matriz de Conformidade (avaliada no critério
  // Proatividade/Conduta): a pergunta some e conta como "sim" — os outros
  // itens continuam valendo o mesmo.
  conformityWithoutConduta: boolean("conformity_without_conduta").notNull().default(false),
  // Avaliação POR ÁREA (ciclo novo de 2026 em diante): qualquer avaliador da
  // área do critério responde e a PRIMEIRA resposta da área fecha o critério
  // para todos (inclusive designados). false = fluxo antigo por designação.
  areaEvaluation: boolean("area_evaluation").notNull().default(false),
  closedAt: timestamptz("closed_at"),
  createdAt: timestamptz("created_at").notNull().default(sql`now()`),
});

export const insertCycleSchema = createInsertSchema(cyclesTable).omit({ id: true, createdAt: true });
export type InsertCycle = z.infer<typeof insertCycleSchema>;
export type Cycle = typeof cyclesTable.$inferSelect;
