// ── Filtros na URL ──────────────────────────────────────────────────────────
// Chip de status, busca, período e ordenação vivem em ?status=&q=&from=&to=&sort=
// para que "voltar" do detalhe devolva a lista exatamente como estava.
export const CARD_FILTER_KEYS = ["pendingRH", "unconfirmed", "inEval", "pendingCal", "partialPub", "fullyEval"] as const;
export const SORT_KEYS = [
  "nameAsc", "nameDesc", "dateDesc", "dateAsc", "participantsDesc", "participantsAsc",
  "evaluatedDesc", "evaluatedAsc", "calibrDesc", "calibrAsc", "scoreDesc", "scoreAsc",
] as const;
export const DEFAULT_SORT = "dateDesc";
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function readUrlFilters() {
  const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const status = p.get("status");
  const sort = p.get("sort");
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  return {
    search: p.get("q") ?? "",
    cardFilter: status && (CARD_FILTER_KEYS as readonly string[]).includes(status) ? status : null,
    sortBy: sort && (SORT_KEYS as readonly string[]).includes(sort) ? sort : DEFAULT_SORT,
    filterDateFrom: DATE_RE.test(from) ? from : "",
    filterDateTo: DATE_RE.test(to) ? to : "",
  };
}

// ── Ordenação por coluna ────────────────────────────────────────────────────
// Cada coluna tem um sentido "primário" (1º clique) e o par inverso (2º clique).
const colSortPairs: Record<string, string> = {
  nameAsc: "nameDesc", nameDesc: "nameAsc",
  dateDesc: "dateAsc", dateAsc: "dateDesc",
  participantsDesc: "participantsAsc", participantsAsc: "participantsDesc",
  evaluatedDesc: "evaluatedAsc", evaluatedAsc: "evaluatedDesc",
  calibrDesc: "calibrAsc", calibrAsc: "calibrDesc",
  scoreDesc: "scoreAsc", scoreAsc: "scoreDesc",
};
const colPrimary: Record<string, string> = {
  name: "nameAsc", date: "dateDesc", participants: "participantsDesc",
  evaluated: "evaluatedDesc", calibr: "calibrDesc", score: "scoreDesc",
};

/** Próxima ordenação ao clicar no cabeçalho `col` estando em `sortBy`. */
export function nextColSort(sortBy: string, col: string): string {
  const primary = colPrimary[col];
  if (sortBy === primary || sortBy === colSortPairs[primary]) {
    return colSortPairs[sortBy] ?? primary;
  }
  return primary;
}

export function isColActive(sortBy: string, col: string): boolean {
  const primary = colPrimary[col];
  return sortBy === primary || sortBy === colSortPairs[primary];
}

export function isColAsc(sortBy: string, col: string): boolean {
  const primary = colPrimary[col];
  return sortBy === colSortPairs[primary];
}
