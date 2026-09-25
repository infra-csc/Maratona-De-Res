import { useState } from "react";
import { useResyncAllEventsCriteria } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { customFetch } from "@/lib/custom-fetch";
import type { FixCalibrationResult, ResyncSummary } from "./types";

/**
 * Ações de manutenção do topo da tela: "Sync. Rótulos de Área", "Corrigir
 * Calibrações" e "Sync. Todos os Eventos" (com o resumo exibido no diálogo).
 */
export function useCriteriaMaintenance(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [fixCalibRunning, setFixCalibRunning] = useState(false);
  const [fixCalibResult, setFixCalibResult] = useState<FixCalibrationResult | null>(null);
  async function runFixCalibrationCriteria() {
    setFixCalibRunning(true);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
      const data = await customFetch<FixCalibrationResult>(`${base}/events/admin/fix-calibration-criteria`, { method: "POST" });
      setFixCalibResult(data);
      toast({ title: `Calibrações corrigidas — ${data.totalUpdated} linha(s) atualizada(s)` });
    } catch (e: unknown) {
      toast({ title: "Erro ao corrigir calibrações", description: (e as Error).message, variant: "destructive" });
    } finally {
      setFixCalibRunning(false);
    }
  }

  const [syncLabelsRunning, setSyncLabelsRunning] = useState(false);
  const [syncLabelsResult, setSyncLabelsResult] = useState<number | null>(null);
  async function runSyncAreaLabels() {
    setSyncLabelsRunning(true);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
      const data = await customFetch<{ updated: number }>(`${base}/criteria/admin/sync-area-labels`, { method: "POST" });
      setSyncLabelsResult(data.updated);
      toast({ title: `Rótulos de área sincronizados — ${data.updated} critério(s) atualizado(s)` });
      qc.invalidateQueries({ queryKey: qKey });
    } catch (e: unknown) {
      toast({ title: "Erro ao sincronizar rótulos", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncLabelsRunning(false);
    }
  }

  const [resyncSummary, setResyncSummary] = useState<ResyncSummary | null>(null);
  const resyncAllMutation = useResyncAllEventsCriteria({
    mutation: {
      onSuccess: (data) => {
        setResyncSummary({
          processed: data.processed ?? 0,
          skipped: data.skipped ?? 0,
          totalAdded: data.totalAdded ?? 0,
          totalDeactivated: data.totalDeactivated ?? 0,
          totalActivated: (data as { totalActivated?: number }).totalActivated ?? 0,
          events: (data.events ?? []).map(ev => ({
            id: ev.id ?? 0, name: ev.name ?? "", added: ev.added ?? 0, deactivated: ev.deactivated ?? 0,
            activated: (ev as { activated?: number }).activated ?? 0,
          })),
        });
        toast({ title: `Sincronização concluída — ${data.processed ?? 0} evento(s) atualizado(s)` });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
    },
  });

  return {
    fixCalibRunning, fixCalibResult, runFixCalibrationCriteria,
    syncLabelsRunning, syncLabelsResult, runSyncAreaLabels,
    resyncSummary, setResyncSummary, resyncAllMutation,
  };
}
