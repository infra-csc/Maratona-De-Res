import { useEffect, useMemo, useState } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { fmtNum } from "@/lib/utils";
import {
  useGetAreas,
  useUpdateEventCriteria, useConfirmEventCriteria, useResyncEventCriteria,
  useDuplicateEventCriterion, useDeleteEventCriterion, useUpdateCriterion, useUpdateEventAssignments,
  useSetEventCriterionAreas, useApplyEventCriteriaAreaDefaults,
  getGetEventsQueryKey, getGetEventQueryKey, getEventCriteria,
  type Evaluation, type EventDetail, type User,
} from "@workspace/api-client-react";
import { eventCriterionAssignmentsKey, useAllCriterionRoutings } from "@/lib/routing-api";
import { customFetch } from "@/lib/custom-fetch";
import type { ToastFn } from "./use-event-mutations";
import { areaCopiesByParent, serverMessage } from "./helpers";
import type { CriterionConfigItem, EnrichedEvent } from "./types";

/**
 * Gestão de Critérios (ativar/peso/duplicar/renomear/excluir) + atribuição de
 * avaliador por ÁREA do evento selecionado. O estado fica aqui (no componente
 * principal) para não se perder ao trocar de aba.
 */
export function useCriteriaManagement({ qc, toast, canManage, allUsers, evalIndex, selectedEventId, selectedDetail, selected }: {
  qc: QueryClient;
  toast: ToastFn;
  canManage: boolean;
  allUsers: User[] | undefined;
  evalIndex: Map<number, Map<number, Evaluation[]>>;
  selectedEventId: number | null;
  selectedDetail: EventDetail | undefined;
  selected: EnrichedEvent | null;
}) {
  const [config, setConfig] = useState<CriterionConfigItem[]>([]);
  const [showInactiveCriteria, setShowInactiveCriteria] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<Record<number, string>>({});
  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  const [primaryEvaluator, setPrimaryEvaluator] = useState<Record<number, number | null>>({});
  const [redirectExpanded, setRedirectExpanded] = useState<Record<number, boolean>>({});
  const [redirectSearch, setRedirectSearch] = useState<Record<number, string>>({});
  const [duplicateDialog, setDuplicateDialog] = useState<{ criterionId: number; baseName: string } | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateAreaId, setDuplicateAreaId] = useState("");
  const [swapDialog, setSwapDialog] = useState<{ ecId: number; currentName: string } | null>(null);
  const [swapSourceId, setSwapSourceId] = useState("");
  const [swapPending, setSwapPending] = useState(false);
  // Diálogo "Áreas que avaliam" de um critério ORIGINAL do evento.
  const [areasDialog, setAreasDialog] = useState<{ criterionId: number; name: string; responsibleAreaId: number | null; responsibleAreaName: string | null } | null>(null);
  const [areasSelection, setAreasSelection] = useState<number[]>([]);

  const { data: areasList } = useGetAreas({ query: { enabled: canManage, queryKey: ["areas"] as unknown[] } });
  const { data: allRoutings } = useAllCriterionRoutings();
  const evaluatorsAll = (allUsers ?? []).filter(u => u.role === "avaliador" && u.active);
  const evaluatorsForArea = (areaId: number) => evaluatorsAll.filter(u => u.areaId === areaId);
  // Avaliações do evento selecionado: consulta fresca quando já carregou,
  // senão a fatia da consulta global (mesmo índice usado no enriquecimento).
  const selectedEvaluations: Evaluation[] = useMemo(
    () => (selectedEventId != null ? [...(evalIndex.get(selectedEventId)?.values() ?? [])].flat() : []),
    [evalIndex, selectedEventId],
  );

  useEffect(() => {
    if (selectedDetail?.criteria) {
      setConfig(selectedDetail.criteria.map(c => ({
        id: c.id,
        criterionId: c.criterionId,
        active: c.active,
        weight: c.weightOverride ?? c.originalWeight ?? 0,
        name: c.criterionName ?? `Critério ${c.criterionId}`,
        eventScoped: c.eventScoped ?? false,
      })));
    }
  }, [selectedDetail?.criteria]);

  useEffect(() => {
    if (selectedDetail?.areaAssignments) {
      const map: Record<number, number[]> = {};
      const primMap: Record<number, number | null> = {};
      for (const a of selectedDetail.areaAssignments) {
        if (!map[a.areaId]) { map[a.areaId] = []; primMap[a.areaId] = null; }
        map[a.areaId].push(a.evaluatorUserId);
      }
      for (const [areaId, ids] of Object.entries(map)) {
        primMap[Number(areaId)] = ids[0] ?? null;
        map[Number(areaId)] = ids.slice(1);
      }
      if (allRoutings) {
        const routingByCriterionId = new Map(allRoutings.map(r => [r.criterionId, r]));
        const areaIdsWithCriteria = new Set(
          (selectedDetail.criteria ?? []).filter(c => c.active && c.responsibleAreaId != null).map(c => c.responsibleAreaId as number),
        );
        for (const areaId of areaIdsWithCriteria) {
          if (primMap[areaId] != null) continue;
          const criterionInArea = (selectedDetail.criteria ?? []).find(c => c.active && c.responsibleAreaId === areaId);
          const suggested = criterionInArea ? routingByCriterionId.get(criterionInArea.criterionId)?.defaultEvaluatorId : null;
          if (suggested != null) primMap[areaId] = suggested;
        }
      }
      setAssignments(map);
      setPrimaryEvaluator(primMap);
    }
  }, [selectedDetail?.areaAssignments, selectedDetail?.criteria, allRoutings]);

  const updateCriteria = useUpdateEventCriteria({
    mutation: {
      onSuccess: (data, vars) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) });
        qc.invalidateQueries({ queryKey: ["event-criteria", vars.id] });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        if (data.warnings && data.warnings.length > 0) toast({ title: "Pesos salvos", description: data.warnings.join(" "), variant: "destructive" });
        else toast({ title: "Pesos salvos" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });
  const confirmCriteriaMutation = useConfirmEventCriteria({
    mutation: {
      onSuccess: (_d, vars) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        // Liberar a avaliação gera as atribuições sugeridas no servidor.
        qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(vars.id) });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });
  const resyncCriteria = useResyncEventCriteria({
    mutation: {
      onSuccess: (data, vars) => {
        // Sincronizar muda o conjunto de critérios do evento: além do detalhe
        // e da lista de critérios, a fila (/events: totais, áreas sem avaliador)
        // e as atribuições por critério precisam ser recarregadas.
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) });
        qc.invalidateQueries({ queryKey: ["event-criteria", vars.id] });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(vars.id) });
        const removed = data.removedStale ?? 0;
        const added = data.addedNew ?? 0;
        const reactivated = (data as { reactivated?: number }).reactivated ?? 0;
        if (removed === 0 && added === 0 && reactivated === 0) {
          toast({ title: "Já está sincronizado", description: "Este evento já usa somente os critérios ativos." });
        } else {
          const parts: string[] = [];
          if (added > 0) parts.push(`${added} adicionado(s)`);
          if (reactivated > 0) parts.push(`${reactivated} reativado(s)`);
          if (removed > 0) parts.push(`${removed} desativado(s)`);
          toast({ title: "Critérios sincronizados", description: parts.join(", ") + "." });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
    },
  });
  const duplicateCriterion = useDuplicateEventCriterion({
    mutation: {
      onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) }); qc.invalidateQueries({ queryKey: ["event-criteria", vars.id] }); toast({ title: "Quesito duplicado" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
    },
  });
  const deleteCriterion = useDeleteEventCriterion({
    mutation: {
      onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) }); qc.invalidateQueries({ queryKey: ["event-criteria", vars.id] }); toast({ title: "Quesito excluído" }); },
      // "Não encontrado" no delete significa que o servidor já não tem esse quesito
      // (foi excluído em outra ação, ou a lista ficou dessincronizada após um
      // "Sincronizar Critérios"). Sem isso, a linha "fantasma" ficava presa na
      // tela para sempre — recarrega para o cliente refletir o estado real.
      onError: (e: { message?: string }, vars) => {
        toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) });
      },
    },
  });
  // Mudar as áreas de um critério cria/remove cópias: mesmas chaves que a
  // duplicação de quesito + fila (/evaluation-console), atribuições e /events.
  const invalidateEventStructure = (eventId: number) => {
    qc.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
    qc.invalidateQueries({ queryKey: ["event-criteria", eventId] });
    qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(eventId) });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: ["/evaluation-console"] });
  };
  const setCriterionAreas = useSetEventCriterionAreas({
    mutation: {
      onSuccess: (_d, vars) => {
        invalidateEventStructure(vars.id);
        toast({ title: "Áreas atualizadas", description: "A nota do critério neste evento é a média das áreas que avaliam." });
        setAreasDialog(null);
      },
      onError: (e: unknown, vars) => {
        toast({ title: "Não foi possível alterar as áreas", description: serverMessage(e), variant: "destructive" });
        invalidateEventStructure(vars.id);
      },
    },
  });
  const applyAreaDefaults = useApplyEventCriteriaAreaDefaults({
    mutation: {
      onSuccess: (data, vars) => {
        invalidateEventStructure(vars.id);
        const before = (selectedDetail?.criteria ?? []).filter(c => c.eventScoped).length;
        const after = (data.criteria ?? []).filter(c => c.eventScoped).length;
        const created = Math.max(0, after - before);
        toast(created > 0
          ? { title: "Áreas do padrão aplicadas", description: `${created} área${created !== 1 ? "s" : ""} adicionada${created !== 1 ? "s" : ""} aos critérios deste evento.` }
          : { title: "Nada a aplicar", description: "Este evento já tem todas as áreas definidas no padrão do catálogo." });
      },
      onError: (e: unknown) => toast({ title: "Não foi possível aplicar o padrão", description: serverMessage(e), variant: "destructive" }),
    },
  });
  const renameCriterion = useUpdateCriterion({
    mutation: {
      // vars.id aqui é o CRITÉRIO, não o evento — usa o evento selecionado com guarda.
      onSuccess: () => {
        if (selectedEventId != null) {
          qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId) });
          qc.invalidateQueries({ queryKey: ["event-criteria", selectedEventId] });
        }
        toast({ title: "Nome atualizado" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao renomear", description: e.message, variant: "destructive" }),
    },
  });
  const updateAssignments = useUpdateEventAssignments({
    mutation: {
      onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(vars.id) }); qc.invalidateQueries({ queryKey: getGetEventsQueryKey() }); toast({ title: "Avaliadores atribuídos" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
    },
  });

  // GET /events/:id não traz sourceCriterionId das cópias; GET /events/:id/criteria
  // traz. Mesma chave/consulta da Central (use-console-data): sai do cache.
  const { data: eventCriteriaRows } = useQuery({
    queryKey: ["event-criteria", selectedEventId] as unknown[],
    queryFn: () => getEventCriteria(selectedEventId as number),
    enabled: selectedEventId != null,
  });
  const eventCriteria = useMemo(() => {
    const sourceById = new Map((eventCriteriaRows ?? []).map(r => [r.criterionId, r.sourceCriterionId ?? null]));
    return (selectedDetail?.criteria ?? []).map(c => ({ ...c, sourceCriterionId: c.sourceCriterionId ?? sourceById.get(c.criterionId) ?? null }));
  }, [selectedDetail?.criteria, eventCriteriaRows]);
  const areaCopies = useMemo(() => areaCopiesByParent(eventCriteria), [eventCriteria]);
  const critMeta = new Map((selectedDetail?.criteria ?? []).map(c => [c.criterionId, c]));
  const targetWeightSum = (selectedDetail?.criteria ?? []).reduce((s, c) => s + (Number(c.originalWeight) || 0), 0);
  const criteriaConfirmed = selectedDetail?.criteriaConfirmed ?? false;
  const hasEvaluations = selectedDetail?.hasEvaluations ?? false;
  const editLocked = criteriaConfirmed || hasEvaluations;
  const weightsDirty = config.some(item => {
    const meta = critMeta.get(item.criterionId);
    const original = meta ? (meta.weightOverride ?? meta.originalWeight ?? 0) : item.weight;
    return item.active !== meta?.active || Number(item.weight) !== Number(original);
  });
  const setCriterionActive = (criterionId: number, active: boolean) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, active } : c)));
  const criterionHasEvals = (criterionId: number) =>
    selectedEvaluations.some(e => e.criterionId === criterionId && e.status === "submitted");
  const setCriterionWeight = (criterionId: number, weight: number) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, weight } : c)));
  const handleSaveCriteria = () => {
    if (!selected) return;
    updateCriteria.mutate({ id: selected.id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
  };
  const handleConfirmCriteria = (value: boolean) => {
    if (!selected) return;
    confirmCriteriaMutation.mutate({ id: selected.id, data: { confirmed: value } });
  };
  const computeSequentialName = (baseName: string): string => {
    const root = baseName.replace(/\s*\(\d+\)$/, "");
    const existing = (selectedDetail?.criteria ?? []).map(c => c.criterionName ?? "");
    const nums = existing.map(n => {
      const m = n.match(new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\((\\d+)\\)$`));
      return m ? parseInt(m[1]) : null;
    }).filter((n): n is number => n !== null);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 2;
    return `${root} (${next})`;
  };
  const handleDuplicate = (criterionId: number, baseName: string) => {
    const suggested = computeSequentialName(baseName);
    setDuplicateName(suggested);
    setDuplicateAreaId("");
    setDuplicateDialog({ criterionId, baseName });
  };
  const handleConfirmDuplicate = () => {
    if (!duplicateDialog || !selected) return;
    const selectedArea = areasList?.find(a => a.id.toString() === duplicateAreaId);
    duplicateCriterion.mutate({
      id: selected.id,
      data: {
        sourceCriterionId: duplicateDialog.criterionId,
        name: duplicateName.trim() || computeSequentialName(duplicateDialog.baseName),
        ...(selectedArea ? { responsibleAreaId: selectedArea.id, responsibleAreaLabel: selectedArea.name } : {}),
      },
    }, { onSuccess: () => setDuplicateDialog(null) });
  };
  const handleRename = (criterionId: number) => {
    const name = (editingName[criterionId] ?? "").trim();
    if (!name) return;
    renameCriterion.mutate({ id: criterionId, data: { name } });
    setEditingName(prev => { const n = { ...prev }; delete n[criterionId]; return n; });
  };
  const handleSwapSource = async () => {
    if (!swapDialog || !selected || !swapSourceId) return;
    setSwapPending(true);
    try {
      await customFetch(`/api/events/${selected.id}/criteria/${swapDialog.ecId}/swap-source`, {
        method: "PATCH",
        body: JSON.stringify({ sourceCriterionId: Number(swapSourceId) }),
      });
      qc.invalidateQueries({ queryKey: getGetEventQueryKey(selected.id) });
      qc.invalidateQueries({ queryKey: ["event-criteria", selected.id] });
      toast({ title: "Origem corrigida com sucesso" });
      setSwapDialog(null);
      setSwapSourceId("");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? (e as { message: string }).message : String(e);
      toast({ title: "Erro ao corrigir", description: msg, variant: "destructive" });
    } finally {
      setSwapPending(false);
    }
  };
  const assignAreas = Array.from(
    new Map(
      (selectedDetail?.criteria ?? [])
        .filter(c => c.active && c.responsibleAreaId != null)
        .map(c => [c.responsibleAreaId as number, c.responsibleAreaName ?? `Área ${c.responsibleAreaId}`] as [number, string])
    ).entries()
  ).map(([areaId, areaName]) => ({ areaId, areaName }));
  const buildOrderedEvaluatorIds = (areaId: number): number[] => {
    const primary = primaryEvaluator[areaId];
    const backups = (assignments[areaId] ?? []).filter(uid => uid !== primary);
    return primary != null ? [primary, ...backups] : backups;
  };
  const allAssigned = assignAreas.every(a => primaryEvaluator[a.areaId] != null);
  const areOrderedEqual = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const assignmentsDirty = assignAreas.some(a => {
    const ordered = buildOrderedEvaluatorIds(a.areaId);
    const current = (selectedDetail?.areaAssignments ?? []).filter(x => x.areaId === a.areaId).map(x => x.evaluatorUserId);
    return !areOrderedEqual(ordered, current);
  });
  const toggleBackupEvaluator = (areaId: number, userId: number, checked: boolean) =>
    setAssignments(prev => {
      const current = (prev[areaId] ?? []).filter(uid => uid !== primaryEvaluator[areaId]);
      const next = checked ? [...current, userId] : current.filter(v => v !== userId);
      return { ...prev, [areaId]: next };
    });
  const buildAssignmentsPayload = () => assignAreas.map(a => ({ areaId: a.areaId, evaluatorUserIds: buildOrderedEvaluatorIds(a.areaId) }));
  const handleSaveAssignments = () => {
    if (!selected) return;
    updateAssignments.mutate({ id: selected.id, data: { assignments: buildAssignmentsPayload() } });
  };
  const handleSaveAllCriteria = () => {
    handleSaveCriteria();
    if (assignmentsDirty) handleSaveAssignments();
  };
  const handleConfirmAndRelease = async () => {
    if (!selected) return;
    try {
      await updateCriteria.mutateAsync({ id: selected.id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
      if (assignmentsDirty) {
        await updateAssignments.mutateAsync({ id: selected.id, data: { assignments: buildAssignmentsPayload() } });
      }
      await confirmCriteriaMutation.mutateAsync({ id: selected.id, data: { confirmed: true } });
    } catch {
      // erros já exibidos via toasts de onError de cada mutation
    }
  };
  const areasLockedReason = hasEvaluations
    ? "Este evento já possui avaliações: as áreas que avaliam não podem mais ser alteradas."
    : null;
  const openAreasDialog = (criterionId: number) => {
    const meta = critMeta.get(criterionId);
    if (!meta || meta.eventScoped) return;
    setAreasSelection((areaCopies.get(criterionId) ?? []).map(c => c.areaId));
    setAreasDialog({
      criterionId,
      name: meta.criterionName ?? `Critério ${criterionId}`,
      responsibleAreaId: meta.responsibleAreaId ?? null,
      responsibleAreaName: meta.responsibleAreaName ?? null,
    });
  };
  /** Cópias do critério que NÃO são de outra área (feitas à mão na mesma área): somem ao salvar as áreas. */
  const sameAreaCopiesOf = (criterionId: number) => {
    const parentArea = critMeta.get(criterionId)?.responsibleAreaId ?? null;
    return eventCriteria.filter(c =>
      c.eventScoped && c.sourceCriterionId === criterionId && (c.responsibleAreaId == null || c.responsibleAreaId === parentArea));
  };
  const handleSaveAreas = () => {
    if (!areasDialog || !selected) return;
    const areaIds = [...new Set(areasSelection)].filter(a => a !== areasDialog.responsibleAreaId);
    setCriterionAreas.mutate({ id: selected.id, criterionId: areasDialog.criterionId, data: { areaIds } });
  };
  const handleApplyAreaDefaults = () => {
    if (!selected) return;
    applyAreaDefaults.mutate({ id: selected.id });
  };
  const confirmBusy = updateCriteria.isPending || updateAssignments.isPending || confirmCriteriaMutation.isPending;
  const fmtW = (v: number) => fmtNum(v, 1);

  return {
    // estado
    config, showInactiveCriteria, setShowInactiveCriteria,
    pendingRemoval, setPendingRemoval, pendingDelete, setPendingDelete,
    editingName, setEditingName,
    assignments, primaryEvaluator, setPrimaryEvaluator,
    redirectExpanded, setRedirectExpanded, redirectSearch, setRedirectSearch,
    duplicateDialog, setDuplicateDialog, duplicateName, setDuplicateName, duplicateAreaId, setDuplicateAreaId,
    swapDialog, setSwapDialog, swapSourceId, setSwapSourceId, swapPending,
    areasDialog, setAreasDialog, areasSelection, setAreasSelection,
    // dados
    areasList, evaluatorsForArea,
    // mutações
    updateCriteria, confirmCriteriaMutation, resyncCriteria, duplicateCriterion, deleteCriterion, updateAssignments,
    setCriterionAreas, applyAreaDefaults,
    // derivados e ações
    critMeta, targetWeightSum, criteriaConfirmed, hasEvaluations, editLocked, weightsDirty,
    setCriterionActive, criterionHasEvals, setCriterionWeight,
    handleSaveCriteria, handleConfirmCriteria, handleDuplicate, handleConfirmDuplicate, handleRename, handleSwapSource,
    assignAreas, allAssigned, assignmentsDirty, toggleBackupEvaluator,
    handleSaveAssignments, handleSaveAllCriteria, handleConfirmAndRelease, confirmBusy, fmtW,
    areaCopies, areasLockedReason, openAreasDialog, sameAreaCopiesOf, handleSaveAreas, handleApplyAreaDefaults,
  };
}

export type CriteriaManagement = ReturnType<typeof useCriteriaManagement>;
