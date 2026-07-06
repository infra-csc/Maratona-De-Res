import { useRoute, Link } from "wouter";
import { useState, useEffect } from "react";
import { useGetEvent, useGetEventResult, useGetEvaluations, useUpdateEventCriteria, useConfirmEventCriteria, useUpdateEventAssignments, useDuplicateEventCriterion, useDeleteEventCriterion, useUpdateCriterion, useGetUsers, useRemoveEventParticipant, useAddEventParticipant, useUpdateEventParticipant, useGetEmployees, useGetEventConformity, useSetEventConformity, useConfirmEventResults, useUnconfirmEventResults, getGetEventQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Users, BarChart3, TrendingUp, CheckCircle2, ShieldAlert, SlidersHorizontal, Lock, Unlock, AlertCircle, AlertTriangle, Save, Trash2, RotateCcw, UserCheck, UserX, UserPlus, ClipboardList, Copy, Check, ChevronsUpDown } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { AudioPlayer } from "@/components/audio-recorder";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

function eventDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatDiariaDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
}

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const id = params ? parseInt(params.id) : 0;

  const { user } = useAuth();
  const canViewResult = !!user && ["admin", "rh", "diretoria"].includes(user.role);

  const { data: event, isLoading } = useGetEvent(id, {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id) },
  });

  const { data: result } = useGetEventResult(id, {
    query: { enabled: !!id && canViewResult, queryKey: ["event-result", id] as unknown[] },
  });
  const participantResults = result?.participants ?? [];

  const { data: evaluations } = useGetEvaluations(
    { eventId: id },
    { query: { enabled: !!id && canViewResult, queryKey: ["evals", id] as unknown[] } }
  );
  const justificationsFor = (critId: number) =>
    (evaluations ?? [])
      .filter(e => e.criterionId === critId && e.status === "submitted")
      .map(e => ({ name: e.evaluatorName ?? "Avaliador", score: parseFloat(e.score as unknown as string), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null }));

  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = !!user && ["admin", "rh"].includes(user.role);

  const { data: conformityData } = useGetEventConformity(id, {
    query: { enabled: !!id, queryKey: ["event-conformity", id] as unknown[] },
  });
  const setConformity = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["event-conformity", id] });
        qc.invalidateQueries({ queryKey: ["event-result", id] });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        toast({ title: "Matriz de conformidade atualizada", variant: "default" });
      },
      onError: () => toast({ title: "Erro ao salvar conformidade", variant: "destructive" }),
    },
  });
  const [conformityForm, setConformityForm] = useState<{ epi: boolean; estaiamentos: boolean; guardaEquipamentos: boolean; conduta: boolean }>({ epi: true, estaiamentos: true, guardaEquipamentos: true, conduta: true });
  const conformityItems = [
    { key: "epi" as const, label: "Uso de EPI" },
    { key: "estaiamentos" as const, label: "Estaiamentos / Aterramentos" },
    { key: "guardaEquipamentos" as const, label: "Guarda de Equipamentos" },
    { key: "conduta" as const, label: "Conduta" },
  ];
  useEffect(() => {
    if (conformityData) {
      setConformityForm({
        epi: conformityData.epi,
        estaiamentos: conformityData.estaiamentos,
        guardaEquipamentos: conformityData.guardaEquipamentos,
        conduta: conformityData.conduta,
      });
    }
  }, [conformityData?.id]);

  const [config, setConfig] = useState<{ id: number; criterionId: number; active: boolean; weight: number; name: string; eventScoped: boolean }[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingRemoveParticipant, setPendingRemoveParticipant] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<Record<number, string>>({});
  useEffect(() => {
    if (event?.criteria) {
      setConfig(event.criteria.map(c => ({
        id: c.id,
        criterionId: c.criterionId,
        active: c.active,
        weight: c.weightOverride ?? c.originalWeight ?? 0,
        name: c.criterionName ?? `Critério ${c.criterionId}`,
        eventScoped: c.eventScoped ?? false,
      })));
    }
  }, [event?.criteria]);

  const updateCriteria = useUpdateEventCriteria({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Pesos salvos", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Pesos salvos" });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });
  const confirmCriteria = useConfirmEventCriteria({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const confirmResults = useConfirmEventResults({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Resultados confirmados", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Resultados confirmados", description: "O evento agora conta na elegibilidade e na nota dos colaboradores." });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao confirmar resultados", description: e.message, variant: "destructive" }),
    },
  });
  const unconfirmResults = useUnconfirmEventResults({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        toast({ title: "Confirmação revertida", description: "O evento deixou de contar na elegibilidade e na nota dos colaboradores." });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao reverter confirmação", description: e.message, variant: "destructive" }),
    },
  });
  const resultsConfirmBusy = confirmResults.isPending || unconfirmResults.isPending;

  const duplicateCriterion = useDuplicateEventCriterion({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Quesito duplicado" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
    },
  });
  const deleteCriterion = useDeleteEventCriterion({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Quesito excluído" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    },
  });
  const renameCriterion = useUpdateCriterion({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Nome atualizado" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao renomear", description: e.message, variant: "destructive" }),
    },
  });

  const removeParticipant = useRemoveEventParticipant({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Participante removido" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
    },
  });

  const updateParticipant = useUpdateEventParticipant({
    mutation: {
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        if (vars.data.confirmed !== undefined) {
          toast({ title: vars.data.confirmed ? "Colaborador reativado" : "Colaborador marcado como inativo" });
        } else if (vars.data.actualDiariaDates !== undefined) {
          toast({ title: "Diárias realizadas atualizadas" });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [newParticipantEmployeeId, setNewParticipantEmployeeId] = useState<number | null>(null);
  const [newParticipantFunction, setNewParticipantFunction] = useState("");
  const { data: allEmployees } = useGetEmployees({ active: true }, { query: { enabled: canManage, queryKey: ["employees", "active"] as unknown[] } });
  const alreadyAllocatedIds = new Set((event?.participants ?? []).map(p => p.employeeId));
  const availableEmployees = (allEmployees ?? []).filter(e => !alreadyAllocatedIds.has(e.id));
  const selectedNewEmployee = availableEmployees.find(e => e.id === newParticipantEmployeeId);

  const addParticipant = useAddEventParticipant({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        toast({ title: "Colaborador adicionado à equipe" });
        setAddParticipantOpen(false);
        setNewParticipantEmployeeId(null);
        setNewParticipantFunction("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
    },
  });

  const { data: usersList } = useGetUsers({ query: { enabled: canManage, queryKey: ["users"] as unknown[] } });
  const evaluators = (usersList ?? []).filter(u => u.role === "avaliador" && u.active);
  // Apenas avaliadores RELACIONADOS à área aparecem no seletor daquela área.
  const evaluatorsForArea = (areaId: number) => evaluators.filter(u => u.areaId === areaId);

  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  useEffect(() => {
    if (event?.areaAssignments) {
      const map: Record<number, number[]> = {};
      for (const a of event.areaAssignments) {
        if (!map[a.areaId]) map[a.areaId] = [];
        map[a.areaId].push(a.evaluatorUserId);
      }
      setAssignments(map);
    }
  }, [event?.areaAssignments]);

  const updateAssignments = useUpdateEventAssignments({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Avaliadores atribuídos" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) {
    return (
      <div className="bg-[#f7f9fb] min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="h-8 w-32 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        <div className="h-40 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-[#f7f9fb] min-h-full p-6 md:p-10 max-w-4xl mx-auto text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="py-24 bg-white border-2 border-dashed border-[#191c1e] text-[#747a60] italic uppercase font-bold">
          Evento não encontrado ou indisponível.
        </div>
      </div>
    );
  }

  const fmt = (v: number) => `${v.toFixed(1)}`;
  const activeCriteriaCount = (event.criteria ?? []).filter(c => c.active).length;
  const critMeta = new Map((event.criteria ?? []).map(c => [c.criterionId, c]));
  const activeSum = config.filter(c => c.active).reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const targetWeightSum = (event.criteria ?? []).reduce((s, c) => s + (Number(c.originalWeight) || 0), 0);
  const sumValid = Math.abs(activeSum - targetWeightSum) <= 0.01;
  const criteriaConfirmed = event.criteriaConfirmed ?? false;
  const hasEvaluations = event.hasEvaluations ?? false;
  // A estrutura do evento (ativar/desativar, duplicar, excluir, renomear
  // quesito, trocar avaliador) trava após confirmação/avaliações. Os PESOS,
  // porém, podem sempre ser editados — inclusive durante calibração ou com o
  // evento fechado — e o resultado é recalculado ao salvar.
  const editLocked = criteriaConfirmed || hasEvaluations;
  const weightsDirty = config.some(item => {
    const meta = critMeta.get(item.criterionId);
    const original = meta ? (meta.weightOverride ?? meta.originalWeight ?? 0) : item.weight;
    return item.active !== meta?.active || Number(item.weight) !== Number(original);
  });

  const setCriterionActive = (criterionId: number, active: boolean) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, active } : c)));
  const setCriterionWeight = (criterionId: number, weight: number) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, weight } : c)));
  const handleSaveCriteria = () =>
    updateCriteria.mutate({ id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
  const handleConfirmCriteria = (value: boolean) => confirmCriteria.mutate({ id, data: { confirmed: value } });
  const handleDuplicate = (criterionId: number, baseName: string) =>
    duplicateCriterion.mutate({ id, data: { sourceCriterionId: criterionId, name: `${baseName} (cópia)` } });
  const handleRename = (criterionId: number) => {
    const name = (editingName[criterionId] ?? "").trim();
    if (!name) return;
    renameCriterion.mutate({ id: criterionId, data: { name } });
    setEditingName(prev => { const n = { ...prev }; delete n[criterionId]; return n; });
  };
  const evaluationProgress = Math.round((event.evaluationProgress ?? 0) * 100);

  // Áreas que precisam de um avaliador atribuído: toda área responsável por um
  // critério ativo (espelha a regra do backend em areasNeedingAssignment).
  const assignAreas = Array.from(
    new Map(
      (event.criteria ?? [])
        .filter(c => c.active && c.responsibleAreaId != null)
        .map(c => [c.responsibleAreaId as number, c.responsibleAreaName ?? `Área ${c.responsibleAreaId}`] as [number, string])
    ).entries()
  ).map(([areaId, areaName]) => ({ areaId, areaName }));
  const allAssigned = assignAreas.every(a => (assignments[a.areaId] ?? []).length > 0);
  const sameEvaluatorSet = (a: number[], b: number[]) => {
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  };
  const assignmentsDirty = assignAreas.some(a => {
    const current = (event.areaAssignments ?? []).filter(x => x.areaId === a.areaId).map(x => x.evaluatorUserId);
    return !sameEvaluatorSet(assignments[a.areaId] ?? [], current);
  });
  const toggleAreaEvaluator = (areaId: number, userId: number, checked: boolean) =>
    setAssignments(prev => {
      const current = prev[areaId] ?? [];
      const next = checked ? [...current, userId] : current.filter(v => v !== userId);
      return { ...prev, [areaId]: next };
    });
  const buildAssignmentsPayload = () => assignAreas.map(a => ({ areaId: a.areaId, evaluatorUserIds: assignments[a.areaId] ?? [] }));
  const handleSaveAssignments = () =>
    updateAssignments.mutate({ id, data: { assignments: buildAssignmentsPayload() } });
  const handleSaveAll = () => {
    if (sumValid) handleSaveCriteria();
    if (assignmentsDirty) handleSaveAssignments();
  };
  // Salva quaisquer pesos/avaliadores pendentes e SÓ ENTÃO confirma, em um clique.
  // Evita o estado em que tudo está preenchido mas o botão fica travado por não ter salvo.
  const handleConfirmAndRelease = async () => {
    try {
      if (sumValid) {
        await updateCriteria.mutateAsync({ id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
      }
      if (assignmentsDirty) {
        await updateAssignments.mutateAsync({ id, data: { assignments: buildAssignmentsPayload() } });
      }
      await confirmCriteria.mutateAsync({ id, data: { confirmed: true } });
    } catch {
      // erros já são exibidos via toasts de onError de cada mutation
    }
  };
  const confirmBusy = updateCriteria.isPending || updateAssignments.isPending || confirmCriteria.isPending;

  const overview: { label: string; value: string }[] = [
    { label: "Status", value: event.status },
    { label: "Período", value: `${new Date(event.startDate).toLocaleDateString('pt-BR')} — ${new Date(event.endDate).toLocaleDateString('pt-BR')}` },
    { label: "Local", value: event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : (event.location ?? "—") },
    { label: "Cliente", value: event.clientName ?? "—" },
    { label: "Participantes", value: String(event.participants?.length ?? 0) },
    { label: "Progresso", value: `${evaluationProgress}% avaliado` },
  ];

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-bold italic uppercase tracking-wider text-[#444933] hover:text-[#506600] transition-colors group">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Voltar para Eventos
        </Link>

        {/* Hero */}
        <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="h-2 bg-[#ccff00] border-b-2 border-[#191c1e]" />
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <StatusBadge status={event.status} />
                  {event.isHistorical && (
                    <span data-testid="badge-historical" className="bg-[#ffb300] text-[#3b2900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                      <span className="inline-block skew-x-[8deg]">Histórico</span>
                    </span>
                  )}
                  {event.cycleName && (
                    <span className="bg-[#191c1e] text-[#ccff00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                      <span className="inline-block skew-x-[8deg]">{event.cycleName}</span>
                    </span>
                  )}
                  {event.forcedClosed && (
                    <span className="bg-[#ff5722] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><ShieldAlert size={10} /> Fechamento Forçado</span>
                    </span>
                  )}
                  {event.resultsConfirmed ? (
                    <span data-testid="badge-results-confirmed" className="bg-[#ccff00] text-[#161e00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><CheckCircle2 size={10} /> Resultados Confirmados</span>
                    </span>
                  ) : (
                    <span data-testid="badge-results-pending" className="bg-[#ff5722] text-white px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><AlertCircle size={10} /> Resultados Não Confirmados</span>
                    </span>
                  )}
                </div>
                <h1 data-testid="text-event-name" className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none mb-2 pr-1.5">{event.name}</h1>
                {event.clientName && <p className="text-base md:text-lg font-bold italic uppercase text-[#506600] mb-6">{event.clientName}</p>}

                <div className="flex flex-wrap items-center gap-5 text-sm font-bold italic text-[#444933]">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#506600]" />
                    <span>{new Date(event.startDate).toLocaleDateString('pt-BR')} — {new Date(event.endDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {(event.city || event.location) && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#506600]" />
                      <span>{event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#506600]" />
                    <span className={evaluationProgress === 100 ? "text-[#506600] font-black" : ""}>{evaluationProgress}% Avaliado</span>
                  </div>
                </div>
              </div>

              {result && result.eventScore > 0 && (() => {
                const concluded = !!event.feedbackReleased;
                const calibrated = (result.criteriaDetails ?? []).some(c => c.calibratedScore != null);
                const displayScore = (result.conformityScore != null ? result.conformityScore : result.eventScore) as number;
                const hasPenalty = (result.conformityPenalty ?? 0) > 0;
                return (
                <div className={`shrink-0 border-2 border-[#191c1e] p-6 flex flex-col items-center justify-center min-w-[160px] -skew-x-6 ${hasPenalty ? "bg-[#ffb300]" : "bg-[#ccff00]"}`}>
                  <div className="skew-x-6 flex flex-col items-center">
                    <span className="text-[10px] font-black italic uppercase tracking-widest text-[#161e00] mb-1">{concluded ? "Avaliação Final" : "Avaliação Parcial"}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black italic text-[#161e00] leading-none">{fmt(displayScore)}</span>
                      <span className="text-sm font-black italic text-[#506600]">/100</span>
                    </div>
                    {hasPenalty && (
                      <span className="mt-1 text-[9px] font-black italic uppercase text-[#862200] bg-white border border-[#862200] px-1.5 py-0.5">
                        -{result.conformityPenalty} pts conformidade
                      </span>
                    )}
                    {!concluded && (
                      <span className="mt-2 inline-flex items-center gap-1 bg-[#191c1e] text-[#ffb300] text-[9px] font-black italic uppercase tracking-wider px-2 py-1" data-testid="badge-calibration-pending">
                        <AlertCircle size={11} />
                        {calibrated ? "Calibragem parcial" : "Aguardando calibragem"}
                      </span>
                    )}
                    {result.projectedPlatoon && (
                      <div className="mt-3">
                        <PlatoonBadge platoon={result.projectedPlatoon} colorHex={result.projectedPlatoonColor} />
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Participantes</p>
              <p data-testid="text-participant-count" className="text-2xl font-black italic text-[#191c1e]">{event.participants?.length ?? 0}</p>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Critérios Ativos</p>
              <p className="text-2xl font-black italic text-[#191c1e]">{activeCriteriaCount}</p>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Quesitos Avaliados</p>
              <p className="text-2xl font-black italic text-[#191c1e]">{result?.evaluatedCriteria ?? 0} / {result?.totalCriteria ?? activeCriteriaCount}</p>
            </div>
          </div>
        </div>

        {/* Visão Geral */}
        <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
            <ClipboardList size={18} />
            <span className="font-black uppercase tracking-tight">Visão Geral</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 divide-x-2 divide-y-2 divide-[#eceef0] border-t-0">
            {overview.map(item => (
              <div key={item.label} data-testid={`overview-${item.label.toLowerCase()}`} className="p-5">
                <p className="text-[10px] font-bold italic uppercase tracking-wider text-[#747a60] mb-1">{item.label}</p>
                <p className="font-black italic uppercase text-sm text-[#191c1e] break-words">{item.value}</p>
              </div>
            ))}
            {canViewResult && (
              <div data-testid="overview-score" className="p-5 bg-[#ccff00]/20">
                <p className="text-[10px] font-bold italic uppercase tracking-wider text-[#506600] mb-1">Score da Equipe</p>
                <p className="font-black italic uppercase text-sm text-[#161e00]">
                  {result && result.eventScore > 0 ? `${fmt(result.eventScore)} / 100` : "Sem nota ainda"}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Detalhamento por Critério — notas e calibrações */}
        {canViewResult && result && result.criteriaDetails && result.criteriaDetails.length > 0 && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <TrendingUp size={18} />
              <span className="font-black uppercase tracking-tight">Notas e Calibrações por Critério</span>
            </div>
            <div className="px-6 py-3 border-b-2 border-[#eceef0]">
              <p className="text-xs italic text-[#444933]">
                <strong>Nota Avaliador</strong> é a nota dada pela área avaliadora. <strong>Nota Calibrada</strong> é o valor ajustado na calibração. <strong>Nota Final</strong> é a que entra no cálculo do score da equipe.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Critério</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Peso</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Avaliador</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Calibrada</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Final</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Contribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {result.criteriaDetails.map(c => {
                    const calibrated = c.calibratedScore != null;
                    const justifications = justificationsFor(c.criterionId);
                    return (
                      <tr key={c.criterionId} data-testid={`row-criterion-detail-${c.criterionId}`} className="hover:bg-[#f2f4f6] transition-all align-top">
                        <td className="px-6 py-4">
                          <p className="font-black italic uppercase text-sm text-[#191c1e]">{c.criterionName}</p>
                          {c.responsibleAreaLabel && (
                            <p className="text-[10px] font-bold italic uppercase text-[#747a60]">{c.responsibleAreaLabel}</p>
                          )}
                          {justifications.length > 0 && (
                            <div className="mt-3 space-y-1.5" data-testid={`justifications-${c.criterionId}`}>
                              <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Justificativas dos Avaliadores</p>
                              {justifications.map((j, i) => (
                                <div key={i} className="border-l-2 border-[#191c1e] bg-[#f7f9fb] px-2.5 py-1.5">
                                  <p className="text-[10px] font-bold italic uppercase text-[#444933]">{j.name} <span className="text-[#747a60]">— {j.score.toFixed(1)}</span></p>
                                  {j.comment ? (
                                    <p className="text-[11px] italic text-[#444933] leading-snug whitespace-pre-wrap break-words mt-0.5">{j.comment}</p>
                                  ) : (
                                    <p className="text-[10px] italic text-[#9aa088] mt-0.5">Sem justificativa</p>
                                  )}
                                  {j.audioUrl && <div className="mt-1.5"><AudioPlayer objectPath={j.audioUrl} /></div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-bold italic text-sm text-[#444933]">{fmt(c.weight)}</td>
                        <td className="px-4 py-4 text-center font-bold italic text-sm text-[#444933]">
                          {c.averageScore != null ? fmt(c.averageScore) : "—"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {calibrated ? (
                            <span className="inline-flex items-center gap-1 text-xs uppercase font-black italic bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1">
                              <Check size={10} /> {fmt(c.calibratedScore as number)}
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-bold italic text-[#747a60]">Sem calibração</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {c.scoreUsed != null ? (
                            <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-3 py-1 border-2 border-[#191c1e]">
                              {fmt(c.scoreUsed)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-4 text-center font-bold italic text-sm text-[#444933]">
                          {c.criterionTotal != null ? fmt(c.criterionTotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* HR criteria configuration + evaluator assignment (merged) */}
        {canManage && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex flex-wrap items-center justify-between gap-3 italic">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                <span className="font-black uppercase tracking-tight">Critérios e Avaliadores (RH)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {allAssigned ? (
                  <span data-testid="badge-assignments-complete" className="inline-flex items-center gap-1.5 bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-3 py-1 text-[11px] font-black uppercase">
                    <UserCheck size={12} /> Avaliadores Atribuídos
                  </span>
                ) : (
                  <span data-testid="badge-assignments-pending" className="inline-flex items-center gap-1.5 bg-[#ff5722] text-white border-2 border-[#ff5722] px-3 py-1 text-[11px] font-black uppercase">
                    <AlertCircle size={12} /> Atribuição Pendente
                  </span>
                )}
                {criteriaConfirmed ? (
                  <span data-testid="badge-criteria-confirmed" className="inline-flex items-center gap-1.5 bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-3 py-1 text-[11px] font-black uppercase">
                    <Lock size={12} /> Critérios Confirmados
                  </span>
                ) : (
                  <span data-testid="badge-criteria-pending" className="inline-flex items-center gap-1.5 bg-[#ff5722] text-white border-2 border-[#ff5722] px-3 py-1 text-[11px] font-black uppercase">
                    <AlertCircle size={12} /> Aguardando Confirmação
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm italic text-[#444933]">
                Para cada critério deste evento defina o <strong>peso</strong> e o <strong>avaliador</strong> que dará a nota daquela área. Desative os que não se aplicam — a soma dos pesos ativos deve ser <strong>{fmt(targetWeightSum)}</strong>. As áreas só podem avaliar após a confirmação do RH.
              </p>

              {hasEvaluations && (
                <div data-testid="notice-criteria-locked" className="flex items-center gap-2 bg-[#fff4e5] border-2 border-[#ff5722] text-[#7a2e00] px-4 py-3 text-xs font-bold italic uppercase">
                  <Lock size={14} className="shrink-0" /> Este evento já possui avaliações. Critérios e avaliadores estão bloqueados, mas os pesos continuam editáveis — ao salvar, o resultado é recalculado.
                </div>
              )}

              <div className="flex items-center justify-between bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                <span className="text-xs font-bold italic uppercase text-[#444933]">Soma dos Pesos Ativos</span>
                <span data-testid="text-criteria-sum" className={`text-2xl font-black italic ${sumValid ? "text-[#506600]" : "text-[#ba1a1a]"}`}>
                  {Math.round(activeSum * 100) / 100} <span className="text-base text-[#747a60]">/ {fmt(targetWeightSum)}</span>
                </span>
              </div>

              <div className="overflow-x-auto border-2 border-[#191c1e]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933]">Critério</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933]">Área</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933] text-center">Peso</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933]">Avaliador</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#eceef0]">
                    {config.map(item => {
                      const meta = critMeta.get(item.criterionId);
                      const isEditingName = editingName[item.criterionId] !== undefined;
                      const areaId = meta?.responsibleAreaId ?? null;
                      const areaEvaluators = areaId != null ? evaluatorsForArea(areaId) : [];
                      return (
                        <tr key={item.criterionId} data-testid={`row-event-criterion-${item.criterionId}`} className={`align-top ${!item.active ? "opacity-60 bg-[#f7f9fb]" : "bg-white"}`}>
                          <td className="px-4 py-3 min-w-[180px]">
                            {isEditingName ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  data-testid={`input-event-criterion-name-${item.criterionId}`}
                                  value={editingName[item.criterionId]}
                                  autoFocus
                                  onChange={e => setEditingName(prev => ({ ...prev, [item.criterionId]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") handleRename(item.criterionId); if (e.key === "Escape") setEditingName(prev => { const n = { ...prev }; delete n[item.criterionId]; return n; }); }}
                                  className="h-9 rounded-none border-2 border-[#191c1e] font-black italic text-sm"
                                />
                                <button
                                  type="button"
                                  data-testid={`button-save-name-${item.criterionId}`}
                                  onClick={() => handleRename(item.criterionId)}
                                  title="Salvar nome"
                                  className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] hover:translate-y-[1px] transition-all"
                                >
                                  <Check size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-black italic uppercase text-sm text-[#191c1e]">{meta?.criterionName ?? item.name}</span>
                                {item.eventScoped && (
                                  <span className="bg-[#191c1e] text-[#ccff00] px-1.5 py-0.5 text-[9px] font-black italic uppercase">Cópia</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-bold italic uppercase text-[#747a60]">{meta?.responsibleAreaName ?? "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Input
                              data-testid={`input-event-criterion-weight-${item.criterionId}`}
                              type="number"
                              min="0"
                              step="1"
                              value={item.active ? item.weight : 0}
                              disabled={!item.active}
                              onChange={e => setCriterionWeight(item.criterionId, Number(e.target.value))}
                              className="w-20 h-10 rounded-none border-2 border-[#191c1e] text-center font-black italic disabled:opacity-50 inline-block"
                            />
                          </td>
                          <td className="px-4 py-3 min-w-[200px]">
                            {!item.active || areaId == null ? (
                              <span className="text-[11px] font-bold italic uppercase text-[#747a60]">—</span>
                            ) : (
                              <>
                                {areaEvaluators.length === 0 ? (
                                  <p className="text-[10px] font-bold italic uppercase text-[#ba1a1a]">Nenhum avaliador vinculado a esta área</p>
                                ) : (
                                  <div data-testid={`select-assignment-${item.criterionId}`} className="flex flex-col gap-1 max-w-[220px]">
                                    {areaEvaluators.map(u => {
                                      const checked = (assignments[areaId] ?? []).includes(u.id);
                                      return (
                                        <label key={u.id} className="flex items-center gap-2 text-xs font-bold italic uppercase text-[#191c1e] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            data-testid={`checkbox-evaluator-${item.criterionId}-${u.id}`}
                                            checked={checked}
                                            disabled={hasEvaluations}
                                            onChange={e => toggleAreaEvaluator(areaId, u.id, e.target.checked)}
                                            className="h-4 w-4 accent-[#191c1e] disabled:opacity-50"
                                          />
                                          {u.name}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                                {areaEvaluators.length > 0 && (assignments[areaId] ?? []).length === 0 ? (
                                  <p className="mt-1 text-[10px] font-bold italic uppercase text-[#ba1a1a]">Sem avaliador</p>
                                ) : (assignments[areaId] ?? []).length > 1 ? (
                                  <p className="mt-1 text-[10px] font-bold italic uppercase text-[#506600]">{(assignments[areaId] ?? []).length} avaliadores — nota final é a média</p>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              {!editLocked && item.eventScoped && !isEditingName && (
                                <button
                                  type="button"
                                  data-testid={`button-rename-event-criterion-${item.criterionId}`}
                                  onClick={() => setEditingName(prev => ({ ...prev, [item.criterionId]: item.name }))}
                                  title="Renomear cópia"
                                  className="h-9 px-3 flex items-center gap-1.5 border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-[11px] font-bold italic uppercase transition-all"
                                >
                                  Renomear
                                </button>
                              )}
                              <button
                                type="button"
                                data-testid={`button-duplicate-event-criterion-${item.criterionId}`}
                                disabled={editLocked || duplicateCriterion.isPending}
                                onClick={() => handleDuplicate(item.criterionId, item.name)}
                                title="Duplicar quesito"
                                className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                <Copy size={16} />
                              </button>
                              {item.eventScoped ? (
                                <button
                                  type="button"
                                  data-testid={`button-delete-event-criterion-${item.criterionId}`}
                                  disabled={editLocked || deleteCriterion.isPending}
                                  onClick={() => setPendingDelete(item.id)}
                                  title="Excluir cópia"
                                  className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-white text-[#ba1a1a] hover:bg-[#ffe5e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : item.active ? (
                                <button
                                  type="button"
                                  data-testid={`button-remove-event-criterion-${item.criterionId}`}
                                  disabled={editLocked}
                                  onClick={() => setPendingRemoval(item.criterionId)}
                                  title="Remover critério"
                                  className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-white text-[#ba1a1a] hover:bg-[#ffe5e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`button-restore-event-criterion-${item.criterionId}`}
                                  disabled={editLocked}
                                  onClick={() => setCriterionActive(item.criterionId, true)}
                                  className="h-9 px-3 flex items-center gap-1.5 border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-[11px] font-bold italic uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  <RotateCcw size={14} /> Reativar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {config.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center italic uppercase font-bold text-[#747a60]">Nenhum critério vinculado a este evento.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {config.some(item => item.active && (critMeta.get(item.criterionId)?.responsibleAreaId != null) && evaluatorsForArea(critMeta.get(item.criterionId)!.responsibleAreaId!).length === 0) && (
                <p className="text-xs font-bold italic uppercase text-[#ba1a1a]">Há áreas sem nenhum avaliador vinculado. Cadastre avaliadores nessas áreas (em Usuários) para poder atribuí-los.</p>
              )}

              {!sumValid && !criteriaConfirmed && (
                <p className="text-xs font-bold italic uppercase text-[#ba1a1a] text-right">Ajuste os pesos para somar exatamente {fmt(targetWeightSum)} antes de salvar ou confirmar.</p>
              )}

              <AlertDialog open={pendingRemoval !== null} onOpenChange={o => { if (!o) setPendingRemoval(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Remover critério?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      O critério <strong>{critMeta.get(pendingRemoval ?? -1)?.criterionName ?? ""}</strong> deixará de ser avaliado neste evento. Você precisará redistribuir o peso dele entre os critérios restantes para que a soma volte a ser <strong>{fmt(targetWeightSum)}</strong> antes de salvar ou confirmar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-remove-criterion" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-remove-criterion"
                      onClick={() => { if (pendingRemoval !== null) setCriterionActive(pendingRemoval, false); setPendingRemoval(null); }}
                      className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white italic uppercase font-bold hover:bg-[#9a1414]"
                    >
                      <Trash2 size={16} className="mr-1.5" /> Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={pendingDelete !== null} onOpenChange={o => { if (!o) setPendingDelete(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Excluir cópia?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      Esta cópia será <strong>removida permanentemente</strong> deste evento. Caso ela esteja ativa, lembre-se de redistribuir o peso entre os critérios restantes para que a soma volte a <strong>{fmt(targetWeightSum)}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete-criterion" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-delete-criterion"
                      onClick={() => { if (pendingDelete !== null) deleteCriterion.mutate({ id, eventCriterionId: pendingDelete }); setPendingDelete(null); }}
                      className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white italic uppercase font-bold hover:bg-[#9a1414]"
                    >
                      <Trash2 size={16} className="mr-1.5" /> Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={pendingRemoveParticipant !== null} onOpenChange={o => { if (!o) setPendingRemoveParticipant(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Remover participante?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      O colaborador <strong>{event?.participants?.find(p => p.id === pendingRemoveParticipant)?.employeeName ?? ""}</strong> será removido da equipe deste evento. Se ele já possuir avaliações enviadas, as notas serão perdidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-remove-participant" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-remove-participant"
                      onClick={() => {
                        if (pendingRemoveParticipant !== null) {
                          removeParticipant.mutate({ id, participantId: pendingRemoveParticipant });
                        }
                        setPendingRemoveParticipant(null);
                      }}
                      className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white italic uppercase font-bold hover:bg-[#9a1414]"
                    >
                      <Trash2 size={16} className="mr-1.5" /> Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                {hasEvaluations && (
                  <span data-testid="text-criteria-locked" className="flex items-center gap-2 text-xs font-bold italic uppercase text-[#747a60] bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                    <Lock size={14} /> Critérios bloqueados — pesos continuam editáveis
                  </span>
                )}
                {!criteriaConfirmed ? (
                  <>
                    <button
                      data-testid="button-save-criteria"
                      onClick={handleSaveAll}
                      disabled={!sumValid || updateCriteria.isPending || updateAssignments.isPending}
                      className="bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                    >
                      <Save size={16} /> {(updateCriteria.isPending || updateAssignments.isPending) ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      data-testid="button-confirm-criteria"
                      onClick={handleConfirmAndRelease}
                      disabled={!sumValid || !allAssigned || confirmBusy}
                      title={!sumValid ? `A soma dos pesos ativos precisa ser ${fmt(targetWeightSum)}` : !allAssigned ? "Atribua um avaliador para todas as áreas antes de liberar" : undefined}
                      className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${HARD_SHADOW}`}
                    >
                      <CheckCircle2 size={16} /> {confirmBusy ? "Confirmando..." : "Confirmar e Liberar Avaliação"}
                    </button>
                  </>
                ) : (
                  <>
                    {!hasEvaluations && assignmentsDirty && (
                      <button
                        data-testid="button-save-assignments"
                        onClick={handleSaveAssignments}
                        disabled={updateAssignments.isPending}
                        className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:translate-y-[1px] transition-all"
                      >
                        <Save size={16} /> {updateAssignments.isPending ? "Salvando..." : "Salvar Avaliadores"}
                      </button>
                    )}
                    {weightsDirty && (
                      <button
                        data-testid="button-save-weights"
                        onClick={handleSaveCriteria}
                        disabled={!sumValid || updateCriteria.isPending}
                        title={!sumValid ? `A soma dos pesos ativos precisa ser ${fmt(targetWeightSum)}` : undefined}
                        className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${HARD_SHADOW}`}
                      >
                        <Save size={16} /> {updateCriteria.isPending ? "Salvando..." : "Salvar Pesos"}
                      </button>
                    )}
                    {!hasEvaluations && (
                      <button
                        data-testid="button-reopen-criteria"
                        onClick={() => handleConfirmCriteria(false)}
                        disabled={confirmCriteria.isPending}
                        className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                      >
                        <Unlock size={16} /> Reabrir Edição dos Critérios
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {canManage && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className={`px-6 py-3 flex flex-wrap items-center justify-between gap-3 italic ${event.resultsConfirmed ? "bg-[#191c1e] text-[#ccff00]" : "bg-[#ff5722] text-white"}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span className="font-black uppercase tracking-tight">Confirmação de Resultados</span>
              </div>
              {event.resultsConfirmed ? (
                <span data-testid="badge-results-confirmed-section" className="inline-flex items-center gap-1.5 bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-3 py-1 text-[11px] font-black uppercase">
                  <Lock size={12} /> Confirmado
                </span>
              ) : (
                <span data-testid="badge-results-pending-section" className="inline-flex items-center gap-1.5 bg-white text-[#ba1a1a] border-2 border-white px-3 py-1 text-[11px] font-black uppercase">
                  <AlertCircle size={12} /> Não Confirmado
                </span>
              )}
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm italic text-[#444933]">
                Enquanto os resultados não forem confirmados, este evento <strong>não conta</strong> na elegibilidade nem na nota final dos colaboradores — mesmo que já esteja fechado. Confirme após revisar as notas e a calibragem. Admin/RH pode confirmar ou reverter a qualquer momento.
              </p>
              {event.status !== "closed" && !event.resultsConfirmed && (
                <p data-testid="text-confirm-requires-closed" className="text-sm italic text-[#ba1a1a] bg-[#ffedea] border-2 border-[#ba1a1a] px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  Este evento ainda está <strong>aberto</strong>. A confirmação só tem efeito depois que o evento for fechado (na tela de Calibração, em "Fechar Evento e Liberar Notas") — confirmar agora não muda nada nos resultados.
                </p>
              )}
              {event.resultsConfirmed && event.resultsConfirmedAt && (
                <p className="text-xs italic text-[#747a60]">
                  Confirmado em {new Date(event.resultsConfirmedAt).toLocaleString('pt-BR')}
                </p>
              )}
              <div className="flex justify-end">
                {event.resultsConfirmed ? (
                  <button
                    data-testid="button-unconfirm-results"
                    onClick={() => unconfirmResults.mutate({ id })}
                    disabled={resultsConfirmBusy}
                    className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                  >
                    <Unlock size={16} /> {resultsConfirmBusy ? "Revertendo..." : "Desconfirmar Resultados"}
                  </button>
                ) : (
                  <button
                    data-testid="button-confirm-results"
                    onClick={() => confirmResults.mutate({ id })}
                    disabled={resultsConfirmBusy || event.status !== "closed"}
                    title={event.status !== "closed" ? "Feche o evento antes de confirmar os resultados" : undefined}
                    className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW}`}
                  >
                    <CheckCircle2 size={16} /> {resultsConfirmBusy ? "Confirmando..." : "Confirmar Resultados"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {result && result.eventScore > 0 && participantResults.length > 0 && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                  <BarChart3 size={18} />
                  <span className="font-black uppercase tracking-tight">Performance Individual (Equipe)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Score Equivalente</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Elegibilidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#eceef0]">
                      {participantResults.map(p => (
                        <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} className="hover:bg-[#f2f4f6] transition-all">
                          <td className="px-6 py-4 font-black italic uppercase text-sm text-[#191c1e]">{p.employeeName}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-3 py-1 border-2 border-[#191c1e]">
                              {fmt(p.eventScore)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {p.eligible === false ? (
                              <span className="inline-block text-[10px] uppercase font-black italic bg-[#ff5722] text-white border-2 border-[#191c1e] px-2 py-1">Inativo/Inelegível</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black italic bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-1">
                                <CheckCircle2 size={10} /> Elegível
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Matriz de Conformidade */}
            <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                <ShieldAlert size={18} />
                <span className="font-black uppercase tracking-tight">Matriz de Conformidade</span>
              </div>
              <div className="p-4 space-y-3">
                {conformityItems.map(item => {
                  const value = conformityForm[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between gap-3 -mx-4 px-4 py-1.5 ${!value ? "bg-[#fdece6] border-l-4 border-[#862200]" : ""}`}
                    >
                      <span className="text-sm font-bold italic text-[#191c1e]">{item.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {!value && (
                          <span className="text-[10px] font-black italic uppercase text-[#862200] whitespace-nowrap">-10 pts</span>
                        )}
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...conformityForm, [item.key]: !value };
                              setConformityForm(next);
                              setConformity.mutate({ id, data: { [item.key]: !value } });
                            }}
                            className={`text-[11px] font-black italic uppercase px-3 py-1 border-2 border-[#191c1e] transition-all ${value ? "bg-[#ccff00] text-[#161e00]" : "bg-[#862200] text-white"}`}
                          >
                            {value ? "Sim" : "Não"}
                          </button>
                        ) : (
                          <span className={`text-[11px] font-black italic uppercase px-2 py-1 border border-[#191c1e] ${value ? "bg-[#ccff00] text-[#161e00]" : "bg-[#862200] text-white"}`}>
                            {value ? "Sim" : "Não"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(result?.conformityPenalty ?? 0) > 0 && (
                  <div className="pt-3 border-t-2 border-[#eceef0]">
                    <p className="text-xs font-bold italic uppercase text-[#862200] flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Desconto na nota final do evento: -{result?.conformityPenalty} pts
                    </p>
                  </div>
                )}
              </div>
            </div>

            {((event.participants && event.participants.length > 0) || canManage) && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center justify-between gap-2 italic">
                  <div className="flex items-center gap-2">
                    <Users size={18} />
                    <span className="font-black uppercase tracking-tight">Equipe Alocada</span>
                  </div>
                  {canManage && (
                    <button
                      data-testid="button-add-participant"
                      onClick={() => setAddParticipantOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 border-2 border-[#ccff00] bg-[#191c1e] text-[#ccff00] hover:bg-[#ccff00] hover:text-[#191c1e] transition-colors text-[11px] font-black uppercase tracking-tight"
                    >
                      <UserPlus size={14} /> Adicionar
                    </button>
                  )}
                </div>
                {(!event.participants || event.participants.length === 0) ? (
                  <div className="py-8 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhum colaborador alocado.</div>
                ) : (
                  <div className="divide-y-2 divide-[#eceef0]">
                    {event.participants.map(p => {
                      const isInactive = p.confirmed === false;
                      const isInformational = p.countsForScore === false;
                      const selectedDates = p.actualDiariaDates ?? [];
                      const realizadasCount = p.actualDiariaDates != null ? p.actualDiariaDates.length : p.actualDiariaCount;
                      const candidateDates = eventDateRange(event.startDate, event.endDate);
                      return (
                        <div
                          key={p.id}
                          data-testid={`chip-participant-${p.employeeId}`}
                          className={cn(
                            "flex items-center gap-4 p-5 transition-colors",
                            isInformational ? "bg-[#862200]/[0.06] border-l-4 border-l-[#862200]" : "hover:bg-[#f2f4f6]",
                            isInactive && "opacity-50"
                          )}
                        >
                          <div className="w-9 h-9 bg-[#eceef0] border-2 border-[#191c1e] flex items-center justify-center font-black italic text-xs text-[#191c1e] shrink-0">
                            {p.employeeName.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black italic uppercase text-sm text-[#191c1e] truncate">{p.employeeName}</p>
                              <span className={`px-2 py-0.5 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block shrink-0 ${p.employmentType === "freela" ? "bg-[#e0e3e5] text-[#444933]" : "bg-white text-[#191c1e]"}`}>
                                <span className="inline-block skew-x-[8deg]">{p.employmentType === "freela" ? "Freela" : "Casa"}</span>
                              </span>
                              {isInformational && (
                                <span
                                  data-testid={`badge-no-score-${p.employeeId}`}
                                  className="px-2 py-0.5 border-2 border-[#862200] bg-[#862200] text-white font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block shrink-0"
                                  title="Participação apenas histórica/informativa — não entra na nota nem na elegibilidade."
                                >
                                  <span className="inline-block skew-x-[8deg]">Não conta p/ nota</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">
                              {p.functionName}{isInactive && <span className="text-[#862200]"> · Inativo</span>}
                            </p>
                            {isInformational ? (
                              <p className="text-[10px] font-bold italic uppercase text-[#862200]/80">
                                Participação informativa — sem controle de diárias.
                              </p>
                            ) : (p.scheduledDiariaCount != null || realizadasCount != null || canManage) && (
                              <div className="flex items-start gap-2 flex-wrap pt-1">
                                <div
                                  data-testid={`text-scheduled-diaria-${p.employeeId}`}
                                  className="flex items-start gap-1.5 px-2 py-1 border-2 border-[#191c1e] bg-white text-[10px] font-bold italic uppercase text-[#444933] leading-tight"
                                  title="Diárias previstas vêm da escalação (logística interna)."
                                >
                                  <Calendar size={11} className="text-[#444933] shrink-0 mt-[1px]" />
                                  <div>
                                    <div>Previstas: {p.scheduledDiariaCount ?? "—"}</div>
                                    {p.scheduledDiariaStart && p.scheduledDiariaEnd && (
                                      <div className="text-[#747a60] normal-case font-semibold not-italic">
                                        {formatDiariaDate(p.scheduledDiariaStart)} – {formatDiariaDate(p.scheduledDiariaEnd)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {canManage ? (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        data-testid={`button-diaria-dates-${p.employeeId}`}
                                        type="button"
                                        className="self-center flex items-center gap-1.5 px-2 py-1 border-2 border-[#191c1e] bg-white hover:bg-[#f2f4f6] transition-colors whitespace-nowrap"
                                      >
                                        <Calendar size={11} className="text-[#444933] shrink-0" />
                                        <span className="text-[10px] font-bold italic uppercase text-[#191c1e]">
                                          Realizadas: {realizadasCount ?? 0}
                                        </span>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="w-64 p-3 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e]">
                                      <p className="text-[10px] font-black italic uppercase text-[#444933] mb-2">Dias em que realmente participou</p>
                                      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                                        {candidateDates.map(dateStr => {
                                          const checked = selectedDates.includes(dateStr);
                                          return (
                                            <label key={dateStr} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                                              <Checkbox
                                                data-testid={`checkbox-diaria-${p.employeeId}-${dateStr}`}
                                                checked={checked}
                                                onCheckedChange={(checkedVal) => {
                                                  const next = new Set(selectedDates);
                                                  if (checkedVal) next.add(dateStr); else next.delete(dateStr);
                                                  updateParticipant.mutate({ id, participantId: p.id, data: { actualDiariaDates: Array.from(next).sort() } });
                                                }}
                                              />
                                              <span className="font-bold italic uppercase text-[#191c1e]">{formatDiariaDate(dateStr)}</span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                ) : realizadasCount != null ? (
                                  <span className="self-center text-[10px] font-bold italic uppercase text-[#747a60] whitespace-nowrap">
                                    Diárias realizadas: {realizadasCount}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                data-testid={`button-toggle-participant-${p.employeeId}`}
                                onClick={() => updateParticipant.mutate({ id, participantId: p.id, data: { confirmed: isInactive } })}
                                className={cn(
                                  "p-1.5 border-2 border-[#191c1e] bg-white transition-colors shrink-0",
                                  isInactive ? "text-[#191c1e] hover:bg-[#ccff00]" : "text-[#862200] hover:bg-[#862200] hover:text-white"
                                )}
                                title={isInactive ? "Reativar colaborador" : "Marcar como inativo (não compareceu)"}
                              >
                                {isInactive ? <UserCheck size={14} /> : <UserX size={14} />}
                              </button>
                              <button
                                data-testid={`button-remove-participant-${p.employeeId}`}
                                onClick={() => setPendingRemoveParticipant(p.id)}
                                className="p-1.5 border-2 border-[#191c1e] bg-white text-[#862200] hover:bg-[#862200] hover:text-white transition-colors shrink-0"
                                title="Remover do evento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Dialog open={addParticipantOpen} onOpenChange={(o) => { setAddParticipantOpen(o); if (!o) { setNewParticipantEmployeeId(null); setNewParticipantFunction(""); } }}>
              <DialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                <DialogHeader>
                  <DialogTitle className="font-black italic uppercase tracking-tight text-[#191c1e]">Adicionar Colaborador</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Colaborador <span className="text-[#ba1a1a]">*</span></Label>
                    <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          role="combobox"
                          aria-expanded={employeePickerOpen}
                          data-testid="select-new-participant-employee"
                          className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-none border-2 border-[#191c1e] bg-white text-left"
                        >
                          <span className={cn("truncate text-sm", selectedNewEmployee ? "font-black italic uppercase text-[#191c1e]" : "font-bold italic uppercase text-xs tracking-wider text-[#747a60]")}>
                            {selectedNewEmployee ? selectedNewEmployee.name : "Busque pelo nome..."}
                          </span>
                          <ChevronsUpDown size={16} className="text-[#191c1e] opacity-60 shrink-0" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                        <Command className="rounded-none">
                          <CommandInput data-testid="input-new-participant-search" placeholder="Buscar pelo nome..." className="italic" />
                          <CommandList className="max-h-[280px]">
                            <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum colaborador disponível.</CommandEmpty>
                            <CommandGroup>
                              {availableEmployees.map(e => (
                                <CommandItem
                                  key={e.id}
                                  value={e.name}
                                  data-testid={`option-new-participant-${e.id}`}
                                  onSelect={() => {
                                    setNewParticipantEmployeeId(e.id);
                                    setNewParticipantFunction(e.functionName ?? "");
                                    setEmployeePickerOpen(false);
                                  }}
                                  className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-2"
                                >
                                  <Check size={16} className={cn("shrink-0", newParticipantEmployeeId === e.id ? "opacity-100" : "opacity-0")} />
                                  <span className="font-black italic uppercase text-sm truncate">{e.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Função no Evento</Label>
                    <Input
                      data-testid="input-new-participant-function"
                      value={newParticipantFunction}
                      onChange={(e) => setNewParticipantFunction(e.target.value)}
                      placeholder="Ex: Operador, Auxiliar..."
                      className="h-11 rounded-none border-2 border-[#191c1e]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    data-testid="button-confirm-add-participant"
                    disabled={!newParticipantEmployeeId || addParticipant.isPending}
                    onClick={() => {
                      if (!newParticipantEmployeeId) return;
                      addParticipant.mutate({ id, data: { employeeId: newParticipantEmployeeId, functionName: newParticipantFunction || undefined } });
                    }}
                    className="w-full h-11 bg-[#191c1e] text-[#ccff00] font-black italic uppercase tracking-tight disabled:opacity-40 hover:bg-[#ccff00] hover:text-[#191c1e] border-2 border-[#191c1e] transition-colors"
                  >
                    {addParticipant.isPending ? "Adicionando..." : "Adicionar à Equipe"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
