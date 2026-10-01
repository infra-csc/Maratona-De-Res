-- Linha do tempo da nota (score_changes): cada recálculo grava, por
-- colaborador, o antes → depois da nota final, faixa, bônus, eventos e
-- elegibilidade, com a ação que disparou a mudança.
--
-- Só ACRESCENTA (tabela nova): o app antigo continua funcionando.
-- Idempotente: roda no Shell (pós-merge) e, à mão, na produção.
CREATE TABLE IF NOT EXISTS "score_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" integer NOT NULL,
	"employee_id" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"cause_action" text,
	"cause_entity" text,
	"cause_entity_id" text,
	"cause_detail" text,
	"final_before" numeric(5, 2),
	"final_after" numeric(5, 2),
	"platoon_before" text,
	"platoon_after" text,
	"bonus_before" numeric(10, 2),
	"bonus_after" numeric(10, 2),
	"events_before" integer,
	"events_after" integer,
	"eligible_before" boolean,
	"eligible_after" boolean
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'score_changes_cycle_id_cycles_id_fk') THEN
    ALTER TABLE "score_changes" ADD CONSTRAINT "score_changes_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE no action ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'score_changes_employee_id_employees_id_fk') THEN
    ALTER TABLE "score_changes" ADD CONSTRAINT "score_changes_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'score_changes_user_id_users_id_fk') THEN
    ALTER TABLE "score_changes" ADD CONSTRAINT "score_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "score_changes_employee_cycle_idx" ON "score_changes" USING btree ("employee_id","cycle_id","changed_at");
