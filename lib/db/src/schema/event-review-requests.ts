import { pgTable, serial, integer, text} from "drizzle-orm/pg-core";
import { timestamptz } from "./columns";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { employeesTable } from "./employees";
import { usersTable } from "./users";

export const eventReviewRequestsTable = pgTable("event_review_requests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  comment: text("comment").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamptz("created_at").notNull().default(sql`now()`),
  resolvedAt: timestamptz("resolved_at"),
  resolvedByUserId: integer("resolved_by_user_id").references(() => usersTable.id),
  resolutionNotes: text("resolution_notes"),
});

export const insertEventReviewRequestSchema = createInsertSchema(eventReviewRequestsTable).omit({ id: true, createdAt: true });
export type InsertEventReviewRequest = z.infer<typeof insertEventReviewRequestSchema>;
export type EventReviewRequest = typeof eventReviewRequestsTable.$inferSelect;
