// Fechar e recalcular o ciclo — as mesmas chamadas e invalidações que viviam
// na aba Bônus & Pagamentos, agora no topo da tela (valem para qualquer aba).
import {
  getGetRankingQueryKey, getGetRankingTotalQueryKey, getListCyclesQueryKey, getListCycleOptionsQueryKey, getGetCurrentCycleQueryKey,
  getGetQuarterlyResultsQueryKey, useCloseQuarter, useRecomputeQuarter,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { plural } from "@/lib/utils";

export type CloseInput = { forced: true; reason: string } | Record<string, never>;

export function useCycleActions(cycleId?: string) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const params = cycleId ? { cycleId } : undefined;
  const qKey = getGetQuarterlyResultsQueryKey(params);

  const closeMutation = useCloseQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
        // O ciclo mudou de situação (fechado): seletor, Ciclos e Total geral.
        qc.invalidateQueries({ queryKey: getGetRankingTotalQueryKey() });
        qc.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        qc.invalidateQueries({ queryKey: getListCycleOptionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetCurrentCycleQueryKey() });
        toast({ title: "Ciclo fechado", description: `${plural(data.totalProcessed, "colaborador processado", "colaboradores processados")}. O bônus agora é oficial.` });
      },
      // O erro aparece dentro do diálogo (ver CloseCycleDialog), sem toast duplicado.
    },
  });

  const recomputeMutation = useRecomputeQuarter({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
        qc.invalidateQueries({ queryKey: getGetRankingTotalQueryKey() });
        qc.invalidateQueries({ queryKey: getListCyclesQueryKey() });
        toast({ title: "Ciclo recalculado", description: `${plural(data.totalProcessed, "colaborador processado", "colaboradores processados")}.` });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao recalcular ciclo", description: e.message, variant: "destructive" }),
    },
  });

  return {
    /** Fecha o ciclo atual; rejeita com o erro da API (o diálogo mostra a mensagem). */
    close: (input: CloseInput) => closeMutation.mutateAsync({ data: input }),
    closing: closeMutation.isPending,
    recompute: () => recomputeMutation.mutate(),
    recomputing: recomputeMutation.isPending,
  };
}
