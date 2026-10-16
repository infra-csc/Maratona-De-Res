// Prévia (dryRun) da pesquisa de avaliadores, com o vínculo obrigatório de
// cada evento da planilha a um evento já cadastrado (ou "ignorar"); depois
// de confirmar, o resultado aparece no mesmo diálogo.
import type { SurveyImportResult, Event as ApiEvent } from "@workspace/api-client-react";
import { CheckCircle2, ClipboardList, Link2, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, plural } from "@/lib/utils";
import { ActionDialog, Chip, DoneBox, ErrorBox, Eyebrow, MessageList, NumberStrip, btnPrimary, btnSecondary, dialogFooterCls } from "./integration-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  preview: SurveyImportResult | null;
  committed: SurveyImportResult | null;
  commitError: string | null;
  /** groupKey do evento da planilha → id do evento existente (-1 = ignorar as respostas). */
  linkOverrides: Record<string, number>;
  setLinkOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  /** Todos os eventos cadastrados, já ordenados por nome. */
  eventLinkOptions: ApiEvent[];
  allResolved: boolean;
  isCommitting: boolean;
  onConfirm: () => void;
};

export function SurveyPreviewDialog({ open, onOpenChange, fileName, preview: p, committed, commitError, linkOverrides, setLinkOverrides, eventLinkOptions, allResolved, isCommitting, onConfirm }: Props) {
  const resolved = p ? p.groups.filter(g => !!linkOverrides[g.groupKey]).length : 0;
  const blocked = !p?.success || (p?.errors.length ?? 0) > 0 || !allResolved;
  const created = committed?.createdAvaliadores?.length ?? 0;
  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} busy={isCommitting} wide="xl" testId="dialog-survey-preview"
      icon={committed ? CheckCircle2 : ClipboardList} tone={committed ? "brand" : "neutral"}
      title={committed ? "Pesquisa importada" : "Prévia da pesquisa de avaliadores"}
      description={committed ? fileName : <>Nada foi gravado ainda. Ligue <span className="font-semibold text-foreground">cada evento</span> da planilha a um evento já cadastrado. <span className="font-semibold text-foreground break-all">{fileName}</span></>}>
      {committed ? (
        <>
          <NumberStrip items={[
            { label: "Avaliadores criados", value: committed.usersCreated ?? 0, tone: (committed.usersCreated ?? 0) > 0 ? "info" : undefined },
            { label: "Notas gravadas", value: committed.evaluationsCreated ?? 0, tone: "ok" },
            { label: "Notas já no app", value: committed.evaluationsSkipped ?? 0 },
            { label: "Conformidades", value: committed.conformitiesUpserted ?? 0 },
            { label: "Eventos atualizados", value: committed.eventsUpdated ?? 0 },
          ]} />
          {(committed.warnings?.length ?? 0) > 0
            ? <MessageList tone="warn" title="Avisos" items={committed.warnings} />
            : <DoneBox>Respostas gravadas nos eventos escolhidos.</DoneBox>}
          {created > 0 && <DoneBox warn>Ao fechar, aparecem as senhas provisórias de {plural(created, "avaliador criado", "avaliadores criados")} — só uma vez.</DoneBox>}
        </>
      ) : p && (
        <div className="space-y-4">
          <NumberStrip items={[
            { label: "Linhas", value: p.totalRows, testId: "text-survey-total-rows" },
            { label: "Eventos na planilha", value: p.groups.length },
            { label: "Avaliadores novos", value: p.avaliadoresToCreate.length, tone: p.avaliadoresToCreate.length > 0 ? "info" : undefined },
          ]} />
          {((p.duplicateRowsIgnored ?? 0) > 0 || (p.evaluationsAlreadyInApp ?? 0) > 0) && (
            <p className="text-[12.5px] text-muted-foreground">
              {(p.duplicateRowsIgnored ?? 0) > 0 && <>{plural(p.duplicateRowsIgnored ?? 0, "resposta repetida será ignorada", "respostas repetidas serão ignoradas")} (vale a mais recente). </>}
              {(p.evaluationsAlreadyInApp ?? 0) > 0 && <>{plural(p.evaluationsAlreadyInApp ?? 0, "nota já existe no app e será pulada", "notas já existem no app e serão puladas")}.</>}
            </p>
          )}
          <MessageList tone="danger" title="Erros — bloqueiam a importação" items={p.errors} />
          {(p.catalogChanges.toDeactivate.length > 0 || p.catalogChanges.toCreateOrActivate.length > 0) && (
            <div className="rounded-xl border border-border px-3.5 py-3 text-[13px]">
              <p className="font-semibold text-foreground">Mudanças no catálogo de critérios</p>
              {p.catalogChanges.toCreateOrActivate.length > 0 && <p className="mt-1 text-muted-foreground"><span className="font-semibold text-foreground">Ativar/criar:</span> {p.catalogChanges.toCreateOrActivate.join(", ")}</p>}
              {p.catalogChanges.toDeactivate.length > 0 && <p className="mt-0.5 text-muted-foreground"><span className="font-semibold text-foreground">Desativar:</span> {p.catalogChanges.toDeactivate.join(", ")}</p>}
            </div>
          )}
          <MessageList tone="info" title={p.avaliadoresToCreate.length === 1 ? "1 avaliador novo será cadastrado" : `${p.avaliadoresToCreate.length} avaliadores novos serão cadastrados`}
            items={p.avaliadoresToCreate} count={false} note="Cada um ganha um usuário com senha provisória, mostrada uma única vez depois da importação." />
          <MessageList tone="warn" title="Avisos" items={p.warnings} />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Eyebrow as="p">Ligar cada evento da planilha</Eyebrow>
              <Chip tone={allResolved ? "ok" : "warn"} icon={Link2} className="h-5 text-[11px]" data-testid="survey-links-progress">{resolved} de {p.groups.length} definidos</Chip>
            </div>
            <ul className="rounded-xl border border-border divide-y divide-border">
              {p.groups.map((g, i) => {
                const sel = linkOverrides[g.groupKey];
                const ignored = sel === -1;
                const selEvent = sel && !ignored ? (g.suggestions.find(s => s.id === sel) ?? eventLinkOptions.find(e => e.id === sel)) : undefined;
                return (
                  <li key={g.groupKey} data-testid={`row-survey-group-${i}`} className={cn("px-3.5 py-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-start", !sel && "bg-[var(--status-warn-bg)]/40")}>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-foreground break-words">{g.eventLabel}</p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{plural(g.rowCount, "linha", "linhas")} · {plural(g.distinctEvaluators, "avaliador", "avaliadores")}</p>
                    </div>
                    <div className="min-w-0">
                      <Select value={sel ? String(sel) : "none"}
                        onValueChange={val => setLinkOverrides(prev => { const n = { ...prev }; if (val === "none") delete n[g.groupKey]; else n[g.groupKey] = Number(val); return n; })}>
                        <SelectTrigger aria-label={`Evento do sistema para ${g.eventLabel}`} data-testid={`select-survey-link-${i}`}
                          className={cn("h-11 lg:h-9 text-[13px] rounded-lg bg-card", !sel ? "border-[var(--status-warn)]" : "border-border")}>
                          <SelectValue placeholder="Escolha um evento…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="none">— sem vínculo —</SelectItem>
                          <SelectItem value="-1">Ignorar estas respostas</SelectItem>
                          {g.suggestions.map(s => <SelectItem key={`s-${s.id}`} value={String(s.id)}>★ {s.name}{s.isHistorical ? " (histórico)" : ""}</SelectItem>)}
                          {eventLinkOptions.filter(e => !g.suggestions.some(s => s.id === e.id)).map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.name}{e.isHistorical ? " (histórico)" : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!sel && <p className="mt-1 text-[12px] font-semibold text-[var(--status-warn-text)]">Obrigatório: escolha um evento ou “Ignorar”.</p>}
                      {ignored && <p className="mt-1 text-[12px] text-muted-foreground">Estas respostas não serão importadas.</p>}
                      {selEvent?.isHistorical && <p className="mt-1 text-[12px] text-[var(--status-warn-text)]">Evento histórico: só os comentários ficam como referência, sem notas.</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-[12px] text-muted-foreground">★ sugestão por nome, cidade e data parecidos.</p>
          </div>
        </div>
      )}
      <ErrorBox message={commitError} title="Falha ao importar" />
      <div className={dialogFooterCls}>
        {committed ? (
          <button type="button" onClick={() => onOpenChange(false)} className={btnPrimary}>{created > 0 ? "Ver as senhas" : "Fechar"}</button>
        ) : (
          <>
            <button type="button" onClick={() => onOpenChange(false)} disabled={isCommitting} className={btnSecondary}>Cancelar</button>
            <button type="button" data-testid="button-confirm-survey-import" disabled={blocked || isCommitting} aria-busy={isCommitting || undefined} onClick={onConfirm}
              title={blocked ? (p?.errors.length ? "Corrija os erros da planilha" : "Ligue todos os eventos para confirmar") : undefined} className={btnPrimary}>
              {isCommitting ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <CheckCircle2 size={15} aria-hidden />}
              {isCommitting ? "Importando…" : "Confirmar e importar"}
            </button>
          </>
        )}
      </div>
    </ActionDialog>
  );
}
