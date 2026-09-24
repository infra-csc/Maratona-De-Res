// Derivações puras (sem hooks) da página de Calibrações: fusão de critérios
// pai/filho, notas dos avaliadores e contadores de edições pendentes.
import type { EventCriterion, Evaluation, Calibration, PublishIntent } from "./types";

export function deriveCriteria(
  criteria: EventCriterion[] | undefined,
  calibrations: Calibration[] | undefined,
  evaluations: Evaluation[] | undefined,
) {
  function getAreaScores(critId: number) {
    // Inclui avaliações dos critérios eventScoped "filhos" (cópias duplicadas
    // ligadas a este critério). O map é calculado abaixo após activeCriteria.
    const children = childCriterionIdsMap.get(critId) ?? [];
    const allIds = [critId, ...children];
    return (evaluations ?? [])
      .filter(e => allIds.includes(e.criterionId) && e.status === "submitted")
      .map(e => {
        const crit = activeCriteria.find(ac => ac.criterionId === e.criterionId);
        const respondedRaw = e.submittedAt ?? e.createdAt ?? null;
        // Number(): o contrato diz number, mas colunas numeric do Postgres podem chegar como string.
        return { name: e.evaluatorName ?? "Avaliador", score: Number(e.score), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null, areaName: crit?.responsibleAreaName ?? null, isChild: e.criterionId !== critId, respondedAt: respondedRaw ? new Date(respondedRaw) : null };
      });
  }

  function getAvgScore(critId: number) {
    const scores = getAreaScores(critId).map(s => s.score);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  function getCalibration(critId: number) {
    return (calibrations ?? []).find(c => c.criterionId === critId);
  }

  // Inclui critérios com calibração salva mesmo se ec_active=F (foram calibrados antes de serem desativados no evento).
  const calibratedCriterionIds = new Set((calibrations ?? []).filter(c => c.calibratedScore != null).map(c => c.criterionId));
  const activeCriteria = (criteria ?? [])
    .filter(c => c.active || calibratedCriterionIds.has(c.criterionId))
    .sort((a, b) => a.criterionId - b.criterionId);

  // Mapa: criterionId → [IDs dos critérios eventScoped que têm este como fonte].
  // Permite fundir avaliações de duplicatas ("Qualidade de Entrega" + "(2)")
  // numa única linha na tabela de calibrações.
  const childCriterionIdsMap = new Map<number, number[]>();
  activeCriteria.forEach(c => {
    if (c.eventScoped && c.sourceCriterionId != null) {
      const arr = childCriterionIdsMap.get(c.sourceCriterionId) ?? [];
      arr.push(c.criterionId);
      childCriterionIdsMap.set(c.sourceCriterionId, arr);
    }
  });

  // Segunda passagem: critérios eventScoped ÓRFÃOS (sourceCriterionId=null) com o
  // mesmo nome de um critério não-scoped → fundir pelo nome para exibição unificada.
  const nonScopedByName = new Map<string, number>(
    activeCriteria
      .filter(c => !c.eventScoped)
      .map(c => [c.criterionName.trim().toUpperCase(), c.criterionId])
  );
  activeCriteria.forEach(c => {
    if (c.eventScoped && c.sourceCriterionId == null) {
      const parentId = nonScopedByName.get(c.criterionName.trim().toUpperCase());
      if (parentId != null) {
        const arr = childCriterionIdsMap.get(parentId) ?? [];
        if (!arr.includes(c.criterionId)) arr.push(c.criterionId);
        childCriterionIdsMap.set(parentId, arr);
      }
    }
  });

  // Conjunto de IDs de critérios "filhos" — ocultos da tabela (fundidos no pai)
  const childCriterionIdSet = new Set<number>(
    [...childCriterionIdsMap.values()].flat()
  );
  // Lista de exibição: exclui os filhos (suas notas aparecem na linha do pai).
  // Dupla proteção: pelo set E pela flag direta (cobre casos de cache stale).
  const displayActiveCriteria = activeCriteria.filter(c =>
    !childCriterionIdSet.has(c.criterionId) &&
    !(c.eventScoped && c.sourceCriterionId != null)
  );

  return { getAreaScores, getAvgScore, getCalibration, activeCriteria, childCriterionIdsMap, displayActiveCriteria };
}

export type DerivedCriteria = ReturnType<typeof deriveCriteria>;
export type AreaScore = ReturnType<DerivedCriteria["getAreaScores"]>[number];
export type CalibrationRecord = NonNullable<ReturnType<DerivedCriteria["getCalibration"]>>;

// Contadores de edições locais pendentes (nota, justificativa, peso, Parc./Final).
export function deriveDirtyState(params: {
  displayActiveCriteria: EventCriterion[];
  getCalibration: DerivedCriteria["getCalibration"];
  calScores: Record<number, string>;
  calReasons: Record<number, string>;
  weightEdits: Record<number, string>;
  publishIntents: Record<number, PublishIntent>;
}) {
  const { displayActiveCriteria, getCalibration, calScores, calReasons, weightEdits, publishIntents } = params;

  // Quantos critérios têm uma edição LOCAL pendente (digitada pelo usuário e ainda
  // não salva). Não recai para o score já salvo na API para evitar falso-positivo
  // de "pendente" em critérios que já foram gravados.
  function pendingScore(critId: number) {
    const raw = calScores[critId];
    if (raw === undefined) return null;
    const score = Number(raw);
    if (!raw || isNaN(score) || score < 0 || score > 10) return null;
    return score;
  }
  const fillableCount = displayActiveCriteria.filter(c => pendingScore(c.criterionId) != null).length;

  // Pendências para o "Salvar Tudo": comentários isolados (critério já calibrado
  // mas com razão editada localmente sem nova nota) + pesos editados.
  const pendingReasonOnlyCrits = displayActiveCriteria.filter(c => {
    if (pendingScore(c.criterionId) != null) return false; // já coberto pelo fillableCount
    const localReason = calReasons[c.criterionId];
    if (localReason === undefined) return false;
    const existing = getCalibration(c.criterionId);
    if (!existing) return false; // sem calibração existente, não há score para reusar
    return localReason.trim() !== (existing.calibrationReason ?? "").trim();
  });
  const pendingWeightCritIds = Object.keys(weightEdits).map(Number).filter(id => {
    const raw = (weightEdits[id] ?? "").replace(",", ".").trim();
    return raw !== "" && !isNaN(Number(raw)) && Number(raw) >= 0;
  });

  // Critérios cuja intenção de publicação (toggle Parc./Final) diverge do estado
  // JÁ publicado no servidor — cada divergência é uma mudança de status pendente
  // que o "Salvar" deve aplicar (publicar/rebaixar), não só as edições de nota.
  // Só conta critérios calibrados (sem calibração não há o que publicar).
  const pendingPublishCritIds = displayActiveCriteria.filter(c => {
    if (!getCalibration(c.criterionId)) return false;
    const intent = publishIntents[c.criterionId];
    if (intent === undefined) return false;
    const baseline = c.finalPublishedAt ? "final" : "partial";
    return intent !== baseline;
  }).map(c => c.criterionId);

  // Edições de DADOS não salvas (nota, justificativa, peso). Não inclui a
  // divergência de intenção Parc./Final — essa é justamente o que "Publicar" aplica.
  const unsavedEditsCount = fillableCount + pendingReasonOnlyCrits.length + pendingWeightCritIds.length;
  const totalDirtyCount = unsavedEditsCount + pendingPublishCritIds.length;

  return { pendingScore, pendingReasonOnlyCrits, pendingWeightCritIds, unsavedEditsCount, totalDirtyCount };
}
