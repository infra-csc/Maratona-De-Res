import { useState, useEffect } from "react";
import { useGetEvents, useCreateEvent, useMergeEvent, useDeleteEvent, useGetCurrentCycle, getGetEventsQueryKey, ApiError } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, ChevronRight, Users, Plus, GitMerge, ChevronsUpDown, Check, SlidersHorizontal, ChevronUp, ChevronDown, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { CycleBadge } from "@/components/cycle-badge";
import { cn } from "@/lib/utils";

function getCycleWeekends(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return [] as { sat: string; sun: string; label: string }[];
  const result: { sat: string; sun: string; label: string }[] = [];
  const end = new Date(endDate + "T12:00:00");
  const d = new Date(startDate + "T12:00:00");
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d <= end) {
    const sat = d.toISOString().split("T")[0];
    const sunD = new Date(d); sunD.setDate(sunD.getDate() + 1);
    const sun = sunD.toISOString().split("T")[0];
    const label = `${String(d.getDate()).padStart(2,"0")}–${String(sunD.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    result.push({ sat, sun, label });
    d.setDate(d.getDate() + 7);
  }
  return result;
}

function MiniBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <div className="h-1 bg-[#e8eae0] w-full overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[9px] font-black italic" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("dateDesc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mergeForEvent, setMergeForEvent] = useState<{ id: number; name: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeTargetPickerOpen, setMergeTargetPickerOpen] = useState(false);
  const [mergeConflict, setMergeConflict] = useState<{ evaluations: number; calibrations: number; conformities: number; results: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [editingEvent, setEditingEvent] = useState<{ id: number; name: string; startDate: string; endDate: string; clientName?: string | null; city?: string | null; state?: string | null; location?: string | null } | null>(null);

  const queryKey = getGetEventsQueryKey();
  const { data: events, isLoading } = useGetEvents(
    undefined,
    { query: { queryKey, refetchInterval: 15000, refetchOnWindowFocus: true } }
  );
  const { data: cycle } = useGetCurrentCycle();

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

  const deleteMutation = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        toast({ title: "Evento excluído com sucesso." });
        setDeleteTarget(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    },
  });

  const { register, handleSubmit, reset } = useForm<EventInput>();

  type EditEventInput = { name: string; startDate: string; endDate: string; clientName?: string; city?: string; state?: string; location?: string };
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit } = useForm<EditEventInput>();

  const normalizeDatesMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("maratona_token");
      const res = await fetch("/api/events/admin/normalize-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<{ ok: boolean; fixedCount: number; normalizedCount: number }>;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Datas normalizadas", description: `${d.fixedCount} corrigidos + ${d.normalizedCount} unificados para data única.` });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: EditEventInput }) => {
      const token = localStorage.getItem("maratona_token");
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Evento atualizado com sucesso." });
      setEditingEvent(null);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (editingEvent) {
      resetEdit({
        name: editingEvent.name,
        startDate: editingEvent.startDate,
        endDate: editingEvent.endDate,
        clientName: editingEvent.clientName ?? "",
        city: editingEvent.city ?? "",
        state: editingEvent.state ?? "",
        location: editingEvent.location ?? "",
      });
    }
  }, [editingEvent, resetEdit]);

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

  const all = events ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastOrClosed = (e: typeof all[0]) => e.status === "closed" || (!!e.endDate && new Date(e.endDate) < today);
  const isInEvaluation = (e: typeof all[0]) =>
    !!e.criteriaConfirmed &&
    (e.evaluationProgress ?? 0) > 0 &&
    (e.calibratedCriteriaCount ?? 0) === 0;

  const cycleWeekends = getCycleWeekends(cycle?.startDate, cycle?.endDate);

  const colSortPairs: Record<string, string> = {
    nameAsc: "nameDesc", nameDesc: "nameAsc",
    dateDesc: "dateAsc", dateAsc: "dateDesc",
    participantsDesc: "participantsAsc", participantsAsc: "participantsDesc",
    evaluatedDesc: "evaluatedAsc", evaluatedAsc: "evaluatedDesc",
    calibrDesc: "calibrAsc", calibrAsc: "calibrDesc",
    scoreDesc: "scoreAsc", scoreAsc: "scoreDesc",
  };
  const colPrimary: Record<string, string> = {
    name: "nameAsc", date: "dateDesc", participants: "participantsDesc",
    evaluated: "evaluatedDesc", calibr: "calibrDesc", score: "scoreDesc",
  };
  const handleColSort = (col: string) => {
    const primary = colPrimary[col];
    if (sortBy === primary || sortBy === colSortPairs[primary]) {
      setSortBy(colSortPairs[sortBy] ?? primary);
    } else {
      setSortBy(primary);
    }
  };
  const colActive = (col: string) => {
    const primary = colPrimary[col];
    return sortBy === primary || sortBy === colSortPairs[primary];
  };
  const sortAsc = (col: string) => {
    const primary = colPrimary[col];
    return sortBy === colSortPairs[primary];
  };

  const filtered = all.filter(ev => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase())
      || (ev.clientName ?? "").toLowerCase().includes(search.toLowerCase())
      || (ev.city ?? "").toLowerCase().includes(search.toLowerCase())
      || (ev.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchDate = (!filterDateFrom || ev.endDate >= filterDateFrom) && (!filterDateTo || ev.startDate <= filterDateTo);
    const matchCard = cardFilter === null
      || (cardFilter === "pendingRH"  && !ev.criteriaConfirmed)
      || (cardFilter === "inEval"     && isInEvaluation(ev))
      || (cardFilter === "concluded"  && ev.status === "closed")
      || (cardFilter === "pendingCal" && isPastOrClosed(ev) && (ev.calibratedCriteriaCount ?? 0) < (ev.totalCriteria ?? 0))
      || (cardFilter === "fullyEval"  && (ev.totalCriteria ?? 0) > 0 && (ev.calibratedCriteriaCount ?? 0) >= (ev.totalCriteria ?? 0));
    return matchSearch && matchDate && matchCard;
  }).slice().sort((a, b) => {
    const sc = (ev: typeof a) => (ev.teamScore ?? ev.averageScore) ?? null;
    const ec = (ev: typeof a) => (ev.totalCriteria ?? 0) > 0 ? (ev.evaluatedCriteria ?? 0) / (ev.totalCriteria ?? 1) : -1;
    const cc = (ev: typeof a) => (ev.totalCriteria ?? 0) > 0 ? (ev.calibratedCriteriaCount ?? 0) / (ev.totalCriteria ?? 1) : -1;
    if (sortBy === "nameAsc")          return a.name.localeCompare(b.name);
    if (sortBy === "nameDesc")         return b.name.localeCompare(a.name);
    if (sortBy === "dateAsc")          return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (sortBy === "participantsDesc") return (b.participantCount ?? 0) - (a.participantCount ?? 0);
    if (sortBy === "participantsAsc")  return (a.participantCount ?? 0) - (b.participantCount ?? 0);
    if (sortBy === "evaluatedDesc")    return ec(b) - ec(a);
    if (sortBy === "evaluatedAsc")     return ec(a) - ec(b);
    if (sortBy === "calibrDesc")       return cc(b) - cc(a);
    if (sortBy === "calibrAsc")        return cc(a) - cc(b);
    if (sortBy === "scoreDesc")        return (sc(b) ?? -1) - (sc(a) ?? -1);
    if (sortBy === "scoreAsc")         return (sc(a) ?? 101) - (sc(b) ?? 101);
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const canCreate = user && ["admin", "rh"].includes(user.role);
  const hasDateFilter = !!(filterDateFrom || filterDateTo);

  const GRID_COLS = "1fr 90px 56px 130px 130px 80px 120px 72px";

  const chipFilters = [
    { key: null,          label: "Todos" },
    { key: "inEval",      label: "Em Avaliação" },
    { key: "pendingRH",   label: "Aguardando RH" },
    { key: "concluded",   label: "Concluídos" },
    { key: "fullyEval",   label: "Pub. Final" },
    { key: "pendingCal",  label: "Falta Cal." },
  ];

  return (
    <div className="min-h-full flex flex-col text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Dark header ── */}
      <div className="bg-[#191c1e] border-b-4 border-[#ccff00] px-5 py-3 flex items-center gap-4 shrink-0 flex-wrap">
        <div className="shrink-0">
          <span className="text-[9px] font-black italic uppercase text-[#747a60] tracking-wider block">Gerenciar</span>
          <h1 data-testid="text-page-title" className="text-[15px] font-black italic uppercase text-white leading-tight">Eventos do Ciclo</h1>
        </div>

        <div className="shrink-0">
          <CycleBadge />
        </div>

        {/* Quick stats */}
        <div className="flex items-center border-l border-[#333] pl-4 gap-0">
          {[
            { val: all.length,                                                label: "Eventos",    color: "text-white" },
            { val: all.filter(e => e.status === "open").length,               label: "Abertos",    color: "text-[#ccff00]" },
            { val: all.filter(e => e.status === "closed").length,             label: "Concluídos", color: "text-[#9aa088]" },
            { val: all.filter(e => e.fullyCalibrated).length,                 label: "Pub. Final", color: "text-[#768f00]" },
          ].map((s, i) => (
            <div key={i} className="px-3 py-1 border-r border-[#333] last:border-0">
              <span className={`block text-[17px] font-black italic leading-none ${s.color}`}>{s.val}</span>
              <span className="text-[8px] font-bold italic uppercase text-[#747a60]">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {user?.role === "admin" && (
            <button
              onClick={() => {
                if (!confirm("Isso vai:\n• Corrigir os 4 eventos com datas erradas\n• Unificar TODOS os eventos multi-dia para data única (startDate = endDate)\n\nConfirmar?")) return;
                normalizeDatesMutation.mutate();
              }}
              disabled={normalizeDatesMutation.isPending}
              className="h-8 px-3 border border-[#333] text-[9px] font-bold italic uppercase text-[#9aa088] hover:border-[#ccff00] hover:text-[#ccff00] transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {normalizeDatesMutation.isPending ? "..." : "Unificar Datas"}
            </button>
          )}
          {canCreate && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="button-create-event"
                  className="h-8 px-3 bg-[#ccff00] text-[#161e00] text-[9px] font-black italic uppercase flex items-center gap-1.5 hover:bg-[#b8e800] transition-colors"
                >
                  <Plus size={10} /> Novo Evento
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
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white border-b border-[#e0e2da] px-5 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-1.5 border border-[#d0d2ca] px-2.5 py-1.5 w-64 shrink-0">
          <Search size={10} className="text-[#9aa088] shrink-0" />
          <input
            data-testid="input-search-events"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar evento, cliente ou cidade…"
            className="text-[10px] italic text-[#191c1e] bg-transparent outline-none w-full placeholder:text-[#b0b8a0]"
          />
        </div>

        {/* Status chip filters */}
        {chipFilters.map((f) => (
          <button
            key={String(f.key)}
            onClick={() => setCardFilter(f.key)}
            className={`h-7 px-2.5 text-[9px] font-bold italic uppercase border transition-colors shrink-0 ${
              cardFilter === f.key
                ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]"
                : "bg-white text-[#747a60] border-[#d0d2ca] hover:border-[#191c1e] hover:text-[#191c1e]"
            }`}
          >
            {f.label}
          </button>
        ))}

        {/* Date filter popover */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className={`ml-auto h-7 px-3 border text-[9px] font-bold italic uppercase flex items-center gap-1.5 transition-colors shrink-0 ${
                hasDateFilter
                  ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]"
                  : "border-[#d0d2ca] text-[#747a60] hover:border-[#191c1e] hover:text-[#191c1e]"
              }`}
            >
              <SlidersHorizontal size={10} />
              {hasDateFilter ? "Datas ●" : "Filtrar Datas"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] p-4 space-y-3">
            <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60]">Filtrar por data</p>
            <div>
              <label className="text-[9px] font-bold italic uppercase tracking-wide text-[#9aa088] block mb-1">De</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full h-8 px-2 text-xs border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold italic uppercase tracking-wide text-[#9aa088] block mb-1">Até</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="w-full h-8 px-2 text-xs border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white"
              />
            </div>
            {cycleWeekends.length > 0 && (
              <div>
                <p className="text-[9px] font-bold italic uppercase tracking-wide text-[#9aa088] mb-1">Fim de semana</p>
                <div className="flex flex-wrap gap-1">
                  {cycleWeekends.map(w => {
                    const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                    return (
                      <button
                        key={w.sat}
                        type="button"
                        onClick={() => {
                          if (active) { setFilterDateFrom(""); setFilterDateTo(""); }
                          else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); }
                        }}
                        className={`px-2 py-1 text-[9px] font-black italic uppercase border-2 transition-colors ${
                          active ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d4c8] hover:border-[#191c1e] hover:text-[#191c1e]"
                        }`}
                      >
                        {w.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                className="w-full text-[10px] font-bold italic uppercase text-[#747a60] hover:text-[#b02f00] text-left"
              >
                × Limpar datas
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {isLoading ? (
          <div className="space-y-px bg-white border border-[#d0d2ca]">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-white animate-pulse border-b border-[#eceef0]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Calendar size={40} className="mb-4 opacity-20" />
            <h3 className="text-lg font-black italic uppercase tracking-tight text-[#191c1e]">Nenhum evento encontrado</h3>
            <p className="text-[#747a60] italic mt-1 text-sm">Ajuste os filtros ou sincronize via integração.</p>
            {cardFilter !== null && (
              <button
                onClick={() => setCardFilter(null)}
                className="mt-4 px-4 py-2 text-[10px] font-bold italic uppercase border-2 border-[#191c1e] hover:bg-[#191c1e] hover:text-[#ccff00] transition-colors"
              >
                Limpar filtro
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-[#d0d2ca]">
            {/* Table header */}
            <div
              className="grid border-b-2 border-[#191c1e] bg-[#191c1e] sticky top-0 z-10"
              style={{ gridTemplateColumns: GRID_COLS }}
            >
              {(["name","date","participants","evaluated","calibr","score"] as const).map((col, i) => {
                const labels: Record<string, string> = {
                  name: "Evento", date: "Data", participants: "Part.",
                  evaluated: "Avaliações", calibr: "Calibrações", score: "Nota",
                };
                const active = colActive(col);
                const asc = sortAsc(col);
                return (
                  <div
                    key={col}
                    onClick={() => handleColSort(col)}
                    className={`px-3 py-2 text-[9px] font-black italic uppercase tracking-wider cursor-pointer select-none flex items-center gap-1 transition-colors group
                      ${i === 0 ? "pl-4" : ""}
                      ${active ? "text-[#ccff00]" : "text-[#ccff00]/50 hover:text-[#ccff00]/80"}`}
                  >
                    {labels[col]}
                    <span className={`inline-flex flex-col leading-none transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
                      <ChevronUp size={7} className={active && asc ? "text-[#ccff00]" : "text-[#ccff00]/50"} />
                      <ChevronDown size={7} className={active && !asc ? "text-[#ccff00]" : "text-[#ccff00]/50"} />
                    </span>
                  </div>
                );
              })}
              <div className="px-3 py-2 text-[9px] font-black italic uppercase tracking-wider text-[#ccff00]/50">Status</div>
              <div className="px-3 py-2" />
            </div>

            {/* Rows */}
            {filtered.map((ev, i) => {
              const score = ev.teamScore ?? ev.averageScore ?? null;
              const concluded = ev.status === "closed";
              const total = ev.totalCriteria ?? 0;
              const evaluated = ev.evaluatedCriteria ?? 0;
              const calCount = ev.calibratedCriteriaCount ?? 0;
              const fc = ev.fullyCalibrated ?? false;
              const finalPubCount = ev.finalCalibratedCriteria ?? 0;
              const partialPubTotal = (ev as Record<string, unknown>).partialPublishedCount as number ?? 0;
              const calSaved = (ev as Record<string, unknown>).calibratedCriteriaCount as number ?? 0;
              const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
              const isPureHistorical = !!ev.isHistorical && calSaved === 0;
              const hasEvals = evaluated > 0;
              const missing = ev.unassignedAreaNames ?? [];

              // Accent bar color
              const accentColor = !ev.criteriaConfirmed && !hasEvals ? "#ff5722"
                : fc ? "#506600"
                : evaluated === total && total > 0 ? "#ccff00"
                : evaluated > 0 ? "#ffb300"
                : "#e0e2da";

              // Score label
              const scoreLabel = isPureHistorical
                ? "Importado"
                : finalPubCount > 0 && partialOnlyCount > 0
                  ? `${finalPubCount}F · ${partialOnlyCount}P`
                  : finalPubCount > 0 ? "Pub. Final"
                  : partialOnlyCount > 0 ? "Pub. Parcial"
                  : calSaved > 0 ? "Rascunho"
                  : "Avaliador";
              const scoreLabelColor = isPureHistorical ? "#a06a00"
                : finalPubCount > 0 && partialOnlyCount === 0 ? "#506600"
                : finalPubCount > 0 || partialOnlyCount > 0 ? "#a06a00"
                : calSaved > 0 ? "#1565c0"
                : "#747a60";

              // MiniBar colors
              const evalColor = !isPureHistorical && evaluated === total && total > 0 ? "#506600" : "#ccff00";
              const calColor = fc ? "#506600" : calCount > 0 ? "#a06a00" : "#d0d2ca";

              // Date display
              const dateStr = ev.startDate === ev.endDate
                ? new Date(ev.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                : `${new Date(ev.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}–${new Date(ev.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

              return (
                <div
                  key={ev.id}
                  data-testid={`row-event-${ev.id}`}
                  className={`grid relative items-center border-b border-[#eceef0] hover:bg-[#f8fdf0] transition-colors group ${i % 2 !== 0 ? "bg-[#fafcf5]" : "bg-white"}`}
                  style={{ gridTemplateColumns: GRID_COLS }}
                >
                  {/* Accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} />

                  {/* Event name + subtitle */}
                  <div className="pl-4 pr-3 py-3 min-w-0">
                    <Link href={`/events/${ev.id}`} className="text-[11px] font-black italic uppercase text-[#191c1e] hover:text-[#506600] leading-tight block truncate transition-colors">
                      {ev.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
                      {ev.isHistorical && (
                        <span className="text-[9px] font-black italic uppercase text-[#a06a00]">Histórico ·</span>
                      )}
                      {!ev.criteriaConfirmed && !hasEvals && (
                        <span className="text-[9px] font-black italic uppercase text-[#b02f00]">Ag. RH ·</span>
                      )}
                      {!ev.resultsConfirmed && ev.criteriaConfirmed && (
                        <span className="text-[9px] font-black italic uppercase text-[#a06a00]">Elegib. pend. ·</span>
                      )}
                      <span className="text-[9px] italic text-[#9aa088] truncate">
                        {[ev.clientName, ev.city].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {missing.length > 0 && !hasEvals && (
                      <p className="text-[9px] font-bold italic uppercase text-[#b02f00] truncate mt-0.5">
                        Sem aval.: {missing.join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="px-3 py-3 text-[10px] font-bold italic text-[#444933] whitespace-nowrap">{dateStr}</div>

                  {/* Participants */}
                  <div className="px-3 py-3 flex items-center gap-1 text-[#747a60]">
                    <Users size={10} />
                    <span className="text-[11px] font-black italic text-[#444933]">{ev.participantCount ?? 0}</span>
                  </div>

                  {/* Avaliações mini bar */}
                  <div className="px-3 py-3">
                    {isPureHistorical ? (
                      <span className="text-[10px] italic text-[#c4c9ac]">—</span>
                    ) : total === 0 ? (
                      <span className="text-[10px] italic text-[#c4c9ac]">—</span>
                    ) : (
                      <MiniBar value={evaluated} total={total} color={evalColor} />
                    )}
                  </div>

                  {/* Calibrações mini bar */}
                  <div className="px-3 py-3">
                    {isPureHistorical ? (
                      <span className="text-[10px] italic text-[#c4c9ac]">—</span>
                    ) : total === 0 ? (
                      <span className="text-[10px] italic text-[#c4c9ac]">—</span>
                    ) : (
                      <MiniBar value={calCount} total={total} color={calColor} />
                    )}
                  </div>

                  {/* Score */}
                  <div className="px-3 py-3 text-center">
                    {score != null ? (
                      <div>
                        <span className={`text-[18px] font-black italic leading-none block ${fc ? "text-[#506600]" : "text-[#191c1e]"}`}>
                          {score.toFixed(1)}
                        </span>
                        <span className="text-[8px] font-bold italic uppercase" style={{ color: scoreLabelColor }}>{scoreLabel}</span>
                      </div>
                    ) : (
                      <span className="text-[14px] italic text-[#c4c9ac]">—</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="px-3 py-3">
                    {!ev.criteriaConfirmed && !hasEvals ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#fff0ee] text-[#b02f00] border-[#f0b0a0]">Ag. RH</span>
                    ) : fc ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#191c1e] text-[#ccff00] border-[#506600]">Pub. Final</span>
                    ) : partialOnlyCount > 0 ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#fff8e1] text-[#a06a00] border-[#e8c870]">Pub. Parcial</span>
                    ) : calSaved > 0 ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#e8f0fe] text-[#1565c0] border-[#90aee8]">Rascunho</span>
                    ) : concluded ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#f4fce0] text-[#506600] border-[#c4cda8]">Concluído</span>
                    ) : evaluated === total && total > 0 ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#f4fce0] text-[#506600] border-[#c4cda8]">Avaliado</span>
                    ) : evaluated > 0 ? (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#fff4e5] text-[#a06a00] border-[#e8b84b]">Em Avaliação</span>
                    ) : (
                      <span className="text-[8px] font-black italic uppercase px-1.5 py-0.5 border bg-[#eceef0] text-[#747a60] border-[#d0d2ca]">Aguardando</span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="px-2 py-3 flex items-center justify-center gap-1">
                    <Link href={`/events/${ev.id}`}>
                      <button
                        data-testid={`button-view-event-${ev.id}`}
                        title="Gerenciar evento"
                        className="h-7 w-7 bg-[#191c1e] text-[#ccff00] flex items-center justify-center hover:bg-[#506600] transition-colors"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </Link>
                    {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 flex items-center justify-center border border-[#d0d2ca] bg-white text-[#747a60] hover:bg-[#eceef0] hover:border-[#191c1e] transition-all">
                            <MoreHorizontal size={11} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] min-w-[160px]">
                          {user && ["admin", "rh"].includes(user.role) && (
                            <DropdownMenuItem
                              data-testid={`button-edit-event-${ev.id}`}
                              onClick={() => setEditingEvent({ id: ev.id, name: ev.name, startDate: ev.startDate, endDate: ev.endDate, clientName: ev.clientName, city: ev.city, state: ev.state, location: ev.location })}
                              className="gap-2 italic font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={12} /> Editar
                            </DropdownMenuItem>
                          )}
                          {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                            <DropdownMenuItem asChild className="gap-2 italic font-bold text-xs cursor-pointer">
                              <Link href={`/calibrations?eventId=${ev.id}`}>
                                <SlidersHorizontal size={12} /> Calibrações
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {user?.role === "admin" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                data-testid={`button-merge-event-${ev.id}`}
                                onClick={() => { setMergeForEvent({ id: ev.id, name: ev.name }); setMergeTargetId(""); }}
                                className="gap-2 italic font-bold text-xs cursor-pointer"
                              >
                                <GitMerge size={12} /> Mesclar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                data-testid={`button-delete-event-${ev.id}`}
                                onClick={() => setDeleteTarget({ id: ev.id, name: ev.name })}
                                className="gap-2 italic font-bold text-xs cursor-pointer text-[#b02f00] focus:text-[#b02f00]"
                              >
                                <Trash2 size={12} /> Excluir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend + count */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center gap-5 mt-3 px-1 flex-wrap">
            {[
              { color: "#506600", label: "Pub. Final" },
              { color: "#ccff00", label: "Avaliado" },
              { color: "#ffb300", label: "Em andamento" },
              { color: "#e0e2da", label: "Aguardando" },
              { color: "#ff5722", label: "Ag. RH" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-[3px] h-3 shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-[9px] italic text-[#747a60]">{l.label}</span>
              </div>
            ))}
            <span className="ml-auto text-[11px] italic text-[#747a60]">
              {filtered.length === all.length
                ? `${all.length} eventos no ciclo`
                : `${filtered.length} de ${all.length} eventos`}
            </span>
          </div>
        )}
      </div>

      {/* ── Merge dialog ── */}
      <Dialog open={!!mergeForEvent} onOpenChange={(open) => { if (!open) { setMergeForEvent(null); setMergeTargetId(""); setMergeConflict(null); } }}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Mesclar Evento Duplicado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm italic text-[#444933]">
              Este evento (<strong>{mergeForEvent?.name}</strong>) será <strong>mantido</strong>. Escolha o evento duplicado abaixo — os dados vazios serão preenchidos, os participantes migrados e o duplicado <strong>excluído</strong>.
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
                <p>{mergeConflict.evaluations} avaliação(ões), {mergeConflict.calibrations} calibração(ões), {mergeConflict.conformities} conformidade(s) e {mergeConflict.results} resultado(s).</p>
                <p>Esses dados serão descartados. Confirma a mesclagem?</p>
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

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight text-[#b02f00]">Excluir Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm italic text-[#444933]">
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Todos os participantes, avaliações, calibrações e resultados vinculados serão <strong>permanentemente removidos</strong>. Essa ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 border-2 border-[#191c1e] bg-white text-[#191c1e] text-xs font-bold italic uppercase hover:bg-[#eceef0] transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => { if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id }); }}
                className="h-9 px-4 border-2 border-[#b02f00] bg-[#b02f00] text-white text-xs font-bold italic uppercase hover:bg-[#8a2000] disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                {deleteMutation.isPending ? "Excluindo..." : "Excluir Definitivamente"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit event dialog ── */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => { if (!open) setEditingEvent(null); }}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Editar Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(d => { if (editingEvent) editMutation.mutate({ id: editingEvent.id, data: d }); })} className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome do Evento <span className="text-[#ba1a1a]">*</span></Label>
              <Input data-testid="input-edit-event-name" {...registerEdit("name", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Cliente</Label>
              <Input data-testid="input-edit-event-client" {...registerEdit("clientName")} className="h-11 rounded-none border-2 border-[#191c1e]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Início <span className="text-[#ba1a1a]">*</span></Label>
                <Input data-testid="input-edit-event-start" type="date" {...registerEdit("startDate", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Fim <span className="text-[#ba1a1a]">*</span></Label>
                <Input data-testid="input-edit-event-end" type="date" {...registerEdit("endDate", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Cidade</Label>
                <Input data-testid="input-edit-event-city" {...registerEdit("city")} className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">UF</Label>
                <Input data-testid="input-edit-event-state" {...registerEdit("state")} maxLength={2} className="h-11 rounded-none border-2 border-[#191c1e] uppercase" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Local</Label>
              <Input data-testid="input-edit-event-location" {...registerEdit("location")} className="h-11 rounded-none border-2 border-[#191c1e]" />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
              <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setEditingEvent(null)}>Cancelar</Button>
              <button
                data-testid="button-submit-edit-event"
                type="submit"
                disabled={editMutation.isPending}
                className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
              >
                {editMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
