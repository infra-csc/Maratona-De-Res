import { pgTable, serial, integer, numeric, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { eventsTable } from "./events";
import { employeesTable } from "./employees";
import { criteriaTable } from "./criteria";
import { usersTable } from "./users";

export const evaluationsTable = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  evaluatorUserId: integer("evaluator_user_id").notNull().references(() => usersTable.id),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  comments: text("comments"),
  commentVisibility: text("comment_visibility").notNull().default("internal"),
  status: text("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const calibrationsTable = pgTable("calibrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id),
  criterionId: integer("criterion_id").notNull().references(() => criteriaTable.id),
  originalAverageScore: numeric("original_average_score", { precision: 5, scale: 2 }),
  calibratedScore: numeric("calibrated_score", { precision: 5, scale: 2 }).notNull(),
  calibrationReason: text("calibration_reason").notNull(),
  calibratedByUserId: integer("calibrated_by_user_id").notNull().references(() => usersTable.id),
  calibratedAt: timestamp("calibrated_at").notNull().defaultNow(),
});

export const insertEvaluationSchema = createInsertSchema(evaluationsTable).omit({ id: true, createdAt: true });
export const insertCalibrationSchema = createInsertSchema(calibrationsTable).omit({ id: true, calibratedAt: true });
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluationsTable.$inferSelect;
export type Calibration = typeof calibrationsTable.$inferSelect;
