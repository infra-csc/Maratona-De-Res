// Testes de rota: /healthz e cadastro de ciclos (API real + Postgres em WASM).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let fechado: number;
let atual: number;

before(async () => {
  h = await startApi();
  fechado = await h.fx.cycle({ name: "Ciclo 1 · 2026", startDate: "2026-01-01", endDate: "2026-06-30", status: "closed", isCurrent: false });
  atual = await h.fx.cycle({ name: "Ciclo 2 · 2026", startDate: "2026-07-01", endDate: "2026-12-31" });
  await h.fx.event({ cycleId: atual, name: "Corrida do ciclo atual", date: "2026-08-08", status: "open", resultsConfirmed: false });
});

after(() => h?.close());

test("healthz responde 200 com o banco no ar", async () => {
  const r = await h.api("GET", "/healthz");
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "ok");
});

test("ciclos: não existe DELETE (nem para admin)", async () => {
  const r = await h.api("DELETE", `/cycles/${fechado}`, { role: "admin" });
  assert.equal(r.status, 404);
  const [row] = await h.sql("select id from cycles where id = $1", [fechado]);
  assert.ok(row, "o ciclo continua no banco");
});

test("ciclos: criar novo com o atual aberto e com eventos → 409", async () => {
  const r = await h.api("POST", "/cycles", {
    role: "admin",
    body: { name: "Ciclo 1 · 2027", startDate: "2027-01-01", endDate: "2027-06-30" },
  });
  assert.equal(r.status, 409);
  assert.equal(r.data.requiresClose, true);
  const [{ n }] = await h.sql("select count(*)::int as n from cycles");
  assert.equal(n, 2, "nenhum ciclo novo criado");
});

test("ciclos: set-current de ciclo fechado → 409", async () => {
  const r = await h.api("POST", `/cycles/${fechado}/set-current`, { role: "admin" });
  assert.equal(r.status, 409);
  const [row] = await h.sql("select is_current from cycles where id = $1", [atual]);
  assert.equal(row.is_current, true, "o ciclo atual não mudou");
});

test("ciclos: só gestores listam; só admin cria", async () => {
  for (const role of ["admin", "rh", "diretoria"]) {
    assert.equal((await h.api("GET", "/cycles", { role })).status, 200, role);
  }
  for (const role of ["operador", "avaliador", "visualizador"]) {
    assert.equal((await h.api("GET", "/cycles", { role })).status, 403, role);
  }
  const rh = await h.api("POST", "/cycles", { role: "rh", body: { name: "x", startDate: "2028-01-01", endDate: "2028-02-01" } });
  assert.equal(rh.status, 403);
});
