// Rodar na raiz do repo:
//   node --import ./scripts/test/register.mjs --test artifacts/maratona/src/lib/criterion-name.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { displayCriterionName, criterionLabel, isCriterionCopyName } from "./criterion-name";

test("displayCriterionName: tira o sufixo das cópias por área", () => {
  assert.equal(displayCriterionName("Proatividade/Conduta (2)"), "Proatividade/Conduta");
  assert.equal(displayCriterionName("Prazo (12) "), "Prazo");
  assert.equal(displayCriterionName("Qualidade (cópia)"), "Qualidade");
  assert.equal(displayCriterionName("Qualidade (copia)"), "Qualidade");
  assert.equal(displayCriterionName("Logística Reversa"), "Logística Reversa");
  assert.equal(displayCriterionName(null), "");
  // Parênteses no meio do nome ficam.
  assert.equal(displayCriterionName("Carga (saída) do Galpão"), "Carga (saída) do Galpão");
  assert.equal(displayCriterionName("Montagem (Fase 2)"), "Montagem (Fase 2)");
});

test("criterionLabel: nome + área para distinguir cópias", () => {
  assert.equal(criterionLabel("Prazo (2)", "Cenografia"), "Prazo · Cenografia");
  assert.equal(criterionLabel("Prazo", null), "Prazo");
  assert.equal(criterionLabel("Prazo (3)", "  "), "Prazo");
});

test("isCriterionCopyName", () => {
  assert.equal(isCriterionCopyName("Prazo (2)"), true);
  assert.equal(isCriterionCopyName("Prazo"), false);
});
