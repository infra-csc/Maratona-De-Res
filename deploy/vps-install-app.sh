#!/usr/bin/env bash
# Fase 2: baixa (ou atualiza) o código, instala, migra, builda e sobe o serviço.
# Rodar como root depois do vps-bootstrap.sh e de cadastrar a chave de deploy
# no GitHub. Na primeira vez, cria /opt/maratona/.env a partir do exemplo e
# para, para você preencher DATABASE_URL, JWT_SECRET etc.
#   BRANCH=main ./vps-install-app.sh
set -euo pipefail
APP_USER=maratona
APP_DIR=/opt/maratona
REPO=git@github.com:infra-csc/maratona-de-res.git
BRANCH=${BRANCH:-main}

as_app() { sudo -u "$APP_USER" -H bash -lc "cd $APP_DIR && $*"; }

if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" -H git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
else
  as_app "git fetch origin $BRANCH && git checkout $BRANCH && git reset --hard origin/$BRANCH"
fi

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  sed -i "s#^STORAGE_DIR=.*#STORAGE_DIR=/var/lib/maratona/storage#; s#^STATIC_DIR=.*#STATIC_DIR=$APP_DIR/artifacts/maratona/dist/public#; s#^ALLOWED_ORIGINS=.*#ALLOWED_ORIGINS=#" "$APP_DIR/.env"
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"; chmod 600 "$APP_DIR/.env"
  echo "Criei $APP_DIR/.env. Preencha DATABASE_URL, JWT_SECRET e SESSION_SECRET e rode de novo."
  exit 2
fi

as_app "./scripts/deploy.sh"
systemctl restart maratona
sleep 4
systemctl --no-pager --lines=15 status maratona || true
curl -fsS http://127.0.0.1:8080/api/healthz && echo
