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
