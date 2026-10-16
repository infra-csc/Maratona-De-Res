// Filtros da Linha do tempo, espelhados na URL — atalhos de outras telas
// chegam já filtrados:
// /linha-do-tempo?colaborador=12&evento=40&tipo=calibracao&de=2026-09-01&ate=2026-09-30&direcao=queda&quem=Renata&faixa=1&q=…
import { daysAgoKey, todayKey, type Category, type Direction } from "./describe";

export type TypeFilter = "todos" | "eventos" | "lancamentos" | "calibracao" | "outros";
export const TYPES: { value: TypeFilter; label: string; cats?: Category[] }[] = [
  { value: "todos", label: "Tudo" },
  { value: "eventos", label: "Eventos", cats: ["event", "confirm"] },
  { value: "lancamentos", label: "Faltas e méritos", cats: ["penalty", "merit"] },
  { value: "calibracao", label: "Calibração e publicação", cats: ["calibration", "publish"] },
  { value: "outros", label: "Saída do ciclo e outros", cats: ["exclusion", "other"] },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export interface Filters { employee: number | null; event: number | null; type: TypeFilter; dir: Direction; by: string; from: string; to: string; faixa: boolean; q: string }
export const EMPTY: Omit<Filters, "employee"> = { event: null, type: "todos", dir: "todas", by: "", from: "", to: "", faixa: false, q: "" };

export function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const int = (k: string) => { const n = Number(p.get(k)); return Number.isInteger(n) && n > 0 ? n : null; };
  const type = p.get("tipo") as TypeFilter | null;
  const dir = p.get("direcao") as Direction | null;
  return {
    employee: int("colaborador"), event: int("evento"),
    type: TYPES.some(t => t.value === type) ? (type as TypeFilter) : "todos",
    dir: dir === "alta" || dir === "queda" ? dir : "todas",
    by: p.get("quem") ?? "",
    from: DATE_RE.test(p.get("de") ?? "") ? p.get("de")! : "",
    to: DATE_RE.test(p.get("ate") ?? "") ? p.get("ate")! : "",
    faixa: p.get("faixa") === "1",
    q: p.get("q") ?? "",
  };
}

export function writeFilters(f: Filters) {
  const url = new URL(window.location.href);
  const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
  set("colaborador", f.employee ? String(f.employee) : ""); set("evento", f.event ? String(f.event) : "");
  set("tipo", f.type === "todos" ? "" : f.type); set("direcao", f.dir === "todas" ? "" : f.dir);
  set("quem", f.by); set("de", f.from); set("ate", f.to); set("faixa", f.faixa ? "1" : ""); set("q", f.q);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export type PresetKey = "tudo" | "hoje" | "7" | "30" | "custom";
export const PRESETS: { key: Exclude<PresetKey, "tudo" | "custom">; label: string; from: () => string; to: () => string }[] = [
  { key: "hoje", label: "Hoje", from: todayKey, to: todayKey },
  { key: "7", label: "7 dias", from: () => daysAgoKey(6), to: todayKey },
  { key: "30", label: "30 dias", from: () => daysAgoKey(29), to: todayKey },
];

export function presetOf(f: Pick<Filters, "from" | "to">): PresetKey {
  return PRESETS.find(p => f.from === p.from() && f.to === p.to())?.key ?? (f.from || f.to ? "custom" : "tudo");
}

/** Filtros "secundários" (os que ficam no painel recolhível do celular). */
export function advancedCount(f: Filters): number {
  return [f.type !== "todos", f.dir !== "todas", !!f.by, !!(f.from || f.to), f.faixa].filter(Boolean).length;
}
