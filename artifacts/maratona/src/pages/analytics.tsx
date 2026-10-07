import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { useGetAnalyticsOverview, getGetAnalyticsOverviewQueryKey, useGetRankingTotal, getGetRankingTotalQueryKey, type AnalyticsOverview } from "@workspace/api-client-react";
import { keepPreviousData } from "@tanstack/react-query";
import { BarChart3, ChevronDown, Download, FileSpreadsheet, FileText, RefreshCw, Table2, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { exportAnalyticsXlsx, exportEventsReportXlsx } from "@/lib/analytics-export";
import { getAnalyticsEventsReport } from "@workspace/api-client-react";
import { PageHeader, EmptyState, StatusBadge, StatTile, BonusPair } from "@/components/shared";
import { bonusSplit } from "@/lib/bonus-split";
import { faixaBonusSplit } from "@/lib/faixa-bonus-split";
import { funnelSteps, isFunnelMonotonic } from "@/lib/bonus-funnel";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { fmtDate, fmtNum, plural, faixaEdge } from "@/lib/utils";
import { AnalyticsTabs, AnalyticsScopeFallback } from "./analytics-team/analytics-tabs";
import { useAuth, hasRole } from "@/lib/auth-context";
import { CycleSelect, CycleScopeNotice, useCycleScope, type CycleScopeState } from "@/components/cycle-select";

// Paleta dos gráficos validada (dataviz/validate_palette) contra as superfícies
// do app: série 1 = lima da marca escurecido para barra/linha (#6f8300 claro,
// #869c00 escuro), série 2 = azul. Definidas em index.css como --viz-series-*.
const SERIES = "var(--viz-series-1)";
const GRID = "var(--viz-grid)";
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

// Notas e médias sempre com 1 casa ("79,0"), como em todo o app.
const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function Card({ title, subtitle, children, table, span2, className = "", style }: {
  title: string; subtitle?: string; children: React.ReactNode; table?: React.ReactNode; span2?: boolean;
  /** Largura/ordem na grade (layout sem buracos, ver gridPlan). */
  className?: string; style?: React.CSSProperties;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      className={`rounded-xl p-5 flex flex-col gap-3 min-w-0 ${span2 ? "lg:col-span-2" : ""} ${className}`}
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", ...style }}
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

type SortCell = string | number | null | undefined;

/**
 * Tabela simples. Com `sort` (valores crus de cada célula, na mesma ordem das
 * linhas), o cabeçalho vira botão: 1º clique ordena (texto A→Z, número do
 * maior para o menor), 2º clique inverte. Vazio fica sempre no fim.
 */
function DataTable({ head, rows, sort }: { head: string[]; rows: (React.ReactNode)[][]; sort?: SortCell[][] }) {
  const [by, setBy] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const order = rows.map((_, i) => i);
  if (sort && by) {
    order.sort((x, y) => {
      const a = sort[x][by.col], b = sort[y][by.col];
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
      const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR", { numeric: true });
      return c * by.dir;
    });
  }
  const toggle = (col: number) => {
    const numeric = typeof sort?.find(r => r[col] != null)?.[col] === "number";
    setBy(prev => (prev?.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: numeric ? -1 : 1 }));
  };
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr>
          {head.map((h, i) => {
            const active = by?.col === i;
            const ariaSort = active ? (by!.dir === 1 ? "ascending" : "descending") : sort ? "none" : undefined;
            return (
              <th key={h} aria-sort={ariaSort} className={`py-2 px-2 font-bold uppercase text-[11px] ${i === 0 ? "text-left" : "text-right"}`} style={{ fontFamily: CONDENSED, color: active ? "var(--foreground)" : "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                {sort ? (
                  <button type="button" onClick={() => toggle(i)} className={`inline-flex items-center gap-1 uppercase font-bold hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded ${i === 0 ? "" : "flex-row-reverse"}`}>
                    {h}
                    <span aria-hidden className="text-[11px]">{active ? (by!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                  </button>
                ) : h}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {order.map(ri => rows[ri]).map((r, ri) => (
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
  if (bias >= 5) return <StatusBadge variant="info" size="sm" label={`Calibração sobe +${n1(bias)}`} srLabel={`A calibração sobe as notas deste avaliador em média ${n1(bias)} pontos`} />;
  if (bias <= -5) return <StatusBadge variant="warn" size="sm" label={`Calibração desce ${n1(bias)}`} srLabel={`A calibração desce as notas deste avaliador em média ${n1(Math.abs(bias))} pontos`} />;
  return <StatusBadge variant="ok" size="sm" label={`Alinhado ${bias > 0 ? "+" : ""}${n1(bias)}`} />;
}

export default function AnalyticsPage() {
  // Seletor de ciclo: atual (padrão), anterior (só consulta) ou Total geral.
  const scope = useCycleScope();
  // Trocar de ciclo mantém a tela anterior até chegar a nova (sem sumir o seletor).
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useGetAnalyticsOverview(scope.params, {
    query: { queryKey: getGetAnalyticsOverviewQueryKey(scope.params), staleTime: 60_000, placeholderData: keepPreviousData },
  });

  if (isLoading) {
    return <AnalyticsScopeFallback scope={scope} current="gestao" state="loading" loadingLabel="Carregando análises" errorTitle="" />;
  }
  if (isError || !data) {
    return <AnalyticsScopeFallback scope={scope} current="gestao" state="error" loadingLabel="" errorTitle="Não foi possível carregar as análises"
      errorDetail={(error as { data?: { error?: string }; message?: string } | null)?.data?.error ?? (error as { message?: string } | null)?.message} />;
  }
  return <AnalyticsView data={data} scope={scope} updatedAt={dataUpdatedAt} refreshing={isFetching} onRefresh={() => void refetch()} />;
}

/** Linha de ajuda do Total geral nas Análises (o que é somado e o que some). */
const ANALYTICS_ALL_HELP = (
  <>Todos os eventos e resultados de <strong>todos os ciclos</strong>. Pessoas contam uma vez por ciclo (quem esteve em dois ciclos conta duas vezes); o funil usa o mínimo de eventos de cada ciclo. Projeções de um ciclo, como "perto da próxima faixa", não aparecem aqui.</>
);

function AnalyticsView({ data, scope, updatedAt, refreshing, onRefresh }: {
  data: AnalyticsOverview; scope: CycleScopeState; updatedAt: number; refreshing: boolean; onRefresh: () => void;
}) {
  const { user } = useAuth();
  const isAll = scope.isAll;
  const readOnly = scope.readOnly;
  // Linha do tempo é só de admin e RH (diretoria vê Análises, mas não o histórico).
  // Ela mostra o ciclo atual: fora dele (consulta) os nomes não viram link.
  const canTimeline = (hasRole(user, "admin") || hasRole(user, "rh")) && !readOnly;
  const noCiclo = isAll ? "em todos os ciclos" : "no ciclo";
  const k = data.kpis;
  // Total geral: oficial × projetado por faixa (soma pessoa × ciclo do Total geral).
  const rankingTotal = useGetRankingTotal({ query: { queryKey: getGetRankingTotalQueryKey(), staleTime: 60_000, enabled: isAll } });
  const split = isAll ? faixaBonusSplit(rankingTotal.data, data.faixas) : null;
  // Oficial e projetado juntos: o indicador de bônus ocupa duas colunas.
  const bonusBoth = (k.bonusOfficial ?? 0) > 0 && (k.bonusProjected ?? 0) > 0;
  const funnel = funnelSteps(data.funnel, { isAll, minEvents: isAll ? null : k.minEvents });
  const period = data.cycle.startDate && data.cycle.endDate
    ? `${fmtDate(data.cycle.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} a ${fmtDate(data.cycle.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}`
    : null;
  const weakest = data.criteria[0];
  const maxCount = Math.max(1, ...data.faixas.map(x => x.count));
  // "Sem cliente" não é cliente: sem nenhum evento com cliente informado, o card some.
  const realClients = data.clients.filter(c => c.client !== "Sem cliente");
  // Grade de 3 colunas sem buracos (lg+): estado vazio não ocupa um cartão
  // inteiro. "Perto da próxima faixa" vazio vira uma linha no cartão de
  // faixas; "Quem mais perdeu/ganhou" sem ninguém some (Penalidades e méritos
  // já diz "nenhum lançamento"); "Onde agir" fecha a última linha.
  const pertoCard = !isAll && data.nearNextFaixa.length > 0;
  const quemCard = data.topPenalized.length + data.topMerited.length > 0;
  const clientsCard = realClients.length > 0;
  const gridPlan = (() => {
    // Ondas de 3 colunas: [Faixas 1 + Perto 2] [Avaliadores 2 + Penalidades 1] … ou [Faixas 1 + Avaliadores 2] [Penalidades 1 + …].
    if (pertoCard) {
      if (quemCard && clientsCard) return { ondeSpan: "", ondeFirst: true, clientsSpan: "lg:col-span-3" };
      if (quemCard || clientsCard) return { ondeSpan: "", ondeFirst: false, clientsSpan: "" };
      return { ondeSpan: "lg:col-span-3", ondeFirst: false, clientsSpan: "" };
    }
    if (quemCard) return { ondeSpan: clientsCard ? "" : "lg:col-span-3", ondeFirst: false, clientsSpan: "" };
    return { ondeSpan: clientsCard ? "lg:col-span-3" : "lg:col-span-2", ondeFirst: false, clientsSpan: "" };
  })();
  const worstConformity = [...data.conformity].filter(c => c.naoPct != null).sort((a, b) => (b.naoPct ?? 0) - (a.naoPct ?? 0))[0];

  return (
    <div className="px-6 py-6 space-y-6" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow={`${data.cycle.name}${period ? ` · ${period}` : ""}`}
        title="Análises"
        description={isAll
          ? "Todos os ciclos somados: notas, critérios, conformidade, bônus e avaliadores. Só entram na nota os eventos com resultados confirmados."
          : readOnly
            ? "Como foi o ciclo: notas, critérios, conformidade, bônus e avaliadores. Só entram na nota os eventos com resultados confirmados; os colaboradores contados são os do Ranking do ciclo."
            : "Como o ciclo está indo: notas, critérios, conformidade, bônus e avaliadores. Só entram na nota os eventos com resultados confirmados; os colaboradores contados são os mesmos do Ranking."}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <CycleSelect scope={scope} />
            <span className="text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }} aria-live="polite">
              {refreshing ? "Atualizando…" : `Atualizado às ${new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </span>
            <ExportMenu data={data} scope={scope} />
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

      <AnalyticsTabs current="gestao" />

      <CycleScopeNotice scope={scope} allHelp={ANALYTICS_ALL_HELP} />

      {/* ── Indicadores ── */}
      <div className={`grid grid-cols-2 md:grid-cols-3 ${bonusBoth ? "xl:grid-cols-7" : "xl:grid-cols-6"} gap-3`} data-testid="analytics-kpis">
        <StatTile hero label="Nota final média" value={n1(k.avgFinalResult)}
          detail={isAll ? `${plural(k.distinctCollaborators ?? k.collaborators, "pessoa")} · ${plural(k.collaborators, "participação", "participações")}` : `${plural(k.collaborators, "colaborador", "colaboradores")} no ranking`} data-testid="kpi-avg-final" />
        <StatTile label="Nota média dos eventos" value={n1(k.avgEventScore)} detail={`${plural(k.eventsScored, "evento", "eventos")} com nota oficial`} />
        <StatTile label="Eventos confirmados" value={`${k.eventsConfirmed}/${k.eventsTotal}`} detail={`${pct(k.eventsConfirmed, k.eventsTotal)}% ${isAll ? "de todos os ciclos" : "do ciclo"}`} />
        <StatTile label="Elegíveis ao bônus" value={`${k.eligible}/${k.collaborators}`} detail={isAll ? `${plural(k.withBonus, "participação", "participações")} com bônus` : readOnly ? `${k.withBonus} com bônus` : `${k.withBonus} com bônus hoje`} />
        {(() => {
          // Oficial (ciclos fechados) × projetado (ciclo aberto), nunca misturados sem aviso.
          const b = bonusSplit(k, brl, { label: isAll ? "Bônus somado" : readOnly ? "Bônus do ciclo" : "Bônus projetado", detail: isAll ? "Soma dos elegíveis de todos os ciclos" : "Soma dos elegíveis" });
          // Com as duas partes: oficial e projetado lado a lado, rotulados (nunca a soma como número principal).
          return b.both
            ? <StatTile className="col-span-2" label={b.label} value={<BonusPair official={b.official!} projected={b.projected!} format={brl} data-testid="kpi-bonus-pair" />} data-testid="kpi-bonus" />
            : <StatTile label={b.label} value={brl(b.single ?? k.bonusTotal)} detail={b.detail} data-testid="kpi-bonus" />;
        })()}
        <StatTile label="Avaliações enviadas" value={k.evaluationsSubmitted} detail={`Notas enviadas pelos avaliadores ${noCiclo}`} />
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
              A calibração move as notas em média <strong>{k.avgCalibrationShift > 0 ? "+" : ""}{n1(k.avgCalibrationShift)}</strong> {Math.abs(k.avgCalibrationShift) === 1 ? "ponto" : "pontos"} em {plural(k.calibratedCriteria, "critério calibrado", "critérios calibrados")}.
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
            <EmptyState compact icon={TrendingUp}
              title={readOnly ? (isAll ? "Nenhum evento com nota oficial" : "Nenhum evento com nota oficial neste ciclo") : "Sem eventos confirmados ainda"}
              description={readOnly ? "Não há evento confirmado com nota por critério no sistema para mostrar." : "A linha aparece quando houver resultados confirmados."} />
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
                        // Nota alta: rótulo ABAIXO do ponto — em cima ele encostava na linha do 100.
                        <text x={Number(x)} y={Number(value) >= 80 ? Number(y) + 20 : Number(y) - 10} textAnchor="end" dx={4} fontSize={12} fontWeight={700} fill="var(--foreground)" data-testid="trend-last-label">{n1(Number(value))}</text>
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
          subtitle={isAll ? "Participações somadas de todos os ciclos até quem recebeu bônus (cada ciclo com o seu mínimo de eventos)." : `Do total de participantes até quem recebe bônus (mínimo de ${k.minEvents} eventos).`}
          table={<DataTable head={["Etapa", isAll ? "Participações" : "Pessoas", "% do total"]} rows={funnel.map(f => [f.label, f.count, `${pct(f.count, funnel[0]?.count ?? 0)}%`])} />}
        >
          {/* Lista em vez de gráfico: rótulos inteiros num card estreito. Ordem
              e rótulos fixos (lib/bonus-funnel), iguais ao relatório e ao Excel. */}
          {!isFunnelMonotonic(funnel) && (
            <p className="text-[12px] mb-3 rounded-lg px-3 py-2" role="note" data-testid="funnel-inconsistent" style={{ backgroundColor: "var(--status-warn-bg)", color: "var(--status-warn-text)" }}>
              Uma etapa tem mais {isAll ? "participações" : "pessoas"} que a anterior (por exemplo, elegibilidade definida manualmente pelo RH sem o mínimo de eventos).
            </p>
          )}
          <ol className="space-y-3" aria-label="Funil do bônus">
            {funnel.map(f => {
              const total = funnel[0]?.count ?? 0;
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
          subtitle="Eventos confirmados, do mais fraco para o mais forte (0 a 100). Usa a nota calibrada quando existe; senão, a média dos avaliadores. Critério avaliado por duas áreas aparece uma vez por área; na nota do evento as duas entram pela média."
          table={data.criteria.length > 0 && (
            <DataTable
              head={["Critério", "Nota usada", "Avaliadores", "Calibrada", "Eventos"]}
              rows={data.criteria.map(c => [`${c.name}${c.area ? ` · ${c.area}` : ""}`, n1(c.avgScore), n1(c.evaluatorAvg), c.calibratedCount > 0 ? `${n1(c.calibratedAvg)} (${c.calibratedCount})` : "—", c.eventsCount])}
              sort={data.criteria.map(c => [`${c.name} ${c.area ?? ""}`, c.avgScore, c.evaluatorAvg, c.calibratedCount > 0 ? c.calibratedAvg : null, c.eventsCount])}
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
          subtitle={isAll ? "Resultados de todos os ciclos por faixa (cada pessoa conta uma vez por ciclo) e o bônus da faixa: oficial (ciclos fechados) e projetado (ciclo aberto)." : readOnly ? "Quantas pessoas ficaram em cada faixa pela nota final do ciclo, e o bônus da faixa." : "Quantas pessoas estão em cada faixa pela nota final do ciclo, e o bônus projetado da faixa."}
          table={split
            ? <DataTable head={["Faixa", "Participações", "Bônus oficial", "Bônus projetado"]} rows={data.faixas.map(f => { const s = split.get(f.name); return [f.name, f.count, s && s.official > 0 ? brl(s.official) : "—", s && s.projected > 0 ? brl(s.projected) : "—"]; })} sort={data.faixas.map(f => [f.minScore ?? 0, f.count, split.get(f.name)?.official ?? 0, split.get(f.name)?.projected ?? 0])} />
            : <DataTable head={["Faixa", isAll ? "Participações" : "Pessoas", isAll ? "Bônus (oficial + projetado)" : readOnly ? "Bônus oficial" : "Bônus projetado"]} rows={data.faixas.map(f => [f.name, f.count, f.bonusTotal > 0 ? brl(f.bonusTotal) : "—"])} sort={data.faixas.map(f => [f.minScore ?? 0, f.count, f.bonusTotal])} />}
        >
          {/* Cada faixa num bloco, com pessoas e bônus na MESMA linha do nome:
              antes o valor ficava solto entre duas faixas e não dava para saber de qual era. */}
          <ul>
            {data.faixas.map(f => (
              <li key={f.name} className="py-2.5 first:pt-0" style={{ borderBottom: "1px solid var(--border)" }} data-testid="faixa-row">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-2 min-w-0 text-[12.5px]">
                    {/* Faixa clara (Branco): contorno do Dashboard (faixaEdge) para o ponto não sumir no fundo claro. */}
                    <span aria-hidden className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: f.color ?? "var(--muted-foreground)", ...faixaEdge(f.color) }} />
                    <span className="font-semibold break-words min-w-0">{f.name}</span>
                    {f.minScore != null && <span className="shrink-0 text-[11px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{fmtNum(f.minScore, 2)}–{fmtNum(f.maxScore ?? 0, 2)}</span>}
                  </span>
                  <span className="text-[12px] tabular-nums text-right ml-auto">
                    <strong className="text-[13px]">{f.count}</strong> {isAll ? (f.count === 1 ? "participação" : "participações") : f.count === 1 ? "pessoa" : "pessoas"}
                    {split ? (() => {
                      const s = split.get(f.name) ?? { official: 0, projected: 0 };
                      if (s.official === 0 && s.projected === 0) return <span style={{ color: "var(--muted-foreground)" }}> · sem bônus</span>;
                      return (
                        <span style={{ color: "var(--muted-foreground)" }} data-testid="faixa-bonus-split">
                          {" · "}Oficial <strong style={{ color: "var(--foreground)" }}>{s.official > 0 ? brl(s.official) : "—"}</strong>
                          {" · "}Projetado <strong style={{ color: "var(--foreground)" }}>{s.projected > 0 ? brl(s.projected) : "—"}</strong>
                        </span>
                      );
                    })() : (
                      <span style={{ color: "var(--muted-foreground)" }}> · {f.bonusTotal > 0 ? <>{isAll ? "Oficial + projetado " : ""}{brl(f.bonusTotal)}</> : "sem bônus"}</span>
                    )}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
                  <div className="h-full rounded-full" style={{ width: `${(f.count / maxCount) * 100}%`, backgroundColor: SERIES }} />
                </div>
              </li>
            ))}
          </ul>
          {!isAll && !pertoCard && (
            <p className="text-[12px] pt-1" style={{ color: "var(--muted-foreground)" }} data-testid="near-next-faixa-empty">
              <strong style={{ color: "var(--foreground)" }}>Perto da próxima faixa:</strong> ninguém a menos de 3 pontos da próxima faixa que paga bônus.
            </p>
          )}
        </Card>

        {/* ── Perto da próxima faixa (só faz sentido num ciclo; some no Total geral; vazio, vira uma linha no cartão de faixas) ── */}
        {pertoCard && <Card
          span2
          title="Perto da próxima faixa"
          subtitle={readOnly ? "Elegíveis que ficaram a até 3 pontos da próxima faixa que paga bônus, e quanto teriam recebido." : "Elegíveis a até 3 pontos da próxima faixa que paga bônus, e quanto passariam a receber."}
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
                sort={data.nearNextFaixa.map(r => [r.name, r.finalResult, r.currentFaixa, r.nextFaixa, r.gap, r.currentBonus, r.potentialBonus])}
              />
            </div>
          )}
        </Card>}

        {/* ── Avaliadores ── */}
        <Card
          span2
          title="Avaliadores"
          subtitle='"Ajuste da calibração" compara a nota do avaliador com a calibrada (a partir de 3 casos). "Dias até enviar" conta a partir do fim do evento.'
        >
          {data.evaluators.length === 0 ? (
            <EmptyState compact title={`Nenhuma avaliação ${noCiclo}`} />
          ) : (
            <div className="overflow-x-auto">
              <DataTable
                head={["Avaliador", "Enviadas", "Nota média dada", "Ajuste da calibração", "Dias até enviar"]}
                rows={data.evaluators.map(e => [
                  e.name, e.submitted,
                  n1(e.avgGiven), biasBadge(e.calibrationBias ?? null, e.biasSamples), n1(e.avgDaysToSubmit),
                ])}
                sort={data.evaluators.map(e => [e.name, e.submitted, e.avgGiven, e.biasSamples >= 3 ? e.calibrationBias : null, e.avgDaysToSubmit])}
              />
            </div>
          )}
        </Card>

        {/* ── Penalidades e méritos ── */}
        <Card
          title="Penalidades e méritos"
          subtitle={isAll ? "Lançamentos de todos os ciclos por tipo." : "Lançamentos do ciclo por tipo."}
        >
          {data.adjustments.length === 0 ? (
            <EmptyState compact title={`Nenhum lançamento ${noCiclo}`} />
          ) : (
            <DataTable
              head={["Tipo", "Ocorr.", "Pontos", "Pessoas"]}
              rows={data.adjustments.map(a => [
                <span className="inline-flex items-center gap-2"><StatusBadge size="sm" variant={a.kind === "merit" ? "ok" : "danger"} label={a.kind === "merit" ? "Mérito" : "Penalidade"} />{a.label}</span>,
                a.occurrences, `${a.kind === "merit" ? "+" : "−"}${a.points}`, a.employees,
              ])}
              sort={data.adjustments.map(a => [a.label, a.occurrences, a.kind === "merit" ? a.points : -a.points, a.employees])}
            />
          )}
        </Card>

        {/* ── Pessoas: mais penalidades × mais méritos (sem ninguém, o cartão de cima já diz) ── */}
        {quemCard && <Card
          span2
          title="Quem mais perdeu e quem mais ganhou pontos"
          subtitle={`Colaboradores com mais pontos de penalidade e mais pontos de mérito ${noCiclo} (até 10 de cada).`}
        >
          <div className="grid gap-5 md:grid-cols-2">
            {([
              { key: "penalty", title: "Mais penalidades", people: data.topPenalized, sign: "−", variant: "danger" as const, empty: `Nenhuma penalidade ${noCiclo}` },
              { key: "merit", title: "Mais méritos", people: data.topMerited, sign: "+", variant: "ok" as const, empty: `Nenhum mérito ${noCiclo}` },
            ]).map(col => (
              <section key={col.key} aria-label={col.title} className="min-w-0">
                <h3 className="mb-1 text-[12px] font-black uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>{col.title}</h3>
                {col.people.length === 0 ? (
                  <EmptyState compact title={col.empty} />
                ) : (
                  <DataTable
                    head={["Colaborador", "Pontos", "Ocorr."]}
                    rows={col.people.map(p => [
                      <span className="flex flex-col">
                        {canTimeline ? (
                          <Link href={`/linha-do-tempo?colaborador=${p.employeeId}&tipo=lancamentos`} className="font-semibold hover:underline underline-offset-2"
                            title={`Ver na linha do tempo as faltas e méritos de ${p.name}`} data-testid={`link-timeline-${col.key}-${p.employeeId}`}>
                            {p.name}
                          </Link>
                        ) : <span className="font-semibold">{p.name}</span>}
                        <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{p.types.join(", ")}</span>
                      </span>,
                      <StatusBadge size="sm" variant={col.variant} label={`${col.sign}${fmtNum(p.points, Number.isInteger(p.points) ? 0 : 1)}`} />,
                      p.occurrences,
                    ])}
                    sort={col.people.map(p => [p.name, p.points, p.occurrences])}
                  />
                )}
              </section>
            ))}
          </div>
        </Card>}

        {/* ── Clientes: só quando os eventos têm cliente informado ── */}
        {clientsCard && <Card
          span2
          className={gridPlan.clientsSpan}
          style={gridPlan.ondeFirst ? { order: 2 } : undefined}
          title="Nota média por cliente"
          subtitle={`Clientes com mais eventos confirmados ${noCiclo} (até 12).`}
          table={<DataTable head={["Cliente", "Nota média", "Eventos"]} rows={realClients.map(c => [c.client, n1(c.avgScore), c.events])} sort={realClients.map(c => [c.client, c.avgScore, c.events])} />}
        >
          <HBars
              data={realClients}
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
        </Card>}

        {/* ── Próximos passos ── */}
        <section className={`rounded-xl p-5 flex flex-col gap-2 text-[13px] ${gridPlan.ondeSpan}`} style={{ backgroundColor: "var(--secondary)", ...(gridPlan.ondeFirst ? { order: 1 } : {}) }} data-testid="analytics-where-to-act">
          <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>{readOnly ? "Para consultar" : "Onde agir"}</h2>
          <p><Link href={scope.withCycle("/analytics/eventos")} className="font-semibold underline underline-offset-2" data-testid="link-events-report">Resultado por evento</Link> <span style={{ color: "var(--muted-foreground)" }}>— nota final calibrada, critérios e equipe de cada evento confirmado.</span></p>
          {canTimeline && <p><Link href="/linha-do-tempo" className="font-semibold underline underline-offset-2" data-testid="link-timeline">Linha do tempo</Link> <span style={{ color: "var(--muted-foreground)" }}>— o que mudou nas notas, dia a dia, e por quê.</span></p>}
          {readOnly && !isAll && <p style={{ color: "var(--muted-foreground)" }}>Edições e fechamento ficam no ciclo atual; o pagamento do bônus deste ciclo continua liberado em <Link href={scope.withCycle("/results")} className="font-semibold underline underline-offset-2" style={{ color: "var(--foreground)" }}>Resultados &amp; Ranking</Link>.</p>}
          {isAll && <p style={{ color: "var(--muted-foreground)" }}>As telas de trabalho (eventos, avaliações, calibrações) agem só no ciclo atual; o pagamento do bônus de cada ciclo fica em Resultados &amp; Ranking, no ciclo dele.</p>}
          {!readOnly && <p style={{ color: "var(--muted-foreground)" }}>Os números acima vêm das telas de trabalho:</p>}
          {!readOnly && <ul className="space-y-1.5">
            <li><Link href="/events?status=unconfirmed" className="font-semibold underline underline-offset-2">Eventos não confirmados</Link> <span style={{ color: "var(--muted-foreground)" }}>— não entram na nota.</span></li>
            <li><Link href="/evaluations" className="font-semibold underline underline-offset-2">Avaliações pendentes</Link> <span style={{ color: "var(--muted-foreground)" }}>— quem ainda não enviou e links de avaliação.</span></li>
            <li><Link href="/calibrations" className="font-semibold underline underline-offset-2">Calibrações</Link> <span style={{ color: "var(--muted-foreground)" }}>— ajuste e publicação.</span></li>
            <li><Link href="/results" className="font-semibold underline underline-offset-2">Resultados e bônus</Link> <span style={{ color: "var(--muted-foreground)" }}>— ranking e pagamentos.</span></li>
          </ul>}
        </section>
      </div>
    </div>
  );
}

/** Exportar: relatório para imprimir/salvar em PDF ou planilha Excel com todas as tabelas. */
function ExportMenu({ data, scope }: { data: AnalyticsOverview; scope: CycleScopeState }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const exportEventsXlsx = async () => {
    setBusy(true);
    try {
      await exportEventsReportXlsx(await getAnalyticsEventsReport(scope.params));
      toast({ title: "Planilha por evento exportada", description: "O arquivo foi salvo na pasta de downloads." });
    } catch (e) {
      toast({ title: "Não foi possível gerar a planilha", description: (e as Error)?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
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
        <DropdownMenuItem onSelect={() => navigate(scope.withCycle("/analytics/relatorio?imprimir=1"))} data-testid="menu-export-pdf">
          <FileText size={15} aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Relatório em PDF</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{scope.isAll ? "Análise de todos os ciclos + regras" : "Análise do ciclo + regras de negócio"}</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate(scope.withCycle("/analytics/eventos?imprimir=1"))} data-testid="menu-export-events-pdf">
          <FileText size={15} aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Relatório por evento (PDF)</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Nota final calibrada, critérios e equipe</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void exportEventsXlsx()} data-testid="menu-export-events-xlsx">
          <FileSpreadsheet size={15} aria-hidden />
          <span className="flex flex-col">
            <span className="font-semibold">Planilha por evento</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Eventos, critérios e equipes</span>
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
