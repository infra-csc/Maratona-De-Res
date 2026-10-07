// Regras puras da 3ª revisão (06/10/2026): matriz pendente/completa (B3), KPI
// único do Total geral (D4) e "atingiu o mínimo" do funil (ciclo fechado).
import { test } from "node:test";
import assert from "node:assert/strict";
import { conformityProgress } from "./conformity-status.ts";
import { totalGeralSummary } from "./total-geral.ts";
import { reachedMinEvents } from "./analytics.ts";

const empty = { epi: null, estaiamentos: null, conduta: null, standoutResponse: null, absencesResponse: null, absencesReport: null, guardaEquipamentos: null };

test("B3: matriz — Conduta conforme o ciclo; faltas pelo relato (ou 'não houve' antigo); só os lados designados", () => {
  const ceno = { ...empty, epi: true, estaiamentos: false, standoutResponse: false, absencesResponse: true, absencesReport: "Ninguém faltou" };
  assert.deepEqual(
    [conformityProgress(ceno, { cenografia: true, ferramentas: false, withoutConduta: false }).cenoDone,
      conformityProgress(ceno, { cenografia: true, ferramentas: false, withoutConduta: true }).cenoDone],
    [false, true],
  );
  const semRelato = { ...ceno, conduta: true, absencesReport: "  " };
  assert.equal(conformityProgress(semRelato, { cenografia: true, ferramentas: false, withoutConduta: false }).cenoDone, false);
  assert.equal(conformityProgress({ ...semRelato, absencesResponse: false }, { cenografia: true, ferramentas: false, withoutConduta: false }).cenoDone, true);
  const p = conformityProgress({ ...empty, guardaEquipamentos: true }, { cenografia: false, ferramentas: true, withoutConduta: false });
  assert.deepEqual([p.filled, p.total, p.complete, p.ferrDone, p.cenoDone], [1, 1, true, true, false]);
  assert.equal(conformityProgress(null, { cenografia: false, ferramentas: false, withoutConduta: false }).complete, false);
});

test("D4: média do Total geral = Σ(nota × eventos) ÷ Σ eventos (não a média das médias das pessoas)", () => {
  const rows = [
    { employeeId: 1, cycleId: 1, finalResult: 80, eventsCount: 3, eligible: true, bonusValue: 2200 },
    { employeeId: 1, cycleId: 2, finalResult: 90, eventsCount: 1, eligible: false, bonusValue: 0 },
    { employeeId: 2, cycleId: 1, finalResult: 70, eventsCount: 1, eligible: true, bonusValue: 1200 },
    { employeeId: 3, cycleId: 2, finalResult: 0, eventsCount: 0, eligible: false, bonusValue: 0 },
  ];
  const s = totalGeralSummary(rows, id => id === 1);
  // (240 + 90 + 70) ÷ 5 = 80 (a média das médias das pessoas daria (82,5 + 70) ÷ 2 = 76,25).
  assert.equal(s.avgFinalResult, 80);
  assert.equal(s.eventsWithScore, 5);
  assert.equal(s.people, 3);
  assert.equal(s.bonusOfficial, 3400);
  assert.equal(totalGeralSummary([], () => true).avgFinalResult, null);
});

test("Funil: elegível sempre atingiu; ciclo fechado vale a apuração gravada", () => {
  // Elegível com poucas participações (regra de hoje mais alta): atingiu.
  assert.equal(reachedMinEvents({ eligible: true, participatedEventsCount: 2, minEvents: 8, official: true }, 8), true);
  // Recusado pelo mínimo na apuração: não atingiu, mesmo com mais participações hoje.
  assert.equal(reachedMinEvents({ eligible: false, participatedEventsCount: 9, minEvents: 8, official: true, eligibilityReason: "Participou de 2 de 8 eventos exigidos no ciclo" }, 8), false);
  // Inelegível por outro motivo: conta pelas participações gravadas.
  assert.equal(reachedMinEvents({ eligible: false, participatedEventsCount: 9, minEvents: 8, official: true, eligibilityReason: "Inelegível neste ciclo" }, 8), true);
  // Ciclo aberto: a regra do ciclo.
  assert.equal(reachedMinEvents({ eligible: false, participatedEventsCount: 3, minEvents: 8 }, 8), false);
});
