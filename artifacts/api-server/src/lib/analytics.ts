// Agregações da tela de Análises. Função pura: recebe as linhas já lidas do
// banco e devolve os indicadores — testável sem Postgres (analytics.test.ts).
import { getPlatoonByScore, calculateTieredBonus, CONFORMITY_ITEM_POINTS, CONFORMITY_PENALTY_FACTOR, type PlatoonRuleData } from "./calculations.js";
import { totalGeralSummary } from "./total-geral.js";

export interface AnalyticsInput {
  events: { id: number; name: string; clientName: string | null; startDate: string; endDate: string; resultsConfirmed: boolean; isHistorical: boolean }[];
  /** Nota oficial por evento (employee_event_results.finalEventScore, 0-100). */
  officialScores: { eventId: number; score: number }[];
  /**
   * Um resultado por pessoa NO CICLO. No Total geral vem uma linha por pessoa
   * e por ciclo, cada uma com o mínimo de eventos do próprio ciclo (`minEvents`).
   */
  quarterly: {
    employeeId: number; employeeName: string; finalResult: number; platoon: string | null; bonusValue: number; eligible: boolean; eventsCount: number; participatedEventsCount: number; minEvents?: number;
    /** Ciclo da linha (Total geral: a média é ponderada por pessoa somando os ciclos). */
    cycleId?: number;
    /** Ciclo FECHADO = bônus oficial; aberto = projeção. Ausente = aberto. */
    official?: boolean;
    /** Motivo gravado na apuração quando não elegível (quarterly_results.eligibility_reason). */
    eligibilityReason?: string | null;
  }[];
  rules: PlatoonRuleData[];
  minEvents: number;
  /**
   * "cycle" (padrão) = um ciclo. "all" = Total geral: contagens de pessoas
   * viram participações (pessoa × ciclo) e "perto da próxima faixa" não se
   * aplica (é projeção de um ciclo em andamento).
   */
  scope?: "cycle" | "all";
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
  /**
   * A Conduta está na Matriz de Conformidade dos eventos do recorte? "all" =
   * em todos (padrão); "none" = ciclo(s) sem a Conduta (pergunta some e conta
   * como "sim"); "some" = Total geral misturando ciclos com e sem.
   */
  condutaInMatrix?: "all" | "some" | "none";
  /** Mínimo de eventos de cada ciclo do recorte (no Total geral, vários). */
  minEventsByCycle?: { cycleId: number; cycleName: string; minEvents: number }[];
  adjustments: { employeeId: number; employeeName?: string | null; label: string; kind: "penalty" | "merit"; points: number; quantity: number }[];
}

/** Colaborador no ranking de penalidades ou de méritos do ciclo. */
export interface AdjustedPerson { employeeId: number; name: string; points: number; occurrences: number; types: string[] }

export interface AnalyticsOverview {
  kpis: {
    eventsTotal: number; eventsConfirmed: number; eventsScored: number; avgEventScore: number | null; avgFinalResult: number | null;
    /** Linhas de resultado (no Total geral, participações pessoa × ciclo). */
    collaborators: number; /** Pessoas diferentes (no ciclo, igual a collaborators). */ distinctCollaborators: number; reachedMinEvents: number; eligible: number; withBonus: number; bonusTotal: number;
    /** Bônus de ciclos FECHADOS (oficial) e de ciclos abertos (projeção); bonusTotal = soma dos dois. */
    bonusOfficial: number; bonusProjected: number;
    evaluationsSubmitted: number; evaluationsDraft: number; calibratedCriteria: number; avgCalibrationShift: number | null;
    penaltiesCount: number; meritsCount: number; minEvents: number;
  };
  scoreTrend: { weekStart: string; label: string; avgScore: number; events: number }[];
  criteria: { key: string; name: string; area: string | null; avgScore: number; evaluatorAvg: number | null; calibratedAvg: number | null; calibratedCount: number; eventsCount: number }[];
  conformity: { item: string; label: string; answered: number; nao: number; naoPct: number | null }[];
  faixas: { name: string; color: string | null; minScore: number | null; maxScore: number | null; bonusValue: number | null; bonusPerExtraEvent: number | null; count: number; bonusTotal: number }[];
  /** Parâmetros das regras de negócio em vigor (para o relatório explicar com os números reais). */
  ruleSet: {
    minEvents: number; conformityItemPoints: number; conformityPenaltyFactor: number; conformityPenaltyPerNo: number;
    /** Itens que o avaliador responde na matriz: 4, ou 3 quando a Conduta saiu (ver condutaInMatrix). */
    conformityItemsAsked: number;
    condutaInMatrix: "all" | "some" | "none";
    minEventsByCycle: { cycleId: number; cycleName: string; minEvents: number }[];
  };
  funnel: { stage: string; label: string; count: number }[];
  nearNextFaixa: { employeeId: number; name: string; finalResult: number; currentFaixa: string | null; nextFaixa: string; gap: number; currentBonus: number; potentialBonus: number }[];
  evaluators: { userId: number; name: string; submitted: number; drafts: number; avgGiven: number | null; calibrationBias: number | null; biasSamples: number; avgDaysToSubmit: number | null }[];
  adjustments: { label: string; kind: "penalty" | "merit"; occurrences: number; points: number; employees: number }[];
  /** Quem mais perdeu pontos com penalidades e quem mais ganhou com méritos (até 10 cada). */
  topPenalized: AdjustedPerson[];
  topMerited: AdjustedPerson[];
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

/**
 * "Atingiu o mínimo de eventos" no funil. Elegível ao bônus SEMPRE atingiu
 * (o funil é decrescente: mínimo ≥ elegíveis ≥ com bônus). Ciclo FECHADO vale
 * o resultado GRAVADO na apuração, não a regra de hoje: recusado pelo mínimo
 * ("Participou de X de N eventos exigidos") não atingiu; inelegível por outro
 * motivo (fora do ciclo, Sup Ceno…) conta pelas participações gravadas.
 */
export function reachedMinEvents(
  q: { eligible: boolean; participatedEventsCount: number; minEvents?: number; official?: boolean; eligibilityReason?: string | null },
  defaultMin: number,
): boolean {
  if (q.eligible) return true;
  if (q.official && q.eligibilityReason && /^Participou de \d+ de \d+ eventos/.test(q.eligibilityReason)) return false;
  return q.participatedEventsCount >= (q.minEvents ?? defaultMin);
}

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
  // Critério de TODAS as áreas (catálogo evaluate_all_areas / áreas extras):
  // cópias de peso 0 por área cuja nota entra pela MÉDIA no critério de
  // origem (mergeEventScopedCriteria). Em Análises viram UMA linha, com a
  // média das áreas (ou a calibração do critério, que vale para a nota).
  const isAreaCopy = (ec: { criterionId: number; weight?: number | null }) => {
    const cat = catalogById.get(ec.criterionId);
    return !!cat?.eventScoped && cat.sourceCriterionId != null && (ec.weight ?? 1) <= 0;
  };
  const multiAreaOrigins = new Set<string>();
  for (const ec of input.eventCriteria) {
    if (isAreaCopy(ec)) multiAreaOrigins.add(`${ec.eventId}:${catalogById.get(ec.criterionId)!.sourceCriterionId}`);
  }
  const ALL_AREAS = "Todas as áreas";
  const rootOf = (ec: { eventId: number; criterionId: number; name: string; area: string | null; weight?: number | null }) => {
    const cat = catalogById.get(ec.criterionId);
    const src = cat?.sourceCriterionId != null ? catalogById.get(cat.sourceCriterionId) : undefined;
    const name = baseName(src?.name ?? cat?.name ?? ec.name);
    const area = isAreaCopy(ec) || multiAreaOrigins.has(`${ec.eventId}:${ec.criterionId}`) ? ALL_AREAS : ec.area;
    return { key: `${name.toLocaleLowerCase("pt-BR")}|${(area ?? "").toLocaleLowerCase("pt-BR")}`, name, area, merged: area === ALL_AREAS };
  };
  const perEvent = new Map<string, { rootKey: string; name: string; area: string | null; merged: boolean; used: number[]; evalAvg: number[]; cal: number[] }>();
  const shifts: number[] = [];
  for (const ec of input.eventCriteria) {
    const ev = eventById.get(ec.eventId);
    if (!ev || ev.isHistorical || !ev.resultsConfirmed) continue;
    const k = `${ec.eventId}:${ec.criterionId}`;
    // Mesma regra da nota oficial: entram os ativos e os inativos calibrados;
    // peso 0 não conta na nota do evento, então também não entra na média.
    if (!ec.active && !calByEc.has(k)) continue;
    if ((ec.weight ?? 1) <= 0 && !isAreaCopy(ec)) continue;
    const evalAvg = avg(evalsByEc.get(k) ?? []);
    const cal = calByEc.get(k);
    const used = cal ?? evalAvg;
    if (used == null) continue;
    const root = rootOf(ec);
    const pk = `${ec.eventId}|${root.key}`;
    if (!perEvent.has(pk)) perEvent.set(pk, { rootKey: root.key, name: root.name, area: root.area, merged: root.merged, used: [], evalAvg: [], cal: [] });
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
    // Multiárea: a calibração do critério vale para a nota; sem ela, a média das áreas.
    a.used.push(e.merged && e.cal.length ? avg(e.cal)! : e.merged && e.evalAvg.length ? avg(e.evalAvg)! : avg(e.used)!);
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
  const condutaInMatrix = input.condutaInMatrix ?? "all";
  // Recorte só de ciclos sem a Conduta: o item nem aparece (não é perguntado).
  const conformity = CONFORMITY_ITEMS.filter(({ item }) => !(item === "conduta" && condutaInMatrix === "none")).map(({ item, label }) => {
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
  const isAll = input.scope === "all";
  const reachedMin = input.quarterly.filter(q => reachedMinEvents(q, input.minEvents)).length;
  const eligible = input.quarterly.filter(q => q.eligible).length;
  const withBonus = input.quarterly.filter(q => q.eligible && q.bonusValue > 0).length;
  const funnel = isAll
    ? [
      { stage: "participated", label: "Participações nos ciclos", count: input.quarterly.length },
      { stage: "reachedMin", label: "Atingiram o mínimo do ciclo", count: reachedMin },
      { stage: "eligible", label: "Elegíveis ao bônus", count: eligible },
      { stage: "withBonus", label: "Com bônus", count: withBonus },
    ]
    : [
      { stage: "participated", label: "Participaram no ciclo", count: input.quarterly.length },
      { stage: "reachedMin", label: `Atingiram ${input.minEvents} eventos`, count: reachedMin },
      { stage: "eligible", label: "Elegíveis ao bônus", count: eligible },
      { stage: "withBonus", label: "Com bônus", count: withBonus },
    ];

  // ── Perto da próxima faixa (até 3 pontos) — só num ciclo ──
  const nearNextFaixa = isAll ? [] : input.quarterly
    .filter(q => q.eligible)
    .map(q => {
      const current = getPlatoonByScore(q.finalResult, input.rules);
      const next = rulesAsc.find(r => r.minScore > q.finalResult && r.bonusValue > 0 && (!current || r.minScore > current.minScore));
      if (!next) return null;
      const gap = r2(next.minScore - q.finalResult);
      if (gap <= 0 || gap > 3) return null;
      const extras = Math.max(0, q.eventsCount - (q.minEvents ?? input.minEvents));
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

  // Por pessoa: pontos = pontos × quantidade, somados no ciclo; empate → mais ocorrências.
  const byPerson = (kind: "penalty" | "merit"): AdjustedPerson[] => {
    const acc = new Map<number, { name: string; points: number; occurrences: number; types: Set<string> }>();
    for (const a of input.adjustments) {
      if (a.kind !== kind) continue;
      const p = acc.get(a.employeeId) ?? { name: a.employeeName ?? `Colaborador #${a.employeeId}`, points: 0, occurrences: 0, types: new Set<string>() };
      p.points += a.points * a.quantity;
      p.occurrences += a.quantity;
      p.types.add(a.label);
      acc.set(a.employeeId, p);
    }
    return [...acc.entries()]
      .map(([employeeId, p]) => ({ employeeId, name: p.name, points: r1(p.points), occurrences: p.occurrences, types: [...p.types].sort((x, y) => x.localeCompare(y, "pt-BR")) }))
      .sort((a, b) => b.points - a.points || b.occurrences - a.occurrences || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 10);
  };
  const topPenalized = byPerson("penalty");
  const topMerited = byPerson("merit");

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
  // Média e bônus: a MESMA conta do Total geral de Resultados (lib/total-geral.ts)
  // — no Total geral, média ponderada pelos eventos com nota de cada pessoa.
  const totals = totalGeralSummary(
    input.quarterly.map(q => ({ employeeId: q.employeeId, cycleId: q.cycleId ?? 0, finalResult: q.finalResult, eventsCount: q.eventsCount, eligible: q.eligible, bonusValue: q.bonusValue })),
    () => false,
  );
  const officialRows = input.quarterly.filter(q => q.official === true && q.eligible);
  const bonusOfficial = r2(officialRows.reduce((s, q) => s + q.bonusValue, 0));
  const bonusTotal = r2(input.quarterly.filter(q => q.eligible).reduce((s, q) => s + q.bonusValue, 0));
  const calibratedCriteria = input.calibrations.filter(c => eventById.has(c.eventId)).length;
  return {
    kpis: {
      eventsTotal: input.events.length,
      eventsConfirmed: input.events.filter(e => e.resultsConfirmed).length,
      eventsScored: scoredConfirmed.length,
      avgEventScore: officialConfirmed.length ? r1(avg(officialConfirmed)!) : null,
      // Um ciclo: média das notas finais de quem tem evento com nota (como
      // Resultados). Total geral: Σ(nota × eventos com nota) ÷ Σ(eventos com
      // nota), a mesma conta de GET /ranking/total e do Dashboard
      // (lib/total-geral.ts).
      avgFinalResult: isAll
        ? totals.avgFinalResult
        : (() => { const xs = input.quarterly.filter(q => q.eventsCount > 0).map(q => q.finalResult); return xs.length ? r1(avg(xs)!) : null; })(),
      collaborators: input.quarterly.length,
      distinctCollaborators: new Set(input.quarterly.map(q => q.employeeId)).size,
      reachedMinEvents: reachedMin,
      eligible,
      withBonus,
      bonusTotal,
      bonusOfficial,
      bonusProjected: r2(bonusTotal - bonusOfficial),
      evaluationsSubmitted: submitted.length,
      evaluationsDraft: input.evaluations.length - submitted.length,
      calibratedCriteria,
      avgCalibrationShift: shifts.length ? r1(avg(shifts)!) : null,
      penaltiesCount: input.adjustments.filter(a => a.kind === "penalty").reduce((s, a) => s + a.quantity, 0),
      meritsCount: input.adjustments.filter(a => a.kind === "merit").reduce((s, a) => s + a.quantity, 0),
      minEvents: input.minEvents,
    },
    ruleSet: {
      conformityItemsAsked: condutaInMatrix === "none" ? 3 : 4,
      condutaInMatrix,
      minEventsByCycle: input.minEventsByCycle ?? [],
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
    topPenalized,
    topMerited,
    clients,
  };
}
