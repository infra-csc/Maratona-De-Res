import { test } from "node:test";
import assert from "node:assert/strict";
import { eventScorePreview } from "./derive.ts";

// Proatividade (peso 3): Produção 9, Cenografia 7, Ativação 8 → média 8.
// Logística Reversa (peso 3): 6. Média ponderada (8×3 + 6×3) / 6 = 7 → 70.
const members: Record<number, { criterionId: number; avg: number | null }[]> = {
  42: [{ criterionId: 42, avg: 9 }, { criterionId: 45, avg: 7 }, { criterionId: 49, avg: 8 }],
  19: [{ criterionId: 19, avg: 6 }],
};
const base = {
  criteria: [{ criterionId: 42, originalWeight: 3 }, { criterionId: 19, originalWeight: 3 }],
  getMembers: (id: number) => members[id] ?? [],
};

test("nota do evento na Calibração: média das áreas por critério, ponderada pelos pesos (0–100)", () => {
  const r = eventScorePreview({ ...base, calibrationOf: () => null, pendingScore: () => null });
  assert.deepEqual(r, { average: 70, calibrated: null, hasCalibration: false });
});

test("com calibração salva (nas áreas) ou digitada: vale no lugar da nota", () => {
  // Calibração 5 salva em Logística Reversa; Proatividade sem calibração (média 8).
  const saved = eventScorePreview({ ...base, calibrationOf: id => (id === 19 ? 5 : null), pendingScore: () => null });
  assert.equal(saved.calibrated, 65);
  // Digitada 10 em Proatividade (ainda não salva) vale para todas as áreas dele.
  const typed = eventScorePreview({ ...base, calibrationOf: () => null, pendingScore: id => (id === 42 ? 10 : null) });
  assert.equal(typed.calibrated, 80);
  assert.equal(typed.average, 70);
});
