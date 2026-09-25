import { useState, useEffect } from "react";
import { useCreateAbsence, useUpdateAbsence } from "@workspace/api-client-react";
import type { Absence, Employee, Event } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCycleResults } from "@/lib/invalidate-results";
import type { QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import type { PenaltyTypeLookup } from "./use-penalty-types";
import type { AbsenceFormData } from "./types";

/**
 * Diálogo "Registrar/Editar Lançamento": abertura, formulário, prévia de
 * pontos e envio (criação com 2ª data opcional = 2 lançamentos; edição = 1).
 */
export function useAbsenceForm(
  qKey: QueryKey,
  employees: Employee[] | undefined,
  events: Event[] | undefined,
  types: PenaltyTypeLookup,
) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { typeLabel, typeKind, typePoints, typeRequiresEvent, defaultType } = types;

  const [open, setOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AbsenceFormData>({
    defaultValues: { quantity: 1, penaltyType: defaultType, employeeId: null, eventId: null, date: "", date2: "", reason: "" },
  });

  const selectedType = watch("penaltyType");
  const watchedEmployeeId = watch("employeeId");
  const watchedEventId = watch("eventId");
  const watchedQty = watch("quantity");
  const watchedDate2 = watch("date2");
  const selectedEmployee = (employees ?? []).find(e => e.id === Number(watchedEmployeeId));
  const selectedEvent = (events ?? []).find(e => e.id === Number(watchedEventId));
  const requiresEvent = typeRequiresEvent(selectedType);
  const previewPoints = typePoints(selectedType) * Math.max(1, Number(watchedQty) || 1);
  const previewKind = typeKind(selectedType);

  useEffect(() => {
    if (!open) return;
    if (editingAbsence) {
      reset({
        penaltyType: editingAbsence.penaltyType,
        employeeId: editingAbsence.employeeId,
        eventId: editingAbsence.eventId ?? null,
        date: editingAbsence.date,
        date2: "",
        quantity: editingAbsence.quantity,
        reason: editingAbsence.reason ?? "",
      });
    } else {
      reset({ quantity: 1, penaltyType: defaultType, employeeId: null, eventId: null, date: "", date2: "", reason: "" });
    }
    // defaultType fora das dependências: quando /penalty-types respondia com o
    // diálogo aberto, o formulário era zerado no meio do preenchimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingAbsence]);

  const createMutation = useCreateAbsence({
    mutation: {
      onError: (e: { message?: string }) => toast({ title: "Não foi possível registrar o lançamento", description: e.message ?? "Tente novamente.", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc);
        toast({ title: "Lançamento atualizado com sucesso" });
        setOpen(false);
        setEditingAbsence(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  function openCreate() {
    setEditingAbsence(null);
    setOpen(true);
  }

  function openEdit(a: Absence) {
    setEditingAbsence(a);
    setOpen(true);
  }

  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function closeDialog() {
    setOpen(false);
    setEditingAbsence(null);
    reset();
  }

  async function onSubmit(d: AbsenceFormData) {
    if (requiresEvent && !d.eventId) {
      toast({ title: "Evento obrigatório", description: `${typeLabel(d.penaltyType)} exige um evento vinculado.`, variant: "destructive" });
      return;
    }
    if (!d.employeeId) {
      toast({ title: "Colaborador obrigatório", variant: "destructive" });
      return;
    }
    if (editingAbsence) {
      updateMutation.mutate({
        id: editingAbsence.id,
        data: {
          penaltyType: d.penaltyType,
          eventId: d.eventId ? Number(d.eventId) : null,
          date: d.date,
          quantity: Number(d.quantity),
          reason: d.reason || null,
        },
      });
    } else {
      const payload = {
        penaltyType: d.penaltyType,
        employeeId: Number(d.employeeId),
        eventId: d.eventId ? Number(d.eventId) : null,
        quantity: Number(d.quantity),
        reason: d.reason || undefined,
      };
      const hasSecondDate = !!d.date2?.trim();
      try {
        await createMutation.mutateAsync({ data: { ...payload, date: d.date } });
        if (hasSecondDate) {
          await createMutation.mutateAsync({ data: { ...payload, date: d.date2 } });
        }
        qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc);
        toast({ title: hasSecondDate ? "2 lançamentos registrados com sucesso" : "Lançamento registrado com sucesso" });
        setOpen(false);
        setEditingAbsence(null);
      } catch {
        // erro já exibido pelo onError da mutation
      }
    }
  }

  const isModalPending = createMutation.isPending || updateMutation.isPending;

  return {
    open, setOpen, editingAbsence, openCreate, openEdit, closeDialog,
    register, handleSubmit, setValue, errors, onSubmit, isModalPending,
    selectedType, watchedEmployeeId, watchedEventId, watchedDate2,
    selectedEmployee, selectedEvent, requiresEvent, previewPoints, previewKind,
  };
}

export type AbsenceFormState = ReturnType<typeof useAbsenceForm>;
