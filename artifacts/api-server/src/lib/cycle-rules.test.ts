import { test } from "node:test";
import assert from "node:assert/strict";
import { isIsoDate, validateCycleFields, nextDay, formatBrDate, type CycleRange } from "./cycle-rules.ts";

const EXISTING: CycleRange[] = [
  { id: 1, name: "Ciclo 1 · 2026", startDate: "2026-01-01", endDate: "2026-06-30" },
  { id: 2, name: "Sem datas", startDate: null, endDate: null },
];

test("isIsoDate aceita só datas reais no formato YYYY-MM-DD", () => {
  assert.equal(isIsoDate("2026-07-01"), true);
  assert.equal(isIsoDate("2024-02-29"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("01/07/2026"), false);
  assert.equal(isIsoDate(""), false);
  assert.equal(isIsoDate(null), false);
});

test("ciclo válido logo após o anterior passa", () => {
  assert.equal(validateCycleFields({ name: "Ciclo 2 · 2026", startDate: "2026-07-01", endDate: "2026-12-31" }, EXISTING), null);
});

test("nome vazio, datas inválidas e início depois do fim são recusados", () => {
  assert.match(validateCycleFields({ name: "  ", startDate: "2026-07-01", endDate: "2026-12-31" }, EXISTING)!, /nome/);
  assert.match(validateCycleFields({ name: "X", startDate: "2026-13-01", endDate: "2026-12-31" }, EXISTING)!, /início inválida/);
  assert.match(validateCycleFields({ name: "X", startDate: "2026-12-31", endDate: "2026-07-01" }, EXISTING)!, /anterior ou igual/);
});

test("nome repetido (ignorando caixa e espaços) é recusado", () => {
  const err = validateCycleFields({ name: "  ciclo 1 · 2026 ", startDate: "2026-07-01", endDate: "2026-12-31" }, EXISTING);
  assert.match(err!, /Já existe um ciclo chamado "Ciclo 1 · 2026"/);
});

test("período sobreposto é recusado; tocar a borda do dia seguinte não", () => {
  const err = validateCycleFields({ name: "Novo", startDate: "2026-06-30", endDate: "2026-12-31" }, EXISTING);
  assert.match(err!, /sobrepõe ao ciclo "Ciclo 1 · 2026" \(01\/01\/2026 a 30\/06\/2026\)/);
  assert.equal(validateCycleFields({ name: "Novo", startDate: "2026-07-01", endDate: "2026-07-01" }, EXISTING), null);
});

test("na edição o próprio ciclo sai da lista e não conflita consigo mesmo", () => {
  const others = EXISTING.filter(c => c.id !== 1);
  assert.equal(validateCycleFields({ name: "Ciclo 1 · 2026", startDate: "2026-01-01", endDate: "2026-06-15" }, others), null);
});

test("nextDay vira mês e ano; formatBrDate não sofre fuso", () => {
  assert.equal(nextDay("2026-06-30"), "2026-07-01");
  assert.equal(nextDay("2026-12-31"), "2027-01-01");
  assert.equal(formatBrDate("2026-08-08"), "08/08/2026");
  assert.equal(formatBrDate(null), "—");
});
