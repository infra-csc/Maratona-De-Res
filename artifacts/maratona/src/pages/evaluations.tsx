import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Rocket, SearchX } from "lucide-react";
import { useGetEvent, getGetEventQueryKey, useGetEvaluations, useCreateEvaluation, useGetEventConformity, useSetEventConformity, useRedirectConformityEvaluator, useRedirectConformityEvaluatorFerramentas, useGetUsersByArea, useGetCurrentCycle, useDeleteEvaluationDraft, getGetEvaluationsQueryKey, createEvaluation, submitEvaluation, ApiError, type EventConformityInput, type EventCriterion } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { withServerMessage } from "@/lib/calibration-api";
import { apiErrorCode, EVENT_NEXT_CYCLE } from "@/lib/utils";
import { isNextCycleEvent, opensLabelFor, NEXT_CYCLE_NOTICE } from "./events/rules";
import { serverErrorMessage } from "./eval-public/helpers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { useEventCriterionAssignments, usePatchCriterionAssignment, useRedirectOptions, useCreatePublicToken, usePublicTokens, usePublicLinkEligibleCriteria, useCreateConformityPublicToken, useCreateFerramentasPublicToken, useConformityPublicTokens, useFerramentasPublicTokens, useMyPrincipalAreas, useUsersByArea, useDeletePublicToken } from "@/lib/routing-api";
import { AdminEvaluationsConsole } from "./evaluations-admin-console";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { CENOGRAFIA_AREA_ID, FERRAMENTAS_AREA_ID, cenografiaItemCount, cenografiaItemsFor } from "./evaluations/constants";
import { conformityFormFromData, displayCriterionName, emptyConformityForm, groupCriteriaByArea, publicEvalBaseUrl } from "./evaluations/helpers";
import type { AreaAssignTarget, AreaGroup, ConformityEvalForm, ConformityLinkType, RedirectDialogArea } from "./evaluations/types";
import { useMyAreaList, useMyAreaEvent, invalidateMyArea, periodFrom, type PeriodFilter, type StatusFilter } from "./evaluations/use-my-area";
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
  // Evento aberto vive na URL (?evento=ID): o portal NORTE abre direto nele e
  // o voltar do navegador funciona.
  const urlSearch = useSearch();
  const [, navigate] = useLocation();
  const selectedEventId = useMemo(() => {
    const v = Number(new URLSearchParams(urlSearch).get("evento"));
    return Number.isInteger(v) && v > 0 ? v : null;
  }, [urlSearch]);
  function setSelectedEventId(id: number | null) {
    navigate(id ? `/evaluations?evento=${id}` : "/evaluations");
  }
  // Entrada pelo portal sem sessão ou com a sessão vencida: o main.tsx (ou o
  // tratamento do 401 no App.tsx) guardou o destino antes do login. Consome
  // SEMPRE (para não sobrar um destino velho) e, se a URL chegou sem evento,
  // retoma o evento pedido.
  useEffect(() => {
    let destino: string | null = null;
    try { destino = sessionStorage.getItem("maratona_destino"); sessionStorage.removeItem("maratona_destino"); } catch { /* sem storage */ }
    if (selectedEventId != null) return;
    const m = destino ? /\/evaluations\?(.*)$/.exec(destino) : null;
    const id = m ? Number(new URLSearchParams(m[1]).get("evento")) : NaN;
    if (Number.isInteger(id) && id > 0) navigate(`/evaluations?evento=${id}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lista de eventos recolhível (desktop): com um evento aberto em telas até
  // 1535 px, ela começa recolhida para o critério não ficar espremido entre a
  // lista e o resumo. A escolha da pessoa fica lembrada neste navegador.
  const [listCollapsed, setListCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("maratona_avaliador_lista");
      if (saved === "recolhida") return true;
      if (saved === "aberta") return false;
    } catch { /* sem storage */ }
    return typeof window !== "undefined" && window.matchMedia?.("(max-width: 1535px)").matches === true;
  });
  function toggleList() {
    setListCollapsed(v => {
      try { localStorage.setItem("maratona_avaliador_lista", v ? "aberta" : "recolhida"); } catch { /* sem storage */ }
      return !v;
    });
  }

  // Filtros da lista (busca com atraso curto para não consultar a cada tecla).
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("cycle");

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

  const { data: cycle } = useGetCurrentCycle();

  // Lista da barra lateral e o evento aberto: GET /evaluations/my-area.
  const listParams = useMemo(() => ({
    status: statusFilter,
    ...(searchTerm ? { search: searchTerm } : {}),
    ...(periodFrom(periodFilter) ? { from: periodFrom(periodFilter) } : {}),
  }), [statusFilter, searchTerm, periodFilter]);
  const areaList = useMyAreaList(listParams, isEvaluator);
  const areaEvent = useMyAreaEvent(selectedEventId, isEvaluator);
  const selectedInfo = areaEvent.event;

  // Trocou de evento (clique, voltar do navegador, link do portal): limpa o
  // que estava sendo digitado no evento anterior.
  useEffect(() => {
    setScores({}); setComments({}); setAudioOverrides({});
  }, [selectedEventId]);

  // Critérios do evento: SÓ os que o avaliador responde, vindos do my-area
  // (regra do dono: o avaliador só vê o que é da área dele). A tela não lê
  // mais GET /events/:id/criteria, que traz o evento inteiro. O formato é o
  // mesmo de EventCriterion para os cartões continuarem iguais.
  const criteria: EventCriterion[] = useMemo(() => (selectedInfo?.criteria ?? []).map(c => ({
    id: 0,
    eventId: selectedInfo!.id,
    criterionId: c.criterionId,
    criterionName: c.name,
    criterionDescription: c.description,
    responsibleAreaId: c.areaId,
    responsibleAreaName: c.areaName,
    active: true,
    originalWeight: c.weight,
    weightOverride: c.weight,
    normalizedWeight: 0,
    eventScoped: c.eventScoped,
    sourceCriterionId: c.sourceCriterionId,
  })), [selectedInfo]);
  const areaMode = !!selectedInfo?.areaMode;
  const withoutConduta = !!selectedInfo?.conformityWithoutConduta;

  // Responsável pela Matriz de Conformidade neste evento: vem do my-area (o
  // avaliador não lê mais o detalhe completo do evento — só o que avalia).
  const isConformityEvaluatorForEvent = !!selectedInfo?.conformityCenografia;
  const isFerramentasEvaluatorForEvent = !!selectedInfo?.conformityFerramentas;
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
  const invalidateConformityViews = () => {
    qc.invalidateQueries({ queryKey: ["event-conformity-eval", selectedEventId] });
    if (selectedEventId != null) qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId) });
  };
  const redirectConformityMutation = useRedirectConformityEvaluator({
    mutation: {
      // A resposta traz só { ok, conformityEvaluatorUserId }: a tela não lê o
      // corpo — refaz as consultas do evento (my-area, matriz e detalhe).
      onSuccess: () => { invalidateMyArea(qc); invalidateConformityViews(); setRedirectConformityOpen(false); toast({ title: "Avaliação redirecionada" }); },
      onError: (e: unknown) => toast({ title: "Erro ao redirecionar", description: serverErrorMessage(e, s => `Erro ${s}`), variant: "destructive" }),
    },
  });
  const redirectFerramentasMutation = useRedirectConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: () => { invalidateMyArea(qc); invalidateConformityViews(); setRedirectFerramentasOpen(false); toast({ title: "Avaliação redirecionada" }); },
      onError: (e: unknown) => toast({ title: "Erro ao redirecionar", description: serverErrorMessage(e, s => `Erro ${s}`), variant: "destructive" }),
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
        invalidateMyArea(qc);
        toast({ title: "Rascunho salvo" });
      },
      onError: (e: unknown) => {
        // 409 = a área já respondeu enquanto eu preenchia: a tela recarrega e
        // o critério passa a mostrar quem respondeu.
        if (e instanceof ApiError && e.status === 409) { invalidateMyArea(qc); qc.invalidateQueries({ queryKey: evalsQKey }); }
        // 409 EVENT_NEXT_CYCLE: o evento é do próximo ciclo — a mensagem é do servidor.
        const nextCycle = apiErrorCode(e) === EVENT_NEXT_CYCLE;
        toast({ title: nextCycle ? "Evento do próximo ciclo" : e instanceof ApiError && e.status === 409 ? "Critério já respondido pela área" : "Erro ao salvar", description: serverErrorMessage(e, s => `Erro ${s}`), variant: "destructive" });
      },
    },
  });

  const activeCriteria = criteria;
  // Critério respondido também por outra área (o servidor sabe; a tela só vê os meus).
  const sharedCriterionIds = new Set((selectedInfo?.criteria ?? []).filter(c => c.multiArea).map(c => c.criterionId));

  // O evento da URL só abre se tiver algo meu (designado, critério da área do
  // cadastro no ciclo com avaliação por área, ou matriz) e a avaliação já
  // tiver aberto (dia seguinte ao evento) — o servidor (GET
  // /evaluations/my-area) decide. Sem isso, a tela explica.
  const currentEvent = selectedInfo;
  const eventUnavailable = selectedEventId != null && areaEvent.isSuccess && !selectedInfo;
  // Evento indisponível: as datas dizem se a avaliação ainda vai abrir
  // ("Abre em DD/MM", dia seguinte ao fim, BRT) ou se o evento é do próximo
  // ciclo (selo "Próximo ciclo" + a frase única) — mesma regra da lista de Eventos.
  const unavailableEventQ = useGetEvent(selectedEventId ?? 0, {
    // O papel avaliador não lê GET /events/:id (lib/evaluator-scope.ts na API): para ele fica o texto geral.
    query: { queryKey: getGetEventQueryKey(selectedEventId ?? 0), enabled: eventUnavailable && user?.role !== "avaliador", retry: false },
  });
  // Avaliador: o próprio my-area diz quando abre (nome, datas e "próximo ciclo"), só para evento DELE.
  const areaUnavailable = eventUnavailable ? areaEvent.data?.unavailable ?? null : null;
  const unavailableEvent = eventUnavailable
    ? unavailableEventQ.data ?? (areaUnavailable ? { name: areaUnavailable.eventName, startDate: areaUnavailable.startDate, endDate: areaUnavailable.endDate, nextCycle: areaUnavailable.nextCycle, status: "open", cycleId: null as number | null } : null)
    : null;
  const unavailableCycle = unavailableEvent && cycle && unavailableEvent.cycleId === cycle.id ? cycle : null;
  const unavailableOpens = unavailableEvent ? opensLabelFor(unavailableEvent, unavailableCycle) : null;
  const unavailableNextCycle = !!unavailableEvent && isNextCycleEvent(unavailableEvent, unavailableCycle);
  const selectedIsNextCycle = !!selectedInfo && !!cycle && (!selectedInfo.cycleName || selectedInfo.cycleName === cycle.name) && isNextCycleEvent(selectedInfo, cycle);

  // Critérios que respondo neste evento — quem decide é o servidor.
  const infoByCriterionId = new Map((selectedInfo?.criteria ?? []).map(c => [c.criterionId, c]));
  const criterionInfo = (criterionId: number) => infoByCriterionId.get(criterionId);
  const myCriteria = activeCriteria;
  const isClosed = (criterionId: number) => infoByCriterionId.get(criterionId)?.state === "closed";
  // Fechados (no modo por área, outra pessoa respondeu primeiro) não entram no envio.
  const launchCriteria = myCriteria.filter(c => !isClosed(c.criterionId));

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

  // Resposta que fechou o critério (a primeira enviada por outra pessoa da
  // área): o avaliador vê o que foi avaliado — nota, comentário, quem e quando.
  function closingEval(criterionId: number) {
    return (evaluations ?? [])
      .filter(e => e.criterionId === criterionId && e.status === "submitted" && e.evaluatorUserId !== user?.id)
      .sort((a, b) => String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? "")))[0];
  }
  // Resumo das notas: critério fechado mostra "9 · por Fulano de Tal" (nome completo).
  const closedNames = new Map(
    myCriteria.filter(c => isClosed(c.criterionId)).map(c => {
      const info = infoByCriterionId.get(c.criterionId);
      const closing = closingEval(c.criterionId);
      const name = info?.answeredByName ?? closing?.evaluatorName ?? "avaliador da área";
      return [c.criterionId, { name, score: closing?.score != null ? Number(closing.score) : null }] as const;
    }),
  );

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function currentScore(criterionId: number): number | null {
    if (scores[criterionId] != null) return scores[criterionId];
    const ev = getEval(criterionId);
    return ev ? Number(ev.score) : null;
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

  // Rascunho meu de um critério que a área já fechou: some da tela (e das contas).
  const discardDraft = useDeleteEvaluationDraft({
    mutation: {
      onSuccess: async () => {
        await qc.invalidateQueries({ queryKey: evalsQKey });
        await invalidateMyArea(qc);
        toast({ title: "Rascunho descartado" });
      },
      onError: (e: { message?: string }) => toast({ title: "Não foi possível descartar o rascunho", description: e?.message, variant: "destructive" }),
    },
  });
  function handleDiscardDraft(evaluationId: number, criterionId: number) {
    discardDraft.mutate({ id: evaluationId });
    setScores(s => { const n = { ...s }; delete n[criterionId]; return n; });
    setComments(s => { const n = { ...s }; delete n[criterionId]; return n; });
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
      for (const c of launchCriteria) {
        const ev = getEval(c.criterionId);
        if (ev?.status === "submitted") continue;
        const score = currentScore(c.criterionId);
        if (score == null) continue;
        failingCriterionName = displayCriterionName(c.criterionName) || `critério #${c.criterionId}`;
        const comment = comments[c.criterionId] ?? ev?.comments ?? "";
        const audioUrl = currentAudio(c.criterionId);
        // withServerMessage: o motivo do servidor (ex.: "Já respondido por
        // Fulano em 05/10 14:30") chega limpo ao aviso, sem "HTTP 409 …".
        const created = await withServerMessage(createEvaluation({
          eventId: selectedEventId,
          criterionId: c.criterionId,
          score,
          comments: comment || undefined,
          audioUrl: audioUrl ?? undefined,
        }));
        await withServerMessage(submitEvaluation(created.id));
        sentCount += 1;
        failingCriterionName = null;
      }
      await qc.invalidateQueries({ queryKey: evalsQKey });
      await invalidateMyArea(qc);
      setConfirmLaunchOpen(false);
      setScores({}); setComments({}); setAudioOverrides({});
      if (extraConformityItemsCompleted < extraConformityItemsTotal) {
        // Os critérios foram, mas a matriz deste evento ainda está em aberto:
        // o evento continua na tela para o avaliador terminar.
        toast({
          title: "Critérios lançados — falta a Matriz de Conformidade",
          description: "Responda a Matriz de Conformidade abaixo para concluir este evento.",
        });
        return;
      }
      toast({ title: "Avaliação lançada com sucesso", description: "Você não tem pendências para este evento." });
      setSelectedEventId(null);
    } catch (e) {
      // A criterion may already be submitted (e.g. a retry after a partial
      // failure) ou a área respondeu antes (409). Recarrega para a tela mostrar
      // o estado real e a próxima tentativa pular o que já foi.
      await qc.invalidateQueries({ queryKey: evalsQKey });
      await invalidateMyArea(qc);
      setConfirmLaunchOpen(false);
      const reason = (e as { message?: string })?.message?.trim();
      const sentMsg = sentCount === 0
        ? "Nenhum critério foi enviado antes da falha."
        : sentCount === 1
          ? "1 critério foi enviado antes da falha."
          : `${sentCount} critérios foram enviados antes da falha.`;
      toast({
        title: apiErrorCode(e) === EVENT_NEXT_CYCLE ? "Evento do próximo ciclo: avaliação ainda não abriu"
          : failingCriterionName ? `Erro ao lançar "${failingCriterionName}"` : "Erro ao lançar avaliação",
        description: `${sentMsg}${reason ? ` Motivo: ${reason}.` : ""} Confira o que ficou pendente e tente novamente.`,
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  }

  // Respondido = enviado por mim OU fechado pela área (outra pessoa respondeu).
  const isDone = (criterionId: number) => getEval(criterionId)?.status === "submitted" || isClosed(criterionId);
  const allEvaled = myCriteria.length > 0 && myCriteria.every(c => isDone(c.criterionId));
  // Ready to launch when every criterion I can still send is filled in-screen
  // (or already done), and there is at least one not-yet-submitted to send.
  const allReady = launchCriteria.length > 0 && launchCriteria.every(c => criterionReady(c.criterionId));
  const pendingToFill = launchCriteria.filter(c => !criterionReady(c.criterionId)).length;
  const toSubmitCount = launchCriteria.filter(c => getEval(c.criterionId)?.status !== "submitted").length;

  // Só "submitted" (ou fechado pela área) conta como concluído; rascunho é
  // trabalho em andamento, não entregue.
  const completedCount = myCriteria.filter(c => isDone(c.criterionId)).length;

  // Link combinado (critérios + matriz): só quem responde pela matriz neste
  // evento, e só enquanto ela não tem resposta — o servidor confere igual.
  const cenografiaAnswered = !!myConformityData && (
    [myConformityData.epi, myConformityData.estaiamentos, myConformityData.conduta, myConformityData.standoutResponse].some(v => v != null)
    || !!myConformityData.absencesReport?.trim()
  );
  const canIncludeConformity = isConformityEvaluatorForEvent && !cenografiaAnswered;
  // Quem respondeu a matriz foi OUTRA pessoa (link combinado, link de
  // conformidade, outro avaliador da área ou o RH)? Então a tela só mostra a
  // resposta. O nome gravado no envio decide; sem ele (dado antigo), quem criou.
  const cenografiaAnsweredByOther = (() => {
    if (!cenografiaAnswered || !myConformityData) return null;
    const byName = myConformityData.cenografiaSubmittedByName?.trim() || null;
    const mine = byName
      ? byName.localeCompare((user?.name ?? "").trim(), "pt-BR", { sensitivity: "base" }) === 0
      : myConformityData.createdByUserId === user?.id;
    if (mine) return null;
    return { name: byName ?? myConformityData.createdByUserName ?? null, at: myConformityData.updatedAt ?? myConformityData.createdAt ?? null };
  })();
  // Beyond the scored criteria, avaliadores da Matriz de Conformidade also
  // answer extra Sim/Não questions (Ferramentas e Case / Cenografia). Those
  // must count toward "Resumo da Avaliação" too, or the sidebar undercounts
  // this evaluator's real workload for the event.
  // Cenografia: as perguntas Sim/Não do evento (sem "Conduta" no ciclo novo
  // → 4 itens no total) + Destaque + Faltas/Atrasos.
  const extraConformityItemsTotal =
    (isFerramentasEvaluatorForEvent ? 1 : 0) +
    (isConformityEvaluatorForEvent ? cenografiaItemCount(withoutConduta) : 0);
  const extraConformityItemsCompleted =
    (isFerramentasEvaluatorForEvent && conformityEvalForm.guardaEquipamentos !== null ? 1 : 0) +
    (isConformityEvaluatorForEvent && cenografiaAnsweredByOther
      // Respondida por outra pessoa: não é pendência minha.
      ? cenografiaItemCount(withoutConduta)
      : isConformityEvaluatorForEvent
      ? [...cenografiaItemsFor(withoutConduta).map(i => conformityEvalForm[i.key]), conformityEvalForm.standoutResponse]
          .filter(v => v !== null).length
        + (conformityEvalForm.absencesReport.trim() ? 1 : 0)
      : 0);

  const totalItems = myCriteria.length + extraConformityItemsTotal;
  const totalCompleted = completedCount + extraConformityItemsCompleted;

  const progressPct = totalItems ? (totalCompleted / totalItems) * 100 : 0;

  // ── Handlers repassados aos componentes (mesma sequência de setState de antes) ──
  function selectEvaluatorEvent(eventId: number) {
    setSelectedEventId(eventId);
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
    const isCeno = g.areaId === CENOGRAFIA_AREA_ID && canIncludeConformity; setPublicLinkDialogCriteriaIds(areaEligible); setPublicLinkDialogAreaName(g.areaName); setPublicLinkRecipientName(""); setGeneratedPublicUrl(null); setLinkCopied(false); setPublicLinkIncludeConformity(isCeno); setPublicLinkForceConformity(isCeno); refetchTokenHistory();
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
      { recipientName: publicLinkRecipientName.trim(), criterionIds: linkCriterionIds, includeConformity: (canIncludeConformity && publicLinkIncludeConformity) || undefined },
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

      {/* ── Body: lista + avaliação (no celular, uma OU outra) ── */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">

        {/* ── Lista de eventos (recolhível no desktop com um evento aberto) ── */}
        <EvaluatorSidebar
          data={areaList.data}
          isLoading={areaList.isLoading}
          isFetching={areaList.isFetching}
          error={areaList.error}
          onRetry={() => { void areaList.refetch(); }}
          selectedEventId={selectedEventId}
          onSelectEvent={selectEvaluatorEvent}
          search={searchInput}
          onSearchChange={setSearchInput}
          status={statusFilter}
          onStatusChange={setStatusFilter}
          period={periodFilter}
          onPeriodChange={setPeriodFilter}
          hiddenOnMobile={selectedEventId != null}
          collapsed={listCollapsed && selectedEventId != null}
          onToggleCollapsed={toggleList}
        />

        {/* ── Avaliação (no celular, só aparece com um evento aberto) ── */}
        <div className={`flex-1 flex-col min-w-0 ${selectedEventId != null ? "flex" : "hidden md:flex"}`}>
          <div className={`@container flex-1 min-w-0 p-4 md:p-5 space-y-5 ${selectedEventId != null ? "pb-28 md:pb-5" : ""}`}>

        {selectedEventId != null && (
          <button
            type="button"
            onClick={() => setSelectedEventId(null)}
            className="md:hidden inline-flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground hover:text-foreground -mt-1 min-h-8"
          >
            <ArrowLeft size={14} /> Eventos
          </button>
        )}

        <AreaAssignDialog
          target={areaAssignTarget}
          users={areaAssignUsers}
          userId={user?.id}
          onClose={() => setAreaAssignTarget(null)}
          onPickUser={assignCriterionToUser}
        />

        {!selectedEventId ? (
          <NoEventSelected pendingCount={areaList.data && !searchTerm && periodFilter === "cycle" ? areaList.data.totals.pending : null} upcoming={areaList.data?.upcoming ?? []} />
        ) : eventUnavailable ? (
          <div data-testid="notice-event-unavailable" className="max-w-lg mx-auto mt-10 text-center bg-card border border-border rounded-xl px-6 py-10">
            <div className="w-14 h-14 border border-border rounded-lg bg-secondary text-muted-foreground flex items-center justify-center mx-auto mb-4">
              <SearchX size={24} />
            </div>
            <h2 className="text-2xl uppercase font-black tracking-tight mb-1" style={{ fontFamily: CONDENSED }}>
              {unavailableOpens ? "Avaliação ainda não abriu" : "Evento indisponível para você"}
            </h2>
            {unavailableOpens && (
              <p data-testid="notice-event-opens" className="inline-block my-2 rounded-full px-3 py-1 text-[12px] font-bold uppercase" style={{ fontFamily: CONDENSED, backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                {unavailableOpens}
              </p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {unavailableNextCycle
                ? NEXT_CYCLE_NOTICE
                : unavailableOpens
                  ? `A avaliação de ${unavailableEvent?.name ?? "este evento"} abre sozinha no dia seguinte ao fim do evento. Volte a partir dessa data.`
                  : "Este evento não tem nada para você avaliar, ou a avaliação dele ainda não abriu — ela abre sozinha no dia seguinte à realização do evento."}
            </p>
            <button type="button" onClick={() => setSelectedEventId(null)} className="mt-5 border border-border rounded-lg bg-card px-4 py-2 font-bold text-xs uppercase tracking-wider hover:bg-secondary">
              Ver meus eventos
            </button>
          </div>
        ) : areaEvent.isError ? (
          <div role="alert" className="max-w-lg mx-auto mt-10 text-center bg-card border border-border rounded-xl px-6 py-10 space-y-3">
            <p className="text-sm font-bold text-destructive">Não foi possível abrir este evento.</p>
            <p className="text-xs text-muted-foreground">{areaEvent.error?.message}</p>
            <button type="button" onClick={() => { void areaEvent.refetch(); }} className="border border-border rounded-lg bg-card px-4 py-2 font-bold text-xs uppercase tracking-wider hover:bg-secondary">
              Tentar de novo
            </button>
          </div>
        ) : !selectedInfo ? (
          <div className="space-y-4" role="status" aria-live="polite">
            <span className="sr-only">Carregando evento…</span>
            <div className="h-16 rounded-xl bg-secondary animate-pulse" />
            <div className="h-72 rounded-xl bg-secondary animate-pulse" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header strip compacto */}
            {/* Evento do próximo ciclo (começa depois do fim do ciclo atual): a
                API recusa a avaliação (409 EVENT_NEXT_CYCLE) até o ciclo novo existir.
                Um selo só ("Próximo ciclo") na faixa + a frase única abaixo. */}
            {currentEvent && <EventHeaderStrip currentEvent={currentEvent} nextCycle={selectedIsNextCycle} />}

            {selectedIsNextCycle && (
              <div role="status" data-testid="notice-event-next-cycle" className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                {NEXT_CYCLE_NOTICE}
              </div>
            )}

            {/* Avaliador principal (fluxo antigo): atribuir/tomar os quesitos da
                área. No ciclo com avaliação por área não há o que atribuir —
                qualquer avaliador da área responde. */}
            {isEvaluator && selectedInfo.pending && !areaMode && !!myPrincipalAreas && myPrincipalAreas.length > 0 && (
              <PrincipalAreaCriteriaSection
                myPrincipalAreas={myPrincipalAreas}
                criterionAssignments={criterionAssignments}
                userId={user?.id}
                onTakeCriterion={takeCriterion}
                onAssignCriterion={setAreaAssignTarget}
              />
            )}

            {/* Duas colunas (formulário + resumo) só quando a área de conteúdo
                tem largura para isso; abaixo disso, o resumo vem depois. */}
            <div className="grid grid-cols-1 @4xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">

              <div className="space-y-8 min-w-0">
                {/* Critérios */}
                <CriteriaColumn
                  myCriteria={myCriteria}
                  myAreaGroups={myAreaGroups}
                  areaMode={areaMode}
                  publicLinkEligibleCriteria={publicLinkEligibleCriteria}
                  criterionAssignments={criterionAssignments}
                  sharedCriterionIds={sharedCriterionIds}
                  comments={comments}
                  getEval={getEval}
                  currentScore={currentScore}
                  currentAudio={currentAudio}
                  isSaving={createMutation.isPending}
                  progressPct={progressPct}
                  criterionInfo={criterionInfo}
                  closingEval={closingEval}
                  onRedirectArea={openRedirectDialog}
                  onOpenPublicLink={openPublicLinkDialog}
                  onScoreClick={handleScoreClick}
                  onCommentChange={handleCommentChange}
                  onAudioChange={handleAudioChange}
                  onSaveDraft={handleSaveDraft}
                  onDiscardDraft={handleDiscardDraft}
                  isDiscarding={discardDraft.isPending}
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
                    withoutConduta={withoutConduta}
                    answeredByOther={cenografiaAnsweredByOther}
                  />
                )}
              </div>

              {/* Resumo (lado direito quando cabe; senão, depois do formulário) */}
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
                closedNames={closedNames}
                launchCriteria={launchCriteria}
                withoutConduta={withoutConduta}
                cenografiaByOther={cenografiaAnsweredByOther ? (cenografiaAnsweredByOther.name ?? "outra pessoa") : null}
              />
            </div>

            {/* Celular: o botão de lançar fica fixo no rodapé (o resumo vem
                depois do formulário). */}
            {isEvaluator && myCriteria.length > 0 && !allEvaled && (
              <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
                {allReady ? (
                  <button
                    type="button"
                    data-testid="button-submit-eval-mobile"
                    onClick={() => setConfirmLaunchOpen(true)}
                    disabled={launching}
                    className="w-full min-h-12 bg-primary text-primary-foreground border border-primary rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Rocket size={16} /> Lançar Avaliação
                  </button>
                ) : (
                  <button type="button" disabled className="w-full min-h-12 bg-secondary border border-border rounded-lg font-bold text-sm uppercase tracking-wider opacity-70 cursor-not-allowed">
                    {pendingToFill} {pendingToFill === 1 ? "critério pendente" : "critérios pendentes"}
                  </button>
                )}
              </div>
            )}
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
        canIncludeConformity={canIncludeConformity}
        withoutConduta={withoutConduta}
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
        withoutConduta={withoutConduta}
      />

    </div>
  );
}
