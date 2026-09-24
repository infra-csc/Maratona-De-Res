-- Limpeza de duplicatas, só se check-duplicates.sql devolveu linhas.
-- Regras: mantém a avaliação SUBMETIDA mais recente (senão a mais recente);
-- a calibração mais recente; o primeiro vínculo de critério; o resultado por
-- evento mais recente. Rode dentro de uma transação e confira antes do COMMIT.

BEGIN;

-- 1) evaluations: mantém a linha de maior prioridade (submitted > draft, depois id maior)
DELETE FROM evaluations e
USING (
  SELECT id,
         row_number() OVER (
           PARTITION BY event_id, criterion_id, evaluator_user_id
           ORDER BY (status = 'submitted') DESC, submitted_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM evaluations
) ranked
WHERE e.id = ranked.id AND ranked.rn > 1;

-- 2) calibrations: mantém a mais recente
DELETE FROM calibrations c
USING (
  SELECT id, row_number() OVER (PARTITION BY event_id, criterion_id ORDER BY calibrated_at DESC, id DESC) AS rn
  FROM calibrations
) ranked
WHERE c.id = ranked.id AND ranked.rn > 1;

-- 3) event_criteria: mantém o primeiro vínculo (preserva peso/publicação mais antigos)
DELETE FROM event_criteria ec
USING (
  SELECT id, row_number() OVER (PARTITION BY event_id, criterion_id ORDER BY id ASC) AS rn
  FROM event_criteria
) ranked
WHERE ec.id = ranked.id AND ranked.rn > 1;

-- 4) employee_event_results: mantém a mais recente (o próximo recálculo refaz tudo)
DELETE FROM employee_event_results r
USING (
  SELECT id, row_number() OVER (PARTITION BY event_id, employee_id ORDER BY updated_at DESC, id DESC) AS rn
  FROM employee_event_results
) ranked
WHERE r.id = ranked.id AND ranked.rn > 1;

-- Confira as contagens e então:
-- COMMIT;   (ou ROLLBACK; para desfazer)
