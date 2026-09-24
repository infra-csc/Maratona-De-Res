#!/bin/bash
set -e
pnpm install --frozen-lockfile
# Migrações versionadas e revisadas (lib/db/migrations). Na primeira vez num
# banco criado por push, o script adota o baseline e aplica só o que falta.
pnpm --filter @workspace/db run migrate:deploy
# Rede de segurança contra divergência entre o banco e o schema: sem --force,
# o push não apaga coluna nem tabela; se precisar, ele para e pede revisão.
pnpm --filter db push
