// Testes de rota: AVALIAÇÃO POR ÁREA (pedido do dono, 10/2026) — vale só no
// ciclo com cycles.area_evaluation = true (o ciclo de teste principal).
//   quem é avaliador da área do cadastro responde sem estar designado →
//   outra área / outros papéis → 403 → a primeira resposta enviada fecha
//   (o segundo recebe 409 com o nome de quem respondeu; corrida: um vence) →
//   ciclo SEM a marca segue o fluxo antigo (só designados, média entre eles) →
//   link do freela gerado por qualquer avaliador da área (critério fechado é
//   recusado com motivo, nunca descartado em silêncio) → GET
//   /evaluations/my-area só traz a área dele → "Conduta" fora da matriz no
//   ciclo novo (link público).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number, cicloAntigo: number;
let areaA: number, areaB: number;
let ana: number, bia: number, caio: number, outraArea: number, semArea: number;

async function user(name: string, role: string, areaId: number | null) {
  return (await h.one("insert into users (name, password_hash, role, area_id) values ($1, 'x', $2, $3) returning id", [name, role, areaId])).id as number;
}
const as = (userId: number, role = "avaliador") => ({ role, userId });

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle();
  await h.sql("update cycles set area_evaluation = true where id = $1", [cycleId]);
  // Ciclo anterior, sem a marca: fluxo antigo (por designação).
  cicloAntigo = (await h.one(
    `insert into cycles (name, start_date, end_date, status, is_current) values ('Ciclo antigo', '2026-01-01', '2026-06-30', 'open', false) returning id`,
  )).id as number;
  const mkArea = async (name: string) => (await h.one("insert into areas (name, active) values ($1, true) returning id", [name])).id as number;
  areaA = await mkArea("Produção (teste)");
  areaB = await mkArea("Logística (teste)");
  ana = await user("Ana Área A", "avaliador", areaA);
  bia = await user("Bia Área A", "avaliador", areaA);
  caio = await user("Caio Área A", "avaliador", areaA);
  outraArea = await user("Otávio Área B", "avaliador", areaB);
  semArea = await user("Sérgio Designado", "avaliador", null);
});

after(() => h?.close());

async function criterionIn(area: number, name: string, allowPublicLink: boolean | null = null) {
  const id = await h.fx.criterion({ name, allowPublicLink });
  await h.sql("update criteria set responsible_area_id = $1 where id = $2", [area, id]);
  return id;
}

async function openEvent(criteria: number[], name = `Evento área ${Math.random().toString(36).slice(2, 6)}`, cycle = cycleId, date = "2026-09-20") {
  const eventId = await h.fx.event({ cycleId: cycle, status: "open", resultsConfirmed: false, criteria, name, date });
  await h.sql("update events set criteria_confirmed = true where id = $1", [eventId]);
  return eventId;
}

async function draft(userId: number, eventId: number, criterionId: number, score = 8) {
  return h.api("POST", "/evaluations", { ...as(userId), body: { eventId, criterionId, score, comments: "Comentário de teste" } });
}

test("avaliador da área responde sem estar designado; outra área e outros papéis → 403", async () => {
  const crit = await criterionIn(areaA, "Montagem A");
  const eventId = await openEvent([crit]);

  const r = await draft(ana, eventId, crit, 9);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const sub = await h.api("POST", `/evaluations/${r.data.id}/submit`, as(ana));
  assert.equal(sub.status, 200, JSON.stringify(sub.data));
  assert.equal(sub.data.status, "submitted");

  const fora = await draft(outraArea, eventId, crit);
  assert.equal(fora.status, 403);
  assert.match(fora.data.error, /não é da sua área/);
  for (const role of ["visualizador", "operador", "diretoria"]) {
    const x = await h.api("POST", "/evaluations", { role, body: { eventId, criterionId: crit, score: 5, comments: "x" } });
    assert.equal(x.status, 403, `${role} não avalia`);
  }
});

test("primeira resposta da área fecha: o segundo recebe 409 com o nome; rascunho não fecha", async () => {
  const crit = await criterionIn(areaA, "Organização A");
  const eventId = await openEvent([crit]);

  // Os dois começam um rascunho (rascunho de outra pessoa não fecha).
  const dAna = await draft(ana, eventId, crit, 7);
  const dBia = await draft(bia, eventId, crit, 6);
  assert.equal(dAna.status, 201);
  assert.equal(dBia.status, 201);

  assert.equal((await h.api("POST", `/evaluations/${dAna.data.id}/submit`, as(ana))).status, 200);

  const tarde = await h.api("POST", `/evaluations/${dBia.data.id}/submit`, as(bia));
  assert.equal(tarde.status, 409);
  assert.match(tarde.data.error, /Já respondido por Ana Área A em \d{2}\/\d{2} \d{2}:\d{2}/);
  // Nem rascunho novo, nem edição do antigo.
  assert.equal((await draft(caio, eventId, crit)).status, 409);
  assert.equal((await h.api("PATCH", `/evaluations/${dBia.data.id}`, { ...as(bia), body: { score: 9 } })).status, 409);

  const enviadas = await h.sql("select evaluator_user_id from evaluations where event_id = $1 and criterion_id = $2 and status = 'submitted'", [eventId, crit]);
  assert.deepEqual(enviadas.map(e => e.evaluator_user_id), [ana]);
});

test("corrida: duas pessoas da área enviam juntas → só uma vence", async () => {
  const crit = await criterionIn(areaA, "Pontualidade A");
  const eventId = await openEvent([crit]);
  const d1 = await draft(ana, eventId, crit, 8);
  const d2 = await draft(bia, eventId, crit, 5);
  const [r1, r2] = await Promise.all([
    h.api("POST", `/evaluations/${d1.data.id}/submit`, as(ana)),
    h.api("POST", `/evaluations/${d2.data.id}/submit`, as(bia)),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  const [{ n }] = await h.sql("select count(*)::int as n from evaluations where event_id = $1 and criterion_id = $2 and status = 'submitted'", [eventId, crit]);
  assert.equal(n, 1);
});

test("modo por área (D2): só a área do critério responde — designação de quem é de fora não dá acesso", async () => {
  const crit = await criterionIn(areaA, "Acabamento A");
  const eventId = await openEvent([crit]);
  await h.sql("insert into event_area_assignments (event_id, area_id, evaluator_user_id) values ($1, $2, $3)", [eventId, areaA, semArea]);

  // Sérgio (sem área no cadastro, designado no evento) não responde.
  const dSergio = await draft(semArea, eventId, crit, 7);
  assert.equal(dSergio.status, 403, JSON.stringify(dSergio.data));
  assert.match(dSergio.data.error, /avaliação é por área/);
  const area = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(semArea));
  assert.equal(area.data.events.length, 0, "o evento não aparece para quem é de fora da área");

  const dAna = await draft(ana, eventId, crit, 9);
  assert.equal((await h.api("POST", `/evaluations/${dAna.data.id}/submit`, as(ana))).status, 200);

  // Designado por critério (redirecionamento) para alguém de outra área: também não.
  const crit2 = await criterionIn(areaB, "Só designado B");
  const ev2 = await openEvent([crit2]);
  await h.fx.criterionAssignment({ eventId: ev2, criterionId: crit2, assignedToId: semArea });
  assert.equal((await draft(semArea, ev2, crit2)).status, 403);
  assert.equal((await draft(ana, ev2, crit2)).status, 403);
  assert.equal((await draft(outraArea, ev2, crit2)).status, 201, "quem é da área B responde");
  assert.deepEqual((await h.api("GET", `/events/${ev2}/criteria`, as(semArea))).data, [], "nem vê o critério");
});

test("fluxo antigo (ciclo sem a marca): área não dá acesso; designados avaliam e fazem média; nada fecha", async () => {
  const crit = await criterionIn(areaA, "Acabamento antigo");
  // Dentro do período do ciclo antigo (fora dele o evento seria do próximo ciclo).
  const eventId = await openEvent([crit], "Evento ciclo antigo", cicloAntigo, "2026-05-20");
  await h.sql("insert into event_area_assignments (event_id, area_id, evaluator_user_id) values ($1, $2, $3), ($1, $2, $4)", [eventId, areaA, semArea, bia]);

  // Ana é da área, mas não foi designada: no ciclo antigo não responde.
  const fora = await draft(ana, eventId, crit, 9);
  assert.equal(fora.status, 403, JSON.stringify(fora.data));
  const listaAna = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(ana));
  assert.equal(listaAna.data.events.length, 0, "evento não aparece para quem só é da área");
  assert.deepEqual((await h.api("GET", `/events/${eventId}/public-link-eligible-criteria`, as(ana))).data, []);

  // Os dois designados respondem; a resposta de um não fecha para o outro.
  const d1 = await draft(semArea, eventId, crit, 6);
  assert.equal((await h.api("POST", `/evaluations/${d1.data.id}/submit`, as(semArea))).status, 200);
  const meio = await h.api("GET", `/events/${eventId}/feedback`, { role: "admin" });
  assert.equal(meio.data.evaluatedCriteria, 0, "falta a Bia: ainda não está avaliado");
  const listaBia = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(bia));
  assert.equal(listaBia.data.events[0].areaMode, false);
  assert.equal(listaBia.data.events[0].criteria[0].state, "open");
  const d2 = await draft(bia, eventId, crit, 8);
  assert.equal(d2.status, 201);
  assert.equal((await h.api("POST", `/evaluations/${d2.data.id}/submit`, as(bia))).status, 200);

  const fb = await h.api("GET", `/events/${eventId}/feedback`, { role: "admin" });
  assert.equal(fb.data.evaluatedCriteria, 1);
  assert.equal(fb.data.eventScore, 70, "média dos designados (6 e 8)");
});

test("status 'avaliado' no modo por área: UMA resposta basta, mesmo com designados", async () => {
  const crit = await criterionIn(areaA, "Status área");
  const eventId = await openEvent([crit]);
  await h.sql("insert into event_area_assignments (event_id, area_id, evaluator_user_id) values ($1, $2, $3), ($1, $2, $4)", [eventId, areaA, semArea, bia]);
  assert.equal((await h.api("GET", `/events/${eventId}/feedback`, { role: "admin" })).data.evaluatedCriteria, 0);
  const d = await draft(caio, eventId, crit, 9);
  assert.equal((await h.api("POST", `/evaluations/${d.data.id}/submit`, as(caio))).status, 200);
  const fb = await h.api("GET", `/events/${eventId}/feedback`, { role: "admin" });
  assert.equal(fb.data.evaluatedCriteria, 1);
  assert.equal(fb.data.isComplete, true);
});

test("GET /evaluations/my-area: só a área do usuário, com quem respondeu e quando", async () => {
  const critA = await criterionIn(areaA, "Qualidade A");
  const critB = await criterionIn(areaB, "Qualidade B");
  const eventId = await openEvent([critA, critB], "Festival Área Teste");
  await h.sql("update events set client_name = 'Cliente Zeta', city = 'Sorocaba' where id = $1", [eventId]);

  const d = await draft(ana, eventId, critA, 8);
  await h.api("POST", `/evaluations/${d.data.id}/submit`, as(ana));

  const r = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(bia));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.areaId, areaA);
  const [ev] = r.data.events;
  assert.equal(ev.id, eventId);
  assert.deepEqual(ev.criteria.map((c: { criterionId: number }) => c.criterionId), [critA], "critério da área B não aparece");
  const c = ev.criteria[0];
  assert.equal(c.state, "closed");
  assert.equal(c.access, "area");
  assert.equal(c.answeredByName, "Ana Área A");
  assert.ok(c.answeredAt);
  assert.equal(ev.pending, false);

  // Para quem respondeu, o critério aparece como "answered".
  const mine = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(ana));
  assert.equal(mine.data.events[0].criteria[0].state, "answered");
  assert.equal(mine.data.events[0].criteria[0].answeredByMe, true);

  // Busca por cliente/cidade + filtro de status.
  const busca = await h.api("GET", "/evaluations/my-area?search=zeta&status=done", as(bia));
  assert.deepEqual(busca.data.events.map((e: { id: number }) => e.id), [eventId]);
  const pend = await h.api("GET", "/evaluations/my-area?search=zeta&status=pending", as(bia));
  assert.equal(pend.data.events.length, 0);

  // Outra área enxerga só o critério dela (aberto).
  const b = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(outraArea));
  assert.deepEqual(b.data.events[0].criteria.map((x: { criterionId: number; state: string }) => [x.criterionId, x.state]), [[critB, "open"]]);

  // Admin consulta uma área; papéis sem avaliação → 403.
  const adm = await h.api("GET", `/evaluations/my-area?eventId=${eventId}&areaId=${areaB}`, { role: "admin" });
  assert.equal(adm.status, 200);
  assert.deepEqual(adm.data.events[0].criteria.map((x: { criterionId: number }) => x.criterionId), [critB]);
  assert.equal((await h.api("GET", "/evaluations/my-area", { role: "visualizador" })).status, 403);

  // O avaliador da área vê a avaliação de quem respondeu (para "respondido por").
  const lista = await h.api("GET", `/evaluations?eventId=${eventId}`, as(bia));
  assert.ok(lista.data.some((e: { criterionId: number; evaluatorUserId: number }) => e.criterionId === critA && e.evaluatorUserId === ana));
});

test("link do freela pela área: gera, envia, fecha; critério já fechado é recusado com motivo", async () => {
  const c1 = await criterionIn(areaA, "Atendimento A", true);
  const c2 = await criterionIn(areaA, "Limpeza A", true);
  const interno = await criterionIn(areaA, "Interno A", false);
  // Cópia por área: usa o allowPublicLink do critério de origem.
  const origem = await criterionIn(areaB, "Entrega geral", true);
  const eventId = await openEvent([c1, c2, interno, origem]);
  const r0 = await h.api("PUT", `/events/${eventId}/criteria/${origem}/areas`, { role: "admin", body: { areaIds: [areaA] } });
  assert.equal(r0.status, 200, JSON.stringify(r0.data));
  const [{ id: copia }] = await h.sql("select id from criteria where source_criterion_id = $1 and event_scoped", [origem]);

  const eleg = await h.api("GET", `/events/${eventId}/public-link-eligible-criteria`, as(bia));
  assert.deepEqual(eleg.data.map((c: { criterionId: number }) => c.criterionId).sort((a: number, b: number) => a - b), [c1, c2, copia].sort((a, b) => a - b));

  const tok = await h.api("POST", `/events/${eventId}/public-token`, { ...as(bia), body: { recipientName: "Fred Freela" } });
  assert.equal(tok.status, 200, JSON.stringify(tok.data));
  const tokenId = tok.data.tokenId;
  const [{ created_by_user_id }] = await h.sql("select created_by_user_id from public_eval_tokens where id = $1", [tokenId]);
  assert.equal(created_by_user_id, bia);

  // Ana responde c1 pela tela antes do freela.
  const d = await draft(ana, eventId, c1, 6);
  assert.equal((await h.api("POST", `/evaluations/${d.data.id}/submit`, as(ana))).status, 200);

  // Ao abrir, o link já avisa que c1 está fechado.
  const info = await h.api("GET", `/public-eval/${tokenId}`);
  const byId = new Map(info.data.criteria.map((c: { criterionId: number }) => [c.criterionId, c]));
  assert.equal((byId.get(c1) as { closed: boolean; closedByName: string }).closed, true);
  assert.equal((byId.get(c1) as { closedByName: string }).closedByName, "Ana Área A");
  assert.equal((byId.get(c2) as { closed: boolean }).closed, false);
  assert.equal(info.data.allClosed, false);

  // Faltar um critério ABERTO → 400; o fechado não é cobrado.
  const faltando = await h.api("POST", `/public-eval/${tokenId}/submit`, { body: { submitterName: "Fred", evaluations: [{ criterionId: c2, score: 9, comments: "ok" }] } });
  assert.equal(faltando.status, 400);

  // Envia tudo, inclusive c1 (já fechado): c1 é recusado com o motivo, o resto grava.
  const envio = await h.api("POST", `/public-eval/${tokenId}/submit`, {
    body: { submitterName: "Fred Freela", evaluations: [c1, c2, copia].map(criterionId => ({ criterionId, score: 9, comments: "Pelo link" })) },
  });
  assert.equal(envio.status, 200, JSON.stringify(envio.data));
  assert.deepEqual(envio.data.saved.sort(), [c2, copia].sort());
  assert.equal(envio.data.rejected.length, 1);
  assert.equal(envio.data.rejected[0].criterionId, c1);
  assert.match(envio.data.rejected[0].reason, /Já respondido por Ana Área A/);
  const [{ n: notasC1 }] = await h.sql("select count(*)::int as n from evaluations where event_id = $1 and criterion_id = $2 and status = 'submitted'", [eventId, c1]);
  assert.equal(notasC1, 1, "a resposta da Ana continua sendo a única");

  // A resposta do freela fecha c2 para a área, com o nome do freela.
  const tarde = await draft(caio, eventId, c2);
  assert.equal(tarde.status, 409);
  assert.match(tarde.data.error, /Fred Freela \(pelo link de freela\)/);
  const area = await h.api("GET", `/evaluations/my-area?eventId=${eventId}`, as(caio));
  const c2Row = area.data.events[0].criteria.find((c: { criterionId: number }) => c.criterionId === c2);
  assert.equal(c2Row.state, "closed");
  assert.equal(c2Row.answeredByName, "Fred Freela");
  assert.equal(c2Row.answeredViaLink, true);
});

test("link do freela: tudo já respondido → avisa ao abrir e o envio é recusado sem queimar o link", async () => {
  const c = await criterionIn(areaA, "Sinalização A", true);
  const eventId = await openEvent([c]);
  const tok = await h.api("POST", `/events/${eventId}/public-token`, { ...as(caio), body: { recipientName: "Gil" } });
  assert.equal(tok.status, 200, JSON.stringify(tok.data));
  const d = await draft(ana, eventId, c, 7);
  assert.equal((await h.api("POST", `/evaluations/${d.data.id}/submit`, as(ana))).status, 200);

  const info = await h.api("GET", `/public-eval/${tok.data.tokenId}`);
  assert.equal(info.data.allClosed, true);
  const envio = await h.api("POST", `/public-eval/${tok.data.tokenId}/submit`, { body: { submitterName: "Gil", evaluations: [{ criterionId: c, score: 10, comments: "x" }] } });
  assert.equal(envio.status, 409);
  assert.match(envio.data.error, /já foram respondidos\. Nada foi gravado/);
  assert.equal(envio.data.rejected[0].criterionId, c);
  const [{ used_at }] = await h.sql("select used_at from public_eval_tokens where id = $1", [tok.data.tokenId]);
  assert.equal(used_at, null, "link não foi marcado como usado");

  // Nada mais elegível para link novo.
  assert.equal((await h.api("POST", `/events/${eventId}/public-token`, { ...as(bia), body: { recipientName: "Outro" } })).status, 400);
});

test("ciclo sem Conduta: link público não cobra a pergunta e grava vazio; ciclo antigo continua cobrando", async () => {
  const cicloNovo = (await h.one(
    `insert into cycles (name, start_date, end_date, status, is_current, conformity_without_conduta, area_evaluation)
     values ('Ciclo sem conduta', '2027-01-01', '2027-06-30', 'open', false, true, true) returning id`,
  )).id as number;
  const c = await criterionIn(areaA, "Cenário A", true);
  const evNovo = await openEvent([c], "Evento ciclo novo", cicloNovo);
  const evAntigo = await openEvent([c], "Evento ciclo antigo");
  // Link com a matriz junto: só quem responde pela matriz no evento.
  await h.sql("update events set conformity_evaluator_user_id = $1 where id = any($2::int[])", [ana, [evNovo, evAntigo]]);
  const conf = { absencesReport: "Ninguém faltou", standoutResponse: false, epi: true, estaiamentos: true };

  // criteria_with_conformity
  const t1 = await h.api("POST", `/events/${evNovo}/public-token`, { ...as(ana), body: { recipientName: "Ivo", includeConformity: true } });
  assert.equal(t1.status, 200, JSON.stringify(t1.data));
  assert.equal((await h.api("GET", `/public-eval/${t1.data.tokenId}`)).data.conformityWithoutConduta, true);
  const e1 = await h.api("POST", `/public-eval/${t1.data.tokenId}/submit`, {
    body: { submitterName: "Ivo", evaluations: [{ criterionId: c, score: 8, comments: "ok" }], ...conf, conduta: false },
  });
  assert.equal(e1.status, 200, JSON.stringify(e1.data));
  const [row] = await h.sql("select epi, conduta, conduta_comment from event_conformities where event_id = $1", [evNovo]);
  assert.equal(row.epi, true);
  assert.equal(row.conduta, null, "conduta não é gravada no ciclo novo");

  const t2 = await h.api("POST", `/events/${evAntigo}/public-token`, { ...as(ana), body: { recipientName: "Ivo", includeConformity: true } });
  assert.equal((await h.api("GET", `/public-eval/${t2.data.tokenId}`)).data.conformityWithoutConduta, false);
  const e2 = await h.api("POST", `/public-eval/${t2.data.tokenId}/submit`, {
    body: { submitterName: "Ivo", evaluations: [{ criterionId: c, score: 8, comments: "ok" }], ...conf },
  });
  assert.equal(e2.status, 400, "ciclo antigo exige Conduta");

  // conformity_cenografia (só a matriz), ciclo novo
  const evConf = await openEvent([c], "Evento só matriz", cicloNovo);
  const [{ id: t3 }] = await h.sql(
    "insert into public_eval_tokens (id, event_id, created_by_user_id, recipient_name, token_type) values ('tok-ceno-sem-conduta', $1, $2, 'Jó', 'conformity_cenografia') returning id",
    [evConf, ana],
  );
  const e3 = await h.api("POST", `/public-eval/${t3}/submit-conformity`, { body: { submitterName: "Jó", ...conf, absencesResponse: true } });
  assert.equal(e3.status, 200, JSON.stringify(e3.data));
  const [row3] = await h.sql("select conduta, epi from event_conformities where event_id = $1", [evConf]);
  assert.equal(row3.conduta, null);
  assert.equal(row3.epi, true);
});

test("avaliador só acessa a tela de avaliação: o resto da API é 403; critérios do evento sem nota publicada", async () => {
  const crit = await criterionIn(areaA, "Escopo A");
  const eventId = await openEvent([crit], "Evento escopo");
  await h.sql("update event_criteria set published_score = 8.5 where event_id = $1 and criterion_id = $2", [eventId, crit]);

  const bloqueadas = [
    "/events", `/events/${eventId}`, `/events/${eventId}/participants`, `/events/${eventId}/feedback`,
    "/employees", "/results/quarterly", `/calibrations?eventId=${eventId}`, "/ranking-detail",
    "/dashboard/summary", "/my-performance", "/analytics/overview", "/criteria", "/absences", "/rules",
    "/platoon-rules", "/exports/ranking", "/cycle-eligibility",
  ];
  for (const url of bloqueadas) {
    const r = await h.api("GET", url, as(ana));
    assert.equal(r.status, 403, `${url} deveria ser 403 para avaliador (veio ${r.status})`);
  }
  assert.equal((await h.api("POST", `/events/${eventId}/criteria/area-defaults`, as(ana))).status, 403);

  for (const url of ["/evaluations/my-area", "/cycles/current", "/users/my-principal-areas", `/evaluations?eventId=${eventId}`, `/events/${eventId}/public-link-eligible-criteria`]) {
    const r = await h.api("GET", url, as(ana));
    assert.equal(r.status, 200, `${url} deveria abrir para avaliador (veio ${r.status}: ${JSON.stringify(r.data)})`);
  }
  const crits = await h.api("GET", `/events/${eventId}/criteria`, as(ana));
  assert.equal(crits.status, 200);
  assert.equal(crits.data[0].publishedScore, null, "avaliador não vê a nota publicada/calibrada");
  const adm = await h.api("GET", `/events/${eventId}/criteria`, { role: "admin" });
  assert.equal(adm.data[0].publishedScore, 8.5);
  // Outros papéis seguem como antes.
  assert.equal((await h.api("GET", `/events/${eventId}`, { role: "rh" })).status, 200);
  // Sem token continua 401 (não 403).
  assert.equal((await h.api("GET", "/events")).status, 401);
});
