// Helpers puros da página de Calibrações (sem hooks, sem estado).
import type React from "react";
import { GOOD_TEXT, AMBER_TEXT, INFO_TEXT } from "@/lib/premium-theme";
import type { ApiEvent, EventStatusFilter, PickerPalette } from "./types";

// Badge do seletor de eventos: prioridade pub. final > pub. parcial > calibrado > fechado > em avaliação > aguardando.
// Eventos históricos e fechados sem calibração mostram "Fechado"; demais mostram o estado real.
export function calibrationEventChip(ev: {
  isHistorical?: boolean;
  feedbackReleased?: boolean;
  partialPublishedAt?: string | null;
  finalCalibratedCriteria?: number | null;
  totalCriteria?: number | null;
  calibratedCriteriaCount?: number | null;
  status?: string;
  evaluatedCriteria?: number | null;
}): { label: string; bg: string; fg: string } {
  const finalCount = ev.finalCalibratedCriteria ?? 0;
  const total = ev.totalCriteria ?? 0;
  const allFinalPub = finalCount > 0 && total > 0 && finalCount >= total;
  if (ev.feedbackReleased || allFinalPub)
    return { label: "Pub. Final", bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT };
  if (ev.partialPublishedAt || finalCount > 0)
    return { label: "Pub. Parcial", bg: "rgba(232,162,61,0.14)", fg: AMBER_TEXT };
  if ((ev.calibratedCriteriaCount ?? 0) > 0)
    return { label: "Calibrado", bg: "rgba(91,141,239,0.14)", fg: INFO_TEXT };
  if (ev.status === "closed" || ev.isHistorical)
    return { label: "Fechado", bg: "var(--secondary)", fg: "var(--muted-foreground)" };
  if ((ev.evaluatedCriteria ?? 0) > 0)
    return { label: "Em Avaliação", bg: "rgba(154,176,0,0.14)", fg: GOOD_TEXT };
  return { label: "Aguardando", bg: "var(--secondary)", fg: "var(--muted-foreground)" };
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

export const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

// Paleta do seletor de eventos, conforme o tema.
export function getPickerPalette(isDark: boolean): PickerPalette {
  return isDark
    ? {
        bg: "#0f0f0f",
        card: "#161616",
        border: "rgba(255,255,255,0.12)",
        text: "#f0ede8",
        muted: "rgba(255,255,255,0.35)",
        activeBg: "#ccff00",
        activeFg: "#0f0f0f",
        itemSel: "#1a1a1a",
        itemBorder: "rgba(255,255,255,0.07)",
        shadow: "6px 6px 0 #ccff00",
        chipBorder: "rgba(255,255,255,0.20)",
        chipText: "rgba(255,255,255,0.45)",
        searchBorder: "rgba(255,255,255,0.10)",
      }
    : {
        bg: "#ffffff",
        card: "#f5f4ef",
        border: "rgba(0,0,0,0.14)",
        text: "#111111",
        muted: "rgba(0,0,0,0.40)",
        activeBg: "#111111",
        activeFg: "#ffffff",
        itemSel: "#f0efe9",
        itemBorder: "rgba(0,0,0,0.07)",
        shadow: "6px 6px 0 rgba(0,0,0,0.15)",
        chipBorder: "rgba(0,0,0,0.20)",
        chipText: "rgba(0,0,0,0.50)",
        searchBorder: "rgba(0,0,0,0.10)",
      };
}

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
