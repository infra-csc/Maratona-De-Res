import { useState } from "react";
import { useGetDashboardSummary, useGetDashboardPlatoonDistribution, useGetDashboardTopEmployees, useGetDashboardQuarterlyEvolution, getGetDashboardSummaryQueryKey, getGetDashboardPlatoonDistributionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Calendar, Users, ClipboardList, TrendingUp, Award, AlertTriangle, Target, CheckCircle2, DollarSign, Clock } from "lucide-react";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function DashboardPage() {
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);

  const { data: summary } = useGetDashboardSummary({ year, quarter }, {
    query: { queryKey: getGetDashboardSummaryQueryKey({ year, quarter }) },
  });
  const { data: distribution } = useGetDashboardPlatoonDistribution({ year, quarter }, {
    query: { queryKey: getGetDashboardPlatoonDistributionQueryKey({ year, quarter }) },
  });
  const { data: topEmployees } = useGetDashboardTopEmployees({ year, quarter });
  const { data: evolution } = useGetDashboardQuarterlyEvolution({ year });

  const fmt = (v: number) => `${v.toFixed(1)}/100`;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold text-foreground tracking-tight">Inteligência Operacional</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhamento estratégico da Maratona de Resultados</p>
        </div>
        <div className="flex gap-3 bg-white p-1.5 rounded-lg border shadow-sm">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger data-testid="select-year" className="w-28 border-none shadow-none bg-slate-50 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-px bg-border my-1" />
          <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
            <SelectTrigger data-testid="select-quarter" className="w-32 border-none shadow-none bg-slate-50 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1º Trimestre</SelectItem>
              <SelectItem value="2">2º Trimestre</SelectItem>
              <SelectItem value="3">3º Trimestre</SelectItem>
              <SelectItem value="4">4º Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-gradient-to-br from-sidebar to-sidebar-accent text-white overflow-hidden relative">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
            <TrendingUp size={100} />
          </div>
          <CardContent className="p-6 relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-white/80 uppercase tracking-wider mb-1">Média Geral</p>
                <p data-testid="text-quarter-avg" className="text-4xl font-black">
                  {summary?.quarterAverage != null ? summary.quarterAverage.toFixed(1) : "—"}
                </p>
                <p className="text-sm text-white/70 mt-1">Pontos no trimestre</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total de Eventos</p>
                <p data-testid="text-total-events" className="text-3xl font-bold text-foreground">{summary?.totalEvents ?? "—"}</p>
                <div className="flex gap-3 mt-2 text-xs font-medium">
                  <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12}/> {summary?.eventsInCalibration ?? 0} Fechados</span>
                </div>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl"><Calendar className="text-primary" size={24} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Times Avaliados</p>
                <p data-testid="text-employees-evaluated" className="text-3xl font-bold text-foreground">{summary?.totalEmployeesEvaluated ?? "—"}</p>
                <div className="flex gap-3 mt-2 text-xs font-medium">
                  <span className="text-amber-600 flex items-center gap-1"><Clock size={12}/> {summary?.pendingEvaluations ?? 0} Pendentes</span>
                </div>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl"><Users className="text-primary" size={24} /></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Bônus Projetado</p>
                <p data-testid="text-projected-bonus" className="text-3xl font-bold text-green-600">{summary?.totalBonusPreview ? fmtBRL(summary.totalBonusPreview) : "—"}</p>
                <p className="text-xs text-muted-foreground mt-2 font-medium">Estimativa atual do trimestre</p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl"><DollarSign className="text-green-600" size={24} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {evolution && evolution.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2 px-6 pt-6 border-b border-slate-100 mb-4">
                <CardTitle className="text-lg font-bold">Evolução de Performance — {year}</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={evolution} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${(v as number).toFixed(0)}`} tick={{ fontSize: 12, fill: '#64748b' }} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{fill: '#f1f5f9'}}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      formatter={v => [`${(v as number).toFixed(1)} pontos`, "Média"]} 
                    />
                    <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {topEmployees && topEmployees.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-4 px-6 pt-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Award size={20} className="text-yellow-500" />
                    Top Performance
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {topEmployees.slice(0, 5).map((emp, i) => (
                    <div key={emp.employeeId} className="flex items-center gap-4 py-4 px-6 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-sm font-bold text-slate-500 shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-foreground">{emp.employeeName}</p>
                      </div>
                      <PlatoonBadge platoon={emp.platoon} colorHex={emp.platoonColor} className="shrink-0" />
                      <div className="text-right shrink-0 min-w-16">
                        <span className="text-lg font-bold text-primary">{fmt(emp.finalResult)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {distribution && distribution.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="pb-2 px-6 pt-6">
                <CardTitle className="text-lg font-bold">Distribuição por Pelotão</CardTitle>
              </CardHeader>
              <CardContent className="px-6 pb-6 pt-0">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie 
                      data={distribution} 
                      dataKey="count" 
                      nameKey="platoonName" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60}
                      outerRadius={80} 
                      paddingAngle={2}
                    >
                      {distribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      formatter={(v, n) => [v, n]} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {distribution.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="font-medium text-slate-700">{d.platoonName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{d.count}</span>
                        <span className="text-muted-foreground w-8 text-right">{d.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {summary?.atRiskEmployees && summary.atRiskEmployees.length > 0 && (
            <Card className="border border-red-200 shadow-sm bg-red-50/50">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700 uppercase tracking-wider">
                  <AlertTriangle size={16} />
                  Atenção: Zona de Risco
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-2">
                <div className="space-y-2">
                  {summary.atRiskEmployees.map((emp) => (
                    <div key={emp.employeeId} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-red-100">
                      <span className="text-sm font-semibold truncate flex-1 pr-2">{emp.employeeName}</span>
                      <span className="text-sm font-black text-red-600 bg-red-50 px-2 py-0.5 rounded">{fmt(emp.currentScore ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {summary?.eventsWithPendencies && summary.eventsWithPendencies.length > 0 && (
            <Card className="border border-amber-200 shadow-sm bg-amber-50/50">
              <CardHeader className="pb-2 px-5 pt-5">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700 uppercase tracking-wider">
                  <Clock size={16} />
                  Eventos Pendentes
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-2">
                <div className="space-y-2">
                  {summary.eventsWithPendencies.slice(0,5).map(ev => (
                    <div key={ev.eventId} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-amber-100">
                      <span className="text-sm font-medium truncate flex-1 pr-2">{ev.eventName}</span>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{ev.pendingCount} pend.</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
