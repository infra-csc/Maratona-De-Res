// Diálogos de ação sobre eventos: mesclar duplicado, excluir, confirmar
// resultados em lote (faixa + diálogo) e a prévia de "Unificar Datas".
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMergeEvent, useDeleteEvent, useConfirmEventResultsBulk, getGetEventsQueryKey, ApiError } from "@workspace/api-client-react";
import type { NormalizeDatesResult } from "@workspace/api-client-react";
import { AlertTriangle, ArrowDown, Check, CheckCheck, ChevronsUpDown, GitMerge, Loader2, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, cn, plural } from "@/lib/utils";
import { serverErrorMessage } from "./form-bits";
import { Chip, DialogHeading, Eyebrow, FieldLabel, Notice, btnPrimary, btnSecondary, dialogCls, inputCls } from "./events-ui";
import type { EventItem, EventRef, MergeConflict, BulkConfirmItem } from "./types";

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
/** Botão vermelho das ações destrutivas (mesma forma dos demais). */
const btnDanger = cn(btnPrimary, "bg-destructive text-destructive-foreground enabled:hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground");

// ── Mesclar ──────────────────────────────────────────────────────────────────

type MergeEventDialogProps = {
  /** Evento que será mantido; `null` = diálogo fechado. */
  event: EventRef | null;
  /** Todos os eventos, para escolher o duplicado. */
  events: EventItem[];
  onClose: () => void;
};

/** Um evento do mesclar (mantido × duplicado): nome e data, com o papel em cima. */
function MergeSlot({ role, tone, name, meta, children }: { role: string; tone: "ok" | "danger"; name?: string; meta?: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2"><Chip tone={tone}>{role}</Chip></div>
      {children ?? (
        <>
          <p className="font-condensed mt-2 text-[17px] font-black uppercase leading-tight text-foreground break-words">{name}</p>
          {meta && <p className="text-[13px] text-muted-foreground mt-0.5">{meta}</p>}
        </>
      )}
    </div>
  );
}

export function MergeEventDialog({ event, events, onClose }: MergeEventDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [conflict, setConflict] = useState<MergeConflict | null>(null);
  const close = () => { onClose(); setTargetId(""); setConflict(null); };

  const mergeMutation = useMergeEvent({
    mutation: {
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({
          title: "Eventos mesclados",
          description: result.warnings.length > 0 ? result.warnings.join(" ") : "Dados combinados com sucesso.",
        });
        close();
      },
      onError: (e: ApiError) => {
        const data = e.data as { requiresConfirmation?: boolean; details?: MergeConflict; error?: string } | null;
        if (data?.requiresConfirmation && data.details) {
          setConflict(data.details);
          return;
        }
        toast({ title: "Erro ao mesclar", description: data?.error ?? e.message, variant: "destructive" });
      },
    },
  });

  const kept = events.find(e => e.id === event?.id);
  const candidates = events
    .filter(e => e.id !== event?.id)
    .slice()
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const selected = candidates.find(e => String(e.id) === targetId);
  const metaOf = (e: EventItem | undefined) => e ? [fmtDate(e.startDate, FULL), e.city, e.isHistorical ? "histórico" : null].filter(Boolean).join(" · ") : undefined;

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open && !mergeMutation.isPending) close(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px]")}>
        <DialogHeading icon={GitMerge} Title={DialogTitle} Description={DialogDescription} title="Mesclar evento duplicado"
          description="Os dados vazios do evento mantido são preenchidos com os do duplicado, os participantes migram e o duplicado é excluído." />

        <div className="space-y-2">
          <MergeSlot role="Fica" tone="ok" name={event?.name} meta={metaOf(kept)} />
          <div className="flex justify-center -my-1" aria-hidden><span className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground"><ArrowDown size={14} /></span></div>
          <MergeSlot role="Sai (duplicado)" tone="danger">
            <FieldLabel htmlFor="select-merge-target-btn">Escolha o duplicado</FieldLabel>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  id="select-merge-target-btn"
                  type="button"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  data-testid="select-merge-target"
                  className={cn(inputCls, "h-auto min-h-11 py-2 flex items-center justify-between gap-3 text-left")}
                >
                  {selected ? (
                    <span className="min-w-0">
                      <span className="font-condensed block truncate text-[16px] font-black uppercase leading-tight">{selected.name}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{metaOf(selected)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Buscar pelo nome do evento…</span>
                  )}
                  <ChevronsUpDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="font-body p-0 rounded-xl border-border bg-popover text-popover-foreground shadow-lg w-[var(--radix-popover-trigger-width)]">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput data-testid="input-merge-target-search" placeholder="Buscar por nome do evento…" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty className="py-6 text-center text-[14px] text-muted-foreground">Nenhum evento encontrado.</CommandEmpty>
                    <CommandGroup>
                      {candidates.map(e => (
                        <CommandItem
                          key={e.id}
                          value={`${e.name} ${e.city ?? ""} ${e.state ?? ""}`}
                          data-testid={`option-merge-target-${e.id}`}
                          onSelect={() => { setTargetId(String(e.id)); setPickerOpen(false); setConflict(null); }}
                          className="cursor-pointer py-2.5 gap-3 items-start rounded-lg"
                        >
                          <Check size={16} aria-hidden className={cn("mt-0.5 shrink-0", targetId === String(e.id) ? "opacity-100" : "opacity-0")} />
                          <span className="flex flex-col min-w-0">
                            <span className="font-condensed text-[15px] font-black uppercase leading-tight whitespace-normal">{e.name}</span>
                            <span className="text-[12.5px] text-muted-foreground whitespace-normal">{metaOf(e)}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </MergeSlot>
        </div>

        {conflict && (
          <Notice icon={AlertTriangle} tone="warn" testId="alert-merge-conflict">
            <p className="font-semibold">O duplicado já tem dado gravado:</p>
            <p>{plural(conflict.evaluations, "avaliação", "avaliações")}, {plural(conflict.calibrations, "calibração", "calibrações")}, {plural(conflict.conformities, "conformidade", "conformidades")} e {plural(conflict.results, "resultado", "resultados")}.</p>
            <p className="mt-1">Esses dados serão descartados. Confirma a mesclagem?</p>
          </Notice>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={close} disabled={mergeMutation.isPending} className={btnSecondary}>Cancelar</button>
          <button
            data-testid="button-confirm-merge"
            type="button"
            disabled={!targetId || mergeMutation.isPending}
            aria-busy={mergeMutation.isPending || undefined}
            className={conflict ? btnDanger : btnPrimary}
            onClick={() => {
              if (!event || !targetId) return;
              mergeMutation.mutate({ id: event.id, data: { mergeEventId: parseInt(targetId), force: !!conflict } });
            }}
          >
            {mergeMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <GitMerge size={15} aria-hidden />}
            {mergeMutation.isPending ? "Mesclando…" : conflict ? "Mesclar mesmo assim" : "Mesclar e excluir duplicado"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Excluir ──────────────────────────────────────────────────────────────────

type DeleteEventDialogProps = {
  /** Evento a excluir; `null` = diálogo fechado. */
  event: EventRef | null;
  onClose: () => void;
};

export function DeleteEventDialog({ event, onClose }: DeleteEventDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  // Todo fechamento (X, Esc, Cancelar, sucesso) limpa o texto digitado.
  const close = () => { onClose(); setConfirmText(""); };
  const ready = confirmText.trim().toUpperCase() === "EXCLUIR";

  const deleteMutation = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({ title: "Evento excluído com sucesso." });
        close();
      },
      onError: (e: unknown) => toast({ title: "Erro ao excluir", description: serverErrorMessage(e), variant: "destructive" }),
    },
  });
  const submit = () => { if (event && ready && !deleteMutation.isPending) deleteMutation.mutate({ id: event.id }); };

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) close(); }}>
      <DialogContent className={dialogCls}>
        <DialogHeading icon={Trash2} tone="danger" Title={DialogTitle} Description={DialogDescription} title="Excluir evento"
          description={<>Tem certeza que deseja excluir <b className="font-semibold text-foreground">{event?.name}</b>? Participantes, avaliações, calibrações e resultados vinculados são <b className="font-semibold text-foreground">removidos para sempre</b>. Essa ação não pode ser desfeita.</>} />
        <div>
          <FieldLabel htmlFor="delete-confirm-text">Digite EXCLUIR para confirmar</FieldLabel>
          <input id="delete-confirm-text" value={confirmText} onChange={e => setConfirmText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            placeholder="EXCLUIR" autoComplete="off" autoFocus
            className={cn(inputCls, "font-condensed uppercase tracking-[0.08em] text-[16px] font-bold", ready && "border-[var(--status-danger)]")} />
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={close} disabled={deleteMutation.isPending} className={btnSecondary}>Cancelar</button>
          <button type="button" disabled={deleteMutation.isPending || !ready} onClick={submit} aria-busy={deleteMutation.isPending || undefined} className={btnDanger}>
            {deleteMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={15} aria-hidden />}
            {deleteMutation.isPending ? "Excluindo…" : "Excluir definitivamente"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Confirmar resultados em lote ─────────────────────────────────────────────

type BulkConfirmProps = {
  /** Lista filtrada no momento (chip "Não Confirmados"). */
  events: EventItem[];
  hasDateFilter: boolean;
};

/** Faixa "N eventos com resultados não confirmados" + diálogo de confirmação. */
export function BulkConfirmBanner({ events, hasDateFilter }: BulkConfirmProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  // Congela a lista no momento em que o diálogo abre: a tela atualiza a cada
  // 60 s (e ao voltar o foco) e a lista filtrada podia mudar entre abrir e confirmar.
  const [items, setItems] = useState<BulkConfirmItem[]>([]);

  const bulkConfirmMutation = useConfirmEventResultsBulk({
    mutation: {
      onSuccess: (d) => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        setOpen(false);
        const parts = [`${plural(d.confirmed, "evento confirmado", "eventos confirmados")}.`];
        if (d.skipped > 0) parts.push(d.skipped === 1 ? "1 já estava confirmado ou é histórico." : `${d.skipped} já estavam confirmados ou são históricos.`);
        if (d.warnings.length > 0) parts.push(d.warnings.join(" "));
        toast({ title: "Resultados confirmados", description: parts.join(" ") });
      },
      onError: (e) => toast({ title: "Erro ao confirmar em lote", description: serverErrorMessage(e), variant: "destructive" }),
    },
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] px-4 py-3.5 sm:px-5">
        <span aria-hidden className="hidden sm:flex w-9 h-9 shrink-0 rounded-full bg-card text-[var(--status-warn-text)] items-center justify-center"><CheckCheck size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-condensed text-[18px] font-black uppercase leading-tight text-foreground">
            {plural(events.length, "evento com resultados não confirmados", "eventos com resultados não confirmados")}{hasDateFilter ? " no período" : ""}
          </p>
          <p className="text-[13px] text-muted-foreground mt-0.5">Confirmar faz esses eventos passarem a contar na elegibilidade e na nota dos colaboradores.</p>
        </div>
        <button
          type="button"
          data-testid="button-bulk-confirm"
          onClick={() => { setItems(events.map(ev => ({ id: ev.id, name: ev.name, startDate: ev.startDate }))); setOpen(true); }}
          disabled={bulkConfirmMutation.isPending}
          className={cn(btnPrimary, "shrink-0")}
        >
          <Check size={15} aria-hidden /> Confirmar {plural(events.length, "evento", "eventos")}
        </button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!bulkConfirmMutation.isPending) setOpen(o); }}>
        <DialogContent className={cn(dialogCls, "max-w-[520px]")}>
          <DialogHeading icon={CheckCheck} tone="brand" Title={DialogTitle} Description={DialogDescription}
            title={`Confirmar ${plural(items.length, "evento", "eventos")}`}
            description="Os resultados destes eventos passam a contar na elegibilidade e na nota dos colaboradores. Dá para desfazer depois, evento a evento." />
          <div>
            <Eyebrow className="mb-2">{plural(items.length, "evento", "eventos")}</Eyebrow>
            <ul className="max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-border divide-y divide-border">
              {items.map(ev => (
                <li key={ev.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <span className="font-condensed text-[15px] font-bold uppercase leading-tight truncate">{ev.name}</span>
                  <span className="shrink-0 font-condensed text-[14px] font-bold tabular-nums text-muted-foreground">{fmtDate(ev.startDate)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={bulkConfirmMutation.isPending} className={btnSecondary}>Cancelar</button>
            <button
              type="button"
              onClick={() => bulkConfirmMutation.mutate({ data: { eventIds: items.map(ev => ev.id) } })}
              disabled={bulkConfirmMutation.isPending || items.length === 0}
              aria-busy={bulkConfirmMutation.isPending || undefined}
              className={btnPrimary}
            >
              {bulkConfirmMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Check size={15} aria-hidden />}
              {bulkConfirmMutation.isPending ? "Confirmando…" : "Confirmar todos"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Unificar Datas ───────────────────────────────────────────────────────────

/** Quantas mudanças de data mostrar na prévia antes do "+N mais". */
const DATE_PREVIEW_LIMIT = 10;

type NormalizeDatesDialogProps = {
  /** Resultado do dryRun; `null` = diálogo fechado. */
  preview: NormalizeDatesResult | null;
  onClose: () => void;
  isPending: boolean;
  onApply: () => void;
};

/** Prévia do "Unificar Datas" + confirmação digitada (APLICAR). */
export function NormalizeDatesDialog({ preview, onClose, isPending, onApply }: NormalizeDatesDialogProps) {
  return (
    <ConfirmDialog
      open={!!preview}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title={`Unificar datas de ${plural(preview?.changes.length ?? 0, "evento", "eventos")}`}
      description={preview
        ? `${plural(preview.fixedCount, "correção pontual", "correções pontuais")} e ${plural(preview.normalizedCount, "evento de vários dias", "eventos de vários dias")} que ${preview.normalizedCount === 1 ? "passa" : "passam"} a ter data única (início = fim). Isso grava direto nos eventos.`
        : undefined}
      confirmLabel="Aplicar"
      confirmText="APLICAR"
      destructive
      isPending={isPending}
      onConfirm={onApply}
      data-testid="dialog-normalize-dates"
    >
      {preview && (
        <ul className="max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-border divide-y divide-border">
          {preview.changes.slice(0, DATE_PREVIEW_LIMIT).map(c => (
            <li key={c.eventId} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
              <span className="font-condensed text-[15px] font-bold uppercase leading-tight truncate">{c.eventName}</span>
              <span className="shrink-0 font-condensed text-[14px] font-bold tabular-nums text-muted-foreground">
                {fmtDate(c.startDateBefore)}{c.endDateBefore !== c.startDateBefore ? `–${fmtDate(c.endDateBefore)}` : ""} → <span className="text-foreground">{fmtDate(c.startDateAfter)}</span>
              </span>
            </li>
          ))}
          {preview.changes.length > DATE_PREVIEW_LIMIT && (
            <li className="px-3.5 py-2.5 text-center text-[13px] text-muted-foreground">e mais {plural(preview.changes.length - DATE_PREVIEW_LIMIT, "evento", "eventos")}</li>
          )}
        </ul>
      )}
    </ConfirmDialog>
  );
}
