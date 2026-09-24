// Harness dos testes de rota: API Express real (src/app.ts, sem build) contra um
// Postgres de verdade rodando em WebAssembly (PGlite), exposto por socket para
// o `pg` do Drizzle conectar como se fosse um servidor comum.
//
// Uso (um banco por arquivo de teste — o `node --test` já roda cada arquivo em
// um processo próprio):
//
//   import { startApi } from "../../../../scripts/test/api-harness.mjs";
//   const h = await startApi();          // em before()
//   await h.api("GET", "/employees", { role: "admin" });
//   await h.close();                     // em after() — o processo termina sozinho
//
// Ordem importa: lib/db cria o pool a partir de DATABASE_URL e lib/auth exige
// JWT_SECRET NO IMPORT. Por isso o banco sobe primeiro, o env é definido depois,
// e só então o app é importado dinamicamente.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const API_DIR = path.join(REPO_ROOT, "artifacts", "api-server");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "lib", "db", "migrations");
const requireFromApi = createRequire(path.join(API_DIR, "package.json"));
const jwt = requireFromApi("jsonwebtoken");

export const JWT_SECRET = "segredo-dos-testes-de-rota";

/** Faixas de bônus 2026 (nome, mín, máx, base, extra por evento adicional). */
export const FAIXAS_2026 = [
  { name: "Sem Bônus", color: "#94a3b8", min: 0, max: 69.99, base: 0, extra: 0 },
  { name: "Branco Caminhada", color: "#e2e8f0", min: 70, max: 74.99, base: 1200, extra: 200 },
  { name: "Branco Corrida", color: "#f1f5f9", min: 75, max: 79.99, base: 1700, extra: 250 },
  { name: "Verde", color: "#22c55e", min: 80, max: 84.99, base: 2200, extra: 300 },
  { name: "Azul", color: "#3b82f6", min: 85, max: 89.99, base: 2700, extra: 350 },
  { name: "Quênia", color: "#ca8a04", min: 90, max: 94.99, base: 3200, extra: 400 },
  { name: "Quênia Alto Rendimento", color: "#a16207", min: 95, max: 100, base: 3700, extra: 450 },
];

/** Aplica TODAS as migrações .sql em ordem de nome (0000_, 0001_, ...). */
async function applyMigrations(pg) {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    const statements = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
    for (const statement of statements) {
      try {
        await pg.exec(statement);
      } catch (err) {
        throw new Error(`Migração ${file} falhou em:\n${statement.slice(0, 300)}\n→ ${err.message}`);
      }
    }
  }
  return files;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

let started = false;

export async function startApi() {
  if (started) throw new Error("startApi() só pode ser chamado uma vez por arquivo de teste (um banco por processo).");
  started = true;

  // 1. Porta livre para o socket do banco (o SO escolhe; liberamos em seguida).
  const dbPort = await freePort();

  // 2. Env lido no import de lib/db, lib/auth e lib/logger.
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${dbPort}/postgres?sslmode=disable`;
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.NODE_ENV = "production"; // sem pino-pretty (worker que prende o processo)
  process.env.LOG_LEVEL = process.env.TEST_API_LOG ? "info" : "silent";
  process.env.PG_POOL_MAX = "1"; // o socket do PGlite aceita uma conexão por vez

  // 3. Em paralelo (cada um leva ~3 s): o banco em memória com as migrações e o
  //    import do app sem build. O pool do pg só conecta na primeira consulta.
  //    O @workspace/db tem que ser o MESMO módulo que o app usa (mesma URL
  //    resolvida), senão fecharíamos um pool diferente no teardown.
  const pg = new PGlite();
  const [migrations, { default: app }, { pool }] = await Promise.all([
    applyMigrations(pg),
    import(pathToFileURL(path.join(API_DIR, "src", "app.ts")).href),
    import(pathToFileURL(requireFromApi.resolve("@workspace/db")).href),
  ]);
  const socketServer = new PGLiteSocketServer({ db: pg, port: dbPort, host: "127.0.0.1" });
  await socketServer.start();

  const httpServer = await new Promise((resolve, reject) => {
    const s = app.listen(0, "127.0.0.1", err => (err ? reject(err) : resolve(s)));
  });
  const baseUrl = `http://127.0.0.1:${httpServer.address().port}/api`;

  // ─── Acesso direto ao banco (fixtures e conferências) ─────────────────────
  const sql = async (text, params = []) => (await pg.query(text, params)).rows;
  const one = async (text, params = []) => (await sql(text, params))[0];
  const usersColumns = new Set((await sql(
    `select column_name from information_schema.columns where table_name = 'users'`,
  )).map(r => r.column_name));

  // ─── Usuários e tokens ─────────────────────────────────────────────────────
  // Um usuário por (papel, colaborador), criado sob demanda: audit_logs,
  // quarterly_results.closed_by etc. têm FK para users, e o requireAuth confere
  // se o usuário existe, está ativo e tem o mesmo token_version do token.
  const userCache = new Map();
  async function ensureUser(role, { userId, employeeId = null, areaId = null } = {}) {
    const key = userId != null ? `id:${userId}` : `${role}|${employeeId ?? ""}|${areaId ?? ""}`;
    if (userCache.has(key)) return userCache.get(key);
    const cols = ["name", "password_hash", "role", "employee_id", "area_id"];
    const vals = [`Teste ${role}${employeeId != null ? ` #${employeeId}` : ""}`, "x", role, employeeId, areaId];
    if (userId != null) { cols.unshift("id"); vals.unshift(userId); }
    if (usersColumns.has("token_version")) { cols.push("token_version"); vals.push(0); }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
    const row = await one(
      `insert into users (${cols.join(", ")}) values (${placeholders})
       on conflict (id) do update set role = excluded.role, employee_id = excluded.employee_id, active = true
       returning id`,
      vals,
    );
    if (userId != null) await sql(`select setval('users_id_seq', greatest((select max(id) from users), 1))`);
    userCache.set(key, row.id);
    return row.id;
  }

  /** Token JWT válido para o papel (semeia o usuário correspondente). */
  async function tokenFor(role, opts = {}) {
    const userId = await ensureUser(role, opts);
    const tv = usersColumns.has("token_version")
      ? (await one(`select token_version from users where id = $1`, [userId])).token_version
      : 0;
    return jwt.sign(
      { userId, email: null, role, employeeId: opts.employeeId ?? null, areaId: opts.areaId ?? null, tv },
      JWT_SECRET,
      { expiresIn: "1h" },
    );
  }

  /**
   * Chamada HTTP. `role` gera token (com `employeeId`/`userId` opcionais);
   * `token` usa um token pronto; sem nenhum dos dois vai sem autenticação.
   */
  async function api(method, urlPath, { role, token, body, employeeId, userId } = {}) {
    const headers = { "content-type": "application/json" };
    const bearer = token ?? (role ? await tokenFor(role, { employeeId, userId }) : null);
    if (bearer) headers.authorization = `Bearer ${bearer}`;
    const res = await fetch(baseUrl + urlPath, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* corpo não-JSON */ }
    return { status: res.status, data };
  }

  // ─── Fábricas de fixtures (SQL direto; devolvem o id criado) ─────────────
  const fx = {
    async cycle({ name = "Ciclo 2 · 2026", startDate = "2026-07-01", endDate = "2026-12-31", status = "open", isCurrent = true } = {}) {
      if (isCurrent) await sql(`update cycles set is_current = false where is_current`);
      return (await one(
        `insert into cycles (name, start_date, end_date, status, is_current, closed_at)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [name, startDate, endDate, status, isCurrent, status === "closed" ? new Date() : null],
      )).id;
    },

    async employee({ name, employmentType = "casa", active = true, functionName = "Montador", document = null, email = null, phone = null } = {}) {
      return (await one(
        `insert into employees (name, employment_type, active, function_name, document, email, phone)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [name ?? `Colaborador ${Math.random().toString(36).slice(2, 7)}`, employmentType, active, functionName, document, email, phone],
      )).id;
    },

    /** Colaboradores típicos: casa ativo, freela ativo e casa inativo. */
    async employees() {
      return {
        casa: await fx.employee({ name: "Ana Casa", document: "11122233344", email: "ana@exemplo.com", phone: "11999990000" }),
        freela: await fx.employee({ name: "Caio Freela", employmentType: "freela", document: "55566677788" }),
        inativo: await fx.employee({ name: "Bruno Desligado", active: false, document: "99988877766" }),
      };
    },

    async platoonRules2026() {
      for (const [i, f] of FAIXAS_2026.entries()) {
        await sql(
          `insert into platoon_rules (name, color, min_score, max_score, min_inclusive, max_inclusive, bonus_value, bonus_per_extra_event, active, display_order)
           values ($1, $2, $3, $4, true, true, $5, $6, true, $7)`,
          [f.name, f.color, f.min, f.max, f.base, f.extra, i],
        );
      }
    },

    async rule(key, value) {
      await sql(
        `insert into rules (key, value, description) values ($1, $2, $3)
         on conflict (key) do update set value = excluded.value`,
        [key, String(value), `Regra de teste ${key}`],
      );
    },

    async criterion({ name, weight = 1, allowPublicLink = null } = {}) {
      const id = (await one(
        `insert into criteria (name, default_weight) values ($1, $2) returning id`,
        [name ?? `Critério ${Math.random().toString(36).slice(2, 7)}`, weight],
      )).id;
      if (allowPublicLink != null) {
        await sql(`insert into criterion_routing (criterion_id, allow_public_link) values ($1, $2)`, [id, allowPublicLink]);
      }
      return id;
    },

    /**
     * Evento com critérios e participantes. `participants` aceita ids ou
     * objetos { employeeId, functionName?, confirmed? }.
     */
    async event({ cycleId, name, date = "2026-08-01", status = "closed", resultsConfirmed = true, criteria = [], participants = [] } = {}) {
      const eventId = (await one(
        `insert into events (name, start_date, end_date, cycle_id, status, results_confirmed, results_confirmed_at)
         values ($1, $2, $2, $3, $4, $5, $6) returning id`,
        [name ?? `Evento ${date}`, date, cycleId, status, resultsConfirmed, resultsConfirmed ? new Date() : null],
      )).id;
      for (const c of criteria) {
        const criterionId = typeof c === "number" ? c : c.criterionId;
        await sql(`insert into event_criteria (event_id, criterion_id, weight_override) values ($1, $2, $3)`,
          [eventId, criterionId, typeof c === "number" ? null : (c.weight ?? null)]);
      }
      for (const p of participants) {
        const part = typeof p === "number" ? { employeeId: p } : p;
        await sql(
          `insert into event_participants (event_id, employee_id, function_name, confirmed) values ($1, $2, $3, $4)`,
          [eventId, part.employeeId, part.functionName ?? "Montador", part.confirmed ?? true],
        );
      }
      return eventId;
    },

    async evaluation({ eventId, criterionId, evaluatorUserId, score, status = "submitted" }) {
      return (await one(
        `insert into evaluations (event_id, criterion_id, evaluator_user_id, score, status, submitted_at)
         values ($1, $2, $3, $4, $5, $6) returning id`,
        [eventId, criterionId, evaluatorUserId, score, status, status === "submitted" ? new Date() : null],
      )).id;
    },

    async calibration({ eventId, criterionId, score, userId, reason = "Calibração de teste" }) {
      return (await one(
        `insert into calibrations (event_id, criterion_id, calibrated_score, calibration_reason, calibrated_by_user_id)
         values ($1, $2, $3, $4, $5) returning id`,
        [eventId, criterionId, score, reason, userId],
      )).id;
    },

    async absence({ employeeId, cycleId, userId, points = 5, kind = "penalty", penaltyType = "falta", date = "2026-08-15", quantity = 1, reason = null }) {
      return (await one(
        `insert into absences (employee_id, cycle_id, registered_by_user_id, points, kind, penalty_type, date, quantity, reason)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
        [employeeId, cycleId, userId, points, kind, penaltyType, date, quantity, reason],
      )).id;
    },

    async criterionAssignment({ eventId, criterionId, assignedToId, status = "suggested" }) {
      return (await one(
        `insert into event_criterion_assignments (event_id, criterion_id, assigned_to_id, status)
         values ($1, $2, $3, $4) returning id`,
        [eventId, criterionId, assignedToId, status],
      )).id;
    },
  };

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise(resolve => {
      httpServer.close(() => resolve());
      httpServer.closeAllConnections();
    });
    await pool.end().catch(() => {});
    await socketServer.stop();
    await pg.close();
  }

  return { baseUrl, api, tokenFor, ensureUser, sql, one, fx, close, pg, migrations };
}
