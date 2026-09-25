// Testes de rota: a trilha de auditoria sai legível (IDs citados viram nome),
// nunca devolve segredo (hash de senha, PIN, token) e filtra por grupo de tipos.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";
import { redact, refKindForKey, REDACTED } from "../lib/audit-view.js";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number;
let admin: number;
let avaliador: number;

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle();
  admin = await h.ensureUser("admin");
  avaliador = await h.ensureUser("avaliador");
});

after(() => h?.close());

async function log(action: string, entity: string, entityId: number | null, beforeJson: unknown, afterJson: unknown) {
  await h.sql(
    "insert into audit_logs (user_id, action, entity, entity_id, before_json, after_json) values ($1, $2, $3, $4, $5, $6)",
    [admin, action, entity, entityId == null ? null : String(entityId), beforeJson == null ? null : JSON.stringify(beforeJson), afterJson == null ? null : JSON.stringify(afterJson)],
  );
}

test("redact tira hash, PIN e token em qualquer nível; mantém o resto", () => {
  const out = redact({ name: "Fred", passwordHash: "$2b$x", nested: { pin: "1234", token: "abc", role: "rh" }, list: [{ secretKey: "k" }] });
  assert.deepEqual(out, { name: "Fred", passwordHash: REDACTED, nested: { pin: REDACTED, token: REDACTED, role: "rh" }, list: [{ secretKey: REDACTED }] });
});

test("refKindForKey reconhece os campos que apontam para pessoas, eventos e critérios", () => {
  assert.equal(refKindForKey("conformityEvaluatorUserId"), "users");
  assert.equal(refKindForKey("from"), "users");
  assert.equal(refKindForKey("eventId"), "events");
  assert.equal(refKindForKey("criterionId"), "criteria");
  assert.equal(refKindForKey("employeeId"), "employees");
  assert.equal(refKindForKey("score"), null);
});

test("GET /audit-logs: nomes resolvidos, segredo oculto e filtro por lista de tipos", async () => {
  const c = await h.fx.criterion({ name: "Crit Auditoria" });
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [c], name: "Evento Auditado" });
  await log("update", "users", avaliador, { role: "avaliador", passwordHash: "$2b$10$antes" }, { role: "operador", passwordHash: "$2b$10$depois" });
  await log("set_conformity_evaluator", "events", eventId, { conformityEvaluatorUserId: admin }, { conformityEvaluatorUserId: avaliador });
  await log("calibrate", "calibrations", 999, { score: 6 }, { score: 8, eventId, criterionId: c });

  const r = await h.api("GET", "/audit-logs?limit=100", { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const raw = JSON.stringify(r.data);
  assert.ok(!raw.includes("$2b$10$"), "hash de senha vazou na resposta");

  const ev = r.data.data.find((l: { action: string }) => l.action === "set_conformity_evaluator");
  assert.equal(ev.entityLabel, "Evento Auditado");
  assert.ok(r.data.refs.users[String(avaliador)], "avaliador citado no depois não foi resolvido");
  assert.equal(r.data.refs.criteria[String(c)], "Crit Auditoria");
  assert.equal(r.data.refs.events[String(eventId)], "Evento Auditado");

  const onlyEvalGroup = await h.api("GET", "/audit-logs?entity=evaluations,calibrations,calibration_comments", { role: "rh" });
  assert.equal(onlyEvalGroup.status, 200);
  assert.ok(onlyEvalGroup.data.data.length >= 1);
  assert.ok(onlyEvalGroup.data.data.every((l: { entity: string }) => ["evaluations", "calibrations", "calibration_comments"].includes(l.entity)));
});

test("GET /audit-logs é só de admin e RH", async () => {
  assert.equal((await h.api("GET", "/audit-logs", { role: "diretoria" })).status, 403);
  assert.equal((await h.api("GET", "/audit-logs", { role: "avaliador" })).status, 403);
});
