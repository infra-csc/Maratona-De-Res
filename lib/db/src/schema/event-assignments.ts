import { pgTable, serial, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { areasTable } from "./areas";
import { usersTable } from "./users";

/**
 * Per-event, per-area evaluator assignment.
 * For a given event, RH chooses exactly ONE evaluator user for each area.
 * That user (not the user's fixed profile area) scores the criteria of that area
 * for that event. Mandatory before the event's criteria can be confirmed/released.
 */
export const eventAreaAssignmentsTable = pgTable("event_area_assignments", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  areaId: integer("area_id").notNull().references(() => areasTable.id),
  evaluatorUserId: integer("evaluator_user_id").notNull().references(() => usersTable.id),
}, (t) => ({
  eventAreaUq: uniqueIndex("event_area_assignments_event_area_uq").on(t.eventId, t.areaId),
}));

export const insertEventAreaAssignmentSchema = createInsertSchema(eventAreaAssignmentsTable).omit({ id: true });
export type InsertEventAreaAssignment = z.infer<typeof insertEventAreaAssignmentSchema>;
export type EventAreaAssignment = typeof eventAreaAssignmentsTable.$inferSelect;
