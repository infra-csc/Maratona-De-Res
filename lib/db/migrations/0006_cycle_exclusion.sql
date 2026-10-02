-- Colaborador FORA do ciclo (decisão do admin na tela Colaboradores): não
-- entra no recálculo — sem nota, ranking, análises nem bônus naquele ciclo.
-- Reversível: excluded volta a false e o próximo recálculo o inclui de novo.
--
-- Só ACRESCENTA colunas com padrão: o app antigo continua funcionando.
-- Idempotente: roda no Shell (pós-merge) e, à mão, na produção.
ALTER TABLE "employee_cycle_eligibility" ADD COLUMN IF NOT EXISTS "excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_cycle_eligibility" ADD COLUMN IF NOT EXISTS "excluded_reason" text;
