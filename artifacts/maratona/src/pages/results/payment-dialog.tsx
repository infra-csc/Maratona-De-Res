import type { QuarterlyResult } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Info, Loader2, Wallet } from "lucide-react";
import { cn, fmtDate } from "@/lib/utils";
import { BONUS_STATUS_LABELS, BONUS_STATUS_OPTIONS, fmtBRL } from "./helpers";
import { FaixaBadge } from "./badges";
import { EligibilityChip } from "./payments-list";
import { DialogHeading, Eyebrow, FieldLabel, Notice, btnPrimary, btnSecondary, dialogCls, inputCls } from "./results-ui";

export type PayForm = { bonusStatus: string; paymentMethod: string; paymentNotes: string };

/** Uma frase por situação, para a escolha não depender de adivinhar o nome. */
const STATUS_HINT: Record<string, string> = {
  projected: "Ainda pode mudar",
  approved: "Valor aprovado",
  scheduled: "Data marcada",
  paid: "Já foi pago",
  blocked: "Não pagar por ora",
  not_eligible: "Fora do bônus",
};

/** Diálogo "Pagamento do bônus" de um colaborador. O estado fica na aba Bônus & Pagamentos. */
export function PaymentDialog({
  payTarget,
  payForm,
  setPayForm,
  onClose,
  onSave,
  isSaving,
  cycleClosed = false,
}: {
  payTarget: QuarterlyResult | null;
  payForm: PayForm;
  setPayForm: React.Dispatch<React.SetStateAction<PayForm>>;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
  cycleClosed?: boolean;
}) {
  const wasPaid = payTarget?.bonusStatus === "paid";
  const extra = payTarget?.extraBonusValue ?? 0;
  return (
    <Dialog open={!!payTarget} onOpenChange={o => { if (!o && !isSaving) onClose(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[520px] max-h-[92dvh] overflow-y-auto")}>
        <DialogHeading
          icon={Wallet}
          Title={DialogTitle}
          Description={DialogDescription}
          title="Pagamento do bônus"
          description={payTarget?.employeeName}
        />

        {payTarget && (
          <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3.5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <Eyebrow as="span" className="block">{cycleClosed ? "Bônus do ciclo" : "Bônus projetado"}</Eyebrow>
                <span className="mt-1.5 block font-condensed text-[30px] font-black leading-none tabular-nums whitespace-nowrap" data-testid="payment-bonus-value">{fmtBRL(payTarget.bonusValue)}</span>
                <span className="mt-1 block text-[12.5px] text-muted-foreground">{extra > 0 ? `Inclui ${fmtBRL(extra)} de eventos extras` : "Sem parcela de eventos extras"}</span>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <FaixaBadge name={payTarget.platoon} minScore={payTarget.platoonMinScore} maxScore={payTarget.platoonMaxScore} color={payTarget.platoonColor} compact />
                <EligibilityChip r={payTarget} />
              </div>
            </div>
            {payTarget.paidAt && (
              <p className="mt-2.5 pt-2.5 border-t border-border text-[12.5px] text-muted-foreground">
                Pago em <b className="font-semibold text-foreground">{fmtDate(payTarget.paidAt.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" })}</b>
                {payTarget.paymentMethod ? ` · ${payTarget.paymentMethod}` : ""}
              </p>
            )}
          </div>
        )}

        <fieldset data-testid="select-bonus-status" className="min-w-0">
          <legend className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Situação do bônus</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {BONUS_STATUS_OPTIONS.map(s => {
              const on = payForm.bonusStatus === s;
              return (
                <label key={s} data-testid={`option-bonus-status-${s}`}
                  className={cn(
                    "relative flex flex-col justify-center min-h-[52px] rounded-lg border px-3 py-2 cursor-pointer select-none",
                    "transition-[background-color,border-color,box-shadow] duration-150",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-card",
                    on ? "border-foreground bg-card shadow-[inset_0_0_0_1px_var(--foreground)]" : "border-border bg-card hover:bg-secondary/60",
                  )}>
                  <input type="radio" name="bonus-status" value={s} checked={on} onChange={() => setPayForm(f => ({ ...f, bonusStatus: s }))} className="sr-only" />
                  <span className="font-condensed text-[14px] font-bold uppercase tracking-[0.04em] leading-tight">{BONUS_STATUS_LABELS[s]?.label ?? s}</span>
                  <span className="text-[12px] leading-tight text-muted-foreground mt-0.5">{STATUS_HINT[s]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {payForm.bonusStatus === "paid" && !wasPaid && (
          <Notice icon={Info} tone="info">Ao salvar, a data de hoje fica registrada como data do pagamento.</Notice>
        )}
        {payForm.bonusStatus !== "paid" && wasPaid && (
          <Notice icon={Info} tone="warn">Ao salvar com outra situação, a data do pagamento é apagada.</Notice>
        )}

        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="payment-method">Forma de pagamento</FieldLabel>
            <input
              id="payment-method"
              data-testid="input-payment-method"
              value={payForm.paymentMethod}
              onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <FieldLabel htmlFor="payment-notes" hint="Opcional">Observações</FieldLabel>
            <textarea
              id="payment-notes"
              data-testid="input-payment-notes"
              value={payForm.paymentNotes}
              onChange={e => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
              placeholder="Ex.: número do lote no Caju, combinado com o RH…"
              rows={3}
              className={cn(inputCls, "h-auto min-h-[84px] py-2.5 resize-y leading-snug")}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={isSaving} className={btnSecondary}>Cancelar</button>
          <button type="button" data-testid="button-save-payment" onClick={onSave} disabled={isSaving} aria-busy={isSaving || undefined} className={btnPrimary}>
            {isSaving ? <><Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> Salvando…</> : "Salvar pagamento"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
