#!/usr/bin/env bash
# Prepara uma VPS Ubuntu 24.04 limpa para o Maratona. Rodar como root.
# Idempotente: pode rodar de novo sem estragar nada.
#
# O que faz: atualiza o sistema, swap de 2 GB, firewall (22/80/443), fail2ban,
# Node 24 + pnpm 10, Nginx, Certbot, usuário de serviço `maratona`, pastas,
# chave SSH de deploy (só necessária se o repositório virar privado), serviço
# systemd e site Nginx HTTP básico (o HTTPS e o Cloudflare estão em docs/DEPLOY-VPS.md).
# NÃO clona o código nem cria o .env: isso é a fase 2 (deploy/vps-install-app.sh).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_USER=maratona
APP_DIR=/opt/maratona
DATA_DIR=/var/lib/maratona
PORT=8080

echo "==> Pacotes do sistema"
apt-get update -y
apt-get upgrade -y
apt-get install -y curl ca-certificates gnupg git build-essential ufw fail2ban nginx certbot python3-certbot-nginx unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades || true
timedatectl set-timezone America/Sao_Paulo || true

echo "==> Swap (2 GB)"
if ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Node 24 + pnpm 10"
if ! node -v 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
npm install -g pnpm@10.28.0

echo "==> Usuário e pastas"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/$APP_USER --shell /bin/bash "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/storage" /var/log/maratona
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR" /var/log/maratona
chmod 750 "$DATA_DIR"

echo "==> Chave de deploy (GitHub, somente leitura; opcional enquanto o repositório for público)"
sudo -u "$APP_USER" bash -c '
  mkdir -p ~/.ssh && chmod 700 ~/.ssh
  [ -f ~/.ssh/id_ed25519 ] || ssh-keygen -q -t ed25519 -N "" -C "maratona-vps-deploy" -f ~/.ssh/id_ed25519
  ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null
  sort -u -o ~/.ssh/known_hosts ~/.ssh/known_hosts
'

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
systemctl enable --now fail2ban

echo "==> Serviço systemd"
cat > /etc/systemd/system/maratona.service <<EOF
[Unit]
Description=Maratona de Resultados (API + web)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/artifacts/api-server
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node --enable-source-maps dist/index.mjs
Restart=always
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=15
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$DATA_DIR $APP_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable maratona.service

echo "==> Nginx"
cat > /etc/nginx/sites-available/maratona <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 30m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/maratona /etc/nginx/sites-enabled/maratona
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo
echo "================ PRONTO (fase 1) ================"
echo "node $(node -v) · pnpm $(pnpm -v) · $(nginx -v 2>&1)"
echo "Chave pública de deploy (só se o repositório for privado: adicionar no GitHub como Deploy key, somente leitura):"
cat /home/$APP_USER/.ssh/id_ed25519.pub
