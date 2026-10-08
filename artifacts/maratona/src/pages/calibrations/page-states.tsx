// Estados da tela fora do caminho feliz: nenhum evento escolhido, carregando,
// erro, evento sem critérios e a confirmação de descartar edições ao trocar de evento.
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, ArrowUpRight, ChevronsUpDown, ListX, RotateCw, Target, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, fmtDate, formatEventSubtitle, plural } from "@/lib/utils";
import { Chip, DialogHeading, Eyebrow, btnPrimary, btnSecondary, btnSmall, dialogCls } from "../evaluations/ui";
import { Bone } from "./cal-ui";
import { calibrationEventChip } from "./helpers";
import type { ApiEvent } from "./types";

/** Nenhum evento escolhido: convite + os eventos que pedem calibração agora. */
export function CalibrationEmptyState({ events, loading, onOpenPicker, onSelect }: {
  events: ApiEvent[];
  loading: boolean;
  onOpenPicker: () => void;
  onSelect: (id: number) => void;
}) {
  // "Para calibrar agora": com resposta das áreas e ainda sem publicação final.
  const toCalibrate = events
    .map(ev => ({ ev, chip: calibrationEventChip(ev) }))
    .filter(({ chip }) => chip.label === "Em avaliação" || chip.label === "Calibrado" || chip.label === "Publicado parcial")
    .sort((a, b) => (b.ev.startDate ?? "").localeCompare(a.ev.startDate ?? ""));
  const shown = toCalibrate.slice(0, 6);
  return (
    <div className="max-w-3xl mx-auto pt-6 md:pt-12 pb-10">
      <span className="w-12 h-12 rounded-full bg-secondary text-foreground flex items-center justify-center"><Target size={22} aria-hidden /></span>
      <h2 className="font-condensed mt-5 text-[36px] md:text-[44px] font-black uppercase leading-[0.95] tracking-[-0.02em] text-foreground">
        {loading ? "Carregando eventos" : events.length === 0 ? "Nenhum evento no ciclo" : "Escolha um evento"}
      </h2>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        {events.length === 0 && !loading
          ? "Quando houver eventos no ciclo atual, eles aparecem aqui para calibrar."
          : "Calibre a nota de cada critério com base nas respostas das áreas, salve e, quando estiver pronto, publique para valer ao colaborador."}
      </p>
      {events.length > 0 && (
        <button type="button" onClick={onOpenPicker} className={cn(btnPrimary, "mt-6")}>
          <ChevronsUpDown size={15} aria-hidden /> Escolher evento
        </button>
      )}

      {loading ? (
        <div className="mt-10 space-y-2" aria-hidden>
          <Bone className="h-3 w-40" />
          {[0, 1, 2].map(i => <Bone key={i} className="h-[68px] w-full rounded-xl" />)}
        </div>
      ) : shown.length > 0 && (
        <section className="mt-10" aria-labelledby="cal-suggest-title">
          <div className="flex items-baseline justify-between gap-3 mb-2.5">
            <Eyebrow as="h3" id="cal-suggest-title">Pedem calibração agora</Eyebrow>
            <span className="font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">{plural(toCalibrate.length, "evento")}</span>
          </div>
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {shown.map(({ ev, chip }) => (
              <li key={ev.id}>
                <button type="button" onClick={() => onSelect(ev.id)} data-testid={`cal-suggest-${ev.id}`}
                  className="group w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-secondary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span className="min-w-0 flex-1">
                    <span className="block font-condensed text-[17px] font-black uppercase leading-tight text-foreground break-words">{ev.name}</span>
                    <span className="block text-[13px] text-muted-foreground truncate">{[ev.startDate ? fmtDate(ev.startDate) : null, formatEventSubtitle(ev)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Chip tone={chip.tone} className="hidden sm:inline-flex">{chip.label}</Chip>
                  <ArrowRight size={16} aria-hidden className="shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
          {toCalibrate.length > shown.length && (
            <p className="mt-2 text-[13px] text-muted-foreground">e mais {plural(toCalibrate.length - shown.length, "evento")} no seletor do topo.</p>
          )}
        </section>
      )}
    </div>
  );
}

/** Carregando os critérios do evento: o esqueleto da barra e de dois critérios. */
export function CalibrationLoading() {
  return (
    <div role="status" aria-label="Carregando critérios" className="space-y-4">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center gap-4">
        <Bone className="w-11 h-11 rounded-full" />
        <div className="space-y-2 flex-1"><Bone className="h-4 w-32" /><Bone className="h-3 w-44" /></div>
        <Bone className="h-11 w-40 rounded-lg hidden sm:block" />
        <Bone className="h-11 w-28 rounded-lg" />
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {[0, 1].map(i => (
          <div key={i} className="p-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_268px]">
            <div className="space-y-3">
              <Bone className="h-6 w-56" />
              <Bone className="h-5 w-28" />
              <Bone className="h-24 w-full rounded-xl" />
              <Bone className="h-16 w-full rounded-lg" />
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3"><Bone className="h-[58px]" /><Bone className="h-[58px]" /><Bone className="h-[58px]" /></div>
              <Bone className="h-20 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando critérios…</span>
    </div>
  );
}

/** Falha ao carregar (eventos ou dados do evento), com nova tentativa. */
export function CalibrationError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-5 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <span className="w-10 h-10 shrink-0 rounded-full bg-card text-[var(--status-danger-text)] flex items-center justify-center"><AlertTriangle size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[20px] font-black uppercase leading-tight text-foreground">{title}</p>
        <p className="text-[14px] text-muted-foreground mt-0.5">Verifique a conexão e tente de novo. Nada do que já foi salvo se perdeu.</p>
      </div>
      <button type="button" onClick={onRetry} className={btnSecondary}><RotateCw size={15} aria-hidden /> Tentar de novo</button>
    </div>
  );
}

/** Evento sem critério ativo: nada a calibrar até configurar os critérios. */
export function NoCriteria({ eventId }: { eventId: number }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><ListX size={20} aria-hidden /></span>
      <p className="font-condensed mt-3 text-[22px] font-black uppercase text-foreground">Nenhum critério ativo</p>
      <p className="text-[14px] text-muted-foreground mt-1 max-w-md mx-auto">Este evento ainda não tem critérios para calibrar. Os critérios são definidos no próprio evento.</p>
      <Link href={`/events/${eventId}`} className={cn(btnSmall, "mt-4")}>Abrir o evento <ArrowUpRight size={14} aria-hidden /></Link>
    </div>
  );
}

/** Trocar de evento com nota/justificativa/peso digitados e não salvos. */
export function DiscardEditsDialog({ open, count, targetName, onCancel, onConfirm }: {
  open: boolean;
  count: number;
  targetName: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) onCancel(); }}>
      <AlertDialogContent className={dialogCls} data-testid="dialog-discard-edits">
        <DialogHeading
          icon={Undo2}
          tone="danger"
          Title={AlertDialogTitle}
          Description={AlertDialogDescription}
          title="Descartar o que não foi salvo?"
          description={<>Há {plural(count, "alteração", "alterações")} sem salvar neste evento. Ao abrir {targetName ? <b className="font-semibold text-foreground">{targetName}</b> : "outro evento"}, {count === 1 ? "ela se perde" : "elas se perdem"}.</>}
        />
        <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel className={cn(btnSecondary, "mt-0")}>Continuar aqui</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={cn(btnSecondary, "bg-[var(--destructive)] text-[var(--destructive-foreground)] border-transparent enabled:hover:bg-[var(--destructive)] enabled:hover:opacity-90")}>
            Descartar e trocar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
