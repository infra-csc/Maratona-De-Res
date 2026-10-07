// Rodar na raiz do repo:
//   node --import ./scripts/test/register.mjs --test artifacts/maratona/src/lib/utils.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtOpensOn, isLightColor, faixaEdge, apiErrorCode, EVENT_NEXT_CYCLE, plural, evaluationOpensOn } from "./utils";

test("fmtOpensOn: sem ano a menos de 12 meses; com ano (AA) depois", () => {
  assert.equal(fmtOpensOn("2026-10-26", "2026-10-06"), "26/10");
  assert.equal(fmtOpensOn("2027-01-10", "2026-10-06"), "10/01");
  assert.equal(fmtOpensOn("2027-03-26", "2026-03-20"), "26/03/27");
  assert.equal(fmtOpensOn(null, "2026-10-06"), "—");
});

test("evaluationOpensOn: dia seguinte ao fim do evento", () => {
  assert.equal(evaluationOpensOn({ startDate: "2027-03-25", endDate: "2027-03-25" }), "2027-03-26");
  assert.equal(evaluationOpensOn({ startDate: "2026-12-30", endDate: "2026-12-31" }), "2027-01-01");
});

test("isLightColor / faixaEdge: só cores muito claras ganham contorno", () => {
  assert.equal(isLightColor("#f1f5f9"), true);
  assert.equal(isLightColor("#22c55e"), false);
  assert.deepEqual(faixaEdge("#22c55e"), {});
  assert.ok(faixaEdge("#ffffff").boxShadow);
  assert.equal(isLightColor(null), false);
});

test("apiErrorCode: lê o code do corpo (ApiError) ou do erro (ApiRequestError)", () => {
  assert.equal(apiErrorCode({ data: { error: "x", code: EVENT_NEXT_CYCLE } }), EVENT_NEXT_CYCLE);
  assert.equal(apiErrorCode({ code: "CLOSED_CYCLE" }), "CLOSED_CYCLE");
  assert.equal(apiErrorCode(new Error("x")), null);
  assert.equal(apiErrorCode(null), null);
});

test("plural", () => {
  assert.equal(plural(1, "penalidade", "penalidades"), "1 penalidade");
  assert.equal(plural(2, "penalidade", "penalidades"), "2 penalidades");
});
