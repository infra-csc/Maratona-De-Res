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
 * Calcula o resultado do evento: Σ(nota_usada × peso)
 * Com pesos somando 20 e notas de 0-5, o resultado fica na escala 0-100.
 * Exemplo: pesos=[3,3,2,3,3,3,3], notas=[4,4,4,3,2,3,5] → 71
 */
export function calculateEventResult(criteria: CriterionData[]): number {
  let total = 0;
  for (const c of criteria) {
    const score = getScoreUsedForCalculation(c.averageScore, c.calibratedScore);
    if (score !== null) {
      total += score * c.weight;
    }
  }
  return Math.round(total * 100) / 100;
}

export function validateCalculationExample(): boolean {
  const weights = [3, 3, 2, 3, 3, 3, 3];
  const scores = [4, 4, 4, 3, 2, 3, 5];
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
