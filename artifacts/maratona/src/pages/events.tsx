// Tela "Eventos do Ciclo": estado dos filtros (espelhado na URL), dados e
// orquestração. As peças visuais e as regras vivem em ./events/.
import { useState, useEffect, useRef } from "react";
import { useGetEvents, useGetCurrentCycle, getGetEventsQueryKey, useNormalizeEventDates } from "@workspace/api-client-react";
import type { NormalizeDatesResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getCycleWeekends } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { CONDENSED } from "@/lib/premium-theme";
import { readUrlFilters, DEFAULT_SORT } from "./events/url-filters";
import { filterAndSortEvents } from "./events/rules";
import { serverErrorMessage } from "./events/form-bits";
import { EventsHeader } from "./events/events-header";
import { EventsFilterBar, WeekendChipsRow } from "./events/events-filters";
import { EventsTable, EventsLegend } from "./events/events-table";
import { CreateEventDialog, EditEventDialog } from "./events/event-form-dialogs";
import { MergeEventDialog, DeleteEventDialog, BulkConfirmBanner, NormalizeDatesDialog } from "./events/event-action-dialogs";
import type { EditingEvent, EventRef } from "./events/types";

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [initialFilters] = useState(readUrlFilters);
  const [search, setSearch] = useState(initialFilters.search);
  const [cardFilter, setCardFilter] = useState<string | null>(initialFilters.cardFilter);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [filterDateFrom, setFilterDateFrom] = useState(initialFilters.filterDateFrom);
  const [filterDateTo, setFilterDateTo] = useState(initialFilters.filterDateTo);

  // Espelha os filtros na URL sem recarregar nem empilhar histórico.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string | null) => { if (value) p.set(key, value); else p.delete(key); };
    setOrDelete("q", search.trim() || null);
    setOrDelete("status", cardFilter);
    setOrDelete("sort", sortBy !== DEFAULT_SORT ? sortBy : null);
    setOrDelete("from", filterDateFrom || null);
    setOrDelete("to", filterDateTo || null);
    const qs = p.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(window.history.state, "", next);
  }, [search, cardFilter, sortBy, filterDateFrom, filterDateTo]);

  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const weekendRowRef = useRef<HTMLDivElement>(null);
  const [mergeForEvent, setMergeForEvent] = useState<EventRef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventRef | null>(null);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);

  const queryKey = getGetEventsQueryKey();
  const { data: events, isLoading } = useGetEvents(
    undefined,
    { query: { queryKey, refetchInterval: 60000, refetchOnWindowFocus: true } }
  );
  const { data: cycle } = useGetCurrentCycle();

  // "Unificar Datas" em dois passos: prévia (dryRun) → diálogo com a lista →
  // aplicar só depois de digitar APLICAR (o servidor exige a mesma palavra).
  const [normalizePreview, setNormalizePreview] = useState<NormalizeDatesResult | null>(null);
  const normalizeDatesMutation = useNormalizeEventDates({
    mutation: {
      onSuccess: (d, vars) => {
        if (vars.data.dryRun) {
          if (d.changes.length === 0) {
            toast({ title: "Nenhuma data para unificar", description: "Todos os eventos já estão com data única e as correções pontuais já foram aplicadas." });
          } else {
            setNormalizePreview(d);
          }
          return;
        }
        qc.invalidateQueries({ queryKey });
        setNormalizePreview(null);
        toast({ title: "Datas normalizadas", description: `${d.fixedCount} corrigidos + ${d.normalizedCount} unificados para data única.` });
      },
      onError: (e) => toast({ title: "Erro", description: serverErrorMessage(e), variant: "destructive" }),
    },
  });

  const all = events ?? [];
  // Data local "YYYY-MM-DD" (sv-SE) para comparar como string com as datas dos eventos.
  const todayStr = new Date().toLocaleDateString("sv-SE");
  const filtered = filterAndSortEvents(all, { search, filterDateFrom, filterDateTo, cardFilter, sortBy, todayStr });

  const cycleWeekends = getCycleWeekends(cycle?.startDate, cycle?.endDate);
  const cyclePeriod = cycle ? formatCyclePeriod(cycle.startDate, cycle.endDate) : null;

  const canCreate = user && (["admin", "rh"].includes(user.role) || hasRole(user, "operador"));
  const hasDateFilter = !!(filterDateFrom || filterDateTo);

  useEffect(() => {
    if (!weekendRowRef.current || cycleWeekends.length === 0) return;
    // Fuso local (não UTC): toISOString() pulava para o próximo fim de semana entre 21h e meia-noite.
    const todayStr = new Date().toLocaleDateString("sv-SE");
    const idx = cycleWeekends.findIndex(w => w.sun >= todayStr);
    const targetIdx = idx >= 0 ? idx : cycleWeekends.length - 1;
    const chip = weekendRowRef.current.children[targetIdx] as HTMLElement | undefined;
    if (chip) chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
  }, [cycle?.startDate]);

  const dateRange = { filterDateFrom, filterDateTo, setFilterDateFrom, setFilterDateTo, hasDateFilter };

  return (
    <div className="min-h-full flex flex-col">

      {/* ── Header ── */}
      <EventsHeader
        cycle={cycle}
        cyclePeriod={cyclePeriod}
        events={all}
        showNormalize={user?.role === "admin"}
        normalizePending={normalizeDatesMutation.isPending}
        onNormalizePreview={() => normalizeDatesMutation.mutate({ data: { dryRun: true } })}
      >
        {canCreate && <CreateEventDialog />}
      </EventsHeader>

      {/* ── Filter bar ── */}
      <EventsFilterBar
        search={search}
        setSearch={setSearch}
        cardFilter={cardFilter}
        setCardFilter={setCardFilter}
        datePopoverOpen={datePopoverOpen}
        setDatePopoverOpen={setDatePopoverOpen}
        {...dateRange}
      />

      {/* ── Weekend chips row ── */}
      {cycleWeekends.length > 0 && (
        <WeekendChipsRow weekends={cycleWeekends} weekendRowRef={weekendRowRef} {...dateRange} />
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Calendar size={40} className="mb-4 opacity-20" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Nenhum evento encontrado</h3>
            <p className="italic mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Ajuste os filtros ou sincronize via integração.</p>
            {cardFilter !== null && (
              <button
                onClick={() => setCardFilter(null)}
                className="mt-4 px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                Limpar filtro
              </button>
            )}
          </div>
        ) : (
          <>
            {cardFilter === "unconfirmed" && user?.role === "admin" && (
              <BulkConfirmBanner events={filtered} hasDateFilter={hasDateFilter} />
            )}
            <EventsTable
              events={filtered}
              user={user}
              sortBy={sortBy}
              setSortBy={setSortBy}
              onEdit={(ev) => setEditingEvent({ id: ev.id, name: ev.name, startDate: ev.startDate, endDate: ev.endDate, clientName: ev.clientName, city: ev.city, state: ev.state, location: ev.location })}
              onMerge={(ev) => setMergeForEvent({ id: ev.id, name: ev.name })}
              onDelete={(ev) => setDeleteTarget({ id: ev.id, name: ev.name })}
            />
          </>
        )}

        {/* Legend + count */}
        {!isLoading && filtered.length > 0 && (
          <EventsLegend shown={filtered.length} total={all.length} />
        )}
      </div>

      <MergeEventDialog event={mergeForEvent} events={all} onClose={() => setMergeForEvent(null)} />

      <NormalizeDatesDialog
        preview={normalizePreview}
        onClose={() => setNormalizePreview(null)}
        isPending={normalizeDatesMutation.isPending}
        onApply={() => normalizeDatesMutation.mutate({ data: { confirm: "APLICAR" } })}
      />

      <DeleteEventDialog event={deleteTarget} onClose={() => setDeleteTarget(null)} />

      <EditEventDialog event={editingEvent} onClose={() => setEditingEvent(null)} />
    </div>
  );
}
