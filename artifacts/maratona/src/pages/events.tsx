import { useState, useEffect, useRef } from "react";
import { useGetEvents, useCreateEvent, useMergeEvent, useDeleteEvent, useGetCurrentCycle, getGetEventsQueryKey, ApiError } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, ChevronRight, Users, Plus, GitMerge, ChevronsUpDown, Check, SlidersHorizontal, ChevronUp, ChevronDown, Trash2, Pencil, MoreHorizontal, CalendarRange } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { PremiumCard, CONDENSED, WARNING } from "@/lib/premium-theme";
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
    <div className="flex flex-col gap-1 w-full">
      <div className="h-[5px] rounded-full w-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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
  const cyclePeriod = cycle ? formatCyclePeriod(cycle.startDate, cycle.endDate) : null;

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
    <div className="min-h-full flex flex-col">

      {/* ── Header ── */}
      <div className="px-6 py-4 flex items-center gap-5 shrink-0 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] block" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Gerenciar</span>
          <h1 data-testid="text-page-title" className="font-black uppercase text-2xl tracking-tight leading-none mt-0.5" style={{ fontFamily: CONDENSED }}>Eventos do Ciclo</h1>
        </div>

        {cycle && (
          <div className="shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
            <CalendarRange size={16} className="shrink-0" style={{ color: "var(--accent)" }} />
            <span className="flex flex-col leading-tight">
              <span className="font-black uppercase text-xs" style={{ fontFamily: CONDENSED }}>{cycle.name}</span>
              <span className="text-[10px] font-semibold" style={{ color: "var(--muted-foreground)" }}>{cyclePeriod ?? "Período não definido"}</span>
            </span>
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-stretch shrink-0 pl-5" style={{ borderLeft: "1px solid var(--border)" }}>
          {[
            { val: all.length,                                    label: "Eventos",    color: "var(--foreground)" },
            { val: all.filter(e => e.status === "open").length,    label: "Abertos",    color: "var(--accent)" },
            { val: all.filter(e => e.status === "closed").length,  label: "Concluídos", color: "var(--muted-foreground)" },
            { val: all.filter(e => e.fullyCalibrated).length,      label: "Pub. Final", color: "#9ab000" },
          ].map((s, i) => (
            <div key={i} className="px-4 text-center" style={{ borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
              <span className="block font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: s.color }}>{s.val}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2.5 shrink-0">
          {user?.role === "admin" && (
            <button
              onClick={() => {
                if (!confirm("Isso vai:\n• Corrigir os 4 eventos com datas erradas\n• Unificar TODOS os eventos multi-dia para data única (startDate = endDate)\n\nConfirmar?")) return;
                normalizeDatesMutation.mutate();
              }}
              disabled={normalizeDatesMutation.isPending}
              className="h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              {normalizeDatesMutation.isPending ? "..." : "Unificar Datas"}
            </button>
          )}
          {canCreate && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="button-create-event"
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 transition-opacity hover:opacity-90"
                  style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Plus size={13} /> Novo Evento
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Novo Evento</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome do Evento <span style={{ color: WARNING }}>*</span></Label>
                    <Input data-testid="input-event-name" {...register("name", { required: true })} placeholder="Ex: Feira XYZ 2026" className="h-11 rounded-lg" style={inputStyle} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cliente</Label>
                    <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome do cliente" className="h-11 rounded-lg" style={inputStyle} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Início <span style={{ color: WARNING }}>*</span></Label>
                      <Input data-testid="input-event-start" type="date" {...register("startDate", { required: true })} className="h-11 rounded-lg" style={inputStyle} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Fim <span style={{ color: WARNING }}>*</span></Label>
                      <Input data-testid="input-event-end" type="date" {...register("endDate", { required: true })} className="h-11 rounded-lg" style={inputStyle} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cidade</Label>
                      <Input data-testid="input-event-city" {...register("city")} placeholder="Ex: São Paulo" className="h-11 rounded-lg" style={inputStyle} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>UF</Label>
                      <Input data-testid="input-event-state" {...register("state")} placeholder="Ex: SP" maxLength={2} className="h-11 rounded-lg uppercase" style={inputStyle} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Local</Label>
                    <Input data-testid="input-event-location" {...register("location")} placeholder="Ex: Pavilhão de Exposições" className="h-11 rounded-lg" style={inputStyle} />
                  </div>
                  <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                    <button type="button" onClick={() => setCreateOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                    <button
                      data-testid="button-submit-event"
                      type="submit"
                      disabled={createMutation.isPending}
                      className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
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
      <div className="px-6 py-3 flex items-center gap-2 shrink-0 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
        {/* Search */}
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 w-72 shrink-0" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
          <Search size={13} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
          <input
            data-testid="input-search-events"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar evento, cliente ou cidade…"
            className="text-xs bg-transparent outline-none w-full"
            style={{ color: "var(--foreground)" }}
          />
        </div>

        {/* Status chip filters */}
        {chipFilters.map((f) => {
          const active = cardFilter === f.key;
          return (
            <button
              key={String(f.key)}
              onClick={() => setCardFilter(f.key)}
              className="h-8 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors shrink-0"
              style={{
                fontFamily: CONDENSED,
                backgroundColor: active ? "var(--primary)" : "transparent",
                color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {f.label}
            </button>
          );
        })}

        {/* Date filter popover */}
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              className="ml-auto h-8 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 transition-colors shrink-0"
              style={{
                fontFamily: CONDENSED,
                backgroundColor: hasDateFilter ? "var(--primary)" : "transparent",
                color: hasDateFilter ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: hasDateFilter ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              <SlidersHorizontal size={12} />
              {hasDateFilter ? "Datas ●" : "Filtrar Datas"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 rounded-xl p-4 space-y-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>Filtrar por data</p>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: "var(--muted-foreground)" }}>De</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full h-9 px-2 text-xs rounded-lg font-bold focus:outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide block mb-1" style={{ color: "var(--muted-foreground)" }}>Até</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="w-full h-9 px-2 text-xs rounded-lg font-bold focus:outline-none"
                style={inputStyle}
              />
            </div>
            {hasDateFilter && (
              <button
                type="button"
                onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                className="w-full text-[11px] font-bold uppercase text-left hover:opacity-70"
                style={{ color: "var(--muted-foreground)" }}
              >
                × Limpar datas
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* ── Weekend chips row ── */}
      {cycleWeekends.length > 0 && (
        <div className="px-6 py-2.5 flex items-center gap-3 shrink-0" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
          <span className="text-[10px] font-black uppercase tracking-widest shrink-0 flex items-center gap-1.5" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>
            <Calendar size={12} />
            Fim de Semana
          </span>
          <div ref={weekendRowRef} className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
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
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-colors shrink-0"
                  style={{
                    fontFamily: CONDENSED,
                    backgroundColor: active ? "var(--primary)" : "var(--card)",
                    color: active ? "var(--primary-foreground)" : "var(--muted-foreground)",
                    border: active ? "1px solid var(--primary)" : "1px solid var(--border)",
                  }}
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
              className="ml-auto text-[10px] font-bold uppercase shrink-0 hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              × limpar
            </button>
          )}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-1">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Calendar size={40} className="mb-4 opacity-20" />
            <h3 className="text-lg font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Nenhum evento encontrado</h3>
            <p className="italic mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Ajuste os filtros ou sincronize via integração.</p>
            {cardFilter !== null && (
              <button
                onClick={() => setCardFilter(null)}
                className="mt-4 px-4 py-2 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                Limpar filtro
              </button>
            )}
          </div>
        ) : (
          <PremiumCard className="overflow-hidden">
            {/* Table header */}
            <div
              className="grid sticky top-0 z-10"
              style={{ gridTemplateColumns: GRID_COLS, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}
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
                    className={cn("px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none flex items-center gap-1 transition-colors group", i === 0 && "pl-4")}
                    style={{ fontFamily: CONDENSED, color: active ? "var(--accent)" : "var(--muted-foreground)" }}
                  >
                    {labels[col]}
                    <span className={cn("inline-flex flex-col leading-none transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")}>
                      <ChevronUp size={8} />
                      <ChevronDown size={8} style={{ marginTop: -2 }} />
                    </span>
                  </div>
                );
              })}
              <div className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Status</div>
              <div className="px-3 py-2.5" />
            </div>

            {/* Rows */}
            {filtered.map((ev) => {
              const score = ev.teamScore ?? ev.averageScore ?? null;
              const concluded = ev.status === "closed";
              const total = ev.totalCriteria ?? 0;
              const evaluated = ev.evaluatedCriteria ?? 0;
              const calCount = ev.calibratedCriteriaCount ?? 0;
              const fc = ev.fullyCalibrated ?? false;
              const finalPubCount = ev.finalCalibratedCriteria ?? 0;
              const partialPubTotal = ev.partialPublishedCount ?? 0;
              const calSaved = ev.calibratedCriteriaCount ?? 0;
              const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
              const isPureHistorical = !!ev.isHistorical && calSaved === 0;
              const hasEvals = evaluated > 0;
              const missing = ev.unassignedAreaNames ?? [];

              // Accent bar color
              const accentColor = !ev.criteriaConfirmed && !hasEvals ? WARNING
                : fc ? "#9ab000"
                : evaluated === total && total > 0 ? "var(--accent)"
                : evaluated > 0 ? "#e8a23d"
                : "var(--border)";

              // Score label
              const scoreLabel = isPureHistorical
                ? "Importado"
                : finalPubCount > 0 && partialOnlyCount > 0
                  ? `${finalPubCount}F · ${partialOnlyCount}P`
                  : finalPubCount > 0 ? "Pub. Final"
                  : partialOnlyCount > 0 ? "Pub. Parcial"
                  : calSaved > 0 ? "Rascunho"
                  : "Avaliador";
              const scoreLabelColor = isPureHistorical ? "#e8a23d"
                : finalPubCount > 0 && partialOnlyCount === 0 ? "#9ab000"
                : finalPubCount > 0 || partialOnlyCount > 0 ? "#e8a23d"
                : calSaved > 0 ? "#5b8def"
                : "var(--muted-foreground)";

              // MiniBar colors
              const evalColor = !isPureHistorical && evaluated === total && total > 0 ? "#9ab000" : "var(--accent)";
              const calColor = fc ? "#9ab000" : calCount > 0 ? "#e8a23d" : "var(--border)";

              // Date display
              const dateStr = ev.startDate === ev.endDate
                ? new Date(ev.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                : `${new Date(ev.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}–${new Date(ev.endDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;

              const badge = !ev.criteriaConfirmed && !hasEvals
                ? { bg: "rgba(229,72,77,0.12)", fg: WARNING, label: "Ag. RH" }
                : fc
                  ? { bg: "rgba(154,176,0,0.14)", fg: "#9ab000", label: "Pub. Final" }
                  : partialOnlyCount > 0
                    ? { bg: "rgba(232,162,61,0.14)", fg: "#e8a23d", label: "Pub. Parcial" }
                    : calSaved > 0
                      ? { bg: "rgba(91,141,239,0.14)", fg: "#5b8def", label: "Rascunho" }
                      : concluded
                        ? { bg: "rgba(154,176,0,0.14)", fg: "#9ab000", label: "Concluído" }
                        : evaluated === total && total > 0
                          ? { bg: "rgba(154,176,0,0.14)", fg: "#9ab000", label: "Avaliado" }
                          : evaluated > 0
                            ? { bg: "rgba(232,162,61,0.14)", fg: "#e8a23d", label: "Em Avaliação" }
                            : { bg: "var(--secondary)", fg: "var(--muted-foreground)", label: "Aguardando" };

              return (
                <div
                  key={ev.id}
                  data-testid={`row-event-${ev.id}`}
                  className="grid relative items-center transition-colors group hover:opacity-95"
                  style={{ gridTemplateColumns: GRID_COLS, borderBottom: "1px solid var(--border)" }}
                >
                  {/* Accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: accentColor }} />

                  {/* Event name + subtitle */}
                  <div className="pl-4 pr-3 py-3 min-w-0">
                    <Link href={`/events/${ev.id}`} className="text-[13px] font-bold uppercase leading-tight block truncate transition-colors hover:opacity-70">
                      {ev.name}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-1.5 mt-0.5">
                      {ev.isHistorical && (
                        <span className="text-[10px] font-bold uppercase" style={{ color: "#e8a23d" }}>Histórico ·</span>
                      )}
                      {!ev.criteriaConfirmed && !hasEvals && (
                        <span className="text-[10px] font-bold uppercase" style={{ color: WARNING }}>Ag. RH ·</span>
                      )}
                      {!ev.resultsConfirmed && ev.criteriaConfirmed && (
                        <span className="text-[10px] font-bold uppercase" style={{ color: "#e8a23d" }}>Elegib. pend. ·</span>
                      )}
                      <span className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
                        {[ev.clientName, ev.city].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {missing.length > 0 && !hasEvals && (
                      <p className="text-[10px] font-bold uppercase truncate mt-0.5" style={{ color: WARNING }}>
                        Sem aval.: {missing.join(", ")}
                      </p>
                    )}
                  </div>

                  {/* Date */}
                  <div className="px-3.5 py-3 text-xs font-semibold whitespace-nowrap">{dateStr}</div>

                  {/* Participants */}
                  <div className="px-3.5 py-3 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                    <Users size={12} />
                    <span className="text-[12px] font-bold">{ev.participantCount ?? 0}</span>
                  </div>

                  {/* Avaliações mini bar */}
                  <div className="px-3.5 py-3">
                    {isPureHistorical || total === 0 ? (
                      <span className="text-[11px] italic opacity-40">—</span>
                    ) : (
                      <MiniBar value={evaluated} total={total} color={evalColor} />
                    )}
                  </div>

                  {/* Calibrações mini bar */}
                  <div className="px-3.5 py-3">
                    {isPureHistorical || total === 0 ? (
                      <span className="text-[11px] italic opacity-40">—</span>
                    ) : (
                      <MiniBar value={calCount} total={total} color={calColor} />
                    )}
                  </div>

                  {/* Score */}
                  <div className="px-3.5 py-3 text-center">
                    {score != null ? (
                      <div>
                        <span className="font-black text-lg leading-none block" style={{ fontFamily: CONDENSED, color: fc ? "#9ab000" : "var(--foreground)" }}>
                          {score.toFixed(1)}
                        </span>
                        <span className="text-[9px] font-bold uppercase" style={{ color: scoreLabelColor }}>{scoreLabel}</span>
                      </div>
                    ) : (
                      <span className="text-sm italic opacity-40">—</span>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="px-3.5 py-3">
                    <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
                  </div>

                  {/* Action */}
                  <div className="px-2.5 py-3 flex items-center justify-center gap-1.5">
                    <Link href={`/events/${ev.id}`}>
                      <button
                        data-testid={`button-view-event-${ev.id}`}
                        title="Gerenciar evento"
                        className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        <ChevronRight size={13} />
                      </button>
                    </Link>
                    {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                            <MoreHorizontal size={12} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl min-w-[160px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                          {user && ["admin", "rh"].includes(user.role) && (
                            <DropdownMenuItem
                              data-testid={`button-edit-event-${ev.id}`}
                              onClick={() => setEditingEvent({ id: ev.id, name: ev.name, startDate: ev.startDate, endDate: ev.endDate, clientName: ev.clientName, city: ev.city, state: ev.state, location: ev.location })}
                              className="gap-2 font-bold text-xs cursor-pointer"
                            >
                              <Pencil size={12} /> Editar
                            </DropdownMenuItem>
                          )}
                          {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                            <DropdownMenuItem asChild className="gap-2 font-bold text-xs cursor-pointer">
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
                                className="gap-2 font-bold text-xs cursor-pointer"
                              >
                                <GitMerge size={12} /> Mesclar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                data-testid={`button-delete-event-${ev.id}`}
                                onClick={() => setDeleteTarget({ id: ev.id, name: ev.name })}
                                className="gap-2 font-bold text-xs cursor-pointer"
                                style={{ color: WARNING }}
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
          </PremiumCard>
        )}

        {/* Legend + count */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center gap-5 mt-4 px-1 flex-wrap">
            {[
              { color: "#9ab000", label: "Pub. Final" },
              { color: "var(--accent)", label: "Avaliado" },
              { color: "#e8a23d", label: "Em andamento" },
              { color: "var(--border)", label: "Aguardando" },
              { color: WARNING, label: "Ag. RH" },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-[3px] h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{l.label}</span>
              </div>
            ))}
            <span className="ml-auto text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {filtered.length === all.length
                ? `${all.length} eventos no ciclo`
                : `${filtered.length} de ${all.length} eventos`}
            </span>
          </div>
        )}
      </div>

      {/* ── Merge dialog ── */}
      <Dialog open={!!mergeForEvent} onOpenChange={(open) => { if (!open) { setMergeForEvent(null); setMergeTargetId(""); setMergeConflict(null); } }}>
        <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Mesclar Evento Duplicado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Este evento (<strong style={{ color: "var(--foreground)" }}>{mergeForEvent?.name}</strong>) será <strong style={{ color: "var(--foreground)" }}>mantido</strong>. Escolha o evento duplicado abaixo — os dados vazios serão preenchidos, os participantes migrados e o duplicado <strong style={{ color: "var(--foreground)" }}>excluído</strong>.
            </p>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Evento duplicado a remover</Label>
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
                        className="w-full h-11 px-3 rounded-lg flex items-center justify-between gap-3 text-left transition-colors"
                        style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}
                      >
                        {selectedMergeTarget ? (
                          <span className="truncate text-sm font-bold uppercase">
                            {selectedMergeTarget.name} — {new Date(selectedMergeTarget.startDate).toLocaleDateString('pt-BR')}{selectedMergeTarget.isHistorical ? " (histórico)" : ""}
                          </span>
                        ) : (
                          <span className="font-bold uppercase text-xs tracking-wider truncate" style={{ color: "var(--muted-foreground)" }}>Selecione o evento duplicado...</span>
                        )}
                        <ChevronsUpDown size={16} className="shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                      <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                        <CommandInput data-testid="input-merge-target-search" placeholder="Buscar por nome do evento..." />
                        <CommandList className="max-h-[320px]">
                          <CommandEmpty className="py-6 text-center text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum evento encontrado.</CommandEmpty>
                          <CommandGroup>
                            {mergeCandidates.map(e => (
                              <CommandItem
                                key={e.id}
                                value={`${e.name} ${e.city ?? ""} ${e.state ?? ""}`}
                                data-testid={`option-merge-target-${e.id}`}
                                onSelect={() => { setMergeTargetId(String(e.id)); setMergeTargetPickerOpen(false); setMergeConflict(null); }}
                                className="cursor-pointer py-2.5 gap-3 items-start"
                              >
                                <Check size={16} className={cn("mt-0.5 shrink-0", mergeTargetId === String(e.id) ? "opacity-100" : "opacity-0")} />
                                <span className="flex flex-col min-w-0">
                                  <span className="font-black uppercase text-sm leading-tight whitespace-normal">{e.name}</span>
                                  <span className="text-[11px] font-bold uppercase whitespace-normal" style={{ color: "var(--muted-foreground)" }}>
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
              <div data-testid="alert-merge-conflict" className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: "rgba(232,162,61,0.12)", border: "1px solid #e8a23d", color: "#e8a23d" }}>
                <p className="font-bold uppercase">O duplicado já tem dado gravado:</p>
                <p>{mergeConflict.evaluations} avaliação(ões), {mergeConflict.calibrations} calibração(ões), {mergeConflict.conformities} conformidade(s) e {mergeConflict.results} resultado(s).</p>
                <p>Esses dados serão descartados. Confirma a mesclagem?</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => { setMergeForEvent(null); setMergeTargetId(""); setMergeConflict(null); }} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
              <button
                data-testid="button-confirm-merge"
                type="button"
                disabled={!mergeTargetId || mergeMutation.isPending}
                className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50"
                style={{ backgroundColor: mergeConflict ? WARNING : "var(--primary)", color: mergeConflict ? "#fff" : "var(--primary-foreground)" }}
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
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED, color: WARNING }}>Excluir Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Tem certeza que deseja excluir <strong style={{ color: "var(--foreground)" }}>{deleteTarget?.name}</strong>? Todos os participantes, avaliações, calibrações e resultados vinculados serão <strong style={{ color: "var(--foreground)" }}>permanentemente removidos</strong>. Essa ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-10 px-4 rounded-lg text-xs font-bold uppercase transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => { if (deleteTarget) deleteMutation.mutate({ id: deleteTarget.id }); }}
                className="h-10 px-4 rounded-lg text-white text-xs font-bold uppercase disabled:opacity-50 transition-opacity hover:opacity-90 flex items-center gap-1.5"
                style={{ backgroundColor: WARNING }}
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
        <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Evento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(d => { if (editingEvent) editMutation.mutate({ id: editingEvent.id, data: d }); })} className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome do Evento <span style={{ color: WARNING }}>*</span></Label>
              <Input data-testid="input-edit-event-name" {...registerEdit("name", { required: true })} className="h-11 rounded-lg" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cliente</Label>
              <Input data-testid="input-edit-event-client" {...registerEdit("clientName")} className="h-11 rounded-lg" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Início <span style={{ color: WARNING }}>*</span></Label>
                <Input data-testid="input-edit-event-start" type="date" {...registerEdit("startDate", { required: true })} className="h-11 rounded-lg" style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Fim <span style={{ color: WARNING }}>*</span></Label>
                <Input data-testid="input-edit-event-end" type="date" {...registerEdit("endDate", { required: true })} className="h-11 rounded-lg" style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cidade</Label>
                <Input data-testid="input-edit-event-city" {...registerEdit("city")} className="h-11 rounded-lg" style={inputStyle} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>UF</Label>
                <Input data-testid="input-edit-event-state" {...registerEdit("state")} maxLength={2} className="h-11 rounded-lg uppercase" style={inputStyle} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Local</Label>
              <Input data-testid="input-edit-event-location" {...registerEdit("location")} className="h-11 rounded-lg" style={inputStyle} />
            </div>
            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => setEditingEvent(null)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
              <button
                data-testid="button-submit-edit-event"
                type="submit"
                disabled={editMutation.isPending}
                className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
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
