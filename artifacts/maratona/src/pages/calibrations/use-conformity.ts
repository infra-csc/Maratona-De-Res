// Matriz de Conformidade: query, mutation e formulário local. Movido
// literalmente do componente da página (mesma ordem de hooks e query keys).
import { useState, useEffect } from "react";
import { useGetEventConformity, useSetEventConformity, getGetEventsQueryKey } from "@workspace/api-client-react";
import type { EventDetail } from "@workspace/api-client-react";
import type { useAuth } from "@/lib/auth-context";
import type { ConformityForm, QueryClientLike } from "./types";

export function useConformity(params: {
  selectedEventId: number | null;
  qc: QueryClientLike;
  user: ReturnType<typeof useAuth>["user"];
  fullEvent: EventDetail | undefined;
}) {
  const { selectedEventId, qc, user, fullEvent } = params;

  // Conformidade
  const { data: conformity } = useGetEventConformity(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["conformity", selectedEventId] as unknown[] },
  });
  const setConformityMutation = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["conformity", selectedEventId] });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      },
    },
  });
  const [conformityForm, setConformityForm] = useState<ConformityForm>({ epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null, epiComment: "", estaiamentosComment: "", guardaEquipamentosComment: "", condutaComment: "", absencesReport: "", standoutResponse: null, standoutJustification: "" });
  const [conformityExpandedComments, setConformityExpandedComments] = useState<Set<string>>(new Set());
  const canManageConformity = ["admin", "rh", "diretoria"].includes(user?.role ?? "")
    || !!(user && fullEvent && user.id === fullEvent.conformityEvaluatorUserId)
    || !!(user && fullEvent && user.id === fullEvent.conformityEvaluatorFerramentasUserId);
  useEffect(() => {
    setConformityExpandedComments(new Set());
    if (conformity) {
      setConformityForm({
        epi: conformity.epi ?? null,
        estaiamentos: conformity.estaiamentos ?? null,
        guardaEquipamentos: conformity.guardaEquipamentos ?? null,
        conduta: conformity.conduta ?? null,
        epiComment: conformity.epiComment ?? "",
        estaiamentosComment: conformity.estaiamentosComment ?? "",
        guardaEquipamentosComment: conformity.guardaEquipamentosComment ?? "",
        condutaComment: conformity.condutaComment ?? "",
        absencesReport: conformity.absencesReport ?? "",
        standoutResponse: conformity.standoutResponse ?? null,
        standoutJustification: conformity.standoutJustification ?? "",
      });
    } else {
      setConformityForm({ epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null, epiComment: "", estaiamentosComment: "", guardaEquipamentosComment: "", condutaComment: "", absencesReport: "", standoutResponse: null, standoutJustification: "" });
    }
  }, [conformity, selectedEventId]);

  return {
    conformity,
    setConformityMutation,
    conformityForm,
    setConformityForm,
    conformityExpandedComments,
    setConformityExpandedComments,
    canManageConformity,
  };
}

export type ConformityState = ReturnType<typeof useConformity>;
