# Arquitetura

Visão geral de como o Maratona de Resultados está organizado. Para rodar o
projeto, veja [DESENVOLVIMENTO.md](DESENVOLVIMENTO.md); para a produção,
[DEPLOY-VPS.md](DEPLOY-VPS.md).

## Visão geral

```
Navegador ──HTTPS──► Cloudflare ──HTTPS──► Nginx (443) ──HTTP──► API Node (127.0.0.1:8080)
                                                                  ├── /api/*  → rotas Express
                                                                  └── /*      → SPA (build do Vite, via STATIC_DIR)
                                                                         │
                                                                         ├── PostgreSQL 18 (localhost)
                                                                         └── STORAGE_DIR (áudios em disco)
```

Um único processo Node (serviço systemd `maratona`) serve a API e o front-end.
Não há fila, cache externo nem outro serviço: o estado vive no PostgreSQL e
os áudios das avaliações vivem numa pasta em disco.

## Estrutura do repositório

| Pasta | Conteúdo |
| --- | --- |
| `artifacts/api-server` | API Express 5. `src/app.ts` monta middlewares e estáticos; `src/index.ts` sobe o servidor; `src/routes/*` são os endpoints; `src/lib/*` as regras de negócio. Build com esbuild (`build.mjs`) para `dist/index.mjs`. |
| `artifacts/maratona` | Front-end React 19 + Vite + Tailwind v4. `src/pages/*` são as telas; `src/components/shared` e `src/components/ui` os componentes; `src/lib/*` utilitários e chamadas. Build para `dist/public`. |
| `lib/api-spec` | `openapi.yaml`, a fonte do contrato da API, e a configuração do Orval. |
| `lib/api-client-react` | Hooks TanStack Query **gerados** a partir do OpenAPI (não editar à mão). |
| `lib/api-zod` | Schemas Zod **gerados** a partir do OpenAPI, usados na validação da API. |
| `lib/db` | Schema Drizzle (`src/schema`), conexão (`src/index.ts`), migrações (`migrations/`) e scripts de migração e verificação (`scripts/`). |
| `scripts` | `deploy.sh`, verificação do contrato da API, SQL de manutenção (`sql/`) e o harness de testes (`test/`). |
| `deploy` | Scripts de preparação da VPS (`vps-bootstrap.sh`) e de instalação/atualização (`vps-install-app.sh`). |
| `e2e` | Testes de navegador com Playwright. |
| `docs` | Esta documentação e o registro de decisões (`docs/decisoes`). |
| `attached_assets`, `screenshots` | Material herdado da época do Replit; não é usado pelo app. |

## Fluxo de uma requisição

1. O front chama a API pelos hooks gerados em `lib/api-client-react`. O
   prefixo `/api` é aplicado uma única vez em tempo de execução
   (`setBaseUrl`); os caminhos gerados são "nus".
2. O token JWT (validade de 24 h) vai no cabeçalho `Authorization: Bearer`.
3. Na API, `routes/index.ts` monta os routers numa **ordem que importa**:
   saúde e login primeiro, depois escopo do avaliador, trava de ciclo fechado,
   armazenamento, link público de avaliação e por fim as rotas de negócio.
4. `requireAuth` (em `lib/auth.ts`) valida o JWT e confere
   `users.token_version` (cache de 30 s): trocar papel, senha, status ou
   vínculo de colaborador exige `bumpTokenVersion`, o que derruba as sessões
   antigas.
5. `requireRole(...)` restringe por papel. A **redação de dados por papel é
   sempre feita na API**, nunca só escondida na tela.
6. O corpo é validado com os schemas de `@workspace/api-zod` e o acesso ao
   banco é feito com Drizzle.

## Contrato da API (OpenAPI → código)

`lib/api-spec/openapi.yaml` é escrito à mão e é a fonte única. Depois de
editá-lo, rode `pnpm run codegen` para regenerar `lib/api-client-react` e
`lib/api-zod`. O CI falha se:

- o cliente gerado não bater com o `openapi.yaml`;
- alguma rota Express não estiver declarada no spec (`pnpm run check:api-contract`).

Armadilhas conhecidas do Orval estão em `docs/decisoes/orval-*.md`
(não misturar parâmetro de caminho com query; corpo de requisição sempre como
`$ref` para um schema nomeado).

## Papéis

| Papel | Resumo |
| --- | --- |
| `admin` | Tudo, inclusive usuários, regras e "Modo Dev" (ver o app como outro usuário). |
| `rh` | Gestão de eventos, critérios, calibração, confirmação de resultados e ciclos. |
| `diretoria` | Gestão e consulta, incluindo calibração e liberação de eventos. |
| `operador` | Operação dos eventos; não vê notas. |
| `avaliador` | Avalia a(s) área(s) atribuída(s) a ele em cada evento; grava áudio de justificativa. |
| `visualizador` | Colaborador: vê apenas o próprio desempenho. |

O login do colaborador é feito por CPF (decisão de produto); por isso o
cadastro com CPF é restrito a gestores.

## Regras de negócio (onde estão)

- **Nota do evento, faixas e bônus:** `artifacts/api-server/src/lib/calculations.ts`
  (testes em `calculations.test.ts`). Média ponderada normalizada para 0–100;
  a nota média do ciclo define a faixa; a faixa define o prêmio base e o valor
  de cada evento além do mínimo.
- **Quem conta para a nota** (freelancer, Sup Ceno, inativo): `lib/participation.ts`.
- **Snapshot oficial do ciclo:** `recomputeCycleResults` em `routes/results.ts`.
  Só eventos com **resultados confirmados** (`resultsConfirmed`) entram.
- **Ciclos:** `routes/cycles.ts` e `lib/cycle-rules.ts`. Nunca são excluídos;
  só um é o atual; criar o próximo exige fechar o atual se ele tiver eventos;
  ciclo fechado só muda de nome.
- **Liberação automática da avaliação** no dia seguinte ao evento:
  `lib/evaluation-release.ts`, executada ao subir a API e a cada 30 minutos.
- Decisões e incidentes anteriores: [docs/decisoes](decisoes/MEMORY.md).

## Arquivos (áudios das avaliações)

Os áudios de justificativa são guardados em disco, em `STORAGE_DIR`
(`lib/objectStorage.ts` e `routes/storage.ts`):

1. O front pede uma URL de upload (`POST /api/storage/uploads/request-url`).
2. A API devolve uma URL assinada com HMAC e prazo de validade
   (`STORAGE_SIGNING_SECRET`, ou `JWT_SECRET` se vazio).
3. O front envia o arquivo com `PUT` para essa URL (limite `STORAGE_MAX_UPLOAD_MB`).
4. A avaliação guarda o caminho `/objects/uploads/<uuid>`; a leitura passa
   pela API, que confere o papel de quem pede.

Gravam: `admin`, `rh`, `avaliador`. Ouvem: `admin`, `rh`, `diretoria`, `avaliador`.

## Integrações externas (opcionais)

- **SSO do portal NORTE** — `POST /api/auth/portal-sso` recebe um JWT HS256
  emitido pelo portal (`iss = norte-portal`, com `exp` e `email`), assinado com
  `SESSION_SECRET`, e devolve uma sessão do Maratona para o usuário ativo com
  aquele e-mail. Sem `SESSION_SECRET` a rota responde 500 e o login normal
  continua funcionando.
- **Sincronização de colaboradores e eventos** — `POST /api/integration/sync`
  busca dados de outro sistema em `EXTERNAL_API_URL` com o token
  `EXTERNAL_API_TOKEN`. Sem as duas variáveis a tela de Integração mostra "não
  configurada". O contrato que o outro sistema precisa expor está em
  [decisoes/integration-external-sync.md](decisoes/integration-external-sync.md).

## Banco de dados

- Schema em `lib/db/src/schema/*.ts` (Drizzle); migrações SQL versionadas em
  `lib/db/migrations` — fluxo em [lib/db/migrations/README.md](../lib/db/migrations/README.md).
- Toda conexão fixa o fuso em UTC; colunas de instante são `timestamptz`.
  Datas de evento são texto `YYYY-MM-DD` (comparar como texto).
- Pool: `PG_POOL_MAX` conexões (padrão 10), timeout de conexão de 10 s e de
  consulta de 60 s.
- `GET /api/healthz` faz `select 1` no banco: responde 200 quando está tudo
  bem e 503 quando o banco não responde.

## Testes

- **Unitários e de rota** (`pnpm run test`): `node --test` com TypeScript via
  hook próprio (`scripts/test/register.mjs`). Os testes de rota sobem o app
  real de `src/` contra um PostgreSQL em WebAssembly (PGlite) com todas as
  migrações aplicadas (`scripts/test/api-harness.mjs`).
- **E2E** (`pnpm run test:e2e`): Playwright sobre o build de produção da API e
  do front, também com PGlite; fluxo login → evento → avaliação → calibração →
  confirmação → bônus.
