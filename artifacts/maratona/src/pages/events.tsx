import { useState, useEffect, useRef } from "react";
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
  const weekendRowRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!weekendRowRef.current || cycleWeekends.length === 0) return;
    const todayStr = new Date().toISOString().split("T")[0];
    const idx = cycleWeekends.findIndex(w => w.sun >= todayStr);
    const targetIdx = idx >= 0 ? idx : cycleWeekends.length - 1;
    const chip = weekendRowRef.current.children[targetIdx] as HTMLElement | undefined;
    if (chip) chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
  }, [cycle?.startDate]);

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

      {/* ── Weekend chips row ── */}
      {cycleWeekends.length > 0 && (
        <div className="bg-[#f4f6ee] border-b-2 border-[#191c1e] px-5 py-1.5 flex items-center gap-3 shrink-0">
          <span className="text-[9px] font-black italic uppercase tracking-widest text-[#506600] shrink-0 flex items-center gap-1.5">
            <Calendar size={10} />
            Fim de Semana
          </span>
          <div ref={weekendRowRef} className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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
                  className={`px-2.5 py-1 text-[9px] font-black italic uppercase whitespace-nowrap border-2 transition-colors shrink-0 ${
                    active
                      ? "bg-[#ccff00] text-[#161e00] border-[#191c1e]"
                      : "bg-white text-[#747a60] border-[#d0d4c8] hover:border-[#191c1e] hover:text-[#191c1e]"
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          {hasDateFilter && filterDateFrom && filterDateTo && (
            <button
              type="button"
              onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
              className="ml-auto text-[9px] font-bold italic uppercase text-[#9aa088] hover:text-[#b02f00] shrink-0"
            >
              × limpar
            </button>
          )}
        </div>
      )}

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-white border-2 border-[#eceef0] animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Calendar size={40} className="mb-4 opacity-20" />
                <h3 className="text-lg font-black italic uppercase tracking-tight text-[#191c1e]">Nenhum evento encontrado</h3>
                <p className="text-[#747a60] italic mt-1 text-sm">Ajuste os filtros ou sincronize via integração.</p>
              </div>
            ) : viewMode === "table" ? (
              <div className="bg-white border-b-2 border-[#eceef0] overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[860px]">
                  <thead>
                    <tr className="border-b-2 border-[#191c1e] bg-[#191c1e] sticky top-0 z-10">
                      {(["name","date","participants","evaluated","calibr","score","status"] as const).map((col, i) => {
                        const labels: Record<string, string> = { name:"Evento", date:"Período", participants:"Part.", evaluated:"Avaliados", calibr:"Calibr.", score:"Score", status:"Status" };
                        const centered = ["participants","evaluated","calibr","score"].includes(col);
                        const active = colActive(col);
                        const asc = sortAsc(col);
                        return (
                          <th
                            key={col}
                            onClick={() => handleColSort(col)}
                            className={`py-3 text-[10px] font-bold uppercase italic cursor-pointer select-none whitespace-nowrap group transition-colors
                              ${i === 0 ? "px-4" : "px-3"}
                              ${centered ? "text-center" : ""}
                              ${active ? "text-[#ccff00]" : "text-[#ccff00]/60 hover:text-[#ccff00]"}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {labels[col]}
                              <span className={`inline-flex flex-col leading-none transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}>
                                <ChevronUp size={8} className={active && asc ? "text-[#ccff00]" : "text-[#ccff00]/50"} />
                                <ChevronDown size={8} className={active && !asc ? "text-[#ccff00]" : "text-[#ccff00]/50"} />
                              </span>
                            </span>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-[10px] font-bold uppercase italic text-[#ccff00]/60 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#eceef0]">
                    {filtered.map(ev => {
                      const score = ev.teamScore ?? ev.averageScore ?? null;
                      const concluded = ev.status === "closed";
                      const total = ev.totalCriteria ?? 0;
                      const evaluated = ev.evaluatedCriteria ?? 0;
                      const calCount = ev.calibratedCriteriaCount ?? 0;
                      const fc = ev.fullyCalibrated ?? false;
                      const isScoreFinal = concluded && fc;
                      const finalPubCount = ev.finalCalibratedCriteria ?? 0;
                      const partialPubTotal = ev.partialPublishedCount ?? 0;
                      const calSaved = ev.calibratedCriteriaCount ?? 0;
                      const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
                      const scoreLabel = finalPubCount > 0 && partialOnlyCount > 0
                        ? `${finalPubCount}F · ${partialOnlyCount}P`
                        : finalPubCount > 0 ? "Calibrado Final"
                        : partialOnlyCount > 0 ? "Calibrado Parcial"
                        : calSaved > 0 ? "Calibrado"
                        : "Avaliador";
                      const scoreLabelColor = finalPubCount > 0 && partialOnlyCount === 0
                        ? "text-[#506600]"
                        : finalPubCount > 0 || partialOnlyCount > 0 ? "text-[#a06a00]"
                        : calSaved > 0 ? "text-[#b06000]"
                        : "text-[#747a60]";
                      const missing = ev.unassignedAreaNames ?? [];
                      const hasEvals = evaluated > 0;
                      const statusColor = !ev.criteriaConfirmed && !hasEvals ? "#ff5722"
                        : fc ? "#ccff00"
                        : evaluated === total && total > 0 ? "#506600"
                        : evaluated > 0 ? "#ffb300"
                        : "#506600";
                      return (
                        <tr key={ev.id} data-testid={`row-event-${ev.id}`} className="hover:bg-[#f7f9fb] transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-[3px] h-9 shrink-0 rounded-sm" style={{ backgroundColor: statusColor }} />
                              <div className="min-w-0">
                                <Link href={`/events/${ev.id}`} className="font-black italic uppercase text-xs text-[#191c1e] hover:text-[#506600] leading-tight block">{ev.name}</Link>
                                <p className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">
                                  {[ev.clientName, ev.city].filter(Boolean).join(" · ") || "—"}
                                </p>
                                {missing.length > 0 && !hasEvals && (
                                  <p className="text-[10px] font-bold italic uppercase text-[#b02f00] truncate" title={`Sem avaliador: ${missing.join(", ")}`}>
                                    Sem avaliador: {missing.join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs font-bold italic text-[#444933] whitespace-nowrap">
                            {new Date(ev.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} — {new Date(ev.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-bold italic text-[#444933] text-center">{ev.participantCount ?? 0}</td>
                          <td className={`px-3 py-2.5 text-xs font-black italic text-center ${total > 0 && evaluated === total ? "text-[#506600]" : "text-[#191c1e]"}`}>
                            {total === 0 ? "—" : `${evaluated}/${total}`}
                          </td>
                          <td className={`px-3 py-2.5 text-xs font-black italic text-center ${fc ? "text-[#506600]" : calCount > 0 ? "text-[#a06a00]" : "text-[#747a60]"}`}>
                            {total === 0 ? "—" : `${calCount}/${total}`}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {score == null ? (
                              <span className="text-xs italic text-[#c4c9ac]">—</span>
                            ) : (
                              <>
                                <span className="text-sm font-black italic text-[#191c1e]">{score.toFixed(1)}</span>
                                <span className={`block text-[9px] font-bold italic uppercase leading-none ${scoreLabelColor}`}>
                                  {scoreLabel}
                                </span>
                              </>
                            )}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {!ev.criteriaConfirmed && !hasEvals ? (
                              <span className="text-[10px] font-bold italic uppercase text-[#b02f00]">Aguardando RH</span>
                            ) : !ev.resultsConfirmed ? (
                              <span className="text-[10px] font-bold italic uppercase text-[#a06a00]">Elegib. pendente</span>
                            ) : ev.status === "closed" ? (
                              <span className="text-[10px] font-bold italic uppercase text-[#506600]">Concluído</span>
                            ) : (
                              <span className="text-[10px] font-bold italic uppercase text-[#506600]">OK</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {user?.role === "admin" && (
                                <button
                                  data-testid={`button-merge-event-${ev.id}`}
                                  title="Mesclar com evento duplicado"
                                  onClick={() => { setMergeForEvent({ id: ev.id, name: ev.name }); setMergeTargetId(""); }}
                                  className="h-7 px-2 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] transition-all"
                                >
                                  <GitMerge size={12} />
                                </button>
                              )}
                              {user?.role === "admin" && (
                                <button
                                  data-testid={`button-delete-event-${ev.id}`}
                                  title="Excluir evento"
                                  onClick={() => setDeleteTarget({ id: ev.id, name: ev.name })}
                                  className="h-7 px-2 flex items-center border-2 border-[#b02f00] bg-white text-[#b02f00] hover:bg-[#fff0ee] transition-all"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                                <Link href={`/calibrations?eventId=${ev.id}`}>
                                  <button title="Ir para calibração" className="h-7 px-2 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] transition-all">
                                    <SlidersHorizontal size={12} />
                                  </button>
                                </Link>
                              )}
                              <Link href={`/events/${ev.id}`}>
                                <button data-testid={`button-view-event-${ev.id}`} className="h-7 px-2.5 flex items-center bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] text-[10px] font-bold italic uppercase hover:bg-[#506600] hover:text-white transition-all whitespace-nowrap">
                                  Gerenciar
                                </button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
                {filtered.map(ev => {
                  const score = ev.teamScore ?? ev.averageScore ?? null;
                  const calibrated = ev.hasCalibration ?? false;
                  const concluded = ev.status === "closed";
                  const total = ev.totalCriteria ?? 0;
                  const evaluated = ev.evaluatedCriteria ?? 0;
                  const calCount = ev.finalCalibratedCriteria ?? 0;
                  const fc = ev.fullyCalibrated ?? false;
                  const evalPct = total > 0 ? Math.round((evaluated / total) * 100) : 0;
                  const calPct  = total > 0 ? Math.round((calCount / total) * 100) : 0;
                  const isScoreFinal = concluded && fc;
                  const finalPubCount = ev.finalCalibratedCriteria ?? 0;
                  const partialPubTotal = ev.partialPublishedCount ?? 0;
                  const calSaved = ev.calibratedCriteriaCount ?? 0;
                  const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
                  const scoreLabel = finalPubCount > 0 && partialOnlyCount > 0
                    ? `${finalPubCount}F · ${partialOnlyCount}P`
                    : finalPubCount > 0 ? "Calibrado Final"
                    : partialOnlyCount > 0 ? "Calibrado Parcial"
                    : calSaved > 0 ? "Calibrado"
                    : "Avaliador";
                  const scoreLabelColor = finalPubCount > 0 && partialOnlyCount === 0
                    ? "#506600"
                    : finalPubCount > 0 || partialOnlyCount > 0 ? "#a06a00"
                    : calSaved > 0 ? "#b06000"
                    : "#747a60";
                  const hasEvals = evaluated > 0;
                  const statusColor = !ev.criteriaConfirmed && !hasEvals ? "#ff5722"
                    : fc ? "#ccff00"
                    : evaluated === total && total > 0 ? "#506600"
                    : evaluated > 0 ? "#ffb300"
                    : "#506600";
                  return (
                    <div key={ev.id} data-testid={`card-event-${ev.id}`} className={`bg-white border-2 border-[#191c1e] border-l-[5px] flex flex-col ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`} style={{ borderLeftColor: statusColor }}>
                      <div className="p-5 flex-1">
                        <div className="flex justify-between items-start gap-4 mb-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              {!ev.criteriaConfirmed && !hasEvals && (
                                <span className="px-2 py-0.5 border border-[#191c1e] font-bold text-[10px] italic uppercase inline-block bg-[#fff0ee] text-[#b02f00]">
                                  Aguardando RH
                                </span>
                              )}
                              {!ev.resultsConfirmed && (
                                <span className="px-2 py-0.5 border border-[#191c1e] font-bold text-[10px] italic uppercase inline-block bg-[#fff8e0] text-[#a06a00]">
                                  Elegib. pendente
                                </span>
                              )}
                              {ev.isHistorical && (
                                <span data-testid={`badge-historical-${ev.id}`} className="bg-[#ffb300] text-[#3b2900] px-2 py-0.5 border border-[#191c1e] font-bold text-[10px] italic uppercase inline-block">Ciclo Anterior</span>
                              )}
                              {concluded && (
                                <span className="bg-[#506600] text-white px-2 py-0.5 border border-[#191c1e] font-bold text-[10px] italic uppercase inline-block">Concluído</span>
                              )}
                            </div>
                            <Link href={`/events/${ev.id}`} className="font-black text-base italic uppercase tracking-tight text-[#191c1e] hover:text-[#506600] transition-colors leading-tight block">{ev.name}</Link>
                            {ev.clientName && <p className="text-xs font-bold italic uppercase text-[#747a60] mt-0.5 truncate">{ev.clientName}</p>}
                          </div>
                          {score != null && (
                            <div className={`border-2 border-[#191c1e] p-2 text-center min-w-[74px] shrink-0 ${finalPubCount > 0 && partialOnlyCount === 0 ? "bg-[#ccff00]" : finalPubCount > 0 || partialOnlyCount > 0 ? "bg-[#fff8e1]" : "bg-[#f0f0f0]"}`}>
                              <span className="block text-[9px] uppercase font-bold italic mb-0.5" style={{ color: scoreLabelColor }}>{scoreLabel}</span>
                              <span className="text-xl font-black italic text-[#191c1e] leading-none">{score.toFixed(1)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold italic text-[#444933] mt-3 pt-3 border-t-2 border-dashed border-[#e0e3e5]">
                          <span className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-[#747a60]" />
                            {new Date(ev.startDate).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })} – {new Date(ev.endDate).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-[#747a60]" />
                            {ev.city ? `${ev.city}${ev.state ? `, ${ev.state}` : ""}` : (ev.location || "Local n/d")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users size={12} className="text-[#747a60]" />
                            {ev.participantCount} participantes
                          </span>
                        </div>
                        {!!ev.unassignedAreaNames && ev.unassignedAreaNames.length > 0 && (
                          <p className="mt-2 text-[10px] font-bold italic uppercase text-[#b02f00] flex items-start gap-1.5">
                            <Info size={11} className="shrink-0 mt-0.5" />
                            Sem avaliador: {ev.unassignedAreaNames.join(", ")}
                          </p>
                        )}
                      </div>

                      <div className="bg-[#f2f4f6] px-5 py-3 border-t-2 border-[#191c1e] flex items-center justify-between gap-4">
                        <div className="flex-1 max-w-[240px] space-y-1.5">
                          {total > 0 && (<>
                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-1 font-bold italic uppercase">
                                <span className="text-[#444933]">Avaliados</span>
                                <span className={evalPct === 100 ? "text-[#506600]" : "text-[#191c1e]"}>{evaluated}/{total}</span>
                              </div>
                              <div className="h-1.5 w-full bg-[#eceef0] border border-[#191c1e] overflow-hidden">
                                <div className={evalPct === 100 ? "h-full bg-[#506600]" : "h-full bg-[#ccff00]"} style={{ width: `${evalPct}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center justify-between text-[10px] mb-1 font-bold italic uppercase">
                                <span className="text-[#444933]">Calibrações</span>
                                <span className={fc ? "text-[#506600]" : calCount > 0 ? "text-[#a06a00]" : "text-[#747a60]"}>{calCount}/{total}</span>
                              </div>
                              <div className="h-1.5 w-full bg-[#eceef0] border border-[#191c1e] overflow-hidden">
                                <div className={fc ? "h-full bg-[#506600]" : "h-full bg-[#ffb300]"} style={{ width: `${calPct}%` }} />
                              </div>
                            </div>
                          </>)}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {user?.role === "admin" && (
                            <button data-testid={`button-merge-event-${ev.id}`} title="Mesclar" onClick={() => { setMergeForEvent({ id: ev.id, name: ev.name }); setMergeTargetId(""); }} className="h-8 px-2.5 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] transition-all">
                              <GitMerge size={14} />
                            </button>
                          )}
                          {user?.role === "admin" && (
                            <button
                              data-testid={`button-delete-event-${ev.id}`}
                              title="Excluir evento"
                              onClick={() => setDeleteTarget({ id: ev.id, name: ev.name })}
                              className="h-8 px-2.5 flex items-center border-2 border-[#b02f00] bg-white text-[#b02f00] hover:bg-[#fff0ee] transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                            <Link href={`/calibrations?eventId=${ev.id}`}>
                              <button data-testid={`button-calibrate-event-${ev.id}`} title="Calibrações" className="h-8 px-2.5 flex items-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] transition-all">
                                <SlidersHorizontal size={14} />
                              </button>
                            </Link>
                          )}
                          <Link href={`/events/${ev.id}`}>
                            <button data-testid={`button-view-event-${ev.id}`} className="h-8 px-3 flex items-center bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] text-[10px] font-bold italic uppercase hover:bg-[#506600] hover:text-white transition-all">
                              Gerenciar <ChevronRight size={13} className="ml-1" />
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
