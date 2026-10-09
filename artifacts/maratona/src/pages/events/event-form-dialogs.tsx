// Diálogos "Novo Evento" (com o botão que o abre) e "Editar Evento".
// Cada um é dono do próprio formulário e da própria mutação.
import { useState, useEffect } from "react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateEvent, useUpdateEvent, getGetEventsQueryKey } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { CalendarPlus, Loader2, Pencil, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { serverErrorMessage } from "./form-bits";
import { DATE_RE } from "./url-filters";
import { DialogHeading, FieldErrorText, FieldLabel, btnPrimary, btnSecondary, dialogCls, inputCls } from "./events-ui";
import type { EditingEvent, EditEventInput } from "./types";

// Regras de validação compartilhadas entre criar e editar. Os dois formulários têm
// uma única data (endDate = startDate no submit), então não há "fim ≥ início" a validar.
const nameRules = { required: "Informe o nome do evento", validate: (v: string) => v.trim().length > 0 || "Informe o nome do evento" };
const startDateRules = { required: "Informe a data do evento", validate: (v: string) => DATE_RE.test(v) || "Data inválida" };

const invalidCls = "aria-[invalid=true]:border-[var(--status-danger)] aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[var(--status-danger)]/20";

type FormValues = { name: string; clientName?: string; startDate: string; city?: string; state?: string; location?: string };

/**
 * Campos do evento — os mesmos em criar e editar. `prefix` separa os ids e os
 * data-testid de cada diálogo ("input-event-*" × "input-edit-event-*").
 */
function EventFields({ prefix, register, errors, placeholders }: {
  prefix: "event" | "edit-event";
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
  placeholders: boolean;
}) {
  const id = (f: string) => `input-${prefix}-${f}`;
  const err = (f: string) => `${id(f)}-error`;
  return (
    <div className="grid grid-cols-6 gap-x-3 gap-y-4">
      <div className="col-span-6">
        <FieldLabel htmlFor={id("name")} required>Nome do evento</FieldLabel>
        <input id={id("name")} data-testid={id("name")} {...register("name", nameRules)} aria-invalid={!!errors.name}
          aria-describedby={errors.name ? err("name") : undefined} placeholder={placeholders ? "Ex.: Feira XYZ 2026" : undefined}
          autoComplete="off" className={cn(inputCls, invalidCls)} />
        <FieldErrorText id={err("name")} message={errors.name?.message} />
      </div>
      <div className="col-span-6 sm:col-span-3">
        <FieldLabel htmlFor={id("client")}>Cliente</FieldLabel>
        <input id={id("client")} data-testid={id("client")} {...register("clientName")} placeholder={placeholders ? "Nome do cliente" : undefined} autoComplete="off" className={inputCls} />
      </div>
      <div className="col-span-6 sm:col-span-3">
        <FieldLabel htmlFor={id("start")} required>Data do evento</FieldLabel>
        <input id={id("start")} data-testid={id("start")} type="date" {...register("startDate", startDateRules)} aria-invalid={!!errors.startDate}
          aria-describedby={errors.startDate ? err("start") : `${id("start")}-hint`} className={cn(inputCls, invalidCls)} />
        {errors.startDate
          ? <FieldErrorText id={err("start")} message={errors.startDate.message} />
          : <p id={`${id("start")}-hint`} className="mt-1.5 text-[12.5px] text-muted-foreground">A avaliação abre sozinha no dia seguinte.</p>}
      </div>
      <div className="col-span-4">
        <FieldLabel htmlFor={id("city")}>Cidade</FieldLabel>
        <input id={id("city")} data-testid={id("city")} {...register("city")} placeholder={placeholders ? "Ex.: São Paulo" : undefined} autoComplete="off" className={inputCls} />
      </div>
      <div className="col-span-2">
        <FieldLabel htmlFor={id("state")}>UF</FieldLabel>
        <input id={id("state")} data-testid={id("state")} {...register("state")} placeholder={placeholders ? "SP" : undefined} maxLength={2} autoComplete="off" className={cn(inputCls, "uppercase")} />
      </div>
      <div className="col-span-6">
        <FieldLabel htmlFor={id("location")}>Local</FieldLabel>
        <input id={id("location")} data-testid={id("location")} {...register("location")} placeholder={placeholders ? "Ex.: Pavilhão de Exposições" : undefined} autoComplete="off" className={inputCls} />
      </div>
    </div>
  );
}

function Footer({ onCancel, pending, submitTestId, label, pendingLabel }: { onCancel: () => void; pending: boolean; submitTestId: string; label: string; pendingLabel: string }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} disabled={pending} className={btnSecondary}>Cancelar</button>
      <button data-testid={submitTestId} type="submit" disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
        {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
        {pending ? pendingLabel : label}
      </button>
    </div>
  );
}

export function CreateEventDialog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventInput>();
  const close = () => { setOpen(false); reset(); };

  const createMutation = useCreateEvent({
    mutation: {
      onSuccess: (ev) => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({ title: "Evento criado", description: ev?.name ? `${ev.name} já está na lista.` : undefined });
        close();
      },
      onError: (e: unknown) => toast({ title: "Não foi possível criar o evento", description: serverErrorMessage(e), variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setOpen(true); else if (!createMutation.isPending) close(); }}>
      <DialogTrigger asChild>
        <button data-testid="button-create-event" type="button" className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 sm:px-4 text-[13px]")}>
          <Plus size={15} aria-hidden /> <span className="sm:hidden">Novo</span><span className="hidden sm:inline">Novo evento</span>
        </button>
      </DialogTrigger>
      <DialogContent className={cn(dialogCls, "max-w-[540px]")}>
        <DialogHeading icon={CalendarPlus} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Novo evento"
          description="Entra no ciclo atual com os critérios ativos do catálogo." />
        <form noValidate onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, name: d.name.trim(), endDate: d.startDate } }))} className="space-y-5">
          <EventFields prefix="event" register={register as unknown as UseFormRegister<FormValues>} errors={errors as FieldErrors<FormValues>} placeholders />
          <Footer onCancel={close} pending={createMutation.isPending} submitTestId="button-submit-event" label="Criar evento" pendingLabel="Criando…" />
        </form>
      </DialogContent>
    </Dialog>
  );
}

type EditEventDialogProps = {
  /** Evento em edição; `null` = diálogo fechado. */
  event: EditingEvent | null;
  onClose: () => void;
};

export function EditEventDialog({ event, onClose }: EditEventDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<EditEventInput>();
  const close = () => { onClose(); reset(); };

  useEffect(() => {
    if (event) {
      reset({
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        clientName: event.clientName ?? "",
        city: event.city ?? "",
        state: event.state ?? "",
        location: event.location ?? "",
      });
    }
  }, [event, reset]);

  const editMutation = useUpdateEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({ title: "Evento atualizado com sucesso." });
        close();
      },
      onError: (e) => toast({ title: "Erro ao salvar", description: serverErrorMessage(e), variant: "destructive" }),
    },
  });

  return (
    <Dialog open={!!event} onOpenChange={(o) => { if (!o && !editMutation.isPending) close(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[540px]")}>
        <DialogHeading icon={Pencil} Title={DialogTitle} Description={DialogDescription} title="Editar evento"
          description={event?.name ?? "Altere os dados do evento."} />
        <form noValidate onSubmit={handleSubmit(d => { if (event) editMutation.mutate({ id: event.id, data: { ...d, name: d.name.trim(), endDate: d.startDate } }); })} className="space-y-5">
          <EventFields prefix="edit-event" register={register as unknown as UseFormRegister<FormValues>} errors={errors as FieldErrors<FormValues>} placeholders={false} />
          {isDirty && <p className="text-[12.5px] text-muted-foreground -mt-1" aria-live="polite">Alterações não salvas.</p>}
          <Footer onCancel={close} pending={editMutation.isPending} submitTestId="button-submit-edit-event" label="Salvar alterações" pendingLabel="Salvando…" />
        </form>
      </DialogContent>
    </Dialog>
  );
}
