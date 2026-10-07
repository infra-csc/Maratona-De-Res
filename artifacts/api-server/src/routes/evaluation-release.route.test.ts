// Avaliação abre SOZINHA no dia seguinte ao evento (regra do dono, 05/10/2026):
// sem depender do "Confirmar critérios" do RH, e nunca antes do dia seguinte.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";
import { evaluationOpensOn, isOpenForEvaluation, todayBR } from "../lib/evaluation-dates.js";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number, area: number, avaliador: number;
before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle({ name: "Ciclo liberação", startDate: "2020-01-01", endDate: "2099-12-31" });
  // Avaliação por área: o avaliador da área responde sem designação.
  await h.sql("update cycles set area_evaluation = true where id = $1", [cycleId]);
  area = (await h.one("insert into areas (name, active) values ('Área liberação', true) returning id")).id;
  avaliador = (await h.one("insert into users (name, password_hash, role, area_id) values ('Avaliador liberação', 'x', 'avaliador', $1) returning id", [area])).id;
});
after(() => h?.close());

const dayOffset = (n: number) => { const d = new Date(`${todayBR()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const as = { role: "avaliador", userId: 0 };

async function eventOn(date: string, name: string, confirmed = false) {
  const c = await h.fx.criterion({ name: `Crit ${name}` });
  await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, c]);
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria: [c], name, date });
  await h.sql("update events set criteria_confirmed = $2 where id = $1", [eventId, confirmed]);
  return { eventId, c };
}

test("regras de data: abre no dia seguinte ao fim do evento (Brasília)", () => {
  assert.equal(evaluationOpensOn({ startDate: "2026-10-03", endDate: "2026-10-04" }), "2026-10-05");
  assert.equal(evaluationOpensOn({ startDate: "2026-12-31", endDate: null }), "2027-01-01");
  // 05/10 às 02:00 UTC ainda é 04/10 em Brasília → não abriu.
  assert.equal(isOpenForEvaluation({ endDate: "2026-10-04" }, new Date("2026-10-05T02:00:00Z")), false);
  assert.equal(isOpenForEvaluation({ endDate: "2026-10-04" }, new Date("2026-10-05T03:00:00Z")), true);
});

test("evento de ontem, sem o clique do RH: aparece e pode ser avaliado (libera sozinho)", async () => {
  const { eventId, c } = await eventOn(dayOffset(-1), "Evento de ontem");
  as.userId = avaliador;
  const list = await h.api("GET", "/evaluations/my-area?status=all", as);
  assert.equal(list.status, 200, JSON.stringify(list.data));
  assert.ok(list.data.events.some((e: { eventId?: number; id?: number }) => (e.eventId ?? e.id) === eventId), "evento de ontem aparece");
  const ev = await h.one("select criteria_confirmed from events where id = $1", [eventId]);
  assert.equal(ev.criteria_confirmed, true, "liberado sozinho (mesma confirmação do RH)");
  const r = await h.api("POST", "/evaluations", { ...as, body: { eventId, criterionId: c, score: 8, comments: "ok" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
});

test("evento de hoje (ou futuro): não aparece e não aceita nota, mesmo se o RH confirmou antes", async () => {
  as.userId = avaliador;
  const today = await eventOn(dayOffset(0), "Evento de hoje", true);
  const list = await h.api("GET", "/evaluations/my-area?status=all", as);
  assert.ok(!list.data.events.some((e: { eventId?: number; id?: number }) => (e.eventId ?? e.id) === today.eventId), "evento de hoje não aparece");
  const r = await h.api("POST", "/evaluations", { ...as, body: { eventId: today.eventId, criterionId: today.c, score: 8, comments: "cedo" } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /abre a partir de/);
  // Não confirmado e no futuro: continua aguardando.
  const future = await eventOn(dayOffset(3), "Evento futuro");
  await h.api("GET", "/evaluations/my-area", as);
  assert.equal((await h.one("select criteria_confirmed from events where id = $1", [future.eventId])).criteria_confirmed, false);
});
