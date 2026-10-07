// Regras únicas de Eventos × Central de Avaliações (rodada 5 da revisão).
import { test } from "node:test";
import assert from "node:assert/strict";
import { areaResponseCounts, completedCriteriaCount, isCriterionComplete, queueTabFor } from "./criteria-rules";

test("critério completo: enviado ou publicado; calibração só salva não conta", () => {
  assert.equal(isCriterionComplete({ submitted: true, published: false }), true);
  assert.equal(isCriterionComplete({ submitted: false, published: true }), true);
  assert.equal(isCriterionComplete({ submitted: false, published: false }), false);
});

test("Eventos conta igual à Central: calibração salva sem publicar não vira 2/2", () => {
  // "Meia Maratona Auditoria": 2 critérios calibrados (rascunho), nada enviado nem publicado.
  assert.equal(completedCriteriaCount({ totalCriteria: 2, evaluatedCriteria: 0, partialPublishedCount: 0, finalCalibratedCriteria: 0 }), 0);
  assert.equal(completedCriteriaCount({ totalCriteria: 2, evaluatedCriteria: 1, partialPublishedCount: 2, finalCalibratedCriteria: 1 }), 2);
  // Nunca passa do total.
  assert.equal(completedCriteriaCount({ totalCriteria: 2, evaluatedCriteria: 3, partialPublishedCount: 0, finalCalibratedCriteria: 0 }), 2);
});

const base = { isOpen: false, isDone: false, nextCycle: false, notOpenYet: false, status: "open", isHistorical: false, total: 2, finalCalibratedCriteria: 0 };

test("aba da Central: A fazer = aberto e não concluído", () => {
  assert.equal(queueTabFor({ ...base, isOpen: true }), "todo");
  assert.equal(queueTabFor({ ...base, isOpen: true, isDone: true }), "done");
});

test("aba da Central: fechado, histórico e Pub. Final vão para Concluídos", () => {
  assert.equal(queueTabFor({ ...base, status: "closed" }), "done");
  assert.equal(queueTabFor({ ...base, isHistorical: true }), "done");
  assert.equal(queueTabFor({ ...base, isOpen: true, finalCalibratedCriteria: 2 }), "done");
});

test("aba da Central: não terminou ou próximo ciclo = A abrir", () => {
  assert.equal(queueTabFor({ ...base, notOpenYet: true }), "waiting");
  assert.equal(queueTabFor({ ...base, nextCycle: true }), "waiting");
});

test("areaResponseCounts: cada critério ativo (com as cópias por área) é uma resposta", () => {
  const criteria = [
    { criterionId: 1, active: true },
    { criterionId: 2, active: true },
    { criterionId: 3, active: true, partialPublishedAt: "2026-10-07" },
    { criterionId: 4, active: false },
  ];
  const evals = [
    { criterionId: 1, status: "submitted" },
    { criterionId: 2, status: "draft" },
    { criterionId: 4, status: "submitted" },
  ];
  assert.deepEqual(areaResponseCounts(criteria, evals), { done: 2, total: 3 });
  assert.deepEqual(areaResponseCounts([], []), { done: 0, total: 0 });
});
