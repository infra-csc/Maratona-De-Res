import { useState } from "react";
import { useGetDashboardSummary, useGetDashboardPlatoonDistribution, useGetDashboardTopEmployees, useGetDashboardQuarterlyEvolution, getGetDashboardSummaryQueryKey, getGetDashboardPlatoonDistributionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Calendar, Users, ClipboardList, TrendingUp, Award, AlertTriangle } from "lucide-react";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function DashboardPage() {
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);

  const params = { year, quarter };

  const { data: summary } = useGetDashboardSummary({ year, quarter }, {
    query: { queryKey: getGetDashboardSummaryQueryKey({ year, quarter }) },
  });
  const { data: distribution } = useGetDashboardPlatoonDistribution({ year, quarter }, {
    query: { queryKey: getGetDashboardPlatoonDistributionQueryKey({ year, quarter }) },
  });
  const { data: topEmployees } = useGetDashboardTopEmployees({ year, quarter });
  const { data: evolution } = useGetDashboardQuarterlyEvolution({ year });

  const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral do desempenho da equipe</p>
        </div>
        <div className="flex gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger data-testid="select-year" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
            <SelectTrigger data-testid="select-quarter" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">T1</SelectItem>
              <SelectItem value="2">T2</SelectItem>
              <SelectItem value="3">T3</SelectItem>
              <SelectItem value="4">T4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Eventos</p>
                <p data-testid="text-total-events" className="text-3xl font-bold mt-1">{summary?.totalEvents ?? "—"}</p>
              </div>
              <Calendar className="text-primary opacity-60" size={24} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Colaboradores Avaliados</p>
                <p data-testid="text-employees-evaluated" className="text-3xl font-bold mt-1">{summary?.totalEmployeesEvaluated ?? "—"}</p>
              </div>
              <Users className="text-primary opacity-60" size={24} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avaliações Pendentes</p>
                <p data-testid="text-pending-evals" className="text-3xl font-bold mt-1 text-destructive">{summary?.pendingEvaluations ?? "—"}</p>
              </div>
              <ClipboardList className="text-destructive opacity-60" size={24} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média do Trimestre</p>
                <p data-testid="text-quarter-avg" className="text-3xl font-bold mt-1">
                  {summary?.quarterAverage != null ? fmt(summary.quarterAverage) : "—"}
                </p>
              </div>
              <TrendingUp className="text-primary opacity-60" size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {distribution && distribution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribuição por Pelotão</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distribution} dataKey="count" nameKey="platoonName" cx="50%" cy="50%" outerRadius={80} label={entry => `${entry.platoonName} (${entry.count})`} labelLine={false}>
                    {distribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => [v, "Colaboradores"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {evolution && evolution.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução Trimestral — {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} domain={[0, 1]} />
                  <Tooltip formatter={v => [`${((v as number) * 100).toFixed(1)}%`, "Média"]} />
                  <Bar dataKey="average" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {topEmployees && topEmployees.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Award size={16} className="text-yellow-500" />
              Top 10 Colaboradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topEmployees.map((emp, i) => (
                <div key={emp.employeeId} data-testid={`row-top-employee-${emp.employeeId}`} className="flex items-center gap-3 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="text-sm font-bold text-muted-foreground w-6 text-right">{i + 1}.</span>
                  <span className="flex-1 text-sm font-medium">{emp.employeeName}</span>
                  {emp.platoon && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (emp.platoonColor ?? "#94a3b8") + "20", color: emp.platoonColor ?? "#94a3b8" }}>
                      {emp.platoon}
                    </span>
                  )}
                  <span className="text-sm font-bold text-primary">{fmt(emp.finalResult)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary?.eventsWithPendencies && summary.eventsWithPendencies.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle size={16} />
              Eventos com Pendências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {summary.eventsWithPendencies.map(ev => (
                <div key={ev.eventId} className="flex items-center justify-between py-1 px-2 rounded-md bg-destructive/5">
                  <span className="text-sm">{ev.eventName}</span>
                  <span className="text-xs text-destructive font-medium">{ev.pendingCount} pendente(s)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
