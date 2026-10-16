import { useState } from "react";
import { useMergeUser } from "@workspace/api-client-react";
import type { MergeUserResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { errorStatus, serverMessage } from "./users-ui";

export type MergeError = { message: string; status?: number; closedCycle: boolean };

/**
 * "Mesclar duplicados": seleção dos duplicados, escolha da conta mantida
 * (canônica), confirmação e o resultado exibido depois. A recusa do servidor
 * (409: dado de ciclo fechado ou avaliação no mesmo critério) fica dentro da
 * confirmação, com a explicação dele.
 */
export function useUserMerge(qKey: QueryKey) {
  const qc = useQueryClient();
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [canonicalId, setCanonicalId] = useState<number | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeUserResult | null>(null);
  const [confirmOpen, setConfirmOpenState] = useState(false);
  const [mergeError, setMergeError] = useState<MergeError | null>(null);

  const mergeMutation = useMergeUser({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        setConfirmOpenState(false);
        setMergeResult(data);
        setMergeMode(false);
        setSelectedIds(new Set());
        setCanonicalId(null);
      },
      onError: (e: unknown) => {
        const data = (e as { data?: { cycleClosed?: boolean } } | null)?.data;
        setMergeError({ message: serverMessage(e, "Não foi possível mesclar os usuários."), status: errorStatus(e), closedCycle: data?.cycleClosed === true });
      },
    },
  });

  function reset() {
    setSelectedIds(new Set());
    setCanonicalId(null);
    setMergeError(null);
  }

  /** Liga/desliga o modo de mescla, sempre zerando a seleção. */
  function toggleMergeMode() {
    setMergeMode(v => !v);
    reset();
  }

  function cancelMerge() {
    setMergeMode(false);
    reset();
  }

  /** Marca/desmarca um avaliador; desmarcar o canônico também limpa o canônico. */
  function toggleSelected(id: number) {
    setMergeError(null);
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

  function setConfirmOpen(o: boolean) {
    setMergeError(null);
    setConfirmOpenState(o);
  }

  function confirmMerge() {
    if (!canonicalId) return;
    setMergeError(null);
    const dups = [...selectedIds].filter(id => id !== canonicalId);
    mergeMutation.mutate({ id: canonicalId, data: { duplicateIds: dups } });
  }

  return {
    mergeMode, selectedIds, canonicalId, setCanonicalId, mergeResult, setMergeResult,
    mergeMutation, toggleMergeMode, cancelMerge, toggleSelected, confirmMerge,
    confirmOpen, setConfirmOpen, mergeError,
  };
}

export type UserMergeState = ReturnType<typeof useUserMerge>;
