// Recalcular o ciclo (admin e RH): refaz ranking, elegibilidade e bônus do
// ciclo atual. Agora com confirmação do que acontece e o resultado no mesmo
// diálogo. Mesma chamada de antes.
import { useState } from "react";
import { recomputeQuarter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { serverErrorMessage } from "./shared";
import { ActionDialog, ConsequenceList, DoneBox, ErrorBox, MessageList, NumberStrip, ToolRow, btnPrimary, btnSecondary, btnSmall, dialogFooterCls } from "./integration-ui";

export function RecomputeCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ totalProcessed: number; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true); setError(null);
    try {
      const data = await recomputeQuarter();
      setResult({ totalProcessed: data.totalProcessed, warnings: data.warnings ?? [] });
      await qc.resetQueries();
    } catch (err: unknown) {
      setError(serverErrorMessage(err, "Erro desconhecido"));
    } finally { setPending(false); }
  }
  const close = () => { if (!pending) { setOpen(false); setResult(null); setError(null); } };

  return (
    <>
      <ToolRow icon={RefreshCw} title="Recalcular o ciclo atual" testId="tool-recompute" traits={[{ label: "Pode repetir sem risco", tone: "ok" }]}
        action={<button type="button" data-testid="button-recompute" onClick={() => setOpen(true)} className={btnSmall}><RefreshCw size={14} aria-hidden /> Recalcular…</button>}>
        Refaz ranking, elegibilidade e bônus do ciclo atual. Use depois de mudar faixas, critérios ou tirar participantes Sup Ceno.
      </ToolRow>
      <ActionDialog open={open} onOpenChange={o => { if (!o) close(); }} busy={pending} icon={result ? CheckCircle2 : RefreshCw} tone={result ? "brand" : "neutral"}
        testId="dialog-recompute" title={result ? "Ciclo recalculado" : "Recalcular o ciclo atual?"}
        description={result ? undefined : "Leva alguns segundos. As telas abertas recarregam no fim."}>
        {!result && (
          <ConsequenceList items={[
            <>Refaz a nota final, a faixa, a elegibilidade e o bônus de <span className="font-semibold text-foreground">cada colaborador do ciclo atual</span>.</>,
            <>Usa as regras e as faixas de agora. Pode rodar de novo sem risco.</>,
          ]} />
        )}
        {result && (
          <>
            <NumberStrip items={[{ label: "Colaboradores processados", value: result.totalProcessed, tone: "ok" }, { label: "Avisos", value: result.warnings.length, tone: result.warnings.length ? "warn" : undefined }]} />
            {result.warnings.length > 0 ? <MessageList tone="warn" title="Avisos" items={result.warnings} /> : <DoneBox>Resultados atualizados em todas as telas.</DoneBox>}
          </>
        )}
        <ErrorBox message={error} title="Falha ao recalcular" />
        <div className={dialogFooterCls}>
          {result ? <button type="button" onClick={close} className={btnPrimary}>Fechar</button> : (
            <>
              <button type="button" onClick={close} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-recompute" onClick={() => { void run(); }} disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <RefreshCw size={15} aria-hidden />}
                {pending ? "Recalculando…" : "Recalcular"}
              </button>
            </>
          )}
        </div>
      </ActionDialog>
    </>
  );
}

