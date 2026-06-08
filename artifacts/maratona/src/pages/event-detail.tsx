import { useRoute } from "wouter";
import { useGetEvent, useGetEventResult, getGetEventQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Calendar, MapPin, Users, BarChart3, TrendingUp, CheckCircle2, ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

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
      <div className="bg-[#f7f9fb] min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="h-8 w-32 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        <div className="h-40 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-[#f7f9fb] min-h-full p-6 md:p-10 max-w-4xl mx-auto text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="py-24 bg-white border-2 border-dashed border-[#191c1e] text-[#747a60] italic uppercase font-bold">
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
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-bold italic uppercase tracking-wider text-[#444933] hover:text-[#506600] transition-colors group">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Voltar para Eventos
        </Link>

        {/* Hero */}
        <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="h-2 bg-[#ccff00] border-b-2 border-[#191c1e]" />
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <StatusBadge status={event.status} />
                  <span className="bg-[#191c1e] text-[#ccff00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                    <span className="inline-block skew-x-[8deg]">T{event.quarter}/{event.year}</span>
                  </span>
                  {event.forcedClosed && (
                    <span className="bg-[#ff5722] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><ShieldAlert size={10} /> Fechamento Forçado</span>
                    </span>
                  )}
                </div>
                <h1 data-testid="text-event-name" className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none mb-2 pr-1.5">{event.name}</h1>
                {event.clientName && <p className="text-base md:text-lg font-bold italic uppercase text-[#506600] mb-6">{event.clientName}</p>}

                <div className="flex flex-wrap items-center gap-5 text-sm font-bold italic text-[#444933]">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white border-2 border-[#191c1e] text-[#506600]"><Calendar size={14} /></div>
                    <span>{new Date(event.startDate).toLocaleDateString('pt-BR')} — {new Date(event.endDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {(event.city || event.location) && (
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white border-2 border-[#191c1e] text-[#506600]"><MapPin size={14} /></div>
                      <span>{event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white border-2 border-[#191c1e] text-[#506600]"><CheckCircle2 size={14} /></div>
                    <span className={evaluationProgress === 100 ? "text-[#506600] font-black" : ""}>{evaluationProgress}% Avaliado</span>
                  </div>
                </div>
              </div>

              {result && result.eventScore > 0 && (
                <div className="shrink-0 bg-[#ccff00] border-2 border-[#191c1e] p-6 flex flex-col items-center justify-center min-w-[160px] -skew-x-6">
                  <div className="skew-x-6 flex flex-col items-center">
                    <span className="text-[10px] font-black italic uppercase tracking-widest text-[#161e00] mb-1">Score Equipe</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black italic text-[#161e00] leading-none">{fmt(result.eventScore)}</span>
                      <span className="text-sm font-black italic text-[#506600]">/100</span>
                    </div>
                    {result.projectedPlatoon && (
                      <div className="mt-3">
                        <PlatoonBadge platoon={result.projectedPlatoon} colorHex={result.projectedPlatoonColor} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Participantes</p>
              <p data-testid="text-participant-count" className="text-2xl font-black italic text-[#191c1e]">{event.participants?.length ?? 0}</p>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Critérios Ativos</p>
              <p className="text-2xl font-black italic text-[#191c1e]">{activeCriteriaCount}</p>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Quesitos Avaliados</p>
              <p className="text-2xl font-black italic text-[#191c1e]">{result?.evaluatedCriteria ?? 0} / {result?.totalCriteria ?? activeCriteriaCount}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {result && result.eventScore > 0 && participantResults.length > 0 && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                  <BarChart3 size={18} />
                  <span className="font-black uppercase tracking-tight">Performance Individual (Equipe)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Score Equivalente</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Elegibilidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#eceef0]">
                      {participantResults.map(p => (
                        <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} className="hover:bg-[#f2f4f6] transition-all">
                          <td className="px-6 py-4 font-black italic uppercase text-sm text-[#191c1e]">{p.employeeName}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-3 py-1 border-2 border-[#191c1e]">
                              {fmt(p.eventScore)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {p.eligible === false ? (
                              <span className="inline-block text-[10px] uppercase font-black italic bg-[#ff5722] text-white border-2 border-[#191c1e] px-2 py-1">Inativo/Inelegível</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black italic bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-1">
                                <CheckCircle2 size={10} /> Elegível
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {event.participants && event.participants.length > 0 && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                  <Users size={18} />
                  <span className="font-black uppercase tracking-tight">Equipe Alocada</span>
                </div>
                <div className="divide-y-2 divide-[#eceef0]">
                  {event.participants.map(p => (
                    <div key={p.id} data-testid={`chip-participant-${p.employeeId}`} className="flex items-center gap-3 p-4 hover:bg-[#f2f4f6] transition-colors">
                      <div className="w-9 h-9 bg-[#eceef0] border-2 border-[#191c1e] flex items-center justify-center font-black italic text-xs text-[#191c1e] shrink-0">
                        {p.employeeName.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black italic uppercase text-sm text-[#191c1e] truncate">{p.employeeName}</p>
                        <p className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">{p.functionName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
