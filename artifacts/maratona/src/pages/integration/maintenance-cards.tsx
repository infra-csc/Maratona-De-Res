// Correções de dados (só admin). Cada uma é uma linha com o que faz e um
// diálogo único: confirmar (o que acontece) → rodando → resultado, com os
// eventos de ciclo fechado deixados como estavam. Mesmas chamadas de antes;
// a limpeza de duplicadas continua com a prévia (dryRun) antes de apagar.
import { useState, type ReactNode } from "react";
import {
  useDedupeEvaluations, useFixCalibrationCriteria, useMigrateCriteriaCatalog, useFixOrphanedEvaluations,
  type DedupeEvaluationsResult, type FixCalibrationCriteria200, type FixOrphanedEvaluations200, type MigrateCriteriaCatalog200,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eraser, Loader2, Repeat, Wrench, type LucideIcon } from "lucide-react";
import { plural } from "@/lib/utils";
import { serverMessage } from "../criteria/helpers";
import {
  ActionDialog, ClosedCycleSkipped, ConsequenceList, DoneBox, ErrorBox, NumberStrip, ToolRow, btnDanger, btnPrimary, btnSecondary, btnSmall, dialogFooterCls,
  type Trait,
} from "./integration-ui";

const SAFE: Trait = { label: "Pode repetir sem risco", tone: "ok", icon: Repeat, title: "Rodar de novo não muda o que já está certo" };

/** Diálogo confirmar → resultado de uma correção que roda numa chamada só. */
function RunDialog({ open, onClose, pending, icon, title, doneTitle, description, consequences, done, error, onRun, runLabel, testId, children }: {
  open: boolean; onClose: () => void; pending: boolean; icon: LucideIcon; title: string; doneTitle: string; description?: ReactNode;
  consequences: ReactNode[]; done: boolean; error: string | null; onRun: () => void; runLabel: string; testId: string; children?: ReactNode;
}) {
  return (
    <ActionDialog open={open} onOpenChange={o => { if (!o) onClose(); }} busy={pending} icon={done ? CheckCircle2 : icon} tone={done ? "brand" : "neutral"}
      title={done ? doneTitle : title} description={done ? undefined : description} testId={testId} wide={done ? "lg" : "md"}>
      {!done && <ConsequenceList items={consequences} />}
      {done && children}
      <ErrorBox message={error} />
      <div className={dialogFooterCls}>
        {done ? (
          <button type="button" onClick={onClose} className={btnPrimary}>Fechar</button>
        ) : (
          <>
            <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>Cancelar</button>
            <button type="button" data-testid={`${testId}-run`} onClick={onRun} disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
              {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {pending ? "Executando…" : runLabel}
            </button>
          </>
        )}
      </div>
    </ActionDialog>
  );
}

/** Limpar avaliações duplicadas: prévia (dryRun) e, confirmando, a limpeza. */
export function DedupeEvaluationsCard() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<DedupeEvaluationsResult | null>(null);
  const [done, setDone] = useState<DedupeEvaluationsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const open = !!preview || !!done || !!previewError;

  const previewMutation = useDedupeEvaluations({
    mutation: { onSuccess: d => { setPreview(d); setError(null); }, onError: (e: unknown) => setPreviewError(serverMessage(e)) },
  });
  const commitMutation = useDedupeEvaluations({
    mutation: { onSuccess: d => { setDone(d); setPreview(null); qc.invalidateQueries(); }, onError: (e: unknown) => setError(serverMessage(e)) },
  });
  const close = () => { if (!commitMutation.isPending) { setPreview(null); setDone(null); setError(null); setPreviewError(null); } };
  const none = preview?.duplicatesFound === 0;

  return (
    <>
      <ToolRow icon={Eraser} title="Limpar avaliações duplicadas" testId="tool-dedupe"
        traits={[{ label: "Mostra prévia antes", tone: "ok" }, { label: "Recalcula os resultados", tone: "info" }]}
        action={<button type="button" data-testid="button-dedupe-evaluations" onClick={() => { setPreviewError(null); previewMutation.mutate({ data: { dryRun: true } }); }}
          disabled={previewMutation.isPending} aria-busy={previewMutation.isPending || undefined} className={btnSmall}>
          {previewMutation.isPending ? <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" /> : <Eraser size={14} aria-hidden />}
          {previewMutation.isPending ? "Verificando…" : "Verificar duplicadas"}
        </button>}>
        Apaga cópias exatas (mesmo evento, critério, avaliador, nota e comentário) e fica com a primeira gravada. Útil depois de uma importação repetida.
      </ToolRow>

      <ActionDialog open={open} onOpenChange={o => { if (!o) close(); }} busy={commitMutation.isPending} icon={done || none ? CheckCircle2 : Eraser}
        tone={done || none ? "brand" : "neutral"} testId={done ? "dialog-dedupe-result" : "dialog-dedupe-confirm"}
        title={done ? "Duplicadas removidas" : previewError ? "Não foi possível verificar" : none ? "Nenhuma duplicada" : "Avaliações duplicadas encontradas"}
        description={done || previewError ? undefined : none ? "Está tudo limpo. Nada foi apagado." : "Nada foi apagado ainda. Confira os números antes de limpar."}>
        <ErrorBox message={previewError} />
        {preview && !none && (
          <>
            <NumberStrip items={[
              { label: "Cópias a apagar", value: preview.duplicatesFound, tone: "warn", testId: "text-dedupe-found" },
              { label: "Notas afetadas", value: preview.groupsAffected, testId: "text-dedupe-groups" },
              { label: "Eventos", value: preview.eventsAffected, testId: "text-dedupe-events" },
            ]} />
            <ConsequenceList items={[
              <>Avaliações com <span className="font-semibold text-foreground">conteúdo diferente</span> nunca são tocadas.</>,
              <>Depois da limpeza, os resultados dos ciclos afetados são <span className="font-semibold text-foreground">recalculados</span> sozinhos.</>,
              <>Duplicadas em evento de <span className="font-semibold text-foreground">ciclo fechado</span> ficam como estão.</>,
            ]} />
            <ClosedCycleSkipped count={preview.skippedClosedCycle} future />
          </>
        )}
        {none && <p className="text-[13.5px] text-muted-foreground" data-testid="text-dedupe-none">Nenhuma avaliação duplicada encontrada.</p>}
        {done && (
          <>
            <NumberStrip items={[{ label: "Cópias apagadas", value: done.duplicatesRemoved, tone: "ok" }, { label: "Eventos", value: done.eventsAffected }]} />
            <ClosedCycleSkipped count={done.skippedClosedCycle} />
            {done.warnings.length > 0
              ? <DoneBox warn>{done.warnings.slice(0, 5).join(" · ")}</DoneBox>
              : <DoneBox>Resultados recalculados.</DoneBox>}
          </>
        )}
        <ErrorBox message={error} title="Falha ao remover" />
        <div className={dialogFooterCls}>
          {done || none || previewError ? (
            <button type="button" data-testid="button-close-dedupe" onClick={close} className={btnPrimary}>Fechar</button>
          ) : (
            <>
              <button type="button" onClick={close} disabled={commitMutation.isPending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-dedupe" onClick={() => { setError(null); commitMutation.mutate({ data: { dryRun: false } }); }}
                disabled={commitMutation.isPending} aria-busy={commitMutation.isPending || undefined} className={btnDanger}>
                {commitMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Eraser size={15} aria-hidden />}
                {commitMutation.isPending ? "Limpando…" : `Apagar ${plural(preview?.duplicatesFound ?? 0, "cópia", "cópias")}`}
              </button>
            </>
          )}
        </div>
      </ActionDialog>
    </>
  );
}

/** Corrigir calibrações gravadas com ids de critérios antigos. */
export function FixCalibrationCriteriaCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FixCalibrationCriteria200 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = useFixCalibrationCriteria({
    mutation: { onSuccess: d => { setResult(d); qc.invalidateQueries(); }, onError: (e: unknown) => setError(serverMessage(e)) },
  });
  const close = () => { if (!m.isPending) { setOpen(false); setResult(null); setError(null); } };
  const n = result?.totalUpdated ?? 0;
  return (
    <>
      <ToolRow icon={Wrench} title="Corrigir calibrações de critérios antigos" testId="tool-fix-calibrations" traits={[SAFE]}
        action={<button type="button" data-testid="button-fix-calibration-criteria" onClick={() => setOpen(true)} className={btnSmall}><Wrench size={14} aria-hidden /> Corrigir…</button>}>
        Calibrações feitas com os critérios de nome antigo deixam de aparecer; isto as leva para o critério atual equivalente.
      </ToolRow>
      <RunDialog open={open} onClose={close} pending={m.isPending} icon={Wrench} testId="dialog-fix-cal" runLabel="Corrigir calibrações"
        title="Corrigir calibrações?" doneTitle="Calibrações corrigidas" description="Troca o critério antigo pelo atual em todas as calibrações afetadas."
        consequences={[<>A nota calibrada não muda: só o critério a que ela está ligada.</>, <>Eventos de ciclo fechado ficam como estão.</>, <>Pode rodar de novo sem risco.</>]}
        done={!!result} error={error} onRun={() => { setError(null); m.mutate(); }}>
        {result && (
          <>
            <DoneBox>{n === 0 ? "Nenhuma calibração precisou mudar — já estavam certas." : `${plural(n, "calibração atualizada", "calibrações atualizadas")}.`}</DoneBox>
            {(result.results?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full min-w-[420px] border-collapse text-[13px]" aria-label="Calibrações remapeadas">
                  <thead><tr className="bg-secondary/50">{["De (antigo)", "Para (atual)", "Qtd"].map((h, i) => <th key={h} className={`font-condensed px-3 py-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground ${i === 2 ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                  <tbody>{result.results?.map((r, i) => (
                    <tr key={i} className="border-t border-border"><td className="px-3 py-2 text-muted-foreground">{r.from}</td><td className="px-3 py-2 font-semibold text-foreground">{r.to}</td><td className="px-3 py-2 text-right tabular-nums">{r.updated}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            <ClosedCycleSkipped items={result.skippedClosedCycle} />
          </>
        )}
      </RunDialog>
    </>
  );
}

/** Migrar o catálogo de critérios em todos os eventos. */
export function MigrateCriteriaCatalogCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<MigrateCriteriaCatalog200 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = useMigrateCriteriaCatalog({
    mutation: { onSuccess: d => { setResult(d); qc.invalidateQueries(); }, onError: (e: unknown) => setError(serverMessage(e)) },
  });
  const close = () => { if (!m.isPending) { setOpen(false); setResult(null); setError(null); } };
  return (
    <>
      <ToolRow icon={Wrench} title="Migrar o catálogo de critérios" testId="tool-migrate-catalog" traits={[SAFE, { label: "Mexe em todos os eventos", tone: "warn" }]}
        action={<button type="button" data-testid="button-migrate-criteria-catalog" onClick={() => setOpen(true)} className={btnSmall}><Wrench size={14} aria-hidden /> Migrar…</button>}>
        Liga os critérios ativos do catálogo a todos os eventos e leva para eles as avaliações que ainda apontam para critérios antigos — inclusive históricos e confirmados.
      </ToolRow>
      <RunDialog open={open} onClose={close} pending={m.isPending} icon={Wrench} testId="dialog-migrate-catalog" runLabel="Migrar catálogo"
        title="Migrar o catálogo de critérios?" doneTitle="Migração concluída" description="Aplica a migração sem precisar importar planilha."
        consequences={[
          <>Desliga os critérios antigos e liga os novos em <span className="font-semibold text-foreground">todos os eventos</span>.</>,
          <>Avaliações ligadas a critérios antigos passam para o critério novo equivalente.</>,
          <>Eventos de ciclo fechado ficam como estão. Pode rodar de novo sem risco.</>,
        ]}
        done={!!result} error={error} onRun={() => { setError(null); m.mutate(); }}>
        {result && (
          <>
            <NumberStrip items={[
              { label: "Critérios ativados", value: result.catalogActivated, tone: "ok" },
              { label: "Desativados", value: result.catalogDeactivated },
              { label: "Criados", value: result.catalogCreated },
              { label: "Eventos atualizados", value: result.eventCriteriaFixed },
              { label: "Avaliações remapeadas", value: result.evaluationsRemapped ?? 0 },
            ]} />
            <ClosedCycleSkipped items={result.skippedClosedCycle} />
          </>
        )}
      </RunDialog>
    </>
  );
}

/** Reativar critérios desativados que ainda têm avaliações (notas que sumiram do evento). */
export function FixOrphanedEvaluationsCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<FixOrphanedEvaluations200 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const m = useFixOrphanedEvaluations({
    mutation: { onSuccess: d => { setResult(d); qc.invalidateQueries(); }, onError: (e: unknown) => setError(serverMessage(e)) },
  });
  const close = () => { if (!m.isPending) { setOpen(false); setResult(null); setError(null); } };
  return (
    <>
      <ToolRow icon={Wrench} title="Corrigir avaliações órfãs" testId="tool-fix-orphaned" traits={[SAFE]}
        action={<button type="button" data-testid="button-fix-orphaned-evaluations" onClick={() => setOpen(true)} className={btnSmall}><Wrench size={14} aria-hidden /> Corrigir…</button>}>
        Quando o catálogo muda depois de avaliações enviadas, elas ficam presas a critérios inativos e somem do evento. Isto reativa esses critérios no evento.
      </ToolRow>
      <RunDialog open={open} onClose={close} pending={m.isPending} icon={Wrench} testId="dialog-fix-orphaned-result" runLabel="Reativar critérios"
        title="Corrigir avaliações órfãs?" doneTitle="Avaliações órfãs corrigidas" description="Acha critérios inativos com avaliação enviada e os reativa no evento."
        consequences={[<>As notas voltam a aparecer no evento.</>, <>Eventos de ciclo fechado ficam como estão.</>, <>Pode rodar de novo sem risco.</>]}
        done={!!result} error={error} onRun={() => { setError(null); m.mutate(); }}>
        {result && (
          <>
            <DoneBox>{result.fixed === 0 ? "Nenhum critério órfão — tudo já estava certo." : `${plural(result.fixed, "critério reativado", "critérios reativados")} em ${plural(result.eventsAffected, "evento", "eventos")}.`}</DoneBox>
            <ClosedCycleSkipped count={result.skippedClosedCycle} />
          </>
        )}
      </RunDialog>
    </>
  );
}
