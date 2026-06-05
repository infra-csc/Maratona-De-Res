import { useState } from "react";
import { useGetEvents, useCreateEvent, useDeleteEvent, useCloseEvent, useReopenEvent, getGetEventsQueryKey } from "@workspace/api-client-react";
import type { Event, EventInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Lock, Unlock, Calendar, MapPin, ChevronRight, Users, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge } from "@/components/ui/status-badge";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

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
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold tracking-tight text-foreground">Gestão de Eventos</h1>
          <p className="text-muted-foreground text-sm mt-1">Crie eventos e acompanhe o andamento das avaliações das equipes.</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-event" className="shadow-sm">
                <Plus size={16} className="mr-2" /> Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl">Novo Evento Cenográfico</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Nome do Evento <span className="text-destructive">*</span></Label>
                  <Input data-testid="input-event-name" {...register("name", { required: true })} placeholder="Ex: Convenção Anual de Vendas 2025" className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Cliente</Label>
                    <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome da empresa" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Cidade</Label>
                    <Input data-testid="input-event-city" {...register("city")} placeholder="São Paulo - SP" className="h-11" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Início <span className="text-destructive">*</span></Label>
                    <Input data-testid="input-event-start" type="date" {...register("startDate", { required: true })} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Fim <span className="text-destructive">*</span></Label>
                    <Input data-testid="input-event-end" type="date" {...register("endDate", { required: true })} className="h-11" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Ano <span className="text-destructive">*</span></Label>
                    <Input data-testid="input-event-year" type="number" {...register("year", { required: true, valueAsNumber: true })} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Trimestre <span className="text-destructive">*</span></Label>
                    <Select defaultValue={String(currentQuarter)} onValueChange={v => setValue("quarter", Number(v))}>
                      <SelectTrigger data-testid="select-event-quarter" className="h-11">
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
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-event" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Evento"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-events"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white transition-colors"
            placeholder="Buscar por nome do evento, cliente ou cidade..."
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger data-testid="select-filter-status" className="w-full md:w-36 h-11 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="open">Abertos</SelectItem>
              <SelectItem value="closed">Fechados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger data-testid="select-filter-year" className="w-full md:w-28 h-11 font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterQuarter} onValueChange={setFilterQuarter}>
            <SelectTrigger data-testid="select-filter-quarter" className="w-full md:w-32 h-11 font-medium">
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
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1,2,3].map(i => (
            <Card key={i} className="h-32 bg-slate-100/50 animate-pulse border-none" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-xl border border-dashed text-muted-foreground">
          <Calendar size={48} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-lg font-semibold text-slate-700">Nenhum evento encontrado</h3>
          <p>Tente ajustar os filtros ou criar um novo evento.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map(ev => {
            const progress = ev.evaluationProgress ?? 0;
            return (
              <Card key={ev.id} data-testid={`card-event-${ev.id}`} className="border-none shadow-sm hover:shadow-md transition-all group overflow-hidden bg-white">
                <div className="flex flex-col h-full">
                  <div className="p-5 flex-1">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <StatusBadge status={ev.status} />
                          {ev.forcedClosed && <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-200 bg-orange-50">Fechamento Forçado</Badge>}
                          <Badge variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 font-semibold">T{ev.quarter}/{ev.year}</Badge>
                        </div>
                        <Link href={`/events/${ev.id}`} className="font-bold text-lg text-foreground hover:text-primary transition-colors leading-tight line-clamp-1">{ev.name}</Link>
                        {ev.clientName && <p className="text-sm font-medium text-muted-foreground mt-1 truncate">{ev.clientName}</p>}
                      </div>
                      
                      {ev.averageScore != null && (
                        <div className="bg-primary/5 border border-primary/10 rounded-lg p-2 text-center min-w-[70px] shrink-0">
                          <span className="block text-[10px] uppercase font-bold text-primary mb-0.5">Score</span>
                          <span className="text-lg font-black text-primary">{ev.averageScore.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-sm text-slate-600">
                      <div className="flex items-center gap-2 truncate">
                        <Calendar size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{new Date(ev.startDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})} — {new Date(ev.endDate).toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})}</span>
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <MapPin size={14} className="text-slate-400 shrink-0" />
                        <span className="truncate">{ev.city ? `${ev.city}, ${ev.state}` : "Local não definido"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-slate-400 shrink-0" />
                        <span>{ev.participantCount} participantes</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 px-5 py-3 border-t flex items-center justify-between">
                    <div className="flex-1 max-w-[200px]">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                        <span className="text-slate-600">Avaliações</span>
                        <span className={progress === 100 ? "text-green-600" : "text-primary"}>{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", progress === 100 ? "bg-green-500" : "bg-primary")} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {canEdit && ev.status === "open" && (
                        <Button
                          data-testid={`button-close-event-${ev.id}`}
                          size="sm"
                          variant="ghost"
                          className="h-8 text-slate-500 hover:text-slate-900"
                          onClick={() => closeMutation.mutate({ id: ev.id })}
                        >
                          <Lock size={14} className="mr-1.5" /> Fechar
                        </Button>
                      )}
                      {canEdit && ev.status === "closed" && (
                        <Button
                          data-testid={`button-reopen-event-${ev.id}`}
                          size="sm"
                          variant="ghost"
                          className="h-8 text-slate-500 hover:text-slate-900"
                          onClick={() => reopenMutation.mutate({ id: ev.id })}
                        >
                          <Unlock size={14} className="mr-1.5" /> Reabrir
                        </Button>
                      )}
                      <Link href={`/events/${ev.id}`}>
                        <Button data-testid={`button-view-event-${ev.id}`} size="sm" className="h-8 shadow-sm">
                          Gerenciar <ChevronRight size={14} className="ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
