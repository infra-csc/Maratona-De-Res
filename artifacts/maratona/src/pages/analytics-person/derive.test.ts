// Contas da análise por colaborador, conferidas contra as regras do servidor
// (api-server/src/lib/calculations.ts e cycle-compute.ts).
// Rodar na raiz do repo:
//   node --import ./scripts/test/register.mjs --test artifacts/maratona/src/pages/analytics-person/derive.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { QuarterlyResult } from "@workspace/api-client-react";
import {
  bonusOf, entryScoreOf, faixaOf, finalOf, impactOf, nextFaixaOf, nextStepOf, rankOf, type Faixa,
} from "./derive";

const faixa = (name: string, minScore: number, maxScore: number, bonusValue: number, bonusPerExtraEvent: number, minInclusive = true, maxInclusive = true): Faixa =>
  ({ name, color: "#888888", minScore, maxScore, minInclusive, maxInclusive, bonusValue, bonusPerExtraEvent });

/** Faixas fechadas nas duas pontas, como no cadastro padrão. */
const FECHADAS: Faixa[] = [
  faixa("Base", 0, 69.99, 0, 0),
  faixa("Prata", 70, 79.99, 1200, 200),
  faixa("Ouro", 80, 100, 2000, 300),
];

/** Mesmas notas, mas com limites exclusivos: Prata é "acima de 70 até 80 (exclusive)". */
const EXCLUSIVAS: Faixa[] = [
  faixa("Base", 0, 70, 0, 0, true, true),
  faixa("Prata", 70, 80, 1200, 200, false, false),
  faixa("Ouro", 80, 100, 2000, 300, true, true),
];

test("finalOf: arredonda UMA vez para 1 casa a partir da média real", () => {
  assert.equal(finalOf(1049.22, 15, 0, 0), 69.9); // 69,948 → 69,9 (sem bônus)
  assert.equal(finalOf(139.9, 2, 0, 0), 70); // 69,95 → 70,0 (ruído do ponto flutuante coberto)
  assert.equal(finalOf(373.85, 5, 2, 3), 75); // (373,85 − 2 + 3) ÷ 5 = 74,97 → 75,0
});

test("finalOf: trava em 0 e 100; sem evento com nota → null", () => {
  assert.equal(finalOf(50, 1, 80, 0), 0);
  assert.equal(finalOf(98, 1, 0, 10), 100);
  assert.equal(finalOf(0, 0, 0, 0), null);
  assert.equal(finalOf(300, 0, 5, 0), null);
});

test("faixaOf: limites inclusivos", () => {
  assert.equal(faixaOf(69.99, FECHADAS)?.name, "Base");
  assert.equal(faixaOf(70, FECHADAS)?.name, "Prata");
  assert.equal(faixaOf(79.99, FECHADAS)?.name, "Prata");
  assert.equal(faixaOf(80, FECHADAS)?.name, "Ouro");
  assert.equal(faixaOf(100, FECHADAS)?.name, "Ouro");
  assert.equal(faixaOf(null, FECHADAS), null);
});

test("faixaOf: compara com 2 casas (79,995 → 80,00)", () => {
  assert.equal(faixaOf(79.995, FECHADAS)?.name, "Ouro");
  assert.equal(faixaOf(79.994, FECHADAS)?.name, "Prata");
});

test("faixaOf: limites exclusivos", () => {
  assert.equal(faixaOf(70, EXCLUSIVAS)?.name, "Base"); // 70 não entra em Prata (mín. exclusivo)
  assert.equal(faixaOf(70.1, EXCLUSIVAS)?.name, "Prata");
  assert.equal(faixaOf(79.9, EXCLUSIVAS)?.name, "Prata");
  assert.equal(faixaOf(80, EXCLUSIVAS)?.name, "Ouro"); // máx. exclusivo de Prata, mín. inclusivo de Ouro
});

test("bonusOf: base + extras × valor da MESMA faixa; faixa sem bônus zera tudo", () => {
  assert.equal(bonusOf(72, 3, FECHADAS), 1200 + 3 * 200);
  assert.equal(bonusOf(85, 0, FECHADAS), 2000);
  assert.equal(bonusOf(85, 2, FECHADAS), 2000 + 2 * 300);
  assert.equal(bonusOf(65, 5, FECHADAS), 0);
  assert.equal(bonusOf(null, 2, FECHADAS), 0);
  assert.equal(bonusOf(70, 1, EXCLUSIVAS), 0); // 70 exato fica na Base quando Prata é exclusiva
});

test("impactOf: conta confere com o servidor → compara com e sem penalidades", () => {
  // Soma 360 em 5 eventos (72,0); −15 de penalidade → 69,0 (perde a Prata).
  const i = impactOf({ scoreSum: 360, n: 5, penalty: 15, merit: 0, reportedFinal: 69, eligible: true, extras: 2, reportedBonus: 0, faixas: FECHADAS });
  assert.equal(i.verified, true);
  assert.equal(i.final, 69);
  assert.equal(i.finalNoPenalty, 72);
  assert.equal(i.lostPoints, 3);
  assert.equal(i.faixa?.name, "Base");
  assert.equal(i.faixaNoPenalty?.name, "Prata");
  assert.deepEqual(i.bonus, { eligible: true, extras: 2, now: 0, noPenalty: 1600, clean: 1600, lost: 1600 });
});

test("impactOf: conta não confere → não inventa comparação nem bônus", () => {
  const i = impactOf({ scoreSum: 360, n: 5, penalty: 15, merit: 0, reportedFinal: 70.5, eligible: true, extras: 2, reportedBonus: 0, faixas: FECHADAS });
  assert.equal(i.verified, false);
  assert.equal(i.bonus, null);
});

test("impactOf: bônus gravado diferente da conta de hoje → bônus null", () => {
  const i = impactOf({ scoreSum: 360, n: 5, penalty: 0, merit: 0, reportedFinal: 72, eligible: true, extras: 0, reportedBonus: 999, faixas: FECHADAS });
  assert.equal(i.verified, true);
  assert.equal(i.bonus, null);
});

test("impactOf: inelegível → R$ 0 com ou sem penalidades", () => {
  const i = impactOf({ scoreSum: 360, n: 5, penalty: 15, merit: 0, reportedFinal: 69, eligible: false, extras: 0, reportedBonus: 0, faixas: FECHADAS });
  assert.equal(i.verified, true);
  assert.deepEqual(i.bonus, { eligible: false, extras: 0, now: 0, noPenalty: 0, clean: 0, lost: 0 });
});

test("impactOf: sem evento com nota → nada verificado, nada calculado", () => {
  const i = impactOf({ scoreSum: null, n: 0, penalty: 5, merit: 0, reportedFinal: 0, eligible: false, extras: 0, reportedBonus: 0, faixas: FECHADAS });
  assert.equal(i.verified, false);
  assert.equal(i.final, null);
  assert.equal(i.lostPoints, 0);
  assert.equal(i.bonus, null);
});

const row = (employeeId: number, finalResult: number): QuarterlyResult =>
  ({ employeeId, employeeName: `P${employeeId}`, finalResult, platoon: null, bonusValue: 0 });

test("rankOf: empate divide a posição", () => {
  const rows = [row(1, 80), row(2, 75), row(3, 75), row(4, 70)];
  assert.deepEqual(rankOf(rows, 1), { position: 1, total: 4 });
  assert.deepEqual(rankOf(rows, 2), { position: 2, total: 4 });
  assert.deepEqual(rankOf(rows, 3), { position: 2, total: 4 });
  assert.deepEqual(rankOf(rows, 4), { position: 4, total: 4 });
  assert.equal(rankOf(rows, 99), null);
});

test("entryScoreOf: menor nota (1 casa) que entra na faixa", () => {
  assert.equal(entryScoreOf(faixa("X", 70, 80, 0, 0, true)), 70);
  assert.equal(entryScoreOf(faixa("X", 70, 80, 0, 0, false)), 70.1);
  assert.equal(entryScoreOf(faixa("X", 69.95, 80, 0, 0, true)), 70);
  assert.equal(entryScoreOf(faixa("X", 69.95, 80, 0, 0, false)), 70);
});

test("próxima faixa: limite inclusivo", () => {
  assert.equal(nextFaixaOf(69.9, FECHADAS)?.name, "Prata");
  const s = nextStepOf(69.9, FECHADAS, true, 2)!;
  assert.equal(s.faixa.name, "Prata");
  assert.equal(s.entry, 70);
  assert.equal(s.gap, 0.1);
  assert.equal(s.bonus, 1200 + 2 * 200);
  assert.equal(nextStepOf(85, FECHADAS, true, 0), null); // já está na mais alta
});

test("próxima faixa: limite exclusivo usa a nota de entrada (70,1) no gap e no bônus", () => {
  // Com 70,0 ele está na Base (Prata começa ACIMA de 70).
  const s = nextStepOf(70, EXCLUSIVAS, true, 1)!;
  assert.equal(s.faixa.name, "Prata");
  assert.equal(s.entry, 70.1);
  assert.equal(s.gap, 0.1);
  assert.equal(s.bonus, 1200 + 200); // com minScore (70) daria R$ 0
  const t = nextStepOf(69.5, EXCLUSIVAS, true, 0)!;
  assert.equal(t.gap, 0.6);
});

test("próxima faixa: inelegível mostra o prêmio base da faixa", () => {
  const s = nextStepOf(75, FECHADAS, false, 3)!;
  assert.equal(s.faixa.name, "Ouro");
  assert.equal(s.gap, 5);
  assert.equal(s.bonus, 2000);
});
