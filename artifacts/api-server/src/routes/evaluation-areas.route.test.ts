// Testes de rota: critério respondido por várias áreas.
//   padrão (catálogo) → evento novo nasce com a cópia de cada área →
//   ajuste por evento cria/remove cópias → nota do critério = média das áreas
//   (conta só quem avaliou) → a cópia ganha o avaliador principal da área.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number;
let areaA: number, areaB: number, areaC: number;

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle();
  const mk = async (name: string) => (await h.one("insert into areas (name, active) values ($1, true) returning id", [name])).id as number;
  areaA = await mk("Área A (teste)");
  areaB = await mk("Área B (teste)");
  areaC = await mk("Área C (teste)");
});

after(() => h?.close());

async function criterionIn(area: number, name: string) {
  const id = await h.fx.criterion({ name });
  await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

async function copiesOf(eventId: number, parentId: number) {
  return h.sql(
    `select c.id, c.name, c.responsible_area_id as area, ec.weight_override as w
       from event_criteria ec join criteria c on c.id = ec.criterion_id
      where ec.event_id = $1 and c.event_scoped and c.source_criterion_id = $2 order by c.id`,
    [eventId, parentId],
  );
}

test("catálogo guarda as áreas que avaliam; GET /criteria devolve", async () => {
  const id = await criterionIn(areaA, "Padrão áreas");
  const r = await h.api("PATCH", `/criteria/${id}`, { role: "rh", body: { evaluatingAreaIds: [areaB, areaC, areaA] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const list = await h.api("GET", "/criteria", { role: "rh" });
  const row = list.data.find((c: { id: number }) => c.id === id);
  // A área responsável não entra na lista de extras.
  assert.deepEqual(row.evaluatingAreaIds, [areaB, areaC].sort((a, b) => a - b));
  assert.equal(row.evaluateAllAreas, false);
  assert.equal((await h.api("PATCH", `/criteria/${id}`, { role: "rh", body: { evaluatingAreaIds: "x" } })).status, 400);
  // Desliga o padrão para não afetar os outros testes.
  await h.api("PATCH", `/criteria/${id}`, { role: "rh", body: { active: false, evaluatingAreaIds: [] } });
});

test("evento novo nasce com a cópia de cada área extra (peso 0, área certa)", async () => {
  const id = await criterionIn(areaA, "Entrega por áreas");
  await h.api("PATCH", `/criteria/${id}`, { role: "admin", body: { evaluatingAreaIds: [areaB, areaC] } });
  const r = await h.api("POST", "/events", { role: "admin", body: { name: "Evento multiárea", startDate: "2026-09-10", endDate: "2026-09-10" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const copies = await copiesOf(r.data.id, id);
  assert.deepEqual(copies.map(c => c.area).sort(), [areaB, areaC].sort());
  assert.ok(copies.every(c => Number(c.w) === 0));
  assert.deepEqual(copies.map(c => c.name), ["Entrega por áreas (2)", "Entrega por áreas (3)"]);
  await h.api("PATCH", `/criteria/${id}`, { role: "admin", body: { active: false, evaluatingAreaIds: [] } });
});

test("ajuste por evento: PUT areas cria e remove cópias; área-padrão aplica o catálogo; trava com avaliação", async () => {
  const id = await criterionIn(areaA, "Ajuste por evento");
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [id] });

  let r = await h.api("PUT", `/events/${eventId}/criteria/${id}/areas`, { role: "rh", body: { areaIds: [areaB] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual((await copiesOf(eventId, id)).map(c => c.area), [areaB]);

  r = await h.api("PUT", `/events/${eventId}/criteria/${id}/areas`, { role: "rh", body: { areaIds: [areaC] } });
  assert.equal(r.status, 200);
  assert.deepEqual((await copiesOf(eventId, id)).map(c => c.area), [areaC]);

  // Padrão do catálogo depois: o botão só ACRESCENTA o que falta.
  await h.api("PATCH", `/criteria/${id}`, { role: "admin", body: { evaluatingAreaIds: [areaB] } });
  r = await h.api("POST", `/events/${eventId}/criteria/area-defaults`, { role: "rh" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual((await copiesOf(eventId, id)).map(c => c.area).sort(), [areaB, areaC].sort());

  // Com avaliação no evento, a estrutura trava.
  const aval = await h.ensureUser("avaliador");
  await h.fx.evaluation({ eventId, criterionId: id, evaluatorUserId: aval, score: 8 });
  assert.equal((await h.api("PUT", `/events/${eventId}/criteria/${id}/areas`, { role: "rh", body: { areaIds: [] } })).status, 409);
  assert.equal((await h.api("POST", `/events/${eventId}/criteria/area-defaults`, { role: "rh" })).status, 409);
  assert.equal((await h.api("PUT", `/events/${eventId}/criteria/${id}/areas`, { role: "avaliador", body: { areaIds: [] } })).status, 403);
  await h.api("PATCH", `/criteria/${id}`, { role: "admin", body: { active: false, evaluatingAreaIds: [] } });
});

test("nota do critério = média das áreas; área sem nota fica de fora", async () => {
  const id = await criterionIn(areaA, "Média das áreas");
  const eventId = await h.fx.event({ cycleId, status: "closed", resultsConfirmed: true, criteria: [id], date: "2026-09-12", name: "Evento média áreas" });
  await h.api("PUT", `/events/${eventId}/criteria/${id}/areas`, { role: "admin", body: { areaIds: [areaB, areaC] } });
  const [copyB, copyC] = await copiesOf(eventId, id);
  assert.ok(copyB && copyC);

  const u1 = await h.ensureUser("avaliador", { areaId: areaA });
  const u2 = await h.ensureUser("rh", { areaId: areaA });
  const u3 = await h.ensureUser("diretoria", { areaId: areaB });
  // Área A: dois avaliadores, 8 e 6 → 7. Área B: 9. Área C: ninguém avaliou.
  await h.fx.evaluation({ eventId, criterionId: id, evaluatorUserId: u1, score: 8 });
  await h.fx.evaluation({ eventId, criterionId: id, evaluatorUserId: u2, score: 6 });
  await h.fx.evaluation({ eventId, criterionId: copyB.id, evaluatorUserId: u3, score: 9 });

  const r = await h.api("GET", `/analytics/events-report?cycleId=${cycleId}`, { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const ev = r.data.events.find((e: { id: number }) => e.id === eventId);
  // (7 + 9) / 2 = 8 → 80 (média por ÁREA; por pessoa daria (8+6+9)/3 = 7,67).
  assert.equal(ev.performanceScore, 80);
});

test("cópia da área recebe o avaliador principal da área ao liberar as avaliações", async () => {
  const principal = await h.ensureUser("avaliador", { areaId: areaB });
  const outro = await criterionIn(areaB, "Critério da área B");
  await h.sql("insert into criterion_routing (criterion_id, default_evaluator_id) values ($1, $2) on conflict (criterion_id) do update set default_evaluator_id = excluded.default_evaluator_id", [outro, principal]);

  const id = await criterionIn(areaA, "Com principal");
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [id] });
  await h.sql("update events set criteria_confirmed = false where id = $1", [eventId]);
  await h.api("PUT", `/events/${eventId}/criteria/${id}/areas`, { role: "admin", body: { areaIds: [areaB] } });
  const [copyB] = await copiesOf(eventId, id);

  const r = await h.api("POST", `/events/${eventId}/criteria/confirm`, { role: "admin", body: { confirmed: true } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const a = await h.one("select assigned_to_id from event_criterion_assignments where event_id = $1 and criterion_id = $2", [eventId, copyB.id]);
  assert.equal(a.assigned_to_id, principal);
});
