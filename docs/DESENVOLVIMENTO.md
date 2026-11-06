# Desenvolvimento

Como rodar o Maratona de Resultados na sua máquina, testar e mexer no banco
e no contrato da API.

## Pré-requisitos

- **Node.js 24** e **pnpm 10** (`corepack enable` ativa o pnpm que vem com o Node).
  O projeto recusa `npm install` e `yarn` (script `preinstall`).
- **PostgreSQL** (16 ou mais novo; a produção usa 18) acessível pela rede.
  Um banco local vazio serve: as migrações criam tudo.
- Git.

O `pnpm-workspace.yaml` exige que todo pacote tenha pelo menos 1 dia de
publicado (`minimumReleaseAge`), como defesa contra pacotes maliciosos. Não
desligue isso.

## Primeira vez

```bash
git clone https://github.com/infra-csc/maratona-de-res.git
cd maratona-de-res
cp .env.example .env
```

No `.env`, para desenvolvimento:

```dotenv
NODE_ENV=development
PORT=8080
DATABASE_URL=postgresql://usuario:senha@localhost:5432/maratona
JWT_SECRET=<gere com: openssl rand -base64 48>
STORAGE_DIR=                     # vazio: ./data/storage (ignorado pelo git)
STATIC_DIR=                      # vazio: o Vite serve o front em dev
ALLOWED_ORIGINS=                 # vazio: qualquer origem
```

A lista completa está em [VARIAVEIS-DE-AMBIENTE.md](VARIAVEIS-DE-AMBIENTE.md).

```bash
pnpm install
pnpm --filter @workspace/db run migrate:deploy   # cria as tabelas
```

## Rodar

Em dois terminais:

```bash
pnpm --filter @workspace/api-server run dev   # API em http://localhost:8080 (faz build e sobe)
pnpm --filter @workspace/maratona run dev     # web em http://localhost:5173
```

O Vite encaminha `/api` para `http://localhost:8080`; para outra API use
`API_PROXY_TARGET=http://host:porta`. A API lê sozinha o `.env` da raiz.

O `dev` da API faz o build e sobe uma vez (não recarrega sozinho): depois de
mudar código da API, pare e rode de novo.

### Dados de demonstração (seed)

O seed **apaga todas as tabelas** do banco de `DATABASE_URL` e cria áreas,
usuários, colaboradores e eventos de exemplo. Ele se recusa a rodar com
`NODE_ENV=production` ou sem `ALLOW_DESTRUCTIVE_SEED=true`.

```bash
set -a; . ./.env; set +a
NODE_ENV=development ALLOW_DESTRUCTIVE_SEED=true SEED_PASSWORD=<senha-de-teste> \
  ./scripts/node_modules/.bin/tsx artifacts/api-server/src/seed.ts
```

Os usuários criados têm e-mails `<papel>@cenografica.com.br` (por exemplo
`admin@…`, `rh@…`, `avaliador@…`) e todos usam `SEED_PASSWORD`. Sem
`SEED_PASSWORD`, uma senha aleatória é gerada e mostrada no terminal.

**Nunca rode o seed apontando para o banco de produção.**

## Portões de qualidade

Rode antes de abrir um pull request (o CI roda os mesmos):

```bash
pnpm run typecheck            # libs + api + web
pnpm run test                 # unitários + rotas (PGlite, sem banco externo)
pnpm run check:api-contract   # toda rota Express declarada no openapi.yaml
pnpm run build                # typecheck + build de produção
```

Só um tipo de teste:

```bash
pnpm run test:routes                                  # só testes de rota
node --import ./scripts/test/register.mjs --test artifacts/api-server/src/lib/calculations.test.ts
```

### E2E (Playwright)

```bash
pnpm --filter @workspace/api-server run build
PORT=5191 BASE_PATH=/ pnpm --filter @workspace/maratona run build
pnpm exec playwright install chromium   # só na primeira vez
pnpm run test:e2e
```

Para usar um navegador já instalado: `E2E_CHANNEL=msedge` (ou `chrome`).
Relatório em `playwright-report/`, traces em `test-results/`.

## Mudando a API

1. Edite `lib/api-spec/openapi.yaml` (rota, parâmetros, schemas).
2. `pnpm run codegen` — regenera `lib/api-client-react` e `lib/api-zod`.
3. Implemente a rota em `artifacts/api-server/src/routes/` e registre o
   router em `routes/index.ts` (a ordem importa; veja [ARQUITETURA.md](ARQUITETURA.md)).
4. Use o hook gerado no front.
5. Comite o `openapi.yaml` **e** os arquivos gerados juntos.

Regras: dados restritos por papel são filtrados na API (`requireRole` e
redação no handler), nunca só escondidos na tela.

## Mudando o banco

1. Altere `lib/db/src/schema/*.ts` (colunas de instante com `timestamptz` de
   `columns.ts`).
2. `pnpm --filter db generate` gera a próxima migração em `lib/db/migrations`.
3. Revise o SQL: prefira DDL aditivo e idempotente (`IF NOT EXISTS`).
4. `pnpm --filter @workspace/db run migrate:deploy` aplica no seu banco.
5. Comite o schema e a migração juntos.

Verificação da estrutura: `pnpm --filter @workspace/db run schema:check`
(só compara) e `schema:repair` (reaplica o que falta, sem apagar nada).
Detalhes e casos delicados: [lib/db/migrations/README.md](../lib/db/migrations/README.md).

`pnpm --filter db push` existe para experimentos locais, mas não gera
histórico: não use para mudanças que vão para produção.

## Convenções

- Interface, mensagens de erro, commits e documentação em **português (PT-BR)**.
- Na interface, use "Faixa" (nunca "Pelotão").
- Números na tela com `fmtNum` (vírgula decimal); datas de evento
  (`YYYY-MM-DD`) com `fmtDate` — `new Date("YYYY-MM-DD")` é UTC e muda o dia.
- Cores de texto: use os `*_TEXT` de `premium-theme.tsx` ou `--accent-text`
  (contraste ≥ 4,5:1).
- Trabalhe em branch e abra pull request para a `main`; o CI precisa estar verde.
- Decisões não óbvias ganham um arquivo em `docs/decisoes/` e uma linha no
  índice `docs/decisoes/MEMORY.md`.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| `DATABASE_URL must be set` | `.env` ausente ou sem `DATABASE_URL`. |
| API não sobe: `JWT_SECRET` | Variável obrigatória vazia. |
| `PORT environment variable is required` | Falta `PORT` no `.env`. |
| Telas vazias depois de um tempo | Token expirado (24 h): saia e entre de novo. |
| CI falha em "Contrato OpenAPI em dia" | Editou o `openapi.yaml` sem rodar `pnpm run codegen`. |
| `pnpm install` recusa um pacote recém-lançado | `minimumReleaseAge`: espere 1 dia ou use uma versão anterior. |
| Windows: build do web falha por binário nativo | O workspace remove binários não-Linux; veja a seção Gotchas de [NOTAS-DO-PROJETO.md](NOTAS-DO-PROJETO.md). |
