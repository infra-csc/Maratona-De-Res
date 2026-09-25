-- Colunas de instante passam de "timestamp" (sem fuso) para "timestamptz".
--
-- Os valores antigos SEMPRE foram hora UTC (o Drizzle grava toISOString() e o
-- Neon roda em UTC); por isso a conversão é explícita, AT TIME ZONE 'UTC',
-- e não depende do fuso da sessão de quem roda a migração (script local em
-- horário de Brasília deslocaria tudo em 3 h).
--
-- Idempotente e tudo-ou-nada: só converte o que ainda é "timestamp without
-- time zone", num único bloco. Pode rodar de novo sem efeito.
--
-- ORDEM EM PRODUÇÃO: publicar o app novo ANTES de rodar esta migração. O app
-- novo lê os dois formatos (lib/db/src/schema/columns.ts); o antigo não lê o
-- formato novo.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN (VALUES
    ('users', 'locked_until'),
    ('users', 'created_at'),
    ('employees', 'created_at'),
    ('cycles', 'closed_at'),
    ('cycles', 'created_at'),
    ('event_comments', 'created_at'),
    ('event_participants', 'diaria_quick_confirmed_at'),
    ('events', 'feedback_released_at'),
    ('events', 'criteria_confirmed_at'),
    ('events', 'results_confirmed_at'),
    ('events', 'created_at'),
    ('event_criteria', 'partial_published_at'),
    ('event_criteria', 'final_published_at'),
    ('calibration_comments', 'created_at'),
    ('calibrations', 'calibrated_at'),
    ('employee_event_results', 'created_at'),
    ('employee_event_results', 'updated_at'),
    ('evaluations', 'submitted_at'),
    ('evaluations', 'created_at'),
    ('event_conformities', 'created_at'),
    ('event_conformities', 'updated_at'),
    ('absences', 'created_at'),
    ('rules', 'updated_at'),
    ('quarterly_results', 'paid_at'),
    ('quarterly_results', 'closed_at'),
    ('employee_cycle_eligibility', 'created_at'),
    ('employee_cycle_eligibility', 'updated_at'),
    ('audit_logs', 'created_at'),
    ('event_review_requests', 'created_at'),
    ('event_review_requests', 'resolved_at'),
    ('area_conformity_routing', 'created_at'),
    ('area_conformity_routing', 'updated_at'),
    ('criterion_routing', 'created_at'),
    ('criterion_routing', 'updated_at'),
    ('event_criterion_assignments', 'confirmed_at'),
    ('event_criterion_assignments', 'created_at'),
    ('event_criterion_assignments', 'updated_at'),
    ('public_eval_tokens', 'used_at'),
    ('public_eval_tokens', 'created_at')
    ) AS alvo(table_name, column_name)
      ON alvo.table_name = c.table_name AND alvo.column_name = c.column_name
    WHERE c.table_schema = 'public' AND c.data_type = 'timestamp without time zone'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN %I SET DATA TYPE timestamp with time zone USING %I AT TIME ZONE ''UTC''',
      r.table_name, r.column_name, r.column_name
    );
  END LOOP;
END $$;
