// Blocos de qualidade do Painel de gestão: critérios, matriz de conformidade
// e a evolução da nota por fim de semana. Cada um com gráfico e tabela.
import type { AnalyticsOverview } from "@workspace/api-client-react";
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ListChecks, ShieldCheck, TrendingUp } from "lucide-react";
import { displayCriterionName } from "@/lib/criterion-name";
import { fmtNum, plural } from "@/lib/utils";
import { AXIS_TICK, GRID, SERIES, VizTooltipBox } from "../analytics-person/ui";
import { Block, FooterLink, InlineState } from "./block";
import { BarList, DataTable, ReferenceKey, ViewToggle, useView } from "./viz";
import { n1 } from "./indicators";

type D = AnalyticsOverview;

/** Nota média por critério — do mais fraco ao mais forte; multiárea numa linha só ("Todas as áreas"). */
export function CriteriaPanel({ data, readOnly, className }: { data: D; readOnly: boolean; className?: string }) {
  const [view, setView] = useView();
  const ref = data.kpis.avgEventScore ?? null;
  const rows = data.criteria;
  return (
    <Block
      id="criterios"
      testId="analytics-criteria"
      icon={ListChecks}
      className={className}
      title="Nota média por critério"
      sub="Eventos confirmados, do mais fraco ao mais forte (0 a 100). Vale a nota calibrada quando existe; senão, a média dos avaliadores. Critério avaliado por várias áreas aparece uma vez, com a média das áreas."
      legend={rows.length > 0 && ref != null && view === "grafico" ? <ReferenceKey label="Nota média dos eventos" value={n1(ref)} /> : undefined}
      aside={rows.length > 0 ? <ViewToggle value={view} onChange={setView} label="Ver os critérios como" testId="criteria-view" /> : undefined}
      footer={!readOnly ? <FooterLink href="/calibrations">Calibrações</FooterLink> : undefined}
    >
      {rows.length === 0 ? (
        <InlineState icon={BarChart3} title="Nenhum critério com nota ainda.">Os critérios aparecem quando um evento tiver o resultado confirmado.</InlineState>
      ) : view === "tabela" ? (
        <DataTable
          caption="Nota média por critério"
          head={["Critério", "Área", "Nota usada", "Avaliadores", "Calibrada", "Eventos"]}
          align={["l", "l", "r", "r", "r", "r"]}
          minWidth={560}
          rows={rows.map(c => [<span className="font-semibold">{displayCriterionName(c.name)}</span>, c.area ?? "—", <b>{n1(c.avgScore)}</b>, n1(c.evaluatorAvg), c.calibratedCount > 0 ? `${n1(c.calibratedAvg)} (${c.calibratedCount})` : "—", c.eventsCount])}
          sort={rows.map(c => [displayCriterionName(c.name), c.area ?? "", c.avgScore, c.evaluatorAvg, c.calibratedCount > 0 ? c.calibratedAvg : null, c.eventsCount])}
        />
      ) : (
        <BarList
          ariaLabel="Nota média por critério"
          testId="criteria-bars"
          reference={ref}
          rows={rows.map(c => ({
            key: `${c.name}|${c.area ?? ""}`,
            name: `${displayCriterionName(c.name)}${c.area ? ` · ${c.area}` : ""}`,
            label: displayCriterionName(c.name),
            sub: c.area ?? undefined,
            value: c.avgScore,
            display: n1(c.avgScore),
            tip: [
              { label: "Nota usada", value: n1(c.avgScore) },
              { label: "Média dos avaliadores", value: n1(c.evaluatorAvg) },
              { label: "Calibrada", value: c.calibratedCount > 0 ? `${n1(c.calibratedAvg)} em ${plural(c.calibratedCount, "evento")}` : "—" },
              { label: "Eventos", value: String(c.eventsCount) },
            ],
          }))}
        />
      )}
    </Block>
  );
}

/** Matriz de conformidade: % de "Não" por item (sem resposta fica de fora). */
export function ConformityPanel({ data, withCycle, className }: { data: D; withCycle: (h: string) => string; className?: string }) {
  const [view, setView] = useView();
  const rows = data.conformity;
  const none = rows.every(c => c.naoPct == null);
  return (
    <Block
      id="matriz"
      testId="analytics-conformity"
      icon={ShieldCheck}
      className={className}
      title="Matriz de conformidade"
      sub={'Percentual de respostas "Não" por item, nos eventos confirmados. Cada "Não" tira pontos da nota do evento.'}
      aside={!none ? <ViewToggle value={view} onChange={setView} label="Ver a matriz como" testId="conformity-view" /> : undefined}
      footer={<FooterLink href={withCycle("/analytics/eventos")}>Desconto por evento</FooterLink>}
    >
      {none ? (
        <InlineState icon={ShieldCheck} title="Nenhuma resposta da matriz ainda." testId="conformity-no-answers">
          A matriz aparece quando um evento confirmado tiver a matriz respondida.
        </InlineState>
      ) : view === "tabela" ? (
        <DataTable caption="Matriz de conformidade" head={["Item", "% Não", "Não", "Respostas"]}
          rows={rows.map(c => [<span className="font-semibold">{c.label}</span>, c.naoPct == null ? "—" : `${n1(c.naoPct)}%`, c.nao, c.answered])}
          sort={rows.map(c => [c.label, c.naoPct, c.nao, c.answered])} />
      ) : (
        <BarList
          ariaLabel='Percentual de "Não" por item da matriz'
          testId="conformity-bars"
          rows={rows.map(c => ({
            key: c.item,
            name: c.label,
            label: c.label,
            sub: c.naoPct == null ? "sem respostas" : `${c.nao} de ${plural(c.answered, "resposta", "respostas")}`,
            value: c.naoPct ?? null,
            display: c.naoPct == null ? "—" : `${n1(c.naoPct)}%`,
            tip: [
              { label: '% de "Não"', value: c.naoPct == null ? "sem respostas" : `${n1(c.naoPct)}%` },
              { label: "Não / respostas", value: `${c.nao} / ${c.answered}` },
            ],
          }))}
        />
      )}
    </Block>
  );
}

/** Eixo enxuto em volta dos dados (passo de 5), dentro de 0–100 — igual à evolução do Dashboard. */
function domainOf(values: number[]): [number, number] {
  const lo = Math.max(0, Math.floor((Math.min(...values) - 6) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 4) / 5) * 5);
  return hi - lo < 15 ? [Math.max(0, hi - 15), hi] : [lo, hi];
}

/** Evolução da nota média dos eventos por fim de semana (uma série, rótulo só no último ponto). */
export function TrendPanel({ data, readOnly, isAll, withCycle, className }: { data: D; readOnly: boolean; isAll: boolean; withCycle: (h: string) => string; className?: string }) {
  const [view, setView] = useView();
  const pts = data.scoreTrend;
  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : null;
  const delta = last && prev ? Math.round((last.avgScore - prev.avgScore) * 10) / 10 : null;
  const [lo, hi] = pts.length > 0 ? domainOf(pts.map(p => p.avgScore)) : [0, 100];
  const step = hi - lo <= 25 ? 5 : hi - lo <= 50 ? 10 : 20;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return (
    <Block
      id="evolucao"
      testId="analytics-trend"
      icon={TrendingUp}
      className={className}
      title="Evolução por fim de semana"
      sub="Nota oficial média dos eventos confirmados em cada fim de semana."
      aside={pts.length > 1 ? <ViewToggle value={view} onChange={setView} label="Ver a evolução como" testId="trend-view" /> : undefined}
      footer={<FooterLink href={withCycle("/analytics/eventos")}>Nota de cada evento</FooterLink>}
    >
      {pts.length === 0 ? (
        <InlineState icon={TrendingUp} title={readOnly ? (isAll ? "Nenhum evento com nota oficial." : "Nenhum evento com nota oficial neste ciclo.") : "Sem eventos confirmados ainda."}>
          {readOnly ? "Não há evento confirmado com nota por critério para mostrar." : "A linha aparece quando houver resultados confirmados."}
        </InlineState>
      ) : (
        <div className="px-4 lg:px-5 pb-4">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-condensed text-[30px] font-black leading-none tabular-nums text-foreground">{n1(last.avgScore)}</span>
            <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{last.label}</span>
            {delta === 0 && prev && <span className="basis-full sm:basis-auto text-[12.5px] text-muted-foreground">Sem variação sobre {prev.label}</span>}
            {delta != null && delta !== 0 && prev && (
              <span className="basis-full sm:basis-auto text-[12.5px] text-muted-foreground">
                <b className={delta > 0 ? "font-semibold tabular-nums text-[var(--status-ok-text)]" : delta < 0 ? "font-semibold tabular-nums text-[var(--status-danger-text)]" : "font-semibold tabular-nums text-foreground"}>
                  {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}{fmtNum(delta, 1)}
                </b>{" "}sobre {prev.label}
              </span>
            )}
          </p>
          {pts.length === 1 ? (
            <p className="mt-3 text-[13px] text-muted-foreground">Só um fim de semana com nota até agora — a linha aparece a partir do segundo.</p>
          ) : view === "tabela" ? (
            <div className="-mx-4 lg:-mx-5 mt-2">
              <DataTable caption="Nota média por fim de semana" head={["Fim de semana", "Nota média", "Eventos"]}
                rows={pts.map(t => [t.label, <b>{n1(t.avgScore)}</b>, t.events])} />
            </div>
          ) : (
            <figure className="mt-3">
              <figcaption className="sr-only">{`Nota média por fim de semana: ${pts.map(t => `${t.label} ${n1(t.avgScore)}`).join("; ")}.`}</figcaption>
              <div aria-hidden className="h-[220px] lg:h-[240px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={pts} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...AXIS_TICK, fontWeight: 600 }} dy={8} interval="preserveStartEnd" minTickGap={16} padding={{ left: 16, right: 16 }} />
                    <YAxis axisLine={false} tickLine={false} width={34} domain={[lo, hi]} ticks={ticks} tick={AXIS_TICK} tickFormatter={v => fmtNum(Number(v), 0)} />
                    <Tooltip
                      cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        const p = active && payload?.[0] ? (payload[0].payload as D["scoreTrend"][number]) : null;
                        if (!p) return null;
                        return <VizTooltipBox title={`Fim de semana ${p.label}`} lines={[{ label: "Nota média", value: n1(p.avgScore) }, { label: "Eventos", value: String(p.events) }]} />;
                      }}
                    />
                    <Line type="linear" dataKey="avgScore" stroke={SERIES} strokeWidth={2} isAnimationActive={false}
                      dot={{ r: 4, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "var(--foreground)", stroke: "var(--card)", strokeWidth: 2 }}>
                      <LabelList dataKey="avgScore" content={(props: { x?: number | string; y?: number | string; index?: number; value?: number | string }) => (
                        props.index === pts.length - 1 ? (
                          <text x={Number(props.x)} y={Number(props.y) - 12} textAnchor="end" dx={6} fontSize={12} fontWeight={700} fill="var(--foreground)" data-testid="trend-last-label">
                            {n1(Number(props.value))}
                          </text>
                        ) : null
                      )} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure>
          )}
        </div>
      )}
    </Block>
  );
}
