// Testes de rota: matriz de permissões por papel (API real + Postgres em WASM).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startApi } from "../../../../scripts/test/api-harness.mjs";

let h: Awaited<ReturnType<typeof startApi>>;
let cycleId: number;
let emp: { casa: number; freela: number; inativo: number };
let outro: number;

const GESTORES = ["admin", "rh", "diretoria"];
const NAO_GESTORES = ["operador", "avaliador", "visualizador"];
const PII = ["document", "email", "phone", "pinValue", "cpfLogin"];

before(async () => {
  h = await startApi();
  cycleId = await h.fx.cycle();
  await h.fx.platoonRules2026();
  emp = await h.fx.employees();
  outro = await h.fx.employee({ name: "Outra Pessoa", document: "12312312312", email: "outra@exemplo.com" });
  const adminId = await h.ensureUser("admin");
  await h.fx.absence({ employeeId: emp.casa, cycleId, userId: adminId, points: 5, reason: "Atraso" });
  await h.fx.absence({ employeeId: outro, cycleId, userId: adminId, points: 10, reason: "Falta" });
});

after(() => h?.close());

test("GET /employees: visualizador recebe só dados públicos (sem CPF/e-mail/telefone/PIN)", async () => {
  const r = await h.api("GET", "/employees", { role: "visualizador", employeeId: emp.casa });
  assert.equal(r.status, 200);
  assert.ok(r.data.length >= 3);
  for (const e of r.data) {
    assert.ok(e.id && e.name, "tem id e nome");
    assert.ok("functionName" in e, "tem função");
    for (const campo of PII) assert.ok(!(campo in e), `não expõe ${campo}`);
  }
});

test("GET /employees: admin e rh recebem o cadastro completo", async () => {
  for (const role of ["admin", "rh"]) {
    const r = await h.api("GET", "/employees", { role });
    assert.equal(r.status, 200, role);
    const ana = r.data.find((e: { id: number }) => e.id === emp.casa);
    assert.equal(ana.document, "11122233344", role);
    assert.equal(ana.email, "ana@exemplo.com", role);
    assert.equal(ana.phone, "11999990000", role);
  }
});

test("GET /absences: visualizador só vê as próprias penalidades", async () => {
  const r = await h.api("GET", "/absences", { role: "visualizador", employeeId: emp.casa });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].employeeId, emp.casa);

  const tentandoOutro = await h.api("GET", `/absences?employeeId=${outro}`, { role: "visualizador", employeeId: emp.casa });
  assert.ok(tentandoOutro.data.every((a: { employeeId: number }) => a.employeeId === emp.casa), "filtro por outro colaborador é ignorado");

  const semVinculo = await h.api("GET", "/absences", { role: "visualizador" });
  assert.deepEqual(semVinculo.data, [], "sem colaborador vinculado não vê nada");

  const admin = await h.api("GET", "/absences", { role: "admin" });
  assert.equal(admin.data.length, 2, "gestor vê todas");
});

test("GET /ranking-detail de outro colaborador → 403 para visualizador; o próprio → 200", async () => {
  const alheio = await h.api("GET", `/ranking-detail?employeeId=${outro}`, { role: "visualizador", employeeId: emp.casa });
  assert.equal(alheio.status, 403);
  const proprio = await h.api("GET", `/ranking-detail?employeeId=${emp.casa}`, { role: "visualizador", employeeId: emp.casa });
  assert.equal(proprio.status, 200);
  const gestor = await h.api("GET", `/ranking-detail?employeeId=${outro}`, { role: "rh" });
  assert.equal(gestor.status, 200);
});

test("/employees/:id/history e /exports/absences → 403 para não gestor", async () => {
  for (const role of NAO_GESTORES) {
    assert.equal((await h.api("GET", `/employees/${emp.casa}/history`, { role, employeeId: emp.casa })).status, 403, `history ${role}`);
    assert.equal((await h.api("GET", "/exports/absences", { role, employeeId: emp.casa })).status, 403, `export ${role}`);
  }
  for (const role of GESTORES) {
    assert.equal((await h.api("GET", `/employees/${emp.casa}/history`, { role })).status, 200, `history ${role}`);
    assert.equal((await h.api("GET", "/exports/absences", { role })).status, 200, `export ${role}`);
  }
});

test("POST /users: rh não cria admin; papel fora da whitelist → 400", async () => {
  const base = { name: "Novo", password: "senha-forte-1" };
  const rhAdmin = await h.api("POST", "/users", { role: "rh", body: { ...base, email: "novo-admin@exemplo.com", role: "admin" } });
  assert.equal(rhAdmin.status, 403);

  const invalido = await h.api("POST", "/users", { role: "admin", body: { ...base, email: "x@exemplo.com", role: "superusuario" } });
  assert.equal(invalido.status, 400);

  const ok = await h.api("POST", "/users", { role: "rh", body: { ...base, email: "novo-vis@exemplo.com", role: "visualizador" } });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.passwordHash, undefined, "não devolve o hash");

  const [{ n }] = await h.sql("select count(*)::int as n from users where email = 'novo-admin@exemplo.com'");
  assert.equal(n, 0);
});

test("PATCH /users: rh não promove a admin nem edita admin; papel inválido → 400", async () => {
  const alvo = await h.ensureUser("avaliador", { employeeId: outro });
  const promover = await h.api("PATCH", `/users/${alvo}`, { role: "rh", body: { role: "admin" } });
  assert.equal(promover.status, 403);
  const [row] = await h.sql("select role from users where id = $1", [alvo]);
  assert.equal(row.role, "avaliador", "papel não mudou");

  const adminId = await h.ensureUser("admin");
  const editarAdmin = await h.api("PATCH", `/users/${adminId}`, { role: "rh", body: { name: "Hackeado" } });
  assert.equal(editarAdmin.status, 403);

  const invalido = await h.api("PATCH", `/users/${alvo}`, { role: "admin", body: { role: "root" } });
  assert.equal(invalido.status, 400);

  const naoGestor = await h.api("PATCH", `/users/${alvo}`, { role: "operador", body: { name: "x" } });
  assert.equal(naoGestor.status, 403);
});

test("/analytics/overview e /cycles: só gestores", async () => {
  for (const role of GESTORES) {
    assert.equal((await h.api("GET", "/analytics/overview", { role })).status, 200, `analytics ${role}`);
    assert.equal((await h.api("GET", "/cycles", { role })).status, 200, `cycles ${role}`);
  }
  for (const role of NAO_GESTORES) {
    assert.equal((await h.api("GET", "/analytics/overview", { role })).status, 403, `analytics ${role}`);
    assert.equal((await h.api("GET", "/cycles", { role })).status, 403, `cycles ${role}`);
  }
});

test("sem token → 401", async () => {
  assert.equal((await h.api("GET", "/employees")).status, 401);
  assert.equal((await h.api("GET", "/cycles")).status, 401);
});
