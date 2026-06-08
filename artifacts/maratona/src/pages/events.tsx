import { useState } from "react";
import { useGetEvents, useCreateEvent, useCloseEvent, useReopenEvent, getGetEventsQueryKey } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Lock, Unlock, Calendar, MapPin, ChevronRight, Users } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function StatusChip({ status }: { status: string }) {
  const open = status === "open";
  return (
    <span
      className={`px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block ${open ? "bg-[#ccff00] text-[#161e00]" : "bg-[#d8dadc] text-[#444933]"}`}
    >
      <span className="inline-block skew-x-[8deg]">{open ? "Aberto" : "Fechado"}</span>
    </span>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterQuarter, setFilterQuarter] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [open, setOpen] = useState(false);

  const queryKey = getGetEventsQueryKey({ year: Number(filterYear), status: filterStatus === "all" ? undefined : filterStatus });
  const { data: events, isLoading } = useGetEvents(
    { year: Number(filterYear), status: filterStatus === "all" ? undefined : filterStatus }, 
    { query: { queryKey } }
  );

  const { register, handleSubmit, reset, setValue } = useForm<EventInput>({
    defaultValues: { year: currentYear, quarter: currentQuarter },
  });

  const createMutation = useCreateEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        toast({ title: "Evento criado com sucesso" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const closeMutation = useCloseEvent({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey }) },
  });
  const reopenMutation = useReopenEvent({
    mutation: { onSuccess: () => qc.invalidateQueries({ queryKey }) },
  });

  const filtered = (events ?? []).filter(ev => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase()) || (ev.clientName ?? "").toLowerCase().includes(search.toLowerCase()) || (ev.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchQuarter = filterQuarter === "all" || ev.quarter === Number(filterQuarter);
    return matchSearch && matchQuarter;
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
            <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-xl">Crie eventos e acompanhe o andamento das avaliações das equipes.</p>
          </div>
          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="button-create-event"
                  className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                >
                  <Plus size={18} /> Novo Evento Cenográfico
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                <DialogHeader>
                  <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Novo Evento Cenográfico</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome do Evento <span className="text-[#ba1a1a]">*</span></Label>
                    <Input data-testid="input-event-name" {...register("name", { required: true })} placeholder="Ex: Convenção Anual de Vendas 2025" className="h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Cliente</Label>
                      <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome da empresa" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Cidade</Label>
                      <Input data-testid="input-event-city" {...register("city")} placeholder="São Paulo - SP" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
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
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Ano <span className="text-[#ba1a1a]">*</span></Label>
                      <Input data-testid="input-event-year" type="number" {...register("year", { required: true, valueAsNumber: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Trimestre <span className="text-[#ba1a1a]">*</span></Label>
                      <Select defaultValue={String(currentQuarter)} onValueChange={v => setValue("quarter", Number(v))}>
                        <SelectTrigger data-testid="select-event-quarter" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
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
                  <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                    <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setOpen(false)}>Cancelar</Button>
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
        </section>

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
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger data-testid="select-filter-year" className="w-full md:w-28 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterQuarter} onValueChange={setFilterQuarter}>
              <SelectTrigger data-testid="select-filter-quarter" className="w-full md:w-32 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o Ano</SelectItem>
                <SelectItem value="1">T1</SelectItem>
                <SelectItem value="2">T2</SelectItem>
                <SelectItem value="3">T3</SelectItem>
                <SelectItem value="4">T4</SelectItem>
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
            <p className="text-[#747a60] italic mt-1">Tente ajustar os filtros ou criar um novo evento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filtered.map(ev => {
              const progress = ev.evaluationProgress ?? 0;
              return (
                <div key={ev.id} data-testid={`card-event-${ev.id}`} className={`bg-white border-2 border-[#191c1e] flex flex-col ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}>
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <StatusChip status={ev.status} />
                          {ev.forcedClosed && (
                            <span className="bg-[#ff5722] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                              <span className="inline-block skew-x-[8deg]">Fechamento Forçado</span>
                            </span>
                          )}
                          <span className="bg-[#191c1e] text-[#ccff00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                            <span className="inline-block skew-x-[8deg]">T{ev.quarter}/{ev.year}</span>
                          </span>
                        </div>
                        <Link href={`/events/${ev.id}`} className="font-black text-xl italic uppercase tracking-tight text-[#191c1e] hover:text-[#506600] transition-colors leading-tight line-clamp-1 pr-1.5">{ev.name}</Link>
                        {ev.clientName && <p className="text-sm font-bold italic uppercase text-[#747a60] mt-1 truncate pr-1.5">{ev.clientName}</p>}
                      </div>

                      {ev.averageScore != null && (
                        <div className="bg-[#ccff00] border-2 border-[#191c1e] p-2 text-center min-w-[72px] shrink-0">
                          <span className="block text-[10px] uppercase font-bold italic text-[#161e00] mb-0.5">Score</span>
                          <span className="text-2xl font-black italic text-[#191c1e] leading-none">{ev.averageScore.toFixed(0)}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t-2 border-dashed border-[#e0e3e5] text-sm font-bold italic text-[#444933]">
                      <div className="flex items-center gap-2 truncate">
                        <Calendar size={14} className="text-[#747a60] shrink-0" />
                        <span className="truncate">{new Date(ev.startDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})} — {new Date(ev.endDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <MapPin size={14} className="text-[#747a60] shrink-0" />
                        <span className="truncate">{ev.city ? `${ev.city}, ${ev.state}` : "Local não definido"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-[#747a60] shrink-0" />
                        <span>{ev.participantCount} participantes</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#f2f4f6] px-5 py-3 border-t-2 border-[#191c1e] flex items-center justify-between gap-4">
                    <div className="flex-1 max-w-[200px]">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-bold italic uppercase">
                        <span className="text-[#444933]">Avaliações</span>
                        <span className={progress === 100 ? "text-[#506600]" : "text-[#191c1e]"}>{progress}%</span>
                      </div>
                      <div className="h-2 w-full bg-[#eceef0] border-2 border-[#191c1e] overflow-hidden">
                        <div className={progress === 100 ? "h-full bg-[#506600]" : "h-full bg-[#ccff00]"} style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {canEdit && ev.status === "open" && (
                        <button
                          data-testid={`button-close-event-${ev.id}`}
                          className="h-8 px-3 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-xs font-bold italic uppercase transition-all"
                          onClick={() => closeMutation.mutate({ id: ev.id })}
                        >
                          <Lock size={14} className="mr-1.5" /> Fechar
                        </button>
                      )}
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
