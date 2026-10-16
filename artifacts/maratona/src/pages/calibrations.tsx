import { useState, useEffect, useRef } from "react";
import { useGetEvents, useGetEvent, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useGetEventComments, useGetCurrentCycle, getGetCalibrationsQueryKey, getGetEventQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useAllPublicTokens } from "@/lib/routing-api";
import { useCalibrationComments, useAddCalibrationComment, useDeleteCalibrationComment, useCalibrationAudit } from "@/lib/calibration-api";
import { getCycleWeekends, weekendsEnd } from "@/lib/utils";
import { BODY } from "@/lib/premium-theme";
import { EventActivityLog } from "@/components/event-activity-log";
import { filterCalibratableEvents, SAVED_REASON_FEEDBACK_MS } from "./calibrations/helpers";
import { deriveCriteria, deriveDirtyState, eventScorePreview } from "./calibrations/derive";
import { EventHero } from "./calibrations/event-hero";
import { PublishConfirmDialog, type PublishItem } from "./calibrations/publish-confirm-dialog";
import { CalibrationEmptyState, CalibrationLoading, CalibrationError, NoCriteria, DiscardEditsDialog } from "./calibrations/page-states";
import { displayCriterionName } from "@/lib/criterion-name";
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
  const canFinalize = ["admin", "rh", "diretoria"].includes(user?.role ?? "");

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
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [pendingSwitchId, setPendingSwitchId] = useState<number | null>(null);
  function switchEvent(eventId: number) { setSelectedEventId(eventId); setCalScores({}); setCalReasons({}); setWeightEdits({}); }
  const [criterionFilter, setCriterionFilter] = useState<"all" | "uncalibrated" | "calibrated" | "pendingPub">("all");
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const [newCommentTexts, setNewCommentTexts] = useState<Record<number, string>>({});
  const [expandedEvalComments, setExpandedEvalComments] = useState<Set<string>>(new Set());
  // O backend restringe a edição de pesos do evento a admin/RH.
  const canEditWeights = ["admin", "rh"].includes(user?.role ?? "");

  const { data: events, isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useGetEvents();
  const { data: cycle } = useGetCurrentCycle();
  const { data: criteria, isLoading: criteriaLoading, isError: criteriaError, refetch: refetchCriteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["ec", selectedEventId] as unknown[] },
  });
  const { data: evaluations, isLoading: evaluationsLoading, isError: evaluationsError, refetch: refetchEvaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: ["evals", selectedEventId] as unknown[] } }
  );
  const { data: calComments } = useCalibrationComments(selectedEventId);
  const { data: calAudit } = useCalibrationAudit(selectedEventId);
  const addCommentMutation = useAddCalibrationComment(selectedEventId ?? 0);
  const deleteCommentMutation = useDeleteCalibrationComment(selectedEventId ?? 0);

  const calQKey = getGetCalibrationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: calibrations, isLoading: calibrationsLoading, isError: calibrationsError, refetch: refetchCalibrations } = useGetCalibrations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: calQKey } }
  );
  const { data: fullEvent } = useGetEvent(selectedEventId ?? 0, {
    query: { enabled: !!selectedEventId, queryKey: getGetEventQueryKey(selectedEventId ?? 0) },
  });

  // Todos os eventos do ciclo aparecem — a calibração pode começar a qualquer
  // momento, inclusive antes de todas as avaliações serem enviadas.
  const calibratableEvents = events ?? [];
  // Até o último evento: evento "fora do período" também ganha o chip do fim de semana.
  const cycleWeekends = getCycleWeekends(cycle?.startDate, weekendsEnd(cycle?.endDate, events));
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
  const { getAreaScores, getMembers, getAvgScore, getCalibration, activeCriteria, childCriterionIdsMap, displayActiveCriteria } =
    deriveCriteria(criteria, calibrations, evaluations);
  const { pendingScore, pendingReasonOnlyCrits, pendingWeightCritIds, unsavedEditsCount, totalDirtyCount } =
    deriveDirtyState({ displayActiveCriteria, getCalibration, calScores, calReasons, weightEdits, publishIntents });
  const scoredCriteria = displayActiveCriteria.filter(c => getAvgScore(c.criterionId) != null);
  // Nota do evento (média das avaliações e, se houver, com a calibração).
  const eventScore = eventScorePreview({
    criteria: displayActiveCriteria,
    getMembers,
    calibrationOf: id => { const v = getCalibration(id)?.calibratedScore; return v != null ? Number(v) : null; },
    pendingScore,
  });
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

  // Salvos e ainda não publicados: só valem na nota depois de publicar.
  const pendingPublishCount = displayActiveCriteria.filter(c => getCalibration(c.criterionId)?.pendingPublish).length;

  // Critérios filtrados por criterionFilter
  const filteredActiveCriteria = criterionFilter === "pendingPub"
    ? displayActiveCriteria.filter(c => getCalibration(c.criterionId)?.pendingPublish)
    : criterionFilter === "uncalibrated"
    ? displayActiveCriteria.filter(c => !getCalibration(c.criterionId))
    : criterionFilter === "calibrated"
    ? displayActiveCriteria.filter(c => !!getCalibration(c.criterionId))
    : displayActiveCriteria;

  const alreadyReleased = !!feedback?.feedbackReleased;
  const feedbackReleasedAtDate = feedback?.feedbackReleasedAt ? new Date(feedback.feedbackReleasedAt) : null;
  const partialPublishedAtDate = feedback?.partialPublishedAt ? new Date(feedback.partialPublishedAt) : null;

  const pickerProps: EventPickerProps = {
    eventPickerOpen,
    eventsLoading,
    setEventPickerOpen,
    calibratableEvents,
    filteredCalibratableEvents,
    pickedEvent,
    selectedEventId,
    onSelectEvent: (eventId: number) => {
      setEventPickerOpen(false);
      // Trocar de evento descarta o que foi digitado e não salvo: pergunta antes.
      if (eventId !== selectedEventId && totalDirtyCount > 0) { setPendingSwitchId(eventId); return; }
      switchEvent(eventId);
    },
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

  // Links do evento (admin/RH): mostra "via link: Freela" no detalhe por área.
  const { data: eventTokens } = useAllPublicTokens(["admin", "rh"].includes(user?.role ?? "") ? selectedEventId : null);

  const rowProps: CriterionRowSharedProps = {
    getAreaScores,
    getMembers,
    tokens: eventTokens,
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

  // Publicar: confirmação com o que vai valer. Se há algo digitado e não salvo
  // (ou nada calibrado), o próprio fluxo orienta com o aviso de sempre.
  const calibratedForPublish = displayActiveCriteria.filter(c => getCalibration(c.criterionId) != null);
  const publishItems: PublishItem[] = calibratedForPublish.map(c => {
    const cal = getCalibration(c.criterionId);
    return { id: c.criterionId, name: displayCriterionName(c.criterionName), score: cal?.calibratedScore ?? null, intent: publishIntents[c.criterionId] ?? "partial", pending: !!cal?.pendingPublish };
  });
  function onPublishClick() {
    if (unsavedEditsCount > 0 || calibratedForPublish.length === 0) { void handlePublishAll(); return; }
    setPublishConfirmOpen(true);
  }
  async function confirmPublish() {
    await handlePublishAll();
    setPublishConfirmOpen(false);
  }

  // Nota oficial só existe depois de publicar (parcial ou final): antes disso o
  // número do feedback é uma conta com o rascunho e não vale para ninguém.
  const hasPublication = !!pickedEvent && (!!pickedEvent.isHistorical || (pickedEvent.finalCalibratedCriteria ?? 0) > 0 || (pickedEvent.partialPublishedCount ?? 0) > 0);
  const teamCount = fullEvent?.participants ? fullEvent.participants.filter(p => p.confirmed !== false && p.countsForScore !== false).length : null;
  const eventDataLoading = !!selectedEventId && (criteriaLoading || calibrationsLoading || evaluationsLoading);
  const eventDataError = !!selectedEventId && (criteriaError || calibrationsError || evaluationsError);
  const retryEventData = () => { void refetchCriteria(); void refetchCalibrations(); void refetchEvaluations(); };
  const pendingSwitchEvent = pendingSwitchId != null ? calibratableEvents.find(e => e.id === pendingSwitchId) : undefined;

  return (
    <div className="min-h-full bg-background text-foreground" style={{ fontFamily: BODY }}>
      <CalibrationHeader pickerProps={pickerProps} cycleName={cycle?.name ?? null} />

      <div className="px-4 md:px-6 py-5 md:py-6">
        {!selectedEventId && (
          eventsError
            ? <CalibrationError title="Não foi possível carregar os eventos" onRetry={() => { void refetchEvents(); }} />
            : <CalibrationEmptyState events={calibratableEvents} loading={eventsLoading} onOpenPicker={() => setEventPickerOpen(true)} onSelect={pickerProps.onSelectEvent} />
        )}

        {selectedEventId && pickedEvent && (
          <div className="space-y-5">
          {/* Grade própria: a coluna de contexto fica presa só enquanto os critérios rolam. */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] items-start">
            {/* Coluna principal: evento, barra de trabalho e critérios */}
            <div className="min-w-0 space-y-4">
              <EventHero
                event={pickedEvent}
                teamCount={teamCount}
                average={eventScore.average}
                calibrated={eventScore.calibrated}
                feedback={feedback}
                hasPublication={hasPublication}
                finalReleased={alreadyReleased || allCriteriaFinalPublished}
                feedbackReleasedAtDate={feedbackReleasedAtDate}
                partialPublishedAtDate={partialPublishedAtDate}
                dataState={eventDataError ? "error" : eventDataLoading ? "loading" : "ready"}
              />

              {eventDataError ? (
                <CalibrationError title="Não foi possível carregar os critérios deste evento" onRetry={retryEventData} />
              ) : eventDataLoading ? (
                <CalibrationLoading />
              ) : displayActiveCriteria.length === 0 ? (
                <NoCriteria eventId={selectedEventId} />
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
                    totalCount={displayActiveCriteria.length}
                    calibratedCount={displayActiveCriteria.length - pendingCount}
                    totalDirtyCount={totalDirtyCount}
                    pendingPublishCount={pendingPublishCount}
                    handleSaveAll={handleSaveAll}
                    onPublishClick={onPublishClick}
                  />
                  <CriteriaTable
                    filteredActiveCriteria={filteredActiveCriteria}
                    displayActiveCount={displayActiveCriteria.length}
                    calibratedCount={displayActiveCriteria.length - pendingCount}
                    pendingPublishCount={pendingPublishCount}
                    rowProps={rowProps}
                    criterionFilter={criterionFilter}
                    setCriterionFilter={setCriterionFilter}
                    autoFillableCount={autoFillableCriteria.length}
                    canAutoFill={canFinalize}
                    autoFillBusy={savingAutoFill || savingAll || publishingAll}
                    savingAutoFill={savingAutoFill}
                    onAutoFill={() => { void autoFillFromEvaluator(); }}
                  />
                </>
              )}
            </div>

            {/* Contexto: equipe, Matriz de Conformidade, comentários do evento */}
            <CalibrationSidebar
              selectedEventId={selectedEventId}
              fullEvent={fullEvent}
              teamPanelOpen={teamPanelOpen}
              setTeamPanelOpen={setTeamPanelOpen}
              conformityState={conformityState}
              eventComments={eventComments}
            />

          </div>
            <EventActivityLog eventId={selectedEventId} />
          </div>
        )}
      </div>

      <PublishConfirmDialog
        open={publishConfirmOpen}
        onOpenChange={setPublishConfirmOpen}
        publishing={publishingAll}
        items={publishItems}
        eventName={pickedEvent?.name}
        onConfirm={() => { void confirmPublish(); }}
      />
      <DiscardEditsDialog
        open={pendingSwitchId != null}
        count={totalDirtyCount}
        targetName={pendingSwitchEvent?.name}
        onCancel={() => setPendingSwitchId(null)}
        onConfirm={() => { if (pendingSwitchId != null) switchEvent(pendingSwitchId); setPendingSwitchId(null); }}
      />
    </div>
  );
}
