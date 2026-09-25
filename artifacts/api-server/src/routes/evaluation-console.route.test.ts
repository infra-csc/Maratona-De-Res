// Testes de rota: GET /evaluation-console devolve, numa requisição, exatamente
// o que as rotas por evento devolvem (a Central de Avaliações troca 2N
// requisições por esta) e só para gestores.
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

type Row = { eventId: number; criterionId: number; id: number | null };
const byKey = (rows: Row[]) => [...rows].sort((a, b) => a.eventId - b.eventId || a.criterionId - b.criterionId);

test("GET /evaluation-console = união das rotas por evento, com peso normalizado por evento", async () => {
  const a = await h.fx.criterion({ name: "Console A" });
  const b = await h.fx.criterion({ name: "Console B" });
  const ev1 = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [{ criterionId: a, weight: 1 }, { criterionId: b, weight: 3 }] });
  const ev2 = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [{ criterionId: a, weight: 2 }] });
  await h.fx.criterionAssignment({ eventId: ev1, criterionId: a, assignedToId: avaliador });
  await h.fx.criterionAssignment({ eventId: ev2, criterionId: a, assignedToId: avaliador });

  const r = await h.api("GET", `/evaluation-console?eventIds=${ev1},${ev2}`, { role: "rh" });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  const perEvent = await Promise.all([ev1, ev2].map(id => h.api("GET", `/events/${id}/criteria`, { role: "rh" })));
  const perEventAssign = await Promise.all([ev1, ev2].map(id => h.api("GET", `/events/${id}/criterion-assignments`, { role: "rh" })));
  assert.deepEqual(byKey(r.data.criteria), byKey(perEvent.flatMap(p => p.data)));
  assert.deepEqual(byKey(r.data.assignments), byKey(perEventAssign.flatMap(p => p.data)));

  // Peso normalizado é por evento, não pela soma do lote inteiro.
  const w = (eventId: number, criterionId: number) =>
    r.data.criteria.find((c: Row & { normalizedWeight: number }) => c.eventId === eventId && c.criterionId === criterionId).normalizedWeight;
  assert.equal(w(ev1, a), 0.25);
  assert.equal(w(ev1, b), 0.75);
  assert.equal(w(ev2, a), 1);
});

test("GET /evaluation-console: avaliador e colaborador não acessam; eventIds inválido → 400", async () => {
  assert.equal((await h.api("GET", "/evaluation-console?eventIds=1", { role: "avaliador" })).status, 403);
  assert.equal((await h.api("GET", "/evaluation-console?eventIds=1", { role: "visualizador" })).status, 403);
  assert.equal((await h.api("GET", "/evaluation-console?eventIds=abc", { role: "admin" })).status, 400);
  const empty = await h.api("GET", "/evaluation-console?eventIds=", { role: "admin" });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.data, { criteria: [], assignments: [] });
});
