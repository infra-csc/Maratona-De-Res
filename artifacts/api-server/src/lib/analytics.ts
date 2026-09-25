// Agregações da tela de Análises. Função pura: recebe as linhas já lidas do
// banco e devolve os indicadores — testável sem Postgres (analytics.test.ts).
import { getPlatoonByScore, calculateTieredBonus, CONFORMITY_ITEM_POINTS, CONFORMITY_PENALTY_FACTOR, type PlatoonRuleData } from "./calculations.js";

export interface AnalyticsInput {
  events: { id: number; name: string; clientName: string | null; startDate: string; endDate: string; resultsConfirmed: boolean; isHistorical: boolean }[];
  /** Nota oficial por evento (employee_event_results.finalEventScore, 0-100). */
  officialScores: { eventId: number; score: number }[];
  quarterly: { employeeId: number; employeeName: string; finalResult: number; platoon: string | null; bonusValue: number; eligible: boolean; eventsCount: number; participatedEventsCount: number }[];
  rules: PlatoonRuleData[];
  minEvents: number;
  evaluations: { eventId: number; criterionId: number; evaluatorUserId: number; evaluatorName: string; score: number; status: string; submittedAt: Date | null }[];
  calibrations: { eventId: number; criterionId: number; calibratedScore: number }[];
  /** weight = peso efetivo no evento (weightOverride ?? peso padrão); ausente = 1. */
  eventCriteria: { eventId: number; criterionId: number; active: boolean; name: string; area: string | null; weight?: number | null }[];
  /**
   * Catálogo de critérios (todos, inclusive cópias por evento). Serve para
   * juntar a cópia "Qualidade da Entrega (2)" ao critério de origem, como faz a
   * nota oficial (mergeEventScopedCriteria). Opcional nos testes antigos.
   */
  criteriaCatalog?: { id: number; name: string; eventScoped: boolean; sourceCriterionId: number | null }[];
  conformities: { eventId: number; epi: boolean | null; estaiamentos: boolean | null; conduta: boolean | null; guardaEquipamentos: boolean | null }[];
  adjustments: { employeeId: number; label: string; kind: "penalty" | "merit"; points: number; quantity: number }[];
}

export interface AnalyticsOverview {
  kpis: {
    eventsTotal: number; eventsConfirmed: number; eventsScored: number; avgEventScore: number | null; avgFinalResult: number | null;
    collaborators: number; reachedMinEvents: number; eligible: number; withBonus: number; bonusTotal: number;
    evaluationsSubmitted: number; evaluationsDraft: number; calibratedCriteria: number; avgCalibrationShift: number | null;
    penaltiesCount: number; meritsCount: number; minEvents: number;
  };
  scoreTrend: { weekStart: string; label: string; avgScore: number; events: number }[];
  criteria: { key: string; name: string; area: string | null; avgScore: number; evaluatorAvg: number | null; calibratedAvg: number | null; calibratedCount: number; eventsCount: number }[];
  conformity: { item: string; label: string; answered: number; nao: number; naoPct: number | null }[];
  faixas: { name: string; color: string | null; minScore: number | null; maxScore: number | null; bonusValue: number | null; bonusPerExtraEvent: number | null; count: number; bonusTotal: number }[];
  /** Parâmetros das regras de negócio em vigor (para o relatório explicar com os números reais). */
  ruleSet: { minEvents: number; conformityItemPoints: number; conformityPenaltyFactor: number; conformityPenaltyPerNo: number };
  funnel: { stage: string; label: string; count: number }[];
  nearNextFaixa: { employeeId: number; name: string; finalResult: number; currentFaixa: string | null; nextFaixa: string; gap: number; currentBonus: number; potentialBonus: number }[];
  evaluators: { userId: number; name: string; submitted: number; drafts: number; avgGiven: number | null; calibrationBias: number | null; biasSamples: number; avgDaysToSubmit: number | null }[];
  adjustments: { label: string; kind: "penalty" | "merit"; occurrences: number; points: number; employees: number }[];
  clients: { client: string; avgScore: number; events: number }[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Sábado do fim de semana a que a data pertence (eventos acontecem sáb/dom). */
export function weekendStart(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = new Date(t).getUTCDay(); // 0 dom … 6 sáb
  const back = (dow - 6 + 7) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

const CONFORMITY_ITEMS = [
  { item: "epi", label: "Uso de EPI" },
  { item: "estaiamentos", label: "Estaiamento e aterramento" },
  { item: "conduta", label: "Conduta e comportamento" },
  { item: "guardaEquipamentos", label: "Guarda de equipamentos" },
] as const;

export function computeAnalytics(input: AnalyticsInput): AnalyticsOverview {
  const eventById = new Map(input.events.map(e => [e.id, e]));
  const officialByEvent = new Map<number, number>();
  for (const s of input.officialScores) if (!officialByEvent.has(s.eventId)) officialByEvent.set(s.eventId, s.score);
  const scoredConfirmed = input.events.filter(e => e.resultsConfirmed && officialByEvent.has(e.id));

  // ── Evolução por fim de semana (eventos confirmados, nota oficial) ──
  const byWeek = new Map<string, number[]>();
  for (const e of scoredConfirmed) {
    const k = weekendStart(e.startDate);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(officialByEvent.get(e.id)!);
  }
  const scoreTrend = [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([weekStart, xs]) => ({
    weekStart,
    label: `${weekStart.slice(8, 10)}/${weekStart.slice(5, 7)}`,
    avgScore: r1(avg(xs)!),
    events: xs.length,
  }));

  // ── Critérios: nota usada (calibração ?? média dos avaliadores), 0-100 ──
  // Só eventos com resultados confirmados, como a nota oficial (o cabeçalho da
  // tela promete isso). Avaliadores (mais abaixo) seguem vendo tudo.
  const submitted = input.evaluations.filter(e => e.status === "submitted");
  const evalsByEc = new Map<string, number[]>();
  for (const e of submitted) {
    const k = `${e.eventId}:${e.criterionId}`;
    if (!evalsByEc.has(k)) evalsByEc.set(k, []);
    evalsByEc.get(k)!.push(e.score);
  }
  const calByEc = new Map(input.calibrations.map(c => [`${c.eventId}:${c.criterionId}`, c.calibratedScore]));
  // Uma linha por critério E área: cópias por evento ("… (2)", "… (cópia)")
  // voltam para o nome de origem e ficam na área que avaliou. Assim "Qualidade
  // da Entrega" aparece duas vezes — Atendimento e Ativação —, como é avaliada;
  // na nota oficial do evento as duas entram pela média. Um ponto por evento.
  const catalogById = new Map((input.criteriaCatalog ?? []).map(c => [c.id, c]));
  const baseName = (n: string) => n.replace(/\s*\((?:\d+|c[óo]pia)\)\s*$/i, "").trim();
  const rootOf = (ec: { criterionId: number; name: string; area: string | null }) => {
    const cat = catalogById.get(ec.criterionId);
    const src = cat?.sourceCriterionId != null ? catalogById.get(cat.sourceCriterionId) : undefined;
    const name = baseName(src?.name ?? cat?.name ?? ec.name);
    return { key: `${name.toLocaleLowerCase("pt-BR")}|${(ec.area ?? "").toLocaleLowerCase("pt-BR")}`, name, area: ec.area };
  };
  const perEvent = new Map<string, { rootKey: string; name: string; area: string | null; used: number[]; evalAvg: number[]; cal: number[] }>();
  const shifts: number[] = [];
  for (const ec of input.eventCriteria) {
    const ev = eventById.get(ec.eventId);
    if (!ev || ev.isHistorical || !ev.resultsConfirmed) continue;
    const k = `${ec.eventId}:${ec.criterionId}`;
    // Mesma regra da nota oficial: entram os ativos e os inativos calibrados;
    // peso 0 não conta na nota do evento, então também não entra na média.
    if (!ec.active && !calByEc.has(k)) continue;
    if ((ec.weight ?? 1) <= 0) continue;
    const evalAvg = avg(evalsByEc.get(k) ?? []);
    const cal = calByEc.get(k);
    const used = cal ?? evalAvg;
    if (used == null) continue;
    const root = rootOf(ec);
    const pk = `${ec.eventId}|${root.key}`;
    if (!perEvent.has(pk)) perEvent.set(pk, { rootKey: root.key, name: root.name, area: root.area, used: [], evalAvg: [], cal: [] });
    const e = perEvent.get(pk)!;
    e.used.push(used * 10);
    if (evalAvg != null) e.evalAvg.push(evalAvg * 10);
    if (cal != null) {
      e.cal.push(cal * 10);
      if (evalAvg != null) shifts.push((cal - evalAvg) * 10);
    }
  }
  const critAgg = new Map<string, { name: string; area: string | null; used: number[]; evalAvg: number[]; cal: number[] }>();
  for (const e of perEvent.values()) {
    if (!critAgg.has(e.rootKey)) critAgg.set(e.rootKey, { name: e.name, area: e.area, used: [], evalAvg: [], cal: [] });
    const a = critAgg.get(e.rootKey)!;
    a.used.push(avg(e.used)!);
    if (e.evalAvg.length) a.evalAvg.push(avg(e.evalAvg)!);
    if (e.cal.length) a.cal.push(avg(e.cal)!);
  }
  const criteria = [...critAgg.entries()].map(([key, a]) => ({
    key, name: a.name, area: a.area,
    avgScore: r1(avg(a.used)!),
    evaluatorAvg: a.evalAvg.length ? r1(avg(a.evalAvg)!) : null,
    calibratedAvg: a.cal.length ? r1(avg(a.cal)!) : null,
    calibratedCount: a.cal.length,
    eventsCount: a.used.length,
  })).sort((x, y) => x.avgScore - y.avgScore);

  // ── Matriz de conformidade ──
  const confirmedConformities = input.conformities.filter(c => eventById.get(c.eventId)?.resultsConfirmed);
  const conformity = CONFORMITY_ITEMS.map(({ item, label }) => {
    let answered = 0; let nao = 0;
    for (const c of confirmedConformities) {
      const v = c[item];
      if (v == null) continue;
      answered++;
      if (v === false) nao++;
    }
    return { item, label, answered, nao, naoPct: answered > 0 ? r1((nao / answered) * 100) : null };
  });

  // ── Faixas e funil ──
  const rulesAsc = [...input.rules].sort((a, b) => a.minScore - b.minScore);
  const faixaCount = new Map<string, { count: number; bonus: number }>();
  for (const q of input.quarterly) {
    const name = q.platoon ?? "Sem faixa";
    if (!faixaCount.has(name)) faixaCount.set(name, { count: 0, bonus: 0 });
    const f = faixaCount.get(name)!;
    f.count++;
    if (q.eligible) f.bonus += q.bonusValue;
  }
  const faixas: AnalyticsOverview["faixas"] = rulesAsc.map(r => ({
    name: r.name, color: r.color ?? null, minScore: r.minScore, maxScore: r.maxScore,
    bonusValue: r.bonusValue, bonusPerExtraEvent: r.bonusPerExtraEvent ?? 0,
    count: faixaCount.get(r.name)?.count ?? 0,
    bonusTotal: r2(faixaCount.get(r.name)?.bonus ?? 0),
  }));
  for (const [name, f] of faixaCount) {
    if (!rulesAsc.some(r => r.name === name)) faixas.push({ name, color: null, minScore: null, maxScore: null, bonusValue: null, bonusPerExtraEvent: null, count: f.count, bonusTotal: r2(f.bonus) });
  }
  const reachedMin = input.quarterly.filter(q => q.participatedEventsCount >= input.minEvents).length;
  const eligible = input.quarterly.filter(q => q.eligible).length;
  const withBonus = input.quarterly.filter(q => q.eligible && q.bonusValue > 0).length;
  const funnel = [
    { stage: "participated", label: "Participaram no ciclo", count: input.quarterly.length },
    { stage: "reachedMin", label: `Atingiram ${input.minEvents} eventos`, count: reachedMin },
    { stage: "eligible", label: "Elegíveis ao bônus", count: eligible },
    { stage: "withBonus", label: "Com bônus", count: withBonus },
  ];

  // ── Perto da próxima faixa (até 3 pontos) ──
  const nearNextFaixa = input.quarterly
    .filter(q => q.eligible)
    .map(q => {
      const current = getPlatoonByScore(q.finalResult, input.rules);
      const next = rulesAsc.find(r => r.minScore > q.finalResult && r.bonusValue > 0 && (!current || r.minScore > current.minScore));
      if (!next) return null;
      const gap = r2(next.minScore - q.finalResult);
      if (gap <= 0 || gap > 3) return null;
      const extras = Math.max(0, q.eventsCount - input.minEvents);
      const potentialBonus = calculateTieredBonus(next.minScore, new Array(extras).fill(next.minScore), input.rules);
      return { employeeId: q.employeeId, name: q.employeeName, finalResult: r2(q.finalResult), currentFaixa: current?.name ?? null, nextFaixa: next.name, gap, currentBonus: r2(q.bonusValue), potentialBonus: r2(potentialBonus) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 15);

  // ── Avaliadores ──
  const evAgg = new Map<number, { name: string; submitted: number; drafts: number; given: number[]; bias: number[]; days: number[] }>();
  for (const e of input.evaluations) {
    if (!evAgg.has(e.evaluatorUserId)) evAgg.set(e.evaluatorUserId, { name: e.evaluatorName, submitted: 0, drafts: 0, given: [], bias: [], days: [] });
    const a = evAgg.get(e.evaluatorUserId)!;
    if (e.status !== "submitted") { a.drafts++; continue; }
    a.submitted++;
    a.given.push(e.score * 10);
    const cal = calByEc.get(`${e.eventId}:${e.criterionId}`);
    if (cal != null) a.bias.push((cal - e.score) * 10);
    const ev = eventById.get(e.eventId);
    if (ev && e.submittedAt) {
      const days = (e.submittedAt.getTime() - Date.parse(`${ev.endDate}T23:59:59Z`)) / 86_400_000;
      a.days.push(Math.max(0, days));
    }
  }
  const evaluators = [...evAgg.entries()].map(([userId, a]) => ({
    userId, name: a.name, submitted: a.submitted, drafts: a.drafts,
    avgGiven: a.given.length ? r1(avg(a.given)!) : null,
    calibrationBias: a.bias.length ? r1(avg(a.bias)!) : null,
    biasSamples: a.bias.length,
    avgDaysToSubmit: a.days.length ? r1(avg(a.days)!) : null,
  })).sort((x, y) => y.submitted - x.submitted);

  // ── Penalidades e méritos ──
  const adjAgg = new Map<string, { label: string; kind: "penalty" | "merit"; occurrences: number; points: number; employees: Set<number> }>();
  for (const a of input.adjustments) {
    const k = `${a.kind}|${a.label}`;
    if (!adjAgg.has(k)) adjAgg.set(k, { label: a.label, kind: a.kind, occurrences: 0, points: 0, employees: new Set() });
    const g = adjAgg.get(k)!;
    g.occurrences += a.quantity;
    g.points += a.points * a.quantity;
    g.employees.add(a.employeeId);
  }
  const adjustments = [...adjAgg.values()]
    .map(g => ({ label: g.label, kind: g.kind, occurrences: g.occurrences, points: g.points, employees: g.employees.size }))
    .sort((a, b) => b.occurrences - a.occurrences);

  // ── Clientes ──
  const byClient = new Map<string, number[]>();
  for (const e of scoredConfirmed) {
    const k = e.clientName?.trim() || "Sem cliente";
    if (!byClient.has(k)) byClient.set(k, []);
    byClient.get(k)!.push(officialByEvent.get(e.id)!);
  }
  const clients = [...byClient.entries()]
    .map(([client, xs]) => ({ client, avgScore: r1(avg(xs)!), events: xs.length }))
    .sort((a, b) => b.events - a.events || b.avgScore - a.avgScore)
    .slice(0, 12);

  const officialConfirmed = scoredConfirmed.map(e => officialByEvent.get(e.id)!);
  const calibratedCriteria = input.calibrations.filter(c => eventById.has(c.eventId)).length;
  return {
    kpis: {
      eventsTotal: input.events.length,
      eventsConfirmed: input.events.filter(e => e.resultsConfirmed).length,
      eventsScored: scoredConfirmed.length,
      avgEventScore: officialConfirmed.length ? r1(avg(officialConfirmed)!) : null,
      // Mesma conta da tela de Resultados: média das notas finais de quem tem evento com nota.
      avgFinalResult: (() => { const xs = input.quarterly.filter(q => q.eventsCount > 0).map(q => q.finalResult); return xs.length ? r1(avg(xs)!) : null; })(),
      collaborators: input.quarterly.length,
      reachedMinEvents: reachedMin,
      eligible,
      withBonus,
      bonusTotal: r2(input.quarterly.filter(q => q.eligible).reduce((s, q) => s + q.bonusValue, 0)),
      evaluationsSubmitted: submitted.length,
      evaluationsDraft: input.evaluations.length - submitted.length,
      calibratedCriteria,
      avgCalibrationShift: shifts.length ? r1(avg(shifts)!) : null,
      penaltiesCount: input.adjustments.filter(a => a.kind === "penalty").reduce((s, a) => s + a.quantity, 0),
      meritsCount: input.adjustments.filter(a => a.kind === "merit").reduce((s, a) => s + a.quantity, 0),
      minEvents: input.minEvents,
    },
    ruleSet: {
      minEvents: input.minEvents,
      conformityItemPoints: CONFORMITY_ITEM_POINTS,
      conformityPenaltyFactor: CONFORMITY_PENALTY_FACTOR,
      conformityPenaltyPerNo: r2(CONFORMITY_ITEM_POINTS * CONFORMITY_PENALTY_FACTOR),
    },
    scoreTrend,
    criteria,
    conformity,
    faixas,
    funnel,
    nearNextFaixa,
    evaluators,
    adjustments,
    clients,
  };
}
