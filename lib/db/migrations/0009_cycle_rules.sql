-- Regras POR CICLO (novo ciclo 2026: mínimo de 7 eventos, pagamento em
-- 08/01/2027, "Conduta" fora da Matriz de Conformidade). Vazio/false = regra
-- de antes: o ciclo atual continua exatamente como estava.
--
-- Só ACRESCENTA colunas com padrão: o app antigo continua funcionando.
-- Idempotente: roda no Shell (pós-merge) e, à mão, na produção.
ALTER TABLE "cycles" ADD COLUMN IF NOT EXISTS "min_events" integer;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN IF NOT EXISTS "payment_date" date;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN IF NOT EXISTS "conformity_without_conduta" boolean DEFAULT false NOT NULL;
