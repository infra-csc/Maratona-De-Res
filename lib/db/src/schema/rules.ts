import { pgTable, serial, text} from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const rulesTable = pgTable("rules", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description").notNull(),
  updatedAt: timestamptz("updated_at"),
});

export const insertRuleSchema = createInsertSchema(rulesTable).omit({ id: true });
export type InsertRule = z.infer<typeof insertRuleSchema>;
export type Rule = typeof rulesTable.$inferSelect;
