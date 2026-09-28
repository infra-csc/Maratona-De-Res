import { useState } from "react";
import { useCreateCriterion, useUpdateCriterion } from "@workspace/api-client-react";
import type { Criterion, CriterionInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import type { AreaOption } from "./types";
import { serverMessage } from "./helpers";
import { EMPTY_AREAS_VALUE, areasPayload, areasValueOf, type EvaluatingAreasValue } from "./evaluating-areas";

/** Estado do diálogo "Novo Critério": formulário + mutação de criação. */
export function useCreateCriterionForm(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // "Áreas que avaliam" fica fora do react-hook-form: o modo "Áreas escolhidas"
  // precisa existir mesmo com a lista ainda vazia.
  const [areasValue, setAreasValue] = useState<EvaluatingAreasValue>(EMPTY_AREAS_VALUE);

  const form = useForm<CriterionInput>({
    defaultValues: { defaultWeight: 3 },
  });
  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function setCreateOpen(o: boolean) {
    setOpen(o);
    if (!o) { form.reset(); setAreasValue(EMPTY_AREAS_VALUE); }
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

  function submit(d: CriterionInput) {
    createMutation.mutate({
      data: {
        ...d,
        name: d.name.trim(),
        defaultWeight: Number(d.defaultWeight),
        ...areasPayload(areasValue, d.responsibleAreaId),
      },
    });
  }

  return { open, setCreateOpen, form, createMutation, areasValue, setAreasValue, submit };
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

/** Diálogo "Áreas que avaliam" de um critério já existente (PATCH /criteria/:id). */
export function useCriterionAreasEditor(qKey: QueryKey) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = useState<Criterion | null>(null);
  const [value, setValue] = useState<EvaluatingAreasValue>(EMPTY_AREAS_VALUE);

  const mutation = useUpdateCriterion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Áreas que avaliam atualizadas", description: "Vale para eventos novos. Em eventos já criados, use \"Aplicar áreas do padrão\" na Central." });
        setTarget(null);
      },
      onError: (e: unknown) => toast({ title: "Não foi possível salvar as áreas", description: serverMessage(e), variant: "destructive" }),
    },
  });

  function start(c: Criterion) {
    setTarget(c);
    setValue(areasValueOf(c));
  }
  function close() { setTarget(null); }
  function save() {
    if (!target) return;
    mutation.mutate({ id: target.id, data: areasPayload(value, target.responsibleAreaId) });
  }

  return { target, value, setValue, mutation, start, close, save };
}

export type CriterionAreasEditor = ReturnType<typeof useCriterionAreasEditor>;
