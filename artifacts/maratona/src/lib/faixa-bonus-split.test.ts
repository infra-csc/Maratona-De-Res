import { test } from "node:test";
import assert from "node:assert/strict";
import { faixaBonusSplit } from "./faixa-bonus-split";

type Cyc = { platoon: string | null; official: boolean; bonusValue: number };
const total = (people: Cyc[][]) => ({ rows: people.map(cycles => ({ cycles })) }) as unknown as Parameters<typeof faixaBonusSplit>[0];

test("faixas: separa oficial (ciclo fechado) e projetado (ciclo aberto)", () => {
  const t = total([
    [{ platoon: "Quênia", official: false, bonusValue: 3200 }, { platoon: "Verde", official: true, bonusValue: 2200 }],
    [{ platoon: "Quênia", official: true, bonusValue: 3200 }, { platoon: null, official: true, bonusValue: 0 }],
  ]);
  const s = faixaBonusSplit(t, [{ name: "Quênia", bonusTotal: 6400 }, { name: "Verde", bonusTotal: 2200 }]);
  assert.ok(s);
  assert.deepEqual(s!.get("Quênia"), { official: 3200, projected: 3200 });
  assert.deepEqual(s!.get("Verde"), { official: 2200, projected: 0 });
});

test("faixas: sem dados ou soma que não fecha → null (a tela mostra oficial + projetado juntos)", () => {
  assert.equal(faixaBonusSplit(undefined, []), null);
  const t = total([[{ platoon: "Azul", official: true, bonusValue: 2700 }]]);
  assert.equal(faixaBonusSplit(t, [{ name: "Azul", bonusTotal: 5400 }]), null);
});
