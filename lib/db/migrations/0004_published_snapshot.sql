-- O colaborador só vê nota de calibração PUBLICADA (parcial ou final). Estas
-- colunas guardam o retrato da última publicação; salvar uma calibração nova
-- não muda o que ele vê até o calibrador publicar de novo.
--
-- Só ACRESCENTA (colunas que aceitam vazio): o app antigo continua funcionando.
-- Idempotente: roda no Shell (pós-merge) e, à mão, na produção.
ALTER TABLE "event_criteria" ADD COLUMN IF NOT EXISTS "published_score" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "event_criteria" ADD COLUMN IF NOT EXISTS "published_reason" text;--> statement-breakpoint
-- Ponto de partida = o que o colaborador já vê hoje: nos critérios já
-- publicados (ou em evento com feedback liberado), a calibração atual.
-- Só preenche o que ainda está vazio — rodar de novo não sobrescreve
-- publicações feitas depois.
UPDATE "event_criteria" ec
   SET "published_score" = cal."calibrated_score",
       "published_reason" = cal."calibration_reason"
  FROM "calibrations" cal, "events" e
 WHERE cal."event_id" = ec."event_id"
   AND cal."criterion_id" = ec."criterion_id"
   AND e."id" = ec."event_id"
   AND ec."published_score" IS NULL
   AND (ec."partial_published_at" IS NOT NULL OR ec."final_published_at" IS NOT NULL OR e."feedback_released");
