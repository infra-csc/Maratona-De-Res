// Avaliação pelo LINK PÚBLICO (/eval/:token), de ponta a ponta:
//
//   admin abre a Central de Avaliações → escolhe o evento → gera o "Link
//   Freelancer" do questionário da avaliadora designada → uma pessoa de fora,
//   sem login, abre o link, preenche nome, notas e comentários e envia →
//   o link passa a "Link Já Utilizado" → as notas chegam na Calibração do
//   evento e a Central mostra quem preencheu.
//
// Dados próprios (support/seed.ts): evento LINK_EVENT, critérios designados à
// AVALIADORA_LINK (que nunca entra no sistema). Nada aqui toca o evento do
// fluxo principal, então a ordem dos specs não importa.
import { expect, test } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN, AVALIADORA_LINK, CRITERIA, LINK_EVENT } from "./support/env";
import { loginPelaTela, menu, novoContextoAnonimo, vigiarErros } from "./support/ui";

const FREELANCER = "Marina Freelancer E2E";
const NOTAS: Record<number, number> = { [CRITERIA[0].id]: 8, [CRITERIA[1].id]: 7 };

test("link público: admin gera o link, freelancer avalia sem login e a nota chega na calibração", async ({ page, browser }, testInfo) => {
  const errosDePagina: string[] = [];
  vigiarErros(page, "admin", errosDePagina);
  let linkUrl = "";

  await test.step("admin abre o evento na Central de Avaliações", async () => {
    await loginPelaTela(page, ADMIN.cpf, testInfo);
    await menu(page, "Avaliações").click();
    await expect(page.getByRole("heading", { level: 1, name: "Central de Avaliações" })).toBeVisible();
    await page.getByRole("button", { name: new RegExp(LINK_EVENT.name, "i") }).click();
    await expect(page.getByRole("heading", { level: 2, name: LINK_EVENT.name })).toBeVisible();
    await checkA11y(page, "central-avaliacoes-admin", testInfo);
  });

  await test.step("admin gera o Link Freelancer do questionário da avaliadora", async () => {
    await page.getByRole("button", { name: "Link", exact: true }).first().click();
    await expect(page.getByText(`Avaliador: ${AVALIADORA_LINK.name}`)).toBeVisible();
    await page.getByRole("textbox", { name: "Para quem é o link" }).fill(FREELANCER);
    await page.getByRole("button", { name: "Gerar Link" }).click();
    await expect(page.getByText("Link gerado — copie e envie")).toBeVisible();
    await checkA11y(page, "link-freelancer-dialogo", testInfo, { inDialog: true });
    const campoLink = page.locator("input[readonly]").filter({ visible: true });
    linkUrl = await campoLink.inputValue();
    expect(linkUrl).toMatch(/\/eval\/[0-9a-f-]{36}$/);
  });

  await test.step("freelancer, sem login, abre o link, avalia e envia", async () => {
    const ctx = await novoContextoAnonimo(browser);
    const fl = await ctx.newPage();
    vigiarErros(fl, "freelancer", errosDePagina);
    try {
      await fl.goto(linkUrl);
      await expect(fl.getByRole("heading", { level: 1, name: LINK_EVENT.name })).toBeVisible();
      await expect(fl.getByText(`Preparado para: ${FREELANCER}`)).toBeVisible();
      await checkA11y(fl, "eval-publico", testInfo);

      await fl.getByRole("textbox", { name: "Confirme seu nome antes de responder" }).fill(FREELANCER);
      for (const c of CRITERIA) {
        await fl.getByRole("group", { name: `Nota do critério ${c.name}` }).getByRole("button", { name: `Nota ${NOTAS[c.id]}`, exact: true }).click();
        await fl.locator(`#crit-${c.id}-comment`).fill(`E2E (link): ${c.name} observada em campo.`);
      }
      await fl.getByRole("button", { name: "Enviar Respostas", exact: true }).click();
      await expect(fl.getByRole("heading", { level: 1, name: "Respostas Enviadas" })).toBeVisible();
      await expect(fl.getByText(`Obrigado, ${FREELANCER}.`)).toBeVisible();
      await checkA11y(fl, "eval-publico-enviado", testInfo);

      // Uso único: reabrir o link mostra que já foi preenchido, e por quem.
      await fl.reload();
      await expect(fl.getByRole("heading", { level: 1, name: "Link Já Utilizado" })).toBeVisible();
      await expect(fl.getByText(FREELANCER)).toBeVisible();
      await checkA11y(fl, "eval-publico-usado", testInfo);
    } finally {
      await ctx.close();
    }
  });

  await test.step("as notas do link chegam na Calibração do evento", async () => {
    await page.goto(`/calibrations?eventId=${LINK_EVENT.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const c of CRITERIA) {
      const linha = page.getByTestId(`row-cal-${c.id}`);
      await expect(linha).toContainText(c.name);
      await expect(linha).toContainText(`${NOTAS[c.id]},00`);
    }
    await checkA11y(page, "calibracoes", testInfo);
  });

  await test.step("a Central mostra o evento concluído e quem preencheu pelo link", async () => {
    await menu(page, "Avaliações").click();
    // Com os 2 critérios respondidos, o evento sai de "Em aberto" e vai para "Concluídos".
    await expect(page.getByRole("button", { name: new RegExp(LINK_EVENT.name, "i") })).toHaveCount(0);
    await page.getByRole("button", { name: /^Concluídos · \d+$/ }).click();
    await page.getByRole("button", { name: new RegExp(LINK_EVENT.name, "i") }).click();
    await expect(page.getByRole("heading", { level: 2, name: LINK_EVENT.name })).toBeVisible();
    await expect(page.getByText("2 de 2 critérios completos")).toBeVisible();
    await expect(page.getByText(`Preenchido por: ${FREELANCER}`).first()).toBeVisible();
  });

  expect(errosDePagina, "Erros de JavaScript não tratados nas páginas").toEqual([]);
});
