import { useState, useEffect, useRef } from "react";
import { useGetEvents, useGetEvent, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useCreateCalibration, useGetEventFeedback, useCloseEvent, useReleaseEventFeedback, usePublishCriterionPartialFeedback, usePublishCriterionFinalFeedback, usePublishAllCriteriaFinalFeedback, usePublishAllCriteriaPartialFeedback, useUpdateEventCriteria, useGetEventConformity, useGetEventComments, useGetReviewRequests, useGetCurrentCycle, getGetCalibrationsQueryKey, getGetEventsQueryKey, getGetEventQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AudioPlayer } from "@/components/audio-recorder";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Target, AlertCircle, Building2, SlidersHorizontal, CalendarDays, ChevronsUpDown, ChevronDown, ChevronUp, Check, Info, Save, CheckCircle, Trophy, Flag, AlertTriangle, Send, Lock, ExternalLink, Filter, ShieldCheck, Shield, X, MessageSquare, User, ClipboardList, Users, Calendar, RotateCcw } from "lucide-react";
import { getAuthToken } from "@/lib/custom-fetch";
import { cn, formatEventSubtitle } from "@/lib/utils";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

// Badge do seletor de eventos: eventos históricos sempre "Fechado"; demais mostram
// o estado real da publicação de feedback (final > parcial), nunca o status
// bruto do evento — sem publicação nenhuma, continua "Em Avaliação" mesmo fechado.
function getCycleWeekends(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return [] as { sat: string; sun: string; label: string }[];
  const result: { sat: string; sun: string; label: string }[] = [];
  const end = new Date(endDate + "T12:00:00");
  const d = new Date(startDate + "T12:00:00");
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d <= end) {
    const sat = d.toISOString().split("T")[0];
    const sunD = new Date(d); sunD.setDate(sunD.getDate() + 1);
    const sun = sunD.toISOString().split("T")[0];
    const label = `${String(d.getDate()).padStart(2,"0")}–${String(sunD.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    result.push({ sat, sun, label });
    d.setDate(d.getDate() + 7);
  }
  return result;
}

function calibrationEventChip(ev: { isHistorical?: boolean; feedbackReleased?: boolean; partialPublishedAt?: string | null }): { label: string; cls: string } {
  if (ev.isHistorical) return { label: "Fechado", cls: "bg-[#d8dadc] text-[#444933]" };
  if (ev.feedbackReleased) return { label: "Avaliação Final", cls: "bg-[#191c1e] text-[#ccff00]" };
  if (ev.partialPublishedAt) return { label: "Avaliação Parcial", cls: "bg-[#ffb5a0] text-[#3b0900]" };
  return { label: "Em Avaliação", cls: "bg-[#ccff00] text-[#161e00]" };
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CalibrationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canFinalize = ["admin", "rh", "diretoria"].includes(user?.role ?? "");
  const qc = useQueryClient();
  const search = useSearch();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventIdFromUrlApplied, setEventIdFromUrlApplied] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "pending" | "inProgress" | "done">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [calScores, setCalScores] = useState<Record<number, string>>({});
  const [calReasons, setCalReasons] = useState<Record<number, string>>({});
  const [savingCritId, setSavingCritId] = useState<number | null>(null);
  const [weightEdits, setWeightEdits] = useState<Record<number, string>>({});
  const [savingWeightId, setSavingWeightId] = useState<number | null>(null);
  const [collapsedCriteria, setCollapsedCriteria] = useState<Set<number>>(new Set());
  const collapsedInitializedForEventId = useRef<number | null>(null);
  const [publishingFinalCritId, setPublishingFinalCritId] = useState<number | null>(null);
  const [publishingAllFinal, setPublishingAllFinal] = useState(false);
  const [publishingAllPartial, setPublishingAllPartial] = useState(false);
  const [criterionFilter, setCriterionFilter] = useState<"all" | "uncalibrated" | "calibrated">("all");
  const [contextOpen, setContextOpen] = useState(false);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [detailCriterionId, setDetailCriterionId] = useState<number | null>(null);
  // O backend restringe a edição de pesos do evento a admin/RH.
  const canEditWeights = ["admin", "rh"].includes(user?.role ?? "");

  function toggleCriterionCollapsed(criterionId: number) {
    setCollapsedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(criterionId)) next.delete(criterionId);
      else next.add(criterionId);
      return next;
    });
  }

  const { data: events } = useGetEvents();
  const { data: cycle } = useGetCurrentCycle();
  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["ec", selectedEventId] as unknown[] },
  });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: ["evals", selectedEventId] as unknown[] } }
  );
  useEffect(() => {
    if (!selectedEventId || !criteria || criteria.length === 0) return;
    if (collapsedInitializedForEventId.current === selectedEventId) return;
    collapsedInitializedForEventId.current = selectedEventId;
    setCollapsedCriteria(new Set(criteria.filter(c => c.active).map(c => c.criterionId)));
  }, [selectedEventId, criteria]);

  const calQKey = getGetCalibrationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: calibrations } = useGetCalibrations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: calQKey } }
  );
  const { data: fullEvent } = useGetEvent(selectedEventId ?? 0, {
    query: { enabled: !!selectedEventId, queryKey: getGetEventQueryKey(selectedEventId ?? 0) },
  });

  // Todos os eventos do ciclo aparecem — a calibração pode começar a qualquer
  // momento, inclusive antes de todas as avaliações serem enviadas.
  const calibratableEvents = events ?? [];
  const cycleWeekends = getCycleWeekends(cycle?.startDate, cycle?.endDate);
  const filteredCalibratableEvents = calibratableEvents.filter(e => {
    const evalCount = e.evaluatedCriteria ?? 0;
    const calCount  = e.calibratedCriteriaCount ?? 0;
    const total     = e.totalCriteria ?? 0;
    const hasPub    = !!(e as Record<string, unknown>).partialPublishedAt || !!e.feedbackReleased || (e.finalCalibratedCriteria ?? 0) > 0;
    const matchStatus = eventStatusFilter === "all"
      || (eventStatusFilter === "pending"     && evalCount === 0 && calCount === 0)
      || (eventStatusFilter === "inProgress"  && !!e.criteriaConfirmed && (evalCount > 0 || calCount > 0))
      || (eventStatusFilter === "done"        && (e.status === "closed" || (total > 0 && evalCount >= total) || hasPub));
    const matchDate = (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom) && (!filterDateTo || (e.startDate ?? "") <= filterDateTo);
    return matchStatus && matchDate;
  });
  const pickedEvent = calibratableEvents.find(e => e.id === selectedEventId);

  // Clear selection if the picked event no longer exists (e.g. removed/out of cycle)
  useEffect(() => {
    if (selectedEventId && (events?.length ?? 0) > 0 && !calibratableEvents.some(e => e.id === selectedEventId)) {
      setSelectedEventId(null);
      setCalScores({});
      setCalReasons({});
      setWeightEdits({});
    }
  }, [selectedEventId, calibratableEvents, events]);

  // Deep-link: se veio de "Ir para Calibração" no evento (?eventId=), seleciona
  // esse evento automaticamente assim que a lista de eventos carregar.
  useEffect(() => {
    if (eventIdFromUrlApplied) return;
    if (!events || events.length === 0) return;
    const params = new URLSearchParams(search);
    const raw = params.get("eventId");
    if (!raw) {
      setEventIdFromUrlApplied(true);
      return;
    }
    const id = Number(raw);
    if (!isNaN(id) && events.some(e => e.id === id)) {
      setSelectedEventId(id);
    }
    setEventIdFromUrlApplied(true);
  }, [events, search, eventIdFromUrlApplied]);

  const createMutation = useCreateCalibration({
    mutation: {
      onSuccess: (data, variables) => {
        const savedCritId = variables.data.criterionId;
        setCalScores(prev => { const n = { ...prev }; delete n[savedCritId]; return n; });
        setCalReasons(prev => { const n = { ...prev }; delete n[savedCritId]; return n; });
        qc.invalidateQueries({ queryKey: calQKey });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        qc.invalidateQueries({ queryKey: fbQKey });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Calibração registrada", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Calibração registrada" });
        }
        setSavingCritId(null);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
        setSavingCritId(null);
      },
    },
  });

  // Edição de peso por critério, direto na calibração. O PUT aceita payload
  // parcial (o backend mescla com as linhas não alteradas) e recalcula o
  // resultado na hora se o evento já estiver fechado.
  const updateWeightMutation = useUpdateEventCriteria({
    mutation: {
      onSuccess: (data, variables) => {
        qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        qc.invalidateQueries({ queryKey: fbQKey });
        setSavingWeightId(null);
        const savedId = variables.data.criteria?.[0]?.criterionId;
        if (savedId != null) {
          setWeightEdits(prev => {
            const next = { ...prev };
            delete next[savedId];
            return next;
          });
        }
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Peso salvo", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Peso salvo" });
        }
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Erro ao salvar peso", description: e.message, variant: "destructive" });
        setSavingWeightId(null);
      },
    },
  });

  function saveWeight(critId: number, active: boolean) {
    const raw = (weightEdits[critId] ?? "").replace(",", ".").trim();
    const w = Number(raw);
    if (!raw || isNaN(w) || w < 0) {
      toast({ title: "Peso inválido", description: "Informe um peso maior ou igual a zero.", variant: "destructive" });
      return;
    }
    setSavingWeightId(critId);
    updateWeightMutation.mutate({
      id: selectedEventId!,
      data: { criteria: [{ criterionId: critId, active, weight: w }] },
    });
  }

  // Mutation usada na gravação em lote ("salvar todas") — sem toast por item,
  // para não disparar uma notificação por critério. O resumo é exibido no fim.
  const bulkMutation = useCreateCalibration();
  const [savingAll, setSavingAll] = useState(false);
  const [savingAutoFill, setSavingAutoFill] = useState(false);

  // Finalização do evento (fechar + liberar notas aos funcionários).
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const fbQKey = ["event-feedback", selectedEventId] as unknown[];
  const { data: feedback } = useGetEventFeedback(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: fbQKey },
  });
  const closeMutation = useCloseEvent();
  const releaseMutation = useReleaseEventFeedback();
  const [unreleasing, setUnreleasing] = useState(false);

  async function handleUnrelease() {
    if (!selectedEventId) return;
    setUnreleasing(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/events/${selectedEventId}/unrelease`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Erro desconhecido");
      qc.invalidateQueries({ queryKey: fbQKey });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId) });
      toast({ title: "Liberação desfeita", description: "O evento voltou ao estado pré-lançamento. Você pode publicar parcial ou finalizar novamente." });
    } catch (err: unknown) {
      toast({ title: "Falha ao desfazer liberação", description: err instanceof Error ? err.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setUnreleasing(false);
    }
  }

  const [publishingCritId, setPublishingCritId] = useState<number | null>(null);
  const publishCriterionPartialMutation = usePublishCriterionPartialFeedback();
  const publishCriterionFinalMutation = usePublishCriterionFinalFeedback();
  const publishAllFinalMutation = usePublishAllCriteriaFinalFeedback();
  const publishAllPartialMutation = usePublishAllCriteriaPartialFeedback();
  const finalizing = closeMutation.isPending || releaseMutation.isPending;

  // Contexto do evento: conformidade e comentários
  const { data: conformity } = useGetEventConformity(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["conformity", selectedEventId] as unknown[] },
  });
  const { data: eventComments } = useGetEventComments(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-comments", selectedEventId] as unknown[] },
  });
  const canSeeReviewRequests = ["admin", "rh", "diretoria"].includes(user?.role ?? "");
  const { data: allReviewRequests } = useGetReviewRequests({
    query: { enabled: canSeeReviewRequests, queryKey: ["review-requests"] as unknown[] },
  });
  const eventReviewRequests = (allReviewRequests ?? []).filter(r => r.eventId === selectedEventId);
  const pendingEventReviewRequests = eventReviewRequests.filter(r => r.status === "pending");

  async function handlePublishCriterionPartial(criterionId: number) {
    if (!selectedEventId) return;
    setPublishingCritId(criterionId);
    try {
      await publishCriterionPartialMutation.mutateAsync({ id: selectedEventId, criterionId });
      qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
      qc.invalidateQueries({ queryKey: fbQKey });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      toast({ title: "Critério publicado parcialmente", description: "Os funcionários agora veem esta prévia deste critério." });
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast({ title: "Não foi possível publicar", description: msg, variant: "destructive" });
    } finally {
      setPublishingCritId(null);
    }
  }

  async function handlePublishCriterionFinal(criterionId: number) {
    if (!selectedEventId) return;
    setPublishingFinalCritId(criterionId);
    try {
      await publishCriterionFinalMutation.mutateAsync({ id: selectedEventId, criterionId });
      qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
      qc.invalidateQueries({ queryKey: fbQKey });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      toast({ title: "Nota Final publicada", description: "Os funcionários veem esta nota como definitiva para este critério." });
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast({ title: "Não foi possível publicar como Final", description: msg, variant: "destructive" });
    } finally {
      setPublishingFinalCritId(null);
    }
  }

  async function handlePublishAllFinal() {
    if (!selectedEventId) return;
    setPublishingAllFinal(true);
    try {
      const result = await publishAllFinalMutation.mutateAsync({ id: selectedEventId });
      qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
      qc.invalidateQueries({ queryKey: fbQKey });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      const count = (result as { published?: number })?.published ?? activeCriteria.length;
      toast({ title: `${count} critério(s) publicados como Final`, description: "Os funcionários veem todas as notas como definitivas." });
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast({ title: "Erro ao publicar todos como Final", description: msg, variant: "destructive" });
    } finally {
      setPublishingAllFinal(false);
    }
  }

  async function handlePublishAllPartial() {
    if (!selectedEventId) return;
    setPublishingAllPartial(true);
    try {
      const result = await publishAllPartialMutation.mutateAsync({ id: selectedEventId });
      qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
      qc.invalidateQueries({ queryKey: fbQKey });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      const count = (result as { published?: number })?.published ?? activeCriteria.length;
      toast({ title: `${count} critério(s) publicados como Parcial`, description: "Os funcionários veem uma prévia de todas as notas." });
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast({ title: "Erro ao publicar todos como Parcial", description: msg, variant: "destructive" });
    } finally {
      setPublishingAllPartial(false);
    }
  }

  async function handleFinalize() {
    if (!selectedEventId) return;
    let closed = false;
    try {
      await closeMutation.mutateAsync({ id: selectedEventId, data: {} });
      closed = true;
      await releaseMutation.mutateAsync({ id: selectedEventId });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      qc.invalidateQueries({ queryKey: fbQKey });
      setFinalizeOpen(false);
      toast({ title: "Evento finalizado", description: "As notas foram liberadas para os funcionários." });
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      // Sempre atualiza o estado: o fechamento pode ter sido aplicado mesmo que
      // a liberação tenha falhado.
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      qc.invalidateQueries({ queryKey: fbQKey });
      if (closed) {
        toast({
          title: "Evento fechado, mas notas não liberadas",
          description: msg ? `${msg} Tente liberar novamente.` : "Não foi possível liberar as notas. Tente novamente.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Não foi possível finalizar", description: msg, variant: "destructive" });
      }
    }
  }

  function getAreaScores(critId: number) {
    return (evaluations ?? [])
      .filter(e => e.criterionId === critId && e.status === "submitted")
      .map(e => ({ name: e.evaluatorName ?? "Avaliador", score: parseFloat(e.score as unknown as string), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null }));
  }

  function getAvgScore(critId: number) {
    const scores = getAreaScores(critId).map(s => s.score);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  function getCalibration(critId: number) {
    return (calibrations ?? []).find(c => c.criterionId === critId);
  }

  function saveCalibration(critId: number) {
    const existing = getCalibration(critId);
    const raw = calScores[critId] ?? (existing ? String(parseFloat(existing.calibratedScore as unknown as string)) : "");
    const reason = (calReasons[critId] ?? existing?.calibrationReason ?? "").trim();
    const score = Number(raw);
    if (!raw || isNaN(score) || score < 0 || score > 10) {
      toast({ title: "Nota inválida", description: "Informe uma nota calibrada de 0 a 10.", variant: "destructive" });
      return;
    }
    setSavingCritId(critId);
    const avg = getAvgScore(critId);
    createMutation.mutate({
      data: {
        eventId: selectedEventId!,
        criterionId: critId,
        calibratedScore: score,
        calibrationReason: reason,
        originalAverageScore: avg ?? undefined,
      },
    });
  }

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  // Todo critério ativo sem calibração conta como pendente — mesmo os que ainda
  // não receberam nota da área (a calibração pode preencher a lacuna).
  const pendingCount = selectedEventId
    ? activeCriteria.filter(c => !getCalibration(c.criterionId)).length
    : 0;

  // Quantos critérios têm uma edição LOCAL pendente (digitada pelo usuário e ainda
  // não salva). Não recai para o score já salvo na API para evitar falso-positivo
  // de "pendente" em critérios que já foram gravados.
  function pendingScore(critId: number) {
    const raw = calScores[critId];
    if (raw === undefined) return null;
    const score = Number(raw);
    if (!raw || isNaN(score) || score < 0 || score > 10) return null;
    return score;
  }
  const fillableCount = activeCriteria.filter(c => pendingScore(c.criterionId) != null).length;

  // Quantos critérios já publicados como Final
  const finalPublishedCount = activeCriteria.filter(c => !!c.finalPublishedAt).length;
  const allCriteriaFinalPublished = activeCriteria.length > 0 && finalPublishedCount === activeCriteria.length;

  // Critérios filtrados por criterionFilter
  const filteredActiveCriteria = criterionFilter === "uncalibrated"
    ? activeCriteria.filter(c => !getCalibration(c.criterionId))
    : criterionFilter === "calibrated"
    ? activeCriteria.filter(c => !!getCalibration(c.criterionId))
    : activeCriteria;

  // Pronto para finalizar: todos os critérios com nota da área já foram calibrados.
  const scoredCriteria = activeCriteria.filter(c => getAvgScore(c.criterionId) != null);
  const allCalibrated = scoredCriteria.length > 0 && scoredCriteria.every(c => getCalibration(c.criterionId));
  const alreadyReleased = !!feedback?.feedbackReleased;
  const feedbackReleasedAtDate = feedback?.feedbackReleasedAt ? new Date(feedback.feedbackReleasedAt) : null;
  const partialPublishedAtDate = feedback?.partialPublishedAt ? new Date(feedback.partialPublishedAt) : null;
  // Recuperação de falha parcial: evento já fechado, porém notas ainda não liberadas.
  const alreadyClosed = pickedEvent?.status === "closed";
  // O backend só libera o feedback se TODAS as avaliações foram concluídas
  // (feedback.isComplete). Espelhamos essa exigência aqui para não oferecer o
  // fechamento e depois falhar com erro 400.
  const evaluationsComplete = !!feedback?.isComplete;
  const readyToFinalize = allCalibrated && evaluationsComplete && canFinalize;

  // Auto-preenche calibrações para critérios que têm nota do avaliador mas ainda
  // não têm calibração — útil após importar avaliações via formulário.
  const autoFillableCriteria = scoredCriteria.filter(c => !getCalibration(c.criterionId));
  async function autoFillFromEvaluator() {
    if (autoFillableCriteria.length === 0) return;
    setSavingAutoFill(true);
    let ok = 0;
    const failed: number[] = [];
    let firstError: string | null = null;
    const allWarnings: string[] = [];
    for (const c of autoFillableCriteria) {
      const avg = getAvgScore(c.criterionId);
      if (avg == null) continue;
      try {
        const result = await bulkMutation.mutateAsync({
          data: {
            eventId: selectedEventId!,
            criterionId: c.criterionId,
            calibratedScore: avg,
            originalAverageScore: avg,
          },
        });
        if (result.warnings) allWarnings.push(...result.warnings);
        ok++;
      } catch (e) {
        failed.push(c.criterionId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }
    setSavingAutoFill(false);
    qc.invalidateQueries({ queryKey: calQKey });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: fbQKey });
    const uniqueWarnings = Array.from(new Set(allWarnings));
    if (failed.length === 0) {
      toast({
        title: `${ok} calibraç${ok === 1 ? "ão preenchida" : "ões preenchidas"} com nota do avaliador`,
        description: uniqueWarnings.length > 0 ? uniqueWarnings.join(" ") : undefined,
        variant: uniqueWarnings.length > 0 ? "destructive" : undefined,
      });
    } else {
      toast({ title: `${ok} preenchida(s), ${failed.length} com erro`, description: firstError ?? "Revise os critérios e tente novamente.", variant: "destructive" });
    }
  }

  // Grava TODAS as calibrações preenchidas de uma vez (a diretoria preenche tudo
  // e salva em um clique, em vez de critério por critério).
  async function saveAllCalibrations() {
    const toSave = activeCriteria
      .map(c => ({ critId: c.criterionId, score: pendingScore(c.criterionId), reason: (calReasons[c.criterionId] ?? getCalibration(c.criterionId)?.calibrationReason ?? "").trim() }))
      .filter((x): x is { critId: number; score: number; reason: string } => x.score != null);
    if (toSave.length === 0) {
      toast({ title: "Nada para salvar", description: "Preencha ao menos uma nota calibrada (1 a 10).", variant: "destructive" });
      return;
    }
    setSavingAll(true);
    let ok = 0;
    const failed: number[] = [];
    let firstError: string | null = null;
    const allWarnings: string[] = [];
    for (const x of toSave) {
      try {
        const result = await bulkMutation.mutateAsync({
          data: {
            eventId: selectedEventId!,
            criterionId: x.critId,
            calibratedScore: x.score,
            calibrationReason: x.reason,
            originalAverageScore: getAvgScore(x.critId) ?? undefined,
          },
        });
        if (result.warnings) allWarnings.push(...result.warnings);
        ok++;
      } catch (e) {
        failed.push(x.critId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }
    setSavingAll(false);
    if (failed.length === 0) {
      // Limpa edições locais apenas quando tudo salvou — critérios com erro
      // permanecem editáveis para nova tentativa.
      setCalScores({});
      setCalReasons({});
    } else {
      // Limpa só os que salvaram com sucesso; mantém os que falharam.
      const savedIds = toSave.filter(x => !failed.includes(x.critId)).map(x => x.critId);
      setCalScores(prev => { const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n; });
      setCalReasons(prev => { const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n; });
    }
    qc.invalidateQueries({ queryKey: calQKey });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: fbQKey });
    const uniqueWarnings = Array.from(new Set(allWarnings));
    if (failed.length === 0) {
      toast({
        title: `${ok} calibraç${ok === 1 ? "ão salva" : "ões salvas"}`,
        description: uniqueWarnings.length > 0 ? uniqueWarnings.join(" ") : undefined,
        variant: uniqueWarnings.length > 0 ? "destructive" : undefined,
      });
    } else {
      toast({ title: `${ok} salva(s), ${failed.length} com erro`, description: firstError ?? "Revise os critérios destacados e tente novamente.", variant: "destructive" });
    }
  }

  const detailCriterion = detailCriterionId != null
    ? (activeCriteria.find(c => c.criterionId === detailCriterionId) ?? null)
    : null;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── COMPACT STICKY HEADER ── */}
      <div className="sticky top-0 z-30 bg-[#191c1e] text-white px-3 py-2 flex items-center gap-2 border-b-2 border-[#ccff00]">
        <Target size={14} className="text-[#ccff00] shrink-0" />
        <span className="font-black italic uppercase text-[12px] tracking-tight shrink-0 hidden sm:inline">Calibrações</span>

        {/* Event picker inline */}
        <div className="flex-1 min-w-0">
          <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                data-testid="select-event"
                disabled={calibratableEvents.length === 0}
                className="w-full h-8 px-3 flex items-center justify-between gap-2 text-left bg-white/10 border border-white/20 hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pickedEvent ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-bold italic uppercase text-[11px] text-white truncate">{pickedEvent.name}</span>
                    {formatEventSubtitle(pickedEvent) && <span className="text-[10px] italic text-white/50 truncate hidden md:inline">{formatEventSubtitle(pickedEvent)}</span>}
                  </span>
                ) : (
                  <span className="font-bold italic uppercase text-[10px] text-white/50">
                    {calibratableEvents.length === 0 ? "Nenhum evento no ciclo" : "Selecionar evento..."}
                  </span>
                )}
                <ChevronsUpDown size={13} className="shrink-0 text-white/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[min(92vw,540px)]">
              <Command className="rounded-none">
                {/* Status filters */}
                <div className="flex flex-wrap gap-1 p-2 border-b border-[#d8dadc]">
                  {([
                    { value: "all", label: "Todos" },
                    { value: "pending", label: "Aguardando" },
                    { value: "inProgress", label: "Em avaliação" },
                    { value: "done", label: "Fechado" },
                  ] as const).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      data-testid={`button-filter-status-${opt.value}`}
                      onClick={() => setEventStatusFilter(opt.value)}
                      className={cn("px-2 py-0.5 border font-bold italic uppercase text-[10px] transition-colors", eventStatusFilter === opt.value ? "bg-[#ccff00] text-[#161e00] border-[#ccff00]" : "bg-white text-[#444933] border-[#d8dadc] hover:border-[#191c1e]")}
                    >{opt.label}</button>
                  ))}
                </div>
                {/* Date filters */}
                <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#d8dadc] flex-wrap">
                  <CalendarDays size={11} className="text-[#747a60] shrink-0" />
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="flex-1 min-w-0 h-6 px-1.5 text-[11px] border border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none" />
                  <span className="text-[10px] text-[#747a60]">até</span>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="flex-1 min-w-0 h-6 px-1.5 text-[11px] border border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none" />
                  {cycleWeekends.map(w => {
                    const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                    return (
                      <button key={w.sat} type="button"
                        onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                        className={`px-1.5 py-0.5 text-[9px] font-black italic uppercase border transition-colors ${active ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d4c8] hover:border-[#191c1e]"}`}
                      >{w.label}</button>
                    );
                  })}
                  {(filterDateFrom || filterDateTo) && (
                    <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} className="text-[10px] italic text-[#747a60] hover:text-[#b02f00]">× limpar</button>
                  )}
                </div>
                <CommandInput data-testid="input-event-search" placeholder="Buscar evento ou cliente..." className="italic" />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty className="py-4 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
                  <CommandGroup>
                    {filteredCalibratableEvents.map(ev => (
                      <CommandItem
                        key={ev.id}
                        value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                        data-testid={`option-event-${ev.id}`}
                        onSelect={() => { setSelectedEventId(ev.id); setCalScores({}); setCalReasons({}); setWeightEdits({}); setEventPickerOpen(false); }}
                        className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-2 items-start"
                      >
                        <Check size={14} className={cn("mt-0.5 shrink-0", selectedEventId === ev.id ? "opacity-100" : "opacity-0")} />
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="font-black italic uppercase text-xs leading-tight whitespace-normal">{ev.name}</span>
                          {formatEventSubtitle(ev) && <span className="text-[10px] font-bold italic uppercase text-[#747a60] whitespace-normal">{formatEventSubtitle(ev)}</span>}
                        </span>
                        <span className={`px-2 py-0.5 border border-[#191c1e] font-bold text-[10px] italic uppercase shrink-0 ${calibrationEventChip(ev).cls}`}>{calibrationEventChip(ev).label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Publication status badge */}
        {pickedEvent && (
          <span className={cn("shrink-0 px-2 py-0.5 font-bold text-[10px] italic uppercase hidden sm:inline border",
            alreadyReleased ? "bg-[#ccff00] text-[#161e00] border-[#ccff00]" :
            partialPublishedAtDate ? "bg-[#ffb5a0] text-[#3b0900] border-[#ffb5a0]" :
            "bg-white/10 text-white/60 border-white/20"
          )}
            title={alreadyReleased ? `Final liberado em ${feedbackReleasedAtDate ? formatDateTime(feedbackReleasedAtDate) : ""}` : partialPublishedAtDate ? `Parcial publicado em ${formatDateTime(partialPublishedAtDate)}` : "Notas não publicadas"}
          >
            {alreadyReleased ? "Final" : partialPublishedAtDate ? "Parcial" : "Não pub."}
          </span>
        )}

        {/* Pending calibrations badge */}
        {pendingCount > 0 && (
          <span
            title={`${pendingCount} critério(s) sem calibração`}
            className="shrink-0 bg-[#ccff00] text-[#161e00] font-black text-[11px] italic uppercase px-2 py-0.5 flex items-center gap-1"
          >
            <SlidersHorizontal size={11} /> {pendingCount}
          </span>
        )}

        {/* Context toggle */}
        {selectedEventId && (
          <button
            type="button"
            onClick={() => setContextOpen(v => !v)}
            title={contextOpen ? "Fechar painel de contexto" : "Ver contexto do evento: equipe, conformidade, pedidos de revisão, comentários"}
            className={cn(
              "shrink-0 flex items-center gap-1 px-2 py-1 border font-bold text-[10px] italic uppercase transition-colors",
              contextOpen ? "bg-[#ccff00] text-[#161e00] border-[#ccff00]" : "border-white/25 text-white/60 hover:border-white/60 hover:text-white"
            )}
          >
            <Info size={12} />
            <span className="hidden sm:inline">Contexto</span>
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* ── PLACEHOLDER: nenhum evento selecionado ── */}
        {!selectedEventId && (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white border-2 border-dashed border-[#191c1e]">
            <div className="w-16 h-16 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#eceef0] flex items-center justify-center mb-5">
              <span className="skew-x-[4deg]"><Target className="text-[#747a60]" size={32} /></span>
            </div>
            <h2 data-testid="text-page-title" className="text-xl font-black italic uppercase tracking-tight mb-1 text-[#191c1e]">Área de Calibração</h2>
            <p className="text-[#747a60] italic text-sm max-w-sm">Use o seletor no topo para escolher um evento e calibrar os critérios.</p>
          </div>
        )}

        {selectedEventId && (
        <>
          {/* ── COLLAPSIBLE CONTEXT DRAWER ── */}
          {contextOpen && (
            <div className="bg-white border-2 border-[#191c1e] divide-y-2 divide-[#e8eaec]">

              {/* Event summary bar */}
              {pickedEvent && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <h3 className="font-black italic uppercase tracking-tight text-[#191c1e] text-sm truncate">{pickedEvent.name}</h3>
                    <span className="text-[11px] font-bold italic uppercase text-[#747a60] truncate hidden sm:inline">{pickedEvent.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {feedback && (
                      <span className="border-2 border-[#191c1e] px-3 py-1 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase italic text-[#747a60]">Nota Final</span>
                        <span className="text-lg font-black italic text-[#506600] leading-none">{feedback.eventScore.toFixed(1)}<span className="text-xs text-[#747a60]">/100</span></span>
                      </span>
                    )}
                    <Link
                      href={`/events/${selectedEventId}`}
                      className="inline-flex items-center gap-1.5 text-[11px] font-black italic uppercase bg-white text-[#444933] border-2 border-[#191c1e] px-3 py-1 hover:bg-[#191c1e] hover:text-white transition-colors shrink-0"
                    >
                      <ExternalLink size={12} /> Ver Evento
                    </Link>
                    {alreadyReleased && canFinalize && (
                      <button
                        type="button"
                        disabled={unreleasing}
                        onClick={handleUnrelease}
                        className="shrink-0 flex items-center gap-1.5 text-[11px] font-black italic uppercase bg-white text-[#444933] border-2 border-[#191c1e] px-3 py-1 hover:bg-[#191c1e] hover:text-white disabled:opacity-40 transition-colors"
                      >
                        <RotateCcw size={12} /> {unreleasing ? "..." : "Tornar Parcial"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Review requests */}
              {eventReviewRequests.length > 0 && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag size={13} className="text-[#3b0900] shrink-0" />
                    <span className="text-[11px] font-black italic uppercase text-[#3b0900]">
                      Revisão Sinalizada {pendingEventReviewRequests.length > 0 && `— ${pendingEventReviewRequests.length} pendente${pendingEventReviewRequests.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {eventReviewRequests.map(r => (
                      <div key={r.id} className={`flex items-start gap-2 text-xs px-3 py-2 ${r.status === "pending" ? "bg-[#ffb5a0] border border-[#862200]" : "bg-[#f2f4f6] border border-[#d8dadc]"}`}>
                        <div className="min-w-0 flex-1">
                          <span className="font-bold italic uppercase text-[#191c1e]">{r.employeeName}</span>
                          {r.comment && <p className="italic text-[#444933] mt-0.5">"{r.comment}"</p>}
                          {r.status === "resolved" && r.resolutionNotes && <p className="text-[10px] font-bold italic uppercase text-[#747a60] mt-0.5">Resposta: {r.resolutionNotes}</p>}
                        </div>
                        <span className={`px-1.5 py-0.5 border font-bold text-[9px] italic uppercase shrink-0 ${r.status === "pending" ? "bg-[#862200] text-white border-[#862200]" : "bg-[#e0e3e5] text-[#444933] border-[#d8dadc]"}`}>
                          {r.status === "pending" ? "Pendente" : "Resolvido"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team */}
              {fullEvent?.participants && fullEvent.participants.length > 0 && (() => {
                const relevantParticipants = fullEvent.participants!.filter(p => p.confirmed !== false && p.countsForScore !== false);
                return (
                  <div className="px-4 py-3">
                    <button type="button" onClick={() => setTeamPanelOpen(o => !o)} className="flex items-center gap-2 w-full text-left mb-2">
                      <Users size={13} className="text-[#444933] shrink-0" />
                      <span className="text-[11px] font-black italic uppercase text-[#444933]">Equipe Alocada <span className="text-[#747a60]">({relevantParticipants.length})</span></span>
                      {teamPanelOpen ? <ChevronUp size={12} className="ml-auto text-[#747a60]" /> : <ChevronDown size={12} className="ml-auto text-[#747a60]" />}
                    </button>
                    {teamPanelOpen && (
                      relevantParticipants.length === 0 ? (
                        <p className="text-xs italic text-[#747a60]">Nenhum colaborador ativo alocado.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                          {relevantParticipants.map(p => {
                            const realizadasCount = p.actualDiariaDates != null ? p.actualDiariaDates.length : p.actualDiariaCount;
                            return (
                              <div key={p.id} className="flex items-center gap-1.5 bg-[#f2f4f6] border border-[#d8dadc] px-2 py-1.5">
                                <div className="w-6 h-6 bg-[#eceef0] border border-[#191c1e] flex items-center justify-center font-black italic text-[9px] shrink-0">
                                  {p.employeeName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-black italic uppercase text-[10px] text-[#191c1e] leading-tight truncate">{p.employeeName}</p>
                                  <p className="text-[9px] font-bold italic uppercase text-[#747a60] truncate">{p.functionName}</p>
                                </div>
                                {realizadasCount != null && (
                                  <span className="text-[9px] font-bold italic uppercase text-[#747a60] shrink-0 flex items-center gap-0.5">
                                    <Calendar size={9} /> {realizadasCount}d
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                );
              })()}

              {/* Conformity */}
              {conformity && (
                <div className="px-4 py-3">
                  <p className="text-[11px] font-black italic uppercase text-[#444933] mb-2 flex items-center gap-1.5"><ShieldCheck size={13} /> Matriz de Conformidade</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
                    {([
                      { label: "EPI", key: "epi" as const, comment: conformity.epiComment },
                      { label: "Estaiamento", key: "estaiamentos" as const, comment: conformity.estaiamentosComment },
                      { label: "Conduta", key: "conduta" as const, comment: conformity.condutaComment },
                      { label: "Guarda Equip.", key: "guardaEquipamentos" as const, comment: conformity.guardaEquipamentosComment },
                    ]).map(item => {
                      const ok = (conformity as unknown as Record<string, boolean | null>)[item.key];
                      return (
                        <div key={item.key} className={`flex items-center justify-between gap-1 px-2 py-1.5 border ${ok === null ? "bg-[#f2f4f6] border-[#d8dadc]" : ok ? "bg-[#f2ffd6] border-[#506600]" : "bg-[#ffede9] border-[#b02f00]"}`}>
                          <span className="text-[10px] font-bold italic uppercase text-[#191c1e] truncate" title={item.comment ?? undefined}>{item.label}</span>
                          <span className={`text-[9px] font-black italic uppercase px-1.5 py-0.5 border shrink-0 ${ok === null ? "bg-[#d8dadc] text-[#444933] border-[#d8dadc]" : ok ? "bg-[#ccff00] text-[#161e00] border-[#ccff00]" : "bg-[#ff5722] text-white border-[#ff5722]"}`}>
                            {ok === null ? "—" : ok ? "OK" : "Não"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1.5">
                    <div className={`flex-1 border px-3 py-1.5 ${conformity.absencesReport ? "border-[#b02f00] bg-[#fff4e5]" : "border-[#d8dadc] bg-[#f2f4f6]"}`}>
                      <p className="text-[9px] font-bold uppercase italic text-[#747a60] mb-0.5 flex items-center gap-1"><User size={9} /> Faltas/Atrasos</p>
                      <p className="text-[11px] italic text-[#191c1e] leading-snug">{conformity.absencesReport ?? <span className="text-[#9aa088]">Sem registro</span>}</p>
                    </div>
                    <div className={`flex-1 border px-3 py-1.5 ${conformity.standoutResponse === true ? "border-[#506600] bg-[#f7ffe0]" : "border-[#d8dadc] bg-[#f2f4f6]"}`}>
                      <p className="text-[9px] font-bold uppercase italic text-[#506600] mb-0.5 flex items-center gap-1"><Trophy size={9} /> Destaque</p>
                      <p className="text-[11px] italic text-[#191c1e] leading-snug">
                        {conformity.standoutResponse === null ? <span className="text-[#9aa088]">Pendente</span> : conformity.standoutResponse ? (conformity.standoutJustification ?? "Sim") : "Não"}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Event Comments */}
              {eventComments && eventComments.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[11px] font-black italic uppercase text-[#444933] mb-2 flex items-center gap-1.5"><MessageSquare size={13} /> Comentários <span className="text-[#747a60]">({eventComments.length})</span></p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {eventComments.map((c, i) => (
                      <div key={i} className="text-[11px] bg-[#f2f4f6] border border-[#d8dadc] px-3 py-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold italic uppercase text-[#191c1e] text-[10px]">{(c as { authorName?: string }).authorName ?? "Admin"}</span>
                          <span className="italic text-[#9aa088] text-[10px]">{c.createdAt ? formatDateTime(new Date(c.createdAt)) : ""}</span>
                        </div>
                        <p className="italic text-[#191c1e] leading-snug whitespace-pre-wrap">{c.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── COMPACT ACTION BAR ── */}
          {activeCriteria.length === 0 ? (
            <div className="bg-white border-2 border-[#191c1e] text-center py-10 italic uppercase font-bold text-[#747a60] text-sm">
              Nenhum critério ativo para este evento.
            </div>
          ) : (
            <>
              {!alreadyReleased && (
                <div className="flex items-center gap-2 flex-wrap bg-white border-2 border-[#191c1e] px-3 py-2">
                  {/* Salvar */}
                  <button
                    data-testid="button-save-all-cal"
                    type="button"
                    disabled={savingAll || fillableCount === 0}
                    onClick={saveAllCalibrations}
                    title={fillableCount === 0 ? "Preencha ao menos uma nota calibrada (0–10) para salvar" : `Salvar ${fillableCount} calibração(ões) digitada(s)`}
                    className="flex items-center gap-1.5 px-4 py-1.5 border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] font-black text-xs italic uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-colors enabled:hover:bg-[#191c1e] enabled:hover:text-[#ccff00]"
                  >
                    <Save size={13} /> {savingAll ? "Salvando..." : `Salvar${fillableCount > 0 ? ` (${fillableCount})` : " Todas"}`}
                  </button>

                  {/* Publicar dropdown */}
                  {canFinalize && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-1.5 px-4 py-1.5 border-2 border-[#191c1e] bg-[#191c1e] text-white font-black text-xs italic uppercase hover:bg-[#506600] transition-colors"
                        >
                          <Send size={13} /> Publicar <ChevronDown size={11} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] w-52 shadow-[4px_4px_0px_0px_#191c1e]">
                        <div className="divide-y divide-[#e8eaec]">
                          <button
                            data-testid="button-publish-all-partial"
                            type="button"
                            disabled={publishingAllPartial}
                            onClick={handlePublishAllPartial}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-black italic uppercase text-left hover:bg-[#f2f4f6] disabled:opacity-50 transition-colors"
                          >
                            <Flag size={13} className="text-[#3b0900] shrink-0" />
                            {publishingAllPartial ? "Publicando..." : "Todos como Parcial"}
                          </button>
                          <button
                            data-testid="button-publish-all-final"
                            type="button"
                            disabled={publishingAllFinal}
                            onClick={handlePublishAllFinal}
                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-black italic uppercase text-left hover:bg-[#f2f4f6] disabled:opacity-50 transition-colors"
                          >
                            <ShieldCheck size={13} className="text-[#506600] shrink-0" />
                            {publishingAllFinal ? "Publicando..." : "Todos como Final"}
                          </button>
                          {autoFillableCriteria.length > 0 && (
                            <button
                              data-testid="button-autofill-from-evaluator"
                              type="button"
                              disabled={savingAutoFill || savingAll}
                              onClick={autoFillFromEvaluator}
                              title="Cria calibrações iguais à nota do avaliador para todos os critérios ainda sem calibração"
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-black italic uppercase text-left hover:bg-[#f2f4f6] disabled:opacity-50 transition-colors"
                            >
                              <Check size={13} className="text-[#444933] shrink-0" />
                              {savingAutoFill ? "Preenchendo..." : `Liberar Sem Cal. (${autoFillableCriteria.length})`}
                            </button>
                          )}
                          {readyToFinalize && (
                            <button
                              data-testid="button-open-finalize"
                              type="button"
                              onClick={() => setFinalizeOpen(true)}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-black italic uppercase text-left bg-[#ccff00] text-[#161e00] hover:bg-[#506600] hover:text-[#ccff00] transition-colors"
                            >
                              <Flag size={13} className="shrink-0" />
                              {alreadyClosed ? "Liberar Notas" : "Fechar e Liberar"}
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  {/* Spacer + progress + filters */}
                  <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-[11px] font-bold italic uppercase text-[#747a60] flex items-center gap-1" title={`${finalPublishedCount} de ${activeCriteria.length} critérios publicados como Final`}>
                      <ShieldCheck size={11} className="text-[#506600]" /> {finalPublishedCount}/{activeCriteria.length} final
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Filter size={11} className="text-[#747a60] mr-1" />
                      {([
                        { value: "all", label: "Todos" },
                        { value: "uncalibrated", label: "Pendentes" },
                        { value: "calibrated", label: "Calibrados" },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCriterionFilter(opt.value)}
                          className={`text-[10px] font-black italic uppercase px-2 py-0.5 border transition-colors ${criterionFilter === opt.value ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-[#f2f4f6] text-[#444933] border-[#d8dadc] hover:border-[#191c1e]"}`}
                        >{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── CRITERIA TABLE ── */}
              {filteredActiveCriteria.length === 0 && activeCriteria.length > 0 ? (
                <div className="bg-[#d8dadc] border-2 border-[#191c1e] px-5 py-4 text-center">
                  <p className="text-sm italic font-bold uppercase text-[#444933]">Nenhum critério para o filtro selecionado.</p>
                </div>
              ) : (
                <div className="bg-white border-2 border-[#191c1e] overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[520px]">
                    <thead>
                      <tr className="bg-[#f2f4f6] border-b-2 border-[#191c1e]">
                        <th className="text-left px-3 py-2 text-[10px] font-black italic uppercase text-[#444933] tracking-wider">Critério</th>
                        <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] tracking-wider w-16">Peso</th>
                        <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] tracking-wider w-20" title="Média das notas enviadas pelos avaliadores da área">Avaliador</th>
                        <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] tracking-wider w-28">Calibrada</th>
                        <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] tracking-wider w-24 hidden sm:table-cell">Status</th>
                        {canFinalize && !alreadyReleased && (
                          <th className="text-center px-2 py-2 text-[10px] font-black italic uppercase text-[#444933] tracking-wider w-32 hidden md:table-cell" title="Publicação parcial: prévia visível ao colaborador · Publicação final: nota definitiva">Publicação</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e8eaec]">
                      {filteredActiveCriteria.map(c => {
                        const areaScores = getAreaScores(c.criterionId);
                        const avg = getAvgScore(c.criterionId);
                        const cal = getCalibration(c.criterionId);
                        const calVal = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
                        const scoreVal = calScores[c.criterionId] ?? (cal ? String(parseFloat(cal.calibratedScore as unknown as string)) : "");
                        const isSaving = savingCritId === c.criterionId && createMutation.isPending;
                        const isFinalPublished = !!c.finalPublishedAt;
                        const peso = c.weightOverride ?? c.originalWeight ?? 0;
                        const hasUnsaved = calScores[c.criterionId] !== undefined;
                        const savedScore = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
                        const changedFromSaved = hasUnsaved && String(savedScore) !== calScores[c.criterionId];

                        return (
                          <tr
                            key={c.criterionId}
                            data-testid={`row-cal-${c.criterionId}`}
                            onClick={() => setDetailCriterionId(c.criterionId)}
                            className="cursor-pointer hover:bg-[#f7ffd1] transition-colors group"
                          >
                            {/* Critério */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-black italic uppercase text-[12px] text-[#191c1e] leading-tight">{c.criterionName}</span>
                                {c.responsibleAreaName && (
                                  <span className="hidden lg:inline text-[9px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border border-[#191c1e] px-1">{c.responsibleAreaName}</span>
                                )}
                                {areaScores.length > 0 && (
                                  <ChevronDown size={11} className="text-[#747a60] opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                                )}
                              </div>
                            </td>
                            {/* Peso */}
                            <td className="px-2 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                              {canEditWeights ? (
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    data-testid={`input-weight-${c.criterionId}`}
                                    type="text"
                                    inputMode="decimal"
                                    value={weightEdits[c.criterionId] ?? String(peso)}
                                    onChange={e => setWeightEdits(prev => ({ ...prev, [c.criterionId]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                                    className="h-6 w-10 px-1 border-2 border-[#191c1e] text-center text-xs font-black italic bg-white focus:outline-none focus:ring-1 focus:ring-[#ccff00]"
                                  />
                                  {weightEdits[c.criterionId] != null && Number(weightEdits[c.criterionId].replace(",", ".")) !== Number(peso) && (
                                    <button
                                      data-testid={`button-save-weight-${c.criterionId}`}
                                      type="button"
                                      disabled={savingWeightId === c.criterionId && updateWeightMutation.isPending}
                                      onClick={() => saveWeight(c.criterionId, c.active)}
                                      title="Salvar peso"
                                      className="h-6 w-6 bg-[#ccff00] border border-[#191c1e] flex items-center justify-center disabled:opacity-50 hover:bg-[#191c1e] hover:text-[#ccff00] transition-colors"
                                    >
                                      {savingWeightId === c.criterionId && updateWeightMutation.isPending ? "·" : <Check size={10} />}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-black italic text-[#191c1e]">{peso}</span>
                              )}
                            </td>
                            {/* Nota Avaliador */}
                            <td className="px-2 py-2.5 text-center">
                              <span className={cn("text-sm font-black italic", calVal != null ? "text-[#c4c9ac] line-through" : "text-[#191c1e]")}>
                                {avg != null ? avg.toFixed(2) : <span className="text-[#c4c9ac] text-xs not-italic">—</span>}
                              </span>
                            </td>
                            {/* Nota Calibrada inline */}
                            <td className="px-2 py-2.5" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  data-testid={`input-cal-score-${c.criterionId}`}
                                  type="text"
                                  inputMode="numeric"
                                  value={scoreVal}
                                  onChange={e => setCalScores(prev => ({ ...prev, [c.criterionId]: e.target.value.replace(/[^0-9]/g, "") }))}
                                  placeholder="—"
                                  className={cn(
                                    "h-7 w-12 px-1 border-2 text-center text-sm font-black italic focus:outline-none focus:ring-2 focus:ring-[#ccff00]",
                                    changedFromSaved ? "border-[#ff5722] bg-[#fff3f0]" :
                                    calVal != null ? "border-[#506600] bg-[#f2ffd6]" :
                                    "border-[#191c1e] bg-white"
                                  )}
                                />
                                {changedFromSaved && (
                                  <button
                                    data-testid={`button-save-cal-${c.criterionId}`}
                                    type="button"
                                    disabled={isSaving || savingAll}
                                    onClick={() => saveCalibration(c.criterionId)}
                                    title="Salvar calibração"
                                    className="h-7 w-7 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center disabled:opacity-50 hover:bg-[#191c1e] hover:text-[#ccff00] transition-colors"
                                  >
                                    {isSaving ? "·" : <Save size={11} />}
                                  </button>
                                )}
                              </div>
                            </td>
                            {/* Status */}
                            <td className="px-2 py-2.5 text-center hidden sm:table-cell">
                              {cal ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold italic uppercase bg-[#f2ffd6] text-[#506600] border border-[#506600] px-1.5 py-0.5">
                                  <CheckCircle size={10} /> Cal.
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border border-[#3b0900] px-1.5 py-0.5">
                                  {avg != null ? "Pendente" : "Sem nota"}
                                </span>
                              )}
                            </td>
                            {/* Publicação */}
                            {canFinalize && !alreadyReleased && (
                              <td className="px-2 py-2.5 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {isFinalPublished ? (
                                    <span
                                      data-testid={`badge-criterion-final-${c.criterionId}`}
                                      title={`Final publicado em ${formatDateTime(new Date(c.finalPublishedAt!))}`}
                                      className="text-[9px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border border-[#506600] px-1.5 py-0.5 flex items-center gap-0.5"
                                    >
                                      <ShieldCheck size={9} /> Final
                                    </span>
                                  ) : c.partialPublishedAt ? (
                                    <span
                                      data-testid={`badge-criterion-partial-${c.criterionId}`}
                                      title={`Parcial publicado em ${formatDateTime(new Date(c.partialPublishedAt))}`}
                                      className="text-[9px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border border-[#3b0900] px-1.5 py-0.5 flex items-center gap-0.5"
                                    >
                                      <Send size={9} /> Parcial
                                    </span>
                                  ) : null}
                                  <button
                                    data-testid={`button-publish-criterion-partial-${c.criterionId}`}
                                    type="button"
                                    disabled={publishingCritId === c.criterionId && publishCriterionPartialMutation.isPending}
                                    onClick={() => handlePublishCriterionPartial(c.criterionId)}
                                    title={isFinalPublished ? "Tornar Parcial" : "Publicar como Parcial"}
                                    className="h-6 px-1.5 border border-[#191c1e] bg-white text-[9px] font-black italic uppercase text-[#191c1e] disabled:opacity-40 hover:bg-[#191c1e] hover:text-white transition-colors"
                                  >
                                    {publishingCritId === c.criterionId && publishCriterionPartialMutation.isPending ? "·" : <Flag size={10} />}
                                  </button>
                                  <button
                                    data-testid={`button-publish-criterion-final-${c.criterionId}`}
                                    type="button"
                                    disabled={publishingFinalCritId === c.criterionId && publishCriterionFinalMutation.isPending}
                                    onClick={() => handlePublishCriterionFinal(c.criterionId)}
                                    title={isFinalPublished ? "Republicar como Final" : "Publicar como Final"}
                                    className={`h-6 px-1.5 border text-[9px] font-black italic uppercase disabled:opacity-40 transition-colors ${isFinalPublished ? "bg-[#506600] text-[#ccff00] border-[#506600] hover:bg-[#ccff00] hover:text-[#161e00]" : "bg-[#191c1e] text-[#ccff00] border-[#191c1e] hover:bg-[#506600]"}`}
                                  >
                                    {publishingFinalCritId === c.criterionId && publishCriterionFinalMutation.isPending ? "·" : <ShieldCheck size={10} />}
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── FINALIZATION STATUS (single compact bar) ── */}
              {scoredCriteria.length > 0 && !alreadyReleased && (
                readyToFinalize ? (
                  <div className="bg-[#191c1e] text-white border-2 border-[#191c1e] px-4 py-2.5 flex items-center justify-between gap-3 shadow-[4px_4px_0px_0px_#ccff00]">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-[#ccff00] shrink-0" />
                      <span className="text-sm font-black italic uppercase">Todas as calibrações salvas — pronto para publicar</span>
                    </div>
                    {canFinalize && (
                      <button
                        data-testid="button-open-finalize"
                        type="button"
                        onClick={() => setFinalizeOpen(true)}
                        className="flex items-center gap-1.5 px-4 py-1.5 border-2 border-[#ccff00] bg-[#ccff00] text-[#161e00] font-black text-xs italic uppercase hover:bg-white hover:border-white transition-colors shrink-0"
                      >
                        <Send size={13} /> {alreadyClosed ? "Liberar Notas" : "Fechar e Liberar"}
                      </button>
                    )}
                  </div>
                ) : allCalibrated && !evaluationsComplete ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-[#191c1e] text-[#444933]">
                    <AlertTriangle size={14} className="shrink-0 text-[#ff5722]" />
                    <p className="text-xs font-bold italic uppercase">Calibrações concluídas, mas há avaliações pendentes.</p>
                  </div>
                ) : allCalibrated && !canFinalize ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-[#191c1e] text-[#444933]">
                    <Lock size={14} className="shrink-0 text-[#747a60]" />
                    <p className="text-xs font-bold italic uppercase">Calibrações concluídas. O fechamento é feito pela diretoria ou RH.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-dashed border-[#191c1e] text-[#444933]">
                    <Info size={14} className="shrink-0 text-[#747a60]" />
                    <p className="text-xs font-bold italic uppercase" title="Calibre os critérios com nota da área para habilitar o fechamento do evento">Calibre todos os critérios para liberar o fechamento.</p>
                  </div>
                )
              )}

              {alreadyReleased && (
                <div className="bg-[#506600] text-[#ccff00] border-2 border-[#191c1e] px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="shrink-0" />
                    <span className="text-sm font-black italic uppercase">
                      Avaliação Final liberada{feedbackReleasedAtDate ? ` em ${formatDateTime(feedbackReleasedAtDate)}` : ""}
                    </span>
                  </div>
                  <button
                    data-testid="button-save-all-cal-released"
                    type="button"
                    disabled={savingAll || fillableCount === 0}
                    onClick={saveAllCalibrations}
                    className="flex items-center gap-1.5 px-4 py-1.5 border-2 border-[#ccff00] bg-[#ccff00] text-[#161e00] font-black text-xs italic uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white hover:border-white transition-colors shrink-0"
                  >
                    <Save size={13} /> {savingAll ? "Salvando..." : `Salvar Ajustes${fillableCount > 0 ? ` (${fillableCount})` : ""}`}
                  </button>
                </div>
              )}
            </>
          )}
        </>
        )}

      </div>

      {/* ── CRITERION DETAIL DIALOG ── */}
      {detailCriterion && (() => {
        const c = detailCriterion;
        const areaScores = getAreaScores(c.criterionId);
        const avg = getAvgScore(c.criterionId);
        const cal = getCalibration(c.criterionId);
        const calVal = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
        const scoreVal = calScores[c.criterionId] ?? (cal ? String(parseFloat(cal.calibratedScore as unknown as string)) : "");
        const reasonVal = calReasons[c.criterionId] ?? (cal?.calibrationReason ?? "");
        const isSaving = savingCritId === c.criterionId && createMutation.isPending;
        const isFinalPublished = !!c.finalPublishedAt;
        return (
          <Dialog open={true} onOpenChange={v => { if (!v) setDetailCriterionId(null); }}>
            <DialogContent className="max-w-2xl rounded-none border-2 border-[#191c1e] p-0 gap-0 shadow-[8px_8px_0px_0px_#ccff00]">
              <DialogHeader className="bg-[#f2f4f6] border-b-2 border-[#191c1e] px-5 py-3 space-y-0">
                <DialogTitle className="font-black italic uppercase tracking-tight text-[#191c1e] flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-[#506600]" /> {c.criterionName}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {c.responsibleAreaName && (
                    <span className="text-[10px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border border-[#191c1e] px-1.5 py-0.5 flex items-center gap-1"><Building2 size={10} /> {c.responsibleAreaName}</span>
                  )}
                  <span className="text-[10px] font-bold italic uppercase text-[#747a60] border border-[#d8dadc] px-1.5 py-0.5">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
                  {cal ? (
                    <span className="text-[10px] font-bold italic uppercase bg-[#f2ffd6] text-[#506600] border border-[#506600] px-1.5 py-0.5 flex items-center gap-1"><CheckCircle size={10} /> Calibrado</span>
                  ) : (
                    <span className="text-[10px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border border-[#3b0900] px-1.5 py-0.5">{avg != null ? "Pendente" : "Sem nota da área"}</span>
                  )}
                  {canEditWeights && (
                    <div className="flex items-center gap-1 ml-auto" onClick={e => e.stopPropagation()}>
                      <span className="text-[10px] font-bold italic uppercase text-[#747a60]">Peso</span>
                      <input
                        data-testid={`input-weight-${c.criterionId}`}
                        type="text" inputMode="decimal"
                        value={weightEdits[c.criterionId] ?? String(c.weightOverride ?? c.originalWeight ?? 0)}
                        onChange={e => setWeightEdits(prev => ({ ...prev, [c.criterionId]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                        className="h-6 w-12 px-1 border-2 border-[#191c1e] text-center text-xs font-black italic focus:outline-none focus:ring-1 focus:ring-[#ccff00]"
                      />
                      {weightEdits[c.criterionId] != null && Number(weightEdits[c.criterionId].replace(",", ".")) !== Number(c.weightOverride ?? c.originalWeight ?? 0) && (
                        <button
                          data-testid={`button-save-weight-${c.criterionId}`}
                          type="button"
                          disabled={savingWeightId === c.criterionId && updateWeightMutation.isPending}
                          onClick={() => saveWeight(c.criterionId, c.active)}
                          className="h-6 px-2 bg-[#ccff00] border border-[#191c1e] text-[10px] font-black italic uppercase disabled:opacity-50 hover:bg-[#191c1e] hover:text-[#ccff00] transition-colors"
                        >
                          {savingWeightId === c.criterionId && updateWeightMutation.isPending ? "..." : "Salvar"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </DialogHeader>
              <div className="p-5 space-y-4 max-h-[68vh] overflow-y-auto">
                {/* Area scores */}
                {areaScores.length > 0 ? (
                  <div>
                    <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-2 flex items-center gap-1.5"><Building2 size={13} /> Notas da Área</p>
                    <div className="space-y-2">
                      {areaScores.map((s, i) => (
                        <div key={i} className="border-2 border-[#191c1e] bg-white">
                          <div className="flex items-center justify-between gap-2 px-3 py-1.5">
                            <span className="text-[11px] font-bold italic uppercase text-[#444933]">{s.name}</span>
                            <span className="text-sm font-black italic text-[#191c1e] bg-[#eceef0] border-l-2 border-[#191c1e] px-2 leading-6 shrink-0">{s.score.toFixed(1)}</span>
                          </div>
                          {s.comment && <p className="text-[11px] italic text-[#444933] border-t-2 border-[#eceef0] px-3 py-1.5 whitespace-pre-wrap">{s.comment}</p>}
                          {s.audioUrl && (
                            <div className="border-t-2 border-[#eceef0] px-3 py-1.5">
                              <p className="text-[10px] font-bold uppercase italic text-[#747a60] mb-1">Áudio</p>
                              <AudioPlayer objectPath={s.audioUrl} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-baseline gap-2 mt-3">
                      <span className="text-[11px] font-bold uppercase italic text-[#747a60]">Nota Avaliador</span>
                      <span className={`text-xl font-black italic ${cal ? "text-[#c4c9ac] line-through" : "text-[#191c1e]"}`}>{avg?.toFixed(2)}</span>
                      {cal && <><span className="text-sm text-[#747a60]">→</span><span className="text-xl font-black italic text-[#ff5722]">{calVal?.toFixed(2)}</span></>}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm italic text-[#747a60] font-bold uppercase">Nenhuma nota enviada pela área para este critério.</p>
                )}

                {/* Calibration form */}
                <div className="border-t-2 border-[#e8eaec] pt-4">
                  <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-1.5"><SlidersHorizontal size={13} /> Calibração</p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                    <div className="sm:w-28 shrink-0">
                      <label className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60] block mb-1">Nota (0–10)</label>
                      <input
                        data-testid={`input-cal-score-${c.criterionId}`}
                        type="text" inputMode="numeric"
                        value={scoreVal}
                        onChange={e => setCalScores(prev => ({ ...prev, [c.criterionId]: e.target.value.replace(/[^0-9]/g, "") }))}
                        placeholder="—"
                        className="h-11 w-full px-3 border-2 border-[#191c1e] text-lg font-black italic focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60] block mb-1">Justificativa</label>
                      <Textarea
                        data-testid={`input-cal-reason-${c.criterionId}`}
                        value={reasonVal}
                        onChange={e => setCalReasons(prev => ({ ...prev, [c.criterionId]: e.target.value }))}
                        placeholder="Por que a nota original foi alterada?"
                        rows={3}
                        className="mt-0 rounded-none border-2 border-[#191c1e] resize-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {cal && (
                      <p className="text-xs italic text-[#444933]">
                        Atual: <strong className="not-italic">{calVal?.toFixed(2)}</strong>{cal.calibratedByName ? ` · por ${cal.calibratedByName}` : ""}
                      </p>
                    )}
                    <button
                      data-testid={`button-save-cal-${c.criterionId}`}
                      type="button"
                      disabled={isSaving || savingAll}
                      onClick={() => saveCalibration(c.criterionId)}
                      className={`ml-auto flex items-center gap-2 bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold text-sm italic uppercase disabled:opacity-50 ${HARD_SHADOW} transition-all enabled:hover:shadow-[2px_2px_0px_0px_#191c1e] enabled:hover:translate-x-[2px] enabled:hover:translate-y-[2px]`}
                    >
                      <Save size={16} /> {isSaving ? "Salvando..." : cal ? "Atualizar Calibração" : "Salvar Calibração"}
                    </button>
                  </div>
                </div>

                {/* Per-criterion publish buttons */}
                {canFinalize && !alreadyReleased && (
                  <div className="border-t-2 border-[#e8eaec] pt-3 flex items-center gap-2 flex-wrap">
                    {isFinalPublished && (
                      <span data-testid={`badge-criterion-final-${c.criterionId}`} title={`Final publicado em ${formatDateTime(new Date(c.finalPublishedAt!))}`} className="text-[11px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1 flex items-center gap-1">
                        <ShieldCheck size={12} /> Final · {formatDateTime(new Date(c.finalPublishedAt!))}
                      </span>
                    )}
                    {c.partialPublishedAt && !isFinalPublished && (
                      <span data-testid={`badge-criterion-partial-${c.criterionId}`} title={`Parcial em ${formatDateTime(new Date(c.partialPublishedAt))}`} className="text-[11px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border-2 border-[#191c1e] px-2 py-1 flex items-center gap-1">
                        <Send size={12} /> Parcial · {formatDateTime(new Date(c.partialPublishedAt))}
                      </span>
                    )}
                    <button
                      data-testid={`button-publish-criterion-partial-${c.criterionId}`}
                      type="button"
                      disabled={publishingCritId === c.criterionId && publishCriterionPartialMutation.isPending}
                      onClick={() => handlePublishCriterionPartial(c.criterionId)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-black italic uppercase bg-white text-[#191c1e] border-2 border-[#191c1e] px-3 py-1.5 disabled:opacity-40 hover:bg-[#191c1e] hover:text-white transition-colors"
                    >
                      <Send size={12} /> {publishingCritId === c.criterionId && publishCriterionPartialMutation.isPending ? "Publicando..." : isFinalPublished ? "Tornar Parcial" : "Publicar Parcial"}
                    </button>
                    <button
                      data-testid={`button-publish-criterion-final-${c.criterionId}`}
                      type="button"
                      disabled={publishingFinalCritId === c.criterionId && publishCriterionFinalMutation.isPending}
                      onClick={() => handlePublishCriterionFinal(c.criterionId)}
                      className={`inline-flex items-center gap-1.5 text-[11px] font-black italic uppercase border-2 border-[#191c1e] px-3 py-1.5 disabled:opacity-40 transition-all ${isFinalPublished ? "bg-[#506600] text-[#ccff00] hover:bg-[#ccff00] hover:text-[#161e00]" : "bg-[#191c1e] text-[#ccff00] hover:bg-[#506600]"}`}
                    >
                      <ShieldCheck size={12} /> {publishingFinalCritId === c.criterionId && publishCriterionFinalMutation.isPending ? "Publicando..." : isFinalPublished ? "Republicar Final" : "Publicar Final"}
                    </button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}


      {/* Modal explicativo de finalização do evento */}
      <Dialog open={finalizeOpen} onOpenChange={(o) => { if (!finalizing) setFinalizeOpen(o); }}>
        <DialogContent className="max-w-3xl rounded-none border-2 border-[#191c1e] p-0 gap-0 shadow-[8px_8px_0px_0px_#ccff00]">
          <DialogHeader className="bg-[#191c1e] text-white p-5 space-y-1 text-left">
            <DialogTitle className="text-xl font-black italic uppercase tracking-tight flex items-center gap-2">
              <Flag size={20} className="text-[#ccff00]" /> Finalizar Evento
            </DialogTitle>
            <p className="text-xs font-bold italic uppercase text-white/60">{pickedEvent?.name}</p>
          </DialogHeader>

          <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
            {/* Resumo: como foi o evento */}
            <div className="flex items-stretch gap-3">
              <div className="flex-1 border-2 border-[#191c1e] p-4 flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Nota Final da Equipe</span>
                <span className="text-3xl font-black italic text-[#506600] leading-none mt-1">
                  {feedback ? feedback.eventScore.toFixed(1) : "—"}<span className="text-sm text-[#747a60]">/100</span>
                </span>
              </div>
            </div>

            {scoredCriteria.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-1.5 flex items-center gap-1.5"><SlidersHorizontal size={13} className="text-[#506600]" /> Notas Finais por Critério</p>
                <div className="border-2 border-[#191c1e] divide-y-2 divide-[#191c1e]">
                  {scoredCriteria.map((c, i) => {
                    const avg = getAvgScore(c.criterionId);
                    const cal = getCalibration(c.criterionId);
                    const calVal = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
                    const finalVal = calVal ?? avg;
                    const peso = c.weightOverride ?? c.originalWeight ?? 0;
                    const scores = getAreaScores(c.criterionId);
                    return (
                      <div key={c.criterionId} className={`px-3 py-2 ${i % 2 ? "bg-[#f7f9fb]" : "bg-white"}`} data-testid={`finalize-criterion-${c.criterionId}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-black italic uppercase text-[#191c1e] truncate">{c.criterionName}</span>
                            <span className="text-[9px] font-bold italic uppercase text-[#747a60] border border-[#c4c9ac] px-1 shrink-0">Peso {peso}</span>
                            {Number(peso) === 0 && (
                              <span className="text-[9px] font-black italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-1 shrink-0">Não conta</span>
                            )}
                            {c.responsibleAreaName && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border border-[#191c1e] px-1 shrink-0"><Building2 size={10} /> {c.responsibleAreaName}</span>
                            )}
                          </div>
                          <span className="flex items-center gap-1.5 justify-end text-xs font-black italic shrink-0">
                            <span className={calVal != null ? "text-[#c4c9ac] line-through" : "text-[#444933]"}>{avg != null ? avg.toFixed(2) : "—"}</span>
                            {calVal != null && (
                              <>
                                <span className="text-[#747a60]">→</span>
                                <span className="text-[#a06a00]">{calVal.toFixed(2)}</span>
                              </>
                            )}
                          </span>
                        </div>
                        {scores.length > 0 && (
                          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1.5">
                            {scores.map((s, j) => (
                              <span key={j} className="inline-flex items-center gap-1 text-[10px] italic text-[#444933]">
                                {s.name}<strong className="not-italic text-[#191c1e] bg-[#eceef0] border border-[#c4c9ac] px-1 leading-tight">{s.score.toFixed(1)}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] italic text-[#747a60] mt-1.5">Original = média da área · Calibrada = ajuste do gestor · Final = nota usada (calibrada quando houver, senão a média).</p>
              </div>
            )}

            {feedback && feedback.attentionPoints && feedback.attentionPoints.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-1.5 flex items-center gap-1.5"><AlertTriangle size={13} className="text-[#ff5722]" /> Pontos de Atenção</p>
                <ul className="space-y-1">
                  {feedback.attentionPoints.map((a, i) => (
                    <li key={i} className="text-sm italic text-[#191c1e] border-l-4 border-[#ff5722] pl-2.5 py-0.5">{a}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-[#fff8e1] border-2 border-[#191c1e] p-3 flex items-start gap-2">
              <Lock size={15} className="text-[#b02f00] shrink-0 mt-0.5" />
              <p className="text-xs italic font-bold text-[#444933] leading-snug">
                Ao finalizar, o evento será <strong>fechado</strong> e estas notas ficarão <strong>visíveis para os funcionários</strong>. Essa ação encerra a calibração do evento.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-5 border-t-2 border-[#191c1e] bg-[#f7f9fb]">
            <button
              type="button"
              disabled={finalizing}
              onClick={() => setFinalizeOpen(false)}
              className="px-5 py-2.5 border-2 border-[#191c1e] bg-white font-bold text-sm italic uppercase tracking-wider disabled:opacity-50 transition-all enabled:hover:bg-[#eceef0]"
            >
              Cancelar
            </button>
            <button
              data-testid="button-confirm-finalize"
              type="button"
              disabled={finalizing}
              onClick={handleFinalize}
              className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-2.5 font-black text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} transition-all enabled:hover:shadow-[2px_2px_0px_0px_#191c1e] enabled:hover:translate-x-[2px] enabled:hover:translate-y-[2px]`}
            >
              <Send size={16} /> {finalizing ? "Finalizando..." : alreadyClosed ? "Liberar Notas" : "Finalizar e Liberar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
