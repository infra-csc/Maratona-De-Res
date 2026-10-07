// Ciclo novo (out–dez/2026): eventos "fora do período", fechamento real do
// ciclo, criação do próximo (eventos + faltas movidos, sem contagem dupla),
// ciclo fechado só consulta (409) com pagamento liberado, Total geral
// ponderado pelos eventos e oficial × projetado, e as travas do avaliador.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";
import { eventPeriodPosition, isAfterCycleEnd } from "../lib/cycle-rules.js";
// cycle-scope e results importam o banco: só depois do harness subir.
const lazy = {
  parseCycleParam: async (raw: unknown) => (await import("../lib/cycle-scope.js")).parseCycleParam(raw),
  recompute: async (cycleId: number, userId: number) => (await import("./results.js")).recomputeCycleResults(cycleId, userId),
};

let h: Awaited<ReturnType<typeof startApi>>;
before(async () => { h = await startApi(); });
after(() => h?.close());

test("eventPeriodPosition: o critério único é a data de INÍCIO do evento", () => {
  const c = { startDate: "2026-06-01", endDate: "2026-09-30" };
  assert.equal(eventPeriodPosition({ startDate: "2026-09-30" }, c), "inside");
  assert.equal(eventPeriodPosition({ startDate: "2026-10-01" }, c), "after");
  assert.equal(eventPeriodPosition({ startDate: "2026-05-31" }, c), "before");
  assert.equal(eventPeriodPosition({ startDate: "2026-10-01" }, { startDate: null, endDate: null }), "inside");
  assert.equal(isAfterCycleEnd({ startDate: "2026-10-04" }, c), true);
  assert.equal(isAfterCycleEnd({ startDate: "2026-05-01" }, c), false);
});

test("cycleId acima do maior inteiro do Postgres é inválido (400), não 500", async () => {
  assert.equal(await lazy.parseCycleParam("2147483648"), null);
  assert.deepEqual(await lazy.parseCycleParam("2147483647"), { kind: "id", id: 2147483647 });
  const r = await h.api("GET", "/events?cycleId=2147483648", { role: "admin" });
  assert.equal(r.status, 400);
  assert.equal((await h.api("GET", "/ranking?cycleId=99999999999", { role: "admin" })).status, 400);
});

test("fluxo real: fora do período não conta; fechar pela rota; criar o próximo leva eventos e faltas; sem contagem dupla", async () => {
  await h.fx.rule("min_events_eligibility", 1);
  const old = await h.fx.cycle({ name: "Período jun-set", startDate: "2031-06-01", endDate: "2031-09-30" });
  const crit = await h.fx.criterion({ name: "Crit período" });
  const aval = await h.ensureUser("avaliador");
  const admin = await h.ensureUser("admin");
  const ana = await h.fx.employee({ name: "Ana Período" });
  const beto = await h.fx.employee({ name: "Beto Período" });

  // Setembro (no período): Ana e Beto, nota 8 → 80.
  const sep = await h.fx.event({ cycleId: old, name: "Setembro período", date: "2031-09-20", criteria: [crit], participants: [ana, beto] });
  await h.fx.evaluation({ eventId: sep, criterionId: crit, evaluatorUserId: aval, score: 8 });
  // Outubro (depois do fim): já avaliado e confirmado, só Ana, nota 6 → 60.
  const oct = await h.fx.event({ cycleId: old, name: "Outubro fora", date: "2031-10-04", status: "open", criteria: [crit], participants: [ana] });
  await h.fx.evaluation({ eventId: oct, criterionId: crit, evaluatorUserId: aval, score: 6 });
  // Falta ligada ao evento de outubro (vai junto) e outra solta (fica).
  const absOct = await h.fx.absence({ employeeId: ana, cycleId: old, userId: admin, points: 5, date: "2031-10-04" });
  await h.sql("update absences set event_id = $1 where id = $2", [oct, absOct]);
  const absSep = await h.fx.absence({ employeeId: beto, cycleId: old, userId: admin, points: 2, date: "2031-09-20" });

  // A lista de Eventos mostra os dois (recorte só pelo ciclo).
  const list = await h.api("GET", `/events?cycleId=${old}`, { role: "admin" });
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.map((e: { id: number }) => e.id).sort(), [sep, oct].sort());

  // Recálculo: outubro e a falta dele não contam no ciclo de jun–set.
  await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} });
  const anaOld = await h.one("select events_count, participated_events_count, total_absences, final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [ana, old]);
  assert.equal(anaOld.events_count, 1);
  assert.equal(anaOld.participated_events_count, 1);
  assert.equal(anaOld.total_absences, 0, "a falta do evento de outubro não conta aqui");
  assert.equal(Number(anaOld.final_result), 80);
  assert.equal((await h.sql("select 1 from employee_event_results where event_id = $1", [oct])).length, 0);

  // Fechar pela rota: o evento de outubro (aberto) não trava o fechamento.
  const close = await h.api("POST", "/results/quarterly/close", { role: "admin", body: {} });
  assert.equal(close.status, 200, JSON.stringify(close.data));
  assert.equal(close.data.forced, false);
  const closedRow = await h.one("select status, min_events from cycles where id = $1", [old]);
  assert.equal(closedRow.status, "closed");
  assert.equal(closedRow.min_events, 1, "o mínimo que valeu fica gravado no ciclo fechado");
  // Fechar de novo: 409 (não reescreve o oficial).
  assert.equal((await h.api("POST", "/results/quarterly/close", { role: "admin", body: {} })).status, 409);
  // Recalcular o atual fechado: 409.
  assert.equal((await h.api("POST", "/results/quarterly/recompute", { role: "admin", body: {} })).status, 409);

  // Pagamento do ciclo fechado continua liberado.
  const qrAna = await h.one("select id from quarterly_results where employee_id = $1 and cycle_id = $2", [ana, old]);
  const pay = await h.api("PATCH", `/results/quarterly/${qrAna.id}/payment`, { role: "admin", body: { bonusStatus: "paid", paidAt: "2031-10-10T12:00:00Z" } });
  assert.equal(pay.status, 200, JSON.stringify(pay.data));

  // Criar o próximo ciclo: outubro e a falta dele mudam; setembro e a falta solta ficam.
  const created = await h.api("POST", "/cycles", { role: "admin", body: { name: "Período out-dez", startDate: "2031-10-01", endDate: "2031-12-31", minEvents: 1 } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const neu = created.data.id as number;
  assert.deepEqual(created.data.movedEvents, [{ id: oct, name: "Outubro fora", outsidePeriod: false }]);
  assert.equal(created.data.movedAbsences, 1);
  assert.equal((await h.one("select cycle_id from events where id = $1", [oct])).cycle_id, neu);
  assert.equal((await h.one("select cycle_id from absences where id = $1", [absOct])).cycle_id, neu);
  assert.equal((await h.one("select cycle_id from absences where id = $1", [absSep])).cycle_id, old);

  // O ciclo novo já calculou (outubro estava confirmado): Ana 60 − 5 = 55.
  const anaNew = await h.one("select events_count, total_absences, final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [ana, neu]);
  assert.equal(anaNew.events_count, 1);
  assert.equal(anaNew.total_absences, 1);
  assert.equal(Number(anaNew.final_result), 55);

  // O antigo não mudou (nem contagem dupla, nem pagamento perdido).
  const anaOldAfter = await h.one("select events_count, final_result, bonus_status from quarterly_results where employee_id = $1 and cycle_id = $2", [ana, old]);
  assert.equal(anaOldAfter.events_count, 1);
  assert.equal(Number(anaOldAfter.final_result), 80);
  assert.equal(anaOldAfter.bonus_status, "paid");
  const rankOld = await h.api("GET", `/ranking?cycleId=${old}`, { role: "admin" });
  assert.equal(rankOld.status, 200);
  assert.deepEqual(rankOld.data.map((r: { employeeId: number }) => r.employeeId).sort(), [ana, beto].sort());
  const detOld = await h.api("GET", `/ranking-detail?employeeId=${ana}&cycleId=${old}`, { role: "admin" });
  assert.equal(detOld.status, 200);
  assert.deepEqual(detOld.data.events.map((e: { eventId: number }) => e.eventId), [sep]);
  assert.equal(detOld.data.summary.finalResult, 80);

  // Total geral: média PONDERADA pelos eventos; bônus oficial × projetado.
  const total = await h.api("GET", "/ranking/total", { role: "admin" });
  assert.equal(total.status, 200);
  const anaTotal = total.data.rows.find((r: { employeeId: number }) => r.employeeId === ana);
  assert.equal(anaTotal.avgFinalResult, 67.5, "(80×1 + 55×1) ÷ 2");
  assert.equal(anaTotal.eventsCount, 2);
  assert.equal(typeof anaTotal.bonusOfficial, "number");
  assert.equal(typeof anaTotal.bonusProjected, "number");
  assert.equal(anaTotal.bonusTotal, Math.round((anaTotal.bonusOfficial + anaTotal.bonusProjected) * 100) / 100);
  assert.equal(anaTotal.cycles.find((c: { cycleId: number }) => c.cycleId === old).official, true);
  assert.equal(anaTotal.cycles.find((c: { cycleId: number }) => c.cycleId === neu).official, false);
  assert.equal(total.data.cycles.find((c: { id: number }) => c.id === old).minEvents, 1);

  // Ciclo fechado só consulta: escritas sobre o evento de setembro → 409.
  const as = { role: "admin" as const };
  for (const [method, url, body] of [
    ["PATCH", `/events/${sep}`, { name: "Mudou" }],
    ["POST", `/events/${sep}/participants`, { employeeId: beto }],
    ["POST", `/events/${sep}/conformity`, { epi: false }],
    ["POST", `/events/${sep}/unconfirm-results`, {}],
    ["POST", "/calibrations", { eventId: sep, criterionId: crit, calibratedScore: 2, calibrationReason: "x" }],
    ["POST", "/evaluations", { eventId: sep, criterionId: crit, score: 2 }],
    ["DELETE", `/absences/${absSep}`, undefined],
  ] as const) {
    const r = await h.api(method, url, { ...as, body });
    assert.equal(r.status, 409, `${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`);
    assert.match(String(r.data.error), /Ciclo fechado/);
  }
  assert.equal((await h.one("select name from events where id = $1", [sep])).name, "Setembro período");
  // Comentário do mural continua liberado.
  assert.equal((await h.api("POST", `/events/${sep}/comments`, { ...as, body: { message: "Consulta" } })).status, 201);

  // Nenhum recálculo automático reescreve o ciclo fechado.
  const skip = await lazy.recompute(old, admin);
  assert.equal(skip.skipped, "closed");
  assert.equal(Number((await h.one("select final_result from quarterly_results where employee_id = $1 and cycle_id = $2", [beto, old])).final_result), 78);
});

test("não existe mais reabrir critérios; confirmar continua funcionando", async () => {
  const cycleId = await h.fx.cycle({ name: "Ciclo critérios" });
  const crit = await h.fx.criterion({ name: "Crit confirmar" });
  const eventId = await h.fx.event({ cycleId, name: "Evento confirmar", status: "open", resultsConfirmed: false, criteria: [crit] });
  const ok = await h.api("POST", `/events/${eventId}/criteria/confirm`, { role: "admin", body: { confirmed: true } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.criteriaConfirmed, true);
  const reopen = await h.api("POST", `/events/${eventId}/criteria/confirm`, { role: "admin", body: { confirmed: false } });
  assert.equal(reopen.status, 409);
  assert.equal(reopen.data.error, "Não é mais possível reabrir os critérios: o evento abre para avaliação sozinho no dia seguinte.");
  assert.equal((await h.one("select criteria_confirmed from events where id = $1", [eventId])).criteria_confirmed, true);
});

test("avaliador: matriz só do evento dele (e só a partir do dia seguinte); critérios só da área dele ou designados", async () => {
  const cycleId = await h.fx.cycle({ name: "Ciclo avaliador" });
  const areaA = (await h.one("insert into areas (name) values ('Área Matriz A') returning id")).id;
  const areaB = (await h.one("insert into areas (name) values ('Área Matriz B') returning id")).id;
  const critA = (await h.one("insert into criteria (name, default_weight, responsible_area_id) values ('Crit A', 1, $1) returning id", [areaA])).id;
  const critB = (await h.one("insert into criteria (name, default_weight, responsible_area_id) values ('Crit B', 1, $1) returning id", [areaB])).id;
  const critB2 = (await h.one("insert into criteria (name, default_weight, responsible_area_id) values ('Crit B2', 1, $1) returning id", [areaB])).id;
  const avalA = (await h.one("insert into users (name, password_hash, role, area_id) values ('Aval A', 'x', 'avaliador', $1) returning id", [areaA])).id;
  const other = (await h.one("insert into users (name, password_hash, role, area_id) values ('Aval outro', 'x', 'avaliador', $1) returning id", [areaB])).id;
  const past = await h.fx.event({ cycleId, name: "Evento passado matriz", date: "2026-08-01", status: "open", resultsConfirmed: false, criteria: [critA, critB, critB2] });
  await h.fx.criterionAssignment({ eventId: past, criterionId: critB, assignedToId: avalA });
  await h.sql("update events set conformity_evaluator_user_id = $1 where id = $2", [other, past]);

  // Critérios: o da área dele (A) e o designado a ele (B); não o B2.
  const crits = await h.api("GET", `/events/${past}/criteria`, { role: "avaliador", userId: avalA });
  assert.equal(crits.status, 200, JSON.stringify(crits.data));
  assert.deepEqual(crits.data.map((c: { criterionId: number }) => c.criterionId).sort(), [critA, critB].sort());

  // Matriz: não é dele → 403; passa a ser dele → 200.
  assert.equal((await h.api("GET", `/events/${past}/conformity`, { role: "avaliador", userId: avalA })).status, 403);
  await h.sql("update events set conformity_evaluator_user_id = $1 where id = $2", [avalA, past]);
  assert.equal((await h.api("GET", `/events/${past}/conformity`, { role: "avaliador", userId: avalA })).status, 200);
  const sent = await h.api("POST", `/events/${past}/conformity`, { role: "avaliador", userId: avalA, body: { epi: true } });
  assert.equal(sent.status, 201, JSON.stringify(sent.data));

  // Evento futuro: a matriz ainda não abre para o avaliador. (O ciclo cobre a
  // data: fora do período o evento seria do PRÓXIMO ciclo → 409 EVENT_NEXT_CYCLE.)
  await h.sql("update cycles set end_date = '2099-12-31' where id = $1", [cycleId]);
  const future = await h.fx.event({ cycleId, name: "Evento futuro matriz", date: "2099-01-10", status: "open", resultsConfirmed: false, criteria: [critA] });
  await h.sql("update events set conformity_evaluator_user_id = $1 where id = $2", [avalA, future]);
  const early = await h.api("POST", `/events/${future}/conformity`, { role: "avaliador", userId: avalA, body: { epi: true } });
  assert.equal(early.status, 409);
  assert.match(early.data.error, /abre para resposta a partir de 11\/01\/2099/);
  // Admin continua podendo.
  assert.equal((await h.api("POST", `/events/${future}/conformity`, { role: "admin", body: { epi: true } })).status, 201);
  await h.sql("update cycles set end_date = '2026-12-31' where id = $1", [cycleId]);
  // Agora fora do período (é do próximo ciclo): nem o admin responde a matriz.
  const next = await h.api("POST", `/events/${future}/conformity`, { role: "admin", body: { epi: false } });
  assert.equal(next.status, 409);
  assert.equal(next.data.code, "EVENT_NEXT_CYCLE");
});

test("ciclo sem Conduta: a resposta enviada é ignorada e Análises tira o item", async () => {
  const cycleId = await h.fx.cycle({ name: "Ciclo sem conduta análises" });
  await h.sql("update cycles set conformity_without_conduta = true where id = $1", [cycleId]);
  const crit = await h.fx.criterion({ name: "Crit sem conduta" });
  const emp = await h.fx.employee({ name: "Colab sem conduta" });
  const eventId = await h.fx.event({ cycleId, name: "Evento sem conduta", criteria: [crit], participants: [emp] });
  const r = await h.api("POST", `/events/${eventId}/conformity`, { role: "admin", body: { epi: true, conduta: false, condutaComment: "não" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const row = await h.one("select conduta, conduta_comment from event_conformities where event_id = $1", [eventId]);
  assert.equal(row.conduta, null);
  assert.equal(row.conduta_comment, null);

  const ov = await h.api("GET", `/analytics/overview?cycleId=${cycleId}`, { role: "admin" });
  assert.equal(ov.status, 200, JSON.stringify(ov.data));
  assert.equal(ov.data.ruleSet.condutaInMatrix, "none");
  assert.equal(ov.data.ruleSet.conformityItemsAsked, 3);
  assert.ok(!ov.data.conformity.some((c: { item: string }) => c.item === "conduta"));
  assert.deepEqual(ov.data.ruleSet.minEventsByCycle.map((m: { cycleId: number }) => m.cycleId), [cycleId]);
});

test("modo por área: uma resposta enviada já conta o critério como avaliado (lista de Eventos e nota)", async () => {
  const area = (await h.one("insert into areas (name) values ('Área modo') returning id")).id;
  const crit = (await h.one("insert into criteria (name, default_weight, responsible_area_id) values ('Crit modo', 1, $1) returning id", [area])).id;
  const a1 = (await h.one("insert into users (name, password_hash, role, area_id) values ('Modo 1', 'x', 'avaliador', $1) returning id", [area])).id;
  const a2 = (await h.one("insert into users (name, password_hash, role, area_id) values ('Modo 2', 'x', 'avaliador', $1) returning id", [area])).id;
  const setup = async (areaEvaluation: boolean, name: string) => {
    const cycleId = await h.fx.cycle({ name });
    await h.sql("update cycles set area_evaluation = $1 where id = $2", [areaEvaluation, cycleId]);
    const eventId = await h.fx.event({ cycleId, name: `Evento ${name}`, status: "open", resultsConfirmed: false, criteria: [crit] });
    for (const u of [a1, a2]) await h.sql("insert into event_area_assignments (event_id, area_id, evaluator_user_id) values ($1, $2, $3)", [eventId, area, u]);
    await h.fx.evaluation({ eventId, criterionId: crit, evaluatorUserId: a1, score: 7 });
    const list = await h.api("GET", `/events?cycleId=${cycleId}`, { role: "admin" });
    return list.data.find((e: { id: number }) => e.id === eventId);
  };
  const areaMode = await setup(true, "Ciclo por área");
  assert.equal(areaMode.evaluatedCriteria, 1, "por área: 1 resposta basta");
  assert.deepEqual(areaMode.unassignedAreaNames, []);
  const oldFlow = await setup(false, "Ciclo por designação");
  assert.equal(oldFlow.evaluatedCriteria, 0, "fluxo antigo: faltam os dois designados");
});
