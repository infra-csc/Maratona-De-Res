// Colaborador "fora do ciclo" (tela Colaboradores): só admin tira/devolve; fora
// do ciclo não tem nota, ranking nem bônus; a linha do tempo registra a saída.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
before(async () => { h = await startApi(); });
after(() => h?.close());

test("PUT /employees/:id/cycle-exclusion: tira do ciclo e devolve", async () => {
  const cycleId = await h.fx.cycle();
  const c = await h.fx.criterion({ name: "Crit exclusão" });
  const emp = await h.fx.employee({ name: "Colab fora do ciclo" });
  const aval = await h.ensureUser("avaliador");
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp], name: "Evento exclusão" });
  await h.fx.evaluation({ eventId, criterionId: c, evaluatorUserId: aval, score: 7 });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });

  type Emp = { id: number; cycleEventsCount: number | null; cycleExcluded: boolean; cycleExcludedReason: string | null };
  const listed = async () => ((await h.api("GET", "/employees", { role: "admin" })).data as Emp[]).find(e => e.id === emp)!;
  const inRanking = async () => ((await h.api("GET", "/results/quarterly", { role: "admin" })).data as { employeeId: number }[]).some(r => r.employeeId === emp);

  assert.equal((await listed()).cycleEventsCount, 1);
  assert.equal((await listed()).cycleExcluded, false);
  assert.equal(await inRanking(), true);

  // Só admin.
  assert.equal((await h.api("PUT", `/employees/${emp}/cycle-exclusion`, { role: "rh", body: { excluded: true } })).status, 403);
  assert.equal((await h.api("PUT", `/employees/${emp}/cycle-exclusion`, { role: "admin", body: {} })).status, 400);
  assert.equal((await h.api("PUT", "/employees/999999/cycle-exclusion", { role: "admin", body: { excluded: true } })).status, 404);

  const out = await h.api("PUT", `/employees/${emp}/cycle-exclusion`, { role: "admin", body: { excluded: true, reason: "  desligado  " } });
  assert.equal(out.status, 200, JSON.stringify(out.data));
  assert.equal(out.data.excludedReason, "desligado");
  assert.equal(await inRanking(), false);
  const e1 = await listed();
  assert.equal(e1.cycleExcluded, true);
  assert.equal(e1.cycleExcludedReason, "desligado");
  assert.equal(e1.cycleEventsCount, null);

  // A linha do tempo registra a saída (nota → sem nota) com o motivo.
  const tl = await h.api("GET", `/results/timeline?employeeId=${emp}`, { role: "admin" });
  const exit = tl.data.entries.find((e: { type: string }) => e.type === "cycle_excluded");
  assert.ok(exit, JSON.stringify(tl.data.entries.map((e: { type: string }) => e.type)));
  assert.equal(exit.finalBefore, 70);
  assert.equal(exit.finalAfter, null);
  assert.equal(exit.reason, "desligado");
  assert.equal(exit.employeeName, "Colab fora do ciclo");

  const back = await h.api("PUT", `/employees/${emp}/cycle-exclusion`, { role: "admin", body: { excluded: false } });
  assert.equal(back.status, 200);
  assert.equal(await inRanking(), true);
  const e2 = await listed();
  assert.equal(e2.cycleExcluded, false);
  assert.equal(e2.cycleExcludedReason, null);
  assert.equal(e2.cycleEventsCount, 1);
});
