import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetEventsQueryKey } from "@workspace/api-client-react";
import {
  eventCriterionAssignmentsKey, patchCriterionAssignment, useGenerateCriterionAssignments,
} from "@/lib/routing-api";
import { fmtDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasRole } from "@/lib/auth-context";
import { buildConformityRows, filterQueueEvents } from "./evaluations-admin-console/helpers";
import type {
  ConformityFilter, ConformityKey, ConsoleView, CritFilter, CritRow, EvaluatorsScope, QueueFilters, QueueSort, QueueTab,
} from "./evaluations-admin-console/types";
import { useConsoleData } from "./evaluations-admin-console/use-console-data";
import { useConfirmResults, useSelectedEventDetail } from "./evaluations-admin-console/use-event-mutations";
import { useCriteriaManagement } from "./evaluations-admin-console/use-criteria-management";
import { useLinkActions, useLinkDialogState } from "./evaluations-admin-console/use-links";
import { useEvaluatorStats } from "./evaluations-admin-console/use-evaluator-stats";
import { ConsoleHeader, KpiStrip } from "./evaluations-admin-console/console-header";
import { EventQueue } from "./evaluations-admin-console/event-queue";
import { EventAssignmentPanel } from "./evaluations-admin-console/event-assignment-panel";
import { ConformityAssignmentList } from "./evaluations-admin-console/conformity-assignment-list";
import { CriteriaView } from "./evaluations-admin-console/criteria-view";
import { TableView } from "./evaluations-admin-console/table-view";
import { EvaluatorsView } from "./evaluations-admin-console/evaluators-view";
import { BatchLinksDialog } from "./evaluations-admin-console/batch-links-dialog";
import { ViewConformityDialog, ViewEvaluationDialog } from "./evaluations-admin-console/submission-dialogs";
import { ConformityLinkDialog, LinkDialog } from "./evaluations-admin-console/link-dialogs";

/**
 * Central de Avaliações (admin/rh/operador). Este componente orquestra o
 * estado compartilhado entre as abas; as partes visuais, os hooks de dados e
 * os helpers puros vivem em `./evaluations-admin-console/`.
 */
export function AdminEvaluationsConsole() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isOperador = hasRole(user, "operador");
  // "operador" tem os mesmos poderes de atribuição/envio de avaliação que
  // admin/rh (sincronizar critérios, aplicar avaliadores padrão, gerar links,
  // atribuir/redirecionar) — mas NUNCA vê o conteúdo de uma resposta já
  // enviada (nota, comentário, áudio, respostas da matriz de conformidade).
  // Isso é controlado à parte por canViewSubmissions, abaixo.
  const canManage = !!user && (["admin", "rh"].includes(user.role) || isOperador);
  const canViewSubmissions = !!user && ["admin", "rh"].includes(user.role);

  const [view, setView] = useState<ConsoleView>("assign");
  const [tab, setTab] = useState<QueueTab>("todo");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [evaluatorFilter, setEvaluatorFilter] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [sort, setSort] = useState<QueueSort>("name");
  const [conformityFilter, setConformityFilter] = useState<ConformityFilter>("all");
  const [noEvaluatorFilter, setNoEvaluatorFilter] = useState(false);
  const [bulkAssignAreaId, setBulkAssignAreaId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [critFilter, setCritFilter] = useState<CritFilter>("all");
  const [viewEvalCrit, setViewEvalCrit] = useState<CritRow | null>(null);
  const [viewConformity, setViewConformity] = useState<ConformityKey | null>(null);
  const [evaluatorsScope, setEvaluatorsScope] = useState<EvaluatorsScope>("all");
  const [openPickerCriterionId, setOpenPickerCriterionId] = useState<number | null>(null);
  const [openConformityPicker, setOpenConformityPicker] = useState<ConformityKey | null>(null);

  // --- Diálogos de link (freelancer, "Gerar todos", matriz de conformidade) ---
  const linkState = useLinkDialogState();
  const {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName, generatedLinkUrl, setGeneratedLinkUrl, linkCopied, setLinkCopied,
    batchOpen, setBatchOpen, batchRunning, batchLinks, batchAllCopied, setBatchAllCopied,
    conformityLinkDialog, setConformityLinkDialog, conformityLinkRecipientName, setConformityLinkRecipientName,
    conformityLinkUrl, setConformityLinkUrl, conformityLinkCopied, setConformityLinkCopied,
  } = linkState;

  // ---- Dados de todos os eventos + evento selecionado + enriquecimento ----
  const { allUsers, cycleWeekends, evalIndex, enrichedEvents } = useConsoleData(selectedEventId, setSelectedEventId);

  const selected = enrichedEvents.find(e => e.id === selectedEventId) ?? null;
  // Cabeçalho usado em todo texto copiado (links): "NOME DO EVENTO · dd/mm" —
  // quem recebe a mensagem precisa saber de qual evento é o link.
  const batchEventHeader = selected
    ? `${selected.name}${selected.startDate ? ` · ${fmtDate(selected.startDate)}${selected.endDate && selected.endDate !== selected.startDate ? `–${fmtDate(selected.endDate)}` : ""}` : ""}`
    : "";

  // Aplica os avaliadores PADRÃO (routing) a todos os critérios ainda sem avaliador,
  // de uma vez — "confirmar que serão esses critérios e essas pessoas avaliando".
  const generateAssignments = useGenerateCriterionAssignments(selected?.id ?? 0);

  const todoEvents = enrichedEvents.filter(e => !e.isDone);
  const doneEvents = enrichedEvents.filter(e => e.isDone);
  const baseTab = tab === "done" ? doneEvents : todoEvents;

  const todayStr = new Date().toISOString().split("T")[0];
  const currentWeekend = cycleWeekends.find(w => w.sat <= todayStr && todayStr <= w.sun)
    ?? cycleWeekends.filter(w => w.sat <= todayStr).at(-1) ?? null;
  const currentWeekendDoneCount = currentWeekend
    ? enrichedEvents.filter(e => e.isDone && !!e.startDate && e.startDate >= currentWeekend.sat && e.startDate <= currentWeekend.sun).length
    : null;

  const areaOptions = [...new Set(enrichedEvents.flatMap(e => e.areaNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const evaluatorOptions = [...new Set(enrichedEvents.flatMap(e => e.evaluatorNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const hasFilters = !!(q || areaFilter || evaluatorFilter || filterDateFrom || filterDateTo || conformityFilter !== "all" || noEvaluatorFilter);

  const queueFilters: QueueFilters = { q, areaFilter, evaluatorFilter, filterDateFrom, filterDateTo, sort, conformityFilter, noEvaluatorFilter };
  const queueEvents = filterQueueEvents(baseTab, queueFilters);

  // ---- Selected event detail (matriz de conformidade + confirmar resultados) ----
  const { selectedDetail, patchAssignment, setConformityEvaluatorMutation, setConformityEvaluatorFerramentasMutation } =
    useSelectedEventDetail({ selectedEventId, qc, toast, setOpenConformityPicker });

  // ---- Gestão de Critérios (ativar/peso/duplicar/renomear/excluir) + atribuição de avaliador por ÁREA ----
  const criteriaMgmt = useCriteriaManagement({ qc, toast, canManage, allUsers, evalIndex, selectedEventId, selectedDetail, selected });
  const confirmResults = useConfirmResults(qc, toast);

  // ---- Links públicos (tokens) ----
  const { createAdminToken, allTokens, createConformityToken, createFerramentasToken, openLinkDialog, handleGenerateLink, handleGenerateAllLinks, handleGenerateConformityLink } =
    useLinkActions({ linkState, selected, selectedEventId, selectedDetail, toast });

  function handleAssign(criterionId: number, userId: number) {
    if (!selected) return;
    patchAssignment.mutate(
      { criterionId, assignedToId: userId, action: "assign" },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
          setOpenPickerCriterionId(null);
          toast({ title: "Avaliador atribuído" });
        },
        onError: (e: Error) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
      },
    );
  }

  // Atribuição em lote por área: laço SEQUENCIAL com a chamada crua (sem o
  // hook), `bulkBusy` trava o picker enquanto roda e o cache é invalidado
  // UMA vez ao final — antes eram N `mutate` em paralelo no mesmo hook
  // (isPending inútil) com N invalidações.
  async function handleBulkAssign(areaId: number, userId: number) {
    if (!selected || bulkBusy) return;
    const eventId = selected.id;
    const unassigned = selected.criteria.filter(c => c.areaId === areaId && c.state === "unassigned");
    if (unassigned.length === 0) { setBulkAssignAreaId(null); return; }
    setBulkBusy(true);
    let okCount = 0;
    let firstError: string | null = null;
    for (const c of unassigned) {
      try {
        await patchCriterionAssignment(eventId, { criterionId: c.criterionId, assignedToId: userId, action: "assign" });
        okCount++;
      } catch (e) {
        firstError ??= (e as Error).message;
      }
    }
    qc.invalidateQueries({ queryKey: eventCriterionAssignmentsKey(eventId) });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    setBulkBusy(false);
    if (firstError == null) {
      setBulkAssignAreaId(null);
      toast({ title: `${okCount} critério(s) atribuído(s)` });
    } else {
      toast({
        title: okCount > 0 ? `${okCount} de ${unassigned.length} critério(s) atribuído(s)` : "Erro ao atribuir critérios",
        description: firstError,
        variant: "destructive",
      });
    }
  }

  // ---- Matriz de conformidade (Cenografia + Ferramentas) ----
  const conformity = selectedDetail?.conformity ?? null;
  const conformityRows = buildConformityRows(selectedDetail);

  // ---- KPIs + aba Avaliadores ----
  const { pendingEvaluatorsCount, evaluatorCards, globalEvaluatorCards } =
    useEvaluatorStats({ enrichedEvents, selected, selectedDetail, conformityRows });

  return (
    <div className="space-y-5">
      <ConsoleHeader view={view} setView={setView} isOperador={isOperador} />

      <KpiStrip
        todoCount={todoEvents.length}
        selected={selected}
        currentWeekendDoneCount={currentWeekendDoneCount}
        pendingEvaluatorsCount={pendingEvaluatorsCount}
        noEvaluatorFilter={noEvaluatorFilter}
        setNoEvaluatorFilter={setNoEvaluatorFilter}
        setView={setView}
        setTab={setTab}
      />

      {enrichedEvents.length === 0 ? (
        <div className="text-center py-20 rounded-xl font-bold uppercase" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          Nenhum evento liberado para avaliação no momento.
        </div>
      ) : view === "assign" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Coluna esquerda — fila de eventos */}
          <EventQueue
            tab={tab}
            setTab={setTab}
            todoCount={todoEvents.length}
            doneCount={doneEvents.length}
            filters={queueFilters}
            setQ={setQ}
            setAreaFilter={setAreaFilter}
            setEvaluatorFilter={setEvaluatorFilter}
            setFilterDateFrom={setFilterDateFrom}
            setFilterDateTo={setFilterDateTo}
            setSort={setSort}
            setConformityFilter={setConformityFilter}
            setNoEvaluatorFilter={setNoEvaluatorFilter}
            areaOptions={areaOptions}
            evaluatorOptions={evaluatorOptions}
            cycleWeekends={cycleWeekends}
            queueEvents={queueEvents}
            baseTabCount={baseTab.length}
            hasFilters={hasFilters}
            selectedId={selected?.id ?? null}
            setSelectedEventId={setSelectedEventId}
          />

          {/* Coluna direita — matriz de atribuição do evento selecionado */}
          {selected && (
            <EventAssignmentPanel
              selected={selected}
              canManage={canManage}
              canViewSubmissions={canViewSubmissions}
              todayStr={todayStr}
              toast={toast}
              confirmResults={confirmResults}
              resyncCriteria={criteriaMgmt.resyncCriteria}
              generateAssignments={generateAssignments}
              batchRunning={batchRunning}
              handleGenerateAllLinks={handleGenerateAllLinks}
              critFilter={critFilter}
              setCritFilter={setCritFilter}
              bulkAssignAreaId={bulkAssignAreaId}
              setBulkAssignAreaId={setBulkAssignAreaId}
              bulkBusy={bulkBusy}
              handleBulkAssign={handleBulkAssign}
              openPickerCriterionId={openPickerCriterionId}
              setOpenPickerCriterionId={setOpenPickerCriterionId}
              handleAssign={handleAssign}
              openLinkDialog={openLinkDialog}
              setViewEvalCrit={setViewEvalCrit}
              conformitySection={
                <ConformityAssignmentList
                  selected={selected}
                  conformityRows={conformityRows}
                  canManage={canManage}
                  canViewSubmissions={canViewSubmissions}
                  openConformityPicker={openConformityPicker}
                  setOpenConformityPicker={setOpenConformityPicker}
                  setViewConformity={setViewConformity}
                  setConformityLinkDialog={setConformityLinkDialog}
                  setConformityLinkRecipientName={setConformityLinkRecipientName}
                  setConformityLinkUrl={setConformityLinkUrl}
                  setConformityLinkCopied={setConformityLinkCopied}
                  setConformityEvaluatorMutation={setConformityEvaluatorMutation}
                  setConformityEvaluatorFerramentasMutation={setConformityEvaluatorFerramentasMutation}
                />
              }
            />
          )}
        </div>
      ) : view === "criterios" ? (
        selected && selectedDetail && (
          <CriteriaView
            selected={selected}
            selectedDetail={selectedDetail}
            enrichedEvents={enrichedEvents}
            setSelectedEventId={setSelectedEventId}
            mgmt={criteriaMgmt}
            isAdmin={user?.role === "admin"}
          />
        )
      ) : view === "table" ? (
        selected && (
          <TableView
            selected={selected}
            enrichedEvents={enrichedEvents}
            setSelectedEventId={setSelectedEventId}
            conformityRows={conformityRows}
            canManage={canManage}
            openPickerCriterionId={openPickerCriterionId}
            setOpenPickerCriterionId={setOpenPickerCriterionId}
            handleAssign={handleAssign}
            openLinkDialog={openLinkDialog}
            setConformityLinkDialog={setConformityLinkDialog}
            setOpenConformityPicker={setOpenConformityPicker}
          />
        )
      ) : (
        <EvaluatorsView
          evaluatorsScope={evaluatorsScope}
          setEvaluatorsScope={setEvaluatorsScope}
          enrichedEvents={enrichedEvents}
          selected={selected}
          setSelectedEventId={setSelectedEventId}
          globalEvaluatorCards={globalEvaluatorCards}
          evaluatorCards={evaluatorCards}
          toast={toast}
          setEvaluatorFilter={setEvaluatorFilter}
          setView={setView}
        />
      )}

      {/* ── Todos os links (batch) ─────────────────────────────────── */}
      {batchOpen && (
        <BatchLinksDialog
          selected={selected}
          batchRunning={batchRunning}
          batchLinks={batchLinks}
          batchAllCopied={batchAllCopied}
          setBatchAllCopied={setBatchAllCopied}
          setBatchOpen={setBatchOpen}
          batchEventHeader={batchEventHeader}
          toast={toast}
        />
      )}

      {/* ── Ver avaliação (modal de leitura) ───────────────────────── */}
      {viewEvalCrit && canViewSubmissions && (
        <ViewEvaluationDialog viewEvalCrit={viewEvalCrit} setViewEvalCrit={setViewEvalCrit} />
      )}

      {/* ── Ver Matriz de Conformidade (modal de leitura) ────────────── */}
      {viewConformity && conformity && canViewSubmissions && (
        <ViewConformityDialog viewConformity={viewConformity} setViewConformity={setViewConformity} conformity={conformity} selectedDetail={selectedDetail} />
      )}

      {/* ── Link Freelancer dialog ─────────────────────────────────── */}
      {linkDialog && (
        <LinkDialog
          linkDialog={linkDialog}
          setLinkDialog={setLinkDialog}
          linkRecipientName={linkRecipientName}
          setLinkRecipientName={setLinkRecipientName}
          generatedLinkUrl={generatedLinkUrl}
          setGeneratedLinkUrl={setGeneratedLinkUrl}
          linkCopied={linkCopied}
          setLinkCopied={setLinkCopied}
          handleGenerateLink={handleGenerateLink}
          generating={createAdminToken.isPending}
          allTokens={allTokens}
          batchEventHeader={batchEventHeader}
          toast={toast}
        />
      )}

      {/* ── Conformity Link dialog ─────────────────────────────────── */}
      {conformityLinkDialog && (
        <ConformityLinkDialog
          conformityLinkDialog={conformityLinkDialog}
          setConformityLinkDialog={setConformityLinkDialog}
          conformityLinkRecipientName={conformityLinkRecipientName}
          setConformityLinkRecipientName={setConformityLinkRecipientName}
          conformityLinkUrl={conformityLinkUrl}
          setConformityLinkUrl={setConformityLinkUrl}
          conformityLinkCopied={conformityLinkCopied}
          setConformityLinkCopied={setConformityLinkCopied}
          handleGenerateConformityLink={handleGenerateConformityLink}
          generating={createConformityToken.isPending || createFerramentasToken.isPending}
          batchEventHeader={batchEventHeader}
          toast={toast}
        />
      )}
    </div>
  );
}
