import type { ScoreTimelineEntry } from "@workspace/api-client-react";
// Import relativo (não "@/"): este arquivo também roda no `node --test`.
import { fmtNum } from "../../lib/utils";

/**
 * Textos e agrupamento da Linha do tempo. A API devolve entradas de três
 * tipos: "recorded" (registro exato de um recálculo, por pessoa),
 * "reconstructed" (passado remontado, por pessoa) e "info" (calibração e
 * publicação da auditoria, por evento). A tela agrupa por DIA e, dentro do
 * dia, por ACONTECIMENTO (a causa), com as pessoas afetadas dentro.
 */

export type Category = "event" | "penalty" | "merit" | "calibration" | "publish" | "confirm" | "exclusion" | "other";

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
  if (t === "confirm-results" || t === "unconfirm-results" || t === "confirm-results-bulk") return "confirm";
  if (t === "penalty" || t === "penalty_removed") return "penalty";
  if (t === "merit" || t === "merit_removed") return "merit";
  if (t === "cycle_excluded" || t === "cycle_included") return "exclusion";
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

/**
 * Como a nota da pessoa mudou nesta entrada:
 * - "up" / "down" / "same": havia nota antes e depois (comparável);
 * - "entered": sem nota antes e com nota depois — ENTROU NA NOTA (primeiro
 *   evento com nota, volta ao ciclo). Não é uma "alta": não há com o que
 *   comparar. Por isso o filtro "Subiu" NÃO inclui quem entrou na nota, e os
 *   indicadores mostram "Entraram na nota" separado;
 * - "left": com nota antes e sem nota depois — SAIU DO CICLO (tirado pelo
 *   admin). Do mesmo jeito, não conta como "queda" nem no filtro "Caiu";
 * - null: entrada sem pessoa (calibração/publicação da auditoria) ou sem nota
 *   antes nem depois (mudou só bônus, elegibilidade ou nº de eventos).
 */
export type Move = "up" | "down" | "same" | "entered" | "left";
export function moveOf(e: ScoreTimelineEntry): Move | null {
  if (e.kind === "info") return null;
  const b = e.finalBefore, a = e.finalAfter;
  if (b == null && a == null) return null;
  if (b == null) return "entered";
  if (a == null) return "left";
  const d = deltaOf(e) ?? 0;
  return d > 0 ? "up" : d < 0 ? "down" : "same";
}

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
  "confirm-results-bulk": "Resultados confirmados em lote",
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
  recompute: "Nota recalculada",
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

/** Um acontecimento: a causa + quem teve a nota afetada por ela. */
export interface Happening {
  id: string;
  at: string;
  kind: ScoreTimelineEntry["kind"];
  type: string;
  category: Category;
  /** Mesma ação que causou as mudanças (null: API antiga, agrupado pela janela). */
  causeId: string | null;
  title: string;
  detail: string | null;
  by: string | null;
  eventId: number | null;
  /** Calibração salva pela regra "só vale publicada" (não muda a nota até publicar). */
  pendingPublish: boolean;
  people: ScoreTimelineEntry[];
  /** Quantas pessoas o acontecimento tem sem filtro (o filtro pode esconder parte). */
  totalPeople: number;
}

/** Lançamentos e saída/volta do ciclo são SEMPRE de uma pessoa só. */
const INDIVIDUAL_TYPES = new Set(["penalty", "merit", "penalty_removed", "merit_removed", "cycle_excluded", "cycle_included"]);
/** Janela para juntar entradas da mesma causa (recálculo em lote, publicação). */
const WINDOW_MS = 120_000;

/**
 * Agrupa as entradas em acontecimentos (uma passada, com Map — nada de
 * `find` em laço).
 *
 * - Com `causeId` (API nova): mesma causa = mesmo acontecimento ("Nota parcial
 *   publicada · Comunicação · SRUN" com as pessoas que mudaram). A mesma ação
 *   repetida mais tarde (ex.: publicar de novo o mesmo critério) abre outro
 *   cartão: a junção exige até 2 min desde a última entrada do grupo.
 * - Sem `causeId` (API antiga): penalidade, mérito, exclusões de lançamento e
 *   saída/volta do ciclo são SEMPRE individuais; o resto (publicação,
 *   confirmação, evento que entrou na nota) junta por tipo + evento em 2 min.
 * - Em qualquer caso, uma pessoa nunca aparece duas vezes no mesmo cartão: se
 *   já está nele, a entrada abre um cartão novo.
 *
 * A entrada "info" da auditoria (calibração, publicação) empresta quem fez e o
 * critério ao registro do recálculo que ela causou; sem par, vira um cartão
 * próprio, sem pessoas.
 */
export function toHappenings(entries: ScoreTimelineEntry[]): Happening[] {
  const sorted = [...entries].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const t = (iso: string) => new Date(iso).getTime();

  // Índice das entradas "info" por tipo + evento, para achar o par em O(1).
  const infoIndex = new Map<string, ScoreTimelineEntry[]>();
  for (const e of sorted) {
    if (e.kind !== "info") continue;
    const k = `${e.type}|${e.eventId ?? ""}`;
    const list = infoIndex.get(k);
    if (list) list.push(e); else infoIndex.set(k, [e]);
  }
  const usedInfo = new Set<string>();
  const findTwin = (e: ScoreTimelineEntry) => {
    const list = infoIndex.get(`${e.type}|${e.eventId ?? ""}`);
    if (!list) return undefined;
    const at = t(e.at);
    return list.find(i => !usedInfo.has(i.id) && Math.abs(t(i.at) - at) < WINDOW_MS
      && (!e.criterionName || !i.criterionName || e.criterionName === i.criterionName));
  };

  const groups: Happening[] = [];
  // Grupo aberto por chave: o último cartão daquela causa + o que precisa para decidir a junção.
  const open = new Map<string, { h: Happening; last: number; who: Set<number> }>();
  for (const e of sorted) {
    if (e.kind === "info") continue;
    const at = t(e.at);
    const individual = INDIVIDUAL_TYPES.has(e.type);
    const key = individual ? null
      : e.causeId ? `c|${e.kind}|${e.type}|${e.causeId}`
      : `w|${e.kind}|${e.type}|${e.eventId ?? ""}`;
    if (key) {
      const g = open.get(key);
      if (g && at - g.last < WINDOW_MS && (e.employeeId == null || !g.who.has(e.employeeId))) {
        g.h.people.push(e);
        g.last = at;
        if (e.employeeId != null) g.who.add(e.employeeId);
        if (!g.h.by && e.by) g.h.by = e.by;
        continue;
      }
    }
    const twin = findTwin(e);
    if (twin) usedInfo.add(twin.id);
    const base = twin ? { ...e, criterionName: e.criterionName ?? twin.criterionName } : e;
    const s = sentenceOf(base);
    const h: Happening = {
      id: `h-${e.id}`, at: e.at, kind: e.kind, type: e.type, category: categoryOf(e), causeId: e.causeId ?? null,
      title: s.title, detail: s.detail, by: e.by ?? twin?.by ?? null, eventId: e.eventId ?? null,
      pendingPublish: false, people: [e], totalPeople: 0,
    };
    groups.push(h);
    if (key) open.set(key, { h, last: at, who: new Set(e.employeeId != null ? [e.employeeId] : []) });
  }
  for (const list of infoIndex.values()) for (const i of list) {
    if (usedInfo.has(i.id)) continue;
    const s = sentenceOf(i);
    groups.push({
      id: `h-${i.id}`, at: i.at, kind: "info", type: i.type, category: categoryOf(i), causeId: i.causeId ?? null,
      title: s.title, detail: s.detail, by: i.by ?? null, eventId: i.eventId ?? null,
      // Só a calibração salva pela regra nova fica "a publicar"; ausente/false
      // (API antiga ou calibração antiga, que valeu na hora) não avisa nada.
      pendingPublish: i.pendingPublish === true,
      people: [], totalPeople: 0,
    });
  }
  for (const g of groups) {
    g.people.sort((a, b) => Math.abs(deltaOf(b) ?? 0) - Math.abs(deltaOf(a) ?? 0) || (a.employeeName ?? "").localeCompare(b.employeeName ?? "", "pt-BR"));
    g.totalPeople = g.people.length;
  }
  return groups.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

// ── Filtros (aplicados DEPOIS de agrupar) ──────────────────────────────────
// Agrupar antes garante que o título do cartão mantém o critério e quem fez
// (a entrada "info" que os traz não some por causa de um filtro) e que buscar
// "Comunicação" acha a publicação COM as pessoas.

export type Direction = "todas" | "alta" | "queda";
export interface HappeningFilter {
  cats?: Category[];
  event?: number | null;
  by?: string;
  from?: string;
  to?: string;
  dir?: Direction;
  faixa?: boolean;
  q?: string;
}

/** Minúsculas e sem acento: "comunicacao" acha "Comunicação". */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterHappenings(hs: Happening[], f: HappeningFilter): Happening[] {
  const text = fold((f.q ?? "").trim());
  const dir = f.dir ?? "todas";
  const out: Happening[] = [];
  for (const h of hs) {
    if (f.cats && !f.cats.includes(h.category)) continue;
    if (f.event && h.eventId !== f.event) continue;
    if (f.by && h.by !== f.by) continue;
    if (f.from || f.to) {
      const d = dayKey(h.at);
      if (f.from && d < f.from) continue;
      if (f.to && d > f.to) continue;
    }
    let people = h.people;
    // Filtros de pessoa: "Subiu"/"Caiu" só comparam nota com nota (quem entrou
    // na nota ou saiu do ciclo fica de fora — ver moveOf).
    if (dir !== "todas") people = people.filter(p => moveOf(p) === (dir === "alta" ? "up" : "down"));
    if (f.faixa) people = people.filter(faixaChanged);
    if ((dir !== "todas" || f.faixa) && people.length === 0) continue;
    if (text) {
      const hay = fold([h.title, h.detail, h.by].filter(Boolean).join(" "));
      if (!hay.includes(text)) {
        // A busca não está no acontecimento: fica quem bate pelo nome, motivo ou rótulo.
        people = people.filter(p => fold([p.employeeName, p.reason, p.label, p.criterionName].filter(Boolean).join(" ")).includes(text));
        if (people.length === 0) continue;
      }
    }
    out.push(people === h.people ? h : { ...h, people });
  }
  return out;
}

// ── Contagens ───────────────────────────────────────────────────────────────

export interface Tally {
  /** Linhas de pessoa (cada mudança de uma pessoa num acontecimento). */
  changes: number;
  /** Pessoas distintas com alguma mudança (nota, faixa, bônus, elegibilidade). */
  people: number;
  ups: number; downs: number; entered: number; left: number; faixas: number;
}
export function tally(rows: ScoreTimelineEntry[]): Tally {
  const t: Tally = { changes: rows.length, people: 0, ups: 0, downs: 0, entered: 0, left: 0, faixas: 0 };
  const who = new Set<number | null | undefined>();
  for (const r of rows) {
    who.add(r.employeeId);
    const m = moveOf(r);
    if (m === "up") t.ups++;
    else if (m === "down") t.downs++;
    else if (m === "entered") t.entered++;
    else if (m === "left") t.left++;
    if (faixaChanged(r)) t.faixas++;
  }
  t.people = who.size;
  return t;
}

export interface DayGroup extends Tally {
  key: string;
  happenings: Happening[];
}

/** Agrupa por dia no fuso de Brasília (02:30Z ainda é o dia anterior). */
export function groupByDay(happenings: Happening[]): DayGroup[] {
  const map = new Map<string, Happening[]>();
  for (const h of happenings) {
    const k = dayKey(h.at);
    const list = map.get(k);
    if (list) list.push(h); else map.set(k, [h]);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, hs]) => ({
    key, happenings: hs, ...tally(hs.flatMap(h => h.people)),
  }));
}
