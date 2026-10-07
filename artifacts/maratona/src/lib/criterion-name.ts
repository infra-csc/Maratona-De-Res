// Nome de critério na TELA. As cópias por área de um critério multiárea são
// gravadas como "Proatividade/Conduta (2)", "(3)"… (ou "(cópia)") — o sufixo
// fica no banco (o reagrupamento usa), mas nunca aparece para ninguém: o
// avaliador responde "o critério", não "a cópia 3". Para distinguir cópias,
// mostre nome + área: criterionLabel("Prazo (2)", "Cenografia") → "Prazo · Cenografia".

const COPY_SUFFIX = /\s*\((\d+|c[óo]pia)\)\s*$/i;

/** Nome do critério sem o sufixo " (n)" / " (cópia)" das cópias por área. */
export function displayCriterionName(name: string | null | undefined): string {
  return (name ?? "").replace(COPY_SUFFIX, "").trim();
}

/** true quando o nome gravado é de uma cópia por área ("Prazo (2)"). */
export function isCriterionCopyName(name: string | null | undefined): boolean {
  return COPY_SUFFIX.test(name ?? "");
}

/** "Nome · Área" — para distinguir as cópias de um critério multiárea. Sem área, só o nome. */
export function criterionLabel(name: string | null | undefined, areaName?: string | null): string {
  const base = displayCriterionName(name);
  const area = (areaName ?? "").trim();
  return area ? `${base} · ${area}` : base;
}
