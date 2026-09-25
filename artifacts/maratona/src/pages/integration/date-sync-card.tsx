import { getGetEventsQueryKey, bulkSyncEventDates, type BulkDateSyncResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle2, CalendarCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/shared";
import { useRef, useState } from "react";
import { CONDENSED } from "@/lib/premium-theme";
import { serverErrorMessage } from "./shared";
import { parseDateSyncRows, type DateSyncEntry } from "./date-sync-parser";

/** Quantas mudanças de data mostrar na prévia antes do "+N mais". */
const DATE_PREVIEW_LIMIT = 10;

/**
 * Card "Atualizar Datas dos Eventos" (só admin): lê a planilha, mostra as
 * linhas lidas, pede ao servidor a prévia do que muda e só grava depois de
 * digitar APLICAR.
 */
export function DateSyncCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dateSyncPreview, setDateSyncPreview] = useState<DateSyncEntry[] | null>(null);
  const [dateSyncPending, setDateSyncPending] = useState(false);
  const [dateSyncResult, setDateSyncResult] = useState<{ updated: number; notFound: number; notFoundIds: string[] } | null>(null);
  const [dateSyncServerPreview, setDateSyncServerPreview] = useState<BulkDateSyncResult | null>(null);
  const dateSyncFileRef = useRef<HTMLInputElement>(null);

  function handleDateSyncFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.arrayBuffer().then(buffer => {
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
      const parsed = parseDateSyncRows(rows);
      setDateSyncPreview(parsed);
      setDateSyncResult(null);
    }).catch(() => toast({ title: "Erro ao ler arquivo", variant: "destructive" }));
    e.target.value = "";
  }

  // Atualização de datas em dois passos: a planilha vira uma prévia calculada
  // pelo SERVIDOR (dryRun: o que muda de fato, o que já está certo, o que não
  // foi achado); só depois de digitar APLICAR o lote é gravado.
  const dateSyncRows = () => (dateSyncPreview ?? []).map(e => ({ externalId: e.externalId, name: e.name, date: e.date }));

  async function handleDateSyncPreview() {
    if (!dateSyncPreview) return;
    setDateSyncPending(true);
    try {
      const data = await bulkSyncEventDates({ updates: dateSyncRows(), dryRun: true });
      if (data.changeCount === 0) {
        setDateSyncServerPreview(null);
        toast({
          title: "Nenhuma data para atualizar",
          description: `As ${data.unchanged} data(s) localizada(s) já estão corretas${data.notFound > 0 ? `; ${data.notFound} evento(s) não encontrado(s) no banco` : ""}.`,
        });
        return;
      }
      setDateSyncServerPreview(data);
    } catch (err: unknown) {
      toast({ title: "Falha ao gerar a prévia", description: serverErrorMessage(err, "Erro desconhecido"), variant: "destructive" });
    } finally {
      setDateSyncPending(false);
    }
  }

  async function handleDateSyncApply() {
    if (!dateSyncPreview) return;
    setDateSyncPending(true);
    try {
      const data = await bulkSyncEventDates({ updates: dateSyncRows(), confirm: "APLICAR" });
      setDateSyncResult({ updated: data.updated, notFound: data.notFound, notFoundIds: data.notFoundIds });
      setDateSyncServerPreview(null);
      setDateSyncPreview(null);
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      toast({ title: `${data.updated} evento(s) atualizado(s)${data.notFound > 0 ? `, ${data.notFound} não encontrado(s)` : ""}` });
    } catch (err: unknown) {
      toast({ title: "Falha ao atualizar datas", description: serverErrorMessage(err, "Erro desconhecido"), variant: "destructive" });
    } finally {
      setDateSyncPending(false);
    }
  }

  return (
    <Card className="bg-card border border-border shadow-none overflow-hidden border-l-4 border-l-[var(--info)]">
      <CardHeader className="bg-[var(--info)]/10 border-b border-[var(--info)]/30 pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-[var(--info)]" style={{ fontFamily: CONDENSED }}>
          <CalendarCheck size={18} /> Atualizar Datas dos Eventos
        </CardTitle>
        <CardDescription className="text-[var(--info)]/80">
          Importa a planilha de eventos (colunas: SKU, ID Evento, Evento, Data Evento) e define a data de cada evento usando o ID externo como chave.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Útil quando os eventos têm data única (não período). O sistema iguala <strong>início = fim = data da planilha</strong> para cada evento localizado pelo ID externo.
        </p>

        <input ref={dateSyncFileRef} type="file" accept=".xlsx" className="hidden" onChange={handleDateSyncFileUpload} />
        <Button
          variant="outline"
          className="w-full bg-card border-dashed border-2 border-[var(--info)]/50 hover:border-[var(--info)] hover:bg-[var(--info)]/10 transition-colors"
          onClick={() => { setDateSyncPreview(null); setDateSyncResult(null); dateSyncFileRef.current?.click(); }}
        >
          <Upload size={16} className="mr-2 text-[var(--info)]" />
          Selecionar planilha .xlsx
        </Button>

        {dateSyncPreview && (
          <div className="space-y-3">
            <div className="bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--info)]">{dateSyncPreview.length} evento(s) encontrado(s) na planilha</span>
              <span className="text-xs text-[var(--info)]">{dateSyncPreview[0]?.date} → {dateSyncPreview[dateSyncPreview.length - 1]?.date}</span>
            </div>
            <div className="max-h-40 overflow-y-auto border rounded-lg divide-y text-xs">
              {dateSyncPreview.slice(0, 10).map(e => (
                <div key={e.externalId} className="px-3 py-1.5 flex items-center justify-between gap-2 bg-card">
                  <span className="text-muted-foreground truncate">{e.name}</span>
                  <span className="font-mono font-bold text-[var(--info)] shrink-0">{e.date}</span>
                </div>
              ))}
              {dateSyncPreview.length > 10 && (
                <div className="px-3 py-1.5 text-muted-foreground text-center">+{dateSyncPreview.length - 10} mais…</div>
              )}
            </div>
            <Button
              className="w-full bg-primary hover:opacity-90 text-primary-foreground"
              disabled={dateSyncPending}
              onClick={handleDateSyncPreview}
            >
              <CalendarCheck size={16} className="mr-2" />
              {dateSyncPending ? "Conferindo…" : `Conferir o que muda no banco (${dateSyncPreview.length} linhas)`}
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={!!dateSyncServerPreview}
          onOpenChange={(open) => { if (!open) setDateSyncServerPreview(null); }}
          title={`Atualizar datas de ${dateSyncServerPreview?.changeCount ?? 0} evento(s)`}
          description={dateSyncServerPreview
            ? `Grava direto em produção: início = fim = data da planilha${dateSyncServerPreview.unchanged > 0 ? `; ${dateSyncServerPreview.unchanged} evento(s) já estão corretos e ficam como estão` : ""}${dateSyncServerPreview.notFound > 0 ? `; ${dateSyncServerPreview.notFound} linha(s) sem evento correspondente serão ignoradas` : ""}.`
            : undefined}
          confirmLabel="Aplicar"
          confirmText="APLICAR"
          destructive
          isPending={dateSyncPending}
          onConfirm={handleDateSyncApply}
          data-testid="dialog-bulk-date-sync"
        >
          {dateSyncServerPreview && (
            <ul className="max-h-60 overflow-y-auto rounded-lg text-xs divide-y border border-border">
              {dateSyncServerPreview.changes.slice(0, DATE_PREVIEW_LIMIT).map((c, i) => (
                <li key={`${c.eventId}-${i}`} className="px-3 py-1.5 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {c.eventName}
                    {c.newName && <span className="text-muted-foreground"> → {c.newName}</span>}
                  </span>
                  <span className="font-mono shrink-0 text-muted-foreground">
                    {c.startDateBefore}{c.endDateBefore !== c.startDateBefore ? `…${c.endDateBefore}` : ""} → <span className="font-bold text-foreground">{c.startDateAfter}</span>
                  </span>
                </li>
              ))}
              {dateSyncServerPreview.changes.length > DATE_PREVIEW_LIMIT && (
                <li className="px-3 py-1.5 text-muted-foreground text-center">+{dateSyncServerPreview.changes.length - DATE_PREVIEW_LIMIT} mais…</li>
              )}
            </ul>
          )}
        </ConfirmDialog>

        {dateSyncResult && (
          <div className={`rounded-lg px-4 py-3 border text-sm font-medium flex items-start gap-2 ${dateSyncResult.notFound > 0 ? "bg-[var(--amber)]/10 border-[var(--amber)]/30 text-[var(--amber)]" : "bg-accent/10 border-accent/40 text-accent-text"}`}>
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            <div>
              <p>{dateSyncResult.updated} evento(s) atualizado(s){dateSyncResult.notFound > 0 ? `, ${dateSyncResult.notFound} ID(s) não encontrado(s) no banco` : " com sucesso."}.</p>
              {dateSyncResult.notFoundIds.length > 0 && (
                <p className="text-xs mt-1 opacity-70">IDs não encontrados: {dateSyncResult.notFoundIds.join(", ")}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
