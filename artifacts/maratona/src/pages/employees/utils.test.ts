// Rodar na raiz do repo:
//   node --import ./scripts/test/register.mjs --test artifacts/maratona/src/pages/employees/utils.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { toTitleCase } from "./utils";

test("toTitleCase: nome próprio, preposições minúsculas, sigla com dígito intacta", () => {
  assert.equal(toTitleCase("ANA PEREIRA DA SILVA"), "Ana Pereira da Silva");
  assert.equal(toTitleCase("Ana Pereira E2E"), "Ana Pereira E2E");
  assert.equal(toTitleCase("joão B2B"), "João B2B");
  assert.equal(toTitleCase("MARIA DOS SANTOS"), "Maria dos Santos");
});
