-- Critério respondido por várias áreas (ou por todas), configurado no catálogo.
-- No evento, cada área extra vira uma cópia do critério e a nota é a média das
-- áreas (mesmo mecanismo já usado em "Qualidade da Entrega").
--
-- Só ADICIONA (tabela e coluna com padrão): o app antigo continua funcionando
-- com o banco migrado, então a ordem publicar/migrar não importa aqui.
-- Idempotente: o mesmo arquivo roda no banco do Shell e, à mão, no de produção.
CREATE TABLE IF NOT EXISTS "criterion_evaluating_areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"criterion_id" integer NOT NULL,
	"area_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "criteria" ADD COLUMN IF NOT EXISTS "evaluate_all_areas" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'criterion_evaluating_areas_criterion_id_criteria_id_fk') THEN
    ALTER TABLE "criterion_evaluating_areas" ADD CONSTRAINT "criterion_evaluating_areas_criterion_id_criteria_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criteria"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'criterion_evaluating_areas_area_id_areas_id_fk') THEN
    ALTER TABLE "criterion_evaluating_areas" ADD CONSTRAINT "criterion_evaluating_areas_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "criterion_evaluating_areas_uq" ON "criterion_evaluating_areas" USING btree ("criterion_id","area_id");
