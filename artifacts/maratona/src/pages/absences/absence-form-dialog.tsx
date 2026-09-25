import { useState } from "react";
import type { Employee, Event } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { FieldError } from "./form-bits";
import { PenaltyTypeField, EventPickerField, EmployeePickerField } from "./absence-form-fields";
import type { AbsenceFormState } from "./use-absence-form";
import type { PenaltyTypeLookup } from "./use-penalty-types";

/** Diálogo "Registrar/Editar Lançamento". */
export function AbsenceFormDialog({ form, types, employees, events }: {
  form: AbsenceFormState;
  types: PenaltyTypeLookup;
  employees: Employee[] | undefined;
  events: Event[] | undefined;
}) {
  const {
    open, setOpen, editingAbsence, closeDialog, register, handleSubmit, errors, onSubmit, isModalPending,
    watchedDate2, previewPoints, previewKind,
  } = form;
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
            <AlertTriangle size={19} /> {editingAbsence ? "Editar Lançamento" : "Registrar Lançamento"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
          <PenaltyTypeField form={form} types={types} />

          <EventPickerField form={form} events={events} open={eventPickerOpen} onOpenChange={setEventPickerOpen} />

          {!editingAbsence && (
            <EmployeePickerField form={form} employees={employees} open={employeePickerOpen} onOpenChange={setEmployeePickerOpen} />
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="absence-date" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Data <span style={{ color: DANGER_TEXT }}>*</span>
              </Label>
              <Input
                id="absence-date"
                type="date"
                aria-invalid={!!errors.date}
                {...register("date", { validate: v => (typeof v === "string" && v.trim().length > 0) || "Informe a data." })}
                className="h-11 rounded-lg"
              />
              <FieldError message={errors.date?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="absence-quantity" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Quantidade <span style={{ color: DANGER_TEXT }}>*</span>
              </Label>
              <Input
                id="absence-quantity"
                type="number"
                min="1"
                aria-invalid={!!errors.quantity}
                {...register("quantity", { valueAsNumber: true, validate: v => (Number.isInteger(v) && v >= 1) || "Informe uma quantidade inteira a partir de 1." })}
                className="h-11 rounded-lg"
              />
              <FieldError message={errors.quantity?.message} />
            </div>
          </div>

          {/* Segunda data — só disponível ao criar (não ao editar) */}
          {!editingAbsence && (
            <div className="space-y-1.5">
              <Label htmlFor="absence-date2" className="font-bold uppercase text-xs tracking-wider flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                2ª Data
                <span className="normal-case font-medium text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                  opcional — cria 2 registros
                </span>
              </Label>
              <Input
                id="absence-date2"
                type="date"
                aria-invalid={!!errors.date2}
                {...register("date2", {
                  // A 2ª data não pode ser anterior à 1ª (datas ISO "YYYY-MM-DD" comparam como texto).
                  validate: (v, form) => !v?.trim() || !form.date || v >= form.date || "A 2ª data deve ser igual ou posterior à data principal.",
                })}
                className="h-11 rounded-lg"
              />
              <FieldError message={errors.date2?.message} />
            </div>
          )}

          <div className="flex items-center justify-between px-4 py-3 rounded-lg font-black uppercase tracking-tight" style={{
            backgroundColor: previewKind === "merit" ? "rgba(154,176,0,0.15)" : "rgba(229,72,77,0.15)",
            color: previewKind === "merit" ? GOOD_TEXT : DANGER_TEXT,
            border: `1px solid ${previewKind === "merit" ? "rgba(154,176,0,0.3)" : "rgba(229,72,77,0.3)"}`,
          }}>
            <span className="text-xs">{!editingAbsence && watchedDate2?.trim() ? "Total a lançar (×2 datas):" : "Total a lançar:"}</span>
            <span className="text-2xl leading-none">{previewKind === "merit" ? "+" : "−"}{!editingAbsence && watchedDate2?.trim() ? previewPoints * 2 : previewPoints} pts</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="absence-reason" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Motivo / Observação</Label>
            <Input id="absence-reason" {...register("reason")} placeholder="Detalhe do lançamento..." className="h-11 rounded-lg" />
          </div>

          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              onClick={closeDialog}
              className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-70"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              data-testid="button-submit-absence"
              type="submit"
              disabled={isModalPending}
              className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ backgroundColor: "#e84000", color: "white" }}
            >
              {isModalPending ? (editingAbsence ? "Salvando..." : "Registrando...") : (editingAbsence ? "Salvar Alterações" : "Confirmar Lançamento")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
