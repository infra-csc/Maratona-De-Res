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
cp .env.example .env                            # preencha DATABASE_URL e JWT_SECRET
pnpm install
pnpm --filter @workspace/api-server run dev     # API em PORT (padrão 8080)
pnpm --filter @workspace/maratona run dev       # Vite (5173) com proxy /api → 8080
```

A API lê o `.env` da raiz sozinha. Todas as variáveis estão documentadas em
`.env.example`. Obrigatórias: `DATABASE_URL`, `JWT_SECRET`, `PORT`.
Opcionais: `ALLOWED_ORIGINS` (CORS), `PG_POOL_MAX`, `SESSION_SECRET` (SSO do
portal), `STORAGE_DIR` (áudio das avaliações, em disco), `STATIC_DIR` (a API
serve o build do web), `EXTERNAL_API_URL`/`EXTERNAL_API_TOKEN`, `LOG_LEVEL`.

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
- Notas de decisões e incidentes passados: `docs/decisoes/*.md`.

## Banco

- Alterou o schema? `pnpm --filter db generate` cria a migração (revise o SQL,
  prefira DDL idempotente). O pós-merge aplica com
  `pnpm --filter @workspace/db run migrate:deploy`, que adota o baseline
  sozinho num banco criado por push. Detalhes em `lib/db/migrations/README.md`.
- `seed.ts` apaga tudo: só roda com `ALLOW_DESTRUCTIVE_SEED=true` fora de produção.

## Deploy (VPS)

Requisitos: Node 24, pnpm 10 (`corepack enable`), acesso ao Postgres (Neon).

```bash
git clone … /opt/maratona && cd /opt/maratona
cp .env.example .env        # preencha; STORAGE_DIR fora do código e no backup
./scripts/deploy.sh         # install, migrações, schema:check e build
pnpm --filter @workspace/api-server run start   # ou via systemd/PM2
```

Com `STATIC_DIR` definido, um único processo serve API (`/api`) e web (SPA).
Antes do primeiro deploy com índices únicos, rode
`scripts/sql/check-duplicates.sql` no banco.

Áudios que estavam no Object Storage do Replit: rode
`lib/db/scripts/export-replit-audios.mjs` no Shell do Replit e copie a pasta
gerada para `STORAGE_DIR` (instruções no topo do script).
