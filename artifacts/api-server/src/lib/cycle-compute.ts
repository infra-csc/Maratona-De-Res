/**
 * Cálculo PURO (sem banco) da nota do time por evento e do resultado oficial
 * do ciclo (employee_event_results + quarterly_results).
 *
 * Os dados chegam pré-carregados em lote (ver lib/cycle-data.ts). Antes, cada
 * evento fazia 5 consultas e cada colaborador mais 3 (N+1): ~800 consultas num
 * ciclo de 96 eventos. As regras de negócio são exatamente as mesmas de antes
 * — este arquivo só troca "consultar dentro do laço" por "procurar no Map".
 *
 * Regras que NÃO podem mudar (cobertas por testes e pelo harness de
 * equivalência antigo × novo):
 *  - só eventos com resultsConfirmed contam (nota E participação);
 *  - nota 0 legítima conta (hasScore); evento sem nenhuma nota fica fora;
 *  - média define a faixa; bônus = base + extras × bonusPerExtraEvent da MESMA
 *    faixa; faixa sem bônus zera tudo;
 *  - conformidade null = 25 (pendente = SIM), false = 0;
 *  - freela, "Sup Ceno *" e participante inativo seguem lib/participation.ts;
 *  - decisões de pagamento (paidAt/approved/scheduled/paid/blocked) preservadas
 *    com warnings;
 *  - eventos históricos usam importedScore direto.
 */
import {
  calculateEventResult, calculateQuarterGrossAverage, calculateQuarterFinalResult, getPlatoonByScore,
  calculateTieredBonus, calculateExtraBonusValue, selectExtraEventScores, calculateConformitySubtotal,
  calculateConformityPenalty, calculateFinalEventScore, buildAssignedEvaluatorsByArea,
  getCriterionEvaluationStatus, mergeEventScopedCriteria,
} from "./calculations.js";
import { participantCountsForScore, isInformationalFunction } from "./participation.js";

// ─── Nota do TIME de um evento ──────────────────────────────────────────────

/** Linha de event_criteria ⋈ criteria ⋈ areas (mesmo select de sempre). */
export interface EventCriterionRow {
  criterionId: number;
  criterionName: string | null;
  criterionDescription: string | null;
  responsibleAreaId: number | null;
  responsibleAreaLabel: string | null;
  responsibleAreaName: string | null;
  active: boolean;
  originalWeight: string | null;
  weightOverride: string | null;
  displayOrder: number | null;
  eventScoped: boolean | null;
  sourceCriterionId: number | null;
}

export interface EvaluationLike {
  criterionId: number;
  evaluatorUserId: number;
  score: string;
  status: string;
}

export interface CalibrationLike {
  criterionId: number;
  calibratedScore: string;
  calibrationReason: string | null;
}

export interface ConformityLike {
  epi: boolean | null;
  estaiamentos: boolean | null;
  guardaEquipamentos: boolean | null;
  conduta: boolean | null;
}

/**
 * Tudo o que a nota do time de UM evento precisa. As listas preservam a ordem
 * em que o banco devolveu as linhas daquele evento (a média é somada nessa
 * ordem, como antes).
 */
export interface EventTeamData<TConformity extends ConformityLike = ConformityLike> {
  criteriaRows: EventCriterionRow[];
  evaluations: EvaluationLike[];
  calibrations: CalibrationLike[];
  areaAssignments: { areaId: number; evaluatorUserId: number }[];
  /** Linha de event_conformities (única por evento), ou undefined se não houver. */
  conformity: TConformity | undefined;
}

export function emptyEventTeamData<T extends ConformityLike>(): EventTeamData<T> {
  return { criteriaRows: [], evaluations: [], calibrations: [], areaAssignments: [], conformity: undefined };
}

/**
 * Calcula o resultado do TIME de um evento (uma única nota por evento) a partir
 * dos dados já carregados. Mesma saída de computeEventTeamResult (results.ts),
 * que agora apenas carrega os dados e delega para cá.
 */
export function computeEventTeamResultFromData<TConformity extends ConformityLike>(data: EventTeamData<TConformity>) {
  const { criteriaRows: eventCriteriaRows, evaluations: allEvals, calibrations: allCalibrations } = data;
  const assignedByArea = buildAssignedEvaluatorsByArea(data.areaAssignments);

  // Exibe os critérios ativos + os inativos que já foram calibrados: um critério
  // pode ter sido desativado (sai do cálculo da nota) mas continua calibrado e
  // deve permanecer visível no detalhe do evento, em vez de "sumir". O flag
  // `active` diferencia quem entra no cálculo/contagem (só ativos).
  const calibratedIds = new Set(allCalibrations.map(c => c.criterionId));
  const displayCriteria = eventCriteriaRows
    .filter(c => c.active || calibratedIds.has(c.criterionId))
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const criteriaDetails = displayCriteria.map(c => {
    const weight = parseFloat(c.weightOverride ?? c.originalWeight ?? "1");
    const submittedEvals = allEvals.filter(e => e.criterionId === c.criterionId && e.status === "submitted");
    const evalScores = submittedEvals.map(e => parseFloat(e.score as unknown as string));
    const averageScore = evalScores.length > 0 ? evalScores.reduce((a, b) => a + b, 0) / evalScores.length : null;
    const calibration = allCalibrations.find(cal => cal.criterionId === c.criterionId);
    const calibratedScore = calibration ? parseFloat(calibration.calibratedScore as unknown as string) : null;
    const calibrationReason = calibration?.calibrationReason ?? null;
    const scoreUsed = calibratedScore !== null ? calibratedScore : averageScore;
    const criterionTotal = scoreUsed !== null ? scoreUsed * weight : null;
    // "Avaliado" exige que TODOS os avaliadores designados para a área do
    // critério tenham enviado (ou que exista calibração, que sempre finaliza).
    const completion = getCriterionEvaluationStatus(c.responsibleAreaId, submittedEvals.map(e => e.evaluatorUserId as number), assignedByArea);
    const isEvaluated = calibratedScore !== null || completion.isEvaluated;
    return {
      criterionId: c.criterionId!,
      criterionName: c.criterionName ?? "",
      criterionDescription: c.criterionDescription ?? null,
      responsibleAreaLabel: c.responsibleAreaLabel ?? c.responsibleAreaName ?? null,
      weight,
      averageScore,
      calibratedScore,
      calibrationReason,
      scoreUsed,
      criterionTotal,
      requiredEvaluators: completion.requiredEvaluators,
      submittedEvaluators: completion.submittedEvaluators,
      status: isEvaluated ? "avaliado" : "pendente",
      active: !!c.active,
    };
  });

  // Regra: TODO critério exibido (ativo OU inativo-mas-calibrado) entra no
  // cálculo da nota e na contagem — se tem calibração, conta. Só ficam de fora
  // os inativos sem nenhuma calibração (que nem aparecem em displayCriteria).
  // Mescla critérios duplicados (eventScoped) nos seus pais antes do cálculo:
  // cada membro contribui com seu scoreUsed; o grupo usa o peso do critério pai.
  const criteriaForCalc = mergeEventScopedCriteria(criteriaDetails.map(cd => {
    const row = displayCriteria.find(r => r.criterionId === cd.criterionId);
    return {
      criterionId: cd.criterionId,
      weight: cd.weight,
      averageScore: cd.averageScore,
      calibratedScore: cd.calibratedScore,
      isEventScoped: row?.eventScoped ?? false,
      sourceCriterionId: row?.sourceCriterionId ?? null,
    };
  }));

  const eventScore = calculateEventResult(criteriaForCalc);

  // Matriz de Conformidade: SIM=25/NÃO=0 por item (0-100), penalidade =
  // (100 - Subtotal Conformidade) × 0,40, aplicada sobre o Subtotal Performance.
  // Tipado como TConformity (sem undefined) para manter a assinatura histórica
  // de computeEventTeamResult; em tempo de execução pode ser undefined, como
  // sempre foi (os consumidores já fazem `team.conformity ?? null`).
  const conformity = data.conformity as TConformity;
  const conformitySubtotal = conformity
    ? calculateConformitySubtotal([conformity.epi, conformity.estaiamentos, conformity.guardaEquipamentos, conformity.conduta])
    : 100;
  const conformityPenalty = calculateConformityPenalty(conformitySubtotal);
  const conformityScore = calculateFinalEventScore(eventScore, conformitySubtotal);

  const hasCalibration = criteriaDetails.some(cd => cd.calibratedScore !== null);
  // Contagem considera todos os critérios exibidos (ativos + inativos-calibrados),
  // já que todos entram na nota.
  const pendingCriteria = criteriaDetails.filter(cd => cd.status === "pendente").length;
  const evaluatedCriteria = criteriaDetails.length - pendingCriteria;
  const isComplete = criteriaDetails.length > 0 && pendingCriteria === 0;

  return { criteriaDetails, eventScore, conformity, conformityPenalty, conformityScore, hasCalibration, pendingCriteria, evaluatedCriteria, totalCriteria: criteriaDetails.length, isComplete };
}

// ─── Resultado oficial do ciclo ─────────────────────────────────────────────

export interface PlatoonRuleMapped {
  name: string; color: string; minScore: number; maxScore: number;
  minInclusive: boolean; maxInclusive: boolean; bonusValue: number; bonusPerExtraEvent: number;
}

export interface CycleEventLike {
  id: number;
  resultsConfirmed: boolean;
  isHistorical: boolean;
  importedScore: string | null;
  startDate: string;
}

/** event_participants ⋈ employees (left join) — mesmo select de sempre. */
export interface ParticipationRow {
  employeeId: number;
  eventId: number;
  functionName: string | null;
  confirmed: boolean;
  employmentType: string | null;
  employeeFunction: string | null;
}

export interface SupCenoCheckRow {
  employeeId: number;
  functionName: string | null;
  employeeFunction: string | null;
}

export interface EmployeeLike {
  id: number;
  name: string;
  functionName: string;
  eligibleForBonus: boolean;
  eligibilityStatus: string;
  eligibilityReason: string | null;
}

export interface AbsenceLike {
  employeeId: number;
  kind: string;
  points: number;
  quantity: number;
}

export interface CycleEligibilityLike {
  eligible: boolean;
  reason: string | null;
}

/** Linha atual de quarterly_results (snapshot de pagamento a preservar). */
export interface ExistingQuarterlyLike {
  employeeId: number;
  bonusStatus: string;
  bonusValue: string;
  paymentMethod: string;
  paymentDueDate: string | null;
  paidAt: Date | null;
  paymentNotes: string | null;
}

export interface CycleRecomputeInput<TConformity extends ConformityLike = ConformityLike> {
  cycleId: number;
  userId: number;
  now: Date;
  /** Todos os eventos do ciclo (confirmados ou não), na ordem do banco. */
  cycleEvents: CycleEventLike[];
  platoonRules: PlatoonRuleMapped[];
  minEvents: number;
  /** quarterly_results atuais do ciclo, na ordem do banco (define a ordem dos warnings). */
  existingRows: ExistingQuarterlyLike[];
  /** Dados da nota do time por evento — necessário para os confirmados não históricos. */
  teamDataByEvent: Map<number, EventTeamData<TConformity>>;
  /** Participações nos eventos CONFIRMADOS do ciclo, na ordem do banco. */
  participationRows: ParticipationRow[];
  /** Participações em TODOS os eventos do ciclo (para a regra "Sup Ceno *"). */
  supCenoCheckRows: SupCenoCheckRow[];
  employeesById: Map<number, EmployeeLike>;
  /** Faltas/penalidades/méritos do ciclo (de todos os colaboradores). */
  absences: AbsenceLike[];
  /** employee_cycle_eligibility do ciclo, por colaborador. */
  eligibilityByEmployee: Map<number, CycleEligibilityLike>;
}

export interface EventResultInsert {
  eventId: number;
  employeeId: number;
  eventScore: string;
  calibratedEventScore: string | null;
  finalEventScore: string;
  platoonProjected: string | null;
  updatedAt: Date;
}

export interface QuarterlyInsert {
  employeeId: number;
  cycleId: number;
  eventsCount: number;
  participatedEventsCount: number;
  scoreSum: string;
  grossAverage: string;
  totalAbsences: number;
  absencePenalty: string;
  meritPoints: string;
  finalResult: string;
  platoon: string | null;
  platoonColor: string | null;
  bonusValue: string;
  extraBonusValue: string;
  eligible: boolean;
  eligibilityReason: string | null;
  bonusStatus: string;
  paymentMethod: string;
  paymentDueDate: string | null;
  paidAt: Date | null;
  paymentNotes: string | null;
  closedAt: Date;
  closedByUserId: number;
}

export const PRESERVE_PAYMENT_STATUSES = ["approved", "scheduled", "paid", "blocked"];

/**
 * Colaboradores cujo cadastro o cálculo vai consultar: todos com participação
 * que conta + os que têm pagamento decidido (para o texto do warning).
 * Usado pelo carregador para buscar os colaboradores numa consulta só.
 */
export function employeeIdsNeededForRecompute(
  participationRows: ParticipationRow[],
  existingRows: ExistingQuarterlyLike[],
): number[] {
  const ids = new Set<number>();
  for (const r of participationRows) if (r.employeeId) ids.add(r.employeeId);
  for (const r of existingRows) ids.add(r.employeeId);
  return [...ids];
}

/**
 * Monta, em memória, as linhas de employee_event_results e quarterly_results
 * de um ciclo + os warnings de pagamento. Mesma lógica (e mesma ordem de
 * iteração) do antigo recomputeCycleResults.
 */
export function buildCycleResults<TConformity extends ConformityLike>(input: CycleRecomputeInput<TConformity>) {
  const { cycleId, userId, now, cycleEvents, platoonRules, minEvents } = input;
  // Trava mestra: eventos sem resultsConfirmed=true não contam para NADA —
  // nem participatedEventsCount/elegibilidade, nem nota — mesmo se fechados.
  const confirmedCycleEvents = cycleEvents.filter(e => e.resultsConfirmed);
  // Eventos confirmados contam para nota independente de status (alguns são
  // confirmados enquanto ainda "open").
  const scoringEvents = confirmedCycleEvents;
  const scoringEventIds = new Set(scoringEvents.map(e => e.id));
  const warnings: string[] = [];

  const paymentByEmployee = new Map<number, ExistingQuarterlyLike>();
  for (const r of input.existingRows) paymentByEmployee.set(r.employeeId, r);

  // Participações por evento (na ordem do banco) — substitui a consulta por evento.
  const participantsByEvent = new Map<number, ParticipationRow[]>();
  for (const r of input.participationRows) {
    let list = participantsByEvent.get(r.eventId);
    if (!list) { list = []; participantsByEvent.set(r.eventId, list); }
    list.push(r);
  }

  // 1. Nota do TIME de cada evento confirmado + linhas por evento.
  //    Eventos históricos já trazem a nota final PRONTA (importedScore), sem
  //    critérios/avaliações e sem penalidade de conformidade.
  const eventScoreById = new Map<number, number>();
  const eventDateById = new Map<number, string>();
  const eventResultInserts: EventResultInsert[] = [];
  for (const ev of scoringEvents) {
    // Freelancers, funções informativas ("Sup Ceno *") e participante marcado
    // como INATIVO no evento (confirmed === false) não geram linha de nota.
    const eventParticipants = (participantsByEvent.get(ev.id) ?? [])
      .filter(p => p.confirmed !== false && participantCountsForScore(p));

    if (ev.isHistorical) {
      const historicalScore = parseFloat(ev.importedScore as unknown as string);
      eventScoreById.set(ev.id, historicalScore);
      eventDateById.set(ev.id, ev.startDate);
      const platoonProj = getPlatoonByScore(historicalScore, platoonRules);
      for (const p of eventParticipants) {
        eventResultInserts.push({
          eventId: ev.id,
          employeeId: p.employeeId,
          eventScore: String(historicalScore),
          calibratedEventScore: String(historicalScore),
          finalEventScore: String(historicalScore),
          platoonProjected: platoonProj?.name ?? null,
          updatedAt: now,
        });
      }
      continue;
    }

    const team = computeEventTeamResultFromData(input.teamDataByEvent.get(ev.id) ?? emptyEventTeamData<TConformity>());
    // Só entra na média quem tem alguma nota de critério (nota 0 legítima
    // conta; evento sem nenhuma avaliação fica fora).
    const hasAnyScore = team.criteriaDetails.some(cd => cd.scoreUsed != null);
    if (hasAnyScore) eventScoreById.set(ev.id, team.conformityScore);
    eventDateById.set(ev.id, ev.startDate);
    const platoonProj = getPlatoonByScore(team.conformityScore, platoonRules);

    for (const p of eventParticipants) {
      eventResultInserts.push({
        eventId: ev.id,
        employeeId: p.employeeId,
        eventScore: String(team.eventScore),
        calibratedEventScore: team.hasCalibration ? String(team.eventScore) : null,
        finalEventScore: String(team.conformityScore),
        platoonProjected: platoonProj?.name ?? null,
        updatedAt: now,
      });
    }
  }

  // 2. "Sup Ceno *" em QUALQUER evento do ciclo (confirmado ou não) torna o
  //    colaborador inelegível ao ranking/bônus.
  const supCenoEmployeeIds = new Set<number>();
  for (const r of input.supCenoCheckRows) {
    if (!r.employeeId) continue;
    if (isInformationalFunction(r.functionName) || isInformationalFunction(r.employeeFunction)) supCenoEmployeeIds.add(r.employeeId);
  }

  // Participação que conta (mesmo predicado da fase 1): inativo no evento,
  // freela e "Sup Ceno *" não contam nem para participatedEventsCount.
  const participatedByEmployee = new Map<number, Set<number>>();
  for (const r of input.participationRows) {
    if (!r.employeeId) continue;
    if (r.confirmed === false) continue;
    if (!participantCountsForScore(r)) continue;
    if (!participatedByEmployee.has(r.employeeId)) participatedByEmployee.set(r.employeeId, new Set());
    participatedByEmployee.get(r.employeeId)!.add(r.eventId);
  }

  // Faltas/penalidades/méritos agrupados por colaborador.
  const absencesByEmployee = new Map<number, AbsenceLike[]>();
  for (const a of input.absences) {
    let list = absencesByEmployee.get(a.employeeId);
    if (!list) { list = []; absencesByEmployee.set(a.employeeId, list); }
    list.push(a);
  }

  // 3. Consolida o resultado do ciclo por colaborador.
  const quarterlyInserts: QuarterlyInsert[] = [];
  for (const [employeeId, eventSet] of participatedByEmployee) {
    const employee = input.employeesById.get(employeeId);
    if (!employee) continue;

    const participatedCount = eventSet.size;

    // Eventos COM NOTA dentre os confirmados que o colaborador participou.
    const eventScores: number[] = [];
    const scoredEventsWithDate: { score: number; date: string }[] = [];
    for (const eventId of eventSet) {
      if (!scoringEventIds.has(eventId)) continue;
      const s = eventScoreById.get(eventId);
      if (s !== undefined) {
        eventScores.push(s);
        const date = eventDateById.get(eventId);
        if (date) scoredEventsWithDate.push({ score: s, date });
      }
    }
    const scoredCount = eventScores.length;
    const scoreSum = Math.round(eventScores.reduce((a, b) => a + b, 0) * 100) / 100;

    const absenceRows = absencesByEmployee.get(employeeId) ?? [];
    const penaltyRows = absenceRows.filter(a => a.kind !== "merit");
    const meritRows = absenceRows.filter(a => a.kind === "merit");
    const totalAbsences = penaltyRows.reduce((s, a) => s + a.quantity, 0);

    const grossAverage = calculateQuarterGrossAverage(eventScores);
    const penaltyPoints = penaltyRows.reduce((s, a) => s + a.points * a.quantity, 0);
    const meritPoints = meritRows.reduce((s, a) => s + a.points * a.quantity, 0);
    const absencePenalty = penaltyPoints;
    // finalResult = (scoreSum − netPenalty) / N = grossAverage − netPenalty / N (travado entre 0 e 100).
    const finalResult = calculateQuarterFinalResult(grossAverage, penaltyPoints - meritPoints, eventScores.length);
    const platoon = getPlatoonByScore(finalResult, platoonRules);

    const cycleElig = input.eligibilityByEmployee.get(employeeId);

    let eligible = (employee.eligibleForBonus ?? true) && (employee.eligibilityStatus ?? "eligible") === "eligible";
    let eligibilityReason: string | null = null;
    if (!eligible) {
      eligibilityReason = employee.eligibilityReason ?? `Colaborador inelegível (${employee.eligibilityStatus})`;
    }
    if (cycleElig && !cycleElig.eligible) {
      eligible = false;
      eligibilityReason = cycleElig.reason ?? "Inelegível neste ciclo";
    }
    // Regra de participação: precisa ter participado de no mínimo N eventos no ciclo.
    if (eligible && participatedCount < minEvents) {
      eligible = false;
      eligibilityReason = `Participou de ${participatedCount} de ${minEvents} eventos exigidos no ciclo`;
    }
    // "Sup Ceno *" em qualquer evento do ciclo, ou como cargo global, desqualifica.
    if (eligible && (supCenoEmployeeIds.has(employeeId) || isInformationalFunction(employee.functionName))) {
      eligible = false;
      eligibilityReason = "Participou como Sup Ceno em um ou mais eventos do ciclo";
    }

    const extraEventScores = eligible ? selectExtraEventScores(scoredEventsWithDate, minEvents) : [];
    const bonusValue = eligible ? calculateTieredBonus(finalResult, extraEventScores, platoonRules) : 0;
    const extraBonusValue = eligible ? calculateExtraBonusValue(finalResult, extraEventScores, platoonRules) : 0;
    const autoStatus = eligible ? "projected" : "not_eligible";

    // Preserva decisões de pagamento já acionadas manualmente; avisa se o
    // valor recalculado diverge do que já foi (ou será) pago.
    const prev = paymentByEmployee.get(employeeId);
    const keepPayment = !!prev && (!!prev.paidAt || PRESERVE_PAYMENT_STATUSES.includes(prev.bonusStatus));
    if (keepPayment && Math.abs(bonusValue - parseFloat(prev!.bonusValue as unknown as string)) > 0.01) {
      warnings.push(
        `${employee.name}: bônus recalculado para R$ ${bonusValue.toFixed(2)} diverge do valor com status "${prev!.bonusStatus}" (R$ ${parseFloat(prev!.bonusValue as unknown as string).toFixed(2)}). Revise o pagamento.`
      );
    }

    quarterlyInserts.push({
      employeeId,
      cycleId,
      eventsCount: scoredCount,
      participatedEventsCount: participatedCount,
      scoreSum: String(scoreSum),
      grossAverage: String(grossAverage),
      totalAbsences,
      absencePenalty: String(absencePenalty),
      meritPoints: String(meritPoints),
      finalResult: String(finalResult),
      platoon: platoon?.name ?? null,
      platoonColor: platoon?.color ?? null,
      bonusValue: String(bonusValue),
      extraBonusValue: String(extraBonusValue),
      eligible,
      eligibilityReason,
      bonusStatus: keepPayment ? prev!.bonusStatus : autoStatus,
      paymentMethod: prev?.paymentMethod ?? "Caju Saldo Livre",
      paymentDueDate: keepPayment ? prev!.paymentDueDate : null,
      paidAt: keepPayment ? prev!.paidAt : null,
      paymentNotes: keepPayment ? prev!.paymentNotes : null,
      closedAt: now,
      closedByUserId: userId,
    });
  }

  // Alerta: pagamento já decidido de quem ficou sem NENHUMA participação que
  // conta neste ciclo — o rebuild removeria a linha; avisa em vez de sumir calado.
  for (const [employeeId, prev] of paymentByEmployee) {
    if (participatedByEmployee.has(employeeId)) continue;
    if (!prev.paidAt && !PRESERVE_PAYMENT_STATUSES.includes(prev.bonusStatus)) continue;
    const employee = input.employeesById.get(employeeId);
    warnings.push(
      `${employee?.name ?? `Colaborador #${employeeId}`}: pagamento com status "${prev.bonusStatus}" será removido deste ciclo — não há mais participações que contam para nota (verifique se o employmentType ou a função mudou).`
    );
  }

  return { eventResultInserts, quarterlyInserts, warnings };
}
