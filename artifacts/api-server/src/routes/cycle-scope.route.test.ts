// Seletor de ciclo: as rotas de LEITURA de Resultados & Ranking, Análises,
// Dashboard e Eventos aceitam ?cycleId= (vazio = atual, id = aquele ciclo,
// all = Total geral). As rotas de ESCRITA continuam só no ciclo atual.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let A = 0; let B = 0; let ana = 0; let bia = 0; let evA = 0; let evB = 0;

before(async () => {
  h = await startApi();
  await h.fx.platoonRules2026();
  const c = await h.fx.criterion({ name: "Crit seletor" });
  const aval = await h.ensureUser("avaliador");
  ana = await h.fx.employee({ name: "Ana Seletor" });
  bia = await h.fx.employee({ name: "Bia Seletor" });

  // Ciclo A (vai virar o anterior, fechado): mínimo de 1 evento; Ana e Bia, nota 80.
  A = await h.fx.cycle({ name: "Ciclo A seletor", startDate: "2025-01-01", endDate: "2025-06-30" });
  await h.sql("update cycles set min_events = 1 where id = $1", [A]);
  evA = await h.fx.event({ cycleId: A, date: "2025-03-01", criteria: [c], participants: [ana, bia], name: "Evento A seletor" });
  await h.fx.evaluation({ eventId: evA, criterionId: c, evaluatorUserId: aval, score: 8 });
  assert.equal((await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} })).status, 200);
  await h.sql("update cycles set status = 'closed', closed_at = now() where id = $1", [A]);
  await h.sql("update quarterly_results set bonus_status = 'paid' where cycle_id = $1 and employee_id = $2", [A, bia]);

  // Ciclo B (atual): só Ana, nota 90, mínimo geral (8) → não elegível.
  B = await h.fx.cycle({ name: "Ciclo B seletor", startDate: "2025-07-01", endDate: "2025-12-31" });
  evB = await h.fx.event({ cycleId: B, date: "2025-08-01", criteria: [c], participants: [ana], name: "Evento B seletor" });
  await h.fx.evaluation({ eventId: evB, criterionId: c, evaluatorUserId: aval, score: 9 });
  assert.equal((await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} })).status, 200);
});
after(() => h?.close());

test("parseCycleParam: vazio = atual; all; id; o resto é inválido", async () => {
  // Import tardio: lib/cycle-scope importa o banco, que só existe depois do startApi().
  const { parseCycleParam } = await import("../lib/cycle-scope.js");
  assert.deepEqual(parseCycleParam(undefined), { kind: "current" });
  assert.deepEqual(parseCycleParam(""), { kind: "current" });
  assert.deepEqual(parseCycleParam("all"), { kind: "all" });
  assert.deepEqual(parseCycleParam("12"), { kind: "id", id: 12 });
  assert.equal(parseCycleParam("0"), null);
  assert.equal(parseCycleParam("-3"), null);
  assert.equal(parseCycleParam("1.5"), null);
  assert.equal(parseCycleParam("abc"), null);
  assert.equal(parseCycleParam(["1", "2"]), null);
});

test("GET /cycles/options: qualquer papel logado; atual primeiro, depois os anteriores", async () => {
  const r = await h.api("GET", "/cycles/options", { role: "operador" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data[0].id, B);
  assert.equal(r.data[0].isCurrent, true);
  const a = r.data.find((c: { id: number }) => c.id === A);
  assert.equal(a.status, "closed");
  assert.equal(a.effectiveMinEvents, 1);
});

test("Ranking: sem parâmetro = atual; ciclo anterior devolve os dados dele; 400/404", async () => {
  const atual = await h.api("GET", "/ranking", { role: "admin" });
  assert.deepEqual(atual.data.map((r: { employeeId: number }) => r.employeeId), [ana]);
  assert.equal(atual.data[0].finalResult, 90);

  const anterior = await h.api("GET", `/ranking?cycleId=${A}`, { role: "admin" });
  assert.equal(anterior.status, 200);
  assert.deepEqual(anterior.data.map((r: { employeeId: number }) => r.employeeId).sort(), [ana, bia].sort());
  assert.ok(anterior.data.every((r: { finalResult: number }) => r.finalResult === 80));

  assert.equal((await h.api("GET", "/ranking?cycleId=abc", { role: "admin" })).status, 400);
  assert.equal((await h.api("GET", "/ranking?cycleId=all", { role: "admin" })).status, 400);
  assert.equal((await h.api("GET", "/ranking?cycleId=999999", { role: "admin" })).status, 404);
});

test("Resultados consolidados e detalhe: ciclo anterior; atual sem parâmetro", async () => {
  const q = await h.api("GET", `/results/quarterly?cycleId=${A}`, { role: "admin" });
  assert.equal(q.status, 200);
  assert.ok(q.data.length === 2 && q.data.every((r: { cycleId: number }) => r.cycleId === A));
  const qAtual = await h.api("GET", "/results/quarterly", { role: "admin" });
  assert.ok(qAtual.data.length === 1 && qAtual.data[0].cycleId === B);
  assert.equal((await h.api("GET", "/results/quarterly?cycleId=all", { role: "admin" })).status, 400);

  const det = await h.api("GET", `/ranking-detail?employeeId=${bia}&cycleId=${A}`, { role: "admin" });
  assert.equal(det.status, 200, JSON.stringify(det.data));
  assert.equal(det.data.cycle.id, A);
  assert.equal(det.data.summary.finalResult, 80);
  assert.equal(det.data.summary.bonusBreakdown.minEvents, 1, "mínimo POR CICLO");
  assert.equal((await h.api("GET", `/ranking-detail?employeeId=${ana}`, { role: "admin" })).data.cycle.id, B);
  assert.equal((await h.api("GET", `/ranking-detail?employeeId=${ana}&cycleId=999999`, { role: "admin" })).status, 404);
});

test("GET /ranking/total: uma linha por pessoa somando os ciclos", async () => {
  const r = await h.api("GET", "/ranking/total", { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const rowAna = r.data.rows.find((x: { employeeId: number }) => x.employeeId === ana);
  const rowBia = r.data.rows.find((x: { employeeId: number }) => x.employeeId === bia);
  assert.equal(rowAna.cyclesWithScore, 2);
  assert.equal(rowAna.avgFinalResult, 85);
  assert.equal(rowAna.eventsCount, 2);
  assert.equal(rowAna.bonusTotal, 2200, "só o ciclo em que foi elegível (A)");
  assert.equal(rowAna.latest.cycleId, B, "faixa do ciclo mais recente");
  assert.deepEqual(rowAna.cycles.map((c: { cycleId: number }) => c.cycleId), [B, A]);
  assert.equal(rowBia.cyclesWithScore, 1);
  assert.equal(rowBia.bonusPaid, 2200);
  assert.equal(r.data.rows[0].employeeId, ana, "ordem pela média");
  assert.equal((await h.api("GET", "/ranking/total", { role: "operador" })).status, 403);
});

test("GET /events: atual, anterior e Total geral (cada evento com o seu ciclo)", async () => {
  const ids = (r: { data: { id: number }[] }) => r.data.map(e => e.id).sort();
  assert.deepEqual(ids(await h.api("GET", "/events", { role: "admin" })), [evB]);
  assert.deepEqual(ids(await h.api("GET", `/events?cycleId=${A}`, { role: "admin" })), [evA]);
  const all = await h.api("GET", "/events?cycleId=all", { role: "admin" });
  assert.deepEqual(ids(all), [evA, evB].sort());
  assert.deepEqual(all.data.map((e: { cycleId: number }) => e.cycleId).sort(), [A, B].sort());
  assert.equal((await h.api("GET", "/events?cycleId=x", { role: "admin" })).status, 400);
  assert.equal((await h.api("GET", "/events?cycleId=999999", { role: "admin" })).status, 404);
});

test("GET /analytics/overview: anterior, atual e Total geral (mínimo por ciclo)", async () => {
  const atual = await h.api("GET", "/analytics/overview", { role: "admin" });
  assert.equal(atual.status, 200, JSON.stringify(atual.data));
  assert.equal(atual.data.cycle.id, B);
  assert.equal(atual.data.scope.isCurrent, true);
  assert.equal(atual.data.kpis.collaborators, 1);

  const anterior = await h.api("GET", `/analytics/overview?cycleId=${A}`, { role: "admin" });
  assert.equal(anterior.data.cycle.id, A);
  assert.equal(anterior.data.scope.isCurrent, false);
  assert.equal(anterior.data.scope.status, "closed");
  assert.equal(anterior.data.kpis.minEvents, 1);
  assert.equal(anterior.data.kpis.eligible, 2);

  const total = await h.api("GET", "/analytics/overview?cycleId=all", { role: "admin" });
  assert.equal(total.data.cycle.id, 0);
  assert.equal(total.data.scope.kind, "all");
  assert.equal(total.data.kpis.collaborators, 3, "participações pessoa × ciclo");
  assert.equal(total.data.kpis.distinctCollaborators, 2);
  assert.equal(total.data.kpis.eventsTotal, 2);
  // D4: KPI único do Total geral = Σ(nota × eventos) ÷ Σ eventos = (80 + 80 + 90) ÷ 3.
  assert.equal(total.data.kpis.avgFinalResult, 83.3);
  assert.equal(total.data.kpis.avgFinalResult, (await h.api("GET", "/ranking/total", { role: "admin" })).data.summary.avgFinalResult);
  assert.equal(total.data.kpis.bonusOfficial, 4400);
  assert.equal(total.data.kpis.bonusProjected, 0);
  assert.equal(total.data.kpis.bonusTotal, 4400);
  assert.equal(total.data.funnel.find((f: { stage: string }) => f.stage === "reachedMin").count, 2, "A: mínimo 1 (2 pessoas); B: mínimo 8 (ninguém)");
  assert.deepEqual(total.data.nearNextFaixa, []);
  assert.equal((await h.api("GET", "/analytics/overview?cycleId=foo", { role: "admin" })).status, 400);

  const rep = await h.api("GET", "/analytics/events-report?cycleId=all", { role: "admin" });
  assert.equal(rep.status, 200);
  assert.equal(rep.data.cycle.id, 0);
  assert.deepEqual(rep.data.events.map((e: { cycleName: string }) => e.cycleName).sort(), ["Ciclo A seletor", "Ciclo B seletor"]);
  assert.equal((await h.api("GET", `/analytics/events-report?cycleId=${A}`, { role: "admin" })).data.events.length, 1);
});

test("Dashboard: Total geral soma os ciclos; pendências seguem do ciclo atual", async () => {
  const total = await h.api("GET", "/dashboard/summary?cycleId=all", { role: "admin" });
  assert.equal(total.status, 200, JSON.stringify(total.data));
  assert.equal(total.data.scope, "all");
  assert.equal(total.data.totalEvents, 2);
  assert.equal(total.data.operationalCycleId, B);
  // D4 (06/10): o KPI único do Total geral, a MESMA função de /ranking/total —
  // Σ(nota × eventos com nota) ÷ Σ eventos = (80×1 + 80×1 + 90×1) ÷ 3 = 83,3.
  assert.equal(total.data.quarterAverage, 83.3);
  assert.equal(total.data.quarterAverage, (await h.api("GET", "/ranking/total", { role: "admin" })).data.summary.avgFinalResult);
  assert.equal(total.data.bonusOfficial, 4400, "ciclo A fechado: Ana e Bia elegíveis (Verde)");
  assert.equal(total.data.bonusProjected, 0, "ciclo B aberto: Ana não atingiu o mínimo");
  assert.equal(total.data.totalBonusPreview, 4400);

  const anterior = await h.api("GET", `/dashboard/summary?cycleId=${A}`, { role: "admin" });
  assert.equal(anterior.data.totalEvents, 1);
  assert.equal(anterior.data.totalBonusPreview, 4400, "ciclo anterior: só o bônus gravado");
  assert.equal(anterior.data.operationalCycleId, A);

  const top = await h.api("GET", "/dashboard/top-employees?cycleId=all", { role: "admin" });
  assert.equal(top.data[0].employeeId, ana);
  assert.equal(top.data[0].finalResult, 85);
  const dist = await h.api("GET", "/dashboard/platoon-distribution?cycleId=all", { role: "admin" });
  assert.equal(dist.data.reduce((s: number, p: { count: number }) => s + p.count, 0), 3);
  assert.equal((await h.api("GET", "/dashboard/summary?cycleId=999999", { role: "admin" })).status, 404);
});

test("Escrita continua só no ciclo atual (cycleId é ignorado)", async () => {
  const before = await h.one("select final_result from quarterly_results where cycle_id = $1 and employee_id = $2", [A, ana]);
  const r = await h.api("POST", `/results/quarterly/recompute?cycleId=${A}`, { role: "admin", body: { cycleId: A } });
  assert.equal(r.status, 200);
  assert.equal(r.data.cycleId, B);
  const after = await h.one("select final_result from quarterly_results where cycle_id = $1 and employee_id = $2", [A, ana]);
  assert.equal(String(after.final_result), String(before.final_result));
  const cyc = await h.one("select status from cycles where id = $1", [A]);
  assert.equal(cyc.status, "closed");
});
