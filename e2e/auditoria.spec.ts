// Auditoria mostra a ação que acabou de ser feita, com o nome do evento, e o
// "O que mudou" abre com o antes → depois:
//
//   admin confirma os resultados de um evento no detalhe do evento →
//   Auditoria, filtrada pela ação "Confirmou os resultados", lista
//   "Admin E2E confirmou os resultados · <evento>" → clicar na linha abre a
//   tabela "Campos alterados" com "Resultados confirmados: Não → Sim".
//
// Dados próprios (support/seed.ts): AUDIT_EVENT, já calibrado e ainda não
// confirmado. O fluxo principal também confirma um evento (outro): a busca
// aqui é pelo nome deste evento, então a ordem dos specs não importa.
import { expect, test } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN, AUDIT_EVENT } from "./support/env";
import { loginPelaTela, menu, vigiarErros } from "./support/ui";

test("auditoria: a confirmação de resultados aparece com o nome do evento e o 'O que mudou' abre", async ({ page }, testInfo) => {
  const errosDePagina: string[] = [];
  vigiarErros(page, "admin", errosDePagina);

  await test.step("admin confirma os resultados do evento", async () => {
    await loginPelaTela(page, ADMIN.cpf, testInfo);
    await page.goto(`/events/${AUDIT_EVENT.id}`);
    await expect(page.getByRole("heading", { level: 1, name: AUDIT_EVENT.name })).toBeVisible();
    await expect(page.getByTestId("badge-results-pending")).toHaveText("Não Confirmado");
    await checkA11y(page, "evento", testInfo);

    await page.getByTestId("button-confirm-results").click();
    const dialogo = page.getByRole("dialog", { name: "Confirmar resultados" });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Resultados confirmados").first()).toBeVisible();
    await expect(page.getByTestId("badge-results-confirmed")).toHaveText("Resultados Confirmados");
  });

  await test.step("Auditoria, filtrada pela ação, lista quem confirmou e qual evento", async () => {
    await menu(page, "Auditoria").click();
    await expect(page.getByRole("heading", { level: 1, name: "Auditoria" })).toBeVisible();
    await checkA11y(page, "auditoria", testInfo);

    await page.getByRole("combobox", { name: "Ação" }).click();
    await page.getByRole("option", { name: "Confirmou os resultados", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Ação" })).toContainText("Confirmou os resultados");
    await expect(page.getByText(/\d+ (ação registrada|ações registradas) com estes filtros/)).toBeVisible();

    const linha = page.locator('[data-testid^="row-audit-"]').filter({ hasText: AUDIT_EVENT.name });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText(`${ADMIN.name} confirmou os resultados · ${AUDIT_EVENT.name}`);
    await checkA11y(page, "auditoria-filtrada", testInfo);
  });

  await test.step("o 'O que mudou' abre com Resultados confirmados: Não → Sim", async () => {
    const linha = page.locator('[data-testid^="row-audit-"]').filter({ hasText: AUDIT_EVENT.name });
    const botao = linha.getByRole("button", { expanded: false }).first();
    await botao.click();
    await expect(linha.getByRole("button", { expanded: true })).toBeVisible();

    const tabela = linha.getByRole("table", { name: "Campos alterados: valor antes e depois" });
    await expect(tabela).toBeVisible();
    const campo = tabela.getByRole("row", { name: /Resultados confirmados/ });
    await expect(campo.getByRole("cell").nth(0)).toHaveText("Não");
    await expect(campo.getByRole("cell").nth(1)).toHaveText("Sim");
    await expect(tabela.getByRole("rowheader", { name: "Confirmado em" })).toBeVisible();
    await checkA11y(page, "auditoria-detalhe", testInfo);

    // Fecha de novo pelo mesmo botão.
    await linha.getByRole("button", { expanded: true }).click();
    await expect(tabela).toBeHidden();
  });

  expect(errosDePagina, "Erros de JavaScript não tratados nas páginas").toEqual([]);
});
