// Análises → "Apresentação para a equipe": a visão que vai para todos os
// colaboradores. O que importa garantir é o sigilo: nenhum nome de avaliador
// nem de colaborador aparece — nem na página, nem no modo apresentação.
//
//   admin abre Análises → aba "Apresentação para a equipe" → as partes "O que
//   foi bom" e "O que precisa melhorar" existem → nenhum nome sensível no texto
//   → "Apresentar" abre a tela cheia, → avança, Esc fecha.
import { expect, test } from "@playwright/test";
import { checkA11y } from "./support/a11y";
import { ADMIN, AVALIADOR, AVALIADORA_LINK, ANA, DIEGO, ELISA, FABIO } from "./support/env";
import { loginPelaTela, menu, vigiarErros } from "./support/ui";

const NOMES_SIGILOSOS = [ADMIN.name, AVALIADOR.name, AVALIADORA_LINK.name, ANA.name, DIEGO.name, ELISA.name, FABIO.name];

test("apresentação para a equipe: sem nomes de avaliador ou colaborador, com modo tela cheia", async ({ page }, testInfo) => {
  const errosDePagina: string[] = [];
  vigiarErros(page, "admin", errosDePagina);

  await loginPelaTela(page, ADMIN.cpf, testInfo);
  await menu(page, "Análises").click();
  await page.getByTestId("tab-analytics-equipe").click();
  await expect(page).toHaveURL(/\/analytics\/apresentacao$/);
  await expect(page.getByRole("heading", { level: 2, name: "O que foi bom" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "O que precisa melhorar" })).toBeVisible();
  await checkA11y(page, "apresentacao-equipe", testInfo);

  const texto = await page.getByRole("main").innerText();
  for (const nome of NOMES_SIGILOSOS) expect(texto, `"${nome}" apareceu na apresentação`).not.toContain(nome);

  await page.getByTestId("button-team-present").click();
  const apresentacao = page.getByTestId("team-presenter");
  await expect(apresentacao).toBeVisible();
  await expect(apresentacao).toHaveAttribute("aria-label", /Como a equipe foi no ciclo/);
  await page.keyboard.press("ArrowRight");
  await expect(apresentacao).not.toHaveAttribute("aria-label", /Como a equipe foi no ciclo/);
  const textoApresentando = await apresentacao.innerText();
  for (const nome of NOMES_SIGILOSOS) expect(textoApresentando).not.toContain(nome);
  await page.keyboard.press("Escape");
  await expect(apresentacao).toBeHidden();

  expect(errosDePagina, errosDePagina.join("\n")).toEqual([]);
});
