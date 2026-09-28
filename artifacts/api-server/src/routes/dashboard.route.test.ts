// Testes de rota: "Progresso de avaliações" do Dashboard. Rascunho esquecido
// em evento com resultado já confirmado não é pendência (a nota está fechada).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;

before(async () => { h = await startApi(); });
after(() => h?.close());

test("GET /dashboard/summary: rascunho em evento confirmado não conta; em evento aberto conta", async () => {
  const cycleId = await h.fx.cycle();
  const c = await h.fx.criterion({ name: "Crit dashboard" });
  const aval = await h.ensureUser("avaliador");
  const confirmado = await h.fx.event({ cycleId, status: "closed", resultsConfirmed: true, criteria: [c], name: "Confirmado com rascunho" });
  await h.fx.evaluation({ eventId: confirmado, criterionId: c, evaluatorUserId: aval, score: 7, status: "draft" });

  let r = await h.api("GET", "/dashboard/summary", { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.pendingEvaluations, 0);

  const aberto = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [c], name: "Aberto com rascunho" });
  await h.fx.evaluation({ eventId: aberto, criterionId: c, evaluatorUserId: aval, score: 7, status: "draft" });
  r = await h.api("GET", "/dashboard/summary", { role: "admin" });
  assert.equal(r.data.pendingEvaluations, 1);
});
