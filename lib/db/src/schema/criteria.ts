import { pgTable, serial, text, boolean, integer, numeric, uniqueIndex, type AnyPgColumn } from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { areasTable } from "./areas";
import { eventsTable } from "./events";
import { usersTable } from "./users";

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
  // Critério de origem do qual este foi duplicado (preenchido somente quando
  // eventScoped=true). Permite agrupar cópias com o original na calibração.
  sourceCriterionId: integer("source_criterion_id").references((): AnyPgColumn => criteriaTable.id),
  // Padrão do catálogo: além da área responsável, TODAS as áreas ativas
  // respondem este critério. Cada área vira uma cópia no evento e a nota do
  // critério é a média das áreas (mergeEventScopedCriteria).
  evaluateAllAreas: boolean("evaluate_all_areas").notNull().default(false),
});

// Padrão do catálogo: áreas que respondem o critério ALÉM da responsável
// (ignorado quando evaluate_all_areas = true). Ajuste por evento = cópias.
export const criterionEvaluatingAreasTable = pgTable("criterion_evaluating_areas", {
  id: serial("id").primaryKey(),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id, { onDelete: "cascade" }),
  areaId: integer("area_id").notNull().references(() => areasTable.id, { onDelete: "cascade" }),
}, (t) => ({
  criterionAreaUq: uniqueIndex("criterion_evaluating_areas_uq").on(t.criterionId, t.areaId),
}));

export const eventCriteriaTable = pgTable("event_criteria", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  active: boolean("active").notNull().default(true),
  weightOverride: numeric("weight_override", { precision: 5, scale: 2 }),
  // Snapshot explícito de publicação parcial deste critério (antes da
  // liberação final do evento). Pode ser republicado várias vezes
  // (sobrescreve a data); a liberação final continua sendo por evento.
  partialPublishedAt: timestamptz("partial_published_at"),
  // Publicação "Final" por critério — diferente de parcial apenas na exibição
  // ao colaborador (sem aviso de rascunho). Não trava edição; se a nota mudar
  // após publicar como Final, o colaborador vê o valor atualizado automaticamente.
  finalPublishedAt: timestamptz("final_published_at"),
  // Auditoria de publicação: quem publicou parcial/final
  partialPublishedByUserId: integer("partial_published_by_user_id").references(() => usersTable.id),
  finalPublishedByUserId: integer("final_published_by_user_id").references(() => usersTable.id),
  // Retrato do que o COLABORADOR vê: nota calibrada e justificativa no momento
  // da última publicação (parcial ou final). Calibrar de novo não muda o que
  // ele vê até o calibrador publicar outra vez (regra do dono, 01/10/2026).
  publishedScore: numeric("published_score", { precision: 5, scale: 2 }),
  publishedReason: text("published_reason"),
}, (t) => ({
  // Um vínculo por (evento, critério): corrida entre resync e seeding da
  // integração criava duas linhas e o critério contava duas vezes na nota.
  eventCriterionUq: uniqueIndex("event_criteria_event_criterion_uq").on(t.eventId, t.criterionId),
}));

export const insertCriterionSchema = createInsertSchema(criteriaTable).omit({ id: true });
export const insertEventCriterionSchema = createInsertSchema(eventCriteriaTable).omit({ id: true });
export type InsertCriterion = z.infer<typeof insertCriterionSchema>;
export type Criterion = typeof criteriaTable.$inferSelect;
export type EventCriterion = typeof eventCriteriaTable.$inferSelect;
