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
export function usePublicEval(token: string | undefined) {
  const [info, setInfo] = useState<PublicEvalInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
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
    getPublicEval(token)
      .then((data) => {
        setInfo(data);
        setSubmitterName("");
        setAnswers(
          Object.fromEntries(
            // score: null = ainda não selecionado (0 é nota válida)
            (data.criteria ?? []).map((c) => [c.criterionId, { score: null, comments: "" }]),
          ),
        );
      })
      .catch((e: unknown) => { if (!catchNextCycle(e)) setLoadError(serverErrorMessage(e, (status) => `Erro ${status}`)); });
  }, [token]);

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
      setConformitySaved(!!result?.conformitySaved);
      setDone(true);
    } catch (e: unknown) {
      // Tudo já estava respondido (409 com a lista do que foi recusado): a
      // tela final diz que NADA foi gravado e por quê — nunca "sucesso".
      const data = e instanceof ApiError ? (e.data as { rejected?: PublicEvalSubmitRejected[] } | null) : null;
      if (e instanceof ApiError && e.status === 409 && Array.isArray(data?.rejected) && data.rejected.length > 0) {
        setRejected(data.rejected);
        setSavedCount(0);
        setConformitySaved(false);
        setNothingSaved(true);
        setDone(true);
        return;
      }
      if (catchNextCycle(e)) return;
      setSubmitError(serverErrorMessage(e, () => "Erro ao enviar"));
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
      setDone(true);
    } catch (e: unknown) {
      // 409 (ciclo fechado, matriz já respondida): a mensagem do servidor vai
      // para a tela e o link é recarregado para mostrar o estado real.
      if (catchNextCycle(e)) return;
      setSubmitError(serverErrorMessage(e, () => "Erro ao enviar"));
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
    info, loadError, nextCycleMessage, done, rejected, savedCount, conformitySaved, nothingSaved, conformityAnswered, needsMatrix, allCriteria, closedCriteria, withoutConduta, submitterName, setSubmitterName, isSubmitting, submitError,
    criteria, answers, setScore, setComments,
    cenoAnswers, setCenoAnswers, cenoStandoutMissing, attempted, setAttempted,
    ferramentasAnswer, setFerramentasAnswer, ferramentasComment, setFerramentasComment,
    isCombined, isConformityCenografia, isConformityFerramentas, isConformity, showCriteria, showCenografiaConformity,
    canSubmit, pending, handleSubmitCriteria, handleSubmitConformity,
  };
}

export type PublicEvalState = ReturnType<typeof usePublicEval>;
