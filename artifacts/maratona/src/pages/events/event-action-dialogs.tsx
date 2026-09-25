// Diálogos de ação sobre eventos: mesclar duplicado, excluir, confirmar
// resultados em lote (faixa + diálogo) e a prévia de "Unificar Datas".
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMergeEvent, useDeleteEvent, useConfirmEventResultsBulk, getGetEventsQueryKey, ApiError } from "@workspace/api-client-react";
import type { NormalizeDatesResult } from "@workspace/api-client-react";
import { ChevronsUpDown, Check, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { fmtDate, cn } from "@/lib/utils";
import { CONDENSED, WARNING, AMBER, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { inputStyle, serverErrorMessage } from "./form-bits";
import type { EventItem, EventRef, MergeConflict, BulkConfirmItem } from "./types";

const dialogStyle = { backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" };

// ── Mesclar ──────────────────────────────────────────────────────────────────

type MergeEventDialogProps = {
  /** Evento que será mantido; `null` = diálogo fechado. */
  event: EventRef | null;
  /** Todos os eventos, para escolher o duplicado. */
  events: EventItem[];
  onClose: () => void;
};

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

  const candidates = events
    .filter(e => e.id !== event?.id)
    .slice()
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const selected = candidates.find(e => String(e.id) === targetId);

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-lg rounded-xl" style={dialogStyle}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Mesclar Evento Duplicado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Este evento (<strong style={{ color: "var(--foreground)" }}>{event?.name}</strong>) será <strong style={{ color: "var(--foreground)" }}>mantido</strong>. Escolha o evento duplicado abaixo — os dados vazios serão preenchidos, os participantes migrados e o duplicado <strong style={{ color: "var(--foreground)" }}>excluído</strong>.
          </p>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Evento duplicado a remover</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  data-testid="select-merge-target"
                  className="w-full h-11 px-3 rounded-lg flex items-center justify-between gap-3 text-left transition-colors"
                  style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}
                >
                  {selected ? (
                    <span className="truncate text-sm font-bold uppercase">
                      {selected.name} — {fmtDate(selected.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}{selected.isHistorical ? " (histórico)" : ""}
                    </span>
                  ) : (
                    <span className="font-bold uppercase text-xs tracking-wider truncate" style={{ color: "var(--muted-foreground)" }}>Selecione o evento duplicado...</span>
                  )}
                  <ChevronsUpDown size={16} className="shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={dialogStyle}>
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput data-testid="input-merge-target-search" placeholder="Buscar por nome do evento..." />
                  <CommandList className="max-h-[320px]">
                    <CommandEmpty className="py-6 text-center text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum evento encontrado.</CommandEmpty>
                    <CommandGroup>
                      {candidates.map(e => (
                        <CommandItem
                          key={e.id}
                          value={`${e.name} ${e.city ?? ""} ${e.state ?? ""}`}
                          data-testid={`option-merge-target-${e.id}`}
                          onSelect={() => { setTargetId(String(e.id)); setPickerOpen(false); setConflict(null); }}
                          className="cursor-pointer py-2.5 gap-3 items-start"
                        >
                          <Check size={16} className={cn("mt-0.5 shrink-0", targetId === String(e.id) ? "opacity-100" : "opacity-0")} />
                          <span className="flex flex-col min-w-0">
                            <span className="font-black uppercase text-sm leading-tight whitespace-normal">{e.name}</span>
                            <span className="text-[11px] font-bold uppercase whitespace-normal" style={{ color: "var(--muted-foreground)" }}>
                              {fmtDate(e.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}{e.isHistorical ? " · histórico" : ""}
                            </span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {conflict && (
            <div data-testid="alert-merge-conflict" className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: "rgba(232,162,61,0.12)", border: `1px solid ${AMBER}`, color: AMBER_TEXT }}>
              <p className="font-bold uppercase">O duplicado já tem dado gravado:</p>
              <p>{conflict.evaluations} avaliação(ões), {conflict.calibrations} calibração(ões), {conflict.conformities} conformidade(s) e {conflict.results} resultado(s).</p>
              <p>Esses dados serão descartados. Confirma a mesclagem?</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={close} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-confirm-merge"
              type="button"
              disabled={!targetId || mergeMutation.isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50"
              style={{ backgroundColor: conflict ? WARNING : "var(--primary)", color: conflict ? "#fff" : "var(--primary-foreground)" }}
              onClick={() => {
                if (!event || !targetId) return;
                mergeMutation.mutate({ id: event.id, data: { mergeEventId: parseInt(targetId), force: !!conflict } });
              }}
            >
              {mergeMutation.isPending ? "Mesclando..." : conflict ? "Mesclar Mesmo Assim" : "Mesclar e Excluir Duplicado"}
            </button>
          </div>
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

  const deleteMutation = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        toast({ title: "Evento excluído com sucesso." });
        close();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-md rounded-xl" style={dialogStyle}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>Excluir Evento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Tem certeza que deseja excluir <strong style={{ color: "var(--foreground)" }}>{event?.name}</strong>? Todos os participantes, avaliações, calibrações e resultados vinculados serão <strong style={{ color: "var(--foreground)" }}>permanentemente removidos</strong>. Essa ação não pode ser desfeita.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="delete-confirm-text" className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Digite EXCLUIR para confirmar</label>
            <Input id="delete-confirm-text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="EXCLUIR" autoComplete="off" style={inputStyle} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={close}
              className="h-10 px-4 rounded-lg text-xs font-bold uppercase transition-opacity hover:opacity-80"
              style={{ border: "1px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              disabled={deleteMutation.isPending || confirmText.trim().toUpperCase() !== "EXCLUIR"}
              onClick={() => { if (event) deleteMutation.mutate({ id: event.id }); }}
              className="h-10 px-4 rounded-lg text-white text-xs font-bold uppercase disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
              style={{ backgroundColor: WARNING }}
            >
              <Trash2 size={13} />
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Definitivamente"}
            </button>
          </div>
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

/** Faixa "N evento(s) com resultados não confirmados" + diálogo de confirmação. */
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
        const parts = [`${d.confirmed} evento(s) confirmado(s).`];
        if (d.skipped > 0) parts.push(`${d.skipped} já estavam confirmados ou são históricos.`);
        if (d.warnings.length > 0) parts.push(d.warnings.join(" "));
        toast({ title: "Resultados confirmados", description: parts.join(" ") });
      },
      onError: (e) => toast({ title: "Erro ao confirmar em lote", description: serverErrorMessage(e), variant: "destructive" }),
    },
  });

  return (
    <>
      <div
        className="mb-3 flex items-center justify-between gap-3 flex-wrap rounded-xl px-4 py-3"
        style={{ backgroundColor: "rgba(232,162,61,0.10)", border: "1px solid rgba(232,162,61,0.35)" }}
      >
        <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
          <strong>{events.length}</strong> evento(s) com resultados não confirmados{hasDateFilter ? " no período selecionado" : ""}.
          <span className="block text-[11px] font-normal" style={{ color: "var(--muted-foreground)" }}>
            Confirmar faz esses eventos passarem a contar na elegibilidade e na nota dos colaboradores.
          </span>
        </p>
        <button
          type="button"
          data-testid="button-bulk-confirm"
          onClick={() => { setItems(events.map(ev => ({ id: ev.id, name: ev.name, startDate: ev.startDate }))); setOpen(true); }}
          disabled={bulkConfirmMutation.isPending}
          className="h-9 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wide inline-flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <Check size={14} /> Confirmar {events.length} evento(s)
        </button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!bulkConfirmMutation.isPending) setOpen(o); }}>
        <DialogContent className="max-w-lg" style={dialogStyle}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
              Confirmar {items.length} evento(s)
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Os resultados destes eventos passam a contar na elegibilidade e na nota dos colaboradores. Dá para desfazer depois, evento a evento.
          </p>
          <ul className="max-h-60 overflow-y-auto rounded-lg text-[12px] divide-y" style={{ border: "1px solid var(--border)" }}>
            {items.map(ev => (
              <li key={ev.id} className="px-3 py-2 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold truncate">{ev.name}</span>
                <span className="shrink-0" style={{ color: "var(--muted-foreground)" }}>{fmtDate(ev.startDate)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={bulkConfirmMutation.isPending}
              className="h-10 px-4 rounded-lg text-[12px] font-bold uppercase disabled:opacity-50"
              style={{ border: "1px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => bulkConfirmMutation.mutate({ data: { eventIds: items.map(ev => ev.id) } })}
              disabled={bulkConfirmMutation.isPending || items.length === 0}
              className="h-10 px-5 rounded-lg text-[12px] font-bold uppercase inline-flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Check size={14} /> {bulkConfirmMutation.isPending ? "Confirmando..." : "Confirmar todos"}
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
      title={`Unificar datas de ${preview?.changes.length ?? 0} evento(s)`}
      description={preview
        ? `${preview.fixedCount} correção(ões) pontual(is) e ${preview.normalizedCount} evento(s) multi-dia que passam a ter data única (início = fim). Isso grava direto nos eventos.`
        : undefined}
      confirmLabel="Aplicar"
      confirmText="APLICAR"
      destructive
      isPending={isPending}
      onConfirm={onApply}
      data-testid="dialog-normalize-dates"
    >
      {preview && (
        <ul className="max-h-60 overflow-y-auto rounded-lg text-[12px] divide-y" style={{ border: "1px solid var(--border)" }}>
          {preview.changes.slice(0, DATE_PREVIEW_LIMIT).map(c => (
            <li key={c.eventId} className="px-3 py-2 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
              <span className="font-semibold truncate">{c.eventName}</span>
              <span className="shrink-0 font-mono text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {fmtDate(c.startDateBefore)}{c.endDateBefore !== c.startDateBefore ? `–${fmtDate(c.endDateBefore)}` : ""} → {fmtDate(c.startDateAfter)}
              </span>
            </li>
          ))}
          {preview.changes.length > DATE_PREVIEW_LIMIT && (
            <li className="px-3 py-2 text-center" style={{ color: "var(--muted-foreground)", borderColor: "var(--border)" }}>
              +{preview.changes.length - DATE_PREVIEW_LIMIT} mais…
            </li>
          )}
        </ul>
      )}
    </ConfirmDialog>
  );
}
