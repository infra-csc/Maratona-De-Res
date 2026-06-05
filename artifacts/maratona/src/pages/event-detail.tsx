import { useRoute } from "wouter";
import { useGetEvent, useGetEventResult, getGetEventQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Users, BarChart3, TrendingUp, ChevronRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const id = params ? parseInt(params.id) : 0;

  const { data: event, isLoading } = useGetEvent(id, {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id) },
  });

  const { data: result } = useGetEventResult(id, {
    query: { enabled: !!id, queryKey: ["event-result", id] as unknown[] },
  });
  const participantResults = result?.participants ?? [];

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="h-8 w-24 bg-slate-200 animate-pulse rounded"></div>
        <div className="h-32 bg-slate-200 animate-pulse rounded-xl"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-slate-200 animate-pulse rounded-xl"></div>
          <div className="h-24 bg-slate-200 animate-pulse rounded-xl"></div>
          <div className="h-24 bg-slate-200 animate-pulse rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <div className="py-24 bg-white rounded-2xl border border-dashed text-slate-400 shadow-sm">
          Evento não encontrado ou indisponível.
        </div>
      </div>
    );
  }

  const fmt = (v: number) => `${v.toFixed(1)}`;
  const activeCriteriaCount = (event.criteria ?? []).filter(c => c.active).length;
  const matrixCells = (event.evaluationMatrix ?? []).flatMap(row => row.criteria ?? []);
  const filledCells = matrixCells.filter(c => c.averageScore != null || (c.status && c.status !== "pendente")).length;
  const evaluationProgress = matrixCells.length > 0 ? Math.round((filledCells / matrixCells.length) * 100) : 0;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/events" className="text-sm font-medium text-slate-500 hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft size={14} /> Voltar para Eventos
        </Link>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <div className="h-2 bg-gradient-to-r from-sidebar to-sidebar-accent w-full" />
        <CardContent className="p-6 md:p-8 relative">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={event.status} />
                <Badge variant="outline" className="text-xs bg-slate-50 font-semibold border-slate-200 text-slate-600">T{event.quarter}/{event.year}</Badge>
                {event.forcedClosed && <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50"><ShieldAlert size={10} className="mr-1"/> Fechamento Forçado</Badge>}
              </div>
              <h1 data-testid="text-event-name" className="text-3xl font-black text-slate-900 tracking-tight leading-tight mb-2">{event.name}</h1>
              {event.clientName && <p className="text-lg font-medium text-slate-500 mb-6">{event.clientName}</p>}
              
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600 font-medium">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-md text-slate-500"><Calendar size={14} /></div>
                  <span>{new Date(event.startDate).toLocaleDateString('pt-BR')} — {new Date(event.endDate).toLocaleDateString('pt-BR')}</span>
                </div>
                {event.city && (
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 rounded-md text-slate-500"><MapPin size={14} /></div>
                    <span>{event.city}, {event.state}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-100 rounded-md text-slate-500"><CheckCircle2 size={14} /></div>
                  <span className={evaluationProgress === 100 ? "text-green-600 font-bold" : ""}>{evaluationProgress}% Avaliado</span>
                </div>
              </div>
            </div>
            
            {result && result.eventScore > 0 && (
              <div className="shrink-0 bg-primary/5 p-6 rounded-2xl border border-primary/10 flex flex-col items-center justify-center min-w-[160px]">
                <span className="text-xs font-bold uppercase tracking-widest text-primary mb-1">Score Equipe</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-primary">{fmt(result.eventScore)}</span>
                  <span className="text-sm font-bold text-primary/50">/100</span>
                </div>
                {result.projectedPlatoon && (
                  <div className="mt-3">
                    <PlatoonBadge platoon={result.projectedPlatoon} colorHex={result.projectedPlatoonColor} />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Participantes</p>
              <p data-testid="text-participant-count" className="text-2xl font-black text-slate-800">{event.participants?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Critérios Ativos</p>
              <p className="text-2xl font-black text-slate-800">{activeCriteriaCount}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-600 shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Quesitos Avaliados</p>
              <p className="text-2xl font-black text-slate-800">{result?.evaluatedCriteria ?? 0} / {result?.totalCriteria ?? activeCriteriaCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {result && result.eventScore > 0 && participantResults.length > 0 && (
            <Card className="border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <BarChart3 className="text-primary" size={20} />
                  Performance Individual (Equipe)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Colaborador</th>
                        <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Score Equivalente</th>
                        <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Elegibilidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {participantResults.map(p => (
                        <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{p.employeeName}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block bg-primary/10 text-primary font-black px-3 py-1 rounded-md">
                              {fmt(p.eventScore)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {p.eligible === false ? (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Inativo/Inelegível</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Elegível</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {event.participants && event.participants.length > 0 && (
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                  <Users className="text-primary" size={20} />
                  Equipe Alocada
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {event.participants.map(p => (
                    <div key={p.id} data-testid={`chip-participant-${p.employeeId}`} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-500 shrink-0">
                        {p.employeeName.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 truncate">{p.employeeName}</p>
                        <p className="text-xs font-medium text-slate-500 truncate">{p.functionName}</p>
                      </div>
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
