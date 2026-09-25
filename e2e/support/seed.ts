// Banco do E2E: aplica as migrações de lib/db/migrations (na ordem do
// _journal.json) e semeia o mínimo para o fluxo principal.
//
// Cenário semeado (ciclo corrente aberto, mínimo de 8 eventos para o bônus):
//  - 7 eventos já confirmados, cada um com os 2 critérios calibrados em 9,0;
//    Ana e Bruno participaram de todos (7 eventos → ainda inelegíveis).
//  - 1 evento alvo ABERTO, critérios confirmados pelo RH, os 2 critérios
//    designados ao avaliador, sem nenhuma nota. Ana, Bruno e Carla na equipe.
// Quando o fluxo confirma o evento alvo, Ana e Bruno chegam a 8 eventos e
// passam a ter bônus; Carla (1 evento) continua inelegível.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { PGlite } from "@electric-sql/pglite";
import { ADMIN, AVALIADOR, ANA, CRITERIA, REPO_ROOT, TARGET_EVENT } from "./env";

const MIGRATIONS_DIR = path.join(REPO_ROOT, "lib", "db", "migrations");

export async function applyMigrations(pg: PGlite): Promise<string[]> {
  const journal = JSON.parse(fs.readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const tags = [...journal.entries].sort((a, b) => a.idx - b.idx).map(e => e.tag);
  for (const tag of tags) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean)) {
      try {
        await pg.exec(statement);
      } catch (err) {
        throw new Error(`Migração ${tag} falhou em:\n${statement.slice(0, 300)}\n→ ${(err as Error).message}`);
      }
    }
  }
  return tags;
}

type Row = Record<string, string | number | boolean | null>;

const lit = (v: Row[string]): string =>
  v === null ? "NULL" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${v.replace(/'/g, "''")}'`;

function insert(table: string, rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${rows.map(r => `(${cols.map(c => lit(r[c])).join(", ")})`).join(",\n")};`;
}

/** "YYYY-MM-DD" deslocado `days` dias a partir de hoje (UTC). */
function isoDay(days: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function seed(pg: PGlite): Promise<void> {
  // Mesma lib de hash da API (routes/auth.ts usa bcryptjs.compare).
  const requireFromApi = createRequire(path.join(REPO_ROOT, "artifacts", "api-server", "package.json"));
  const bcrypt = requireFromApi("bcryptjs") as { hashSync(s: string, rounds: number): string };

  const statements: string[] = [];

  statements.push(insert("areas", [
    { id: 1, name: "Operações", active: true },
    { id: 2, name: "Logística", active: true },
  ]));

  statements.push(insert("employees", [
    { id: ANA.id, name: ANA.name, department: "Operações", function_name: "Montador", employment_type: "casa", active: true },
    { id: 2, name: "Bruno Lima E2E", department: "Operações", function_name: "Montador", employment_type: "casa", active: true },
    { id: 3, name: "Carla Souza E2E", department: "Operações", function_name: "Motorista", employment_type: "casa", active: true },
  ]));

  statements.push(insert("users", [
    { id: ADMIN.id, name: ADMIN.name, email: "admin.e2e@exemplo.com", cpf_login: ADMIN.cpf, role: "admin", area_id: null },
    { id: AVALIADOR.id, name: AVALIADOR.name, email: "avaliador.e2e@exemplo.com", cpf_login: AVALIADOR.cpf, role: "avaliador", area_id: 1 },
  ].map(u => ({ ...u, password_hash: bcrypt.hashSync(u.cpf_login, 8), active: true, must_change_password: false }))));

  statements.push(insert("cycles", [
    { id: 1, name: "Ciclo E2E", start_date: isoDay(-200), end_date: isoDay(160), status: "open", is_current: true },
  ]));

  statements.push(insert("criteria", CRITERIA.map((c, i) => ({
    id: c.id, name: c.name, responsible_area_id: 1, default_weight: 50, active: true, display_order: i + 1, event_scoped: false,
  }))));

  // Faixas de bônus (mesmos valores dos testes de rota / regra 2026).
  const FAIXAS: [string, string, number, number, number, number][] = [
    ["Sem Bônus", "#94a3b8", 0, 69.99, 0, 0],
    ["Branco Caminhada", "#e2e8f0", 70, 74.99, 1200, 200],
    ["Branco Corrida", "#f1f5f9", 75, 79.99, 1700, 250],
    ["Verde", "#22c55e", 80, 84.99, 2200, 300],
    ["Azul", "#3b82f6", 85, 89.99, 2700, 350],
    ["Quênia", "#ca8a04", 90, 94.99, 3200, 400],
    ["Quênia Alto Rendimento", "#a16207", 95, 100, 3700, 450],
  ];
  statements.push(insert("platoon_rules", FAIXAS.map(([name, color, min, max, bonus, extra], i) => ({
    name, color, min_score: min, max_score: max, min_inclusive: true, max_inclusive: true,
    bonus_value: bonus, bonus_per_extra_event: extra, active: true, display_order: i,
  }))));
  statements.push(insert("rules", [
    { key: "min_events_eligibility", value: "8", description: "Mínimo de eventos participados no ciclo para o colaborador ser elegível ao bônus" },
  ]));

  // 7 eventos passados já confirmados + o evento alvo (id 8), aberto.
  const events: Row[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = isoDay(-7 * (9 - i));
    events.push({
      id: i, name: `Corrida Histórica E2E ${i}`, client_name: "Cliente E2E", city: "São Paulo", state: "SP",
      start_date: day, end_date: day, cycle_id: 1, status: "closed", criteria_confirmed: true,
      results_confirmed: true, results_confirmed_at: `${day} 20:00`, results_confirmed_by: ADMIN.id, feedback_released: true,
    });
  }
  const targetDay = isoDay(-3);
  events.push({
    id: TARGET_EVENT.id, name: TARGET_EVENT.name, client_name: "Cliente E2E", city: "Campinas", state: "SP",
    start_date: targetDay, end_date: targetDay, cycle_id: 1, status: "open", criteria_confirmed: true,
    results_confirmed: false, results_confirmed_at: null, results_confirmed_by: null, feedback_released: false,
  });
  statements.push(insert("events", events));

  const participants: Row[] = [];
  const eventCriteria: Row[] = [];
  const calibrations: Row[] = [];
  for (let e = 1; e <= 7; e++) {
    for (const emp of [ANA.id, 2]) participants.push({ event_id: e, employee_id: emp, function_name: "Montador", confirmed: true });
    for (const c of CRITERIA) {
      eventCriteria.push({ event_id: e, criterion_id: c.id, active: true, weight_override: 50 });
      calibrations.push({ event_id: e, criterion_id: c.id, original_average_score: 9, calibrated_score: 9, calibration_reason: "Seed E2E", calibrated_by_user_id: ADMIN.id });
    }
  }
  for (const emp of [ANA.id, 2, 3]) participants.push({ event_id: TARGET_EVENT.id, employee_id: emp, function_name: "Montador", confirmed: true });
  for (const c of CRITERIA) eventCriteria.push({ event_id: TARGET_EVENT.id, criterion_id: c.id, active: true, weight_override: null });
  statements.push(insert("event_participants", participants));
  statements.push(insert("event_criteria", eventCriteria));
  statements.push(insert("calibrations", calibrations));

  // Designação do avaliador no evento alvo: por área (sistema antigo) e por
  // critério (roteamento novo) — é o que a tela /evaluations usa para listar.
  statements.push(insert("event_area_assignments", [{ event_id: TARGET_EVENT.id, area_id: 1, evaluator_user_id: AVALIADOR.id }]));
  statements.push(insert("event_criterion_assignments", CRITERIA.map(c => ({
    event_id: TARGET_EVENT.id, criterion_id: c.id, assigned_to_id: AVALIADOR.id, status: "pending",
  }))));

  for (const s of statements) {
    try {
      await pg.exec(s);
    } catch (err) {
      throw new Error(`Seed E2E falhou em:\n${s.slice(0, 300)}\n→ ${(err as Error).message}`);
    }
  }
  // As sequences precisam andar além dos ids fixos (a API insere linhas novas).
  for (const t of ["areas", "employees", "users", "cycles", "criteria", "events"]) {
    await pg.exec(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT max(id) FROM ${t}))`);
  }
}
