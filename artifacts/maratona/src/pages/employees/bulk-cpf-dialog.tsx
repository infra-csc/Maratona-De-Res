// Importação em lote de CPFs ("NOME;CPF" por linha). O texto, as linhas
// reconhecidas e o envio ficam no pai — `onConfirm` precisa enxergar a lista
// ATUAL (ver handleBulkSetCpf).
import type { BulkSetCpfResult } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { DialogHeading, FieldLabel, Notice, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, useReturnFocus } from "./ui";
import { toTitleCase } from "./utils";

export function BulkCpfDialog({
  open,
  onOpenChange,
  text,
  onTextChange,
  validCount,
  loading,
  result,
  onConfirm,
  onClose,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  text: string;
  onTextChange: (v: string) => void;
  /** Quantidade de linhas válidas reconhecidas no texto. */
  validCount: number;
  loading: boolean;
  result: BulkSetCpfResult | null;
  onConfirm: () => void;
  /** Botões Cancelar/Fechar: só fecham (o resultado some ao reabrir, como antes). */
  onClose: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).length;
  const invalid = lines - validCount;
  return (
    <Dialog open={open} onOpenChange={v => { if (!loading) onOpenChange(v); }}>
      <DialogContent className={cn(dialogCls, "max-w-[520px] max-h-[92dvh] overflow-y-auto")} data-testid="bulk-cpf-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={CreditCard} Title={DialogTitle} Description={DialogDescription} title="Importar CPFs"
          description={result ? "Resultado da importação." : "Uma linha por colaborador, no formato NOME;CPF. O nome precisa ser igual ao do cadastro. Rodar de novo não altera o que já está certo."} />
        {!result ? (
          <>
            <div>
              <FieldLabel htmlFor="bulk-cpf-text" hint={lines > 0 ? <span aria-live="polite" className="tabular-nums">{plural(validCount, "linha válida", "linhas válidas")}{invalid > 0 ? ` · ${invalid} com erro` : ""}</span> : undefined}>Lista NOME;CPF</FieldLabel>
              <textarea
                id="bulk-cpf-text"
                value={text}
                onChange={e => onTextChange(e.target.value)}
                rows={8}
                spellCheck={false}
                aria-describedby="bulk-cpf-help"
                placeholder={"MARIA DA SILVA;12345678901\nJOÃO SOUZA;98765432100"}
                className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5 font-mono text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30"
              />
              <p id="bulk-cpf-help" className="mt-1.5 text-[12.5px] text-muted-foreground">Aceita ; , ou tab como separador. CPF com ou sem pontuação (11 dígitos).</p>
            </div>
            <div className={dialogFooterCls}>
              <button type="button" onClick={onClose} disabled={loading} className={btnSecondary}>Cancelar</button>
              <button type="button" onClick={onConfirm} disabled={loading || validCount === 0} aria-busy={loading || undefined} className={btnPrimary} data-testid="button-confirm-bulk-cpf">
                {loading ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <CreditCard size={15} aria-hidden />}
                {loading ? "Importando…" : validCount > 0 ? `Importar ${plural(validCount, "CPF", "CPFs")}` : "Importar"}
              </button>
            </div>
          </>
        ) : (
          <>
            <Notice icon={CheckCircle2} tone={result.updated.length > 0 ? "ok" : "neutral"} testId="bulk-cpf-result">
              <p className="font-semibold text-foreground">{plural(result.updated.length, "colaborador atualizado", "colaboradores atualizados")}</p>
              {result.updated.length > 0 && (
                <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5 pr-1">{result.updated.map(e => <li key={e.id}>{toTitleCase(e.name)}</li>)}</ul>
              )}
            </Notice>
            {result.notFound.length > 0 && (
              <Notice icon={AlertTriangle} tone="warn">
                <p className="font-semibold text-foreground">{result.notFound.length === 1 ? "1 nome não encontrado" : `${result.notFound.length} nomes não encontrados`}</p>
                <ul className="mt-1.5 max-h-28 overflow-y-auto space-y-0.5 pr-1">{result.notFound.map(n => <li key={n}>{n}</li>)}</ul>
                <p className="mt-1.5 text-muted-foreground">Confira a grafia: o nome precisa ser igual ao do cadastro.</p>
              </Notice>
            )}
            <div className={dialogFooterCls}>
              <button type="button" onClick={onClose} className={btnPrimary}>Fechar</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
