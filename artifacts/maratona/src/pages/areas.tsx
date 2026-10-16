// Tela "Áreas": as áreas que avaliam a equipe de Cenografia nos eventos,
// quem avalia por cada uma e de quais critérios ela é a responsável. Peças
// em ./areas/ (linha/cartão, diálogos, "Critérios e pessoas" e o resumo).
import { useMemo, useState } from "react";
import {
  useGetAreas, useCreateArea, useUpdateArea, useGetCriteria, useUpdateCriterion, useGetUsers, useUpdateUser, useGetCurrentCycle,
  getGetAreasQueryKey, getGetCriteriaQueryKey, getGetUsersQueryKey,
} from "@workspace/api-client-react";
import type { Area, AreaInput, Criterion, User } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Info, Plus, SearchX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural } from "@/lib/utils";
import { useWideScreen } from "./events/use-wide-screen";
import {
  Bone, EmptyBlock, ErrorBlock, Notice, SearchField, Segmented, StatCell, btnPrimary, btnSecondary, serverMessage, surfaceCls,
} from "./areas/areas-ui";
import { AreaCard, AreaRow, type AreaRowProps } from "./areas/area-row";
import { CreateAreaDialog, DeactivateAreaDialog } from "./areas/area-dialogs";
import { ManageAreaDialog } from "./areas/manage-area-dialog";
import { norm, summarize, type AreaFilter, type AreaSummary } from "./areas/model";

function AreasSkeleton() {
  return (
    <div role="status" aria-label="Carregando áreas" className="space-y-5">
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="bg-card px-5 py-4 space-y-3"><Bone className="h-3 w-24" /><Bone className="h-8 w-16" /><Bone className="h-3 w-36 max-w-full" /></div>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5"><Bone className="h-11 lg:h-10 w-full sm:w-[300px]" /><Bone className="h-11 lg:h-9 w-full sm:w-[320px]" /></div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-start gap-6 px-5 py-4">
            <div className="flex-1 space-y-2"><Bone className="h-4 w-40 max-w-full" /><Bone className="h-3 w-64 max-w-full" /></div>
            <div className="hidden md:block space-y-2"><Bone className="h-5 w-36" /><Bone className="h-5 w-28" /></div>
            <Bone className="h-6 w-24 hidden md:block" /><Bone className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

const th = "font-condensed h-11 px-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-card border-b border-border md:sticky md:top-16 z-10";

export default function AreasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const wide = useWideScreen();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<AreaFilter>("all");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [manageId, setManageId] = useState<number | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<AreaSummary | null>(null);

  const qKey = getGetAreasQueryKey();
  const criteriaKey = getGetCriteriaQueryKey();
  const usersKey = getGetUsersQueryKey();
  const { data: areas, isLoading, isError, refetch, isRefetching } = useGetAreas({ query: { queryKey: qKey } });
  const { data: criteria } = useGetCriteria({ query: { queryKey: criteriaKey } });
  const { data: users } = useGetUsers({ query: { queryKey: usersKey } });
  const { data: cycle } = useGetCurrentCycle();
  const areaMode = !!cycle?.areaEvaluation && cycle.status !== "closed";

  const createMutation = useCreateArea({
    mutation: {
      onSuccess: (a: Area) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Área criada", description: `${a?.name ?? "A área"} já pode receber avaliadores e critérios.` });
        setCreateOpen(false);
      },
      onError: (e: unknown) => setCreateError(serverMessage(e)),
    },
  });

  const updateMutation = useUpdateArea({
    mutation: {
      onSuccess: (a: Area, vars) => {
        qc.invalidateQueries({ queryKey: qKey });
        if (vars.data.active !== undefined) {
          const name = a?.name ?? (areas ?? []).find(x => x.id === vars.id)?.name ?? "A área";
          toast({ title: vars.data.active ? "Área reativada" : "Área desativada", description: vars.data.active ? `${name} volta a aparecer nas escolhas de área.` : `${name} saiu das escolhas de área. Nada foi apagado.` });
        }
        setDeactivateTarget(null);
      },
      onError: (e: unknown) => toast({ title: "Não foi possível atualizar a área", description: serverMessage(e), variant: "destructive" }),
    },
  });

  const updateCriterionMutation = useUpdateCriterion({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: criteriaKey }),
      onError: (e: unknown) => toast({ title: "Não foi possível mudar o critério", description: serverMessage(e), variant: "destructive" }),
    },
  });

  const updateUserMutation = useUpdateUser({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
      onError: (e: unknown) => toast({ title: "Não foi possível mudar a pessoa de área", description: serverMessage(e), variant: "destructive" }),
    },
  });

  const summaries = useMemo(() => summarize(areas ?? [], criteria ?? [], users ?? []), [areas, criteria, users]);
  const counts = useMemo(() => ({
    all: summaries.length,
    true: summaries.filter(s => s.area.active).length,
    false: summaries.filter(s => !s.area.active).length,
  }), [summaries]);
  const attention = summaries.filter(s => s.needsEvaluator);
  const evaluatorsTotal = summaries.filter(s => s.area.active).reduce((n, s) => n + s.evaluators.length, 0);
  const evaluatorsNoArea = (users ?? []).filter(u => u.active && u.role === "avaliador" && u.areaId == null).length;
  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const criteriaNoArea = activeCriteria.filter(c => c.responsibleAreaId == null);

  const q = norm(search);
  const filtered = summaries
    .filter(s => filterActive === "all" || (filterActive === "true" ? s.area.active : !s.area.active))
    .filter(s => !onlyAttention || s.needsEvaluator)
    .filter(s => !q || norm(s.area.name).includes(q) || norm(s.area.description).includes(q) || s.evaluators.some(u => norm(u.name).includes(q)))
    .sort((a, b) => Number(b.area.active) - Number(a.area.active) || a.area.name.localeCompare(b.area.name, "pt-BR"));
  const filtering = q !== "" || filterActive !== "all" || onlyAttention;
  const clearFilters = () => { setSearch(""); setFilterActive("all"); setOnlyAttention(false); };

  const togglingId = updateMutation.isPending && updateMutation.variables?.data.active !== undefined ? updateMutation.variables.id : null;
  const rowProps = (s: AreaSummary): AreaRowProps => ({
    s,
    canEdit: true,
    toggling: togglingId === s.area.id,
    onToggle: (sum, next) => {
      // Desativar pede confirmação (muda as escolhas de área); reativar é direto.
      if (!next) setDeactivateTarget(sum);
      else updateMutation.mutate({ id: sum.area.id, data: { active: true } });
    },
    onManage: sum => setManageId(sum.area.id),
  });

  function toggleCriterion(c: Criterion, belongs: boolean) {
    if (manageId == null) return;
    updateCriterionMutation.mutate({ id: c.id, data: { responsibleAreaId: belongs ? null : manageId } });
  }
  function toggleUser(u: User, belongs: boolean) {
    if (manageId == null) return;
    updateUserMutation.mutate({ id: u.id, data: { areaId: belongs ? null : manageId } });
  }
  const openCreate = () => { setCreateError(null); setCreateOpen(true); };
  const manageArea = manageId != null ? (areas ?? []).find(a => a.id === manageId) ?? null : null;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
        <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Áreas</h1>
        <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Quem avalia a equipe de Cenografia em cada evento, e por quais critérios cada área responde.</p>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button type="button" data-testid="button-create-area" onClick={openCreate} className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
            <Plus size={15} aria-hidden /> Nova<span className="hidden sm:inline"> área</span>
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {isLoading ? <AreasSkeleton /> : isError || !areas ? (
          <ErrorBlock title="Não foi possível carregar as áreas" onRetry={() => { void refetch(); }} />
        ) : areas.length === 0 ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={Building2} title="Nenhuma área cadastrada" testId="areas-empty"
              action={<button type="button" onClick={openCreate} className={btnPrimary}><Plus size={15} aria-hidden /> Criar a primeira</button>}>
              Cada área avalia a equipe de Cenografia pelos critérios de que é responsável. Comece por Cenografia, Logística, Produção…
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", isRefetching && "opacity-80")}>
            <section aria-label="Panorama das áreas" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border")}>
              <StatCell testId="stat-areas-active" label="Áreas ativas" value={counts.true}
                sub={counts.false > 0 ? `${plural(counts.false, "inativa", "inativas")} fora das escolhas` : "Todas em uso"} />
              <StatCell testId="stat-areas-evaluators" label="Avaliadores" value={evaluatorsTotal}
                sub={evaluatorsNoArea > 0 ? <span className="text-[var(--status-warn-text)] font-semibold">{plural(evaluatorsNoArea, "avaliador sem área", "avaliadores sem área")}</span> : "Cada um em uma área só"} />
              <StatCell testId="stat-areas-criteria" label="Critérios com área" value={activeCriteria.length - criteriaNoArea.length}
                unit={`de ${activeCriteria.length}`}
                sub={criteriaNoArea.length > 0
                  ? <span className="text-[var(--status-warn-text)] font-semibold" title={criteriaNoArea.map(c => displayCriterionName(c.name)).join(", ")}>{plural(criteriaNoArea.length, "critério ativo sem área", "critérios ativos sem área")}</span>
                  : "Todo critério ativo tem dono"} />
              <StatCell testId="stat-areas-attention" label="Sem avaliador" value={attention.length} tone={attention.length > 0 ? "warn" : "neutral"}
                sub={attention.length > 0 ? "Têm critério e ninguém para responder" : "Toda área com critério tem avaliador"}
                onClick={attention.length > 0 || onlyAttention ? () => setOnlyAttention(v => !v) : undefined}
                pressed={attention.length > 0 || onlyAttention ? onlyAttention : undefined}
                action={onlyAttention ? "Ver todas" : "Ver quais"} />
            </section>

            <Notice icon={Info} testId="areas-rule-notice">
              <span className="font-semibold text-foreground">Os avaliados são sempre a equipe de Cenografia do evento; as áreas avaliam essa equipe.</span>{" "}
              Cada avaliador pertence a uma área só.
              {areaMode && <> Neste ciclo, <span className="font-semibold text-foreground">qualquer avaliador da área</span> responde os critérios dela e a primeira resposta enviada fecha o critério para a área.</>}
            </Notice>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <Segmented<AreaFilter> label="Filtrar por situação" value={filterActive} onChange={setFilterActive} className="w-full sm:w-auto"
                options={([["all", "Todas"], ["true", "Ativas"], ["false", "Inativas"]] as const).map(([v, l]) => ({
                  value: v, testId: `filter-active-${v}`,
                  label: <>{l} <span className="tabular-nums font-semibold opacity-70">{counts[v]}</span></>,
                }))} />
              <SearchField value={search} onChange={setSearch} label="Buscar área ou avaliador" placeholder="Buscar área ou avaliador"
                testId="input-search-areas" className="flex-1 sm:max-w-[360px] sm:ml-auto" />
            </div>

            {filtered.length === 0 ? (
              <div className={surfaceCls}>
                <EmptyBlock icon={SearchX} title="Nenhuma área encontrada" testId="areas-no-results"
                  action={filtering ? <button type="button" onClick={clearFilters} className={btnSecondary}>Limpar filtros</button> : undefined}>
                  Nada com essa busca ou esse filtro.
                </EmptyBlock>
              </div>
            ) : wide ? (
              <div className={cn(surfaceCls, "overflow-clip")}>
                <table className="w-full border-collapse text-[14px]" aria-label="Áreas">
                  <thead>
                    <tr>
                      <th className={cn(th, "pl-5 w-[30%] rounded-tl-2xl")}>Área</th>
                      <th className={cn(th, "w-[24%]")}>Avaliadores</th>
                      <th className={cn(th, "w-[17%]")}>Critérios</th>
                      <th className={th}>Pessoas</th>
                      <th className={cn(th, "w-[130px] text-right")}>Situação</th>
                      <th className={cn(th, "pr-4 w-[80px] xl:w-[210px] rounded-tr-2xl")}><span className="sr-only">Ações</span></th>
                    </tr>
                  </thead>
                  <tbody>{filtered.map(s => <AreaRow key={s.area.id} {...rowProps(s)} />)}</tbody>
                </table>
              </div>
            ) : (
              <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]" aria-label="Áreas">
                {filtered.map(s => <AreaCard key={s.area.id} {...rowProps(s)} />)}
              </ul>
            )}
            {filtered.length > 0 && (
              <p className="text-[13px] text-muted-foreground tabular-nums" data-testid="areas-count">
                {filtering ? `Mostrando ${filtered.length} de ${plural(summaries.length, "área", "áreas")}` : plural(summaries.length, "área", "áreas")}
              </p>
            )}
          </div>
        )}
      </div>

      <CreateAreaDialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) setCreateError(null); }}
        pending={createMutation.isPending} error={createError}
        onSubmit={(d: AreaInput) => { setCreateError(null); createMutation.mutate({ data: d }); }} />
      <DeactivateAreaDialog target={deactivateTarget} pending={updateMutation.isPending}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={() => deactivateTarget && updateMutation.mutate({ id: deactivateTarget.area.id, data: { active: false } })} />
      <ManageAreaDialog area={manageArea} areas={areas ?? []} criteria={criteria ?? []} users={users ?? []}
        onToggleCriterion={toggleCriterion} onToggleUser={toggleUser}
        pendingCriterionId={updateCriterionMutation.isPending ? updateCriterionMutation.variables?.id ?? null : null}
        pendingUserId={updateUserMutation.isPending ? updateUserMutation.variables?.id ?? null : null}
        onClose={() => setManageId(null)} />
    </div>
  );
}
