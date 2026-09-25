// Cabeçalho do evento (nome, badges, local/datas, atalhos para Avaliações e
// Calibração, confirmar/desconfirmar resultados) e o diálogo de confirmação.
// Estado do diálogo e mutações ficam na página; aqui só a apresentação.
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, ShieldAlert, Unlock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/utils";
import { CONDENSED, WARNING, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import type { EventDetail, ResultsDialogMode, SetState } from "./types";

export type EventHeaderProps = {
  event: EventDetail;
  canManage: boolean;
  resultsConfirmBusy: boolean;
  resultsDialog: ResultsDialogMode;
  setResultsDialog: SetState<ResultsDialogMode>;
  /** Dispara confirmar/desconfirmar conforme o modo aberto no diálogo. */
  onSubmitResultsDialog: () => void;
};

export function EventHeader({ event, canManage, resultsConfirmBusy, resultsDialog, setResultsDialog, onSubmitResultsDialog }: EventHeaderProps) {
  return (
    <>
      {/* ── Header ── */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/events" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase mb-2.5 transition-colors hover:opacity-70" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={12} /> Eventos
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 data-testid="text-event-name" className="font-black uppercase text-2xl tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>{event.name}</h1>
              {event.isHistorical && (
                <span data-testid="badge-historical" className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT }}>Histórico</span>
              )}
              {event.forcedClosed && (
                <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase inline-flex items-center gap-1" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>
                  <ShieldAlert size={8} /> Fechamento Forçado
                </span>
              )}
              {event.resultsConfirmed ? (
                <span data-testid="badge-results-confirmed" className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>Resultados Confirmados</span>
              ) : (
                <span data-testid="badge-results-pending" className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>Não Confirmado</span>
              )}
            </div>
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--muted-foreground)" }}>
              {[event.clientName, event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location].filter(Boolean).join(" · ")}
              {" · "}
              {fmtDate(event.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} — {fmtDate(event.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            <Link
              href={`/evaluations?eventId=${event.id}`}
              data-testid="link-event-evaluations"
              title="Critérios, avaliadores e avaliações deste evento"
              className="h-9 px-4 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              Avaliações
            </Link>
            <Link
              href={`/calibrations?eventId=${event.id}`}
              data-testid="link-event-calibrations"
              title="Calibrar e publicar as notas deste evento"
              className="h-9 px-4 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              Calibração
            </Link>
            {canManage && (
              event.resultsConfirmed ? (
                <button
                  data-testid="button-unconfirm-results"
                  onClick={() => setResultsDialog("unconfirm")}
                  disabled={resultsConfirmBusy}
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: WARNING, color: "#fff" }}
                >
                  <Unlock size={13} /> {resultsConfirmBusy ? "Revertendo..." : "Desconfirmar Resultados"}
                </button>
              ) : (
                <button
                  data-testid="button-confirm-results"
                  onClick={() => setResultsDialog("confirm")}
                  disabled={resultsConfirmBusy}
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <CheckCircle2 size={13} /> {resultsConfirmBusy ? "Confirmando..." : "Confirmar Resultados"}
                </button>
              )
            )}
          </div>
        </div>
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
