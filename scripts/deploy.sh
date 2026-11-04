#!/usr/bin/env bash
# Atualiza a instalação na VPS: dependências, migrações e build.
# Uso (na raiz do projeto, com o .env preenchido):  ./scripts/deploy.sh
# Depois reinicie o processo da API (systemd/PM2).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Falta o arquivo .env na raiz (copie de .env.example)." >&2
  exit 1
fi
set -a; . ./.env; set +a

pnpm install --frozen-lockfile
# Migrações versionadas e revisadas (lib/db/migrations). Na primeira vez num
# banco criado por push, o script adota o baseline e aplica só o que falta.
pnpm --filter @workspace/db run migrate:deploy
# Só confere (não altera) a estrutura do banco contra as migrações.
pnpm --filter @workspace/db run schema:check || echo "[aviso] schema:check apontou diferenças; revise antes de seguir."
pnpm --filter @workspace/api-server --filter @workspace/maratona run build
echo "Build pronto. Reinicie a API (ex: sudo systemctl restart maratona)."
