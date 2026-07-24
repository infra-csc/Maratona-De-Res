import { useState, useEffect, useRef } from "react";
import { useGetEvents, useGetEvent, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useCreateCalibration, useGetEventFeedback, usePublishCriterionPartialFeedback, usePublishCriterionFinalFeedback, usePublishAllCriteriaFinalFeedback, usePublishAllCriteriaPartialFeedback, useUpdateEventCriteria, useGetEventConformity, useSetEventConformity, useGetEventComments, useGetReviewRequests, useGetCurrentCycle, getGetCalibrationsQueryKey, getGetEventsQueryKey, getGetEventQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Target, AlertCircle, Building2, SlidersHorizontal, ChevronsUpDown, ChevronDown, ChevronUp, Check, Save, CheckCircle, Trophy, Flag, Send, ExternalLink, Filter, ShieldCheck, X, MessageSquare, User, Users, Calendar, Copy, Clock } from "lucide-react";
import { getAuthToken } from "@/lib/custom-fetch";
import { cn, formatEventSubtitle } from "@/lib/utils";
import { CONDENSED, BODY, WARNING, usePremiumTheme } from "@/lib/premium-theme";

const GOOD = "#9ab000";
const AMBER = "#e8a23d";

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

// Badge do seletor de eventos: prioridade pub. final > pub. parcial > calibrado > fechado > em avaliação > aguardando.
// Eventos históricos e fechados sem calibração mostram "Fechado"; demais mostram o estado real.
function calibrationEventChip(ev: {
  isHistorical?: boolean;
  feedbackReleased?: boolean;
  partialPublishedAt?: string | null;
  finalCalibratedCriteria?: number | null;
  calibratedCriteriaCount?: number | null;
  status?: string;
  evaluatedCriteria?: number | null;
}): { label: string; bg: string; fg: string } {
  if (ev.feedbackReleased) return { label: "Pub. Final", bg: "rgba(154,176,0,0.14)", fg: GOOD };
  if (ev.partialPublishedAt || (ev.finalCalibratedCriteria ?? 0) > 0)
    return { label: "Pub. Parcial", bg: "rgba(232,162,61,0.14)", fg: AMBER };
  if ((ev.calibratedCriteriaCount ?? 0) > 0)
    return { label: "Calibrado", bg: "rgba(91,141,239,0.14)", fg: "#5b8def" };
  if (ev.status === "closed" || ev.isHistorical)
    return { label: "Fechado", bg: "var(--secondary)", fg: "var(--muted-foreground)" };
  if ((ev.evaluatedCriteria ?? 0) > 0)
    return { label: "Em Avaliação", bg: "rgba(154,176,0,0.14)", fg: GOOD };
  return { label: "Aguardando", bg: "var(--secondary)", fg: "var(--muted-foreground)" };
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

export default function CalibrationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isDark } = usePremiumTheme();
  const canFinalize = ["admin", "rh", "diretoria"].includes(user?.role ?? "");

  const pk = isDark
    ? {
        bg: "#0f0f0f",
        card: "#161616",
        border: "rgba(255,255,255,0.12)",
        text: "#f0ede8",
        muted: "rgba(255,255,255,0.35)",
        activeBg: "#ccff00",
        activeFg: "#0f0f0f",
        itemSel: "#1a1a1a",
        itemBorder: "rgba(255,255,255,0.07)",
        shadow: "6px 6px 0 #ccff00",
        chipBorder: "rgba(255,255,255,0.20)",
        chipText: "rgba(255,255,255,0.45)",
        searchBorder: "rgba(255,255,255,0.10)",
      }
    : {
        bg: "#ffffff",
        card: "#f5f4ef",
        border: "rgba(0,0,0,0.14)",
        text: "#111111",
        muted: "rgba(0,0,0,0.40)",
        activeBg: "#111111",
        activeFg: "#ffffff",
        itemSel: "#f0efe9",
        itemBorder: "rgba(0,0,0,0.07)",
        shadow: "6px 6px 0 rgba(0,0,0,0.15)",
        chipBorder: "rgba(0,0,0,0.20)",
        chipText: "rgba(0,0,0,0.50)",
        searchBorder: "rgba(0,0,0,0.10)",
      };
  const qc = useQueryClient();
  const search = useSearch();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventIdFromUrlApplied, setEventIdFromUrlApplied] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "pending" | "inProgress" | "done">("all");
  const [eventSearchText, setEventSearchText] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [calScores, setCalScores] = useState<Record<number, string>>({});
  const [calReasons, setCalReasons] = useState<Record<number, string>>({});
  const [savedReasonIds, setSavedReasonIds] = useState<Set<number>>(new Set());
  const [savingCritId, setSavingCritId] = useState<number | null>(null);
  const [weightEdits, setWeightEdits] = useState<Record<number, string>>({});
  const [savingWeightId, setSavingWeightId] = useState<number | null>(null);
  const [collapsedCriteria, setCollapsedCriteria] = useState<Set<number>>(new Set());
  const collapsedInitializedForEventId = useRef<number | null>(null);
  const [publishingFinalCritId, setPublishingFinalCritId] = useState<number | null>(null);
  const [publishingAllFinal, setPublishingAllFinal] = useState(false);
  const [publishingAllPartial, setPublishingAllPartial] = useState(false);
  // Intenção de publicação por critério: "partial" | "final"
  const [publishIntents, setPublishIntents] = useState<Record<number, "partial" | "final">>({});
  const [publishingAll, setPublishingAll] = useState(false);
  const [criterionFilter, setCriterionFilter] = useState<"all" | "uncalibrated" | "calibrated">("all");
  const [contextOpen, setContextOpen] = useState(false);
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
    const hasPub    = !!(e as unknown as Record<string, unknown>).partialPublishedAt || !!e.feedbackReleased || (e.finalCalibratedCriteria ?? 0) > 0;
    const matchStatus = eventStatusFilter === "all"
      || (eventStatusFilter === "pending"     && evalCount === 0 && calCount === 0)
      || (eventStatusFilter === "inProgress"  && !!e.criteriaConfirmed && (evalCount > 0 || calCount > 0))
      || (eventStatusFilter === "done"        && (e.status === "closed" || (total > 0 && evalCount >= total) || hasPub));
    const matchDate = (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom) && (!filterDateTo || (e.startDate ?? "") <= filterDateTo);
    const q = eventSearchText.trim().toLowerCase();
    const matchText = !q || [e.name, e.clientName, e.city, e.state].some(v => v?.toLowerCase().includes(q));
    return matchStatus && matchDate && matchText;
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

  const fbQKey = ["event-feedback", selectedEventId] as unknown[];
  const { data: feedback } = useGetEventFeedback(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: fbQKey },
  });

  const [publishingCritId, setPublishingCritId] = useState<number | null>(null);
  const publishCriterionPartialMutation = usePublishCriterionPartialFeedback();
  const publishCriterionFinalMutation = usePublishCriterionFinalFeedback();
  const publishAllFinalMutation = usePublishAllCriteriaFinalFeedback();
  const publishAllPartialMutation = usePublishAllCriteriaPartialFeedback();

  // Conformidade
  const { data: conformity } = useGetEventConformity(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["conformity", selectedEventId] as unknown[] },
  });
  const setConformityMutation = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["conformity", selectedEventId] });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      },
    },
  });
  const [conformityForm, setConformityForm] = useState<{
    epi: boolean | null; estaiamentos: boolean | null; guardaEquipamentos: boolean | null; conduta: boolean | null;
    epiComment: string; estaiamentosComment: string; guardaEquipamentosComment: string; condutaComment: string;
    absencesReport: string; standoutResponse: boolean | null; standoutJustification: string;
  }>({ epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null, epiComment: "", estaiamentosComment: "", guardaEquipamentosComment: "", condutaComment: "", absencesReport: "", standoutResponse: null, standoutJustification: "" });
  const [conformityExpandedComments, setConformityExpandedComments] = useState<Set<string>>(new Set());
  const canManageConformity = ["admin", "rh", "diretoria"].includes(user?.role ?? "")
    || !!(user && fullEvent && (user.id === (fullEvent as unknown as Record<string, unknown>).conformityEvaluatorUserId))
    || !!(user && fullEvent && (user.id === (fullEvent as unknown as Record<string, unknown>).conformityEvaluatorFerramentasUserId));
  useEffect(() => {
    setConformityExpandedComments(new Set());
    if (conformity) {
      setConformityForm({
        epi: conformity.epi ?? null,
        estaiamentos: conformity.estaiamentos ?? null,
        guardaEquipamentos: conformity.guardaEquipamentos ?? null,
        conduta: conformity.conduta ?? null,
        epiComment: conformity.epiComment ?? "",
        estaiamentosComment: conformity.estaiamentosComment ?? "",
        guardaEquipamentosComment: conformity.guardaEquipamentosComment ?? "",
        condutaComment: conformity.condutaComment ?? "",
        absencesReport: (conformity as unknown as Record<string, unknown>).absencesReport as string ?? "",
        standoutResponse: (conformity as unknown as Record<string, unknown>).standoutResponse as boolean | null ?? null,
        standoutJustification: (conformity as unknown as Record<string, unknown>).standoutJustification as string ?? "",
      });
    } else {
      setConformityForm({ epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null, epiComment: "", estaiamentosComment: "", guardaEquipamentosComment: "", condutaComment: "", absencesReport: "", standoutResponse: null, standoutJustification: "" });
    }
  }, [conformity, selectedEventId]);

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
      const count = (result as { published?: number })?.published ?? displayActiveCriteria.length;
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
      const count = (result as { published?: number })?.published ?? displayActiveCriteria.length;
      toast({ title: `${count} critério(s) publicados como Parcial`, description: "Os funcionários veem uma prévia de todas as notas." });
    } catch (e) {
      const msg = (e as { message?: string })?.message;
      toast({ title: "Erro ao publicar todos como Parcial", description: msg, variant: "destructive" });
    } finally {
      setPublishingAllPartial(false);
    }
  }

  // Publica todos os critérios calibrados de acordo com a intenção definida por critério
  async function handlePublishAll() {
    if (!selectedEventId) return;
    // Inclui critérios inativos-mas-calibrados: eles aparecem na tela com o
    // toggle Parc./Final, então o Publicar deve poder aplicar o status neles
    // também (o backend permite publicar critério inativo já calibrado).
    const calibrated = displayActiveCriteria.filter(c => getCalibration(c.criterionId) != null);
    if (calibrated.length === 0) {
      toast({ title: "Nenhum critério calibrado para publicar", description: "Salve ao menos uma nota calibrada antes de publicar.", variant: "destructive" });
      return;
    }
    setPublishingAll(true);
    let okFinal = 0, okPartial = 0;
    const failed: number[] = [];
    let firstError: string | null = null;
    for (const c of calibrated) {
      const intent = publishIntents[c.criterionId] ?? "partial";
      try {
        if (intent === "final") {
          await publishCriterionFinalMutation.mutateAsync({ id: selectedEventId, criterionId: c.criterionId });
          okFinal++;
        } else {
          await publishCriterionPartialMutation.mutateAsync({ id: selectedEventId, criterionId: c.criterionId });
          okPartial++;
        }
      } catch (e) {
        failed.push(c.criterionId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }
    setPublishingAll(false);
    qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
    qc.invalidateQueries({ queryKey: fbQKey });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    if (failed.length === 0) {
      const parts: string[] = [];
      if (okFinal > 0) parts.push(`${okFinal} Final`);
      if (okPartial > 0) parts.push(`${okPartial} Parcial`);
      toast({ title: `Publicado — ${parts.join(", ")}` });
    } else {
      toast({ title: `${okFinal + okPartial} publicado(s), ${failed.length} com erro`, description: firstError ?? undefined, variant: "destructive" });
    }
  }

  function getAreaScores(critId: number) {
    // Inclui avaliações dos critérios eventScoped "filhos" (cópias duplicadas
    // ligadas a este critério). O map é calculado abaixo após activeCriteria.
    const children = childCriterionIdsMap.get(critId) ?? [];
    const allIds = [critId, ...children];
    return (evaluations ?? [])
      .filter(e => allIds.includes(e.criterionId) && e.status === "submitted")
      .map(e => {
        const crit = activeCriteria.find(ac => ac.criterionId === e.criterionId);
        const respondedRaw = e.submittedAt ?? e.createdAt ?? null;
        return { name: e.evaluatorName ?? "Avaliador", score: parseFloat(e.score as unknown as string), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null, areaName: crit?.responsibleAreaName ?? null, isChild: e.criterionId !== critId, respondedAt: respondedRaw ? new Date(respondedRaw as unknown as string) : null };
      });
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
    // Propaga a mesma nota calibrada para critérios filhos (cópias eventScoped)
    const children = childCriterionIdsMap.get(critId) ?? [];
    children.forEach(childId => {
      createMutation.mutate({
        data: {
          eventId: selectedEventId!,
          criterionId: childId,
          calibratedScore: score,
          calibrationReason: reason,
          originalAverageScore: avg ?? undefined,
        },
      });
    });
  }

  // Inclui critérios com calibração salva mesmo se ec_active=F (foram calibrados antes de serem desativados no evento).
  const calibratedCriterionIds = new Set((calibrations ?? []).filter(c => c.calibratedScore != null).map(c => c.criterionId));
  const activeCriteria = (criteria ?? [])
    .filter(c => c.active || calibratedCriterionIds.has(c.criterionId))
    .sort((a, b) => a.criterionId - b.criterionId);

  // Mapa: criterionId → [IDs dos critérios eventScoped que têm este como fonte].
  // Permite fundir avaliações de duplicatas ("Qualidade de Entrega" + "(2)")
  // numa única linha na tabela de calibrações.
  const childCriterionIdsMap = new Map<number, number[]>();
  activeCriteria.forEach(c => {
    if (c.eventScoped && c.sourceCriterionId != null) {
      const arr = childCriterionIdsMap.get(c.sourceCriterionId) ?? [];
      arr.push(c.criterionId);
      childCriterionIdsMap.set(c.sourceCriterionId, arr);
    }
  });
  // Conjunto de IDs de critérios "filhos" — ocultos da tabela (fundidos no pai)
  const childCriterionIdSet = new Set<number>(
    activeCriteria.filter(c => c.eventScoped && c.sourceCriterionId != null).map(c => c.criterionId)
  );
  // Lista de exibição: exclui os filhos (suas notas aparecem na linha do pai)
  const displayActiveCriteria = activeCriteria.filter(c => !childCriterionIdSet.has(c.criterionId));

  // Inicializa publishIntents quando o evento muda ou quando os critérios carregam.
  // DEVE ficar APÓS a declaração de displayActiveCriteria para evitar TDZ em produção.
  useEffect(() => { setPublishIntents({}); setCriterionFilter("all"); }, [selectedEventId]);
  useEffect(() => {
    if (!displayActiveCriteria.length) return;
    setPublishIntents(prev => {
      const next = { ...prev };
      for (const c of displayActiveCriteria) {
        if (next[c.criterionId] === undefined) {
          next[c.criterionId] = c.finalPublishedAt ? "final" : "partial";
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayActiveCriteria.map(c => c.criterionId).join(",")]);

  // Todo critério ativo sem calibração conta como pendente — mesmo os que ainda
  // não receberam nota da área (a calibração pode preencher a lacuna).
  const pendingCount = selectedEventId
    ? displayActiveCriteria.filter(c => !getCalibration(c.criterionId)).length
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
  const fillableCount = displayActiveCriteria.filter(c => pendingScore(c.criterionId) != null).length;

  // Critérios com peso > 0 (únicos que entram nos contadores de calibração)
  const scorableActiveCriteria = displayActiveCriteria.filter(c => Number(c.weightOverride ?? c.originalWeight ?? 0) > 0);

  // Pendências para o "Salvar Tudo": comentários isolados (critério já calibrado
  // mas com razão editada localmente sem nova nota) + pesos editados.
  const pendingReasonOnlyCrits = displayActiveCriteria.filter(c => {
    if (pendingScore(c.criterionId) != null) return false; // já coberto pelo fillableCount
    const localReason = calReasons[c.criterionId];
    if (localReason === undefined) return false;
    const existing = getCalibration(c.criterionId);
    if (!existing) return false; // sem calibração existente, não há score para reusar
    return localReason.trim() !== (existing.calibrationReason ?? "").trim();
  });
  const pendingWeightCritIds = Object.keys(weightEdits).map(Number).filter(id => {
    const raw = (weightEdits[id] ?? "").replace(",", ".").trim();
    return raw !== "" && !isNaN(Number(raw)) && Number(raw) >= 0;
  });

  // Critérios cuja intenção de publicação (toggle Parc./Final) diverge do estado
  // JÁ publicado no servidor — cada divergência é uma mudança de status pendente
  // que o "Salvar" deve aplicar (publicar/rebaixar), não só as edições de nota.
  // Só conta critérios calibrados (sem calibração não há o que publicar).
  const pendingPublishCritIds = displayActiveCriteria.filter(c => {
    if (!getCalibration(c.criterionId)) return false;
    const intent = publishIntents[c.criterionId];
    if (intent === undefined) return false;
    const baseline = c.finalPublishedAt ? "final" : "partial";
    return intent !== baseline;
  }).map(c => c.criterionId);

  const totalDirtyCount = fillableCount + pendingReasonOnlyCrits.length + pendingWeightCritIds.length + pendingPublishCritIds.length;

  // Quantos critérios já publicados como Final
  const finalPublishedCount = scorableActiveCriteria.filter(c => !!c.finalPublishedAt).length;
  const allCriteriaFinalPublished = scorableActiveCriteria.length > 0 && finalPublishedCount === scorableActiveCriteria.length;

  // Critérios filtrados por criterionFilter
  const filteredActiveCriteria = criterionFilter === "uncalibrated"
    ? displayActiveCriteria.filter(c => !getCalibration(c.criterionId))
    : criterionFilter === "calibrated"
    ? displayActiveCriteria.filter(c => !!getCalibration(c.criterionId))
    : displayActiveCriteria;

  const scoredCriteria = displayActiveCriteria.filter(c => getAvgScore(c.criterionId) != null);
  const alreadyReleased = !!feedback?.feedbackReleased;
  const feedbackReleasedAtDate = feedback?.feedbackReleasedAt ? new Date(feedback.feedbackReleasedAt) : null;
  const partialPublishedAtDate = feedback?.partialPublishedAt ? new Date(feedback.partialPublishedAt) : null;

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
    // Salva apenas critérios de exibição (pais); os filhos são propagados abaixo.
    const toSave = displayActiveCriteria
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
        // Propaga para critérios filhos (eventScoped) com a mesma nota
        const children = childCriterionIdsMap.get(x.critId) ?? [];
        for (const childId of children) {
          await bulkMutation.mutateAsync({
            data: {
              eventId: selectedEventId!,
              criterionId: childId,
              calibratedScore: x.score,
              calibrationReason: x.reason,
              originalAverageScore: getAvgScore(x.critId) ?? undefined,
            },
          });
        }
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

  // Salva TUDO de uma vez: calibrações com nota nova, comentários pendentes em
  // calibrações já salvas, e edições de peso.
  async function handleSaveAll() {
    if (totalDirtyCount === 0) return;
    setSavingAll(true);
    let okCal = 0, okWeight = 0;
    const failedCal: number[] = [], failedWeight: number[] = [];
    let firstError: string | null = null;
    const allWarnings: string[] = [];

    // 1. Calibrações com nota nova (+ comentário)
    const toSaveScores = displayActiveCriteria
      .map(c => ({ critId: c.criterionId, score: pendingScore(c.criterionId), reason: (calReasons[c.criterionId] ?? getCalibration(c.criterionId)?.calibrationReason ?? "").trim() }))
      .filter((x): x is { critId: number; score: number; reason: string } => x.score != null);
    for (const x of toSaveScores) {
      try {
        const result = await bulkMutation.mutateAsync({
          data: { eventId: selectedEventId!, criterionId: x.critId, calibratedScore: x.score, calibrationReason: x.reason, originalAverageScore: getAvgScore(x.critId) ?? undefined },
        });
        if (result.warnings) allWarnings.push(...result.warnings);
        okCal++;
        for (const childId of (childCriterionIdsMap.get(x.critId) ?? [])) {
          await bulkMutation.mutateAsync({ data: { eventId: selectedEventId!, criterionId: childId, calibratedScore: x.score, calibrationReason: x.reason, originalAverageScore: getAvgScore(x.critId) ?? undefined } });
        }
      } catch (e) {
        failedCal.push(x.critId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }

    // 2. Comentários pendentes em calibrações já salvas (sem nova nota)
    for (const c of pendingReasonOnlyCrits) {
      const existing = getCalibration(c.criterionId);
      if (!existing) continue;
      const score = parseFloat(existing.calibratedScore as unknown as string);
      const reason = (calReasons[c.criterionId] ?? "").trim();
      try {
        await bulkMutation.mutateAsync({
          data: { eventId: selectedEventId!, criterionId: c.criterionId, calibratedScore: score, calibrationReason: reason, originalAverageScore: getAvgScore(c.criterionId) ?? undefined },
        });
        okCal++;
      } catch (e) {
        failedCal.push(c.criterionId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }

    // 3. Pesos editados
    for (const critId of pendingWeightCritIds) {
      const raw = (weightEdits[critId] ?? "").replace(",", ".").trim();
      const w = Number(raw);
      const crit = displayActiveCriteria.find(c => c.criterionId === critId);
      if (!crit || isNaN(w)) continue;
      try {
        await updateWeightMutation.mutateAsync({ id: selectedEventId!, data: { criteria: [{ criterionId: critId, active: crit.active ?? true, weight: w }] } });
        okWeight++;
        setWeightEdits(prev => { const n = { ...prev }; delete n[critId]; return n; });
      } catch (e) {
        failedWeight.push(critId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }

    // 4. Mudanças de status (Parc./Final) — publica/rebaixa cada critério cuja
    // intenção diverge do que já está publicado no servidor.
    let okPublish = 0;
    const failedPublish: number[] = [];
    for (const critId of pendingPublishCritIds) {
      const intent = publishIntents[critId];
      try {
        if (intent === "final") {
          await publishCriterionFinalMutation.mutateAsync({ id: selectedEventId!, criterionId: critId });
        } else {
          await publishCriterionPartialMutation.mutateAsync({ id: selectedEventId!, criterionId: critId });
        }
        okPublish++;
      } catch (e) {
        failedPublish.push(critId);
        if (!firstError) firstError = (e as { message?: string })?.message ?? null;
      }
    }

    setSavingAll(false);
    const totalOk = okCal + okWeight + okPublish;
    const totalFailed = failedCal.length + failedWeight.length + failedPublish.length;

    if (failedCal.length === 0) {
      setCalScores({});
      setCalReasons({});
    } else {
      const savedIds = [...toSaveScores.filter(x => !failedCal.includes(x.critId)).map(x => x.critId), ...pendingReasonOnlyCrits.filter(c => !failedCal.includes(c.criterionId)).map(c => c.criterionId)];
      setCalScores(prev => { const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n; });
      setCalReasons(prev => { const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n; });
    }

    qc.invalidateQueries({ queryKey: calQKey });
    qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: fbQKey });

    const uniqueWarnings = Array.from(new Set(allWarnings));
    if (totalFailed === 0) {
      const parts: string[] = [];
      if (okCal > 0) parts.push(`${okCal} calibraç${okCal === 1 ? "ão" : "ões"}`);
      if (okWeight > 0) parts.push(`${okWeight} peso${okWeight === 1 ? "" : "s"}`);
      if (okPublish > 0) parts.push(`${okPublish} status`);
      toast({ title: `Tudo salvo — ${parts.join(", ")}`, description: uniqueWarnings.length > 0 ? uniqueWarnings.join(" ") : undefined, variant: uniqueWarnings.length > 0 ? "destructive" : undefined });
    } else {
      toast({ title: `${totalOk} salvo(s), ${totalFailed} com erro`, description: firstError ?? "Revise os itens destacados.", variant: "destructive" });
    }
  }

  const currentPubBadge = pickedEvent ? calibrationEventChip(pickedEvent) : null;

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>

      {/* ── COMPACT STICKY HEADER ── */}
      <div className="sticky top-0 z-30 px-3 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: "2px solid var(--accent)" }} />
        <span className="font-black uppercase text-[13px] tracking-tight shrink-0 hidden sm:inline" style={{ fontFamily: CONDENSED }}>Calibrações</span>

        {/* Event picker inline */}
        <div className="flex-1 min-w-0">
          <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                data-testid="select-event"
                disabled={calibratableEvents.length === 0}
                className="w-full h-9 px-3 flex items-center justify-between gap-2 text-left transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed rounded-none"
                style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
              >
                {pickedEvent ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-black uppercase text-[11px] truncate" style={{ fontFamily: CONDENSED }}>{pickedEvent.name}</span>
                    {formatEventSubtitle(pickedEvent) && (
                      <span className="text-[10px] font-bold truncate hidden md:inline" style={{ color: "var(--muted-foreground)" }}>{formatEventSubtitle(pickedEvent)}</span>
                    )}
                  </span>
                ) : (
                  <span className="font-black uppercase text-[10px] tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                    {calibratableEvents.length === 0 ? "Nenhum evento no ciclo" : "Selecionar evento..."}
                  </span>
                )}
                <ChevronsUpDown size={13} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="p-0 rounded-none w-[min(96vw,600px)]"
              style={{
                backgroundColor: pk.bg,
                border: `2px solid ${pk.border}`,
                color: pk.text,
                boxShadow: pk.shadow,
              }}
            >
              <Command
                shouldFilter={false}
                className="[&_[cmdk-input-wrapper]]:hidden [&_[cmdk-item]]:rounded-none [&_[cmdk-item]]:px-0 [&_[cmdk-group]]:px-0"
                style={{ backgroundColor: pk.bg, color: pk.text }}
              >
                {/* ── Status filter tabs ── */}
                <div className="flex" style={{ borderBottom: `2px solid ${pk.border}` }}>
                  {([
                    { value: "all", label: "Todos" },
                    { value: "pending", label: "Aguardando" },
                    { value: "inProgress", label: "Em Avaliação" },
                    { value: "done", label: "Fechado" },
                  ] as const).map((opt, i) => {
                    const active = eventStatusFilter === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`button-filter-status-${opt.value}`}
                        onClick={() => setEventStatusFilter(opt.value)}
                        className="flex-1 py-2.5 font-black uppercase text-[11px] tracking-widest transition-all"
                        style={{
                          fontFamily: CONDENSED,
                          backgroundColor: active ? pk.activeBg : "transparent",
                          color: active ? pk.activeFg : pk.muted,
                          borderRight: i < 3 ? `1px solid ${pk.border}` : undefined,
                        }}
                      >{opt.label}</button>
                    );
                  })}
                </div>

                {/* ── Search (plain input, no duplicate icon) ── */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${pk.border}`, backgroundColor: pk.card }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: pk.muted, flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    data-testid="input-event-search"
                    type="text"
                    value={eventSearchText}
                    onChange={e => setEventSearchText(e.target.value)}
                    placeholder="Buscar evento ou cliente..."
                    className="flex-1 h-8 bg-transparent border-none outline-none font-bold text-[12px] placeholder:opacity-50"
                    style={{ color: pk.text, fontFamily: BODY }}
                    autoComplete="off"
                  />
                  {eventSearchText && (
                    <button type="button" onClick={() => setEventSearchText("")} className="shrink-0 hover:opacity-70 transition-opacity" style={{ color: pk.muted }}>
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* ── Date weekend chips (horizontal scroll) ── */}
                {cycleWeekends.length > 0 && (
                  <div className="flex items-center gap-0 px-3.5 py-2 overflow-x-auto" style={{ borderBottom: `1px solid ${pk.border}`, backgroundColor: pk.bg, scrollbarWidth: "none" }}>
                    <span className="text-[10px] font-black uppercase shrink-0 mr-2.5" style={{ color: pk.muted, fontFamily: CONDENSED }}>Fim de semana</span>
                    <div className="flex items-center gap-1.5">
                      {cycleWeekends.map(w => {
                        const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                        return (
                          <button key={w.sat} type="button"
                            onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                            className="px-2.5 py-1 font-black uppercase text-[10px] tracking-wide transition-all shrink-0 whitespace-nowrap"
                            style={{
                              fontFamily: CONDENSED,
                              backgroundColor: active ? pk.activeBg : "transparent",
                              color: active ? pk.activeFg : pk.chipText,
                              border: active ? `1.5px solid ${pk.activeBg}` : `1.5px solid ${pk.chipBorder}`,
                            }}
                          >{w.label}</button>
                        );
                      })}
                      {(filterDateFrom || filterDateTo) && (
                        <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                          className="text-[10px] font-black uppercase shrink-0 px-2 hover:opacity-70 transition-opacity"
                          style={{ color: pk.muted }}
                        >× Limpar</button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Event list ── */}
                <CommandList className="max-h-[320px] overflow-y-auto" style={{ backgroundColor: pk.bg }}>
                  <CommandEmpty className="py-10 text-center font-black uppercase text-[11px] tracking-widest" style={{ color: pk.muted, fontFamily: CONDENSED }}>
                    Nenhum evento encontrado.
                  </CommandEmpty>
                  <CommandGroup className="p-0" style={{ backgroundColor: pk.bg }}>
                    {filteredCalibratableEvents.map((ev, idx) => {
                      const chip = calibrationEventChip(ev);
                      const isSelected = selectedEventId === ev.id;
                      return (
                        <CommandItem
                          key={ev.id}
                          value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                          data-testid={`option-event-${ev.id}`}
                          onSelect={() => { setSelectedEventId(ev.id); setCalScores({}); setCalReasons({}); setWeightEdits({}); setEventPickerOpen(false); }}
                          className="cursor-pointer rounded-none flex items-stretch gap-0 aria-selected:bg-transparent"
                          style={{
                            borderTop: idx > 0 ? `1px solid ${pk.itemBorder}` : undefined,
                            backgroundColor: isSelected ? pk.itemSel : "transparent",
                          }}
                        >
                          {/* Selected indicator bar */}
                          <div className="w-[3px] shrink-0" style={{ backgroundColor: isSelected ? pk.activeBg : "transparent" }} />
                          <div className="flex items-center gap-3 px-3.5 py-2.5 flex-1 min-w-0">
                            <span className="flex flex-col min-w-0 flex-1 gap-0.5">
                              <span
                                className="font-black uppercase text-[13px] leading-tight"
                                style={{ fontFamily: CONDENSED, color: isSelected ? pk.activeBg : pk.text }}
                              >{ev.name}</span>
                              {formatEventSubtitle(ev) && (
                                <span className="text-[11px] font-bold uppercase" style={{ color: pk.muted }}>
                                  {formatEventSubtitle(ev)}
                                </span>
                              )}
                            </span>
                            <span
                              className="font-black text-[10px] uppercase tracking-wider shrink-0 px-2 py-0.5"
                              style={{
                                fontFamily: CONDENSED,
                                border: `1.5px solid ${chip.fg}`,
                                color: chip.fg,
                                backgroundColor: chip.bg,
                              }}
                            >{chip.label}</span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Publication status badge */}
        {pickedEvent && currentPubBadge && (
          <span className="shrink-0 px-2.5 py-1 rounded-full font-bold text-[10px] uppercase hidden sm:inline"
            style={{
              backgroundColor: (alreadyReleased || allCriteriaFinalPublished) ? "var(--primary)" : partialPublishedAtDate ? "rgba(232,162,61,0.14)" : "var(--secondary)",
              color: (alreadyReleased || allCriteriaFinalPublished) ? "var(--primary-foreground)" : partialPublishedAtDate ? AMBER : "var(--muted-foreground)",
            }}
            title={(alreadyReleased || allCriteriaFinalPublished) ? `Final liberado em ${feedbackReleasedAtDate ? formatDateTime(feedbackReleasedAtDate) : ""}` : partialPublishedAtDate ? `Parcial publicado em ${formatDateTime(partialPublishedAtDate)}` : "Notas não publicadas"}
          >
            {(alreadyReleased || allCriteriaFinalPublished) ? "Final" : partialPublishedAtDate ? "Parcial" : "Não pub."}
          </span>
        )}

        {/* Pending calibrations badge */}
        {pendingCount > 0 && (
          <span
            title={`${pendingCount} critério(s) sem calibração`}
            className="shrink-0 font-black text-[11px] uppercase px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <SlidersHorizontal size={11} /> {pendingCount}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* ── PLACEHOLDER: nenhum evento selecionado ── */}
        {!selectedEventId && (
          <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl" style={{ border: "1px dashed var(--border)" }}>
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: "var(--secondary)" }}>
              <Target style={{ color: "var(--muted-foreground)" }} size={32} />
            </div>
            <h2 data-testid="text-page-title" className="text-xl font-black uppercase tracking-tight mb-1" style={{ fontFamily: CONDENSED }}>Área de Calibração</h2>
            <p className="text-sm max-w-sm" style={{ color: "var(--muted-foreground)" }}>Use o seletor no topo para escolher um evento e calibrar os critérios.</p>
          </div>
        )}

        {selectedEventId && (
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* ── RIGHT SIDEBAR: Context always visible ── */}
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-16 self-start lg:order-2 rounded-xl max-h-[50vh] lg:max-h-[calc(100vh-90px)] overflow-y-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>

            {/* Event summary bar */}
            {pickedEvent && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <h3 className="font-black uppercase tracking-tight text-sm truncate" style={{ fontFamily: CONDENSED }}>{pickedEvent.name}</h3>
                  <span className="text-[11px] font-bold uppercase truncate hidden sm:inline" style={{ color: "var(--muted-foreground)" }}>{pickedEvent.clientName}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {feedback && (
                    <span className="rounded-lg px-3 py-1.5 flex items-center gap-1.5" style={{ border: "1px solid var(--border)" }}>
                      <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nota Final</span>
                      <span className="text-lg font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{feedback.eventScore.toFixed(1)}<span className="text-xs" style={{ color: "var(--muted-foreground)" }}>/100</span></span>
                    </span>
                  )}
                  <Link
                    href={`/events/${selectedEventId}`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase rounded-lg px-3 py-1.5 transition-colors hover:opacity-80 shrink-0"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <ExternalLink size={12} /> Ver Evento
                  </Link>
                </div>
              </div>
            )}

            {/* Review requests */}
            {eventReviewRequests.length > 0 && (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Flag size={13} className="shrink-0" style={{ color: WARNING }} />
                  <span className="text-[11px] font-black uppercase" style={{ color: WARNING }}>
                    Revisão Sinalizada {pendingEventReviewRequests.length > 0 && `— ${pendingEventReviewRequests.length} pendente${pendingEventReviewRequests.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {eventReviewRequests.map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: r.status === "pending" ? "rgba(229,72,77,0.10)" : "var(--secondary)", border: r.status === "pending" ? `1px solid ${WARNING}` : "1px solid var(--border)" }}>
                      <div className="min-w-0 flex-1">
                        <span className="font-bold uppercase">{r.employeeName}</span>
                        {r.comment && <p className="mt-0.5" style={{ color: "var(--foreground)" }}>"{r.comment}"</p>}
                        {r.status === "resolved" && r.resolutionNotes && <p className="text-[10px] font-bold uppercase mt-0.5" style={{ color: "var(--muted-foreground)" }}>Resposta: {r.resolutionNotes}</p>}
                      </div>
                      <span className="px-1.5 py-0.5 rounded font-bold text-[9px] uppercase shrink-0" style={{ backgroundColor: r.status === "pending" ? WARNING : "var(--secondary)", color: r.status === "pending" ? "#fff" : "var(--muted-foreground)" }}>
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
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <button type="button" onClick={() => setTeamPanelOpen(o => !o)} className="flex items-center gap-2 w-full text-left mb-2">
                    <Users size={13} className="shrink-0" />
                    <span className="text-[11px] font-black uppercase">Equipe Alocada <span style={{ color: "var(--muted-foreground)" }}>({relevantParticipants.length})</span></span>
                    {teamPanelOpen ? <ChevronUp size={12} className="ml-auto" style={{ color: "var(--muted-foreground)" }} /> : <ChevronDown size={12} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />}
                  </button>
                  {teamPanelOpen && (
                    relevantParticipants.length === 0 ? (
                      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador ativo alocado.</p>
                    ) : (
                      <div className="space-y-1">
                        {relevantParticipants.map(p => {
                          const realizadasCount = p.actualDiariaDates != null ? p.actualDiariaDates.length : p.actualDiariaCount;
                          return (
                            <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ backgroundColor: "var(--secondary)" }}>
                              <div className="w-7 h-7 rounded-md flex items-center justify-center font-black text-[10px] shrink-0" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                                {p.employeeName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-black uppercase text-[10px] leading-tight truncate">{p.employeeName}</p>
                                <p className="text-[9px] font-bold uppercase truncate" style={{ color: "var(--muted-foreground)" }}>{p.functionName}</p>
                              </div>
                              {realizadasCount != null && (
                                <span className="text-[9px] font-bold uppercase shrink-0 flex items-center gap-0.5 rounded px-1.5 py-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>
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

            {/* Conformidade — editável para gestores */}
            {(conformity || canManageConformity) && (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-[11px] font-black uppercase mb-2 flex items-center gap-1.5"><ShieldCheck size={13} /> Matriz de Conformidade</p>
                {(fullEvent?.conformityEvaluatorName || fullEvent?.conformityEvaluatorFerramentasName) && (
                  <div className="mb-2 space-y-0.5">
                    {fullEvent?.conformityEvaluatorName && (
                      <p className="text-[9px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><User size={9} /> Responsável Cenografia: <span className="font-bold ml-0.5" style={{ color: "var(--foreground)" }}>{fullEvent.conformityEvaluatorName}</span></p>
                    )}
                    {fullEvent?.conformityEvaluatorFerramentasName && (
                      <p className="text-[9px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><User size={9} /> Responsável Ferramentas: <span className="font-bold ml-0.5" style={{ color: "var(--foreground)" }}>{fullEvent.conformityEvaluatorFerramentasName}</span></p>
                    )}
                  </div>
                )}
                <div className="space-y-1 mb-2">
                  {([
                    { label: "EPI", key: "epi" as const, commentKey: "epiComment" as const },
                    { label: "Estaiamento", key: "estaiamentos" as const, commentKey: "estaiamentosComment" as const },
                    { label: "Conduta", key: "conduta" as const, commentKey: "condutaComment" as const },
                    { label: "Guarda Equip.", key: "guardaEquipamentos" as const, commentKey: "guardaEquipamentosComment" as const },
                  ]).map(item => {
                    const value = conformityForm[item.key];
                    const comment = conformityForm[item.commentKey];
                    const isExpanded = conformityExpandedComments.has(item.key);
                    return (
                      <div key={item.key} className="rounded-lg overflow-hidden" style={{ border: value === null ? "1px solid var(--border)" : value ? `1px solid ${GOOD}` : `1px solid ${WARNING}`, backgroundColor: value === null ? "var(--secondary)" : value ? "rgba(154,176,0,0.10)" : "rgba(229,72,77,0.08)" }}>
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] font-bold uppercase truncate block">{item.label}</span>
                            {value !== null && !!(conformity as unknown as Record<string, unknown>)?.createdByUserName && (
                              <span className="text-[8px] flex items-center gap-0.5 mt-0.5" style={{ color: GOOD }}>
                                <Check size={8} /> {String((conformity as unknown as Record<string, unknown>).createdByUserName) as string}
                              </span>
                            )}
                          </div>
                          {canManageConformity ? (
                            <div className="flex items-center rounded overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
                              <button type="button" onClick={() => { const next = { ...conformityForm, [item.key]: true }; setConformityForm(next); setConformityMutation.mutate({ id: selectedEventId!, data: { [item.key]: true } }); }} className="px-1.5 py-0.5 text-[9px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === true ? "var(--primary)" : "transparent", color: value === true ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>S</button>
                              <button type="button" onClick={() => { const next = { ...conformityForm, [item.key]: false }; setConformityForm(next); setConformityMutation.mutate({ id: selectedEventId!, data: { [item.key]: false } }); }} className="px-1.5 py-0.5 text-[9px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === false ? WARNING : "transparent", color: value === false ? "#fff" : "var(--muted-foreground)" }}>N</button>
                              <button type="button" onClick={() => { const next = { ...conformityForm, [item.key]: null }; setConformityForm(next); setConformityMutation.mutate({ id: selectedEventId!, data: { [item.key]: null } }); }} className="px-1.5 py-0.5 text-[9px] font-black uppercase transition-all" style={{ backgroundColor: value === null ? "rgba(232,162,61,0.24)" : "transparent", color: value === null ? AMBER : "var(--muted-foreground)" }}>?</button>
                            </div>
                          ) : (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: value === null ? "var(--secondary)" : value ? "var(--primary)" : WARNING, color: value === null ? "var(--muted-foreground)" : value ? "var(--primary-foreground)" : "#fff" }}>
                              {value === null ? "—" : value ? "OK" : "Não"}
                            </span>
                          )}
                          {canManageConformity && (
                            <button type="button" title={comment ? "Ver/editar comentário" : "Adicionar comentário"} onClick={() => setConformityExpandedComments(prev => { const next = new Set(prev); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })} className="p-0.5 rounded transition-all ml-0.5" style={{ border: comment ? "1px solid var(--primary)" : "1px solid var(--border)", backgroundColor: comment ? "var(--primary)" : "transparent", color: comment ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                              <MessageSquare size={9} />
                            </button>
                          )}
                        </div>
                        {isExpanded && canManageConformity && (
                          <div className="px-2 pb-2 space-y-1">
                            <Textarea value={comment} onChange={e => setConformityForm(f => ({ ...f, [item.commentKey]: e.target.value }))} placeholder="Observação..." className="text-[10px] resize-none min-h-[48px] p-1.5 rounded" style={fieldStyle} />
                            <button type="button" disabled={setConformityMutation.isPending} onClick={() => setConformityMutation.mutate({ id: selectedEventId!, data: { [item.commentKey]: comment || null } })} className="px-2 py-0.5 rounded font-black uppercase text-[9px] disabled:opacity-50 transition-colors hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                              Salvar
                            </button>
                          </div>
                        )}
                        {!isExpanded && comment && (
                          <p className="px-2 pb-1 text-[9px] line-clamp-1 cursor-pointer" style={{ color: "var(--muted-foreground)" }} onClick={() => setConformityExpandedComments(prev => { const next = new Set(prev); next.add(item.key); return next; })}>💬 {comment}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-1.5">
                  {/* Faltas/Atrasos */}
                  <div className="rounded-lg px-2 py-1.5" style={{ border: conformityForm.absencesReport ? `1px solid ${AMBER}` : "1px solid var(--border)", backgroundColor: conformityForm.absencesReport ? "rgba(232,162,61,0.10)" : "var(--secondary)" }}>
                    <p className="text-[9px] font-bold uppercase mb-1 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><User size={9} /> Faltas/Atrasos</p>
                    {canManageConformity ? (
                      <div className="flex gap-1">
                        <Textarea value={conformityForm.absencesReport} onChange={e => setConformityForm(f => ({ ...f, absencesReport: e.target.value }))} placeholder="Sem registro" className="text-[10px] resize-none min-h-[36px] p-1 flex-1 rounded" style={fieldStyle} />
                        <button type="button" disabled={setConformityMutation.isPending} onClick={() => setConformityMutation.mutate({ id: selectedEventId!, data: { absencesReport: conformityForm.absencesReport || null } })} className="px-1.5 rounded font-black text-[9px] disabled:opacity-50 transition-colors hover:opacity-90 shrink-0 self-start" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                          <Save size={9} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] leading-snug">{conformityForm.absencesReport || <span style={{ color: "var(--muted-foreground)" }}>Sem registro</span>}</p>
                    )}
                  </div>
                  {/* Destaque */}
                  <div className="rounded-lg px-2 py-1.5" style={{ border: conformityForm.standoutResponse === true ? `1px solid ${GOOD}` : "1px solid var(--border)", backgroundColor: conformityForm.standoutResponse === true ? "rgba(154,176,0,0.10)" : "var(--secondary)" }}>
                    <p className="text-[9px] font-bold uppercase mb-1 flex items-center gap-1" style={{ color: GOOD }}><Trophy size={9} /> Destaque</p>
                    {canManageConformity ? (
                      <div className="space-y-1">
                        <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          <button type="button" onClick={() => { setConformityForm(f => ({ ...f, standoutResponse: false, standoutJustification: "" })); setConformityMutation.mutate({ id: selectedEventId!, data: { standoutResponse: false } }); }} className="flex-1 px-2 py-0.5 text-[9px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: conformityForm.standoutResponse === false ? "var(--primary)" : "transparent", color: conformityForm.standoutResponse === false ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>Não</button>
                          <button type="button" onClick={() => { setConformityForm(f => ({ ...f, standoutResponse: true })); setConformityMutation.mutate({ id: selectedEventId!, data: { standoutResponse: true } }); }} className="flex-1 px-2 py-0.5 text-[9px] font-black uppercase transition-all" style={{ backgroundColor: conformityForm.standoutResponse === true ? GOOD : "transparent", color: conformityForm.standoutResponse === true ? "#fff" : "var(--muted-foreground)" }}>Sim</button>
                        </div>
                        {conformityForm.standoutResponse === true && (
                          <div className="flex gap-1">
                            <Textarea value={conformityForm.standoutJustification} onChange={e => setConformityForm(f => ({ ...f, standoutJustification: e.target.value }))} placeholder="Justificativa do destaque..." className="text-[10px] resize-none min-h-[36px] p-1 flex-1 rounded" style={fieldStyle} />
                            <button type="button" disabled={setConformityMutation.isPending} onClick={() => setConformityMutation.mutate({ id: selectedEventId!, data: { standoutJustification: conformityForm.standoutJustification || null } })} className="px-1.5 rounded font-black text-[9px] disabled:opacity-50 transition-colors hover:opacity-90 shrink-0 self-start" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                              <Save size={9} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] leading-snug">
                        {conformityForm.standoutResponse === null ? <span style={{ color: "var(--muted-foreground)" }}>Pendente</span> : conformityForm.standoutResponse ? (conformityForm.standoutJustification || "Sim") : "Não"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Event Comments */}
            {eventComments && eventComments.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[11px] font-black uppercase mb-2 flex items-center gap-1.5"><MessageSquare size={13} /> Comentários <span style={{ color: "var(--muted-foreground)" }}>({eventComments.length})</span></p>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {eventComments.map((c, i) => (
                    <div key={i} className="text-[11px] rounded-lg px-3 py-2" style={{ backgroundColor: "var(--secondary)" }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold uppercase text-[10px]">{(c as { authorName?: string }).authorName ?? "Admin"}</span>
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{c.createdAt ? formatDateTime(new Date(c.createdAt)) : ""}</span>
                      </div>
                      <p className="leading-snug whitespace-pre-wrap">{c.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── LEFT COLUMN: Calibrations table ── */}
          <div className="flex-1 min-w-0 space-y-3 lg:order-1">

            {/* ── COMPACT ACTION BAR ── */}
          {displayActiveCriteria.length === 0 ? (
            <div className="rounded-xl text-center py-10 font-bold uppercase text-sm" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
              Nenhum critério ativo para este evento.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {/* Liberar Sem Cal. — à esquerda */}
                  {autoFillableCriteria.length > 0 && canFinalize && (
                    <button
                      data-testid="button-autofill-from-evaluator"
                      type="button"
                      disabled={savingAutoFill || savingAll}
                      onClick={autoFillFromEvaluator}
                      title="Cria calibrações iguais à nota do avaliador para todos os critérios ainda sem calibração"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs uppercase disabled:opacity-50 transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <Check size={13} /> {savingAutoFill ? "Preenchendo..." : `Liberar Sem Cal. (${autoFillableCriteria.length})`}
                    </button>
                  )}

                  {/* Progress + filtros */}
                  <span className="text-[11px] font-bold uppercase flex items-center gap-1" style={{ color: "var(--muted-foreground)" }} title={`${finalPublishedCount} de ${scorableActiveCriteria.length} critérios (peso > 0) publicados como Final`}>
                    <ShieldCheck size={11} style={{ color: GOOD }} /> {finalPublishedCount}/{scorableActiveCriteria.length} final
                  </span>
                  <div className="flex items-center gap-1">
                    <Filter size={11} className="mr-0.5" style={{ color: "var(--muted-foreground)" }} />
                    {([
                      { value: "all", label: "Todos" },
                      { value: "uncalibrated", label: "Pendentes" },
                      { value: "calibrated", label: "Calibrados" },
                    ] as const).map(opt => {
                      const active = criterionFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCriterionFilter(opt.value)}
                          className="text-[10px] font-black uppercase px-2 py-1 rounded transition-colors"
                          style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                        >{opt.label}</button>
                      );
                    })}
                  </div>

                  {/* Grupo direito: log de publicação + Salvar + Publicar */}
                  <div className="ml-auto flex items-center gap-2">
                    {/* Log de publicação */}
                    {(alreadyReleased || allCriteriaFinalPublished || partialPublishedAtDate) && (
                      <span className="text-[10px] font-bold flex items-center gap-1" style={{ color: alreadyReleased || allCriteriaFinalPublished ? GOOD : AMBER }}>
                        {alreadyReleased || allCriteriaFinalPublished ? <ShieldCheck size={11} /> : <Send size={11} />}
                        {alreadyReleased || allCriteriaFinalPublished
                          ? `Final ${feedbackReleasedAtDate ? formatDateTime(feedbackReleasedAtDate) : ""}`
                          : `Parcial ${partialPublishedAtDate ? formatDateTime(partialPublishedAtDate) : ""}`}
                      </span>
                    )}
                    {/* Salvar — sempre visível quando há alterações */}
                    <button
                      data-testid="button-save-all-cal"
                      type="button"
                      disabled={savingAll || totalDirtyCount === 0}
                      onClick={handleSaveAll}
                      title={totalDirtyCount === 0 ? "Nenhuma alteração pendente" : `Salvar ${totalDirtyCount} alteração(ões) pendente(s)`}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-black text-xs uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <Save size={13} /> {savingAll ? "Salvando..." : `Salvar${totalDirtyCount > 0 ? ` (${totalDirtyCount})` : ""}`}
                    </button>
                    {/* Publicar */}
                    {canFinalize && (
                      <button
                        data-testid="button-publish-all"
                        type="button"
                        disabled={publishingAll || publishingAllPartial || publishingAllFinal}
                        onClick={handlePublishAll}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-black text-xs uppercase transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <Send size={13} /> {publishingAll ? "Publicando..." : "Publicar"}
                      </button>
                    )}
                  </div>
                </div>

              {/* ── CRITERIA TABLE ── */}
              {filteredActiveCriteria.length === 0 && displayActiveCriteria.length > 0 ? (
                <div className="rounded-xl px-5 py-4 text-center" style={{ backgroundColor: "var(--secondary)" }}>
                  <p className="text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum critério para o filtro selecionado.</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <table className="w-full text-sm border-collapse min-w-[520px]">
                    <thead>
                      <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Critério</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-black uppercase tracking-wider w-16" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Peso</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-black uppercase tracking-wider w-20" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }} title="Média das notas enviadas pelos avaliadores da área">Avaliador</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-black uppercase tracking-wider w-28" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Calibrada</th>
                        <th className="text-center px-2 py-2.5 text-[10px] font-black uppercase tracking-wider w-32 hidden sm:table-cell" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
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
                        const reasonVal = calReasons[c.criterionId] ?? (cal?.calibrationReason ?? "");
                        const reasonChanged = calReasons[c.criterionId] !== undefined && calReasons[c.criterionId] !== (cal?.calibrationReason ?? "");

                        return (
                          <tr
                            key={c.criterionId}
                            data-testid={`row-cal-${c.criterionId}`}
                            className="transition-colors group"
                            style={{ borderTop: "1px solid var(--border)" }}
                          >
                            {/* Critério */}
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black uppercase text-[12px] leading-tight" style={{ fontFamily: CONDENSED }}>{c.criterionName}</span>
                                {c.responsibleAreaName && (
                                  <span className="hidden lg:inline text-[9px] font-bold uppercase rounded px-1" style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>{c.responsibleAreaName}</span>
                                )}
                                {(childCriterionIdsMap.get(c.criterionId) ?? []).map(childId => {
                                  const childCrit = activeCriteria.find(ac => ac.criterionId === childId);
                                  return childCrit?.responsibleAreaName ? (
                                    <span key={childId} className="hidden lg:inline text-[9px] font-bold uppercase rounded px-1" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>+ {childCrit.responsibleAreaName}</span>
                                  ) : null;
                                })}
                              </div>
                              {/* ── Avaliadores: nota individual + comentário ── */}
                              {areaScores.map((s, i) => (
                                <div key={i} className="mt-2 pt-1.5" style={{ borderTop: "1px dashed var(--border)" }}>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[8px] font-black uppercase tracking-wider px-1 py-px" style={{ color: GOOD, backgroundColor: "rgba(154,176,0,0.12)" }}>Avaliador</span>
                                    <span className="text-[10px] font-bold">{s.name}</span>
                                    {s.areaName && (
                                      <span className="text-[8px] font-bold uppercase px-1 py-px" style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>{s.areaName}</span>
                                    )}
                                    {s.respondedAt && (
                                      <span className="text-[8px] font-bold flex items-center gap-0.5" style={{ color: "var(--muted-foreground)" }} title={`Respondido em ${formatDateTime(s.respondedAt)}`}>
                                        <Clock size={8} /> {formatDateTime(s.respondedAt)}
                                      </span>
                                    )}
                                    {s.comment && (
                                      <button
                                        type="button"
                                        onClick={e => {
                                          e.stopPropagation();
                                          setCalReasons(prev => ({ ...prev, [c.criterionId]: s.comment }));
                                          setTimeout(() => {
                                            const el = document.querySelector(`[data-testid="input-cal-reason-inline-${c.criterionId}"]`) as HTMLTextAreaElement | null;
                                            if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
                                          }, 0);
                                        }}
                                        title="Copiar para justificativa da calibração"
                                        className="ml-auto h-4 w-4 flex items-center justify-center shrink-0 hover:opacity-70"
                                        style={{ color: GOOD }}
                                      >
                                        <Copy size={9} />
                                      </button>
                                    )}
                                  </div>
                                  {s.comment && <p className="text-[11px] leading-snug line-clamp-3 mt-0.5">{s.comment}</p>}
                                </div>
                              ))}
                              {/* ── Justificativa da calibração (editável) ── */}
                              <div onClick={e => e.stopPropagation()} className="mt-2 pt-1.5" style={{ borderTop: "1px dashed var(--border)" }}>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[8px] font-black uppercase tracking-wider rounded px-1 py-px" style={{ color: "var(--muted-foreground)", backgroundColor: "var(--secondary)" }}>Calibração</span>
                                  {cal?.calibratedByName && (
                                    <span className="text-[10px] font-bold" style={{ color: "var(--muted-foreground)" }}>{cal.calibratedByName}</span>
                                  )}
                                  {/* ── Indicador de salvo ── */}
                                  {savedReasonIds.has(c.criterionId) && !reasonChanged && (
                                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-black uppercase" style={{ color: GOOD }}>
                                      <Check size={9} /> Salvo
                                    </span>
                                  )}
                                  {/* ── Indicador de não salvo ── */}
                                  {reasonChanged && (
                                    <span className="ml-auto flex items-center gap-0.5 text-[9px] font-black uppercase" style={{ color: AMBER }}>
                                      <AlertCircle size={9} /> Não salvo
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  data-testid={`input-cal-reason-inline-${c.criterionId}`}
                                  rows={1}
                                  value={reasonVal}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => {
                                    setSavedReasonIds(prev => { const n = new Set(prev); n.delete(c.criterionId); return n; });
                                    setCalReasons(prev => ({ ...prev, [c.criterionId]: e.target.value }));
                                    e.target.style.height = "auto";
                                    e.target.style.height = e.target.scrollHeight + "px";
                                  }}
                                  onFocus={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
                                  onBlur={e => {
                                    e.stopPropagation();
                                    // Auto-save ao perder foco quando há uma calibração existente e razão mudou
                                    if (reasonChanged && cal && !isSaving) {
                                      saveCalibration(c.criterionId);
                                      setSavedReasonIds(prev => new Set(prev).add(c.criterionId));
                                    }
                                  }}
                                  placeholder="Escreva a justificativa e clique fora para salvar…"
                                  className="w-full px-2 py-1.5 text-[11px] rounded resize-none leading-snug overflow-hidden transition-colors focus:outline-none"
                                  style={{
                                    border: reasonChanged ? `1px solid ${AMBER}` : "1px solid var(--border)",
                                    backgroundColor: reasonChanged ? "rgba(232,162,61,0.08)" : reasonVal ? "rgba(154,176,0,0.06)" : "var(--secondary)",
                                    color: "var(--foreground)",
                                  }}
                                />
                                {/* Ação manual quando não há calibração ainda ou usuário quer salvar explicitamente */}
                                {reasonChanged && (
                                  <div className="mt-1 flex items-center gap-2">
                                    {cal ? (
                                      <button
                                        type="button"
                                        disabled={isSaving}
                                        onClick={e => {
                                          e.stopPropagation();
                                          saveCalibration(c.criterionId);
                                          setSavedReasonIds(prev => new Set(prev).add(c.criterionId));
                                        }}
                                        className="px-2.5 py-1 rounded font-black uppercase text-[10px] disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1"
                                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                                      >
                                        <Save size={10} /> Salvar justificativa
                                      </button>
                                    ) : (
                                      <p className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                                        <AlertCircle size={10} /> Salve a nota calibrada primeiro para gravar a justificativa.
                                      </p>
                                    )}
                                  </div>
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
                                    className="h-6 w-10 px-1 rounded text-center text-xs font-black focus:outline-none"
                                    style={fieldStyle}
                                  />
                                  {weightEdits[c.criterionId] != null && Number(weightEdits[c.criterionId].replace(",", ".")) !== Number(peso) && (
                                    <button
                                      data-testid={`button-save-weight-${c.criterionId}`}
                                      type="button"
                                      disabled={savingWeightId === c.criterionId && updateWeightMutation.isPending}
                                      onClick={() => saveWeight(c.criterionId, c.active)}
                                      title="Salvar peso"
                                      className="h-6 w-6 rounded flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
                                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                                    >
                                      {savingWeightId === c.criterionId && updateWeightMutation.isPending ? "·" : <Check size={10} />}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs font-black">{peso}</span>
                              )}
                            </td>
                            {/* Nota Avaliador */}
                            <td className="px-2 py-2.5 text-center">
                              {/* Quando há múltiplos avaliadores, mostra breakdown por área */}
                              {areaScores.length > 1 && (
                                <div className="flex items-center justify-center gap-1 mb-0.5 flex-wrap">
                                  {areaScores.map((s, si) => (
                                    <span
                                      key={si}
                                      className="text-[9px] font-black px-1 py-px leading-none"
                                      style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", fontFamily: CONDENSED }}
                                      title={`${s.name}${s.areaName ? ` · ${s.areaName}` : ""}: ${s.score.toFixed(1)}`}
                                    >
                                      {s.score.toFixed(1)}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <span className="text-sm font-black" style={{ color: calVal != null ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: calVal != null ? "line-through" : "none" }}>
                                {avg != null ? avg.toFixed(2) : <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</span>}
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
                                  className="h-7 w-12 px-1 rounded text-center text-sm font-black focus:outline-none"
                                  style={{
                                    border: changedFromSaved ? `2px solid ${WARNING}` : calVal != null ? `2px solid ${GOOD}` : "2px solid var(--border)",
                                    backgroundColor: changedFromSaved ? "rgba(229,72,77,0.08)" : calVal != null ? "rgba(154,176,0,0.10)" : "var(--secondary)",
                                    color: "var(--foreground)",
                                  }}
                                />
                                {changedFromSaved && (
                                  <button
                                    data-testid={`button-save-cal-${c.criterionId}`}
                                    type="button"
                                    disabled={isSaving || savingAll}
                                    onClick={() => saveCalibration(c.criterionId)}
                                    title="Salvar calibração"
                                    className="h-7 w-7 rounded flex items-center justify-center disabled:opacity-50 transition-opacity hover:opacity-90"
                                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                                  >
                                    {isSaving ? "·" : <Save size={11} />}
                                  </button>
                                )}
                              </div>
                            </td>
                            {/* Status + seletor de intenção de publicação */}
                            <td className="px-1 py-2 text-center hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                              {cal && canFinalize ? (
                                <div className="flex flex-col items-center gap-1">
                                  {/* Estado de publicação atual — badge prominente */}
                                  {isFinalPublished ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(154,176,0,0.18)", color: GOOD, border: `1px solid ${GOOD}` }}>
                                        <CheckCircle size={8} /> Final pub.
                                      </span>
                                      <span className="text-[8px] leading-tight text-center" style={{ color: "var(--muted-foreground)" }}>
                                        {formatDateTime(new Date(c.finalPublishedAt!))}
                                      </span>
                                      {c.finalPublishedByUserName && (
                                        <span className="text-[8px] leading-tight text-center font-medium" style={{ color: GOOD }}>
                                          {c.finalPublishedByUserName}
                                        </span>
                                      )}
                                    </div>
                                  ) : c.partialPublishedAt ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(232,162,61,0.18)", color: AMBER, border: `1px solid ${AMBER}` }}>
                                        <CheckCircle size={8} /> Parcial pub.
                                      </span>
                                      <span className="text-[8px] leading-tight text-center" style={{ color: "var(--muted-foreground)" }}>
                                        {formatDateTime(new Date(c.partialPublishedAt))}
                                      </span>
                                      {c.partialPublishedByUserName && (
                                        <span className="text-[8px] leading-tight text-center font-medium" style={{ color: AMBER }}>
                                          {c.partialPublishedByUserName}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                                      Não pub.
                                    </span>
                                  )}
                                  {/* Seletor de intenção: Parc. | Final */}
                                  <div className="flex items-stretch rounded overflow-hidden w-full max-w-[88px]" style={{ border: "1px solid var(--border)" }}>
                                    <button
                                      type="button"
                                      onClick={() => setPublishIntents(prev => ({ ...prev, [c.criterionId]: "partial" }))}
                                      className="flex-1 py-1 text-[8px] font-black uppercase transition-colors leading-none"
                                      style={{ backgroundColor: (publishIntents[c.criterionId] ?? "partial") === "partial" ? AMBER : "transparent", color: (publishIntents[c.criterionId] ?? "partial") === "partial" ? "#fff" : "var(--muted-foreground)" }}
                                    >
                                      Parc.
                                    </button>
                                    <span className="w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />
                                    <button
                                      type="button"
                                      onClick={() => setPublishIntents(prev => ({ ...prev, [c.criterionId]: "final" }))}
                                      className="flex-1 py-1 text-[8px] font-black uppercase transition-colors leading-none"
                                      style={{ backgroundColor: (publishIntents[c.criterionId] ?? "partial") === "final" ? GOOD : "transparent", color: (publishIntents[c.criterionId] ?? "partial") === "final" ? "#fff" : "var(--muted-foreground)" }}
                                    >
                                      Final
                                    </button>
                                  </div>
                                </div>
                              ) : cal ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase rounded px-1.5 py-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD, border: `1px solid ${GOOD}` }}>
                                  <CheckCircle size={9} /> Cal.
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER, border: `1px solid ${AMBER}` }}>
                                  {avg != null ? "Pendente" : "Sem nota"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}


            </>
          )}
          </div>{/* end left column */}
        </div>
        )}

      </div>

    </div>
  );
}
