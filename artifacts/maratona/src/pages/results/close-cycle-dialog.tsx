import { useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Loader2, LockKeyhole } from "lucide-react";
import { apiErrorMessage, cn, plural } from "@/lib/utils";
import { Bone, DialogHeading, Eyebrow, FieldErrorText, FieldLabel, Notice, btnPrimary, btnSecondary, dialogCls, inputCls } from "./results-ui";
import { fmtBRL } from "./helpers";
import type { CloseInput } from "./use-cycle-actions";

export type CloseSummary = {
  cycleName: string;
  /** Mínimo de eventos que vale no ciclo (fica gravado nele ao fechar). */
  minEvents: number | null;
  /** Eventos do período, confirmados e abertos para avaliação (null enquanto carrega). */
  events: { total: number; confirmed: number; open: number } | null;
  /** Bônus que passa a ser oficial e quantas pessoas recebem. */
  bonusTotal: number;
  withBonus: number;
};

/**
 * Botão "Fechar ciclo" + confirmação. Mostra o que fica oficial antes de
 * confirmar; o fechamento forçado (com eventos ainda abertos) exige
 * justificativa. Erros da API aparecem aqui dentro — inclusive o pedido de
 * forçar quando ainda há evento aberto.
 */
export function CloseCycleDialog({ summary, onClose, closing }: {
  summary: CloseSummary;
  onClose: (input: CloseInput) => Promise<unknown>;
  closing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [forced, setForced] = useState(false);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) { setForced(false); setReason(""); setTouched(false); setError(null); }
  }, [open]);
  useEffect(() => { if (forced) reasonRef.current?.focus(); }, [forced]);

  const reasonMissing = forced && !reason.trim();
  const ev = summary.events;

  async function confirm() {
    if (reasonMissing) { setTouched(true); reasonRef.current?.focus(); return; }
    setError(null);
    try {
      await onClose(forced ? { forced: true, reason: reason.trim() } : {});
      setOpen(false);
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível fechar o ciclo. Tente de novo."));
      // A API pede o fechamento forçado quando ainda há evento aberto: já deixa marcado.
      const data = (e as { data?: { requiresForce?: boolean } | null })?.data;
      if (data?.requiresForce) setForced(true);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={o => { if (!closing) setOpen(o); }}>
      <AlertDialogTrigger asChild>
        <button type="button" data-testid="button-close-quarter" className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
          <LockKeyhole size={15} aria-hidden /> <span className="hidden sm:inline">Fechar ciclo</span><span className="sm:hidden">Fechar</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className={cn(dialogCls, "max-w-[520px] max-h-[90dvh] overflow-y-auto")}>
        <DialogHeading
          icon={LockKeyhole}
          tone="brand"
          Title={AlertDialogTitle}
          Description={AlertDialogDescription}
          title={`Fechar o ${summary.cycleName}?`}
          description="Notas, faixas e bônus ficam congelados e passam a ser oficiais. Depois de fechado, o ciclo não é mais recalculado."
        />

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border">
          <div className="bg-card px-3.5 py-3">
            <dt><Eyebrow as="span" className="block">Eventos confirmados</Eyebrow></dt>
            <dd className="mt-1.5 font-condensed text-[22px] font-black leading-none tabular-nums">
              {ev ? <>{ev.confirmed}<span className="text-[14px] text-muted-foreground"> de {ev.total}</span></> : <Bone className="h-5 w-16" />}
            </dd>
          </div>
          <div className="bg-card px-3.5 py-3">
            <dt><Eyebrow as="span" className="block">Abertos p/ avaliação</Eyebrow></dt>
            <dd className={cn("mt-1.5 font-condensed text-[22px] font-black leading-none tabular-nums", ev && ev.open > 0 && "text-[var(--status-warn-text)]")}>
              {ev ? ev.open : <Bone className="h-5 w-10" />}
            </dd>
          </div>
          <div className="bg-card px-3.5 py-3">
            <dt><Eyebrow as="span" className="block">Bônus que fica oficial</Eyebrow></dt>
            <dd className="mt-1.5 font-condensed text-[22px] font-black leading-none tabular-nums whitespace-nowrap">{fmtBRL(summary.bonusTotal)}</dd>
            <dd className="mt-1 text-[12px] text-muted-foreground">{summary.withBonus > 0 ? `${plural(summary.withBonus, "pessoa", "pessoas")} com bônus` : "Ninguém com bônus ainda"}</dd>
          </div>
          <div className="bg-card px-3.5 py-3">
            <dt><Eyebrow as="span" className="block">Mínimo de eventos</Eyebrow></dt>
            <dd className="mt-1.5 font-condensed text-[22px] font-black leading-none tabular-nums">{summary.minEvents ?? "—"}</dd>
            <dd className="mt-1 text-[12px] text-muted-foreground">Fica gravado no ciclo.</dd>
          </div>
        </dl>

        <div className={cn("rounded-xl border px-3.5 py-3 transition-colors duration-150", forced ? "border-[var(--status-warn)]/60 bg-[var(--status-warn-bg)]" : "border-border")}>
          <div className="flex items-start gap-3">
            <Checkbox
              id="force-close"
              data-testid="checkbox-force-close"
              checked={forced}
              onCheckedChange={c => setForced(c === true)}
              aria-describedby="force-close-hint"
              className="mt-0.5 h-5 w-5"
            />
            <div className="min-w-0">
              <label htmlFor="force-close" className="font-condensed text-[15px] font-bold uppercase tracking-[0.03em] leading-tight cursor-pointer">Fechar mesmo com eventos abertos</label>
              <p id="force-close-hint" className="mt-1 text-[13px] leading-snug text-muted-foreground">
                Fechamento forçado: os eventos ainda abertos ficam fora do resultado. A justificativa fica registrada na auditoria.
              </p>
            </div>
          </div>
          {forced && (
            <div className="mt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 duration-150">
              <FieldLabel htmlFor="force-reason" required>Justificativa</FieldLabel>
              <textarea
                id="force-reason"
                ref={reasonRef}
                data-testid="input-force-reason"
                value={reason}
                onChange={e => { setReason(e.target.value); if (error) setError(null); }}
                onBlur={() => setTouched(true)}
                placeholder="Por que o ciclo precisa ser fechado agora?"
                rows={3}
                aria-invalid={touched && reasonMissing ? true : undefined}
                aria-describedby={touched && reasonMissing ? "force-reason-error" : undefined}
                className={cn(inputCls, "h-auto min-h-[88px] py-2.5 resize-y leading-snug", touched && reasonMissing && "border-[var(--status-danger)]")}
              />
              <FieldErrorText id="force-reason-error" message={touched && reasonMissing ? "Escreva a justificativa para forçar o fechamento." : undefined} />
            </div>
          )}
        </div>

        {error && (
          <div role="alert">
            <Notice icon={AlertTriangle} tone="danger" testId="close-cycle-error">{error}</Notice>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} disabled={closing} className={btnSecondary}>Cancelar</button>
          <button
            type="button"
            data-testid="button-confirm-close-quarter"
            onClick={confirm}
            disabled={closing}
            aria-busy={closing || undefined}
            className={btnPrimary}
          >
            {closing ? <><Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> Fechando…</> : forced ? "Fechar o ciclo (forçado)" : "Fechar o ciclo"}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
