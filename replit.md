# Maratona de Resultados

App interno de RH: avaliação de equipes por evento, calibração, consolidação do ciclo e bônus por colaborador. Papéis: admin, rh, diretoria, operador, avaliador, visualizador (colaborador).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API na porta `PORT` (8080 no Replit; o Vite faz proxy de `/api`)
- `pnpm --filter @workspace/maratona run dev` — app web
- `pnpm run typecheck` — libs + api + web
- `pnpm run test` — testes das regras de cálculo (runner nativo do Node)
- `pnpm run build` — typecheck + build de produção (api + web; mockup-sandbox fica de fora)
- `pnpm run codegen` — regenera hooks e Zod a partir de `lib/api-spec/openapi.yaml`
- `pnpm --filter db generate` / `migrate` — migrações versionadas; `push` só em dev
- Env obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `BASE_PATH`. Opcionais: `APP_ORIGINS`, `PG_POOL_MAX`, `SESSION_SECRET`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `LOG_LEVEL`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (bundle ESM via esbuild em `artifacts/api-server/build.mjs`)
- DB: PostgreSQL + Drizzle ORM; schema em `lib/db/src/schema`, migrações em `lib/db/migrations`
- Validação: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (OpenAPI → `lib/api-client-react`, `lib/api-zod`)

## Where things live

- Regras de nota/faixa/bônus: `artifacts/api-server/src/lib/calculations.ts` (+ `.test.ts`)
- Quem conta para nota: `artifacts/api-server/src/lib/participation.ts`
- Snapshot oficial do ciclo (`recomputeCycleResults`): `artifacts/api-server/src/routes/results.ts`
- Auth (JWT, papéis): `artifacts/api-server/src/lib/auth.ts`; ordem de montagem dos routers importa: `routes/index.ts`
- Tema/tokens do web: `artifacts/maratona/src/index.css` (fonte única, cores completas) e `src/lib/premium-theme.tsx`
- Componentes compartilhados: `artifacts/maratona/src/components/shared`
- Decisões e incidentes passados: `.agents/memory/*.md`

## Architecture decisions

- Só eventos com `resultsConfirmed` entram no ciclo (nota, elegibilidade, bônus); `status` não é a trava.
- Nota média do ciclo define a faixa; a faixa define prêmio base e valor por evento extra (regra da tabela oficial, 15/09/2026).
- Redação por papel é feita na API (operador não vê nota; visualizador só vê o próprio), nunca só na UI.
- Ciclos nunca são excluídos (sem DELETE): o histórico de cada um fica em quarterly_results/eventos por cycleId e é consultado em /cycles/:id. Só um ciclo atual; criar o próximo exige fechar o atual quando ele tem eventos; ciclo fechado não volta a ser atual e só muda de nome.
- Tokens públicos de avaliação são single-use e reaproveitados quando pendentes e equivalentes.
- Login do colaborador é por CPF (senha = CPF) por decisão de produto; por isso o cadastro com CPF é restrito a gestores.

## Gotchas

- Rota nova só entra com entrada no `openapi.yaml` + `pnpm run codegen`; o CI falha se o cliente gerado divergir.
- Antes de aplicar índices únicos num banco existente, rode `scripts/sql/check-duplicates.sql`.
- `seed.ts` apaga 17 tabelas: exige `ALLOW_DESTRUCTIVE_SEED=true` e nunca roda em produção.
- Datas de evento são `YYYY-MM-DD`: comparar como texto e exibir com `fmtDate`; `new Date("YYYY-MM-DD")` é UTC.
- Windows: `pnpm-workspace.yaml` remove binários nativos não-linux; `vite build` local não roda (use o CI).

## User preferences

- Responder sempre em português (PT-BR).
- Nunca usar "Pelotão" na UI (usar "Faixa").
