-- Avaliação POR ÁREA por ciclo (decisão do dono, 06/10/2026: só no ciclo
-- novo): qualquer avaliador da área responde e a primeira resposta da área
-- fecha o critério. false (padrão) = fluxo antigo, então o ciclo atual
-- continua exatamente como estava.
--
-- Só ACRESCENTA coluna com padrão. Idempotente: roda no Shell (pós-merge) e,
-- à mão, na produção.
ALTER TABLE "cycles" ADD COLUMN IF NOT EXISTS "area_evaluation" boolean DEFAULT false NOT NULL;
