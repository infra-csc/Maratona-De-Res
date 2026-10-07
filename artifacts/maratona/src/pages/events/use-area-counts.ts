// Lista de Eventos no ciclo por ÁREA: a barra de Avaliações conta RESPOSTAS
// POR ÁREA (as cópias dos critérios multiárea uma a uma), a mesma conta da
// Central. GET /events só traz o total por critério de origem; os critérios
// com as cópias vêm de /evaluation-console e as respostas de /evaluations
// (as mesmas consultas de fundo da Central, 5 min de validade).
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getEvaluationConsole, getGetEvaluationConsoleQueryKey, useGetEvaluations, getGetEvaluationsQueryKey,
  type Cycle, type User,
} from "@workspace/api-client-react";
import { hasRole } from "@/lib/auth-context";
import { areaResponseCounts, type AreaResponseCount } from "./criteria-rules";
import type { EventItem } from "./types";

const BACKGROUND = { staleTime: 5 * 60_000, refetchOnWindowFocus: false } as const;

export function useAreaResponseCounts(events: EventItem[] | undefined, cycleById: Map<number, Cycle>, user: User | null): (ev: EventItem) => AreaResponseCount | null {
  const allowed = ["admin", "rh", "diretoria", "operador"].some(r => hasRole(user, r));
  const ids = useMemo(() => (events ?? [])
    .filter(ev => !ev.isHistorical && !!cycleById.get(ev.cycleId)?.areaEvaluation)
    .map(ev => ev.id)
    .sort((a, b) => a - b)
    .join(","), [events, cycleById]);
  const enabled = allowed && ids !== "";
  const { data: consoleData } = useQuery({
    queryKey: getGetEvaluationConsoleQueryKey({ eventIds: ids }),
    queryFn: () => getEvaluationConsole({ eventIds: ids }),
    enabled,
    ...BACKGROUND,
  });
  const { data: evaluations } = useGetEvaluations(undefined, {
    query: { queryKey: getGetEvaluationsQueryKey(), enabled, ...BACKGROUND },
  });
  const byEvent = useMemo(() => {
    const out = new Map<number, AreaResponseCount>();
    if (!consoleData || !evaluations) return out;
    const areaIds = new Set(ids.split(",").filter(Boolean).map(Number));
    for (const id of areaIds) {
      out.set(id, areaResponseCounts(
        consoleData.criteria.filter(c => c.eventId === id),
        evaluations.filter(e => e.eventId === id),
      ));
    }
    return out;
  }, [consoleData, evaluations, ids]);
  return (ev: EventItem) => byEvent.get(ev.id) ?? null;
}
