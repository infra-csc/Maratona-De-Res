// Evolução de performance: média das notas finais por ciclo, do mais antigo
// para o mais recente (a API ordena pela DATA DE INÍCIO do ciclo). Uma série
// só: linha de 2 px, pontos de 8 px, rótulo só no ponto em foco, tooltip e a
// mesma informação em tabela (alternância Gráfico | Tabela).
import { useState } from "react";
import type { QuarterlyEvolution } from "@workspace/api-client-react";
import { CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineIcon } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { Segmented } from "../calibrations/cal-ui";
import { AXIS_TICK, GRID, SERIES, VizTooltipBox } from "../analytics-person/ui";
import { Bone, FooterLink, InlineError, InlineState, Panel } from "./dashboard-ui";

type View = "grafico" | "tabela";

/** Eixo enxuto em volta dos dados (passo de 5), dentro de 0–100. */
function domainOf(values: number[]): [number, number] {
  const lo = Math.max(0, Math.floor((Math.min(...values) - 6) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...values) + 4) / 5) * 5);
  return hi - lo < 15 ? [Math.max(0, hi - 15), hi] : [lo, hi];
}

export function EvolutionPanel({ data, loading, error, onRetry, focusCycleId, withCycle, className }: {
  data: QuarterlyEvolution[] | undefined; loading: boolean; error: boolean; onRetry: () => void;
  /** Ciclo escolhido no seletor (destacado); null no Total geral → o mais recente. */
  focusCycleId: number | null;
  withCycle: (href: string) => string;
  className?: string;
}) {
  const [view, setView] = useState<View>("grafico");
  const points = data ?? [];
  const found = focusCycleId != null ? points.findIndex(p => p.cycleId === focusCycleId) : -1;
  const fi = found >= 0 ? found : points.length - 1;
  // Ciclo escolhido ainda sem resultado (ciclo novo): o destaque vai para o último que tem.
  const focusMissing = focusCycleId != null && found < 0 && points.length > 0;
  const focus = points[fi] ?? null;
  const prev = fi > 0 ? points[fi - 1] : null;
  const delta = focus && prev ? Math.round((focus.average - prev.average) * 10) / 10 : null;
  const [lo, hi] = points.length > 0 ? domainOf(points.map(p => p.average)) : [0, 100];
  const step = hi - lo <= 25 ? 5 : hi - lo <= 50 ? 10 : 20;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);

  const summaryText = points.length === 0 ? "" :
    `Média por ciclo: ${points.map(p => `${p.label} ${fmtNum(p.average, 1)}`).join("; ")}.`;

  return (
    <Panel
      className={className}
      labelId="dash-evolution-title"
      testId="dashboard-evolution"
      icon={LineIcon}
      title="Evolução de performance"
      sub="Média das notas finais por ciclo, do mais antigo ao mais recente."
      aside={points.length > 1 ? (
        <Segmented<View> size="sm" label="Ver a evolução como" value={view} onChange={setView}
          options={[{ value: "grafico", label: "Gráfico", testId: "evolution-view-chart" }, { value: "tabela", label: "Tabela", testId: "evolution-view-table" }]} />
      ) : undefined}
      footer={<FooterLink href={withCycle("/analytics")}>Análises</FooterLink>}
    >
      {loading ? (
        <div className="px-4 lg:px-5 pb-5" aria-hidden><Bone className="h-4 w-48 mb-4" /><Bone className="h-[200px] w-full" /></div>
      ) : error && !data ? (
        <InlineError what="a evolução" onRetry={onRetry} testId="dashboard-evolution-error" />
      ) : points.length === 0 ? (
        <InlineState icon={LineIcon} title="Nenhum ciclo com resultado ainda." testId="dashboard-evolution-empty">
          A evolução aparece quando um ciclo tiver resultado apurado.
        </InlineState>
      ) : (
        <div className="px-4 lg:px-5 pb-4">
          {/* Leitura principal: o ciclo em foco e a variação sobre o anterior. */}
          {focus && (
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-condensed text-[30px] font-black leading-none tabular-nums text-foreground">{fmtNum(focus.average, 1)}</span>
              <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground truncate max-w-full">{focus.label}</span>
              {delta != null && prev && (
                <span className="basis-full sm:basis-auto text-[12.5px] text-muted-foreground">
                  <b className={cn("font-semibold tabular-nums", delta > 0 ? "text-[var(--status-ok-text)]" : delta < 0 ? "text-[var(--status-danger-text)]" : "text-foreground")}>
                    {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}{fmtNum(delta, 1)}
                  </b>{" "}sobre {prev.label}
                </span>
              )}
            </p>
          )}
          {focusMissing && (
            <p className="mt-1 text-[12.5px] text-muted-foreground" data-testid="evolution-focus-missing">
              Último ciclo com resultado. O ciclo escolhido entra no gráfico quando tiver resultado apurado.
            </p>
          )}

          {points.length === 1 ? (
            <p className="mt-3 text-[13px] text-muted-foreground">Só um ciclo com resultado até agora — a linha aparece a partir do segundo.</p>
          ) : view === "tabela" ? (
            <table className="mt-3 w-full text-[14px]" data-testid="dashboard-evolution-table">
              <caption className="sr-only">Média das notas finais por ciclo</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="py-2 text-left font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Ciclo</th>
                  <th scope="col" className="py-2 text-right font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Média</th>
                  <th scope="col" className="py-2 text-right font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Variação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {points.map((p, i) => {
                  const d = i > 0 ? p.average - points[i - 1].average : null;
                  return (
                    <tr key={p.cycleId ?? p.label} className={i === fi ? "font-semibold" : undefined}>
                      <td className="py-2 pr-3 text-foreground">{p.label}</td>
                      <td className="py-2 text-right tabular-nums text-foreground">{fmtNum(p.average, 1)}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{d == null ? "—" : `${d > 0 ? "+" : ""}${fmtNum(d, 1)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <figure className="mt-3" data-testid="dashboard-evolution-chart">
              <figcaption className="sr-only">{summaryText}</figcaption>
              <div aria-hidden className="h-[210px] lg:h-[230px] -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 26, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={GRID} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ ...AXIS_TICK, fontWeight: 600 }} dy={8} interval="preserveStartEnd" minTickGap={16} padding={{ left: 24, right: 24 }}
                      tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
                    <YAxis axisLine={false} tickLine={false} width={34} domain={[lo, hi]} ticks={ticks} tick={AXIS_TICK}
                      tickFormatter={v => fmtNum(Number(v), 0)} />
                    <Tooltip
                      cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        const p = active && payload?.[0] ? (payload[0].payload as QuarterlyEvolution) : null;
                        if (!p) return null;
                        const i = points.indexOf(p);
                        const d = i > 0 ? p.average - points[i - 1].average : null;
                        return (
                          <VizTooltipBox title={p.label} lines={[
                            { label: "Média", value: fmtNum(p.average, 1) },
                            ...(d != null ? [{ label: `Sobre ${points[i - 1].label}`, value: `${d > 0 ? "+" : ""}${fmtNum(d, 1)}` }] : []),
                          ]} />
                        );
                      }}
                    />
                    <Line type="linear" dataKey="average" stroke={SERIES} strokeWidth={2} isAnimationActive={false}
                      dot={(props: { cx?: number; cy?: number; index?: number }) => (
                        <circle key={`d-${props.index}`} cx={props.cx} cy={props.cy} r={props.index === fi ? 5.5 : 4}
                          fill={props.index === fi ? "var(--foreground)" : SERIES} stroke="var(--card)" strokeWidth={2} />
                      )}
                      activeDot={{ r: 6, fill: "var(--foreground)", stroke: "var(--card)", strokeWidth: 2 }}>
                      <LabelList dataKey="average" content={(props: { x?: number | string; y?: number | string; index?: number; value?: number | string }) => (
                        props.index === fi ? (
                          <text x={Number(props.x)} y={Number(props.y) - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">
                            {fmtNum(Number(props.value), 1)}
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
    </Panel>
  );
}
