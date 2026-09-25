import { useState } from "react";
import { useMergeUser } from "@workspace/api-client-react";
import type { MergeUserResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

/**
 * "Mesclar Avaliadores": seleção dos duplicados, escolha do canônico (conta
 * mantida) e o resultado exibido depois da mescla.
 */
export function useUserMerge(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [canonicalId, setCanonicalId] = useState<number | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeUserResult | null>(null);

  const mergeMutation = useMergeUser({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        setMergeResult(data);
        setMergeMode(false);
        setSelectedIds(new Set());
        setCanonicalId(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao mesclar", description: e.message, variant: "destructive" }),
    },
  });

  /** Liga/desliga o modo mescla, sempre zerando a seleção. */
  function toggleMergeMode() {
    setMergeMode(v => !v);
    setSelectedIds(new Set());
    setCanonicalId(null);
  }

  function cancelMerge() {
    setMergeMode(false);
    setSelectedIds(new Set());
    setCanonicalId(null);
  }

  /** Marca/desmarca um avaliador; desmarcar o canônico também limpa o canônico. */
  function toggleSelected(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (canonicalId === id) setCanonicalId(null);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function confirmMerge() {
    if (!canonicalId) return;
    const dups = [...selectedIds].filter(id => id !== canonicalId);
    mergeMutation.mutate({ id: canonicalId, data: { duplicateIds: dups } });
  }

  return {
    mergeMode, selectedIds, canonicalId, setCanonicalId, mergeResult, setMergeResult,
    mergeMutation, toggleMergeMode, cancelMerge, toggleSelected, confirmMerge,
  };
}

export type UserMergeState = ReturnType<typeof useUserMerge>;
