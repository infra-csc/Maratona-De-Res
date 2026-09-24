import { useState, useEffect } from "react";
import { useGetEvents, useGetEvaluations, useGetEventCriteria, useGetEvent, useCreateEvaluation, useGetEventConformity, useSetEventConformity, useRedirectConformityEvaluator, useRedirectConformityEvaluatorFerramentas, useGetUsersByArea, useGetCurrentCycle, getGetEvaluationsQueryKey, getGetEventQueryKey, createEvaluation, submitEvaluation, type EventConformityInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useEventCriterionAssignments, usePatchCriterionAssignment, useRedirectOptions, useCreatePublicToken, usePublicTokens, usePublicLinkEligibleCriteria, useCreateConformityPublicToken, useCreateFerramentasPublicToken, useConformityPublicTokens, useFerramentasPublicTokens, useMyPrincipalAreas, useUsersByArea, useDeletePublicToken } from "@/lib/routing-api";
import { AdminEvaluationsConsole } from "./evaluations-admin-console";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { CENOGRAFIA_AREA_ID, FERRAMENTAS_AREA_ID } from "./evaluations/constants";
import { conformityFormFromData, emptyConformityForm, groupCriteriaByArea, publicEvalBaseUrl } from "./evaluations/helpers";
import type { AreaAssignTarget, AreaGroup, ConformityEvalForm, ConformityLinkType, EvalTab, RedirectDialogArea } from "./evaluations/types";
import { useEvaluatorOverview } from "./evaluations/use-evaluator-overview";
import { EvaluatorSidebar } from "./evaluations/evaluator-sidebar";
import { PrincipalAreaCriteriaSection, AreaAssignDialog } from "./evaluations/principal-area-criteria";
import { NoEventSelected, EventHeaderStrip } from "./evaluations/event-header";
import { CriteriaColumn } from "./evaluations/criteria-column";
import { FerramentasConformitySection } from "./evaluations/ferramentas-conformity-section";
import { CenografiaConformitySection } from "./evaluations/cenografia-conformity-section";
import { EvaluationSummaryPanel } from "./evaluations/evaluation-summary-panel";
import { RedirectFormDialog } from "./evaluations/redirect-form-dialog";
import { PublicLinkDialog } from "./evaluations/public-link-dialog";
import { ConformityPublicLinkDialog } from "./evaluations/conformity-public-link-dialog";

export default function EvaluationsPage() {
  const { user } = useAuth();
  const isEvaluator = user?.role === "avaliador";
  // Everyone who is not an evaluator (managers, diretoria, visualizador) is in
  // read-only consultation mode: they inspect evaluation progress, never score.
  const isConsultation = !!user && !isEvaluator;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [activeEvalTab, setActiveEvalTab] = useState<EvalTab>("todo");
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  // Per-criterion audio override (objectPath). "" means the user cleared a
  // previously saved audio (re-recording). undefined => fall back to saved eval.
  const [audioOverrides, setAudioOverrides] = useState<Record<number, string>>({});
  // Confirmation modal + in-flight state for the one-click "Lançar Avaliação" flow.
  const [confirmLaunchOpen, setConfirmLaunchOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [conformityEvalForm, setConformityEvalForm] = useState<ConformityEvalForm>(emptyConformityForm());
  const [redirectConformityOpen, setRedirectConformityOpen] = useState(false);
  const [redirectConformityTargetId, setRedirectConformityTargetId] = useState<number | null>(null);
  const [redirectFerramentasOpen, setRedirectFerramentasOpen] = useState(false);
  const [redirectFerramentasTargetId, setRedirectFerramentasTargetId] = useState<number | null>(null);

  const { data: events } = useGetEvents({});
  const { data: cycle } = useGetCurrentCycle();

  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-criteria", selectedEventId] as unknown[] },
  });

  const { data: selectedEventDetail } = useGetEvent(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: getGetEventQueryKey(selectedEventId ?? 0) },
  });

  const isConformityEvaluatorForEvent = !!selectedEventId && !!user && selectedEventDetail?.conformityEvaluatorUserId === user.id;
  const isFerramentasEvaluatorForEvent = !!selectedEventId && !!user && selectedEventDetail?.conformityEvaluatorFerramentasUserId === user.id;
  const isAnyConformityEvaluator = isConformityEvaluatorForEvent || isFerramentasEvaluatorForEvent;
  const { data: myConformityData } = useGetEventConformity(selectedEventId!, {
    query: { enabled: isAnyConformityEvaluator, queryKey: ["event-conformity-eval", selectedEventId] as unknown[] },
  });
  const conformityEvalMutation = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["event-conformity-eval", selectedEventId] });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e?.message ?? "Não foi possível salvar. Tente novamente.", variant: "destructive" }),
    },
  });
  // Users for redirect popups (loaded lazily)
  const { data: cenografiaUsers } = useGetUsersByArea(CENOGRAFIA_AREA_ID, {
    query: { enabled: isConformityEvaluatorForEvent, queryKey: ["users-by-area", CENOGRAFIA_AREA_ID] as unknown[] },
  });
  const { data: ferramentasUsers } = useGetUsersByArea(FERRAMENTAS_AREA_ID, {
    query: { enabled: isFerramentasEvaluatorForEvent, queryKey: ["users-by-area", FERRAMENTAS_AREA_ID] as unknown[] },
  });
  const redirectConformityMutation = useRedirectConformityEvaluator({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setRedirectConformityOpen(false); toast({ title: "Avaliação redirecionada" }); },
      onError: () => toast({ title: "Erro ao redirecionar", variant: "destructive" }),
    },
  });
  const redirectFerramentasMutation = useRedirectConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setRedirectFerramentasOpen(false); toast({ title: "Avaliação redirecionada" }); },
      onError: () => toast({ title: "Erro ao redirecionar", variant: "destructive" }),
    },
  });
  useEffect(() => {
    if (myConformityData) {
      setConformityEvalForm(conformityFormFromData(myConformityData));
    } else {
      setConformityEvalForm(emptyConformityForm());
    }
  }, [myConformityData?.id, selectedEventId]);

  const evalsQKey = getGetEvaluationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: evalsQKey } }
  );

  // Criterion assignments for the selected event (new routing system)
  const { data: criterionAssignments } = useEventCriterionAssignments(selectedEventId ?? 0);
  const patchCriterionAssignment = usePatchCriterionAssignment(selectedEventId ?? 0);
  // Áreas em que o usuário logado é avaliador principal — dá visibilidade
  // completa dos quesitos da área e permite atribuir/tomar/mover entre colegas.
  const { data: myPrincipalAreas } = useMyPrincipalAreas();
  const [areaAssignTarget, setAreaAssignTarget] = useState<AreaAssignTarget | null>(null);
  const { data: areaAssignUsers } = useUsersByArea(areaAssignTarget?.areaId ?? null);
  const [redirectDialogArea, setRedirectDialogArea] = useState<RedirectDialogArea | null>(null);
  const [redirectTargetId, setRedirectTargetId] = useState<number | null>(null);
  const [publicLinkDialogCriteriaIds, setPublicLinkDialogCriteriaIds] = useState<number[] | null>(null);
  const [publicLinkDialogAreaName, setPublicLinkDialogAreaName] = useState<string | null>(null);
  const [publicLinkRecipientName, setPublicLinkRecipientName] = useState("");
  const [publicLinkIncludeConformity, setPublicLinkIncludeConformity] = useState(false);
  // Trava: quando o link é da área Cenografia, a matriz de conformidade é obrigatória
  // no mesmo questionário (não pode gerar link só do critério e deixar a conformidade
  // separada/sem resposta). Nesse caso a opção fica marcada e desabilitada.
  const [publicLinkForceConformity, setPublicLinkForceConformity] = useState(false);
  const [generatedPublicUrl, setGeneratedPublicUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Conformity public link dialog state (shared for cenografia + ferramentas)
  const [conformityPublicLinkType, setConformityPublicLinkType] = useState<ConformityLinkType | null>(null);
  const [conformityPublicRecipientName, setConformityPublicRecipientName] = useState("");
  const [generatedConformityUrl, setGeneratedConformityUrl] = useState<string | null>(null);
  const [conformityLinkCopied, setConformityLinkCopied] = useState(false);
  const { data: redirectOptionsData } = useRedirectOptions(
    selectedEventId ?? 0,
    redirectDialogArea?.firstCriterionId ?? 0,
  );
  const { data: publicLinkEligibleCriteria } = usePublicLinkEligibleCriteria(selectedEventId ?? null);
  const createPublicToken = useCreatePublicToken(selectedEventId ?? 0);
  const deletePublicToken = useDeletePublicToken(selectedEventId ?? 0);
  const createConformityPublicToken = useCreateConformityPublicToken(selectedEventId ?? 0);
  const createFerramentasPublicToken = useCreateFerramentasPublicToken(selectedEventId ?? 0);
  const { data: publicTokenHistory, refetch: refetchTokenHistory } = usePublicTokens(
    publicLinkDialogCriteriaIds !== null ? (selectedEventId ?? null) : null,
  );
  // Habilitado sempre que o avaliador é responsável pela conformidade deste
  // evento (não só quando o dialog de link está aberto) — precisamos saber se
  // já existe link enviado para trocar o formulário por uma view de histórico.
  const { data: conformityPublicTokenHistory, refetch: refetchConformityTokenHistory } = useConformityPublicTokens(
    isConformityEvaluatorForEvent ? (selectedEventId ?? null) : null,
  );
  const { data: ferramentasPublicTokenHistory, refetch: refetchFerramentasTokenHistory } = useFerramentasPublicTokens(
    isFerramentasEvaluatorForEvent ? (selectedEventId ?? null) : null,
  );

  const createMutation = useCreateEvaluation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: evalsQKey });
        toast({ title: "Rascunho salvo" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);

  // Sidebar do avaliador (A Fazer / Publicado / Concluídas) — useQueries por evento liberado.
  const { configuredEvents, relevantEvaluatorEvents, evaluatorEventStats, publishedNotDoneEvents, todoEvents, doneEvents } =
    useEvaluatorOverview({ isEvaluator, events, userId: user?.id, myPrincipalAreas });

  // If the selected event stops being selectable (closed or criteria unconfirmed
  // server-side), clear the selection so trigger text and loaded data stay in sync.
  useEffect(() => {
    if (selectedEventId == null || !events) return;
    const stillValid = events.some(e => e.id === selectedEventId && (e.status === "open" || e.status === "closed") && (isEvaluator ? e.criteriaConfirmed : true));
    if (!stillValid) { setSelectedEventId(null); setScores({}); setComments({}); setAudioOverrides({}); }
  }, [selectedEventId, events, isEvaluator]);

  const currentEvent = events?.find(e => e.id === selectedEventId);
  const criteriaLocked = currentEvent ? !currentEvent.criteriaConfirmed : false;

  // Avaliadores only see/evaluate the areas assigned to them FOR THIS EVENT
  // (atribuição evento→área→avaliador), not the fixed profile area.
  const myAssignedAreaIds = new Set(
    (selectedEventDetail?.areaAssignments ?? [])
      .filter(a => a.evaluatorUserId === user?.id)
      .map(a => a.areaId),
  );
  // Quando um critério já tem um registro de roteamento (foi atribuído/
  // redirecionado individualmente), ele manda: só quem está atualmente
  // designado enxerga o critério, mesmo que outra pessoa também pertença à
  // área responsável — é isso que faz um redirecionamento remover de vez o
  // critério da lista de quem redirecionou. Sem registro de roteamento
  // (evento legado / nunca atribuído individualmente), cai na área.
  const criterionAssignmentByCriterionId = new Map(
    (criterionAssignments ?? []).map(a => [a.criterionId, a]),
  );
  const myCriteria = activeCriteria.filter(c => {
    const assignment = criterionAssignmentByCriterionId.get(c.criterionId);
    if (assignment) return assignment.assignedToId === user?.id;
    return c.responsibleAreaId != null && myAssignedAreaIds.has(c.responsibleAreaId);
  });

  // For primary-area evaluators: fallback redirect options from the criterion's responsible area.
  // Placed after myCriteria because it references myCriteria.find() to look up the area.
  const redirectCriterionAreaId = redirectDialogArea?.areaId ?? null;
  const { data: redirectAreaUsersRaw } = useGetUsersByArea(redirectCriterionAreaId!, {
    query: {
      enabled: redirectCriterionAreaId != null,
      queryKey: ["users-by-area-redirect", redirectCriterionAreaId] as unknown[],
    },
  });
  // Routing-configured list takes priority; falls back to area members (excluding self).
  const effectiveRedirectOptions: { id: number; name: string }[] =
    (redirectOptionsData?.length ?? 0) > 0
      ? (redirectOptionsData ?? []).map(u => ({ id: u.id, name: u.name }))
      : (redirectAreaUsersRaw ?? [])
          .filter(u => u.id !== user?.id)
          .map(u => ({ id: u.id, name: u.name }));

  // Agrupa os critérios do avaliador logado por área — inclui areaId para
  // suportar botões de redirecionar/link-público por formulário (grupo de área).
  const myAreaGroups = groupCriteriaByArea(myCriteria);

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function currentScore(criterionId: number): number | null {
    if (scores[criterionId] != null) return scores[criterionId];
    const ev = getEval(criterionId);
    return ev ? parseFloat(ev.score as unknown as string) : null;
  }

  function currentAudio(criterionId: number): string | null {
    const override = audioOverrides[criterionId];
    if (override !== undefined) return override === "" ? null : override;
    return getEval(criterionId)?.audioUrl ?? null;
  }

  function handleSaveDraft(criterionId: number) {
    if (!selectedEventId) return;
    const score = currentScore(criterionId);
    if (score == null) return;

    const comment = comments[criterionId] ?? getEval(criterionId)?.comments ?? "";
    if (!comment.trim()) {
      toast({ title: "Comentário obrigatório", description: "Preencha o comentário antes de salvar.", variant: "destructive" });
      return;
    }
    // Áudio é opcional — complemento ao comentário, não trava salvar/submeter.
    const audioUrl = currentAudio(criterionId);
    createMutation.mutate({ data: { eventId: selectedEventId, criterionId, score, comments: comment, audioUrl: audioUrl ?? undefined } });
  }

  function handleScoreClick(criterionId: number, score: number) {
    setScores(s => ({ ...s, [criterionId]: score }));
  }

  function handleCommentChange(criterionId: number, value: string) {
    setComments(s => ({ ...s, [criterionId]: value }));
  }

  function handleAudioChange(criterionId: number, path: string | null) {
    setAudioOverrides(s => ({ ...s, [criterionId]: path ?? "" }));
  }

  // A criterion is "ready to launch" if it's already submitted, OR fully filled
  // in-screen: score escolhido, comentário preenchido e áudio gravado.
  function criterionReady(criterionId: number): boolean {
    const ev = getEval(criterionId);
    if (ev?.status === "submitted") return true;
    const score = currentScore(criterionId);
    if (score == null) return false;
    const comment = comments[criterionId] ?? ev?.comments ?? "";
    if (!comment.trim()) return false;
    return true;
  }

  // One-click submit: create/update each pending criterion as draft then submit
  // it, with no requirement to have saved a rascunho first. On success we leave
  // the evaluation screen so the avaliador sees the event as concluded.
  async function handleLaunchAll() {
    if (!selectedEventId) return;
    setLaunching(true);
    // Rastreia o progresso para que, em caso de falha, o toast diga qual
    // critério quebrou e quantos já haviam sido enviados antes dele.
    let sentCount = 0;
    let failingCriterionName: string | null = null;
    try {
      for (const c of myCriteria) {
        const ev = getEval(c.criterionId);
        if (ev?.status === "submitted") continue;
        const score = currentScore(c.criterionId);
        if (score == null) continue;
        failingCriterionName = c.criterionName ?? `critério #${c.criterionId}`;
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
        sentCount += 1;
        failingCriterionName = null;
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
      const reason = (e as { message?: string })?.message?.trim();
      const sentMsg = sentCount === 0
        ? "Nenhum critério foi enviado antes da falha."
        : sentCount === 1
          ? "1 critério foi enviado antes da falha."
          : `${sentCount} critérios foram enviados antes da falha.`;
      toast({
        title: failingCriterionName ? `Erro ao lançar "${failingCriterionName}"` : "Erro ao lançar avaliação",
        description: `${sentMsg}${reason ? ` Motivo: ${reason}.` : ""} Confira o que ficou pendente e tente novamente.`,
        variant: "destructive",
      });
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

  // Só "submitted" conta como concluído — mesma régua do card do evento
  // (EvaluatorEventCard); rascunho é trabalho em andamento, não entregue.
  const completedCount = myCriteria.filter(c => getEval(c.criterionId)?.status === "submitted").length;

  // Beyond the scored criteria, avaliadores da Matriz de Conformidade also
  // answer extra Sim/Não questions (Ferramentas e Case / Cenografia). Those
  // must count toward "Resumo da Avaliação" too, or the sidebar undercounts
  // this evaluator's real workload for the event.
  const extraConformityItemsTotal =
    (isFerramentasEvaluatorForEvent ? 1 : 0) +
    (isConformityEvaluatorForEvent ? 5 : 0);
  const extraConformityItemsCompleted =
    (isFerramentasEvaluatorForEvent && conformityEvalForm.guardaEquipamentos !== null ? 1 : 0) +
    (isConformityEvaluatorForEvent
      ? [conformityEvalForm.epi, conformityEvalForm.estaiamentos, conformityEvalForm.conduta, conformityEvalForm.standoutResponse]
          .filter(v => v !== null).length
        + (conformityEvalForm.absencesReport.trim() ? 1 : 0)
      : 0);

  const totalItems = myCriteria.length + extraConformityItemsTotal;
  const totalCompleted = completedCount + extraConformityItemsCompleted;

  const progressPct = totalItems ? (totalCompleted / totalItems) * 100 : 0;

  // ── Handlers repassados aos componentes (mesma sequência de setState de antes) ──
  function selectEvaluatorEvent(tab: EvalTab, eventId: number) {
    setActiveEvalTab(tab); setSelectedEventId(eventId); setScores({}); setComments({}); setAudioOverrides({});
  }

  function takeCriterion(criterionId: number) {
    patchCriterionAssignment.mutate(
      { criterionId, assignedToId: user!.id, action: "assign" },
      { onError: (e) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }) },
    );
  }

  function assignCriterionToUser(userId: number) {
    if (!areaAssignTarget) return;
    patchCriterionAssignment.mutate(
      { criterionId: areaAssignTarget.criterionId, assignedToId: userId, action: "assign" },
      {
        onError: (e) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
        onSuccess: () => setAreaAssignTarget(null),
      },
    );
  }

  function openRedirectDialog(g: AreaGroup) {
    setRedirectDialogArea({ areaId: g.areaId, areaName: g.areaName, criteriaIds: g.criteria.map(c => c.criterionId), firstCriterionId: g.criteria[0]?.criterionId ?? 0 }); setRedirectTargetId(null);
  }

  function closeRedirectDialog() {
    setRedirectDialogArea(null); setRedirectTargetId(null);
  }

  async function confirmRedirect() {
    if (!redirectDialogArea || !redirectTargetId) return;
    try {
      for (const criterionId of redirectDialogArea.criteriaIds) {
        await patchCriterionAssignment.mutateAsync({ criterionId, assignedToId: redirectTargetId, action: "redirect" });
      }
      toast({ title: "Formulário redirecionado com sucesso" });
      setRedirectDialogArea(null);
      setRedirectTargetId(null);
    } catch (e) {
      toast({ title: "Erro ao redirecionar", description: (e as Error).message, variant: "destructive" });
    }
  }

  function openPublicLinkDialog(g: AreaGroup, areaEligible: number[]) {
    const isCeno = g.areaId === CENOGRAFIA_AREA_ID; setPublicLinkDialogCriteriaIds(areaEligible); setPublicLinkDialogAreaName(g.areaName); setPublicLinkRecipientName(""); setGeneratedPublicUrl(null); setLinkCopied(false); setPublicLinkIncludeConformity(isCeno); setPublicLinkForceConformity(isCeno); refetchTokenHistory();
  }

  function closePublicLinkDialog() {
    setPublicLinkDialogCriteriaIds(null);
    setPublicLinkDialogAreaName(null);
    setPublicLinkRecipientName("");
    setPublicLinkIncludeConformity(false);
    setPublicLinkForceConformity(false);
    setGeneratedPublicUrl(null);
    setLinkCopied(false);
  }

  function generatePublicLink(linkCriterionIds: number[]) {
    createPublicToken.mutate(
      { recipientName: publicLinkRecipientName.trim(), criterionIds: linkCriterionIds, includeConformity: publicLinkIncludeConformity || undefined },
      {
        onSuccess: ({ tokenId }) => {
          const base = publicEvalBaseUrl();
          setGeneratedPublicUrl(`${base}/eval/${tokenId}`);
          refetchTokenHistory();
        },
        onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
      },
    );
  }

  function deletePublicLinkToken(tokenId: string) {
    deletePublicToken.mutate(
      { tokenId },
      { onSuccess: () => refetchTokenHistory() },
    );
  }

  function openConformityLinkDialog(type: ConformityLinkType) {
    setConformityPublicLinkType(type); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false);
    if (type === "cenografia") refetchConformityTokenHistory(); else refetchFerramentasTokenHistory();
  }

  function closeConformityLinkDialog() {
    setConformityPublicLinkType(null); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false);
  }

  function generateConformityLink(base: string) {
    const mutation = conformityPublicLinkType === "cenografia" ? createConformityPublicToken : createFerramentasPublicToken;
    mutation.mutate(
      { recipientName: conformityPublicRecipientName.trim() },
      {
        onSuccess: ({ tokenId }) => {
          setGeneratedConformityUrl(`${base}/eval/${tokenId}`);
          if (conformityPublicLinkType === "cenografia") refetchConformityTokenHistory();
          else refetchFerramentasTokenHistory();
        },
        onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
      },
    );
  }

  function saveConformity(data: EventConformityInput, successTitle: string) {
    if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data }, { onSuccess: () => toast({ title: successTitle }) });
  }

  // Redesign: admin/rh/diretoria ganham uma central dedicada de atribuição
  // (progresso + quem-falta-avaliar + atribuição de avaliadores), separada do
  // fluxo de lançamento de nota do avaliador que segue abaixo.
  if (isConsultation) {
    return (
      <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
        <div className="p-6 md:p-10">
          <AdminEvaluationsConsole />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen flex flex-col text-foreground" style={{ fontFamily: BODY }}>

      {/* ── Top bar ── */}
      <div className="bg-card px-5 py-3 flex items-center justify-between gap-4 shrink-0 border-b border-border">
        <div className="flex items-center gap-3">
          <h1 data-testid="text-page-title" className="text-xl uppercase tracking-tight font-black leading-none text-foreground" style={{ fontFamily: CONDENSED }}>
            Central de <span className="text-accent-text">Avaliações</span>
          </h1>
          {cycle && (
            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded border border-border text-muted-foreground hidden sm:inline-block">
              {cycle.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <EvaluatorSidebar
          isEvaluator={isEvaluator}
          selectedEventId={selectedEventId}
          evaluatorEventStats={evaluatorEventStats}
          todoEvents={todoEvents}
          publishedNotDoneEvents={publishedNotDoneEvents}
          doneEvents={doneEvents}
          configuredEventsCount={configuredEvents.length}
          relevantEventsCount={relevantEvaluatorEvents.length}
          onSelectEvent={selectEvaluatorEvent}
        />

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-auto p-5 space-y-5">

        {isEvaluator && selectedEventId && activeEvalTab === "todo" && !!myPrincipalAreas && myPrincipalAreas.length > 0 && (
          <PrincipalAreaCriteriaSection
            myPrincipalAreas={myPrincipalAreas}
            criterionAssignments={criterionAssignments}
            activeCriteria={activeCriteria}
            userId={user?.id}
            onTakeCriterion={takeCriterion}
            onAssignCriterion={setAreaAssignTarget}
          />
        )}

        <AreaAssignDialog
          target={areaAssignTarget}
          users={areaAssignUsers}
          userId={user?.id}
          onClose={() => setAreaAssignTarget(null)}
          onPickUser={assignCriterionToUser}
        />

        {!selectedEventId ? (
          <NoEventSelected />
        ) : (
          <div className="space-y-5">
            {/* Header strip compacto */}
            {currentEvent && <EventHeaderStrip currentEvent={currentEvent} />}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Criteria Column / Evaluation Form */}
              <CriteriaColumn
                criteriaLocked={criteriaLocked}
                myCriteria={myCriteria}
                myAreaGroups={myAreaGroups}
                publicLinkEligibleCriteria={publicLinkEligibleCriteria}
                criterionAssignments={criterionAssignments}
                comments={comments}
                getEval={getEval}
                currentScore={currentScore}
                currentAudio={currentAudio}
                isSaving={createMutation.isPending}
                progressPct={progressPct}
                onRedirectArea={openRedirectDialog}
                onOpenPublicLink={openPublicLinkDialog}
                onScoreClick={handleScoreClick}
                onCommentChange={handleCommentChange}
                onAudioChange={handleAudioChange}
                onSaveDraft={handleSaveDraft}
              />

              {/* ─── GRUPO 1: Ferramentas e Case (Cenografia) ─── */}
              {isFerramentasEvaluatorForEvent && (
                <FerramentasConformitySection
                  conformityEvalForm={conformityEvalForm}
                  setConformityEvalForm={setConformityEvalForm}
                  myConformityData={myConformityData}
                  ferramentasPublicTokenHistory={ferramentasPublicTokenHistory}
                  ferramentasUsers={ferramentasUsers}
                  redirectOpen={redirectFerramentasOpen}
                  onRedirectOpenChange={setRedirectFerramentasOpen}
                  redirectTargetId={redirectFerramentasTargetId}
                  onRedirectSelect={(userId) => { setRedirectFerramentasTargetId(userId); redirectFerramentasMutation.mutate({ id: selectedEventId!, data: { userId } }); }}
                  onOpenLinkDialog={() => openConformityLinkDialog("ferramentas")}
                  saveConformity={saveConformity}
                  isSaving={conformityEvalMutation.isPending}
                  toast={toast}
                />
              )}

              {/* ─── GRUPO 2: Cenografia ─── */}
              {isConformityEvaluatorForEvent && (
                <CenografiaConformitySection
                  conformityEvalForm={conformityEvalForm}
                  setConformityEvalForm={setConformityEvalForm}
                  myConformityData={myConformityData}
                  conformityPublicTokenHistory={conformityPublicTokenHistory}
                  cenografiaUsers={cenografiaUsers}
                  redirectOpen={redirectConformityOpen}
                  onRedirectOpenChange={setRedirectConformityOpen}
                  redirectTargetId={redirectConformityTargetId}
                  onRedirectSelect={(userId) => { setRedirectConformityTargetId(userId); redirectConformityMutation.mutate({ id: selectedEventId!, data: { userId } }); }}
                  onOpenLinkDialog={() => openConformityLinkDialog("cenografia")}
                  saveConformity={saveConformity}
                  isSaving={conformityEvalMutation.isPending}
                  toast={toast}
                />
              )}

              {/* Right Sticky Panel */}
              <EvaluationSummaryPanel
                isEvaluator={isEvaluator}
                myCriteria={myCriteria}
                getEval={getEval}
                currentScore={currentScore}
                comments={comments}
                progressPct={progressPct}
                totalItems={totalItems}
                totalCompleted={totalCompleted}
                completedCount={completedCount}
                extraConformityItemsTotal={extraConformityItemsTotal}
                extraConformityItemsCompleted={extraConformityItemsCompleted}
                isFerramentasEvaluatorForEvent={isFerramentasEvaluatorForEvent}
                isConformityEvaluatorForEvent={isConformityEvaluatorForEvent}
                conformityEvalForm={conformityEvalForm}
                allEvaled={allEvaled}
                allReady={allReady}
                pendingToFill={pendingToFill}
                launching={launching}
                confirmLaunchOpen={confirmLaunchOpen}
                setConfirmLaunchOpen={setConfirmLaunchOpen}
                toSubmitCount={toSubmitCount}
                eventName={currentEvent?.name}
                onLaunch={handleLaunchAll}
              />
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      <RedirectFormDialog
        area={redirectDialogArea}
        targetId={redirectTargetId}
        onTargetChange={setRedirectTargetId}
        options={effectiveRedirectOptions}
        isPending={patchCriterionAssignment.isPending}
        onClose={closeRedirectDialog}
        onConfirm={confirmRedirect}
      />

      <PublicLinkDialog
        criteriaIds={publicLinkDialogCriteriaIds}
        areaName={publicLinkDialogAreaName}
        recipientName={publicLinkRecipientName}
        setRecipientName={setPublicLinkRecipientName}
        includeConformity={publicLinkIncludeConformity}
        setIncludeConformity={setPublicLinkIncludeConformity}
        forceConformity={publicLinkForceConformity}
        generatedUrl={generatedPublicUrl}
        linkCopied={linkCopied}
        setLinkCopied={setLinkCopied}
        eligibleCriteria={publicLinkEligibleCriteria}
        activeCriteria={activeCriteria}
        history={publicTokenHistory}
        isGenerating={createPublicToken.isPending}
        isDeleting={deletePublicToken.isPending}
        onGenerate={generatePublicLink}
        onDeleteToken={deletePublicLinkToken}
        onClose={closePublicLinkDialog}
        toast={toast}
      />

      <ConformityPublicLinkDialog
        linkType={conformityPublicLinkType}
        recipientName={conformityPublicRecipientName}
        setRecipientName={setConformityPublicRecipientName}
        generatedUrl={generatedConformityUrl}
        linkCopied={conformityLinkCopied}
        setLinkCopied={setConformityLinkCopied}
        conformityHistory={conformityPublicTokenHistory}
        ferramentasHistory={ferramentasPublicTokenHistory}
        isGenerating={createConformityPublicToken.isPending || createFerramentasPublicToken.isPending}
        onGenerate={generateConformityLink}
        onClose={closeConformityLinkDialog}
        toast={toast}
      />

    </div>
  );
}
