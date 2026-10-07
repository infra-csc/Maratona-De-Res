-- 2ª rodada de revisão (06/10/2026):
--  * evaluations.public_token_id: o link público que gravou a resposta. Liga a
--    nota ao freela que preencheu ("Respondido por") sem adivinhar pela janela
--    de 5 s entre o envio e o "usado em" do link. Nulo = enviada pela tela.
--  * índice em public_eval_tokens(event_id, created_by_user_id): consulta de
--    "quem respondeu pelo link" e dos links de cada avaliador no evento.
--
-- Só ACRESCENTA coluna anulável e índice: o app antigo continua funcionando.
-- Idempotente: roda no Shell (pós-merge) e, à mão, na produção.
--
-- CASO-LIMITE DO BACKFILL (B4, 4ª revisão) — leia antes de rodar em produção:
-- o backfill (último comando) liga a avaliação ANTIGA ao link pelo horário
-- (link usado entre 1 s antes e 5 s depois do envio). O código antigo do link,
-- quando o avaliador JÁ TINHA ENVIADO aquele critério pela tela, pulava o
-- critério (não gravava nada) — mas marcava o link como usado. Se o avaliador
-- enviou pela TELA até 5 s antes de o freela usar um link dele no mesmo
-- critério, a janela casaria a resposta da tela com o link e "Respondido por"
-- mostraria o freela por engano. Proteção: o envio pela tela SEMPRE gravou a
-- auditoria (audit_logs: action 'submit', entity 'evaluations', entity_id = id
-- da avaliação) e o envio pelo link NUNCA gravou — é o indício mais forte de
-- "enviada fora do link" que o banco tem (o link não grava áudio, nome nem
-- outro marcador na avaliação). Avaliação com essa auditoria nunca é ligada.
-- Limite que sobra: avaliação enviada pela tela cuja auditoria falhou (a
-- gravação da auditoria não derruba o envio) — raríssimo; e quem gerou o link
-- pode conferir/ajustar pela Central. No sentido conservador: avaliação
-- enviada pela tela, REABERTA e depois respondida pelo link fica sem vínculo
-- (mostra quem gerou o link, como antes da 0011).
ALTER TABLE "evaluations" ADD COLUMN IF NOT EXISTS "public_token_id" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evaluations_public_token_id_public_eval_tokens_id_fk') THEN
    ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_public_token_id_public_eval_tokens_id_fk" FOREIGN KEY ("public_token_id") REFERENCES "public"."public_eval_tokens"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "public_eval_tokens_event_creator_idx" ON "public_eval_tokens" USING btree ("event_id","created_by_user_id");
--> statement-breakpoint
-- M2 (3ª revisão): avaliações ANTIGAS enviadas pelo link (antes desta coluna)
-- ganham o vínculo com o link, para "Respondido por" mostrar o freela. O
-- envio antigo gravava o "usado em" do link e o "enviado em" da avaliação com
-- relógios separados (diferença de milissegundos a poucos segundos), por isso
-- a janela: token do MESMO evento, do mesmo avaliador (o link responde em nome
-- de quem o gerou), que cobre o critério, usado entre 1 s antes e 5 s depois
-- do envio — e só quando há UM candidato (ambíguo fica sem vínculo e mostra
-- quem gerou o link). Idempotente: só preenche onde ainda está nulo.
UPDATE "evaluations" AS ev
   SET "public_token_id" = m.token_id
  FROM (
    SELECT e.id AS evaluation_id, min(t.id) AS token_id
      FROM "evaluations" e
      JOIN "public_eval_tokens" t
        ON t.event_id = e.event_id
       AND t.created_by_user_id = e.evaluator_user_id
       AND t.used_at IS NOT NULL
       AND t.used_at BETWEEN e.submitted_at - interval '1 second' AND e.submitted_at + interval '5 seconds'
      JOIN "public_eval_token_criteria" tc ON tc.token_id = t.id AND tc.criterion_id = e.criterion_id
     WHERE e.public_token_id IS NULL AND e.status = 'submitted' AND e.submitted_at IS NOT NULL
       -- B4: enviada pela TELA (auditoria do envio) nunca é ligada a um link.
       AND NOT EXISTS (SELECT 1 FROM "audit_logs" a
                        WHERE a.entity = 'evaluations' AND a.action = 'submit' AND a.entity_id = e.id::text)
     GROUP BY e.id
    HAVING count(DISTINCT t.id) = 1
  ) AS m
 WHERE ev.id = m.evaluation_id AND ev.public_token_id IS NULL;
