-- Linha do tempo do ciclo inteiro (sem filtro de colaborador) filtra por
-- ciclo e ordena por data: o índice (employee_id, cycle_id, changed_at) não
-- servia para essa consulta.
--
-- Só ACRESCENTA um índice. Idempotente: roda no Shell (pós-merge) e, à mão,
-- na produção.
CREATE INDEX IF NOT EXISTS "score_changes_cycle_changed_idx" ON "score_changes" USING btree ("cycle_id","changed_at");
