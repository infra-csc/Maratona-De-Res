# Maratona de Resultados

Aplicação interna de RH para avaliar o desempenho das equipes em eventos,
calibrar as notas, consolidar o ciclo e calcular o bônus de cada colaborador.

- **Produção:** https://maratonaresultados.appsnorte.com/ (VPS própria, atrás do Cloudflare)
- **Idioma:** toda a interface, os commits e a documentação são em português (PT-BR).

## Documentação

| Documento | Para quê |
| --- | --- |
| [docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md) | Rodar na sua máquina, testes, codegen da API, migrações, seed |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Como o código está organizado, fluxo de uma requisição, papéis, regras de negócio |
| [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md) | Como a produção está montada, como atualizar, backup, rollback e problemas comuns |
| [docs/VARIAVEIS-DE-AMBIENTE.md](docs/VARIAVEIS-DE-AMBIENTE.md) | Todas as variáveis do `.env`, obrigatórias e opcionais |
| [docs/NOTAS-DO-PROJETO.md](docs/NOTAS-DO-PROJETO.md) | Resumo rápido: onde fica cada coisa, decisões e armadilhas |
| [docs/decisoes/](docs/decisoes/MEMORY.md) | Registro de decisões e incidentes passados (um arquivo por assunto) |
| [lib/db/migrations/README.md](lib/db/migrations/README.md) | Fluxo de migrações do banco e histórico das migrações delicadas |

## Stack

- **Monorepo:** pnpm workspaces · Node.js 24 · TypeScript 5.9
- **API:** Express 5 + Drizzle ORM (PostgreSQL), empacotada com esbuild — `artifacts/api-server`
- **Web:** React 19 + Vite + Tailwind v4 + TanStack Query + wouter — `artifacts/maratona`
- **Contrato:** OpenAPI (`lib/api-spec/openapi.yaml`) → hooks React (`lib/api-client-react`) e schemas Zod (`lib/api-zod`) gerados com Orval
- **Banco:** PostgreSQL; schema em `lib/db/src/schema`, migrações versionadas em `lib/db/migrations`
- **Testes:** `node --test` (unitários e de rota contra Postgres em WASM/PGlite) e Playwright (E2E)
- **Produção:** Ubuntu 24.04 · Nginx · systemd · PostgreSQL 18 local · Cloudflare na frente

## Começo rápido (desenvolvimento)

Pré-requisitos: Node 24, pnpm 10 (`corepack enable`) e um PostgreSQL acessível.

```bash
cp .env.example .env        # preencha DATABASE_URL e JWT_SECRET; use NODE_ENV=development
pnpm install
pnpm --filter @workspace/db run migrate:deploy   # cria/atualiza as tabelas
pnpm --filter @workspace/api-server run dev      # API em http://localhost:8080
pnpm --filter @workspace/maratona run dev        # web em http://localhost:5173 (proxy /api → 8080)
```

Detalhes, dados de demonstração e solução de problemas em
[docs/DESENVOLVIMENTO.md](docs/DESENVOLVIMENTO.md).

## Portões de qualidade

```bash
pnpm run typecheck            # libs + api + web
pnpm run test                 # unitários + rotas (Postgres em WASM, sem serviço externo)
pnpm run check:api-contract   # toda rota Express precisa estar no openapi.yaml
pnpm run codegen              # depois de editar o openapi.yaml
pnpm run build                # typecheck + build de produção (api + web)
pnpm run test:e2e             # Playwright (precisa do build; ver DESENVOLVIMENTO.md)
```

O CI (`.github/workflows/ci.yml`) roda tudo isso em cada push e pull request,
e falha se o `openapi.yaml` mudar sem o cliente regenerado.

## Atualizar a produção

1. Abrir pull request e fazer merge na `main` (o CI precisa estar verde).
2. No servidor, como administrador: `sudo bash /root/vps-install-app.sh`.
   O script baixa a `main`, instala, aplica as migrações, faz o build e
   reinicia o serviço. Passo a passo e rollback em [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md).

## Segurança

Este repositório é **público**. Nunca comite `.env`, senhas, tokens, chaves,
dumps de banco, endereços de servidor nem dados pessoais (CPF, nomes de
colaboradores, prints de telas com dados reais).

## Licença

Uso interno. O campo `license` do `package.json` é herança do template inicial.
