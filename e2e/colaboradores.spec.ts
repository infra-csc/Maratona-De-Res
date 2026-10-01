// Colaboradores: ninguém fica inacessível.
//
//   A lista padrão ("No ciclo") só mostra quem tem nota no ciclo; quem ainda
//   não tem (freela, recém-criado) aparece pela BUSCA, numa seção à parte
//   "Sem nota no ciclo". Ao criar, a busca é preenchida com o nome para o
//   colaborador aparecer na hora. A aba "Fora do ciclo" existe para devolver
//   quem o admin tirou do ciclo.
import { expect, test } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN } from "./support/env";
import { loginPelaTela, menu, vigiarErros } from "./support/ui";

test("admin cria um colaborador e o encontra pela busca em \"Sem nota no ciclo\"; a aba \"Fora do ciclo\" existe", async ({ page }, testInfo) => {
  const errosDePagina: string[] = [];
  vigiarErros(page, "admin", errosDePagina);
  const nome = `Zuleica Nova E2E ${Date.now().toString().slice(-6)}`;

  await test.step("admin abre Colaboradores pelo menu", async () => {
    await loginPelaTela(page, ADMIN.cpf, testInfo);
    await menu(page, "Colaboradores").click();
    await expect(page.getByTestId("text-page-title")).toHaveText(/Colaboradores/i);
    await expect(page.getByTestId("filter-cycle-in")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("filter-cycle-out")).toBeVisible();
    await checkA11y(page, "colaboradores", testInfo);
  });

  await test.step("cria o colaborador: a busca vem preenchida e ele aparece em \"Sem nota no ciclo\"", async () => {
    await page.getByTestId("button-create-employee").click();
    const dialogo = page.getByRole("dialog", { name: /Novo Colaborador/i });
    await expect(dialogo).toBeVisible();
    await dialogo.getByTestId("input-employee-name").fill(nome);
    await dialogo.getByTestId("button-submit-employee").click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText(/Entra em "No ciclo" quando tiver nota/).first()).toBeVisible();

    await expect(page.getByTestId("input-search-employees")).toHaveValue(nome);
    const secao = page.getByTestId("section-no-score");
    await expect(secao).toBeVisible();
    await expect(secao).toContainText(/Sem nota no ciclo/i);
    const linha = secao.locator('[data-testid^="row-employee-"]').filter({ hasText: new RegExp(nome, "i") });
    await expect(linha).toHaveCount(1);
    await expect(linha).toContainText(/Sem nota/i);
    await expect(linha.locator('[data-testid^="button-edit-employee-"]')).toBeVisible();
    await checkA11y(page, "colaboradores-busca-sem-nota", testInfo);
  });

  await test.step("sem busca, a lista padrão continua só com quem tem nota", async () => {
    await page.getByTestId("input-search-employees").fill("");
    await expect(page.getByTestId("section-no-score")).toHaveCount(0);
    await expect(page.locator('[data-testid^="row-employee-"]').filter({ hasText: new RegExp(nome, "i") })).toHaveCount(0);
  });

  await test.step("a aba \"Fora do ciclo\" abre", async () => {
    await page.getByTestId("filter-cycle-out").click();
    await expect(page.getByTestId("filter-cycle-out")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("filter-cycle-in")).toHaveAttribute("aria-pressed", "false");
  });

  expect(errosDePagina, "Erros de JavaScript não tratados nas páginas").toEqual([]);
});
