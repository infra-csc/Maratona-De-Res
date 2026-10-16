// Topo do Detalhe do Evento: barra fixa (voltar + trilha + ações no desktop),
// o cartão do evento (nome, selos, data/local, avisos e o placar) e o diálogo
// de confirmar/desconfirmar resultados. Estado do diálogo e mutações ficam na
// página; aqui só a apresentação.
import type { ReactNode } from "react";
import { Link } from "wouter";
import type { Cycle } from "@workspace/api-client-react";
import { ArrowLeft, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, History, Info, Loader2, Lock, MapPin, ShieldAlert, SlidersHorizontal, Unlock, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, fmtDate, fmtOpensOn, evaluationOpensOn, plural } from "@/lib/utils";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { useWideScreen } from "../events/use-wide-screen";
import { weekdayShort } from "../events/events-ui";
import { Chip, DialogHeading, Eyebrow, Notice, btnGhost, btnPrimary, btnSecondary, btnSmall, dialogCls } from "./detail-ui";
import type { EventDetail, ResultsDialogMode, SetState } from "./types";

export type EventHeaderProps = {
  event: EventDetail;
  canManage: boolean;
  /** Evento de ciclo fechado/anterior: só consulta (sem atalhos de edição nem confirmar). */
  readOnlyCycle?: Cycle | null;
  /** Evento do PRÓXIMO ciclo (começa depois do fim do ciclo): não aceita avaliação nem confirmação até o ciclo novo ser criado. */
  nextCycle?: boolean;
  /** "Abre em DD/MM" / "Próximo ciclo" (events/rules → opensLabelFor); null = a avaliação já abriu. */
  opensLabel?: string | null;
  /** Linha do tempo (leitura) — admin/RH, também em modo consulta. */
  canSeeTimeline?: boolean;
  resultsConfirmBusy: boolean;
  resultsDialog: ResultsDialogMode;
  setResultsDialog: SetState<ResultsDialogMode>;
  /** Dispara confirmar/desconfirmar conforme o modo aberto no diálogo. */
  onSubmitResultsDialog: () => void;
  /** Placar do evento (nota, equipe, critérios, matriz), no pé do cartão. */
  placar?: ReactNode;
};

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

export function EventHeader({ event, canManage, readOnlyCycle = null, nextCycle = false, opensLabel = null, canSeeTimeline = canManage, resultsConfirmBusy, resultsDialog, setResultsDialog, onSubmitResultsDialog, placar }: EventHeaderProps) {
  const wide = useWideScreen();
  const readOnly = !!readOnlyCycle;
  // Volta para a lista do ciclo do evento (consulta), não para o atual.
  const backHref = readOnly && readOnlyCycle && !readOnlyCycle.isCurrent ? `/events?ciclo=${readOnlyCycle.id}` : "/events";
  // Mesmo selo da Central (Atribuição): um só — "Próximo ciclo" (frase única
  // no título e no aviso) ou "Abre em DD/MM" (dia seguinte ao fim do evento).
  const waiting = !readOnly && !!opensLabel && !event.resultsConfirmed;
  // Confirmar Resultados antes de a avaliação abrir: desabilitado, com o motivo.
  const notOpenYet = waiting && !nextCycle;
  const opensOnLabel = notOpenYet ? fmtOpensOn(evaluationOpensOn(event)) : null;
  const confirmBlockedReason = nextCycle ? NEXT_CYCLE_NOTICE : notOpenYet ? `A avaliação abre em ${opensOnLabel}` : null;
  const place = event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location;
  const sameDay = !event.endDate || event.endDate === event.startDate;
  const wd = weekdayShort(event.startDate);
  const teamCount = event.participants?.filter(p => p.countsForScore !== false).length ?? 0;

  const links = (
    <>
      {/* Próximo ciclo: a Central continua aberta para preparar critérios e responsáveis. */}
      {!readOnly && (
        <Link
          href={`/evaluations?eventId=${event.id}`}
          data-testid="link-event-evaluations"
          title={nextCycle ? "Critérios e responsáveis deste evento (as avaliações abrem quando o ciclo novo for criado)" : "Critérios, avaliadores e avaliações deste evento"}
          className={btnSmall}
        >
          <ClipboardList size={15} aria-hidden /> Avaliações
        </Link>
      )}
      {!readOnly && (
        <Link href={`/calibrations?eventId=${event.id}`} data-testid="link-event-calibrations" title="Calibrar e publicar as notas deste evento" className={btnSmall}>
          <SlidersHorizontal size={15} aria-hidden /> Calibração
        </Link>
      )}
      {canSeeTimeline && (
        <Link href={`/linha-do-tempo?evento=${event.id}`} data-testid="link-event-timeline" title="O que este evento mudou nas notas, dia a dia" className={btnSmall}>
          <History size={15} aria-hidden /> Linha do tempo
        </Link>
      )}
    </>
  );
  const confirm = canManage && (
    event.resultsConfirmed ? (
      <button
        type="button"
        data-testid="button-unconfirm-results"
        onClick={() => setResultsDialog("unconfirm")}
        disabled={resultsConfirmBusy}
        className={cn(btnSmall, "text-[var(--status-danger-text)] enabled:hover:bg-[var(--status-danger-bg)]")}
      >
        {resultsConfirmBusy ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Unlock size={15} aria-hidden />}
        {resultsConfirmBusy ? "Revertendo…" : "Desconfirmar resultados"}
      </button>
    ) : (
      <button
        type="button"
        data-testid="button-confirm-results"
        onClick={() => setResultsDialog("confirm")}
        disabled={resultsConfirmBusy || !!confirmBlockedReason}
        title={confirmBlockedReason ?? undefined}
        aria-describedby={nextCycle ? "event-next-cycle-reason" : notOpenYet ? "event-confirm-opens-reason" : undefined}
        className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-4 text-[13px]")}
      >
        {resultsConfirmBusy ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <CheckCircle2 size={15} aria-hidden />}
        {resultsConfirmBusy ? "Confirmando…" : "Confirmar resultados"}
      </button>
    )
  );
  const hasActions = !readOnly || canSeeTimeline || canManage;

  return (
    <>
      {/* Barra fixa no tablet e no desktop: voltar, trilha e (desktop) as ações. */}
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 min-h-14 lg:h-16 flex items-center gap-2">
        <Link href={backHref} className={cn(btnGhost, "-ml-3 shrink-0")} data-testid="link-back-events">
          <ArrowLeft size={15} aria-hidden /> Eventos
        </Link>
        <span aria-hidden className="text-muted-foreground/50 font-condensed text-[16px]">/</span>
        <span aria-hidden className="min-w-0 truncate font-condensed text-[15px] font-bold uppercase tracking-[0.03em] text-muted-foreground">{event.name}</span>
        {wide && hasActions && (
          <div className="ml-auto flex items-center gap-2 shrink-0 pl-4">
            {links}
            {confirm}
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 pt-5 max-w-[1440px] mx-auto">
        <section aria-label="Evento" className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 sm:px-6 pt-5 pb-5">
            <Eyebrow>{event.clientName ? `Evento · ${event.clientName}` : "Evento"}</Eyebrow>
            <h1 data-testid="text-event-name" className="font-condensed mt-2 text-[28px] md:text-[36px] font-black uppercase leading-[0.98] tracking-[-0.015em] text-foreground break-words">
              {event.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground">
                <CalendarDays size={15} aria-hidden />
                <span className="tabular-nums">{sameDay ? fmtDate(event.startDate, FULL) : `${fmtDate(event.startDate, FULL)} – ${fmtDate(event.endDate, FULL)}`}</span>
                {wd && sameDay && <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.05em]">· {wd}</span>}
              </span>
              {place && <span className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground"><MapPin size={15} aria-hidden />{place}</span>}
              <span className="inline-flex items-center gap-1.5 text-[14px] text-muted-foreground"><Users size={15} aria-hidden />Equipe de {plural(teamCount, "pessoa", "pessoas")}</span>
            </div>
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              {event.isHistorical && <Chip tone="warn" data-testid="badge-historical">Histórico</Chip>}
              {event.forcedClosed && <Chip tone="danger" icon={ShieldAlert} title={event.forcedCloseReason ?? undefined}>Fechamento forçado</Chip>}
              {/* Evento que ainda não abriu (futuro / próximo ciclo): selo único "Abre em DD/MM" ou "Próximo ciclo" — sem "Não confirmado". */}
              {event.resultsConfirmed ? (
                <Chip tone="ok" icon={CheckCircle2} data-testid="badge-results-confirmed">Resultados Confirmados</Chip>
              ) : waiting ? null : (
                <Chip tone="danger" data-testid="badge-results-pending" title="Resultados não confirmados: ainda não contam na elegibilidade nem na nota dos colaboradores">Não Confirmado</Chip>
              )}
              {waiting && (
                <Chip tone="info" icon={CalendarClock} data-testid="badge-event-opens" title={nextCycle ? NEXT_CYCLE_NOTICE : "A avaliação abre sozinha no dia seguinte ao fim do evento."}>{opensLabel}</Chip>
              )}
              {readOnly && readOnlyCycle && <Chip icon={Lock}>Só consulta</Chip>}
            </div>
            {notOpenYet && (
              <p id="event-confirm-opens-reason" className="mt-2.5 text-[13.5px] text-muted-foreground" data-testid="event-opens-help">
                A avaliação abre sozinha no dia seguinte ao fim do evento.
              </p>
            )}

            {!wide && hasActions && (
              <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2 [&>a]:w-full [&>button]:w-full">
                {links}
                {confirm && <div className="col-span-full grid">{confirm}</div>}
              </div>
            )}

            {!readOnly && nextCycle && (
              <div id="event-next-cycle-reason" data-testid="event-next-cycle-reason" role="status" className="mt-4">
                <Notice icon={Info} tone="info">{NEXT_CYCLE_NOTICE}</Notice>
              </div>
            )}
            {readOnly && readOnlyCycle && (
              <div role="status" data-testid="event-readonly-notice" className="mt-4">
                <Notice icon={Lock} tone="neutral">
                  <b className="font-condensed mr-1.5 text-[13px] font-bold uppercase tracking-[0.05em] text-foreground">
                    {readOnlyCycle.status === "closed" ? "Ciclo fechado — só consulta" : "Ciclo anterior — só consulta"}
                  </b>
                  Este evento é do ciclo <b className="font-semibold text-foreground">{readOnlyCycle.name}</b>. Equipe, matriz, avaliações e confirmação não mudam mais por aqui.
                </Notice>
              </div>
            )}
          </div>
          {placar}
        </section>
      </div>

      {/* Confirmar/desconfirmar resultados muda elegibilidade e bônus de todos: pede confirmação */}
      <Dialog open={resultsDialog !== null} onOpenChange={(o) => { if (!o && !resultsConfirmBusy) setResultsDialog(null); }}>
        <DialogContent className={dialogCls}>
          <DialogHeading
            icon={resultsDialog === "unconfirm" ? Unlock : CheckCircle2}
            tone={resultsDialog === "unconfirm" ? "danger" : "brand"}
            Title={DialogTitle}
            Description={DialogDescription}
            title={resultsDialog === "confirm" ? "Confirmar resultados" : "Desconfirmar resultados"}
            description={resultsDialog === "confirm"
              ? "Este evento passa a contar na elegibilidade e na nota de todos os participantes. O ciclo é recalculado agora."
              : "Este evento deixa de contar na elegibilidade e na nota dos participantes. O ciclo é recalculado agora e o bônus projetado pode mudar."}
          />
          <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <p className="font-condensed text-[17px] font-black uppercase leading-tight text-foreground break-words">{event.name}</p>
            <p className="text-[13px] text-muted-foreground mt-0.5">{fmtDate(event.startDate, FULL)} · {plural(teamCount, "participante", "participantes")}</p>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" onClick={() => setResultsDialog(null)} disabled={resultsConfirmBusy} className={btnSecondary}>Cancelar</button>
            <button
              type="button"
              disabled={resultsConfirmBusy}
              aria-busy={resultsConfirmBusy || undefined}
              onClick={onSubmitResultsDialog}
              className={resultsDialog === "confirm" ? btnPrimary : cn(btnPrimary, "bg-destructive text-destructive-foreground")}
            >
              {resultsConfirmBusy && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {resultsConfirmBusy ? "Aguarde…" : resultsDialog === "confirm" ? "Confirmar" : "Desconfirmar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
