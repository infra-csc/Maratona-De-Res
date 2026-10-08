import type { MyAreaEvaluations, MyAreaEvent } from "@workspace/api-client-react";
import { CheckCircle2, Search, X, Loader2, PanelLeftClose, PanelLeftOpen, CalendarClock, ChevronDown, SearchX, AlertTriangle, RotateCw, Inbox, ShieldCheck, Clock, Send } from "lucide-react";
import { cn, fmtDate, fmtOpensOn, todayBR, plural } from "@/lib/utils";
import { fmtEventDate } from "../events/rules";
import { PERIOD_LABELS, type PeriodFilter, type StatusFilter } from "./use-my-area";
import { Chip, Eyebrow, btnSecondary } from "./ui";

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

const BAR: Record<"todo" | "published" | "done", string> = {
  todo: "bg-[var(--status-warn)]",
  published: "bg-[var(--status-info)]",
  done: "bg-accent",
};

function EventItem({ ev, active, kind, onSelect }: { ev: MyAreaEvent; active: boolean; kind: "todo" | "published" | "done"; onSelect: () => void }) {
  const total = ev.totalCriteria;
  const pct = total > 0 ? Math.round((ev.answeredCount / total) * 100) : ev.pending ? 0 : 100;
  const testId = kind === "todo" ? `evaluator-event-${ev.id}` : kind === "published" ? `evaluator-event-published-${ev.id}` : `evaluator-event-done-${ev.id}`;
  const where = place(ev);
  const hasChips = ev.draftCount > 0 || ev.conformityPending || kind === "published";
  return (
    <li>
      <button
        type="button"
        data-testid={testId}
        aria-current={active ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "group relative w-full text-left px-4 py-3.5 flex flex-col gap-1.5 transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          active ? "bg-secondary" : "hover:bg-secondary/55",
        )}
      >
        {/* Marca do item aberto */}
        <span aria-hidden className={cn("absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full transition-opacity duration-150", active ? "bg-foreground opacity-100" : "opacity-0")} />
        <span className="font-condensed text-[16px] font-black uppercase leading-[1.1] text-foreground line-clamp-2">{ev.name}</span>
        <span className="text-[13px] text-muted-foreground truncate">
          {fmtDate(ev.startDate)}{where ? ` · ${where}` : ""}
        </span>
        <span className="flex items-center gap-2.5 mt-0.5">
          <span className="flex-1 h-1.5 bg-secondary group-hover:bg-card rounded-full overflow-hidden" aria-hidden>
            <span className={cn("block h-full rounded-full transition-[width] duration-300", BAR[kind])} style={{ width: `${pct}%` }} />
          </span>
          <span className="font-condensed text-[13px] font-bold text-muted-foreground shrink-0 tabular-nums">{ev.answeredCount}/{total}</span>
        </span>
        {hasChips && (
          <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
            {kind === "published" && (
              ev.published === "final"
                ? <Chip tone="info" icon={CheckCircle2}>Feedback final publicado</Chip>
                : <Chip tone="info" icon={Send}>Publicação parcial</Chip>
            )}
            {ev.draftCount > 0 && <Chip tone="warn" icon={Clock}>{ev.draftCount === 1 ? "1 rascunho" : `${ev.draftCount} rascunhos`}</Chip>}
            {ev.conformityPending && <Chip icon={ShieldCheck}>Matriz pendente</Chip>}
          </span>
        )}
      </button>
    </li>
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
      <summary className="list-none cursor-pointer min-h-12 px-4 py-3 flex items-center justify-between gap-2 hover:bg-secondary/55 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Eyebrow as="span" className="flex items-center gap-1.5 text-[var(--status-info-text)]">
          <CalendarClock size={13} aria-hidden /> Abrem em breve
        </Eyebrow>
        <span className="flex items-center gap-1.5 font-condensed text-[13px] font-bold text-muted-foreground tabular-nums">
          {upcoming.length}
          <ChevronDown size={15} aria-hidden className="transition-transform duration-200 group-open:rotate-180" />
        </span>
      </summary>
      <p className="px-4 pb-2 text-[13px] text-muted-foreground leading-snug">
        {plural(upcoming.length, "evento seu ainda não abriu", "eventos seus ainda não abriram")}: a avaliação abre sozinha no dia seguinte ao fim de cada um.
      </p>
      <ul className="pb-2">
        {upcoming.map(u => {
          const sameDay = !u.endDate || u.endDate === u.startDate;
          const when = u.startDate ? (sameDay ? fmtEventDate(u.startDate, today) : `${fmtEventDate(u.startDate, today)}–${fmtEventDate(u.endDate, today)}`) : "—";
          return (
            <li key={u.eventId} className="px-4 py-2.5 flex items-start justify-between gap-3" data-testid={`evaluator-upcoming-${u.eventId}`}>
              <span className="min-w-0">
                <span className="block font-condensed text-[15px] font-black uppercase leading-tight text-foreground break-words">{u.eventName}</span>
                <span className="text-[13px] text-muted-foreground">{when}</span>
              </span>
              {u.opensOn && <Chip tone="info">Abre em {fmtOpensOn(u.opensOn, today)}</Chip>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function SectionTitle({ label, count, dot }: { label: string; count: number; dot: string }) {
  return (
    <div className="px-4 pt-5 pb-1.5 flex items-center justify-between">
      <h2 className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-muted-foreground flex items-center gap-2">
        <span aria-hidden className={cn("w-2 h-2 rounded-full inline-block", dot)} /> {label}
      </h2>
      <span className="font-condensed text-[13px] font-bold text-muted-foreground tabular-nums">{count}</span>
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
      <aside aria-label="Eventos para avaliar" className="hidden md:flex md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] lg:top-0 lg:h-[100dvh] md:self-start w-16 shrink-0 bg-card border-r border-border flex-col items-center gap-3 py-4">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={false}
          aria-label="Mostrar a lista de eventos"
          title="Mostrar a lista de eventos"
          data-testid="button-expand-event-list"
          className="w-11 h-11 rounded-lg border border-border bg-card flex items-center justify-center text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeftOpen size={18} aria-hidden />
        </button>
        {totals && totals.pending > 0 && (
          <span className="font-condensed min-w-7 h-7 px-1.5 rounded-full flex items-center justify-center text-[14px] font-black tabular-nums bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]" title={`${totals.pending} a responder`}>
            {totals.pending}
          </span>
        )}
        <span className="font-condensed text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground [writing-mode:vertical-rl] rotate-180 mt-1">
          Eventos
        </span>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Eventos para avaliar"
      className={cn(
        "w-full md:w-[320px] shrink-0 bg-card md:border-r border-border flex-col md:sticky md:top-14 md:h-[calc(100dvh-3.5rem)] lg:top-0 lg:h-[100dvh] md:self-start",
        hiddenOnMobile ? "hidden md:flex" : "flex flex-1 md:flex-none",
      )}
    >
      {/* Cabeçalho + filtros */}
      <div className="px-4 pt-4 pb-3 space-y-3 border-b border-border">
        <div className="flex items-center justify-between gap-2 min-h-8">
          <Eyebrow as="span" className="text-foreground">Eventos</Eyebrow>
          <div className="flex items-center gap-1.5">
            {isFetching && !isLoading && <Loader2 size={14} className="animate-spin text-muted-foreground" aria-label="Atualizando" />}
            {selectedEventId != null && (
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded={true}
                aria-label="Recolher a lista de eventos"
                title="Recolher a lista de eventos"
                data-testid="button-collapse-event-list"
                className="hidden md:flex shrink-0 w-9 h-9 rounded-lg items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PanelLeftClose size={17} aria-hidden />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <label htmlFor="evaluator-search" className="sr-only">Buscar evento, cliente ou cidade</label>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
          <input
            id="evaluator-search"
            type="search"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Buscar evento, cliente ou cidade"
            className="w-full h-11 rounded-lg border border-border bg-background pl-9 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="Limpar busca" className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary">
              <X size={15} aria-hidden />
            </button>
          )}
        </div>
        <div role="group" aria-label="Filtrar por situação" className="flex gap-1 p-1 rounded-lg bg-secondary">
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
                  "font-condensed flex-auto whitespace-nowrap min-h-10 rounded-md text-[13px] font-bold uppercase tracking-[0.03em] leading-none transition-[background-color,color,box-shadow] duration-150 flex items-center justify-center gap-1.5 px-1",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {n != null && (
                  <span className={cn("tabular-nums rounded px-1 min-w-5 h-5 inline-flex items-center justify-center text-[12px]",
                    on && t.value === "pending" && n > 0 ? "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]" : "")}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="evaluator-period" className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground shrink-0">Período</label>
          <select
            id="evaluator-period"
            value={period}
            onChange={e => onPeriodChange(e.target.value as PeriodFilter)}
            className="flex-1 h-10 rounded-lg border border-border bg-background px-2.5 text-[14px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          >
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </select>
        </div>
      </div>

      {/* Lista */}
      <div className={cn("flex-1 overflow-y-auto min-h-[200px] pb-4 transition-opacity duration-150", isFetching && !isLoading && "opacity-70")} aria-busy={isLoading || isFetching}>
        {isLoading ? (
          <div className="px-4 py-3 space-y-1" role="status" aria-live="polite">
            <span className="sr-only">Carregando eventos…</span>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="py-3 space-y-2" aria-hidden>
                <div className="h-4 w-4/5 rounded bg-secondary animate-pulse" />
                <div className="h-3 w-3/5 rounded bg-secondary animate-pulse" />
                <div className="h-1.5 w-full rounded-full bg-secondary animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-10 text-center" role="alert">
            <span className="mx-auto w-11 h-11 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] flex items-center justify-center"><AlertTriangle size={20} aria-hidden /></span>
            <p className="mt-3 text-[15px] font-semibold text-foreground">Não foi possível carregar seus eventos.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">{error.message}</p>
            <button type="button" onClick={onRetry} data-testid="button-retry-event-list" className={cn(btnSecondary, "mt-4")}>
              <RotateCw size={14} aria-hidden /> Tentar de novo
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <span className="mx-auto w-11 h-11 rounded-full flex items-center justify-center bg-secondary text-muted-foreground">
              {filtering ? <SearchX size={20} aria-hidden /> : status === "pending" ? <CheckCircle2 size={20} aria-hidden className="text-[var(--status-ok-text)]" /> : <Inbox size={20} aria-hidden />}
            </span>
            <p className="mt-3 text-[15px] font-semibold text-foreground">
              {filtering
                ? "Nenhum evento encontrado com esses filtros."
                : status === "pending"
                  ? "Tudo em dia"
                  : status === "done"
                    ? "Nenhum evento respondido ainda."
                    : data?.areaId == null
                      ? "Sem área no cadastro e sem designação."
                      : "Nenhum evento liberado para a sua área."}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
              {filtering
                ? "Ajuste a busca ou o período."
                : status === "pending"
                  ? "Cada evento aparece no dia seguinte à realização."
                  : data?.areaId == null && status === "all"
                    ? "Peça ao RH para definir a sua área no cadastro de usuários."
                    : "O que você ou sua área responder aparece aqui."}
            </p>
            {filtering && (
              <button type="button" onClick={() => { onSearchChange(""); onPeriodChange("cycle"); }} className={cn(btnSecondary, "mt-4")}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {pendingTodo.length > 0 && (
              <section>
                <SectionTitle label="A responder" count={pendingTodo.length} dot="bg-[var(--status-warn)]" />
                <ul className="divide-y divide-border">{pendingTodo.map(ev => <EventItem key={ev.id} ev={ev} kind="todo" active={selectedEventId === ev.id} onSelect={() => onSelectEvent(ev.id)} />)}</ul>
              </section>
            )}
            {pendingPublished.length > 0 && (
              <section>
                <SectionTitle label="Publicado" count={pendingPublished.length} dot="bg-[var(--status-info)]" />
                <ul className="divide-y divide-border">{pendingPublished.map(ev => <EventItem key={ev.id} ev={ev} kind="published" active={selectedEventId === ev.id} onSelect={() => onSelectEvent(ev.id)} />)}</ul>
              </section>
            )}
            {done.length > 0 && (
              <section>
                <SectionTitle label="Respondidos" count={done.length} dot="bg-accent" />
                <ul className="divide-y divide-border">{done.map(ev => <EventItem key={ev.id} ev={ev} kind="done" active={selectedEventId === ev.id} onSelect={() => onSelectEvent(ev.id)} />)}</ul>
              </section>
            )}
          </>
        )}
        {!isLoading && !error && <UpcomingSection upcoming={data?.upcoming ?? []} />}
      </div>
    </aside>
  );
}
