import type { Event } from "@workspace/api-client-react";
import { CheckCircle, Clock, Building2, Target, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDENSED, AMBER, INFO, AMBER_TEXT, INFO_TEXT } from "@/lib/premium-theme";
import type { EvalTab, EvaluatorEventStat } from "./types";

interface EvaluatorSidebarProps {
  isEvaluator: boolean;
  selectedEventId: number | null;
  evaluatorEventStats: EvaluatorEventStat[];
  todoEvents: Event[];
  publishedNotDoneEvents: Event[];
  doneEvents: Event[];
  configuredEventsCount: number;
  relevantEventsCount: number;
  // Troca a aba ativa, seleciona o evento e limpa notas/comentários/áudios locais.
  onSelectEvent: (tab: EvalTab, eventId: number) => void;
}

// Sidebar do avaliador: lista compacta A Fazer / Publicado / Concluídas.
export function EvaluatorSidebar({
  isEvaluator, selectedEventId, evaluatorEventStats, todoEvents, publishedNotDoneEvents, doneEvents,
  configuredEventsCount, relevantEventsCount, onSelectEvent,
}: EvaluatorSidebarProps) {
  return (
    <aside className="w-72 shrink-0 bg-card border-r border-border flex flex-col overflow-hidden">

      {/* Evaluator: lista compacta A Fazer / Concluídas */}
      {isEvaluator && (
        <div className="flex-1 overflow-y-auto">
          {/* Cabeçalho da sidebar do avaliador */}
          <div className="bg-secondary px-4 py-2.5 flex items-center justify-between border-b border-border">
            <span className="text-[11px] font-black uppercase tracking-widest text-accent-text flex items-center gap-1.5" style={{ fontFamily: CONDENSED }}>
              <Target size={11} /> Minhas Avaliações
            </span>
            {evaluatorEventStats.length > 0 && (
              <span className="text-[11px] font-black text-muted-foreground tabular-nums">
                {doneEvents.length}<span className="opacity-60">/{evaluatorEventStats.length}</span>
              </span>
            )}
          </div>
          {configuredEventsCount === 0 ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 bg-secondary border border-border rounded-lg flex items-center justify-center mx-auto">
                <Clock size={18} className="text-muted-foreground" />
              </div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Nenhum evento liberado no momento.</p>
            </div>
          ) : relevantEventsCount === 0 ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 bg-secondary border border-border rounded-lg flex items-center justify-center mx-auto">
                <Building2 size={18} className="text-muted-foreground" />
              </div>
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Nenhuma avaliação atribuída à sua área.</p>
            </div>
          ) : (
            <>
              {todoEvents.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: AMBER_TEXT }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: AMBER }} /> A Fazer
                    </span>
                    <span className="text-[11px] font-black text-muted-foreground">{todoEvents.length}</span>
                  </div>
                  {todoEvents.map(ev => {
                    const stats = evaluatorEventStats.find(s => s.event.id === ev.id);
                    const pct = stats && stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
                    const active = selectedEventId === ev.id;
                    return (
                      <button key={ev.id} type="button" data-testid={`evaluator-event-${ev.id}`}
                        onClick={() => onSelectEvent("todo", ev.id)}
                        className={cn("w-full text-left px-4 py-3 border-l-4 border-b border-border flex flex-col gap-1.5 transition-colors", active ? "bg-secondary" : "hover:bg-secondary/60")}
                        style={{ borderLeftColor: AMBER }}
                      >
                        <span className={cn("text-[11px] font-black uppercase leading-snug truncate", active ? "text-foreground" : "text-muted-foreground")}>{ev.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, transition: "width 0.3s", backgroundColor: AMBER }} />
                          </div>
                          <span className="text-[11px] font-black text-muted-foreground shrink-0 tabular-nums">{stats?.submitted ?? 0}/{stats?.total ?? 0}</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
              {publishedNotDoneEvents.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1" style={{ color: INFO_TEXT }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: INFO }} /> Publicado
                    </span>
                    <span className="text-[11px] font-black text-muted-foreground">{publishedNotDoneEvents.length}</span>
                  </div>
                  {publishedNotDoneEvents.map(ev => {
                    const isFinal = (ev as { feedbackReleased?: boolean }).feedbackReleased;
                    const active = selectedEventId === ev.id;
                    return (
                      <button key={ev.id} type="button" data-testid={`evaluator-event-published-${ev.id}`}
                        onClick={() => onSelectEvent("todo", ev.id)}
                        className={cn("w-full text-left px-4 py-3 border-l-4 border-b border-border flex flex-col gap-1.5 transition-colors", active ? "bg-secondary" : "opacity-80 hover:opacity-100 hover:bg-secondary/60")}
                        style={{ borderLeftColor: INFO }}
                      >
                        <span className="text-[11px] font-black uppercase leading-snug truncate text-foreground">{ev.name}</span>
                        <span className="text-[11px] font-black uppercase flex items-center gap-1" style={{ color: INFO_TEXT }}>
                          {isFinal ? <><CheckCircle size={9} /> Feedback final publicado</> : <><Send size={9} /> Publicação parcial</>}
                        </span>
                      </button>
                    );
                  })}
                </>
              )}
              {doneEvents.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-widest text-accent-text flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-accent" /> Concluídas
                    </span>
                    <span className="text-[11px] font-black text-muted-foreground">{doneEvents.length}</span>
                  </div>
                  {doneEvents.map(ev => {
                    const active = selectedEventId === ev.id;
                    return (
                      <button key={ev.id} type="button" data-testid={`evaluator-event-done-${ev.id}`}
                        onClick={() => onSelectEvent("done", ev.id)}
                        className={cn("w-full text-left px-4 py-3 border-l-4 border-l-accent border-b border-border flex flex-col gap-1.5 transition-colors", active ? "bg-accent/10" : "opacity-75 hover:opacity-100 hover:bg-accent/10")}
                      >
                        <span className="text-[11px] font-black uppercase leading-snug truncate text-accent-text">{ev.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-accent/25 overflow-hidden">
                            <div className="h-full bg-accent" style={{ width: "100%" }} />
                          </div>
                          <span className="text-[11px] font-black text-accent-text shrink-0">100%</span>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
              {todoEvents.length === 0 && doneEvents.length === 0 && (
                <div className="p-6 text-center text-[11px] font-bold uppercase text-muted-foreground">Nenhuma avaliação.</div>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  );
}
