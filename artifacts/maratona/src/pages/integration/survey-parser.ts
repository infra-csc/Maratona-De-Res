import * as XLSX from "xlsx";

// -----------------------------------------------------------------------------
// Leitura da planilha da pesquisa de avaliadores (export do MS Forms).
// Em vez de exigir um layout fixo de colunas, localizamos a aba de respostas
// (aquela cujo cabeçalho tem "Evento que está avaliando...") e mapeamos cada
// coluna pelo TEXTO do cabeçalho, remontando as linhas no layout canônico de
// 29 colunas que a API espera. Isso permite subir o arquivo bruto exportado
// do Forms, mesmo com colunas extras (Hora de início/conclusão/Email) ou em
// ordem diferente.
// -----------------------------------------------------------------------------

/** Linha no layout canônico que a API de importação da pesquisa espera. */
export type SurveyRow = (string | number | null)[];

const SURVEY_CANONICAL_COLS = 29;

function normalizeHeaderText(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ") // inclui espaços não-quebráveis (U+00A0) que o Forms usa
    .toLowerCase()
    .trim();
}

// target = índice no layout canônico (SURVEY_COL do servidor);
// hasComment = a coluna imediatamente à direita é o "Comentários ou Justificativa" dela.
const SURVEY_HEADER_MAP: { target: number; hasComment?: boolean; match: (h: string) => boolean }[] = [
  { target: 2, match: (h) => h.startsWith("seu nome") },
  { target: 3, match: (h) => h.startsWith("evento que esta avaliando") },
  { target: 4, match: (h) => h.startsWith("selecione a area") },
  { target: 5, hasComment: true, match: (h) => h.startsWith("perda de material") },
  { target: 7, hasComment: true, match: (h) => h.startsWith("logistica reversa") },
  { target: 9, hasComment: true, match: (h) => h.startsWith("qualidade da entrega") && !h.includes("(2)") },
  { target: 11, hasComment: true, match: (h) => h.startsWith("qualidade da entrega") && h.includes("(2)") },
  { target: 13, hasComment: true, match: (h) => h.startsWith("prazo de entrega") },
  { target: 15, hasComment: true, match: (h) => h.startsWith("todos os equipamentos") },
  { target: 17, hasComment: true, match: (h) => h.startsWith("carga na saida do galpao") },
  { target: 19, hasComment: true, match: (h) => h.startsWith("todos usaram epi") },
  { target: 21, hasComment: true, match: (h) => h.startsWith("estaiamento") },
  { target: 23, hasComment: true, match: (h) => h.startsWith("conduta e comportamento") },
  { target: 25, match: (h) => h.startsWith("alguem faltou") },
  { target: 26, match: (h) => h.startsWith("algum profissional") },
  { target: 27, match: (h) => h.startsWith("conte quem se destacou") },
  { target: 28, match: (h) => h.startsWith("classifique o nivel") },
];

export function extractSurveyRows(workbook: XLSX.WorkBook): SurveyRow[] | null {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const allRows = XLSX.utils.sheet_to_json<SurveyRow>(sheet, { header: 1, raw: false, defval: "" });
    for (let headerIdx = 0; headerIdx < Math.min(3, allRows.length); headerIdx++) {
      const headers = (allRows[headerIdx] ?? []).map(normalizeHeaderText);
      if (!headers.some((h) => h.startsWith("evento que esta avaliando"))) continue;
      const used = new Set<number>();
      const sourceByTarget: { target: number; src: number; hasComment: boolean }[] = [];
      let complete = true;
      for (const spec of SURVEY_HEADER_MAP) {
        const src = headers.findIndex((h, i) => !used.has(i) && h !== "" && spec.match(h));
        if (src === -1) { complete = false; break; }
        used.add(src);
        sourceByTarget.push({ target: spec.target, src, hasComment: !!spec.hasComment });
      }
      if (!complete) continue;
      return allRows
        .slice(headerIdx + 1)
        .filter((r) => Array.isArray(r) && r.some((cell) => String(cell ?? "").trim() !== ""))
        .map((r) => {
          const out: SurveyRow = new Array(SURVEY_CANONICAL_COLS).fill("");
          for (const { target, src, hasComment } of sourceByTarget) {
            out[target] = r[src] ?? "";
            if (hasComment) out[target + 1] = r[src + 1] ?? "";
          }
          return out;
        });
    }
  }
  return null;
}
