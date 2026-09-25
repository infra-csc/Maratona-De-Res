// Diálogos "Novo Evento" (com o botão que o abre) e "Editar Evento".
// Cada um é dono do próprio formulário e da própria mutação.
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateEvent, useUpdateEvent, getGetEventsQueryKey } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { FieldError, inputStyle, serverErrorMessage } from "./form-bits";
import { DATE_RE } from "./url-filters";
import type { EditingEvent, EditEventInput } from "./types";

// Regras de validação compartilhadas entre criar e editar. Os dois formulários têm
// uma única data (endDate = startDate no submit), então não há "fim ≥ início" a validar.
const nameRules = { required: "Informe o nome do evento", validate: (v: string) => v.trim().length > 0 || "Informe o nome do evento" };
const startDateRules = { required: "Informe a data do evento", validate: (v: string) => DATE_RE.test(v) || "Data inválida" };

const dialogStyle = { backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" };
const labelClass = "font-bold uppercase text-xs tracking-wider";
const labelStyle = { color: "var(--muted-foreground)" };

export function CreateEventDialog() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EventInput>();
  const close = () => { setOpen(false); reset(); };

  const createMutation = useCreateEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({ title: "Evento criado" });
        close();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setOpen(true); else close(); }}>
      <DialogTrigger asChild>
        <button
          data-testid="button-create-event"
          className="h-9 px-4 rounded-lg text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Plus size={13} /> Novo Evento
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg rounded-xl" style={dialogStyle}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Novo Evento</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, name: d.name.trim(), endDate: d.startDate } }))} className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="input-event-name" className={labelClass} style={labelStyle}>Nome do Evento <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input id="input-event-name" data-testid="input-event-name" {...register("name", nameRules)} aria-invalid={!!errors.name} placeholder="Ex: Feira XYZ 2026" className="h-11 rounded-lg" style={inputStyle} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass} style={labelStyle}>Cliente</Label>
            <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome do cliente" className="h-11 rounded-lg" style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="input-event-start" className={labelClass} style={labelStyle}>Data do Evento <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input id="input-event-start" data-testid="input-event-start" type="date" {...register("startDate", startDateRules)} aria-invalid={!!errors.startDate} className="h-11 rounded-lg" style={inputStyle} />
            <FieldError message={errors.startDate?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={labelClass} style={labelStyle}>Cidade</Label>
              <Input data-testid="input-event-city" {...register("city")} placeholder="Ex: São Paulo" className="h-11 rounded-lg" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass} style={labelStyle}>UF</Label>
              <Input data-testid="input-event-state" {...register("state")} placeholder="Ex: SP" maxLength={2} className="h-11 rounded-lg uppercase" style={inputStyle} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass} style={labelStyle}>Local</Label>
            <Input data-testid="input-event-location" {...register("location")} placeholder="Ex: Pavilhão de Exposições" className="h-11 rounded-lg" style={inputStyle} />
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={close} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-submit-event"
              type="submit"
              disabled={createMutation.isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {createMutation.isPending ? "Criando..." : "Criar Evento"}
            </button>
          </div>
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
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditEventInput>();
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
    <Dialog open={!!event} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-lg rounded-xl" style={dialogStyle}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Evento</DialogTitle>
        </DialogHeader>
        <form noValidate onSubmit={handleSubmit(d => { if (event) editMutation.mutate({ id: event.id, data: { ...d, name: d.name.trim(), endDate: d.startDate } }); })} className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="input-edit-event-name" className={labelClass} style={labelStyle}>Nome do Evento <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input id="input-edit-event-name" data-testid="input-edit-event-name" {...register("name", nameRules)} aria-invalid={!!errors.name} className="h-11 rounded-lg" style={inputStyle} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass} style={labelStyle}>Cliente</Label>
            <Input data-testid="input-edit-event-client" {...register("clientName")} className="h-11 rounded-lg" style={inputStyle} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="input-edit-event-start" className={labelClass} style={labelStyle}>Data do Evento <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input id="input-edit-event-start" data-testid="input-edit-event-start" type="date" {...register("startDate", startDateRules)} aria-invalid={!!errors.startDate} className="h-11 rounded-lg" style={inputStyle} />
            <FieldError message={errors.startDate?.message} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className={labelClass} style={labelStyle}>Cidade</Label>
              <Input data-testid="input-edit-event-city" {...register("city")} className="h-11 rounded-lg" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass} style={labelStyle}>UF</Label>
              <Input data-testid="input-edit-event-state" {...register("state")} maxLength={2} className="h-11 rounded-lg uppercase" style={inputStyle} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={labelClass} style={labelStyle}>Local</Label>
            <Input data-testid="input-edit-event-location" {...register("location")} className="h-11 rounded-lg" style={inputStyle} />
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={close} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-submit-edit-event"
              type="submit"
              disabled={editMutation.isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
