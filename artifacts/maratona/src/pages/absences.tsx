// Tela "Penalidades e méritos": dados e orquestração. As peças visuais vivem
// em ./absences/: topo fixo, panorama do ciclo, barra de ferramentas, lista
// (tabela ou cartões; por lançamento ou por pessoa), diálogos (registrar/
// editar e excluir) e os hooks do catálogo de tipos, dos filtros, do
// formulário e da exclusão (use-*.ts).
import { useMemo, useState } from "react";
import {
  useGetAbsences, useGetEmployees, useGetEvents, useGetCurrentCycle, useGetQuarterlyResults, getGetAbsencesQueryKey,
} from "@workspace/api-client-react";
import { CalendarRange, Info, Lock, Plus, Scale } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { Bone, EmptyBlock, ErrorBlock, Notice, btnPrimary, surfaceCls } from "./absences/absences-ui";
import { usePenaltyTypes } from "./absences/use-penalty-types";
import { useAbsenceFilters } from "./absences/use-absence-filters";
import { useAbsenceForm } from "./absences/use-absence-form";
import { useAbsenceDelete } from "./absences/use-absence-delete";
import { AbsencesHeader } from "./absences/absences-header";
import { AbsencesPanel } from "./absences/absences-panel";
import { AbsencesToolbar, ListMeta } from "./absences/absences-filters";
import { AbsencesList, NoResults, PeopleList } from "./absences/absences-table";
import { AbsenceFormDialog } from "./absences/absence-form-dialog";
import { DeleteAbsenceDialog } from "./absences/delete-absence-dialog";
import { buildPeople } from "./absences/people";
import { eventLockedByClosedCycle } from "./absences/helpers";
import type { AbsenceRowProps } from "./absences/absence-row";
import type { EmployeeScore, ListView } from "./absences/types";

/** Carregando: panorama, barra de ferramentas e algumas linhas. */
function AbsencesSkeleton() {
  return (
    <div role="status" aria-label="Carregando lançamentos" className="space-y-5">
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="bg-card px-5 py-4 space-y-3"><Bone className="h-3 w-24" /><Bone className="h-8 w-16" /><Bone className="h-3 w-36 max-w-full" /></div>)}
      </div>
      <div className="flex flex-col lg:flex-row gap-2.5"><Bone className="h-11 lg:h-9 w-full lg:w-[360px]" /><Bone className="h-11 lg:h-9 w-full lg:w-[300px]" /><Bone className="h-11 lg:h-9 w-full lg:w-[240px]" /></div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-5 px-5 py-4">
            <Bone className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2"><Bone className="h-4 w-44 max-w-full" /><Bone className="h-3 w-28" /></div>
            <Bone className="h-6 w-32 hidden md:block" /><Bone className="h-5 w-20 hidden lg:block" /><Bone className="h-6 w-14" /><Bone className="h-6 w-14 hidden sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AbsencesPage() {
  const { user } = useAuth();
  // Espelha o backend: lançar/editar/excluir é admin|rh|diretoria; tipos, admin|rh.
  const canEdit = hasRole(user, "admin") || hasRole(user, "rh") || hasRole(user, "diretoria");
  const canManageTypes = hasRole(user, "admin") || hasRole(user, "rh");
  const [view, setView] = useState<ListView>("entries");

  const qKey = getGetAbsencesQueryKey();
  const { data: absences, isLoading, isError, refetch, isRefetching } = useGetAbsences(undefined, { query: { queryKey: qKey } });
  const { data: employees } = useGetEmployees({ active: true });
  const { data: events } = useGetEvents();
  const { data: cycle, isLoading: cycleLoading } = useGetCurrentCycle();
  const { data: results } = useGetQuarterlyResults();

  const cycleClosed = cycle?.status === "closed";
  const scores = useMemo(() => {
    const m = new Map<number, EmployeeScore>();
    for (const r of results ?? []) m.set(r.employeeId, { eventsCount: r.eventsCount ?? 0, grossAverage: r.grossAverage ?? null, finalResult: r.finalResult });
    return m;
  }, [results]);
  const eventById = useMemo(() => new Map((events ?? []).map(e => [e.id, e])), [events]);

  const types = usePenaltyTypes();
  const filters = useAbsenceFilters(absences, types.typeLabel);
  const form = useAbsenceForm(qKey, employees, events, types, cycleClosed);
  const removal = useAbsenceDelete(qKey);

  const all = absences ?? [];
  const peopleAll = useMemo(() => buildPeople(all, scores), [all, scores]);
  const peopleShown = useMemo(() => buildPeople(filters.filteredAbsences, scores), [filters.filteredAbsences, scores]);
  const employeeName = filters.filterEmployeeId != null ? (all.find(a => a.employeeId === filters.filterEmployeeId)?.employeeName ?? "Colaborador") : null;
  const cycleLabel = cycle ? `${cycle.name} · ${formatCyclePeriod(cycle.startDate, cycle.endDate) ?? "período não definido"}` : null;

  // Ciclo fechado: a API recusa editar/excluir, salvo lançamento de evento "fora do período".
  const rowLocked = (eventId: number | null | undefined) => cycleClosed && (eventId == null || eventLockedByClosedCycle(eventById.get(eventId), true));

  const rowProps = (a: (typeof all)[number]): AbsenceRowProps => ({
    a,
    canEdit,
    locked: rowLocked(a.eventId),
    score: scores.get(a.employeeId),
    typeLabel: types.typeLabel,
    onEdit: form.openEdit,
    onDelete: removal.setDeleteTarget,
    onPickEmployee: id => { filters.setFilterEmployeeId(id); setView("entries"); },
    fresh: form.freshIds.includes(a.id),
  });

  const hasAny = all.length > 0;
  const noCycle = !cycleLoading && !cycle;
  const createBtn = canEdit && !noCycle
    ? <button type="button" onClick={form.openCreate} className={btnPrimary}><Plus size={15} aria-hidden /> Registrar o primeiro</button>
    : undefined;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <AbsencesHeader canEdit={canEdit} canManageTypes={canManageTypes} onCreate={form.openCreate} />

      <div className={cn("flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto", canEdit && "pb-28 md:pb-5")}>
        {isLoading ? <AbsencesSkeleton /> : isError || !absences ? (
          <ErrorBlock title="Não foi possível carregar os lançamentos" onRetry={() => { void refetch(); }} />
        ) : noCycle ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={CalendarRange} title="Nenhum ciclo ativo" testId="absences-no-cycle">
              Os lançamentos entram sempre no ciclo atual. Crie ou ative um ciclo em Ciclos para começar a lançar.
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", isRefetching && "opacity-80")}>
            {cycleClosed && (
              <Notice icon={Lock} tone="warn" testId="absences-closed-notice">
                <span className="font-semibold text-foreground">Ciclo fechado: só consulta.</span>{" "}
                Lançamentos do ciclo não podem ser criados, editados nem excluídos — só os de eventos que ficaram para o próximo ciclo.
              </Notice>
            )}
            {hasAny && <AbsencesPanel rows={all} people={peopleAll} cycleLabel={cycleLabel}
              kind={filters.filterKind} onKind={filters.setFilterKind} view={view} onView={setView} />}
            <Notice icon={Info} tone="neutral" testId="absences-rule-notice">
              <span className="font-semibold text-foreground">Como mexe na nota:</span>{" "}
              os pontos são divididos pelos eventos com nota do colaborador no ciclo.
              Ex.: −50 pts para quem tem 8 eventos tira 6,3 da nota (50 ÷ 8). Penalidade desconta, mérito soma.
            </Notice>
            {!hasAny ? (
              <div className={surfaceCls}>
                <EmptyBlock icon={Scale} title="Nenhum lançamento neste ciclo" testId="absences-empty-cycle" action={createBtn}>
                  Faltas, atrasos e méritos aparecem aqui assim que alguém registrar. Cada um mostra quanto mexe na nota do colaborador.
                </EmptyBlock>
              </div>
            ) : (
              <div className="space-y-3">
                <AbsencesToolbar filters={filters} events={events} />
                <ListMeta filters={filters} total={all.length} employeeName={employeeName} view={view} onView={setView} shownPeople={peopleShown.length} />
                {filters.filteredAbsences.length === 0 ? <NoResults onClear={filters.clearFilters} />
                  : view === "people"
                    ? <PeopleList people={peopleShown} onPick={id => { filters.setFilterEmployeeId(id); setView("entries"); }} />
                    : <AbsencesList rows={filters.filteredAbsences.map(rowProps)} canEdit={canEdit} />}
                {view === "people" && filters.filteredAbsences.length > 0 && (
                  <p className="text-[12.5px] text-muted-foreground">
                    A nota do ciclo e a média sem lançamentos vêm de Resultados. Toque numa pessoa para ver os lançamentos dela.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Celular: o lançamento rápido fica sempre à mão, no pé da tela. */}
      {canEdit && !noCycle && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm px-4 pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]">
          <button type="button" data-testid="button-register-absence-mobile" onClick={form.openCreate} className={cn(btnPrimary, "w-full")}>
            <Plus size={16} aria-hidden /> Novo lançamento
          </button>
        </div>
      )}

      <AbsenceFormDialog form={form} types={types} employees={employees} events={events} scores={scores} />
      <DeleteAbsenceDialog state={removal} typeLabel={types.typeLabel} scores={scores} />
    </div>
  );
}
