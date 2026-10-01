// Linha do tempo da nota: o recálculo grava o antes → depois com o motivo; o
// passado é remontado; só admin e RH veem.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";
import { diffScoreSnapshots } from "../lib/score-history.js";
import { reconstructSteps } from "../lib/score-timeline.js";

let h: Awaited<ReturnType<typeof startApi>>;
before(async () => { h = await startApi(); });
after(() => h?.close());

test("diffScoreSnapshots: só quem mudou; antes/depois e motivo", () => {
  const rows = diffScoreSnapshots(1,
    [{ employeeId: 1, finalResult: "70.00", platoon: "A", bonusValue: "100", eventsCount: 3, eligible: true },
     { employeeId: 2, finalResult: "50.00", platoon: "B", bonusValue: "0", eventsCount: 2, eligible: false }],
    [{ employeeId: 1, finalResult: "72.50", platoon: "A", bonusValue: "100", eventsCount: 3, eligible: true },
     { employeeId: 2, finalResult: "50.00", platoon: "B", bonusValue: "0", eventsCount: 2, eligible: false },
     { employeeId: 3, finalResult: "80.00", platoon: "C", bonusValue: "200", eventsCount: 1, eligible: true }],
    9, { action: "publish_partial_feedback", entity: "event_criteria", entityId: "5", detail: { eventId: 7, passwordHash: "x" } });
  assert.deepEqual(rows.map(r => [r.employeeId, r.finalBefore, r.finalAfter]), [[1, "70.00", "72.50"], [3, null, "80.00"]]);
  assert.equal(rows[0].causeAction, "publish_partial_feedback");
  assert.ok(!rows[0].causeDetail!.includes("$2b") && rows[0].causeDetail!.includes('"eventId":7'));
});

test("reconstructSteps: repassa eventos e ajustes em ordem, 1 casa", () => {
  const steps = reconstructSteps(
    [{ eventId: 1, name: "E1", at: "2026-07-01T10:00:00Z", score: 72 }, { eventId: 2, name: "E2", at: "2026-07-08T10:00:00Z", score: 67.85 }],
    [{ id: 1, at: "2026-07-05T10:00:00Z", kind: "penalty", label: "Falta", points: 5, quantity: 1, reason: null, eventName: null, by: "RH" }],
    [{ name: "Sem", color: null, minScore: 0, maxScore: 69.99, minInclusive: true, maxInclusive: true },
     { name: "70", color: null, minScore: 70, maxScore: 100, minInclusive: true, maxInclusive: true }],
    null,
  );
  assert.deepEqual(steps.map(s => [s.type, s.finalBefore, s.finalAfter, s.platoonAfter]), [
    ["event_counted", null, 72, "70"],
    ["penalty", 72, 67, "Sem"],
    ["event_counted", 67, 67.4, "Sem"], // (72 + 67,85 − 5) ÷ 2 = 67,425 → 67,4
  ]);
});

test("GET /results/timeline: publicar grava a mudança com motivo; só admin/RH", async () => {
  const cycleId = await h.fx.cycle();
  const c = await h.fx.criterion({ name: "Crit linha do tempo" });
  const emp = await h.fx.employee({ name: "Colab linha do tempo" });
  const aval = await h.ensureUser("avaliador");
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp], name: "Evento linha do tempo" });
  await h.fx.evaluation({ eventId, criterionId: c, evaluatorUserId: aval, score: 6 });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  await h.api("POST", "/calibrations", { role: "rh", body: { eventId, criterionId: c, calibratedScore: 8, calibrationReason: "melhorou" } });
  const pub = await h.api("POST", `/events/${eventId}/criteria/${c}/publish-partial`, { role: "rh" });
  assert.equal(pub.status, 200, JSON.stringify(pub.data));

  const r = await h.api("GET", `/results/timeline?employeeId=${emp}`, { role: "rh" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const rec = r.data.entries.filter((e: { kind: string }) => e.kind === "recorded");
  const last = rec[rec.length - 1];
  assert.equal(last.type, "publish_partial_feedback");
  assert.equal(last.finalBefore, 60);
  assert.equal(last.finalAfter, 80);
  assert.equal(last.eventName, "Evento linha do tempo");
  const cal = r.data.entries.find((e: { type: string }) => e.type === "calibrate");
  assert.equal(cal.scoreAfter, 8);
  assert.equal(cal.criterionName, "Crit linha do tempo");
  assert.equal(r.data.people.find((p: { employeeId: number }) => p.employeeId === emp).finalResult, 80);
  assert.equal(last.employeeName, "Colab linha do tempo");

  // Sem filtro: todos os colaboradores, com nome em cada mudança registrada.
  const all = await h.api("GET", "/results/timeline", { role: "admin" });
  assert.equal(all.status, 200, JSON.stringify(all.data));
  assert.equal(all.data.employeeId, null);
  assert.ok(all.data.entries.some((e: { kind: string; employeeId: number }) => e.kind === "recorded" && e.employeeId === emp));

  assert.equal((await h.api("GET", `/results/timeline?employeeId=${emp}`, { role: "diretoria" })).status, 403);
  assert.equal((await h.api("GET", `/results/timeline?employeeId=${emp}`, { role: "visualizador", employeeId: emp })).status, 403);
  assert.equal((await h.api("GET", "/results/timeline?employeeId=abc", { role: "admin" })).status, 400);
});
