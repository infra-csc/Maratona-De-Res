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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Lock, Unlock, Calendar, MapPin, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

function statusLabel(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    open: { label: "Aberto", variant: "default" },
    closed: { label: "Fechado", variant: "secondary" },
    calibration: { label: "Calibração", variant: "outline" },
  };
  return map[status] ?? { label: status, variant: "outline" };
}

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [filterQuarter, setFilterQuarter] = useState("all");
  const [open, setOpen] = useState(false);

  const queryKey = getGetEventsQueryKey({ year: Number(filterYear) });
  const { data: events, isLoading } = useGetEvents({ year: Number(filterYear) }, {
    query: { queryKey },
  });

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
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase()) || (ev.clientName ?? "").toLowerCase().includes(search.toLowerCase());
    const matchQuarter = filterQuarter === "all" || ev.quarter === Number(filterQuarter);
    return matchSearch && matchQuarter;
  });

  const canEdit = user && ["admin", "rh", "avaliador"].includes(user.role);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold">Eventos</h1>
          <p className="text-muted-foreground text-sm">Gerencie os eventos avaliados</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-event" size="sm">
                <Plus size={16} className="mr-1.5" /> Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo Evento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Nome do Evento *</Label>
                  <Input data-testid="input-event-name" {...register("name", { required: true })} placeholder="Ex: Evento Corporativo XYZ" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Cliente</Label>
                    <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome do cliente" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Cidade</Label>
                    <Input data-testid="input-event-city" {...register("city")} placeholder="São Paulo" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Início *</Label>
                    <Input data-testid="input-event-start" type="date" {...register("startDate", { required: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fim *</Label>
                    <Input data-testid="input-event-end" type="date" {...register("endDate", { required: true })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ano *</Label>
                    <Input data-testid="input-event-year" type="number" {...register("year", { required: true, valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trimestre *</Label>
                    <Select defaultValue={String(currentQuarter)} onValueChange={v => setValue("quarter", Number(v))}>
                      <SelectTrigger data-testid="select-event-quarter">
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
                <div className="flex justify-end gap-2 pt-2">
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

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-events"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            placeholder="Buscar evento ou cliente..."
          />
        </div>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger data-testid="select-filter-year" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterQuarter} onValueChange={setFilterQuarter}>
          <SelectTrigger data-testid="select-filter-quarter" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Trim.</SelectItem>
            <SelectItem value="1">T1</SelectItem>
            <SelectItem value="2">T2</SelectItem>
            <SelectItem value="3">T3</SelectItem>
            <SelectItem value="4">T4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando eventos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum evento encontrado</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(ev => {
            const s = statusLabel(ev.status);
            return (
              <Card key={ev.id} data-testid={`card-event-${ev.id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{ev.name}</h3>
                        <Badge variant={s.variant} className="shrink-0">{s.label}</Badge>
                        {ev.forcedClosed && <Badge variant="outline" className="shrink-0 text-orange-600 border-orange-300">Forçado</Badge>}
                      </div>
                      {ev.clientName && <p className="text-xs text-muted-foreground mt-0.5">{ev.clientName}</p>}
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar size={11} />{ev.startDate} — {ev.endDate}</span>
                        {ev.city && <span className="flex items-center gap-1"><MapPin size={11} />{ev.city}, {ev.state}</span>}
                        <span>T{ev.quarter}/{ev.year}</span>
                        <span>{ev.participantCount} participantes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canEdit && ev.status === "open" && (
                        <Button
                          data-testid={`button-close-event-${ev.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => closeMutation.mutate({ id: ev.id })}
                        >
                          <Lock size={13} className="mr-1" /> Fechar
                        </Button>
                      )}
                      {canEdit && ev.status === "closed" && (
                        <Button
                          data-testid={`button-reopen-event-${ev.id}`}
                          size="sm"
                          variant="outline"
                          onClick={() => reopenMutation.mutate({ id: ev.id })}
                        >
                          <Unlock size={13} className="mr-1" /> Reabrir
                        </Button>
                      )}
                      <Link href={`/events/${ev.id}`}>
                        <Button data-testid={`button-view-event-${ev.id}`} size="sm" variant="ghost">
                          <ChevronRight size={15} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
