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
        return { name: e.evaluatorName ?? "Avaliador", evaluatorUserId: e.evaluatorUserId ?? null, criterionId: e.criterionId, score: Number(e.score), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null, areaName: crit?.responsibleAreaName ?? null, isChild: e.criterionId !== critId, respondedAt: respondedRaw ? new Date(respondedRaw) : null };
      });
  }

  /** Uma linha por ÁREA do critério (o de origem + as cópias por área): respostas e média de cada uma. */
  function getMembers(critId: number) {
    const ids = [critId, ...(childCriterionIdsMap.get(critId) ?? [])];
    const scores = getAreaScores(critId);
    return ids
      .map(id => {
        const crit = activeCriteria.find(ac => ac.criterionId === id);
        const answers = scores.filter(s => s.criterionId === id);
        const avg = answers.length > 0 ? answers.reduce((a, b) => a + b.score, 0) / answers.length : null;
        return { criterionId: id, areaName: crit?.responsibleAreaName ?? null, answers, avg };
      })
      .sort((a, b) => (a.criterionId === critId ? -1 : b.criterionId === critId ? 1 : (a.areaName ?? "").localeCompare(b.areaName ?? "", "pt-BR")));
  }

  // Mesma conta do servidor (mergeEventScopedCriteria): média das ÁREAS que
  // avaliaram — cada área entra com a média das respostas dela.
  function getAvgScore(critId: number) {
    const avgs = getMembers(critId).map(m => m.avg).filter((v): v is number => v != null);
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
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

  return { getAreaScores, getMembers, getAvgScore, getCalibration, activeCriteria, childCriterionIdsMap, displayActiveCriteria };
}

export type DerivedCriteria = ReturnType<typeof deriveCriteria>;
export type AreaScore = ReturnType<DerivedCriteria["getAreaScores"]>[number];
export type AreaMember = ReturnType<DerivedCriteria["getMembers"]>[number];
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

  // Edições de DADOS não salvas (nota, justificativa, peso). O seletor
  // Parc./Final NÃO conta: ele só diz como o botão "Publicar" publica. Regra do
  // dono (02/10/2026): SALVAR NUNCA PUBLICA — antes, trocar o seletor para
  // "Final" e clicar em Salvar publicava o critério como Final.
  void publishIntents;
  const unsavedEditsCount = fillableCount + pendingReasonOnlyCrits.length + pendingWeightCritIds.length;
  const totalDirtyCount = unsavedEditsCount;

  return { pendingScore, pendingReasonOnlyCrits, pendingWeightCritIds, unsavedEditsCount, totalDirtyCount };
}
