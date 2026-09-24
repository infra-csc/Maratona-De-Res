# Migrações do banco

Histórico versionado do schema (Drizzle). Até 23/09/2026 o schema só existia via
`drizzle-kit push`, sem histórico; `0000_baseline.sql` captura o estado atual
(inclusive os índices únicos e de consulta adicionados nessa data).

## Fluxo

1. Altere `lib/db/src/schema/*.ts`.
2. `pnpm --filter db generate` gera o próximo arquivo em `migrations/`.
3. Revise o SQL e commite junto com a mudança de código.
4. Em produção: `pnpm --filter db migrate` aplica só o que falta.

`push` continua útil em desenvolvimento local, mas não gera histórico.

## Primeira vez em um banco que JÁ existe (produção hoje)

O baseline recria todas as tabelas; num banco existente ele não pode ser
executado. Marque-o como aplicado e siga com as migrações seguintes:

1. Rode `scripts/sql/check-duplicates.sql`. Se devolver linhas, rode
   `scripts/sql/dedupe-before-unique.sql` (dentro de uma transação, conferindo
   antes do COMMIT).
2. Aplique manualmente só os índices novos do baseline (são as linhas
   `CREATE UNIQUE INDEX` / `CREATE INDEX` de `0000_baseline.sql` cujos nomes
   ainda não existem no banco) — ou deixe o `pnpm --filter db push` do
   `scripts/post-merge.sh` criá-los, o que hoje acontece automaticamente após
   o `git pull` no Replit.
3. Marque o baseline como aplicado, para que `migrate` não tente recriá-lo:

   ```sql
   CREATE SCHEMA IF NOT EXISTS drizzle;
   CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
     id serial PRIMARY KEY, hash text NOT NULL, created_at bigint
   );
   INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
   SELECT '<hash>', <when>
   -- <hash> e <when> vêm de migrations/meta/_journal.json (campo "tag" e "when")
   -- combinados com o conteúdo do arquivo: use `pnpm --filter db migrate` num
   -- banco vazio de teste para ver o valor gravado, ou mantenha `push` até a
   -- próxima migração real.
   ;
   ```

Enquanto o passo 3 não for feito, continue usando `push` (post-merge). A partir
da primeira migração incremental, troque o `post-merge.sh` para `migrate`.
