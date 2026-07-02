import { useState } from "react";
import { useGetEvents, useReopenEvent, getGetEventsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Unlock, Calendar, MapPin, ChevronRight, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { CycleBadge } from "@/components/cycle-badge";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function StatusChip({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={`px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block ${confirmed ? "bg-[#ccff00] text-[#161e00]" : "bg-[#ff5722] text-white"}`}
    >
      <span className="inline-block skew-x-[8deg]">{confirmed ? "Configurado" : "Aguardando RH"}</span>
    </span>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [cardFilter, setCardFilter] = useState<string | null>(null);

  const queryKey = getGetEventsQueryKey();
  const { data: events, isLoading } = useGetEvents(
    undefined,
    { query: { queryKey, refetchInterval: 15000, refetchOnWindowFocus: true } }
  );

  const reopenMutation = useReopenEvent({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey }) },
  });

  // O backend já retorna apenas os eventos do ciclo atual (getEvents filtra por
  // cycle.startDate/endDate) — aqui mostramos TODOS eles, abertos ou fechados,
  // para que o card atualize ao vivo conforme os avaliadores forem enviando notas.
  const filtered = (events ?? []).filter(ev => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase()) || (ev.clientName ?? "").toLowerCase().includes(search.toLowerCase()) || (ev.city ?? "").toLowerCase().includes(search.toLowerCase()) || (ev.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchConfig = filterStatus === "all" || (filterStatus === "configured" ? !!ev.criteriaConfirmed : !ev.criteriaConfirmed);
    const matchCard = cardFilter === null
      || (cardFilter === "configured" && ev.criteriaConfirmed)
      || (cardFilter === "pendingRH" && !ev.criteriaConfirmed)
      || (cardFilter === "pendingCal" && ev.status === "closed" && !ev.hasCalibration)
      || (cardFilter === "fullyEval" && ev.evaluationProgress === 1);
    return matchSearch && matchConfig && matchCard;
  });

  const canEdit = user && ["admin", "rh", "avaliador"].includes(user.role);

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
              Gestão de <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Eventos</span>
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-xl">Acompanhe o andamento das avaliações das equipes nos eventos sincronizados.</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <CycleBadge />
            <div className="flex items-center gap-2 text-sm font-bold italic uppercase tracking-wider text-[#444933] bg-[#e6e8ea] border-2 border-[#191c1e] px-4 py-3 skew-x-[-4deg]">
              <span className="inline-block skew-x-[4deg]">Eventos sincronizados via integração</span>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        {events && events.length > 0 && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(() => {
              const all = events ?? [];
              const configured = all.filter(e => e.criteriaConfirmed).length;
              const pendingRH = all.filter(e => !e.criteriaConfirmed).length;
              const pendingCal = all.filter(e => e.status === "closed" && !e.hasCalibration).length;
              const fullyEval = all.filter(e => e.evaluationProgress === 1).length;
              const cards = [
                { key: "configured", label: "Configurados", value: configured, color: "#506600" },
                { key: "pendingRH", label: "Aguardando RH", value: pendingRH, color: "#ff5722" },
                { key: "pendingCal", label: "Falta Calibrar", value: pendingCal, color: "#ffb300" },
                { key: "fullyEval", label: "Avaliação 100%", value: fullyEval, color: "#ccff00" },
              ];
              return cards.map(c => {
                const isActive = cardFilter === c.key;
                return (
                  <button
                    key={c.label}
                    onClick={() => setCardFilter(isActive ? null : c.key)}
                    className={`bg-white border-2 p-4 flex flex-col justify-between h-28 relative overflow-hidden text-left cursor-pointer transition-all hover:translate-y-[-2px] ${isActive ? "border-[#ccff00] shadow-[4px_4px_0px_0px_#ccff00]" : "border-[#191c1e] hover:shadow-[2px_2px_0px_0px_#191c1e]"}`}
                  >
                    <div className="z-10">
                      <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#444933]">{c.label}</p>
                      <h2 className="text-[32px] leading-none italic font-black mt-1" style={{ color: c.color }}>{c.value}</h2>
                      <p className="text-[10px] font-bold uppercase italic text-[#747a60] mt-1">de {all.length} eventos</p>
                    </div>
                    <div className="w-full h-1.5 mt-auto" style={{ backgroundColor: c.color }} />
                    {isActive && <div className="absolute top-2 right-2 w-3 h-3 bg-[#ccff00] border-2 border-[#191c1e]" />}
                  </button>
                );
              });
            })()}
          </section>
        )}

        {/* Filter bar */}
        <section className="bg-[#e6e8ea] border-2 border-[#191c1e] flex flex-col md:flex-row gap-4 items-stretch md:items-center p-4 skew-x-[-1deg]">
          <div className="relative flex-1 skew-x-[1deg]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
            <Input
              data-testid="input-search-events"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
              placeholder="Buscar por nome do evento, cliente ou cidade..."
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto skew-x-[1deg]">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger data-testid="select-filter-status" className="w-full md:w-36 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="configured">Configurados</SelectItem>
                <SelectItem value="pending">Aguardando RH</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[1,2,3].map(i => (
              <div key={i} className="h-48 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white border-2 border-dashed border-[#191c1e]">
            <Calendar size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-black italic uppercase tracking-tight text-[#191c1e]">Nenhum evento encontrado</h3>
            <p className="text-[#747a60] italic mt-1">Tente ajustar os filtros ou sincronizar os eventos via integração.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filtered.map(ev => {
              const progress = Math.round((ev.evaluationProgress ?? 0) * 100);
              const score = ev.teamScore ?? ev.averageScore ?? null;
              const calibrated = ev.hasCalibration ?? false;
              const concluded = ev.status === "closed";
              return (
                <div key={ev.id} data-testid={`card-event-${ev.id}`} className={`bg-white border-2 border-[#191c1e] flex flex-col ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}>
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <StatusChip confirmed={ev.criteriaConfirmed ?? false} />
                          {ev.forcedClosed && (
                            <span className="bg-[#ff5722] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">Fechamento Forçado</span>
                            </span>
                          )}
                          {ev.cycleName && (
                            <span className="bg-[#191c1e] text-[#ccff00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">{ev.cycleName}</span>
                            </span>
                          )}
                          {concluded ? (
                            <span className="bg-[#506600] text-white px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">Evento Concluído</span>
                            </span>
                          ) : score != null ? (
                            <span className="bg-[#ffb5a0] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">Score Provisório</span>
                            </span>
                          ) : null}
                        </div>
                        <Link href={`/events/${ev.id}`} className="font-black text-xl italic uppercase tracking-tight text-[#191c1e] hover:text-[#506600] transition-colors leading-tight pr-1.5">{ev.name}</Link>
                        {ev.clientName && <p className="text-sm font-bold italic uppercase text-[#747a60] mt-1 truncate pr-1.5">{ev.clientName}</p>}
                      </div>

                      {score != null && (
                        <div className={`border-2 border-[#191c1e] p-2 text-center min-w-[78px] shrink-0 ${concluded ? "bg-[#ccff00]" : "bg-white"}`}>
                          <span className="block text-[10px] uppercase font-bold italic text-[#161e00] mb-0.5">{concluded ? "Score Final" : "Provisório"}</span>
                          <span className="text-2xl font-black italic text-[#191c1e] leading-none">{score.toFixed(0)}</span>
                          <span className={`block text-[8px] uppercase font-bold italic mt-0.5 leading-none ${concluded ? "text-[#506600]" : "text-[#a06a00]"}`}>{concluded ? (calibrated ? "Pós-calibração" : "Evento fechado") : (calibrated ? "Calibração parcial" : "Sem calibração")}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t-2 border-dashed border-[#e0e3e5] text-sm font-bold italic text-[#444933]">
                      <div className="flex items-center gap-2 truncate">
                        <Calendar size={14} className="text-[#747a60] shrink-0" />
                        <span className="truncate">{new Date(ev.startDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})} — {new Date(ev.endDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-[#747a60] shrink-0" />
                        <span>{ev.city ? `${ev.city}${ev.state ? `, ${ev.state}` : ""}` : (ev.location || "Local não definido")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-[#747a60] shrink-0" />
                        <span>{ev.participantCount} participantes</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f2f4f6] px-5 py-3 border-t-2 border-[#191c1e] flex items-center justify-between gap-4">
                    <div className="flex-1 max-w-[280px] space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5 font-bold italic uppercase">
                          <span className="text-[#444933]">Avaliações dos Avaliadores</span>
                          <span className={progress === 100 ? "text-[#506600]" : "text-[#191c1e]"}>
                            {progress}% ({ev.submittedCount ?? 0} / {ev.totalCriteria ?? 0})
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[#eceef0] border-2 border-[#191c1e] overflow-hidden">
                          <div className={progress === 100 ? "h-full bg-[#506600]" : "h-full bg-[#ccff00]"} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs font-bold italic uppercase">
                        <span className="text-[#444933]">Calibragem</span>
                        <span className="flex items-center gap-1.5">
                          <span className={`inline-block w-2 h-2 border border-[#191c1e] ${concluded ? "bg-[#506600]" : calibrated ? "bg-[#ffb300]" : "bg-[#cfd4d8]"}`} />
                          <span className={concluded ? "text-[#506600]" : calibrated ? "text-[#a06a00]" : "text-[#747a60]"}>{concluded ? "Concluída" : calibrated ? "Em andamento" : "Pendente"}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canEdit && ev.status === "closed" && (
                        <button
                          data-testid={`button-reopen-event-${ev.id}`}
                          className="h-8 px-3 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-xs font-bold italic uppercase transition-all"
                          onClick={() => reopenMutation.mutate({ id: ev.id })}
                        >
                          <Unlock size={14} className="mr-1.5" /> Reabrir
                        </button>
                      )}
                      <Link href={`/events/${ev.id}`}>
                        <button data-testid={`button-view-event-${ev.id}`} className="h-8 px-3 flex items-center bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] text-xs font-bold italic uppercase hover:bg-[#506600] hover:text-white transition-all">
                          Gerenciar <ChevronRight size={14} className="ml-1" />
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
