// "Seus eventos": alternância Todos / Avaliados / Em avaliação, busca, aviso
// dos eventos que esperam a confirmação do RH e a lista (cartões que abrem).
import type { ComponentType } from "react";
import { CalendarDays, CalendarX2, CheckCircle2, Clock, Hourglass, SearchX } from "lucide-react";
import { plural } from "@/lib/utils";
import { EventCard } from "./event-card";
import { Notice, SearchField, Section, Segmented, btnGhost } from "./mp-ui";
import type { EventFilters } from "./use-event-filters";
import type { EventSummary, StatusFilter } from "./types";

export function EventHistory({ filters, events, cycleName }: {
  filters: EventFilters;
  events: EventSummary[];
  cycleName: string;
}) {
  const { eventFilter, setEventFilter, statusFilter, setStatusFilter, pendingConfirmationCount, filteredEvents } = filters;
  const confirmed = (events ?? []).filter(ev => ev.resultsConfirmed).length;
  return (
    <Section id="mp-events" icon={CalendarDays} title="Seus eventos" testId="my-events"
      hint={confirmed > 0 ? `${plural(confirmed, "evento", "eventos")} com resultado confirmado neste ciclo. Toque num evento para ver a nota de cada critério.` : undefined}>
      <div className="space-y-3">
        {confirmed > 0 && (
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Segmented<StatusFilter>
              label="Mostrar eventos"
              value={statusFilter}
              onChange={setStatusFilter}
              size="sm"
              className="sm:w-[360px] shrink-0"
              options={[
                { value: "all", label: "Todos", testId: "filter-events-all" },
                { value: "avaliado", label: "Avaliados", testId: "filter-events-done" },
                { value: "em_avaliacao", label: "Em avaliação", testId: "filter-events-open" },
              ]}
            />
            <SearchField value={eventFilter} onChange={setEventFilter} label="Buscar evento por nome, cidade ou UF" placeholder="Buscar evento ou cidade" testId="input-search-my-events" className="flex-1 sm:max-w-[360px]" />
          </div>
        )}
        {pendingConfirmationCount > 0 && (
          <Notice icon={Clock} tone="neutral" testId="text-pending-confirmation">
            {pendingConfirmationCount === 1
              ? <><span className="font-semibold text-foreground">1 evento esperando o RH confirmar o resultado.</span> Ele entra na lista e na nota depois da confirmação.</>
              : <><span className="font-semibold text-foreground">{pendingConfirmationCount} eventos esperando o RH confirmar o resultado.</span> Eles entram na lista e na nota depois da confirmação.</>}
          </Notice>
        )}
        {filteredEvents.length === 0 ? (
          <EmptyHistory events={events} eventFilter={eventFilter} statusFilter={statusFilter} cycleName={cycleName}
            onReset={() => { setEventFilter(""); setStatusFilter("all"); }} />
        ) : (
          <div className="space-y-3">
            {filteredEvents.map(ev => <EventCard key={ev.eventId} event={ev} />)}
          </div>
        )}
      </div>
    </Section>
  );
}

/** Vazio com a explicação certa para cada combinação de filtro/ciclo. */
function EmptyHistory({ events, eventFilter, statusFilter, cycleName, onReset }: {
  events: EventSummary[]; eventFilter: string; statusFilter: StatusFilter; cycleName: string; onReset: () => void;
}) {
  const confirmedCount = (events ?? []).filter(ev => ev.resultsConfirmed).length;
  const totalCount = (events ?? []).length;
  let Icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }> = SearchX;
  let title = "Nenhum evento encontrado";
  let detail = "";
  let reset = false;
  if (eventFilter) {
    title = `Nada encontrado para “${eventFilter}”`;
    detail = "Tente outro nome ou cidade.";
    reset = true;
  } else if (statusFilter === "avaliado") {
    title = "Nenhum evento com nota final ainda";
    detail = confirmedCount > 0 ? "Seus eventos confirmados ainda estão com as notas dos critérios sendo finalizadas." : "As avaliações deste ciclo estão em andamento.";
    Icon = Hourglass;
    reset = true;
  } else if (statusFilter === "em_avaliacao") {
    title = "Nenhum evento em avaliação";
    detail = "Todos os seus eventos confirmados já têm nota final.";
    Icon = CheckCircle2;
    reset = true;
  } else if (confirmedCount === 0 && totalCount > 0) {
    title = "Resultados ainda não confirmados";
    detail = `Você tem ${plural(totalCount, "evento", "eventos")} no ciclo. As notas aparecem aqui depois que o RH confirmar os resultados.`;
    Icon = Clock;
  } else if (totalCount === 0) {
    title = "Nenhum evento neste ciclo";
    detail = `Você ainda não participou de eventos no ciclo ${cycleName}. Quando participar, eles aparecem aqui.`;
    Icon = CalendarX2;
  }
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center" data-testid="my-events-empty">
      <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Icon size={20} aria-hidden /></span>
      <p className="mt-3 font-condensed text-[19px] font-black uppercase leading-tight text-foreground">{title}</p>
      {detail && <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground max-w-sm mx-auto">{detail}</p>}
      {reset && <button type="button" onClick={onReset} className={`${btnGhost} mt-3`}>Ver todos os eventos</button>}
    </div>
  );
}
