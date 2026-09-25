import { Calendar, Clock, Search } from "lucide-react";
import { EventCard } from "./event-card";
import type { EventFilters } from "./use-event-filters";
import type { EventSummary, StatusFilter } from "./types";

/** "Histórico de Eventos": filtro de status, busca, aviso de pendentes e lista. */
export function EventHistory({ filters, events, cycleName }: {
  filters: EventFilters;
  events: EventSummary[];
  cycleName: string;
}) {
  const { eventFilter, setEventFilter, statusFilter, setStatusFilter, pendingConfirmationCount, filteredEvents } = filters;
  return (
    <div>
      <div className="flex flex-col gap-3 mb-[14px]">
        <h3 className="font-black text-[16px] uppercase flex items-center gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>
          <Calendar size={18} /> Histórico de Eventos
        </h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex rounded-lg overflow-hidden flex-1 sm:flex-none" style={{ border: "1px solid var(--border)" }}>
            {[
              { key: "all", label: "Todos" },
              { key: "avaliado", label: "Avaliados" },
              { key: "em_avaliacao", label: "Em Aval." },
            ].map(btn => (
              <button
                key={btn.key}
                onClick={() => setStatusFilter(btn.key as StatusFilter)}
                className="flex-1 sm:flex-none px-3 sm:px-[14px] py-2 text-[11px] font-bold uppercase transition-colors border-none"
                style={statusFilter === btn.key
                  ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
                  : { backgroundColor: "transparent", color: "var(--muted-foreground)" }
                }
              >
                {btn.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <Search size={12} className="text-muted-foreground shrink-0" />
            <input
              type="search"
              aria-label="Buscar evento por nome, cidade ou UF"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              placeholder="Buscar evento..."
              className="border-none bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground flex-1 min-w-0"
            />
          </div>
        </div>
        {pendingConfirmationCount > 0 && (
          <p
            data-testid="text-pending-confirmation"
            className="text-[11px] font-semibold flex items-center gap-1.5"
            title="Estes eventos só entram na sua nota e na elegibilidade depois que o RH confirmar os resultados."
            style={{ color: "var(--muted-foreground)" }}
          >
            <Clock size={12} className="shrink-0" aria-hidden="true" />
            {pendingConfirmationCount} evento(s) aguardando confirmação do RH — ainda não aparecem na lista nem contam na nota.
          </p>
        )}
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyHistory events={events} eventFilter={eventFilter} statusFilter={statusFilter} cycleName={cycleName} />
      ) : (
        <div>
          {filteredEvents.map(ev => <EventCard key={ev.eventId} event={ev} />)}
        </div>
      )}
    </div>
  );
}

/** Estado vazio com a explicação certa para cada combinação de filtro/ciclo. */
function EmptyHistory({ events, eventFilter, statusFilter, cycleName }: {
  events: EventSummary[];
  eventFilter: string;
  statusFilter: StatusFilter;
  cycleName: string;
}) {
  const confirmedCount = (events ?? []).filter(ev => ev.resultsConfirmed).length;
  const totalCount = (events ?? []).length;
  let icon = "🔍";
  let title = "Nenhum evento encontrado";
  let detail = "";
  if (eventFilter) {
    title = `Sem resultados para "${eventFilter}"`;
    detail = "Tente um nome diferente ou limpe a busca.";
    icon = "🔍";
  } else if (statusFilter === "avaliado") {
    title = "Nenhum evento totalmente avaliado";
    detail = confirmedCount > 0 ? "Há eventos com resultados confirmados, mas as notas por quesito ainda estão sendo finalizadas." : "As avaliações estão em andamento neste ciclo.";
    icon = "⏳";
  } else if (statusFilter === "em_avaliacao") {
    title = "Todos os eventos já foram avaliados";
    detail = "Todos os seus eventos confirmados têm notas finalizadas. ";
    icon = "✅";
  } else if (confirmedCount === 0 && totalCount > 0) {
    title = "Resultados ainda não confirmados";
    detail = `Você tem ${totalCount} evento(s) no ciclo, mas nenhum resultado foi confirmado pelo RH ainda. As notas aparecerão aqui após a confirmação.`;
    icon = "🕐";
  } else if (totalCount === 0) {
    title = "Nenhum evento no ciclo";
    detail = `Você ainda não tem eventos registrados no ciclo ${cycleName}.`;
    icon = "📋";
  }
  return (
    <div className="rounded-xl py-16 text-center space-y-2" style={{ border: "1px dashed var(--border)" }}>
      <div className="text-3xl mb-1">{icon}</div>
      <p className="font-black text-[14px] uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{title}</p>
      {detail && <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">{detail}</p>}
    </div>
  );
}
