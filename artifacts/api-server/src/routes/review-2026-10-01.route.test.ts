// Regressões da revisão de 01/10/2026 (regra "só vale publicada", fora do
// ciclo e linha do tempo). Cada teste reproduz um furo achado na revisão.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
before(async () => { h = await startApi(); });
after(() => h?.close());

const here = path.dirname(fileURLToPath(import.meta.url));
/** Comandos da migração, um a um (como o schema:repair reaplica). */
const migration = (tag: string) =>
  fs.readFileSync(path.join(here, "../../../../lib/db/migrations", `${tag}.sql`), "utf8").split("--> statement-breakpoint").map(x => x.trim()).filter(Boolean);

async function scenario(name: string, opts: { resultsConfirmed?: boolean } = {}) {
  const cycleId = await h.fx.cycle();
  const c = await h.fx.criterion({ name: `Crit ${name}` });
  const emp = await h.fx.employee({ name: `Colab ${name}` });
  const aval = await h.ensureUser("avaliador");
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp], name: `Evento ${name}`, ...opts });
  await h.fx.evaluation({ eventId, criterionId: c, evaluatorUserId: aval, score: 6 });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  const finalOf = async () => Number((await h.one("select final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [emp, cycleId]))?.final_result);
  return { cycleId, c, emp, eventId, finalOf };
}

test("schema:repair (reaplicar a 0004) não publica calibração pendente", async () => {
  const s = await scenario("repair");
  // Publicado em parcial SEM calibração → retrato vazio; depois o RH salva 9.
  assert.equal((await h.api("POST", `/events/${s.eventId}/criteria/${s.c}/publish-partial`, { role: "rh" })).status, 200);
  assert.equal((await h.api("POST", "/calibrations", { role: "rh", body: { eventId: s.eventId, criterionId: s.c, calibratedScore: 9 } })).status, 201);
  for (const stmt of migration("0004_published_snapshot")) await h.sql(stmt);
  const ec = await h.one("select published_score from event_criteria where event_id = $1 and criterion_id = $2", [s.eventId, s.c]);
  assert.equal(ec.published_score, null);
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  assert.equal(await s.finalOf(), 60);
});

test("calibração (rascunho) só para quem calibra", async () => {
  const s = await scenario("leitura");
  await h.api("POST", "/calibrations", { role: "rh", body: { eventId: s.eventId, criterionId: s.c, calibratedScore: 9 } });
  for (const role of ["visualizador", "avaliador", "operador"] as const) {
    assert.equal((await h.api("GET", `/calibrations?eventId=${s.eventId}`, { role, employeeId: s.emp })).status, 403, role);
    assert.equal((await h.api("GET", `/calibrations/comments?eventId=${s.eventId}`, { role, employeeId: s.emp })).status, 403, role);
  }
  const ok = await h.api("GET", `/calibrations?eventId=${s.eventId}`, { role: "diretoria" });
  assert.equal(ok.status, 200);
  assert.equal(ok.data[0].pendingPublish, true);
});

test("re-salvar calibração ANTIGA nunca publicada mantém a nota que valia", async () => {
  const s = await scenario("antiga");
  const rh = await h.ensureUser("rh");
  await h.sql("insert into calibrations (event_id, criterion_id, calibrated_score, calibrated_by_user_id) values ($1, $2, 8, $3)", [s.eventId, s.c, rh]);
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  assert.equal(await s.finalOf(), 80);
  // Corrige só a justificativa (mesma nota) e depois muda para 9 — sem publicar.
  await h.api("POST", "/calibrations", { role: "rh", body: { eventId: s.eventId, criterionId: s.c, calibratedScore: 8, calibrationReason: "texto" } });
  await h.api("POST", "/calibrations", { role: "rh", body: { eventId: s.eventId, criterionId: s.c, calibratedScore: 9 } });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  assert.equal(await s.finalOf(), 80, "vale o 8 antigo até publicar");
  await h.api("POST", `/events/${s.eventId}/criteria/${s.c}/publish-final`, { role: "rh" });
  assert.equal(await s.finalOf(), 90);
});

test("Eventos: 'a publicar' e nota prévia seguem a regra; confirmar avisa da pendente", async () => {
  const s = await scenario("eventos", { resultsConfirmed: false });
  await h.api("POST", "/calibrations", { role: "rh", body: { eventId: s.eventId, criterionId: s.c, calibratedScore: 9 } });
  const row = async () => ((await h.api("GET", "/events", { role: "admin" })).data as { id: number; pendingPublishCount: number; teamScore: number | null }[]).find(e => e.id === s.eventId)!;
  let ev = await row();
  assert.equal(ev.pendingPublishCount, 1);
  assert.equal(ev.teamScore, 60, "nota prévia sem a calibração não publicada");
  const conf = await h.api("POST", `/events/${s.eventId}/confirm-results`, { role: "admin" });
  assert.equal(conf.status, 200);
  assert.ok(conf.data.warnings.some((w: string) => w.includes("não publicada")), JSON.stringify(conf.data.warnings));
  await h.api("POST", `/events/${s.eventId}/criteria/${s.c}/publish-partial`, { role: "rh" });
  ev = await row();
  assert.equal(ev.pendingPublishCount, 0);
  assert.equal(await s.finalOf(), 90);
});

test("fora do ciclo: pagamento decidido bloqueia; colaborador não vê nota; detalhe recusa; linha do tempo identifica", async () => {
  const s = await scenario("fora");
  await h.sql("update quarterly_results set bonus_status = 'paid', paid_at = now() where employee_id = $1 and cycle_id = $2", [s.emp, s.cycleId]);
  const blocked = await h.api("PUT", `/employees/${s.emp}/cycle-exclusion`, { role: "admin", body: { excluded: true } });
  assert.equal(blocked.status, 409, JSON.stringify(blocked.data));
  assert.equal((await h.api("PUT", `/employees/${s.emp}/cycle-exclusion`, { role: "admin", body: { excluded: true, reason: "x".repeat(301) } })).status, 400);

  await h.sql("update quarterly_results set bonus_status = 'projected', paid_at = null where employee_id = $1 and cycle_id = $2", [s.emp, s.cycleId]);
  assert.equal((await h.api("PUT", `/employees/${s.emp}/cycle-exclusion`, { role: "admin", body: { excluded: true, reason: "desligado" } })).status, 200);

  const me = await h.api("GET", "/my-performance", { role: "visualizador", employeeId: s.emp });
  assert.equal(me.status, 200);
  assert.equal(me.data.summary.finalResult, null);
  assert.equal(me.data.summary.projectedBonus, null);
  assert.equal(me.data.summary.eligible, false);

  assert.equal((await h.api("GET", `/ranking-detail?employeeId=${s.emp}`, { role: "admin" })).status, 404);

  const tl = await h.api("GET", `/results/timeline?employeeId=${s.emp}`, { role: "admin" });
  assert.equal(tl.status, 200);
  assert.deepEqual(
    { name: tl.data.subject.name, inRanking: tl.data.subject.inRanking, excluded: tl.data.subject.excluded, reason: tl.data.subject.excludedReason },
    { name: "Colab fora", inRanking: false, excluded: true, reason: "desligado" });
  assert.ok(tl.data.entries.filter((e: { employeeId: number | null }) => e.employeeId === s.emp).every((e: { employeeName: string | null }) => e.employeeName === "Colab fora"));

  const elig = await h.api("GET", `/cycle-eligibility?employeeId=${s.emp}`, { role: "admin" });
  assert.equal(elig.data[0].excluded, true);
  assert.equal((await h.api("GET", "/results/timeline?cycleId=abc", { role: "admin" })).status, 400);
});

test("linha do tempo: confirmar em lote não atribui a todos o último evento", async () => {
  const cycleId = await h.fx.cycle();
  const c = await h.fx.criterion({ name: "Crit lote" });
  const aval = await h.ensureUser("avaliador");
  const a = await h.fx.employee({ name: "Colab lote A" });
  const b = await h.fx.employee({ name: "Colab lote B" });
  const e1 = await h.fx.event({ cycleId, criteria: [c], participants: [a], name: "Lote E1", resultsConfirmed: false });
  const e2 = await h.fx.event({ cycleId, criteria: [c], participants: [b], name: "Lote E2", resultsConfirmed: false });
  await h.fx.evaluation({ eventId: e1, criterionId: c, evaluatorUserId: aval, score: 7 });
  await h.fx.evaluation({ eventId: e2, criterionId: c, evaluatorUserId: aval, score: 8 });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  assert.equal((await h.api("POST", "/events/confirm-results-bulk", { role: "admin", body: { eventIds: [e1, e2] } })).status, 200);
  const tl = await h.api("GET", `/results/timeline?employeeId=${a}`, { role: "admin" });
  const rec = tl.data.entries.filter((e: { kind: string }) => e.kind === "recorded");
  const last = rec[rec.length - 1];
  assert.equal(last.type, "confirm-results-bulk");
  assert.notEqual(last.eventName, "Lote E2");
});
