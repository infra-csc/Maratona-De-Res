import { test } from "node:test";
import assert from "node:assert/strict";
import { funnelSteps, isFunnelMonotonic } from "./bonus-funnel";

test("funil: ordem fixa e rótulos do escopo", () => {
  const api = [
    { stage: "withBonus", label: "x", count: 2 },
    { stage: "participated", label: "x", count: 10 },
    { stage: "eligible", label: "x", count: 3 },
    { stage: "reachedMin", label: "x", count: 5 },
  ];
  const one = funnelSteps(api, { isAll: false, minEvents: 8 });
  assert.deepEqual(one.map(s => s.stage), ["participated", "reachedMin", "eligible", "withBonus"]);
  assert.equal(one[1].label, "Atingiram o mínimo (8 eventos)");
  assert.equal(funnelSteps(api, { isAll: true })[0].label, "Participações nos ciclos");
  assert.equal(isFunnelMonotonic(one), true);
});

test("funil: detecta etapa maior que a anterior", () => {
  const steps = funnelSteps([
    { stage: "participated", label: "", count: 4 },
    { stage: "reachedMin", label: "", count: 1 },
    { stage: "eligible", label: "", count: 2 },
  ], { isAll: true });
  assert.equal(isFunnelMonotonic(steps), false);
});

test("funil: etapa desconhecida vai para o fim com o rótulo da API", () => {
  const steps = funnelSteps([{ stage: "novo", label: "Etapa nova", count: 1 }, { stage: "participated", label: "", count: 3 }], { isAll: false });
  assert.deepEqual(steps.map(s => s.label), ["Participaram do ciclo", "Etapa nova"]);
});
