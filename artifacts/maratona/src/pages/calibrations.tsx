import { useState, useEffect, useRef } from "react";
import { useGetEvents, useGetEvent, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useCreateCalibration, useGetEventFeedback, useCloseEvent, useReleaseEventFeedback, usePublishCriterionPartialFeedback, usePublishCriterionFinalFeedback, usePublishAllCriteriaFinalFeedback, usePublishAllCriteriaPartialFeedback, useUpdateEventCriteria, useGetEventConformity, useGetEventComments, useGetReviewRequests, getGetCalibrationsQueryKey, getGetEventsQueryKey, getGetEventQueryKey } from "@workspace/api-client-react";
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
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterWeekend, setFilterWeekend] = useState(false);
  const [calScores, setCalScores] = useState<Record<number, string>>({});
  const [calReasons, setCalReasons] = useState<Record<number, string>>({});
  const [savingCritId, setSavingCritId] = useState<number | null>(null);
  const [weightEdits, setWeightEdits] = useState<Record<number, string>>({});
  const [savingWeightId, setSavingWeightId] = useState<number | null>(null);
  // Cards de critério começam recolhidos; o usuário clica para expandir o que quer ver.
  const [collapsedCriteria, setCollapsedCriteria] = useState<Set<number>>(new Set());
  const collapsedInitializedForEventId = useRef<number | null>(null);
  const [publishingFinalCritId, setPublishingFinalCritId] = useState<number | null>(null);
  const [publishingAllFinal, setPublishingAllFinal] = useState(false);
  const [publishingAllPartial, setPublishingAllPartial] = useState(false);
  const [criterionFilter, setCriterionFilter] = useState<"all" | "uncalibrated" | "calibrated">("all");
  const [contextOpen, setContextOpen] = useState(true);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
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
  const isWeekend = (dateStr: string | null | undefined) => {
    if (!dateStr) return false;
    const d = new Date(dateStr + "T12:00:00");
    return d.getDay() === 0 || d.getDay() === 6;
  };
  const filteredCalibratableEvents = calibratableEvents.filter(e => {
    const matchStatus = eventStatusFilter === "all" || e.status === eventStatusFilter;
    const matchDate = (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom) && (!filterDateTo || (e.startDate ?? "") <= filterDateTo);
    const matchWeekend = !filterWeekend || isWeekend(e.startDate) || isWeekend(e.endDate);
    return matchStatus && matchDate && matchWeekend;
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

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Hero panel */}
        <section className="relative">
          <div className="bg-[#191c1e] text-white p-8 skew-x-[-2deg] shadow-[8px_8px_0px_0px_#ccff00]">
            <div className="skew-x-[2deg] flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h1 data-testid="text-page-title" className="text-3xl md:text-5xl italic uppercase font-black tracking-tighter leading-none mb-3 flex items-center gap-3">
                  <Target size={36} className="text-[#ccff00]" /> Calibrações Técnicas
                </h1>
                <p className="text-base md:text-lg italic text-white/70 max-w-2xl">
                  Ajuste técnico de notas aplicadas aos critérios do evento. A precisão é a diferença entre um resultado justo e um campeão.
                </p>
              </div>
              {selectedEventId && pendingCount > 0 && (
                <div className="bg-[#ccff00] text-[#161e00] p-4 border-2 border-white skew-x-[-6deg] shrink-0">
                  <div className="skew-x-[6deg] flex items-center gap-3">
                    <SlidersHorizontal size={32} />
                    <div>
                      <p className="text-xs font-bold uppercase italic tracking-wider">Ações Pendentes</p>
                      <p className="text-4xl font-black italic leading-none mt-1">{pendingCount}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Event selector */}
        <section className="bg-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1.5 bg-[#ccff00] border-l-2 border-b-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wider">ETAPA 01</div>
          <Label className="text-xs font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-2 relative">
            <CalendarDays size={16} /> Selecionar Evento
          </Label>

          <div className="w-full max-w-2xl">
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                { value: "all", label: "Todos" },
                { value: "open", label: "Em avaliação" },
                { value: "closed", label: "Fechado" },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  data-testid={`button-filter-status-${opt.value}`}
                  onClick={() => setEventStatusFilter(opt.value)}
                  className={cn(
                    "px-3 py-1.5 border-2 border-[#191c1e] font-bold italic uppercase text-[11px] tracking-wider transition-all",
                    eventStatusFilter === opt.value ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#444933] hover:bg-[#f7f9fb]"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Filtro de data */}
            <div className="mb-3 space-y-2">
              <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60]">Filtrar por data</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] font-bold italic uppercase tracking-wide text-[#9aa088] block mb-1">De</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full h-8 px-2 text-xs border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white" />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-bold italic uppercase tracking-wide text-[#9aa088] block mb-1">Até</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full h-8 px-2 text-xs border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white" />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button type="button" onClick={() => setFilterWeekend(p => !p)} className={`flex-1 h-8 px-3 text-[10px] font-black italic uppercase tracking-wide border-2 transition-colors ${filterWeekend ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d4c8] hover:border-[#191c1e] hover:text-[#191c1e]"}`}>
                  {filterWeekend ? "✓ " : ""}Fim de semana
                </button>
                {(filterDateFrom || filterDateTo || filterWeekend) && (
                  <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterWeekend(false); }} className="text-[10px] font-bold italic uppercase text-[#747a60] hover:text-[#b02f00] whitespace-nowrap">
                    × Limpar
                  </button>
                )}
              </div>
            </div>

            <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={eventPickerOpen}
                  data-testid="select-event"
                  disabled={calibratableEvents.length === 0}
                  className={`w-full min-h-[3.25rem] px-4 py-3 flex items-center justify-between gap-3 text-left border-2 border-[#191c1e] bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#f7f9fb] ${HARD_SHADOW}`}
                >
                  {pickedEvent ? (
                    <span className="flex flex-col min-w-0">
                      <span className="font-black italic uppercase text-sm leading-tight text-[#191c1e]">{pickedEvent.name}</span>
                      {formatEventSubtitle(pickedEvent) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] truncate">{formatEventSubtitle(pickedEvent)}</span>}
                    </span>
                  ) : (
                    <span className="font-bold italic uppercase text-xs tracking-wider text-[#747a60]">
                      {calibratableEvents.length === 0 ? "Nenhum evento no ciclo atual" : "Busque um evento para calibrar..."}
                    </span>
                  )}
                  <ChevronsUpDown size={18} className="shrink-0 text-[#191c1e]" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                <Command className="rounded-none">
                  <CommandInput data-testid="input-event-search" placeholder="Buscar por evento ou cliente..." className="italic" />
                  <CommandList className="max-h-[320px]">
                    <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
                    <CommandGroup>
                      {filteredCalibratableEvents.map(ev => (
                        <CommandItem
                          key={ev.id}
                          value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                          data-testid={`option-event-${ev.id}`}
                          onSelect={() => { setSelectedEventId(ev.id); setCalScores({}); setCalReasons({}); setWeightEdits({}); setEventPickerOpen(false); }}
                          className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3 items-start"
                        >
                          <Check size={16} className={cn("mt-0.5 shrink-0", selectedEventId === ev.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex flex-col min-w-0 flex-1">
                            <span className="font-black italic uppercase text-sm leading-tight whitespace-normal">{ev.name}</span>
                            {formatEventSubtitle(ev) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-normal">{formatEventSubtitle(ev)}</span>}
                          </span>
                          <span className={`px-2 py-0.5 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase shrink-0 ${calibrationEventChip(ev).cls}`}>
                            {calibrationEventChip(ev).label}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="mt-4 flex items-start gap-2.5 bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
              <Info size={16} className="shrink-0 mt-0.5 text-[#444933]" />
              <p className="text-[11px] md:text-xs font-bold italic uppercase tracking-wide text-[#444933]">
                Todos os eventos do ciclo aparecem nesta lista. É possível calibrar a qualquer momento — inclusive critérios que ainda não receberam nota da área — e ajustar os pesos de cada critério.
              </p>
            </div>
          </div>
        </section>

        {/* Inline calibration */}
        {selectedEventId ? (
          <section className="space-y-5">
            {pickedEvent && (
              <div className="bg-white border-2 border-[#191c1e] p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#e0e3e5] flex items-center justify-center shrink-0">
                    <span className="skew-x-[4deg]"><Target size={20} /></span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black italic uppercase tracking-tight text-[#191c1e]">{pickedEvent.name}</h3>
                    <p className="text-xs font-bold italic uppercase text-[#747a60] truncate">{pickedEvent.clientName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                  {feedback && (
                    <div className="border-2 border-[#191c1e] px-3 py-1.5 flex flex-col items-center justify-center">
                      <span className="text-[9px] font-bold uppercase italic tracking-wider text-[#747a60]">Nota Final da Equipe</span>
                      <span className="text-2xl font-black italic text-[#506600] leading-none">{feedback.eventScore.toFixed(1)}<span className="text-sm text-[#747a60]">/100</span></span>
                    </div>
                  )}
                  <span className={`px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block shrink-0 ${alreadyReleased ? "bg-[#191c1e] text-[#ccff00]" : partialPublishedAtDate ? "bg-[#ffb5a0] text-[#3b0900]" : "bg-[#d8dadc] text-[#444933]"}`}>
                    <span className="inline-block skew-x-[8deg]">{alreadyReleased ? "Avaliação Final" : partialPublishedAtDate ? "Avaliação Parcial" : "Não Publicada"}</span>
                  </span>
                  <Link
                    href={`/events/${selectedEventId}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black italic uppercase bg-white text-[#444933] border-2 border-[#191c1e] px-3 py-1 hover:bg-[#191c1e] hover:text-white transition-colors shrink-0"
                  >
                    <ExternalLink size={12} /> Ver Gerenciamento
                  </Link>
                </div>
              </div>
            )}

            {/* Revisão Sinalizada — pedido de revisão feito pelo colaborador para este evento */}
            {eventReviewRequests.length > 0 && (
              <div className={cn(
                "border-2 border-[#191c1e] p-4",
                pendingEventReviewRequests.length > 0 ? "bg-[#ffb5a0]" : "bg-[#f2f4f6]"
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <Flag size={14} className="text-[#3b0900] shrink-0" />
                  <span className="text-[11px] font-black italic uppercase tracking-wider text-[#3b0900]">
                    Revisão Sinalizada {pendingEventReviewRequests.length > 0 && `— ${pendingEventReviewRequests.length} pendente${pendingEventReviewRequests.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="space-y-2">
                  {eventReviewRequests.map(r => (
                    <div key={r.id} className="bg-white border-2 border-[#191c1e] p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-black italic uppercase text-[#191c1e] truncate">{r.employeeName}</span>
                        <span className={`px-2 py-0.5 border border-[#191c1e] font-bold text-[9px] italic uppercase shrink-0 ${r.status === "pending" ? "bg-[#862200] text-white" : "bg-[#e0e3e5] text-[#444933]"}`}>
                          {r.status === "pending" ? "Pendente" : "Resolvida"}
                        </span>
                      </div>
                      <p className="text-xs italic text-[#444933]">"{r.comment}"</p>
                      {r.status === "resolved" && r.resolutionNotes && (
                        <p className="text-[10px] font-bold italic uppercase text-[#747a60] mt-1">Resposta: {r.resolutionNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Equipe Alocada — referência rápida de quem participou do evento sem
                precisar sair para "Ver Gerenciamento" */}
            {selectedEventId && fullEvent?.participants && fullEvent.participants.length > 0 && (() => {
              const relevantParticipants = fullEvent.participants!.filter(p => p.confirmed !== false && p.countsForScore !== false);
              return (
                <div className="border-2 border-[#191c1e] bg-white">
                  <button
                    type="button"
                    onClick={() => setTeamPanelOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-[#f2f4f6] border-b-2 border-[#191c1e] hover:bg-[#e8eaec] transition-colors"
                  >
                    <span className="flex items-center gap-2 text-[11px] font-black italic uppercase tracking-wider text-[#444933]">
                      <Users size={14} /> Equipe Alocada <span className="text-[#747a60]">({relevantParticipants.length})</span>
                    </span>
                    {teamPanelOpen ? <ChevronUp size={16} className="text-[#444933] shrink-0" /> : <ChevronDown size={16} className="text-[#444933] shrink-0" />}
                  </button>
                  {teamPanelOpen && (
                    relevantParticipants.length === 0 ? (
                      <div className="py-6 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhum colaborador ativo alocado neste evento.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        {relevantParticipants.map(p => {
                          const realizadasCount = p.actualDiariaDates != null ? p.actualDiariaDates.length : p.actualDiariaCount;
                          return (
                            <div key={p.id} className="border-2 border-[#eceef0] p-3 flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#eceef0] border-2 border-[#191c1e] flex items-center justify-center font-black italic text-[10px] text-[#191c1e] shrink-0">
                                {p.employeeName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black italic uppercase text-xs text-[#191c1e] leading-tight truncate">{p.employeeName}</p>
                                <p className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">{p.functionName}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`px-1.5 py-0.5 border border-[#191c1e] font-bold text-[9px] italic uppercase ${p.employmentType === "freela" ? "bg-[#e0e3e5] text-[#444933]" : "bg-white text-[#191c1e]"}`}>
                                  {p.employmentType === "freela" ? "Freela" : "Casa"}
                                </span>
                                {realizadasCount != null && (
                                  <span className="flex items-center gap-1 text-[9px] font-bold italic uppercase text-[#747a60]">
                                    <Calendar size={9} /> {realizadasCount} diária{realizadasCount === 1 ? "" : "s"}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              );
            })()}

            {/* Painel de Contexto do Evento — conformidade, faltas, destaque, comentários */}
            {selectedEventId && (conformity || (eventComments && eventComments.length > 0)) && (
              <div className="border-2 border-[#191c1e] bg-white">
                <button
                  type="button"
                  onClick={() => setContextOpen(o => !o)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-[#f2f4f6] border-b-2 border-[#191c1e] hover:bg-[#e8eaec] transition-colors"
                >
                  <span className="flex items-center gap-2 text-[11px] font-black italic uppercase tracking-wider text-[#444933]">
                    <ClipboardList size={14} /> Contexto do Evento
                  </span>
                  {contextOpen ? <ChevronUp size={16} className="text-[#444933] shrink-0" /> : <ChevronDown size={16} className="text-[#444933] shrink-0" />}
                </button>
                {contextOpen && (
                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Matriz de Conformidade */}
                    {conformity && (
                      <div>
                        <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-2 flex items-center gap-1.5">
                          <ShieldCheck size={13} /> Matriz de Conformidade
                        </p>
                        <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0]">
                          {[
                            { label: "EPI", key: "epi" as const, comment: conformity.epiComment },
                            { label: "Estaiamentos/Aterramento", key: "estaiamentos" as const, comment: conformity.estaiamentosComment },
                            { label: "Conduta", key: "conduta" as const, comment: conformity.condutaComment },
                            { label: "Guarda de Equipamentos", key: "guardaEquipamentos" as const, comment: conformity.guardaEquipamentosComment },
                          ].map(item => {
                            const ok = (conformity as unknown as Record<string, boolean | null>)[item.key];
                            return (
                              <div key={item.key} className="px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold italic uppercase text-[#191c1e]">{item.label}</span>
                                  <span className={`text-[10px] font-black italic uppercase px-2 py-0.5 border border-[#191c1e] shrink-0 ${ok === null ? "bg-[#d8dadc] text-[#444933]" : ok ? "bg-[#ccff00] text-[#161e00]" : "bg-[#ff5722] text-white"}`}>
                                    {ok === null ? "—" : ok ? "SIM" : "NÃO"}
                                  </span>
                                </div>
                                {item.comment && ok === false && (
                                  <p className="text-[11px] italic text-[#444933] mt-1 leading-snug">{item.comment}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {/* Falta / Atraso — texto livre sempre obrigatório; PENDENTE só se nunca respondido */}
                        <div className={`mt-3 border-2 p-3 ${conformity.absencesReport ? "border-[#b02f00] bg-[#fff4e5]" : "border-[#191c1e]"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60] flex items-center gap-1"><User size={11} /> Faltas/Atrasos (+30 min)</p>
                            <span className={`text-[10px] font-black italic uppercase px-2 py-0.5 border border-[#191c1e] shrink-0 ${conformity.absencesReport ? "bg-[#b02f00] text-white" : "bg-[#d8dadc] text-[#444933]"}`}>
                              {conformity.absencesReport ? "RESPONDIDO" : "PENDENTE"}
                            </span>
                          </div>
                          {conformity.absencesReport && (
                            <p className="text-[11px] italic text-[#191c1e] leading-snug whitespace-pre-wrap mt-1.5">{conformity.absencesReport}</p>
                          )}
                        </div>
                        {/* Destaque — distingue PENDENTE (nunca respondido) de SIM/NÃO explícito */}
                        <div className={`mt-3 border-2 p-3 ${conformity.standoutResponse === true ? "border-[#506600] bg-[#f7ffe0]" : "border-[#191c1e]"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#506600] flex items-center gap-1"><Trophy size={11} /> Destaque de Desempenho</p>
                            <span className={`text-[10px] font-black italic uppercase px-2 py-0.5 border border-[#191c1e] shrink-0 ${conformity.standoutResponse === null ? "bg-[#d8dadc] text-[#444933]" : conformity.standoutResponse ? "bg-[#ccff00] text-[#161e00]" : "bg-[#d8dadc] text-[#444933]"}`}>
                              {conformity.standoutResponse === null ? "PENDENTE" : conformity.standoutResponse ? "SIM" : "NÃO"}
                            </span>
                          </div>
                          {conformity.standoutResponse === true && conformity.standoutJustification && (
                            <p className="text-[11px] italic text-[#191c1e] leading-snug whitespace-pre-wrap mt-1.5">{conformity.standoutJustification}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Comentários do Evento */}
                    {eventComments && eventComments.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-2 flex items-center gap-1.5">
                          <MessageSquare size={13} /> Comentários do Evento <span className="text-[#747a60]">({eventComments.length})</span>
                        </p>
                        <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-48 overflow-y-auto">
                          {eventComments.map((c, i) => (
                            <div key={i} className="px-3 py-2">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="text-[10px] font-bold italic uppercase text-[#747a60]">{(c as { authorName?: string }).authorName ?? "Admin"}</span>
                                <span className="text-[10px] italic text-[#9aa088] shrink-0">{c.createdAt ? formatDateTime(new Date(c.createdAt)) : ""}</span>
                              </div>
                              <p className="text-[11px] italic text-[#191c1e] leading-snug whitespace-pre-wrap">{c.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeCriteria.length === 0 && (
              <div className="bg-white border-2 border-[#191c1e] text-center py-16 italic uppercase font-bold text-[#747a60]">
                Nenhum critério ativo para este evento.
              </div>
            )}

            {alreadyReleased ? (
              <div className="bg-[#191c1e] text-white border-2 border-[#191c1e] p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_#ccff00]">
                <CheckCircle size={20} className="text-[#ccff00] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black italic uppercase tracking-tight leading-tight">Avaliação Final — notas liberadas{feedbackReleasedAtDate ? ` em ${formatDateTime(feedbackReleasedAtDate)}` : ""}</p>
                  <p className="text-[11px] font-bold italic uppercase text-white/60 leading-tight">Os funcionários já veem estas notas. Ajustes ainda são possíveis e recalculam os resultados automaticamente.</p>
                </div>
                {canFinalize && (
                  <button
                    type="button"
                    disabled={unreleasing}
                    onClick={handleUnrelease}
                    title="Desfaz a liberação final — funcionários deixam de ver as notas até nova publicação"
                    className="shrink-0 flex items-center gap-1.5 text-[11px] font-black italic uppercase bg-white/10 text-white border border-white/30 px-3 py-2 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <RotateCcw size={12} /> {unreleasing ? "Revertendo..." : "Reverter"}
                  </button>
                )}
              </div>
            ) : partialPublishedAtDate ? (
              <div className="bg-[#ffb5a0] border-2 border-[#191c1e] p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_#191c1e]">
                <Info size={20} className="text-[#3b0900] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-black italic uppercase tracking-tight text-[#3b0900] leading-tight">Avaliação Parcial — critério mais recente publicado em {formatDateTime(partialPublishedAtDate)}</p>
                  <p className="text-[11px] font-bold italic uppercase text-[#3b0900]/70 leading-tight">Os funcionários veem, para cada critério, a última publicação parcial daquele critério. Publique cada critério individualmente abaixo, ou finalize o evento quando estiver pronto.</p>
                </div>
              </div>
            ) : (
              <div className="bg-[#d8dadc] border-2 border-[#191c1e] p-4 flex items-center gap-3 shadow-[4px_4px_0px_0px_#191c1e]">
                <Info size={20} className="text-[#444933] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-black italic uppercase tracking-tight text-[#191c1e] leading-tight">Ainda não publicada</p>
                  <p className="text-[11px] font-bold italic uppercase text-[#444933] leading-tight">
                    Os funcionários ainda não receberam nenhuma publicação deste evento{alreadyClosed ? " — evento fechado, aguardando liberação" : ""}. Use "Publicar Parcial" em cada critério abaixo para enviar uma prévia a qualquer momento.
                  </p>
                </div>
              </div>
            )}

            {activeCriteria.length > 0 && !alreadyReleased && (
              <div className="sticky top-16 md:top-2 z-20 bg-[#191c1e] text-white border-2 border-[#191c1e] p-4 flex flex-col gap-3 shadow-[6px_6px_0px_0px_#ccff00]">
                {/* Linha 1: info + botões principais */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <SlidersHorizontal size={20} className="text-[#ccff00] shrink-0" />
                    <div className="min-w-0">
                      {readyToFinalize ? (
                        <>
                          <p className="text-sm font-black italic uppercase tracking-tight leading-tight">Todas as calibrações salvas</p>
                          <p className="text-[11px] font-bold italic uppercase text-white/60 leading-tight">
                            Publique as notas (parcial ou final) para os funcionários quando estiver pronto.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-black italic uppercase tracking-tight leading-tight">Salvar todas de uma vez</p>
                          <p className="text-[11px] font-bold italic uppercase text-white/60 leading-tight">
                            {fillableCount > 0 ? `${fillableCount} critério(s) com nota preenchida` : "Preencha as notas calibradas (1 a 10) abaixo"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    {!readyToFinalize && (
                      <button
                        data-testid="button-save-all-cal"
                        type="button"
                        disabled={savingAll || fillableCount === 0}
                        onClick={saveAllCalibrations}
                        className="bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-5 py-3 font-black text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all enabled:hover:bg-white enabled:hover:border-white"
                      >
                        <Save size={16} /> {savingAll ? "Salvando..." : `Salvar Todas${fillableCount > 0 ? ` (${fillableCount})` : ""}`}
                      </button>
                    )}
                    {canFinalize && autoFillableCriteria.length > 0 && (
                      <button
                        data-testid="button-autofill-from-evaluator"
                        type="button"
                        disabled={savingAutoFill || savingAll}
                        onClick={autoFillFromEvaluator}
                        title="Cria calibrações iguais à nota do avaliador para todos os critérios ainda sem calibração"
                        className="bg-[#e0e3e5] text-[#191c1e] border-2 border-[#e0e3e5] px-4 py-3 font-black text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all enabled:hover:bg-white enabled:hover:border-white"
                      >
                        <Check size={16} /> {savingAutoFill ? "Preenchendo..." : `Liberar Sem Calibração (${autoFillableCriteria.length})`}
                      </button>
                    )}
                    {canFinalize && (
                      <button
                        data-testid="button-publish-all-partial"
                        type="button"
                        disabled={publishingAllPartial}
                        onClick={handlePublishAllPartial}
                        className="bg-[#ffb5a0] text-[#3b0900] border-2 border-[#ffb5a0] px-5 py-3 font-black text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all enabled:hover:bg-[#ccff00] enabled:hover:border-[#ccff00]"
                      >
                        <Flag size={16} /> {publishingAllPartial ? "Publicando..." : "Publicar Todos Parcial"}
                      </button>
                    )}
                    {canFinalize && (
                      <button
                        data-testid="button-publish-all-final"
                        type="button"
                        disabled={publishingAllFinal}
                        onClick={handlePublishAllFinal}
                        className="bg-[#506600] text-[#ccff00] border-2 border-[#506600] px-5 py-3 font-black text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all enabled:hover:bg-[#ccff00] enabled:hover:text-[#161e00] enabled:hover:border-[#ccff00]"
                      >
                        <ShieldCheck size={16} /> {publishingAllFinal ? "Publicando..." : "Publicar Todos como Final"}
                      </button>
                    )}
                  </div>
                </div>
                {/* Linha 2: progresso + filtro */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/20">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-bold italic uppercase text-white/70 flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-[#ccff00]" />
                      {finalPublishedCount}/{activeCriteria.length} critério(s) publicados como Final
                    </span>
                    {readyToFinalize && canFinalize && (
                      <button
                        data-testid="button-open-finalize"
                        type="button"
                        onClick={() => setFinalizeOpen(true)}
                        className="text-[10px] font-black italic uppercase text-white/50 underline decoration-dotted underline-offset-2 hover:text-[#ccff00] transition-colors"
                      >
                        {alreadyClosed ? "Liberar Notas (fechamento formal)" : "Fechar Evento e Liberar Notas (fechamento formal)"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Filter size={12} className="text-white/50 shrink-0" />
                    {([
                      { value: "all", label: "Todos" },
                      { value: "uncalibrated", label: "Sem Calibração" },
                      { value: "calibrated", label: "Calibrados" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCriterionFilter(opt.value)}
                        className={`text-[10px] font-black italic uppercase px-2 py-1 border transition-colors ${criterionFilter === opt.value ? "bg-[#ccff00] text-[#161e00] border-[#ccff00]" : "bg-transparent text-white/70 border-white/30 hover:border-white/60"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {filteredActiveCriteria.length === 0 && activeCriteria.length > 0 && (
              <div className="bg-[#d8dadc] border-2 border-[#191c1e] px-5 py-4 text-center">
                <p className="text-sm italic font-bold uppercase text-[#444933]">Nenhum critério para o filtro selecionado.</p>
              </div>
            )}
            {filteredActiveCriteria.map(c => {
              const areaScores = getAreaScores(c.criterionId);
              const avg = getAvgScore(c.criterionId);
              const cal = getCalibration(c.criterionId);
              const calVal = cal ? parseFloat(cal.calibratedScore as unknown as string) : null;
              const finalVal = calVal ?? avg;
              const scoreVal = calScores[c.criterionId] ?? (cal ? String(parseFloat(cal.calibratedScore as unknown as string)) : "");
              const reasonVal = calReasons[c.criterionId] ?? (cal?.calibrationReason ?? "");
              const isSaving = savingCritId === c.criterionId && createMutation.isPending;
              const isCollapsed = collapsedCriteria.has(c.criterionId);
              const isFinalPublished = !!c.finalPublishedAt;

              return (
                <article key={c.criterionId} data-testid={`row-cal-${c.criterionId}`} className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                  {/* Criterion header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                    <div className="min-w-0 flex items-center gap-2">
                      <button
                        data-testid={`button-toggle-collapse-${c.criterionId}`}
                        type="button"
                        onClick={() => toggleCriterionCollapsed(c.criterionId)}
                        title={isCollapsed ? "Expandir critério" : "Recolher critério"}
                        className="shrink-0 h-6 w-6 flex items-center justify-center border-2 border-[#191c1e] bg-white hover:bg-[#191c1e] hover:text-white transition-colors"
                      >
                        {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                      </button>
                      <div className="min-w-0">
                      <div className="font-black italic uppercase tracking-tight text-[#191c1e]">{c.criterionName}</div>
                      {canEditWeights ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] font-bold italic uppercase text-[#747a60]">Peso</span>
                          <input
                            data-testid={`input-weight-${c.criterionId}`}
                            type="text"
                            inputMode="decimal"
                            value={weightEdits[c.criterionId] ?? String(c.weightOverride ?? c.originalWeight ?? 0)}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9.,]/g, "");
                              setWeightEdits(prev => ({ ...prev, [c.criterionId]: val }));
                            }}
                            className="h-7 w-16 px-2 border-2 border-[#191c1e] text-sm font-black italic bg-white focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                          />
                          {weightEdits[c.criterionId] != null && Number(weightEdits[c.criterionId].replace(",", ".")) !== Number(c.weightOverride ?? c.originalWeight ?? 0) && (
                            <button
                              data-testid={`button-save-weight-${c.criterionId}`}
                              type="button"
                              disabled={savingWeightId === c.criterionId && updateWeightMutation.isPending}
                              onClick={() => saveWeight(c.criterionId, c.active)}
                              className="h-7 px-2.5 bg-[#ccff00] border-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wider disabled:opacity-50 hover:bg-[#191c1e] hover:text-[#ccff00] transition-colors"
                            >
                              {savingWeightId === c.criterionId && updateWeightMutation.isPending ? "..." : "Salvar peso"}
                            </button>
                          )}
                          {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && (
                            <span className="text-[9px] font-black italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-1.5 py-0.5">Não conta na média</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-bold italic uppercase text-[#747a60]">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
                          {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && (
                            <span className="text-[9px] font-black italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-1.5 py-0.5">Não conta na média</span>
                          )}
                        </div>
                      )}
                      </div>
                      {isCollapsed && (
                        <span
                          data-testid={`badge-collapsed-score-${c.criterionId}`}
                          className={`inline-flex items-center gap-1.5 text-xs font-black italic border-2 border-[#191c1e] px-2 py-1 ${calVal != null ? "bg-[#506600] text-[#ccff00]" : "bg-white text-[#191c1e]"}`}
                        >
                          <span className={`text-[10px] font-bold uppercase not-italic ${calVal != null ? "text-[#ccff00]/70" : "text-[#747a60]"}`}>
                            {calVal != null ? "Nota Calibrada" : avg != null ? "Nota Avaliador" : "Nota"}
                          </span>
                          {finalVal != null ? finalVal.toFixed(2) : "—"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {c.responsibleAreaName && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-1 skew-x-[-6deg]">
                          <span className="inline-flex items-center gap-1.5 skew-x-[6deg]"><Building2 size={12} /> {c.responsibleAreaName}</span>
                        </span>
                      )}
                      {cal ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1">
                          <CheckCircle size={12} /> Calibrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border-2 border-[#191c1e] px-2 py-1">
                          {avg != null ? "Pendente" : "Sem nota da área"}
                        </span>
                      )}
                      {!alreadyReleased && isFinalPublished && (
                        <span
                          data-testid={`badge-criterion-final-${c.criterionId}`}
                          title={`Final publicado em ${formatDateTime(new Date(c.finalPublishedAt!))}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1"
                        >
                          <ShieldCheck size={12} /> Final · {formatDateTime(new Date(c.finalPublishedAt!))}
                        </span>
                      )}
                      {!alreadyReleased && c.partialPublishedAt && !isFinalPublished && (
                        <span
                          data-testid={`badge-criterion-partial-${c.criterionId}`}
                          title={`Publicado em ${formatDateTime(new Date(c.partialPublishedAt))}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border-2 border-[#191c1e] px-2 py-1"
                        >
                          <Send size={12} /> Parcial · {formatDateTime(new Date(c.partialPublishedAt))}
                        </span>
                      )}
                      {canFinalize && !alreadyReleased && (
                        <button
                          data-testid={`button-publish-criterion-partial-${c.criterionId}`}
                          type="button"
                          disabled={publishingCritId === c.criterionId && publishCriterionPartialMutation.isPending}
                          onClick={() => handlePublishCriterionPartial(c.criterionId)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-black italic uppercase bg-white text-[#191c1e] border-2 border-[#191c1e] px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all enabled:hover:bg-[#191c1e] enabled:hover:text-white"
                        >
                          <Send size={12} /> {publishingCritId === c.criterionId && publishCriterionPartialMutation.isPending ? "Publicando..." : "Publicar Parcial"}
                        </button>
                      )}
                      {canFinalize && !alreadyReleased && (
                        <button
                          data-testid={`button-publish-criterion-final-${c.criterionId}`}
                          type="button"
                          disabled={publishingFinalCritId === c.criterionId && publishCriterionFinalMutation.isPending}
                          onClick={() => handlePublishCriterionFinal(c.criterionId)}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-black italic uppercase border-2 border-[#191c1e] px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${isFinalPublished ? "bg-[#506600] text-[#ccff00] enabled:hover:bg-[#ccff00] enabled:hover:text-[#161e00]" : "bg-[#191c1e] text-[#ccff00] enabled:hover:bg-[#506600]"}`}
                        >
                          <ShieldCheck size={12} /> {publishingFinalCritId === c.criterionId && publishCriterionFinalMutation.isPending ? "Publicando..." : isFinalPublished ? "Republicar Final" : "Publicar Final"}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-[#191c1e]">
                    {/* Left: scores from the area */}
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-1.5">
                        <Building2 size={13} /> Notas da Área
                      </p>
                      {areaScores.length > 0 ? (
                        <>
                          <div className="flex flex-col gap-2">
                            {areaScores.map((s, i) => (
                              <div key={i} className="border-2 border-[#191c1e] bg-white max-w-full">
                                <div className="flex items-center justify-between gap-2 px-2.5 py-1">
                                  <span className="text-[11px] font-bold italic uppercase text-[#444933] break-words min-w-0">{s.name}</span>
                                  <span className="text-sm font-black italic text-[#191c1e] bg-[#eceef0] border-l-2 border-[#191c1e] px-2 leading-6 shrink-0">{s.score.toFixed(1)}</span>
                                </div>
                                {s.comment ? (
                                  <p className="text-[11px] italic text-[#444933] border-t-2 border-[#eceef0] px-2.5 py-1.5 leading-snug whitespace-pre-wrap break-words">
                                    <span className="font-bold uppercase text-[#747a60] not-italic">Justificativa: </span>{s.comment}
                                  </p>
                                ) : (
                                  <p className="text-[10px] italic text-[#9aa088] border-t-2 border-[#eceef0] px-2.5 py-1.5">Sem justificativa</p>
                                )}
                                {s.audioUrl && (
                                  <div className="border-t-2 border-[#eceef0] px-2.5 py-1.5">
                                    <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60] mb-1">Áudio</p>
                                    <AudioPlayer objectPath={s.audioUrl} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex items-baseline gap-3">
                            <span className="text-[11px] font-bold uppercase italic tracking-wider text-[#747a60]">Nota Avaliador</span>
                            <span className={`text-2xl font-black italic ${cal ? "text-[#c4c9ac] line-through" : "text-[#191c1e]"}`}>{avg?.toFixed(2)}</span>
                            {cal && (
                              <>
                                <span className="text-sm font-bold italic text-[#747a60]">→</span>
                                <span className="text-2xl font-black italic text-[#ff5722]">{parseFloat(cal.calibratedScore as unknown as string).toFixed(2)}</span>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm italic text-[#747a60] font-bold uppercase">Nenhuma nota enviada pela área para este critério.</p>
                      )}
                    </div>

                    {/* Right: inline calibration */}
                    <div className="p-5 bg-[#fbfcfd]">
                      <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-1.5">
                        <SlidersHorizontal size={13} /> Calibração
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                        <div className="sm:w-28 shrink-0">
                          <Label className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Nota (1–10)</Label>
                          <input
                            data-testid={`input-cal-score-${c.criterionId}`}
                            type="text"
                            inputMode="numeric"
                            value={scoreVal}
                            onChange={e => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              setCalScores(prev => ({ ...prev, [c.criterionId]: val }));
                            }}
                            placeholder="—"
                            className="h-11 mt-1 w-full px-3 border-2 border-[#191c1e] text-lg font-black italic disabled:opacity-60 disabled:bg-[#eceef0] focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:ring-offset-2 focus:ring-offset-[#fbfcfd]"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Justificativa</Label>
                          <Textarea
                            data-testid={`input-cal-reason-${c.criterionId}`}
                            value={reasonVal}
                            onChange={e => setCalReasons(prev => ({ ...prev, [c.criterionId]: e.target.value }))}
                            placeholder="Por que a nota original foi alterada?"
                            rows={2}
                            className="mt-1 rounded-none border-2 border-[#191c1e] resize-none disabled:opacity-60 disabled:bg-[#eceef0]"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <button
                          data-testid={`button-save-cal-${c.criterionId}`}
                          type="button"
                          disabled={isSaving || savingAll}
                          onClick={() => saveCalibration(c.criterionId)}
                          className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} transition-all enabled:hover:shadow-[2px_2px_0px_0px_#191c1e] enabled:hover:translate-x-[2px] enabled:hover:translate-y-[2px]`}
                        >
                          <Save size={16} /> {isSaving ? "Salvando..." : cal ? "Atualizar Calibração" : "Salvar Calibração"}
                        </button>
                      </div>
                      {cal && (
                        <div className="mt-3 text-xs italic text-[#444933] bg-[#f2f4f6] border-l-4 border-[#ff5722] p-3 relative">
                          <AlertCircle size={12} className="text-[#ff5722] absolute top-2 right-2" />
                          <span className="block pr-4">Calibração atual: <strong className="not-italic">{parseFloat(cal.calibratedScore as unknown as string).toFixed(2)}</strong>{cal.calibratedByName ? ` · por ${cal.calibratedByName}` : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </article>
              );
            })}

            {/* Finalização — aparece apenas quando todas as calibrações estão salvas */}
            {scoredCriteria.length > 0 && (
              alreadyReleased ? (
                <div className="bg-[#506600] text-[#ccff00] border-2 border-[#191c1e] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[6px_6px_0px_0px_#191c1e]">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle size={26} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-base font-black italic uppercase tracking-tight leading-tight">Avaliação Final — evento finalizado</p>
                      <p className="text-xs font-bold italic uppercase text-[#ccff00]/70 leading-tight">As notas já foram liberadas para os funcionários. Qualquer recalibração acima é aplicada imediatamente.</p>
                    </div>
                  </div>
                  <button
                    data-testid="button-save-all-cal-released"
                    type="button"
                    disabled={savingAll || fillableCount === 0}
                    onClick={saveAllCalibrations}
                    className="bg-[#ccff00] text-[#161e00] border-2 border-[#161e00] px-5 py-3 font-black text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-all enabled:hover:bg-white"
                  >
                    <Save size={16} /> {savingAll ? "Salvando..." : `Salvar Ajustes${fillableCount > 0 ? ` (${fillableCount})` : ""}`}
                  </button>
                </div>
              ) : readyToFinalize ? (
                <div className="bg-[#191c1e] text-white border-2 border-[#191c1e] p-5 flex items-center gap-3 shadow-[6px_6px_0px_0px_#ccff00]">
                  <CheckCircle size={26} className="text-[#ccff00] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-base font-black italic uppercase tracking-tight leading-tight">Todas as calibrações salvas</p>
                    <p className="text-xs font-bold italic uppercase text-white/60 leading-tight">Publique as notas (parcial ou final) para os funcionários quando estiver pronto.</p>
                  </div>
                </div>
              ) : allCalibrated && !evaluationsComplete ? (
                <div className="bg-white border-2 border-[#191c1e] p-5 flex items-center gap-3 text-[#444933]">
                  <AlertTriangle size={20} className="shrink-0 text-[#ff5722]" />
                  <p className="text-xs font-bold italic uppercase tracking-wide leading-tight">
                    Calibrações concluídas, mas ainda há avaliações pendentes. O evento só pode ser fechado após todas as avaliações serem enviadas.
                  </p>
                </div>
              ) : allCalibrated && !canFinalize ? (
                <div className="bg-white border-2 border-dashed border-[#191c1e] p-5 flex items-center gap-3 text-[#444933]">
                  <Lock size={20} className="shrink-0 text-[#747a60]" />
                  <p className="text-xs font-bold italic uppercase tracking-wide leading-tight">
                    Calibrações concluídas. O fechamento do evento é feito pela diretoria ou pelo RH.
                  </p>
                </div>
              ) : (
                <div className="bg-white border-2 border-dashed border-[#191c1e] p-5 flex items-center gap-3 text-[#444933]">
                  <Info size={20} className="shrink-0 text-[#747a60]" />
                  <p className="text-xs font-bold italic uppercase tracking-wide leading-tight">
                    Calibre todos os critérios para liberar o fechamento do evento.
                  </p>
                </div>
              )
            )}
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white border-2 border-dashed border-[#191c1e]">
            <div className="w-16 h-16 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#eceef0] flex items-center justify-center mb-5">
              <span className="skew-x-[4deg]"><Target className="text-[#747a60]" size={32} /></span>
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight mb-2 text-[#191c1e]">Área de Calibração</h2>
            <p className="text-[#747a60] italic max-w-md">Selecione um evento no campo acima para visualizar as notas da área e calibrar cada critério diretamente.</p>
          </div>
        )}
      </div>

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
