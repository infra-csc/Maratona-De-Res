// Testes de rota (revisão 06/10 da avaliação por área):
//   link combinado de Cenografia (critérios + Matriz de Conformidade) nunca
//   sobrescreve a matriz e só sai pelas mãos do responsável dela (ou admin/RH);
//   trava "só a partir do dia seguinte ao evento" em TODAS as escritas e links
//   do avaliador — PATCH e envio de rascunho, links de matriz, link público
//   gerado por avaliador — sem travar admin/RH.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";
import { todayBR } from "../lib/evaluation-dates.js";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number, area: number;
let resp: number, colega: number;

const as = (userId: number, role = "avaliador") => ({ role, userId });
const dayOffset = (n: number) => { const d = new Date(`${todayBR()}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const conf = { epi: true, estaiamentos: true, conduta: true, absencesReport: "Ninguém faltou", standoutResponse: false };

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle({ name: "Ciclo links", startDate: "2020-01-01", endDate: "2099-12-31" });
  await h.sql("update cycles set area_evaluation = true where id = $1", [cycleId]);
  area = (await h.one("insert into areas (name, active) values ('Cenografia (teste)', true) returning id")).id;
  resp = (await h.one("insert into users (name, password_hash, role, area_id) values ('Rita Responsável', 'x', 'avaliador', $1) returning id", [area])).id;
  colega = (await h.one("insert into users (name, password_hash, role, area_id) values ('Caco Colega', 'x', 'avaliador', $1) returning id", [area])).id;
});
after(() => h?.close());

async function evento(date: string, criteria: number[], name: string) {
  const eventId = await h.fx.event({ cycleId, status: "open", resultsConfirmed: false, criteria, name, date });
  await h.sql("update events set criteria_confirmed = true, conformity_evaluator_user_id = $2 where id = $1", [eventId, resp]);
  return eventId;
}
async function criterio(name: string) {
  const id = await h.fx.criterion({ name, allowPublicLink: true });
  await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

test("link combinado: só o responsável pela matriz (ou admin/RH) inclui a matriz; matriz respondida → recusa ao gerar", async () => {
  const c = await criterio("Cenário combinado");
  const eventId = await evento(dayOffset(-2), [c], "Evento combinado");

  const colegaTenta = await h.api("POST", `/events/${eventId}/public-token`, { ...as(colega), body: { recipientName: "Fred", includeConformity: true } });
  assert.equal(colegaTenta.status, 403, JSON.stringify(colegaTenta.data));
  assert.match(colegaTenta.data.error, /responsável pela Matriz/);
  // Sem a matriz, o colega da área gera normalmente.
  assert.equal((await h.api("POST", `/events/${eventId}/public-token`, { ...as(colega), body: { recipientName: "Fred" } })).status, 200);

  await h.sql("insert into event_conformities (event_id, epi, estaiamentos, created_by_user_id, cenografia_submitted_by_name) values ($1, true, false, $2, 'Rita Responsável')", [eventId, resp]);
  const depois = await h.api("POST", `/events/${eventId}/public-token`, { ...as(resp), body: { recipientName: "Fred", includeConformity: true } });
  assert.equal(depois.status, 409, JSON.stringify(depois.data));
  assert.match(depois.data.error, /já foi respondida por Rita Responsável/);
});

test("link combinado: matriz respondida depois de gerar → critérios gravam, matriz é recusada com motivo e fica intacta", async () => {
  const c = await criterio("Montagem combinada");
  const eventId = await evento(dayOffset(-2), [c], "Evento matriz depois");
  const tok = await h.api("POST", `/events/${eventId}/public-token`, { ...as(resp), body: { recipientName: "Gil", includeConformity: true } });
  assert.equal(tok.status, 200, JSON.stringify(tok.data));
  assert.equal((await h.api("GET", `/public-eval/${tok.data.tokenId}`)).data.conformityAnswered, false);

  // O responsável responde a matriz pela tela enquanto o freela preenche.
  await h.sql("insert into event_conformities (event_id, epi, estaiamentos, standout_response, absences_report, created_by_user_id, cenografia_submitted_by_name) values ($1, false, false, true, 'Faltou o João', $2, 'Rita Responsável')", [eventId, resp]);
  const info = await h.api("GET", `/public-eval/${tok.data.tokenId}`);
  assert.equal(info.data.conformityAnswered, true);
  assert.equal(info.data.conformityAnsweredByName, "Rita Responsável");

  const envio = await h.api("POST", `/public-eval/${tok.data.tokenId}/submit`, {
    body: { submitterName: "Gil", evaluations: [{ criterionId: c, score: 8, comments: "ok" }], ...conf },
  });
  assert.equal(envio.status, 200, JSON.stringify(envio.data));
  assert.deepEqual(envio.data.saved, [c]);
  assert.equal(envio.data.conformitySaved, false);
  const recusa = envio.data.rejected.find((r: { kind: string }) => r.kind === "conformity");
  assert.ok(recusa, "a parte da matriz volta em rejected");
  assert.match(recusa.reason, /já foi respondida por Rita Responsável/);
  const [row] = await h.sql("select epi, estaiamentos, absences_report from event_conformities where event_id = $1", [eventId]);
  assert.equal(row.epi, false, "matriz não foi sobrescrita");
  assert.equal(row.absences_report, "Faltou o João");
});

test("link combinado: critérios todos fechados e matriz aberta → envia só a matriz; tudo respondido → 409 sem queimar o link", async () => {
  const c = await criterio("Acabamento combinado");
  const eventId = await evento(dayOffset(-2), [c], "Evento só matriz falta");
  const tok = await h.api("POST", `/events/${eventId}/public-token`, { ...as(resp), body: { recipientName: "Ivo", includeConformity: true } });
  assert.equal(tok.status, 200, JSON.stringify(tok.data));
  const d = await h.api("POST", "/evaluations", { ...as(colega), body: { eventId, criterionId: c, score: 7, comments: "pela tela" } });
  assert.equal((await h.api("POST", `/evaluations/${d.data.id}/submit`, as(colega))).status, 200);

  const info = await h.api("GET", `/public-eval/${tok.data.tokenId}`);
  assert.equal(info.data.allClosed, true);
  assert.equal(info.data.conformityAnswered, false);
  const soMatriz = await h.api("POST", `/public-eval/${tok.data.tokenId}/submit`, { body: { submitterName: "Ivo", evaluations: [], ...conf } });
  assert.equal(soMatriz.status, 200, JSON.stringify(soMatriz.data));
  assert.equal(soMatriz.data.conformitySaved, true);
  assert.deepEqual(soMatriz.data.saved, []);
  const [row] = await h.sql("select epi, cenografia_submitted_by_name from event_conformities where event_id = $1", [eventId]);
  assert.equal(row.epi, true);
  assert.equal(row.cenografia_submitted_by_name, "Ivo");

  // Outro evento: critério fechado E matriz respondida → nada a gravar.
  const c2 = await criterio("Pintura combinada");
  const ev2 = await evento(dayOffset(-2), [c2], "Evento tudo respondido");
  const tok2 = await h.api("POST", `/events/${ev2}/public-token`, { ...as(resp), body: { recipientName: "Ivo", includeConformity: true } });
  const d2 = await h.api("POST", "/evaluations", { ...as(colega), body: { eventId: ev2, criterionId: c2, score: 7, comments: "pela tela" } });
  await h.api("POST", `/evaluations/${d2.data.id}/submit`, as(colega));
  await h.sql("insert into event_conformities (event_id, epi, created_by_user_id) values ($1, true, $2)", [ev2, resp]);
  const nada = await h.api("POST", `/public-eval/${tok2.data.tokenId}/submit`, {
    body: { submitterName: "Ivo", evaluations: [{ criterionId: c2, score: 9, comments: "x" }], ...conf },
  });
  assert.equal(nada.status, 409, JSON.stringify(nada.data));
  assert.deepEqual(nada.data.rejected.map((r: { kind: string }) => r.kind).sort(), ["conformity", "criterion"]);
  const [{ used_at }] = await h.sql("select used_at from public_eval_tokens where id = $1", [tok2.data.tokenId]);
  assert.equal(used_at, null);
});

test("trava do dia seguinte: PATCH, envio de rascunho e links do avaliador recusados no dia do evento; admin/RH passam", async () => {
  const c = await criterio("Critério de hoje");
  const eventId = await evento(dayOffset(0), [c], "Evento de hoje");
  // Rascunho que já existia (ex.: criado antes da regra).
  const [{ id: evalId }] = await h.sql(
    "insert into evaluations (event_id, criterion_id, evaluator_user_id, score, comments, status) values ($1, $2, $3, 8, 'cedo', 'draft') returning id",
    [eventId, c, colega],
  );
  const patch = await h.api("PATCH", `/evaluations/${evalId}`, { ...as(colega), body: { score: 9 } });
  assert.equal(patch.status, 400, JSON.stringify(patch.data));
  assert.match(patch.data.error, /abre a partir de/);
  const submit = await h.api("POST", `/evaluations/${evalId}/submit`, as(colega));
  assert.equal(submit.status, 400, JSON.stringify(submit.data));
  assert.match(submit.data.error, /abre a partir de/);

  const linkCrit = await h.api("POST", `/events/${eventId}/public-token`, { ...as(colega), body: { recipientName: "Fred" } });
  assert.equal(linkCrit.status, 400);
  const linkMatriz = await h.api("POST", `/events/${eventId}/public-token/conformity`, { ...as(resp), body: { recipientName: "Fred" } });
  assert.equal(linkMatriz.status, 400, JSON.stringify(linkMatriz.data));
  assert.match(linkMatriz.data.error, /abre a partir de/);
  await h.sql("update events set conformity_evaluator_ferramentas_user_id = $2 where id = $1", [eventId, resp]);
  assert.equal((await h.api("POST", `/events/${eventId}/public-token/conformity-ferramentas`, { ...as(resp), body: { recipientName: "Fred" } })).status, 400);
  assert.equal((await h.api("POST", `/events/${eventId}/admin-public-token`, { role: "operador", body: { assignedToUserId: colega, criterionIds: [c] } })).status, 400);

  // Admin/RH podem sempre — e o link que eles geram vale já.
  assert.equal((await h.api("POST", `/events/${eventId}/public-token/conformity`, { role: "rh", body: { recipientName: "Fred" } })).status, 200);
  const adm = await h.api("POST", `/events/${eventId}/admin-public-token`, { role: "admin", body: { assignedToUserId: colega, criterionIds: [c], recipientName: "Freela do RH" } });
  assert.equal(adm.status, 200, JSON.stringify(adm.data));
  const envioAdm = await h.api("POST", `/public-eval/${adm.data.tokenId}/submit`, { body: { submitterName: "Freela do RH", evaluations: [{ criterionId: c, score: 9, comments: "ok" }] } });
  assert.equal(envioAdm.status, 200, JSON.stringify(envioAdm.data));

  // Link gerado por avaliador (ex.: antes da regra) não é aceito no dia do evento.
  const c2 = await criterio("Outro de hoje");
  const ev2 = await evento(dayOffset(0), [c2], "Outro evento de hoje");
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ('tok-cedo', $1, $2, 'Fred', 'criteria')", [ev2, colega]);
  await h.sql("insert into public_eval_token_criteria (token_id, criterion_id) values ('tok-cedo', $1)", [c2]);
  const cedo = await h.api("POST", "/public-eval/tok-cedo/submit", { body: { submitterName: "Fred", evaluations: [{ criterionId: c2, score: 9, comments: "x" }] } });
  assert.equal(cedo.status, 400, JSON.stringify(cedo.data));
  assert.match(cedo.data.error, /abre a partir de/);
  await h.sql("insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ('tok-cedo-matriz', $1, $2, 'Fred', 'conformity_cenografia')", [ev2, resp]);
  const cedoMatriz = await h.api("POST", "/public-eval/tok-cedo-matriz/submit-conformity", { body: { submitterName: "Fred", ...conf } });
  assert.equal(cedoMatriz.status, 400, JSON.stringify(cedoMatriz.data));
});
