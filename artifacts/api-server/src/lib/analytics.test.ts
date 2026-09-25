import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAnalytics, weekendStart, type AnalyticsInput } from "./analytics.ts";

const RULES = [
  { name: "Sem Bônus", color: "#64748b", minScore: 0, maxScore: 69.99, minInclusive: true, maxInclusive: true, bonusValue: 0, bonusPerExtraEvent: 0 },
  { name: "Branco Caminhada", color: "#e2e8f0", minScore: 70, maxScore: 74.99, minInclusive: true, maxInclusive: true, bonusValue: 1200, bonusPerExtraEvent: 200 },
  { name: "Branco Corrida", color: "#cbd5e1", minScore: 75, maxScore: 79.99, minInclusive: true, maxInclusive: true, bonusValue: 1700, bonusPerExtraEvent: 250 },
];

function base(): AnalyticsInput {
  return {
    events: [
      { id: 1, name: "A", clientName: "Cliente X", startDate: "2026-08-08", endDate: "2026-08-08", resultsConfirmed: true, isHistorical: false },
      { id: 2, name: "B", clientName: "Cliente X", startDate: "2026-08-09", endDate: "2026-08-09", resultsConfirmed: true, isHistorical: false },
      { id: 3, name: "C", clientName: null, startDate: "2026-08-15", endDate: "2026-08-15", resultsConfirmed: false, isHistorical: false },
    ],
    officialScores: [{ eventId: 1, score: 70 }, { eventId: 1, score: 70 }, { eventId: 2, score: 80 }],
    quarterly: [
      { employeeId: 10, employeeName: "Ana", finalResult: 72.5, platoon: "Branco Caminhada", bonusValue: 1400, eligible: true, eventsCount: 10, participatedEventsCount: 10 },
      { employeeId: 11, employeeName: "Bia", finalResult: 68, platoon: "Sem Bônus", bonusValue: 0, eligible: true, eventsCount: 9, participatedEventsCount: 9 },
      { employeeId: 12, employeeName: "Caio", finalResult: 80, platoon: "Branco Corrida", bonusValue: 0, eligible: false, eventsCount: 3, participatedEventsCount: 3 },
    ],
    rules: RULES,
    minEvents: 9,
    evaluations: [
      { eventId: 1, criterionId: 100, evaluatorUserId: 5, evaluatorName: "Ava", score: 6, status: "submitted", submittedAt: new Date("2026-08-10T12:00:00Z") },
      { eventId: 2, criterionId: 100, evaluatorUserId: 5, evaluatorName: "Ava", score: 8, status: "submitted", submittedAt: new Date("2026-08-09T20:00:00Z") },
      { eventId: 3, criterionId: 100, evaluatorUserId: 6, evaluatorName: "Beto", score: 9, status: "draft", submittedAt: null },
    ],
    calibrations: [{ eventId: 1, criterionId: 100, calibratedScore: 7 }],
    eventCriteria: [
      { eventId: 1, criterionId: 100, active: true, name: "Prazo", area: "Produção" },
      { eventId: 2, criterionId: 100, active: true, name: "Prazo", area: "Produção" },
      { eventId: 3, criterionId: 100, active: true, name: "Prazo", area: "Produção" },
    ],
    conformities: [
      { eventId: 1, epi: true, estaiamentos: false, conduta: null, guardaEquipamentos: true },
      { eventId: 2, epi: false, estaiamentos: false, conduta: true, guardaEquipamentos: null },
    ],
    adjustments: [
      { employeeId: 10, label: "Falta", kind: "penalty", points: 50, quantity: 2 },
      { employeeId: 11, label: "Falta", kind: "penalty", points: 50, quantity: 1 },
      { employeeId: 10, label: "Destaque", kind: "merit", points: 20, quantity: 1 },
    ],
  };
}

test("weekendStart: sábado e domingo do mesmo fim de semana caem no mesmo sábado", () => {
  assert.equal(weekendStart("2026-08-08"), "2026-08-08"); // sábado
  assert.equal(weekendStart("2026-08-09"), "2026-08-08"); // domingo
  assert.equal(weekendStart("2026-08-14"), "2026-08-08"); // sexta seguinte
  assert.equal(weekendStart("2026-08-15"), "2026-08-15");
});

test("KPIs: média só de eventos confirmados com nota oficial; bônus só de elegíveis", () => {
  const o = computeAnalytics(base());
  assert.equal(o.kpis.eventsTotal, 3);
  assert.equal(o.kpis.eventsConfirmed, 2);
  assert.equal(o.kpis.eventsScored, 2);
  assert.equal(o.kpis.avgEventScore, 75);
  assert.equal(o.kpis.bonusTotal, 1400);
  assert.equal(o.kpis.evaluationsSubmitted, 2);
  assert.equal(o.kpis.evaluationsDraft, 1);
  assert.equal(o.kpis.penaltiesCount, 3);
  assert.equal(o.kpis.meritsCount, 1);
});

test("Evolução: um ponto por fim de semana com a média dos eventos", () => {
  const o = computeAnalytics(base());
  assert.deepEqual(o.scoreTrend, [{ weekStart: "2026-08-08", label: "08/08", avgScore: 75, events: 2 }]);
});

test("Critérios: calibração substitui a média; deslocamento e viés em pontos 0-100", () => {
  const o = computeAnalytics(base());
  const prazo = o.criteria[0];
  assert.equal(prazo.name, "Prazo");
  assert.equal(prazo.eventsCount, 2); // evento 3 só tem rascunho → sem nota
  assert.equal(prazo.avgScore, 75); // (7 + 8) / 2 × 10
  assert.equal(prazo.evaluatorAvg, 70);
  assert.equal(prazo.calibratedAvg, 70);
  assert.equal(o.kpis.avgCalibrationShift, 10); // RH subiu 6 → 7
  const ava = o.evaluators.find(e => e.name === "Ava")!;
  assert.equal(ava.calibrationBias, 10);
  assert.equal(ava.avgGiven, 70);
  assert.equal(ava.avgDaysToSubmit, 0.8); // 1,5 dia no evento 1 e 0 no evento 2 (antes do fim)
});

test("Conformidade: percentual de Não sobre as respostas, pendentes fora", () => {
  const o = computeAnalytics(base());
  const byItem = Object.fromEntries(o.conformity.map(c => [c.item, c]));
  assert.deepEqual([byItem.epi.answered, byItem.epi.nao, byItem.epi.naoPct], [2, 1, 50]);
  assert.deepEqual([byItem.estaiamentos.nao, byItem.estaiamentos.naoPct], [2, 100]);
  assert.equal(byItem.conduta.answered, 1);
});

test("Faixas, funil e perto da próxima faixa", () => {
  const o = computeAnalytics(base());
  assert.deepEqual(o.funnel.map(f => f.count), [3, 2, 2, 1]);
  assert.equal(o.faixas.find(f => f.name === "Branco Caminhada")!.count, 1);
  assert.equal(o.faixas.find(f => f.name === "Branco Corrida")!.bonusTotal, 0); // Caio inelegível
  // Ana a 2,5 da Branco Corrida (10 eventos → 1 extra): 1.700 + 250
  // Bia a 2,0 da Branco Caminhada (9 eventos → 0 extras): 1.200
  assert.deepEqual(o.nearNextFaixa.map(n => [n.name, n.gap, n.potentialBonus]), [["Bia", 2, 1200], ["Ana", 2.5, 1950]]);
});

test("Penalidades agrupadas por tipo com colaboradores distintos; clientes com média", () => {
  const o = computeAnalytics(base());
  const falta = o.adjustments.find(a => a.label === "Falta")!;
  assert.deepEqual([falta.occurrences, falta.points, falta.employees], [3, 150, 2]);
  assert.deepEqual(o.clients, [{ client: "Cliente X", avgScore: 75, events: 2 }]);
});

test("Ciclo vazio não quebra", () => {
  const o = computeAnalytics({ ...base(), events: [], officialScores: [], quarterly: [], evaluations: [], calibrations: [], eventCriteria: [], conformities: [], adjustments: [] });
  assert.equal(o.kpis.avgEventScore, null);
  assert.equal(o.scoreTrend.length, 0);
  assert.equal(o.conformity.every(c => c.naoPct === null), true);
});

test("critérios e matriz só contam eventos confirmados (como a nota oficial)", () => {
  const input = base();
  // Evento 3 não confirmado: uma avaliação enviada e uma matriz com "Não" não podem entrar.
  input.evaluations.push({ eventId: 3, criterionId: 100, evaluatorUserId: 5, evaluatorName: "Ava", score: 1, status: "submitted", submittedAt: new Date("2026-08-16T12:00:00Z") });
  input.conformities.push({ eventId: 3, epi: false, estaiamentos: false, conduta: false, guardaEquipamentos: false });
  const o = computeAnalytics(input);
  const prazo = o.criteria.find(c => c.name === "Prazo")!;
  assert.equal(prazo.eventsCount, 2);
  assert.equal(prazo.avgScore, 75); // evento 1 calibrado 7 → 70, evento 2 avaliador 8 → 80
  const conduta = o.conformity.find(c => c.item === "conduta")!;
  assert.equal(conduta.answered, 1);
  assert.equal(conduta.nao, 0);
  // Avaliadores continuam vendo tudo o que foi enviado, inclusive do evento não confirmado.
  assert.equal(o.evaluators.find(e => e.name === "Ava")!.submitted, 3);
});

test("nota final média: mesma conta de Resultados (ignora quem não tem evento com nota)", () => {
  const input = base();
  input.quarterly.push({ employeeId: 13, employeeName: "Dani", finalResult: 0, platoon: "Sem Bônus", bonusValue: 0, eligible: false, eventsCount: 0, participatedEventsCount: 1 });
  const o = computeAnalytics(input);
  assert.equal(o.kpis.avgFinalResult, 73.5); // (72,5 + 68 + 80) / 3
});

test("critérios: uma linha por área (Atendimento e Ativação); cópias \"(2)\" entram na área certa, um ponto por evento", () => {
  const input = base();
  // Cenário real de produção: "Qualidade da Entrega" global de Atendimento (17),
  // outra global de mesmo nome da Ativação (34), cópias "(2)" com e sem origem.
  input.criteriaCatalog = [
    { id: 17, name: "Qualidade da Entrega", eventScoped: false, sourceCriterionId: null },
    { id: 34, name: "Qualidade da Entrega", eventScoped: false, sourceCriterionId: null },
    { id: 36, name: "Qualidade da Entrega (2)", eventScoped: true, sourceCriterionId: 17 },
    { id: 30, name: "Qualidade da Entrega (2)", eventScoped: true, sourceCriterionId: null },
  ];
  input.eventCriteria.push(
    { eventId: 1, criterionId: 17, active: true, name: "Qualidade da Entrega", area: "Atendimento" },
    { eventId: 1, criterionId: 36, active: true, name: "Qualidade da Entrega (2)", area: "Ativação" },
    { eventId: 2, criterionId: 34, active: true, name: "Qualidade da Entrega", area: "Ativação" },
    { eventId: 2, criterionId: 30, active: true, name: "Qualidade da Entrega (2)", area: "Ativação" },
  );
  input.evaluations.push(
    { eventId: 1, criterionId: 17, evaluatorUserId: 7, evaluatorName: "Cid", score: 8, status: "submitted", submittedAt: null },
    { eventId: 1, criterionId: 36, evaluatorUserId: 8, evaluatorName: "Dea", score: 6, status: "submitted", submittedAt: null },
    { eventId: 2, criterionId: 34, evaluatorUserId: 8, evaluatorName: "Dea", score: 9, status: "submitted", submittedAt: null },
    { eventId: 2, criterionId: 30, evaluatorUserId: 8, evaluatorName: "Dea", score: 7, status: "submitted", submittedAt: null },
  );
  const o = computeAnalytics(input);
  const q = o.criteria.filter(c => c.name.startsWith("Qualidade"));
  assert.equal(q.length, 2);
  assert.ok(q.every(c => c.name === "Qualidade da Entrega"));
  const atend = q.find(c => c.area === "Atendimento")!;
  const ativ = q.find(c => c.area === "Ativação")!;
  assert.equal(atend.eventsCount, 1);  // evento 1 (critério 17)
  assert.equal(atend.avgScore, 80);
  // Ativação: evento 1 = cópia (2) → 60; evento 2 = média de 34 (90) e cópia (70) = 80 → (60+80)/2
  assert.equal(ativ.eventsCount, 2);
  assert.equal(ativ.avgScore, 70);
});

test("critérios: peso 0 fica fora da média; inativo só entra se tiver calibração (regra da nota oficial)", () => {
  const input = base();
  input.eventCriteria.push(
    { eventId: 1, criterionId: 200, active: true, name: "Duplicado sem peso", area: "Atendimento", weight: 0 },
    { eventId: 1, criterionId: 201, active: false, name: "Inativo calibrado", area: "Logística", weight: 3 },
    { eventId: 2, criterionId: 202, active: false, name: "Inativo sem calibração", area: "Logística", weight: 3 },
  );
  input.calibrations.push({ eventId: 1, criterionId: 200, calibratedScore: 0 }, { eventId: 1, criterionId: 201, calibratedScore: 5 });
  input.evaluations.push({ eventId: 2, criterionId: 202, evaluatorUserId: 5, evaluatorName: "Ava", score: 9, status: "submitted", submittedAt: null });
  const o = computeAnalytics(input);
  assert.equal(o.criteria.find(c => c.name === "Duplicado sem peso"), undefined);
  assert.equal(o.criteria.find(c => c.name === "Inativo calibrado")?.avgScore, 50);
  assert.equal(o.criteria.find(c => c.name === "Inativo sem calibração"), undefined);
});
