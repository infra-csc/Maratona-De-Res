import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy, Target, Calendar, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronRight,
  MapPin, DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { StatusBadge } from "@/components/ui/status-badge";

const QUARTER_LABELS = ["1º Trimestre", "2º Trimestre", "3º Trimestre", "4º Trimestre"];
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

function usePeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

interface PerformanceData {
  employee: { id: number; name: string; department: string; functionName: string };
  period: { year: number; quarter: number };
  summary: {
    grossAverage: number | null;
    currentPlatoon: string | null;
    projectedBonus: number | null;
    evaluatedEvents: number;
    pendingEvents: number;
    totalAbsences: number;
    isQuarterClosed: boolean;
    finalResult: number | null;
    absencePenalty: number | null;
  };
  events: EventSummary[];
}

interface EventSummary {
  eventId: number;
  eventName: string;
  city: string;
  state: string;
  startDate: string;
  status: string;
  eventScore: number;
  projectedPlatoon: string | null;
  projectedPlatoonColor: string | null;
  evaluatedCriteria: number;
  totalCriteria: number;
  isPending: boolean;
  criteriaDetails: CriterionDetail[];
}

interface CriterionDetail {
  criterionId: number;
  criterionName: string;
  criterionDescription: string;
  weight: number;
  scoreUsed: number | null;
  criterionTotal: number | null;
  hasCalibration: boolean;
  publicComments: string[];
  evaluated: boolean;
}

function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all bg-white mb-4">
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left gap-4"
        >
          <div className="flex items-start gap-4 min-w-0 w-full">
            <div className="mt-1 shrink-0 bg-slate-100 p-2 rounded-full text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <StatusBadge status={event.status} />
                {event.isPending && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Ação Pendente</Badge>}
              </div>
              <p className="font-bold text-base truncate text-slate-900">{event.eventName}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1"><MapPin size={12} /> {event.city}/{event.state}</span>
                {event.startDate && <span>{new Date(event.startDate).toLocaleDateString("pt-BR")}</span>}
                <span className="bg-slate-100 px-2 py-0.5 rounded-md">Quesitos: {event.evaluatedCriteria}/{event.totalCriteria}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
            {event.projectedPlatoon && <PlatoonBadge platoon={event.projectedPlatoon} colorHex={event.projectedPlatoonColor} />}
            
            {event.eventScore > 0 && (
              <div className="text-right bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10">
                <span className="block text-[10px] uppercase font-bold text-primary mb-0.5">Nota</span>
                <span className="font-black text-xl text-primary">{event.eventScore.toFixed(1)}</span>
              </div>
            )}
          </div>
        </button>

        {open && (
          <div className="border-t bg-slate-50/80 p-5 md:p-6 space-y-4">
            <h4 className="font-semibold text-sm uppercase tracking-wide text-slate-500 mb-2">Detalhamento dos Critérios</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {event.criteriaDetails.map(c => (
                <div key={c.criterionId} className="bg-white rounded-xl border p-4 shadow-sm relative overflow-hidden">
                  {c.hasCalibration && <div className="absolute top-0 right-0 w-8 h-8 bg-amber-100 transform rotate-45 translate-x-4 -translate-y-4"></div>}
                  
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">Peso {c.weight}</span>
                        {c.evaluated && !c.hasCalibration && <span className="text-[10px] text-green-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> Avaliado</span>}
                        {c.hasCalibration && <span className="text-[10px] text-amber-700 font-bold flex items-center gap-1"><AlertTriangle size={12}/> Calibrado</span>}
                      </div>
                      <p className="font-bold text-sm text-slate-800 leading-tight">{c.criterionName}</p>
                    </div>
                    
                    <div className="text-right shrink-0">
                      {c.scoreUsed !== null ? (
                        <div className="flex items-end gap-1">
                          <span className="font-black text-2xl text-slate-900 leading-none">{c.scoreUsed.toFixed(1)}</span>
                          <span className="text-xs font-bold text-slate-400 pb-1">/5</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200">Pendente</Badge>
                      )}
                    </div>
                  </div>
                  
                  {c.publicComments.length > 0 && (
                    <div className="mt-4 space-y-2 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Feedbacks da equipe avaliadora</p>
                      {c.publicComments.map((comment, i) => (
                        <div key={i} className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 rounded-l-lg"></div>
                          <span className="italic leading-relaxed">"{comment}"</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyPerformancePage() {
  const { user } = useAuth();
  const { year: defaultYear, quarter: defaultQuarter } = usePeriod();
  const [year, setYear] = useState(defaultYear);
  const [quarter, setQuarter] = useState(defaultQuarter);

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ["my-performance", year, quarter],
    queryFn: async () => {
      const token = localStorage.getItem("maratona_token");
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
      const resp = await fetch(`${apiBase}/my-performance?year=${year}&quarter=${quarter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? "Erro ao carregar desempenho");
      }
      return resp.json();
    },
    enabled: !!user?.employeeId,
  });

  if (!user?.employeeId) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 bg-white rounded-2xl border shadow-sm text-center space-y-4">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Seu perfil de usuário não está vinculado a um colaborador no sistema. O painel Meu Desempenho é exclusivo para participantes da Maratona de Resultados.
        </p>
        <p className="text-sm font-medium pt-4 text-slate-500 border-t">Contate o RH ou o administrador do sistema para realizar a vinculação.</p>
      </div>
    );
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto bg-slate-50/30 min-h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3 uppercase">
            <TrendingUp className="text-primary" size={28} />
            Meu Desempenho
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-slate-700 bg-white px-3 py-1 rounded-md border shadow-sm text-sm">{data?.employee.name ?? user?.name}</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase">{data?.employee.functionName}</span>
          </div>
        </div>
        <div className="flex bg-white p-1.5 rounded-xl border shadow-sm gap-2 w-max">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-28 h-10 border-none shadow-none font-bold bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)} className="font-medium">{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="w-px bg-border my-2" />
          <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
            <SelectTrigger className="w-40 h-10 border-none shadow-none font-bold bg-slate-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_LABELS.map((q, i) => <SelectItem key={i + 1} value={String(i + 1)} className="font-medium">{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-800">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="font-medium ml-2">{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {data && summary && (
        <>
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-md bg-gradient-to-br from-sidebar to-sidebar-accent text-white relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <Trophy size={100} />
              </div>
              <CardContent className="p-6 relative z-10">
                <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">Média do Trimestre</p>
                {result !== null ? (
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-5xl font-black">{result.toFixed(1)}</span>
                    <span className="text-white/60 font-bold">/100</span>
                  </div>
                ) : (
                  <div className="text-lg font-medium text-white/70 mt-4">Em andamento</div>
                )}
                {summary.isQuarterClosed && (
                  <Badge variant="outline" className="mt-4 bg-white/10 border-white/20 text-white text-[10px] font-bold">FECHADO OFICIALMENTE</Badge>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Seu Pelotão</p>
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-500"><Target size={20} /></div>
                </div>
                {summary.currentPlatoon ? (
                  <>
                    <h3 className="text-2xl font-black text-slate-800 leading-tight">{summary.currentPlatoon}</h3>
                    <Badge variant="secondary" className="mt-3 bg-slate-100 text-slate-600 font-bold text-[10px]">
                      {summary.isQuarterClosed ? "CLASSIFICAÇÃO FINAL" : "PROJEÇÃO ATUAL"}
                    </Badge>
                  </>
                ) : (
                  <div className="text-2xl font-black text-slate-300">—</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-green-700 uppercase tracking-widest">Bônus Caju</p>
                  <div className="bg-green-100 p-2 rounded-lg text-green-600"><DollarSign size={20} /></div>
                </div>
                {summary.projectedBonus !== null ? (
                  <>
                    <h3 className="text-3xl font-black text-green-600">{fmtBRL(summary.projectedBonus)}</h3>
                    <Badge variant="outline" className="mt-2 bg-green-50 border-green-200 text-green-700 font-bold text-[10px]">
                      {summary.isQuarterClosed ? "VALOR CONFIRMADO" : "VALOR PROJETADO"}
                    </Badge>
                  </>
                ) : (
                  <div className="text-3xl font-black text-slate-300">—</div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Participação</p>
                  <div className="bg-blue-50 p-2 rounded-lg text-blue-600"><Calendar size={20} /></div>
                </div>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-slate-800">{summary.evaluatedEvents}</h3>
                  <span className="text-sm font-semibold text-slate-500">eventos</span>
                </div>
                
                {(summary.pendingEvents > 0 || summary.totalAbsences > 0) && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                    {summary.pendingEvents > 0 && <span className="text-xs font-bold flex items-center gap-1.5 text-amber-600"><Clock size={12}/> {summary.pendingEvents} avaliações em andamento</span>}
                    {summary.totalAbsences > 0 && <span className="text-xs font-bold flex items-center gap-1.5 text-red-600"><AlertTriangle size={12}/> {summary.totalAbsences} faltas registradas</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Absence penalty info */}
          {summary.absencePenalty !== null && summary.absencePenalty > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-4">
              <div className="bg-red-100 text-red-600 p-2 rounded-full shrink-0"><AlertTriangle size={20} /></div>
              <div>
                <h4 className="font-bold text-red-800 mb-1">Penalidade por Faltas</h4>
                <p className="text-sm text-red-700 font-medium">
                  Foi aplicado um desconto de <strong>{summary.absencePenalty} pontos</strong> na sua nota final devido às faltas registradas no período.
                  {summary.grossAverage !== null && ` (A média original era ${summary.grossAverage.toFixed(1)}).`}
                </p>
              </div>
            </div>
          )}

          {/* Event breakdown */}
          <div className="pt-4">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 mb-6 flex items-center gap-2">
              <Calendar className="text-primary" size={24} />
              Histórico de Eventos
            </h2>
            {data.events.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed text-slate-400 font-medium shadow-sm">
                Nenhum evento registrado no {QUARTER_LABELS[quarter - 1]} de {year}.
              </div>
            ) : (
              <div className="space-y-4">
                {data.events.map(ev => <EventCard key={ev.eventId} event={ev} />)}
              </div>
            )}
          </div>

          {/* Privacy note */}
          <div className="bg-slate-100 rounded-lg p-4 text-center mt-8 border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              Sigilo de Avaliação
            </p>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Para garantir imparcialidade, as notas e comentários exibidos são consolidados. A identidade dos avaliadores é estritamente confidencial.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
