# Maratona de Resultados

Aplicação interna de RH para avaliar o desempenho das equipes em eventos
esportivos, calibrar as notas, consolidar o ciclo e calcular o bônus por
colaborador.

## Stack

- pnpm workspaces · Node 24 · TypeScript 5.9
- API: Express 5 + Drizzle ORM (PostgreSQL) — `artifacts/api-server`
- Web: React 18 + Vite + Tailwind v4 + TanStack Query + wouter — `artifacts/maratona`
- Contrato: OpenAPI (`lib/api-spec/openapi.yaml`) → hooks React (`lib/api-client-react`) e schemas Zod (`lib/api-zod`) gerados com Orval
- Banco: schema em `lib/db/src/schema`, migrações em `lib/db/migrations`

## Rodar

```bash
pnpm install
pnpm --filter @workspace/api-server run dev     # API em PORT (8080 no Replit)
pnpm --filter @workspace/maratona run dev       # Vite com proxy /api → 8080
```

Variáveis obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `BASE_PATH`.
Opcionais: `APP_ORIGINS` (CORS, lista separada por vírgula), `PG_POOL_MAX`,
`SESSION_SECRET` (SSO do portal), `PRIVATE_OBJECT_DIR`/`PUBLIC_OBJECT_SEARCH_PATHS`
(áudio das avaliações), `LOG_LEVEL`.

## Portões de qualidade

```bash
pnpm run typecheck   # libs + api + web
pnpm run test        # unitários + rotas contra Postgres em WASM (PGlite)
pnpm run check:api-contract  # toda rota Express declarada no openapi.yaml
pnpm run codegen     # após editar openapi.yaml
pnpm run build       # typecheck + build de produção (api + web)
```

O CI (`.github/workflows/ci.yml`) roda tudo isso em cada push e falha se o
`openapi.yaml` mudar sem o cliente regenerado ou se alguma rota ficar fora
do spec. Testes de rota usam `scripts/test/api-harness.mjs` (app real de
`src/`, banco PGlite em memória com todas as migrações, tokens por papel).

## Regras de negócio (onde estão)

- Nota do evento, faixas e bônus: `artifacts/api-server/src/lib/calculations.ts`
  (testes em `calculations.test.ts`). A nota média do ciclo define a faixa; a
  faixa define o prêmio base e o valor de cada evento além do mínimo.
- Quem conta para nota (freela, Sup Ceno, inativo): `lib/participation.ts`.
- Snapshot oficial do ciclo: `recomputeCycleResults` em `routes/results.ts`.
  Só eventos com **resultados confirmados** entram.
- Ciclos (tela `/cycles`, rotas em `routes/cycles.ts`, validação em
  `lib/cycle-rules.ts`): nunca são excluídos; só um é o atual; criar o próximo
  exige fechar o atual se ele tiver eventos; ciclo fechado só muda de nome.
- Notas de decisões e incidentes passados: `.agents/memory/*.md`.

## Banco

- Alterou o schema? `pnpm --filter db generate` cria a migração (revise o SQL,
  prefira DDL idempotente). O pós-merge aplica com
  `pnpm --filter @workspace/db run migrate:deploy`, que adota o baseline
  sozinho num banco criado por push. Detalhes em `lib/db/migrations/README.md`.
- `seed.ts` apaga tudo: só roda com `ALLOW_DESTRUCTIVE_SEED=true` fora de produção.

## Deploy (Replit)

`git pull` no Shell e Republicar. O hook de pós-merge instala dependências,
aplica as migrações versionadas e roda `push` (sem --force) como rede de
segurança. Antes do primeiro pull com índices únicos, rode
`scripts/sql/check-duplicates.sql` no painel Database.
