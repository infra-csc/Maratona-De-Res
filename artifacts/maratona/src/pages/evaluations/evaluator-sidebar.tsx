import type { MyAreaEvaluations, MyAreaEvent } from "@workspace/api-client-react";
import { CheckCircle, Clock, Building2, Target, Send, Search, X, Loader2, ClipboardList, PanelLeftClose, PanelLeftOpen, CalendarClock, ChevronDown } from "lucide-react";
import { cn, fmtDate, fmtOpensOn, todayBR, plural } from "@/lib/utils";
import { fmtEventDate } from "../events/rules";
import { CONDENSED, AMBER, INFO, AMBER_TEXT, INFO_TEXT } from "@/lib/premium-theme";
import { PERIOD_LABELS, type PeriodFilter, type StatusFilter } from "./use-my-area";

interface EvaluatorSidebarProps {
  data: MyAreaEvaluations | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  onRetry: () => void;
  selectedEventId: number | null;
  onSelectEvent: (eventId: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  period: PeriodFilter;
  onPeriodChange: (value: PeriodFilter) => void;
  /** No celular, a lista some quando há um evento aberto (volta pelo "← Eventos"). */
  hiddenOnMobile: boolean;
  /** Desktop: a lista vira um trilho estreito para dar espaço ao formulário. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "pending", label: "A responder" },
  { value: "done", label: "Respondidos" },
  { value: "all", label: "Todos" },
];

function place(ev: MyAreaEvent): string {
  return [ev.clientName, ev.city ? `${ev.city}${ev.state ? `/${ev.state}` : ""}` : ev.location].filter(Boolean).join(" · ");
}

function EventItem({ ev, active, kind, onSelect }: { ev: MyAreaEvent; active: boolean; kind: "todo" | "published" | "done"; onSelect: () => void }) {
  const total = ev.totalCriteria;
  const pct = total > 0 ? Math.round((ev.answeredCount / total) * 100) : ev.pending ? 0 : 100;
  const color = kind === "todo" ? AMBER : kind === "published" ? INFO : "var(--accent)";
  const testId = kind === "todo" ? `evaluator-event-${ev.id}` : kind === "published" ? `evaluator-event-published-${ev.id}` : `evaluator-event-done-${ev.id}`;
  const where = place(ev);
  return (
    <button
      type="button"
      data-testid={testId}
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={cn("w-full text-left px-4 py-3 border-l-4 border-b border-border flex flex-col gap-1 transition-colors", active ? "bg-secondary" : "hover:bg-secondary/60")}
      style={{ borderLeftColor: color }}
    >
      <span className="text-[13px] font-black uppercase leading-snug text-foreground line-clamp-2" style={{ fontFamily: CONDENSED }}>{ev.name}</span>
      <span className="text-[11px] text-muted-foreground truncate">
        {fmtDate(ev.startDate)}{where ? ` · ${where}` : ""}
      </span>
      <div className="flex items-center gap-2 mt-0.5">
        <div className="flex-1 h-1.5 bg-muted-foreground/20 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, transition: "width 0.3s", backgroundColor: color }} />
        </div>
        <span className="text-[11px] font-black text-muted-foreground shrink-0 tabular-nums">{ev.answeredCount}/{total}</span>
      </div>
      {(ev.draftCount > 0 || ev.conformityPending || kind === "published") && (
        <div className="flex flex-wrap items-center gap-1.5">
          {kind === "published" && (
            <span className="text-[11px] font-bold uppercase flex items-center gap-1" style={{ color: INFO_TEXT }}>
              {ev.published === "final" ? <><CheckCircle size={10} /> Feedback final publicado</> : <><Send size={10} /> Publicação parcial</>}
            </span>
          )}
          {ev.draftCount > 0 && (
            <span className="text-[11px] font-bold uppercase" style={{ color: AMBER_TEXT }}>
              {ev.draftCount === 1 ? "1 rascunho" : `${ev.draftCount} rascunhos`}
            </span>
          )}
          {ev.conformityPending && (
            <span className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1"><ClipboardList size={10} /> Matriz pendente</span>
          )}
        </div>
      )}
    </button>
  );
}

/**
 * "Abrem em breve" (recolhida): eventos do avaliador que ainda não abriram
 * para avaliação — nome, data e "Abre em DD/MM". Só informação: sem link
 * para avaliar (a avaliação abre sozinha no dia seguinte ao fim do evento).
 */
function UpcomingSection({ upcoming }: { upcoming: NonNullable<MyAreaEvaluations["upcoming"]> }) {
  if (upcoming.length === 0) return null;
  const today = todayBR();
  return (
    <details className="group border-t border-border" data-testid="evaluator-upcoming">
      <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-2 hover:bg-secondary/60 [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: INFO_TEXT }}>
          <CalendarClock size={12} aria-hidden /> Abrem em breve
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
          {upcoming.length}
          <ChevronDown size={14} aria-hidden className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <p className="px-4 pb-2 text-[11px] text-muted-foreground leading-snug">
        {plural(upcoming.length, "evento seu ainda não abriu", "eventos seus ainda não abriram")}: a avaliação abre sozinha no dia seguinte ao fim de cada um.
      </p>
      <ul className="pb-2">
        {upcoming.map(u => {
          const sameDay = !u.endDate || u.endDate === u.startDate;
          const when = u.startDate ? (sameDay ? fmtEventDate(u.startDate, today) : `${fmtEventDate(u.startDate, today)}–${fmtEventDate(u.endDate, today)}`) : "—";
          return (
            <li key={u.eventId} className="px-4 py-2 border-l-4 flex items-start justify-between gap-2" style={{ borderLeftColor: "var(--status-info-text)" }} data-testid={`evaluator-upcoming-${u.eventId}`}>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-black uppercase leading-snug text-foreground break-words" style={{ fontFamily: CONDENSED }}>{u.eventName}</span>
                <span className="text-[11px] text-muted-foreground">{when}</span>
              </span>
              {u.opensOn && (
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase whitespace-nowrap" style={{ fontFamily: CONDENSED, backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                  Abre em {fmtOpensOn(u.opensOn, today)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function SectionTitle({ label, count, color, textColor }: { label: string; count: number; color: string; textColor: string }) {
  return (
    <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
      <h2 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: textColor }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} /> {label}
      </h2>
      <span className="text-[11px] font-black text-muted-foreground">{count}</span>
    </div>
  );
}

// Barra lateral do avaliador: busca (evento, cliente, cidade), filtro
// A responder / Respondidos / Todos e período — tudo filtrado no servidor.
export function EvaluatorSidebar({
  data, isLoading, isFetching, error, onRetry, selectedEventId, onSelectEvent,
  search, onSearchChange, status, onStatusChange, period, onPeriodChange, hiddenOnMobile, collapsed, onToggleCollapsed,
}: EvaluatorSidebarProps) {
  const events = data?.events ?? [];
  const pendingTodo = events.filter(e => e.pending && !e.published);
  const pendingPublished = events.filter(e => e.pending && !!e.published);
  const done = events.filter(e => !e.pending);
  const totals = data?.totals;
  const filtering = search.trim() !== "" || period !== "cycle";

  // Recolhida (desktop, com um evento aberto): trilho estreito com o botão de
  // abrir a lista e o número de eventos a responder.
  if (collapsed) {
    return (
      <aside aria-label="Eventos para avaliar" className="hidden md:flex md:sticky md:top-0 md:self-start md:h-[100dvh] w-14 shrink-0 bg-card border-r border-border flex-col items-center gap-3 py-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-label="Mostrar a lista de eventos"
          title="Mostrar a lista de eventos"
          data-testid="button-expand-event-list"
          className="w-10 h-10 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-secondary"
        >
          <PanelLeftOpen size={18} aria-hidden />
        </button>
        {totals && totals.pending > 0 && (
          <span className="text-[11px] font-black tabular-nums rounded-full px-2 py-0.5" style={{ backgroundColor: "rgba(232,162,61,0.15)", color: AMBER_TEXT }} title={`${totals.pending} a responder`}>
            {totals.pending}
          </span>
        )}
        <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground [writing-mode:vertical-rl] rotate-180 mt-1" style={{ fontFamily: CONDENSED }}>
          Eventos
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Eventos para avaliar"
      className={cn(
        "w-full md:w-80 shrink-0 bg-card border-b md:border-b-0 md:border-r border-border flex-col overflow-hidden md:sticky md:top-0 md:self-start md:h-[100dvh]",
        hiddenOnMobile ? "hidden md:flex" : "flex flex-1 md:flex-none",
      )}
    >
      {/* Cabeçalho + filtros */}
      <div className="border-b border-border bg-card">
        <div className="bg-secondary px-4 py-2.5 flex items-center justify-between gap-2 border-b border-border">
          <span className="text-[11px] font-black uppercase tracking-widest text-accent-text flex items-center gap-1.5 shrink-0" style={{ fontFamily: CONDENSED }}>
            <Target size={11} /> Minhas Avaliações
          </span>
          <div className="flex items-center gap-2 min-w-0">
            {data?.areaName && (
              <span className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1 truncate" title={`Sua área no cadastro: ${data.areaName}`}>
                <Building2 size={11} className="shrink-0" /> <span className="truncate">{data.areaName}</span>
              </span>
            )}
            {selectedEventId != null && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded={true}
                aria-label="Recolher a lista de eventos"
                title="Recolher a lista de eventos"
                data-testid="button-collapse-event-list"
                className="hidden md:flex shrink-0 w-8 h-8 rounded-md items-center justify-center text-muted-foreground hover:text-foreground hover:bg-card"
              >
                <PanelLeftClose size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>
        <div className="p-3 space-y-2.5">
          <div className="relative">
            <label htmlFor="evaluator-search" className="sr-only">Buscar evento, cliente ou cidade</label>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
            <input
              id="evaluator-search"
              type="search"
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Buscar evento, cliente ou cidade"
              className="w-full h-10 rounded-lg border border-border bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button type="button" onClick={() => onSearchChange("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <div role="group" aria-label="Filtrar por situação" className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-secondary border border-border">
            {STATUS_TABS.map(t => {
              const n = t.value === "pending" ? totals?.pending : t.value === "done" ? totals?.done : undefined;
              const on = status === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={on}
                  data-testid={`filter-status-${t.value}`}
                  onClick={() => onStatusChange(t.value)}
                  className={cn(
                    "h-8 rounded-md text-[11px] font-black uppercase tracking-wide transition-colors flex items-center justify-center gap-1",
                    on ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {n != null && <span className={cn("tabular-nums", on ? "text-accent-text" : "")}>{n}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="evaluator-period" className="text-[11px] font-bold uppercase text-muted-foreground shrink-0">Período</label>
            <select
              id="evaluator-period"
              value={period}
              onChange={e => onPeriodChange(e.target.value as PeriodFilter)}
              className="flex-1 h-8 rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
            {isFetching && !isLoading && <Loader2 size={14} className="animate-spin text-muted-foreground shrink-0" aria-label="Atualizando" />}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto min-h-[200px]" aria-busy={isLoading}>
        {isLoading ? (
          <div className="p-4 space-y-3" role="status" aria-live="polite">
            <span className="sr-only">Carregando eventos…</span>
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-secondary animate-pulse" aria-hidden />)}
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3" role="alert">
            <p className="text-sm font-bold text-destructive">Não foi possível carregar seus eventos.</p>
            <p className="text-xs text-muted-foreground">{error.message}</p>
            <button
              type="button"
              onClick={onRetry}
              data-testid="button-retry-event-list"
              className="border border-border rounded-lg bg-card px-4 py-2 font-bold text-xs uppercase tracking-wider hover:bg-secondary"
            >
              Tentar de novo
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <div className="w-10 h-10 bg-secondary border border-border rounded-lg flex items-center justify-center mx-auto">
              {status === "pending" && !filtering ? <CheckCircle size={18} className="text-accent-text" /> : <Clock size={18} className="text-muted-foreground" />}
            </div>
            <p className="text-sm font-bold text-foreground">
              {filtering
                ? "Nenhum evento encontrado com esses filtros."
                : status === "pending"
                  ? "Nada a responder agora."
                  : status === "done"
                    ? "Nenhum evento respondido ainda."
                    : data?.areaId == null
                      ? "Sem área no cadastro e sem designação."
                      : "Nenhum evento liberado para a sua área."}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {filtering
                ? "Ajuste a busca ou o período."
                : status === "pending"
                  ? "Cada evento aparece no dia seguinte à realização."
                  : data?.areaId == null && status === "all"
                    ? "Peça ao RH para definir a sua área no cadastro de usuários."
                    : "O que você ou sua área responder aparece aqui."}
            </p>
          </div>
        ) : (
          <>
            {pendingTodo.length > 0 && (
              <section>
                <SectionTitle label="A responder" count={pendingTodo.length} color={AMBER} textColor={AMBER_TEXT} />
                {pendingTodo.map(ev => <EventItem key={ev.id} ev={ev} kind="todo" active={selectedEventId === ev.id} onSelect={() => onSelectEvent(ev.id)} />)}
              </section>
            )}
            {pendingPublished.length > 0 && (
              <section>
                <SectionTitle label="Publicado" count={pendingPublished.length} color={INFO} textColor={INFO_TEXT} />
                {pendingPublished.map(ev => <EventItem key={ev.id} ev={ev} kind="published" active={selectedEventId === ev.id} onSelect={() => onSelectEvent(ev.id)} />)}
              </section>
            )}
            {done.length > 0 && (
              <section>
                <SectionTitle label="Respondidos" count={done.length} color="var(--accent)" textColor="var(--accent-text)" />
                {done.map(ev => <EventItem key={ev.id} ev={ev} kind="done" active={selectedEventId === ev.id} onSelect={() => onSelectEvent(ev.id)} />)}
              </section>
            )}
          </>
        )}
        {!isLoading && !error && <UpcomingSection upcoming={data?.upcoming ?? []} />}
      </div>
    </aside>
  );
}
