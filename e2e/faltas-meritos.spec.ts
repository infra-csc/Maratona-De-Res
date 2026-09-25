// Penalidade e mérito refletindo na nota final e no bônus (Resultados):
//
//   admin restaura os tipos padrão em /penalty-types → lança uma FALTA
//   ("Ausência Não Comunicada", −50) para o Diego em /absences → Resultados
//   mostra a nota caindo de faixa → lança um MÉRITO ("Estrela do Evento", +25)
//   → Resultados mostra a nota subindo de faixa, e o detalhe lista os dois.
//
// Regra (api-server lib/calculations.ts calculateQuarterFinalResult e
// lib/cycle-compute.ts): nota final = média bruta − (penalidades − méritos) ÷
// nº de eventos com nota, travada entre 0 e 100; a faixa sai da nota final e o
// bônus é o valor base da faixa (sem eventos extras, Diego tem exatamente 8).
//
//   Diego: 8 eventos confirmados com nota 90 → média bruta 90.
//   - sem lançamentos:         90                 → Quênia  → R$ 3.200
//   - falta −50:               90 − 50/8  = 83,75 (tela: 83,8) → Verde → R$ 2.200
//   - falta −50 + mérito +25:  90 − 25/8  = 86,875 (tela: 86,9) → Azul → R$ 2.700
//
// Dados próprios (support/seed.ts): DIEGO e o evento FALTAS_EVENT. Os tipos de
// lançamento não são semeados (o spec usa o botão "Restaurar Padrões").
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN, DIEGO } from "./support/env";
import { loginPelaTela, menu, vigiarErros } from "./support/ui";

const FALTA = { label: "Ausência Não Comunicada", points: 50 } as const;
const MERITO = { label: "Estrela do Evento", points: 25 } as const;

/** Hoje em America/Sao_Paulo, no formato do <input type="date">. */
function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

async function conferirResultado(page: Page, testInfo: TestInfo, esperado: { nota: string; faixa: string; bonus: RegExp }) {
  // Pelo MENU, sem recarregar: o lançamento em /absences precisa invalidar o
  // cache do ranking no front (antes de 25/09 Resultados mostrava a nota
  // antiga por até 30 s). Se a correção regredir, este passo falha.
  await menu(page, "Resultados & Ranking").click();
  await expect(page.getByRole("heading", { level: 1, name: /Resultados & Ranking/ })).toBeVisible();
  const card = page.getByTestId(`card-ranking-${DIEGO.id}`);
  await expect(card).toContainText(DIEGO.name);
  await expect(card).toContainText("8 eventos");
  await expect(card).not.toContainText("Inelegível");
  await expect(page.getByTestId(`text-final-result-${DIEGO.id}`)).toHaveText(esperado.nota);
  await expect(card).toContainText(esperado.faixa);
  await expect(card).toContainText(esperado.bonus);
  await checkA11y(page, "resultados", testInfo);
}

async function lancar(page: Page, testInfo: TestInfo, tipo: { label: string; points: number }, sinal: "−" | "+", motivo: string) {
  await menu(page, "Penalidades e Méritos").click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByTestId("button-register-absence").click();
  const dialogo = page.getByRole("dialog", { name: /Registrar Lançamento/i });
  await expect(dialogo).toBeVisible();
  await checkA11y(page, "penalidades-e-meritos-dialogo", testInfo, { inDialog: true });

  await dialogo.getByTestId("select-penalty-type").click();
  const rotulo = `${tipo.label} — ${sinal}${tipo.points} pts`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await page.getByRole("option", { name: new RegExp(`^${rotulo}`) }).click();
  await expect(dialogo.getByTestId("select-penalty-type")).toContainText(tipo.label);

  await dialogo.getByTestId("select-absence-employee").click();
  await page.getByPlaceholder("Buscar pelo nome...").fill("Diego");
  await page.getByRole("option", { name: DIEGO.name }).click();
  await expect(dialogo.getByTestId("select-absence-employee")).toContainText(DIEGO.name);

  await dialogo.locator('input[type="date"]').first().fill(hojeSP());
  await dialogo.getByPlaceholder("Detalhe do lançamento...").fill(motivo);
  await expect(dialogo.getByText(`${sinal === "−" ? "−" : "+"}${tipo.points} pts`, { exact: true })).toBeVisible();

  await dialogo.getByTestId("button-submit-absence").click();
  await expect(page.getByText("Lançamento registrado com sucesso").first()).toBeVisible();
  await expect(dialogo).toBeHidden();
  const linha = page.locator('[data-testid^="row-absence-"]').filter({ hasText: DIEGO.name }).filter({ hasText: tipo.label });
  await expect(linha).toHaveCount(1);
  await checkA11y(page, "penalidades-e-meritos", testInfo);
}

test("falta e mérito lançados em /absences mudam a nota final, a faixa e o bônus em Resultados", async ({ page }, testInfo) => {
  const errosDePagina: string[] = [];
  vigiarErros(page, "admin", errosDePagina);

  await test.step("admin restaura os tipos padrão de lançamento", async () => {
    await loginPelaTela(page, ADMIN.cpf, testInfo);
    await menu(page, "Tipos de Lançamento").click();
    await expect(page.getByRole("heading", { level: 1, name: "Tipos de Lançamento" })).toBeVisible();
    await page.getByRole("button", { name: "Restaurar Padrões" }).click();
    await expect(page.getByText(FALTA.label, { exact: true })).toBeVisible();
    await expect(page.getByText(MERITO.label, { exact: true })).toBeVisible();
    await checkA11y(page, "tipos-de-lancamento", testInfo);
  });

  await test.step("antes dos lançamentos: Diego com nota 90, Quênia, bônus R$ 3.200", async () => {
    await conferirResultado(page, testInfo, { nota: "90,0", faixa: "Quênia", bonus: /Bônus\s*R\$\s*3\.200/ });
  });

  await test.step(`admin lança falta (${FALTA.label}, −${FALTA.points}) para o Diego`, async () => {
    await lancar(page, testInfo, FALTA, "−", "E2E: faltou sem aviso.");
  });

  await test.step("com a falta: nota 83,75 (90 − 50/8), faixa Verde, bônus R$ 2.200", async () => {
    await conferirResultado(page, testInfo, { nota: "83,8", faixa: "Verde", bonus: /Bônus\s*R\$\s*2\.200/ });
  });

  await test.step(`admin lança mérito (${MERITO.label}, +${MERITO.points}) para o Diego`, async () => {
    await lancar(page, testInfo, MERITO, "+", "E2E: destaque no evento.");
  });

  await test.step("com falta e mérito: nota 86,9 (90 − 25/8), faixa Azul, bônus R$ 2.700; o detalhe lista os dois", async () => {
    await conferirResultado(page, testInfo, { nota: "86,9", faixa: "Azul", bonus: /Bônus\s*R\$\s*2\.700/ });
    await page.getByTestId(`card-ranking-${DIEGO.id}`).click();
    const detalhe = page.getByRole("dialog");
    await expect(detalhe.getByRole("heading", { name: DIEGO.name })).toBeVisible();
    // Nota com 1 casa na tela; a conta aparece por extenso: (Σ notas − penalidades + méritos) ÷ eventos.
    await expect(detalhe.getByTestId("detail-final-result")).toHaveText("86,9");
    await expect(detalhe.getByText(`(720,0 − ${FALTA.points} + ${MERITO.points}) ÷ 8 = 86,9`)).toBeVisible();
    await expect(detalhe.getByTestId("detail-bonus-value").first()).toHaveText(/R\$\s*2\.700,00/);
    await expect(detalhe.locator('[data-testid^="detail-penalty-"]')).toHaveCount(1);
    await expect(detalhe.locator('[data-testid^="detail-penalty-"]')).toContainText(FALTA.label);
    await expect(detalhe.locator('[data-testid^="detail-merit-"]')).toHaveCount(1);
    await expect(detalhe.locator('[data-testid^="detail-merit-"]')).toContainText(MERITO.label);
  });

  expect(errosDePagina, "Erros de JavaScript não tratados nas páginas").toEqual([]);
});
