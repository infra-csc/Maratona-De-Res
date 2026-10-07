// AVALIAÇÃO POR ÁREA, de ponta a ponta:
//
//   Ana (avaliadora da área "Cenários E2E", sem designação nenhuma) entra,
//   acha o evento na lista "A responder", responde e lança → o evento vai para
//   "Respondidos". Beto, da mesma área, chega pelo link direto do evento
//   (como o portal NORTE abre: /evaluations?evento=ID) SEM sessão → faz login
//   → cai no evento pedido e vê "Respondido por Ana…", sem formulário.
//
// Dados próprios (support/seed.ts): área 3, usuários 4 e 5, critério 3 e o
// evento 12 — nada aqui toca os outros specs.
// Capturas (1366 e 390, claro e escuro) em test-results/capturas-area/.
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { AREA_ANA, AREA_BETO, AREA_CRITERION, AREA_EVENT, REPO_ROOT, WEB_URL } from "./support/env";
import { loginPelaTela, vigiarErros } from "./support/ui";

const SHOTS = path.join(REPO_ROOT, "test-results", "capturas-area");

async function shot(page: Page, name: string, width: number, height: number, dark = false) {
  await page.setViewportSize({ width, height });
  await page.evaluate(d => {
    localStorage.setItem("premium_theme_dark", d ? "1" : "0");
    document.documentElement.classList.toggle("dark", d);
  }, dark);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${width}${dark ? "-escuro" : ""}.png`), fullPage: false });
}

test("avaliador da área responde sem atribuição e o segundo vê 'respondido por'", async ({ browser }, testInfo) => {
  const erros: string[] = [];

  await test.step("Ana acha o evento em 'A responder', avalia e lança", async () => {
    const ctx = await browser.newContext({ baseURL: WEB_URL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 1366, height: 800 } });
    const page = await ctx.newPage();
    vigiarErros(page, "ana", erros);
    try {
      await loginPelaTela(page, AREA_ANA.cpf, testInfo);
      await expect(page).toHaveURL(/\/evaluations$/);
      const item = page.getByTestId(`evaluator-event-${AREA_EVENT.id}`);
      await expect(item).toContainText("0/1");
      // Busca por cidade filtra no servidor.
      await page.getByRole("searchbox", { name: "Buscar evento, cliente ou cidade" }).fill("itu");
      await expect(item).toBeVisible();
      await page.getByRole("searchbox", { name: "Buscar evento, cliente ou cidade" }).fill("cidade-que-nao-existe");
      await expect(page.getByText("Nenhum evento encontrado com esses filtros.")).toBeVisible();
      await page.getByRole("searchbox", { name: "Buscar evento, cliente ou cidade" }).fill("");
      await checkA11y(page, "avaliacoes-area-lista", testInfo);
      await shot(page, "01-lista", 1366, 800);

      await item.click();
      await expect(page).toHaveURL(new RegExp(`/evaluations\\?evento=${AREA_EVENT.id}$`));
      await expect(page.getByRole("heading", { level: 2, name: AREA_EVENT.name })).toBeVisible();
      await expect(page.getByText("Qualquer avaliador da área pode responder.")).toBeVisible();

      const card = page.locator(".criterion-row").filter({ has: page.getByRole("heading", { name: `1. ${AREA_CRITERION.name}` }) });
      await card.getByRole("button", { name: "9", exact: true }).click();
      await card.getByRole("textbox").fill("E2E: cenário montado no prazo e sem retrabalho.");
      await shot(page, "02-formulario", 1366, 800);
      await shot(page, "02-formulario", 390, 844);
      await page.setViewportSize({ width: 1366, height: 800 });

      await page.getByTestId("button-submit-eval").click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Lançar agora" }).click();
      await expect(page.getByText("Avaliação lançada com sucesso").first()).toBeVisible();
      await expect(page.getByTestId(`evaluator-event-${AREA_EVENT.id}`)).toHaveCount(0);
      await page.getByTestId("filter-status-done").click();
      await expect(page.getByTestId(`evaluator-event-done-${AREA_EVENT.id}`)).toContainText("1/1");
      await shot(page, "03-respondidos", 1366, 800);
    } finally {
      await ctx.close();
    }
  });

  await test.step("Beto abre o link do evento sem sessão, entra e vê 'Respondido por Ana'", async () => {
    const ctx = await browser.newContext({ baseURL: WEB_URL, locale: "pt-BR", timezoneId: "America/Sao_Paulo", viewport: { width: 1366, height: 800 } });
    const page = await ctx.newPage();
    vigiarErros(page, "beto", erros);
    try {
      // Link direto (portal): sem sessão vai para o login e, depois dele, volta ao evento.
      await page.goto(`/evaluations?evento=${AREA_EVENT.id}`);
      await expect(page).toHaveURL(/\/login$/);
      await page.getByLabel("CPF").fill(AREA_BETO.cpf);
      await page.getByRole("button", { name: "Acessar" }).click();
      await expect(page).toHaveURL(new RegExp(`/evaluations\\?evento=${AREA_EVENT.id}$`));
      await expect(page.getByRole("heading", { level: 2, name: AREA_EVENT.name })).toBeVisible();

      const fechado = page.getByTestId(`criterion-closed-${AREA_CRITERION.id}`);
      await expect(fechado).toContainText(`Respondido por ${AREA_ANA.name}`);
      await expect(fechado).toContainText(/em \d{2}\/\d{2} \d{2}:\d{2}/);
      // Vê o que foi avaliado: nota e comentário de quem respondeu.
      await expect(page.getByTestId(`closed-score-${AREA_CRITERION.id}`)).toHaveText("9");
      await expect(fechado).toContainText("cenário montado no prazo");
      // Sem formulário: nem notas, nem comentário, nem botão de lançar.
      await expect(fechado.getByRole("textbox")).toHaveCount(0);
      await expect(page.getByTestId("button-submit-eval")).toHaveCount(0);
      await expect(page.getByText("Sua área já respondeu este evento")).toBeVisible();
      // Na lista, nada a responder.
      await expect(page.getByTestId(`evaluator-event-${AREA_EVENT.id}`)).toHaveCount(0);
      await checkA11y(page, "avaliacoes-area-fechado", testInfo);

      await shot(page, "04-respondido-por", 1366, 800);
      await shot(page, "04-respondido-por", 1366, 800, true);
      await shot(page, "04-respondido-por", 390, 844);
      await shot(page, "04-respondido-por", 390, 844, true);
      // Celular: "← Eventos" volta para a lista (que some com um evento aberto).
      await page.getByRole("button", { name: "Eventos" }).click();
      await expect(page).toHaveURL(/\/evaluations$/);
      await expect(page.getByRole("searchbox", { name: "Buscar evento, cliente ou cidade" })).toBeVisible();
      await shot(page, "05-lista-vazia", 390, 844);
      await shot(page, "05-lista-vazia", 390, 844, true);

      // Avaliador só avalia: qualquer outra tela volta para /evaluations.
      for (const rota of ["/results", "/events", "/calibrations", "/employees", "/meu-desempenho", "/rota-que-nao-existe"]) {
        await page.goto(rota);
        await expect(page).toHaveURL(/\/evaluations$/);
      }
    } finally {
      await ctx.close();
    }
  });

  expect(erros, "Erros de JavaScript não tratados nas páginas").toEqual([]);
});
