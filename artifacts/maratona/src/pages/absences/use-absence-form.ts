import { useState, useEffect } from "react";
import { useCreateAbsence, useUpdateAbsence } from "@workspace/api-client-react";
import type { Absence, Employee, Event } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCycleResults } from "@/lib/invalidate-results";
import type { QueryKey } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, evaluationErrorTitle } from "@/lib/utils";
import { eventLockedByClosedCycle } from "./helpers";
import type { PenaltyTypeLookup } from "./use-penalty-types";
import type { AbsenceFormData } from "./types";

/** Recusa do servidor mostrada dentro do diálogo (além do aviso). */
export type SubmitError = { title: string; message: string } | null;

/**
 * Diálogo "Registrar/Editar lançamento": abertura, formulário, prévia de
 * pontos e envio (criação com 2ª data opcional = 2 lançamentos; edição = 1).
 */
export function useAbsenceForm(
  qKey: QueryKey,
  employees: Employee[] | undefined,
  events: Event[] | undefined,
  types: PenaltyTypeLookup,
  cycleClosed: boolean,
) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { typeLabel, typeKind, typePoints, typeRequiresEvent, defaultType } = types;

  const [open, setOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [submitError, setSubmitError] = useState<SubmitError>(null);
  // Linhas recém-salvas ganham um destaque curto na lista (o olho acha o que mudou).
  const [freshIds, setFreshIds] = useState<number[]>([]);
  const flash = (ids: number[]) => { setFreshIds(ids); window.setTimeout(() => setFreshIds([]), 2200); };

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AbsenceFormData>({
    defaultValues: { quantity: 1, penaltyType: defaultType, employeeId: null, eventId: null, date: "", date2: "", reason: "" },
  });

  // Colaborador e evento não são <input>: registrados à mão, com a validação
  // aparecendo no próprio campo (antes era só um aviso solto no canto).
  useEffect(() => {
    register("employeeId", { validate: v => (v != null && Number(v) > 0) || "Escolha o colaborador." });
    register("eventId", {
      validate: (v, f) => {
        if (typeRequiresEvent(f.penaltyType) && !v) return `${typeLabel(f.penaltyType)} exige um evento vinculado.`;
        const ev = v ? (events ?? []).find(e => e.id === Number(v)) : undefined;
        if (ev && eventLockedByClosedCycle(ev, cycleClosed)) return "Este evento é de um ciclo fechado: só consulta. Escolha outro evento.";
        return true;
      },
    });
  }, [register, events, cycleClosed, typeRequiresEvent, typeLabel]);

  const selectedType = watch("penaltyType");
  const watchedEmployeeId = watch("employeeId");
  const watchedEventId = watch("eventId");
  const watchedQty = watch("quantity");
  const watchedDate = watch("date");
  const watchedDate2 = watch("date2");
  const selectedEmployee = (employees ?? []).find(e => e.id === Number(watchedEmployeeId));
  const selectedEvent = (events ?? []).find(e => e.id === Number(watchedEventId));
  const requiresEvent = typeRequiresEvent(selectedType);
  const qty = Math.max(1, Number(watchedQty) || 1);
  const previewPoints = typePoints(selectedType) * qty;
  const previewKind = typeKind(selectedType);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
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

  function showError(e: unknown, fallback: string) {
    const title = evaluationErrorTitle(e, fallback);
    const message = apiErrorMessage(e, "Tente de novo em instantes.");
    setSubmitError({ title, message });
    toast({ title, description: message, variant: "destructive" });
  }

  const createMutation = useCreateAbsence();
  const updateMutation = useUpdateAbsence({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc);
        flash([vars.id]);
        toast({ title: "Lançamento atualizado", description: "A nota do colaborador já foi recalculada." });
        setOpen(false);
        setEditingAbsence(null);
      },
      onError: (e: unknown) => showError(e, "Não foi possível salvar"),
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
    setSubmitError(null);
    reset();
  }

  async function onSubmit(d: AbsenceFormData) {
    setSubmitError(null);
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
      return;
    }
    const payload = {
      penaltyType: d.penaltyType,
      employeeId: Number(d.employeeId),
      eventId: d.eventId ? Number(d.eventId) : null,
      quantity: Number(d.quantity),
      reason: d.reason || undefined,
    };
    const hasSecondDate = !!d.date2?.trim();
    let created = 0;
    const ids: number[] = [];
    try {
      ids.push((await createMutation.mutateAsync({ data: { ...payload, date: d.date } })).id);
      created = 1;
      if (hasSecondDate) {
        ids.push((await createMutation.mutateAsync({ data: { ...payload, date: d.date2 } })).id);
        created = 2;
      }
      qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc);
      flash(ids);
      toast({ title: hasSecondDate ? "2 lançamentos registrados com sucesso" : "Lançamento registrado com sucesso", description: "A nota do colaborador já foi recalculada." });
      setOpen(false);
      setEditingAbsence(null);
    } catch (e) {
      // A 1ª data pode ter entrado antes de a 2ª ser recusada: a lista precisa mostrar isso.
      // O formulário fica só com a 2ª data, para um novo envio não duplicar a 1ª.
      if (created > 0) {
        qc.invalidateQueries({ queryKey: qKey }); invalidateCycleResults(qc);
        setValue("date", d.date2);
        setValue("date2", "");
      }
      showError(e, created > 0 ? "A 1ª data entrou; a 2ª não" : "Não foi possível registrar o lançamento");
    }
  }

  const isModalPending = createMutation.isPending || updateMutation.isPending;

  return {
    open, setOpen, editingAbsence, openCreate, openEdit, closeDialog, submitError, freshIds,
    register, handleSubmit, setValue, errors, onSubmit, isModalPending,
    selectedType, watchedEmployeeId, watchedEventId, watchedDate, watchedDate2, qty,
    selectedEmployee, selectedEvent, requiresEvent, previewPoints, previewKind, cycleClosed,
  };
}

export type AbsenceFormState = ReturnType<typeof useAbsenceForm>;
