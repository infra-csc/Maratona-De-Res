// Regressões da 3ª rodada de revisão do BACKEND (06/10/2026). Um teste por
// achado/decisão: D1 (evento do próximo ciclo), D2 (só a área responde no modo
// por área), D3 (avaliação por área não troca com resposta enviada), D4/M4
// (KPI único do Total geral; recorte de um ciclo), A1 (avaliador não vê além
// da área), A2 (sincronização × ciclo fechado), M2 (backfill da 0011), M5
// (importação histórica × ciclo fechado), B1, B2, B3, B5, funil de Análises e
// a regra única de "aberto para avaliação".
// A ordem importa: o último teste (D1 — mudança de ciclo) fecha o ciclo atual.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let ext: http.Server;
let extData: { employees: unknown[]; events: unknown[]; participations: unknown[] } = { employees: [], events: [], participations: [] };

let fechado: number, atual: number;
let areaA: number, areaB: number, areaC: number;
let ana: number, bia: number, beto: number, semArea: number, ceno1: number, ceno2: number, ferr1: number, ferr2: number;
let critA: number, critB: number;
let evIn: number, evNext: number, evFechado: number;
let empCasa: number, empX: number, empFreela: number;

async function user(name: string, role: string, areaId: number | null) {
  return (await h.one("insert into users (name, password_hash, role, area_id) values ($1, 'x', $2, $3) returning id", [name, role, areaId])).id as number;
}
const as = (userId: number, role = "avaliador") => ({ role, userId });

async function criterionIn(area: number | null, name: string, allowPublicLink: boolean | null = null) {
  const id = await h.fx.criterion({ name, allowPublicLink });
  if (area != null) await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

async function openEvent(cycleId: number, criteria: number[], name: string, date: string, participants: number[] = [], confirmed = true) {
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria, name, date, participants });
  if (confirmed) await h.sql("update events set criteria_confirmed = true where id = $1", [eventId]);
  return eventId;
}

async function token(eventId: number, createdBy: number, type = "criteria", criteria: number[] = []) {
  const id = `r3-${Math.random().toString(36).slice(2, 10)}`;
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ($1, $2, $3, 'Freela', $4)", [id, eventId, createdBy, type]);
  for (const c of criteria) await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ($1, $2)", [id, c]);
  return id;
}

const NEXT_MSG = "Este evento é do próximo ciclo: abre para avaliação quando o ciclo novo for criado.";
const MIGRATION_0011 = fs.readFileSync(new URL("../../../../lib/db/migrations/0011_review_round2.sql", import.meta.url), "utf8");
const BACKFILL_0011 = MIGRATION_0011.split("--> statement-breakpoint").map(x => x.trim()).find(x => x.includes("UPDATE \"evaluations\""))!;

before(async () => {
  // API externa falsa da sincronização (A2): o módulo lê a URL no import.
  ext = http.createServer((req, res) => {
    const key = (req.url ?? "").replace("/api/integration/", "") as keyof typeof extData;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(extData[key] ?? []));
  });
  await new Promise<void>(resolve => ext.listen(0, "127.0.0.1", () => resolve()));
  process.env.EXTERNAL_API_URL = `http://127.0.0.1:${(ext.address() as { port: number }).port}`;
  process.env.EXTERNAL_API_TOKEN = "token-de-teste";

  h = await startApi();
  await h.fx.platoonRules2026();
  const mkArea = async (name: string, id?: number) => (id != null
    ? await h.one("insert into areas (id, name, active) values ($1, $2, true) returning id", [id, name])
    : await h.one("insert into areas (name, active) values ($1, true) returning id", [name])).id as number;
  await mkArea("Cenografia (R3)", 13);
  await mkArea("Ferramentas e Case (R3)", 16);
  await h.sql("select setval('areas_id_seq', 100)");
  areaA = await mkArea("Área A (R3)");
  areaB = await mkArea("Área B (R3)");
  areaC = await mkArea("Área C (R3)");
  ana = await user("Ana R3", "avaliador", areaA);
  bia = await user("Bia R3", "avaliador", areaA);
  beto = await user("Beto R3", "avaliador", areaB);
  semArea = await user("Sérgio R3", "avaliador", null);
  ceno1 = await user("Ceno Um R3", "avaliador", 13);
  ceno2 = await user("Ceno Dois R3", "avaliador", 13);
  ferr1 = await user("Ferr Um R3", "avaliador", 16);
  ferr2 = await user("Ferr Dois R3", "avaliador", 16);

  empCasa = await h.fx.employee({ name: "Casa R3" });
  empX = await h.fx.employee({ name: "Recusado mínimo R3" });
  empFreela = await h.fx.employee({ name: "Freela R3", employmentType: "freela" });

  fechado = await h.fx.cycle({ name: "Fechado R3", startDate: "2026-01-01", endDate: "2026-03-31", status: "closed", isCurrent: false });
  atual = await h.fx.cycle({ name: "Atual R3", startDate: "2026-04-01", endDate: "2026-09-30" });

  critA = await criterionIn(areaA, "Crit A R3", true);
  critB = await criterionIn(areaB, "Crit B R3", true);
  evFechado = await h.fx.event({ cycleId: fechado, date: "2026-02-01", status: "closed", resultsConfirmed: true, criteria: [critA], participants: [empCasa, empX], name: "Evento fechado R3" });
  evIn = await openEvent(atual, [critA, critB], "Evento dentro R3", "2026-09-20", [empCasa, empFreela]);
  // Começa DEPOIS do fim do ciclo atual (30/09): é do próximo ciclo.
  evNext = await openEvent(atual, [critA], "Evento próximo ciclo R3", "2026-10-01", [], false);
});
after(async () => {
  await h?.close();
  await new Promise(resolve => ext?.close(resolve));
});

// ── D1 ──────────────────────────────────────────────────────────────────────
test("D1: evento do próximo ciclo não libera sozinho e não aceita avaliação, matriz nem link (409 EVENT_NEXT_CYCLE); preparação livre", async () => {
  const { autoReleaseDueEvents } = await import("../lib/evaluation-release.js");
  const evDue = await openEvent(atual, [critA], "Evento libera R3", "2026-09-21", [], false);
  assert.deepEqual(await autoReleaseDueEvents({ eventIds: [evNext, evDue] }), [evDue]);
  assert.equal((await h.one("select criteria_confirmed from events where id = $1", [evNext])).criteria_confirmed, false, "não liberado sozinho");

  // Mesmo confirmado à mão e com designado, não aparece na tela do avaliador.
  await h.sql("update events set criteria_confirmed = true, conformity_evaluator_user_id = $2 where id = $1", [evNext, ana]);
  await h.fx.criterionAssignment({ eventId: evNext, criterionId: critA, assignedToId: ana });
  assert.equal((await h.api("GET", `/evaluations/my-area?eventId=${evNext}`, as(ana))).data.events.length, 0);
  assert.ok(!(await h.api("GET", "/evaluations/my-area", as(ana))).data.events.some((e: { id: number }) => e.id === evNext));
  assert.ok(!(await h.api("GET", `/evaluations/my-area?areaId=${areaA}`, { role: "admin" })).data.events.some((e: { id: number }) => e.id === evNext));

  const expect409 = async (method: string, url: string, opts: Record<string, unknown>) => {
    const r = await h.api(method, url, opts);
    assert.equal(r.status, 409, `${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`);
    assert.equal(r.data.code, "EVENT_NEXT_CYCLE");
    assert.equal(r.data.error, NEXT_MSG);
    assert.equal(r.data.nextCycle, true);
  };
  await expect409("POST", "/evaluations", { role: "admin", body: { eventId: evNext, criterionId: critA, score: 8, comments: "x" } });
  await expect409("POST", "/evaluations", { ...as(ana), body: { eventId: evNext, criterionId: critA, score: 8, comments: "x" } });
  const rascunho = await h.fx.evaluation({ eventId: evNext, criterionId: critA, evaluatorUserId: ana, score: 7, status: "draft" });
  await h.sql("update evaluations set comments = 'ok' where id = $1", [rascunho]);
  await expect409("PATCH", `/evaluations/${rascunho}`, { ...as(ana), body: { score: 9 } });
  await expect409("POST", `/evaluations/${rascunho}/submit`, as(ana));
  await expect409("POST", `/events/${evNext}/conformity`, { role: "admin", body: { epi: true } });
  await expect409("POST", `/events/${evNext}/conformity`, { ...as(ana), body: { epi: true } });
  await expect409("POST", `/events/${evNext}/public-token`, { ...as(ana), body: { recipientName: "Freela" } });
  await expect409("POST", `/events/${evNext}/public-token/conformity`, { ...as(ana), body: { recipientName: "Freela" } });
  await expect409("POST", `/events/${evNext}/public-token/conformity-ferramentas`, { role: "admin", body: { recipientName: "Freela" } });
  await expect409("POST", `/events/${evNext}/admin-public-token`, { role: "admin", body: { assignedToUserId: ana, criterionIds: [critA] } });
  // Apagar o rascunho é limpeza: continua liberado.
  assert.equal((await h.api("DELETE", `/evaluations/${rascunho}`, as(ana))).status, 200);
  assert.equal((await h.sql("select id from evaluations where event_id = $1", [evNext])).length, 0);

  // Link público: GET avisa; envio recusado sem queimar o link.
  const t = await token(evNext, ana, "criteria", [critA]);
  const info = await h.api("GET", `/public-eval/${t}`);
  assert.equal(info.status, 200);
  assert.equal(info.data.nextCycle, true);
  await expect409("POST", `/public-eval/${t}/submit`, { body: { submitterName: "Freela", evaluations: [{ criterionId: critA, score: 8, comments: "ok" }] } });
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [t])).used_at, null);
  const tc = await token(evNext, ana, "conformity_cenografia");
  await expect409("POST", `/public-eval/${tc}/submit-conformity`, { body: { submitterName: "Freela", epi: true, estaiamentos: true, conduta: true } });
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [tc])).used_at, null);
  assert.equal((await h.api("GET", `/public-eval/${await token(evIn, ana, "criteria", [critA])}`)).data.nextCycle, false);

  // Preparação: dados, equipe e critérios continuam editáveis.
  assert.equal((await h.api("PATCH", `/events/${evNext}`, { role: "admin", body: { name: "Evento próximo ciclo R3" } })).status, 200);
  const part = await h.api("POST", `/events/${evNext}/participants`, { role: "admin", body: { employeeId: empCasa } });
  assert.ok([200, 201].includes(part.status), JSON.stringify(part.data));
  assert.equal((await h.api("PATCH", `/events/${evNext}/conformity-evaluator`, { role: "admin", body: { userId: ceno1 } })).status, 200);
});

// ── "Aberto" e contagem de eventos ─────────────────────────────────────────
test("my-area?eventId= de evento do avaliador que ainda não abriu diz quando abre (próximo ciclo); de outra área, nada", async () => {
  const evSoon = await openEvent(atual, [critA], "Evento abre depois R3", "2026-10-02", [], false);
  const mine = (await h.api("GET", `/evaluations/my-area?eventId=${evSoon}`, as(ana))).data;
  assert.equal(mine.events.length, 0);
  assert.deepEqual(mine.unavailable, { eventId: evSoon, eventName: "Evento abre depois R3", startDate: "2026-10-02", endDate: "2026-10-02", nextCycle: true });
  const other = (await h.api("GET", `/evaluations/my-area?eventId=${evSoon}`, as(beto))).data;
  assert.equal(other.events.length, 0);
  assert.equal(other.unavailable, undefined, "evento de outra área não revela nome nem datas");
  assert.equal((await h.api("GET", `/evaluations/my-area?eventId=${evSoon}`, as(semArea))).data.unavailable, undefined);
});

test("Regra única de 'aberto': GET /events (periodPosition/nextCycle/openForEvaluation) = stats.eventsOpen = Dashboard", async () => {
  const list = (await h.api("GET", `/events?cycleId=${atual}`, { role: "admin" })).data as { id: number; periodPosition: string; nextCycle: boolean; openForEvaluation: boolean }[];
  const byId = new Map(list.map(e => [e.id, e]));
  assert.equal(byId.get(evNext)!.periodPosition, "after");
  assert.equal(byId.get(evNext)!.nextCycle, true);
  assert.equal(byId.get(evNext)!.openForEvaluation, false);
  assert.equal(byId.get(evIn)!.periodPosition, "inside");
  assert.equal(byId.get(evIn)!.openForEvaluation, true);
  const futuro = await openEvent(atual, [critA], "Evento futuro R3", "2026-09-29");
  await h.sql("update events set start_date = '2026-09-30', end_date = '2099-01-01' where id = $1", [futuro]);

  const list2 = (await h.api("GET", `/events?cycleId=${atual}`, { role: "admin" })).data as typeof list;
  assert.equal(list2.find(e => e.id === futuro)!.openForEvaluation, false, "ainda não terminou");
  const stats = ((await h.api("GET", "/cycles", { role: "admin" })).data as { id: number; stats: { eventsTotal: number; eventsAfterEnd: number; eventsStored: number; eventsOpen: number } }[]).find(c => c.id === atual)!.stats;
  assert.equal(stats.eventsStored, list2.length);
  assert.equal(stats.eventsAfterEnd, list2.filter(e => e.nextCycle).length);
  assert.equal(stats.eventsTotal, list2.filter(e => !e.nextCycle).length);
  assert.equal(stats.eventsOpen, list2.filter(e => e.openForEvaluation).length);

  const dash = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
  assert.equal(dash.eventsInCycle, stats.eventsTotal, "X de Y no ciclo: Y = eventsTotal");
  assert.ok(!dash.eventsWithPendencies.some((e: { eventId: number }) => e.eventId === evNext || e.eventId === futuro));
  // Ciclo fechado: nada está aberto.
  const statsFechado = ((await h.api("GET", "/cycles", { role: "admin" })).data as { id: number; stats: { eventsOpen: number } }[]).find(c => c.id === fechado)!.stats;
  assert.equal(statsFechado.eventsOpen, 0);
  await h.sql("delete from event_criteria where event_id = $1", [futuro]);
  await h.sql("delete from events where id = $1", [futuro]);
});

// ── D2 ──────────────────────────────────────────────────────────────────────
test("D2: modo por área — só quem é da área do critério responde; repasse para outra área → 409", async () => {
  const c = await criterionIn(areaA, "Crit D2 R3", true);
  await h.sql("update criterion_routing set redirect_mode = 'specific' where criterion_id = $1", [c]);
  await h.sql("insert into criterion_redirect_users (criterion_id, user_id) values ($1, $2), ($1, $3)", [c, bia, beto]);
  const ev = await openEvent(atual, [c], "Evento D2 R3", "2026-09-18");
  await h.fx.criterionAssignment({ eventId: ev, criterionId: c, assignedToId: semArea });

  // Fluxo antigo: designado responde; repasse para outra área permitido pelo roteamento.
  assert.equal((await h.api("GET", `/events/${ev}/criterion-assignments/redirect-options/${c}`, as(ana))).data.length, 2);
  await h.sql("update cycles set area_evaluation = true where id = $1", [atual]);
  try {
    const fora = await h.api("POST", "/evaluations", { ...as(semArea), body: { eventId: ev, criterionId: c, score: 8, comments: "x" } });
    assert.equal(fora.status, 403, JSON.stringify(fora.data));
    assert.match(fora.data.error, /avaliação é por área/);
    assert.deepEqual((await h.api("GET", `/events/${ev}/public-link-eligible-criteria`, as(semArea))).data, []);
    assert.equal((await h.api("GET", `/evaluations/my-area?eventId=${ev}`, as(semArea))).data.events.length, 0);

    const opts = (await h.api("GET", `/events/${ev}/criterion-assignments/redirect-options/${c}`, as(ana))).data as { id: number }[];
    assert.deepEqual(opts.map(o => o.id), [bia], "só gente da área do critério");
    const r = await h.api("PATCH", `/events/${ev}/criterion-assignments/${c}`, { role: "admin", body: { action: "redirect", assignedToId: beto } });
    assert.equal(r.status, 409, JSON.stringify(r.data));
    assert.equal(r.data.code, "AREA_MODE_OTHER_AREA");
    assert.equal((await h.one("select assigned_to_id from event_criterion_assignments where event_id = $1 and criterion_id = $2", [ev, c])).assigned_to_id, semArea);
    const ok = await h.api("PATCH", `/events/${ev}/criterion-assignments/${c}`, { role: "admin", body: { action: "redirect", assignedToId: bia } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));

    // Da área: responde mesmo sem designação.
    assert.equal((await h.api("POST", "/evaluations", { ...as(ana), body: { eventId: ev, criterionId: c, score: 8, comments: "x" } })).status, 201);
  } finally {
    await h.sql("update cycles set area_evaluation = false where id = $1", [atual]);
  }
});

// ── D3 ──────────────────────────────────────────────────────────────────────
test("D3: PATCH /cycles não troca a avaliação por área com avaliação enviada no ciclo (409 com motivo)", async () => {
  await h.fx.evaluation({ eventId: evIn, criterionId: critB, evaluatorUserId: beto, score: 7 });
  const r = await h.api("PATCH", `/cycles/${atual}`, { role: "admin", body: { areaEvaluation: true } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "CYCLE_HAS_EVALUATIONS");
  assert.match(r.data.error, /avaliação por área/);
  assert.equal((await h.one("select area_evaluation from cycles where id = $1", [atual])).area_evaluation, false);

  const vazio = await h.fx.cycle({ name: "Vazio R3", startDate: "2030-01-01", endDate: "2030-06-30", isCurrent: false });
  const ok = await h.api("PATCH", `/cycles/${vazio}`, { role: "admin", body: { areaEvaluation: true } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.areaEvaluation, true);

  const fechadoR = await h.api("PATCH", `/cycles/${fechado}`, { role: "admin", body: { areaEvaluation: true } });
  assert.equal(fechadoR.status, 409);
  assert.match(fechadoR.data.error, /avaliação por área/);
});

// ── A1 ──────────────────────────────────────────────────────────────────────
test("A1: rotas liberadas ao avaliador não devolvem nada além da área dele", async () => {
  await h.sql("update events set conformity_evaluator_user_id = $2, conformity_evaluator_ferramentas_user_id = $3 where id = $1", [evIn, ceno1, ferr1]);
  await h.sql("insert into event_conformities (event_id, epi, absences_response, absences_report, guarda_equipamentos, created_by_user_id) values ($1, true, true, 'Fulano faltou', true, $2)", [evIn, ceno1]);
  await h.sql("update event_participants set comment = 'comentário do RH' where event_id = $1", [evIn]);
  await h.fx.criterionAssignment({ eventId: evIn, criterionId: critB, assignedToId: beto });
  await h.fx.criterionAssignment({ eventId: evIn, criterionId: critA, assignedToId: ana });
  await token(evIn, beto, "criteria", [critB]);
  const deAna = await token(evIn, ana, "criteria", [critA]);

  // Repasse da matriz: só a confirmação.
  const p1 = await h.api("PATCH", `/events/${evIn}/conformity-evaluator`, { ...as(ceno1), body: { userId: ceno2 } });
  assert.equal(p1.status, 200, JSON.stringify(p1.data));
  assert.deepEqual(Object.keys(p1.data).sort(), ["conformityEvaluatorUserId", "ok"]);
  assert.equal(p1.data.conformityEvaluatorUserId, ceno2);
  const p2 = await h.api("PATCH", `/events/${evIn}/conformity-evaluator-ferramentas`, { ...as(ferr1), body: { userId: ferr2 } });
  assert.equal(p2.status, 200, JSON.stringify(p2.data));
  assert.deepEqual(Object.keys(p2.data).sort(), ["conformityEvaluatorFerramentasUserId", "ok"]);
  const adminR = await h.api("PATCH", `/events/${evIn}/conformity-evaluator`, { role: "admin", body: { userId: ceno1 } });
  assert.equal(adminR.data.ok, true);
  assert.ok(Array.isArray(adminR.data.participants), "admin/RH recebem o detalhe");

  // Matriz: cada lado vê só a sua parte.
  const ferrView = (await h.api("GET", `/events/${evIn}/conformity`, as(ferr2))).data;
  assert.equal(ferrView.guardaEquipamentos, true);
  assert.equal(ferrView.epi, null);
  assert.equal(ferrView.absencesReport, null);
  const cenoView = (await h.api("GET", `/events/${evIn}/conformity`, as(ceno1))).data;
  assert.equal(cenoView.epi, true);
  assert.equal(cenoView.absencesReport, "Fulano faltou");
  assert.equal(cenoView.guardaEquipamentos, null);
  const posted = await h.api("POST", `/events/${evIn}/conformity`, { ...as(ferr2), body: { guardaEquipamentos: false, guardaEquipamentosComment: "faltou case" } });
  assert.equal(posted.status, 200, JSON.stringify(posted.data));
  assert.equal(posted.data.absencesReport, null);
  assert.equal(posted.data.epi, null);
  assert.equal((await h.api("GET", `/events/${evIn}/conformity`, as(ana))).status, 403);

  // Critérios, designações, avaliações, links e lista: só a área A.
  const crits = (await h.api("GET", `/events/${evIn}/criteria`, as(ana))).data as { criterionId: number }[];
  assert.deepEqual(crits.map(c => c.criterionId), [critA]);
  const asg = (await h.api("GET", `/events/${evIn}/criterion-assignments`, as(ana))).data as { criterionId: number; assignedToId: number }[];
  assert.ok(asg.every(a => a.assignedToId === ana), JSON.stringify(asg));
  assert.equal((await h.api("GET", `/events/${evIn}/criterion-assignments/redirect-options/${critB}`, as(ana))).status, 403);
  assert.equal((await h.api("GET", `/events/${evIn}/criterion-assignments/redirect-options/${critA}`, as(ana))).status, 200);
  const evals = (await h.api("GET", `/evaluations?eventId=${evIn}`, as(ana))).data as { criterionId: number }[];
  assert.ok(evals.every(e => e.criterionId !== critB), "nota da área B não aparece");
  const tokens = (await h.api("GET", `/events/${evIn}/public-tokens`, as(ana))).data as { id: string; createdByName: string }[];
  assert.ok(tokens.some(t => t.id === deAna));
  assert.ok(tokens.every(t => t.createdByName === "Ana R3"), "links de outra pessoa não aparecem");
  const elig = (await h.api("GET", `/events/${evIn}/public-link-eligible-criteria`, as(ana))).data as { criterionId: number }[];
  assert.ok(elig.every(c => c.criterionId === critA));
  const myArea = (await h.api("GET", `/evaluations/my-area?eventId=${evIn}`, as(ana))).data;
  assert.ok(myArea.events[0].criteria.every((c: { areaId: number }) => c.areaId === areaA));
  assert.equal(JSON.stringify(myArea).includes("comentário do RH"), false);
  assert.deepEqual((await h.api("GET", "/users/my-principal-areas", as(ana))).data, []);
  assert.equal((await h.api("GET", "/cycles/current", as(ana))).status, 200);
  // Fora da lista do avaliador: detalhe do evento e participantes.
  assert.equal((await h.api("GET", `/events/${evIn}`, as(ana))).status, 403);
  assert.equal((await h.api("GET", `/events/${evIn}/participants`, as(ana))).status, 403);
});

// ── B1 ──────────────────────────────────────────────────────────────────────
test("B1: /users/by-area para o avaliador — só as áreas que ele usa; outras → 403", async () => {
  await h.sql("update criterion_routing set redirect_area_id = $1 where criterion_id = $2", [areaC, critA]);
  assert.equal((await h.api("GET", `/users/by-area/${areaA}`, as(ana))).status, 200, "a própria área");
  assert.equal((await h.api("GET", `/users/by-area/${areaC}`, as(ana))).status, 200, "área de redirecionamento do critério dela");
  assert.equal((await h.api("GET", `/users/by-area/${areaB}`, as(ana))).status, 403);
  assert.equal((await h.api("GET", "/users/by-area/13", as(ana))).status, 403, "não responde matriz nenhuma");
  const cenoList = await h.api("GET", "/users/by-area/13", as(ceno1));
  assert.equal(cenoList.status, 200);
  assert.ok(cenoList.data.some((u: { id: number }) => u.id === ceno2));
  assert.equal((await h.api("GET", "/users/by-area/16", as(ceno1))).status, 403);
  assert.equal((await h.api("GET", `/users/by-area/${areaB}`, { role: "admin" })).status, 200);
});

// ── B2 ──────────────────────────────────────────────────────────────────────
test("B2: áudio em /storage — avaliador só ouve o de avaliação que enxerga (ou o que acabou de gravar)", async () => {
  // A nota enviada do Beto (área B, do teste D3) ganha um áudio.
  await h.sql("update evaluations set audio_url = '/objects/uploads/audio-area-b' where event_id = $1 and criterion_id = $2 and evaluator_user_id = $3", [evIn, critB, beto]);
  const deBia = await h.fx.evaluation({ eventId: evIn, criterionId: critA, evaluatorUserId: bia, score: 6, status: "draft" });
  await h.sql("update evaluations set audio_url = '/objects/uploads/audio-rascunho-bia' where id = $1", [deBia]);
  const propria = await h.fx.evaluation({ eventId: evIn, criterionId: critA, evaluatorUserId: ana, score: 8, status: "draft" });
  await h.sql("update evaluations set audio_url = '/objects/uploads/audio-ana' where id = $1", [propria]);
  await h.sql("insert into audit_logs (user_id, action, entity, entity_id) values ($1, 'upload_audio', 'storage_audio', '/objects/uploads/audio-novo-ana')", [ana]);

  const get = (path: string, opts: Record<string, unknown>) => h.api("GET", `/storage/objects/uploads/${path}`, opts);
  assert.equal((await get("audio-area-b", as(ana))).status, 403);
  assert.equal((await get("audio-rascunho-bia", as(ana))).status, 403, "rascunho de colega não");
  assert.notEqual((await get("audio-ana", as(ana))).status, 403);
  assert.notEqual((await get("audio-novo-ana", as(ana))).status, 403, "o que ela acabou de gravar");
  assert.equal((await get("audio-novo-ana", as(bia))).status, 403);
  assert.notEqual((await get("audio-area-b", as(beto))).status, 403);
  assert.notEqual((await get("audio-area-b", { role: "admin" })).status, 403);
  await h.sql("delete from evaluations where id = any($1)", [[deBia, propria]]);
});

// ── B3 ──────────────────────────────────────────────────────────────────────
test("B3: matriz pendente/completa — a mesma conta na tela do avaliador e na lista de Eventos (com a Conduta do ciclo)", async () => {
  const ev = await openEvent(atual, [critA], "Evento matriz R3", "2026-09-19");
  await h.sql("update events set conformity_evaluator_user_id = $2 where id = $1", [ev, ana]);
  await h.sql("insert into event_conformities (event_id, epi, estaiamentos, standout_response, absences_response, absences_report, created_by_user_id) values ($1, true, true, false, true, 'Ninguém faltou', $2)", [ev, ana]);
  const state = async () => {
    const my = (await h.api("GET", `/evaluations/my-area?eventId=${ev}`, as(ana))).data.events[0];
    const row = ((await h.api("GET", `/events?cycleId=${atual}`, { role: "admin" })).data as { id: number; conformityCenografiaDone: boolean; conformityComplete: boolean }[]).find(e => e.id === ev)!;
    return { pending: my.conformityPending as boolean, done: row.conformityCenografiaDone, complete: row.conformityComplete };
  };
  // Ciclo COM a Conduta na matriz: falta a Conduta.
  assert.deepEqual(await state(), { pending: true, done: false, complete: false });
  await h.sql("update event_conformities set conduta = true where event_id = $1", [ev]);
  assert.deepEqual(await state(), { pending: false, done: true, complete: true });
  // Ciclo SEM a Conduta: ela não conta.
  await h.sql("update event_conformities set conduta = null where event_id = $1", [ev]);
  await h.sql("update cycles set conformity_without_conduta = true where id = $1", [atual]);
  try {
    assert.deepEqual(await state(), { pending: false, done: true, complete: true });
  } finally {
    await h.sql("update cycles set conformity_without_conduta = false where id = $1", [atual]);
  }
});

// ── B5 ──────────────────────────────────────────────────────────────────────
test("B5: PATCH de designação valida evento e critério (404/400, nunca 500)", async () => {
  const patch = (url: string) => h.api("PATCH", url, { role: "admin", body: { assignedToId: ana } });
  assert.equal((await patch(`/events/999999/criterion-assignments/${critA}`)).status, 404);
  assert.equal((await patch(`/events/${evIn}/criterion-assignments/999999`)).status, 404);
  assert.equal((await patch(`/events/${evNext}/criterion-assignments/${critB}`)).status, 400, "critério fora do evento");
  assert.equal((await patch(`/events/abc/criterion-assignments/${critA}`)).status, 400);
  assert.equal((await h.api("PATCH", `/events/${evIn}/criterion-assignments/${critA}`, { role: "admin", body: { assignedToId: 999999 } })).status, 404);
  assert.equal((await patch(`/events/${evIn}/criterion-assignments/${critA}`)).status, 200);
});

// ── M2 ──────────────────────────────────────────────────────────────────────
test("M2: a 0011 liga as respostas ANTIGAS ao link (janela -1 s/+5 s, candidato único, idempotente); 'respondido por' mostra o freela", async () => {
  const [c1, c2, c3, c4] = [await criterionIn(null, "M2 dentro"), await criterionIn(null, "M2 ambíguo"), await criterionIn(null, "M2 fora"), await criterionIn(null, "M2 tela")];
  const ev = await openEvent(atual, [c1, c2, c3, c4], "Evento M2 R3", "2026-09-10");
  for (const c of [c1, c2, c3, c4]) await h.fx.criterionAssignment({ eventId: ev, criterionId: c, assignedToId: ana });
  const used = async (criteria: number[], name: string, at: string) => {
    const t = await token(ev, ana, "criteria", criteria);
    await h.sql("update public_eval_tokens set used_at = $2, submitter_name = $3 where id = $1", [t, at, name]);
    return t;
  };
  const sent = (c: number, at: string) => h.sql("insert into evaluations (event_id, criterion_id, evaluator_user_id, score, status, submitted_at, comments) values ($1, $2, $3, 8, 'submitted', $4, 'ok')", [ev, c, ana, at]);
  // O código antigo gravava o envio e, depois, o "usado em" do link, com
  // relógios separados: o link aparece usado alguns segundos depois do envio.
  const t1 = await used([c1], "Freela Dentro", "2026-09-11T10:00:02.400Z");
  await sent(c1, "2026-09-11T10:00:00Z");
  await used([c2], "Freela A", "2026-09-11T11:00:01Z");
  await used([c2], "Freela B", "2026-09-11T11:00:02Z");
  await sent(c2, "2026-09-11T11:00:00Z");
  await used([c3], "Freela Fora", "2026-09-11T12:00:10Z");
  await sent(c3, "2026-09-11T12:00:00Z");
  await sent(c4, "2026-09-11T13:00:00Z");

  await h.sql(BACKFILL_0011);
  await h.sql(BACKFILL_0011); // idempotente
  const link = async (c: number) => (await h.one("select public_token_id from evaluations where event_id = $1 and criterion_id = $2", [ev, c])).public_token_id;
  assert.equal(await link(c1), t1);
  assert.equal(await link(c2), null, "dois candidatos: ambíguo, sem vínculo");
  assert.equal(await link(c3), null, "fora da janela");
  assert.equal(await link(c4), null, "pela tela");

  const list = (await h.api("GET", `/evaluations?eventId=${ev}`, { role: "admin" })).data as { criterionId: number; evaluatorName: string }[];
  const nameOf = (c: number) => list.find(e => e.criterionId === c)?.evaluatorName;
  assert.equal(nameOf(c1), "Freela Dentro");
  assert.equal(nameOf(c2), "Ana R3");
  assert.equal(nameOf(c4), "Ana R3");
  const my = (await h.api("GET", `/evaluations/my-area?eventId=${ev}`, as(ana))).data.events[0].criteria as { criterionId: number; answeredByName: string; answeredViaLink: boolean; answeredByMe: boolean }[];
  const row = my.find(c => c.criterionId === c1)!;
  assert.equal(row.answeredByName, "Freela Dentro");
  assert.equal(row.answeredViaLink, true);
  assert.equal(row.answeredByMe, false);
  assert.equal(my.find(c => c.criterionId === c4)!.answeredViaLink, false);
});

// ── M5 ──────────────────────────────────────────────────────────────────────
test("M5: importação de resultados históricos — atualizar ou criar em ciclo fechado → erro na prévia e 409 ao aplicar", async () => {
  await h.sql("insert into events (name, start_date, end_date, cycle_id, status, is_historical, imported_score) values ('Histórico fechado R3', '2026-02-20', '2026-02-20', $1, 'closed', true, '70')", [fechado]);
  const run = (csvData: string, dryRun: boolean) => h.api("POST", "/integration/import/historical-results", { role: "admin", body: { csvData, dryRun } });
  for (const csv of ["Casa R3,85,Histórico fechado R3,20/02/2026", "Casa R3,85,Evento novo no fechado R3,2026-03-10"]) {
    const dry = await run(csv, true);
    assert.equal(dry.status, 200, JSON.stringify(dry.data));
    assert.equal(dry.data.success, false);
    assert.ok(dry.data.errors.some((e: string) => /ciclo fechado/.test(e)), JSON.stringify(dry.data.errors));
    const apply = await run(csv, false);
    assert.equal(apply.status, 409, JSON.stringify(apply.data));
    assert.equal(apply.data.code, "CLOSED_CYCLE");
  }
  assert.equal((await h.one("select imported_score from events where name = 'Histórico fechado R3'")).imported_score, "70.00");
  assert.equal((await h.sql("select id from events where name = 'Evento novo no fechado R3'")).length, 0);
  // Ciclo aberto: segue normal.
  const ok = await run("Casa R3,85,Evento histórico atual R3,2026-05-10", true);
  assert.equal(ok.data.success, true, JSON.stringify(ok.data.errors));
});

// ── A2 ──────────────────────────────────────────────────────────────────────
test("A2: sincronização — ciclo atual fechado → 409; evento de ciclo fechado não é tocado; período pela data de início", async () => {
  await h.sql("update events set external_id = 'ext-fechado' where id = $1", [evFechado]);
  extData = {
    employees: [{ id: "emp-r3", name: "Sincronizado R3" }],
    events: [
      { id: "ext-fechado", name: "Mudou pela sync", startDate: "2026-09-15", endDate: "2026-09-15" },
      { id: "ext-virada", name: "Começa no último dia R3", startDate: "2026-09-30", endDate: "2026-10-01" },
      { id: "ext-depois", name: "Depois do ciclo R3", startDate: "2026-10-01", endDate: "2026-10-01" },
    ],
    participations: [
      { eventId: "ext-fechado", employeeId: "emp-r3", functionName: "Cenotécnico" },
      { eventId: "ext-virada", employeeId: "emp-r3", functionName: "Cenotécnico" },
    ],
  };

  await h.sql("update cycles set status = 'closed' where id = $1", [atual]);
  try {
    const r = await h.api("POST", "/integration/sync", { role: "admin" });
    assert.equal(r.status, 409, JSON.stringify(r.data));
    assert.equal(r.data.code, "CLOSED_CYCLE");
    assert.equal((await h.sql("select id from events where external_id = 'ext-virada'")).length, 0);
  } finally {
    await h.sql("update cycles set status = 'open' where id = $1", [atual]);
  }

  const r = await h.api("POST", "/integration/sync", { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.skippedClosedCycle.map((s: { eventId: number }) => s.eventId), [evFechado]);
  const fech = await h.one("select name, cycle_id, start_date::text as d from events where id = $1", [evFechado]);
  assert.deepEqual([fech.name, fech.cycle_id, fech.d], ["Evento fechado R3", fechado, "2026-02-01"], "intacto");
  assert.equal((await h.sql("select p.id from event_participants p join employees e on e.id = p.employee_id where p.event_id = $1 and e.external_id = 'emp-r3'", [evFechado])).length, 0);
  const virada = await h.one("select cycle_id from events where external_id = 'ext-virada'");
  assert.equal(virada?.cycle_id, atual, "começa dentro do ciclo (termina depois): entra");
  assert.equal((await h.sql("select id from events where external_id = 'ext-depois'")).length, 0, "começa depois do fim: fica de fora");
});

// ── D4 / M4 ─────────────────────────────────────────────────────────────────
test("D4/M4: KPI do Total geral = Σ(nota×eventos)÷Σ eventos, igual em /ranking/total, Dashboard e Análises; um ciclo usa o recorte do Ranking", async () => {
  await h.sql("delete from quarterly_results");
  const qr = (emp: number, cycle: number, final: number, events: number, eligible: boolean, bonus: number, participated = events, reason: string | null = null) => h.sql(
    `insert into quarterly_results (employee_id, cycle_id, final_result, events_count, participated_events_count, eligible, bonus_value, eligibility_reason)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`, [emp, cycle, final, events, participated, eligible, bonus, reason]);
  await qr(empCasa, fechado, 80, 3, true, 2200);
  await qr(empCasa, atual, 90, 1, false, 0);
  await qr(empFreela, atual, 10, 1, false, 0); // freela: fora do recorte do Ranking
  await qr(empX, fechado, 60, 0, false, 0, 9, "Participou de 2 de 8 eventos exigidos no ciclo");

  const total = (await h.api("GET", "/ranking/total", { role: "admin" })).data;
  assert.equal(total.summary.avgFinalResult, 82.5, "(80×3 + 90×1) ÷ 4");
  assert.equal(total.summary.eventsWithScore, 4);
  const dashAll = (await h.api("GET", "/dashboard/summary?cycleId=all", { role: "admin" })).data;
  const anAll = (await h.api("GET", "/analytics/overview?cycleId=all", { role: "admin" })).data.kpis;
  assert.equal(dashAll.quarterAverage, total.summary.avgFinalResult);
  assert.equal(anAll.avgFinalResult, total.summary.avgFinalResult);

  // Um ciclo (M4): Dashboard = Análises, sem o freela (rankingScope).
  const dash = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
  const an = (await h.api("GET", "/analytics/overview", { role: "admin" })).data.kpis;
  assert.equal(dash.quarterAverage, 90);
  assert.equal(dash.quarterAverage, an.avgFinalResult);
  assert.equal(dash.totalEmployeesEvaluated, an.collaborators);
});

// ── Funil ───────────────────────────────────────────────────────────────────
test("Funil de Análises (ciclo fechado): 'Atingiram o mínimo' vem da apuração gravada e o funil é decrescente", async () => {
  await h.sql("update cycles set min_events = 8 where id = $1", [fechado]);
  const ov = (await h.api("GET", `/analytics/overview?cycleId=${fechado}`, { role: "admin" })).data;
  const count = (stage: string) => ov.funnel.find((f: { stage: string }) => f.stage === stage).count as number;
  // Casa R3: elegível (gravado) com 3 participações — a regra de hoje (8) diria
  // que não atingiu. Recusado R3: recusado pelo mínimo na apuração, mesmo com 9.
  assert.equal(count("participated"), 2);
  assert.equal(count("reachedMin"), 1);
  assert.equal(count("eligible"), 1);
  assert.equal(count("withBonus"), 1);
  const counts = ov.funnel.map((f: { count: number }) => f.count);
  assert.deepEqual(counts, [...counts].sort((a: number, b: number) => b - a), "decrescente");
  assert.equal(ov.kpis.reachedMinEvents, 1);
});

// ── D1 (por último: fecha o ciclo atual e cria o próximo) ───────────────────
test("D1: o ciclo novo leva o evento; aviso de critério com várias respostas no ciclo por área; depois vale a liberação normal", async () => {
  // Respostas antigas (antes da regra) em dois avaliadores no mesmo critério.
  await h.fx.evaluation({ eventId: evNext, criterionId: critA, evaluatorUserId: ana, score: 8 });
  await h.fx.evaluation({ eventId: evNext, criterionId: critA, evaluatorUserId: bia, score: 6 });
  await h.sql("update events set criteria_confirmed = false where id = $1", [evNext]);
  await h.sql("update cycles set status = 'closed' where id = $1", [atual]);

  const r = await h.api("POST", "/cycles", { role: "admin", body: { name: "Novo R3", startDate: "2026-10-01", endDate: "2026-12-31", areaEvaluation: true } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.ok(r.data.movedEvents.some((e: { id: number }) => e.id === evNext));
  assert.ok(r.data.warnings.includes("Evento Evento próximo ciclo R3: critério Crit A R3 tem 2 respostas enviadas antes da regra por área — revisar na Central"), JSON.stringify(r.data.warnings));

  const { autoReleaseDueEvents } = await import("../lib/evaluation-release.js");
  assert.deepEqual(await autoReleaseDueEvents({ eventIds: [evNext] }), [evNext], "agora no ciclo certo: libera no dia seguinte");
  const list = (await h.api("GET", "/events", { role: "admin" })).data as { id: number; nextCycle: boolean; openForEvaluation: boolean }[];
  const ev = list.find(e => e.id === evNext)!;
  assert.equal(ev.nextCycle, false);
  assert.equal(ev.openForEvaluation, true);
  const post = await h.api("POST", "/evaluations", { role: "admin", body: { eventId: evNext, criterionId: critA, score: 9, comments: "x" } });
  assert.notEqual(post.data.code, "EVENT_NEXT_CYCLE", JSON.stringify(post.data));
});
