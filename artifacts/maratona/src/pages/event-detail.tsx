// Detalhe do Evento. A página busca os dados, guarda o estado compartilhado
// (formulário da Matriz, diálogos) e as mutações usadas por mais de uma
// seção; a apresentação de cada bloco vive em ./event-detail/.
import { useRoute } from "wouter";
import { useState, useEffect, useMemo } from "react";
import {
  useGetEvent, useGetEventResult, useGetEvaluations, useUpdateEventParticipant, useGetEventConformity,
  useConfirmEventResults, useUnconfirmEventResults,
  getGetEventQueryKey, getGetEventResultQueryKey, getGetEvaluationsQueryKey, getGetEventConformityQueryKey,
  getGetQuarterlyResultsQueryKey, getGetRankingQueryKey, getGetEventsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, hasRole } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { BODY } from "@/lib/premium-theme";
import { EventActivityLog } from "@/components/event-activity-log";
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

  const { data: event, isLoading } = useGetEvent(id, {
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
  const canManage = !!user && ["admin", "rh"].includes(user.role);
  const isOperador = hasRole(user, "operador");
  // Gestão de equipe (adicionar/remover participante) também é permitida ao
  // papel "operador" — que NÃO pode confirmar resultados financeiros, editar
  // nota histórica, nem ver/gerenciar a Matriz de Conformidade (só canManage).
  const canManageTeam = canManage || isOperador;
  const canManageConformity = canManage || (!!user && user.id === event?.conformityEvaluatorUserId);

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

  if (isLoading) {
    return (
      <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-6" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
        <div className="h-8 w-32 rounded-lg animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-full p-6 md:p-10 max-w-4xl mx-auto text-center" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
        <div className="py-24 rounded-xl font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
          Evento não encontrado ou indisponível.
        </div>
      </div>
    );
  }

  const activeCriteriaCount = (event.criteria ?? []).filter(c => c.active).length;

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>

      <EventHeader
        event={event}
        canManage={canManage}
        resultsConfirmBusy={resultsConfirmBusy}
        resultsDialog={resultsDialog}
        setResultsDialog={setResultsDialog}
        onSubmitResultsDialog={submitResultsDialog}
      />

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">

        <SummaryCards event={event} result={result} conformityForm={conformityForm} activeCriteriaCount={activeCriteriaCount} />

        {/* ── Critérios de Avaliação (leitura — gestão de critérios agora em Avaliações) ── */}
        {canViewResult && result && result.criteriaDetails && result.criteriaDetails.length > 0 && (
          <CriteriaSection criteriaDetails={result.criteriaDetails} evaluations={evaluations} importedCriteriaMap={importedCriteriaMap} />
        )}

        {/* Eventos históricos: observações importadas */}
        {event.isHistorical && (
          <ImportedNotesSection eventId={event.id} currentScore={event.importedScore} currentNotes={event.importedNotes} canManage={canManage} />
        )}

        {/* ── Equipe Alocada ── */}
        {((event.participants && event.participants.length > 0) || canManageTeam) && (
          <TeamSection
            id={id}
            event={event}
            canManageTeam={canManageTeam}
            updateParticipant={updateParticipant}
            onAddParticipant={() => setAddParticipantOpen(true)}
            onRequestRemoveParticipant={setPendingRemoveParticipant}
          />
        )}

        <RemoveParticipantDialog id={id} event={event} pendingParticipantId={pendingRemoveParticipant} onClose={() => setPendingRemoveParticipant(null)} />
        <AddParticipantDialog id={id} event={event} canManageTeam={canManageTeam} open={addParticipantOpen} onOpenChange={setAddParticipantOpen} />

        {/* ── Matriz de Conformidade — não visível para "operador" (não vê notas/respostas) ── */}
        {!isOperador && (
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
          />
        )}

        {/* ── Performance Individual ── */}
        {hasPerformanceTable && <PerformanceSection participants={participantResults} />}

        {!event.isHistorical && <EventCommentsPanel eventId={id} />}
        <EventActivityLog eventId={id} />
      </div>
    </div>
  );
}
