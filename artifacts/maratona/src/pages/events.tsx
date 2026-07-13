import { useState } from "react";
import { useGetEvents, useCreateEvent, useMergeEvent, getGetEventsQueryKey, ApiError } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, MapPin, ChevronRight, Users, Plus, GitMerge, ChevronsUpDown, Check, SlidersHorizontal, ArrowUpDown, Info } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { CycleBadge } from "@/components/cycle-badge";
import { cn } from "@/lib/utils";

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
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("dateDesc");
  const [createOpen, setCreateOpen] = useState(false);
  const [mergeForEvent, setMergeForEvent] = useState<{ id: number; name: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeTargetPickerOpen, setMergeTargetPickerOpen] = useState(false);
  const [mergeConflict, setMergeConflict] = useState<{ evaluations: number; calibrations: number; conformities: number; results: number } | null>(null);

  const queryKey = getGetEventsQueryKey();
  const { data: events, isLoading } = useGetEvents(
    undefined,
    { query: { queryKey, refetchInterval: 15000, refetchOnWindowFocus: true } }
  );

  const mergeMutation = useMergeEvent({
    mutation: {
      onSuccess: (result) => {
        qc.invalidateQueries({ queryKey });
        toast({
          title: "Eventos mesclados",
          description: result.warnings.length > 0 ? result.warnings.join(" ") : "Dados combinados com sucesso.",
        });
        setMergeForEvent(null);
        setMergeTargetId("");
        setMergeConflict(null);
      },
      onError: (e: ApiError) => {
        const data = e.data as { requiresConfirmation?: boolean; details?: { evaluations: number; calibrations: number; conformities: number; results: number }; error?: string } | null;
        if (data?.requiresConfirmation && data.details) {
          setMergeConflict(data.details);
          return;
        }
        toast({ title: "Erro ao mesclar", description: data?.error ?? e.message, variant: "destructive" });
      },
    },
  });

  const { register, handleSubmit, reset } = useForm<EventInput>();

  const createMutation = useCreateEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        toast({ title: "Evento criado" });
        setCreateOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  // O backend já retorna apenas os eventos do ciclo atual (getEvents filtra por
  // cycle.startDate/endDate) — aqui mostramos TODOS eles, abertos ou fechados,
  // para que o card atualize ao vivo conforme os avaliadores forem enviando notas.
  const filtered = (events ?? []).filter(ev => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase()) || (ev.clientName ?? "").toLowerCase().includes(search.toLowerCase()) || (ev.city ?? "").toLowerCase().includes(search.toLowerCase()) || (ev.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchConfig = filterStatus === "all"
      || (filterStatus === "configured" && !!ev.criteriaConfirmed)
      || (filterStatus === "confirmed" && !!ev.resultsConfirmed)
      || (filterStatus === "unconfirmed" && !ev.resultsConfirmed)
      || (filterStatus === "pendingCal" && ev.status === "closed" && !ev.fullyCalibrated)
      || (filterStatus === "fullyEval" && !!ev.fullyCalibrated)
      || (filterStatus === "fullyCalibrated" && !!ev.fullyCalibrated);
    const matchCard = cardFilter === null
      || (cardFilter === "configured" && ev.criteriaConfirmed)
      || (cardFilter === "confirmed" && ev.resultsConfirmed)
      || (cardFilter === "unconfirmed" && !ev.resultsConfirmed)
      || (cardFilter === "pendingCal" && ev.status === "closed" && !ev.fullyCalibrated)
      // "Avaliação 100%" = todas as calibrações FINAIS publicadas, de todos os
      // critérios — não basta os avaliadores terem submetido as notas.
      || (cardFilter === "fullyEval" && !!ev.fullyCalibrated);
    return matchSearch && matchConfig && matchCard;
  }).slice().sort((a, b) => {
    if (sortBy === "dateAsc") return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (sortBy === "scoreDesc") return ((b.teamScore ?? b.averageScore) ?? -1) - ((a.teamScore ?? a.averageScore) ?? -1);
    if (sortBy === "scoreAsc") return ((a.teamScore ?? a.averageScore) ?? 101) - ((b.teamScore ?? b.averageScore) ?? 101);
    if (sortBy === "status") return (a.status ?? "").localeCompare(b.status ?? "");
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const canCreate = user && ["admin", "rh"].includes(user.role);

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
            {canCreate && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <button
                    data-testid="button-create-event"
                    className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <Plus size={18} /> Novo Evento
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Novo Evento</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome do Evento <span className="text-[#ba1a1a]">*</span></Label>
                      <Input data-testid="input-event-name" {...register("name", { required: true })} placeholder="Ex: Feira XYZ 2026" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Cliente</Label>
                      <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome do cliente" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Início <span className="text-[#ba1a1a]">*</span></Label>
                        <Input data-testid="input-event-start" type="date" {...register("startDate", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Fim <span className="text-[#ba1a1a]">*</span></Label>
                        <Input data-testid="input-event-end" type="date" {...register("endDate", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Cidade</Label>
                        <Input data-testid="input-event-city" {...register("city")} placeholder="Ex: São Paulo" className="h-11 rounded-none border-2 border-[#191c1e]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">UF</Label>
                        <Input data-testid="input-event-state" {...register("state")} placeholder="Ex: SP" maxLength={2} className="h-11 rounded-none border-2 border-[#191c1e] uppercase" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Local</Label>
                      <Input data-testid="input-event-location" {...register("location")} placeholder="Ex: Pavilhão de Exposições" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                      <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                      <button
                        data-testid="button-submit-event"
                        type="submit"
                        disabled={createMutation.isPending}
                        className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                      >
                        {createMutation.isPending ? "Criando..." : "Criar Evento"}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>

        {/* Summary cards */}
        {events && events.length > 0 && (
          <section className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {(() => {
              const all = events ?? [];
              const configured = all.filter(e => e.criteriaConfirmed).length;
              const confirmed = all.filter(e => e.resultsConfirmed).length;
              const unconfirmed = all.filter(e => !e.resultsConfirmed).length;
              const pendingCal = all.filter(e => e.status === "closed" && !e.fullyCalibrated).length;
              const fullyEval = all.filter(e => !!e.fullyCalibrated).length;
              const cards = [
                { key: "configured", label: "Configurados", value: configured, color: "#506600" },
                { key: "confirmed", label: "Confirmados", value: confirmed, color: "#506600" },
                { key: "unconfirmed", label: "Não Confirmados", value: unconfirmed, color: "#ff5722" },
                { key: "pendingCal", label: "Falta Calibrar", value: pendingCal, color: "#ffb300" },
                { key: "fullyEval", label: "Avaliação 100%", value: fullyEval, color: "#ccff00" },
              ];
              return cards.map(c => {
                const isActive = cardFilter === c.key;
                return (
                  <button
                    key={c.label}
                    onClick={() => setCardFilter(isActive ? null : c.key)}
                    title={`Clique para filtrar: ${c.label}`}
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
          </div>
          <p className="flex items-center gap-1.5 text-[11px] italic font-bold text-[#747a60]">
            <Info size={12} className="shrink-0" />
            Clique em um card para filtrar a lista. As categorias podem se sobrepor — um evento pode aparecer em mais de um grupo ao mesmo tempo (ex: confirmado e aguardando calibração).
          </p>
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
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCardFilter(null); }}>
              <SelectTrigger data-testid="select-filter-status" className="w-full md:w-44 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="configured">Configurados</SelectItem>
                <SelectItem value="confirmed">Confirmados</SelectItem>
                <SelectItem value="unconfirmed">Não Confirmados</SelectItem>
                <SelectItem value="pendingCal">Falta Calibrar</SelectItem>
                <SelectItem value="fullyCalibrated">Calibragem Concluída</SelectItem>
                <SelectItem value="fullyEval">Avaliação 100%</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-44 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                <ArrowUpDown size={14} className="mr-1 shrink-0 text-[#747a60]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dateDesc">Mais Recente</SelectItem>
                <SelectItem value="dateAsc">Mais Antigo</SelectItem>
                <SelectItem value="scoreDesc">Maior Score</SelectItem>
                <SelectItem value="scoreAsc">Menor Score</SelectItem>
                <SelectItem value="status">Por Status</SelectItem>
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
                          <span
                            title="Confirmar resultados garante a elegibilidade da equipe deste evento, independente da nota final"
                            className={`px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block ${ev.resultsConfirmed ? "bg-[#eceef0] text-[#506600]" : "bg-[#fff4e5] text-[#a06a00]"}`}
                          >
                            <span className="inline-block skew-x-[8deg]">{ev.resultsConfirmed ? "Elegibilidade OK" : "Elegibilidade Pendente"}</span>
                          </span>
                          {ev.isHistorical && (
                            <span data-testid={`badge-historical-${ev.id}`} className="bg-[#ffb300] text-[#3b2900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">Ciclo Anterior</span>
                            </span>
                          )}
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

                      {score != null && (() => {
                        const isScoreFinal = concluded && (ev.fullyCalibrated ?? false);
                        const isScorePartial = concluded && !(ev.fullyCalibrated ?? false);
                        return (
                          <div className={`border-2 border-[#191c1e] p-2 text-center min-w-[86px] shrink-0 ${isScoreFinal ? "bg-[#ccff00]" : isScorePartial ? "bg-[#fff8e1]" : "bg-white"}`}>
                            <span className="block text-[10px] uppercase font-bold italic text-[#161e00] mb-0.5">
                              {isScoreFinal ? "Score Final" : isScorePartial ? "Score Parcial" : "Provisório"}
                            </span>
                            <span className="text-2xl font-black italic text-[#191c1e] leading-none">{score.toFixed(1)}</span>
                            <span className={`block text-[8px] uppercase font-bold italic mt-0.5 leading-none ${isScoreFinal ? "text-[#506600]" : isScorePartial ? "text-[#a06a00]" : "text-[#747a60]"}`}>
                              {isScoreFinal ? "Pós-calibração" : isScorePartial ? "Cal. incompleta" : calibrated ? "Cal. parcial" : "Sem calibração"}
                            </span>
                          </div>
                        );
                      })()}
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
                    {!!ev.unassignedAreaNames && ev.unassignedAreaNames.length > 0 && (
                      <p className="mt-2 text-[11px] font-bold italic uppercase text-[#b02f00] flex items-start gap-1.5">
                        <Info size={12} className="shrink-0 mt-0.5" />
                        Sem avaliador: {ev.unassignedAreaNames.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="bg-[#f2f4f6] px-5 py-3 border-t-2 border-[#191c1e] flex items-center justify-between gap-4">
                    <div className="flex-1 max-w-[280px] space-y-2">
                      {(() => {
                        const total = ev.totalCriteria ?? 0;
                        const evaluated = ev.evaluatedCriteria ?? 0;
                        const calCount = ev.finalCalibratedCriteria ?? 0;
                        const evalPct = total > 0 ? Math.round((evaluated / total) * 100) : 0;
                        const calPct = total > 0 ? Math.round((calCount / total) * 100) : 0;
                        const fc = ev.fullyCalibrated ?? false;
                        return (<>
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1.5 font-bold italic uppercase">
                              <span className="text-[#444933]">Quesitos Avaliados</span>
                              {total === 0 ? (
                                <span className="text-[#747a60]">—</span>
                              ) : (
                                <span className={evalPct === 100 ? "text-[#506600]" : "text-[#191c1e]"}>
                                  {evaluated} / {total}
                                </span>
                              )}
                            </div>
                            <div className="h-2 w-full bg-[#eceef0] border-2 border-[#191c1e] overflow-hidden">
                              {total > 0 && (
                                <div className={evalPct === 100 ? "h-full bg-[#506600]" : "h-full bg-[#ccff00]"} style={{ width: `${evalPct}%` }} />
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs mb-1.5 font-bold italic uppercase">
                              <span className="text-[#444933]">Calibrações Finais</span>
                              {total === 0 ? (
                                <span className="text-[#747a60]">—</span>
                              ) : (
                                <span className={fc ? "text-[#506600]" : calCount > 0 ? "text-[#a06a00]" : "text-[#747a60]"}>
                                  {calCount} / {total}{fc ? " · Concluída" : calCount > 0 || calibrated ? " · Em andamento" : " · Pendente"}
                                </span>
                              )}
                            </div>
                            <div className="h-2 w-full bg-[#eceef0] border-2 border-[#191c1e] overflow-hidden">
                              {total > 0 && (
                                <div className={fc ? "h-full bg-[#506600]" : "h-full bg-[#ffb300]"} style={{ width: `${calPct}%` }} />
                              )}
                            </div>
                          </div>
                        </>);
                      })()}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {user?.role === "admin" && (
                        <button
                          data-testid={`button-merge-event-${ev.id}`}
                          title="Mesclar com evento duplicado"
                          className="h-8 px-2.5 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-xs font-bold italic uppercase transition-all"
                          onClick={() => { setMergeForEvent({ id: ev.id, name: ev.name }); setMergeTargetId(""); }}
                        >
                          <GitMerge size={14} />
                        </button>
                      )}
                      {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                        <Link href={`/calibrations?eventId=${ev.id}`}>
                          <button
                            data-testid={`button-calibrate-event-${ev.id}`}
                            title="Ir para calibração deste evento"
                            className="h-8 px-2.5 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] transition-all"
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                        </Link>
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

      <Dialog open={!!mergeForEvent} onOpenChange={(open) => { if (!open) { setMergeForEvent(null); setMergeTargetId(""); setMergeConflict(null); } }}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Mesclar Evento Duplicado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm italic text-[#444933]">
              Este evento (<strong>{mergeForEvent?.name}</strong>) será <strong>mantido</strong>. Escolha o evento duplicado abaixo — os dados vazios (cidade, local, UF, cliente) serão preenchidos com os dele, os participantes serão migrados e o duplicado será <strong>excluído</strong>.
            </p>
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Evento duplicado a remover</Label>
              {(() => {
                const mergeCandidates = (events ?? [])
                  .filter(e => e.id !== mergeForEvent?.id)
                  .slice()
                  .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
                const selectedMergeTarget = mergeCandidates.find(e => String(e.id) === mergeTargetId);
                return (
                  <Popover open={mergeTargetPickerOpen} onOpenChange={setMergeTargetPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={mergeTargetPickerOpen}
                        data-testid="select-merge-target"
                        className="w-full h-11 px-3 flex items-center justify-between gap-3 text-left border-2 border-[#191c1e] bg-white hover:bg-[#f7f9fb] transition-all"
                      >
                        {selectedMergeTarget ? (
                          <span className="truncate text-sm font-bold italic uppercase text-[#191c1e]">
                            {selectedMergeTarget.name} — {new Date(selectedMergeTarget.startDate).toLocaleDateString('pt-BR')}{selectedMergeTarget.isHistorical ? " (histórico)" : ""}
                          </span>
                        ) : (
                          <span className="font-bold italic uppercase text-xs tracking-wider text-[#747a60] truncate">Selecione o evento duplicado...</span>
                        )}
                        <ChevronsUpDown size={16} className="shrink-0 text-[#191c1e]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                      <Command className="rounded-none" filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                        <CommandInput data-testid="input-merge-target-search" placeholder="Buscar por nome do evento..." className="italic" />
                        <CommandList className="max-h-[320px]">
                          <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
                          <CommandGroup>
                            {mergeCandidates.map(e => (
                              <CommandItem
                                key={e.id}
                                value={`${e.name} ${e.city ?? ""} ${e.state ?? ""}`}
                                data-testid={`option-merge-target-${e.id}`}
                                onSelect={() => { setMergeTargetId(String(e.id)); setMergeTargetPickerOpen(false); setMergeConflict(null); }}
                                className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3 items-start"
                              >
                                <Check size={16} className={cn("mt-0.5 shrink-0", mergeTargetId === String(e.id) ? "opacity-100" : "opacity-0")} />
                                <span className="flex flex-col min-w-0">
                                  <span className="font-black italic uppercase text-sm leading-tight whitespace-normal">{e.name}</span>
                                  <span className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-normal">
                                    {new Date(e.startDate).toLocaleDateString('pt-BR')}{e.isHistorical ? " · histórico" : ""}
                                  </span>
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                );
              })()}
            </div>

            {mergeConflict && (
              <div data-testid="alert-merge-conflict" className="border-2 border-[#191c1e] bg-[#fff3cd] p-3 text-sm italic text-[#5c4400] space-y-1">
                <p className="font-bold uppercase">O duplicado já tem dado gravado:</p>
                <p>
                  {mergeConflict.evaluations} avaliação(ões), {mergeConflict.calibrations} calibração(ões), {mergeConflict.conformities} conformidade(s) e {mergeConflict.results} resultado(s).
                </p>
                <p>Esses dados do duplicado serão descartados; os dados do evento mantido não são afetados. Confirma a mesclagem mesmo assim?</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
              <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => { setMergeForEvent(null); setMergeTargetId(""); setMergeConflict(null); }}>Cancelar</Button>
              <button
                data-testid="button-confirm-merge"
                type="button"
                disabled={!mergeTargetId || mergeMutation.isPending}
                className={cn(
                  "border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50",
                  mergeConflict ? "bg-[#ff5722] text-white" : "bg-[#ccff00]",
                )}
                onClick={() => {
                  if (!mergeForEvent || !mergeTargetId) return;
                  mergeMutation.mutate({ id: mergeForEvent.id, data: { mergeEventId: parseInt(mergeTargetId), force: !!mergeConflict } });
                }}
              >
                {mergeMutation.isPending ? "Mesclando..." : mergeConflict ? "Mesclar Mesmo Assim" : "Mesclar e Excluir Duplicado"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
