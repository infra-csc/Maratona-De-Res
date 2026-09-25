import { useState } from "react";
import { useDeleteAbsence } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCycleResults } from "@/lib/invalidate-results";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/** Exclusão de um lançamento, com o alvo guardado até a confirmação. */
export function useAbsenceDelete(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const deleteMutation = useDeleteAbsence({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc); setDeleteTargetId(null); },
      onError: () => toast({ title: "Erro ao remover lançamento", variant: "destructive" }),
    },
  });

  return { deleteTargetId, setDeleteTargetId, deleteMutation };
}

export type AbsenceDeleteState = ReturnType<typeof useAbsenceDelete>;
