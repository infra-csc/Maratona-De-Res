// Checagem simples de acessibilidade por tela visitada, só com o Playwright
// (sem axe): (1) exatamente um <h1> visível; (2) todo campo de formulário
// visível tem nome acessível (label, aria-label, aria-labelledby, title ou,
// em último caso, placeholder — a mesma conta que o Chromium faz).
//
// O nome acessível vem do snapshot de acessibilidade do próprio elemento
// (locator.ariaSnapshot(), ex.: `- textbox "Buscar colaborador"`): é a árvore
// que um leitor de tela recebe, e não uma reimplementação da regra.
//
// KNOWN_ISSUES: dívidas já conhecidas que o E2E registra (anotação no
// relatório) sem falhar, porque corrigi-las exige mexer em telas fora do
// escopo deste teste. Qualquer problema NOVO fora desta lista falha o teste.
// Quando uma dívida for corrigida, remova a linha correspondente.
import { expect, type Page, type TestInfo } from "@playwright/test";

type KnownIssue = { screen: string; rule: "h1" | "input-name"; match?: RegExp; why: string };

// Login, Calibrações (h1, seletor de evento e campo de peso) corrigidos em 25/09.
export const KNOWN_ISSUES: KnownIssue[] = [];

const FIELD_SELECTOR = [
  "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image])",
  "textarea",
  "select",
  "[role=textbox]",
  "[role=combobox]",
  "[role=searchbox]",
  "[role=spinbutton]",
  "[role=slider]",
  "[role=checkbox]",
  "[role=radio]",
  "[role=switch]",
  "[contenteditable=true]",
].join(", ");

/** Identificação legível do campo para a mensagem de erro. */
async function describeField(el: ReturnType<Page["locator"]>): Promise<string> {
  return el.evaluate(node => {
    const e = node as HTMLElement;
    const id = e.getAttribute("data-testid") ?? (e.id ? `#${e.id}` : null) ?? (e.getAttribute("name") ? `[name=${e.getAttribute("name")}]` : null);
    return id ?? `<${e.tagName.toLowerCase()}${e.className ? ` class="${String(e.className).slice(0, 60)}"` : ""}>`;
  });
}

/**
 * Nome acessível a partir do snapshot: `- textbox "Nome"` → "Nome"; sem nome
 * (`- textbox`, `- textbox: valor`) → "". Quando o nome tem aspas, o snapshot
 * (YAML) embrulha a linha inteira: `- 'textbox "Ex.: \"João\""'`.
 */
function nameFromSnapshot(snapshot: string): string {
  let line = (snapshot.split("\n")[0] ?? "").trim().replace(/^- /, "");
  if (line.startsWith("'")) {
    line = line.slice(1, line.lastIndexOf("'")).replace(/''/g, "'");
  } else if (line.startsWith('"')) {
    const end = line.lastIndexOf('"');
    try { line = JSON.parse(line.slice(0, end + 1)) as string; } catch { /* mantém a linha crua */ }
  }
  const m = /^[\w-]+ "((?:[^"\\]|\\.)*)"/.exec(line);
  return m ? m[1].trim() : "";
}

/**
 * `inDialog`: com um diálogo modal aberto, o resto da página sai da árvore de
 * acessibilidade (aria-hidden) — o h1 some de propósito. Aí só vale a regra
 * dos campos, que é o que importa no diálogo.
 */
export async function checkA11y(page: Page, screen: string, testInfo: TestInfo, opts: { inDialog?: boolean } = {}): Promise<void> {
  const known = KNOWN_ISSUES.filter(k => k.screen === screen);
  const problems: string[] = [];
  const tolerated: string[] = [];

  // (1) exatamente um h1 visível (fora de diálogo modal)
  const h1Count = opts.inDialog ? 1 : await page.getByRole("heading", { level: 1 }).filter({ visible: true }).count();
  if (h1Count !== 1) {
    const msg = `[${screen}] ${h1Count} <h1> visíveis (esperado: 1)`;
    const k = known.find(i => i.rule === "h1");
    // Dívida conhecida é "não tem h1"; dois ou mais h1 continua sendo falha.
    if (k && h1Count === 0) tolerated.push(`${msg} — conhecido: ${k.why}`);
    else problems.push(msg);
  }

  // (2) campos visíveis com nome acessível
  const fields = page.locator(FIELD_SELECTOR).filter({ visible: true });
  const n = await fields.count();
  for (let i = 0; i < n; i++) {
    const el = fields.nth(i);
    const snapshot = await el.ariaSnapshot().catch(() => "");
    if (!snapshot.trim()) continue; // fora da árvore de acessibilidade (aria-hidden etc.)
    if (nameFromSnapshot(snapshot)) continue;
    const who = await describeField(el);
    const msg = `[${screen}] campo sem nome acessível: ${who} (${snapshot.split("\n")[0].trim()})`;
    const k = known.find(i2 => i2.rule === "input-name" && i2.match?.test(who));
    if (k) tolerated.push(`${msg} — conhecido: ${k.why}`);
    else problems.push(msg);
  }

  for (const t of tolerated) testInfo.annotations.push({ type: "a11y (dívida conhecida)", description: t });
  expect(problems, `Problemas de acessibilidade na tela "${screen}":\n${problems.join("\n")}`).toEqual([]);
}
