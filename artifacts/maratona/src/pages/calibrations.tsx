import { useState, useEffect, useRef } from "react";
import { useGetEvents, useGetEvent, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useGetEventComments, useGetCurrentCycle, getGetCalibrationsQueryKey, getGetEventQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Target } from "lucide-react";
import { useCalibrationComments, useAddCalibrationComment, useDeleteCalibrationComment, useCalibrationAudit } from "@/lib/calibration-api";
import { getCycleWeekends } from "@/lib/utils";
import { CONDENSED, BODY, usePremiumTheme } from "@/lib/premium-theme";
import { EventActivityLog } from "@/components/event-activity-log";
import { calibrationEventChip, filterCalibratableEvents, getPickerPalette, SAVED_REASON_FEEDBACK_MS } from "./calibrations/helpers";
import { deriveCriteria, deriveDirtyState } from "./calibrations/derive";
import { useCalibrationSaveFlow } from "./calibrations/use-calibration-save-flow";
import { useConformity } from "./calibrations/use-conformity";
import { CalibrationHeader } from "./calibrations/calibration-header";
import { CalibrationSidebar } from "./calibrations/calibration-sidebar";
import { CalibrationActionBar } from "./calibrations/calibration-action-bar";
import { CriteriaTable } from "./calibrations/criteria-table";
import type { CriterionRowSharedProps } from "./calibrations/criterion-row";
import type { EventPickerProps } from "./calibrations/event-picker";

// Página de Calibrações. O estado compartilhado vive aqui e desce por props;
// helpers, derivações, o fluxo salvar→publicar (use-calibration-save-flow) e
// os blocos visuais ficam em ./calibrations/.
export default function CalibrationsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isDark } = usePremiumTheme();
  const canFinalize = ["admin", "rh", "diretoria"].includes(user?.role ?? "");

  const pk = getPickerPalette(isDark);
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
  // Feedback "Salvo" na justificativa: entra após gravação bem-sucedida e sai
  // sozinho após SAVED_REASON_FEEDBACK_MS (um timer por critério).
  const [savedReasonIds, setSavedReasonIds] = useState<Set<number>>(new Set());
  const savedReasonTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => { Object.values(savedReasonTimers.current).forEach(clearTimeout); }, []);
  function markReasonSaved(critId: number) {
    setSavedReasonIds(prev => new Set(prev).add(critId));
    clearTimeout(savedReasonTimers.current[critId]);
    savedReasonTimers.current[critId] = setTimeout(() => {
      setSavedReasonIds(prev => { const n = new Set(prev); n.delete(critId); return n; });
      delete savedReasonTimers.current[critId];
    }, SAVED_REASON_FEEDBACK_MS);
  }
  const [savingCritId, setSavingCritId] = useState<number | null>(null);
  const [weightEdits, setWeightEdits] = useState<Record<number, string>>({});
  const [savingWeightId, setSavingWeightId] = useState<number | null>(null);
  // Intenção de publicação por critério: "partial" | "final"
  const [publishIntents, setPublishIntents] = useState<Record<number, "partial" | "final">>({});
  const [publishingAll, setPublishingAll] = useState(false);
  const [criterionFilter, setCriterionFilter] = useState<"all" | "uncalibrated" | "calibrated">("all");
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [newCommentTexts, setNewCommentTexts] = useState<Record<number, string>>({});
  const [expandedEvalComments, setExpandedEvalComments] = useState<Set<string>>(new Set());
  // O backend restringe a edição de pesos do evento a admin/RH.
  const canEditWeights = ["admin", "rh"].includes(user?.role ?? "");

  const { data: events } = useGetEvents();
  const { data: cycle } = useGetCurrentCycle();
  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["ec", selectedEventId] as unknown[] },
  });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: ["evals", selectedEventId] as unknown[] } }
  );
  const { data: calComments } = useCalibrationComments(selectedEventId);
  const { data: calAudit } = useCalibrationAudit(selectedEventId);
  const addCommentMutation = useAddCalibrationComment(selectedEventId ?? 0);
  const deleteCommentMutation = useDeleteCalibrationComment(selectedEventId ?? 0);

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
  const filteredCalibratableEvents = filterCalibratableEvents(calibratableEvents, eventStatusFilter, filterDateFrom, filterDateTo, eventSearchText);
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

  // Derivações puras (fusão pai/filho, notas dos avaliadores, pendências).
  // Calculadas antes do fluxo salvar→publicar, que as recebe por parâmetro.
  const { getAreaScores, getAvgScore, getCalibration, activeCriteria, childCriterionIdsMap, displayActiveCriteria } =
    deriveCriteria(criteria, calibrations, evaluations);
  const { pendingScore, pendingReasonOnlyCrits, pendingWeightCritIds, unsavedEditsCount, totalDirtyCount } =
    deriveDirtyState({ displayActiveCriteria, getCalibration, calScores, calReasons, weightEdits, publishIntents });
  const scoredCriteria = displayActiveCriteria.filter(c => getAvgScore(c.criterionId) != null);
  // Auto-preenche calibrações para critérios que têm nota do avaliador mas ainda
  // não têm calibração — útil após importar avaliações via formulário.
  const autoFillableCriteria = scoredCriteria.filter(c => !getCalibration(c.criterionId));

  // Mutations de peso/calibração/publicação + feedback do evento (mesma ordem de hooks de antes).
  const {
    updateWeightMutation,
    saveWeight,
    savingAll,
    savingAutoFill,
    feedback,
    handlePublishAll,
    saveCalibration,
    autoFillFromEvaluator,
    handleSaveAll,
  } = useCalibrationSaveFlow({
    selectedEventId, qc, toast, criteria, calQKey,
    weightEdits, setWeightEdits, setSavingWeightId,
    calScores, setCalScores, calReasons, setCalReasons, setSavingCritId, markReasonSaved,
    publishIntents, setPublishingAll,
    displayActiveCriteria, childCriterionIdsMap, getCalibration, getAvgScore,
    pendingScore, pendingReasonOnlyCrits, pendingWeightCritIds, unsavedEditsCount, totalDirtyCount,
    autoFillableCriteria,
  });

  // Conformidade
  const conformityState = useConformity({ selectedEventId, qc, user, fullEvent });

  const { data: eventComments } = useGetEventComments(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-comments", selectedEventId] as unknown[] },
  });

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

  // Critérios com peso > 0 (únicos que entram nos contadores de calibração)
  const scorableActiveCriteria = displayActiveCriteria.filter(c => Number(c.weightOverride ?? c.originalWeight ?? 0) > 0);

  // Quantos critérios já publicados como Final
  const finalPublishedCount = scorableActiveCriteria.filter(c => !!c.finalPublishedAt).length;
  const allCriteriaFinalPublished = scorableActiveCriteria.length > 0 && finalPublishedCount === scorableActiveCriteria.length;

  // Critérios filtrados por criterionFilter
  const filteredActiveCriteria = criterionFilter === "uncalibrated"
    ? displayActiveCriteria.filter(c => !getCalibration(c.criterionId))
    : criterionFilter === "calibrated"
    ? displayActiveCriteria.filter(c => !!getCalibration(c.criterionId))
    : displayActiveCriteria;

  const alreadyReleased = !!feedback?.feedbackReleased;
  const feedbackReleasedAtDate = feedback?.feedbackReleasedAt ? new Date(feedback.feedbackReleasedAt) : null;
  const partialPublishedAtDate = feedback?.partialPublishedAt ? new Date(feedback.partialPublishedAt) : null;

  const currentPubBadge = pickedEvent ? calibrationEventChip(pickedEvent) : null;

  const pickerProps: EventPickerProps = {
    pk,
    eventPickerOpen,
    setEventPickerOpen,
    calibratableEvents,
    filteredCalibratableEvents,
    pickedEvent,
    selectedEventId,
    onSelectEvent: (eventId: number) => { setSelectedEventId(eventId); setCalScores({}); setCalReasons({}); setWeightEdits({}); setEventPickerOpen(false); },
    eventStatusFilter,
    setEventStatusFilter,
    eventSearchText,
    setEventSearchText,
    cycleWeekends,
    filterDateFrom,
    setFilterDateFrom,
    filterDateTo,
    setFilterDateTo,
  };

  const rowProps: CriterionRowSharedProps = {
    getAreaScores,
    getAvgScore,
    getCalibration,
    childCriterionIdsMap,
    activeCriteria,
    calScores,
    setCalScores,
    calReasons,
    setCalReasons,
    savedReasonIds,
    setSavedReasonIds,
    savingCritId,
    savingAll,
    saveCalibration,
    expandedEvalComments,
    setExpandedEvalComments,
    calAudit,
    calComments,
    newCommentTexts,
    setNewCommentTexts,
    canFinalize,
    addCommentMutation,
    deleteCommentMutation,
    toast,
    canEditWeights,
    weightEdits,
    setWeightEdits,
    savingWeightId,
    updateWeightPending: updateWeightMutation.isPending,
    saveWeight,
    publishIntents,
    setPublishIntents,
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>

      {/* ── COMPACT STICKY HEADER ── */}
      <CalibrationHeader
        pickerProps={pickerProps}
        showPubBadge={!!(pickedEvent && currentPubBadge)}
        alreadyReleased={alreadyReleased}
        allCriteriaFinalPublished={allCriteriaFinalPublished}
        partialPublishedAtDate={partialPublishedAtDate}
        feedbackReleasedAtDate={feedbackReleasedAtDate}
        pendingCount={pendingCount}
      />

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
          <CalibrationSidebar
            selectedEventId={selectedEventId}
            pickedEvent={pickedEvent}
            feedback={feedback}
            fullEvent={fullEvent}
            teamPanelOpen={teamPanelOpen}
            setTeamPanelOpen={setTeamPanelOpen}
            conformityState={conformityState}
            eventComments={eventComments}
          />

          {/* ── LEFT COLUMN: Calibrations table ── */}
          <div className="flex-1 min-w-0 space-y-3 lg:order-1">

            {/* ── COMPACT ACTION BAR ── */}
          {displayActiveCriteria.length === 0 ? (
            <div className="rounded-xl text-center py-10 font-bold uppercase text-sm" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
              Nenhum critério ativo para este evento.
            </div>
          ) : (
            <>
              <CalibrationActionBar
                autoFillableCount={autoFillableCriteria.length}
                canFinalize={canFinalize}
                savingAutoFill={savingAutoFill}
                savingAll={savingAll}
                publishingAll={publishingAll}
                autoFillFromEvaluator={autoFillFromEvaluator}
                finalPublishedCount={finalPublishedCount}
                scorableCount={scorableActiveCriteria.length}
                criterionFilter={criterionFilter}
                setCriterionFilter={setCriterionFilter}
                alreadyReleased={alreadyReleased}
                allCriteriaFinalPublished={allCriteriaFinalPublished}
                feedbackReleasedAtDate={feedbackReleasedAtDate}
                partialPublishedAtDate={partialPublishedAtDate}
                totalDirtyCount={totalDirtyCount}
                unsavedEditsCount={unsavedEditsCount}
                handleSaveAll={handleSaveAll}
                handlePublishAll={handlePublishAll}
              />

              {/* ── CRITERIA TABLE ── */}
              <CriteriaTable
                filteredActiveCriteria={filteredActiveCriteria}
                displayActiveCount={displayActiveCriteria.length}
                rowProps={rowProps}
              />


            </>
          )}
          </div>{/* end left column */}
        </div>
        )}

        {selectedEventId && (
          <div className="mt-4">
            <EventActivityLog eventId={selectedEventId} />
          </div>
        )}

      </div>

    </div>
  );
}
