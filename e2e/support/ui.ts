// Passos de tela reaproveitados pelos specs extras (link público, faltas e
// méritos, auditoria). O fluxo principal tem as próprias cópias, de propósito:
// ele é a referência e fica legível de ponta a ponta sozinho.
import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";
import { checkA11y } from "./a11y";
import { WEB_URL } from "./env";

/** Entra pela tela de login (CPF = senha, ver pages/login.tsx). */
export async function loginPelaTela(page: Page, cpf: string, testInfo: TestInfo, { checarA11y = false } = {}) {
  await page.goto("/login");
  const cpfInput = page.getByLabel("CPF");
  await expect(cpfInput).toBeVisible();
  if (checarA11y) await checkA11y(page, "login", testInfo);
  await cpfInput.fill(cpf);
  await page.getByRole("button", { name: "Acessar" }).click();
  // Sai da tela de login (cada papel cai numa página diferente).
  await expect(page).not.toHaveURL(/\/login$/);
}

/** Exceções JS não tratadas na página (tela branca, erro de render) também reprovam o spec. */
export function vigiarErros(page: Page, quem: string, erros: string[]) {
  page.on("pageerror", e => erros.push(`[${quem}] ${e.message}`));
}

/** Link do menu lateral (mesma navegação que a pessoa usa). */
export function menu(page: Page, nome: string) {
  return page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: nome, exact: true });
}

/** Contexto novo, sem sessão — alguém de fora do sistema abrindo um link. */
export async function novoContextoAnonimo(browser: Browser) {
  return browser.newContext({ baseURL: WEB_URL, locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
}
