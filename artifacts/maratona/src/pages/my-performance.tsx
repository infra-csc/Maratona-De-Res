import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGetCurrentCycle } from "@workspace/api-client-react";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface PerformanceData {
  employee: { id: number; name: string; department: string; functionName: string };
  cycle: { id: number; name: string };
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
  city: string | null;
  state: string | null;
  location: string | null;
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
                {(event.city || event.location) && (
                  <span className="flex items-center gap-1"><MapPin size={12} /> {event.city ? `${event.city}${event.state ? `/${event.state}` : ""}` : event.location}</span>
                )}
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
  const { data: currentCycle } = useGetCurrentCycle();

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ["my-performance"],
    queryFn: async () => {
      const token = localStorage.getItem("maratona_token");
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
      const resp = await fetch(`${apiBase}/my-performance`, {
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
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f7f9fb] border-b-4 border-[#191c1e] flex flex-wrap gap-4 justify-between items-center px-6 md:px-10 py-4">
        <h1 className="text-2xl md:text-3xl italic font-black text-[#506600] uppercase tracking-tighter flex items-center gap-3">
          <TrendingUp size={28} />
          Meu Desempenho
        </h1>
        {data?.cycle && (
          <div className="bg-white border-2 border-[#191c1e] px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase italic tracking-wider text-[#747a60]">Ciclo</span>
              <span className="font-black text-[#191c1e] text-sm">{data.cycle.name}</span>
            </div>
            {formatCyclePeriod(currentCycle?.startDate, currentCycle?.endDate) && (
              <span className="text-[11px] font-bold italic text-[#747a60] mt-0.5">
                {formatCyclePeriod(currentCycle?.startDate, currentCycle?.endDate)}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="p-6 md:p-10 space-y-10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#191c1e] bg-[#ccff00] px-3 py-1 border-2 border-[#191c1e] text-sm italic">{data?.employee.name ?? user?.name}</span>
          <span className="text-xs font-bold uppercase italic text-[#747a60]">{data?.employee.functionName}</span>
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
          {/* Executive Summary Cards — estilo app */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Média do Ciclo */}
            <div className="bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden group">
              <div className="z-10">
                <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Média do Ciclo</p>
                {result !== null ? (
                  <h2 className="text-[40px] leading-none italic font-black mt-2">{result.toFixed(1)}<span className="text-[18px] text-[#747a60]">/100</span></h2>
                ) : (
                  <div className="text-lg font-medium text-[#747a60] mt-4 italic">Em andamento</div>
                )}
                {summary.isQuarterClosed && (
                  <p className="text-[10px] font-bold uppercase italic text-[#506600] mt-2">Fechado Oficialmente</p>
                )}
              </div>
              <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Trophy size={110} strokeWidth={1.5} />
              </div>
              <div className="w-full h-2 bg-[#191c1e] mt-auto" />
            </div>

            {/* Seu Pelotão */}
            <div className="bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden group">
              <div className="z-10">
                <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Seu Pelotão</p>
                {summary.currentPlatoon ? (
                  <>
                    <h2 className="text-[32px] leading-none italic font-black mt-2 text-[#506600]">{summary.currentPlatoon}</h2>
                    <p className="text-[10px] font-bold uppercase italic text-[#747a60] mt-2">
                      {summary.isQuarterClosed ? "Classificação Final" : "Projeção Atual"}
                    </p>
                  </>
                ) : (
                  <div className="text-[32px] leading-none italic font-black mt-2 text-[#747a60]">—</div>
                )}
              </div>
              <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Target size={110} strokeWidth={1.5} />
              </div>
              <div className="w-full h-2 bg-[#506600] mt-auto" />
            </div>

            {/* Bônus Caju */}
            <div className="bg-[#ccff00] border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden shadow-[4px_4px_0px_0px_#191c1e]">
              <div className="z-10">
                <p className="text-xs font-bold uppercase italic tracking-wider text-[#161e00]">Bônus Caju</p>
                {summary.projectedBonus !== null ? (
                  <>
                    <h2 className="text-[32px] leading-none italic font-black mt-2 text-[#506600]">{fmtBRL(summary.projectedBonus)}</h2>
                    <p className="text-[10px] font-bold uppercase italic text-[#506600] mt-2">Valor parcial — validado apenas ao fim do ciclo</p>
                  </>
                ) : (
                  <div className="text-[32px] leading-none italic font-black mt-2 text-[#747a60]">—</div>
                )}
              </div>
              <div className="absolute -right-3 -bottom-3 opacity-10">
                <DollarSign size={110} strokeWidth={1.5} />
              </div>
              <div className="w-full h-2 bg-[#191c1e] mt-auto" />
            </div>

            {/* Participação */}
            <div className="bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between h-40 relative overflow-hidden group">
              <div className="z-10">
                <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Participação</p>
                <h2 className="text-[40px] leading-none italic font-black mt-2">{summary.evaluatedEvents}</h2>
                <p className="text-[11px] font-bold uppercase italic text-[#506600] mt-1">eventos no ciclo</p>
                {summary.pendingEvents > 0 && (
                  <p className="text-[10px] font-bold uppercase italic text-amber-600 mt-1">{summary.pendingEvents} em andamento</p>
                )}
                {summary.totalAbsences > 0 && (
                  <p className="text-[10px] font-bold uppercase italic text-red-600 mt-1">{summary.totalAbsences} faltas</p>
                )}
              </div>
              <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Calendar size={110} strokeWidth={1.5} />
              </div>
              <div className="w-full h-2 bg-[#191c1e] mt-auto" />
            </div>
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
                Nenhum evento registrado no ciclo {data.cycle.name}.
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
    </div>
  );
}
