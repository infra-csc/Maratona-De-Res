// Fluxo salvar → publicar da página de Calibrações. Código movido literalmente
// do componente da página: mesmas mutations (na mesma ordem de hooks), mesmas
// query keys, invalidações e toasts. O estado continua no componente pai.
import { useState } from "react";
import type React from "react";
import {
  useCreateCalibration,
  useGetEventFeedback,
  usePublishCriterionPartialFeedback,
  usePublishCriterionFinalFeedback,
  useUpdateEventCriteria,
  getGetEventsQueryKey,
  getGetCalibrationsQueryKey,
} from "@workspace/api-client-react";
import { isAuthError, errorMessage, SESSION_EXPIRED_TOAST } from "./helpers";
import type { DerivedCriteria } from "./derive";
import type { deriveDirtyState } from "./derive";
import type { EventCriterion, PublishIntent, QueryClientLike, ToastFn } from "./types";

type DirtyState = ReturnType<typeof deriveDirtyState>;

export type CalibrationSaveFlowParams = {
  selectedEventId: number | null;
  qc: QueryClientLike;
  toast: ToastFn;
  criteria: EventCriterion[] | undefined;
  calQKey: ReturnType<typeof getGetCalibrationsQueryKey>;
  weightEdits: Record<number, string>;
  setWeightEdits: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setSavingWeightId: React.Dispatch<React.SetStateAction<number | null>>;
  calScores: Record<number, string>;
  setCalScores: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  calReasons: Record<number, string>;
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setSavingCritId: React.Dispatch<React.SetStateAction<number | null>>;
  markReasonSaved: (critId: number) => void;
  publishIntents: Record<number, PublishIntent>;
  setPublishingAll: React.Dispatch<React.SetStateAction<boolean>>;
  displayActiveCriteria: EventCriterion[];
  childCriterionIdsMap: DerivedCriteria["childCriterionIdsMap"];
  getCalibration: DerivedCriteria["getCalibration"];
  getAvgScore: DerivedCriteria["getAvgScore"];
  pendingScore: DirtyState["pendingScore"];
  pendingReasonOnlyCrits: DirtyState["pendingReasonOnlyCrits"];
  pendingWeightCritIds: DirtyState["pendingWeightCritIds"];
  unsavedEditsCount: number;
  totalDirtyCount: number;
  autoFillableCriteria: EventCriterion[];
};

export function useCalibrationSaveFlow(params: CalibrationSaveFlowParams) {
  const {
    selectedEventId, qc, toast, criteria, calQKey,
    weightEdits, setWeightEdits, setSavingWeightId,
    calScores, setCalScores, calReasons, setCalReasons, setSavingCritId, markReasonSaved,
    publishIntents, setPublishingAll,
    displayActiveCriteria, childCriterionIdsMap, getCalibration, getAvgScore,
    pendingScore, pendingReasonOnlyCrits, pendingWeightCritIds, unsavedEditsCount, totalDirtyCount,
    autoFillableCriteria,
  } = params;

  // Edição de peso por critério, direto na calibração. O PUT aceita payload
  // parcial (o backend mescla com as linhas não alteradas) e recalcula o
  // resultado na hora se o evento já estiver fechado.
  const updateWeightMutation = useUpdateEventCriteria({
    mutation: {
      onSuccess: (data, variables) => {
        qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        qc.invalidateQueries({ queryKey: fbQKey });
        setSavingWeightId(null);
        const savedId = variables.data.criteria?.[0]?.criterionId;
        if (savedId != null) {
          setWeightEdits(prev => {
            const next = { ...prev };
            delete next[savedId];
            return next;
          });
        }
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Peso salvo", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Peso salvo" });
        }
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Erro ao salvar peso", description: e.message, variant: "destructive" });
        setSavingWeightId(null);
      },
    },
  });

  function saveWeight(critId: number, active: boolean) {
    const raw = (weightEdits[critId] ?? "").replace(",", ".").trim();
    const w = Number(raw);
    if (!raw || isNaN(w) || w < 0) {
      toast({ title: "Peso inválido", description: "Informe um peso maior ou igual a zero.", variant: "destructive" });
      return;
    }
    setSavingWeightId(critId);
    updateWeightMutation.mutate({
      id: selectedEventId!,
      data: { criteria: [{ criterionId: critId, active, weight: w }] },
    });
  }

  // Única mutation de calibração da tela — sem toast por item. Cada fluxo
  // (salvar um critério, salvar tudo, auto-preencher) aguarda as chamadas e
  // emite UM resumo no fim, em vez de uma notificação por requisição.
  const bulkMutation = useCreateCalibration();
  const [savingAll, setSavingAll] = useState(false);
  const [savingAutoFill, setSavingAutoFill] = useState(false);

  const fbQKey = ["event-feedback", selectedEventId] as unknown[];
  const { data: feedback } = useGetEventFeedback(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: fbQKey },
  });

  const publishCriterionPartialMutation = usePublishCriterionPartialFeedback();
  const publishCriterionFinalMutation = usePublishCriterionFinalFeedback();

  // Nome legível de um critério para as mensagens de erro em lote.
  function criterionLabel(critId: number): string {
    return (criteria ?? []).find(c => c.criterionId === critId)?.criterionName ?? `#${critId}`;
  }
  function failedDescription(failedIds: number[], firstError: string | null): string {
    const names = failedIds.map(criterionLabel).join(", ");
    return firstError ? `Falhou em: ${names}. ${firstError}` : `Falhou em: ${names}.`;
  }

  // Publica todos os critérios calibrados de acordo com a intenção definida por critério
  async function handlePublishAll() {
    if (!selectedEventId) return;
    // Publicar usa a nota que está NO SERVIDOR. Se há nota/justificativa/peso
    // digitados e não salvos, publicaríamos a nota antiga — bloqueia e orienta.
    if (unsavedEditsCount > 0) {
      toast({ title: "Há notas não salvas", description: "Salve as alterações antes de publicar — a publicação usa a nota gravada no servidor.", variant: "destructive" });
      return;
    }
    // Inclui critérios inativos-mas-calibrados: eles aparecem na tela com o
    // toggle Parc./Final, então o Publicar deve poder aplicar o status neles
    // também (o backend permite publicar critério inativo já calibrado).
    const calibrated = displayActiveCriteria.filter(c => getCalibration(c.criterionId) != null);
    if (calibrated.length === 0) {
      toast({ title: "Nenhum critério calibrado para publicar", description: "Salve ao menos uma nota calibrada antes de publicar.", variant: "destructive" });
      return;
    }
    setPublishingAll(true);
    let okFinal = 0, okPartial = 0;
    const failed: number[] = [];
    let firstError: string | null = null;
    let sessionExpired = false;
    for (const c of calibrated) {
      const intent = publishIntents[c.criterionId] ?? "partial";
      try {
        if (intent === "final") {
          await publishCriterionFinalMutation.mutateAsync({ id: selectedEventId, criterionId: c.criterionId });
          okFinal++;
        } else {
          await publishCriterionPartialMutation.mutateAsync({ id: selectedEventId, criterionId: c.criterionId });
          okPartial++;
        }
      } catch (e) {
        if (isAuthError(e)) { sessionExpired = true; break; }
        failed.push(c.criterionId);
        if (!firstError) firstError = errorMessage(e) ?? null;
      }
    }
    setPublishingAll(false);
    qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
    qc.invalidateQueries({ queryKey: fbQKey });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    if (sessionExpired) {
      toast(SESSION_EXPIRED_TOAST);
      return;
    }
    if (failed.length === 0) {
      const parts: string[] = [];
      if (okFinal > 0) parts.push(`${okFinal} Final`);
      if (okPartial > 0) parts.push(`${okPartial} Parcial`);
      toast({ title: `Publicado — ${parts.join(", ")}` });
    } else {
      toast({ title: `${okFinal + okPartial} publicado(s), ${failed.length} com erro`, description: failedDescription(failed, firstError), variant: "destructive" });
    }
  }

  // Salva UM critério (pai + cópias eventScoped filhas) aguardando todas as
  // requisições: um único spinner e um único toast, independentemente de
  // quantos filhos o critério tenha.
  async function saveCalibration(critId: number) {
    if (!selectedEventId) return;
    const existing = getCalibration(critId);
    const raw = calScores[critId] ?? (existing ? String(Number(existing.calibratedScore)) : "");
    const reason = (calReasons[critId] ?? existing?.calibrationReason ?? "").trim();
    const score = Number(raw);
    if (!raw || isNaN(score) || score < 0 || score > 10) {
      toast({ title: "Nota inválida", description: "Informe uma nota calibrada de 0 a 10.", variant: "destructive" });
      return;
    }
    setSavingCritId(critId);
    const avg = getAvgScore(critId);
    const targetIds = [critId, ...(childCriterionIdsMap.get(critId) ?? [])];
    try {
      const results = await Promise.all(targetIds.map(id => bulkMutation.mutateAsync({
        data: {
          eventId: selectedEventId,
          criterionId: id,
          calibratedScore: score,
          calibrationReason: reason,
          originalAverageScore: avg ?? undefined,
        },
      })));
      setCalScores(prev => { const n = { ...prev }; delete n[critId]; return n; });
      setCalReasons(prev => { const n = { ...prev }; delete n[critId]; return n; });
      markReasonSaved(critId);
      qc.invalidateQueries({ queryKey: calQKey });
      qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
      qc.invalidateQueries({ queryKey: fbQKey });
      const warnings = Array.from(new Set(results.flatMap(r => r.warnings ?? [])));
      if (warnings.length > 0) {
        toast({ title: "Calibração registrada", description: warnings.join(" "), variant: "destructive" });
      } else {
        toast({ title: "Calibração registrada" });
      }
    } catch (e) {
      if (isAuthError(e)) toast(SESSION_EXPIRED_TOAST);
      else toast({ title: "Erro ao salvar calibração", description: errorMessage(e), variant: "destructive" });
    } finally {
      setSavingCritId(null);
    }
  }

  // Auto-preenche calibrações para critérios que têm nota do avaliador mas ainda
  // não têm calibração — útil após importar avaliações via formulário.
  async function autoFillFromEvaluator() {
    if (autoFillableCriteria.length === 0) return;
    setSavingAutoFill(true);
    let ok = 0;
    const failed: number[] = [];
    let firstError: string | null = null;
    let sessionExpired = false;
    const allWarnings: string[] = [];
    for (const c of autoFillableCriteria) {
      const avg = getAvgScore(c.criterionId);
      if (avg == null) continue;
      try {
        const result = await bulkMutation.mutateAsync({
          data: {
            eventId: selectedEventId!,
            criterionId: c.criterionId,
            calibratedScore: avg,
            originalAverageScore: avg,
          },
        });
        if (result.warnings) allWarnings.push(...result.warnings);
        ok++;
      } catch (e) {
        if (isAuthError(e)) { sessionExpired = true; break; }
        failed.push(c.criterionId);
        if (!firstError) firstError = errorMessage(e) ?? null;
      }
    }
    setSavingAutoFill(false);
    qc.invalidateQueries({ queryKey: calQKey });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: fbQKey });
    if (sessionExpired) {
      toast(SESSION_EXPIRED_TOAST);
      return;
    }
    const uniqueWarnings = Array.from(new Set(allWarnings));
    if (failed.length === 0) {
      toast({
        title: `${ok} calibraç${ok === 1 ? "ão preenchida" : "ões preenchidas"} com nota do avaliador`,
        description: uniqueWarnings.length > 0 ? uniqueWarnings.join(" ") : undefined,
        variant: uniqueWarnings.length > 0 ? "destructive" : undefined,
      });
    } else {
      toast({ title: `${ok} preenchida(s), ${failed.length} com erro`, description: failedDescription(failed, firstError), variant: "destructive" });
    }
  }

  // Salva TUDO de uma vez: calibrações com nota nova, comentários pendentes em
  // calibrações já salvas, e edições de peso.
  async function handleSaveAll() {
    if (totalDirtyCount === 0 || !selectedEventId) return;
    const eventId = selectedEventId;
    setSavingAll(true);
    let okCal = 0, okWeight = 0, okPublish = 0;
    const failedCal: number[] = [], failedWeight: number[] = [], failedPublish: number[] = [];
    let firstError: string | null = null;
    let sessionExpired = false;
    const allWarnings: string[] = [];
    const savedScoreIds = new Set<number>();
    const savedReasonOnlyIds: number[] = [];

    // 1. Calibrações com nota nova (+ comentário)
    const toSaveScores = displayActiveCriteria
      .map(c => ({ critId: c.criterionId, score: pendingScore(c.criterionId), reason: (calReasons[c.criterionId] ?? getCalibration(c.criterionId)?.calibrationReason ?? "").trim() }))
      .filter((x): x is { critId: number; score: number; reason: string } => x.score != null);
    for (const x of toSaveScores) {
      try {
        const result = await bulkMutation.mutateAsync({
          data: { eventId, criterionId: x.critId, calibratedScore: x.score, calibrationReason: x.reason, originalAverageScore: getAvgScore(x.critId) ?? undefined },
        });
        if (result.warnings) allWarnings.push(...result.warnings);
        for (const childId of (childCriterionIdsMap.get(x.critId) ?? [])) {
          await bulkMutation.mutateAsync({ data: { eventId, criterionId: childId, calibratedScore: x.score, calibrationReason: x.reason, originalAverageScore: getAvgScore(x.critId) ?? undefined } });
        }
        // Só conta como salvo (e limpa a edição local) com pai E filhos gravados.
        okCal++;
        savedScoreIds.add(x.critId);
      } catch (e) {
        if (isAuthError(e)) { sessionExpired = true; break; }
        failedCal.push(x.critId);
        if (!firstError) firstError = errorMessage(e) ?? null;
      }
    }

    // 2. Comentários pendentes em calibrações já salvas (sem nova nota)
    if (!sessionExpired) for (const c of pendingReasonOnlyCrits) {
      const existing = getCalibration(c.criterionId);
      if (!existing) continue;
      const score = Number(existing.calibratedScore);
      const reason = (calReasons[c.criterionId] ?? "").trim();
      try {
        await bulkMutation.mutateAsync({
          data: { eventId, criterionId: c.criterionId, calibratedScore: score, calibrationReason: reason, originalAverageScore: getAvgScore(c.criterionId) ?? undefined },
        });
        okCal++;
        savedReasonOnlyIds.push(c.criterionId);
      } catch (e) {
        if (isAuthError(e)) { sessionExpired = true; break; }
        failedCal.push(c.criterionId);
        if (!firstError) firstError = errorMessage(e) ?? null;
      }
    }

    // 3. Pesos editados
    if (!sessionExpired) for (const critId of pendingWeightCritIds) {
      const raw = (weightEdits[critId] ?? "").replace(",", ".").trim();
      const w = Number(raw);
      const crit = displayActiveCriteria.find(c => c.criterionId === critId);
      if (!crit || isNaN(w)) continue;
      try {
        await updateWeightMutation.mutateAsync({ id: eventId, data: { criteria: [{ criterionId: critId, active: crit.active ?? true, weight: w }] } });
        okWeight++;
        setWeightEdits(prev => { const n = { ...prev }; delete n[critId]; return n; });
      } catch (e) {
        if (isAuthError(e)) { sessionExpired = true; break; }
        failedWeight.push(critId);
        if (!firstError) firstError = errorMessage(e) ?? null;
      }
    }

    // 4. Mudanças de status (Parc./Final). Recalculado AQUI, depois da etapa 1:
    // um critério que acabou de receber a primeira nota ainda não tinha
    // calibração no render anterior e ficaria fora de `pendingPublishCritIds`,
    // deixando a intenção "Final" sem efeito. Considera publicável todo critério
    // salvo agora OU já calibrado no servidor cuja intenção diverge do publicado.
    const publishTargets = displayActiveCriteria.filter(c => {
      const hasCalibration = savedScoreIds.has(c.criterionId) || !!getCalibration(c.criterionId);
      if (!hasCalibration) return false;
      const intent = publishIntents[c.criterionId];
      if (intent === undefined) return false;
      const baseline = c.finalPublishedAt ? "final" : "partial";
      return intent !== baseline;
    }).map(c => c.criterionId);
    if (!sessionExpired) for (const critId of publishTargets) {
      const intent = publishIntents[critId];
      try {
        if (intent === "final") {
          await publishCriterionFinalMutation.mutateAsync({ id: eventId, criterionId: critId });
        } else {
          await publishCriterionPartialMutation.mutateAsync({ id: eventId, criterionId: critId });
        }
        okPublish++;
      } catch (e) {
        if (isAuthError(e)) { sessionExpired = true; break; }
        failedPublish.push(critId);
        if (!firstError) firstError = errorMessage(e) ?? null;
      }
    }

    setSavingAll(false);
    const totalOk = okCal + okWeight + okPublish;
    const totalFailed = failedCal.length + failedWeight.length + failedPublish.length;

    // Limpa as edições locais apenas dos critérios efetivamente gravados; os
    // que falharam (ou não chegaram a ser enviados) continuam editáveis.
    const savedIds = [...savedScoreIds, ...savedReasonOnlyIds];
    setCalScores(prev => { const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n; });
    setCalReasons(prev => { const n = { ...prev }; savedIds.forEach(id => delete n[id]); return n; });
    savedReasonOnlyIds.forEach(markReasonSaved);

    qc.invalidateQueries({ queryKey: calQKey });
    qc.invalidateQueries({ queryKey: ["ec", selectedEventId] });
    qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
    qc.invalidateQueries({ queryKey: fbQKey });

    if (sessionExpired) {
      toast({ ...SESSION_EXPIRED_TOAST, description: `${SESSION_EXPIRED_TOAST.description}${totalOk > 0 ? ` ${totalOk} item(ns) já haviam sido salvos.` : ""}` });
      return;
    }

    const uniqueWarnings = Array.from(new Set(allWarnings));
    if (totalFailed === 0) {
      const parts: string[] = [];
      if (okCal > 0) parts.push(`${okCal} calibraç${okCal === 1 ? "ão" : "ões"}`);
      if (okWeight > 0) parts.push(`${okWeight} peso${okWeight === 1 ? "" : "s"}`);
      if (okPublish > 0) parts.push(`${okPublish} status`);
      toast({ title: `Tudo salvo — ${parts.join(", ")}`, description: uniqueWarnings.length > 0 ? uniqueWarnings.join(" ") : undefined, variant: uniqueWarnings.length > 0 ? "destructive" : undefined });
    } else {
      const failedIds = Array.from(new Set([...failedCal, ...failedWeight, ...failedPublish]));
      toast({ title: `${totalOk} salvo(s), ${totalFailed} com erro`, description: failedDescription(failedIds, firstError), variant: "destructive" });
    }
  }

  return {
    updateWeightMutation,
    saveWeight,
    savingAll,
    savingAutoFill,
    feedback,
    handlePublishAll,
    saveCalibration,
    autoFillFromEvaluator,
    handleSaveAll,
  };
}
