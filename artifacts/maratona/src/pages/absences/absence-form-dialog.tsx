// Diálogo "Registrar/Editar lançamento": quem, o quê, onde, quando — e,
// antes de confirmar, quanto isso mexe na nota do colaborador.
import { useEffect, useState } from "react";
import type { Employee, Event } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CalendarPlus, Loader2, Minus, Pencil, Plus, X } from "lucide-react";
import { cn, fmtDate, fmtNum, fmtScore, plural, todayBR } from "@/lib/utils";
import {
  Avatar, DialogHeading, FOCUS_RING, FieldErrorText, FieldLabel, Notice, btnGhost, btnPrimary, btnSecondary,
  dialogCls, inputCls, invalidCls, kindText, useReturnFocus,
} from "./absences-ui";
import { scoreEffect, signOf } from "./helpers";
import { PenaltyTypeField, EventPickerField, EmployeePickerField } from "./absence-form-fields";
import type { AbsenceFormState } from "./use-absence-form";
import type { PenaltyTypeLookup } from "./use-penalty-types";
import type { EmployeeScore } from "./types";

const chipBtn = cn("font-condensed h-8 px-2.5 rounded-md border border-border bg-card text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-secondary aria-pressed:border-foreground/40 aria-pressed:bg-secondary aria-pressed:text-foreground", FOCUS_RING);
const stepBtn = cn("w-11 shrink-0 inline-flex items-center justify-center text-muted-foreground transition-colors duration-150 enabled:hover:text-foreground enabled:hover:bg-secondary disabled:opacity-40", FOCUS_RING, "focus-visible:ring-offset-0 focus-visible:ring-inset");

/** "Total a lançar" + "Na nota de Fulano: −6,3". */
function ImpactPreview({ form, score }: { form: AbsenceFormState; score: EmployeeScore | undefined }) {
  const { previewKind, previewPoints, editingAbsence, watchedDate2, selectedEmployee } = form;
  const times = !editingAbsence && watchedDate2?.trim() ? 2 : 1;
  const pts = previewPoints * times;
  const sign = signOf(previewKind);
  const effect = scoreEffect(pts, score?.eventsCount);
  const name = selectedEmployee?.name ?? editingAbsence?.employeeName ?? null;
  const first = name?.split(" ")[0];
  const merit = previewKind === "merit";
  return (
    <div data-testid="absence-impact" aria-live="polite"
      className={cn("rounded-xl border px-4 py-3.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-center transition-colors duration-200",
        merit ? "border-[var(--status-ok)]/35 bg-[var(--status-ok-bg)]" : "border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)]")}>
      <div className="pr-4 border-r border-foreground/10">
        <span className="font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{times === 2 ? "Total (2 datas)" : editingAbsence ? "Total do lançamento" : "Total a lançar"}</span>
        <span className={cn("font-condensed block mt-1 text-[28px] font-black leading-none tabular-nums tracking-[-0.02em] whitespace-nowrap", kindText(previewKind))}>{sign}{pts} pts</span>
      </div>
      <div className="min-w-0 text-[13px] leading-snug">
        {!name ? (
          <span className="text-muted-foreground">Escolha o colaborador para ver quanto isso mexe na nota.</span>
        ) : effect == null ? (
          <span className="text-muted-foreground"><span className="font-semibold text-foreground">{first}</span> ainda não tem evento com nota no ciclo: o efeito aparece quando tiver.</span>
        ) : (
          <>
            <span className="block text-foreground">Na nota de <span className="font-semibold">{first}</span>: <span className={cn("font-condensed text-[18px] font-black tabular-nums", kindText(previewKind))}>{sign}{fmtNum(effect, 1)}</span></span>
            <span className="block mt-0.5 text-muted-foreground tabular-nums">{pts} pts ÷ {plural(score!.eventsCount, "evento", "eventos")} · nota hoje {fmtScore(score!.finalResult)}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function AbsenceFormDialog({ form, types, employees, events, scores }: {
  form: AbsenceFormState;
  types: PenaltyTypeLookup;
  employees: Employee[] | undefined;
  events: Event[] | undefined;
  scores: Map<number, EmployeeScore>;
}) {
  const {
    open, setOpen, editingAbsence, closeDialog, register, handleSubmit, setValue, errors, onSubmit, isModalPending,
    watchedDate, watchedDate2, selectedEvent, selectedEmployee, qty, submitError,
  } = form;
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [secondDate, setSecondDate] = useState(false);
  const onCloseAutoFocus = useReturnFocus(open);
  const editing = !!editingAbsence;
  const employeeId = editingAbsence?.employeeId ?? selectedEmployee?.id;
  const score = employeeId != null ? scores.get(employeeId) : undefined;
  const today = todayBR();
  const showSecond = !editing && (secondDate || !!watchedDate2);
  // Cada abertura começa sem a 2ª data (inclusive depois de um envio com sucesso).
  useEffect(() => { if (open) setSecondDate(false); }, [open]);

  function close() {
    if (isModalPending) return;
    setSecondDate(false);
    closeDialog();
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) close(); else setOpen(true); }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px] max-h-[92dvh] p-0 sm:p-0 gap-0 flex flex-col overflow-hidden")} data-testid="absence-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (isModalPending) e.preventDefault(); }}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1" noValidate>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
        <DialogHeading icon={editing ? Pencil : Plus} tone={editing ? "neutral" : "brand"} Title={DialogTitle} Description={DialogDescription}
          title={editing ? "Editar lançamento" : "Registrar lançamento"}
          description={editing
            ? "O colaborador não muda. Para lançar para outra pessoa, exclua este e registre de novo."
            : "Penalidade desconta e mérito soma. Na nota, os pontos são divididos pelos eventos do colaborador no ciclo."} />

        <div className="space-y-4">
          {editing ? (
            <div className="flex items-center gap-3 rounded-xl border border-border px-3.5 py-2.5" data-testid="absence-dialog-employee">
              <Avatar name={editingAbsence.employeeName ?? "?"} className="w-9 h-9 text-[13px]" />
              <span className="min-w-0">
                <span className="block font-semibold text-foreground truncate">{editingAbsence.employeeName}</span>
                <span className="block text-[12.5px] text-muted-foreground tabular-nums">
                  {score ? `${plural(score.eventsCount, "evento", "eventos")} · nota hoje ${fmtScore(score.finalResult)}` : "sem nota no ciclo ainda"}
                </span>
              </span>
            </div>
          ) : (
            <EmployeePickerField form={form} employees={employees} scores={scores} open={employeePickerOpen} onOpenChange={setEmployeePickerOpen} />
          )}

          <PenaltyTypeField form={form} types={types} />
          <EventPickerField form={form} events={events} open={eventPickerOpen} onOpenChange={setEventPickerOpen} />

          <div className="grid gap-4 sm:grid-cols-[1fr_168px]">
            <div>
              <FieldLabel htmlFor="absence-date" required>Data da ocorrência</FieldLabel>
              <input id="absence-date" type="date" aria-invalid={!!errors.date} aria-describedby={errors.date ? "absence-date-error" : undefined}
                {...register("date", { validate: v => (typeof v === "string" && v.trim().length > 0) || "Informe a data." })}
                className={cn(inputCls, "tabular-nums", errors.date && invalidCls)} />
              <FieldErrorText id="absence-date-error" message={errors.date?.message} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" className={chipBtn} aria-pressed={watchedDate === today} onClick={() => setValue("date", today, { shouldValidate: true })}>Hoje</button>
                {selectedEvent?.endDate && (
                  <button type="button" className={chipBtn} aria-pressed={watchedDate === selectedEvent.endDate}
                    onClick={() => setValue("date", selectedEvent.endDate, { shouldValidate: true })}>
                    Fim do evento · {fmtDate(selectedEvent.endDate)}
                  </button>
                )}
              </div>
            </div>
            <div>
              <FieldLabel htmlFor="absence-quantity" required>Quantidade</FieldLabel>
              <div className={cn("flex h-11 rounded-lg border border-border bg-card overflow-hidden transition-[border-color,box-shadow] duration-150 focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-ring/30", errors.quantity && invalidCls)}>
                <button type="button" className={cn(stepBtn, "border-r border-border")} aria-label="Diminuir a quantidade" disabled={qty <= 1}
                  onClick={() => setValue("quantity", Math.max(1, qty - 1), { shouldValidate: true })}><Minus size={15} aria-hidden /></button>
                <input id="absence-quantity" type="number" inputMode="numeric" min="1" step="1" aria-invalid={!!errors.quantity}
                  aria-describedby={errors.quantity ? "absence-quantity-error" : undefined}
                  {...register("quantity", { valueAsNumber: true, validate: v => (Number.isInteger(v) && v >= 1) || "Use um número inteiro a partir de 1." })}
                  className="min-w-0 flex-1 bg-transparent text-center text-[15px] font-semibold tabular-nums text-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                <button type="button" className={cn(stepBtn, "border-l border-border")} aria-label="Aumentar a quantidade"
                  onClick={() => setValue("quantity", qty + 1, { shouldValidate: true })}><Plus size={15} aria-hidden /></button>
              </div>
              <FieldErrorText id="absence-quantity-error" message={errors.quantity?.message} />
            </div>
          </div>

          {/* Segunda data — só ao criar: cria um segundo lançamento igual. */}
          {!editing && (showSecond ? (
            <div className="rounded-xl border border-dashed border-border px-3.5 py-3">
              <FieldLabel htmlFor="absence-date2" hint="cria um 2º lançamento igual">2ª data</FieldLabel>
              <div className="flex gap-2">
                <input id="absence-date2" type="date" aria-invalid={!!errors.date2} aria-describedby={errors.date2 ? "absence-date2-error" : undefined}
                  min={watchedDate || undefined}
                  {...register("date2", {
                    // A 2ª data não pode ser anterior à 1ª (datas ISO "YYYY-MM-DD" comparam como texto).
                    validate: (v, f) => !v?.trim() || !f.date || v >= f.date || "A 2ª data deve ser igual ou posterior à data principal.",
                  })}
                  className={cn(inputCls, "tabular-nums", errors.date2 && invalidCls)} />
                <button type="button" onClick={() => { setValue("date2", "", { shouldValidate: true }); setSecondDate(false); }}
                  aria-label="Tirar a 2ª data" className={cn(btnGhost, "min-h-11 md:min-h-11 w-11 px-0 shrink-0")}><X size={16} aria-hidden /></button>
              </div>
              <FieldErrorText id="absence-date2-error" message={errors.date2?.message} />
            </div>
          ) : (
            <button type="button" onClick={() => setSecondDate(true)} data-testid="button-add-second-date" className={cn(btnGhost, "-mt-1 -ml-2 px-2")}>
              <CalendarPlus size={15} aria-hidden /> A mesma ocorrência em outra data
            </button>
          ))}

          <div>
            <FieldLabel htmlFor="absence-reason" hint="opcional">Observação</FieldLabel>
            <textarea id="absence-reason" rows={2} {...register("reason")} placeholder="Detalhe do lançamento..."
              className={cn(inputCls, "h-auto min-h-[72px] py-2.5 leading-snug resize-y")} />
          </div>

          </div>
        </div>
          {/* Pé fixo fora da rolagem: o efeito e o envio ficam sempre à vista. */}
          <div className="shrink-0 px-5 sm:px-6 pt-3.5 pb-5 bg-card border-t border-border space-y-3 shadow-[0_-10px_20px_-16px_rgba(0,0,0,0.35)]">
          <ImpactPreview form={form} score={score} />

          {submitError && (
            <div role="alert" data-testid="absence-submit-error">
              <Notice icon={AlertTriangle} tone="danger">
                {submitError.message.toLowerCase().startsWith(submitError.title.toLowerCase())
                  ? submitError.message
                  : <><span className="font-semibold">{submitError.title}.</span> {submitError.message}</>}
              </Notice>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={isModalPending} className={btnSecondary}>Cancelar</button>
            <button data-testid="button-submit-absence" type="submit" disabled={isModalPending} aria-busy={isModalPending || undefined} className={cn(btnPrimary, "flex-1 sm:flex-none")}>
              {isModalPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : editing ? <Pencil size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
              {isModalPending ? (editing ? "Salvando…" : "Registrando…") : (editing ? "Salvar alterações" : showSecond && watchedDate2 ? "Registrar 2 lançamentos" : "Registrar lançamento")}
            </button>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


