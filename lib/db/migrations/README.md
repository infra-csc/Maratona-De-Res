# Migrações do banco

Histórico versionado do schema (Drizzle). Até 23/09/2026 o schema só existia via
`drizzle-kit push`, sem histórico; `0000_baseline.sql` captura o estado atual
(inclusive os índices únicos e de consulta adicionados nessa data).

## Fluxo

1. Altere `lib/db/src/schema/*.ts`.
2. `pnpm --filter db generate` gera o próximo arquivo em `migrations/`.
3. Revise o SQL (prefira DDL aditivo e idempotente, ex.: `ADD COLUMN IF NOT
   EXISTS`) e commite junto com a mudança de código.
4. No Replit, o `git pull` roda `scripts/post-merge.sh`, que chama
   `pnpm --filter @workspace/db run migrate:deploy` e aplica só o que falta.
   Para outro banco: `DATABASE_URL=... pnpm --filter @workspace/db run migrate:deploy`.

`push` continua útil em desenvolvimento local, mas não gera histórico. No
pós-merge ele roda DEPOIS das migrações só como rede de segurança contra
divergência: sem `--force`, não apaga coluna nem tabela.

## Banco que já existia antes das migrações (produção)

Não é preciso nada manual. `scripts/migrate-deploy.mjs` detecta um banco com as
tabelas do app e sem `drizzle.__drizzle_migrations`, registra o baseline
`0000` como aplicado (mesmo hash e data que o migrador do Drizzle usaria) e
segue para as migrações seguintes. Testado em banco vazio e em banco criado
por `push` (PGlite), inclusive rodando duas vezes.

Antes do primeiro pull que traz índices únicos novos, rode
`scripts/sql/check-duplicates.sql`; se devolver linhas, rode
`scripts/sql/dedupe-before-unique.sql` dentro de uma transação, conferindo
antes do COMMIT.

## Datas: `timestamptz` (migração 0002)

Toda coluna de instante é `timestamp with time zone`, declarada com
`timestamptz(...)` de `src/schema/columns.ts` — não use `timestamp(...)` do
Drizzle em coluna nova. Os valores sempre foram UTC; a 0002 converte com
`AT TIME ZONE 'UTC'` (independe do fuso de quem roda) e é idempotente.

**Ordem em produção (obrigatória):** publicar o app novo PRIMEIRO e só depois
rodar `migrate:deploy` no banco de produção. O app novo lê os dois formatos; o
app antigo não lê o formato novo (as datas viram inválidas). Entre os dois
passos o app funciona normalmente.

Nas migrações, prefira SQL idempotente (`IF NOT EXISTS`, blocos `DO` que
conferem o estado): o mesmo arquivo roda no banco do Shell pelo pós-merge e
depois, à mão, no de produção.

## Critério respondido por várias áreas (migração 0003)

`criteria.evaluate_all_areas` e a tabela `criterion_evaluating_areas` guardam o
padrão do catálogo ("Áreas que avaliam"). No evento, cada área extra vira uma
cópia do critério (`event_scoped`, `source_criterion_id`, peso 0) — criada ao
criar/sincronizar o evento, pelo botão "Aplicar áreas do padrão" ou pelo ajuste
por evento — e a nota do critério é a média das áreas que avaliaram
(`mergeEventScopedCriteria`). A 0003 só acrescenta tabela e coluna com padrão:
aqui a ordem publicar/migrar não importa.

## Publicar no Replit copia a estrutura do banco do Shell (incidente 30/09)

Ao publicar, o Replit aplica na produção a estrutura do banco de
DESENVOLVIMENTO (o do Shell). Se o banco do Shell está atrasado, a publicação
desfaz na produção o que as migrações criaram — e o histórico
`drizzle.__drizzle_migrations` continua dizendo "aplicada", então o
`migrate:deploy` não percebe. Em 30/09 isso tirou 3 índices únicos da produção
(salvar calibração dava 500) e voltou as datas para sem fuso.

- `pnpm --filter @workspace/db run schema:check` compara o banco de
  `DATABASE_URL` com a estrutura que as migrações definem (monta a referência
  em memória) e lista as diferenças.
- `pnpm --filter @workspace/db run schema:repair` reaplica as migrações
  idempotentes e recria índices que faltam (único só sem duplicatas). Não apaga nada.

**Antes de publicar:** rodar `schema:repair` no Shell (o pós-merge já roda).
Depois de publicar: `schema:check` com o `DATABASE_URL` de produção.
