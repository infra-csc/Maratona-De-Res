-- Rode ANTES de aplicar o schema (drizzle push / migrate) que adiciona os
-- índices únicos. Se qualquer consulta abaixo devolver linhas, resolva as
-- duplicatas primeiro (ver scripts/sql/dedupe-before-unique.sql), senão a
-- criação do índice falha e o schema não é aplicado.

-- 1) Avaliações duplicadas por (evento, critério, avaliador)
SELECT event_id, criterion_id, evaluator_user_id, count(*) AS n, array_agg(id ORDER BY id) AS ids
FROM evaluations
GROUP BY event_id, criterion_id, evaluator_user_id
HAVING count(*) > 1;

-- 2) Calibrações duplicadas por (evento, critério)
SELECT event_id, criterion_id, count(*) AS n, array_agg(id ORDER BY calibrated_at DESC) AS ids
FROM calibrations
GROUP BY event_id, criterion_id
HAVING count(*) > 1;

-- 3) Vínculos de critério duplicados por (evento, critério)
SELECT event_id, criterion_id, count(*) AS n, array_agg(id ORDER BY id) AS ids
FROM event_criteria
GROUP BY event_id, criterion_id
HAVING count(*) > 1;

-- 4) Resultados por evento duplicados por (evento, colaborador)
SELECT event_id, employee_id, count(*) AS n, array_agg(id ORDER BY updated_at DESC) AS ids
FROM employee_event_results
GROUP BY event_id, employee_id
HAVING count(*) > 1;
