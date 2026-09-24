// Testes do cálculo puro do ciclo (lib/cycle-compute.ts): nota do time por
// evento e resultado oficial (nota, faixa, bônus, pagamento preservado).
// A equivalência com a implementação antiga (consultas por evento) foi
// provada à parte, com um harness PGlite comparando antigo × novo.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEventTeamResultFromData,
  buildCycleResults,
  emptyEventTeamData,
  employeeIdsNeededForRecompute,
  type EventTeamData,
  type EventCriterionRow,
  type CycleRecomputeInput,
  type PlatoonRuleMapped,
  type ParticipationRow,
  type EmployeeLike,
  type ExistingQuarterlyLike,
} from "./cycle-compute.ts";

const crit = (criterionId: number, over: Partial<EventCriterionRow> = {}): EventCriterionRow => ({
  criterionId, criterionName: `C${criterionId}`, criterionDescription: null, responsibleAreaId: null,
  responsibleAreaLabel: null, responsibleAreaName: null, active: true, originalWeight: "1", weightOverride: null,
  displayOrder: 0, eventScoped: false, sourceCriterionId: null, ...over,
});
const ev = (criterionId: number, score: number, evaluatorUserId = 10, status = "submitted") =>
  ({ criterionId, score: String(score), evaluatorUserId, status });
const conf = (epi: boolean | null, estaiamentos: boolean | null, guardaEquipamentos: boolean | null, conduta: boolean | null) =>
  ({ epi, estaiamentos, guardaEquipamentos, conduta });

function team(over: Partial<EventTeamData> = {}): EventTeamData {
  return { ...emptyEventTeamData(), ...over };
}

test("nota do time: média ponderada, calibração substitui a média, rascunho não conta", () => {
  const r = computeEventTeamResultFromData(team({
    criteriaRows: [crit(1, { originalWeight: "3" }), crit(2, { originalWeight: "1" })],
    evaluations: [ev(1, 8, 10), ev(1, 6, 11), ev(1, 0, 12, "draft"), ev(2, 5)],
    calibrations: [{ criterionId: 2, calibratedScore: "9", calibrationReason: "ajuste" }],
  }));
  // critério 1: média 7 (peso 3); critério 2: calibrado 9 (peso 1) → (21 + 9) / 4 × 10 = 75
  assert.equal(r.eventScore, 75);
  assert.equal(r.conformityScore, 75);
  assert.equal(r.hasCalibration, true);
  assert.equal(r.criteriaDetails[1].calibrationReason, "ajuste");
});

test("nota do time: conformidade null = 25 (sem penalidade), false = 0 (penalidade 10 cada)", () => {
  const base = { criteriaRows: [crit(1)], evaluations: [ev(1, 8)] };
  assert.equal(computeEventTeamResultFromData(team({ ...base, conformity: conf(null, null, null, null) })).conformityScore, 80);
  const r = computeEventTeamResultFromData(team({ ...base, conformity: conf(false, true, null, false) }));
  assert.equal(r.conformityPenalty, 20);
  assert.equal(r.conformityScore, 60);
  // sem linha de conformidade = conformidade plena
  assert.equal(computeEventTeamResultFromData(team(base)).conformityScore, 80);
});

test("nota do time: quesito duplicado com pai presente é mesclado; com pai ausente conta sozinho", () => {
  const merged = computeEventTeamResultFromData(team({
    criteriaRows: [crit(1, { originalWeight: "2" }), crit(50, { eventScoped: true, sourceCriterionId: 1, originalWeight: "7" }), crit(2)],
    evaluations: [ev(1, 6), ev(50, 10), ev(2, 4)],
  }));
  // grupo (1+50): média 8 com peso 2 do pai; critério 2: 4 peso 1 → (16 + 4) / 3 × 10 = 66,67
  assert.equal(merged.eventScore, 66.67);

  const orphan = computeEventTeamResultFromData(team({
    criteriaRows: [crit(50, { eventScoped: true, sourceCriterionId: 99, originalWeight: "1" }), crit(2)],
    evaluations: [ev(50, 10), ev(2, 4)],
  }));
  // pai 99 não está no evento: o duplicado NÃO some → (10 + 4) / 2 × 10 = 70
  assert.equal(orphan.eventScore, 70);
});

test("nota do time: inativo sem calibração fica fora; inativo calibrado entra", () => {
  const r = computeEventTeamResultFromData(team({
    criteriaRows: [crit(1), crit(2, { active: false }), crit(3, { active: false })],
    evaluations: [ev(1, 6), ev(2, 10)],
    calibrations: [{ criterionId: 3, calibratedScore: "8", calibrationReason: null }],
  }));
  assert.deepEqual(r.criteriaDetails.map(c => c.criterionId), [1, 3]);
  assert.equal(r.eventScore, 70);
});

test("nota do time: nota 0 legítima tem scoreUsed (conta); evento sem avaliação não tem", () => {
  const zero = computeEventTeamResultFromData(team({ criteriaRows: [crit(1)], evaluations: [ev(1, 0)] }));
  assert.equal(zero.eventScore, 0);
  assert.equal(zero.criteriaDetails.some(c => c.scoreUsed != null), true);
  const none = computeEventTeamResultFromData(team({ criteriaRows: [crit(1)], evaluations: [ev(1, 9, 10, "draft")] }));
  assert.equal(none.criteriaDetails.some(c => c.scoreUsed != null), false);
});

// ─── Ciclo ───────────────────────────────────────────────────────────────────

const RULES: PlatoonRuleMapped[] = [
  { name: "0-70", color: "#999", minScore: 0, maxScore: 69.99, minInclusive: true, maxInclusive: true, bonusValue: 0, bonusPerExtraEvent: 150 },
  { name: "Branco", color: "#eee", minScore: 70, maxScore: 74.99, minInclusive: true, maxInclusive: true, bonusValue: 1200, bonusPerExtraEvent: 200 },
  { name: "Verde", color: "#0f0", minScore: 75, maxScore: 100, minInclusive: true, maxInclusive: true, bonusValue: 2000, bonusPerExtraEvent: 300 },
];
const emp = (id: number, over: Partial<EmployeeLike> = {}): EmployeeLike => ({
  id, name: `Colab ${id}`, functionName: "Montador", eligibleForBonus: true, eligibilityStatus: "eligible", eligibilityReason: null, ...over,
});
const part = (employeeId: number, eventId: number, over: Partial<ParticipationRow> = {}): ParticipationRow => ({
  employeeId, eventId, functionName: "Montador", confirmed: true, employmentType: "casa", employeeFunction: "Montador", ...over,
});
/** Evento cuja nota do time é exatamente `score` (um critério, sem conformidade). */
const scored = (score: number): EventTeamData => team({ criteriaRows: [crit(1)], evaluations: [ev(1, score / 10)] });

function input(over: Partial<CycleRecomputeInput>): CycleRecomputeInput {
  return {
    cycleId: 1, userId: 7, now: new Date("2026-09-24T12:00:00Z"),
    cycleEvents: [], platoonRules: RULES, minEvents: 2, existingRows: [],
    teamDataByEvent: new Map(), participationRows: [], supCenoCheckRows: [],
    employeesById: new Map(), absences: [], eligibilityByEmployee: new Map(),
    ...over,
  };
}
const evRow = (id: number, startDate: string, over: Partial<CycleRecomputeInput["cycleEvents"][number]> = {}) =>
  ({ id, resultsConfirmed: true, isHistorical: false, importedScore: null, startDate, ...over });

test("ciclo: média define a faixa; bônus = base + extras × valor da MESMA faixa", () => {
  const events = [evRow(1, "2026-01-01"), evRow(2, "2026-02-01"), evRow(3, "2026-03-01"), evRow(4, "2026-04-01")];
  const r = buildCycleResults(input({
    cycleEvents: events,
    teamDataByEvent: new Map([[1, scored(90)], [2, scored(60)], [3, scored(95)], [4, scored(55)]]),
    participationRows: events.map(e => part(1, e.id)),
    employeesById: new Map([[1, emp(1)]]),
  }));
  const q = r.quarterlyInserts[0];
  assert.equal(q.grossAverage, "75");
  assert.equal(q.platoon, "Verde");
  // 4 eventos pontuados, mínimo 2 → 2 extras × 300 (faixa Verde, a da média) — a nota individual dos extras não importa
  assert.equal(q.bonusValue, String(2000 + 2 * 300));
  assert.equal(q.extraBonusValue, "600");
  assert.equal(q.eligible, true);
  assert.equal(q.bonusStatus, "projected");
  assert.equal(r.eventResultInserts.length, 4);
});

test("ciclo: faixa sem bônus zera inclusive os extras", () => {
  const events = [evRow(1, "2026-01-01"), evRow(2, "2026-02-01"), evRow(3, "2026-03-01")];
  const r = buildCycleResults(input({
    cycleEvents: events,
    teamDataByEvent: new Map(events.map(e => [e.id, scored(60)])),
    participationRows: events.map(e => part(1, e.id)),
    employeesById: new Map([[1, emp(1)]]),
  }));
  assert.equal(r.quarterlyInserts[0].platoon, "0-70");
  assert.equal(r.quarterlyInserts[0].bonusValue, "0");
  assert.equal(r.quarterlyInserts[0].extraBonusValue, "0");
});

test("ciclo: só confirmados contam; nota 0 conta; evento sem nota conta só como participação", () => {
  const events = [evRow(1, "2026-01-01"), evRow(2, "2026-02-01"), evRow(3, "2026-03-01"), evRow(4, "2026-04-01", { resultsConfirmed: false })];
  const r = buildCycleResults(input({
    cycleEvents: events,
    teamDataByEvent: new Map([[1, scored(80)], [2, scored(0)], [3, team({ criteriaRows: [crit(1)] })]]),
    // participação no evento 4 (não confirmado) nem chega: o carregador só traz confirmados
    participationRows: [part(1, 1), part(1, 2), part(1, 3)],
    employeesById: new Map([[1, emp(1)]]),
  }));
  const q = r.quarterlyInserts[0];
  assert.equal(q.eventsCount, 2);                 // 80 e 0
  assert.equal(q.participatedEventsCount, 3);     // inclui o evento sem nota
  assert.equal(q.grossAverage, "40");
});

test("ciclo: freela, 'Sup Ceno *' e inativo no evento não geram nota; Sup Ceno em evento não confirmado desqualifica", () => {
  const events = [evRow(1, "2026-01-01"), evRow(2, "2026-02-01"), evRow(3, "2026-03-01"), evRow(4, "2026-04-01", { resultsConfirmed: false })];
  const r = buildCycleResults(input({
    cycleEvents: events,
    teamDataByEvent: new Map(events.map(e => [e.id, scored(90)])),
    participationRows: [
      part(1, 1), part(1, 2), part(1, 3, { confirmed: false }),
      part(2, 1, { employmentType: "freela" }),
      part(3, 1, { functionName: "Sup Ceno Local" }), part(3, 2),
      part(4, 1), part(4, 2),
    ],
    supCenoCheckRows: [{ employeeId: 4, functionName: "Sup Ceno", employeeFunction: "Montador" }],
    employeesById: new Map([[1, emp(1)], [2, emp(2)], [3, emp(3)], [4, emp(4)]]),
  }));
  const byEmp = new Map(r.quarterlyInserts.map(q => [q.employeeId, q]));
  assert.equal(byEmp.get(1)!.participatedEventsCount, 2); // inativo no evento 3 não conta
  assert.equal(byEmp.has(2), false);                       // freela nunca entra
  assert.equal(byEmp.get(3)!.participatedEventsCount, 1);  // só a participação não informativa
  assert.equal(byEmp.get(4)!.eligible, false);
  assert.equal(byEmp.get(4)!.eligibilityReason, "Participou como Sup Ceno em um ou mais eventos do ciclo");
  assert.deepEqual(r.eventResultInserts.filter(e => e.eventId === 1).map(e => e.employeeId).sort(), [1, 4]);
});

test("ciclo: histórico usa importedScore; penalidade/mérito ajustam a nota final", () => {
  const events = [evRow(1, "2026-01-01", { isHistorical: true, importedScore: "80.00" }), evRow(2, "2026-02-01")];
  const r = buildCycleResults(input({
    cycleEvents: events,
    teamDataByEvent: new Map([[2, scored(70)]]),
    participationRows: [part(1, 1), part(1, 2)],
    employeesById: new Map([[1, emp(1)]]),
    absences: [
      { employeeId: 1, kind: "penalty", points: 10, quantity: 2 },
      { employeeId: 1, kind: "merit", points: 5, quantity: 1 },
      { employeeId: 2, kind: "penalty", points: 50, quantity: 1 },
    ],
  }));
  const q = r.quarterlyInserts[0];
  assert.equal(q.grossAverage, "75");
  assert.equal(q.totalAbsences, 2);
  assert.equal(q.absencePenalty, "20");
  assert.equal(q.meritPoints, "5");
  assert.equal(q.finalResult, String(75 - 15 / 2)); // (150 − 20 + 5) / 2
  const hist = r.eventResultInserts.find(e => e.eventId === 1)!;
  assert.equal(hist.finalEventScore, "80");
  assert.equal(hist.calibratedEventScore, "80");
});

test("ciclo: elegibilidade manual e cadastral; mínimo de eventos", () => {
  const events = [evRow(1, "2026-01-01"), evRow(2, "2026-02-01")];
  const r = buildCycleResults(input({
    cycleEvents: events, minEvents: 2,
    teamDataByEvent: new Map(events.map(e => [e.id, scored(90)])),
    participationRows: [part(1, 1), part(1, 2), part(2, 1), part(2, 2), part(3, 1), part(4, 1), part(4, 2)],
    employeesById: new Map([[1, emp(1)], [2, emp(2, { eligibilityStatus: "suspended" })], [3, emp(3)], [4, emp(4)]]),
    eligibilityByEmployee: new Map([[4, { eligible: false, reason: null }]]),
  }));
  const byEmp = new Map(r.quarterlyInserts.map(q => [q.employeeId, q]));
  assert.equal(byEmp.get(1)!.eligible, true);
  assert.equal(byEmp.get(2)!.eligibilityReason, "Colaborador inelegível (suspended)");
  assert.equal(byEmp.get(3)!.eligibilityReason, "Participou de 1 de 2 eventos exigidos no ciclo");
  assert.equal(byEmp.get(4)!.eligibilityReason, "Inelegível neste ciclo");
  assert.equal(byEmp.get(4)!.bonusValue, "0");
  assert.equal(byEmp.get(4)!.bonusStatus, "not_eligible");
});

test("ciclo: pagamento decidido é preservado e divergência vira warning; quem saiu do ciclo também avisa", () => {
  const events = [evRow(1, "2026-01-01"), evRow(2, "2026-02-01")];
  const paidAt = new Date("2026-08-15T12:00:00Z");
  const prev = (employeeId: number, bonusStatus: string, bonusValue: string, over: Partial<ExistingQuarterlyLike> = {}): ExistingQuarterlyLike =>
    ({ employeeId, bonusStatus, bonusValue, paymentMethod: "PIX", paymentDueDate: "2026-08-10", paidAt: null, paymentNotes: "nota", ...over });
  const existingRows = [
    prev(1, "paid", "1000", { paidAt }),
    prev(2, "projected", "999"),
    prev(3, "approved", "2000"),
  ];
  const r = buildCycleResults(input({
    cycleEvents: events,
    teamDataByEvent: new Map(events.map(e => [e.id, scored(90)])),
    participationRows: [part(1, 1), part(1, 2), part(2, 1), part(2, 2)],
    employeesById: new Map([[1, emp(1)], [2, emp(2)], [3, emp(3)]]),
    existingRows,
  }));
  const byEmp = new Map(r.quarterlyInserts.map(q => [q.employeeId, q]));
  assert.equal(byEmp.get(1)!.bonusStatus, "paid");
  assert.equal(byEmp.get(1)!.paidAt, paidAt);
  assert.equal(byEmp.get(1)!.paymentNotes, "nota");
  assert.equal(byEmp.get(1)!.bonusValue, "2000");
  assert.equal(byEmp.get(2)!.bonusStatus, "projected");   // não decidido: recalculado
  assert.equal(byEmp.get(2)!.paymentMethod, "PIX");       // método sempre herdado
  assert.equal(byEmp.get(2)!.paymentDueDate, null);
  assert.deepEqual(r.warnings, [
    'Colab 1: bônus recalculado para R$ 2000.00 diverge do valor com status "paid" (R$ 1000.00). Revise o pagamento.',
    'Colab 3: pagamento com status "approved" será removido deste ciclo — não há mais participações que contam para nota (verifique se o employmentType ou a função mudou).',
  ]);
  assert.deepEqual(employeeIdsNeededForRecompute([part(1, 1), part(5, 2)], existingRows).sort(), [1, 2, 3, 5]);
});
