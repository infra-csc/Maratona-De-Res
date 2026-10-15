import { useState } from "react";
import { useDeleteAbsence } from "@workspace/api-client-react";
import type { Absence } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCycleResults } from "@/lib/invalidate-results";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, evaluationErrorTitle } from "@/lib/utils";

/** Exclusão de um lançamento, com o alvo guardado até a confirmação. */
export function useAbsenceDelete(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null);

  const deleteMutation = useDeleteAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc);
        toast({ title: "Lançamento excluído", description: deleteTarget?.employeeName ? `A nota de ${deleteTarget.employeeName} já foi recalculada.` : undefined });
        setDeleteTarget(null);
      },
      onError: (e: unknown) => toast({ title: evaluationErrorTitle(e, "Não foi possível excluir"), description: apiErrorMessage(e, "Tente de novo em instantes."), variant: "destructive" }),
    },
  });

  return { deleteTarget, setDeleteTarget, deleteMutation };
}

export type AbsenceDeleteState = ReturnType<typeof useAbsenceDelete>;
