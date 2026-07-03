import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGetCurrentCycle } from "@workspace/api-client-react";
import { formatCyclePeriod, CycleBadge } from "@/components/cycle-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy, Target, Calendar, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronRight,
  MapPin, DollarSign, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { PlatoonBadge } from "@/components/ui/platoon-badge";

interface PerformanceData {
  employee: { id: number; name: string; department: string; functionName: string; eligible?: boolean; eligibilityStatus?: string | null };
  cycle: { id: number; name: string };
  summary: {
    grossAverage: number | null;
    currentPlatoon: string | null;
    projectedBonus: number | null;
    bonusStatus: string | null;
    eligible: boolean;
    totalEvents: number;
    closedEvents: number;
    openEvents: number;
    totalAbsences: number;
    penaltyPoints: number;
    meritPoints: number;
    isQuarterClosed: boolean;
    finalResult: number | null;
    absencePenalty: number | null;
  };
  adjustments: Adjustment[];
  events: EventSummary[];
}

interface Adjustment {
  id: number;
  kind: "penalty" | "merit";
  penaltyType: string;
  points: number;
  quantity: number;
  totalPoints: number;
  date: string | null;
  reason: string | null;
  eventName: string | null;
}

interface EventSummary {
  eventId: number;
  eventName: string;
  city: string | null;
  state: string | null;
  location: string | null;
  startDate: string;
  status: string;
  feedbackReleased?: boolean;
  feedbackReleasedAt?: string | null;
  partialPublishedAt?: string | null;
  eventScore: number;
  projectedPlatoon: string | null;
  projectedPlatoonColor: string | null;
  evaluatedCriteria: number;
  totalCriteria: number;
  criteriaDetails: CriterionDetail[];
}

interface CriterionDetail {
  criterionId: number;
  criterionName: string;
  criterionDescription: string;
  weight: number;
  scoreUsed: number | null;
  criterionTotal: number | null;
  publicComments: string[];
  evaluated: boolean;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function bonusStatusLabel(isQuarterClosed: boolean, bonusStatus: string | null): string {
  if (!isQuarterClosed) return "Valor parcial — projeção do ciclo em andamento";
  switch (bonusStatus) {
    case "paid": return "Bônus pago";
    case "approved": return "Aprovado — aguardando pagamento";
    case "scheduled": return "Pagamento agendado";
    case "blocked": return "Bloqueado — contate o RH";
    default: return "Resultado final — aguardando aprovação do RH";
  }
}

function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);
  const publishLabel = event.feedbackReleased
    ? `Avaliação Final${event.feedbackReleasedAt ? ` · ${formatDateTime(event.feedbackReleasedAt)}` : ""}`
    : event.partialPublishedAt
      ? `Avaliação Parcial · ${formatDateTime(event.partialPublishedAt)}`
      : "Ainda não publicada";

  return (
    <div className="bg-white border-2 border-[#191c1e] mb-4">
      {/* Header do evento */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-[#f2f4f6] transition-colors text-left gap-4"
      >
        <div className="flex items-start gap-4 min-w-0 w-full">
          <div className="mt-1 shrink-0 bg-[#ccff00] border-2 border-[#191c1e] p-2 text-[#191c1e]">
            {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn(
                "text-[10px] font-bold uppercase italic px-2 py-0.5 border-2 border-[#191c1e]",
                event.feedbackReleased ? "bg-[#191c1e] text-[#ccff00]" : event.partialPublishedAt ? "bg-[#ccff00] text-[#191c1e]" : "bg-[#d8dadc] text-[#444933]"
              )}>
                {publishLabel}
              </span>
            </div>
            <p className="font-bold text-base text-[#191c1e]">{event.eventName}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-bold italic text-[#747a60]">
              {(event.city || event.location) && (
                <span className="flex items-center gap-1"><MapPin size={12} /> {event.city ? `${event.city}${event.state ? `/${event.state}` : ""}` : event.location}</span>
              )}
              {event.startDate && <span>{new Date(event.startDate).toLocaleDateString("pt-BR")}</span>}
              <span className="bg-[#f2f4f6] border border-[#191c1e] px-2 py-0.5">Quesitos: {event.evaluatedCriteria}/{event.totalCriteria}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pl-14 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#191c1e]/20">
          {event.projectedPlatoon && (
            <span className="text-[10px] font-bold uppercase italic px-2 py-1 border-2 border-[#191c1e]"
              style={{ backgroundColor: event.projectedPlatoonColor || '#ccff00', color: '#191c1e' }}>
              {event.projectedPlatoon}
            </span>
          )}

          {event.eventScore > 0 && (
            <div className="text-right bg-[#ccff00] border-2 border-[#191c1e] px-3 py-1.5">
              <span className="block text-[10px] uppercase font-bold text-[#191c1e] mb-0.5 italic">Nota</span>
              <span className="font-black text-xl text-[#506600]">{event.eventScore.toFixed(1)}</span>
            </div>
          )}
        </div>
      </button>

      {/* Detalhamento dos critérios */}
      {open && (
        <div className="border-t-2 border-[#191c1e] bg-[#f2f4f6] p-5 md:p-6 space-y-4">
          <h4 className="text-sm font-black uppercase tracking-tighter text-[#747a60] mb-2 italic">Detalhamento dos Critérios</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {event.criteriaDetails.map(c => (
              <div key={c.criterionId} className="bg-white border-2 border-[#191c1e] p-4 relative overflow-hidden">
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold uppercase italic text-[#747a60] bg-[#f2f4f6] border border-[#191c1e] px-2 py-0.5">Peso {c.weight}</span>
                      {c.evaluated && (
                        <span className="text-[10px] font-bold uppercase italic text-[#506600] flex items-center gap-1">
                          <CheckCircle2 size={12}/> Avaliado
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-sm text-[#191c1e] leading-tight italic">{c.criterionName}</p>
                  </div>

                  <div className="text-right shrink-0">
                    {c.scoreUsed !== null ? (
                      <div className="flex items-end gap-1">
                        <span className="font-black text-2xl text-[#191c1e] leading-none">{c.scoreUsed.toFixed(1)}</span>
                        <span className="text-xs font-bold text-[#747a60] pb-1 italic">/10</span>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold uppercase italic px-2 py-1 bg-[#f2f4f6] text-[#747a60] border border-[#191c1e]">Pendente</span>
                    )}
                  </div>
                </div>

                {c.publicComments.length > 0 && (
                  <div className="mt-4 space-y-2 pt-3 border-t-2 border-[#191c1e]/20">
                    <p className="text-[10px] font-black uppercase italic text-[#747a60]">Feedbacks da equipe avaliadora</p>
                    {c.publicComments.map((comment, i) => (
                      <div key={i} className="text-xs text-[#444933] bg-[#f2f4f6] p-3 border-l-2 border-[#191c1e] relative">
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
    </div>
  );
}

export default function MyPerformancePage() {
  const { user } = useAuth();
  const { data: currentCycle } = useGetCurrentCycle();
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "closed" | "open">("all");

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
      <div className="p-8 max-w-2xl mx-auto mt-12 bg-white border-2 border-[#191c1e] text-center space-y-4">
        <div className="w-20 h-20 bg-[#ffdbd1] border-2 border-[#191c1e] flex items-center justify-center mx-auto text-[#862200] mb-2">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-[#191c1e]">Acesso Restrito</h2>
        <p className="text-[#444933] italic">
          Seu perfil de usuário não está vinculado a um colaborador no sistema. O painel Meu Desempenho é exclusivo para participantes da Maratona de Resultados.
        </p>
        <p className="text-sm font-bold pt-4 text-[#747a60] border-t-2 border-[#191c1e]">Contate o RH ou o administrador do sistema para realizar a vinculação.</p>
      </div>
    );
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const filteredEvents = (data?.events ?? []).filter(ev => {
    const matchesText = !eventFilter ||
      ev.eventName.toLowerCase().includes(eventFilter.toLowerCase()) ||
      (ev.city?.toLowerCase() ?? "").includes(eventFilter.toLowerCase()) ||
      (ev.state?.toLowerCase() ?? "").includes(eventFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || ev.status === statusFilter;
    return matchesText && matchesStatus;
  });

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#f7f9fb] border-b-4 border-[#191c1e] flex flex-wrap gap-4 justify-between items-center px-6 md:px-10 py-4">
        <h1 className="text-2xl md:text-3xl italic font-black text-[#506600] uppercase tracking-tighter flex items-center gap-3">
          <TrendingUp size={28} />
          Meu Desempenho
        </h1>
        <CycleBadge className="bg-[#f7f9fb]" />
      </header>

      <div className="p-6 md:p-10 space-y-10">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#191c1e] bg-[#ccff00] px-3 py-1 border-2 border-[#191c1e] text-sm italic">{data?.employee.name ?? user?.name}</span>
          <span className="text-xs font-bold uppercase italic text-[#747a60]">{data?.employee.functionName}</span>
        </div>

      {data && summary && (
        <div className={cn(
          "border-2 border-[#191c1e] px-4 py-3 text-xs font-bold italic uppercase flex items-center gap-2",
          summary.isQuarterClosed ? "bg-[#e3f5cf] text-[#506600]" : "bg-[#fff3cd] text-[#664d03]"
        )}>
          {summary.isQuarterClosed ? <CheckCircle2 size={16} /> : <Clock size={16} />}
          {summary.isQuarterClosed
            ? "Ciclo fechado — resultado oficial"
            : "Ciclo em andamento — nota, pelotão e bônus são projeções parciais e podem mudar até o fechamento oficial"}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 border-2 border-[#191c1e]" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive" className="bg-[#ffdbd1] border-2 border-[#862200] text-[#862200]">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription className="font-bold ml-2 italic">{(error as Error).message}</AlertDescription>
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
                  <>
                    <h2 className="text-[40px] leading-none italic font-black mt-2">{result.toFixed(1)}<span className="text-[18px] text-[#747a60]">/100</span></h2>
                    <p className={cn(
                      "text-[10px] font-bold uppercase italic mt-2",
                      summary.isQuarterClosed ? "text-[#506600]" : "text-[#a15c00]"
                    )}>
                      {summary.isQuarterClosed ? "Avaliado Oficialmente" : "Projeção Parcial"}
                    </p>
                  </>
                ) : (
                  <div className="text-lg font-medium text-[#747a60] mt-4 italic">-</div>
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
                {!summary.eligible ? (
                  <>
                    <h2 className="text-[32px] leading-none italic font-black mt-2 text-[#747a60]">—</h2>
                    <p className="text-[10px] font-bold uppercase italic text-[#862200] mt-2">Não elegível para bônus neste ciclo</p>
                  </>
                ) : summary.projectedBonus !== null ? (
                  <>
                    <h2 className="text-[32px] leading-none italic font-black mt-2 text-[#506600]">{fmtBRL(summary.projectedBonus)}</h2>
                    <p className="text-[10px] font-bold uppercase italic text-[#506600] mt-2">{bonusStatusLabel(summary.isQuarterClosed, summary.bonusStatus)}</p>
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
                <h2 className="text-[40px] leading-none italic font-black mt-2">{summary.totalEvents}</h2>
                <p className="text-[11px] font-bold uppercase italic text-[#506600] mt-1">eventos no ciclo</p>
                {summary.openEvents > 0 && (
                  <p className="text-[10px] font-bold uppercase italic text-[#506600] mt-1">{summary.openEvents} em avaliação</p>
                )}
                {summary.totalAbsences > 0 && (
                  <p className="text-[10px] font-bold uppercase italic text-[#862200] mt-1">{summary.totalAbsences} {summary.totalAbsences === 1 ? "penalidade" : "penalidades"}</p>
                )}
              </div>
              <div className="absolute -right-3 -bottom-3 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Calendar size={110} strokeWidth={1.5} />
              </div>
              <div className="w-full h-2 bg-[#191c1e] mt-auto" />
            </div>
          </div>

          {/* Penalidades e Méritos */}
          {(data.adjustments?.length ?? 0) > 0 && (
            <div className="pt-4">
              <h2 className="text-xl font-black uppercase tracking-tight text-[#506600] flex items-center gap-2 mb-4">
                <AlertTriangle size={22} />
                Penalidades e Méritos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                {(summary.penaltyPoints ?? 0) > 0 && (
                  <div className="bg-[#ffdbd1] border-2 border-[#191c1e] p-4 flex items-center justify-between">
                    <span className="text-xs font-black uppercase italic tracking-wider text-[#862200]">Penalidades</span>
                    <span className="text-2xl font-black italic text-[#862200]">-{summary.penaltyPoints} pts</span>
                  </div>
                )}
                {(summary.meritPoints ?? 0) > 0 && (
                  <div className="bg-[#ccff00] border-2 border-[#191c1e] p-4 flex items-center justify-between">
                    <span className="text-xs font-black uppercase italic tracking-wider text-[#161e00]">Méritos</span>
                    <span className="text-2xl font-black italic text-[#506600]">+{summary.meritPoints} pts</span>
                  </div>
                )}
              </div>
              <div className="bg-white border-2 border-[#191c1e] divide-y-2 divide-[#eceef0]">
                {data.adjustments.map(adj => (
                  <div key={adj.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-black uppercase italic px-2 py-0.5 border-2 border-[#191c1e] ${
                          adj.kind === "merit" ? "bg-[#ccff00] text-[#161e00]" : "bg-[#ff5722] text-white"
                        }`}>
                          {adj.kind === "merit" ? "Mérito" : "Penalidade"}
                        </span>
                        <span className="text-xs font-bold italic uppercase text-[#444933]">{adj.penaltyType}</span>
                        {adj.quantity > 1 && (
                          <span className="text-[10px] font-bold italic uppercase text-[#747a60] bg-[#eceef0] border border-[#191c1e] px-1.5 py-0.5">x{adj.quantity}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold italic text-[#747a60]">
                        {adj.date && <span>{new Date(`${adj.date}T00:00:00`).toLocaleDateString("pt-BR")}</span>}
                        {adj.eventName && <span className="flex items-center gap-1"><Calendar size={12} /> {adj.eventName}</span>}
                      </div>
                      {adj.reason && <p className="text-xs text-[#444933] italic mt-1">"{adj.reason}"</p>}
                    </div>
                    <span className={`font-black italic text-lg shrink-0 ${adj.kind === "merit" ? "text-[#506600]" : "text-[#862200]"}`}>
                      {adj.kind === "merit" ? "+" : "-"}{adj.totalPoints} pts
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase italic text-[#747a60] mt-2">
                Méritos somam e penalidades descontam pontos na sua nota final do ciclo (limitada entre 0 e 100).
              </p>
            </div>
          )}

          {/* Event breakdown */}
          <div className="pt-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-black uppercase tracking-tight text-[#506600] flex items-center gap-2">
                <Calendar size={24} />
                Histórico de Eventos
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex bg-white border-2 border-[#191c1e]">
                  {[
                    { key: "all", label: "Todos" },
                    { key: "closed", label: "Avaliados" },
                    { key: "open", label: "Em avaliação" },
                  ].map(btn => (
                    <button
                      key={btn.key}
                      onClick={() => setStatusFilter(btn.key as typeof statusFilter)}
                      className={`px-3 py-2 text-[10px] font-bold uppercase italic transition-colors ${
                        statusFilter === btn.key
                          ? "bg-[#ccff00] text-[#191c1e]"
                          : "bg-white text-[#747a60] hover:bg-[#f2f4f6]"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
                <div className="relative max-w-sm w-full">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
                  <input
                    type="text"
                    value={eventFilter}
                    onChange={(e) => setEventFilter(e.target.value)}
                    placeholder="Buscar evento..."
                    className="w-full pl-9 pr-4 py-2 bg-white border-2 border-[#191c1e] text-sm font-bold italic text-[#191c1e] placeholder:text-[#747a60] placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                  />
                </div>
              </div>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="text-center py-20 bg-white border-2 border-dashed border-[#747a60] text-[#747a60] font-medium">
                {eventFilter
                  ? `Nenhum evento encontrado para "${eventFilter}".`
                  : `Nenhum evento registrado no ciclo ${data.cycle.name}.`
                }
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map(ev => <EventCard key={ev.eventId} event={ev} />)}
              </div>
            )}
          </div>

          {/* Privacy note */}
          <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 text-center mt-8">
            <p className="text-[10px] font-black uppercase italic text-[#506600] tracking-widest">
              Sigilo de Avaliação
            </p>
            <p className="text-xs text-[#444933] font-medium mt-1 italic">
              Para garantir imparcialidade, as notas e comentários exibidos são consolidados. A identidade dos avaliadores é estritamente confidencial.
            </p>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
