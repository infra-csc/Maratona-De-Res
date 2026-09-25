// Sobe o ambiente completo do E2E, sem serviço externo:
//   1. Postgres em WebAssembly (PGlite) exposto por socket (pglite-socket),
//      com as migrações de lib/db/migrations e o seed de support/seed.ts;
//   2. a API real, a partir do build (artifacts/api-server/dist/index.mjs);
//   3. o front a partir do build do Vite (artifacts/maratona/dist/public),
//      servido por support/web-server.ts com /api repassado para a API;
//   4. um recálculo inicial do ciclo, para Resultados já ter o ranking.
// A função devolvida é o teardown (Playwright chama ao final da execução).
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { FullConfig } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { applyMigrations, seed } from "./support/seed";
import { startWebServer } from "./support/web-server";
import { ADMIN, API_DIST, API_PORT, API_URL, DB_PORT, JWT_SECRET, LOG_DIR, WEB_DIST, WEB_PORT } from "./support/env";

function assertPortFree(port: number, what: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", () => reject(new Error(
      `Porta ${port} (${what}) ocupada. Libere-a ou defina outra via E2E_DB_PORT / E2E_API_PORT / E2E_WEB_PORT.`,
    )));
    srv.listen(port, "127.0.0.1", () => srv.close(() => resolve()));
  });
}

async function waitForHealth(api: ChildProcess, logFile: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) break;
    try {
      const r = await fetch(`${API_URL}/api/healthz`);
      if (r.ok) return;
    } catch { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 250));
  }
  const tail = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").slice(-3000) : "(sem log)";
  throw new Error(`A API não respondeu em ${API_URL}/api/healthz.\nÚltimas linhas de ${logFile}:\n${tail}`);
}

export default async function globalSetup(_config: FullConfig) {
  const apiEntry = path.join(API_DIST, "index.mjs");
  if (!fs.existsSync(apiEntry)) {
    throw new Error(`Build da API não encontrado (${apiEntry}). Rode: pnpm --filter @workspace/api-server run build`);
  }
  const indexHtml = path.join(WEB_DIST, "index.html");
  if (!fs.existsSync(indexHtml)) {
    throw new Error(`Build do front não encontrado (${WEB_DIST}). Rode: PORT=5191 BASE_PATH=/ pnpm --filter @workspace/maratona run build`);
  }
  // O servidor do E2E serve na raiz: o build precisa ter sido feito com BASE_PATH=/.
  // (No Git Bash do Windows, "/" vira "C:/Program Files/Git/" sem MSYS_NO_PATHCONV=1.)
  if (!/src="\/assets\//.test(fs.readFileSync(indexHtml, "utf8"))) {
    throw new Error(`O build do front em ${WEB_DIST} não foi feito com BASE_PATH=/ (os assets não estão em /assets/). Refaça o build.`);
  }
  await assertPortFree(DB_PORT, "banco");
  await assertPortFree(API_PORT, "API");
  await assertPortFree(WEB_PORT, "web");

  // 1. Banco
  const pg = new PGlite();
  await applyMigrations(pg);
  await seed(pg);
  const dbServer = new PGLiteSocketServer({ db: pg, port: DB_PORT, host: "127.0.0.1" });
  await dbServer.start();

  // 2. API (build de produção; PGlite atende uma conexão por vez → pool de 1)
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logFile = path.join(LOG_DIR, "e2e-api.log");
  const log = fs.createWriteStream(logFile);
  const api = spawn(process.execPath, [apiEntry], {
    cwd: path.dirname(API_DIST),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(API_PORT),
      JWT_SECRET,
      PG_POOL_MAX: "1",
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?sslmode=disable`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stdout?.pipe(log);
  api.stderr?.pipe(log);

  // 3. Web
  let web: Awaited<ReturnType<typeof startWebServer>> | undefined;
  const teardown = async () => {
    await new Promise<void>(resolve => (web ? web.close(() => resolve()) : resolve()));
    if (api.exitCode === null) {
      const exited = new Promise(r => api.once("exit", r));
      api.kill();
      await Promise.race([exited, new Promise(r => setTimeout(r, 5000))]);
    }
    log.end();
    await dbServer.stop();
    await pg.close();
  };

  try {
    await waitForHealth(api, logFile);
    web = await startWebServer({ root: WEB_DIST, port: WEB_PORT, apiPort: API_PORT });

    // 4. Recálculo inicial (pela própria API, logando como o admin semeado).
    const login = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: ADMIN.cpf, password: ADMIN.cpf }),
    });
    if (!login.ok) throw new Error(`Login do admin semeado falhou: ${login.status} ${await login.text()}`);
    const { token } = (await login.json()) as { token: string };
    const rec = await fetch(`${API_URL}/api/results/quarterly/recompute`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: "{}",
    });
    if (!rec.ok) throw new Error(`Recálculo inicial do ciclo falhou: ${rec.status} ${await rec.text()}`);
  } catch (err) {
    await teardown();
    throw err;
  }

  return teardown;
}
