export function convertScoreToPercentage(score: number, maxScore = 5): number {
  return score / maxScore;
}

export function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return weights.map(() => 0);
  return weights.map((w) => w / total);
}

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

export function calculateEventResult(criteria: CriterionData[], maxScore = 5): number {
  const activeCriteria = criteria.filter(
    (c) => getScoreUsedForCalculation(c.averageScore, c.calibratedScore) !== null,
  );
  if (activeCriteria.length === 0) return 0;

  const weights = activeCriteria.map((c) => c.weight);
  const normalizedWeights = normalizeWeights(weights);

  let totalContribution = 0;
  for (let i = 0; i < activeCriteria.length; i++) {
    const score = getScoreUsedForCalculation(
      activeCriteria[i].averageScore,
      activeCriteria[i].calibratedScore,
    )!;
    const pct = convertScoreToPercentage(score, maxScore);
    totalContribution += pct * normalizedWeights[i];
  }
  return totalContribution;
}

export function calculateQuarterGrossAverage(eventScores: number[]): number {
  if (eventScores.length === 0) return 0;
  return eventScores.reduce((a, b) => a + b, 0) / eventScores.length;
}

export function calculateAbsencePenalty(totalAbsences: number, penaltyPerAbsence: number): number {
  return totalAbsences * penaltyPerAbsence;
}

export function calculateQuarterFinalResult(grossAverage: number, absencePenalty: number): number {
  return Math.max(0, grossAverage - absencePenalty);
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
