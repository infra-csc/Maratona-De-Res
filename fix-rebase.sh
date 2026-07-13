#!/bin/bash
set -e
echo "==> Marcando conflito como resolvido..."
git add artifacts/api-server/src/routes/evaluations.ts
echo "==> Continuando o rebase..."
GIT_EDITOR=true git rebase --continue
echo "==> Concluído! Rebase finalizado."
git status
