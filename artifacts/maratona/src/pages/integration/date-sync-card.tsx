// Atualizar datas dos eventos (só admin), num diálogo em passos: a planilha
// lida → o que muda no banco (prévia do servidor, dryRun) → digitar APLICAR
// → resultado (inclui os eventos de ciclo fechado deixados de fora). Mesmas
// chamadas de antes.
import { useState } from "react";
import { getGetEventsQueryKey, bulkSyncEventDates, type BulkDateSyncResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { ArrowRight, CalendarCheck, Loader2 } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { serverErrorMessage } from "./shared";
import { parseDateSyncRows, type DateSyncEntry } from "./date-sync-parser";
import {
  ActionDialog, ClosedCycleSkipped, ConsequenceList, DoneBox, ErrorBox, FieldLabel, FileButton, NumberStrip, ToolRow,
  btnDanger, btnPrimary, btnSecondary, btnSmall, dialogFooterCls, inputCls,
} from "./integration-ui";

const PREVIEW_LIMIT = 10;
const PHRASE = "APLICAR";
type Done = { updated: number; notFound: number; notFoundIds: string[]; skipped: BulkDateSyncResult["skippedClosedCycle"] };

export function DateSyncCard() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<DateSyncEntry[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [server, setServer] = useState<BulkDateSyncResult | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const open = rows !== null || done !== null;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setServer(null); setDone(null); setError(null); setTyped("");
    file.arrayBuffer().then(buffer => {
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
      setFileName(file.name);
      setRows(parseDateSyncRows(raw));
    }).catch(() => { setFileName(file.name); setRows([]); setError("Não deu para ler o arquivo. Confira se é uma planilha .xlsx."); });
  }
  const payload = () => (rows ?? []).map(r => ({ externalId: r.externalId, name: r.name, date: r.date }));

  async function check() {
    setPending(true); setError(null);
    try {
      setServer(await bulkSyncEventDates({ updates: payload(), dryRun: true }));
    } catch (err: unknown) {
      setError(serverErrorMessage(err, "Não foi possível gerar a prévia."));
    } finally { setPending(false); }
  }
  async function apply() {
    setPending(true); setError(null);
    try {
      const data = await bulkSyncEventDates({ updates: payload(), confirm: PHRASE });
      setDone({ updated: data.updated, notFound: data.notFound, notFoundIds: data.notFoundIds, skipped: data.skippedClosedCycle });
      setRows(null); setServer(null);
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    } catch (err: unknown) {
      setError(serverErrorMessage(err, "Não foi possível atualizar as datas."));
    } finally { setPending(false); }
  }
  const close = () => { if (!pending) { setRows(null); setServer(null); setDone(null); setError(null); setTyped(""); } };

  const step = done ? "done" : server ? "confirm" : "read";
  const nothing = server && server.changeCount === 0;

  return (
    <>
      <ToolRow icon={CalendarCheck} title="Datas dos eventos (.xlsx)" testId="tool-date-sync"
        columns={["SKU", "ID Evento", "Evento", "Data Evento"]} traits={[{ label: "Mostra prévia antes", tone: "ok" }, { label: "Pede APLICAR", tone: "warn" }]}
        action={<FileButton id="input-date-sync" accept=".xlsx" onFile={onFile} label="Escolher planilha" busyLabel="Lendo…" className={btnSmall} testId="button-date-sync" />}>
        Para eventos de um dia só: acha cada evento pelo ID externo e iguala <span className="font-semibold text-foreground">início = fim = data da planilha</span>.
      </ToolRow>

      <ActionDialog open={open} onOpenChange={o => { if (!o) close(); }} busy={pending} wide="lg" icon={CalendarCheck}
        tone={step === "done" ? "brand" : step === "confirm" && !nothing ? "danger" : "neutral"}
        testId={step === "confirm" ? "dialog-bulk-date-sync" : "dialog-date-sync"}
        title={step === "done" ? "Datas atualizadas" : step === "confirm" ? (nothing ? "Nenhuma data para mudar" : `Atualizar a data de ${plural(server?.changeCount ?? 0, "evento", "eventos")}?`) : "Planilha lida"}
        description={step === "read" ? <span className="break-all">{fileName}</span> : step === "confirm" && !nothing ? "Grava direto no banco. Confira a lista antes." : undefined}>

        {step === "read" && rows && (
          <>
            {rows.length > 0 ? (
              <>
                <p className="text-[13.5px] text-foreground">
                  <span className="font-semibold">{plural(rows.length, "evento encontrado", "eventos encontrados")}</span>
                  <span className="text-muted-foreground"> · datas de {rows[0]?.date} a {rows[rows.length - 1]?.date}</span>
                </p>
                <ul className="rounded-xl border border-border divide-y divide-border max-h-52 overflow-y-auto text-[13px]">
                  {rows.slice(0, PREVIEW_LIMIT).map(r => (
                    <li key={r.externalId} className="px-3.5 py-2 flex items-center justify-between gap-3">
                      <span className="truncate text-foreground">{r.name}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{r.date}</span>
                    </li>
                  ))}
                  {rows.length > PREVIEW_LIMIT && <li className="px-3.5 py-2 text-center text-muted-foreground">e mais {rows.length - PREVIEW_LIMIT}</li>}
                </ul>
                <p className="text-[12.5px] text-muted-foreground">Próximo passo: o sistema confere no banco o que muda de fato. Nada é gravado ainda.</p>
              </>
            ) : !error && <p className="text-[13.5px] text-muted-foreground">Nenhuma linha válida na planilha (ID do evento e data).</p>}
          </>
        )}

        {step === "confirm" && server && (
          <>
            <NumberStrip items={[
              { label: "Mudam", value: server.changeCount, tone: server.changeCount > 0 ? "warn" : undefined },
              { label: "Já certos", value: server.unchanged },
              { label: "Não encontrados", value: server.notFound, tone: server.notFound > 0 ? "danger" : undefined },
            ]} />
            {server.changes.length > 0 && (
              <ul className="rounded-xl border border-border divide-y divide-border max-h-60 overflow-y-auto text-[13px]">
                {server.changes.slice(0, PREVIEW_LIMIT).map((c, i) => (
                  <li key={`${c.eventId}-${i}`} className="px-3.5 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                    <span className="min-w-0 truncate text-foreground">{c.eventName}{c.newName && <span className="text-muted-foreground"> → {c.newName}</span>}</span>
                    <span className="shrink-0 inline-flex items-center gap-1.5 font-mono tabular-nums text-muted-foreground">
                      {c.startDateBefore}{c.endDateBefore !== c.startDateBefore ? `…${c.endDateBefore}` : ""}
                      <ArrowRight size={12} aria-hidden /> <span className="font-semibold text-foreground">{c.startDateAfter}</span>
                    </span>
                  </li>
                ))}
                {server.changes.length > PREVIEW_LIMIT && <li className="px-3.5 py-2 text-center text-muted-foreground">e mais {server.changes.length - PREVIEW_LIMIT}</li>}
              </ul>
            )}
            <ClosedCycleSkipped items={server.skippedClosedCycle} future />
            {!nothing && (
              <>
                <ConsequenceList items={[
                  <>Início e fim de cada evento listado passam a ser a data da planilha.</>,
                  server.notFound > 0 ? <>{plural(server.notFound, "linha sem evento correspondente é ignorada", "linhas sem evento correspondente são ignoradas")}.</> : <>Todas as linhas acharam o evento.</>,
                ]} />
                <div>
                  <FieldLabel htmlFor="date-sync-phrase">Digite {PHRASE} para confirmar</FieldLabel>
                  <input id="date-sync-phrase" data-testid="input-date-sync-confirm" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" placeholder={PHRASE}
                    className={cn(inputCls, "font-mono tracking-[0.08em]")} />
                </div>
              </>
            )}
          </>
        )}

        {step === "done" && done && (
          <>
            <NumberStrip items={[{ label: "Eventos atualizados", value: done.updated, tone: "ok" }, { label: "IDs não encontrados", value: done.notFound, tone: done.notFound > 0 ? "warn" : undefined }]} />
            <ClosedCycleSkipped items={done.skipped} />
            {done.notFoundIds.length > 0
              ? <DoneBox warn><span className="font-semibold">IDs não encontrados:</span> <span className="break-all">{done.notFoundIds.join(", ")}</span></DoneBox>
              : <DoneBox>Todas as datas foram gravadas.</DoneBox>}
          </>
        )}

        <ErrorBox message={error} />
        <div className={dialogFooterCls}>
          {step === "done" || nothing ? (
            <button type="button" onClick={close} className={btnPrimary}>Fechar</button>
          ) : (
            <>
              <button type="button" onClick={close} disabled={pending} className={btnSecondary}>Cancelar</button>
              {step === "read" ? (
                <button type="button" data-testid="button-date-sync-check" onClick={check} disabled={pending || !rows?.length} aria-busy={pending || undefined} className={btnPrimary}>
                  {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
                  {pending ? "Conferindo…" : "Conferir no banco"}
                </button>
              ) : (
                <button type="button" data-testid="button-date-sync-apply" onClick={apply} disabled={pending || typed.trim() !== PHRASE} aria-busy={pending || undefined} className={btnDanger}>
                  {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
                  {pending ? "Aplicando…" : "Aplicar"}
                </button>
              )}
            </>
          )}
        </div>
      </ActionDialog>
    </>
  );
}

