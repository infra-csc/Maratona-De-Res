import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetScoreTimeline, getGetScoreTimelineQueryKey,
  type EventsReport, type QuarterlyResult, type RankingDetail,
} from "@workspace/api-client-react";
import { ArrowRight, Award, AlertTriangle, CalendarClock, History, Info, ListChecks, Table2, TrendingUp, Trophy } from "lucide-react";
import { EmptyState, LoadingState, StatTile, StatusBadge } from "@/components/shared";
import { CONDENSED, DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { fmtDate, fmtNum } from "@/lib/utils";
import {
  bonusOf, brl, criteriaCompare, impactOf, mean, n1, nextFaixaOf, personEvents, plural, pts, rankOf, signed,
  type Faixa, type Impact, type PersonEvent,
} from "./derive";
import { CriteriaDumbbell, EventsChart, EvolutionChart, FaixaRuler, TeamStrip, entryTitle, type ScaleMarker } from "./charts";
import { Card, FaixaChip, SmallLabel } from "./ui";

const dmy = (iso: string | null | undefined) => (iso ? fmtDate(iso.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

/** Análise detalhada do ciclo de um colaborador. */
export function PersonView({ detail, rows, faixas, minEvents, teamEventAvg, report, canTimeline, onPick }: {
  detail: RankingDetail; rows: QuarterlyResult[]; faixas: Faixa[]; minEvents: number;
  teamEventAvg: number | null; report: EventsReport | undefined; canTimeline: boolean; onPick: (id: number) => void;
}) {
  const s = detail.summary;
  const bd = s.bonusBreakdown;
  const n = s.confirmedEventCount ?? 0;
  const impact = useMemo(() => impactOf({
    scoreSum: s.scoreSum, n, penalty: s.penaltyPoints, merit: s.meritPoints, reportedFinal: s.finalResult,
    eligible: bd ? (bd.eligible ?? null) : null, extras: bd ? bd.extraEvents.length : null,
    reportedBonus: bd ? bd.totalValue : null, faixas,
  }), [s, n, bd, faixas]);

  const events = useMemo(() => personEvents(detail, report), [detail, report]);
  const counted = events.filter(e => e.counts);
  const criteria = useMemo(() => criteriaCompare(report, new Set(counted.map(e => e.id))), [report, counted]);
  const rank = rankOf(rows, detail.employee.id);
  const teamAvg = mean(rows.map(r => r.finalResult));
  const final = s.finalResult ?? null;
  const faixa = impact.faixa ?? faixas.find(f => f.name === s.platoon) ?? null;
  const next = nextFaixaOf(final, faixas);
  const gap = final != null && next ? Math.max(0, next.minScore - final) : null;
  const eligible = bd?.eligible ?? null;
  const launchesByEvent = useMemo(() => {
    const m = new Map<string, { pen: number; mer: number }>();
    for (const p of detail.penalties) if (p.eventName) m.set(p.eventName, { ...(m.get(p.eventName) ?? { pen: 0, mer: 0 }), pen: (m.get(p.eventName)?.pen ?? 0) + p.total });
    for (const p of detail.merits) if (p.eventName) m.set(p.eventName, { ...(m.get(p.eventName) ?? { pen: 0, mer: 0 }), mer: (m.get(p.eventName)?.mer ?? 0) + p.total });
    return m;
  }, [detail]);

  const markers: ScaleMarker[] = [];
  if (final != null) markers.push({ key: "final", value: final, label: "Nota final", kind: "main" });
  if (impact.verified && impact.penalty > 0 && impact.finalNoPenalty != null) markers.push({ key: "nopen", value: impact.finalNoPenalty, label: "Sem as penalidades", kind: "ghost" });
  if (teamAvg != null && rows.length > 1) markers.push({ key: "team", value: teamAvg, label: "Média da equipe", kind: "team" });

  const nextBonus = next ? (eligible ? bonusOf(next.minScore, bd?.extraEvents.length ?? 0, faixas) : next.bonusValue) : 0;

  return (
    <div className="space-y-5" data-testid="person-analysis">
      {/* ── Identidade + nota + régua ── */}
      <section className="rounded-xl p-4 sm:p-6 flex flex-col gap-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} aria-label="Resumo do colaborador">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <SmallLabel>{[detail.employee.functionName, detail.employee.department].filter(Boolean).join(" · ") || "Colaborador"}</SmallLabel>
            <h2 className="mt-1 text-[30px] sm:text-[38px] font-black uppercase leading-[0.95]" style={{ fontFamily: CONDENSED, letterSpacing: "-0.01em" }} data-testid="text-person-name">
              {detail.employee.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <FaixaChip size="lg" name={faixa?.name ?? s.platoon} color={faixa?.color ?? s.platoonColor} />
              {rank && <StatusBadge variant="neutral" icon={Trophy} label={`${rank.position}º de ${rank.total} no ranking`} />}
              {eligible === true && <StatusBadge variant="ok" label="Elegível ao bônus" />}
              {eligible === false && <StatusBadge variant="warn" label="Não elegível ao bônus" />}
              {!s.isQuarterClosed && <StatusBadge variant="info" icon={Info} label="Valores parciais" srLabel="Ciclo ainda não recalculado para este colaborador: valores parciais" />}
            </div>
            {eligible === false && bd?.eligibilityReason && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>{bd.eligibilityReason}.</p>
            )}
          </div>
          <div className="flex items-end gap-6 md:text-right md:flex-col md:items-end md:gap-1 shrink-0">
            <div>
              <SmallLabel>Nota final</SmallLabel>
              <p className="text-[64px] sm:text-[76px] font-black leading-[0.85] tabular-nums" style={{ fontFamily: CONDENSED }} data-testid="person-final">{n1(final)}</p>
            </div>
            <p className="text-[13px] pb-1 md:pb-0" style={{ color: "var(--muted-foreground)" }}>
              Média bruta <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(s.grossAverage)}</strong>
              {teamAvg != null && final != null && <><br className="hidden md:block" /><span className="md:hidden"> · </span>equipe <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(teamAvg)}</strong> <span className="tabular-nums" style={{ color: final - teamAvg >= 0 ? GOOD_TEXT : DANGER_TEXT }}>({signed(final - teamAvg)})</span></>}
            </p>
          </div>
        </div>

        {final != null && faixas.length > 0 && (
          <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: "var(--secondary)" }}>
            <FaixaRuler faixas={faixas} markers={markers} extraDomain={next ? [next.minScore] : []} />
            <p className="mt-3 text-[13px] leading-relaxed" data-testid="person-next-faixa">
              {next && gap != null ? (
                <>
                  Faltam <strong className="tabular-nums">{n1(gap)}</strong> {gap === 1 ? "ponto" : "pontos"} para <strong>{next.name}</strong> ({n1(next.minScore)})
                  {next.bonusValue > 0 && <>, que {eligible ? <>pagaria <strong>{brl(nextBonus)}</strong> de bônus</> : <>paga <strong>{brl(next.bonusValue)}</strong> de prêmio base</>}</>}.
                  {n > 0 && <span style={{ color: "var(--muted-foreground)" }}> Com {plural(n, "evento", "eventos")} na nota, isso equivale a cerca de {fmtNum(gap * n, 1)} pontos a mais na soma das notas (ou de penalidade a menos).</span>}
                </>
              ) : <>Está na faixa mais alta.</>}
            </p>
          </div>
        )}
      </section>

      {/* ── Indicadores ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile label="Média bruta" value={n1(s.grossAverage)} detail={s.scoreSum != null ? `Soma ${fmtNum(s.scoreSum, 2)} ÷ ${plural(n, "evento", "eventos")}` : "Sem evento na nota"} />
        <StatTile label="Eventos na nota" value={<>{n}<span className="text-[16px] font-bold" style={{ color: "var(--muted-foreground)" }}> / {minEvents}</span></>}
          detail={n >= minEvents ? "Atingiu o mínimo do bônus" : `Faltam ${minEvents - n} para o mínimo do bônus`} />
        <StatTile label="Penalidades" value={<span style={{ color: s.penaltyPoints > 0 ? DANGER_TEXT : undefined }}>{s.penaltyPoints > 0 ? `−${pts(s.penaltyPoints)}` : "0"}</span>}
          detail={s.penaltyPoints > 0 ? (impact.verified ? `${signed(-impact.lostPoints)} na nota final` : plural(detail.penalties.length, "lançamento", "lançamentos")) : "Nenhuma no ciclo"} />
        <StatTile label="Méritos" value={<span style={{ color: s.meritPoints > 0 ? GOOD_TEXT : undefined }}>{s.meritPoints > 0 ? `+${pts(s.meritPoints)}` : "0"}</span>}
          detail={s.meritPoints > 0 ? (impact.verified ? `${signed(impact.gainedPoints)} na nota final` : plural(detail.merits.length, "lançamento", "lançamentos")) : "Nenhum no ciclo"} />
        <StatTile label="Bônus do ciclo" value={bd ? brl(bd.totalValue) : brl(s.bonusValue ?? null)}
          detail={bd ? (bd.applied ? `${brl(bd.baseValue)} base + ${brl(bd.extraValue)} extra` : eligible === false ? "Não elegível" : "Faixa sem bônus") : undefined} />
        <StatTile label="Posição" value={rank ? `${rank.position}º` : "—"} detail={rank ? `de ${rank.total} no ranking` : "Fora do ranking do ciclo"} />
      </div>

      {/* ── Conta + custo das penalidades ── */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <CalcCard detail={detail} impact={impact} n={n} />
        <PenaltyCostCard impact={impact} detail={detail} eligible={eligible} />
      </div>

      {/* ── Evento a evento ── */}
      <EventsCard events={events} counted={counted} teamEventAvg={teamEventAvg} faixas={faixas} name={detail.employee.name} launchesByEvent={launchesByEvent} />

      {/* ── Lançamentos + critérios ── */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <LaunchesCard detail={detail} n={n} />
        <Card title="Critérios nos eventos dele" subtitle="Média de cada critério nos eventos confirmados de que participou, comparada com todos os eventos confirmados do ciclo. A nota do critério é do time do evento, não só dele.">
          {criteria.length === 0 ? (
            <EmptyState compact icon={ListChecks} title="Sem critérios avaliados" description={report ? "Nenhum evento dele com critérios avaliados e resultados confirmados." : "Não foi possível carregar o relatório por evento."} />
          ) : (
            <>
              <CriteriaHighlights rows={criteria} />
              <CriteriaDumbbell rows={criteria} />
            </>
          )}
        </Card>
      </div>

      {/* ── Equipe + evolução ── */}
      <div className={`grid gap-5 items-start ${canTimeline ? "xl:grid-cols-2" : ""}`}>
        <TeamCompareCard detail={detail} rows={rows} faixas={faixas} teamAvg={teamAvg} onPick={onPick} n={n} />
        {canTimeline && <EvolutionCard employeeId={detail.employee.id} name={detail.employee.name} final={final} faixas={faixas} />}
      </div>
    </div>
  );
}

// ── Como a nota foi calculada ─────────────────────────────────────────────
function CalcCard({ detail, impact, n }: { detail: RankingDetail; impact: Impact; n: number }) {
  const s = detail.summary;
  if (s.scoreSum == null || n === 0) {
    return (
      <Card title="Como a nota foi calculada">
        <EmptyState compact icon={CalendarClock} title="Ainda sem nota no ciclo" description="A nota aparece quando um evento dele tiver os resultados confirmados." />
      </Card>
    );
  }
  const net = s.scoreSum - s.penaltyPoints + s.meritPoints;
  const raw = net / n;
  return (
    <Card title="Como a nota foi calculada" subtitle="(Soma das notas dos eventos − penalidades + méritos) ÷ número de eventos, arredondada uma vez para 1 casa.">
      <div className="flex flex-wrap sm:flex-nowrap items-stretch gap-1.5" role="group" aria-label={`Conta: (${fmtNum(s.scoreSum, 2)} − ${pts(s.penaltyPoints)} + ${pts(s.meritPoints)}) ÷ ${n} = ${n1(s.finalResult)}`}>
        <Term value={fmtNum(s.scoreSum, 2)} label={`Soma · ${plural(n, "evento", "eventos")}`} />
        <Op>−</Op>
        <Term value={pts(s.penaltyPoints)} label="Penalidades" color={s.penaltyPoints > 0 ? DANGER_TEXT : undefined} />
        <Op>+</Op>
        <Term value={pts(s.meritPoints)} label="Méritos" color={s.meritPoints > 0 ? GOOD_TEXT : undefined} />
        <Op>÷</Op>
        <Term value={String(n)} label="Eventos" />
        <Op>=</Op>
        <Term value={n1(s.finalResult)} label="Nota final" strong />
      </div>
      <div className="rounded-lg px-3.5 py-3 text-[13px] leading-relaxed" style={{ backgroundColor: "var(--secondary)" }}>
        <p>
          {fmtNum(net, 2)} ÷ {n} = <strong className="tabular-nums">{fmtNum(raw, 2)}</strong>, arredondado para <strong className="tabular-nums">{n1(s.finalResult)}</strong>.
        </p>
        {impact.verified && (impact.penalty > 0 || impact.merit > 0) && (
          <p className="mt-1.5" style={{ color: "var(--muted-foreground)" }}>
            Na média: <strong style={{ color: "var(--foreground)" }}>{n1(s.grossAverage)}</strong> de média bruta
            {impact.penalty > 0 && <>, <strong style={{ color: DANGER_TEXT }}>▼ {fmtNum(impact.penalty / n, 2)}</strong> das penalidades</>}
            {impact.merit > 0 && <>, <strong style={{ color: GOOD_TEXT }}>▲ {fmtNum(impact.merit / n, 2)}</strong> dos méritos</>}
            {" "}= <strong style={{ color: "var(--foreground)" }}>{n1(s.finalResult)}</strong>. Cada ponto lançado vale 1/{n} de ponto na nota.
          </p>
        )}
        {!impact.verified && s.finalResult != null && (
          <p className="mt-1.5" style={{ color: "var(--muted-foreground)" }}>A conta refeita aqui não bate com a nota informada; confira o recálculo do ciclo em Resultados.</p>
        )}
      </div>
    </Card>
  );
}

function Term({ value, label, color, strong }: { value: string; label: string; color?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg px-2.5 py-2 min-w-[64px] flex-1 sm:min-w-0" style={{ backgroundColor: strong ? "var(--primary)" : "var(--card)", border: `1px solid ${strong ? "var(--primary)" : "var(--border)"}`, color: strong ? "var(--primary-foreground)" : undefined }}>
      <p className="text-[22px] font-black leading-none tabular-nums whitespace-nowrap" style={{ fontFamily: CONDENSED, color: strong ? undefined : color }}>{value}</p>
      <p className="mt-1 text-[10.5px] font-bold uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.05em", color: strong ? undefined : "var(--muted-foreground)", opacity: strong ? 0.85 : 1 }}>{label}</p>
    </div>
  );
}
const Op = ({ children }: { children: string }) => (
  <span aria-hidden className="self-center text-[22px] font-black px-0.5" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{children}</span>
);

// ── O que as penalidades custaram ─────────────────────────────────────────
function PenaltyCostCard({ impact, detail, eligible }: { impact: Impact; detail: RankingDetail; eligible: boolean | null }) {
  const bd = detail.summary.bonusBreakdown;
  if (impact.penalty <= 0) {
    return (
      <Card title="O que as penalidades custaram">
        <div className="flex items-center gap-4 rounded-lg p-4" style={{ backgroundColor: "var(--status-ok-bg)" }}>
          <Award size={28} aria-hidden style={{ color: GOOD_TEXT }} className="shrink-0" />
          <div>
            <p className="font-black uppercase text-[17px] leading-tight" style={{ fontFamily: CONDENSED }}>Nenhuma penalidade no ciclo</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {impact.merit > 0 && impact.verified
                ? <>A nota final só ganhou: os méritos somaram <strong style={{ color: GOOD_TEXT }}>{signed(impact.gainedPoints)}</strong> à média bruta.</>
                : "A nota final é a própria média bruta dos eventos."}
            </p>
          </div>
        </div>
      </Card>
    );
  }
  if (!impact.verified) {
    return (
      <Card title="O que as penalidades custaram">
        <p className="text-[13px]">Foram <strong style={{ color: DANGER_TEXT }}>−{pts(impact.penalty)} pontos</strong> lançados. A conta refeita aqui não bate com a nota informada, então a comparação com e sem penalidades não é mostrada; recalcule o ciclo em Resultados.</p>
      </Card>
    );
  }
  const changed = impact.faixa?.name !== impact.faixaNoPenalty?.name;
  const b = impact.bonus;
  return (
    <Card title="O que as penalidades custaram" subtitle={`−${pts(impact.penalty)} pontos lançados em ${plural(detail.penalties.length, "penalidade", "penalidades")}, comparados com a mesma nota sem elas (méritos mantidos).`}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-3.5" style={{ backgroundColor: "var(--status-danger-bg)" }}>
          <SmallLabel>Na nota final</SmallLabel>
          <p className="mt-1 text-[38px] font-black leading-none tabular-nums" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }} data-testid="person-lost-points">{signed(-impact.lostPoints)}</p>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>{n1(impact.final)} hoje · {n1(impact.finalNoPenalty)} sem elas</p>
        </div>
        <div className="rounded-lg p-3.5" style={{ backgroundColor: b && b.lost > 0 ? "var(--status-danger-bg)" : "var(--secondary)" }}>
          <SmallLabel>No bônus</SmallLabel>
          <p className="mt-1 text-[38px] font-black leading-none tabular-nums" style={{ fontFamily: CONDENSED, color: b && b.lost > 0 ? DANGER_TEXT : undefined }} data-testid="person-lost-bonus">
            {b ? (b.lost > 0 ? `−${brl(b.lost)}` : brl(0)) : "—"}
          </p>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
            {b ? `${brl(b.now)} hoje · ${brl(b.noPenalty)} sem elas` : "Não dá para calcular com segurança"}
          </p>
        </div>
      </div>
      <ul className="space-y-2.5 text-[13px]">
        <li className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Faixa:</span>
          <FaixaChip size="sm" name={impact.faixa?.name} color={impact.faixa?.color} />
          <ArrowRight size={14} aria-hidden style={{ color: "var(--muted-foreground)" }} />
          <span className="sr-only">sem as penalidades seria</span>
          <FaixaChip size="sm" name={impact.faixaNoPenalty?.name} color={impact.faixaNoPenalty?.color} />
          {changed
            ? <StatusBadge size="sm" variant="danger" label="Perdeu a faixa" />
            : <span style={{ color: "var(--muted-foreground)" }}>continuaria na mesma faixa</span>}
        </li>
        <li style={{ color: "var(--muted-foreground)" }}>
          {b == null
            ? (bd && Math.abs((bd.storedTotal ?? bd.totalValue) - bd.totalValue) > 0.01
              ? "O bônus gravado está diferente da conta de hoje: recalcule o ciclo em Resultados para comparar."
              : "O bônus gravado não bate com a nota de hoje (ciclo a recalcular); por isso a diferença em reais não é mostrada.")
            : !b.eligible
              ? <>Não elegível ao bônus: R$ 0 com ou sem penalidades{changed && impact.faixaNoPenalty && impact.faixaNoPenalty.bonusValue > 0 ? <>. A faixa {impact.faixaNoPenalty.name} paga {brl(impact.faixaNoPenalty.bonusValue)} de prêmio base a quem é elegível.</> : "."}</>
              : b.lost > 0
                ? <>As penalidades tiraram <strong style={{ color: DANGER_TEXT }}>{brl(b.lost)}</strong> do bônus ({plural(b.extras, "evento extra", "eventos extras")} contados nos dois casos).</>
                : "O bônus é o mesmo com ou sem as penalidades."}
        </li>
        {impact.merit > 0 && (
          <li style={{ color: "var(--muted-foreground)" }}>
            Sem nenhum lançamento (nem penalidades, nem méritos), a nota seria <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(impact.finalClean)}</strong>.
          </li>
        )}
      </ul>
    </Card>
  );
}

// ── Evento a evento ───────────────────────────────────────────────────────
function EventsCard({ events, counted, teamEventAvg, faixas, name, launchesByEvent }: {
  events: PersonEvent[]; counted: PersonEvent[]; teamEventAvg: number | null; faixas: Faixa[]; name: string;
  launchesByEvent: Map<string, { pen: number; mer: number }>;
}) {
  const [showTable, setShowTable] = useState(false);
  const outside = events.filter(e => !e.counts);
  const best = counted.length ? counted.reduce((m, e) => (e.score > m.score ? e : m)) : null;
  const worst = counted.length > 1 ? counted.reduce((m, e) => (e.score < m.score ? e : m)) : null;
  const aboveAvg = teamEventAvg != null ? counted.filter(e => e.score >= teamEventAvg).length : null;
  return (
    <Card
      title="Nota evento a evento"
      subtitle="Nota oficial de cada evento confirmado que entrou na nota dele, em ordem de data, e como a média foi se formando."
      action={events.length > 0 ? (
        <button type="button" onClick={() => setShowTable(v => !v)} aria-pressed={showTable}
          className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", fontFamily: CONDENSED }}>
          <Table2 size={13} aria-hidden /> {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      ) : undefined}
    >
      {events.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="Nenhum evento no ciclo" description="Ele ainda não participou de eventos neste ciclo." />
      ) : (
        <>
          {counted.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[13px]" aria-label="Destaques dos eventos">
              {best && <Highlight label="Melhor evento" value={n1(best.score)} detail={`${best.name} · ${dmy(best.date)}`} color={GOOD_TEXT} />}
              {worst && <Highlight label="Evento mais fraco" value={n1(worst.score)} detail={`${worst.name} · ${dmy(worst.date)}`} color={DANGER_TEXT} />}
              {aboveAvg != null && teamEventAvg != null && <Highlight label="Acima da média do ciclo" value={`${aboveAvg} de ${counted.length}`} detail={`Média dos eventos do ciclo: ${n1(teamEventAvg)}`} />}
            </ul>
          )}
          {showTable || counted.length === 0 ? (
            <EventsTable events={events} launchesByEvent={launchesByEvent} />
          ) : (
            <EventsChart events={counted} teamAvg={teamEventAvg} faixas={faixas} name={name} />
          )}
          {!showTable && outside.length > 0 && counted.length > 0 && (
            <div className="rounded-lg px-3.5 py-3" style={{ backgroundColor: "var(--secondary)" }}>
              <p className="text-[12px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>
                Fora da nota · {outside.length}
              </p>
              <ul className="mt-1.5 space-y-1 text-[13px]">
                {outside.map(e => (
                  <li key={e.id} className="flex flex-wrap gap-x-2">
                    <span className="font-semibold">{e.name}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{dmy(e.date)} · {e.why}{e.hasScore && !e.counts && e.score > 0 ? ` · ${n1(e.score)}` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function Highlight({ label, value, detail, color }: { label: string; value: string; detail: string; color?: string }) {
  return (
    <li className="rounded-lg px-3.5 py-2.5 min-w-0" style={{ backgroundColor: "var(--secondary)" }}>
      <SmallLabel>{label}</SmallLabel>
      <p className="text-[22px] font-black leading-none mt-1 tabular-nums" style={{ fontFamily: CONDENSED, color }}>{value}</p>
      <p className="text-[12px] mt-1 line-clamp-2" title={detail} style={{ color: "var(--muted-foreground)" }}>{detail}</p>
    </li>
  );
}

function EventsTable({ events, launchesByEvent }: { events: PersonEvent[]; launchesByEvent: Map<string, { pen: number; mer: number }> }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[12.5px] min-w-[640px]">
        <thead>
          <tr>
            {["Data", "Evento", "Nota", "Faixa do evento", "Matriz", "Média até aqui", "Situação"].map((h, i) => (
              <th key={h} className={`py-2 px-2 text-[11px] font-bold uppercase whitespace-nowrap ${i >= 2 && i <= 5 && i !== 3 ? "text-right" : "text-left"}`}
                style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(e => {
            const l = launchesByEvent.get(e.name);
            return (
              <tr key={e.id} style={{ opacity: e.counts ? 1 : 0.75 }}>
                <td className="py-2 px-2 tabular-nums whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)" }}>{dmy(e.date)}</td>
                <td className="py-2 px-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="font-semibold">{e.name}</span>
                  <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {[e.place, l?.pen ? `penalidade −${pts(l.pen)}` : null, l?.mer ? `mérito +${pts(l.mer)}` : null].filter(Boolean).join(" · ")}
                  </span>
                </td>
                <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ borderBottom: "1px solid var(--border)" }}>{e.hasScore ? n1(e.score) : "—"}</td>
                <td className="py-2 px-2" style={{ borderBottom: "1px solid var(--border)" }}>{e.faixaName ? <FaixaChip size="sm" name={e.faixaName} color={e.faixaColor} muted /> : "—"}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)", color: e.conformityPenalty ? DANGER_TEXT : "var(--muted-foreground)" }}>{e.conformityPenalty ? `−${n1(e.conformityPenalty)}` : "—"}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{n1(e.runningAvg)}</td>
                <td className="py-2 px-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  {e.counts ? <StatusBadge size="sm" variant="ok" label="Na nota" /> : (
                    <span className="flex flex-col items-start gap-0.5">
                      <StatusBadge size="sm" variant="neutral" label="Fora da nota" />
                      <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{e.why}</span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>“Matriz”: pontos que a matriz de conformidade tirou da nota do evento (já descontados na nota).</p>
    </div>
  );
}

// ── Penalidades e méritos ─────────────────────────────────────────────────
function LaunchesCard({ detail, n }: { detail: RankingDetail; n: number }) {
  const items = [
    ...detail.penalties.map(p => ({ ...p, kind: "penalty" as const })),
    ...detail.merits.map(m => ({ ...m, kind: "merit" as const })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const pen = detail.summary.penaltyPoints, mer = detail.summary.meritPoints;
  return (
    <Card title="Penalidades e méritos" subtitle={n > 0 ? `Cada lançamento, do mais recente ao mais antigo. Na nota final, cada ponto vale 1/${n} (dividido pelos ${plural(n, "evento", "eventos")} na nota).` : "Cada lançamento do ciclo, do mais recente ao mais antigo."}>
      {items.length === 0 ? (
        <EmptyState compact icon={Award} title="Nenhum lançamento no ciclo" description="Sem penalidades nem méritos: a nota final é a média dos eventos." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--status-danger-bg)" }}>
              <SmallLabel>Penalidades · {detail.penalties.length}</SmallLabel>
              <p className="text-[24px] font-black leading-none mt-1 tabular-nums" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>{pen > 0 ? `−${pts(pen)}` : "0"} <span className="text-[13px]">pts</span></p>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--status-ok-bg)" }}>
              <SmallLabel>Méritos · {detail.merits.length}</SmallLabel>
              <p className="text-[24px] font-black leading-none mt-1 tabular-nums" style={{ fontFamily: CONDENSED, color: GOOD_TEXT }}>{mer > 0 ? `+${pts(mer)}` : "0"} <span className="text-[13px]">pts</span></p>
            </div>
          </div>
          <ol className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {items.map((it, i) => {
              const isPen = it.kind === "penalty";
              return (
                <li key={`${it.kind}-${it.id}`} className="flex items-start gap-3 px-3.5 py-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }} data-testid={`launch-${it.kind}-${it.id}`}>
                  <span aria-hidden className="mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: isPen ? "var(--status-danger-bg)" : "var(--status-ok-bg)", color: isPen ? DANGER_TEXT : GOOD_TEXT }}>
                    {isPen ? <AlertTriangle size={15} /> : <Award size={15} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge size="sm" variant={isPen ? "danger" : "ok"} label={isPen ? "Penalidade" : "Mérito"} />
                      <span className="font-semibold">{it.label}{it.quantity > 1 ? ` × ${it.quantity}` : ""}</span>
                    </p>
                    <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                      {dmy(it.date)}{it.eventName ? ` · ${it.eventName}` : " · sem evento"}
                    </p>
                    {it.reason && <p className="mt-1 text-[12.5px] leading-snug">“{it.reason}”</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black tabular-nums text-[16px]" style={{ fontFamily: CONDENSED, color: isPen ? DANGER_TEXT : GOOD_TEXT }}>{isPen ? "−" : "+"}{pts(it.total)} pts</p>
                    {n > 0 && <p className="text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{isPen ? "−" : "+"}{fmtNum(it.total / n, 2)} na nota</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}

// ── Critérios: destaques ──────────────────────────────────────────────────
function CriteriaHighlights({ rows }: { rows: ReturnType<typeof criteriaCompare> }) {
  const byDiff = [...rows].sort((a, b) => b.diff - a.diff);
  const strong = byDiff[0];
  const weak = byDiff.length > 1 ? byDiff[byDiff.length - 1] : null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]">
      {strong && (
        <li className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
          <SmallLabel>Ponto mais forte</SmallLabel>
          <p className="mt-1 font-semibold leading-snug">{strong.name}{strong.area ? <span style={{ color: "var(--muted-foreground)" }}> · {strong.area}</span> : null}</p>
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            {n1(strong.mine)} · <strong style={{ color: strong.diff >= 0 ? GOOD_TEXT : DANGER_TEXT }}>{strong.diff >= 0 ? "▲" : "▼"} {signed(strong.diff)}</strong> do ciclo
          </p>
        </li>
      )}
      {weak && (
        <li className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
          <SmallLabel>Ponto a melhorar</SmallLabel>
          <p className="mt-1 font-semibold leading-snug">{weak.name}{weak.area ? <span style={{ color: "var(--muted-foreground)" }}> · {weak.area}</span> : null}</p>
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
            {n1(weak.mine)} · <strong style={{ color: weak.diff >= 0 ? GOOD_TEXT : DANGER_TEXT }}>{weak.diff >= 0 ? "▲" : "▼"} {signed(weak.diff)}</strong> do ciclo
          </p>
        </li>
      )}
    </ul>
  );
}

// ── Na equipe ─────────────────────────────────────────────────────────────
function TeamCompareCard({ detail, rows, faixas, teamAvg, onPick, n }: {
  detail: RankingDetail; rows: QuarterlyResult[]; faixas: Faixa[]; teamAvg: number | null; onPick: (id: number) => void; n: number;
}) {
  const s = detail.summary;
  const avg = (f: (r: QuarterlyResult) => number) => mean(rows.map(f));
  const lines: { label: string; me: number | null; team: number | null; fmt: (v: number) => string; higherIsBetter: boolean }[] = [
    { label: "Nota final", me: s.finalResult ?? null, team: teamAvg, fmt: n1, higherIsBetter: true },
    { label: "Média bruta", me: s.grossAverage ?? null, team: avg(r => r.grossAverage ?? 0), fmt: n1, higherIsBetter: true },
    { label: "Eventos na nota", me: n, team: avg(r => r.eventsCount ?? 0), fmt: v => fmtNum(v, Number.isInteger(v) ? 0 : 1), higherIsBetter: true },
    { label: "Pontos de penalidade", me: s.penaltyPoints, team: avg(r => r.absencePenalty ?? 0), fmt: v => fmtNum(v, Number.isInteger(v) ? 0 : 1), higherIsBetter: false },
    { label: "Pontos de mérito", me: s.meritPoints, team: avg(r => r.meritPoints ?? 0), fmt: v => fmtNum(v, Number.isInteger(v) ? 0 : 1), higherIsBetter: true },
  ];
  return (
    <Card title="Comparação com a equipe" subtitle={rows.length > 0 ? `Onde ele está entre os ${rows.length} colaboradores do ranking (ponto destacado) e como seus números se comparam à média.` : "Ranking do ciclo indisponível."}>
      {rows.length > 1 && (
        <TeamStrip people={rows.map(r => ({ id: r.employeeId, name: r.employeeName, final: r.finalResult, color: r.platoonColor ?? null }))}
          faixas={faixas} highlightId={detail.employee.id} onPick={onPick} teamAvg={teamAvg} />
      )}
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            {["", "Ele", "Média da equipe", "Diferença"].map((h, i) => (
              <th key={i} className={`py-2 px-2 text-[11px] font-bold uppercase ${i === 0 ? "text-left" : "text-right"}`} style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(l => {
            const d = l.me != null && l.team != null ? l.me - l.team : null;
            const good = d != null && Math.abs(d) >= 0.05 && (l.higherIsBetter ? d > 0 : d < 0);
            const bad = d != null && Math.abs(d) >= 0.05 && !good;
            return (
              <tr key={l.label}>
                <td className="py-2 px-2 font-semibold" style={{ borderBottom: "1px solid var(--border)" }}>{l.label}</td>
                <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ borderBottom: "1px solid var(--border)" }}>{l.me == null ? "—" : l.fmt(l.me)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{l.team == null ? "—" : l.fmt(l.team)}</td>
                <td className="py-2 px-2 text-right tabular-nums font-bold whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)", color: good ? GOOD_TEXT : bad ? DANGER_TEXT : "var(--muted-foreground)" }}>
                  {d == null ? "—" : `${good ? "▲" : bad ? "▼" : "="} ${signed(d)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11.5px]" style={{ color: "var(--muted-foreground)" }}>▲ melhor que a média da equipe · ▼ pior (para penalidades, menos é melhor).</p>
    </Card>
  );
}

// ── Evolução (linha do tempo; só admin e RH) ──────────────────────────────
function EvolutionCard({ employeeId, name, final, faixas }: { employeeId: number; name: string; final: number | null; faixas: Faixa[] }) {
  const params = { employeeId };
  const q = useGetScoreTimeline(params, { query: { queryKey: getGetScoreTimelineQueryKey(params), staleTime: 30_000 } });
  const entries = (q.data?.entries ?? []).filter(e => e.kind !== "info" && e.finalAfter != null && (e.employeeId == null || e.employeeId === employeeId));
  const moves = entries
    .map(e => ({ e, d: e.finalBefore != null && e.finalAfter != null ? Math.round((e.finalAfter - e.finalBefore) * 10) / 10 : null }))
    .filter(x => x.d != null && x.d !== 0)
    .sort((a, b) => b.e.at.localeCompare(a.e.at))
    .slice(0, 6);
  return (
    <Card
      title="Evolução da nota final"
      subtitle="A nota depois de cada mudança no ciclo: evento que entrou, penalidade, mérito, publicação de calibração. Linhas pontilhadas: início de cada faixa."
      action={
        <Link href={`/linha-do-tempo?colaborador=${employeeId}`} className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: CONDENSED }} data-testid="link-person-timeline">
          <History size={13} aria-hidden /> Linha do tempo
        </Link>
      }
    >
      {q.isLoading ? <LoadingState lines={4} label="Carregando a evolução" /> : q.isError ? (
        <EmptyState compact icon={TrendingUp} title="Não foi possível carregar a evolução" description="Tente de novo em instantes." />
      ) : entries.length === 0 ? (
        <EmptyState compact icon={TrendingUp} title="Ainda sem mudanças registradas" description="A evolução aparece quando um evento entrar na nota ou houver lançamento." />
      ) : (
        <>
          <EvolutionChart entries={entries} currentFinal={final} faixas={faixas} name={name} />
          {moves.length > 0 && (
            <div>
              <SmallLabel className="mb-1.5">Últimas mudanças</SmallLabel>
              <ol className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {moves.map(({ e, d }, i) => (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" title={entryTitle(e)}>{entryTitle(e)}</p>
                      <p className="text-[11.5px] truncate" style={{ color: "var(--muted-foreground)" }} title={e.eventName ?? undefined}>
                        {fmtDate(e.at.slice(0, 10))}{e.eventName ? ` · ${e.eventName}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0 tabular-nums">
                      <p style={{ color: "var(--muted-foreground)" }}>{n1(e.finalBefore)} → <strong style={{ color: "var(--foreground)" }}>{n1(e.finalAfter)}</strong></p>
                      <p className="text-[11.5px] font-bold" style={{ color: (d ?? 0) > 0 ? GOOD_TEXT : DANGER_TEXT }}>{(d ?? 0) > 0 ? "▲" : "▼"} {signed(d ?? 0)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
