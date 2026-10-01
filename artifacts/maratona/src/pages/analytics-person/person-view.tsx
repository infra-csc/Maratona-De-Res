import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetScoreTimeline, getGetScoreTimelineQueryKey,
  type EventsReport, type QuarterlyResult, type RankingDetail,
} from "@workspace/api-client-react";
import { ArrowRight, Award, AlertTriangle, CalendarClock, History, Info, ListChecks, Table2, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState, StatTile, StatusBadge } from "@/components/shared";
import { CONDENSED, DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { fmtDate, fmtNum } from "@/lib/utils";
import {
  brl, criteriaCompare, impactOf, mean, n1, nextStepOf, personEvents, plural, pts, rankOf, signed,
  type CriterionCompare, type Faixa, type Impact, type PersonEvent,
} from "./derive";
import { CriteriaDumbbell, EventsChart, EvolutionChart, FaixaRuler, TeamStrip, entryTitle, type ScaleMarker } from "./charts";
import { Card, FaixaChip, SmallLabel } from "./ui";

const dmy = (iso: string | null | undefined) => (iso ? fmtDate(iso.slice(0, 10), { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");

/** Análise detalhada do ciclo de um colaborador. */
export function PersonView({ detail, rows, faixas, minEvents: minEventsOverview, teamEventAvg, report, reportLoading, reportError, onRetryReport, canTimeline, onPick }: {
  detail: RankingDetail; rows: QuarterlyResult[]; faixas: Faixa[];
  /** Mínimo de eventos do bônus pela visão geral; null = não carregou. */
  minEvents: number | null;
  teamEventAvg: number | null; report: EventsReport | undefined; reportLoading: boolean; reportError: boolean; onRetryReport: () => void;
  canTimeline: boolean; onPick: (id: number) => void;
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
  const counted = useMemo(() => events.filter(e => e.counts), [events]);
  const criteria = useMemo(() => criteriaCompare(report, new Set(counted.map(e => e.id))), [report, counted]);
  const rank = rankOf(rows, detail.employee.id);
  const myRow = rows.find(r => r.employeeId === detail.employee.id) ?? null;
  const teamAvg = mean(rows.map(r => r.finalResult));
  // Sem evento com nota não há nota final (o servidor devolve a gravada, que é 0 ou antiga).
  const final = n > 0 ? (s.finalResult ?? null) : null;
  const faixa = impact.faixa ?? faixas.find(f => f.name === s.platoon) ?? null;
  const eligible = bd?.eligible ?? null;
  const step = nextStepOf(final, faixas, eligible, bd?.extraEvents.length ?? 0);
  // Elegibilidade ao bônus é por eventos PARTICIPADOS (com ou sem nota); o mínimo do detalhe vale mais que o da visão geral.
  const minEvents = bd?.minEvents ?? minEventsOverview;
  const participated = s.participatedEventsCount ?? myRow?.participatedEventsCount ?? null;
  // Resultado gravado no ciclo × conta ao vivo do detalhe.
  const storedFinal = myRow?.finalResult ?? null;
  const pendingRecalc = s.isQuarterClosed && final != null && storedFinal != null && Math.abs(storedFinal - final) >= 0.05;
  // Ligação lançamento → evento pelo NOME: /ranking-detail não devolve o eventId das penalidades/méritos.
  const launchesByEvent = useMemo(() => {
    const m = new Map<string, { pen: number; mer: number }>();
    // Pelo id do evento (dois eventos com o mesmo nome não se somam); o nome só
    // como reserva para API antiga.
    const key = (p: { eventId?: number | null; eventName?: string | null }) => (p.eventId != null ? `id:${p.eventId}` : p.eventName ? `nome:${p.eventName}` : null);
    for (const p of detail.penalties) { const k = key(p); if (k) m.set(k, { ...(m.get(k) ?? { pen: 0, mer: 0 }), pen: (m.get(k)?.pen ?? 0) + p.total }); }
    for (const p of detail.merits) { const k = key(p); if (k) m.set(k, { ...(m.get(k) ?? { pen: 0, mer: 0 }), mer: (m.get(k)?.mer ?? 0) + p.total }); }
    return m;
  }, [detail]);

  const markers: ScaleMarker[] = [];
  if (final != null) markers.push({ key: "final", value: final, label: "Nota final", kind: "main" });
  if (final != null && impact.verified && impact.penalty > 0 && impact.finalNoPenalty != null) markers.push({ key: "nopen", value: impact.finalNoPenalty, label: "Sem as penalidades", kind: "ghost" });
  if (teamAvg != null && rows.length > 1) markers.push({ key: "team", value: teamAvg, label: "Média da equipe", kind: "team" });

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
              {!s.isQuarterClosed && <StatusBadge variant="info" icon={Info} label="Sem resultado gravado" srLabel="Sem resultado gravado no ciclo para este colaborador: a nota é a conta de hoje; elegibilidade e bônus aparecem depois do recálculo" />}
              {pendingRecalc && <StatusBadge variant="info" icon={Info} label="Recálculo pendente" srLabel={`Recálculo pendente: a nota de hoje (${n1(final)}) difere da gravada no último recálculo do ciclo (${n1(storedFinal)}), que é a usada no ranking e no bônus`} />}
            </div>
            {pendingRecalc && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--muted-foreground)" }}>
                A nota de hoje ({n1(final)}) difere da gravada no último recálculo do ciclo ({n1(storedFinal)}); ranking e bônus usam a gravada até o ciclo ser recalculado em Resultados.
              </p>
            )}
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
              {final == null ? <>Sem evento com nota no ciclo</> : <>
                Média bruta <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(s.grossAverage)}</strong>
                {teamAvg != null && <><br className="hidden md:block" /><span className="md:hidden"> · </span>equipe <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(teamAvg)}</strong> <span className="tabular-nums" style={{ color: final - teamAvg >= 0 ? GOOD_TEXT : DANGER_TEXT }}>({signed(final - teamAvg)})</span></>}
              </>}
            </p>
          </div>
        </div>

        {final != null && faixas.length > 0 && (
          <div className="rounded-lg p-3 sm:p-4" style={{ backgroundColor: "var(--secondary)" }}>
            <FaixaRuler faixas={faixas} markers={markers} extraDomain={step ? [step.entry] : []} />
            <p className="mt-3 text-[13px] leading-relaxed" data-testid="person-next-faixa">
              {step ? (
                <>
                  Faltam <strong className="tabular-nums">{n1(step.gap)}</strong> {step.gap === 1 ? "ponto" : "pontos"} para <strong>{step.faixa.name}</strong> (a partir de {n1(step.entry)})
                  {step.faixa.bonusValue > 0 && <>, que {eligible ? <>pagaria <strong>{brl(step.bonus)}</strong> de bônus</> : <>paga <strong>{brl(step.faixa.bonusValue)}</strong> de prêmio base</>}</>}.
                  <span style={{ color: "var(--muted-foreground)" }}> Com {plural(n, "evento", "eventos")} na nota, isso equivale a cerca de {fmtNum(step.gap * n, 1)} pontos a mais na soma das notas (ou de penalidade a menos).</span>
                </>
              ) : <>Está na faixa mais alta.</>}
            </p>
          </div>
        )}
      </section>

      {/* ── Indicadores ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile label="Média bruta" value={n1(s.grossAverage)} detail={s.scoreSum != null ? `Soma ${fmtNum(s.scoreSum, 2)} ÷ ${plural(n, "evento", "eventos")}` : "Sem evento na nota"} />
        <StatTile label="Eventos participados" data-testid="person-participated"
          value={<>{participated ?? "—"}<span className="text-[16px] font-bold" style={{ color: "var(--muted-foreground)" }}> / {minEvents ?? "—"}</span></>}
          detail={`${plural(n, "evento", "eventos")} na nota · ${participated == null || minEvents == null ? "mínimo do bônus indisponível"
            : participated >= minEvents ? "atingiu o mínimo do bônus" : `faltam ${minEvents - participated} para o mínimo do bônus`}`} />
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
        <PenaltyCostCard impact={impact} detail={detail} n={n} />
      </div>

      {/* ── Evento a evento ── */}
      <EventsCard events={events} counted={counted} teamEventAvg={teamEventAvg} faixas={faixas} name={detail.employee.name} launchesByEvent={launchesByEvent} />

      {/* ── Lançamentos + critérios ── */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <LaunchesCard detail={detail} n={n} />
        <Card title="Critérios nos eventos dele" subtitle="Média de cada critério nos eventos confirmados de que participou, comparada com todos os eventos confirmados do ciclo. A nota do critério é do time do evento, não só dele.">
          {reportLoading ? (
            <LoadingState lines={4} label="Carregando os critérios" />
          ) : reportError || !report ? (
            <EmptyState compact icon={AlertTriangle} title="Não foi possível carregar os critérios" description="O relatório por evento não respondeu. Tente de novo em instantes."
              action={<Button variant="outline" size="sm" onClick={onRetryReport}>Tentar de novo</Button>} />
          ) : criteria.length === 0 ? (
            <EmptyState compact icon={ListChecks} title="Sem critérios avaliados" description="Nenhum evento dele com critérios avaliados e resultados confirmados." />
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
        <TeamCompareCard detail={detail} rows={rows} faixas={faixas} teamAvg={teamAvg} onPick={onPick} n={n} final={final} participated={participated} />
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
      {/* Dois blocos que não quebram por dentro: "(soma − pen. + mér.)" e "÷ N = nota". Em tela estreita, o segundo desce inteiro. */}
      <div className="flex flex-wrap xl:flex-nowrap items-stretch gap-x-1.5 gap-y-2" role="group" aria-label={`Conta: (${fmtNum(s.scoreSum, 2)} − ${pts(s.penaltyPoints)} + ${pts(s.meritPoints)}) ÷ ${n} = ${n1(s.finalResult)}`}>
        <div className="flex flex-nowrap items-stretch gap-1 min-w-0 flex-[3_1_0%] basis-[300px]">
          <Op paren>(</Op>
          <Term value={fmtNum(s.scoreSum, 2)} label={`Soma · ${plural(n, "evento", "eventos")}`} grow />
          <Op>−</Op>
          <Term value={pts(s.penaltyPoints)} label="Penalidades" color={s.penaltyPoints > 0 ? DANGER_TEXT : undefined} />
          <Op>+</Op>
          <Term value={pts(s.meritPoints)} label="Méritos" color={s.meritPoints > 0 ? GOOD_TEXT : undefined} />
          <Op paren>)</Op>
        </div>
        <div className="flex flex-nowrap items-stretch gap-1 min-w-0 flex-[2_1_0%] basis-[200px]">
          <Op>÷</Op>
          <Term value={String(n)} label="Eventos" />
          <Op>=</Op>
          <Term value={n1(s.finalResult)} label="Nota final" strong />
        </div>
      </div>
      <div className="rounded-lg px-3.5 py-3 text-[13px] leading-relaxed" style={{ backgroundColor: "var(--secondary)" }}>
        <p>
          <span className="whitespace-nowrap">({fmtNum(s.scoreSum, 2)} − {pts(s.penaltyPoints)} + {pts(s.meritPoints)})</span>{" "}
          <span className="whitespace-nowrap">÷ {n} = {fmtNum(net, 2)} ÷ {n}</span>{" "}
          <span className="whitespace-nowrap">= <strong className="tabular-nums">{fmtNum(raw, 2)}</strong>,</span> arredondado para <strong className="tabular-nums">{n1(s.finalResult)}</strong>.
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

function Term({ value, label, color, strong, grow }: { value: string; label: string; color?: string; strong?: boolean; grow?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-2 min-w-0 ${grow ? "flex-[1.6_1_0%]" : "flex-1"}`} style={{ backgroundColor: strong ? "var(--primary)" : "var(--card)", border: `1px solid ${strong ? "var(--primary)" : "var(--border)"}`, color: strong ? "var(--primary-foreground)" : undefined }}>
      <p className="text-[22px] font-black leading-none tabular-nums whitespace-nowrap" style={{ fontFamily: CONDENSED, color: strong ? undefined : color }}>{value}</p>
      <p className="mt-1 text-[10.5px] font-bold uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.05em", color: strong ? undefined : "var(--muted-foreground)", opacity: strong ? 0.85 : 1 }}>{label}</p>
    </div>
  );
}
const Op = ({ children, paren }: { children: string; paren?: boolean }) => (
  <span aria-hidden className={`self-center shrink-0 ${paren ? "text-[34px] font-light leading-none -mt-1" : "text-[20px] font-black px-0.5"}`} style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{children}</span>
);

// ── O que as penalidades custaram ─────────────────────────────────────────
function PenaltyCostCard({ impact, detail, n }: { impact: Impact; detail: RankingDetail; n: number }) {
  const bd = detail.summary.bonusBreakdown;
  if (n === 0) {
    // Sem evento com nota não há nota para comparar: nada de "com × sem" nem de "recalcule".
    return (
      <Card title="O que as penalidades custaram">
        <EmptyState compact icon={CalendarClock} title="Sem nota para comparar"
          description={impact.penalty > 0
            ? `Há −${pts(impact.penalty)} pontos de penalidade lançados. O efeito na nota aparece quando um evento dele tiver os resultados confirmados.`
            : "O efeito de penalidades e méritos aparece quando um evento dele tiver os resultados confirmados."} />
      </Card>
    );
  }
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
  const lowest = counted.length > 1 ? counted.reduce((m, e) => (e.score < m.score ? e : m)) : null;
  // Notas todas iguais: um destaque só (não o mesmo evento como "melhor" e "mais fraco").
  const worst = best && lowest && lowest.score < best.score ? lowest : null;
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
              {best && (worst
                ? <Highlight label="Melhor evento" value={n1(best.score)} detail={`${best.name} · ${dmy(best.date)}`} color={GOOD_TEXT} />
                : counted.length === 1
                  ? <Highlight label="Único evento na nota" value={n1(best.score)} detail={`${best.name} · ${dmy(best.date)}`} />
                  : <Highlight label="Mesma nota em todos" value={n1(best.score)} detail={`Os ${counted.length} eventos na nota tiveram ${n1(best.score)}`} />)}
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
            const l = launchesByEvent.get(`id:${e.id}`) ?? launchesByEvent.get(`nome:${e.name}`);
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
/** Diferença que conta como "acima/abaixo do ciclo" (a mesma do ▲/▼ do gráfico; menos que isso aparece como ±0,0). */
const DIFF_MIN = 0.05;

function CriteriaHighlights({ rows }: { rows: CriterionCompare[] }) {
  const byDiff = [...rows].sort((a, b) => b.diff - a.diff);
  const byMine = [...rows].sort((a, b) => b.mine - a.mine);
  // "Ponto mais forte" só se estiver ACIMA do ciclo; "a melhorar" só se ABAIXO. Senão, rótulo neutro pela média dele.
  const top = byDiff[0]?.diff >= DIFF_MIN
    ? { row: byDiff[0], label: "Ponto mais forte" }
    : byMine[0] ? { row: byMine[0], label: "Critério com maior média" } : null;
  const lastDiff = byDiff[byDiff.length - 1];
  const bottomCandidate = lastDiff && lastDiff.diff <= -DIFF_MIN
    ? { row: lastDiff, label: "Ponto a melhorar" }
    : byMine.length > 1 ? { row: byMine[byMine.length - 1], label: "Critério com menor média" } : null;
  const bottom = bottomCandidate && bottomCandidate.row.key !== top?.row.key ? bottomCandidate : null;
  const items = [top, bottom].filter((x): x is { row: CriterionCompare; label: string } => x != null);
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[13px]" aria-label="Destaques dos critérios">
      {items.map(({ row: r, label }) => {
        const up = r.diff >= DIFF_MIN, down = r.diff <= -DIFF_MIN;
        return (
          <li key={label} className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
            <SmallLabel>{label}</SmallLabel>
            <p className="mt-1 font-semibold leading-snug">{r.name}{r.area ? <span style={{ color: "var(--muted-foreground)" }}> · {r.area}</span> : null}</p>
            <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: "var(--muted-foreground)" }}>
              {n1(r.mine)} · <strong style={{ color: up ? GOOD_TEXT : down ? DANGER_TEXT : "var(--muted-foreground)" }}>{up ? "▲" : down ? "▼" : "="} {signed(r.diff)}</strong> do ciclo
            </p>
          </li>
        );
      })}
    </ul>
  );
}

// ── Na equipe ─────────────────────────────────────────────────────────────
function TeamCompareCard({ detail, rows, faixas, teamAvg, onPick, n, final, participated }: {
  detail: RankingDetail; rows: QuarterlyResult[]; faixas: Faixa[]; teamAvg: number | null; onPick: (id: number) => void; n: number;
  final: number | null; participated: number | null;
}) {
  const s = detail.summary;
  const avg = (f: (r: QuarterlyResult) => number) => mean(rows.map(f));
  const lines: { label: string; me: number | null; team: number | null; fmt: (v: number) => string; higherIsBetter: boolean }[] = [
    { label: "Nota final", me: final, team: teamAvg, fmt: n1, higherIsBetter: true },
    { label: "Média bruta", me: n > 0 ? (s.grossAverage ?? null) : null, team: avg(r => r.grossAverage ?? 0), fmt: n1, higherIsBetter: true },
    { label: "Eventos participados", me: participated, team: avg(r => r.participatedEventsCount ?? 0), fmt: v => fmtNum(v, Number.isInteger(v) ? 0 : 1), higherIsBetter: true },
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
