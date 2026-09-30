// Testes de rota: salvar calibração (erro 500 relatado em 30/09).
// A tela grava o critério e as cópias por área EM PARALELO, e cada gravação
// num evento confirmado recalcula o ciclo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number;

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle();
});
after(() => h?.close());

test("POST /calibrations: evento confirmado, com média original e sem", async () => {
  const c = await h.fx.criterion({ name: "Cal simples" });
  const emp = await h.fx.employee({ name: "Cal Colab" });
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp] });
  for (const body of [
    { eventId, criterionId: c, calibratedScore: 8, calibrationReason: "ok", originalAverageScore: 7.333333 },
    { eventId, criterionId: c, calibratedScore: 9, calibrationReason: "" },
    { eventId, criterionId: c, calibratedScore: 9.5, originalAverageScore: 10 },
  ]) {
    const r = await h.api("POST", "/calibrations", { role: "rh", body });
    assert.equal(r.status, 201, JSON.stringify(r.data));
  }
});

test("POST /calibrations: critério + cópias por área gravados em paralelo (como a tela faz)", async () => {
  const c = await h.fx.criterion({ name: "Cal paralelo" });
  const emp = await h.fx.employee({ name: "Cal Colab 2" });
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp] });
  const areas: number[] = [];
  for (const n of ["Cal A", "Cal B", "Cal C"]) areas.push((await h.one("insert into areas (name, active) values ($1, true) returning id", [n])).id);
  // Evento confirmado trava a estrutura só com avaliações: cria as cópias antes.
  await h.sql("update events set results_confirmed = false where id = $1", [eventId]);
  const put = await h.api("PUT", `/events/${eventId}/criteria/${c}/areas`, { role: "admin", body: { areaIds: areas } });
  assert.equal(put.status, 200, JSON.stringify(put.data));
  await h.sql("update events set results_confirmed = true, status = 'closed' where id = $1", [eventId]);
  const ids = [c, ...(await h.sql("select id from criteria where source_criterion_id = $1", [c])).map(r => r.id as number)];
  assert.equal(ids.length, 4);

  const rs = await Promise.all(ids.map(id => h.api("POST", "/calibrations", { role: "rh", body: { eventId, criterionId: id, calibratedScore: 8, calibrationReason: "paralelo", originalAverageScore: 7.5 } })));
  assert.deepEqual(rs.map(r => r.status), [201, 201, 201, 201], JSON.stringify(rs.map(r => r.data)));
});
