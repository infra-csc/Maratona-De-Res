import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetEventsQueryKey } from "@workspace/api-client-react";
import {
  eventCriterionAssignmentsKey, patchCriterionAssignment, useGenerateCriterionAssignments,
} from "@/lib/routing-api";
import { fmtDate, plural, todayBR } from "@/lib/utils";
import { CalendarX2, MousePointerClick } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasRole } from "@/lib/auth-context";
import { buildConformityRows, filterQueueEvents, readEventIdFromUrl } from "./evaluations-admin-console/helpers";
import type {
  ConformityFilter, ConformityKey, ConsoleView, CritFilter, CritRow, EvaluatorsScope, QueueFilters, QueueSort, QueueTab,
} from "./evaluations-admin-console/types";
import { useConsoleData } from "./evaluations-admin-console/use-console-data";
import { useConfirmResults, useSelectedEventDetail } from "./evaluations-admin-console/use-event-mutations";
import { useCriteriaManagement } from "./evaluations-admin-console/use-criteria-management";
import { useLinkActions, useLinkDialogState } from "./evaluations-admin-console/use-links";
import { useEvaluatorStats } from "./evaluations-admin-console/use-evaluator-stats";
import { ConsoleHeader, KpiStrip, type WeekendPulse } from "./evaluations-admin-console/console-header";
import { ConsoleSkeleton, ViewSkeleton } from "./evaluations-admin-console/console-states";
import { EmptyBlock, ErrorBlock, smoothScrollTo, surfaceCls } from "./evaluations-admin-console/console-ui";
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
  // Por data: a fila sai agrupada por fim de semana (o mais antigo em aberto primeiro).
  const [sort, setSort] = useState<QueueSort>("data");
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
    linkReusedName, setLinkReusedName,
    batchOpen, setBatchOpen, batchRunning, batchLinks, batchAllCopied, setBatchAllCopied, batchPlan, setBatchPlan,
    conformityLinkDialog, setConformityLinkDialog, conformityLinkRecipientName, setConformityLinkRecipientName,
    conformityLinkUrl, setConformityLinkUrl, conformityLinkCopied, setConformityLinkCopied,
  } = linkState;

  // ---- Dados de todos os eventos + evento selecionado + enriquecimento ----
  const { allUsers, cycleWeekends, evalIndex, enrichedEvents, cycleAreaMode, cycle, loading, loadError, retry } = useConsoleData(selectedEventId, setSelectedEventId);

  const selected = enrichedEvents.find(e => e.id === selectedEventId) ?? null;
  // Cabeçalho usado em todo texto copiado (links): "NOME DO EVENTO · dd/mm" —
  // quem recebe a mensagem precisa saber de qual evento é o link.
  const batchEventHeader = selected
    ? `${selected.name}${selected.startDate ? ` · ${fmtDate(selected.startDate)}${selected.endDate && selected.endDate !== selected.startDate ? `–${fmtDate(selected.endDate)}` : ""}` : ""}`
    : "";

  // Aplica os avaliadores PADRÃO (routing) a todos os critérios ainda sem avaliador,
  // de uma vez — "confirmar que serão esses critérios e essas pessoas avaliando".
  const generateAssignments = useGenerateCriterionAssignments(selected?.id ?? 0);

  // Abas da fila: partição única (events/rules.ts → queueTabFor). "A fazer" =
  // aberto pela regra única (isOpenEvent) e não concluído; "A abrir" = ainda não
  // abriu (não terminou / próximo ciclo); "Concluídos" = completo, fechado,
  // histórico ou com publicação final.
  const eventsOfTab = (t: QueueTab) => enrichedEvents.filter(e => e.queueTab === t);
  const todoEvents = eventsOfTab("todo");
  const waitingEvents = eventsOfTab("waiting");
  const doneEvents = eventsOfTab("done");
  const baseTab = tab === "done" ? doneEvents : tab === "waiting" ? waitingEvents : todoEvents;
  // KPI "Eventos abertos": a regra única do app (isOpenEvent) — o mesmo número
  // do cabeçalho de Eventos e de Ciclos.
  const openCount = enrichedEvents.filter(e => e.isOpen).length;
  // Ciclo por área: critérios a responder / respondidos nos eventos abertos.
  const openEvents = enrichedEvents.filter(e => e.isOpen);
  const answeredCount = openEvents.reduce((n, e) => n + e.done, 0);
  const toAnswerCount = openEvents.reduce((n, e) => n + (e.total - e.done), 0);

  // Hoje em Brasília (toISOString é UTC e virava o dia às 21h).
  const todayStr = todayBR();
  const currentWeekend = cycleWeekends.find(w => w.sat <= todayStr && todayStr <= w.sun)
    ?? cycleWeekends.filter(w => w.sat <= todayStr).at(-1) ?? null;
  const currentWeekendEvents = currentWeekend
    ? enrichedEvents.filter(e => !!e.startDate && e.startDate >= currentWeekend.sat && e.startDate <= currentWeekend.sun)
    : [];
  const weekendActive = !!currentWeekend && filterDateFrom === currentWeekend.sat && filterDateTo === currentWeekend.sun;
  const weekendPulse: WeekendPulse = currentWeekend ? {
    label: currentWeekend.label,
    isNow: currentWeekend.sat <= todayStr && todayStr <= currentWeekend.sun,
    done: currentWeekendEvents.filter(e => e.isDone).length,
    total: currentWeekendEvents.length,
    active: weekendActive,
  } : null;

  const areaOptions = [...new Set(enrichedEvents.flatMap(e => e.areaNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const evaluatorOptions = [...new Set(enrichedEvents.flatMap(e => e.evaluatorNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const hasFilters = !!(q || areaFilter || evaluatorFilter || filterDateFrom || filterDateTo || conformityFilter !== "all" || noEvaluatorFilter);

  const queueFilters: QueueFilters = { q, areaFilter, evaluatorFilter, filterDateFrom, filterDateTo, sort, conformityFilter, noEvaluatorFilter };
  const queueEvents = filterQueueEvents(baseTab, queueFilters);

  // Seleção acompanha a aba: ao trocar de aba, o painel da direita mostra o
  // 1º evento da nova aba (ou fica vazio, se ela não tiver nenhum) — antes o
  // painel continuava num evento que não estava na lista.
  function changeTab(next: QueueTab) {
    setTab(next);
    const list = filterQueueEvents(eventsOfTab(next), queueFilters);
    setSelectedEventId(list[0]?.id ?? null);
  }

  // Panorama → "fim de semana atual": filtra a fila por ele (ou limpa) e abre
  // a primeira aba que tiver evento daquele fim de semana.
  function toggleCurrentWeekend() {
    if (!currentWeekend) return;
    setView("assign");
    if (weekendActive) { setFilterDateFrom(""); setFilterDateTo(""); return; }
    setFilterDateFrom(currentWeekend.sat);
    setFilterDateTo(currentWeekend.sun);
    const f = { ...queueFilters, filterDateFrom: currentWeekend.sat, filterDateTo: currentWeekend.sun };
    const nextTab = (["todo", "waiting", "done"] as const).find(t => filterQueueEvents(eventsOfTab(t), f).length > 0) ?? tab;
    setTab(nextTab);
    setSelectedEventId(filterQueueEvents(eventsOfTab(nextTab), f)[0]?.id ?? null);
  }

  // Celular/tablet (fila acima do painel): escolher um evento leva ao painel;
  // "← Eventos" volta para a fila.
  const queueRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stacked = () => !window.matchMedia?.("(min-width: 1024px)").matches;
  function selectEvent(id: number) {
    setSelectedEventId(id);
    if (stacked()) requestAnimationFrame(() => smoothScrollTo(panelRef.current));
  }
  function backToQueue() { smoothScrollTo(queueRef.current); }

  // Primeira carga: com ?eventId= (link "Avaliações" da tela de Eventos), a
  // fila abre na aba do evento, com ele selecionado; sem ele, no 1º evento de
  // "A fazer" (ou da primeira aba que tiver evento).
  const urlEventId = useRef(readEventIdFromUrl());
  const initialized = useRef(false);
  const selectedFromUrl = useRef(false);
  useEffect(() => {
    if (initialized.current || enrichedEvents.length === 0) return;
    const fromUrl = urlEventId.current != null ? enrichedEvents.find(e => e.id === urlEventId.current) : undefined;
    initialized.current = true;
    if (fromUrl) {
      // Com ?eventId=, o evento da URL fica selecionado: o efeito abaixo ("volta
      // para o 1º da aba") rodava no mesmo ciclo, ainda com a seleção vazia, e
      // trocava o evento pedido pelo 1º de "A fazer" (achado na rodada 6).
      setTab(fromUrl.queueTab);
      setSelectedEventId(fromUrl.id);
      selectedFromUrl.current = true;
      return;
    }
    const first = (["todo", "waiting", "done"] as const).find(t => eventsOfTab(t).length > 0) ?? "todo";
    setTab(first);
    setSelectedEventId(filterQueueEvents(eventsOfTab(first), queueFilters)[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedEvents]);

  // O evento selecionado saiu da lista (ou foi limpo): volta para o 1º da aba.
  useEffect(() => {
    if (selectedFromUrl.current) { selectedFromUrl.current = false; return; }
    if (!initialized.current || selectedEventId != null || view !== "assign") return;
    const first = queueEvents[0];
    if (first) setSelectedEventId(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedEvents, view]);

  // Critérios/Tabela trabalham com um evento: sem seleção, o 1º do ciclo.
  useEffect(() => {
    if (view === "assign" || selectedEventId != null || enrichedEvents.length === 0) return;
    setSelectedEventId(enrichedEvents[0].id);
  }, [view, selectedEventId, enrichedEvents, setSelectedEventId]);

  // ---- Selected event detail (matriz de conformidade + confirmar resultados) ----
  const { selectedDetail, patchAssignment, setConformityEvaluatorMutation, setConformityEvaluatorFerramentasMutation } =
    useSelectedEventDetail({ selectedEventId, qc, toast, setOpenConformityPicker });

  // ---- Gestão de Critérios (ativar/peso/duplicar/renomear/excluir) + atribuição de avaliador por ÁREA ----
  const criteriaMgmt = useCriteriaManagement({ qc, toast, canManage, allUsers, evalIndex, selectedEventId, selectedDetail, selected });
  const confirmResults = useConfirmResults(qc, toast);

  // ---- Links públicos (tokens) ----
  const { createAdminToken, allTokens, createConformityToken, createFerramentasToken, openLinkDialog, handleGenerateLink, handleGenerateAllLinks, runAreaBatch, handleGenerateConformityLink } =
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
      toast({ title: `${plural(okCount, "critério atribuído", "critérios atribuídos")}` });
    } else {
      toast({
        title: okCount > 0 ? `${okCount} de ${plural(unassigned.length, "critério atribuído", "critérios atribuídos")}` : "Erro ao atribuir critérios",
        description: firstError,
        variant: "destructive",
      });
    }
  }

  // ---- Matriz de conformidade (Cenografia + Ferramentas) ----
  const conformity = selectedDetail?.conformity ?? null;
  const conformityRows = buildConformityRows(selectedDetail);

  // ---- KPIs + aba Avaliadores ----
  const { pendingEvaluatorsCount, evaluatorCards, globalEvaluatorCards, globalAreaResponders, eventAreaResponders } =
    useEvaluatorStats({ enrichedEvents, selected, selectedDetail, conformityRows });

  const header = (
    <ConsoleHeader view={view} setView={setView} isOperador={isOperador} areaMode={cycleAreaMode} cycleName={cycle?.name ?? null} />
  );

  return (
    // A página (evaluations.tsx) envolve a Central com respiro próprio; a
    // Central desfaz esse respiro para ter o topo fixo de ponta a ponta, como
    // as telas de Avaliações e Calibração.
    <div className="-m-6 md:-m-10 min-h-full bg-background text-foreground font-body">
      {header}
      <div className="px-4 md:px-6 py-5 md:py-6 space-y-5">
      {loading ? (
        <ConsoleSkeleton />
      ) : loadError ? (
        <ErrorBlock title="Não foi possível carregar os eventos" onRetry={retry} />
      ) : enrichedEvents.length === 0 ? (
        <div className={surfaceCls} data-testid="console-empty">
          <EmptyBlock icon={CalendarX2} title="Nenhum evento no ciclo" className="py-16">
            Quando houver eventos do ciclo atual liberados para avaliação, eles aparecem aqui com o progresso de cada área.
          </EmptyBlock>
        </div>
      ) : (
      <>
      <KpiStrip
        openCount={openCount}
        weekend={weekendPulse}
        onWeekend={toggleCurrentWeekend}
        pendingEvaluatorsCount={pendingEvaluatorsCount}
        selectedUnassigned={selected?.unassigned ?? 0}
        noEvaluatorFilter={noEvaluatorFilter}
        setNoEvaluatorFilter={setNoEvaluatorFilter}
        setView={setView}
        setTab={changeTab}
        areaMode={cycleAreaMode}
        toAnswerCount={toAnswerCount}
        answeredCount={answeredCount}
      />

      {view === "assign" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[360px_minmax(0,1fr)] gap-5 items-start">
          {/* Coluna esquerda — fila de eventos */}
          <div ref={queueRef} className="min-w-0 scroll-mt-[72px] md:scroll-mt-20 lg:sticky lg:top-[80px]">
          <EventQueue
            tab={tab}
            setTab={changeTab}
            todoCount={todoEvents.length}
            waitingCount={waitingEvents.length}
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
            currentWeekendSat={currentWeekend?.sat ?? null}
            queueEvents={queueEvents}
            baseTabCount={baseTab.length}
            hasFilters={hasFilters}
            selectedId={selected?.id ?? null}
            onSelect={selectEvent}
            areaMode={cycleAreaMode}
          />
          </div>

          {/* Coluna direita — o evento selecionado */}
          <div ref={panelRef} className="min-w-0 scroll-mt-[72px] md:scroll-mt-20">
          {!selected && (
            <div data-testid="panel-empty" className="rounded-2xl border border-dashed border-border">
              <EmptyBlock icon={MousePointerClick} className="py-16"
                title={baseTab.length === 0
                  ? tab === "todo" ? "Nada a fazer agora" : tab === "waiting" ? "Nenhum evento a abrir" : "Nenhum evento concluído ainda"
                  : "Escolha um evento na lista"}>
                {baseTab.length === 0
                  ? tab === "todo" ? "Nenhum evento aberto está esperando avaliação." : "Esta aba não tem eventos neste ciclo."
                  : "O progresso por área, quem já respondeu e a Matriz do evento aparecem aqui."}
              </EmptyBlock>
            </div>
          )}
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
              allTokens={allTokens}
              onBack={backToQueue}
              conformitySection={
                <ConformityAssignmentList
                  selected={selected}
                  conformityRows={conformityRows}
                  loading={!selectedDetail}
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
        </div>
      ) : view === "criterios" ? (
        selected && (selectedDetail ? (
          <CriteriaView
            selected={selected}
            selectedDetail={selectedDetail}
            enrichedEvents={enrichedEvents}
            setSelectedEventId={setSelectedEventId}
            mgmt={criteriaMgmt}
            isAdmin={user?.role === "admin"}
          />
        ) : <ViewSkeleton />)
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
            allTokens={allTokens}
            canViewSubmissions={canViewSubmissions}
            setViewEvalCrit={setViewEvalCrit}
            // O seletor da Matriz vive na aba de eventos: abre lá, já aberto.
            setOpenConformityPicker={(k) => { setOpenConformityPicker(k); setView("assign"); }}
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
          areaMode={cycleAreaMode}
          globalAreaResponders={globalAreaResponders}
          eventAreaResponders={eventAreaResponders}
        />
      )}
      </>
      )}
      </div>

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
          batchPlan={batchPlan}
          setBatchPlan={setBatchPlan}
          runAreaBatch={runAreaBatch}
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
          linkReusedName={linkReusedName}
          setLinkReusedName={setLinkReusedName}
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
