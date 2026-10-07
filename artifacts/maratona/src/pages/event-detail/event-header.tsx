// Cabeçalho do evento (nome, badges, local/datas, atalhos para Avaliações e
// Calibração, confirmar/desconfirmar resultados) e o diálogo de confirmação.
// Estado do diálogo e mutações ficam na página; aqui só a apresentação.
import { Link } from "wouter";
import type { Cycle } from "@workspace/api-client-react";
import { ArrowLeft, CalendarClock, CheckCircle2, Info, Lock, ShieldAlert, Unlock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, fmtOpensOn, evaluationOpensOn } from "@/lib/utils";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { CONDENSED, WARNING, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
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
};

export function EventHeader({ event, canManage, readOnlyCycle = null, nextCycle = false, opensLabel = null, canSeeTimeline = canManage, resultsConfirmBusy, resultsDialog, setResultsDialog, onSubmitResultsDialog }: EventHeaderProps) {
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
  return (
    <>
      {/* ── Header ── */}
      <div className="px-4 sm:px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase mb-2.5 transition-colors hover:opacity-70" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={12} /> Eventos
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 data-testid="text-event-name" className="font-black uppercase text-2xl tracking-tight leading-none break-words min-w-0" style={{ fontFamily: CONDENSED }}>{event.name}</h1>
              {event.isHistorical && (
                <span data-testid="badge-historical" className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT }}>Histórico</span>
              )}
              {event.forcedClosed && (
                <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase inline-flex items-center gap-1" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>
                  <ShieldAlert size={8} /> Fechamento Forçado
                </span>
              )}
              {/* Evento que ainda não abriu (futuro / próximo ciclo): selo único "Abre em DD/MM" ou "Próximo ciclo" — sem "Não confirmado". */}
              {event.resultsConfirmed ? (
                <span data-testid="badge-results-confirmed" className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>Resultados Confirmados</span>
              ) : waiting ? null : (
                <span data-testid="badge-results-pending" className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>Não Confirmado</span>
              )}
              {waiting && (
                <span data-testid="badge-event-opens" title={nextCycle ? NEXT_CYCLE_NOTICE : "A avaliação abre sozinha no dia seguinte ao fim do evento."} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ background: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                  <CalendarClock size={10} aria-hidden /> {opensLabel}
                </span>
              )}
            </div>
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--muted-foreground)" }}>
              {[event.clientName, event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location].filter(Boolean).join(" · ")}
              {" · "}
              {fmtDate(event.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} — {fmtDate(event.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
            {notOpenYet && (
              <p id="event-confirm-opens-reason" className="text-[12px] mt-1" style={{ color: "var(--muted-foreground)" }} data-testid="event-opens-help">
                A avaliação abre sozinha no dia seguinte ao fim do evento.
              </p>
            )}
          </div>
          {/* Celular: atalhos dividem a linha e o botão principal vem embaixo,
              na largura toda (antes "Confirmar Resultados" saía cortado). */}
          <div className="flex flex-wrap gap-2 items-center w-full max-w-full sm:w-auto sm:shrink-0">
            {/* Próximo ciclo: a Central continua aberta para preparar critérios e responsáveis. */}
            {!readOnly && <Link
              href={`/evaluations?eventId=${event.id}`}
              data-testid="link-event-evaluations"
              title={nextCycle ? "Critérios e responsáveis deste evento (as avaliações abrem quando o ciclo novo for criado)" : "Critérios, avaliadores e avaliações deste evento"}
              className="h-9 px-3 sm:px-4 rounded-lg text-[11px] font-bold uppercase flex flex-1 sm:flex-none justify-center items-center gap-1.5 whitespace-nowrap transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              Avaliações
            </Link>}
            {!readOnly && <Link
              href={`/calibrations?eventId=${event.id}`}
              data-testid="link-event-calibrations"
              title="Calibrar e publicar as notas deste evento"
              className="h-9 px-3 sm:px-4 rounded-lg text-[11px] font-bold uppercase flex flex-1 sm:flex-none justify-center items-center gap-1.5 whitespace-nowrap transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              Calibração
            </Link>}
            {canSeeTimeline && (
              <Link
                href={`/linha-do-tempo?evento=${event.id}`}
                data-testid="link-event-timeline"
                title="O que este evento mudou nas notas, dia a dia"
                className="h-9 px-3 sm:px-4 rounded-lg text-[11px] font-bold uppercase flex flex-1 sm:flex-none justify-center items-center gap-1.5 whitespace-nowrap transition-colors hover:opacity-80"
                style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
              >
                Linha do tempo
              </Link>
            )}
            {canManage && (
              event.resultsConfirmed ? (
                <button
                  data-testid="button-unconfirm-results"
                  onClick={() => setResultsDialog("unconfirm")}
                  disabled={resultsConfirmBusy}
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase flex w-full sm:w-auto justify-center items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: WARNING, color: "#fff" }}
                >
                  <Unlock size={13} /> {resultsConfirmBusy ? "Revertendo..." : "Desconfirmar Resultados"}
                </button>
              ) : (
                <button
                  data-testid="button-confirm-results"
                  onClick={() => setResultsDialog("confirm")}
                  disabled={resultsConfirmBusy || !!confirmBlockedReason}
                  title={confirmBlockedReason ?? undefined}
                  aria-describedby={nextCycle ? "event-next-cycle-reason" : notOpenYet ? "event-confirm-opens-reason" : undefined}
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase flex w-full sm:w-auto justify-center items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                  // Bloqueado (próximo ciclo / ainda não abriu): cinza neutro — o verde-limão a 50% ainda parecia clicável no escuro.
                  style={confirmBlockedReason
                    ? { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }
                    : { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <CheckCircle2 size={13} /> {resultsConfirmBusy ? "Confirmando..." : "Confirmar Resultados"}
                </button>
              )
            )}
          </div>
        </div>
        {!readOnly && nextCycle && (
          <p id="event-next-cycle-reason" data-testid="event-next-cycle-reason" role="status" className="mt-3 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px]" style={{ backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
            <Info size={14} aria-hidden className="mt-[2px] shrink-0" />
            <span>{NEXT_CYCLE_NOTICE}</span>
          </p>
        )}
        {readOnly && readOnlyCycle && (
          <div role="status" data-testid="event-readonly-notice" className="mt-3 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px]"
            style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            <Lock size={14} aria-hidden className="mt-[2px] shrink-0" style={{ color: "var(--foreground)" }} />
            <span>
              <strong className="mr-1.5 font-bold uppercase text-[11.5px]" style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", color: "var(--foreground)" }}>
                {readOnlyCycle.status === "closed" ? "Ciclo fechado — só consulta" : "Ciclo anterior — só consulta"}
              </strong>
              Este evento é do ciclo <strong style={{ color: "var(--foreground)" }}>{readOnlyCycle.name}</strong>. Equipe, matriz, avaliações e confirmação não mudam mais por aqui.
            </span>
          </div>
        )}
      </div>

      {/* Confirmar/desconfirmar resultados muda elegibilidade e bônus de todos: pede confirmação */}
      <Dialog open={resultsDialog !== null} onOpenChange={(o) => { if (!o && !resultsConfirmBusy) setResultsDialog(null); }}>
        <DialogContent className="max-w-md" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
              {resultsDialog === "confirm" ? "Confirmar resultados" : "Desconfirmar resultados"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {resultsDialog === "confirm"
              ? "Este evento passa a contar na elegibilidade e na nota de todos os participantes. O ciclo é recalculado agora."
              : "Este evento deixa de contar na elegibilidade e na nota dos participantes. O ciclo é recalculado agora e o bônus projetado pode mudar."}
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setResultsDialog(null)} disabled={resultsConfirmBusy} className="h-9 px-4 rounded-lg text-[11px] font-bold uppercase disabled:opacity-50" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
            <button
              type="button"
              disabled={resultsConfirmBusy}
              onClick={onSubmitResultsDialog}
              className="h-9 px-4 rounded-lg text-[11px] font-black uppercase disabled:opacity-50"
              style={resultsDialog === "confirm" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { backgroundColor: WARNING, color: "#fff" }}
            >
              {resultsConfirmBusy ? "Aguarde..." : resultsDialog === "confirm" ? "Confirmar" : "Desconfirmar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
