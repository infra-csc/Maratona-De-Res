import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const penaltyTypesTable = pgTable("penalty_types", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  points: integer("points").notNull(),
  kind: text("kind").notNull().default("penalty"),
  requiresEvent: boolean("requires_event").notNull().default(false),
  active: boolean("active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
});

export const insertPenaltyTypeSchema = createInsertSchema(penaltyTypesTable).omit({ id: true });
export type InsertPenaltyType = z.infer<typeof insertPenaltyTypeSchema>;
export type PenaltyTypeRow = typeof penaltyTypesTable.$inferSelect;
