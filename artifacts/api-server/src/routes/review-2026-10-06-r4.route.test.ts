// Regressões da 4ª rodada de revisão do BACKEND (06/10/2026). Um teste por
// achado, com o cenário que o revisor provou: A1 (designação de outra área no
// ciclo por área), M1 (caminho "disfarçado" × trava de ciclo fechado), M2 (só
// o papel avaliador avalia no ciclo por área), M3 (regra única de "aberto" na
// tela do avaliador e no Dashboard), M4 (manutenções × ciclo fechado), M5
// (avaliador "principal" no ciclo por área), B1 (permissão antes de gravar a
// designação), B2 (troca da avaliação por área × envio), B3 (link só grava
// critério ativo), B4 (backfill da 0011 × envio pela tela), B5 (403
// EVALUATOR_SCOPE documentado) e o campo novo `upcoming` de /evaluations/my-area.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;

let fechado: number, atual: number, areaCycle: number;
let areaA: number, areaB: number;
let adminU: number, rhU: number, ana: number, bia: number, beto: number;
let critA: number, critB: number;
let evFechado: number, evNextC: number, evIn: number, evArea: number, evArea2: number;

async function user(name: string, role: string, areaId: number | null) {
  return (await h.one("insert into users (name, password_hash, role, area_id) values ($1, 'x', $2, $3) returning id", [name, role, areaId])).id as number;
}
const as = (userId: number, role = "avaliador") => ({ role, userId });

async function criterionIn(area: number | null, name: string, allowPublicLink: boolean | null = null) {
  const id = await h.fx.criterion({ name, allowPublicLink });
  if (area != null) await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

async function openEvent(cycleId: number, criteria: number[], name: string, date: string, confirmed = true) {
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria, name, date });
  if (confirmed) await h.sql("update events set criteria_confirmed = true where id = $1", [eventId]);
  return eventId;
}

async function token(eventId: number, createdBy: number, criteria: number[]) {
  const id = `r4-${Math.random().toString(36).slice(2, 10)}`;
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ($1, $2, $3, 'Freela', 'criteria')", [id, eventId, createdBy]);
  for (const c of criteria) await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ($1, $2)", [id, c]);
  return id;
}

/** Hoje em Brasília e soma de dias (AAAA-MM-DD). */
const todayBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** "%3X%3Y…": o id do evento com cada dígito codificado. */
const enc = (n: number) => String(n).split("").map(d => `%3${d}`).join("");

const MIGRATION_0011 = fs.readFileSync(new URL("../../../../lib/db/migrations/0011_review_round2.sql", import.meta.url), "utf8");
const BACKFILL_0011 = MIGRATION_0011.split("--> statement-breakpoint").map(x => x.trim()).find(x => x.includes("UPDATE \"evaluations\""))!;
const OPENAPI = fs.readFileSync(new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
const ADMIN_BLOCK_MSG = "No ciclo por área, só o avaliador da área responde. Ajustes de nota são feitos na Calibração.";

before(async () => {
  h = await startApi();
  await h.fx.platoonRules2026();
  const mkArea = async (name: string) => (await h.one("insert into areas (name, active) values ($1, true) returning id", [name])).id as number;
  areaA = await mkArea("Área A (R4)");
  areaB = await mkArea("Área B (R4)");
  adminU = await user("Admin R4", "admin", null);
  rhU = await user("RH R4", "rh", null);
  ana = await user("Ana R4", "avaliador", areaA);
  bia = await user("Bia R4", "avaliador", areaA);
  beto = await user("Beto R4", "avaliador", areaB);

  fechado = await h.fx.cycle({ name: "Fechado R4", startDate: "2025-01-01", endDate: "2025-06-30", status: "closed", isCurrent: false });
  areaCycle = await h.fx.cycle({ name: "Por área R4", startDate: "2024-01-01", endDate: "2024-12-31", isCurrent: false });
  await h.sql("update cycles set area_evaluation = true where id = $1", [areaCycle]);
  atual = await h.fx.cycle({ name: "Atual R4", startDate: "2025-07-01", endDate: "2099-12-31" });

  critA = await criterionIn(areaA, "Crit A R4", true);
  critB = await criterionIn(areaB, "Crit B R4", true);
  // Evento de ciclo FECHADO ainda com status "open" (ninguém o encerrou).
  evFechado = await openEvent(fechado, [critA], "Evento fechado R4", "2025-03-01");
  // Começa depois do fim do ciclo fechado: é do PRÓXIMO ciclo (não travado).
  evNextC = await openEvent(fechado, [critA], "Evento próximo ciclo R4", "2025-08-01", false);
  evIn = await openEvent(atual, [critA, critB], "Evento dentro R4", "2026-09-20");
  evArea = await openEvent(areaCycle, [critA, critB], "Evento por área R4", "2024-05-01");
  evArea2 = await openEvent(areaCycle, [critA, critB], "Evento por área 2 R4", "2024-05-02");
});
after(async () => { await h?.close(); });

// ── A1 ──────────────────────────────────────────────────────────────────────
test("A1: ciclo por área — designação para OUTRA área não dá visibilidade (lista e áudio) e PUT /assignments recusa (409 AREA_MODE_OTHER_AREA)", async () => {
  // Beto (área B) enviou com áudio; Ana (área A) foi designada para a área B no evento.
  const notaB = await h.fx.evaluation({ eventId: evArea, criterionId: critB, evaluatorUserId: beto, score: 7 });
  await h.sql("update evaluations set audio_url = '/objects/uploads/r4-audio-area-b' where id = $1", [notaB]);
  await h.sql("insert into event_area_assignments (event_id, area_id, evaluator_user_id) values ($1, $2, $3)", [evArea, areaB, ana]);
  const lista = (await h.api("GET", `/evaluations?eventId=${evArea}`, as(ana))).data as { criterionId: number }[];
  assert.ok(lista.every(e => e.criterionId !== critB), "nota da área B não aparece no ciclo por área");
  assert.equal((await h.api("GET", "/storage/objects/uploads/r4-audio-area-b", as(ana))).status, 403);

  // Fluxo antigo (ciclo sem a marca): a designação de área continua valendo.
  const notaBIn = await h.fx.evaluation({ eventId: evIn, criterionId: critB, evaluatorUserId: beto, score: 7 });
  await h.sql("update evaluations set audio_url = '/objects/uploads/r4-audio-in-b' where id = $1", [notaBIn]);
  await h.sql("insert into event_area_assignments (event_id, area_id, evaluator_user_id) values ($1, $2, $3)", [evIn, areaB, ana]);
  const listaIn = (await h.api("GET", `/evaluations?eventId=${evIn}`, as(ana))).data as { criterionId: number }[];
  assert.ok(listaIn.some(e => e.criterionId === critB));
  assert.notEqual((await h.api("GET", "/storage/objects/uploads/r4-audio-in-b", as(ana))).status, 403);
  await h.sql("delete from event_area_assignments where event_id = $1", [evIn]);
  await h.sql("delete from evaluations where id = $1", [notaBIn]);

  // PUT /events/:id/assignments: Ana (área A) na área B → 409; na própria área → 200.
  const put = (areaId: number) => h.api("PUT", `/events/${evArea2}/assignments`, { role: "admin", body: { assignments: [{ areaId, evaluatorUserIds: [ana] }] } });
  const r = await put(areaB);
  assert.equal(r.status, 409, JSON.stringify(r.data));
  assert.equal(r.data.code, "AREA_MODE_OTHER_AREA");
  assert.equal((await h.sql("select id from event_area_assignments where event_id = $1", [evArea2])).length, 0);
  assert.equal((await put(areaA)).status, 200);
  await h.sql("delete from event_area_assignments where event_id = $1", [evArea2]);
});

// ── M1 ──────────────────────────────────────────────────────────────────────
test("M1: caminho com maiúsculas ou codificado não escapa da trava (ciclo fechado e próximo ciclo → 409); id disfarçado ou URI malformada → 400", async () => {
  const expect409 = async (method: string, url: string, body: unknown, code: string) => {
    const r = await h.api(method, url, { role: "admin", body });
    assert.equal(r.status, 409, `${method} ${url} → ${r.status} ${JSON.stringify(r.data)}`);
    assert.equal(r.data.code, code);
  };
  const nota = { eventId: evFechado, criterionId: critA, score: 8, comments: "x" };
  await expect409("POST", "/Evaluations", nota, "CLOSED_CYCLE");
  await expect409("POST", `/events/${enc(evFechado)}/conformity`, { epi: true }, "CLOSED_CYCLE");
  await expect409("PUT", `/EVENTS/${evFechado}/criteria`, { criteria: [{ criterionId: critA, active: true }] }, "CLOSED_CYCLE");
  await expect409("PATCH", `/Events/${enc(evFechado)}`, { name: "Mudou" }, "CLOSED_CYCLE");
  // Evento do próximo ciclo: avaliação e matriz recusadas pelo caminho disfarçado também.
  await expect409("POST", "/EVALUATIONS", { ...nota, eventId: evNextC }, "EVENT_NEXT_CYCLE");
  await expect409("POST", `/events/${enc(evNextC)}/conformity`, { epi: true }, "EVENT_NEXT_CYCLE");
  // Id "quase numérico" (o parseInt da rota leria o evento) e URI malformada.
  assert.equal((await h.api("PATCH", `/events/${evFechado}abc`, { role: "admin", body: { name: "Mudou" } })).status, 400);
  assert.equal((await h.api("PATCH", `/events/%20${evFechado}`, { role: "admin", body: { name: "Mudou" } })).status, 400);
  assert.equal((await h.api("PATCH", "/events/%E0%A4%A", { role: "admin", body: { name: "Mudou" } })).status, 400);

  assert.equal((await h.sql("select id from evaluations where event_id = any($1)", [[evFechado, evNextC]])).length, 0);
  assert.equal((await h.one("select name from events where id = $1", [evFechado])).name, "Evento fechado R4");
  assert.equal((await h.sql("select id from event_conformities where event_id = any($1)", [[evFechado, evNextC]])).length, 0);
  // O escopo do avaliador casa o caminho exato e nega o resto (nunca libera).
  const esc = await h.api("POST", "/Evaluations", { ...as(ana), body: nota });
  assert.equal(esc.status, 403);
  assert.equal(esc.data.code, "EVALUATOR_SCOPE");
});

// ── M2 ──────────────────────────────────────────────────────────────────────
test("M2: ciclo por área — admin e RH não lançam/editam/enviam avaliação de critério (403 AREA_MODE_EVALUATOR_ONLY); avaliador da área e link do admin seguem", async () => {
  const expect403 = (r: { status: number; data: { code?: string; error?: string } }) => {
    assert.equal(r.status, 403, JSON.stringify(r.data));
    assert.equal(r.data.code, "AREA_MODE_EVALUATOR_ONLY");
    assert.equal(r.data.error, ADMIN_BLOCK_MSG);
  };
  const body = { eventId: evArea, criterionId: critA, score: 8, comments: "x" };
  expect403(await h.api("POST", "/evaluations", { role: "admin", userId: adminU, body }));
  expect403(await h.api("POST", "/evaluations", { role: "rh", userId: rhU, body }));
  // Rascunho que já existia (de admin, de antes da regra, e da Ana).
  const doAdmin = await h.fx.evaluation({ eventId: evArea, criterionId: critA, evaluatorUserId: adminU, score: 5, status: "draft" });
  await h.sql("update evaluations set comments = 'antigo' where id = $1", [doAdmin]);
  expect403(await h.api("PATCH", `/evaluations/${doAdmin}`, { role: "admin", userId: adminU, body: { score: 6 } }));
  expect403(await h.api("POST", `/evaluations/${doAdmin}/submit`, { role: "admin", userId: adminU }));
  const daAna = await h.fx.evaluation({ eventId: evArea, criterionId: critA, evaluatorUserId: ana, score: 6, status: "draft" });
  await h.sql("update evaluations set comments = 'ok' where id = $1", [daAna]);
  expect403(await h.api("PATCH", `/evaluations/${daAna}`, { role: "rh", userId: rhU, body: { score: 9 } }));
  expect403(await h.api("POST", `/evaluations/${daAna}/submit`, { role: "rh", userId: rhU }));
  assert.equal((await h.one("select status from evaluations where id = $1", [doAdmin])).status, "draft");
  await h.sql("delete from evaluations where id = $1", [doAdmin]);

  // O avaliador da área responde normalmente.
  assert.equal((await h.api("PATCH", `/evaluations/${daAna}`, { ...as(ana), body: { score: 9 } })).status, 200);
  assert.equal((await h.api("POST", `/evaluations/${daAna}/submit`, as(ana))).status, 200);
  // Papel sem avaliação (diretoria) nem chega na regra: 403 de papel.
  assert.equal((await h.api("PATCH", `/evaluations/${daAna}`, { role: "diretoria", body: { score: 1 } })).status, 403);

  // Link de freela gerado pelo admin EM NOME de um avaliador da área (o
  // token responde por quem o recebeu — rota admin-public-token) continua
  // valendo no ciclo por área. Em nome do próprio admin, não (5ª revisão, A1).
  const tAdmin = await token(evArea2, adminU, [critA]);
  assert.equal((await h.api("POST", `/public-eval/${tAdmin}/submit`, { body: { submitterName: "Freela M2", evaluations: [{ criterionId: critA, score: 8, comments: "ok" }] } })).status, 409);
  const t = await token(evArea2, bia, [critA]);
  const link = await h.api("POST", `/public-eval/${t}/submit`, { body: { submitterName: "Freela M2", evaluations: [{ criterionId: critA, score: 8, comments: "ok" }] } });
  assert.equal(link.status, 200, JSON.stringify(link.data));
  assert.deepEqual(link.data.saved, [critA]);

  // Fluxo antigo: admin segue lançando.
  const antigo = await h.api("POST", "/evaluations", { role: "admin", userId: adminU, body: { eventId: evIn, criterionId: critA, score: 8, comments: "x" } });
  assert.equal(antigo.status, 201, JSON.stringify(antigo.data));
  await h.sql("delete from evaluations where id = $1", [antigo.data.id]);
});

// ── M3 ──────────────────────────────────────────────────────────────────────
test("M3: regra única de 'aberto' — ciclo fechado nada pendente (my-area e Dashboard); evento encerrado não conta como pendente", async () => {
  // my-area: evento de ciclo fechado com critério sem resposta não é pendente.
  const admin = (await h.api("GET", `/evaluations/my-area?eventId=${evFechado}&areaId=${areaA}`, { role: "admin" })).data;
  assert.equal(admin.events.length, 1);
  assert.equal(admin.events[0].openCount, 1);
  assert.equal(admin.events[0].pending, false);
  assert.equal(admin.totals.pending, 0);
  await h.fx.criterionAssignment({ eventId: evFechado, criterionId: critA, assignedToId: ana });
  const daAna = (await h.api("GET", `/evaluations/my-area?eventId=${evFechado}`, as(ana))).data;
  assert.equal(daAna.events.length, 1);
  assert.equal(daAna.events[0].pending, false);

  // Dashboard do ciclo fechado: nenhum pendente.
  const dashFechado = (await h.api("GET", `/dashboard/summary?cycleId=${fechado}`, { role: "admin" })).data;
  assert.equal(dashFechado.pendingEvaluations, 0);
  assert.equal(dashFechado.eventsWithPendencies.length, 0);

  // Ciclo atual: o mesmo evento sem nota é pendente aberto e deixa de ser quando encerrado.
  const ev = await openEvent(atual, [critA], "Evento encerrado R4", "2026-09-02");
  const p1 = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data.pendingEvaluations as number;
  await h.sql("update events set status = 'closed' where id = $1", [ev]);
  const p2 = (await h.api("GET", "/dashboard/summary", { role: "admin" })).data.pendingEvaluations as number;
  assert.equal(p2, p1 - 1, "evento encerrado não é pendente");
  const mine = (await h.api("GET", `/evaluations/my-area?eventId=${ev}&areaId=${areaA}`, { role: "admin" })).data;
  assert.equal(mine.events[0].pending, false);
  await h.sql("delete from event_criteria where event_id = $1", [ev]);
  await h.sql("delete from events where id = $1", [ev]);
});

// ── M5 ──────────────────────────────────────────────────────────────────────
test("M5: ciclo por área — ser 'principal' da área não mostra nem atribui (GET e PATCH assign); papel com maiúscula não vê tudo", async () => {
  // Ana (área A) é a avaliadora PRINCIPAL dos critérios da área B (roteamento).
  await h.sql("update criterion_routing set default_evaluator_id = $1 where criterion_id = $2", [ana, critB]);
  try {
    await h.fx.criterionAssignment({ eventId: evArea2, criterionId: critB, assignedToId: beto });
    for (const role of ["avaliador", "Avaliador"]) {
      const asg = (await h.api("GET", `/events/${evArea2}/criterion-assignments`, { role, userId: ana })).data as { criterionId: number }[];
      assert.ok(Array.isArray(asg), JSON.stringify(asg));
      assert.ok(asg.every(a => a.criterionId !== critB), `${role}: ${JSON.stringify(asg)}`);
    }
    const r = await h.api("PATCH", `/events/${evArea2}/criterion-assignments/${critB}`, { ...as(ana), body: { action: "assign", assignedToId: beto } });
    assert.equal(r.status, 403, JSON.stringify(r.data));
    assert.equal((await h.api("GET", `/events/${evArea2}/criterion-assignments/redirect-options/${critB}`, as(ana))).status, 403);

    // Fluxo antigo: a principal vê e atribui.
    const asgIn = (await h.api("GET", `/events/${evIn}/criterion-assignments`, as(ana))).data as { criterionId: number }[];
    assert.ok(asgIn.some(a => a.criterionId === critB));
    const ok = await h.api("PATCH", `/events/${evIn}/criterion-assignments/${critB}`, { ...as(ana), body: { action: "assign", assignedToId: beto } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
  } finally {
    await h.sql("update criterion_routing set default_evaluator_id = null where criterion_id = $1", [critB]);
    await h.sql("delete from event_criterion_assignments where event_id = any($1) and criterion_id = $2", [[evArea2, evIn], critB]);
  }
});

// ── B1 ──────────────────────────────────────────────────────────────────────
test("B1: PATCH de designação sem permissão → 403 SEM criar a linha de designação", async () => {
  const count = async () => (await h.sql("select id from event_criterion_assignments where event_id = $1 and criterion_id = $2", [evIn, critA])).length;
  assert.equal(await count(), 0);
  const redirect = await h.api("PATCH", `/events/${evIn}/criterion-assignments/${critA}`, { ...as(bia), body: { action: "redirect", assignedToId: ana } });
  assert.equal(redirect.status, 403, JSON.stringify(redirect.data));
  const assign = await h.api("PATCH", `/events/${evIn}/criterion-assignments/${critA}`, { ...as(bia), body: { action: "assign", assignedToId: ana } });
  assert.equal(assign.status, 403);
  const confirm = await h.api("PATCH", `/events/${evIn}/criterion-assignments/${critA}`, { ...as(bia), body: { assignedToId: bia } });
  assert.equal(confirm.status, 403);
  assert.equal(await count(), 0, "nenhuma linha criada por quem recebeu 403");
  // Com permissão (admin), a linha é criada na hora, como antes.
  assert.equal((await h.api("PATCH", `/events/${evIn}/criterion-assignments/${critA}`, { role: "admin", body: { assignedToId: ana } })).status, 200);
  assert.equal(await count(), 1);
  await h.sql("delete from event_criterion_assignments where event_id = $1 and criterion_id = $2", [evIn, critA]);
});

// ── B2 ──────────────────────────────────────────────────────────────────────
test("B2: troca da avaliação por área no ciclo é atômica com o envio — rascunho não impede; o envio segue a regra nova; com envio, a troca é recusada", async () => {
  const ciclo = await h.fx.cycle({ name: "B2 R4", startDate: "2023-01-01", endDate: "2023-12-31", isCurrent: false });
  const ev = await openEvent(ciclo, [critA], "Evento B2 R4", "2023-05-01");
  const doAdmin = await h.api("POST", "/evaluations", { role: "admin", userId: adminU, body: { eventId: ev, criterionId: critA, score: 7, comments: "x" } });
  assert.equal(doAdmin.status, 201, JSON.stringify(doAdmin.data));
  const daAna = await h.fx.evaluation({ eventId: ev, criterionId: critA, evaluatorUserId: ana, score: 8, status: "draft" });
  await h.sql("update evaluations set comments = 'ok' where id = $1", [daAna]);

  // Só rascunhos: a troca passa.
  const on = await h.api("PATCH", `/cycles/${ciclo}`, { role: "admin", body: { areaEvaluation: true } });
  assert.equal(on.status, 200, JSON.stringify(on.data));
  // O envio confere a regra JÁ gravada (dentro da transação, com o ciclo travado).
  const sub = await h.api("POST", `/evaluations/${doAdmin.data.id}/submit`, { role: "admin", userId: adminU });
  assert.equal(sub.status, 403);
  assert.equal(sub.data.code, "AREA_MODE_EVALUATOR_ONLY");
  assert.equal((await h.api("POST", `/evaluations/${daAna}/submit`, as(ana))).status, 200);
  // Com envio no ciclo, desligar é recusado.
  const off = await h.api("PATCH", `/cycles/${ciclo}`, { role: "admin", body: { areaEvaluation: false } });
  assert.equal(off.status, 409);
  assert.equal(off.data.code, "CYCLE_HAS_EVALUATIONS");
  assert.equal((await h.one("select area_evaluation from cycles where id = $1", [ciclo])).area_evaluation, true);
});

// ── B3 ──────────────────────────────────────────────────────────────────────
test("B3: link público só grava critério ATIVO no evento — desativado sai do GET e é ignorado com aviso; só desativados → 409 CRITERIA_INACTIVE", async () => {
  const ev = await openEvent(atual, [critA, critB], "Evento B3 R4", "2026-09-12");
  const t = await token(ev, adminU, [critA, critB]);
  await h.sql("update event_criteria set active = false where event_id = $1 and criterion_id = $2", [ev, critB]);

  const info = (await h.api("GET", `/public-eval/${t}`)).data;
  assert.deepEqual(info.criteria.map((c: { criterionId: number }) => c.criterionId), [critA]);

  const r = await h.api("POST", `/public-eval/${t}/submit`, { body: { submitterName: "Freela B3", evaluations: [
    { criterionId: critA, score: 8, comments: "ok" },
    { criterionId: critB, score: 7, comments: "ok" },
  ] } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.saved, [critA]);
  const rej = r.data.rejected.find((x: { criterionId: number }) => x.criterionId === critB);
  assert.ok(rej, JSON.stringify(r.data.rejected));
  assert.match(rej.reason, /desativado/);
  assert.equal((await h.sql("select id from evaluations where event_id = $1 and criterion_id = $2", [ev, critB])).length, 0);

  // O link que só cobria o critério desativado: nada a gravar, link sem uso.
  const t2 = await token(ev, adminU, [critB]);
  const r2 = await h.api("POST", `/public-eval/${t2}/submit`, { body: { submitterName: "Freela B3", evaluations: [{ criterionId: critB, score: 7, comments: "ok" }] } });
  assert.equal(r2.status, 409, JSON.stringify(r2.data));
  assert.equal(r2.data.code, "CRITERIA_INACTIVE");
  assert.equal((await h.one("select used_at from public_eval_tokens where id = $1", [t2])).used_at, null);
});

// ── B4 ──────────────────────────────────────────────────────────────────────
test("B4: backfill da 0011 não liga ao link a avaliação enviada pela TELA (auditoria do envio) até 5 s antes do uso do link", async () => {
  assert.match(MIGRATION_0011, /CASO-LIMITE DO BACKFILL/);
  const [c1, c2] = [await criterionIn(null, "B4 tela"), await criterionIn(null, "B4 link")];
  const ev = await openEvent(atual, [c1, c2], "Evento B4 R4", "2026-09-10");
  const used = async (c: number, name: string, at: string) => {
    const t = await token(ev, ana, [c]);
    await h.sql("update public_eval_tokens set used_at = $2, submitter_name = $3 where id = $1", [t, at, name]);
    return t;
  };
  const sent = async (c: number, at: string) => (await h.one(
    "insert into evaluations (event_id, criterion_id, evaluator_user_id, score, status, submitted_at, comments) values ($1, $2, $3, 8, 'submitted', $4, 'ok') returning id",
    [ev, c, ana, at])).id as number;
  // c1: a Ana enviou pela TELA às 10:00:00 (o envio pela tela grava a auditoria);
  // 3 s depois o freela usou um link dela que cobria o mesmo critério — o
  // código antigo pulava o critério já enviado.
  await used(c1, "Freela Errado", "2026-09-11T10:00:03Z");
  const pelaTela = await sent(c1, "2026-09-11T10:00:00Z");
  await h.sql("insert into audit_logs (user_id, action, entity, entity_id) values ($1, 'submit', 'evaluations', $2)", [ana, String(pelaTela)]);
  // c2: mesmo horário, enviado PELO link (sem auditoria de envio): liga.
  const t2 = await used(c2, "Freela Certo", "2026-09-11T11:00:03Z");
  await sent(c2, "2026-09-11T11:00:00Z");

  await h.sql(BACKFILL_0011);
  const link = async (c: number) => (await h.one("select public_token_id from evaluations where event_id = $1 and criterion_id = $2", [ev, c])).public_token_id;
  assert.equal(await link(c1), null, "enviada pela tela: nunca atribuída ao freela");
  assert.equal(await link(c2), t2);
});

// ── B5 ──────────────────────────────────────────────────────────────────────
test("B5: 403 EVALUATOR_SCOPE documentado no contrato e devolvido pela API", async () => {
  assert.match(OPENAPI, /ForbiddenError:[\s\S]*EVALUATOR_SCOPE[\s\S]*AREA_MODE_EVALUATOR_ONLY/);
  const r = await h.api("GET", "/events", as(ana));
  assert.equal(r.status, 403);
  assert.equal(r.data.code, "EVALUATOR_SCOPE");
});

// ── NOVO: upcoming ──────────────────────────────────────────────────────────
test("my-area devolve `upcoming`: eventos do ciclo atual do avaliador que ainda não abriram (ordem por opensOn, máx. 30); admin recebe []", async () => {
  const hoje = todayBR();
  const mk = async (name: string, start: string, end: string, criteria: number[], designate = true, status = "open") => {
    const id = await openEvent(atual, criteria, name, start, false);
    await h.sql("update events set end_date = $2, status = $3 where id = $1", [id, end, status]);
    if (designate) await h.fx.criterionAssignment({ eventId: id, criterionId: criteria[0], assignedToId: ana });
    return id;
  };
  const created: number[] = [];
  const longe = await mk("Próximo longe R4", addDays(hoje, 10), addDays(hoje, 10), [critA]);
  const varios = await mk("Próximo vários dias R4", addDays(hoje, 2), addDays(hoje, 3), [critA]);
  const hojeEv = await mk("Termina hoje R4", hoje, hoje, [critA]);
  const outraArea = await mk("Outra área R4", addDays(hoje, 5), addDays(hoje, 5), [critB], false);
  const encerrado = await mk("Encerrado futuro R4", addDays(hoje, 4), addDays(hoje, 4), [critA], true, "closed");
  const jaAbriu = await mk("Já abriu R4", addDays(hoje, -3), addDays(hoje, -2), [critA]);
  created.push(longe, varios, hojeEv, outraArea, encerrado, jaAbriu);
  try {
    const up = (await h.api("GET", "/evaluations/my-area", as(ana))).data.upcoming as { eventId: number; eventName: string; startDate: string; endDate: string; opensOn: string }[];
    const ids = up.map(e => e.eventId);
    assert.deepEqual(ids, [hojeEv, varios, longe], JSON.stringify(up));
    assert.deepEqual(up[1], { eventId: varios, eventName: "Próximo vários dias R4", startDate: addDays(hoje, 2), endDate: addDays(hoje, 3), opensOn: addDays(hoje, 4) });
    assert.equal(up[0].opensOn, addDays(hoje, 1));
    // Com filtros (eventId de outro evento), o upcoming é o mesmo.
    assert.deepEqual(((await h.api("GET", `/evaluations/my-area?eventId=${evIn}`, as(ana))).data.upcoming as { eventId: number }[]).map(e => e.eventId), ids);
    assert.deepEqual((await h.api("GET", `/evaluations/my-area?areaId=${areaA}`, { role: "admin" })).data.upcoming, []);
    assert.deepEqual((await h.api("GET", "/evaluations/my-area", as(beto))).data.upcoming.map((e: { eventId: number }) => e.eventId), [], "Beto não está designado (fluxo antigo)");

    // Máximo 30.
    for (let i = 0; i < 30; i++) created.push(await mk(`Lote ${i} R4`, addDays(hoje, 20), addDays(hoje, 20), [critA]));
    const cheio = (await h.api("GET", "/evaluations/my-area", as(ana))).data.upcoming as { eventId: number }[];
    assert.equal(cheio.length, 30);
    assert.deepEqual(cheio.slice(0, 3).map(e => e.eventId), [hojeEv, varios, longe]);
  } finally {
    await h.sql("delete from event_criterion_assignments where event_id = any($1)", [created]);
    await h.sql("delete from event_criteria where event_id = any($1)", [created]);
    await h.sql("delete from events where id = any($1)", [created]);
  }
});

// ── M4 (por último: mexe no catálogo global de critérios) ───────────────────
test("M4: manutenções de catálogo/calibração pulam eventos de ciclo fechado e devolvem skippedClosedCycle", async () => {
  const antigo = await criterionIn(null, "Qualidade e Acabamento da Montagem");
  const novo = await criterionIn(null, "Qualidade da Entrega");
  // fix-calibration-criteria
  const calFechado = await h.fx.calibration({ eventId: evFechado, criterionId: antigo, score: 8, userId: adminU });
  const calAberto = await h.fx.calibration({ eventId: evIn, criterionId: antigo, score: 8, userId: adminU });
  const fix = await h.api("POST", "/events/admin/fix-calibration-criteria", { role: "admin" });
  assert.equal(fix.status, 200, JSON.stringify(fix.data));
  assert.ok(fix.data.skippedClosedCycle.some((s: { eventId: number }) => s.eventId === evFechado), JSON.stringify(fix.data));
  const crit = async (id: number) => (await h.one("select criterion_id from calibrations where id = $1", [id])).criterion_id;
  assert.equal(await crit(calFechado), antigo, "calibração de ciclo fechado intacta");
  assert.equal(await crit(calAberto), novo);

  // migrate-criteria-catalog
  const evalFechado = await h.fx.evaluation({ eventId: evFechado, criterionId: antigo, evaluatorUserId: bia, score: 7 });
  const evalAberto = await h.fx.evaluation({ eventId: evIn, criterionId: antigo, evaluatorUserId: bia, score: 7 });
  const ecRows = async (ev: number) => (await h.sql("select criterion_id, active from event_criteria where event_id = $1 order by criterion_id", [ev]));
  const fechadoAntes = await ecRows(evFechado);
  const abertoAntes = (await ecRows(evIn)).length;
  const mig = await h.api("POST", "/integration/migrate-criteria-catalog", { role: "admin" });
  assert.equal(mig.status, 200, JSON.stringify(mig.data));
  assert.ok(mig.data.skippedClosedCycle.some((s: { eventId: number }) => s.eventId === evFechado), JSON.stringify(mig.data));
  assert.deepEqual(await ecRows(evFechado), fechadoAntes, "critérios do evento de ciclo fechado intactos");
  assert.ok((await ecRows(evIn)).length > abertoAntes, "evento do ciclo aberto recebeu o catálogo novo");
  const critOf = async (id: number) => (await h.one("select criterion_id from evaluations where id = $1", [id])).criterion_id;
  assert.equal(await critOf(evalFechado), antigo, "avaliação de ciclo fechado não é remapeada");
  assert.equal(await critOf(evalAberto), novo);
});
