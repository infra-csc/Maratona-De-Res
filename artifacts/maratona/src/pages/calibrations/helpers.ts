// Helpers puros da página de Calibrações (sem hooks, sem estado).
import type { ApiEvent, EventStatusFilter } from "./types";

// Selo do evento (seletor e cabeçalho): prioridade publicado final > publicado
// parcial > calibrado > fechado > em avaliação > aguardando. Eventos históricos
// e fechados sem calibração mostram "Fechado"; demais mostram o estado real.
export type EventChipTone = "ok" | "warn" | "info" | "neutral";
export function calibrationEventChip(ev: {
  isHistorical?: boolean;
  feedbackReleased?: boolean;
  partialPublishedAt?: string | null;
  finalCalibratedCriteria?: number | null;
  totalCriteria?: number | null;
  calibratedCriteriaCount?: number | null;
  status?: string;
  evaluatedCriteria?: number | null;
}): { label: string; tone: EventChipTone } {
  const finalCount = ev.finalCalibratedCriteria ?? 0;
  const total = ev.totalCriteria ?? 0;
  const allFinalPub = finalCount > 0 && total > 0 && finalCount >= total;
  if (ev.feedbackReleased || allFinalPub) return { label: "Publicado final", tone: "ok" };
  if (ev.partialPublishedAt || finalCount > 0) return { label: "Publicado parcial", tone: "warn" };
  if ((ev.calibratedCriteriaCount ?? 0) > 0) return { label: "Calibrado", tone: "info" };
  if (ev.status === "closed" || ev.isHistorical) return { label: "Fechado", tone: "neutral" };
  if ((ev.evaluatedCriteria ?? 0) > 0) return { label: "Em avaliação", tone: "info" };
  return { label: "Aguardando", tone: "neutral" };
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Erros dos hooks gerados (ApiError) e do calibration-api.ts (ApiRequestError)
// carregam `status`; os laços em lote usam isso para parar no primeiro 401/403.
export function errorStatus(e: unknown): number | undefined {
  if (e && typeof e === "object" && "status" in e) {
    const s = (e as { status?: unknown }).status;
    if (typeof s === "number") return s;
  }
  return undefined;
}
export function errorMessage(e: unknown): string | undefined {
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return undefined;
}
export function isAuthError(e: unknown): boolean {
  const s = errorStatus(e);
  return s === 401 || s === 403;
}
export const SESSION_EXPIRED_TOAST = {
  title: "Sessão expirada",
  description: "Sua sessão expirou ou foi trocada em outra aba. Entre novamente.",
  variant: "destructive" as const,
};
export const SAVED_REASON_FEEDBACK_MS = 2000;

// Filtro da lista de eventos do seletor (status, fim de semana e texto).
export function filterCalibratableEvents(
  calibratableEvents: ApiEvent[],
  eventStatusFilter: EventStatusFilter,
  filterDateFrom: string,
  filterDateTo: string,
  eventSearchText: string,
): ApiEvent[] {
  return calibratableEvents.filter(e => {
    const evalCount = e.evaluatedCriteria ?? 0;
    const calCount  = e.calibratedCriteriaCount ?? 0;
    const total     = e.totalCriteria ?? 0;
    const hasPub    = !!e.partialPublishedAt || !!e.feedbackReleased || (e.finalCalibratedCriteria ?? 0) > 0;
    const matchStatus = eventStatusFilter === "all"
      || (eventStatusFilter === "pending"     && evalCount === 0 && calCount === 0)
      || (eventStatusFilter === "inProgress"  && !!e.criteriaConfirmed && (evalCount > 0 || calCount > 0))
      || (eventStatusFilter === "done"        && (e.status === "closed" || (total > 0 && evalCount >= total) || hasPub));
    const matchDate = (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom) && (!filterDateTo || (e.startDate ?? "") <= filterDateTo);
    const q = eventSearchText.trim().toLowerCase();
    const matchText = !q || [e.name, e.clientName, e.city, e.state].some(v => v?.toLowerCase().includes(q));
    return matchStatus && matchDate && matchText;
  });
}

/**
 * Nota calibrada (0–10) no MESMO formato em todo lugar — campo, "→ nota" e
 * histórico: vírgula e só as casas que existem ("8,5", "9", "8,25"). Antes o
 * histórico mostrava "→ 8,50" e o campo "8,5".
 */
export function fmtCalScore(v: number | string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(v);
}
