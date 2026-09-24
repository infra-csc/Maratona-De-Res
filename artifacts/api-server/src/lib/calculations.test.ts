// Testes das regras de cálculo que decidem nota e bônus. Rodam com o test
// runner nativo do Node (sem dependência extra): `pnpm run test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTieredBonus,
  calculateExtraBonusValue,
  getPlatoonByScore,
  selectExtraEventScores,
  calculateQuarterFinalResult,
  calculateQuarterGrossAverage,
  mergeEventScopedCriteria,
  calculateEventResult,
  calculateConformitySubtotal,
  calculateConformityPenalty,
  calculateFinalEventScore,
  getCriterionEvaluationStatus,
  buildAssignedEvaluatorsByArea,
  type PlatoonRuleData,
} from "./calculations.ts";

// Tabela oficial "Faixas de Bonificação" do ciclo 2026.
const RULES: PlatoonRuleData[] = [
  { name: "Sem Bônus", color: "#64748b", minScore: 0, maxScore: 69.99, minInclusive: true, maxInclusive: true, bonusValue: 0, bonusPerExtraEvent: 0 },
  { name: "Branco Caminhada", color: "#e2e8f0", minScore: 70, maxScore: 74.99, minInclusive: true, maxInclusive: true, bonusValue: 1200, bonusPerExtraEvent: 200 },
  { name: "Branco Corrida", color: "#cbd5e1", minScore: 75, maxScore: 79.99, minInclusive: true, maxInclusive: true, bonusValue: 1700, bonusPerExtraEvent: 250 },
  { name: "Verde", color: "#22c55e", minScore: 80, maxScore: 84.99, minInclusive: true, maxInclusive: true, bonusValue: 2200, bonusPerExtraEvent: 300 },
  { name: "Azul", color: "#3b82f6", minScore: 85, maxScore: 89.99, minInclusive: true, maxInclusive: true, bonusValue: 2700, bonusPerExtraEvent: 350 },
  { name: "Quênia", color: "#ca8a04", minScore: 90, maxScore: 94.99, minInclusive: true, maxInclusive: true, bonusValue: 3200, bonusPerExtraEvent: 400 },
  { name: "Quênia Alto Rendimento", color: "#facc15", minScore: 95, maxScore: 100, minInclusive: true, maxInclusive: true, bonusValue: 3700, bonusPerExtraEvent: 450 },
];

test("getPlatoonByScore: fronteiras fechadas e arredondamento a 2 casas", () => {
  assert.equal(getPlatoonByScore(69.99, RULES)?.name, "Sem Bônus");
  assert.equal(getPlatoonByScore(70, RULES)?.name, "Branco Caminhada");
  assert.equal(getPlatoonByScore(74.99, RULES)?.name, "Branco Caminhada");
  // 74.995 arredonda para 75.00 e não cai na lacuna entre faixas
  assert.equal(getPlatoonByScore(74.995, RULES)?.name, "Branco Corrida");
  assert.equal(getPlatoonByScore(74.994, RULES)?.name, "Branco Caminhada");
  assert.equal(getPlatoonByScore(100, RULES)?.name, "Quênia Alto Rendimento");
  assert.equal(getPlatoonByScore(100.01, RULES), null);
  assert.equal(getPlatoonByScore(-1, RULES), null);
});

test("calculateTieredBonus: base + extras × valor da MESMA faixa (tabela oficial, 3 extras)", () => {
  // A nota de cada evento extra não altera o valor pago.
  assert.equal(calculateTieredBonus(72, [40, 99, 70], RULES), 1800);
  assert.equal(calculateTieredBonus(77, [50, 50, 50], RULES), 2450);
  assert.equal(calculateTieredBonus(82, [100, 10, 60], RULES), 3100);
  assert.equal(calculateTieredBonus(87, [70, 70, 70], RULES), 3750);
  assert.equal(calculateTieredBonus(92, [0.5, 95, 71], RULES), 4400);
  assert.equal(calculateTieredBonus(97, [60, 61, 62], RULES), 5050);
});

test("calculateTieredBonus: sem extras só a base; faixa sem bônus zera inclusive os extras", () => {
  assert.equal(calculateTieredBonus(72, [], RULES), 1200);
  assert.equal(calculateTieredBonus(69.99, [90, 90, 90], RULES), 0);
  assert.equal(calculateTieredBonus(0, [], RULES), 0);
  // bonusPerExtraEvent ausente conta como 0
  const semExtra = RULES.map(r => ({ ...r, bonusPerExtraEvent: undefined }));
  assert.equal(calculateTieredBonus(72, [80, 80], semExtra), 1200);
});

test("calculateExtraBonusValue = tiered − base, e zera na faixa sem bônus", () => {
  assert.equal(calculateExtraBonusValue(72, [40, 99, 70], RULES), 600);
  assert.equal(calculateTieredBonus(72, [40, 99, 70], RULES) - calculateExtraBonusValue(72, [40, 99, 70], RULES), 1200);
  assert.equal(calculateExtraBonusValue(69.99, [90, 90], RULES), 0);
});

test("selectExtraEventScores: ordem cronológica e mínimo maior que o total", () => {
  const eventos = [
    { score: 60, date: "2026-08-15" },
    { score: 90, date: "2026-06-01" },
    { score: 70, date: "2026-07-10" },
  ];
  assert.deepEqual(selectExtraEventScores(eventos, 1), [70, 60]);
  assert.deepEqual(selectExtraEventScores(eventos, 3), []);
  assert.deepEqual(selectExtraEventScores(eventos, 9), []);
  assert.deepEqual(selectExtraEventScores([], 9), []);
});

test("calculateQuarterFinalResult: (soma − penalidade líquida) ÷ N, travado em 0..100", () => {
  assert.equal(calculateQuarterFinalResult(calculateQuarterGrossAverage([70, 80]), 50, 2), 50);
  assert.equal(calculateQuarterFinalResult(90, -20, 2), 100); // mérito não passa de 100
  assert.equal(calculateQuarterFinalResult(10, 500, 2), 0);   // penalidade não vai abaixo de 0
  assert.equal(calculateQuarterFinalResult(0, 0, 0), 0);
});

test("calculateEventResult: média ponderada; peso total 0 não divide por zero", () => {
  const nota = calculateEventResult([
    { criterionId: 1, weight: 3, averageScore: 8, calibratedScore: null },
    { criterionId: 2, weight: 1, averageScore: 4, calibratedScore: 10 }, // calibração sobrepõe
  ]);
  assert.equal(nota, 85); // (8×3 + 10×1) / 4 = 8.5 → 85
  assert.equal(calculateEventResult([{ criterionId: 1, weight: 0, averageScore: 8, calibratedScore: null }]), 0);
});

test("mergeEventScopedCriteria: filho funde no pai; filho sem pai não some da nota", () => {
  const fundido = mergeEventScopedCriteria([
    { criterionId: 17, weight: 3, averageScore: 6, calibratedScore: null, isEventScoped: false, sourceCriterionId: null },
    { criterionId: 34, weight: 0, averageScore: 8, calibratedScore: null, isEventScoped: true, sourceCriterionId: 17 },
  ]);
  assert.equal(fundido.length, 1);
  assert.equal(fundido[0].criterionId, 17);
  assert.equal(fundido[0].averageScore, 7);
  const orfao = mergeEventScopedCriteria([
    { criterionId: 34, weight: 3, averageScore: 8, calibratedScore: null, isEventScoped: true, sourceCriterionId: 17 },
  ]);
  assert.equal(orfao.length, 1, "filho cujo pai não está na lista deve continuar contando");
  assert.equal(orfao[0].averageScore, 8);
});

test("Matriz de Conformidade: null = pendente conta como Sim; penalidade = (100 − subtotal) × 0,4", () => {
  assert.equal(calculateConformitySubtotal([true, true, true, true]), 100);
  assert.equal(calculateConformitySubtotal([null, undefined, true, true]), 100);
  assert.equal(calculateConformitySubtotal([false, true, true, true]), 75);
  assert.equal(calculateConformityPenalty(75), 10);
  assert.equal(calculateFinalEventScore(70, 75), 60); // exemplo da especificação
  assert.equal(calculateFinalEventScore(35, 0), 0);   // nota 0 legítima, não negativa
});

test("getCriterionEvaluationStatus: exige TODOS os designados da área; área sem designação aceita qualquer envio", () => {
  const byArea = buildAssignedEvaluatorsByArea([{ areaId: 1, evaluatorUserId: 10 }, { areaId: 1, evaluatorUserId: 11 }]);
  assert.equal(getCriterionEvaluationStatus(1, [10], byArea).isEvaluated, false);
  assert.equal(getCriterionEvaluationStatus(1, [10, 11], byArea).isEvaluated, true);
  assert.equal(getCriterionEvaluationStatus(1, [10, 10, 11], byArea).submittedEvaluators, 2);
  assert.equal(getCriterionEvaluationStatus(2, [99], byArea).isEvaluated, true);
  assert.equal(getCriterionEvaluationStatus(2, [], byArea).isEvaluated, false);
});
