import type { BulkSetCpfResult } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle, RefreshCw, CreditCard } from "lucide-react";

/**
 * Importação em lote de CPFs ("NOME;CPF" por linha). O texto, as linhas reconhecidas e o envio
 * ficam no pai — `onConfirm` precisa enxergar a lista ATUAL (ver handleBulkSetCpf).
 */
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard size={18} /> Importar CPFs
          </DialogTitle>
        </DialogHeader>
        {!result ? (
          <div className="space-y-4 py-2">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Cole uma linha por colaborador no formato <code>NOME;CPF</code> (o nome precisa ser exatamente igual ao cadastro).
              A operação é idempotente — rodar de novo não altera dados já corretos.
            </p>
            <textarea
              id="bulk-cpf-text"
              value={text}
              onChange={e => onTextChange(e.target.value)}
              rows={8}
              placeholder={"MARIA DA SILVA;12345678901\nJOÃO SOUZA;98765432100"}
              className="w-full rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2"
              style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            />
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {validCount} linha(s) válida(s) reconhecida(s).
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => onClose()}
                className="h-9 px-4 rounded-lg text-sm font-bold uppercase"
                style={{ border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                disabled={loading || validCount === 0}
                className="h-9 px-4 rounded-lg text-sm font-bold uppercase flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {loading ? <><RefreshCw size={14} className="animate-spin" /> Importando…</> : <><CreditCard size={14} /> Confirmar</>}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
              <CheckCircle2 size={16} /> {result.updated.length} colaboradores atualizados
            </div>
            {result.updated.length > 0 && (
              <div className="rounded-lg border text-xs max-h-36 overflow-y-auto divide-y">
                {result.updated.map(e => (
                  <div key={e.id} className="px-3 py-1.5 text-green-800">{e.name}</div>
                ))}
              </div>
            )}
            {result.notFound.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle size={13} /> {result.notFound.length} não encontrados
                </p>
                <div className="rounded-lg border border-amber-200 text-xs max-h-28 overflow-y-auto divide-y divide-amber-100">
                  {result.notFound.map(n => (
                    <div key={n} className="px-3 py-1.5 text-amber-800">{n}</div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end pt-1">
              <button
                onClick={() => onClose()}
                className="h-9 px-5 rounded-lg text-sm font-bold uppercase"
                style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
