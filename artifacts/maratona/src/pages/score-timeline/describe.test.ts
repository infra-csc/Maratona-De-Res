import { test } from "node:test";
import assert from "node:assert/strict";
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { filterHappenings, groupByDay, moveOf, tally, toHappenings } from "./describe";

let seq = 0;
function entry(p: Partial<ScoreTimelineEntry>): ScoreTimelineEntry {
  seq++;
  return { id: `e${seq}`, at: "2026-09-20T15:00:00.000Z", kind: "recorded", type: "recompute", ...p };
}
const names = (h: { people: ScoreTimelineEntry[] }) => h.people.map(p => p.employeeName).sort();

test("toHappenings: mesmo causeId = um acontecimento, com o critério da auditoria no título", () => {
  const cause = "publish_partial_feedback|event_criteria|55";
  const hs = toHappenings([
    entry({ type: "publish_partial_feedback", causeId: cause, eventId: 13, eventName: "SRUN", employeeId: 1, employeeName: "Ana", finalBefore: 70, finalAfter: 72 }),
    entry({ type: "publish_partial_feedback", causeId: cause, eventId: 13, eventName: "SRUN", employeeId: 2, employeeName: "Bia", at: "2026-09-20T15:00:40.000Z", finalBefore: 80, finalAfter: 79 }),
    entry({ kind: "info", type: "publish_partial_feedback", causeId: "log-9", eventId: 13, eventName: "SRUN", criterionName: "Comunicação", by: "Renata", at: "2026-09-20T14:59:59.000Z" }),
  ]);
  assert.equal(hs.length, 1);
  assert.deepEqual(names(hs[0]), ["Ana", "Bia"]);
  assert.equal(hs[0].by, "Renata");
  assert.match(hs[0].detail ?? "", /Comunicação/);
  assert.equal(hs[0].totalPeople, 2);
});

test("toHappenings: causeIds diferentes no mesmo evento e instante = cartões separados", () => {
  const hs = toHappenings([
    entry({ type: "publish_partial_feedback", causeId: "publish_partial_feedback|event_criteria|1", eventId: 13, employeeId: 1, employeeName: "Ana", finalBefore: 70, finalAfter: 71 }),
    entry({ type: "publish_partial_feedback", causeId: "publish_partial_feedback|event_criteria|2", eventId: 13, employeeId: 1, employeeName: "Ana", finalBefore: 71, finalAfter: 73 }),
  ]);
  assert.equal(hs.length, 2);
  for (const h of hs) assert.equal(h.people.length, 1);
});

test("toHappenings: penalidades de pessoas diferentes no mesmo evento em 90 s = 2 cartões", () => {
  const hs = toHappenings([
    entry({ type: "penalty", causeId: "create|absences|10", eventId: 13, label: "Atraso", employeeId: 1, employeeName: "Ana", finalBefore: 80, finalAfter: 78 }),
    entry({ type: "penalty", causeId: "create|absences|11", eventId: 13, label: "Falta", employeeId: 2, employeeName: "Bia", at: "2026-09-20T15:01:30.000Z", finalBefore: 75, finalAfter: 70 }),
  ]);
  assert.equal(hs.length, 2);
  const byTitle = Object.fromEntries(hs.map(h => [h.title, names(h)]));
  assert.deepEqual(byTitle["Penalidade · Atraso"], ["Ana"]);
  assert.deepEqual(byTitle["Penalidade · Falta"], ["Bia"]);
});

test("toHappenings: saídas do ciclo com motivos diferentes = 2 cartões (mesmo sem causeId)", () => {
  const hs = toHappenings([
    entry({ type: "cycle_excluded", reason: "Desligado", employeeId: 1, employeeName: "Ana", finalBefore: 80, finalAfter: null }),
    entry({ type: "cycle_excluded", reason: "Afastado", employeeId: 2, employeeName: "Bia", at: "2026-09-20T15:00:20.000Z", finalBefore: 60, finalAfter: null }),
  ]);
  assert.equal(hs.length, 2);
  assert.ok(hs.every(h => h.people.length === 1));
  assert.ok(hs.some(h => h.detail?.includes("Desligado") && names(h)[0] === "Ana"));
  assert.ok(hs.some(h => h.detail?.includes("Afastado") && names(h)[0] === "Bia"));
});

test("toHappenings sem causeId (API antiga): penalidade e mérito individuais, publicação junta na janela de 2 min", () => {
  const hs = toHappenings([
    entry({ type: "penalty", eventId: 13, label: "Atraso", employeeId: 1, employeeName: "Ana" }),
    entry({ type: "penalty", eventId: 13, label: "Atraso", employeeId: 2, employeeName: "Bia", at: "2026-09-20T15:00:30.000Z" }),
    entry({ kind: "reconstructed", type: "merit", eventId: 13, label: "Elogio", employeeId: 3, employeeName: "Caio" }),
    entry({ type: "publish_final_feedback", eventId: 13, employeeId: 1, employeeName: "Ana", at: "2026-09-21T10:00:00.000Z" }),
    entry({ type: "publish_final_feedback", eventId: 13, employeeId: 2, employeeName: "Bia", at: "2026-09-21T10:01:00.000Z" }),
    // Fora da janela (3 min depois do último): outro acontecimento.
    entry({ type: "publish_final_feedback", eventId: 13, employeeId: 3, employeeName: "Caio", at: "2026-09-21T10:04:30.000Z" }),
  ]);
  const pen = hs.filter(h => h.type === "penalty");
  assert.equal(pen.length, 2);
  assert.equal(hs.filter(h => h.type === "merit").length, 1);
  const pub = hs.filter(h => h.type === "publish_final_feedback");
  assert.equal(pub.length, 2);
  assert.deepEqual(pub.map(names).sort((a, b) => b.length - a.length), [["Ana", "Bia"], ["Caio"]]);
});

test("toHappenings: a mesma pessoa nunca aparece 2x no mesmo cartão", () => {
  const hs = toHappenings([
    entry({ type: "publish_partial_feedback", eventId: 13, employeeId: 1, employeeName: "Ana" }),
    entry({ type: "publish_partial_feedback", eventId: 13, employeeId: 1, employeeName: "Ana", at: "2026-09-20T15:00:10.000Z" }),
  ]);
  assert.equal(hs.length, 2);
});

test("toHappenings: calibração só avisa 'a publicar' com pendingPublish === true", () => {
  const hs = toHappenings([
    entry({ kind: "info", type: "calibrate", eventId: 13, pendingPublish: true }),
    entry({ kind: "info", type: "calibrate", eventId: 14, pendingPublish: false, at: "2026-09-20T16:00:00.000Z" }),
    entry({ kind: "info", type: "calibrate", eventId: 15, at: "2026-09-20T17:00:00.000Z" }),
  ]);
  const by = Object.fromEntries(hs.map(h => [h.eventId, h.pendingPublish]));
  assert.deepEqual(by, { 13: true, 14: false, 15: false });
});

test("filterHappenings: busca pelo critério acha a publicação com as pessoas; 'Subiu' mantém o título", () => {
  const cause = "publish_partial_feedback|event_criteria|55";
  const hs = toHappenings([
    entry({ type: "publish_partial_feedback", causeId: cause, eventId: 13, employeeId: 1, employeeName: "Ana", finalBefore: 70, finalAfter: 72 }),
    entry({ type: "publish_partial_feedback", causeId: cause, eventId: 13, employeeId: 2, employeeName: "Bia", finalBefore: 80, finalAfter: 79 }),
    entry({ kind: "info", type: "publish_partial_feedback", eventId: 13, criterionName: "Comunicação", by: "Renata" }),
  ]);
  const q = filterHappenings(hs, { q: "comunicacao" });
  assert.equal(q.length, 1);
  assert.equal(q[0].people.length, 2);
  const up = filterHappenings(hs, { dir: "alta" });
  assert.equal(up.length, 1);
  assert.deepEqual(names(up[0]), ["Ana"]);
  assert.match(up[0].detail ?? "", /Comunicação/);
  assert.equal(up[0].totalPeople, 2);
  assert.equal(filterHappenings(hs, { q: "bia" })[0].people.length, 1);
});

test("moveOf/tally: entrou na nota e saiu do ciclo são contados à parte, não como alta/queda", () => {
  const rows = [
    entry({ type: "event_counted", employeeId: 1, finalBefore: null, finalAfter: 77 }),
    entry({ type: "cycle_excluded", employeeId: 2, finalBefore: 60, finalAfter: null }),
    entry({ employeeId: 3, finalBefore: 60, finalAfter: 61 }),
    entry({ employeeId: 4, finalBefore: 60, finalAfter: 60, bonusBefore: 0, bonusAfter: 100 }),
  ];
  assert.deepEqual(rows.map(moveOf), ["entered", "left", "up", "same"]);
  assert.deepEqual(tally(rows), { changes: 4, people: 4, ups: 1, downs: 0, entered: 1, left: 1, faixas: 0 });
  const hs = toHappenings(rows);
  assert.equal(filterHappenings(hs, { dir: "alta" }).flatMap(h => h.people).length, 1);
});

test("groupByDay: 02:30Z conta no dia anterior (America/Sao_Paulo)", () => {
  const hs = toHappenings([
    entry({ type: "penalty", employeeId: 1, at: "2026-09-21T02:30:00.000Z", finalBefore: 80, finalAfter: 78 }),
    entry({ type: "penalty", employeeId: 2, at: "2026-09-21T03:30:00.000Z", finalBefore: 80, finalAfter: 82 }),
  ]);
  const days = groupByDay(hs);
  assert.deepEqual(days.map(d => d.key), ["2026-09-21", "2026-09-20"]);
  assert.equal(days[1].downs, 1);
  assert.equal(days[0].ups, 1);
});
