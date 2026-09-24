import type { Dispatch, SetStateAction } from "react";
import { ClipboardCheck } from "lucide-react";
import { CONDENSED, AMBER_TEXT } from "@/lib/premium-theme";
import { initials } from "./helpers";
import { EventCombobox } from "./pickers";
import type { ToastFn } from "./use-event-mutations";
import type { ConsoleView, EnrichedEvent, EvaluatorsScope, EventEvaluatorCard, GlobalEvaluatorCard } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Aba Avaliadores — visão global (todos os eventos do ciclo) ou por evento. */
export function EvaluatorsView(props: {
  evaluatorsScope: EvaluatorsScope;
  setEvaluatorsScope: SetState<EvaluatorsScope>;
  enrichedEvents: EnrichedEvent[];
  selected: EnrichedEvent | null;
  setSelectedEventId: SetState<number | null>;
  globalEvaluatorCards: GlobalEvaluatorCard[];
  evaluatorCards: EventEvaluatorCard[];
  toast: ToastFn;
  setEvaluatorFilter: SetState<string>;
  setView: SetState<ConsoleView>;
}) {
  const {
    evaluatorsScope, setEvaluatorsScope, enrichedEvents, selected, setSelectedEventId,
    globalEvaluatorCards, evaluatorCards, toast, setEvaluatorFilter, setView,
  } = props;
  return (
    <div>
      {/* Toggle Todos / Este Evento */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setEvaluatorsScope("all")}
            className="px-3 py-1.5 text-[11px] font-bold uppercase transition-colors"
            style={{ backgroundColor: evaluatorsScope === "all" ? "var(--primary)" : "transparent", color: evaluatorsScope === "all" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          >
            Todos os eventos
          </button>
          <button
            type="button"
            onClick={() => setEvaluatorsScope("event")}
            className="px-3 py-1.5 text-[11px] font-bold uppercase transition-colors"
            style={{ borderLeft: "1px solid var(--border)", backgroundColor: evaluatorsScope === "event" ? "var(--primary)" : "transparent", color: evaluatorsScope === "event" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
          >
            Este evento
          </button>
        </div>
        {evaluatorsScope === "event" && (
          <EventCombobox events={enrichedEvents} value={selected?.id ?? null} onChange={setSelectedEventId} />
        )}
        {evaluatorsScope === "all" && (
          <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
            {globalEvaluatorCards.length} avaliador(es) · {globalEvaluatorCards.filter(c => c.submitted < c.assigned).length} com pendência
          </span>
        )}
      </div>

      {/* ── Visão global: todos os eventos ── */}
      {evaluatorsScope === "all" ? (
        globalEvaluatorCards.length === 0 ? (
          <div className="text-center py-16 rounded-xl space-y-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="font-bold uppercase text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum avaliador atribuído no ciclo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {globalEvaluatorCards.map(av => (
              <div key={av.id} className="rounded-xl p-4 relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: av.accent }} />
                <div className="flex items-center gap-2.5 mb-3">
                  <span className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                    <span className="font-black text-[13px]" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>{initials(av.name)}</span>
                  </span>
                  <div className="min-w-0">
                    <div className="font-black uppercase text-[14.5px] leading-tight truncate" style={{ fontFamily: CONDENSED }}>{av.name}</div>
                    <div className="text-[11px] font-bold uppercase mt-0.5" style={{ color: "var(--muted-foreground)" }}>{av.submitted}/{av.assigned} critérios no ciclo</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: av.bg, color: av.color }}>{av.label}</span>
                  <span className="font-black text-xs" style={{ fontFamily: CONDENSED, color: av.color }}>{av.pct}%</span>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden mb-3" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="h-full rounded-full" style={{ width: `${av.pct}%`, background: av.accent }} />
                </div>
                {av.pendingEvents.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-bold uppercase mb-1.5" style={{ color: "var(--muted-foreground)" }}>Falta responder:</p>
                    <div className="flex flex-wrap gap-1">
                      {av.pendingEvents.map(ev => (
                        <span key={ev.id} className="text-[11px] font-bold uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT }}>{ev.name}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toast({ title: `${av.assigned - av.submitted} pendência(s) no ciclo`, description: `${av.name} ainda não enviou ${av.assigned - av.submitted} de ${av.assigned} critério(s).` })}
                    className="flex-1 rounded-lg py-2 text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Cobrar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEvaluatorFilter(av.name); setView("assign"); }}
                    className="flex-1 rounded-lg py-2 text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Ver critérios
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Visão por evento ── */
        evaluatorCards.length === 0 ? (
          <div className="text-center py-16 rounded-xl space-y-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <p className="font-bold uppercase text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum avaliador atribuído neste evento.</p>
            <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Atribua avaliadores aos critérios do evento para ver o progresso aqui.</p>
            <button
              type="button"
              onClick={() => setView("assign")}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[11px] font-bold uppercase transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <ClipboardCheck size={13} /> Ir para Atribuição
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluatorCards.map(av => (
              <div key={av.id} className="rounded-xl p-4 relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: av.accent }} />
                <div className="flex items-center gap-2.5 mb-3.5">
                  <span className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                    <span className="font-black text-[13px]" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>{initials(av.name)}</span>
                  </span>
                  <div className="min-w-0">
                    <div className="font-black uppercase text-[14.5px] leading-tight truncate" style={{ fontFamily: CONDENSED }}>{av.name}</div>
                    <div className="text-[11px] font-bold uppercase mt-0.5" style={{ color: "var(--muted-foreground)" }}>{av.area}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: av.bg, color: av.color }}>{av.label}</span>
                  <span className="font-black text-xs" style={{ fontFamily: CONDENSED, color: av.color }}>{av.submitted}/{av.assigned} neste evento</span>
                </div>
                <div className="h-[6px] rounded-full overflow-hidden mb-3.5" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="h-full rounded-full" style={{ width: `${av.pct}%`, background: av.accent }} />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => toast({ title: `${av.assigned - av.submitted} pendência(s) neste evento`, description: `${av.name} ainda não enviou ${av.assigned - av.submitted} de ${av.assigned} critério(s) atribuído(s).` })}
                    className="flex-1 rounded-lg py-2 text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Cobrar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEvaluatorFilter(av.name); setView("assign"); }}
                    className="flex-1 rounded-lg py-2 text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Ver critérios
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
