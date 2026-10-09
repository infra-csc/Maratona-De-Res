// Tela "Eventos do Ciclo": estado dos filtros (espelhado na URL), dados e
// orquestração. As peças visuais e as regras vivem em ./events/.
import { useState, useEffect, useRef, useMemo } from "react";
import { useGetEvents, getGetEventsQueryKey, useNormalizeEventDates } from "@workspace/api-client-react";
import type { NormalizeDatesResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getCycleWeekends, weekendsEnd, todayBR, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CalendarX2, SearchX, X } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { CycleSelect, CycleScopeNotice, useCycleScope } from "@/components/cycle-select";
import { readUrlFilters, DEFAULT_SORT } from "./events/url-filters";
import { filterAndSortEvents, countCycleEvents } from "./events/rules";
import { Bone, EmptyBlock, ErrorBlock, btnGhost, btnSmall, surfaceCls } from "./events/events-ui";
import { serverErrorMessage } from "./events/form-bits";
import { EventsHeader, EventsPanorama } from "./events/events-header";
import { EventsFilterBar, WeekendChipsRow, chipFilters } from "./events/events-filters";
import { EventsTable, EventsLegend } from "./events/events-table";
import { areaCountsOf } from "./events/use-area-counts";
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

  // Seletor de ciclo: atual (padrão, como sempre), anterior ou Total geral —
  // os dois últimos só de consulta (sem criar/editar/excluir/confirmar).
  const scope = useCycleScope();
  const { readOnly } = scope;
  const queryKey = getGetEventsQueryKey(scope.params);
  const { data: events, isLoading, isError, refetch } = useGetEvents(
    scope.params,
    { query: { queryKey, refetchInterval: readOnly ? false : 60000, refetchOnWindowFocus: !readOnly } }
  );
  // Período dos chips de fim de semana: o do ciclo escolhido (no Total geral, sem chips).
  const cycle = scope.isAll ? null : scope.cycle;
  const cycleNameById = new Map(scope.options.map(c => [c.id, c.name]));
  const cycleById = useMemo(() => new Map(scope.options.map(c => [c.id, c])), [scope.options]);
  // Ciclo por área: Avaliações conta respostas por área (a mesma conta da Central).

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
  // Hoje em Brasília "YYYY-MM-DD" para comparar como string com as datas dos eventos.
  const todayStr = todayBR();
  // Contagens pela regra única (a mesma de Ciclos e da Central de Avaliações).
  const counts = countCycleEvents(all, ev => cycleById.get(ev.cycleId) ?? null, todayStr);
  const filtered = filterAndSortEvents(all, { search, filterDateFrom, filterDateTo, cardFilter, sortBy, todayStr });

  const cycleWeekends = cycle ? getCycleWeekends(cycle.startDate, weekendsEnd(cycle.endDate, all)) : [];

  const canCreate = !readOnly && user && (["admin", "rh"].includes(user.role) || hasRole(user, "operador"));
  const hasDateFilter = !!(filterDateFrom || filterDateTo);

  useEffect(() => {
    if (!weekendRowRef.current || cycleWeekends.length === 0) return;
    // Fuso local (não UTC): toISOString() pulava para o próximo fim de semana entre 21h e meia-noite.
    const todayStr = new Date().toLocaleDateString("sv-SE");
    const idx = cycleWeekends.findIndex(w => w.sun >= todayStr);
    const targetIdx = idx >= 0 ? idx : cycleWeekends.length - 1;
    const chip = weekendRowRef.current.children[targetIdx] as HTMLElement | undefined;
    if (chip) chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
    // Roda de novo quando a faixa aparece (ela só existe depois que os eventos carregam).
  }, [cycle?.startDate, isLoading, cycleWeekends.length]);

  const dateRange = { filterDateFrom, filterDateTo, setFilterDateFrom, setFilterDateTo, hasDateFilter };

  // Contagem de cada situação com a busca e o período atuais (o número no chip).
  const listParams = { search, filterDateFrom, filterDateTo, sortBy, todayStr };
  const chipCounts = Object.fromEntries(chipFilters.map(f => [f.key ?? "all", filterAndSortEvents(all, { ...listParams, cardFilter: f.key }).length]));
  // Eventos de cada fim de semana (a mesma regra do filtro de período).
  const weekendCount = (w: { sat: string; sun: string }) => all.filter(ev => ev.endDate >= w.sat && ev.startDate <= w.sun).length;
  const currentWeekend = cycleWeekends.find(w => w.sat <= todayStr && todayStr <= w.sun) ?? null;
  // O operador não vê nota (a API já manda vazio): a coluna sai.
  const showScore = !hasRole(user, "operador");
  const hasAnyFilter = !!(search.trim() || cardFilter || hasDateFilter);
  const clearFilters = () => { setSearch(""); setCardFilter(null); setFilterDateFrom(""); setFilterDateTo(""); };

  return (
    <div className="min-h-full flex flex-col min-w-0">
      <EventsHeader
        title={scope.isAll ? "Eventos · Total Geral" : "Eventos do Ciclo"}
        cycleSlot={<CycleSelect scope={scope} />}
        showNormalize={!readOnly && user?.role === "admin"}
        normalizePending={normalizeDatesMutation.isPending}
        onNormalizePreview={() => normalizeDatesMutation.mutate({ data: { dryRun: true } })}
      >
        {canCreate && <CreateEventDialog />}
      </EventsHeader>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-4 max-w-[1680px] w-full mx-auto">
        {readOnly && (
          <CycleScopeNotice
            scope={scope}
            allHelp={<>Eventos de <strong>todos os ciclos</strong>, cada um com o selo do seu ciclo na coluna Data. Para criar, editar ou confirmar eventos, volte ao ciclo atual.</>}
          />
        )}

        {isLoading ? (
          <EventsSkeleton />
        ) : isError ? (
          <ErrorBlock title="Não foi possível carregar os eventos" onRetry={() => { void refetch(); }} />
        ) : (
          <>
            <EventsPanorama events={all} counts={counts} cardFilter={cardFilter} setCardFilter={setCardFilter} />

            <div className="space-y-3">
              <EventsFilterBar
                search={search}
                setSearch={setSearch}
                cardFilter={cardFilter}
                setCardFilter={setCardFilter}
                datePopoverOpen={datePopoverOpen}
                setDatePopoverOpen={setDatePopoverOpen}
                chipCounts={chipCounts}
                {...dateRange}
              />
              {cycleWeekends.length > 0 && (
                <WeekendChipsRow weekends={cycleWeekends} weekendRowRef={weekendRowRef} countOf={weekendCount} currentSat={currentWeekend?.sat ?? null} {...dateRange} />
              )}
            </div>

            {all.length === 0 ? (
              <div className={cn(surfaceCls, "border-dashed")}>
                <EmptyBlock icon={CalendarX2} title={scope.isAll ? "Nenhum evento registrado" : "Nenhum evento neste ciclo"} testId="events-empty">
                  {canCreate ? "Crie um evento pelo botão Novo evento ou sincronize pela Integração." : "Os eventos aparecem aqui quando forem criados ou sincronizados pela Integração."}
                </EmptyBlock>
              </div>
            ) : filtered.length === 0 ? (
              <div className={surfaceCls}>
                <EmptyBlock icon={SearchX} title="Nenhum evento encontrado" testId="events-no-results"
                  action={hasAnyFilter ? <button type="button" onClick={clearFilters} className={btnSmall}><X size={14} aria-hidden /> Limpar filtros</button> : undefined}>
                  Nenhum evento bate com a busca e os filtros escolhidos.
                </EmptyBlock>
              </div>
            ) : (
              <>
                {!readOnly && cardFilter === "unconfirmed" && user?.role === "admin" && (
                  <BulkConfirmBanner events={filtered} hasDateFilter={hasDateFilter} />
                )}
                {hasAnyFilter && (
                  <div className="flex items-center justify-between gap-3 -mb-1" aria-live="polite">
                    <span className="text-[13.5px] text-muted-foreground">
                      <b className="font-semibold text-foreground tabular-nums">{filtered.length}</b> de {all.length} eventos com os filtros
                    </span>
                    <button type="button" onClick={clearFilters} className={cn(btnGhost, "-mr-3")}><X size={14} aria-hidden /> Limpar filtros</button>
                  </div>
                )}
                <EventsTable
                  events={filtered}
                  user={user}
                  sortBy={sortBy}
                  setSortBy={setSortBy}
                  readOnly={readOnly}
                  showScore={showScore}
                  weekends={cycleWeekends}
                  currentSat={currentWeekend?.sat ?? null}
                  cycleLabelOf={scope.isAll ? (ev => cycleNameById.get(ev.cycleId) ?? null) : undefined}
                  cycleOf={ev => cycleById.get(ev.cycleId) ?? null}
                  areaCountsOf={areaCountsOf}
                  onEdit={(ev) => setEditingEvent({ id: ev.id, name: ev.name, startDate: ev.startDate, endDate: ev.endDate, clientName: ev.clientName, city: ev.city, state: ev.state, location: ev.location })}
                  onMerge={(ev) => setMergeForEvent({ id: ev.id, name: ev.name })}
                  onDelete={(ev) => setDeleteTarget({ id: ev.id, name: ev.name })}
                />
                <EventsLegend shown={filtered.length} total={all.length} scopeLabel={scope.isAll ? "em todos os ciclos" : "no ciclo"} afterEnd={counts.afterEnd} />
              </>
            )}
          </>
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

/** Carregando: o esqueleto do panorama, dos filtros e de algumas linhas. */
function EventsSkeleton() {
  return (
    <div role="status" aria-label="Carregando eventos" className="space-y-4">
      <div className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-5 gap-px bg-border")}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={cn("bg-card px-4 py-4 lg:px-5 space-y-2.5", i === 0 && "col-span-2 lg:col-span-1")}>
            <Bone className="h-3 w-20" /><Bone className="h-8 w-14" /><Bone className="h-3 w-32 hidden sm:block" />
          </div>
        ))}
      </div>
      <div className="flex gap-2"><Bone className="h-11 lg:h-9 w-full lg:w-72 rounded-lg" /><Bone className="h-11 lg:h-9 flex-1 rounded-lg hidden lg:block" /></div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="px-5 py-4 flex items-center gap-6">
            <div className="flex-1 space-y-2"><Bone className="h-4 w-2/3 max-w-[320px]" /><Bone className="h-3 w-40" /></div>
            <Bone className="h-4 w-14 hidden lg:block" />
            <Bone className="h-2 w-24 hidden lg:block" />
            <Bone className="h-2 w-24 hidden lg:block" />
            <Bone className="h-6 w-24 rounded-md" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando eventos…</span>
    </div>
  );
}
