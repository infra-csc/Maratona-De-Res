import { useGetDashboardSummary, useGetDashboardPlatoonDistribution, useGetDashboardTopEmployees, useGetDashboardQuarterlyEvolution, getGetDashboardSummaryQueryKey, getGetDashboardPlatoonDistributionQueryKey } from "@workspace/api-client-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { CheckCircle2, Users, Trophy, DollarSign, History, AlertTriangle, Clock, ChevronRight } from "lucide-react";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { CycleBadge } from "@/components/cycle-badge";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

export default function DashboardPage() {
  const { data: summary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });
  const { data: distribution } = useGetDashboardPlatoonDistribution({
    query: { queryKey: getGetDashboardPlatoonDistributionQueryKey() },
  });
  const { data: topEmployees } = useGetDashboardTopEmployees();
  const { data: evolution } = useGetDashboardQuarterlyEvolution();

  const fmt = (v: number) => `${v.toFixed(1)}/100`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const submitted = summary?.submittedEvaluations ?? 0;
  const pending = summary?.pendingEvaluations ?? 0;
  const progress = submitted + pending > 0 ? Math.round((submitted / (submitted + pending)) * 100) : 0;
  const ghostPos = Math.max(0, progress - 7);

  const platoonRanking = [...(distribution ?? [])].sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f7f9fb] border-b-4 border-[#191c1e] flex flex-wrap gap-4 justify-between items-center px-6 md:px-10 py-4">
        <h1 data-testid="text-page-title" className="text-2xl md:text-3xl italic font-black text-[#506600] uppercase tracking-tighter">
          Painel de Controle
        </h1>
        <CycleBadge />
      </header>

      <div className="p-6 md:p-10 space-y-10">
        {/* 1. KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Média Geral */}
          <div className="bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden group">
            <div className="z-10">
              <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Média do Ciclo</p>
              <h2 data-testid="text-quarter-avg" className="text-[40px] leading-none italic font-black mt-2">
                {summary?.quarterAverage != null ? summary.quarterAverage.toFixed(1) : "—"}
              </h2>
              <p className="text-[11px] font-bold uppercase italic opacity-50 mt-1">Pontos no ciclo</p>
            </div>
            <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Trophy size={110} strokeWidth={1.5} />
            </div>
            <div className="w-full h-2 bg-[#191c1e] mt-auto" />
          </div>

          {/* Eventos */}
          <div className="bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden group">
            <div className="z-10">
              <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Eventos</p>
              <h2 data-testid="text-total-events" className="text-[40px] leading-none italic font-black mt-2">{summary?.totalEvents ?? "—"}</h2>
              <p className="text-[11px] font-bold uppercase italic text-[#506600] mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} /> {summary?.eventsInCalibration ?? 0} Fechados
              </p>
            </div>
            <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <CheckCircle2 size={110} strokeWidth={1.5} />
            </div>
            <div className="w-full h-2 bg-[#191c1e] mt-auto" />
          </div>

          {/* Progresso de Avaliações (lime hero) */}
          <div className={`bg-[#ccff00] border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden ${HARD_SHADOW}`}>
            <div>
              <p className="text-xs font-bold uppercase italic tracking-wider text-[#161e00]">Progresso de Avaliações</p>
              <h2 data-testid="text-eval-progress" className="text-[40px] leading-none italic font-black mt-2">{progress}%</h2>
              <p className="text-[11px] font-bold uppercase italic opacity-60 mt-1">{pending} pendentes</p>
            </div>
            <div className="w-full mt-auto border-2 border-[#191c1e] h-3 relative bg-[#e0e3e5]">
              <div className="h-full bg-[#191c1e] transition-[width] duration-700" style={{ width: `${progress}%` }} />
              <div className="absolute -top-1 -bottom-1 w-1 bg-[#506600] z-10" style={{ left: `${ghostPos}%` }} />
            </div>
          </div>

          {/* Bônus Projetado */}
          <div className="bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden group">
            <div className="z-10">
              <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Bônus Projetado</p>
              <h2 data-testid="text-projected-bonus" className="text-[32px] leading-none italic font-black mt-2 text-[#506600]">
                {summary?.totalBonusPreview != null ? fmtBRL(summary.totalBonusPreview) : "—"}
              </h2>
              <p className="text-[11px] font-bold uppercase italic opacity-50 mt-1">Estimativa do ciclo</p>
            </div>
            <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <DollarSign size={110} strokeWidth={1.5} />
            </div>
            <div className="w-full h-2 bg-[#506600] mt-auto" />
          </div>
        </section>

        {/* 2. Evolução de Performance */}
        {evolution && evolution.length > 0 && (
          <section className="bg-white border-2 border-[#191c1e] p-6 md:p-8">
            <div className="flex flex-wrap justify-between items-end gap-3 mb-8">
              <div>
                <h3 className="text-xl md:text-2xl italic uppercase font-black">Evolução de Performance</h3>
                <p className="text-sm text-[#444933]">Média de pontos por ciclo</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={evolution} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#e0e3e5" />
                <XAxis dataKey="label" axisLine={{ stroke: "#191c1e", strokeWidth: 2 }} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fontStyle: "italic", fill: "#191c1e" }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v as number).toFixed(0)}`} tick={{ fontSize: 11, fill: "#747a60" }} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "rgba(204,255,0,0.15)" }}
                  contentStyle={{ borderRadius: 0, border: "2px solid #191c1e", boxShadow: "4px 4px 0 0 #191c1e", fontWeight: 700, fontStyle: "italic", textTransform: "uppercase", fontSize: 12 }}
                  formatter={v => [`${(v as number).toFixed(1)} pts`, "Média"]}
                />
                <Bar dataKey="average" radius={0} maxBarSize={56} stroke="#191c1e" strokeWidth={2}>
                  {evolution.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? "#ccff00" : "#e0e3e5"} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="average" stroke="#191c1e" strokeWidth={3} strokeDasharray="8 8" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </section>
        )}

        {/* 3. Bottom grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Pelotões */}
          <section className="lg:col-span-1 bg-white border-2 border-[#191c1e] p-6 flex flex-col">
            <h3 className="text-xl italic uppercase font-black mb-6 border-b-4 border-[#506600] pb-2">Top Pelotões</h3>
            <div className="space-y-4">
              {platoonRanking.length === 0 && (
                <p className="text-sm italic uppercase font-bold text-[#747a60]">Sem dados de pelotão.</p>
              )}
              {platoonRanking.map((p, i) => (
                <div
                  key={p.platoonName}
                  className={`flex items-center gap-4 border-2 border-[#191c1e] p-4 skew-x-[-3deg] ${i === 0 ? `bg-[#ccff00] ${HARD_SHADOW}` : ""}`}
                >
                  <span className={`text-2xl italic font-black ${i === 0 ? "text-[#191c1e]" : "text-[#747a60] opacity-50"}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 skew-x-[3deg]">
                    <p className="text-sm font-black uppercase italic">{p.platoonName}</p>
                    <p className="text-[11px] font-bold opacity-60 italic uppercase">{p.count} colaboradores · {p.percentage}%</p>
                  </div>
                  {i === 0
                    ? <Trophy size={22} className="text-[#191c1e] skew-x-[3deg]" />
                    : <span className="w-7 h-7 border-2 border-[#191c1e] skew-x-[3deg]" style={{ backgroundColor: p.color }} />}
                </div>
              ))}
            </div>
          </section>

          {/* Top Performance */}
          <section className="lg:col-span-2 bg-white border-2 border-[#191c1e] overflow-hidden flex flex-col">
            <div className="p-6 border-b-2 border-[#191c1e] flex justify-between items-center bg-[#f2f4f6]">
              <h3 className="text-xl italic uppercase font-black">Top Performance</h3>
              <History size={20} className="text-[#444933]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#e6e8ea]">
                    <th className="p-4 text-xs font-bold italic uppercase border-b-2 border-[#191c1e]">Pos</th>
                    <th className="p-4 text-xs font-bold italic uppercase border-b-2 border-[#191c1e]">Colaborador</th>
                    <th className="p-4 text-xs font-bold italic uppercase border-b-2 border-[#191c1e]">Pelotão</th>
                    <th className="p-4 text-xs font-bold italic uppercase border-b-2 border-[#191c1e] text-right">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {(!topEmployees || topEmployees.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-sm italic uppercase font-bold text-[#747a60] text-center">Nenhum resultado consolidado.</td></tr>
                  )}
                  {topEmployees?.slice(0, 6).map((emp, i) => (
                    <tr key={emp.employeeId} className="border-b border-[#c4c9ac] hover:bg-[#f2f4f6] transition-colors">
                      <td className="p-4 text-lg italic font-black w-12">{String(i + 1).padStart(2, "0")}</td>
                      <td className="p-4 text-base italic font-bold uppercase">{emp.employeeName}</td>
                      <td className="p-4"><PlatoonBadge platoon={emp.platoon} colorHex={emp.platoonColor} /></td>
                      <td className="p-4 text-right text-lg italic font-black text-[#506600]">{fmt(emp.finalResult)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* 4. Alerts */}
        {((summary?.atRiskEmployees && summary.atRiskEmployees.length > 0) || (summary?.eventsWithPendencies && summary.eventsWithPendencies.length > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {summary?.atRiskEmployees && summary.atRiskEmployees.length > 0 && (
              <section className="bg-white border-2 border-[#ba1a1a] p-6">
                <h3 className="text-sm font-black uppercase italic flex items-center gap-2 text-[#ba1a1a] mb-4">
                  <AlertTriangle size={16} /> Zona de Risco
                </h3>
                <div className="space-y-2">
                  {summary.atRiskEmployees.map(emp => (
                    <div key={emp.employeeId} className="flex items-center justify-between p-3 border-2 border-[#ffdad6] bg-[#ffdad6]/30">
                      <span className="text-sm font-bold italic uppercase truncate flex-1 pr-2">{emp.employeeName}</span>
                      <span className="text-sm font-black italic text-white bg-[#ba1a1a] px-2 py-0.5">{fmt(emp.currentScore ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {summary?.eventsWithPendencies && summary.eventsWithPendencies.length > 0 && (
              <section className="bg-white border-2 border-[#b02f00] p-6">
                <h3 className="text-sm font-black uppercase italic flex items-center gap-2 text-[#b02f00] mb-4">
                  <Clock size={16} /> Eventos Pendentes
                </h3>
                <div className="space-y-2">
                  {summary.eventsWithPendencies.slice(0, 5).map(ev => (
                    <div key={ev.eventId} className="flex items-center justify-between p-3 border-2 border-[#ffdbd1] bg-[#ffdbd1]/30">
                      <span className="text-sm font-bold italic uppercase truncate flex-1 pr-2">{ev.eventName}</span>
                      <span className="text-xs font-black italic text-white bg-[#b02f00] px-2 py-0.5 flex items-center gap-1">{ev.pendingCount} pend. <ChevronRight size={12} /></span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
