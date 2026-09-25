// Testes de rota: escritas em várias tabelas são tudo ou nada (transação) e não
// deixam órfãos. O harness roda com PG_POOL_MAX=1, então uma consulta via `db`
// dentro do callback de uma transação trava o teste (pega o erro de "usar db
// em vez de tx" de graça).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number;
let avaliador: number;

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle();
  avaliador = await h.ensureUser("avaliador");
});

after(() => h?.close());

async function openEvent(criteria: Array<number | { criterionId: number; weight?: number }>) {
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria });
  return eventId;
}

async function duplicate(eventId: number, sourceCriterionId: number, name: string) {
  const r = await h.api("POST", `/events/${eventId}/criteria/duplicate`, { role: "admin", body: { sourceCriterionId, name } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const row = await h.one(
    `select ec.id as ec_id, c.id as criterion_id from criteria c
       join event_criteria ec on ec.criterion_id = c.id and ec.event_id = $1
     where c.name = $2`, [eventId, name]);
  return { ecId: row.ec_id as number, criterionId: row.criterion_id as number };
}

test("POST /events cria o evento já vinculado aos critérios ativos do catálogo", async () => {
  const c = await h.fx.criterion({ name: "Catálogo A" });
  const r = await h.api("POST", "/events", { role: "admin", body: { name: "Evento novo", startDate: "2026-09-01", endDate: "2026-09-01" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const links = await h.sql("select criterion_id from event_criteria where event_id = $1", [r.data.id]);
  assert.ok(links.some(l => l.criterion_id === c));
});

test("PUT /events/:id/criteria: peso inválido no meio da lista não deixa metade gravada", async () => {
  const a = await h.fx.criterion({ name: "Peso A" });
  const b = await h.fx.criterion({ name: "Peso B" });
  const eventId = await openEvent([{ criterionId: a, weight: 2 }, { criterionId: b, weight: 3 }]);
  // 5000 estoura numeric(5,2) na segunda atualização.
  const r = await h.api("PUT", `/events/${eventId}/criteria`, {
    role: "admin",
    body: { criteria: [{ criterionId: a, active: true, weight: 7 }, { criterionId: b, active: true, weight: 5000 }] },
  });
  assert.ok(r.status >= 400, JSON.stringify(r));
  const rows = await h.sql("select criterion_id, weight_override from event_criteria where event_id = $1 order by criterion_id", [eventId]);
  assert.deepEqual(rows.map(x => [x.criterion_id, Number(x.weight_override)]), [[a, 2], [b, 3]]);
});

test("DELETE quesito duplicado: remove atribuição e link público junto e reaponta duplicatas filhas", async () => {
  const base = await h.fx.criterion({ name: "Base Del" });
  const eventId = await openEvent([base]);
  const dup = await duplicate(eventId, base, "Base Del (2)");
  const neto = await duplicate(eventId, dup.criterionId, "Base Del (3)");
  await h.fx.criterionAssignment({ eventId, criterionId: dup.criterionId, assignedToId: avaliador });
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id) values ('tok-del', $1, $2)", [eventId, avaliador]);
  await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ('tok-del', $1), ('tok-del', $2)", [dup.criterionId, base]);

  const r = await h.api("DELETE", `/events/${eventId}/criteria/${dup.ecId}`, { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  assert.equal((await h.sql("select 1 from criteria where id = $1", [dup.criterionId])).length, 0);
  assert.equal((await h.sql("select 1 from event_criterion_assignments where criterion_id = $1", [dup.criterionId])).length, 0);
  const tokenCriteria = await h.sql("select criterion_id from public_eval_token_criteria where token_id = 'tok-del'");
  assert.deepEqual(tokenCriteria.map(x => x.criterion_id), [base]);
  const filho = await h.one("select source_criterion_id from criteria where id = $1", [neto.criterionId]);
  assert.equal(filho.source_criterion_id, base);
});

test("DELETE quesito duplicado já calibrado → 409 e nada é apagado", async () => {
  const base = await h.fx.criterion({ name: "Base Cal" });
  const eventId = await openEvent([base]);
  const dup = await duplicate(eventId, base, "Base Cal (2)");
  const rh = await h.ensureUser("rh");
  await h.fx.calibration({ eventId, criterionId: dup.criterionId, score: 8, userId: rh });

  const r = await h.api("DELETE", `/events/${eventId}/criteria/${dup.ecId}`, { role: "admin" });
  assert.equal(r.status, 409);
  assert.equal((await h.sql("select 1 from event_criteria where id = $1", [dup.ecId])).length, 1);
});

test("confirmar critérios: congela pesos, marca o evento e gera as atribuições padrão juntos", async () => {
  const c = await h.fx.criterion({ name: "Confirma", weight: 4 });
  await h.sql("insert into criterion_routing (criterion_id, default_evaluator_id) values ($1, $2)", [c, avaliador]);
  const eventId = await openEvent([c]);

  const r = await h.api("POST", `/events/${eventId}/criteria/confirm`, { role: "admin", body: { confirmed: true } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const ev = await h.one("select criteria_confirmed from events where id = $1", [eventId]);
  assert.equal(ev.criteria_confirmed, true);
  const ec = await h.one("select weight_override from event_criteria where event_id = $1", [eventId]);
  assert.equal(Number(ec.weight_override), 4);
  const asg = await h.sql("select assigned_to_id from event_criterion_assignments where event_id = $1", [eventId]);
  assert.deepEqual(asg.map(x => x.assigned_to_id), [avaliador]);
});

test("POST /evaluations: primeira nota congela os pesos na mesma transação", async () => {
  const c = await h.fx.criterion({ name: "Avalia", weight: 6 });
  const eventId = await openEvent([c]);
  const r = await h.api("POST", "/evaluations", { role: "admin", body: { eventId, criterionId: c, score: 8 } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const ec = await h.one("select weight_override from event_criteria where event_id = $1", [eventId]);
  assert.equal(Number(ec.weight_override), 6);
});

test("PUT /criteria/:id/routing: lista com usuário inexistente não troca o modo nem apaga a lista antiga", async () => {
  const c = await h.fx.criterion({ name: "Roteia" });
  const ok = await h.api("PUT", `/criteria/${c}/routing`, { role: "admin", body: { redirectMode: "specific", redirectUserIds: [avaliador] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));

  const bad = await h.api("PUT", `/criteria/${c}/routing`, { role: "admin", body: { redirectMode: "specific", allowPublicLink: true, redirectUserIds: [999999] } });
  assert.ok(bad.status >= 400, JSON.stringify(bad));
  const routing = await h.one("select allow_public_link from criterion_routing where criterion_id = $1", [c]);
  assert.equal(routing.allow_public_link, false);
  const users = await h.sql("select user_id from criterion_redirect_users where criterion_id = $1", [c]);
  assert.deepEqual(users.map(x => x.user_id), [avaliador]);
});

test("publicar parcial/final de todos os critérios de uma vez", async () => {
  const a = await h.fx.criterion({ name: "Pub A" });
  const b = await h.fx.criterion({ name: "Pub B" });
  const eventId = await openEvent([a, b]);
  const p = await h.api("POST", `/events/${eventId}/criteria/publish-partial-all`, { role: "admin" });
  assert.equal(p.status, 200, JSON.stringify(p.data));
  assert.equal(p.data.published, 2);
  const f = await h.api("POST", `/events/${eventId}/criteria/publish-final-all`, { role: "admin" });
  assert.equal(f.status, 200, JSON.stringify(f.data));
  const rows = await h.sql("select 1 from event_criteria where event_id = $1 and final_published_at is not null and partial_published_at is not null", [eventId]);
  assert.equal(rows.length, 2);
});

test("PATCH /criteria/:id desativando: vínculos de eventos ainda não confirmados caem junto", async () => {
  const c = await h.fx.criterion({ name: "Desativa" });
  const eventId = await openEvent([c]);
  const r = await h.api("PATCH", `/criteria/${c}`, { role: "admin", body: { active: false } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const ec = await h.one("select active from event_criteria where event_id = $1 and criterion_id = $2", [eventId, c]);
  assert.equal(ec.active, false);
});
