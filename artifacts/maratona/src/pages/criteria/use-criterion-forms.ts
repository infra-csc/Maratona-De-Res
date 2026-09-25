import { useState } from "react";
import { useCreateCriterion } from "@workspace/api-client-react";
import type { Criterion, CriterionInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import type { AreaOption } from "./types";

/** Estado do diálogo "Novo Critério": formulário + mutação de criação. */
export function useCreateCriterionForm(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<CriterionInput>({
    defaultValues: { defaultWeight: 3 },
  });
  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function setCreateOpen(o: boolean) {
    setOpen(o);
    if (!o) form.reset();
  }

  const createMutation = useCreateCriterion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Critério criado" });
        setCreateOpen(false);
      },
      onError: (e: { message?: string }) => toast({ title: "Não foi possível criar o critério", description: e.message ?? "Tente novamente.", variant: "destructive" }),
    },
  });

  return { open, setCreateOpen, form, createMutation };
}

export type CreateCriterionForm = ReturnType<typeof useCreateCriterionForm>;

/** Estado do diálogo "Duplicar Critério" (cópia do critério vinculada a outra área). */
export function useDuplicateCriterion(qKey: QueryKey, criteria: Criterion[] | undefined, areas: AreaOption[] | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [duplicateSourceId, setDuplicateSourceId] = useState<number | null>(null);
  const [duplicateAreaId, setDuplicateAreaId] = useState<string>("");
  const duplicateSource = duplicateSourceId != null ? (criteria ?? []).find(c => c.id === duplicateSourceId) : null;

  const duplicateMutation = useCreateCriterion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Critério duplicado" });
        setDuplicateSourceId(null);
        setDuplicateAreaId("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
    },
  });

  /** Abre o diálogo; "Qualidade da Entrega" já sugere Ativação como área de destino. */
  function startDuplicate(c: Criterion) {
    setDuplicateSourceId(c.id);
    const suggestedArea = c.name.trim().toLowerCase() === "qualidade da entrega"
      ? (areas ?? []).find(a => a.name.trim().toLowerCase() === "ativação" && a.id !== c.responsibleAreaId)
      : undefined;
    setDuplicateAreaId(suggestedArea ? String(suggestedArea.id) : "");
  }

  function closeDuplicate() {
    setDuplicateSourceId(null);
    setDuplicateAreaId("");
  }

  const handleDuplicate = () => {
    if (!duplicateSource || !duplicateAreaId) return;
    duplicateMutation.mutate({
      data: {
        name: duplicateSource.name,
        description: duplicateSource.description ?? undefined,
        defaultWeight: Number(duplicateSource.defaultWeight),
        responsibleAreaId: Number(duplicateAreaId),
      },
    });
  };

  return {
    duplicateSourceId, duplicateSource, duplicateAreaId, setDuplicateAreaId,
    duplicateMutation, startDuplicate, closeDuplicate, handleDuplicate,
  };
}

export type DuplicateCriterionState = ReturnType<typeof useDuplicateCriterion>;
