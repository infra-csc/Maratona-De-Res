import { useState } from "react";
import {
  useCreatePenaltyType, useUpdatePenaltyType, useDeletePenaltyType, useSeedDefaultPenaltyTypes,
} from "@workspace/api-client-react";
import type { PenaltyType } from "@workspace/api-client-react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { invalidateCycleResults } from "@/lib/invalidate-results";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, plural } from "@/lib/utils";

export interface TypeFormData {
  slug: string;
  label: string;
  points: number;
  kind: "penalty" | "merit";
  requiresEvent: boolean;
  active: boolean;
  displayOrder: number;
}

export type ApplyScope = "future" | "cycle";

/** Sugestão de identificador a partir do nome: "Atraso injustificado" → "atraso_injustificado". */
export function slugify(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

/** Corpo completo do PUT (o contrato pede o tipo inteiro). */
const fullPayload = (t: PenaltyType) => ({
  slug: t.slug, label: t.label, points: t.points, kind: t.kind, requiresEvent: t.requiresEvent, active: t.active, displayOrder: t.displayOrder,
});

/** Formulário Novo/Editar tipo, ativar/desativar na linha, remover e restaurar padrões. */
export function useTypeForm(qKey: QueryKey, types: PenaltyType[] | undefined) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingType, setEditingType] = useState<PenaltyType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PenaltyType | null>(null);
  const [applyScope, setApplyScope] = useState<ApplyScope>("future");
  const [slugTouched, setSlugTouched] = useState(false);

  const form = useForm<TypeFormData>({
    defaultValues: { slug: "", label: "", points: 10, kind: "penalty", requiresEvent: false, active: true, displayOrder: 0 },
  });
  const { reset } = form;

  const refresh = () => { qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc); };
  const fail = (title: string) => (e: unknown) => toast({ title, description: apiErrorMessage(e, "Tente de novo em instantes."), variant: "destructive" });

  const createMutation = useCreatePenaltyType({
    mutation: {
      onSuccess: (t) => { refresh(); toast({ title: "Tipo criado", description: `“${t.label}” já aparece no formulário de lançamento.` }); setOpen(false); },
      onError: fail("Não foi possível criar o tipo"),
    },
  });

  const updateMutation = useUpdatePenaltyType({
    mutation: {
      onSuccess: (data) => {
        refresh();
        const retro = (data as PenaltyType & { retroactiveUpdated?: number }).retroactiveUpdated ?? 0;
        toast({
          title: "Tipo atualizado",
          description: retro > 0
            ? `${retro === 1 ? "1 lançamento já registrado neste ciclo foi atualizado" : `${retro} lançamentos já registrados neste ciclo foram atualizados`} com o novo valor. Os resultados foram recalculados.`
            : undefined,
        });
        setOpen(false);
        setEditingType(null);
      },
      onError: fail("Não foi possível salvar o tipo"),
    },
  });

  // Ativar/desativar direto na linha (mesmo PUT, só muda "active").
  const toggleMutation = useUpdatePenaltyType({
    mutation: {
      onSuccess: (t) => { refresh(); toast({ title: t.active ? "Tipo ativado" : "Tipo desativado", description: t.active ? `“${t.label}” volta a aparecer no formulário de lançamento.` : `“${t.label}” sai do formulário; os lançamentos já feitos continuam valendo.` }); },
      onError: fail("Não foi possível mudar a situação"),
    },
  });

  const deleteMutation = useDeletePenaltyType({
    mutation: {
      onSuccess: () => { refresh(); toast({ title: "Tipo removido", description: deleteTarget ? `“${deleteTarget.label}” saiu do cadastro.` : undefined }); setDeleteTarget(null); },
      onError: fail("Não foi possível remover o tipo"),
    },
  });

  const seedMutation = useSeedDefaultPenaltyTypes({
    mutation: {
      onSuccess: (data) => {
        refresh();
        if (data.inserted === 0) toast({ title: "Os tipos padrão já existem", description: "Nenhum tipo novo foi inserido." });
        else toast({ title: `${plural(data.inserted ?? 0, "tipo padrão restaurado", "tipos padrão restaurados")} com sucesso` });
      },
      onError: fail("Não foi possível restaurar os padrões"),
    },
  });

  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function closeDialog() {
    setOpen(false);
    setEditingType(null);
    reset();
  }

  function openCreate(kind: "penalty" | "merit" = "penalty") {
    setEditingType(null);
    setSlugTouched(false);
    reset({ slug: "", label: "", points: 10, kind, requiresEvent: false, active: true, displayOrder: (types?.length ?? 0) + 1 });
    setOpen(true);
  }

  function openEdit(t: PenaltyType) {
    setEditingType(t);
    setApplyScope("future");
    setSlugTouched(true);
    reset({ slug: t.slug, label: t.label, points: t.points, kind: t.kind as "penalty" | "merit", requiresEvent: t.requiresEvent, active: t.active, displayOrder: t.displayOrder });
    setOpen(true);
  }

  function onSubmit(d: TypeFormData) {
    const pointsChanged = !!editingType && Number(d.points) !== editingType.points;
    const payload = {
      slug: d.slug.trim().toLowerCase().replace(/\s+/g, "_"),
      label: d.label.trim(),
      points: Number(d.points),
      kind: d.kind,
      requiresEvent: d.requiresEvent,
      active: d.active,
      displayOrder: Number(d.displayOrder),
      ...(pointsChanged ? { applyScope } : {}),
    };
    if (editingType) updateMutation.mutate({ id: editingType.id, data: payload });
    else createMutation.mutate({ data: payload });
  }

  function toggleActive(t: PenaltyType, active: boolean) {
    toggleMutation.mutate({ id: t.id, data: { ...fullPayload(t), active } });
  }

  const togglingId = toggleMutation.isPending ? toggleMutation.variables?.id ?? null : null;

  return {
    open, editingType, openCreate, openEdit, closeDialog, form, onSubmit,
    applyScope, setApplyScope, slugTouched, setSlugTouched,
    isPending: createMutation.isPending || updateMutation.isPending,
    deleteTarget, setDeleteTarget, deleteMutation,
    toggleActive, togglingId, seedMutation,
  };
}

export type TypeFormState = ReturnType<typeof useTypeForm>;
