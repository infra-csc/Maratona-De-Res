// Testes de rota: link público de avaliação (API real + Postgres em WASM).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let eventId: number;
let avaliador: number;
let criterios: number[];
let tokenId: string;

before(async () => {
  h = await startApi();
  const cycleId = await h.fx.cycle();
  const ana = await h.fx.employee({ name: "Ana Casa" });
  criterios = [
    await h.fx.criterion({ name: "Montagem", allowPublicLink: true }),
    await h.fx.criterion({ name: "Organização", allowPublicLink: true }),
  ];
  const semLink = await h.fx.criterion({ name: "Interno", allowPublicLink: false });
  eventId = await h.fx.event({
    cycleId, date: "2026-08-08", status: "open", resultsConfirmed: false,
    criteria: [...criterios, semLink], participants: [ana],
  });
  avaliador = await h.ensureUser("avaliador");
  for (const criterionId of [...criterios, semLink]) {
    await h.fx.criterionAssignment({ eventId, criterionId, assignedToId: avaliador });
  }
});

after(() => h?.close());

test("link público: avaliador designado gera o token só com critérios que permitem link", async () => {
  const r = await h.api("POST", `/events/${eventId}/public-token`, { role: "avaliador", body: { recipientName: "Fulano da Silva" } });
  assert.ok(r.status === 200 || r.status === 201, JSON.stringify(r));
  tokenId = r.data.tokenId;
  assert.ok(tokenId);
  const rows = await h.sql("select criterion_id from public_eval_token_criteria where token_id = $1 order by criterion_id", [tokenId]);
  assert.deepEqual(rows.map(x => x.criterion_id), [...criterios].sort((a, b) => a - b));
});

test("link público: sem nome do destinatário → 400; sem autenticação → 401", async () => {
  assert.equal((await h.api("POST", `/events/${eventId}/public-token`, { role: "avaliador", body: {} })).status, 400);
  assert.equal((await h.api("POST", `/events/${eventId}/public-token`, { body: { recipientName: "x" } })).status, 401);
});

test("link público: GET /public-eval/:token abre sem login e lista o questionário", async () => {
  const r = await h.api("GET", `/public-eval/${tokenId}`);
  assert.equal(r.status, 200);
  assert.equal(r.data.isUsed, false);
  assert.equal(r.data.recipientName, "Fulano da Silva");
  assert.equal(r.data.criteria.length, 2);
  assert.equal((await h.api("GET", "/public-eval/nao-existe")).status, 404);
});

test("link público: primeiro envio grava as notas; segundo envio → 409", async () => {
  const body = {
    submitterName: "Fulano da Silva",
    evaluations: criterios.map((criterionId, i) => ({ criterionId, score: 7 + i, comments: "ok" })),
  };
  const primeiro = await h.api("POST", `/public-eval/${tokenId}/submit`, { body });
  assert.ok(primeiro.status === 200 || primeiro.status === 201, JSON.stringify(primeiro));

  const notas = await h.sql(
    "select criterion_id, score::float as score, status, evaluator_user_id from evaluations where event_id = $1 order by criterion_id",
    [eventId],
  );
  assert.equal(notas.length, 2);
  for (const n of notas) {
    assert.equal(n.status, "submitted");
    assert.equal(n.evaluator_user_id, avaliador, "conta como avaliação de quem gerou o link");
  }

  const segundo = await h.api("POST", `/public-eval/${tokenId}/submit`, { body });
  assert.equal(segundo.status, 409);

  const info = await h.api("GET", `/public-eval/${tokenId}`);
  assert.equal(info.data.isUsed, true);
  assert.equal(info.data.submitterName, "Fulano da Silva");
});

// Regressão: /submit (critérios) não recalculava o ciclo; só /submit-conformity.
test("link público: envio em evento já confirmado recalcula o resultado do ciclo", async () => {
  const [{ cycle_id: cycleId }] = await h.sql("select cycle_id from events where id = $1", [eventId]);
  const bia = await h.fx.employee({ name: "Bia Confirmada" });
  const crit = await h.fx.criterion({ name: "Acabamento", allowPublicLink: true });
  const confirmado = await h.fx.event({ cycleId, date: "2026-09-10", status: "closed", resultsConfirmed: true, criteria: [crit], participants: [bia] });
  await h.fx.criterionAssignment({ eventId: confirmado, criterionId: crit, assignedToId: avaliador });
  assert.equal((await h.api("POST", "/results/quarterly/recompute", { role: "admin" })).status, 200);

  const tok = await h.api("POST", `/events/${confirmado}/public-token`, { role: "avaliador", body: { recipientName: "Externo" } });
  const envio = await h.api("POST", `/public-eval/${tok.data.tokenId}/submit`, {
    body: { submitterName: "Externo", evaluations: [{ criterionId: crit, score: 9 }] },
  });
  assert.equal(envio.status, 200);
  const [row] = await h.sql(
    "select events_count, final_result::float as final_result from quarterly_results where cycle_id = $1 and employee_id = $2",
    [cycleId, bia],
  );
  assert.equal(row?.events_count, 1, "o evento passou a ter nota");
  assert.equal(row?.final_result, 90);
});

test("link público: critério fora do questionário ou nota fora de 0–10 → 400", async () => {
  const novo = await h.api("POST", `/events/${eventId}/public-token`, { role: "avaliador", body: { recipientName: "Beltrano" } });
  // Critérios já submetidos não entram em link novo: sem nada elegível → 400.
  assert.equal(novo.status, 400);

  const [{ id: outroToken }] = await h.sql(
    `insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name) values ('token-teste-2', $1, $2, 'Ciclano') returning id`,
    [eventId, avaliador],
  );
  await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ($1, $2)", [outroToken, criterios[0]]);
  const foraDaEscala = await h.api("POST", `/public-eval/${outroToken}/submit`, {
    body: { submitterName: "Ciclano", evaluations: [{ criterionId: criterios[0], score: 11 }] },
  });
  assert.equal(foraDaEscala.status, 400);
  const foraDoLink = await h.api("POST", `/public-eval/${outroToken}/submit`, {
    body: { submitterName: "Ciclano", evaluations: [{ criterionId: criterios[1], score: 5 }] },
  });
  assert.equal(foraDoLink.status, 400);
});
