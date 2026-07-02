export function getAverageEvaluatorScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function getScoreUsedForCalculation(
  averageScore: number | null,
  calibratedScore: number | null,
): number | null {
  if (calibratedScore !== null) return calibratedScore;
  return averageScore;
}

export interface CriterionData {
  criterionId: number;
  weight: number;
  averageScore: number | null;
  calibratedScore: number | null;
}

/**
 * Calcula o resultado do evento como MÉDIA PONDERADA das notas (escala 0-10),
 * normalizada para 0-100: (Σ(nota_usada × peso) / Σ(peso)) × 10.
 * Pesos são livres (temporário); apenas critérios com nota entram na média.
 * Exemplo: pesos=[3,3,2,3,3,3,3], notas=[8,8,8,6,4,6,10] → 71
 */
export function calculateEventResult(criteria: CriterionData[]): number {
  let weighted = 0;
  let weightSum = 0;
  for (const c of criteria) {
    const score = getScoreUsedForCalculation(c.averageScore, c.calibratedScore);
    if (score !== null) {
      weighted += score * c.weight;
      weightSum += c.weight;
    }
  }
  if (weightSum === 0) return 0;
  return Math.round((weighted / weightSum) * 10 * 100) / 100;
}

export function validateCalculationExample(): boolean {
  const weights = [3, 3, 2, 3, 3, 3, 3];
  const scores = [8, 8, 8, 6, 4, 6, 10];
  const criteria: CriterionData[] = weights.map((weight, i) => ({
    criterionId: i + 1,
    weight,
    averageScore: scores[i],
    calibratedScore: null,
  }));
  const result = calculateEventResult(criteria);
  return result === 71;
}

export function calculateQuarterGrossAverage(eventScores: number[]): number {
  if (eventScores.length === 0) return 0;
  return Math.round((eventScores.reduce((a, b) => a + b, 0) / eventScores.length) * 100) / 100;
}

export function calculateAbsencePenalty(totalAbsences: number, penaltyPerAbsence: number): number {
  return totalAbsences * penaltyPerAbsence;
}

export function calculateQuarterFinalResult(grossAverage: number, absencePenalty: number): number {
  return Math.min(100, Math.max(0, Math.round((grossAverage - absencePenalty) * 100) / 100));
}

export interface PlatoonRuleData {
  name: string;
  color: string;
  minScore: number;
  maxScore: number;
  minInclusive: boolean;
  maxInclusive: boolean;
  bonusValue: number;
  bonusPerExtraEvent?: number;
}

export function getPlatoonByScore(
  score: number,
  rules: PlatoonRuleData[],
): PlatoonRuleData | null {
  const sorted = [...rules].sort((a, b) => b.minScore - a.minScore);
  for (const rule of sorted) {
    const aboveMin = rule.minInclusive ? score >= rule.minScore : score > rule.minScore;
    const belowMax = rule.maxInclusive ? score <= rule.maxScore : score < rule.maxScore;
    if (aboveMin && belowMax) return rule;
  }
  return null;
}

export function calculateBonusByScore(score: number, rules: PlatoonRuleData[]): number {
  const platoon = getPlatoonByScore(score, rules);
  return platoon ? platoon.bonusValue : 0;
}

/**
 * Bônus do Simulador: valor base da faixa (para o mínimo de eventos exigido)
 * somado ao bônus por evento extra × quantidade de eventos além do mínimo.
 * Sem teto — cada evento extra soma linearmente o valor da faixa atual.
 */
export function calculateTieredBonus(
  score: number,
  participatedEvents: number,
  minEvents: number,
  rules: PlatoonRuleData[],
): number {
  const platoon = getPlatoonByScore(score, rules);
  if (!platoon) return 0;
  const extraEvents = Math.max(0, participatedEvents - minEvents);
  const perExtra = platoon.bonusPerExtraEvent ?? 0;
  return Math.round((platoon.bonusValue + extraEvents * perExtra) * 100) / 100;
}

/**
 * Converte uma nota bruta (0–10) para percentual (0–100).
 * Útil para exibição e relatórios sem alterar o cálculo base.
 */
export function convertScoreToPercentage(score: number, maxScore = 10): number {
  if (maxScore === 0) return 0;
  return Math.round((score / maxScore) * 100 * 100) / 100;
}

/**
 * Normaliza pesos para que a soma seja igual a targetSum (padrão: 20).
 * Usado ao redistribuir pesos após adicionar/remover quesitos.
 */
export function normalizeWeights(weights: number[], targetSum = 20): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return weights.map(() => 0);
  const factor = targetSum / total;
  const normalized = weights.map(w => Math.round(w * factor * 100) / 100);
  // Correct rounding drift on last element
  const currentSum = normalized.reduce((a, b) => a + b, 0);
  const drift = Math.round((targetSum - currentSum) * 100) / 100;
  if (normalized.length > 0) normalized[normalized.length - 1] += drift;
  return normalized;
}
