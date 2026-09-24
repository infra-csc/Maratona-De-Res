import type { Dispatch, SetStateAction } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  useGetEvent, useConfirmEventResults,
  useSetConformityEvaluator, useSetConformityEvaluatorFerramentas,
  getGetEventsQueryKey, getGetEventQueryKey,
} from "@workspace/api-client-react";
import { usePatchCriterionAssignment } from "@/lib/routing-api";
import type { useToast } from "@/hooks/use-toast";
import type { ConformityKey } from "./types";

export type ToastFn = ReturnType<typeof useToast>["toast"];

/** Detalhe do evento selecionado (matriz de conformidade + confirmar resultados)
 *  e as mutações de atribuição que dependem dele. */
export function useSelectedEventDetail({ selectedEventId, qc, toast, setOpenConformityPicker }: {
  selectedEventId: number | null;
  qc: QueryClient;
  toast: ToastFn;
  setOpenConformityPicker: Dispatch<SetStateAction<ConformityKey | null>>;
}) {
  const { data: selectedDetail } = useGetEvent(selectedEventId ?? 0, {
    query: {
      enabled: selectedEventId != null,
      queryKey: (selectedEventId != null ? getGetEventQueryKey(selectedEventId) : ["/events", null]) as unknown[],
    },
  });
  const patchAssignment = usePatchCriterionAssignment(selectedEventId ?? 0);
  // Nas mutações abaixo o id do evento vem das VARIÁVEIS da própria mutação
  // (vars.id), não de `selected!` — o usuário pode trocar de evento enquanto
  // a requisição está em voo, e `selected` pode ser null.
  const setConformityEvaluatorMutation = useSetConformityEvaluator({
    mutation: {
      onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) }); qc.invalidateQueries({ queryKey: getGetEventsQueryKey() }); setOpenConformityPicker(null); toast({ title: "Avaliador de Cenografia atualizado" }); },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });
  const setConformityEvaluatorFerramentasMutation = useSetConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) }); qc.invalidateQueries({ queryKey: getGetEventsQueryKey() }); setOpenConformityPicker(null); toast({ title: "Avaliador de Ferramentas atualizado" }); },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });
  return { selectedDetail, patchAssignment, setConformityEvaluatorMutation, setConformityEvaluatorFerramentasMutation };
}

export type SelectedEventDetail = ReturnType<typeof useSelectedEventDetail>;

/** "Confirmar Resultados" do evento (passa a contar na elegibilidade). */
export function useConfirmResults(qc: QueryClient, toast: ToastFn) {
  return useConfirmEventResults({
    mutation: {
      onSuccess: (data, vars) => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) });
        toast({
          title: "Resultados confirmados",
          description: data.warnings && data.warnings.length > 0 ? data.warnings.join(" ") : "O evento agora conta na elegibilidade dos colaboradores.",
        });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
    },
  });
}

export type ConfirmResultsMutation = ReturnType<typeof useConfirmResults>;
