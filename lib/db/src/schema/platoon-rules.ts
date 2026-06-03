import { pgTable, serial, text, boolean, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const platoonRulesTable = pgTable("platoon_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  minScore: numeric("min_score", { precision: 5, scale: 2 }).notNull(),
  maxScore: numeric("max_score", { precision: 5, scale: 2 }).notNull(),
  minInclusive: boolean("min_inclusive").notNull().default(true),
  maxInclusive: boolean("max_inclusive").notNull().default(false),
  bonusValue: numeric("bonus_value", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
});

export const insertPlatoonRuleSchema = createInsertSchema(platoonRulesTable).omit({ id: true });
export type InsertPlatoonRule = z.infer<typeof insertPlatoonRuleSchema>;
export type PlatoonRule = typeof platoonRulesTable.$inferSelect;
