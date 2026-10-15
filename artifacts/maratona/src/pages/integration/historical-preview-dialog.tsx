// Prévia (dryRun) da importação de resultados históricos, evento por evento,
// com o vínculo opcional a um evento que já existe na mesma data; depois de
// confirmar, o resultado aparece no mesmo diálogo.
import type { HistoricalImportResult } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, History, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, plural } from "@/lib/utils";
import { ActionDialog, Chip, DoneBox, ErrorBox, Eyebrow, MessageList, NumberStrip, btnPrimary, btnSecondary, dialogFooterCls, type Tone } from "./integration-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  preview: HistoricalImportResult | null;
  committed: HistoricalImportResult | null;
  commitError: string | null;
  /** groupKey do evento da planilha → id do evento existente ao qual vincular. */
  linkOverrides: Record<string, number>;
  setLinkOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isCommitting: boolean;
  onConfirm: () => void;
};

const ACTION: Record<string, { label: string; tone: Tone; hint: string }> = {
  create: { label: "Criar", tone: "ok", hint: "evento novo, ainda não existe no sistema." },
  link: { label: "Vincular", tone: "info", hint: "você escolheu ligar a um evento que já existe, em vez de criar outro." },
  update: { label: "Atualizar", tone: "warn", hint: "já existe um evento histórico com este nome e data: a nota é substituída pela da planilha." },
  conflict: { label: "Conflito", tone: "danger", hint: "não será importado (veja o motivo nos erros)." },
};

export function HistoricalPreviewDialog({ open, onOpenChange, fileName, preview, committed, commitError, linkOverrides, setLinkOverrides, isCommitting, onConfirm }: Props) {
  const p = preview;
  const blocked = !p?.success || (p?.errors.length ?? 0) > 0;
  const create = p?.events.filter(ev => ev.action === "create").length ?? 0;
  const update = p?.events.filter(ev => ev.action === "update").length ?? 0;
  const conflict = p?.events.filter(ev => ev.action === "conflict").length ?? 0;
  const toLink = p?.events.reduce((s, ev) => s + ev.matchedCount, 0) ?? 0;

  return (
    <ActionDialog open={open} onOpenChange={onOpenChange} busy={isCommitting} wide="xl" testId="dialog-historical-preview"
      icon={committed ? CheckCircle2 : History} tone={committed ? "brand" : "neutral"}
      title={committed ? "Resultados históricos importados" : "Prévia da importação"}
      description={committed ? fileName : <>Nada foi gravado ainda. Confira evento por evento antes de confirmar. <span className="text-foreground font-semibold break-all">{fileName}</span></>}>
      {committed ? (
        <>
          <NumberStrip items={[
            { label: "Eventos criados", value: committed.eventsCreated ?? 0, tone: "ok" },
            { label: "Eventos atualizados", value: committed.eventsUpdated ?? 0 },
            { label: "Participações", value: committed.participantsLinked ?? 0 },
            { label: "Colaboradores novos", value: committed.employeesCreated ?? 0, tone: (committed.employeesCreated ?? 0) > 0 ? "info" : undefined },
          ]} />
          {(committed.warnings?.length ?? 0) > 0
            ? <MessageList tone="warn" title="Avisos" items={committed.warnings ?? []} />
            : <DoneBox>Os eventos entraram como resultados históricos, com a nota já fechada.</DoneBox>}
        </>
      ) : p && (
        <div className="space-y-4">
          <NumberStrip items={[
            { label: "Linhas", value: p.totalRows, testId: "text-preview-total-rows" },
            { label: "Já cadastrados", value: p.matched, testId: "text-preview-matched" },
            { label: "Colaboradores novos", value: p.employeesToCreate?.length ?? 0, tone: (p.employeesToCreate?.length ?? 0) > 0 ? "info" : undefined },
            { label: "Eventos a criar", value: create, tone: "ok" },
            { label: "Eventos a atualizar", value: update, tone: update > 0 ? "warn" : undefined },
            { label: "Participações", value: toLink },
          ]} />

          {conflict > 0 && (
            <p className="text-[13px] font-semibold text-[var(--status-danger-text)]">
              {conflict === 1 ? "1 evento não será importado" : `${conflict} eventos não serão importados`} por causa dos erros abaixo: corrija a planilha e envie de novo.
            </p>
          )}
          <MessageList tone="danger" title="Erros — bloqueiam a importação" items={p.errors}
            note="Enquanto houver erro, não dá para confirmar. Corrija a planilha (ou os cadastros) e envie de novo." />
          <MessageList tone="info" title={p.employeesToCreate?.length === 1 ? "1 colaborador novo será cadastrado" : `${p.employeesToCreate?.length ?? 0} colaboradores novos serão cadastrados`}
            items={p.employeesToCreate ?? []} count={false}
            note="Esses nomes não bateram com ninguém já cadastrado. Ao confirmar, viram um cadastro básico (sem área/função) já no evento. Se algum estiver digitado errado, cancele e corrija a planilha." />
          <MessageList tone="info" title={`${plural(p.cycleFallback?.length ?? 0, "evento", "eventos")} fora do período de qualquer ciclo`}
            items={p.cycleFallback ?? []} count={false} note="Em vez de bloquear, entram no ciclo atual (indicado na tabela) e aparecem normalmente nos relatórios." />

          {p.events.length > 0 && (
            <div className="space-y-2">
              <Eyebrow as="p">Evento por evento</Eyebrow>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full min-w-[680px] border-collapse text-[13px]" aria-label="Eventos da planilha">
                  <thead>
                    <tr className="bg-secondary/50">
                      {["Evento", "Data", "Nota", "Participantes", "Ciclo", "Ação"].map(h => (
                        <th key={h} className="font-condensed px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.events.map((ev, i) => {
                      const linked = ev.action === "create" && !!linkOverrides[ev.groupKey];
                      const a = ACTION[linked ? "link" : ev.action] ?? ACTION.create;
                      return (
                        <tr key={i} className="border-t border-border align-top" data-testid={`row-preview-event-${i}`}>
                          <td className="px-3 py-2 font-semibold text-foreground">{ev.eventName}</td>
                          <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">{ev.date}</td>
                          <td className="px-3 py-2 tabular-nums text-foreground">{ev.score ?? "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <span className="tabular-nums">{ev.matchedCount}/{ev.participantsCount}</span>
                            {ev.newEmployeeNames && ev.newEmployeeNames.length > 0 && (
                              <span className="block mt-0.5 text-[12px] text-[var(--status-info-text)]">{plural(ev.newEmployeeNames.length, "novo", "novos")}: {ev.newEmployeeNames.join(", ")}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {ev.cycleName ?? "—"}
                            {ev.cycleFallback && <span className="block mt-0.5 text-[12px] text-[var(--status-info-text)]">fora do período (ciclo atual)</span>}
                          </td>
                          <td className="px-3 py-2">
                            <Chip tone={a.tone}>{a.label}</Chip>
                            {ev.action === "create" && ev.overlapCandidates && ev.overlapCandidates.length > 0 && (
                              <div className="mt-2 min-w-[230px]" data-testid={`select-link-override-${i}`}>
                                <p className="mb-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-[var(--status-warn-text)]">
                                  <AlertTriangle size={12} aria-hidden className="mt-[2px] shrink-0" />
                                  Já existe {ev.overlapCandidates.length === 1 ? "1 evento" : `${ev.overlapCandidates.length} eventos`} nessa data — pode ser a mesma corrida com outro nome.
                                </p>
                                <Select value={linkOverrides[ev.groupKey] ? String(linkOverrides[ev.groupKey]) : "none"}
                                  onValueChange={val => setLinkOverrides(prev => { const n = { ...prev }; if (val === "none") delete n[ev.groupKey]; else n[ev.groupKey] = Number(val); return n; })}>
                                  <SelectTrigger aria-label={`O que fazer com ${ev.eventName}`} className="h-9 text-[12.5px] rounded-lg border-border bg-card"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Criar evento novo</SelectItem>
                                    {ev.overlapCandidates.map(c => <SelectItem key={c.id} value={String(c.id)}>Vincular a “{c.name}” ({c.isHistorical ? "histórico" : "manual"})</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
                {Object.values(ACTION).map(a => (
                  <div key={a.label} className="flex items-start gap-2"><dt className="shrink-0"><Chip tone={a.tone} className="h-5 text-[11px]">{a.label}</Chip></dt><dd className="leading-snug">{a.hint}</dd></div>
                ))}
              </dl>
            </div>
          )}
        </div>
      )}
      <ErrorBox message={commitError} title="Falha ao importar" />
      <div className={dialogFooterCls}>
        {committed ? (
          <button type="button" onClick={() => onOpenChange(false)} className={btnPrimary}>Fechar</button>
        ) : (
          <>
            <button type="button" onClick={() => onOpenChange(false)} disabled={isCommitting} className={btnSecondary}>Cancelar</button>
            <button type="button" data-testid="button-confirm-historical-import" disabled={blocked || isCommitting} aria-busy={isCommitting || undefined} onClick={onConfirm}
              title={blocked ? "Corrija os erros da planilha para confirmar" : undefined} className={cn(btnPrimary)}>
              {isCommitting ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <CheckCircle2 size={15} aria-hidden />}
              {isCommitting ? "Importando…" : "Confirmar e importar"}
            </button>
          </>
        )}
      </div>
    </ActionDialog>
  );
}
