// Detalhe do Evento. A página busca os dados, guarda o estado compartilhado
// (formulário da Matriz, diálogos) e as mutações usadas por mais de uma
// seção; a apresentação de cada bloco vive em ./event-detail/.
import { useRoute } from "wouter";
import { useState, useEffect, useMemo } from "react";
import {
  useGetEvent, useGetEventResult, useGetEvaluations, useUpdateEventParticipant, useGetEventConformity,
  useConfirmEventResults, useUnconfirmEventResults,
  getGetEventQueryKey, getGetEventResultQueryKey, getGetEvaluationsQueryKey, getGetEventConformityQueryKey,
  getGetQuarterlyResultsQueryKey, getGetRankingQueryKey, getGetEventsQueryKey, ApiError,
  useListCycleOptions, getListCycleOptionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, hasRole } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { EventActivityLog } from "@/components/event-activity-log";
import { eventPeriodPosition } from "@/lib/utils";
import { isNextCycleEvent, opensLabelFor, areaResponseCounts } from "./events/rules";
import { Link } from "wouter";
import { ArrowLeft, SearchX } from "lucide-react";
import { Bone, EmptyBlock, ErrorBlock, btnGhost, btnSmall } from "./event-detail/detail-ui";
import { matchCriterionByName, parseImportedConformityRatio, parseImportedCriteriaScores } from "./event-detail/helpers";
import type { ConformityForm, ImportedCriterionScore, ResultsDialogMode } from "./event-detail/types";
import { EventHeader } from "./event-detail/event-header";
import { SummaryCards } from "./event-detail/summary-cards";
import { CriteriaSection } from "./event-detail/criteria-section";
import { ImportedNotesSection } from "./event-detail/imported-notes-section";
import { TeamSection } from "./event-detail/team-section";
import { AddParticipantDialog, RemoveParticipantDialog } from "./event-detail/team-dialogs";
import { ConformitySection } from "./event-detail/conformity-section";
import { PerformanceSection } from "./event-detail/performance-section";
import { EventCommentsPanel } from "./event-detail/event-comments-panel";

const EMPTY_CONFORMITY_FORM: ConformityForm = {
  epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null,
  epiComment: "", estaiamentosComment: "", guardaEquipamentosComment: "", condutaComment: "",
  absencesResponse: null, absencesReport: "", standoutResponse: null, standoutJustification: "",
};

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const id = params ? parseInt(params.id) : 0;

  const { user } = useAuth();
  const canViewResult = !!user && ["admin", "rh", "diretoria"].includes(user.role);

  const { data: event, isLoading, isError, error, refetch } = useGetEvent(id, {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id) },
  });

  const { data: result } = useGetEventResult(id, {
    query: { enabled: !!id && canViewResult, queryKey: getGetEventResultQueryKey(id) },
  });
  const participantResults = result?.participants ?? [];
  const hasPerformanceTable = !!result && result.eventScore > 0 && participantResults.length > 0;

  const { data: evaluations } = useGetEvaluations(
    { eventId: id },
    { query: { enabled: !!id && canViewResult, queryKey: getGetEvaluationsQueryKey({ eventId: id }) } }
  );

  const { toast } = useToast();
  const qc = useQueryClient();

  // Evento de ciclo FECHADO (ou de um ciclo que não é o atual): só consulta,
  // como a API (409 em qualquer escrita). Exceção igual à da API: evento
  // "fora do período" de um ciclo fechado (vai para o próximo ciclo) segue editável.
  const { data: cycleOptions } = useListCycleOptions({ query: { queryKey: getListCycleOptionsQueryKey(), staleTime: 5 * 60_000 } });
  const eventCycle = event ? (cycleOptions?.find(c => c.id === event.cycleId) ?? null) : null;
  const readOnlyCycle = !!event && !!eventCycle && (eventCycle.status === "closed"
    ? eventPeriodPosition(event, eventCycle) !== "after"
    : !eventCycle.isCurrent);

  const canManage = !readOnlyCycle && !!user && ["admin", "rh"].includes(user.role);
  const isOperador = hasRole(user, "operador");
  // Gestão de equipe (adicionar/remover participante) também é permitida ao
  // papel "operador" — que NÃO pode confirmar resultados financeiros, editar
  // nota histórica, nem ver/gerenciar a Matriz de Conformidade (só canManage).
  const canManageTeam = !readOnlyCycle && (canManage || isOperador);
  // Evento do PRÓXIMO ciclo: a API recusa respostas da Matriz (409 EVENT_NEXT_CYCLE)
  // até o ciclo novo existir — a Matriz fica só leitura; o responsável pode ser escolhido.
  const nextCycle = !!event && !event.isHistorical && isNextCycleEvent(event, eventCycle);
  const canManageConformity = !readOnlyCycle && !nextCycle && (canManage || (!!user && user.id === event?.conformityEvaluatorUserId));

  // ── Matriz de Conformidade: o formulário fica aqui porque os cards do topo o leem ──
  const { data: conformityData } = useGetEventConformity(id, {
    query: { enabled: !!id, queryKey: getGetEventConformityQueryKey(id) },
  });
  const [conformityForm, setConformityForm] = useState<ConformityForm>(EMPTY_CONFORMITY_FORM);
  const importedConformityRatio = useMemo(
    () => (event?.isHistorical && event.importedNotes ? parseImportedConformityRatio(event.importedNotes) : null),
    [event?.isHistorical, event?.importedNotes]
  );
  const importedConformityAllValue = importedConformityRatio
    ? importedConformityRatio.sim === importedConformityRatio.total
      ? true
      : importedConformityRatio.sim === 0
        ? false
        : null
    : null;

  useEffect(() => {
    if (conformityData) {
      setConformityForm({
        epi: conformityData.epi ?? null,
        estaiamentos: conformityData.estaiamentos ?? null,
        guardaEquipamentos: conformityData.guardaEquipamentos ?? null,
        conduta: conformityData.conduta ?? null,
        epiComment: conformityData.epiComment ?? "",
        estaiamentosComment: conformityData.estaiamentosComment ?? "",
        guardaEquipamentosComment: conformityData.guardaEquipamentosComment ?? "",
        condutaComment: conformityData.condutaComment ?? "",
        absencesResponse: conformityData.absencesResponse ?? null,
        absencesReport: conformityData.absencesReport ?? "",
        standoutResponse: conformityData.standoutResponse ?? null,
        standoutJustification: conformityData.standoutJustification ?? "",
      });
    } else if (importedConformityAllValue !== null) {
      setConformityForm(f => ({
        ...f,
        epi: importedConformityAllValue,
        estaiamentos: importedConformityAllValue,
        guardaEquipamentos: importedConformityAllValue,
        conduta: importedConformityAllValue,
      }));
    }
  }, [conformityData?.id, importedConformityAllValue]);

  // ── Notas de critério importadas (eventos históricos) ──
  const importedCriteriaScores = useMemo(
    () => (event?.isHistorical && event.importedNotes ? parseImportedCriteriaScores(event.importedNotes) : []),
    [event?.isHistorical, event?.importedNotes]
  );
  const importedCriteriaMap = useMemo(() => {
    const map = new Map<number, ImportedCriterionScore>();
    if (importedCriteriaScores.length === 0 || !result?.criteriaDetails) return map;
    const catalog = result.criteriaDetails.map(c => ({ criterionId: c.criterionId, criterionName: c.criterionName }));
    for (const p of importedCriteriaScores) {
      const cid = matchCriterionByName(p.rawName, catalog);
      if (cid != null && !map.has(cid)) map.set(cid, p);
    }
    return map;
  }, [importedCriteriaScores, result?.criteriaDetails]);

  // ── Confirmar / desconfirmar resultados ──
  const invalidateCycle = () => {
    qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetEventResultQueryKey(id) });
    qc.invalidateQueries({ queryKey: getGetQuarterlyResultsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
    qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
  };
  const confirmResults = useConfirmEventResults({
    mutation: {
      onSuccess: (data) => {
        invalidateCycle();
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
        invalidateCycle();
        toast({ title: "Confirmação revertida", description: "O evento deixou de contar na elegibilidade e na nota dos colaboradores." });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao reverter confirmação", description: e.message, variant: "destructive" }),
    },
  });
  const resultsConfirmBusy = confirmResults.isPending || unconfirmResults.isPending;
  const [resultsDialog, setResultsDialog] = useState<ResultsDialogMode>(null);
  const submitResultsDialog = () => {
    const opts = { onSettled: () => setResultsDialog(null) };
    if (resultsDialog === "confirm") confirmResults.mutate({ id }, opts); else unconfirmResults.mutate({ id }, opts);
  };

  // ── Equipe ──
  const [pendingRemoveParticipant, setPendingRemoveParticipant] = useState<number | null>(null);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const updateParticipant = useUpdateEventParticipant({
    mutation: {
      onSuccess: (_data, vars) => {
        invalidateCycle();
        if (vars.data.confirmed !== undefined) {
          toast({ title: vars.data.confirmed ? "Colaborador reativado" : "Colaborador marcado como inativo" });
        } else if (vars.data.functionName !== undefined) {
          toast({ title: "Cargo no evento atualizado" });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) return <EventDetailSkeleton />;

  if (!event) {
    const notFound = !isError || (error instanceof ApiError && error.status === 404);
    return (
      <div className="min-h-full">
        <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 min-h-14 lg:h-16 flex items-center">
          <Link href="/events" className={`${btnGhost} -ml-3`}><ArrowLeft size={15} aria-hidden /> Eventos</Link>
        </div>
        <div className="px-4 md:px-6 py-8 max-w-3xl mx-auto">
          <h1 className="sr-only">{notFound ? "Evento não encontrado" : "Erro ao carregar o evento"}</h1>
          {notFound ? (
            <div className="rounded-2xl border border-dashed border-border bg-card">
              <EmptyBlock icon={SearchX} title="Evento não encontrado" testId="event-not-found"
                action={<Link href="/events" className={btnSmall}><ArrowLeft size={14} aria-hidden /> Voltar para Eventos</Link>}>
                O evento não existe mais (pode ter sido mesclado ou excluído) ou você não tem acesso a ele.
              </EmptyBlock>
            </div>
          ) : (
            <ErrorBlock title="Não foi possível carregar o evento" onRetry={() => { void refetch(); }} />
          )}
        </div>
      </div>
    );
  }

  const activeCriteriaCount = (event.criteria ?? []).filter(c => c.active).length;
  // Ciclo por área: respostas por área (a mesma conta da lista de Eventos e da Central).
  const areaCounts = canViewResult && eventCycle?.areaEvaluation && evaluations ? areaResponseCounts(event.criteria ?? [], evaluations) : null;

  return (
    <div className="min-h-full">
      <EventHeader
        event={event}
        canManage={canManage}
        readOnlyCycle={readOnlyCycle ? (eventCycle ?? null) : null}
        nextCycle={nextCycle}
        opensLabel={event.isHistorical ? null : opensLabelFor(event, eventCycle)}
        canSeeTimeline={!!user && ["admin", "rh"].includes(user.role)}
        resultsConfirmBusy={resultsConfirmBusy}
        resultsDialog={resultsDialog}
        setResultsDialog={setResultsDialog}
        onSubmitResultsDialog={submitResultsDialog}
        placar={
          <SummaryCards event={event} result={result} conformityForm={conformityForm} activeCriteriaCount={activeCriteriaCount}
            canViewResult={canViewResult} showMatrix={!isOperador} areaCounts={areaCounts} />
        }
      />

      {/* Celular/tablet: uma coluna, na ordem de leitura. Desktop largo: o que
          se avalia à esquerda; equipe, comentários e o log à direita. */}
      <div className="px-4 md:px-6 py-5 max-w-[1440px] mx-auto flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <div className="contents xl:flex xl:flex-col xl:gap-5 xl:min-w-0">
          {/* ── Critérios de Avaliação (leitura — gestão de critérios agora em Avaliações) ── */}
          {canViewResult && result && result.criteriaDetails && result.criteriaDetails.length > 0 && (
            <div className="order-1 xl:order-none">
              <CriteriaSection criteriaDetails={result.criteriaDetails} evaluations={evaluations} importedCriteriaMap={importedCriteriaMap} />
            </div>
          )}

          {/* Eventos históricos: observações importadas */}
          {event.isHistorical && (
            <div className="order-2 xl:order-none">
              <ImportedNotesSection eventId={event.id} currentScore={event.importedScore} currentNotes={event.importedNotes} canManage={canManage} canView={canViewResult} />
            </div>
          )}

          {/* ── Matriz de Conformidade — não visível para "operador" (não vê notas/respostas) ── */}
          {!isOperador && (
            <div className="order-4 xl:order-none">
              <ConformitySection
                id={id}
                event={event}
                canManage={canManage}
                canManageConformity={canManageConformity}
                conformityData={conformityData}
                conformityForm={conformityForm}
                setConformityForm={setConformityForm}
                importedConformityRatio={importedConformityRatio}
                importedConformityAllValue={importedConformityAllValue}
                conformityPenalty={result?.conformityPenalty}
                readOnly={readOnlyCycle}
                nextCycle={nextCycle && !readOnlyCycle}
              />
            </div>
          )}

          {/* ── Performance Individual ── */}
          {hasPerformanceTable && <div className="order-5 xl:order-none"><PerformanceSection participants={participantResults} /></div>}
        </div>

        <div className="contents xl:flex xl:flex-col xl:gap-5 xl:min-w-0 xl:col-start-2 xl:row-start-1">
          {/* ── Equipe Alocada ── */}
          {((event.participants && event.participants.length > 0) || canManageTeam) && (
            <div className="order-3 xl:order-none">
              <TeamSection
                id={id}
                event={event}
                canManageTeam={canManageTeam}
                updateParticipant={updateParticipant}
                onAddParticipant={() => setAddParticipantOpen(true)}
                onRequestRemoveParticipant={setPendingRemoveParticipant}
              />
            </div>
          )}

          {!event.isHistorical && <div className="order-6 xl:order-none"><EventCommentsPanel eventId={id} readOnly={readOnlyCycle} /></div>}
          <div className="order-7 xl:order-none"><EventActivityLog eventId={id} /></div>
        </div>
      </div>

      <RemoveParticipantDialog id={id} event={event} pendingParticipantId={pendingRemoveParticipant} onClose={() => setPendingRemoveParticipant(null)} />
      <AddParticipantDialog id={id} event={event} canManageTeam={canManageTeam} open={addParticipantOpen} onOpenChange={setAddParticipantOpen} />
    </div>
  );
}

/** Carregando: barra do topo, cartão do evento e duas seções. */
function EventDetailSkeleton() {
  return (
    <div className="min-h-full" role="status" aria-label="Carregando o evento">
      <div className="bg-card border-b border-border px-4 md:px-6 min-h-14 lg:h-16 flex items-center gap-3">
        <Bone className="h-4 w-24" /><Bone className="h-4 w-48 hidden sm:block" />
        <div className="ml-auto hidden lg:flex gap-2"><Bone className="h-9 w-28 rounded-lg" /><Bone className="h-9 w-28 rounded-lg" /><Bone className="h-9 w-44 rounded-lg" /></div>
      </div>
      <div className="px-4 md:px-6 pt-5 max-w-[1440px] mx-auto space-y-5">
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-5 space-y-3">
            <Bone className="h-3 w-32" /><Bone className="h-9 w-2/3 max-w-[460px]" /><Bone className="h-4 w-72 max-w-full" />
            <div className="flex gap-2"><Bone className="h-6 w-28 rounded-md" /><Bone className="h-6 w-24 rounded-md" /></div>
          </div>
          <div className="border-t border-border grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
            {[0, 1, 2, 3].map(i => <div key={i} className="bg-card px-4 sm:px-6 py-4 space-y-2.5"><Bone className="h-3 w-20" /><Bone className="h-8 w-16" /><Bone className="h-3 w-32" /></div>)}
          </div>
        </div>
        <div className="grid xl:grid-cols-[minmax(0,1fr)_400px] gap-5">
          <Bone className="h-64 w-full rounded-2xl" />
          <Bone className="h-64 w-full rounded-2xl hidden xl:block" />
        </div>
      </div>
      <span className="sr-only">Carregando o evento…</span>
    </div>
  );
}
