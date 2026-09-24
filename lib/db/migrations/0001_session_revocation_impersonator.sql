-- Idempotente: bancos que já receberam estas colunas por `drizzle-kit push`
-- (pós-merge antigo) não falham ao aplicar a migração.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "token_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "impersonator_user_id" integer;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_impersonator_user_id_users_id_fk') THEN
    ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_impersonator_user_id_users_id_fk" FOREIGN KEY ("impersonator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
