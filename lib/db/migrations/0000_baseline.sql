CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"cpf_login" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'visualizador' NOT NULL,
	"area_id" integer,
	"employee_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"pin_value" text,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_cpf_login_unique" UNIQUE("cpf_login"),
	CONSTRAINT "users_pin_value_unique" UNIQUE("pin_value")
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"document" text,
	"email" text,
	"phone" text,
	"department" text DEFAULT 'Geral' NOT NULL,
	"function_name" text DEFAULT 'Colaborador' NOT NULL,
	"employment_type" text DEFAULT 'casa' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"eligible_for_bonus" boolean DEFAULT true NOT NULL,
	"eligibility_status" text DEFAULT 'eligible' NOT NULL,
	"eligibility_reason" text,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"function_name" text,
	"team_name" text,
	"confirmed" boolean DEFAULT true NOT NULL,
	"scheduled_diaria_count" integer,
	"scheduled_diaria_start" date,
	"scheduled_diaria_end" date,
	"actual_diaria_dates" date[],
	"actual_diaria_count" integer,
	"diaria_quick_confirmed" boolean DEFAULT false,
	"diaria_quick_confirmed_at" timestamp,
	"comment" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"name" text NOT NULL,
	"client_name" text,
	"location" text,
	"city" text,
	"state" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"cycle_id" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"forced_closed" boolean DEFAULT false NOT NULL,
	"forced_close_reason" text,
	"feedback_released" boolean DEFAULT false NOT NULL,
	"feedback_released_at" timestamp,
	"criteria_confirmed" boolean DEFAULT false NOT NULL,
	"criteria_confirmed_at" timestamp,
	"is_historical" boolean DEFAULT false NOT NULL,
	"imported_score" numeric(6, 2),
	"imported_notes" text,
	"results_confirmed" boolean DEFAULT false NOT NULL,
	"results_confirmed_at" timestamp,
	"results_confirmed_by" integer,
	"conformity_evaluator_user_id" integer,
	"conformity_evaluator_ferramentas_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"responsible_area_id" integer,
	"responsible_area_label" text,
	"default_weight" numeric(5, 2) DEFAULT '1' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"event_scoped" boolean DEFAULT false NOT NULL,
	"source_criterion_id" integer
);
--> statement-breakpoint
CREATE TABLE "event_criteria" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"weight_override" numeric(5, 2),
	"partial_published_at" timestamp,
	"final_published_at" timestamp,
	"partial_published_by_user_id" integer,
	"final_published_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "event_area_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"area_id" integer NOT NULL,
	"evaluator_user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibration_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"text" text NOT NULL,
	"created_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calibrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"original_average_score" numeric(5, 2),
	"calibrated_score" numeric(5, 2) NOT NULL,
	"calibration_reason" text,
	"calibrated_by_user_id" integer NOT NULL,
	"calibrated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_event_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"event_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"calibrated_event_score" numeric(6, 2),
	"final_event_score" numeric(6, 2) DEFAULT '0' NOT NULL,
	"platoon_projected" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"evaluator_user_id" integer NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"comments" text,
	"audio_url" text,
	"comment_visibility" text DEFAULT 'internal' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_conformities" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"epi" boolean,
	"estaiamentos" boolean,
	"guarda_equipamentos" boolean,
	"conduta" boolean,
	"epi_comment" text,
	"estaiamentos_comment" text,
	"guarda_equipamentos_comment" text,
	"conduta_comment" text,
	"absences_response" boolean,
	"absences_report" text,
	"standout_response" boolean,
	"standout_justification" text,
	"created_by_user_id" integer NOT NULL,
	"cenografia_submitted_by_name" text,
	"ferramentas_submitted_by_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "absences" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"event_id" integer,
	"penalty_type" text DEFAULT 'falta' NOT NULL,
	"kind" text DEFAULT 'penalty' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"date" date NOT NULL,
	"cycle_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"reason" text,
	"registered_by_user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "penalty_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"points" integer NOT NULL,
	"kind" text DEFAULT 'penalty' NOT NULL,
	"requires_event" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "penalty_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "rules_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "platoon_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"min_score" numeric(5, 2) NOT NULL,
	"max_score" numeric(5, 2) NOT NULL,
	"min_inclusive" boolean DEFAULT true NOT NULL,
	"max_inclusive" boolean DEFAULT false NOT NULL,
	"bonus_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"bonus_per_extra_event" numeric(10, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quarterly_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"events_count" integer DEFAULT 0 NOT NULL,
	"participated_events_count" integer DEFAULT 0 NOT NULL,
	"score_sum" numeric(8, 2) DEFAULT '0' NOT NULL,
	"gross_average" numeric(6, 2) DEFAULT '0' NOT NULL,
	"total_absences" integer DEFAULT 0 NOT NULL,
	"absence_penalty" numeric(6, 2) DEFAULT '0' NOT NULL,
	"merit_points" numeric(6, 2) DEFAULT '0' NOT NULL,
	"final_result" numeric(6, 2) DEFAULT '0' NOT NULL,
	"platoon" text,
	"platoon_color" text,
	"bonus_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"extra_bonus_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"eligible" boolean DEFAULT true NOT NULL,
	"eligibility_reason" text,
	"bonus_status" text DEFAULT 'projected' NOT NULL,
	"payment_method" text DEFAULT 'Caju Saldo Livre' NOT NULL,
	"payment_due_date" date,
	"paid_at" timestamp,
	"payment_notes" text,
	"closed_at" timestamp,
	"closed_by_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "employee_cycle_eligibility" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"eligible" boolean DEFAULT true NOT NULL,
	"reason" text,
	"created_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before_json" text,
	"after_json" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_review_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"comment" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by_user_id" integer,
	"resolution_notes" text
);
--> statement-breakpoint
CREATE TABLE "area_conformity_routing" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"default_evaluator_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion_redirect_users" (
	"criterion_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion_routing" (
	"id" serial PRIMARY KEY NOT NULL,
	"criterion_id" integer NOT NULL,
	"default_evaluator_id" integer,
	"conformity_evaluator_id" integer,
	"comment_required" boolean DEFAULT true NOT NULL,
	"redirect_mode" text DEFAULT 'area' NOT NULL,
	"redirect_area_id" integer,
	"allow_public_link" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_criterion_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"criterion_id" integer NOT NULL,
	"assigned_to_id" integer,
	"status" text DEFAULT 'suggested' NOT NULL,
	"redirected_from_id" integer,
	"confirmed_by_user_id" integer,
	"confirmed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_eval_token_criteria" (
	"token_id" text NOT NULL,
	"criterion_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_eval_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"created_by_user_id" integer,
	"recipient_name" text,
	"submitter_name" text,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"token_type" text DEFAULT 'criteria' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_results_confirmed_by_users_id_fk" FOREIGN KEY ("results_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_conformity_evaluator_user_id_users_id_fk" FOREIGN KEY ("conformity_evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_conformity_evaluator_ferramentas_user_id_users_id_fk" FOREIGN KEY ("conformity_evaluator_ferramentas_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_responsible_area_id_areas_id_fk" FOREIGN KEY ("responsible_area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criteria" ADD CONSTRAINT "criteria_source_criterion_id_criteria_id_fk" FOREIGN KEY ("source_criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criteria" ADD CONSTRAINT "event_criteria_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criteria" ADD CONSTRAINT "event_criteria_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criteria" ADD CONSTRAINT "event_criteria_partial_published_by_user_id_users_id_fk" FOREIGN KEY ("partial_published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criteria" ADD CONSTRAINT "event_criteria_final_published_by_user_id_users_id_fk" FOREIGN KEY ("final_published_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_area_assignments" ADD CONSTRAINT "event_area_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_area_assignments" ADD CONSTRAINT "event_area_assignments_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_area_assignments" ADD CONSTRAINT "event_area_assignments_evaluator_user_id_users_id_fk" FOREIGN KEY ("evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_comments" ADD CONSTRAINT "calibration_comments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_comments" ADD CONSTRAINT "calibration_comments_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibration_comments" ADD CONSTRAINT "calibration_comments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calibrations" ADD CONSTRAINT "calibrations_calibrated_by_user_id_users_id_fk" FOREIGN KEY ("calibrated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_event_results" ADD CONSTRAINT "employee_event_results_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_event_results" ADD CONSTRAINT "employee_event_results_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_evaluator_user_id_users_id_fk" FOREIGN KEY ("evaluator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_conformities" ADD CONSTRAINT "event_conformities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_conformities" ADD CONSTRAINT "event_conformities_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_results" ADD CONSTRAINT "quarterly_results_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_results" ADD CONSTRAINT "quarterly_results_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quarterly_results" ADD CONSTRAINT "quarterly_results_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cycle_eligibility" ADD CONSTRAINT "employee_cycle_eligibility_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cycle_eligibility" ADD CONSTRAINT "employee_cycle_eligibility_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cycle_eligibility" ADD CONSTRAINT "employee_cycle_eligibility_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_review_requests" ADD CONSTRAINT "event_review_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_review_requests" ADD CONSTRAINT "event_review_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_review_requests" ADD CONSTRAINT "event_review_requests_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_conformity_routing" ADD CONSTRAINT "area_conformity_routing_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "area_conformity_routing" ADD CONSTRAINT "area_conformity_routing_default_evaluator_id_users_id_fk" FOREIGN KEY ("default_evaluator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_redirect_users" ADD CONSTRAINT "criterion_redirect_users_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_redirect_users" ADD CONSTRAINT "criterion_redirect_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_routing" ADD CONSTRAINT "criterion_routing_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_routing" ADD CONSTRAINT "criterion_routing_default_evaluator_id_users_id_fk" FOREIGN KEY ("default_evaluator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_routing" ADD CONSTRAINT "criterion_routing_conformity_evaluator_id_users_id_fk" FOREIGN KEY ("conformity_evaluator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_routing" ADD CONSTRAINT "criterion_routing_redirect_area_id_areas_id_fk" FOREIGN KEY ("redirect_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criterion_assignments" ADD CONSTRAINT "event_criterion_assignments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criterion_assignments" ADD CONSTRAINT "event_criterion_assignments_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criterion_assignments" ADD CONSTRAINT "event_criterion_assignments_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criterion_assignments" ADD CONSTRAINT "event_criterion_assignments_redirected_from_id_users_id_fk" FOREIGN KEY ("redirected_from_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_criterion_assignments" ADD CONSTRAINT "event_criterion_assignments_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_eval_token_criteria" ADD CONSTRAINT "public_eval_token_criteria_token_id_public_eval_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."public_eval_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_eval_token_criteria" ADD CONSTRAINT "public_eval_token_criteria_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_eval_tokens" ADD CONSTRAINT "public_eval_tokens_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "public_eval_tokens" ADD CONSTRAINT "public_eval_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employees_external_id_uq" ON "employees" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_participants_event_employee_uq" ON "event_participants" USING btree ("event_id","employee_id");--> statement-breakpoint
CREATE INDEX "event_participants_employee_idx" ON "event_participants" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_external_id_uq" ON "events" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_criteria_event_criterion_uq" ON "event_criteria" USING btree ("event_id","criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_area_assignments_event_area_evaluator_uq" ON "event_area_assignments" USING btree ("event_id","area_id","evaluator_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calibrations_event_criterion_uq" ON "calibrations" USING btree ("event_id","criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_event_results_event_employee_uq" ON "employee_event_results" USING btree ("event_id","employee_id");--> statement-breakpoint
CREATE INDEX "employee_event_results_employee_idx" ON "employee_event_results" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "evaluations_event_criterion_evaluator_uq" ON "evaluations" USING btree ("event_id","criterion_id","evaluator_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_conformities_event_uq" ON "event_conformities" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "absences_employee_cycle_idx" ON "absences" USING btree ("employee_id","cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quarterly_results_employee_cycle_uq" ON "quarterly_results" USING btree ("employee_id","cycle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_cycle_eligibility_employee_cycle_uq" ON "employee_cycle_eligibility" USING btree ("employee_id","cycle_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "area_conformity_routing_area_uq" ON "area_conformity_routing" USING btree ("area_id");--> statement-breakpoint
CREATE UNIQUE INDEX "criterion_redirect_users_uq" ON "criterion_redirect_users" USING btree ("criterion_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "criterion_routing_criterion_uq" ON "criterion_routing" USING btree ("criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_criterion_assignments_uq" ON "event_criterion_assignments" USING btree ("event_id","criterion_id");--> statement-breakpoint
CREATE UNIQUE INDEX "public_eval_token_criteria_uq" ON "public_eval_token_criteria" USING btree ("token_id","criterion_id");