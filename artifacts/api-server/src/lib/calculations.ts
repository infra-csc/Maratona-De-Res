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

/**
 * Agrupa as atribuições de avaliador por área: quais evaluatorUserId's foram
 * designados para cada área NESTE evento. Um evento pode ter mais de um
 * avaliador por área — quando isso ocorre, a nota final do critério é a média
 * das avaliações de todos eles.
 */
export function buildAssignedEvaluatorsByArea(
  assignments: { areaId: number; evaluatorUserId: number }[],
): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const a of assignments) {
    if (!map.has(a.areaId)) map.set(a.areaId, new Set());
    map.get(a.areaId)!.add(a.evaluatorUserId);
  }
  return map;
}

export interface CriterionEvaluationStatus {
  /** true se todos os avaliadores designados para a área do critério já enviaram sua avaliação. */
  isEvaluated: boolean;
  /** quantos avaliadores estão designados para a área do critério (0 = nenhuma atribuição configurada). */
  requiredEvaluators: number;
  /** quantos dos avaliadores designados já enviaram avaliação para este critério. */
  submittedEvaluators: number;
}

/**
 * Determina se um critério está "avaliado": todos os avaliadores designados
 * para a área responsável pelo critério enviaram sua avaliação. Se a área não
 * tiver nenhuma atribuição configurada (dado legado/sem RH definir), cai no
 * comportamento antigo: qualquer avaliação enviada conta como avaliado.
 */
export function getCriterionEvaluationStatus(
  responsibleAreaId: number | null | undefined,
  submittedEvaluatorIds: number[],
  assignedEvaluatorsByArea: Map<number, Set<number>>,
): CriterionEvaluationStatus {
  const distinctSubmitted = new Set(submittedEvaluatorIds);
  const required = responsibleAreaId != null ? assignedEvaluatorsByArea.get(responsibleAreaId) : undefined;

  if (!required || required.size === 0) {
    return {
      isEvaluated: distinctSubmitted.size > 0,
      requiredEvaluators: 0,
      submittedEvaluators: distinctSubmitted.size,
    };
  }

  let submittedFromRequired = 0;
  for (const id of required) {
    if (distinctSubmitted.has(id)) submittedFromRequired++;
  }
  return {
    isEvaluated: submittedFromRequired === required.size,
    requiredEvaluators: required.size,
    submittedEvaluators: submittedFromRequired,
  };
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

/**
 * Matriz de Conformidade: 4 itens obrigatórios (Uso de EPI, Estaiamento e
 * aterramento, Guarda de equipamentos/ferramentas, Conduta e comportamento).
 * Cada item SIM = 25 pontos, NÃO = 0. Subtotal Conformidade vai de 0 a 100.
 * Sem registro de conformidade = conformidade plena (100).
 */
export function calculateConformitySubtotal(items: (boolean | null | undefined)[]): number {
  return items.reduce((sum: number, v) => sum + (v === true ? 25 : 0), 0);
}

/**
 * Penalidade Conformidade = (100 - Subtotal Conformidade) × 0,40.
 * A conformidade não entra como média simples: funciona como desconto sobre
 * a nota de performance.
 */
export function calculateConformityPenalty(conformitySubtotal: number): number {
  return Math.round((100 - conformitySubtotal) * 0.4 * 100) / 100;
}

/**
 * Pontuação Final do Evento = Subtotal Performance - Penalidade Conformidade,
 * limitada entre 0 e 100.
 */
export function calculateFinalEventScore(performanceSubtotal: number, conformitySubtotal: number): number {
  const penalty = calculateConformityPenalty(conformitySubtotal);
  return Math.min(100, Math.max(0, Math.round((performanceSubtotal - penalty) * 100) / 100));
}

/**
 * Confere os exemplos da especificação "Mudanças para o Próximo Período":
 * conformidade [NÃO, SIM, SIM, SIM] → subtotal 75, penalidade 10;
 * performance pesos=[2,3,3,2,2,2] notas=[7,7,7,7,7,7] → subtotal 70;
 * pontuação final = 70 - 10 = 60.
 */
export function validateConformityCalculationExample(): boolean {
  const subtotal = calculateConformitySubtotal([false, true, true, true]);
  if (subtotal !== 75) return false;
  const penalty = calculateConformityPenalty(subtotal);
  if (penalty !== 10) return false;
  const weights = [2, 3, 3, 2, 2, 2];
  const scores = [7, 7, 7, 7, 7, 7];
  const criteria: CriterionData[] = weights.map((weight, i) => ({
    criterionId: i + 1,
    weight,
    averageScore: scores[i],
    calibratedScore: null,
  }));
  const performance = calculateEventResult(criteria);
  if (performance !== 70) return false;
  const final = calculateFinalEventScore(performance, subtotal);
  return final === 60;
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
 * Bônus do Simulador: valor base da faixa da nota geral (para o mínimo de
 * eventos exigido) somado ao bônus de CADA evento adicional (além do mínimo).
 * Os eventos adicionais são sempre os últimos cronologicamente (a partir do
 * evento de nº mínimo+1); cada um usa a NOTA DAQUELE evento específico para
 * definir sua própria faixa e o valor de "bônus por evento adicional" dela —
 * não a faixa da nota geral. Sem teto — soma linear por evento extra.
 */
export function calculateTieredBonus(
  score: number,
  extraEventScores: number[],
  rules: PlatoonRuleData[],
): number {
  const platoon = getPlatoonByScore(score, rules);
  if (!platoon) return 0;
  let extraBonus = 0;
  for (const extraScore of extraEventScores) {
    const extraPlatoon = getPlatoonByScore(extraScore, rules);
    extraBonus += extraPlatoon?.bonusPerExtraEvent ?? 0;
  }
  return Math.round((platoon.bonusValue + extraBonus) * 100) / 100;
}

/**
 * Dado o conjunto de eventos pontuados (com nota e data) de um colaborador,
 * separa os eventos "base" (os primeiros, cronologicamente, até o mínimo
 * exigido) dos "adicionais" (os últimos, a partir do evento de nº mínimo+1).
 * Eventos sem data conhecida não entram na ordenação de extras.
 */
export function selectExtraEventScores(
  scoredEvents: { score: number; date: string }[],
  minEvents: number,
): number[] {
  const sorted = [...scoredEvents].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.slice(minEvents).map(e => e.score);
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
