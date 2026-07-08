import { pgTable, serial, integer, boolean, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { criteriaTable } from "./criteria";
import { usersTable } from "./users";
import { areasTable } from "./areas";
import { eventsTable } from "./events";

/**
 * Roteamento global por critério: quem avalia por padrão e como pode
 * redirecionar. Configurado por admin/RH na tela de critérios.
 *
 * redirect_mode:
 *   'area'     → pode redirecionar para qualquer usuário da redirect_area_id
 *   'specific' → pode redirecionar apenas para usuários listados em
 *                criterion_redirect_users
 *   'none'     → sem redirecionamento permitido
 */
export const criterionRoutingTable = pgTable("criterion_routing", {
  id: serial("id").primaryKey(),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id, { onDelete: "cascade" }),
  defaultEvaluatorId: integer("default_evaluator_id").references(() => usersTable.id, { onDelete: "set null" }),
  commentRequired: boolean("comment_required").notNull().default(true),
  redirectMode: text("redirect_mode").notNull().default("area"),
  redirectAreaId: integer("redirect_area_id").references(() => areasTable.id, { onDelete: "set null" }),
  allowPublicLink: boolean("allow_public_link").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  criterionUq: uniqueIndex("criterion_routing_criterion_uq").on(t.criterionId),
}));

/**
 * Usuários permitidos como destino de redirecionamento quando
 * redirect_mode = 'specific'.
 */
export const criterionRedirectUsersTable = pgTable("criterion_redirect_users", {
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: uniqueIndex("criterion_redirect_users_uq").on(t.criterionId, t.userId),
}));

/**
 * Atribuição por critério por evento: quem realmente vai avaliar cada critério
 * em cada evento. Gerado automaticamente a partir do criterion_routing ao criar
 * ou sincronizar o evento — o avaliador padrão vira sugestão e RH confirma.
 *
 * status:
 *   'suggested'   → sugerido pelo routing, aguarda confirmação RH
 *   'confirmed'   → confirmado por RH/admin, aguardando avaliação
 *   'redirected'  → avaliador original redirecionou para outro usuário
 *   'submitted'   → avaliação enviada
 */
export const eventCriterionAssignmentsTable = pgTable("event_criterion_assignments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id, { onDelete: "set null" }),
  status: text("status").notNull().default("suggested"),
  redirectedFromId: integer("redirected_from_id").references(() => usersTable.id, { onDelete: "set null" }),
  confirmedByUserId: integer("confirmed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  eventCriterionUq: uniqueIndex("event_criterion_assignments_uq").on(t.eventId, t.criterionId),
}));

/**
 * Tokens de avaliação pública para freelancers (Ativação, Produção, Cenografia).
 * O link é single-use: depois de usado o token expira.
 */
export const publicEvalTokensTable = pgTable("public_eval_tokens", {
  id: text("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  recipientName: text("recipient_name"),
  submitterName: text("submitter_name"),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCriterionRoutingSchema = createInsertSchema(criterionRoutingTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEventCriterionAssignmentSchema = createInsertSchema(eventCriterionAssignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type CriterionRouting = typeof criterionRoutingTable.$inferSelect;
export type CriterionRedirectUser = typeof criterionRedirectUsersTable.$inferSelect;
export type EventCriterionAssignment = typeof eventCriterionAssignmentsTable.$inferSelect;
export type PublicEvalToken = typeof publicEvalTokensTable.$inferSelect;
export type InsertCriterionRouting = z.infer<typeof insertCriterionRoutingSchema>;
export type InsertEventCriterionAssignment = z.infer<typeof insertEventCriterionAssignmentSchema>;
