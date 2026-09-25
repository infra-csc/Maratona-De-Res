import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey, type AnalyticsOverview } from "@workspace/api-client-react";
import { AlertTriangle, BarChart3, ChevronDown, Download, FileSpreadsheet, FileText, RefreshCw, Table2, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportAnalyticsXlsx } from "@/lib/analytics-export";
import { PageHeader, EmptyState, LoadingState, StatusBadge, StatTile } from "@/components/shared";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { fmtDate, fmtNum } from "@/lib/utils";

// Paleta dos gráficos validada (dataviz/validate_palette) contra as superfícies
// do app: série 1 = lima da marca escurecido para barra/linha (#6f8300 claro,
// #869c00 escuro), série 2 = azul. Definidas em index.css como --viz-series-*.
const SERIES = "var(--viz-series-1)";
const GRID = "var(--viz-grid)";
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

const n1 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Card({ title, subtitle, children, table, span2 }: {
  title: string; subtitle?: string; children: React.ReactNode; table?: React.ReactNode; span2?: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      className={`rounded-xl p-5 flex flex-col gap-3 min-w-0 ${span2 ? "lg:col-span-2" : ""}`}
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-black uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.01em" }}>{title}</h2>
          {subtitle && <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable(v => !v)}
            aria-pressed={showTable}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", fontFamily: CONDENSED }}
          >
            <Table2 size={13} aria-hidden /> {showTable ? "Ver gráfico" : "Ver tabela"}
          </button>
        )}
      </header>
      {showTable && table ? <div className="overflow-x-auto">{table}</div> : children}
    </section>
  );
}

function VizTooltip({ active, payload, lines }: { active?: boolean; payload?: { payload: Record<string, unknown> }[]; lines: (row: Record<string, unknown>) => { label: string; value: string }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg px-3 py-2 text-[12px] shadow-md" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
      {lines(row).map((l, i) => (
        <div key={i} className="flex justify-between gap-4">
          <span style={{ color: i === 0 ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: i === 0 ? 700 : 400 }}>{l.label}</span>
          <span className="font-semibold tabular-nums">{l.value}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: (React.ReactNode)[][] }) {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} className={`py-2 px-2 font-bold uppercase text-[11px] ${i === 0 ? "text-left" : "text-right"}`} style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((c, ci) => (
              <td key={ci} className={`py-2 px-2 ${ci === 0 ? "text-left" : "text-right tabular-nums"}`} style={{ borderBottom: "1px solid var(--border)" }}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Barras horizontais de uma série, com valor na ponta (sem legenda: o título nomeia). */
/** Largura do contêiner (para o eixo de rótulos não espremer as barras no celular). */
function useWidth<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Rótulo do eixo: corta com reticências no espaço disponível; o nome inteiro fica no title. */
function AxisLabel({ x, y, payload, maxChars }: { x?: number; y?: number; payload?: { value: string }; maxChars: number }) {
  const full = String(payload?.value ?? "");
  const text = full.length > maxChars ? `${full.slice(0, Math.max(1, maxChars - 1))}…` : full;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={11} fill="var(--foreground)">
      <title>{full}</title>
      {text}
    </text>
  );
}

function HBars<T extends Record<string, unknown>>({ data, labelKey, valueKey, max, format, tooltip, height }: {
  data: T[]; labelKey: keyof T & string; valueKey: keyof T & string; max?: number;
  format: (v: number) => string; tooltip: (row: T) => { label: string; value: string }[]; height?: number;
}) {
  const h = height ?? Math.max(120, data.length * 34 + 24);
  const [ref, width] = useWidth<HTMLDivElement>();
  // ~40% da largura para os nomes (entre 96 e 190 px); ~6,3 px por caractere a 11 px.
  const labelWidth = Math.round(Math.min(190, Math.max(96, (width || 420) * 0.4)));
  const maxChars = Math.floor((labelWidth - 8) / 6.3);
  return (
    <div ref={ref} style={{ height: h }} role="img" aria-label={data.map(d => `${String(d[labelKey])}: ${format(Number(d[valueKey]))}`).join("; ")}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" domain={[0, max ?? "auto"]} axisLine={false} tickLine={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey={labelKey} width={labelWidth} axisLine={{ stroke: GRID }} tickLine={false} tick={<AxisLabel maxChars={maxChars} />} />
          <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.6 }} content={<VizTooltip lines={row => tooltip(row as T)} />} />
          <Bar dataKey={valueKey} fill={SERIES} barSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey={valueKey} position="right" formatter={(v: unknown) => format(Number(v))} style={{ fontSize: 11, fontWeight: 700, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function biasBadge(bias: number | null, samples: number) {
  if (bias == null || samples < 3) return <span style={{ color: "var(--muted-foreground)" }}>—</span>;
  if (bias >= 5) return <StatusBadge variant="info" size="sm" label={`RH sobe +${n1(bias)}`} srLabel={`A calibração sobe as notas deste avaliador em média ${n1(bias)} pontos`} />;
  if (bias <= -5) return <StatusBadge variant="warn" size="sm" label={`RH desce ${n1(bias)}`} srLabel={`A calibração desce as notas deste avaliador em média ${n1(Math.abs(bias))} pontos`} />;
  return <StatusBadge variant="ok" size="sm" label={`Alinhado ${bias > 0 ? "+" : ""}${n1(bias)}`} />;
}

export default function AnalyticsPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useGetAnalyticsOverview({
    query: { queryKey: getGetAnalyticsOverviewQueryKey(), staleTime: 60_000 },
  });

  if (isLoading) {
    return <div className="px-6 py-6"><LoadingState lines={8} withHeader label="Carregando análises" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="px-6 py-10">
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar as análises" description={(error as { message?: string } | null)?.message ?? "Tente novamente em instantes."} />
      </div>
    );
  }
  return <AnalyticsView data={data} updatedAt={dataUpdatedAt} refreshing={isFetching} onRefresh={() => void refetch()} />;
}

function AnalyticsView({ data, updatedAt, refreshing, onRefresh }: {
  data: AnalyticsOverview; updatedAt: number; refreshing: boolean; onRefresh: () => void;
}) {
  const k = data.kpis;
  const period = data.cycle.startDate && data.cycle.endDate
    ? `${fmtDate(data.cycle.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} a ${fmtDate(data.cycle.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}`
    : null;
  const weakest = data.criteria[0];
  const maxCount = Math.max(1, ...data.faixas.map(x => x.count));
  const worstConformity = [...data.conformity].filter(c => c.naoPct != null).sort((a, b) => (b.naoPct ?? 0) - (a.naoPct ?? 0))[0];

  return (
    <div className="px-6 py-6 space-y-6" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow={`${data.cycle.name}${period ? ` · ${period}` : ""}`}
        title="Análises"
        description="Como o ciclo está indo: notas, critérios, conformidade, bônus e avaliadores. Só entram na nota os eventos com resultados confirmados; os colaboradores contados são os mesmos do Ranking."
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }} aria-live="polite">
              {refreshing ? "Atualizando…" : `Atualizado às ${new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
            <ExportMenu data={data} />
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-bold uppercase transition-colors hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              style={{ border: "1px solid var(--border)", fontFamily: CONDENSED }}
              data-testid="button-refresh-analytics"
            >
              <RefreshCw size={14} aria-hidden className={refreshing ? "animate-spin" : undefined} /> Atualizar
            </button>
          </div>
        }
      />

      {/* ── Indicadores ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="analytics-kpis">
        <StatTile hero label="Nota final média" value={n1(k.avgFinalResult)} detail={`${k.collaborators} colaboradores no ranking`} data-testid="kpi-avg-final" />
        <StatTile label="Nota média dos eventos" value={n1(k.avgEventScore)} detail={`${k.eventsScored} evento(s) com nota oficial`} />
        <StatTile label="Eventos confirmados" value={`${k.eventsConfirmed}/${k.eventsTotal}`} detail={`${pct(k.eventsConfirmed, k.eventsTotal)}% do ciclo`} />
        <StatTile label="Elegíveis ao bônus" value={`${k.eligible}/${k.collaborators}`} detail={`${k.withBonus} com bônus hoje`} />
        <StatTile label="Bônus projetado" value={brl(k.bonusTotal)} detail="Soma dos elegíveis" />
        <StatTile label="Avaliações enviadas" value={k.evaluationsSubmitted} detail={k.evaluationsDraft > 0 ? `${k.evaluationsDraft} em rascunho` : "Nenhum rascunho parado"} />
      </div>

      {/* ── Destaques em texto: o que pede atenção ── */}
      {(weakest || worstConformity || k.avgCalibrationShift != null) && (
        <ul className="grid gap-2 md:grid-cols-3 text-[13px]" aria-label="Destaques">
          {weakest && (
            <li className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
              Critério mais fraco: <strong>{weakest.name}</strong>{weakest.area ? ` (${weakest.area})` : ""}, média <strong>{n1(weakest.avgScore)}</strong>.
            </li>
          )}
          {worstConformity && (
            <li className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
              Item da matriz com mais "Não": <strong>{worstConformity.label}</strong>, em <strong>{n1(worstConformity.naoPct)}%</strong> das respostas.
            </li>
          )}
          {k.avgCalibrationShift != null && (
            <li className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
              A calibração do RH move as notas em média <strong>{k.avgCalibrationShift > 0 ? "+" : ""}{n1(k.avgCalibrationShift)}</strong> ponto(s) em {k.calibratedCriteria} critério(s) calibrado(s).
            </li>
          )}
        </ul>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Evolução ── */}
        <Card
          span2
          title="Evolução da nota por fim de semana"
          subtitle="Média da nota oficial dos eventos confirmados em cada fim de semana (0 a 100)."
          table={data.scoreTrend.length > 0 && (
            <DataTable head={["Fim de semana", "Nota média", "Eventos"]} rows={data.scoreTrend.map(t => [t.label, n1(t.avgScore), t.events])} />
          )}
        >
          {data.scoreTrend.length === 0 ? (
            <EmptyState compact icon={TrendingUp} title="Sem eventos confirmados ainda" description="A linha aparece quando houver resultados confirmados." />
          ) : (
            <div style={{ height: 260 }} role="img" aria-label={data.scoreTrend.map(t => `${t.label}: ${n1(t.avgScore)}`).join("; ")}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.scoreTrend} margin={{ top: 16, right: 24, bottom: 4, left: -8 }}>
                  <CartesianGrid vertical={false} stroke={GRID} />
                  <XAxis dataKey="label" axisLine={{ stroke: GRID }} tickLine={false} tick={AXIS_TICK} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} axisLine={false} tickLine={false} tick={AXIS_TICK} />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                    content={<VizTooltip lines={row => [
                      { label: `Fim de semana ${String(row.label)}`, value: "" },
                      { label: "Nota média", value: n1(row.avgScore as number) },
                      { label: "Eventos", value: String(row.events) },
                    ]} />}
                  />
                  <Line
                    type="monotone" dataKey="avgScore" stroke={SERIES} strokeWidth={2} isAnimationActive={false}
                    dot={{ r: 4, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 }}
                  >
                    <LabelList dataKey="avgScore" position="top" content={({ x, y, value, index }) =>
                      index === data.scoreTrend.length - 1 ? (
                        <text x={Number(x)} y={Number(y) - 10} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--foreground)">{n1(Number(value))}</text>
                      ) : null
                    } />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* ── Funil ── */}
        <Card
          title="Funil do bônus"
          subtitle={`Do total de participantes até quem recebe bônus (mínimo de ${k.minEvents} eventos).`}
          table={<DataTable head={["Etapa", "Pessoas", "% do total"]} rows={data.funnel.map(f => [f.label, f.count, `${pct(f.count, data.funnel[0]?.count ?? 0)}%`])} />}
        >
          {/* Lista em vez de gráfico: rótulos inteiros num card estreito. */}
          <ol className="space-y-3" aria-label="Funil do bônus">
            {data.funnel.map(f => {
              const total = data.funnel[0]?.count ?? 0;
              return (
                <li key={f.stage} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
                  <span className="text-[12.5px] font-semibold">{f.label}</span>
                  <span className="text-[12px] tabular-nums"><strong className="text-[14px]">{f.count}</strong> <span style={{ color: "var(--muted-foreground)" }}>· {pct(f.count, total)}%</span></span>
                  <div className="col-span-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${pct(f.count, total)}%`, backgroundColor: SERIES }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        {/* ── Critérios ── */}
        <Card
          span2
          title="Nota média por critério"
          subtitle="Eventos confirmados, do mais fraco para o mais forte. Usa a nota calibrada quando existe; senão, a média dos avaliadores (0 a 100)."
          table={data.criteria.length > 0 && (
            <DataTable
              head={["Critério", "Nota usada", "Avaliadores", "Calibrada", "Eventos"]}
              rows={data.criteria.map(c => [`${c.name}${c.area ? ` · ${c.area}` : ""}`, n1(c.avgScore), n1(c.evaluatorAvg), c.calibratedCount > 0 ? `${n1(c.calibratedAvg)} (${c.calibratedCount})` : "—", c.eventsCount])}
            />
          )}
        >
          {data.criteria.length === 0 ? (
            <EmptyState compact icon={BarChart3} title="Nenhum critério avaliado ainda" />
          ) : (
            <HBars
              data={data.criteria.map(c => ({ ...c, label: `${c.name}${c.area ? ` · ${c.area}` : ""}` }))}
              labelKey="label"
              valueKey="avgScore"
              max={100}
              format={v => n1(v)}
              tooltip={row => [
                { label: String(row.label), value: "" },
                { label: "Nota usada", value: n1(row.avgScore) },
                { label: "Média dos avaliadores", value: n1(row.evaluatorAvg) },
                { label: "Calibrada", value: row.calibratedCount > 0 ? `${n1(row.calibratedAvg)} em ${row.calibratedCount}` : "—" },
                { label: "Eventos", value: String(row.eventsCount) },
              ]}
            />
          )}
        </Card>

        {/* ── Conformidade ── */}
        <Card
          title="Matriz de conformidade"
          subtitle={'Eventos confirmados: percentual de respostas "Não" por item (sem resposta fica de fora).'}
          table={<DataTable head={["Item", "% Não", "Não", "Respostas"]} rows={data.conformity.map(c => [c.label, c.naoPct == null ? "—" : `${n1(c.naoPct)}%`, c.nao, c.answered])} />}
        >
          <HBars
            data={data.conformity.map(c => ({ ...c, value: c.naoPct ?? 0 }))}
            labelKey="label"
            valueKey="value"
            max={100}
            format={v => `${n1(v)}%`}
            tooltip={row => [
              { label: row.label, value: "" },
              { label: '% de "Não"', value: row.naoPct == null ? "sem respostas" : `${n1(row.naoPct)}%` },
              { label: "Não / respostas", value: `${row.nao} / ${row.answered}` },
            ]}
          />
        </Card>

        {/* ── Faixas ── */}
        <Card
          title="Colaboradores por faixa"
          subtitle="Faixa da nota final do ciclo e bônus projetado de cada uma."
          table={<DataTable head={["Faixa", "Pessoas", "Bônus"]} rows={data.faixas.map(f => [f.name, f.count, brl(f.bonusTotal)])} />}
        >
          <ul className="space-y-2">
            {data.faixas.map(f => {
              return (
                <li key={f.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-2 min-w-0 text-[12.5px]">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: f.color ?? "var(--muted-foreground)", boxShadow: "inset 0 0 0 1px var(--border)" }} />
                    <span className="truncate font-semibold">{f.name}</span>
                    {f.minScore != null && <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{fmtNum(f.minScore, 2)}–{fmtNum(f.maxScore ?? 0, 2)}</span>}
                  </span>
                  <span className="text-[12px] tabular-nums text-right" style={{ color: "var(--muted-foreground)" }}>{f.bonusTotal > 0 ? brl(f.bonusTotal) : ""}</span>
                  <div className="col-span-2 flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(f.count / maxCount) * 100}%`, backgroundColor: SERIES }} />
                    </div>
                    <span className="w-8 text-right text-[12px] font-bold tabular-nums">{f.count}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* ── Perto da próxima faixa ── */}
        <Card
          span2
          title="Perto da próxima faixa"
          subtitle="Elegíveis a até 3 pontos da próxima faixa que paga bônus, e quanto passariam a receber."
        >
          {data.nearNextFaixa.length === 0 ? (
            <EmptyState compact title="Ninguém a menos de 3 pontos da próxima faixa" />
          ) : (
            <div className="overflow-x-auto">
              <DataTable
                head={["Colaborador", "Nota", "Faixa atual", "Próxima", "Faltam", "Bônus hoje", "Na próxima"]}
                rows={data.nearNextFaixa.map(r => [
                  r.name, n1(r.finalResult), r.currentFaixa ?? "—", r.nextFaixa, `${n1(r.gap)} pt`, brl(r.currentBonus), brl(r.potentialBonus),
                ])}
              />
            </div>
          )}
        </Card>

        {/* ── Avaliadores ── */}
        <Card
          span2
          title="Avaliadores"
          subtitle='"Ajuste da calibração" compara a nota do avaliador com a calibrada pelo RH (a partir de 3 casos). "Dias até enviar" conta a partir do fim do evento.'
        >
          {data.evaluators.length === 0 ? (
            <EmptyState compact title="Nenhuma avaliação no ciclo" />
          ) : (
            <div className="overflow-x-auto">
              <DataTable
                head={["Avaliador", "Enviadas", "Rascunhos", "Nota média dada", "Ajuste da calibração", "Dias até enviar"]}
                rows={data.evaluators.map(e => [
                  e.name, e.submitted, e.drafts > 0 ? <span style={{ color: "var(--status-warn-text)", fontWeight: 700 }}>{e.drafts}</span> : 0,
                  n1(e.avgGiven), biasBadge(e.calibrationBias ?? null, e.biasSamples), n1(e.avgDaysToSubmit),
                ])}
              />
            </div>
          )}
        </Card>

        {/* ── Penalidades e méritos ── */}
        <Card
          title="Penalidades e méritos"
          subtitle="Lançamentos do ciclo por tipo."
        >
          {data.adjustments.length === 0 ? (
            <EmptyState compact title="Nenhum lançamento no ciclo" />
          ) : (
            <DataTable
              head={["Tipo", "Ocorr.", "Pontos", "Pessoas"]}
              rows={data.adjustments.map(a => [
                <span className="inline-flex items-center gap-2"><StatusBadge size="sm" variant={a.kind === "merit" ? "ok" : "danger"} label={a.kind === "merit" ? "Mérito" : "Penalidade"} />{a.label}</span>,
                a.occurrences, `${a.kind === "merit" ? "+" : "−"}${a.points}`, a.employees,
              ])}
            />
          )}
        </Card>

        {/* ── Clientes ── */}
        <Card
          span2
          title="Nota média por cliente"
          subtitle="Clientes com mais eventos confirmados no ciclo (até 12)."
          table={data.clients.length > 0 && <DataTable head={["Cliente", "Nota média", "Eventos"]} rows={data.clients.map(c => [c.client, n1(c.avgScore), c.events])} />}
        >
          {data.clients.length === 0 ? (
            <EmptyState compact title="Sem eventos confirmados" />
          ) : (
            <HBars
              data={data.clients}
              labelKey="client"
              valueKey="avgScore"
              max={100}
              format={v => n1(v)}
              tooltip={row => [
                { label: row.client, value: "" },
                { label: "Nota média", value: n1(row.avgScore) },
                { label: "Eventos", value: String(row.events) },
              ]}
            />
          )}
        </Card>

        {/* ── Próximos passos ── */}
        <section className="rounded-xl p-5 flex flex-col gap-2 text-[13px]" style={{ backgroundColor: "var(--secondary)" }}>
          <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>Onde agir</h2>
          <p style={{ color: "var(--muted-foreground)" }}>Os números acima vêm das telas de trabalho:</p>
          <ul className="space-y-1.5">
            <li><Link href="/events?status=unconfirmed" className="font-semibold underline underline-offset-2">Eventos não confirmados</Link> <span style={{ color: "var(--muted-foreground)" }}>— não entram na nota.</span></li>
            <li><Link href="/evaluations" className="font-semibold underline underline-offset-2">Avaliações pendentes</Link> <span style={{ color: "var(--muted-foreground)" }}>— rascunhos e links.</span></li>
            <li><Link href="/calibrations" className="font-semibold underline underline-offset-2">Calibrações</Link> <span style={{ color: "var(--muted-foreground)" }}>— ajuste e publicação.</span></li>
            <li><Link href="/results" className="font-semibold underline underline-offset-2">Resultados e bônus</Link> <span style={{ color: "var(--muted-foreground)" }}>— ranking e pagamentos.</span></li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Exportar: relatório para imprimir/salvar em PDF ou planilha Excel com todas as tabelas. */
function ExportMenu({ data }: { data: AnalyticsOverview }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const exportXlsx = async () => {
    setBusy(true);
    try {
      await exportAnalyticsXlsx(data);
      toast({ title: "Planilha exportada", description: "O arquivo foi salvo na pasta de downloads." });
    } catch (e) {
      toast({ title: "Não foi possível gerar a planilha", description: (e as Error)?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9" disabled={busy} data-testid="button-export-analytics">
          <Download size={14} aria-hidden /> {busy ? "Gerando…" : "Exportar"} <ChevronDown size={14} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => navigate("/analytics/relatorio?imprimir=1")} data-testid="menu-export-pdf">
          <FileText size={15} aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Relatório em PDF</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Análise do ciclo + regras de negócio</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportXlsx()} data-testid="menu-export-xlsx">
          <FileSpreadsheet size={15} aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Planilha Excel</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Uma aba por tabela da tela</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
