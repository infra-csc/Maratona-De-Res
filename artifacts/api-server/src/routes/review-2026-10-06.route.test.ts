// Regressões da 2ª rodada de revisão (06/10/2026) no BACKEND. Cada teste
// reproduz um achado: A1, M1–M6, B1–B6, Dashboard "pendentes", principal no
// fluxo antigo, contagem de eventos e ordem da "Evolução de Performance".
// A ordem dos testes importa: o último (M2) fecha o ciclo atual e cria o novo.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let fechado: number, atual: number, cicloArea: number, cicloAntigo: number;
let areaA: number, areaP: number;
let ana: number, bia: number, caio: number, principal: number, outro: number, aval: number;
let empAna: number;
let critLink: number;
let evFechado: number, evForaFechado: number, evAtual: number;

async function user(name: string, role: string, areaId: number | null) {
  return (await h.one("insert into users (name, password_hash, role, area_id) values ($1, 'x', $2, $3) returning id", [name, role, areaId])).id as number;
}
const as = (userId: number, role = "avaliador") => ({ role, userId });

async function criterionIn(area: number | null, name: string, allowPublicLink: boolean | null = null) {
  const id = await h.fx.criterion({ name, allowPublicLink });
  if (area != null) await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

async function openEvent(cycleId: number, criteria: number[], name: string, date = "2026-09-20", participants: number[] = []) {
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria, name, date, participants });
  await h.sql("update events set criteria_confirmed = true where id = $1", [eventId]);
  return eventId;
}

async function token(eventId: number, createdBy: number, type = "criteria", criteria: number[] = []) {
  const id = `r2-${Math.random().toString(36).slice(2, 10)}`;
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ($1, $2, $3, 'Freela', $4)", [id, eventId, createdBy, type]);
  for (const c of criteria) await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ($1, $2)", [id, c]);
  return id;
}

async function withCurrentClosed(fn: () => Promise<void>) {
  await h.sql("update cycles set status = 'closed' where id = $1", [atual]);
  try { await fn(); } finally { await h.sql("update cycles set status = 'open' where id = $1", [atual]); }
}

before(async () => {
  h = await startApi();
  await h.fx.platoonRules2026();
  const mkArea = async (name: string) => (await h.one("insert into areas (name, active) values ($1, true) returning id", [name])).id as number;
  areaA = await mkArea("Área A (R2)");
  areaP = await mkArea("Área P (R2)");
  ana = await user("Ana R2", "avaliador", areaA);
  bia = await user("Bia R2", "avaliador", areaA);
  caio = await user("Caio R2", "avaliador", areaA);
  principal = await user("Paulo Principal R2", "avaliador", null);
  outro = await user("Otto R2", "avaliador", null);
  aval = await user("Avaliador Link R2", "avaliador", null);
  empAna = await h.fx.employee({ name: "Ana Colaboradora R2" });

  fechado = await h.fx.cycle({ name: "Ciclo fechado R2", startDate: "2026-01-01", endDate: "2026-06-30", status: "closed", isCurrent: false });
  cicloAntigo = await h.fx.cycle({ name: "Ciclo antigo R2", startDate: "2025-01-01", endDate: "2025-06-30", status: "closed", isCurrent: false });
  cicloArea = await h.fx.cycle({ name: "Ciclo por área R2", startDate: "2025-07-01", endDate: "2025-12-31", status: "open", isCurrent: false });
  await h.sql("update cycles set area_evaluation = true where id = $1", [cicloArea]);
  atual = await h.fx.cycle({ name: "Ciclo atual R2" }); // 2026-07-01 a 2026-12-31, aberto, atual

  critLink = await h.fx.criterion({ name: "Crit link R2", allowPublicLink: true });
  evFechado = await h.fx.event({ cycleId: fechado, date: "2026-03-01", status: "closed", resultsConfirmed: true, criteria: [critLink], participants: [empAna], name: "Evento fechado R2" });
  // "Fora do período" do ciclo fechado (começa depois do fim): liberado.
  evForaFechado = await h.fx.event({ cycleId: fechado, date: "2026-07-15", status: "open", resultsConfirmed: false, criteria: [critLink], name: "Evento fora do fechado R2" });
  evAtual = await openEvent(atual, [critLink], "Evento atual R2", "2026-08-10", [empAna]);
});
after(() => h?.close());

// ── A1 ──────────────────────────────────────────────────────────────────────
test("A1: link público em evento de ciclo fechado → 409 CLOSED_CYCLE sem queimar o link; GET avisa", async () => {
  const t = await token(evFechado, aval, "criteria", [critLink]);
  const info = await h.api("GET", `/public-eval/${t}`);
  assert.equal(info.status, 200);
  assert.equal(info.data.cycleClosed, true);

  const r = await h.api("POST", `/public-eval/${t}/submit`, { body: { submitterName: "Freela", evaluations: [{ criterionId: critLink, score: 9, comments: "ok" }] } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "CLOSED_CYCLE");
  assert.equal(r.data.cycleClosed, true);
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [t])).used_at, null, "link continua sem uso");
  assert.equal((await h.sql("select id from evaluations where event_id = $1", [evFechado])).length, 0);

  const tc = await token(evFechado, aval, "conformity_cenografia");
  const rc = await h.api("POST", `/public-eval/${tc}/submit-conformity`, { body: { submitterName: "Freela", epi: true, estaiamentos: true, conduta: true } });
  assert.equal(rc.status, 409);
  assert.equal(rc.data.code, "CLOSED_CYCLE");
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [tc])).used_at, null);
  assert.equal((await h.sql("select id from event_conformities where event_id = $1", [evFechado])).length, 0);

  // Evento "fora do período" do ciclo fechado e evento do ciclo atual: liberados.
  assert.equal((await h.api("GET", `/public-eval/${await token(evForaFechado, aval, "criteria", [critLink])}`)).data.cycleClosed, false);
  assert.equal((await h.api("GET", `/public-eval/${await token(evAtual, aval, "criteria", [critLink])}`)).data.cycleClosed, false);
});

// ── B3 / B4 ─────────────────────────────────────────────────────────────────
test("B3: POST /absences ligado a evento de ciclo fechado (ciclo atual aberto) → 409", async () => {
  const r = await h.api("POST", "/absences", { role: "admin", body: { employeeId: empAna, eventId: evFechado, date: "2026-03-01" } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "CLOSED_CYCLE");
  const ok = await h.api("POST", "/absences", { role: "admin", body: { employeeId: empAna, eventId: evAtual, date: "2026-08-10" } });
  assert.notEqual(ok.status, 409, "evento do ciclo atual não é travado");
});

test("B4: escrita anônima recebe 401 (a trava de ciclo fechado não responde antes da autenticação)", async () => {
  assert.equal((await h.api("POST", "/absences", { body: { employeeId: empAna, eventId: evFechado, date: "2026-03-01" } })).status, 401);
  assert.equal((await h.api("PATCH", `/events/${evFechado}`, { body: { name: "x" } })).status, 401);
  assert.equal((await h.api("POST", "/evaluations", { body: { eventId: evFechado, criterionId: critLink, score: 5 } })).status, 401);
  assert.equal((await h.api("POST", "/cycle-eligibility", { body: { employeeId: empAna, eligible: false } })).status, 401);
  // Autenticado continua recebendo o 409.
  assert.equal((await h.api("PATCH", `/events/${evFechado}`, { role: "admin", body: { name: "x" } })).status, 409);
});

// ── M1 ──────────────────────────────────────────────────────────────────────
test("M1: elegibilidade, fora do ciclo e resync-all com o ciclo atual FECHADO → 409/pulado", async () => {
  await withCurrentClosed(async () => {
    const e = await h.api("POST", "/cycle-eligibility", { role: "admin", body: { employeeId: empAna, eligible: false, reason: "x" } });
    assert.equal(e.status, 409, JSON.stringify(e.data));
    assert.equal(e.data.code, "CLOSED_CYCLE");
    const x = await h.api("PUT", `/employees/${empAna}/cycle-exclusion`, { role: "admin", body: { excluded: true } });
    assert.equal(x.status, 409);
    assert.equal(x.data.code, "CLOSED_CYCLE");
    const rs = await h.api("POST", "/events/criteria/resync-all", { role: "admin", body: {} });
    assert.equal(rs.status, 200);
    assert.ok(rs.data.skippedClosedCycle >= 1, JSON.stringify(rs.data));
  });
  assert.equal((await h.api("POST", "/cycle-eligibility", { role: "admin", body: { employeeId: empAna, eligible: true } })).status, 201);
});

test("M1: bulk-date-sync nunca muda data de evento de ciclo fechado (nem o devolve ao período fechado)", async () => {
  const livre = await openEvent(atual, [critLink], "Evento livre data R2", "2026-08-20");
  const updates = [
    { externalId: "", name: "Evento fechado R2", date: "2026-03-05" },
    { externalId: "", name: "Evento fora do fechado R2", date: "2026-05-01" },
    { externalId: "", name: "Evento livre data R2", date: "2026-08-21" },
  ];
  const dry = await h.api("POST", "/events/bulk-date-sync", { role: "admin", body: { updates, dryRun: true } });
  assert.equal(dry.status, 200, JSON.stringify(dry.data));
  assert.deepEqual(dry.data.changes.map((c: { eventId: number }) => c.eventId), [livre]);
  assert.deepEqual(dry.data.skippedClosedCycle.map((c: { eventId: number }) => c.eventId).sort(), [evFechado, evForaFechado].sort());
  const apply = await h.api("POST", "/events/bulk-date-sync", { role: "admin", body: { updates, confirm: "APLICAR" } });
  assert.equal(apply.status, 200);
  assert.equal((await h.one("select start_date::text as d from events where id = $1", [evFechado])).d, "2026-03-01");
  assert.equal((await h.one("select start_date::text as d from events where id = $1", [evForaFechado])).d, "2026-07-15");
  assert.equal((await h.one("select start_date::text as d from events where id = $1", [livre])).d, "2026-08-21");
});

test("M1: dedupe e fix-orphaned-evaluations não tocam evento de ciclo fechado", async () => {
  const c = await h.fx.criterion({ name: "Crit dedupe R2" });
  const evDup = await openEvent(atual, [c], "Evento dedupe R2", "2026-08-25");
  await h.sql("insert into event_criteria (event_id, criterion_id) values ($1, $2)", [evFechado, c]);
  await h.sql("drop index evaluations_event_criterion_evaluator_uq");
  try {
    for (const ev of [evDup, evFechado]) {
      for (let i = 0; i < 2; i++) await h.sql("insert into evaluations (event_id, criterion_id, evaluator_user_id, score, status, comments) values ($1, $2, $3, 7, 'draft', 'igual')", [ev, c, outro]);
    }
    const r = await h.api("POST", "/integration/evaluations/dedupe", { role: "admin", body: { dryRun: false } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.duplicatesRemoved, 1);
    assert.equal(r.data.skippedClosedCycle, 1);
    assert.equal((await h.sql("select id from evaluations where event_id = $1 and criterion_id = $2", [evFechado, c])).length, 2, "ciclo fechado intacto");
  } finally {
    await h.sql("delete from evaluations where criterion_id = $1", [c]);
    await h.sql("create unique index evaluations_event_criterion_evaluator_uq on evaluations (event_id, criterion_id, evaluator_user_id)");
  }

  const o = await h.fx.criterion({ name: "Crit órfão R2" });
  const evOrf = await openEvent(atual, [], "Evento órfão R2", "2026-08-26");
  for (const ev of [evOrf, evFechado]) {
    await h.sql("insert into event_criteria (event_id, criterion_id, active) values ($1, $2, false)", [ev, o]);
    await h.fx.evaluation({ eventId: ev, criterionId: o, evaluatorUserId: outro, score: 7 });
  }
  const f = await h.api("POST", "/integration/fix-orphaned-evaluations", { role: "admin", body: {} });
  assert.equal(f.status, 200);
  assert.equal(f.data.skippedClosedCycle, 1);
  assert.equal((await h.one("select active from event_criteria where event_id = $1 and criterion_id = $2", [evOrf, o])).active, true);
  assert.equal((await h.one("select active from event_criteria where event_id = $1 and criterion_id = $2", [evFechado, o])).active, false);
  await h.sql("delete from evaluations where criterion_id = $1", [o]);
  await h.sql("delete from event_criteria where criterion_id = $1", [o]);
});

test("M1: junção de colaboradores com dado de ciclo fechado → 409 com o motivo; sem → junta", async () => {
  const canon = await h.fx.employee({ name: "Canônico R2" });
  const dupFechado = await h.fx.employee({ name: "Duplicado fechado R2" });
  await h.sql("insert into event_participants (event_id, employee_id, function_name, confirmed) values ($1, $2, 'Montador', true)", [evFechado, dupFechado]);
  const r = await h.api("POST", `/employees/${canon}/merge`, { role: "admin", body: { duplicateIds: [dupFechado] } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "CLOSED_CYCLE");
  assert.ok(r.data.closedCycleData.some((x: string) => /participaç/.test(x)));
  assert.equal((await h.sql("select id from employees where id = $1", [dupFechado])).length, 1, "nada foi juntado");

  const dupLivre = await h.fx.employee({ name: "Duplicado livre R2" });
  const ok = await h.api("POST", `/employees/${canon}/merge`, { role: "admin", body: { duplicateIds: [dupLivre] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
});

test("M1: importação da pesquisa vinculada a evento de ciclo fechado → erro na prévia e 409 ao aplicar", async () => {
  const rows = [["", "", "Fulano Pesquisa R2", "eventofechadosurvey", ""]];
  const linkOverrides = { eventofechadosurvey: evFechado };
  const dry = await h.api("POST", "/integration/import/survey", { role: "admin", body: { rows, linkOverrides, dryRun: true } });
  assert.equal(dry.status, 200);
  assert.ok(dry.data.errors.some((e: string) => /ciclo fechado/.test(e)), JSON.stringify(dry.data.errors));
  const apply = await h.api("POST", "/integration/import/survey", { role: "admin", body: { rows, linkOverrides, dryRun: false } });
  assert.equal(apply.status, 409);
  assert.equal(apply.data.code, "CLOSED_CYCLE");
});

// ── M4 ──────────────────────────────────────────────────────────────────────
test("M4: /my-performance não mostra evento fora do período do ciclo", async () => {
  const emp = await h.fx.employee({ name: "Colab M4 R2" });
  const c = await h.fx.criterion({ name: "Crit M4 R2" });
  const dentro = await h.fx.event({ cycleId: atual, date: "2026-08-05", status: "closed", resultsConfirmed: true, criteria: [c], participants: [emp], name: "Evento M4 dentro" });
  const depois = await h.fx.event({ cycleId: atual, date: "2027-02-01", status: "open", resultsConfirmed: false, criteria: [c], participants: [emp], name: "Evento M4 depois" });
  const r = await h.api("GET", "/my-performance", { role: "visualizador", employeeId: emp });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const ids = r.data.events.map((e: { eventId: number }) => e.eventId);
  assert.ok(ids.includes(dentro));
  assert.ok(!ids.includes(depois), "fora do período não entra");
});

// ── M5 ──────────────────────────────────────────────────────────────────────
test("M5: liberação automática — ciclo fechado não libera; erro num evento não aborta os outros nem dá 500", async () => {
  const c = await h.fx.criterion({ name: "Crit M5 R2" });
  const mk = async (name: string) => {
    const id = await h.fx.event({ cycleId: atual, date: "2026-09-01", status: "open", resultsConfirmed: false, criteria: [c], name });
    await h.fx.criterionAssignment({ eventId: id, criterionId: c, assignedToId: outro });
    return id;
  };
  const evDue = await mk("Evento M5 ok");
  const evFail = await mk("Evento M5 falha");
  const confirmed = async (id: number) => (await h.one("select criteria_confirmed from events where id = $1", [id])).criteria_confirmed;

  await withCurrentClosed(async () => {
    const r = await h.api("GET", `/evaluations/my-area?eventId=${evDue}`, as(outro));
    assert.equal(r.status, 200);
    assert.equal(await confirmed(evDue), false, "ciclo fechado: nada é liberado sozinho");
  });

  await h.sql(`create or replace function r2_falha_liberacao() returns trigger language plpgsql as $$
    begin if new.id = ${evFail} and new.criteria_confirmed then raise exception 'falha simulada'; end if; return new; end $$`);
  await h.sql("create trigger r2_falha before update on events for each row execute function r2_falha_liberacao()");
  try {
    const { autoReleaseDueEvents } = await import("../lib/evaluation-release.js");
    const released = await autoReleaseDueEvents({ eventIds: [evFail, evDue] });
    assert.deepEqual(released, [evDue], "o evento com erro não impediu o outro");
    assert.equal(await confirmed(evFail), false);
    const r = await h.api("GET", `/evaluations/my-area?eventId=${evFail}`, as(outro));
    assert.equal(r.status, 200, "erro na liberação nunca vira 500");
  } finally {
    await h.sql("drop trigger r2_falha on events");
  }
});

// ── M6 ──────────────────────────────────────────────────────────────────────
test("M6: link só de matriz não sobrescreve resposta; GET informa quem respondeu", async () => {
  const ev = await openEvent(atual, [critLink], "Evento matriz R2", "2026-09-10");
  const adminId = await h.ensureUser("admin");
  await h.sql("insert into event_conformities (event_id, epi, estaiamentos, created_by_user_id, cenografia_submitted_by_name) values ($1, true, true, $2, 'Fulano da Matriz')", [ev, adminId]);

  const ceno = await token(ev, aval, "conformity_cenografia");
  const info = await h.api("GET", `/public-eval/${ceno}`);
  assert.equal(info.data.conformityAnswered, true);
  assert.equal(info.data.conformityAnsweredByName, "Fulano da Matriz");
  const r = await h.api("POST", `/public-eval/${ceno}/submit-conformity`, { body: { submitterName: "Freela", epi: false, epiComment: "x", estaiamentos: true, conduta: true } });
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "CONFORMITY_ALREADY_ANSWERED");
  assert.match(r.data.rejected[0].reason, /Fulano da Matriz/);
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [ceno])).used_at, null, "link não queimado");
  const row = await h.one("select epi, cenografia_submitted_by_name from event_conformities where event_id = $1", [ev]);
  assert.equal(row.epi, true);
  assert.equal(row.cenografia_submitted_by_name, "Fulano da Matriz");

  // Ferramentas: a primeira grava; a segunda é recusada com o nome.
  const f1 = await token(ev, aval, "conformity_ferramentas");
  assert.equal((await h.api("GET", `/public-eval/${f1}`)).data.conformityAnswered, false);
  assert.equal((await h.api("POST", `/public-eval/${f1}/submit-conformity`, { body: { submitterName: "Ferr Um", guardaEquipamentos: true } })).status, 200);
  const f2 = await token(ev, aval, "conformity_ferramentas");
  const r2 = await h.api("POST", `/public-eval/${f2}/submit-conformity`, { body: { submitterName: "Ferr Dois", guardaEquipamentos: false, guardaEquipamentosComment: "x" } });
  assert.equal(r2.status, 409);
  assert.match(r2.data.rejected[0].reason, /Ferr Um/);
  assert.equal((await h.one("select guarda_equipamentos from event_conformities where event_id = $1", [ev])).guarda_equipamentos, true);
});

// ── B1 e fluxo antigo do principal ──────────────────────────────────────────
test("B1: avaliador vê rascunho só dele; de colegas, só o ENVIADO", async () => {
  const c = await criterionIn(areaA, "Crit B1 R2");
  const ev = await openEvent(atual, [c], "Evento B1 R2");
  const minha = await h.fx.evaluation({ eventId: ev, criterionId: c, evaluatorUserId: ana, score: 7, status: "draft" });
  const rascunhoBia = await h.fx.evaluation({ eventId: ev, criterionId: c, evaluatorUserId: bia, score: 3, status: "draft" });
  const enviadaCaio = await h.fx.evaluation({ eventId: ev, criterionId: c, evaluatorUserId: caio, score: 9, status: "submitted" });
  const r = await h.api("GET", `/evaluations?eventId=${ev}`, as(ana));
  assert.equal(r.status, 200);
  const ids = r.data.map((e: { id: number }) => e.id);
  assert.ok(ids.includes(minha), "o próprio rascunho");
  assert.ok(ids.includes(enviadaCaio), "o enviado do colega da área");
  assert.ok(!ids.includes(rascunhoBia), "rascunho do colega (nota, comentário, áudio) não");
});

test("Fluxo antigo: o avaliador PRINCIPAL vê as respostas da área dele (ciclo sem avaliação por área)", async () => {
  const c = await criterionIn(areaP, "Crit principal R2", true);
  await h.sql("update criterion_routing set default_evaluator_id = $1 where criterion_id = $2", [principal, c]);
  const evAntigo = await openEvent(atual, [c], "Evento principal antigo R2");
  const evArea = await openEvent(cicloArea, [c], "Evento principal por área R2", "2025-09-20");
  const nAntigo = await h.fx.evaluation({ eventId: evAntigo, criterionId: c, evaluatorUserId: outro, score: 8 });
  const nArea = await h.fx.evaluation({ eventId: evArea, criterionId: c, evaluatorUserId: outro, score: 8 });
  const r = await h.api("GET", "/evaluations", as(principal));
  const ids = r.data.map((e: { id: number }) => e.id);
  assert.ok(ids.includes(nAntigo), "fluxo antigo: principal vê a área dele");
  assert.ok(!ids.includes(nArea), "ciclo por área: vale a área do cadastro");
});

// ── Dashboard: pendentes ────────────────────────────────────────────────────
test("Dashboard: evento aberto para avaliação SEM nenhuma nota é pendente; evento futuro não conta", async () => {
  const before = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
  const c = await h.fx.criterion({ name: "Crit pendente R2" });
  await openEvent(atual, [c], "Evento sem nota R2", "2026-09-14");
  const mid = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
  assert.equal(mid.pendingEvaluations, before.pendingEvaluations + 1, "sem nota nenhuma = pendente");
  await openEvent(atual, [c], "Evento futuro R2", "2026-12-20");
  const after = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
  assert.equal(after.pendingEvaluations, mid.pendingEvaluations, "ainda não abriu (dia seguinte ao evento)");
});

// ── B2 ──────────────────────────────────────────────────────────────────────
test("B2: rascunho órfão (modo por área) não deixa evento pendente; o dono pode apagá-lo", async () => {
  await h.sql("update cycles set area_evaluation = true where id = $1", [atual]);
  try {
    const c = await criterionIn(areaA, "Crit B2 R2");
    const ev = await openEvent(atual, [c], "Evento B2 R2", "2026-09-12");
    await h.fx.evaluation({ eventId: ev, criterionId: c, evaluatorUserId: ana, score: 8 });
    const mid = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
    const midDrafts = (await h.api("GET", "/analytics/overview", { role: "admin" })).data.kpis.evaluationsDraft;
    const orfao = await h.fx.evaluation({ eventId: ev, criterionId: c, evaluatorUserId: bia, score: 4, status: "draft" });
    const after = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
    assert.equal(after.pendingEvaluations, mid.pendingEvaluations);
    assert.ok(!after.eventsWithPendencies.some((e: { eventId: number }) => e.eventId === ev));
    assert.equal((await h.api("GET", "/analytics/overview", { role: "admin" })).data.kpis.evaluationsDraft, midDrafts, "órfão não conta como rascunho");

    assert.equal((await h.api("DELETE", `/evaluations/${orfao}`, as(caio))).status, 403, "rascunho de outra pessoa");
    assert.equal((await h.api("DELETE", `/evaluations/${orfao}`, as(bia))).status, 200);
    assert.equal((await h.sql("select id from evaluations where id = $1", [orfao])).length, 0);
    const enviada = await h.one("select id from evaluations where event_id = $1 and evaluator_user_id = $2", [ev, ana]);
    assert.equal((await h.api("DELETE", `/evaluations/${enviada.id}`, as(ana))).status, 409, "enviada não se apaga");
  } finally {
    await h.sql("update cycles set area_evaluation = false where id = $1", [atual]);
  }
});

// ── B5 ──────────────────────────────────────────────────────────────────────
test("B5: 'Respondido por' pelo vínculo exato do envio, sem janela de 5 s; migração 0011 aplicada", async () => {
  assert.equal((await h.sql("select 1 from information_schema.columns where table_name = 'evaluations' and column_name = 'public_token_id'")).length, 1);
  assert.equal((await h.sql("select 1 from pg_indexes where indexname = 'public_eval_tokens_event_creator_idx'")).length, 1);

  const [c1, c2, c3] = [await h.fx.criterion({ name: "Crit B5 a", allowPublicLink: true }), await h.fx.criterion({ name: "Crit B5 b", allowPublicLink: true }), await h.fx.criterion({ name: "Crit B5 c", allowPublicLink: true })];
  const ev = await openEvent(atual, [c1, c2, c3], "Evento B5 R2", "2026-09-15");
  for (const c of [c1, c2, c3]) await h.fx.criterionAssignment({ eventId: ev, criterionId: c, assignedToId: aval });

  // Envio real pelo link: grava o vínculo explícito.
  const t = await token(ev, aval, "criteria", [c1]);
  const s = await h.api("POST", `/public-eval/${t}/submit`, { body: { submitterName: "Freela Exato", evaluations: [{ criterionId: c1, score: 8, comments: "ok" }] } });
  assert.equal(s.status, 200, JSON.stringify(s.data));
  assert.equal((await h.one("select public_token_id from evaluations where event_id = $1 and criterion_id = $2", [ev, c1])).public_token_id, t);

  // Envio antigo (antes da 0011): a própria 0011 liga ao link (backfill —
  // ver review-2026-10-06-r3, M2). Aqui: dado antigo + a migração aplicada.
  const t3 = await token(ev, aval, "criteria", [c3]);
  await h.sql("update public_eval_tokens set used_at = '2026-09-16T10:00:00Z', submitter_name = 'Freela Antigo' where id = $1", [t3]);
  await h.sql("insert into evaluations (event_id, criterion_id, evaluator_user_id, score, status, submitted_at) values ($1, $2, $3, 6, 'submitted', '2026-09-16T10:00:01Z')", [ev, c3, aval]);
  const fs = await import("node:fs");
  const migration = fs.readFileSync(new URL("../../../../lib/db/migrations/0011_review_round2.sql", import.meta.url), "utf8");
  await h.sql(migration.split("--> statement-breakpoint").map(x => x.trim()).filter(x => x.includes("UPDATE \"evaluations\""))[0]);
  // Envio pela TELA (depois da 0011) 2 s depois de um link usado que cobre o
  // critério: sem vínculo explícito, nunca é atribuído ao freela.
  const t2 = await token(ev, aval, "criteria", [c2]);
  await h.sql("update public_eval_tokens set used_at = now(), submitter_name = 'Freela Errado' where id = $1", [t2]);
  await h.sql("insert into evaluations (event_id, criterion_id, evaluator_user_id, score, status, submitted_at) values ($1, $2, $3, 7, 'submitted', now() + interval '2 seconds')", [ev, c2, aval]);

  const list = (await h.api("GET", `/evaluations?eventId=${ev}`, { role: "admin" })).data as { criterionId: number; evaluatorName: string }[];
  const nameOf = (c: number) => list.find(e => e.criterionId === c)?.evaluatorName;
  assert.equal(nameOf(c1), "Freela Exato");
  assert.equal(nameOf(c2), "Avaliador Link R2", "envio pela tela não é atribuído ao freela");
  assert.equal(nameOf(c3), "Freela Antigo");
});

// ── B6 ──────────────────────────────────────────────────────────────────────
test("B6: matriz pela tela e pelo link ao mesmo tempo — os dois gravam, sem 500", async () => {
  const ev = await openEvent(atual, [critLink], "Evento B6 R2", "2026-09-16");
  const f = await token(ev, aval, "conformity_ferramentas");
  const [tela, link] = await Promise.all([
    h.api("POST", `/events/${ev}/conformity`, { role: "admin", body: { epi: true, estaiamentos: true } }),
    h.api("POST", `/public-eval/${f}/submit-conformity`, { body: { submitterName: "Ferr B6", guardaEquipamentos: true } }),
  ]);
  assert.ok([200, 201].includes(tela.status), JSON.stringify(tela.data));
  assert.equal(link.status, 200, JSON.stringify(link.data));
  const row = await h.one("select epi, estaiamentos, guarda_equipamentos from event_conformities where event_id = $1", [ev]);
  assert.deepEqual([row.epi, row.estaiamentos, row.guarda_equipamentos], [true, true, true]);
});

// ── Contagem de eventos ─────────────────────────────────────────────────────
test("Contagem: stats.eventsStored = GET /events do ciclo = eventsTotal + eventsAfterEnd", async () => {
  const cycles = (await h.api("GET", "/cycles", { role: "admin" })).data as { id: number; stats: { eventsTotal: number; eventsAfterEnd: number; eventsStored: number } }[];
  for (const id of [atual, fechado]) {
    const s = cycles.find(c => c.id === id)!.stats;
    const list = (await h.api("GET", `/events?cycleId=${id}`, { role: "admin" })).data as unknown[];
    assert.equal(s.eventsStored, list.length);
    assert.equal(s.eventsTotal + s.eventsAfterEnd, s.eventsStored);
  }
  assert.ok(cycles.find(c => c.id === fechado)!.stats.eventsAfterEnd >= 1);
});

// ── M3 ──────────────────────────────────────────────────────────────────────
test("M3: Total geral do Dashboard e de Análises = a conta de /ranking/total (ponderada; oficial × projetado)", async () => {
  const upsert = (cycleId: number, final: number, events: number, bonus: number) => h.sql(
    `insert into quarterly_results (employee_id, cycle_id, final_result, events_count, participated_events_count, eligible, bonus_value)
     values ($1, $2, $3, $4, $4, true, $5)
     on conflict (employee_id, cycle_id) do update set final_result = excluded.final_result, events_count = excluded.events_count,
       participated_events_count = excluded.participated_events_count, eligible = true, bonus_value = excluded.bonus_value`,
    [empAna, cycleId, final, events, bonus]);
  await upsert(fechado, 80, 3, 2200);
  await upsert(atual, 90, 1, 2700);

  const total = (await h.api("GET", "/ranking/total", { role: "admin" })).data as { rows: { employeeId: number; avgFinalResult: number | null; bonusOfficial: number; bonusProjected: number }[] };
  const rowAna = total.rows.find(r => r.employeeId === empAna)!;
  assert.equal(rowAna.avgFinalResult, 82.5, "(80×3 + 90×1) ÷ 4 — não a média simples 85");
  assert.equal(rowAna.bonusOfficial, 2200);
  assert.equal(rowAna.bonusProjected, 2700);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  // D4: o KPI único do Total geral vem pronto em /ranking/total (summary).
  const expectedAvg = (total as unknown as { summary: { avgFinalResult: number | null } }).summary.avgFinalResult;
  assert.ok(expectedAvg != null);
  const expectedOfficial = r2(total.rows.reduce((s, r) => s + r.bonusOfficial, 0));
  const expectedProjected = r2(total.rows.reduce((s, r) => s + r.bonusProjected, 0));

  const dash = (await h.api("GET", "/dashboard/summary?cycleId=all", { role: "admin" })).data;
  assert.equal(dash.quarterAverage, expectedAvg);
  assert.equal(dash.bonusOfficial, expectedOfficial);
  assert.equal(dash.bonusProjected, expectedProjected);
  assert.equal(dash.totalBonusPreview, r2(expectedOfficial + expectedProjected));

  const an = (await h.api("GET", "/analytics/overview?cycleId=all", { role: "admin" })).data.kpis;
  assert.equal(an.avgFinalResult, expectedAvg);
  assert.equal(an.bonusOfficial, expectedOfficial);
  assert.equal(an.bonusProjected, expectedProjected);

  // Um ciclo aberto: tudo é projeção.
  const um = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data;
  assert.equal(um.bonusOfficial, 0);
  assert.equal(um.bonusProjected, um.totalBonusPreview);
});

// ── Evolução de Performance ─────────────────────────────────────────────────
test("Evolução de Performance: ciclos em ordem de data de início (não de id)", async () => {
  // "Ciclo antigo R2" foi cadastrado DEPOIS do fechado, mas começa antes.
  await h.sql("insert into quarterly_results (employee_id, cycle_id, final_result, events_count) values ($1, $2, 70, 1) on conflict do nothing", [empAna, cicloAntigo]);
  // A evolução usa o recorte do Ranking: quem tem resultado participou de evento do ciclo.
  await h.fx.event({ cycleId: cicloAntigo, date: "2020-02-10", status: "closed", resultsConfirmed: true, name: "Evento ciclo antigo R2", participants: [empAna] });
  const pts = (await h.api("GET", "/dashboard/quarterly-evolution", { role: "admin" })).data as { cycleId: number }[];
  const starts = new Map(((await h.api("GET", "/cycles/options", { role: "admin" })).data as { id: number; startDate: string }[]).map(c => [c.id, c.startDate]));
  const ids = pts.map(p => p.cycleId);
  assert.ok(ids.indexOf(cicloAntigo) >= 0 && ids.indexOf(cicloAntigo) < ids.indexOf(fechado));
  const dates = ids.map(id => starts.get(id)!);
  assert.deepEqual(dates, [...dates].sort());
});

// ── M2 (por último: fecha o ciclo atual e cria o próximo) ───────────────────
test("M2: novo ciclo leva TODO evento depois do fim do anterior (com faltas) e avisa os fora do período novo", async () => {
  const c = await h.fx.criterion({ name: "Crit M2 R2" });
  const jan = await h.fx.event({ cycleId: atual, date: "2027-01-10", status: "open", resultsConfirmed: false, criteria: [c], name: "Evento M2 janeiro" });
  const mai = await h.fx.event({ cycleId: atual, date: "2027-05-10", status: "open", resultsConfirmed: false, criteria: [c], name: "Evento M2 maio" });
  const rh = await h.ensureUser("rh");
  const falta = await h.fx.absence({ employeeId: empAna, cycleId: atual, userId: rh, date: "2027-05-10" });
  await h.sql("update absences set event_id = $1 where id = $2", [mai, falta]);
  await h.sql("update cycles set status = 'closed' where id = $1", [atual]);

  const r = await h.api("POST", "/cycles", { role: "admin", body: { name: "Ciclo novo R2", startDate: "2027-01-01", endDate: "2027-03-31" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const moved = new Map((r.data.movedEvents as { id: number; outsidePeriod: boolean }[]).map(e => [e.id, e]));
  assert.equal(moved.get(jan)?.outsidePeriod, false);
  assert.equal(moved.get(mai)?.outsidePeriod, true, "maio veio junto, mesmo fora do período novo");
  assert.ok(r.data.warnings.some((w: string) => w.includes("Evento M2 maio")));
  assert.equal((await h.one("select cycle_id from events where id = $1", [mai])).cycle_id, r.data.id);
  assert.equal((await h.one("select cycle_id from absences where id = $1", [falta])).cycle_id, r.data.id, "falta ligada vai junto");
  assert.ok(!moved.has(evAtual), "evento do período do ciclo anterior fica nele");
});
