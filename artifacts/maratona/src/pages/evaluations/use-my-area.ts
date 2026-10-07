import { keepPreviousData, useQuery, type QueryClient } from "@tanstack/react-query";
import {
  getMyAreaEvaluations, getGetMyAreaEvaluationsQueryKey,
  type GetMyAreaEvaluationsParams, type MyAreaEvaluations, type MyAreaEvent,
} from "@workspace/api-client-react";
import { withServerMessage } from "@/lib/calibration-api";

// Tela do avaliador: UMA chamada (GET /evaluations/my-area) traz os eventos da
// área do cadastro + os designados, já com o estado de cada critério (aberto,
// respondido por mim, fechado pela área). Substitui as 4 consultas por evento
// do antigo use-evaluator-overview.

export type StatusFilter = "pending" | "done" | "all";
export type PeriodFilter = "cycle" | "30" | "90" | "year";

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  cycle: "Ciclo atual",
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  year: "Este ano",
};

function isoLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Período → `from` (o servidor usa só o ciclo atual quando não há datas). */
export function periodFrom(period: PeriodFilter, now = new Date()): string | undefined {
  if (period === "cycle") return undefined;
  if (period === "year") return `${now.getFullYear()}-01-01`;
  const d = new Date(now);
  d.setDate(d.getDate() - Number(period));
  return isoLocal(d);
}

const ROOT_KEY = getGetMyAreaEvaluationsQueryKey()[0];

/** Lista da barra lateral (busca, status e período vão para o servidor). */
export function useMyAreaList(params: GetMyAreaEvaluationsParams, enabled: boolean) {
  return useQuery<MyAreaEvaluations>({
    queryKey: getGetMyAreaEvaluationsQueryKey(params),
    queryFn: ({ signal }) => withServerMessage(getMyAreaEvaluations(params, { signal })),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** O evento aberto na tela (vem da URL), com o estado de cada critério. */
export function useMyAreaEvent(eventId: number | null, enabled: boolean) {
  const params: GetMyAreaEvaluationsParams = { eventId: eventId ?? undefined, status: "all" };
  const q = useQuery<MyAreaEvaluations>({
    queryKey: getGetMyAreaEvaluationsQueryKey(params),
    queryFn: ({ signal }) => withServerMessage(getMyAreaEvaluations(params, { signal })),
    enabled: enabled && eventId != null,
  });
  const event: MyAreaEvent | null = q.data?.events.find(e => e.id === eventId) ?? null;
  return { ...q, event, areaName: q.data?.areaName ?? null };
}

/** Depois de salvar/enviar: lista e evento aberto voltam do servidor. */
export function invalidateMyArea(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: [ROOT_KEY] });
}
