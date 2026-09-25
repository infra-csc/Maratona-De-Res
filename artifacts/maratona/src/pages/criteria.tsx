// Tela "Critérios de Avaliação": dados, filtros e orquestração. As peças
// visuais vivem em ./criteria/: cabeçalho com as ações de manutenção,
// tabela (linha, célula de peso, seletor de avaliador), card da matriz de
// conformidade, diálogos (novo, duplicar, roteamento, resumo do sync) e os
// hooks de formulário/manutenção.
import { useState, useMemo } from "react";
import { useGetCriteria, useUpdateCriterion, useGetAreas, useGetUsers, getGetCriteriaQueryKey, useGetConformityRouting } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAllCriterionRoutings } from "@/lib/routing-api";
import { useAuth, hasRole } from "@/lib/auth-context";
import { BODY } from "@/lib/premium-theme";
import { useCriteriaMaintenance } from "./criteria/use-criteria-maintenance";
import { useCreateCriterionForm, useDuplicateCriterion } from "./criteria/use-criterion-forms";
import { CriteriaHeader } from "./criteria/criteria-header";
import { CriteriaTable } from "./criteria/criteria-table";
import { ConformityRoutingCard } from "./criteria/conformity-routing-card";
import { CreateCriterionDialog, DuplicateCriterionDialog, ResyncSummaryDialog } from "./criteria/criterion-dialogs";
import { CriterionRoutingDialog } from "./criteria/routing-config-dialog";

export default function CriteriaPage() {
  const { user } = useAuth();
  // Espelha o backend: POST/PATCH /criteria exigem admin|rh (diretoria só visualiza).
  const canEdit = hasRole(user, "admin") || hasRole(user, "rh");
  const qc = useQueryClient();
  const [routingDialogId, setRoutingDialogId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAreaId, setFilterAreaId] = useState<string>("__all");

  const qKey = getGetCriteriaQueryKey();
  const { data: criteria, isLoading } = useGetCriteria({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: usersList } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });
  const { data: routings } = useAllCriterionRoutings();
  const { data: conformityRoutings } = useGetConformityRouting();

  const evaluators = useMemo(() =>
    (usersList ?? [])
      .filter(u => u.active && u.role !== "visualizador")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [usersList],
  );

  const routingMap = new Map((routings ?? []).map(r => [r.criterionId, r]));

  const create = useCreateCriterionForm(qKey);

  const updateMutation = useUpdateCriterion({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    },
  });

  const maintenance = useCriteriaMaintenance(qKey);

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const inactiveCriteria = (criteria ?? []).filter(c => !c.active);
  const baseDisplayed = showInactive ? (criteria ?? []) : activeCriteria;

  const displayedCriteria = useMemo(() => {
    let list = baseDisplayed;
    if (filterAreaId !== "__all") {
      const areaIdNum = parseInt(filterAreaId);
      list = list.filter(c => (c.responsibleAreaId ?? null) === (Number.isNaN(areaIdNum) ? null : areaIdNum));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [baseDisplayed, filterAreaId, searchQuery]);

  const routingCriterion = routingDialogId != null ? (criteria ?? []).find(c => c.id === routingDialogId) : null;

  const duplicate = useDuplicateCriterion(qKey, criteria, areas);

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        <CriteriaHeader
          maintenance={maintenance}
          canEdit={canEdit}
          createOpen={create.open}
          onCreateOpenChange={create.setCreateOpen}
        />

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando critérios...</div>
        ) : (
          <CriteriaTable
            displayedCriteria={displayedCriteria}
            baseCount={baseDisplayed.length}
            inactiveCount={inactiveCriteria.length}
            showInactive={showInactive}
            onToggleInactive={() => setShowInactive(v => !v)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterAreaId={filterAreaId}
            onFilterAreaChange={setFilterAreaId}
            areas={areas}
            routingMap={routingMap}
            evaluators={evaluators}
            updateMutation={updateMutation}
            onDuplicate={duplicate.startDuplicate}
            onOpenRouting={setRoutingDialogId}
            onRoutingSaved={() => qc.invalidateQueries()}
          />
        )}

        {/* Avaliador Padrão da Matriz de Conformidade */}
        <ConformityRoutingCard areas={areas} conformityRoutings={conformityRoutings} evaluators={evaluators} />
      </div>

      {/* Create Criterion Dialog */}
      <CreateCriterionDialog state={create} areas={areas} />

      {/* Routing config dialog */}
      <CriterionRoutingDialog
        criterionId={routingDialogId}
        criterion={routingCriterion}
        currentRouting={routingDialogId !== null ? routingMap.get(routingDialogId) : undefined}
        areas={areas ?? []}
        evaluators={evaluators}
        onClose={() => setRoutingDialogId(null)}
      />

      {/* Duplicate criterion dialog */}
      <DuplicateCriterionDialog state={duplicate} areas={areas} />

      {/* Resync summary dialog */}
      <ResyncSummaryDialog summary={maintenance.resyncSummary} onClose={() => maintenance.setResyncSummary(null)} />
    </div>
  );
}
