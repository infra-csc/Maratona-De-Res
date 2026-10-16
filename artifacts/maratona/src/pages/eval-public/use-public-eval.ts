import { useState, useEffect } from "react";
import {
  getPublicEval, submitPublicEval, submitPublicEvalConformity, ApiError,
  type PublicEvalInfo, type PublicEvalSubmitInput, type PublicEvalConformityInput, type PublicEvalSubmitRejected,
} from "@workspace/api-client-react";
import { serverErrorMessage, cenoItems, cenoCommentKeyOf, cenoLabels } from "./helpers";
import { apiErrorCode, EVENT_NEXT_CYCLE } from "@/lib/utils";
import type { CriterionAnswer, ConformityAnswers, PendingItem } from "./types";
import { displayCriterionName } from "../../lib/criterion-name";

/**
 * Estado do formulário público (link de uso único): carga do token, respostas
 * de critérios e das matrizes de conformidade, regras de envio, lista de
 * pendências e os dois envios (critérios [+ cenografia] / só conformidade).
 */
/** Rascunho local (só neste aparelho) — some no envio. Conexão ruim/recarga não apaga o que a pessoa já preencheu. */
const draftKey = (token: string) => `maratona_eval_draft:${token}`;
type LocalDraft = {
  submitterName?: string;
  answers?: Record<number, CriterionAnswer>;
  cenoAnswers?: ConformityAnswers;
  ferramentasAnswer?: boolean | null;
  ferramentasComment?: string;
};
function readDraft(token: string): LocalDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(token));
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch { return null; }
}
/** O rascunho tem alguma resposta de verdade (não só o estado vazio inicial)? */
function draftHasContent(d: LocalDraft | null): boolean {
  if (!d) return false;
  if (d.submitterName?.trim()) return true;
  if (Object.values(d.answers ?? {}).some(a => a?.score != null || !!a?.comments?.trim())) return true;
  const c = d.cenoAnswers;
  if (c && (c.epi !== null || c.estaiamentos !== null || c.conduta !== null || c.standoutResponse !== null
    || !!c.absencesReport?.trim() || !!c.epiComment?.trim() || !!c.estaiamentosComment?.trim() || !!c.condutaComment?.trim() || !!c.standoutJustification?.trim())) return true;
  return (d.ferramentasAnswer ?? null) !== null || !!d.ferramentasComment?.trim();
}
function clearDraft(token: string | undefined) {
  if (!token) return;
  try { localStorage.removeItem(draftKey(token)); } catch { /* armazenamento indisponível */ }
}

/** Falha de rede (sem resposta do servidor): mensagem humana em vez de "Failed to fetch". */
const NETWORK_SUBMIT_ERROR = "Não foi possível enviar: a conexão falhou. Suas respostas continuam aqui — confira o sinal e toque em Enviar de novo.";

export function usePublicEval(token: string | undefined) {
  const [info, setInfo] = useState<PublicEvalInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Status HTTP da falha ao abrir (404 = link inválido; 0 = sem conexão; 5xx = servidor).
  const [loadErrorStatus, setLoadErrorStatus] = useState<number | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // Havia respostas guardadas neste aparelho e elas foram restauradas.
  const [draftRestored, setDraftRestored] = useState(false);
  // Evento do próximo ciclo (409 EVENT_NEXT_CYCLE): a mensagem do servidor
  // vai para uma tela própria — o link volta a valer quando o ciclo novo existir.
  const [nextCycleMessage, setNextCycleMessage] = useState<string | null>(null);
  const catchNextCycle = (e: unknown) => {
    if (apiErrorCode(e) !== EVENT_NEXT_CYCLE) return false;
    setNextCycleMessage(serverErrorMessage(e, () => "Este evento é do próximo ciclo: a avaliação abre quando o ciclo novo for criado."));
    return true;
  };
  const [submitterName, setSubmitterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // O que foi recusado no envio porque já estava respondido (critérios e, no
  // link combinado, a matriz) — e o que de fato foi gravado.
  const [rejected, setRejected] = useState<PublicEvalSubmitRejected[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [conformitySaved, setConformitySaved] = useState(false);
  // Tudo já estava respondido: nada foi gravado (o link continua sem uso).
  const [nothingSaved, setNothingSaved] = useState(false);
  // A pessoa já tentou enviar com algo faltando: só então os avisos em
  // vermelho de campo vazio aparecem (antes disso a tela não acusa nada).
  const [attempted, setAttempted] = useState(false);

  // Criteria form state — score null = ainda não escolhido
  const [answers, setAnswers] = useState<Record<number, CriterionAnswer>>({});

  // Cenografia conformity state
  const [cenoAnswers, setCenoAnswers] = useState<ConformityAnswers>({
    epi: null, estaiamentos: null, conduta: null,
    epiComment: "", estaiamentosComment: "", condutaComment: "",
    absencesReport: "", standoutResponse: null, standoutJustification: "",
  });

  // Ferramentas conformity state
  const [ferramentasAnswer, setFerramentasAnswer] = useState<boolean | null>(null);
  const [ferramentasComment, setFerramentasComment] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoadError(null);
    setLoadErrorStatus(null);
    getPublicEval(token)
      .then((data) => {
        setInfo(data);
        // Link já usado: o rascunho local não serve mais.
        const saved = data.isUsed ? null : readDraft(token);
        const draft = draftHasContent(saved) ? saved : null;
        if (data.isUsed) clearDraft(token);
        setSubmitterName(draft?.submitterName ?? "");
        setAnswers(
          Object.fromEntries(
            // score: null = ainda não selecionado (0 é nota válida)
            (data.criteria ?? []).map((c) => {
              const d = draft?.answers?.[c.criterionId];
              return [c.criterionId, { score: typeof d?.score === "number" ? d.score : null, comments: typeof d?.comments === "string" ? d.comments : "" }];
            }),
          ),
        );
        if (draft?.cenoAnswers) setCenoAnswers((prev) => ({ ...prev, ...draft.cenoAnswers }));
        if (draft && draft.ferramentasAnswer !== undefined) setFerramentasAnswer(draft.ferramentasAnswer);
        if (typeof draft?.ferramentasComment === "string") setFerramentasComment(draft.ferramentasComment);
        setDraftRestored(!!draft);
      })
      .catch((e: unknown) => {
        if (catchNextCycle(e)) return;
        setLoadErrorStatus(e instanceof ApiError ? e.status : 0);
        setLoadError(serverErrorMessage(e, (status) => `Erro ${status}`));
      });
  }, [token, loadAttempt]);

  // Guarda o que já foi preenchido neste aparelho (até o envio).
  const draftReady = !!info && !info.isUsed;
  useEffect(() => {
    if (!token || !draftReady || done) return;
    const id = window.setTimeout(() => {
      try {
        const payload: LocalDraft = { submitterName, answers, cenoAnswers, ferramentasAnswer, ferramentasComment };
        if (draftHasContent(payload)) localStorage.setItem(draftKey(token), JSON.stringify(payload));
        else localStorage.removeItem(draftKey(token));
      } catch { /* armazenamento indisponível: segue sem rascunho */ }
    }, 400);
    return () => window.clearTimeout(id);
  }, [token, draftReady, done, submitterName, answers, cenoAnswers, ferramentasAnswer, ferramentasComment]);

  /** Tenta abrir o link de novo (depois de uma falha de conexão). */
  const retryLoad = () => setLoadAttempt((n) => n + 1);

  const tokenType = info?.tokenType ?? "criteria";
  // Critérios que a área já respondeu ficam visíveis (só leitura) e não são cobrados.
  const allCriteria = info?.criteria ?? [];
  const criteria = allCriteria.filter(c => !c.closed);
  const closedCriteria = allCriteria.filter(c => c.closed);
  const isCombined = tokenType === "criteria_with_conformity";
  // Link combinado com a matriz já respondida (pelo responsável ou outro
  // link): a matriz não é pedida de novo — e nunca é sobrescrita.
  const conformityAnswered = isCombined && !!info?.conformityAnswered;
  const needsMatrix = isCombined && !conformityAnswered;
  // Ciclo sem "Conduta" na Matriz de Conformidade: a pergunta some.
  const withoutConduta = !!info?.conformityWithoutConduta;
  const activeCenoItems = withoutConduta ? cenoItems.filter(k => k !== "conduta") : cenoItems;

  // critério pronto = score selecionado (inclui 0) E comentário preenchido.
  // Sem critério aberto, só vale se ainda falta a matriz (link combinado).
  const allCriteriaScored = (criteria.length > 0 || needsMatrix) && criteria.every((c) => {
    const ans = answers[c.criterionId];
    return ans?.score !== null && ans?.score !== undefined && ans?.comments?.trim().length > 0;
  });

  // Cenografia: resposta "Não" exige comentário explicando o que aconteceu
  const cenoAllAnswered = activeCenoItems.every(k => cenoAnswers[k] !== null);
  const cenoCommentMissing = activeCenoItems.some(k => cenoAnswers[k] === false && !cenoAnswers[cenoCommentKeyOf[k]].trim());
  const cenoAbsencesMissing = !cenoAnswers.absencesReport.trim();
  // "Algum profissional teve um desempenho fora da curva?" é obrigatória (o
  // servidor cobra standoutResponse) — e, no Sim, o detalhe também.
  const cenoStandoutUnanswered = cenoAnswers.standoutResponse === null;
  const cenoStandoutMissing = cenoAnswers.standoutResponse === true && !cenoAnswers.standoutJustification.trim();
  const cenoCanSubmit = cenoAllAnswered && !cenoCommentMissing && !cenoAbsencesMissing && !cenoStandoutUnanswered && !cenoStandoutMissing;

  // Ferramentas: resposta "Não" exige comentário
  const ferramentasCanSubmit = ferramentasAnswer !== null
    && (ferramentasAnswer !== false || !!ferramentasComment.trim());

  function setScore(criterionId: number, score: number) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { score, comments: prev[criterionId]?.comments ?? "" } }));
  }

  function setComments(criterionId: number, comments: string) {
    setAnswers((prev) => ({ ...prev, [criterionId]: { score: prev[criterionId]?.score ?? null, comments } }));
  }

  async function handleSubmitCriteria() {
    if (!token || !submitterName.trim() || !allCriteriaScored) return;
    if (needsMatrix && !cenoCanSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const body: PublicEvalSubmitInput = {
        submitterName: submitterName.trim(),
        evaluations: criteria.map((c) => ({
          criterionId: c.criterionId,
          score: answers[c.criterionId]?.score ?? 0,
          comments: answers[c.criterionId]?.comments || undefined,
        })),
      };
      if (needsMatrix) {
        Object.assign(body, {
          epi: cenoAnswers.epi,
          estaiamentos: cenoAnswers.estaiamentos,
          conduta: withoutConduta ? null : cenoAnswers.conduta,
          epiComment: cenoAnswers.epiComment || null,
          estaiamentosComment: cenoAnswers.estaiamentosComment || null,
          condutaComment: withoutConduta ? null : (cenoAnswers.condutaComment || null),
          // Não há Sim/Não para faltas na tela: o relato em texto é obrigatório,
          // então a resposta é sempre "respondido" (true) — mesma regra do
          // fluxo interno do avaliador.
          absencesResponse: true,
          absencesReport: cenoAnswers.absencesReport,
          standoutResponse: cenoAnswers.standoutResponse,
          standoutJustification: cenoAnswers.standoutJustification || null,
        });
      }
      const result = await submitPublicEval(token, body);
      setRejected(result?.rejected ?? []);
      setSavedCount(result?.saved?.length ?? 0);
      setSavedIds(result?.saved ?? []);
      setConformitySaved(!!result?.conformitySaved);
      clearDraft(token);
      setDone(true);
    } catch (e: unknown) {
      // Tudo já estava respondido (409 com a lista do que foi recusado): a
      // tela final diz que NADA foi gravado e por quê — nunca "sucesso".
      const data = e instanceof ApiError ? (e.data as { rejected?: PublicEvalSubmitRejected[] } | null) : null;
      if (e instanceof ApiError && e.status === 409 && Array.isArray(data?.rejected) && data.rejected.length > 0) {
        setRejected(data.rejected);
        setSavedCount(0);
        setSavedIds([]);
        setConformitySaved(false);
        setNothingSaved(true);
        clearDraft(token);
        setDone(true);
        return;
      }
      if (catchNextCycle(e)) return;
      setSubmitError(e instanceof ApiError ? serverErrorMessage(e, () => "Erro ao enviar") : NETWORK_SUBMIT_ERROR);
      // A área respondeu tudo enquanto a pessoa preenchia: recarrega o link
      // para a tela mostrar quem respondeu (o link continua sem uso).
      if (e instanceof ApiError && e.status === 409) {
        getPublicEval(token).then(setInfo).catch(() => {});
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitConformity() {
    if (!token || !submitterName.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const body: PublicEvalConformityInput = { submitterName: submitterName.trim() };
      if (tokenType === "conformity_cenografia") {
        Object.assign(body, {
          epi: cenoAnswers.epi,
          estaiamentos: cenoAnswers.estaiamentos,
          conduta: withoutConduta ? null : cenoAnswers.conduta,
          epiComment: cenoAnswers.epiComment || null,
          estaiamentosComment: cenoAnswers.estaiamentosComment || null,
          condutaComment: withoutConduta ? null : (cenoAnswers.condutaComment || null),
          // Sem controle Sim/Não na tela: relato em texto obrigatório => true fixo.
          absencesResponse: true,
          absencesReport: cenoAnswers.absencesReport,
          standoutResponse: cenoAnswers.standoutResponse,
          standoutJustification: cenoAnswers.standoutJustification || null,
        });
      } else {
        Object.assign(body, {
          guardaEquipamentos: ferramentasAnswer,
          guardaEquipamentosComment: ferramentasComment || null,
        });
      }
      await submitPublicEvalConformity(token, body);
      clearDraft(token);
      setDone(true);
    } catch (e: unknown) {
      // 409 (ciclo fechado, matriz já respondida): a mensagem do servidor vai
      // para a tela e o link é recarregado para mostrar o estado real.
      if (catchNextCycle(e)) return;
      setSubmitError(e instanceof ApiError ? serverErrorMessage(e, () => "Erro ao enviar") : NETWORK_SUBMIT_ERROR);
      if (e instanceof ApiError && e.status === 409) {
        getPublicEval(token).then(setInfo).catch(() => {});
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isConformityCenografia = tokenType === "conformity_cenografia";
  const isConformityFerramentas = tokenType === "conformity_ferramentas";
  const isConformity = isConformityCenografia || isConformityFerramentas;
  const showCriteria = !isConformity;
  const showCenografiaConformity = isConformityCenografia || needsMatrix;
  const canSubmit = !isSubmitting && !!submitterName.trim() && (
    isConformityCenografia ? cenoCanSubmit :
    isConformityFerramentas ? ferramentasCanSubmit :
    isCombined ? (allCriteriaScored && (!needsMatrix || cenoCanSubmit)) :
    allCriteriaScored
  );

  // O que ainda falta para liberar o envio — espelha exatamente as regras de
  // `canSubmit`. Vira a lista acima do botão e a âncora de rolagem/foco.
  const pending: PendingItem[] = [];
  if (!submitterName.trim()) pending.push({ label: "Seu nome completo", targetId: "field-submitter-name" });
  if (showCriteria) {
    for (const c of criteria) {
      const ans = answers[c.criterionId];
      if (ans?.score === null || ans?.score === undefined) pending.push({ label: `Nota do critério ${displayCriterionName(c.criterionName)}`, targetId: `crit-${c.criterionId}-score` });
      if (!ans?.comments?.trim()) pending.push({ label: `Comentário do critério ${displayCriterionName(c.criterionName)}`, targetId: `crit-${c.criterionId}-comment` });
    }
  }
  if (showCenografiaConformity) {
    for (const k of activeCenoItems) {
      if (cenoAnswers[k] === null) pending.push({ label: cenoLabels[k], targetId: `ceno-${k}` });
      else if (cenoAnswers[k] === false && !cenoAnswers[cenoCommentKeyOf[k]].trim()) pending.push({ label: `Comentário de ${cenoLabels[k]} (resposta Não)`, targetId: `ceno-${k}-comment` });
    }
    if (cenoAbsencesMissing) pending.push({ label: "Faltas e atrasos", targetId: "ceno-absences" });
    if (cenoStandoutUnanswered) pending.push({ label: "Desempenho fora da curva", targetId: "ceno-standout" });
    if (cenoStandoutMissing) pending.push({ label: "Detalhe do destaque", targetId: "ceno-standout-justification" });
  }
  if (isConformityFerramentas) {
    if (ferramentasAnswer === null) pending.push({ label: "Retorno de equipamentos e ferramentas", targetId: "ferr-answer" });
    else if (ferramentasAnswer === false && !ferramentasComment.trim()) pending.push({ label: "Comentário de ferramentas (resposta Não)", targetId: "ferr-comment" });
  }

  return {
    info, loadError, loadErrorStatus, retryLoad, draftRestored, nextCycleMessage, done, rejected, savedCount, savedIds, conformitySaved, nothingSaved, conformityAnswered, needsMatrix, allCriteria, closedCriteria, withoutConduta, submitterName, setSubmitterName, isSubmitting, submitError,
    criteria, answers, setScore, setComments,
    cenoAnswers, setCenoAnswers, cenoStandoutMissing, attempted, setAttempted,
    cenoCanSubmit, ferramentasCanSubmit,
    ferramentasAnswer, setFerramentasAnswer, ferramentasComment, setFerramentasComment,
    isCombined, isConformityCenografia, isConformityFerramentas, isConformity, showCriteria, showCenografiaConformity,
    canSubmit, pending, handleSubmitCriteria, handleSubmitConformity,
  };
}

export type PublicEvalState = ReturnType<typeof usePublicEval>;
