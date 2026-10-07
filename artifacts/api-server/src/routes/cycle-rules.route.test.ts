// Regras POR CICLO (novo ciclo 2026): mínimo de eventos, data de pagamento e
// "Conduta" fora da Matriz de Conformidade. O ciclo sem regras próprias segue
// exatamente como antes.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";
import { parseCycleRules } from "../lib/cycle-rules.js";

let h: Awaited<ReturnType<typeof startApi>>;
before(async () => { h = await startApi(); });
after(() => h?.close());

test("parseCycleRules: valida mínimo, data e conduta", () => {
  assert.deepEqual(parseCycleRules({ minEvents: 7, paymentDate: "2027-01-08", conformityWithoutConduta: true }),
    { values: { minEvents: 7, paymentDate: "2027-01-08", conformityWithoutConduta: true } });
  assert.deepEqual(parseCycleRules({ minEvents: null, paymentDate: "" }), { values: { minEvents: null, paymentDate: null } });
  assert.deepEqual(parseCycleRules({}), { values: {} });
  assert.ok("error" in parseCycleRules({ minEvents: 0 }));
  assert.ok("error" in parseCycleRules({ minEvents: 7.5 }));
  assert.ok("error" in parseCycleRules({ paymentDate: "2027-02-30" }));
  assert.ok("error" in parseCycleRules({ conformityWithoutConduta: "sim" }));
});

async function eventWithConductaNo(cycleId: number, name: string) {
  const c = await h.fx.criterion({ name: `Crit ${name}` });
  const emp = await h.fx.employee({ name: `Colab ${name}` });
  const aval = await h.ensureUser("avaliador");
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp], name });
  await h.fx.evaluation({ eventId, criterionId: c, evaluatorUserId: aval, score: 8 });
  // Matriz: tudo "sim", menos a Conduta.
  const rh = await h.ensureUser("rh");
  await h.sql("insert into event_conformities (event_id, epi, estaiamentos, guarda_equipamentos, conduta, created_by_user_id) values ($1, true, true, true, false, $2)", [eventId, rh]);
  return { eventId, emp };
}

test("Conduta fora da matriz: não desconta no ciclo novo; desconta no ciclo antigo", async () => {
  // Ciclo antigo (sem a regra): conduta "não" = −10 (25 × 0,4) → 80 − 10 = 70.
  const oldCycle = await h.fx.cycle({ name: "Ciclo antigo conduta" });
  const oldEv = await eventWithConductaNo(oldCycle, "Evento conduta antigo");
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  const oldScore = await h.one("select final_event_score from employee_event_results where event_id = $1", [oldEv.eventId]);
  assert.equal(Number(oldScore.final_event_score), 70);

  // Ciclo novo: a mesma resposta não conta.
  const newCycle = await h.fx.cycle({ name: "Ciclo novo conduta", startDate: "2027-01-01", endDate: "2027-12-31" });
  await h.sql("update cycles set conformity_without_conduta = true where id = $1", [newCycle]);
  const newEv = await eventWithConductaNo(newCycle, "Evento conduta novo");
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  const newScore = await h.one("select final_event_score from employee_event_results where event_id = $1", [newEv.eventId]);
  assert.equal(Number(newScore.final_event_score), 80);

  // O detalhe do evento avisa as telas para esconder a pergunta.
  const det = await h.api("GET", `/events/${newEv.eventId}`, { role: "admin" });
  assert.equal(det.data.conformityWithoutConduta, true);
  assert.equal((await h.api("GET", `/events/${oldEv.eventId}`, { role: "admin" })).data.conformityWithoutConduta, false);
});

test("mínimo de eventos do ciclo vale no lugar da regra geral; ciclo fechado só muda a data de pagamento", async () => {
  const cycleId = await h.fx.cycle({ name: "Ciclo mínimo", startDate: "2028-01-01", endDate: "2028-12-31" });
  const { emp } = await eventWithConductaNo(cycleId, "Evento mínimo");
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  const elig = async () => (await h.one("select eligible from quarterly_results where employee_id = $1 and cycle_id = $2", [emp, cycleId])).eligible;
  assert.equal(await elig(), false, "regra geral: 8 eventos");

  // Admin define 1 evento no ciclo: recalcula na hora.
  const up = await h.api("PATCH", `/cycles/${cycleId}`, { role: "admin", body: { minEvents: 1, paymentDate: "2029-01-08" } });
  assert.equal(up.status, 200, JSON.stringify(up.data));
  assert.equal(up.data.minEvents, 1);
  assert.equal(up.data.effectiveMinEvents, 1);
  assert.equal(up.data.paymentDate, "2029-01-08");
  assert.equal(await elig(), true);

  assert.equal((await h.api("PATCH", `/cycles/${cycleId}`, { role: "admin", body: { minEvents: 0 } })).status, 400);
  assert.equal((await h.api("PATCH", `/cycles/${cycleId}`, { role: "rh", body: { minEvents: 7 } })).status, 403);

  await h.sql("update cycles set status = 'closed', closed_at = now() where id = $1", [cycleId]);
  assert.equal((await h.api("PATCH", `/cycles/${cycleId}`, { role: "admin", body: { minEvents: 7 } })).status, 409);
  assert.equal((await h.api("PATCH", `/cycles/${cycleId}`, { role: "admin", body: { conformityWithoutConduta: true } })).status, 409);
  const pay = await h.api("PATCH", `/cycles/${cycleId}`, { role: "admin", body: { paymentDate: "2029-01-15" } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));
  assert.equal(pay.data.paymentDate, "2029-01-15");
});

test("criar o ciclo novo leva os eventos de depois do fim do anterior (os do período ficam)", async () => {
  const old = await h.fx.cycle({ name: "Ciclo jun-set", startDate: "2030-06-01", endDate: "2030-09-30" });
  const sep = await h.fx.event({ cycleId: old, name: "Evento setembro", date: "2030-09-27" });
  const oct = await h.fx.event({ cycleId: old, name: "Evento outubro", date: "2030-10-04", resultsConfirmed: false });
  await h.sql("update cycles set status = 'closed', closed_at = now() where id = $1", [old]);

  const r = await h.api("POST", "/cycles", { role: "admin", body: { name: "Ciclo out-dez", startDate: "2030-10-01", endDate: "2030-12-31", minEvents: 7, paymentDate: "2031-01-08", conformityWithoutConduta: true } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.deepEqual(r.data.movedEvents, [{ id: oct, name: "Evento outubro", outsidePeriod: false }]);
  assert.equal(r.data.minEvents, 7);
  assert.equal(r.data.paymentDate, "2031-01-08");
  assert.equal(r.data.conformityWithoutConduta, true);
  assert.equal((await h.one("select cycle_id from events where id = $1", [oct])).cycle_id, r.data.id);
  assert.equal((await h.one("select cycle_id from events where id = $1", [sep])).cycle_id, old);
});
