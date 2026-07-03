import { pgTable, serial, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { areasTable } from "./areas";
import { eventsTable } from "./events";

export const criteriaTable = pgTable("criteria", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  responsibleAreaId: integer("responsible_area_id").references(() => areasTable.id),
  responsibleAreaLabel: text("responsible_area_label"),
  defaultWeight: numeric("default_weight", { precision: 5, scale: 2 }).notNull().default("1"),
  active: boolean("active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  // Critério criado como cópia (duplicado) dentro de um evento específico.
  // Não aparece na lista global de critérios nem é anexado automaticamente a
  // outros eventos na sincronização.
  eventScoped: boolean("event_scoped").notNull().default(false),
});

export const eventCriteriaTable = pgTable("event_criteria", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  active: boolean("active").notNull().default(true),
  weightOverride: numeric("weight_override", { precision: 5, scale: 2 }),
  // Snapshot explícito de publicação parcial deste critério (antes da
  // liberação final do evento). Pode ser republicado várias vezes
  // (sobrescreve a data); a liberação final continua sendo por evento.
  partialPublishedAt: timestamp("partial_published_at"),
});

export const insertCriterionSchema = createInsertSchema(criteriaTable).omit({ id: true });
export const insertEventCriterionSchema = createInsertSchema(eventCriteriaTable).omit({ id: true });
export type InsertCriterion = z.infer<typeof insertCriterionSchema>;
export type Criterion = typeof criteriaTable.$inferSelect;
export type EventCriterion = typeof eventCriteriaTable.$inferSelect;
