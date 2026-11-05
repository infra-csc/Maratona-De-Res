# Variáveis de ambiente

Todas as configurações ficam no arquivo `.env` na raiz do projeto, criado a
partir de [`.env.example`](../.env.example). A API carrega esse arquivo
sozinha (`node --env-file-if-exists`); em produção o systemd também o lê
(`EnvironmentFile=/opt/maratona/.env`).

**Nunca comite o `.env`** (ele está no `.gitignore`). Em produção ele deve
pertencer ao usuário `maratona` com permissão `600`.

Depois de mudar o `.env` em produção: `sudo systemctl restart maratona`.
Variáveis usadas no **build do front** (`BASE_PATH`) só valem depois de um
novo build (`sudo bash /root/vps-install-app.sh`).

## Obrigatórias

| Variável | Exemplo | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://maratona:SENHA@127.0.0.1:5432/maratona` | Conexão com o PostgreSQL. A API não sobe sem ela. Em bancos gerenciados (Neon etc.) acrescente `?sslmode=verify-full`. |
| `JWT_SECRET` | `openssl rand -base64 48` | Assina os tokens de sessão. A API não sobe sem ela. Trocar o valor desloga todo mundo. |
| `PORT` | `8080` | Porta em que a API escuta. Em produção o Nginx encaminha para `127.0.0.1:8080`. |
| `NODE_ENV` | `production` | `production` no servidor, `development` na sua máquina. Com `production` o seed se recusa a rodar. |

## Arquivos (áudios das avaliações)

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `STORAGE_DIR` | `./data/storage` (relativo à pasta de execução) | Pasta dos áudios. Em produção: `/var/lib/maratona/storage`, fora do código e incluída no backup. |
| `STORAGE_SIGNING_SECRET` | usa `JWT_SECRET` | Segredo HMAC das URLs de upload (válidas por 15 min). |
| `STORAGE_MAX_UPLOAD_MB` | `25` | Tamanho máximo de um áudio. O Nginx precisa aceitar pelo menos isso (`client_max_body_size`). |
| `API_PUBLIC_BASE` | `/api` | Prefixo usado ao montar as URLs de upload. Só muda se a API ficar em outro caminho. |

## Front-end e rede

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `STATIC_DIR` | vazio | Caminho **absoluto** do build do web. Preenchido, a própria API serve o SPA. Produção: `/opt/maratona/artifacts/maratona/dist/public`. Vazio em dev (o Vite serve). |
| `BASE_PATH` | `/` | Base do build do Vite. Mude só se o app ficar num subcaminho. Vale no build. |
| `ALLOWED_ORIGINS` | vazio (qualquer origem) | Origens permitidas no CORS, separadas por vírgula. Como front e API estão no mesmo domínio, pode ficar vazio ou com `https://maratonaresultados.appsnorte.com`. |
| `TRUST_PROXY` | `loopback` | De quem a API aceita o IP real do cliente (`X-Forwarded-For`). `loopback` = Nginx na mesma máquina; `false` se a API ficar exposta direto; um número N confia em N saltos. Afeta o limite de tentativas de login. |
| `API_PROXY_TARGET` | `http://localhost:8080` | Só no `vite dev`: para onde o front encaminha `/api`. |

## Banco

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `PG_POOL_MAX` | `10` | Conexões simultâneas por processo. |

## Integrações (opcionais)

| Variável | Para quê |
| --- | --- |
| `SESSION_SECRET` | Login único vindo do portal NORTE (`POST /api/auth/portal-sso`). Deve ser o **mesmo valor** configurado no portal. Vazio: o SSO fica desligado e o login por e-mail/CPF continua normal. |
| `EXTERNAL_API_URL` | Endereço do sistema de onde a tela "Integração" importa colaboradores, eventos e participações. |
| `EXTERNAL_API_TOKEN` | Token enviado como `Bearer` para esse sistema (mesmo valor nos dois lados). Sem URL e token, a sincronização fica "não configurada". |

O contrato que o sistema externo precisa expor está em
[decisoes/integration-external-sync.md](decisoes/integration-external-sync.md).

## Logs

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | Nível dos logs (pino): `debug`, `info`, `warn`, `error`. |

## Só para desenvolvimento e testes

| Variável | Para quê |
| --- | --- |
| `ALLOW_DESTRUCTIVE_SEED` | `true` libera o seed, que **apaga todas as tabelas**. Nunca em produção. |
| `SEED_PASSWORD` | Senha dos usuários de demonstração criados pelo seed. |
| `E2E_CHANNEL` | Navegador do Playwright (`msedge`, `chrome`) em vez do Chromium baixado. |
| `PRIVATE_OBJECT_DIR` | Usada só por `lib/db/scripts/export-replit-audios.mjs` (migração antiga do Replit). |
