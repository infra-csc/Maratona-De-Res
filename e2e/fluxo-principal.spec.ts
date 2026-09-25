// Fluxo principal da Maratona de Resultados, de ponta a ponta pelo navegador:
//
//   admin entra → abre o evento → avaliador entra e avalia os critérios em
//   /evaluations → admin calibra em /calibrations → admin confirma os
//   resultados no detalhe do evento → Resultados mostra a colaboradora
//   passando de inelegível (7 eventos) para elegível com bônus (8 eventos).
//
// Dados: e2e/support/seed.ts (banco novo a cada execução, via global-setup).
// Em cada tela visitada roda a checagem simples de acessibilidade
// (support/a11y.ts).
//
// Fora do escopo (e por quê):
//  - "Publicar" notas (parcial/final) na Calibração: não é pré-requisito para
//    confirmar resultados nem muda o bônus; só libera o feedback ao avaliador.
//  - Áudio da avaliação: opcional e depende do Object Storage do Google.
//  - Matriz de Conformidade: sem avaliador de conformidade designado no seed,
//    a conformidade fica "pendente = SIM" (sem desconto), a regra oficial.
//  - Fechar o ciclo / pagamentos: operação de fim de ciclo, fora do fluxo do evento.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN, ANA, AVALIADOR, CRITERIA, TARGET_EVENT, WEB_URL } from "./support/env";

async function loginPelaTela(page: Page, cpf: string, testInfo: TestInfo, { checarA11y = false } = {}) {
  await page.goto("/login");
  const cpfInput = page.getByLabel("CPF");
  await expect(cpfInput).toBeVisible();
  if (checarA11y) await checkA11y(page, "login", testInfo);
  await cpfInput.fill(cpf);
  await page.getByRole("button", { name: "Acessar" }).click();
}

/** Exceções JS não tratadas na página (tela branca, erro de render) também reprovam o fluxo. */
function vigiarErros(page: Page, quem: string, erros: string[]) {
  page.on("pageerror", e => erros.push(`[${quem}] ${e.message}`));
}

function rankingDe(page: Page, employeeId: number) {
  return page.getByTestId(`card-ranking-${employeeId}`);
}

test("fluxo principal: avaliar, calibrar e confirmar o evento gera o bônus da colaboradora", async ({ page, browser }, testInfo) => {
  const errosDePagina: string[] = [];
  vigiarErros(page, "admin", errosDePagina);

  await test.step("admin entra pela tela de login e cai no Dashboard", async () => {
    await loginPelaTela(page, ADMIN.cpf, testInfo, { checarA11y: true });
    await expect(page.getByRole("heading", { level: 1, name: "Painel de Controle" })).toBeVisible();
    await checkA11y(page, "dashboard", testInfo);
  });

  await test.step("admin abre o evento pela lista de Eventos", async () => {
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Eventos", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Eventos do Ciclo" })).toBeVisible();
    const linha = page.getByTestId(`row-event-${TARGET_EVENT.id}`);
    await expect(linha).toBeVisible();
    await checkA11y(page, "eventos", testInfo);

    await linha.getByRole("link", { name: TARGET_EVENT.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${TARGET_EVENT.id}$`));
    await expect(page.getByRole("heading", { level: 1, name: TARGET_EVENT.name })).toBeVisible();
    await expect(page.getByTestId("badge-results-pending")).toHaveText("Não Confirmado");
    await checkA11y(page, "evento", testInfo);
  });

  await test.step("avaliador entra, avalia os critérios do evento e lança a avaliação", async () => {
    const ctx = await browser.newContext({ baseURL: WEB_URL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    const av = await ctx.newPage();
    vigiarErros(av, "avaliador", errosDePagina);
    try {
      await loginPelaTela(av, AVALIADOR.cpf, testInfo);
      // Avaliador vive em /evaluations (HomeRoute redireciona).
      await expect(av).toHaveURL(/\/evaluations$/);
      await expect(av.getByRole("heading", { level: 1, name: /Central de Avaliações/ })).toBeVisible();
      const itemEvento = av.getByTestId(`evaluator-event-${TARGET_EVENT.id}`);
      await expect(itemEvento).toContainText("0/2");
      await checkA11y(av, "avaliacoes", testInfo);

      await itemEvento.click();
      await expect(av.getByRole("heading", { level: 2, name: TARGET_EVENT.name })).toBeVisible();

      const notas: Record<number, string> = { [CRITERIA[0].id]: "9", [CRITERIA[1].id]: "8" };
      for (const [i, c] of CRITERIA.entries()) {
        const card = av.locator(".criterion-row").filter({ has: av.getByRole("heading", { name: `${i + 1}. ${c.name}` }) });
        await card.getByRole("button", { name: notas[c.id], exact: true }).click();
        await card.getByRole("textbox").fill(`E2E: ${c.name} dentro do esperado.`);
      }
      await checkA11y(av, "avaliacao-do-evento", testInfo);

      await av.getByTestId("button-submit-eval").click();
      const dialogo = av.getByRole("alertdialog");
      await expect(dialogo).toBeVisible();
      await dialogo.getByRole("button", { name: "Lançar agora" }).click();
      await expect(av.getByText("Avaliação lançada com sucesso").first()).toBeVisible();
      // O evento sai de "A Fazer" e vai para "Concluídas".
      await expect(av.getByTestId(`evaluator-event-done-${TARGET_EVENT.id}`)).toBeVisible();
      await expect(av.getByTestId(`evaluator-event-${TARGET_EVENT.id}`)).toHaveCount(0);
    } finally {
      await ctx.close();
    }
  });

  await test.step("admin calibra a nota do 2º critério (8 → 9) com justificativa", async () => {
    await page.goto(`/events/${TARGET_EVENT.id}`);
    await page.getByTestId("link-event-calibrations").click();
    await expect(page).toHaveURL(new RegExp(`/calibrations\\?eventId=${TARGET_EVENT.id}$`));

    const c1 = page.getByTestId(`row-cal-${CRITERIA[0].id}`);
    const c2 = page.getByTestId(`row-cal-${CRITERIA[1].id}`);
    await expect(c1).toContainText(CRITERIA[0].name);
    // Notas enviadas pelo avaliador chegaram na calibração.
    await expect(c1).toContainText("9,00");
    await expect(c2).toContainText("8,00");
    await checkA11y(page, "calibracoes", testInfo);

    await page.getByTestId(`input-cal-reason-inline-${CRITERIA[1].id}`).fill("E2E: atraso justificado pelo cliente.");
    await page.getByTestId(`input-cal-score-${CRITERIA[1].id}`).fill("9");
    await page.getByTestId(`button-save-cal-${CRITERIA[1].id}`).click();
    await expect(page.getByText("Calibração registrada").first()).toBeVisible();
    await expect(c2).toContainText("→ 9");
    await expect(page.getByTestId(`input-cal-score-${CRITERIA[1].id}`)).toHaveValue("9");
  });

  await test.step("antes da confirmação: Ana tem 7 eventos e está inelegível", async () => {
    await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Resultados & Ranking" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /Resultados & Ranking/ })).toBeVisible();
    const ana = rankingDe(page, ANA.id);
    await expect(ana).toContainText(ANA.name);
    await expect(ana).toContainText("7 eventos");
    await expect(ana).toContainText("Inelegível");
    await expect(ana).not.toContainText("Bônus");
    await checkA11y(page, "resultados", testInfo);
  });

  await test.step("admin confirma os resultados do evento", async () => {
    await page.goto(`/events/${TARGET_EVENT.id}`);
    await page.getByTestId("button-confirm-results").click();
    const dialogo = page.getByRole("dialog", { name: "Confirmar resultados" });
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Resultados confirmados").first()).toBeVisible();
    await expect(page.getByTestId("badge-results-confirmed")).toHaveText("Resultados Confirmados");
    await expect(page.getByTestId("button-unconfirm-results")).toBeVisible();
  });

  await test.step("Resultados: Ana chega a 8 eventos, faixa Quênia e bônus de R$ 3.200,00", async () => {
    await page.goto("/results");
    const ana = rankingDe(page, ANA.id);
    await expect(ana).toContainText("8 eventos");
    await expect(ana).not.toContainText("Inelegível");
    await expect(ana).toContainText("Quênia");
    await expect(page.getByTestId(`text-final-result-${ANA.id}`)).toHaveText(/^90([,.]0+)?$/);
    await expect(ana).toContainText(/Bônus\s*R\$\s*3\.200/);
    // Carla só tem o evento alvo: continua fora do bônus.
    await expect(rankingDe(page, 3)).toContainText("Inelegível");
    await checkA11y(page, "resultados", testInfo);

    await ana.click();
    const detalhe = page.getByRole("dialog");
    await expect(detalhe).toBeVisible();
    await expect(detalhe.getByRole("heading", { name: ANA.name })).toBeVisible();
    await expect(detalhe.getByTestId("detail-bonus-value").first()).toHaveText(/R\$\s*3\.200,00/);
    await expect(detalhe.getByTestId(`detail-event-${TARGET_EVENT.id}`)).toBeVisible();
  });

  expect(errosDePagina, "Erros de JavaScript não tratados nas páginas").toEqual([]);
});
