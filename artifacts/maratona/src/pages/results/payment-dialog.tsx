import type { QuarterlyResult } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CONDENSED } from "@/lib/premium-theme";
import { BONUS_STATUS_LABELS, BONUS_STATUS_OPTIONS, fieldStyle, fmtBRL } from "./helpers";

export type PayForm = { bonusStatus: string; paymentMethod: string; paymentNotes: string };

/** Modal "Gestão de Pagamento" de um colaborador. O estado fica na aba Bônus & Pagamentos. */
export function PaymentDialog({
  payTarget,
  payForm,
  setPayForm,
  onClose,
  onSave,
  isSaving,
}: {
  payTarget: QuarterlyResult | null;
  payForm: PayForm;
  setPayForm: React.Dispatch<React.SetStateAction<PayForm>>;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <Dialog open={!!payTarget} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Gestão de Pagamento</DialogTitle>
          <p className="text-sm font-bold uppercase mt-1" style={{ color: "var(--muted-foreground)" }}>{payTarget?.employeeName}</p>
        </DialogHeader>
        <div className="rounded-lg p-4 flex items-center justify-between mb-2 mt-4" style={{ backgroundColor: "var(--primary)" }}>
          <span className="text-xs font-black uppercase tracking-wide" style={{ color: "var(--primary-foreground)" }}>Valor do Bônus</span>
          <span className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>{payTarget ? fmtBRL(payTarget.bonusValue) : "R$ 0,00"}</span>
        </div>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>Status do Bônus</Label>
            <Select value={payForm.bonusStatus} onValueChange={v => setPayForm(f => ({ ...f, bonusStatus: v }))}>
              <SelectTrigger data-testid="select-bonus-status" className="h-11 rounded-lg font-bold" style={fieldStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BONUS_STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s} className="font-medium">{BONUS_STATUS_LABELS[s]?.label ?? s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>Método de Pagamento</Label>
            <Input
              data-testid="input-payment-method"
              value={payForm.paymentMethod}
              onChange={e => setPayForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className="h-11 rounded-lg"
              style={fieldStyle}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wide" style={{ color: "var(--muted-foreground)" }}>Observações (Opcional)</Label>
            <Textarea
              data-testid="input-payment-notes"
              value={payForm.paymentNotes}
              onChange={e => setPayForm(f => ({ ...f, paymentNotes: e.target.value }))}
              placeholder="Detalhes adicionais sobre o pagamento..."
              className="resize-none rounded-lg"
              style={fieldStyle}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => onClose()} className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
            <button
              data-testid="button-save-payment"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
