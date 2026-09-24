// Testes de rota: recálculo do ciclo ponta a ponta (API real + Postgres em WASM).
//
// Regra do bônus: a MÉDIA do ciclo define a faixa; bônus = base da faixa +
// nº de eventos extras × valor por extra DA MESMA faixa; faixa sem bônus zera
// tudo. Extras = eventos pontuados além do mínimo de elegibilidade (em ordem de
// data). Só eventos com resultado confirmado contam; nota 0 conta na média.
//
// Cenário (min_events_eligibility = 2; critérios C1 peso 3, C2 peso 1):
//   E1 07/07 confirmado  C1 = média(7, 9) = 8; C2 = 2 calibrado p/ 8 → 80
//                        (sem a calibração seria 65)
//   E2 20/07 confirmado  C1 = 9; C2 = 9                           → 90
//   E3 10/08 confirmado  C1 = 0; C2 = 0                           → 0
//   E4 20/08 fechado mas NÃO confirmado  C1 = 10; C2 = 10         → não conta
//   E5 01/09 confirmado  C1 = 10; C2 = 10                         → 100
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number;
const p: Record<string, number> = {};

async function resultado(employeeId: number) {
  const [row] = await h.sql(
    `select events_count, participated_events_count, final_result::float as final_result, platoon,
            bonus_value::float as bonus_value, extra_bonus_value::float as extra_bonus_value,
            eligible, eligibility_reason
       from quarterly_results where cycle_id = $1 and employee_id = $2`,
    [cycleId, employeeId],
  );
  return row;
}

before(async () => {
  h = await startApi();
  const { fx } = h;
  cycleId = await fx.cycle();
  await fx.platoonRules2026();
  await fx.rule("min_events_eligibility", 2);

  const c1 = await fx.criterion({ name: "Montagem", weight: 3 });
  const c2 = await fx.criterion({ name: "Organização", weight: 1 });
  const av1 = await h.ensureUser("avaliador");
  const av2 = await h.ensureUser("operador");
  const admin = await h.ensureUser("admin");

  p.ana = await fx.employee({ name: "Ana (tem nota 0)" });
  p.bia = await fx.employee({ name: "Bia (Quênia com extra)" });
  p.edu = await fx.employee({ name: "Edu (Azul no limite)" });
  p.duda = await fx.employee({ name: "Duda (poucos eventos)" });
  p.fabi = await fx.employee({ name: "Fabi (inativa no E1)" });
  p.caio = await fx.employee({ name: "Caio Freela", employmentType: "freela" });

  const evento = async (
    date: string, notas: { c1: number[]; c2: number; calibC2?: number }, participantes: (number | object)[], resultsConfirmed = true,
  ) => {
    const eventId = await fx.event({ cycleId, date, criteria: [c1, c2], participants: participantes, resultsConfirmed });
    const avaliadores = [av1, av2];
    for (const [i, nota] of notas.c1.entries()) {
      await fx.evaluation({ eventId, criterionId: c1, evaluatorUserId: avaliadores[i], score: nota });
    }
    await fx.evaluation({ eventId, criterionId: c2, evaluatorUserId: av1, score: notas.c2 });
    if (notas.calibC2 != null) await fx.calibration({ eventId, criterionId: c2, score: notas.calibC2, userId: admin });
    return eventId;
  };

  await evento("2026-07-07", { c1: [7, 9], c2: 2, calibC2: 8 },
    [p.ana, p.bia, p.edu, p.caio, { employeeId: p.fabi, confirmed: false }]);
  await evento("2026-07-20", { c1: [9], c2: 9 }, [p.ana, p.bia, p.edu, p.duda, p.fabi, p.caio]);
  await evento("2026-08-10", { c1: [0], c2: 0 }, [p.ana]);
  await evento("2026-08-20", { c1: [10], c2: 10 }, [p.ana, p.bia], false);
  await evento("2026-09-01", { c1: [10], c2: 10 }, [p.ana, p.bia, p.fabi]);
});

after(() => h?.close());

test("recálculo: só admin e rh disparam", async () => {
  assert.equal((await h.api("POST", "/results/quarterly/recompute", { role: "diretoria" })).status, 403);
  assert.equal((await h.api("POST", "/results/quarterly/recompute", { role: "visualizador" })).status, 403);
});

test("recálculo: POST /results/quarterly/recompute processa o ciclo atual", async () => {
  const r = await h.api("POST", "/results/quarterly/recompute", { role: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.cycleId, cycleId);
  assert.equal(r.data.totalProcessed, 5, "5 colaboradores casa com participação válida");
});

test("recálculo: média na faixa Quênia com 1 evento extra → 3200 + 1 × 400 (calibração vale, não confirmado fica fora)", async () => {
  const bia = await resultado(p.bia);
  assert.equal(bia.final_result, 90);
  assert.equal(bia.platoon, "Quênia");
  assert.equal(bia.events_count, 3, "E4 não confirmado não conta");
  assert.equal(bia.participated_events_count, 3);
  assert.equal(bia.eligible, true);
  assert.equal(bia.bonus_value, 3600);
  assert.equal(bia.extra_bonus_value, 400);
});

test("recálculo: média exatamente 85 → Azul, sem extra → 2700", async () => {
  const edu = await resultado(p.edu);
  assert.equal(edu.final_result, 85);
  assert.equal(edu.platoon, "Azul");
  assert.equal(edu.bonus_value, 2700);
  assert.equal(edu.extra_bonus_value, 0);
});

test("recálculo: nota 0 conta na média e faixa sem bônus zera base e extras", async () => {
  const ana = await resultado(p.ana);
  assert.equal(ana.events_count, 4, "E1, E2, E3 (nota 0) e E5");
  assert.equal(ana.final_result, 67.5, "(80 + 90 + 0 + 100) / 4");
  assert.equal(ana.platoon, "Sem Bônus");
  assert.equal(ana.eligible, true);
  assert.equal(ana.bonus_value, 0, "2 extras, mas a faixa não paga");
  assert.equal(ana.extra_bonus_value, 0);
});

test("recálculo: abaixo do mínimo de eventos fica inelegível e sem bônus", async () => {
  const duda = await resultado(p.duda);
  assert.equal(duda.participated_events_count, 1);
  assert.equal(duda.platoon, "Quênia");
  assert.equal(duda.eligible, false);
  assert.match(duda.eligibility_reason ?? "", /1 de 2/);
  assert.equal(duda.bonus_value, 0);
});

test("recálculo: participação inativa no evento não conta; freela não entra", async () => {
  const fabi = await resultado(p.fabi);
  assert.equal(fabi.participated_events_count, 2, "E1 marcado como não participou");
  assert.equal(fabi.final_result, 95);
  assert.equal(fabi.platoon, "Quênia Alto Rendimento");
  assert.equal(fabi.bonus_value, 3700);
  assert.equal(await resultado(p.caio), undefined, "freela não gera resultado");
});

test("recálculo: é idempotente e a API de resultados expõe o bônus só para gestor", async () => {
  const r = await h.api("POST", "/results/quarterly/recompute", { role: "rh" });
  assert.equal(r.status, 200);
  const [{ n }] = await h.sql("select count(*)::int as n from quarterly_results where cycle_id = $1", [cycleId]);
  assert.equal(n, 5, "não duplica linhas");

  const gestor = await h.api("GET", "/results/quarterly", { role: "admin" });
  assert.equal(gestor.status, 200);
  const bia = gestor.data.find((x: { employeeId: number }) => x.employeeId === p.bia);
  assert.equal(bia.bonusValue, 3600);

  const vis = await h.api("GET", "/results/quarterly", { role: "visualizador", employeeId: p.bia });
  assert.equal(vis.status, 200);
  for (const x of vis.data) assert.equal(x.bonusValue, 0, "não gestor não vê valor de bônus");
});
