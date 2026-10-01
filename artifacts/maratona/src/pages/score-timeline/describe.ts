import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { fmtNum } from "@/lib/utils";

/**
 * Textos e agrupamento da Linha do tempo. A API devolve entradas de três
 * tipos: "recorded" (registro exato de um recálculo, por pessoa),
 * "reconstructed" (passado remontado, por pessoa) e "info" (calibração e
 * publicação da auditoria, por evento). A tela agrupa por DIA e, dentro do
 * dia, por ACONTECIMENTO (o motivo), com as pessoas afetadas dentro.
 */

export type Category = "event" | "penalty" | "merit" | "calibration" | "publish" | "confirm" | "other";

const TZ = "America/Sao_Paulo";
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });

export const dayKey = (iso: string) => dayKeyFmt.format(new Date(iso));
export const todayKey = () => dayKey(new Date().toISOString());
export const timeOf = (iso: string) => timeFmt.format(new Date(iso));
export const shortDate = (iso: string) => shortFmt.format(new Date(iso));
export const shortDay = (key: string) => shortFmt.format(new Date(`${key}T12:00:00-03:00`));
export function dayTitle(key: string): string {
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === todayKey()) return "Hoje";
  if (key === yesterday) return "Ontem";
  const s = dayFmt.format(new Date(`${key}T12:00:00-03:00`));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function daysAgoKey(n: number): string { return dayKey(new Date(Date.now() - n * 86_400_000).toISOString()); }

export const score = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
export const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const signed = (d: number) => `${d > 0 ? "+" : "−"}${fmtNum(Math.abs(d), 1)}`;

export function categoryOf(e: Pick<ScoreTimelineEntry, "type">): Category {
  const t = e.type;
  if (t === "event_counted") return "event";
  if (t === "confirm-results" || t === "unconfirm-results") return "confirm";
  if (t === "penalty" || t === "penalty_removed") return "penalty";
  if (t === "merit" || t === "merit_removed") return "merit";
  if (t === "calibrate" || t === "recalibrate_released") return "calibration";
  if (t.startsWith("publish_") || t === "release_feedback") return "publish";
  return "other";
}

export function deltaOf(e: ScoreTimelineEntry): number | null {
  if (e.finalBefore == null || e.finalAfter == null) return null;
  return Math.round((e.finalAfter - e.finalBefore) * 10) / 10;
}
export const faixaChanged = (e: ScoreTimelineEntry) =>
  e.kind !== "info" && e.platoonAfter != null && (e.platoonBefore ?? null) !== (e.platoonAfter ?? null);

const PUBLISH_LABEL: Record<string, string> = {
  publish_partial_feedback: "Nota parcial publicada",
  publish_final_feedback: "Nota final publicada",
  publish_partial_all_feedback: "Todas as notas parciais publicadas",
  publish_final_all_feedback: "Todas as notas finais publicadas",
  release_feedback: "Feedback liberado",
};
const CAUSE_LABEL: Record<string, string> = {
  ...PUBLISH_LABEL,
  "confirm-results": "Resultados do evento confirmados",
  "unconfirm-results": "Confirmação dos resultados desfeita",
  calibrate: "Calibração salva",
  recalibrate_released: "Recalibração de nota já liberada",
  update: "Cadastro alterado",
  set_cycle_eligibility: "Elegibilidade ao bônus alterada",
  close: "Evento encerrado",
  reopen: "Evento reaberto",
  update_conformity: "Matriz de conformidade alterada",
  create_conformity: "Matriz de conformidade preenchida",
  submit: "Avaliação enviada",
  recompute: "Recálculo do ciclo",
  import_survey: "Pesquisa de avaliação importada",
  sync_integration: "Sincronização com o sistema de eventos",
  update_weights_after_evaluations: "Pesos dos critérios alterados",
  merge: "Cadastros duplicados mesclados",
  delete: "Registro excluído",
  create: "Registro criado",
};

/** Título do acontecimento e complemento (critério · evento · motivo). */
export function sentenceOf(e: ScoreTimelineEntry): { title: string; detail: string | null } {
  const join = (...xs: (string | null | undefined)[]) => xs.filter(Boolean).join(" · ") || null;
  switch (e.type) {
    case "event_counted":
      return { title: "Evento entrou na nota", detail: join(e.eventName) };
    case "penalty":
      return { title: `Penalidade · ${e.label ?? "lançamento"}`, detail: join(e.points != null ? `−${fmtNum(e.points, 0)} pts` : null, e.eventName, e.reason) };
    case "merit":
      return { title: `Mérito · ${e.label ?? "lançamento"}`, detail: join(e.points != null ? `+${fmtNum(e.points, 0)} pts` : null, e.eventName, e.reason) };
    case "penalty_removed":
    case "merit_removed":
      return { title: `${e.type === "merit_removed" ? "Mérito" : "Penalidade"} excluído · ${e.label ?? "lançamento"}`, detail: join(e.eventName, e.reason) };
    case "cycle_excluded":
      return { title: "Retirado do ciclo", detail: join("sem nota, ranking e bônus neste ciclo", e.reason ? `“${e.reason}”` : null) };
    case "cycle_included":
      return { title: "Devolvido ao ciclo", detail: join(e.reason ? `“${e.reason}”` : null) };
    case "calibrate":
    case "recalibrate_released":
      return {
        title: CAUSE_LABEL[e.type],
        detail: join(e.criterionName, e.eventName, e.scoreBefore != null && e.scoreAfter != null ? `${score(e.scoreBefore)} → ${score(e.scoreAfter)}` : e.scoreAfter != null ? `nota ${score(e.scoreAfter)}` : null, e.reason ? `“${e.reason}”` : null),
      };
    default:
      return { title: CAUSE_LABEL[e.type] ?? (e.kind === "recorded" ? "Nota recalculada" : e.type), detail: join(e.criterionName, e.eventName) };
  }
}

/** Um acontecimento: o motivo + quem teve a nota afetada por ele. */
export interface Happening {
  id: string;
  at: string;
  kind: ScoreTimelineEntry["kind"];
  type: string;
  category: Category;
  title: string;
  detail: string | null;
  by: string | null;
  eventId: number | null;
  /** Calibração salva (não muda a nota até publicar). */
  pendingPublish: boolean;
  people: ScoreTimelineEntry[];
}

/**
 * Agrupa as entradas em acontecimentos. Mesma causa no mesmo instante (até
 * 2 min) = um acontecimento só: "Nota parcial publicada · Qualidade · SRUN"
 * com as pessoas que mudaram. A entrada "info" da auditoria empresta o
 * critério e quem fez ao registro do recálculo que ela causou.
 */
export function toHappenings(entries: ScoreTimelineEntry[]): Happening[] {
  const groups: Happening[] = [];
  const info = entries.filter(e => e.kind === "info");
  const usedInfo = new Set<string>();
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  for (const e of sorted) {
    if (e.kind === "info") continue;
    const t = new Date(e.at).getTime();
    const individual = e.kind === "reconstructed" && (categoryOf(e) === "penalty" || categoryOf(e) === "merit");
    const existing = individual ? undefined : groups.find(h =>
      h.kind === e.kind && h.type === e.type && h.eventId === (e.eventId ?? null) && Math.abs(new Date(h.at).getTime() - t) < 120_000);
    if (existing) { existing.people.push(e); continue; }
    const twin = info.find(i => !usedInfo.has(i.id) && i.type === e.type && (i.eventId ?? null) === (e.eventId ?? null)
      && Math.abs(new Date(i.at).getTime() - t) < 120_000);
    if (twin) usedInfo.add(twin.id);
    const base = twin ? { ...e, criterionName: e.criterionName ?? twin.criterionName } : e;
    const s = sentenceOf(base);
    groups.push({
      id: `h-${e.id}`, at: e.at, kind: e.kind, type: e.type, category: categoryOf(e),
      title: s.title, detail: s.detail, by: e.by ?? twin?.by ?? null, eventId: e.eventId ?? null,
      pendingPublish: false, people: [e],
    });
  }
  for (const i of info) {
    if (usedInfo.has(i.id)) continue;
    const s = sentenceOf(i);
    groups.push({
      id: `h-${i.id}`, at: i.at, kind: "info", type: i.type, category: categoryOf(i), title: s.title, detail: s.detail,
      by: i.by ?? null, eventId: i.eventId ?? null, pendingPublish: categoryOf(i) === "calibration", people: [],
    });
  }
  for (const g of groups) g.people.sort((a, b) => Math.abs(deltaOf(b) ?? 0) - Math.abs(deltaOf(a) ?? 0) || (a.employeeName ?? "").localeCompare(b.employeeName ?? "", "pt-BR"));
  return groups.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

export interface DayGroup {
  key: string;
  happenings: Happening[];
  /** Pessoas distintas com a nota alterada no dia, altas, quedas e mudanças de faixa. */
  people: number; ups: number; downs: number; faixas: number;
}

export function groupByDay(happenings: Happening[]): DayGroup[] {
  const map = new Map<string, Happening[]>();
  for (const h of happenings) map.set(dayKey(h.at), [...(map.get(dayKey(h.at)) ?? []), h]);
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, hs]) => {
    const rows = hs.flatMap(h => h.people);
    return {
      key, happenings: hs,
      people: new Set(rows.map(r => r.employeeId)).size,
      ups: rows.filter(r => (deltaOf(r) ?? 0) > 0).length,
      downs: rows.filter(r => (deltaOf(r) ?? 0) < 0).length,
      faixas: rows.filter(faixaChanged).length,
    };
  });
}
