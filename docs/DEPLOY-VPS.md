# Produção (VPS)

Como a produção do Maratona de Resultados está montada e como mantê-la.
Desde 04/11/2026 o app roda numa VPS própria (antes rodava no Replit, que não é mais
usado).

> Este repositório é público. Endereço IP do servidor, usuários, senhas e
> chaves **não** ficam aqui: estão com a equipe de TI.

## Como está montado

| Item | Valor |
| --- | --- |
| Endereço público | https://maratonaresultados.appsnorte.com/ |
| Sistema | Ubuntu 24.04 LTS, fuso `America/Sao_Paulo`, swap de 2 GB |
| Node / pnpm | Node 24 (NodeSource) / pnpm 10 |
| Código | `/opt/maratona` (clone da `main`, dono: usuário de sistema `maratona`) |
| Configuração | `/opt/maratona/.env` (permissão 600) — ver [VARIAVEIS-DE-AMBIENTE.md](VARIAVEIS-DE-AMBIENTE.md) |
| Áudios | `/var/lib/maratona/storage` (`STORAGE_DIR`) |
| Serviço | systemd `maratona` → `node dist/index.mjs` em `artifacts/api-server`, porta 8080 só em `127.0.0.1` |
| Front-end | Servido pela própria API (`STATIC_DIR=/opt/maratona/artifacts/maratona/dist/public`) |
| Banco | PostgreSQL 18 local, banco e usuário `maratona`, aceita conexão só de `localhost` |
| Proxy | Nginx: HTTPS na 443 → `127.0.0.1:8080` |
| Firewall | `ufw` (SSH, 80, 443) + `fail2ban` |
| Atualizações do sistema | `unattended-upgrades` (correções de segurança automáticas) |
| Backup | `pg_dump` diário do banco (ver [Backup](#backup)) |

```
Usuário ─► Cloudflare (proxy, SSL "Full") ─► Nginx :443 (certificado de origem autoassinado)
                                               └─► API Node 127.0.0.1:8080 ─► PostgreSQL 18 (localhost)
                                                                            └─► /var/lib/maratona/storage
```

### Cloudflare e HTTPS

- O DNS de `maratonaresultados.appsnorte.com` está **com proxy** (nuvem laranja)
  no Cloudflare.
- Entre o Cloudflare e o servidor o Nginx usa um **certificado autoassinado**
  de longa duração. Por isso o modo SSL/TLS do Cloudflare precisa ficar em
  **Full**. **Não mude para "Full (strict)"**: o site passa a dar erro 526.
  Para usar "Full (strict)", troque antes o certificado do Nginx por um
  *Cloudflare Origin Certificate* ou Let's Encrypt.
- O Nginx restaura o IP real do visitante a partir das faixas do Cloudflare
  (`set_real_ip_from` + `real_ip_header CF-Connecting-IP`) para os logs e o
  limite de tentativas de login.
- Acesso direto pelo IP está fechado: um `server` *default* do Nginx responde
  `444` (fecha a conexão) para qualquer nome que não seja o domínio.

Exemplo do site Nginx (`/etc/nginx/sites-available/maratona`), para
referência ao recriar o servidor:

```nginx
# Qualquer acesso que não seja pelo domínio: fecha a conexão.
server {
    listen 80 default_server;
    listen 443 ssl default_server;
    server_name _;
    ssl_certificate     /etc/nginx/ssl/origin.crt;
    ssl_certificate_key /etc/nginx/ssl/origin.key;
    return 444;
}

server {
    listen 80;
    server_name maratonaresultados.appsnorte.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name maratonaresultados.appsnorte.com;

    ssl_certificate     /etc/nginx/ssl/origin.crt;
    ssl_certificate_key /etc/nginx/ssl/origin.key;

    # IP real do visitante (lista completa: https://www.cloudflare.com/ips/)
    # set_real_ip_from 173.245.48.0/20;  ... (uma linha por faixa)
    real_ip_header CF-Connecting-IP;

    client_max_body_size 30m;   # >= STORAGE_MAX_UPLOAD_MB

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

## Atualizar o app (deploy)

O fluxo normal é sempre pela `main`:

1. A mudança entra por pull request; o CI precisa estar verde; faz-se o merge
   na `main`.
2. No servidor, com um usuário administrador:

   ```bash
   sudo bash /root/vps-install-app.sh
   ```

O script (cópia de [`deploy/vps-install-app.sh`](../deploy/vps-install-app.sh)):

1. faz `git fetch` + `git reset --hard origin/main` em `/opt/maratona`
   (alterações manuais no código do servidor são descartadas; o `.env` fica);
2. roda [`scripts/deploy.sh`](../scripts/deploy.sh): `pnpm install`,
   migrações do banco (`migrate:deploy`), conferência da estrutura
   (`schema:check`) e build da API e do front;
3. reinicia o serviço e chama `http://127.0.0.1:8080/api/healthz`.

No fim deve aparecer `{"status":"ok"}`. Para instalar outra branch (teste):
`sudo BRANCH=nome-da-branch bash /root/vps-install-app.sh` — e depois volte
para a `main` da mesma forma.

**Não publique mais nada pelo Replit**: ele não é mais a produção, e o que
for gravado lá se perde.

### Migrações em produção

As migrações rodam sozinhas no deploy e só aplicam o que falta. Antes de um
merge que mexe no banco, leia o [README das migrações](../lib/db/migrations/README.md)
— algumas pedem ordem específica (publicar o código antes de migrar) ou uma
checagem de duplicatas (`scripts/sql/check-duplicates.sql`).

## Operação do dia a dia

```bash
sudo systemctl status maratona          # está rodando?
sudo journalctl -u maratona -f          # logs da API ao vivo
sudo journalctl -u maratona --since "1 hour ago"
sudo systemctl restart maratona         # depois de mudar o .env
curl -s http://127.0.0.1:8080/api/healthz
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
sudo nginx -t && sudo systemctl reload nginx   # depois de mudar o Nginx
```

Acesso ao banco: `sudo -u postgres psql maratona`.

## Backup

- Um `pg_dump` diário do banco `maratona` é gravado no próprio servidor
  (agendado no cron/systemd do servidor, com retenção limitada).
- Os áudios ficam em `/var/lib/maratona/storage` e também precisam de cópia.
- **Enquanto não houver cópia fora do servidor, perder a VPS significa perder
  os dados.** Baixe periodicamente o dump e os áudios, ou configure envio para
  um armazenamento externo (por exemplo Cloudflare R2 ou um *storage box*).

Restaurar um dump (com o serviço parado):

```bash
sudo systemctl stop maratona
sudo -u postgres dropdb maratona
sudo -u postgres createdb -O maratona maratona
sudo -u postgres pg_restore -d maratona --no-owner --role=maratona ARQUIVO.dump   # formato custom
# ou, se o dump for .sql:  sudo -u postgres psql -d maratona -f ARQUIVO.sql
sudo systemctl start maratona
```

Confira o formato do arquivo antes (`pg_restore -l ARQUIVO` funciona só no
formato custom). Faça um dump do estado atual antes de restaurar.

## Voltar uma versão (rollback)

A forma segura é reverter na `main` e reinstalar:

1. No GitHub, use **Revert** no pull request problemático e faça o merge do revert.
2. No servidor: `sudo bash /root/vps-install-app.sh`.

As migrações só andam para frente: reverter o código **não desfaz** colunas
ou tabelas já criadas. Como as migrações são aditivas, o código anterior
normalmente continua funcionando. Se uma migração precisar ser desfeita,
restaure o backup do banco feito antes do deploy.

## Montar um servidor novo do zero

1. Ubuntu 24.04 limpo, acesso root por chave SSH.
2. Copie e rode a fase 1, que instala pacotes, Node, pnpm, Nginx, firewall,
   fail2ban, swap, o usuário `maratona`, as pastas e o serviço systemd:
   `sudo bash deploy/vps-bootstrap.sh`.
3. Instale o PostgreSQL 18 (repositório oficial `apt.postgresql.org`), crie o
   usuário e o banco `maratona` e restaure o último backup.
4. Rode a fase 2: `sudo bash deploy/vps-install-app.sh`. Na primeira vez ela
   cria `/opt/maratona/.env` a partir do exemplo e para: preencha
   `DATABASE_URL`, `JWT_SECRET` (o mesmo de antes para não deslogar ninguém) e,
   se usar, `SESSION_SECRET` / `EXTERNAL_API_*`. Rode de novo.
5. Copie os áudios para `/var/lib/maratona/storage` (dono `maratona`).
6. Configure o Nginx com HTTPS como no exemplo acima e aponte o DNS no
   Cloudflare para o novo IP (proxy ligado, SSL em **Full**).
7. Configure o backup diário.

## Problemas comuns

| Sintoma | O que verificar |
| --- | --- |
| Erro 526 no navegador | Cloudflare foi colocado em "Full (strict)". Volte para "Full". |
| Erro 521/522 | Nginx parado ou firewall bloqueando 443: `systemctl status nginx`, `ufw status`. |
| Erro 502 | API parada: `systemctl status maratona` e `journalctl -u maratona -n 100`. |
| `healthz` responde 503 | API sem banco: `systemctl status postgresql` e `DATABASE_URL` no `.env`. |
| Áudio não toca ou não grava | Permissão de `/var/lib/maratona/storage` (dono `maratona`) e `client_max_body_size` do Nginx. |
| Login falha para todos depois de mexer no `.env` | `JWT_SECRET` mudou: sessões antigas caem; peça para entrarem de novo. |
| Deploy para em `schema:check` com aviso | Diferença entre o banco e as migrações; ver [README das migrações](../lib/db/migrations/README.md) (`schema:repair`). |

## Melhorias planejadas

- Backup automático fora do servidor (banco e áudios).
- Firewall aceitando 80/443 só das faixas do Cloudflare.
- Certificado de origem do Cloudflare para permitir "Full (strict)".
- Áudios no Cloudflare R2 em vez do disco local.
