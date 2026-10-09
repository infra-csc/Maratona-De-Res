import { useState } from "react";
import { useResyncAllEventsCriteria } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { customFetch } from "@/lib/custom-fetch";
import { serverMessage } from "./helpers";
import type { FixCalibrationResult, ResyncSummary } from "./types";

/** As três ações de manutenção do menu "Mais ações". */
export type MaintenanceKind = "labels" | "calibrations" | "resync";

/**
 * Um diálogo só para as três: confirma (com a consequência explicada), roda,
 * e mostra o resultado ou o erro no próprio diálogo.
 */
export type MaintenanceState = {
  kind: MaintenanceKind;
  status: "confirm" | "running" | "done" | "error";
  error?: string;
  labels?: number;
  calibrations?: FixCalibrationResult;
  resync?: ResyncSummary;
};

const apiBase = () => (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

/**
 * Ações de manutenção do topo da tela: "Sincronizar rótulos de área",
 * "Corrigir calibrações" e "Sincronizar todos os eventos". Mesmas chamadas de
 * antes; agora cada uma passa por uma confirmação.
 */
export function useCriteriaMaintenance(qKey: QueryKey) {
  const qc = useQueryClient();
  const [state, setState] = useState<MaintenanceState | null>(null);
  const resyncAllMutation = useResyncAllEventsCriteria();

  function open(kind: MaintenanceKind) {
    setState({ kind, status: "confirm" });
  }
  function close() {
    setState(s => (s?.status === "running" ? s : null));
  }

  async function confirm() {
    if (!state || state.status === "running") return;
    const kind = state.kind;
    setState({ kind, status: "running" });
    try {
      if (kind === "labels") {
        const data = await customFetch<{ updated: number }>(`${apiBase()}/criteria/admin/sync-area-labels`, { method: "POST" });
        qc.invalidateQueries({ queryKey: qKey });
        setState({ kind, status: "done", labels: data.updated ?? 0 });
      } else if (kind === "calibrations") {
        const data = await customFetch<FixCalibrationResult>(`${apiBase()}/events/admin/fix-calibration-criteria`, { method: "POST" });
        setState({ kind, status: "done", calibrations: { totalUpdated: data.totalUpdated ?? 0, results: data.results ?? [], skippedClosedCycle: data.skippedClosedCycle ?? [] } });
      } else {
        const data = await resyncAllMutation.mutateAsync();
        const raw = data as typeof data & { totalActivated?: number; failures?: { id: number; name: string; error: string }[] };
        qc.invalidateQueries({ queryKey: qKey });
        setState({
          kind,
          status: "done",
          resync: {
            processed: data.processed ?? 0,
            skipped: data.skipped ?? 0,
            skippedClosedCycle: data.skippedClosedCycle ?? 0,
            failures: raw.failures ?? [],
            totalAdded: data.totalAdded ?? 0,
            totalDeactivated: data.totalDeactivated ?? 0,
            totalActivated: raw.totalActivated ?? 0,
            events: (data.events ?? []).map(ev => ({
              id: ev.id ?? 0, name: ev.name ?? "", added: ev.added ?? 0, deactivated: ev.deactivated ?? 0,
              activated: (ev as { activated?: number }).activated ?? 0,
            })),
          },
        });
      }
    } catch (e: unknown) {
      setState({ kind, status: "error", error: serverMessage(e) });
    }
  }

  return { state, open, close, confirm };
}

export type CriteriaMaintenance = ReturnType<typeof useCriteriaMaintenance>;
