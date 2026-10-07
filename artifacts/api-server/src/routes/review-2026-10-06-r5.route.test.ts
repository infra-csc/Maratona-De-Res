// Regressões da 5ª rodada de revisão do BACKEND (06/10/2026): A1 (link gerado
// em nome de alguém de outra área no ciclo por área), M1 (link antigo de
// designado de outra área depois de ligar a marca), M2 (mudar o período do
// ciclo aberto recalcula), B1 (designação de outra área não revela o critério)
// e B2 (`unavailable` do my-area não revela evento alheio no fluxo antigo).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;

let areaCycle: number, atual: number;
let areaA: number, areaB: number;
let adminU: number, operador: number, ana: number, beto: number;
let critA: number, critB: number;

async function user(name: string, role: string, areaId: number | null) {
  return (await h.one("insert into users (name, password_hash, role, area_id) values ($1, 'x', $2, $3) returning id", [name, role, areaId])).id as number;
}
const as = (userId: number, role = "avaliador") => ({ role, userId });

async function criterionIn(area: number, name: string) {
  const id = await h.fx.criterion({ name, allowPublicLink: true });
  await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

async function openEvent(cycleId: number, criteria: number[], name: string, date: string, confirmed = true) {
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria, name, date });
  await h.sql("update events set criteria_confirmed = $2 where id = $1", [eventId, confirmed]);
  return eventId;
}

async function token(eventId: number, createdBy: number, criteria: number[]) {
  const id = `r5-${Math.random().toString(36).slice(2, 10)}`;
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ($1, $2, $3, 'Freela', 'criteria')", [id, eventId, createdBy]);
  for (const c of criteria) await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ($1, $2)", [id, c]);
  return id;
}

const AREA_LINK_REASON = "No ciclo por área, só o avaliador da área do critério responde — este link foi gerado em nome de alguém de outra área.";

before(async () => {
  h = await startApi();
  await h.fx.platoonRules2026();
  const mkArea = async (name: string) => (await h.one("insert into areas (name, active) values ($1, true) returning id", [name])).id as number;
  areaA = await mkArea("Área A (R5)");
  areaB = await mkArea("Área B (R5)");
  adminU = await user("Admin R5", "admin", null);
  operador = await user("Operador R5", "operador", null);
  ana = await user("Ana R5", "avaliador", areaA);
  beto = await user("Beto R5", "avaliador", areaB);

  areaCycle = await h.fx.cycle({ name: "Por área R5", startDate: "2024-01-01", endDate: "2024-12-31", isCurrent: false });
  await h.sql("update cycles set area_evaluation = true where id = $1", [areaCycle]);
  atual = await h.fx.cycle({ name: "Atual R5", startDate: "2030-01-01", endDate: "2030-12-31" });

  critA = await criterionIn(areaA, "Crit A R5");
  critB = await criterionIn(areaB, "Crit B R5");
});
after(async () => { await h?.close(); });

test("A1: ciclo por área — link do admin/operador só em nome de avaliador da área do critério (409 AREA_MODE_OTHER_AREA)", async () => {
  const ev = await openEvent(areaCycle, [critA, critB], "Evento A1 R5", "2024-05-01");
  const gera = (by: { role: string; userId?: number }, assignedToUserId: number, criterionIds: number[]) =>
    h.api("POST", `/events/${ev}/admin-public-token`, { ...by, body: { assignedToUserId, criterionIds, recipientName: "Freela" } });

  const outra = await gera(as(operador, "operador"), beto, [critA]);
  assert.equal(outra.status, 409, JSON.stringify(outra.data));
  assert.equal(outra.data.code, "AREA_MODE_OTHER_AREA");
  // Admin em nome de si mesmo (não é avaliador da área) também não.
  assert.equal((await gera(as(adminU, "admin"), adminU, [critA])).status, 409);
  assert.equal((await h.sql("select 1 from public_eval_tokens where event_id = $1", [ev])).length, 0, "nenhum link criado");

  const certo = await gera(as(operador, "operador"), ana, [critA]);
  assert.equal(certo.status, 200, JSON.stringify(certo.data));
  // Fluxo antigo (ciclo sem a marca): continua livre.
  const evOld = await openEvent(atual, [critA], "Evento antigo A1 R5", "2030-02-01");
  assert.equal((await h.api("POST", `/events/${evOld}/admin-public-token`, { role: "admin", userId: adminU, body: { assignedToUserId: beto, criterionIds: [critA], recipientName: "Freela" } })).status, 200);
});

test("M1: link de designado de OUTRA área (criado antes da marca) não grava critério da área no ciclo por área", async () => {
  const ev = await openEvent(areaCycle, [critA, critB], "Evento M1 R5", "2024-06-01");
  const so = await token(ev, beto, [critA]);
  const r = await h.api("POST", `/public-eval/${so}/submit`, { body: { submitterName: "Freela M1", evaluations: [{ criterionId: critA, score: 2, comments: "x" }] } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.rejected[0].reason, AREA_LINK_REASON);
  assert.equal((await h.sql("select 1 from evaluations where event_id = $1", [ev])).length, 0);
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [so])).used_at, null, "link não queimado");

  // Misto: grava o da área dele (B), recusa o da área A com o motivo.
  const misto = await token(ev, beto, [critA, critB]);
  const r2 = await h.api("POST", `/public-eval/${misto}/submit`, { body: { submitterName: "Freela M1", evaluations: [
    { criterionId: critA, score: 2, comments: "x" },
    { criterionId: critB, score: 8, comments: "ok" },
  ] } });
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  assert.deepEqual(r2.data.saved, [critB]);
  assert.equal(r2.data.rejected.find((x: { criterionId: number }) => x.criterionId === critA)?.reason, AREA_LINK_REASON);
  // O critério da área A segue aberto para Ana.
  assert.equal((await h.api("POST", "/evaluations", { ...as(ana), body: { eventId: ev, criterionId: critA, score: 9, comments: "ok" } })).status, 201);
});

test("B1: ciclo por área — designação para critério de OUTRA área não aparece em criterion-assignments", async () => {
  const ev = await openEvent(areaCycle, [critA, critB], "Evento B1 R5", "2024-07-01");
  await h.fx.criterionAssignment({ eventId: ev, criterionId: critA, assignedToId: beto });
  await h.fx.criterionAssignment({ eventId: ev, criterionId: critB, assignedToId: beto });
  const rows = (await h.api("GET", `/events/${ev}/criterion-assignments`, as(beto))).data as { criterionId: number }[];
  assert.deepEqual(rows.map(r => r.criterionId), [critB]);
});

test("B2: my-area `unavailable` — fluxo antigo só com designação; evento do próximo ciclo pela área do cadastro", async () => {
  const futuro = await openEvent(atual, [critA], "Evento antigo futuro R5", "2030-11-20", false);
  assert.equal((await h.api("GET", `/evaluations/my-area?eventId=${futuro}`, as(ana))).data.unavailable, undefined, "fluxo antigo sem designação: nada");
  await h.fx.criterionAssignment({ eventId: futuro, criterionId: critA, assignedToId: ana });
  assert.equal((await h.api("GET", `/evaluations/my-area?eventId=${futuro}`, as(ana))).data.unavailable?.eventId, futuro, "designada: diz quando abre");

  const proximo = await openEvent(atual, [critA], "Evento próximo ciclo R5", "2031-01-10", false);
  const u = (await h.api("GET", `/evaluations/my-area?eventId=${proximo}`, as(ana))).data.unavailable;
  assert.equal(u?.nextCycle, true);
  assert.equal((await h.api("GET", `/evaluations/my-area?eventId=${proximo}`, as(beto))).data.unavailable, undefined);
});

test("M2: mudar o período do ciclo aberto recalcula na hora (evento que sai do período deixa de contar)", async () => {
  await h.fx.rule("min_events_eligibility", 1);
  const aval = await h.ensureUser("avaliador");
  const emp = await h.fx.employee({ name: "Colab M2 R5" });
  const crit = await h.fx.criterion({ name: "Crit M2 R5" });
  const mar = await h.fx.event({ cycleId: atual, name: "Março M2 R5", date: "2030-03-10", criteria: [crit], participants: [emp] });
  await h.fx.evaluation({ eventId: mar, criterionId: crit, evaluatorUserId: aval, score: 9 });
  const nov = await h.fx.event({ cycleId: atual, name: "Novembro M2 R5", date: "2030-11-10", criteria: [crit], participants: [emp] });
  await h.fx.evaluation({ eventId: nov, criterionId: crit, evaluatorUserId: aval, score: 5 });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  const antes = await h.one("select events_count, final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [emp, atual]);
  assert.equal(antes.events_count, 2);
  assert.equal(Number(antes.final_result), 70);

  const r = await h.api("PATCH", `/cycles/${atual}`, { role: "admin", userId: adminU, body: { endDate: "2030-06-30" } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const depois = await h.one("select events_count, final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [emp, atual]);
  assert.equal(depois.events_count, 1);
  assert.equal(Number(depois.final_result), 90);
});

// ── 6ª revisão ─────────────────────────────────────────────────────────────
test("R6-M1: ciclo por área — admin não gera link de critério em nome próprio pela rota comum (409 AREA_MODE_OTHER_AREA)", async () => {
  const ev = await openEvent(areaCycle, [critA], "Evento R6-M1", "2024-08-01");
  await h.fx.criterionAssignment({ eventId: ev, criterionId: critA, assignedToId: adminU });
  const r = await h.api("POST", `/events/${ev}/public-token`, { role: "admin", userId: adminU, body: { recipientName: "Freela" } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "AREA_MODE_OTHER_AREA");
  assert.equal((await h.sql("select 1 from public_eval_tokens where event_id = $1", [ev])).length, 0);
  // O avaliador da área gera normalmente.
  assert.equal((await h.api("POST", `/events/${ev}/public-token`, { ...as(ana), body: { recipientName: "Freela" } })).status, 200);
});

test("R6-B1: link antigo em nome de outra área — o GET já mostra o critério fechado com o motivo e o envio diz isso (409 AREA_MODE_OTHER_AREA)", async () => {
  const ev = await openEvent(areaCycle, [critA], "Evento R6-B1", "2024-08-02");
  const t = await token(ev, beto, [critA]);
  const info = (await h.api("GET", `/public-eval/${t}`)).data;
  assert.equal(info.criteria[0].closed, true);
  assert.equal(info.criteria[0].closedReason, AREA_LINK_REASON);
  assert.equal(info.allClosed, true);
  const r = await h.api("POST", `/public-eval/${t}/submit`, { body: { submitterName: "Freela", evaluations: [{ criterionId: critA, score: 5, comments: "x" }] } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "AREA_MODE_OTHER_AREA");
  assert.match(r.data.error, /outra área/);
});

test("R6-M2: juntar usuários — dado de ciclo fechado → 409 CLOSED_CYCLE; avaliação no mesmo critério dos dois → 409 (nunca 500)", async () => {
  const fechado = await h.fx.cycle({ name: "Fechado R6", startDate: "2010-01-01", endDate: "2010-12-31", status: "closed", isCurrent: false });
  const canon = await user("Canon R6", "avaliador", areaA);
  const dup = await user("Dup R6", "avaliador", areaA);
  const evF = await h.fx.event({ cycleId: fechado, date: "2010-05-01", status: "closed", resultsConfirmed: true, criteria: [critA], name: "Evento fechado R6" });
  await h.fx.evaluation({ eventId: evF, criterionId: critA, evaluatorUserId: dup, score: 8 });
  const r = await h.api("POST", `/users/${canon}/merge`, { role: "admin", userId: adminU, body: { duplicateIds: [dup] } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "CLOSED_CYCLE");
  assert.equal((await h.one("select evaluator_user_id from evaluations where event_id = $1", [evF])).evaluator_user_id, dup);

  const canon2 = await user("Canon2 R6", "avaliador", areaA);
  const dup2 = await user("Dup2 R6", "avaliador", areaA);
  const evO = await openEvent(areaCycle, [critA], "Evento choque R6", "2024-08-03");
  await h.fx.evaluation({ eventId: evO, criterionId: critA, evaluatorUserId: canon2, score: 7 });
  await h.fx.evaluation({ eventId: evO, criterionId: critA, evaluatorUserId: dup2, score: 6, status: "draft" });
  const r2 = await h.api("POST", `/users/${canon2}/merge`, { role: "admin", userId: adminU, body: { duplicateIds: [dup2] } });
  assert.equal(r2.status, 409, JSON.stringify(r2.data));
  assert.equal(r2.data.code, "MERGE_EVALUATION_CLASH");
});

test("R6-B2: export de avaliações pendentes segue a regra única de 'aberto' (evento futuro não entra)", async () => {
  const passado = await openEvent(areaCycle, [critB], "Evento passado pendente R6", "2024-09-01");
  const futuro = await openEvent(atual, [critB], "Evento futuro R6", "2030-05-01");
  const r = await h.api("GET", "/exports/pending-evaluations", { role: "admin", userId: adminU });
  assert.equal(r.status, 200);
  assert.ok(String(r.data.data).includes("Evento passado pendente R6"), "pendência real aparece");
  assert.ok(!String(r.data.data).includes("Evento futuro R6"), "evento que não abriu não é pendência");
  void passado; void futuro;
});

test("Colaboradores no ciclo novo: GET /employees marca quem estava no ciclo anterior (inPreviousCycle)", async () => {
  const anterior = await h.fx.cycle({ name: "Anterior R7", startDate: "2099-01-01", endDate: "2099-03-31", status: "closed", isCurrent: false });
  const emp = await h.fx.employee({ name: "Colab anterior R7" });
  const outro = await h.fx.employee({ name: "Colab sem histórico R7" });
  await h.sql("insert into quarterly_results (employee_id, cycle_id, final_result, events_count, participated_events_count, eligible) values ($1, $2, 80, 3, 3, true)", [emp, anterior]);
  await h.sql("update cycles set is_current = false");
  const novo = await h.fx.cycle({ name: "Novo R7", startDate: "2099-04-01", endDate: "2099-06-30" });
  const list = (await h.api("GET", "/employees", { role: "admin", userId: adminU })).data as { id: number; inPreviousCycle: boolean }[];
  assert.equal(list.find(e => e.id === emp)?.inPreviousCycle, true);
  assert.equal(list.find(e => e.id === outro)?.inPreviousCycle, false);
  void novo;
});
