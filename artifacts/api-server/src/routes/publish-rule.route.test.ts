// Regra do dono (01/10/2026): para o COLABORADOR, as notas só mudam quando o
// calibrador PUBLICA (parcial ou final). Salvar a calibração não atualiza
// Meu Desempenho nem a nota oficial do ciclo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;

before(async () => { h = await startApi(); });
after(() => h?.close());

test("salvar calibração não muda o colaborador; publicar muda; recalibrar sem publicar não muda", async () => {
  const cycleId = await h.fx.cycle();
  const c = await h.fx.criterion({ name: "Crit publicação" });
  const emp = await h.fx.employee({ name: "Colab publicação" });
  const aval = await h.ensureUser("avaliador");
  const eventId = await h.fx.event({ cycleId, criteria: [c], participants: [emp], name: "Evento publicação" });
  await h.fx.evaluation({ eventId, criterionId: c, evaluatorUserId: aval, score: 6 });
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });

  const finalOf = async () => Number((await h.one("select final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [emp, cycleId])).final_result);
  const myScore = async () => {
    const r = await h.api("GET", "/my-performance", { role: "visualizador", employeeId: emp });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const ev = r.data.events.find((e: { eventId: number }) => e.eventId === eventId);
    return ev.criteriaDetails.find((d: { criterionId: number }) => d.criterionId === c)?.scoreUsed ?? null;
  };
  assert.equal(await finalOf(), 60);

  // 1. Salvar a calibração: nada muda para o colaborador.
  let r = await h.api("POST", "/calibrations", { role: "rh", body: { eventId, criterionId: c, calibratedScore: 9, calibrationReason: "ajuste" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(await finalOf(), 60);
  assert.equal(await myScore(), null);

  // 2. Publicar (parcial): agora muda.
  r = await h.api("POST", `/events/${eventId}/criteria/${c}/publish-partial`, { role: "rh" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(await finalOf(), 90);
  assert.equal(await myScore(), 9);

  // 3. Recalibrar sem publicar: o colaborador continua vendo 9 e a nota oficial 90.
  await h.api("POST", "/calibrations", { role: "rh", body: { eventId, criterionId: c, calibratedScore: 7 } });
  assert.equal(await finalOf(), 90);
  assert.equal(await myScore(), 9);

  // 4. Publicar de novo (final): passa a 7.
  r = await h.api("POST", `/events/${eventId}/criteria/${c}/publish-final`, { role: "rh" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(await finalOf(), 70);
  assert.equal(await myScore(), 7);
});
