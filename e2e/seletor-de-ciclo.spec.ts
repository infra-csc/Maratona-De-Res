// Seletor de ciclo (Resultados & Ranking, Análises, Dashboard e Eventos):
// abre sempre no ciclo atual; o ciclo anterior é só consulta (sem fechar,
// recalcular, criar ou editar) — mas o PAGAMENTO do bônus dele continua
// liberado (o bônus é pago depois do fim do ciclo); o "Total geral" soma
// todos os ciclos, com o bônus oficial separado do projetado.
// A escolha vai na URL (?ciclo=ID | ?ciclo=todos) para o link ser compartilhável.
import { expect, test } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN, ANA, PREVIOUS_CYCLE, PREVIOUS_EVENT } from "./support/env";
import { loginPelaTela, menu, vigiarErros } from "./support/ui";

test("seletor de ciclo: abre no atual, consulta o anterior e mostra o Total geral", async ({ page }, testInfo) => {
  const erros: string[] = [];
  vigiarErros(page, "admin", erros);
  await loginPelaTela(page, ADMIN.cpf, testInfo);

  // Resultados abre no ciclo atual, sem aviso de consulta.
  await menu(page, "Resultados & Ranking").click();
  await expect(page).toHaveURL(/\/results$/);
  const seletor = page.getByTestId("cycle-select");
  await expect(page.getByTestId("cycle-select-value")).toHaveText("Ciclo E2E");
  await expect(page.getByTestId("cycle-readonly-notice")).toHaveCount(0);
  await checkA11y(page, "resultados-seletor-ciclo", testInfo);

  // Teclado: abre a lista e fecha com Esc.
  await seletor.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("cycle-select-content")).toBeVisible();
  await expect(page.getByTestId(`cycle-option-${PREVIOUS_CYCLE.id}`)).toBeVisible();
  await expect(page.getByTestId("cycle-option-todos")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cycle-select-content")).toBeHidden();

  // Ciclo anterior: dados dele, só consulta.
  await seletor.click();
  await page.getByTestId(`cycle-option-${PREVIOUS_CYCLE.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/results\\?ciclo=${PREVIOUS_CYCLE.id}$`));
  await expect(page.getByTestId("cycle-readonly-notice")).toContainText("Ciclo fechado — só consulta");
  await expect(page.getByTestId("cycle-readonly-notice")).toContainText("o pagamento do bônus deste ciclo continua liberado");
  await expect(page.getByTestId(`text-final-result-${ANA.id}`)).toHaveText("82,0");
  await page.getByTestId("tab-bonus").click();
  await expect(page.getByTestId(`row-result-${ANA.id}`)).toBeVisible();
  await expect(page.getByTestId("button-recompute-quarter")).toHaveCount(0);
  // Pagamento do ciclo anterior continua liberado.
  await expect(page.getByTestId(`button-payment-${ANA.id}`)).toBeVisible();
  await expect(page.getByRole("button", { name: /Fechar Ciclo/i })).toHaveCount(0);

  // Total geral: uma linha por pessoa, com o histórico ciclo a ciclo.
  await seletor.click();
  await page.getByTestId("cycle-option-todos").click();
  await expect(page).toHaveURL(/\/results\?ciclo=todos$/);
  await expect(page.getByTestId("cycle-readonly-notice")).toContainText("Total geral — só consulta");
  await expect(page.getByTestId("results-total")).toBeVisible();
  await expect(page.getByTestId("total-bonus-official")).toBeVisible();
  await expect(page.getByTestId("total-bonus-projected")).toBeVisible();
  await expect(page.getByTestId("total-open-cycle-warning")).toContainText("Ciclo E2E");
  await page.getByTestId(`button-total-expand-${ANA.id}`).click();
  await expect(page.getByTestId(`row-total-${ANA.id}`)).toBeVisible();
  await expect(page.getByRole("button", { name: PREVIOUS_CYCLE.name })).toBeVisible();
  await checkA11y(page, "resultados-total-geral", testInfo);

  // "Voltar ao ciclo atual" tira o parâmetro.
  await page.getByTestId("button-back-to-current-cycle").click();
  await expect(page).toHaveURL(/\/results$/);

  // Eventos: link compartilhado do ciclo anterior → só consulta.
  await page.goto(`/events?ciclo=${PREVIOUS_CYCLE.id}`);
  await expect(page.getByTestId(`row-event-${PREVIOUS_EVENT.id}`)).toBeVisible();
  await expect(page.getByTestId("button-create-event")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Mais ações para ${PREVIOUS_EVENT.name}` })).toHaveCount(0);
  // "Ver evento" de ciclo fechado abre o detalhe em modo consulta.
  await page.getByTestId(`button-view-event-${PREVIOUS_EVENT.id}`).click();
  await expect(page).toHaveURL(new RegExp(`/events/${PREVIOUS_EVENT.id}$`));
  await expect(page.getByTestId("event-readonly-notice")).toContainText("Ciclo fechado — só consulta");
  await expect(page.getByTestId("button-unconfirm-results")).toHaveCount(0);
  await expect(page.getByTestId("link-event-calibrations")).toHaveCount(0);
  await page.goto("/events?ciclo=todos");
  await expect(page.getByTestId(`badge-event-cycle-${PREVIOUS_EVENT.id}`)).toHaveText(PREVIOUS_CYCLE.name);
  await menu(page, "Eventos").click();
  await expect(page.getByTestId("cycle-select-value")).toHaveText("Ciclo E2E");
  await expect(page.getByTestId("button-create-event")).toBeVisible();
  await expect(page.getByTestId(`row-event-${PREVIOUS_EVENT.id}`)).toHaveCount(0);

  // Dashboard no Total geral e Análises num ciclo anterior (a aba leva o ciclo junto).
  await page.goto("/?ciclo=todos");
  await expect(page.getByTestId("cycle-readonly-notice")).toContainText("Total geral");
  await page.goto(`/analytics?ciclo=${PREVIOUS_CYCLE.id}`);
  await expect(page.getByTestId("cycle-select-value")).toHaveText(PREVIOUS_CYCLE.name);
  await page.getByTestId("tab-analytics-equipe").click();
  await expect(page).toHaveURL(new RegExp(`/analytics/apresentacao\\?ciclo=${PREVIOUS_CYCLE.id}$`));
  await expect(page.getByTestId("cycle-readonly-notice")).toBeVisible();

  expect(erros, erros.join("\n")).toEqual([]);
});
