import { useState, useEffect } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useGetEvent, useGetEventResult, useCreateEvaluation, useGetUsers, getGetEvaluationsQueryKey, getGetEventQueryKey, exportPendingEvaluations, getEventCriteria, getEvent, getEvaluations, createEvaluation, submitEvaluation } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Users, Download, Calendar, MapPin, Building2, Save, Flag, Target, Lock, ChevronsUpDown, Check, Info, ListChecks, User, SlidersHorizontal, ArrowRight, Rocket } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { cn, formatEventSubtitle } from "@/lib/utils";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function ScoreButton({ score, current, onClick, disabled, label }: { score: number, current: number, onClick: () => void, disabled: boolean, label: string }) {
  const isSelected = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-2 border-[#191c1e] p-3 md:p-4 flex flex-col items-center gap-1.5 transition-all w-full",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 active:translate-y-0",
        isSelected
          ? "bg-[#ccff00] text-[#161e00]"
          : "bg-white text-[#191c1e]"
      )}
    >
      <span className="text-2xl italic font-black">{score}</span>
      <span className="text-[10px] leading-tight text-center font-bold uppercase italic">{label}</span>
    </button>
  );
}

function EvaluatorEventCard({
  event, userId, selected, onSelect,
}: {
  event: { id: number; name: string; clientName?: string | null; city?: string | null; state?: string | null; cycleName?: string };
  userId: number | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: criteria } = useGetEventCriteria(event.id, {
    query: { queryKey: ["event-criteria", event.id] as unknown[] },
  });
  const { data: detail } = useGetEvent(event.id, {
    query: { queryKey: getGetEventQueryKey(event.id) },
  });
  const { data: evals } = useGetEvaluations(
    { eventId: event.id },
    { query: { queryKey: getGetEvaluationsQueryKey({ eventId: event.id }) } },
  );

  // Esta avaliação é por atribuição evento→área→avaliador, não pela área do perfil.
  const myAreaIds = new Set(
    (detail?.areaAssignments ?? []).filter(a => a.evaluatorUserId === userId).map(a => a.areaId),
  );
  const myCriteria = (criteria ?? []).filter(
    c => c.active && c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId),
  );
  // Only events that actually have criteria for this avaliador's area are theirs to do.
  if (myCriteria.length === 0) return null;

  const myEval = (cid: number) => (evals ?? []).find(e => e.criterionId === cid && e.evaluatorUserId === userId);
  const total = myCriteria.length;
  const submitted = myCriteria.filter(c => myEval(c.criterionId)?.status === "submitted").length;
  const drafts = myCriteria.filter(c => myEval(c.criterionId)?.status === "draft").length;
  const done = submitted === total;
  const inProgress = !done && (submitted > 0 || drafts > 0);

  const badge = done
    ? { label: "Concluída", cls: "bg-[#506600] text-[#ccff00]", Icon: CheckCircle }
    : inProgress
      ? { label: "Em andamento", cls: "bg-[#ffdbd1] text-[#862200]", Icon: Clock }
      : { label: "A fazer", cls: "bg-[#f2f4f6] text-[#747a60]", Icon: Clock };
  const Badge = badge.Icon;
  const pct = Math.round((submitted / total) * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`evaluator-event-${event.id}`}
      className={cn(
        "text-left border-2 border-[#191c1e] p-5 transition-all",
        HARD_SHADOW, HARD_SHADOW_HOVER,
        selected ? "bg-[#f7ffd1]" : "bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={cn("px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block", badge.cls)}>
          <span className="inline-flex items-center gap-1.5 skew-x-[8deg]"><Badge size={12} /> {badge.label}</span>
        </span>
        {event.cycleName && <span className="text-[11px] font-bold italic uppercase text-[#747a60] shrink-0">{event.cycleName}</span>}
      </div>
      <h4 className="text-lg italic uppercase font-black tracking-tight leading-tight">{event.name}</h4>
      {formatEventSubtitle(event) && <p className="text-[12px] font-bold italic uppercase text-[#747a60] mt-0.5 truncate">{formatEventSubtitle(event)}</p>}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-bold italic uppercase text-[#444933]">{submitted} de {total} critérios submetidos</span>
          <span className="text-xs font-black italic text-[#506600]">{pct}%</span>
        </div>
        <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2">
          <div className="bg-[#ccff00] h-full transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {drafts > 0 && (
          <p className="text-[11px] text-[#862200] italic mt-1.5 font-bold uppercase">{drafts} em rascunho — submeta para concluir</p>
        )}
      </div>
    </button>
  );
}

export default function EvaluationsPage() {
  const { user } = useAuth();
  const isManager = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const isEvaluator = user?.role === "avaliador";
  // Everyone who is not an evaluator (managers, diretoria, visualizador) is in
  // read-only consultation mode: they inspect evaluation progress, never score.
  const isConsultation = !!user && !isEvaluator;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [selectedAvaliadorId, setSelectedAvaliadorId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  // Per-criterion audio override (objectPath). "" means the user cleared a
  // previously saved audio (re-recording). undefined => fall back to saved eval.
  const [audioOverrides, setAudioOverrides] = useState<Record<number, string>>({});
  // Confirmation modal + in-flight state for the one-click "Lançar Avaliação" flow.
  const [confirmLaunchOpen, setConfirmLaunchOpen] = useState(false);
  const [launching, setLaunching] = useState(false);

  const { data: events } = useGetEvents({});

  // Lista global de avaliadores (independe do evento selecionado) para permitir
  // filtrar por Avaliador antes ou sem escolher um Evento.
  const { data: allUsers } = useGetUsers({
    query: { enabled: isConsultation, queryKey: ["users"] as unknown[] },
  });
  const allAvaliadores = (allUsers ?? [])
    .filter(u => u.role === "avaliador" && u.active)
    .map(u => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const { data: participants } = useGetEventParticipants(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-participants", selectedEventId] as unknown[] },
  });

  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-criteria", selectedEventId] as unknown[] },
  });

  const { data: selectedEventDetail } = useGetEvent(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: getGetEventQueryKey(selectedEventId ?? 0) },
  });

  const evalsQKey = getGetEvaluationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: evalsQKey } }
  );

  const { data: eventResult } = useGetEventResult(selectedEventId!, {
    query: { enabled: !!selectedEventId && isManager, queryKey: ["event-result-eval", selectedEventId] as unknown[] },
  });

  const createMutation = useCreateEvaluation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: evalsQKey }),
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const activeEvents = (events ?? []).filter(e => e.status === "open" || e.status === "closed");
  // Only events whose criteria the RH has already confirmed can be evaluated.
  const configuredEvents = activeEvents.filter(e => e.criteriaConfirmed);
  // Evaluators may only act on RH-released events; consultation roles may inspect any open event.
  // Ordenado alfabeticamente por nome do evento (pt-BR, ignorando maiúsc./acentos).
  const selectableEvents = [...(isEvaluator ? configuredEvents : activeEvents)].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" })
  );
  const pickedEvent = selectableEvents.find(e => e.id === selectedEventId);

  // For evaluators: fetch criteria for every selectable event so the overview
  // only lists events that actually have work for their area (and so the empty
  // state is accurate). Same query key as the per-event fetch → deduped/cached.
  const evaluatorCriteriaQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: ["event-criteria", ev.id] as unknown[],
          queryFn: () => getEventCriteria(ev.id),
        }))
      : [],
  });
  const evaluatorEventDetailQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: getGetEventQueryKey(ev.id),
          queryFn: () => getEvent(ev.id),
        }))
      : [],
  });
  const relevantEvaluatorEvents = isEvaluator
    ? configuredEvents.filter((_, i) => {
        const myAreaIds = new Set(
          (evaluatorEventDetailQueries[i]?.data?.areaAssignments ?? [])
            .filter(a => a.evaluatorUserId === user?.id)
            .map(a => a.areaId),
        );
        return (evaluatorCriteriaQueries[i]?.data ?? []).some(
          c => c.active && c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId),
        );
      })
    : [];

  // Fetch this avaliador's evaluations for every configured event so the
  // overview can split events into "A Fazer" vs "Concluídas". Same query key as
  // the per-event/card fetch → deduped/cached, no extra network.
  const evaluatorEvalQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: getGetEvaluationsQueryKey({ eventId: ev.id }),
          queryFn: () => getEvaluations({ eventId: ev.id }),
        }))
      : [],
  });
  // Per-event completion stats for the avaliador (only events that actually
  // have criteria assigned to their area count as theirs).
  const evaluatorEventStats = isEvaluator
    ? configuredEvents.map((ev, i) => {
        const myAreaIds = new Set(
          (evaluatorEventDetailQueries[i]?.data?.areaAssignments ?? [])
            .filter(a => a.evaluatorUserId === user?.id)
            .map(a => a.areaId),
        );
        const myCrit = (evaluatorCriteriaQueries[i]?.data ?? []).filter(
          c => c.active && c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId),
        );
        const evs = evaluatorEvalQueries[i]?.data ?? [];
        const submitted = myCrit.filter(
          c => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === user?.id)?.status === "submitted",
        ).length;
        const total = myCrit.length;
        return { event: ev, total, submitted, done: total > 0 && submitted === total, relevant: total > 0 };
      }).filter(s => s.relevant)
    : [];
  const todoEvents = evaluatorEventStats.filter(s => !s.done).map(s => s.event);
  const doneEvents = evaluatorEventStats.filter(s => s.done).map(s => s.event);

  // If the selected event stops being selectable (closed or criteria unconfirmed
  // server-side), clear the selection so trigger text and loaded data stay in sync.
  useEffect(() => {
    if (selectedEventId == null || !events) return;
    const stillValid = events.some(e => e.id === selectedEventId && (e.status === "open" || e.status === "closed") && (isEvaluator ? e.criteriaConfirmed : true));
    if (!stillValid) { setSelectedEventId(null); setScores({}); setComments({}); setAudioOverrides({}); setSelectedAvaliadorId(null); setStatusFilter("all"); }
  }, [selectedEventId, events, isEvaluator]);
  const canRelease = isManager;
  const eventComplete = eventResult?.isComplete ?? false;
  const feedbackReleased = eventResult?.feedbackReleased ?? false;

  const currentEvent = events?.find(e => e.id === selectedEventId);
  const criteriaLocked = currentEvent ? !currentEvent.criteriaConfirmed : false;

  // Avaliadores only see/evaluate the areas assigned to them FOR THIS EVENT
  // (atribuição evento→área→avaliador), not the fixed profile area.
  const myAssignedAreaIds = new Set(
    (selectedEventDetail?.areaAssignments ?? [])
      .filter(a => a.evaluatorUserId === user?.id)
      .map(a => a.areaId),
  );
  const myCriteria = activeCriteria.filter(c => c.responsibleAreaId != null && myAssignedAreaIds.has(c.responsibleAreaId));

  // Avaliadores atribuídos a cada área (evento → área → avaliador[]); pode haver
  // mais de um por área — a nota final é a média entre eles.
  const assignedEvaluatorsByArea = new Map<number, { id: number; name: string }[]>();
  for (const a of (selectedEventDetail?.areaAssignments ?? [])) {
    if (a.evaluatorUserId == null) continue;
    const list = assignedEvaluatorsByArea.get(a.areaId) ?? [];
    list.push({ id: a.evaluatorUserId, name: a.evaluatorName ?? "Sem nome" });
    assignedEvaluatorsByArea.set(a.areaId, list);
  }

  // Manager-only oversight: per-criterion submission status ("quem preencheu / quem falta").
  // "submitted" só quando TODOS os avaliadores designados para a área enviaram;
  // "partial" cobre o caso de 1 de N já ter enviado.
  type CriterionUiStatus = {
    state: "submitted" | "partial" | "draft" | "pending";
    submittedNames: string[];
    pendingNames: string[];
    requiredCount: number;
    submittedCount: number;
  };
  function criterionStatus(criterionId: number, responsibleAreaId: number | null): CriterionUiStatus {
    const evs = (evaluations ?? []).filter(e => e.criterionId === criterionId);
    const assigned = responsibleAreaId != null ? (assignedEvaluatorsByArea.get(responsibleAreaId) ?? []) : [];
    const evalByEvaluator = new Map(evs.filter(e => e.evaluatorUserId != null).map(e => [e.evaluatorUserId as number, e]));
    if (assigned.length > 0) {
      const submitted = assigned.filter(a => evalByEvaluator.get(a.id)?.status === "submitted");
      const drafted = assigned.filter(a => evalByEvaluator.get(a.id)?.status === "draft");
      const pending = assigned.filter(a => !submitted.includes(a));
      const state: CriterionUiStatus["state"] = submitted.length === assigned.length
        ? "submitted"
        : submitted.length > 0
          ? "partial"
          : drafted.length > 0
            ? "draft"
            : "pending";
      return { state, submittedNames: submitted.map(a => a.name), pendingNames: pending.map(a => a.name), requiredCount: assigned.length, submittedCount: submitted.length };
    }
    // Sem atribuição configurada para a área: cai no fallback "qualquer envio conta" (espelha o backend).
    const submitted = evs.find(e => e.status === "submitted");
    if (submitted) return { state: "submitted", submittedNames: [submitted.evaluatorName ?? "—"], pendingNames: [], requiredCount: 1, submittedCount: 1 };
    const draft = evs.find(e => e.status === "draft");
    if (draft) return { state: "draft", submittedNames: [], pendingNames: [], requiredCount: 1, submittedCount: 0 };
    return { state: "pending", submittedNames: [], pendingNames: [], requiredCount: 1, submittedCount: 0 };
  }

  function groupByArea(list: typeof activeCriteria) {
    return Object.values(
      list.reduce((acc, c) => {
        const key = c.responsibleAreaName ?? "Sem área definida";
        (acc[key] ??= { area: key, criteria: [] as typeof activeCriteria }).criteria.push(c);
        return acc;
      }, {} as Record<string, { area: string; criteria: typeof activeCriteria }>)
    );
  }
  const areaGroups = groupByArea(activeCriteria);
  const teamSubmittedCount = activeCriteria.filter(c => criterionStatus(c.criterionId, c.responsibleAreaId ?? null).state === "submitted").length;
  const teamProgressPct = activeCriteria.length ? (teamSubmittedCount / activeCriteria.length) * 100 : 0;

  // Avaliadores atribuídos ao evento (evento → área → avaliador), com status
  // agregado (Pendente/Concluído) para permitir consultar/filtrar por pessoa.
  const avaliadorMap = new Map<number, { id: number; name: string; areaIds: Set<number> }>();
  for (const a of (selectedEventDetail?.areaAssignments ?? [])) {
    if (a.evaluatorUserId == null) continue;
    const existing = avaliadorMap.get(a.evaluatorUserId);
    if (existing) existing.areaIds.add(a.areaId);
    else avaliadorMap.set(a.evaluatorUserId, { id: a.evaluatorUserId, name: a.evaluatorName ?? "Sem nome", areaIds: new Set([a.areaId]) });
  }
  // Progresso POR avaliador: conta apenas as submissões DELE, não a completude
  // agregada do critério (que pode exigir outro avaliador da mesma área).
  const avaliadorStats = Array.from(avaliadorMap.values())
    .map(av => {
      const crit = activeCriteria.filter(c => c.responsibleAreaId != null && av.areaIds.has(c.responsibleAreaId));
      const submitted = crit.filter(c =>
        (evaluations ?? []).some(e => e.criterionId === c.criterionId && e.evaluatorUserId === av.id && e.status === "submitted")
      ).length;
      const total = crit.length;
      return { ...av, total, submitted, done: total > 0 && submitted === total };
    })
    .filter(av => av.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const selectedAvaliador = avaliadorStats.find(av => av.id === selectedAvaliadorId) ?? null;
  // Com avaliador selecionado, "avaliado" = submissão DELE; sem seleção, usa a
  // completude agregada do critério (todos os designados da área enviaram).
  const isCriterionDone = (c: (typeof activeCriteria)[number]) =>
    selectedAvaliador
      ? (evaluations ?? []).some(e => e.criterionId === c.criterionId && e.evaluatorUserId === selectedAvaliador.id && e.status === "submitted")
      : criterionStatus(c.criterionId, c.responsibleAreaId ?? null).state === "submitted";
  const avaliadorFilteredCriteria = selectedAvaliador
    ? activeCriteria.filter(c => c.responsibleAreaId != null && selectedAvaliador.areaIds.has(c.responsibleAreaId))
    : activeCriteria;
  const statusFilteredCriteria = statusFilter === "all"
    ? avaliadorFilteredCriteria
    : avaliadorFilteredCriteria.filter(c => (statusFilter === "done" ? isCriterionDone(c) : !isCriterionDone(c)));
  const filteredAreaGroups = groupByArea(statusFilteredCriteria);

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function currentScore(criterionId: number) {
    if (scores[criterionId] != null) return scores[criterionId];
    const ev = getEval(criterionId);
    return ev ? parseFloat(ev.score as unknown as string) : 0;
  }

  function currentAudio(criterionId: number): string | null {
    const override = audioOverrides[criterionId];
    if (override !== undefined) return override === "" ? null : override;
    return getEval(criterionId)?.audioUrl ?? null;
  }

  function handleSaveDraft(criterionId: number) {
    if (!selectedEventId) return;
    const score = currentScore(criterionId);
    if (score === 0) return;

    const comment = comments[criterionId] ?? getEval(criterionId)?.comments ?? "";
    const audioUrl = currentAudio(criterionId);
    if (!audioUrl) {
      toast({ title: "Áudio obrigatório", description: "Grave um áudio explicando a avaliação antes de salvar.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ data: { eventId: selectedEventId, criterionId, score, comments: comment || undefined, audioUrl } });
  }

  function handleScoreClick(criterionId: number, score: number) {
    setScores(s => ({ ...s, [criterionId]: score }));
  }

  // A criterion is "ready to launch" if it's already submitted, OR fully filled
  // in-screen (score chosen and áudio gravado) — justificativa is opcional —
  // even if it was never explicitly saved as rascunho.
  function criterionReady(criterionId: number): boolean {
    const ev = getEval(criterionId);
    if (ev?.status === "submitted") return true;
    const score = currentScore(criterionId);
    if (score === 0) return false;
    if (!currentAudio(criterionId)) return false;
    return true;
  }

  // One-click submit: create/update each pending criterion as draft then submit
  // it, with no requirement to have saved a rascunho first. On success we leave
  // the evaluation screen so the avaliador sees the event as concluded.
  async function handleLaunchAll() {
    if (!selectedEventId) return;
    setLaunching(true);
    try {
      for (const c of myCriteria) {
        const ev = getEval(c.criterionId);
        if (ev?.status === "submitted") continue;
        const score = currentScore(c.criterionId);
        const comment = comments[c.criterionId] ?? ev?.comments ?? "";
        const audioUrl = currentAudio(c.criterionId);
        const created = await createEvaluation({
          eventId: selectedEventId,
          criterionId: c.criterionId,
          score,
          comments: comment || undefined,
          audioUrl: audioUrl ?? undefined,
        });
        await submitEvaluation(created.id);
      }
      await qc.invalidateQueries({ queryKey: evalsQKey });
      toast({ title: "Avaliação lançada com sucesso", description: "Você não tem pendências para este evento." });
      setConfirmLaunchOpen(false);
      setSelectedEventId(null);
      setScores({}); setComments({}); setAudioOverrides({});
    } catch (e) {
      // A criterion may already be submitted (e.g. a retry after a partial
      // failure). Refetch so getEval() reflects the real server state and the
      // next attempt skips what's already done instead of erroring again.
      await qc.invalidateQueries({ queryKey: evalsQKey });
      toast({ title: "Erro ao lançar avaliação", description: ((e as { message?: string })?.message ?? "") + " Confira o que ficou pendente e tente novamente.", variant: "destructive" });
    } finally {
      setLaunching(false);
    }
  }

  const allEvaled = myCriteria.length > 0 && myCriteria.every(c => {
    const ev = getEval(c.criterionId);
    return ev && ev.status === "submitted";
  });
  // Ready to launch when every criterion is filled in-screen (or already done),
  // and there is at least one not-yet-submitted criterion to send.
  const allReady = myCriteria.length > 0 && myCriteria.every(c => criterionReady(c.criterionId));
  const pendingToFill = myCriteria.filter(c => !criterionReady(c.criterionId)).length;
  const toSubmitCount = myCriteria.filter(c => getEval(c.criterionId)?.status !== "submitted").length;

  const completedCount = myCriteria.filter(c => {
    const ev = getEval(c.criterionId);
    return ev && (ev.status === "submitted" || ev.status === "draft");
  }).length;

  const progressPct = myCriteria.length ? (completedCount / myCriteria.length) * 100 : 0;

  async function handleExportPending() {
    try {
      const data = await exportPendingEvaluations();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const renderEventPicker = (compact: boolean) => (
    <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={eventPickerOpen}
          data-testid="select-event"
          disabled={selectableEvents.length === 0}
          className={`${compact ? "w-full md:w-[20rem] min-h-[3rem] px-3 py-2" : "w-full min-h-[3.25rem] px-4 py-3"} flex items-center justify-between gap-3 text-left border-2 border-[#191c1e] bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#f7f9fb] ${HARD_SHADOW}`}
        >
          {pickedEvent ? (
            <span className="flex flex-col min-w-0">
              <span className="font-black italic uppercase text-sm leading-tight text-[#191c1e]">{pickedEvent.name}</span>
              {formatEventSubtitle(pickedEvent) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] truncate">{formatEventSubtitle(pickedEvent)}</span>}
            </span>
          ) : (
            <span className="font-bold italic uppercase text-xs tracking-wider text-[#747a60] truncate">
              {selectableEvents.length === 0
                ? (isConsultation ? "Nenhum evento disponível" : "Nenhum evento disponível")
                : (isConsultation ? "Selecione um evento para consultar..." : (compact ? "Selecionar evento..." : "Selecione um evento para avaliar..."))}
            </span>
          )}
          <ChevronsUpDown size={compact ? 16 : 18} className="shrink-0 text-[#191c1e]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={compact ? "end" : "start"} className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
        <Command className="rounded-none">
          <CommandInput data-testid="input-event-search" placeholder="Buscar por evento ou cliente..." className="italic" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
            <CommandGroup>
              {selectableEvents.map(ev => (
                <CommandItem
                  key={ev.id}
                  value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                  data-testid={`option-event-${ev.id}`}
                  onSelect={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); setEventPickerOpen(false); }}
                  className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3 items-start"
                >
                  <Check size={16} className={cn("mt-0.5 shrink-0", selectedEventId === ev.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex flex-col min-w-0">
                    <span className="font-black italic uppercase text-sm leading-tight whitespace-normal">{ev.name}</span>
                    {formatEventSubtitle(ev) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-normal">{formatEventSubtitle(ev)}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const labels = {
    1: "Crítico",
    2: "Muito abaixo",
    3: "Abaixo do esperado",
    4: "Insuficiente",
    5: "Atendeu minimamente",
    6: "Atendeu",
    7: "Atendeu bem",
    8: "Muito bom",
    9: "Ótimo",
    10: "Excelência"
  };

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">Central de Avaliações</h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2">{isConsultation ? "Consulte o andamento das avaliações de cada evento em tempo real." : "Mantenha o ritmo. Avalie a sprint e impulsione a equipe."}</p>
          </div>
          {isManager && (
            <button
              data-testid="button-export-pending"
              onClick={handleExportPending}
              className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
            >
              <Download size={18} /> Exportar Pendentes
            </button>
          )}
          {isEvaluator && (
            <div className="flex flex-col gap-1 md:items-end">
              <span className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] px-1">Selecionar evento</span>
              {renderEventPicker(true)}
            </div>
          )}
        </section>

        {/* STEP 01 — Filtros (managers/consultation pick from the full panel) */}
        {!isEvaluator && (
        <section className="bg-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1.5 bg-[#ccff00] border-l-2 border-b-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wider">ETAPA 01</div>
          <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight mb-1">{isConsultation ? "Filtros" : "Selecionar Evento"}</h3>
          <p className="text-sm text-[#444933] italic mb-5">{isConsultation ? "Selecione o evento e refine a consulta por avaliador ou status." : "Busque pelo nome do evento ou do cliente e selecione para iniciar a avaliação."}</p>

          <div className={cn("grid grid-cols-1 gap-4", isConsultation && "md:grid-cols-3")}>
            <div>
              {isConsultation && (
                <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                  <Calendar size={12} /> Evento
                </p>
              )}
              {renderEventPicker(false)}
            </div>

            {isConsultation && (
              <>
                <div>
                  <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                    <User size={12} /> Avaliador
                  </p>
                  <Select
                    value={selectedAvaliadorId != null ? String(selectedAvaliadorId) : "__all"}
                    onValueChange={(v) => setSelectedAvaliadorId(v === "__all" ? null : Number(v))}
                  >
                    <SelectTrigger data-testid="select-avaliador" className="h-[3.25rem] rounded-none border-2 border-[#191c1e] bg-white italic font-bold text-xs uppercase focus:ring-0 disabled:opacity-50">
                      <SelectValue placeholder="Todos os avaliadores" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-[#191c1e]">
                      <SelectItem value="__all">Todos os avaliadores</SelectItem>
                      {selectedEventId && avaliadorStats.length > 0
                        ? avaliadorStats.map(av => (
                            <SelectItem key={av.id} value={String(av.id)}>{av.name} ({av.submitted}/{av.total})</SelectItem>
                          ))
                        : allAvaliadores.map(av => (
                            <SelectItem key={av.id} value={String(av.id)}>{av.name}</SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                    <ListChecks size={12} /> Status
                  </p>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as "all" | "pending" | "done")}
                  >
                    <SelectTrigger data-testid="select-status-filter" className="h-[3.25rem] rounded-none border-2 border-[#191c1e] bg-white italic font-bold text-xs uppercase focus:ring-0 disabled:opacity-50">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-[#191c1e]">
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="done">Avaliadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
            <Info size={16} className="shrink-0 mt-0.5 text-[#444933]" />
            <p className="text-[11px] md:text-xs font-bold italic uppercase tracking-wide text-[#444933]">
              {isConsultation
                ? "Modo consulta: acompanhe o status de cada avaliação por evento, sem editar notas."
                : "Apenas eventos já configurados e liberados pelo RH aparecem nesta lista."}
            </p>
          </div>
        </section>
        )}

        {/* Evaluator overview — pending vs completed evaluations at a glance */}
        {isEvaluator && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <ListChecks size={22} />
              <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">Minhas Avaliações</h3>
            </div>
            <p className="text-sm text-[#444933] italic px-1 -mt-1">
              Foque no que ainda falta avaliar. As avaliações concluídas ficam na aba ao lado. Clique em um evento para avaliar ou rever.
            </p>
            {configuredEvents.length === 0 ? (
              <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                Nenhum evento liberado para avaliação no momento.
              </div>
            ) : relevantEvaluatorEvents.length === 0 ? (
              <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                Nenhuma avaliação atribuída à sua área nos eventos abertos no momento.
              </div>
            ) : (
              <Tabs defaultValue="todo" className="space-y-4">
                <TabsList className="bg-transparent p-0 h-auto gap-2 justify-start rounded-none">
                  <TabsTrigger
                    value="todo"
                    data-testid="tab-todo"
                    className="rounded-none border-2 border-[#191c1e] bg-white px-4 py-2 font-black italic uppercase text-xs tracking-wider data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none"
                  >
                    A Fazer ({todoEvents.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="done"
                    data-testid="tab-done"
                    className="rounded-none border-2 border-[#191c1e] bg-white px-4 py-2 font-black italic uppercase text-xs tracking-wider data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none"
                  >
                    Concluídas ({doneEvents.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="todo" className="mt-0">
                  {todoEvents.length === 0 ? (
                    <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                      Tudo em dia! Nenhuma avaliação pendente no momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {todoEvents.map(ev => (
                        <EvaluatorEventCard
                          key={ev.id}
                          event={ev}
                          userId={user?.id}
                          selected={selectedEventId === ev.id}
                          onSelect={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="done" className="mt-0">
                  {doneEvents.length === 0 ? (
                    <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                      Nenhuma avaliação concluída ainda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {doneEvents.map(ev => (
                        <EvaluatorEventCard
                          key={ev.id}
                          event={ev}
                          userId={user?.id}
                          selected={selectedEventId === ev.id}
                          onSelect={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </section>
        )}

        {!selectedEventId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-[#191c1e] bg-white">
            <div className="w-16 h-16 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center mb-4 skew-x-[-6deg]">
              <CheckCircle className="text-[#161e00] skew-x-[6deg]" size={32} />
            </div>
            <h2 className="text-2xl italic uppercase font-black tracking-tight mb-2">{isConsultation ? "Pronto para consultar" : "Pronto para avaliar"}</h2>
            <p className="text-[#444933] italic max-w-md">{isConsultation ? "Selecione um evento no menu acima para consultar o andamento das avaliações da equipe." : "Selecione um evento no menu acima para iniciar ou continuar a avaliação da equipe responsável."}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Header Card */}
            {currentEvent && (
              <section className={`bg-[#191c1e] text-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden ${HARD_SHADOW}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Users size={120} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-[#ccff00] text-[#161e00] px-3 py-1 border-2 border-[#ccff00] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                        <span className="inline-block skew-x-[8deg]">Aberto</span>
                      </span>
                      {currentEvent.cycleName && (
                        <span className="bg-transparent text-white px-3 py-1 border-2 border-white/30 font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                          <span className="inline-block skew-x-[8deg]">{currentEvent.cycleName}</span>
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl md:text-4xl italic uppercase font-black tracking-tighter leading-none mb-1">{currentEvent.name}</h2>
                    <p className="text-[#ccff00] font-bold italic uppercase text-lg">{currentEvent.clientName}</p>

                    <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-white/70 italic">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{new Date(currentEvent.startDate).toLocaleDateString('pt-BR')} — {new Date(currentEvent.endDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {(currentEvent.city || currentEvent.location) && (
                        <div className="flex items-center gap-2">
                          <MapPin size={16} />
                          <span>{currentEvent.city ? `${currentEvent.city}${currentEvent.state ? `, ${currentEvent.state}` : ""}` : currentEvent.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>{currentEvent.participantCount} participantes</span>
                      </div>
                    </div>
                  </div>

                  {isManager && (
                    <div className="flex flex-col justify-end">
                      <div className="bg-black/30 border-2 border-white/20 p-4 w-full md:w-64">
                        <p className="text-xs text-white/80 font-bold italic uppercase mb-2">Progresso Geral (Todo o time)</p>
                        <div className="flex items-center justify-between mb-1 text-xs italic font-bold">
                          <span>{Math.round(teamProgressPct)}% Concluído</span>
                        </div>
                        <div className="w-full bg-black/40 border border-white/20 h-2.5">
                          <div className="bg-[#ccff00] h-full transition-[width]" style={{ width: `${teamProgressPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Criteria Column / Evaluation Form */}
              <div className="space-y-4">
                <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight px-1 flex items-center gap-2">
                  {isConsultation ? (<><ListChecks size={22} /> Status das Avaliações</>) : "Critérios de Avaliação"}
                </h3>

                {isConsultation ? (
                  filteredAreaGroups.length === 0 ? (
                    <div className="text-center py-12 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60]">
                      {statusFilter === "pending"
                        ? "Nenhuma avaliação pendente com os filtros atuais."
                        : statusFilter === "done"
                          ? "Nenhuma avaliação concluída com os filtros atuais."
                          : selectedAvaliador
                            ? "Este avaliador não tem critérios atribuídos neste evento."
                            : "Nenhum critério ativo neste evento."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {criteriaLocked && (
                        <div className="flex items-start gap-2.5 bg-[#fff4e5] border-2 border-[#191c1e] px-4 py-3">
                          <Lock size={16} className="shrink-0 mt-0.5 text-[#b02f00]" />
                          <p className="text-[11px] md:text-xs font-bold italic uppercase tracking-wide text-[#b02f00]">Critérios ainda não confirmados — as áreas não podem avaliar até a liberação.</p>
                        </div>
                      )}
                      {filteredAreaGroups.map(g => {
                        const submittedInArea = g.criteria.filter(c => isCriterionDone(c)).length;
                        const areaDone = submittedInArea === g.criteria.length;
                        return (
                          <div key={g.area} data-testid={`status-area-${g.area}`} className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                              <span className="inline-flex items-center gap-2 font-black italic uppercase tracking-tight min-w-0 truncate pr-1.5">
                                <Building2 size={16} className="shrink-0" /> {g.area}
                              </span>
                              <span className={cn("px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block shrink-0", areaDone ? "bg-[#506600] text-[#ccff00]" : "bg-[#ffb5a0] text-[#3b0900]")}>
                                <span className="inline-block skew-x-[8deg]">{submittedInArea}/{g.criteria.length} {areaDone ? "Concluído" : "Pendente"}</span>
                              </span>
                            </div>
                            <ul>
                              {g.criteria.map(c => {
                                const st = criterionStatus(c.criterionId, c.responsibleAreaId ?? null);
                                const assignedNames = c.responsibleAreaId != null ? (assignedEvaluatorsByArea.get(c.responsibleAreaId) ?? []).map(a => a.name) : [];
                                const responsible = assignedNames.length > 0 ? assignedNames.join(", ") : (st.submittedNames[0] ?? null);
                                return (
                                  <li key={c.criterionId} data-testid={`status-crit-${c.criterionId}`} className="flex items-center justify-between gap-3 px-5 py-3 border-t-2 border-[#eceef0] first:border-t-0">
                                    <span className="font-bold italic text-[#191c1e] min-w-0 truncate pr-1.5">{c.criterionName}</span>
                                    <span className="shrink-0 flex items-center gap-2">
                                      <span data-testid={`status-responsible-${c.criterionId}`} className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-nowrap hidden sm:inline-flex items-center gap-1 pr-0.5">
                                        <User size={11} className="shrink-0" /> {responsible ?? "Sem responsável"}
                                      </span>
                                      {st.state === "submitted" ? (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-1"><CheckCircle size={12} /> Preenchido</span>
                                      ) : st.state === "partial" ? (
                                        <span data-testid={`status-partial-${c.criterionId}`} title={`Falta: ${st.pendingNames.join(", ")}`} className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#fff4c2] text-[#5c4a00] border-2 border-[#191c1e] px-2 py-1"><Clock size={12} /> {st.submittedCount}/{st.requiredCount} Parcial</span>
                                      ) : st.state === "draft" ? (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ffdbd1] text-[#862200] border-2 border-[#191c1e] px-2 py-1"><Clock size={12} /> Rascunho</span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#f2f4f6] text-[#747a60] border-2 border-[#191c1e] px-2 py-1"><Clock size={12} /> Falta</span>
                                      )}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : criteriaLocked ? (
                  <div data-testid="notice-criteria-locked" className="text-center py-14 bg-[#fff4e5] border-2 border-[#191c1e] px-6">
                    <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#ff5722] text-white flex items-center justify-center mx-auto mb-4">
                      <Lock size={26} />
                    </div>
                    <h2 className="text-2xl italic uppercase font-black tracking-tight text-[#b02f00] mb-1">Avaliação bloqueada</h2>
                    <p className="text-sm md:text-base italic text-[#444933] max-w-md mx-auto">Os critérios deste evento ainda não foram confirmados pelo RH. Aguarde a liberação para iniciar a avaliação da equipe.</p>
                  </div>
                ) : myCriteria.length === 0 ? (
                  <div data-testid="notice-no-area-criteria" className="text-center py-12 bg-white border-2 border-[#191c1e] px-6">
                    <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#f2f4f6] text-[#747a60] flex items-center justify-center mx-auto mb-4">
                      <Building2 size={24} />
                    </div>
                    <p className="italic uppercase font-bold text-[#747a60] max-w-md mx-auto">Nenhum critério atribuído à sua área neste evento.</p>
                  </div>
                ) : (
                  <div className={`bg-white border-2 border-[#191c1e] p-6 md:p-8 ${HARD_SHADOW}`}>
                    <div className="space-y-10">
                      {myCriteria.map((c, index) => {
                        const ev = getEval(c.criterionId);
                        const submitted = ev?.status === "submitted";
                        const isDraft = ev?.status === "draft";
                        const score = currentScore(c.criterionId);
                        const comment = comments[c.criterionId] ?? ev?.comments ?? "";
                        const audio = currentAudio(c.criterionId);

                        // Áudio é obrigatório para salvar/submeter qualquer avaliação.
                        // Justificativa é sempre opcional.
                        const needsAudio = !audio;

                        return (
                          <div key={c.criterionId} className={cn("criterion-row border-l-4 pl-6 py-2", submitted ? "border-[#506600]" : isDraft ? "border-[#ff5722]" : score > 0 ? "border-[#ccff00]" : "border-[#191c1e]/20")}>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="bg-[#e6e8ea] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-black italic uppercase">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
                                  {c.responsibleAreaName && (
                                    <span className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <Building2 size={11} /> {c.responsibleAreaName}
                                    </span>
                                  )}
                                  {submitted && (
                                    <span className="bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <CheckCircle size={12} /> Submetido
                                    </span>
                                  )}
                                  {isDraft && (
                                    <span className="bg-[#ffdbd1] text-[#862200] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <Clock size={12} /> Rascunho
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">{index + 1}. {c.criterionName}</h4>
                                <p className="text-sm text-[#444933] italic mt-1 leading-relaxed">
                                  {c.criterionDescription && c.criterionDescription.trim().length > 0
                                    ? c.criterionDescription
                                    : "Avalie o desempenho da equipe considerando este critério específico para o evento atual."}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-bold italic uppercase text-[#747a60]">Ritmo Atual</p>
                                <p className="text-[40px] leading-none italic font-black">{score > 0 ? score : "-"}</p>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="grid grid-cols-5 gap-2 md:gap-3">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                                  <ScoreButton
                                    key={val}
                                    score={val}
                                    current={score}
                                    label={labels[val as keyof typeof labels]}
                                    onClick={() => handleScoreClick(c.criterionId, val)}
                                    disabled={submitted}
                                  />
                                ))}
                              </div>
                            </div>

                            {!submitted && (
                              <div className="mt-4 border-2 p-4 border-[#191c1e] bg-[#f2f4f6]">
                                <label className="text-xs font-black italic uppercase flex items-center gap-2 mb-2">
                                  Justificativa / Feedback
                                  <span className="text-[10px] text-[#444933] bg-[#e6e8ea] border border-[#191c1e] px-2 py-0.5 font-bold italic uppercase">Opcional</span>
                                </label>
                                <Textarea
                                  placeholder="Comentários opcionais para a equipe (serão vistos anonimamente)..."
                                  value={comment}
                                  onChange={e => setComments(s => ({ ...s, [c.criterionId]: e.target.value }))}
                                  className="bg-white rounded-none border-2 resize-y min-h-24 italic focus-visible:ring-0 border-[#191c1e]"
                                />

                                <div className={cn("mt-4 border-2 p-4", needsAudio ? "border-[#ba1a1a] bg-[#ffdad6]/20" : "border-[#191c1e] bg-white")}>
                                  <label className="text-xs font-black italic uppercase flex items-center gap-2 mb-2">
                                    Áudio da avaliação
                                    <span className="text-[10px] text-white bg-[#ba1a1a] px-2 py-0.5 font-bold italic uppercase">Obrigatório</span>
                                  </label>
                                  <p className="text-[11px] text-[#444933] italic mb-3 leading-relaxed">
                                    Grave um áudio explicando a nota. Sem áudio não é possível salvar nem submeter a avaliação.
                                  </p>
                                  <AudioRecorder
                                    value={audio}
                                    onChange={path => setAudioOverrides(s => ({ ...s, [c.criterionId]: path ?? "" }))}
                                  />
                                </div>

                                <div className="flex justify-end pt-3">
                                  <button
                                    onClick={() => handleSaveDraft(c.criterionId)}
                                    disabled={score === 0 || needsAudio}
                                    data-testid={`button-save-draft-${c.criterionId}`}
                                    className="bg-white border-2 border-[#191c1e] px-4 py-2 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                                  >
                                    <Save size={14} />
                                    {isDraft ? "Atualizar Rascunho" : "Salvar Rascunho"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {submitted && comment && (
                              <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 mt-4">
                                <p className="text-xs font-black italic uppercase mb-1">Seu Feedback:</p>
                                <p className="text-sm text-[#444933] italic">"{comment}"</p>
                              </div>
                            )}

                            {submitted && audio && (
                              <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 mt-4">
                                <p className="text-xs font-black italic uppercase mb-2">Áudio da avaliação</p>
                                <AudioPlayer objectPath={audio} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sprint goal footer */}
                    <div className="mt-12 pt-8 border-t-4 border-dashed border-[#191c1e] flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center">
                          <Flag size={20} className="text-[#161e00]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold italic uppercase">Meta da Avaliação</p>
                          <div className="w-48 h-2 bg-[#eceef0] mt-1 border border-[#191c1e] overflow-hidden">
                            <div className="h-full bg-[#ccff00]" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Sticky Panel */}
              <div className="sticky top-6 space-y-6">
                <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                  <div className="bg-[#191c1e] text-[#ccff00] px-5 py-4 italic">
                    <h3 className="text-lg font-black uppercase tracking-tight">{isConsultation ? "Status do Time" : "Resumo da Avaliação"}</h3>
                    <p className="text-[11px] font-bold uppercase text-white/70">{isConsultation ? "Acompanhamento da equipe" : "Sua avaliação para este evento"}</p>
                  </div>

                  <div className="p-5 border-b-2 border-[#eceef0]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold italic uppercase text-[#444933]">Progresso</span>
                      <span className="text-sm font-black italic text-[#506600]">{Math.round(isConsultation ? teamProgressPct : progressPct)}%</span>
                    </div>
                    <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2.5 mb-2">
                      <div className="bg-[#ccff00] h-full transition-[width] duration-500" style={{ width: `${isConsultation ? teamProgressPct : progressPct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#747a60] italic">
                      {isConsultation
                        ? `${teamSubmittedCount} de ${activeCriteria.length} critérios submetidos pelo time.`
                        : `${completedCount} de ${myCriteria.length} critérios preenchidos (rascunho ou submetido).`}
                    </p>
                  </div>

                  {/* Confidential administrative info — managers only */}
                  {isManager && (
                    <div className="p-5 bg-[#f2f4f6] space-y-4 border-b-2 border-[#eceef0]">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold italic uppercase text-[#444933]">Equipe</span>
                        <span className="text-sm font-black italic">{participants?.length || 0} pessoas</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold italic uppercase text-[#444933]">Critérios Pendentes</span>
                        <span className="text-sm font-black italic text-[#b02f00]">{activeCriteria.length - teamSubmittedCount}</span>
                      </div>
                      {eventResult && (
                        <div className="pt-2 border-t-2 border-[#e0e3e5] space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black italic uppercase">Nota Parcial da Equipe</span>
                            <div className="text-right">
                              <span className="text-xl font-black italic text-[#506600]">{eventResult.eventScore.toFixed(1)}</span>
                              <span className="text-xs text-[#747a60] italic">/100</span>
                            </div>
                          </div>
                          {!eventResult.hasCalibration && (
                            <p className="text-[10px] font-bold italic uppercase tracking-wide text-[#b02f00] leading-tight">
                              Provisória — antes da calibração. O valor final do colaborador sai após a calibração.
                            </p>
                          )}
                        </div>
                      )}
                      {eventResult?.projectedPlatoon && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold italic uppercase text-[#444933]">Pelotão Projetado</span>
                          <PlatoonBadge platoon={eventResult.projectedPlatoon} colorHex={eventResult.projectedPlatoonColor} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grade summary — evaluators only */}
                  {isEvaluator && myCriteria.length > 0 && (
                    <div className="p-5 border-b-2 border-[#eceef0]">
                      <p className="text-xs font-bold italic uppercase text-[#444933] mb-3">Resumo das Notas</p>
                      <div className="space-y-2">
                        {myCriteria.map(c => {
                          const ev = getEval(c.criterionId);
                          const score = currentScore(c.criterionId);
                          const hasScore = score > 0;
                          const isSubmitted = ev?.status === "submitted";
                          const isDraft = ev?.status === "draft";
                          return (
                            <div key={c.criterionId} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">{c.criterionName}</span>
                                {isSubmitted && <Lock size={11} className="shrink-0 text-[#506600]" />}
                                {isDraft && !isSubmitted && <span className="shrink-0 text-[9px] font-black italic uppercase text-[#862200] tracking-wide">rascunho</span>}
                              </div>
                              {hasScore ? (
                                <span className="shrink-0 text-sm font-black italic text-[#506600]">{score}<span className="text-[10px] text-[#747a60]">/10</span></span>
                              ) : (
                                <span className="shrink-0 text-sm font-black italic text-[#c2c6c9]">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Submission — evaluators only */}
                  {isEvaluator && myCriteria.length > 0 && (
                    <div className="p-5">
                      {allEvaled ? (
                        <div className="flex items-center justify-center gap-2 text-[#506600] bg-[#ccff00]/30 border-2 border-[#506600] p-3 font-bold italic uppercase text-sm">
                          <CheckCircle size={16} /> Você já concluiu sua avaliação
                        </div>
                      ) : allReady ? (
                        <button
                          data-testid="button-submit-eval"
                          onClick={() => setConfirmLaunchOpen(true)}
                          disabled={launching}
                          className={`w-full bg-[#ccff00] border-2 border-[#191c1e] py-4 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                        >
                          <Rocket size={16} /> Lançar Avaliação
                        </button>
                      ) : (
                        <button disabled className="w-full bg-[#eceef0] border-2 border-[#191c1e] py-4 font-bold text-sm italic uppercase tracking-wider opacity-60 cursor-not-allowed">
                          {pendingToFill} {pendingToFill === 1 ? "critério pendente" : "critérios pendentes"}
                        </button>
                      )}

                      {!allEvaled && (
                        <p className="text-[11px] text-center text-[#747a60] italic mt-3 leading-relaxed">
                          {allReady
                            ? <>Ao lançar, suas notas são <strong>submetidas e bloqueadas</strong>. Salvar rascunho é opcional.</>
                            : <>Dê nota e grave o áudio de cada critério (a justificativa é opcional). <strong>Salvar rascunho é opcional</strong> — você pode lançar direto.</>}
                        </p>
                      )}

                      <AlertDialog open={confirmLaunchOpen} onOpenChange={(o) => { if (!launching) setConfirmLaunchOpen(o); }}>
                        <AlertDialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]" data-testid="dialog-confirm-launch">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                              <Rocket size={22} className="text-[#506600]" /> Confirmar lançamento
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-[#444933] italic leading-relaxed">
                              Você está prestes a submeter {toSubmitCount} {toSubmitCount === 1 ? "avaliação" : "avaliações"} para
                              {" "}<strong>{pickedEvent?.name}</strong>. Após o lançamento, as notas ficam
                              {" "}<strong>bloqueadas para edição</strong> e compõem a nota final da equipe. Deseja continuar?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          {isEvaluator && myCriteria.length > 0 && (
                            <div className="border-2 border-[#191c1e] bg-[#f2f4f6] p-4 max-h-60 overflow-y-auto">
                              <p className="text-xs font-bold italic uppercase text-[#444933] mb-3">Resumo das Notas</p>
                              <div className="space-y-2">
                                {myCriteria.map(c => {
                                  const ev = getEval(c.criterionId);
                                  const score = currentScore(c.criterionId);
                                  const hasScore = score > 0;
                                  const isSubmitted = ev?.status === "submitted";
                                  const isDraft = ev?.status === "draft";
                                  return (
                                    <div key={c.criterionId} className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">{c.criterionName}</span>
                                        {isSubmitted && <Lock size={11} className="shrink-0 text-[#506600]" />}
                                        {isDraft && !isSubmitted && <span className="shrink-0 text-[9px] font-black italic uppercase text-[#862200] tracking-wide">rascunho</span>}
                                      </div>
                                      {hasScore ? (
                                        <span className="shrink-0 text-sm font-black italic text-[#506600]">{score}<span className="text-[10px] text-[#747a60]">/10</span></span>
                                      ) : (
                                        <span className="shrink-0 text-sm font-black italic text-[#c2c6c9]">—</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              disabled={launching}
                              data-testid="button-cancel-launch"
                              className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs tracking-wider"
                            >
                              Voltar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => { e.preventDefault(); handleLaunchAll(); }}
                              disabled={launching}
                              data-testid="button-confirm-launch"
                              className="rounded-none border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] font-bold italic uppercase text-xs tracking-wider hover:bg-[#bdf000] disabled:opacity-60"
                            >
                              {launching ? "Lançando..." : "Lançar agora"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>

                {/* Release Feedback Card (Admin only) */}
                {canRelease && eventComplete && (
                  <div className="bg-white border-2 border-dashed border-[#191c1e] p-5">
                    <h4 className="text-xs font-black italic uppercase flex items-center gap-2 mb-2"><Target size={14} /> Ação de Gestão</h4>
                    {feedbackReleased ? (
                      <div className="flex items-center gap-2 text-sm text-[#506600] font-bold italic uppercase">
                        <CheckCircle size={16} /> Feedback liberado para a equipe
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-[#506600] font-bold italic uppercase">
                          <CheckCircle size={16} /> Liberado para calibragem
                        </div>
                        <p className="text-xs text-[#747a60] italic">
                          {eventResult?.hasCalibration
                            ? "Todas as avaliações foram concluídas e a calibragem já está em andamento. Acesse a tela de Calibrações para revisar e finalizar as notas da equipe."
                            : "Todas as avaliações foram concluídas. O evento foi liberado para calibragem — acesse a tela de Calibrações para ajustar as notas antes de liberar o feedback à equipe."}
                        </p>
                        <Link
                          href="/calibrations"
                          data-testid="link-go-to-calibrations"
                          className="w-full bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] py-3 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:bg-[#2a2f33]"
                        >
                          <SlidersHorizontal size={15} /> Ir para Calibrações <ArrowRight size={15} />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
