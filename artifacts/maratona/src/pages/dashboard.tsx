import { useGetDashboardSummary, useGetDashboardTopEmployees, useGetDashboardQuarterlyEvolution, useGetDashboardPlatoonDistribution, useGetCurrentCycle, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, Trophy, DollarSign, History, AlertTriangle, Clock, ChevronRight, CalendarRange, Shapes } from "lucide-react";
import { Link } from "wouter";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { PremiumCard, CONDENSED, WARNING } from "@/lib/premium-theme";

export default function DashboardPage() {
  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: topEmployees } = useGetDashboardTopEmployees();
  const { data: evolution } = useGetDashboardQuarterlyEvolution();
  const { data: platoons } = useGetDashboardPlatoonDistribution();
  const { data: cycle } = useGetCurrentCycle();

  const fmt = (v: number) => `${v.toFixed(1)}/100`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const submitted = summary?.submittedEvaluations ?? 0;
  const pending = summary?.pendingEvaluations ?? 0;
  // submitted + pending = total de eventos com alguma avaliação; o percentual
  // reflete eventos com todas as avaliações concluídas vs total com avaliações.
  const progress = submitted + pending > 0 ? Math.round((submitted / (submitted + pending)) * 100) : 0;
  const cyclePeriod = cycle ? formatCyclePeriod(cycle.startDate, cycle.endDate) : null;

  return (
    <div className="p-6 md:p-10 space-y-8">
      {/* Header */}
      <header className="flex flex-wrap gap-4 justify-between items-center">
        <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
          Painel de Controle
        </h1>
        {cycle && (
          <div
            data-testid="badge-cycle-period"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
          >
            <CalendarRange size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
            <span className="flex flex-col leading-tight">
              <span className="font-bold uppercase text-xs tracking-wider" style={{ fontFamily: CONDENSED }}>{cycle.name}</span>
              <span className="text-[11px] font-medium tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                {cyclePeriod ?? "Período não definido"}
              </span>
            </span>
          </div>
        )}
      </header>

      {/* 1. KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Média Geral */}
        <PremiumCard className="p-6 h-40 flex flex-col justify-between relative overflow-hidden group">
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Média do Ciclo</p>
            <h2 data-testid="text-quarter-avg" className="text-[40px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>
              {summary?.quarterAverage != null ? summary.quarterAverage.toFixed(1) : "—"}
            </h2>
            <p className="text-[11px] font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>Pontos no ciclo</p>
          </div>
          <div className="absolute -right-3 -bottom-3 opacity-[0.06] group-hover:scale-110 transition-transform duration-500">
            <Trophy size={110} strokeWidth={1.5} />
          </div>
        </PremiumCard>

        {/* Eventos */}
        <PremiumCard className="p-6 h-40 flex flex-col justify-between relative overflow-hidden group">
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Eventos Confirmados</p>
            <h2 data-testid="text-total-events" className="text-[40px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{summary?.totalEvents ?? "—"}</h2>
            <p className="text-[11px] font-semibold mt-1 flex items-center gap-1" style={{ color: "var(--accent)" }}>
              <CheckCircle2 size={12} /> de {summary?.eventsInCycle ?? 0} no ciclo
            </p>
          </div>
          <div className="absolute -right-3 -bottom-3 opacity-[0.06] group-hover:scale-110 transition-transform duration-500">
            <CheckCircle2 size={110} strokeWidth={1.5} />
          </div>
        </PremiumCard>

        {/* Progresso de Avaliações (hero) */}
        <div
          className="rounded-xl p-6 h-40 flex flex-col justify-between relative overflow-hidden"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-70" style={{ fontFamily: CONDENSED }}>Progresso de Avaliações</p>
            <h2 data-testid="text-eval-progress" className="text-[40px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{progress}%</h2>
            <p className="text-[11px] font-medium opacity-70 mt-1">{pending} {pending === 1 ? "evento pendente" : "eventos pendentes"}</p>
          </div>
          <div className="w-full mt-auto rounded-full h-2.5 overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.15)" }}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progress}%`, backgroundColor: "var(--primary-foreground)" }} />
          </div>
        </div>

        {/* Bônus Projetado */}
        <PremiumCard className="p-6 h-40 flex flex-col justify-between relative overflow-hidden group">
          <div className="z-10">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Bônus Projetado</p>
            <h2 data-testid="text-projected-bonus" className="text-[30px] leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>
              {summary?.totalBonusPreview != null ? fmtBRL(summary.totalBonusPreview) : "—"}
            </h2>
            <p className="text-[11px] font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>Estimativa do ciclo</p>
          </div>
          <div className="absolute -right-3 -bottom-3 opacity-[0.06] group-hover:scale-110 transition-transform duration-500">
            <DollarSign size={110} strokeWidth={1.5} />
          </div>
        </PremiumCard>
      </section>

      {/* 2. Evolução de Performance */}
      {evolution && evolution.length > 0 && (
        <PremiumCard className="p-6 md:p-8">
          <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Evolução de Performance</h3>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Média de pontos por ciclo</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={evolution} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" axisLine={{ stroke: "var(--border)" }} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "var(--muted-foreground)" }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v as number).toFixed(0)}`} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} domain={[0, 100]} />
              <Tooltip
                cursor={{ fill: "rgba(154,176,0,0.1)" }}
                contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", backgroundColor: "var(--card)", color: "var(--foreground)", fontWeight: 600, fontSize: 12 }}
                formatter={v => [`${(v as number).toFixed(1)} pts`, "Média"]}
              />
              <Bar dataKey="average" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {evolution.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? "var(--accent)" : "var(--secondary)"} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="average" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 6" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </PremiumCard>
      )}

      {/* 3. Top Performance + Distribuição de Pelotões */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
        <PremiumCard className="overflow-hidden flex flex-col">
          <div className="p-6 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
            <h3 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Top Performance</h3>
            <History size={20} style={{ color: "var(--muted-foreground)" }} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="p-4 text-xs font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Pos</th>
                  <th className="p-4 text-xs font-bold uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Colaborador</th>
                  <th className="p-4 text-xs font-bold uppercase text-right" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Nota</th>
                </tr>
              </thead>
              <tbody>
                {(!topEmployees || topEmployees.length === 0) && (
                  <tr><td colSpan={3} className="p-6 text-sm font-semibold text-center" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado consolidado.</td></tr>
                )}
                {topEmployees?.slice(0, 6).map((emp, i) => (
                  <tr key={emp.employeeId} className="transition-colors hover:opacity-80" style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="p-4 text-lg font-black w-12" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{String(i + 1).padStart(2, "0")}</td>
                    <td className="p-4 text-base font-bold">{emp.employeeName}</td>
                    <td className="p-4 text-right text-lg font-black" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{fmt(emp.finalResult)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        <PremiumCard className="p-6">
          <h3 className="text-sm font-black uppercase flex items-center gap-2 mb-1" style={{ fontFamily: CONDENSED }}>
            <Shapes size={16} style={{ color: "var(--accent)" }} /> Distribuição de Pelotões
          </h3>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>Colaboradores com resultado apurado neste ciclo</p>
          {!platoons || platoons.length === 0 ? (
            <p className="text-sm font-semibold text-center py-6" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado apurado ainda.</p>
          ) : (
            <>
              <div className="w-full h-3 rounded-full overflow-hidden flex mb-4" style={{ backgroundColor: "var(--secondary)" }}>
                {platoons.map(p => (
                  <div key={p.platoonName} style={{ width: `${p.percentage}%`, backgroundColor: p.color }} title={p.platoonName} />
                ))}
              </div>
              <div className="space-y-2.5">
                {platoons.map(p => (
                  <div key={p.platoonName} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-semibold truncate">{p.platoonName}</span>
                    </div>
                    <span className="text-sm font-bold shrink-0" style={{ color: "var(--muted-foreground)" }}>
                      {p.count} <span className="opacity-60">({p.percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </PremiumCard>
      </div>

      {/* 4. Alerts — quando só um dos dois tem conteúdo, evita o card sobrar
          sozinho numa grade de 2 colunas com metade da tela vazia. */}
      {(() => {
        const hasRisk = !!summary?.atRiskEmployees && summary.atRiskEmployees.length > 0;
        const hasPendencies = !!summary?.eventsWithPendencies && summary.eventsWithPendencies.length > 0;
        if (!hasRisk && !hasPendencies) return null;
        return (
        <div className={hasRisk && hasPendencies ? "grid grid-cols-1 lg:grid-cols-2 gap-5" : "grid grid-cols-1 max-w-xl"}>
          {summary?.atRiskEmployees && summary.atRiskEmployees.length > 0 && (
            <PremiumCard className="p-6" style={{ borderColor: WARNING }}>
              <h3 className="text-sm font-black uppercase flex items-center gap-2 mb-4" style={{ fontFamily: CONDENSED, color: WARNING }}>
                <AlertTriangle size={16} /> Zona de Risco
              </h3>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {summary.atRiskEmployees.map(emp => (
                  <div key={emp.employeeId} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: "rgba(229,72,77,0.08)" }}>
                    <span className="text-sm font-semibold break-words flex-1 pr-2">{emp.employeeName}</span>
                    <span className="text-sm font-black text-white px-2 py-0.5 rounded" style={{ backgroundColor: WARNING }}>{fmt(emp.currentScore ?? 0)}</span>
                  </div>
                ))}
              </div>
            </PremiumCard>
          )}

          {summary?.eventsWithPendencies && summary.eventsWithPendencies.length > 0 && (
            <PremiumCard className="p-6">
              <h3 className="text-sm font-black uppercase flex items-center gap-2 mb-4" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>
                <Clock size={16} /> Eventos Pendentes
              </h3>
              <div className="space-y-2">
                {summary.eventsWithPendencies.slice(0, 5).map(ev => (
                  <Link key={ev.eventId} href={`/events/${ev.eventId}`} className="flex items-center justify-between p-3 rounded-lg transition-colors hover:opacity-80" style={{ backgroundColor: "var(--secondary)" }}>
                    <span className="text-sm font-semibold flex-1 pr-2">{ev.eventName}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{ev.pendingCount} pend. <ChevronRight size={12} /></span>
                  </Link>
                ))}
              </div>
            </PremiumCard>
          )}
        </div>
        );
      })()}
    </div>
  );
}
