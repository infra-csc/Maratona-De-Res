// Tela "Critérios": dados, filtros e orquestração. As peças visuais vivem em
// ./criteria/: topo fixo e panorama, barra de ferramentas e lista (tabela ou
// cartões), cartão da matriz de conformidade, diálogos (novo, duplicar, áreas,
// roteamento, desativar, manutenção) e os hooks de formulário/manutenção.
import { useMemo, useState } from "react";
import type { Criterion } from "@workspace/api-client-react";
import { useGetCriteria, useUpdateCriterion, useGetAreas, useGetUsers, getGetCriteriaQueryKey, useGetConformityRouting, useGetCurrentCycle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Info, ListChecks, Plus } from "lucide-react";
import { useAllCriterionRoutings } from "@/lib/routing-api";
import { useAuth, hasRole } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn } from "@/lib/utils";
import { Bone, EmptyBlock, ErrorBlock, Notice, btnPrimary, surfaceCls } from "./criteria/criteria-ui";
import { evaluatingAreaIdsOf, evaluatorsForArea, serverMessage, weightShare } from "./criteria/helpers";
import { useCriteriaMaintenance } from "./criteria/use-criteria-maintenance";
import { useCreateCriterionForm, useCriterionAreasEditor, useDuplicateCriterion } from "./criteria/use-criterion-forms";
import { CriteriaHeader, CriteriaPanel, type CriteriaStats } from "./criteria/criteria-header";
import { CriteriaList, CriteriaToolbar, type CriterionGroup } from "./criteria/criteria-table";
import type { CriterionRowProps } from "./criteria/criterion-row";
import { ConformityRoutingCard } from "./criteria/conformity-routing-card";
import { CreateCriterionDialog, CriterionAreasDialog, DeactivateCriterionDialog, DuplicateCriterionDialog } from "./criteria/criterion-dialogs";
import { CriterionRoutingDialog } from "./criteria/routing-config-dialog";
import { MaintenanceDialog } from "./criteria/maintenance-dialog";

/** Carregando: panorama, barra de ferramentas e algumas linhas. */
function CriteriaSkeleton() {
  return (
    <div role="status" aria-label="Carregando critérios" className="space-y-5">
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="bg-card px-5 py-4 space-y-3"><Bone className="h-3 w-24" /><Bone className="h-8 w-16" /><Bone className="h-3 w-36 max-w-full" /></div>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5"><Bone className="h-11 lg:h-9 w-full sm:w-[400px]" /><Bone className="h-11 lg:h-9 w-full sm:w-[240px]" /></div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-start gap-6 px-5 py-4">
            <div className="flex-1 space-y-2"><Bone className="h-4 w-48 max-w-full" /><Bone className="h-3 w-72 max-w-full" /></div>
            <div className="hidden md:flex gap-1.5"><Bone className="h-6 w-24" /><Bone className="h-6 w-20" /></div>
            <Bone className="h-6 w-12 hidden md:block" /><Bone className="h-5 w-32 hidden lg:block" /><Bone className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CriteriaPage() {
  const { user } = useAuth();
  // Espelha o backend: POST/PATCH /criteria exigem admin|rh (diretoria só visualiza).
  const canEdit = hasRole(user, "admin") || hasRole(user, "rh");
  const isAdmin = hasRole(user, "admin");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [routingDialogId, setRoutingDialogId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAreaId, setFilterAreaId] = useState<string>("__all");
  const [deactivateTarget, setDeactivateTarget] = useState<Criterion | null>(null);

  const qKey = getGetCriteriaQueryKey();
  const { data: criteria, isLoading, isError, refetch, isRefetching } = useGetCriteria({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: usersList } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });
  const { data: routings } = useAllCriterionRoutings();
  const { data: conformityRoutings } = useGetConformityRouting();
  const { data: cycle } = useGetCurrentCycle();
  // Ciclo atual POR ÁREA: ninguém é designado — sem avaliador padrão é o normal.
  const areaMode = !!cycle?.areaEvaluation && cycle.status !== "closed";

  const evaluators = useMemo(() =>
    (usersList ?? [])
      .filter(u => u.active && u.role !== "visualizador")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [usersList],
  );
  const areaList = useMemo(() => areas ?? [], [areas]);
  const routingMap = useMemo(() => new Map((routings ?? []).map(r => [r.criterionId, r])), [routings]);

  const create = useCreateCriterionForm(qKey);
  const maintenance = useCriteriaMaintenance(qKey);
  const duplicate = useDuplicateCriterion(qKey, criteria, areas);
  const areasEditor = useCriterionAreasEditor(qKey);

  const updateMutation = useUpdateCriterion({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: qKey });
        if (vars.data.active !== undefined) {
          const c = (criteria ?? []).find(x => x.id === vars.id);
          toast({
            title: vars.data.active ? "Critério reativado" : "Critério desativado",
            description: vars.data.active
              ? `${displayCriterionName(c?.name)} volta a entrar nos eventos novos.`
              : `${displayCriterionName(c?.name)} saiu dos eventos novos e dos não confirmados.`,
          });
          setDeactivateTarget(null);
        }
      },
      onError: (e: unknown, vars) => toast({
        title: vars.data.active !== undefined ? "Não foi possível mudar a situação" : "Não foi possível salvar o peso",
        description: serverMessage(e),
        variant: "destructive",
      }),
    },
  });
  const pendingVars = updateMutation.isPending ? updateMutation.variables : undefined;

  const activeCriteria = useMemo(() => (criteria ?? []).filter(c => c.active), [criteria]);
  const inactiveCriteria = useMemo(() => (criteria ?? []).filter(c => !c.active), [criteria]);
  const totalWeight = activeCriteria.reduce((s, c) => s + Number(c.defaultWeight || 0), 0);

  const stats: CriteriaStats = useMemo(() => {
    const ids = new Set<number>();
    let multiArea = 0;
    for (const c of activeCriteria) {
      const set = evaluatingAreaIdsOf(c, areaList);
      set.forEach(id => ids.add(id));
      if (set.size > 1) multiArea += 1;
    }
    return {
      active: activeCriteria.length,
      inactive: inactiveCriteria.length,
      multiArea,
      totalWeight,
      areaNames: areaList.filter(a => ids.has(a.id)).map(a => a.name),
    };
  }, [activeCriteria, inactiveCriteria, areaList, totalWeight]);

  const areaOptions = useMemo(() =>
    areaList
      .filter(a => a.active !== false)
      .map(a => ({ ...a, count: activeCriteria.filter(c => evaluatingAreaIdsOf(c, areaList).has(a.id)).length })),
    [areaList, activeCriteria],
  );

  const filterList = (list: Criterion[]) => {
    let out = list;
    if (filterAreaId === "__none") out = out.filter(c => c.responsibleAreaId == null);
    else if (filterAreaId !== "__all") {
      const id = Number(filterAreaId);
      out = out.filter(c => evaluatingAreaIdsOf(c, areaList).has(id));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) out = out.filter(c => displayCriterionName(c.name).toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
    return out.slice().sort((a, b) => displayCriterionName(a.name).localeCompare(displayCriterionName(b.name), "pt-BR"));
  };

  const rowProps = (c: Criterion): CriterionRowProps => ({
    criterion: c,
    share: weightShare(Number(c.defaultWeight || 0), totalWeight),
    routing: routingMap.get(c.id),
    pickerEvaluators: evaluatorsForArea(evaluators, c.responsibleAreaId),
    areas: areaList,
    canEdit,
    areaMode,
    savingWeight: pendingVars?.id === c.id && pendingVars.data.defaultWeight !== undefined,
    togglingActive: pendingVars?.id === c.id && pendingVars.data.active !== undefined,
    onSaveWeight: (crit, value) => updateMutation.mutate({ id: crit.id, data: { defaultWeight: value } }),
    onToggleActive: (crit, next) => {
      // Desativar pede confirmação (mexe nos eventos não confirmados); reativar é direto.
      if (!next) setDeactivateTarget(crit);
      else updateMutation.mutate({ id: crit.id, data: { active: true } });
    },
    onDuplicate: duplicate.startDuplicate,
    onOpenRouting: setRoutingDialogId,
    onEditAreas: areasEditor.start,
    onRoutingSaved: () => qc.invalidateQueries(),
  });

  const filtering = searchQuery.trim() !== "" || filterAreaId !== "__all";
  const groups: CriterionGroup[] = [
    { key: "active", items: filterList(activeCriteria).map(rowProps) },
    ...(showInactive ? [{ key: "inactive" as const, items: filterList(inactiveCriteria).map(rowProps) }] : []),
  ];
  const routingCriterion = routingDialogId != null ? (criteria ?? []).find(c => c.id === routingDialogId) : null;
  const hasAny = (criteria ?? []).length > 0;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <CriteriaHeader isAdmin={isAdmin} canEdit={canEdit} onMaintenance={maintenance.open} onCreate={() => create.setCreateOpen(true)} />

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {isLoading ? <CriteriaSkeleton /> : isError || !criteria ? (
          <ErrorBlock title="Não foi possível carregar os critérios" onRetry={() => { void refetch(); }} />
        ) : !hasAny ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={ListChecks} title="Nenhum critério cadastrado" testId="criteria-empty"
              action={canEdit ? <button type="button" onClick={() => create.setCreateOpen(true)} className={btnPrimary}><Plus size={15} aria-hidden /> Criar o primeiro</button> : undefined}>
              Os critérios definem o que é avaliado em cada evento, por qual área e com que peso.
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", isRefetching && "opacity-80")}>
            <CriteriaPanel stats={stats} showInactive={showInactive} onToggleInactive={() => setShowInactive(v => !v)} />
            <Notice icon={Info} tone={areaMode ? "info" : "neutral"} testId="criteria-rules-notice">
              <span className="font-semibold text-foreground">Mudanças aqui valem para os eventos novos e os ainda não confirmados.</span>{" "}
              Eventos confirmados guardam os critérios como histórico.
              {areaMode && <> Neste ciclo, <span className="font-semibold text-foreground">qualquer avaliador da área</span> responde o critério e a primeira resposta enviada fecha para a área.</>}
            </Notice>
            <div className="space-y-3">
              <CriteriaToolbar
                search={searchQuery}
                onSearchChange={setSearchQuery}
                areaId={filterAreaId}
                onAreaChange={setFilterAreaId}
                areaOptions={areaOptions}
                inactiveCount={inactiveCriteria.length}
                showInactive={showInactive}
                onToggleInactive={() => setShowInactive(v => !v)}
              />
              <CriteriaList groups={groups} filtering={filtering} totalActive={activeCriteria.length}
                onClearFilters={() => { setSearchQuery(""); setFilterAreaId("__all"); }} />
            </div>
            <ConformityRoutingCard
              areas={areas}
              conformityRoutings={conformityRoutings}
              evaluators={evaluators}
              withoutConduta={!!cycle?.conformityWithoutConduta}
              areaMode={areaMode}
              canEdit={canEdit}
            />
          </div>
        )}
      </div>

      <CreateCriterionDialog state={create} areas={areas} />
      <CriterionRoutingDialog
        criterionId={routingDialogId}
        criterion={routingCriterion}
        currentRouting={routingDialogId !== null ? routingMap.get(routingDialogId) : undefined}
        areas={areaList}
        evaluators={evaluators}
        areaMode={areaMode}
        onClose={() => setRoutingDialogId(null)}
      />
      <DuplicateCriterionDialog state={duplicate} areas={areas} />
      <CriterionAreasDialog editor={areasEditor} areas={areas} />
      <DeactivateCriterionDialog
        target={deactivateTarget}
        pending={!!deactivateTarget && pendingVars?.id === deactivateTarget.id}
        onConfirm={() => { if (deactivateTarget) updateMutation.mutate({ id: deactivateTarget.id, data: { active: false } }); }}
        onClose={() => setDeactivateTarget(null)}
      />
      <MaintenanceDialog maintenance={maintenance} />
    </div>
  );
}
