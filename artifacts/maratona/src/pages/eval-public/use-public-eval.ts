import { useState, useEffect } from "react";
import {
  getPublicEval, submitPublicEval, submitPublicEvalConformity,
  type PublicEvalInfo, type PublicEvalSubmitInput, type PublicEvalConformityInput,
} from "@workspace/api-client-react";
import { serverErrorMessage, cenoItems, cenoCommentKeyOf, cenoLabels } from "./helpers";
import type { CriterionAnswer, ConformityAnswers, PendingItem } from "./types";

/**
 * Estado do formulário público (link de uso único): carga do token, respostas
 * de critérios e das matrizes de conformidade, regras de envio, lista de
 * pendências e os dois envios (critérios [+ cenografia] / só conformidade).
 */
export function usePublicEval(token: string | undefined) {
  const [info, setInfo] = useState<PublicEvalInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitterName, setSubmitterName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
      .catch((e: unknown) => setLoadError(serverErrorMessage(e, (status) => `Erro ${status}`)));
  }, [token]);

  const tokenType = info?.tokenType ?? "criteria";
  const criteria = info?.criteria ?? [];
  const isCombined = tokenType === "criteria_with_conformity";

  // critério pronto = score selecionado (inclui 0) E comentário preenchido
  const allCriteriaScored = criteria.length > 0 && criteria.every((c) => {
    const ans = answers[c.criterionId];
    return ans?.score !== null && ans?.score !== undefined && ans?.comments?.trim().length > 0;
  });

  // Cenografia: resposta "Não" exige comentário explicando o que aconteceu
  const cenoAllAnswered = cenoItems.every(k => cenoAnswers[k] !== null);
  const cenoCommentMissing = cenoItems.some(k => cenoAnswers[k] === false && !cenoAnswers[cenoCommentKeyOf[k]].trim());
  const cenoAbsencesMissing = !cenoAnswers.absencesReport.trim();
  const cenoStandoutMissing = cenoAnswers.standoutResponse === true && !cenoAnswers.standoutJustification.trim();
  const cenoCanSubmit = cenoAllAnswered && !cenoCommentMissing && !cenoAbsencesMissing && !cenoStandoutMissing;

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
    if (isCombined && !cenoCanSubmit) return;
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
      if (isCombined) {
        Object.assign(body, {
          epi: cenoAnswers.epi,
          estaiamentos: cenoAnswers.estaiamentos,
          conduta: cenoAnswers.conduta,
          epiComment: cenoAnswers.epiComment || null,
          estaiamentosComment: cenoAnswers.estaiamentosComment || null,
          condutaComment: cenoAnswers.condutaComment || null,
          // Não há Sim/Não para faltas na tela: o relato em texto é obrigatório,
          // então a resposta é sempre "respondido" (true) — mesma regra do
          // fluxo interno do avaliador.
          absencesResponse: true,
          absencesReport: cenoAnswers.absencesReport,
          standoutResponse: cenoAnswers.standoutResponse,
          standoutJustification: cenoAnswers.standoutJustification || null,
        });
      }
      await submitPublicEval(token, body);
      setDone(true);
    } catch (e: unknown) {
      setSubmitError(serverErrorMessage(e, () => "Erro ao enviar"));
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
          conduta: cenoAnswers.conduta,
          epiComment: cenoAnswers.epiComment || null,
          estaiamentosComment: cenoAnswers.estaiamentosComment || null,
          condutaComment: cenoAnswers.condutaComment || null,
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
      setSubmitError(serverErrorMessage(e, () => "Erro ao enviar"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isConformityCenografia = tokenType === "conformity_cenografia";
  const isConformityFerramentas = tokenType === "conformity_ferramentas";
  const isConformity = isConformityCenografia || isConformityFerramentas;
  const showCriteria = !isConformity;
  const showCenografiaConformity = isConformityCenografia || isCombined;
  const canSubmit = !isSubmitting && !!submitterName.trim() && (
    isConformityCenografia ? cenoCanSubmit :
    isConformityFerramentas ? ferramentasCanSubmit :
    isCombined ? (allCriteriaScored && cenoCanSubmit) :
    allCriteriaScored
  );

  // O que ainda falta para liberar o envio — espelha exatamente as regras de
  // `canSubmit`. Vira a lista acima do botão e a âncora de rolagem/foco.
  const pending: PendingItem[] = [];
  if (!submitterName.trim()) pending.push({ label: "Seu nome completo", targetId: "field-submitter-name" });
  if (showCriteria) {
    for (const c of criteria) {
      const ans = answers[c.criterionId];
      if (ans?.score === null || ans?.score === undefined) pending.push({ label: `Nota do critério ${c.criterionName}`, targetId: `crit-${c.criterionId}-score` });
      if (!ans?.comments?.trim()) pending.push({ label: `Comentário do critério ${c.criterionName}`, targetId: `crit-${c.criterionId}-comment` });
    }
  }
  if (showCenografiaConformity) {
    for (const k of cenoItems) {
      if (cenoAnswers[k] === null) pending.push({ label: cenoLabels[k], targetId: `ceno-${k}` });
      else if (cenoAnswers[k] === false && !cenoAnswers[cenoCommentKeyOf[k]].trim()) pending.push({ label: `Comentário de ${cenoLabels[k]} (resposta Não)`, targetId: `ceno-${k}-comment` });
    }
    if (cenoAbsencesMissing) pending.push({ label: "Faltas e atrasos", targetId: "ceno-absences" });
    if (cenoStandoutMissing) pending.push({ label: "Detalhe do destaque", targetId: "ceno-standout-justification" });
  }
  if (isConformityFerramentas) {
    if (ferramentasAnswer === null) pending.push({ label: "Retorno de equipamentos e ferramentas", targetId: "ferr-answer" });
    else if (ferramentasAnswer === false && !ferramentasComment.trim()) pending.push({ label: "Comentário de ferramentas (resposta Não)", targetId: "ferr-comment" });
  }

  return {
    info, loadError, done, submitterName, setSubmitterName, isSubmitting, submitError,
    criteria, answers, setScore, setComments,
    cenoAnswers, setCenoAnswers, cenoStandoutMissing,
    ferramentasAnswer, setFerramentasAnswer, ferramentasComment, setFerramentasComment,
    isCombined, isConformityCenografia, isConformityFerramentas, isConformity, showCriteria, showCenografiaConformity,
    canSubmit, pending, handleSubmitCriteria, handleSubmitConformity,
  };
}

export type PublicEvalState = ReturnType<typeof usePublicEval>;
