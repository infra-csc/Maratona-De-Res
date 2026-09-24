import { useState, useEffect, useRef } from "react";
import { useGetEvents, useCreateEvent, useMergeEvent, useDeleteEvent, useGetCurrentCycle, getGetEventsQueryKey, ApiError } from "@workspace/api-client-react";
import type { EventInput } from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { fmtDate, getCycleWeekends } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Calendar, ChevronRight, Users, Plus, GitMerge, ChevronsUpDown, Check, SlidersHorizontal, ChevronUp, ChevronDown, Trash2, Pencil, MoreHorizontal, CalendarRange, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useAuth, hasRole } from "@/lib/auth-context";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { PremiumCard, CONDENSED, WARNING, GOOD, AMBER, INFO } from "@/lib/premium-theme";
import { cn } from "@/lib/utils";

// ── Filtros na URL ──────────────────────────────────────────────────────────
// Chip de status, busca, período e ordenação vivem em ?status=&q=&from=&to=&sort=
// para que "voltar" do detalhe devolva a lista exatamente como estava.
const CARD_FILTER_KEYS = ["pendingRH", "unconfirmed", "inEval", "pendingCal", "partialPub", "fullyEval"] as const;
const SORT_KEYS = [
  "nameAsc", "nameDesc", "dateDesc", "dateAsc", "participantsDesc", "participantsAsc",
  "evaluatedDesc", "evaluatedAsc", "calibrDesc", "calibrAsc", "scoreDesc", "scoreAsc",
] as const;
const DEFAULT_SORT = "dateDesc";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readUrlFilters() {
  const p = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const status = p.get("status");
  const sort = p.get("sort");
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  return {
    search: p.get("q") ?? "",
    cardFilter: status && (CARD_FILTER_KEYS as readonly string[]).includes(status) ? status : null,
    sortBy: sort && (SORT_KEYS as readonly string[]).includes(sort) ? sort : DEFAULT_SORT,
    filterDateFrom: DATE_RE.test(from) ? from : "",
    filterDateTo: DATE_RE.test(to) ? to : "",
  };
}

function MiniBar({ value, total, color, title }: { value: number; total: number; color: string; title?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1 w-full" title={title}>
      <div className="h-[5px] rounded-full w-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

function CalBar({ finalCount, partialCount, total }: { finalCount: number; partialCount: number; total: number }) {
  const safeTotal = total > 0 ? total : 1;
  const finalPct   = Math.min(100, (finalCount   / safeTotal) * 100);
  const partialPct = Math.min(100 - finalPct, (partialCount / safeTotal) * 100);
  const totalCount = finalCount + partialCount;
  const labelColor = finalCount === total && total > 0 ? GOOD
    : finalCount > 0 || partialCount > 0 ? AMBER
    : "var(--muted-foreground)";
  return (
    <div className="flex flex-col gap-1 w-full" title={`${finalCount} final · ${partialCount} parcial de ${total} critérios`}>
      <div className="relative h-[5px] rounded-full w-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        {finalPct > 0 && (
          <div className="absolute left-0 top-0 h-full" style={{ width: `${finalPct}%`, backgroundColor: GOOD }} />
        )}
        {partialPct > 0 && (
          <div className="absolute top-0 h-full" style={{ left: `${finalPct}%`, width: `${partialPct}%`, backgroundColor: AMBER }} />
        )}
      </div>
      <span className="text-[10px] font-bold" style={{ color: labelColor }}>{totalCount}/{total}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="text-[11px] font-semibold" style={{ color: WARNING }}>{message}</p>;
}

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [initialFilters] = useState(readUrlFilters);
  const [search, setSearch] = useState(initialFilters.search);
  const [cardFilter, setCardFilter] = useState<string | null>(initialFilters.cardFilter);
  const [sortBy, setSortBy] = useState(initialFilters.sortBy);
  const [filterDateFrom, setFilterDateFrom] = useState(initialFilters.filterDateFrom);
  const [filterDateTo, setFilterDateTo] = useState(initialFilters.filterDateTo);

  // Espelha os filtros na URL sem recarregar nem empilhar histórico.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string | null) => { if (value) p.set(key, value); else p.delete(key); };
    setOrDelete("q", search.trim() || null);
    setOrDelete("status", cardFilter);
    setOrDelete("sort", sortBy !== DEFAULT_SORT ? sortBy : null);
    setOrDelete("from", filterDateFrom || null);
    setOrDelete("to", filterDateTo || null);
    const qs = p.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(window.history.state, "", next);
  }, [search, cardFilter, sortBy, filterDateFrom, filterDateTo]);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const weekendRowRef = useRef<HTMLDivElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mergeForEvent, setMergeForEvent] = useState<{ id: number; name: string } | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [mergeTargetPickerOpen, setMergeTargetPickerOpen] = useState(false);
  const [mergeConflict, setMergeConflict] = useState<{ evaluations: number; calibrations: number; conformities: number; results: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  // Congela a lista no momento em que o diálogo abre: a tela atualiza a cada
  // 60 s (e ao voltar o foco) e a lista filtrada podia mudar entre abrir e confirmar.
  const [bulkConfirmIds, setBulkConfirmIds] = useState<{ id: number; name: string; startDate: string }[]>([]);
  const [editingEvent, setEditingEvent] = useState<{ id: number; name: string; startDate: string; endDate: string; clientName?: string | null; city?: string | null; state?: string | null; location?: string | null } | null>(null);

  const queryKey = getGetEventsQueryKey();
  const { data: events, isLoading } = useGetEvents(
    undefined,
    { query: { queryKey, refetchInterval: 60000, refetchOnWindowFocus: true } }
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
        setDeleteConfirmText("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    },
  });

  const { register, handleSubmit, reset, formState: { errors: createErrors } } = useForm<EventInput>();

  type EditEventInput = { name: string; startDate: string; endDate: string; clientName?: string; city?: string; state?: string; location?: string };
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm<EditEventInput>();

  // Regras de validação compartilhadas entre criar e editar. Os dois formulários têm
  // uma única data (endDate = startDate no submit), então não há "fim ≥ início" a validar.
  const nameRules = { required: "Informe o nome do evento", validate: (v: string) => v.trim().length > 0 || "Informe o nome do evento" };
  const startDateRules = { required: "Informe a data do evento", validate: (v: string) => DATE_RE.test(v) || "Data inválida" };
  const closeCreateDialog = () => { setCreateOpen(false); reset(); };
  const closeEditDialog = () => { setEditingEvent(null); resetEdit(); };

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

  const bulkConfirmMutation = useMutation({
    mutationFn: async (eventIds: number[]) => {
      const token = localStorage.getItem("maratona_token");
      const res = await fetch("/api/events/confirm-results-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ eventIds }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as { error?: string }).error ?? `HTTP ${res.status}`); }
      return res.json() as Promise<{ confirmed: number; skipped: number; warnings: string[] }>;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey });
      setBulkConfirmOpen(false);
      const parts = [`${d.confirmed} evento(s) confirmado(s).`];
      if (d.skipped > 0) parts.push(`${d.skipped} já estavam confirmados ou são históricos.`);
      if (d.warnings.length > 0) parts.push(d.warnings.join(" "));
      toast({ title: "Resultados confirmados", description: parts.join(" ") });
    },
    onError: (e: Error) => toast({ title: "Erro ao confirmar em lote", description: e.message, variant: "destructive" }),
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
      resetEdit();
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
  // Datas vêm como "YYYY-MM-DD": comparar como string evita o deslocamento de
  // fuso (new Date("YYYY-MM-DD") é meia-noite UTC = 21h do dia anterior no Brasil,
  // o que marcava o evento como "passado" no próprio dia).
  const todayStr = new Date().toLocaleDateString("sv-SE");
  const isPastOrClosed = (e: typeof all[0]) => e.status === "closed" || (!!e.endDate && e.endDate < todayStr);
  const isInEvaluation = (e: typeof all[0]) =>
    !!e.criteriaConfirmed &&
    (e.evaluationProgress ?? 0) > 0 &&
    (e.calibratedCriteriaCount ?? 0) === 0;
  // Publicado parcialmente: tem critério(s) com prévia publicada, mas nem tudo já virou Final.
  // O evento só é FINAL quando TODOS os quesitos têm publicação final — enquanto sobrar
  // qualquer critério só-parcial, ele é Parcial (mesmo que o feedback já tenha sido liberado).
  const hasPartialPublication = (e: typeof all[0]) =>
    Math.max(0, (e.partialPublishedCount ?? 0) - (e.finalCalibratedCriteria ?? 0)) > 0;
  // Pub. Final = TODOS os quesitos com publicação final (ou o evento já liberado),
  // e nenhum quesito ainda só-parcial. Mesma regra usada no badge, no filtro e no contador.
  const isPubFinal = (e: typeof all[0]) => {
    if (e.isHistorical) return true;
    if (hasPartialPublication(e)) return false;
    const totalC = e.totalCriteria ?? 0;
    const finalC = e.finalCalibratedCriteria ?? 0;
    return (totalC > 0 && finalC >= totalC) || !!e.feedbackReleased;
  };

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
      // Resultados ainda não confirmados (botão "Confirmar Resultados"): equipe/elegibilidade
      // pendente de validação. Históricos importados ficam de fora — não passam por essa etapa.
      || (cardFilter === "unconfirmed" && !ev.resultsConfirmed && !ev.isHistorical)
      || (cardFilter === "inEval"     && isInEvaluation(ev))
      || (cardFilter === "pendingCal" && isPastOrClosed(ev) && (ev.finalCalibratedCriteria ?? 0) === 0 && (ev.partialPublishedCount ?? 0) === 0)
      || (cardFilter === "partialPub" && hasPartialPublication(ev))
      || (cardFilter === "fullyEval"  && isPubFinal(ev));
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

  const canCreate = user && (["admin", "rh"].includes(user.role) || hasRole(user, "operador"));
  const hasDateFilter = !!(filterDateFrom || filterDateTo);

  useEffect(() => {
    if (!weekendRowRef.current || cycleWeekends.length === 0) return;
    // Fuso local (não UTC): toISOString() pulava para o próximo fim de semana entre 21h e meia-noite.
    const todayStr = new Date().toLocaleDateString("sv-SE");
    const idx = cycleWeekends.findIndex(w => w.sun >= todayStr);
    const targetIdx = idx >= 0 ? idx : cycleWeekends.length - 1;
    const chip = weekendRowRef.current.children[targetIdx] as HTMLElement | undefined;
    if (chip) chip.scrollIntoView({ behavior: "instant", block: "nearest", inline: "center" });
  }, [cycle?.startDate]);

  const GRID_COLS = "1fr 90px 56px 130px 130px 110px 80px 120px 72px";

  const chipFilters: { key: string | null; label: string; title: string }[] = [
    { key: null,          label: "Todos",           title: "Todos os eventos do ciclo" },
    { key: "pendingRH",   label: "Aguardando RH",   title: "Aguardando o RH confirmar os critérios do evento" },
    { key: "unconfirmed", label: "Não Confirmados", title: "Resultados não confirmados: ainda não contam na elegibilidade nem na nota" },
    { key: "inEval",      label: "Em Avaliação",    title: "Avaliações em andamento, sem calibração salva" },
    { key: "pendingCal",  label: "Falta calibrar",  title: "Eventos encerrados sem nenhuma calibração ou publicação" },
    { key: "partialPub",  label: "Pub. Parcial",    title: "Publicação parcial: nem todos os critérios têm publicação final" },
    { key: "fullyEval",   label: "Pub. Final",      title: "Publicação final: todos os critérios publicados" },
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
            { val: all.length,                                        label: "Eventos",     color: "var(--foreground)" },
            { val: all.filter(e => e.status === "open").length,      label: "Abertos",     color: "var(--accent)" },
            { val: all.filter(e => hasPartialPublication(e)).length,  label: "Pub. Parcial", color: AMBER },
            { val: all.filter(e => isPubFinal(e)).length, label: "Pub. Final",  color: GOOD },
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
            <Dialog open={createOpen} onOpenChange={(open) => { if (open) setCreateOpen(true); else closeCreateDialog(); }}>
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
                <form noValidate onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, name: d.name.trim(), endDate: d.startDate } }))} className="space-y-5 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="input-event-name" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome do Evento <span style={{ color: WARNING }}>*</span></Label>
                    <Input id="input-event-name" data-testid="input-event-name" {...register("name", nameRules)} aria-invalid={!!createErrors.name} placeholder="Ex: Feira XYZ 2026" className="h-11 rounded-lg" style={inputStyle} />
                    <FieldError message={createErrors.name?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cliente</Label>
                    <Input data-testid="input-event-client" {...register("clientName")} placeholder="Nome do cliente" className="h-11 rounded-lg" style={inputStyle} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="input-event-start" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Data do Evento <span style={{ color: WARNING }}>*</span></Label>
                    <Input id="input-event-start" data-testid="input-event-start" type="date" {...register("startDate", startDateRules)} aria-invalid={!!createErrors.startDate} className="h-11 rounded-lg" style={inputStyle} />
                    <FieldError message={createErrors.startDate?.message} />
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
                    <button type="button" onClick={closeCreateDialog} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
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
            type="search"
            aria-label="Buscar evento, cliente ou cidade"
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
              type="button"
              title={f.title}
              aria-pressed={active}
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
          <>
          {cardFilter === "unconfirmed" && user?.role === "admin" && (
            <div
              className="mb-3 flex items-center justify-between gap-3 flex-wrap rounded-xl px-4 py-3"
              style={{ backgroundColor: "rgba(232,162,61,0.10)", border: "1px solid rgba(232,162,61,0.35)" }}
            >
              <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                <strong>{filtered.length}</strong> evento(s) com resultados não confirmados{hasDateFilter ? " no período selecionado" : ""}.
                <span className="block text-[11px] font-normal" style={{ color: "var(--muted-foreground)" }}>
                  Confirmar faz esses eventos passarem a contar na elegibilidade e na nota dos colaboradores.
                </span>
              </p>
              <button
                type="button"
                data-testid="button-bulk-confirm"
                onClick={() => { setBulkConfirmIds(filtered.map(ev => ({ id: ev.id, name: ev.name, startDate: ev.startDate }))); setBulkConfirmOpen(true); }}
                disabled={bulkConfirmMutation.isPending}
                className="h-9 px-4 rounded-lg text-[12px] font-bold uppercase tracking-wide inline-flex items-center gap-2 shrink-0 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Check size={14} /> Confirmar {filtered.length} evento(s)
              </button>
            </div>
          )}
          <PremiumCard className="overflow-hidden">
            {/* Table header */}
            <div
              className="grid sticky top-0 z-10"
              style={{ gridTemplateColumns: GRID_COLS, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}
            >
              {(["name","date","participants","evaluated","calibr","matrix","score"] as const).map((col) => {
                const labels: Record<string, string> = {
                  name: "Evento", date: "Data", participants: "Part.",
                  evaluated: "Avaliações", calibr: "Calibrações", matrix: "Matriz", score: "Nota",
                };
                if (col === "matrix") {
                  return (
                    <div key={col} role="columnheader" className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                      {labels[col]}
                    </div>
                  );
                }
                const active = colActive(col);
                const asc = sortAsc(col);
                return (
                  <div
                    key={col}
                    role="columnheader"
                    aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
                    className={cn("flex items-center", col === "name" && "pl-0.5")}
                  >
                    <button
                      type="button"
                      onClick={() => handleColSort(col)}
                      aria-label={`Ordenar por ${labels[col]}${active ? (asc ? " (crescente)" : " (decrescente)") : ""}`}
                      className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider select-none flex items-center gap-1 transition-colors group bg-transparent rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                      style={{ fontFamily: CONDENSED, color: active ? "var(--accent-text)" : "var(--muted-foreground)", outlineColor: "var(--ring)" }}
                    >
                      {labels[col]}
                      <span aria-hidden="true" className={cn("inline-flex flex-col leading-none transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")}>
                        <ChevronUp size={8} style={{ opacity: active && !asc ? 0.35 : 1 }} />
                        <ChevronDown size={8} style={{ marginTop: -2, opacity: active && asc ? 0.35 : 1 }} />
                      </span>
                    </button>
                  </div>
                );
              })}
              <div role="columnheader" className="px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Status</div>
              <div role="columnheader" className="px-3 py-2.5"><span className="sr-only">Ações</span></div>
            </div>

            {/* Rows */}
            {filtered.map((ev) => {
              const score = ev.teamScore ?? ev.averageScore ?? null;
              const concluded = ev.status === "closed";
              const total = ev.totalCriteria ?? 0;
              const evaluated = ev.evaluatedCriteria ?? 0;
              const calCount = ev.calibratedCriteriaCount ?? 0;
              // Barra de avaliações: usa critérios como unidade (totalCriteria como denominador).
              // Calibração conta como avaliado para exibição — evita "1/2" quando há 5/5 calibrações.
              const evalTotal = total;
              const evalDone = Math.max(evaluated, calCount);
              const fc = ev.fullyCalibrated ?? false;
              const finalPubCount = ev.finalCalibratedCriteria ?? 0;
              const partialPubTotal = ev.partialPublishedCount ?? 0;
              const calSaved = ev.calibratedCriteriaCount ?? 0;
              const partialOnlyCount = Math.max(0, partialPubTotal - finalPubCount);
              const isPureHistorical = !!ev.isHistorical && calSaved === 0;
              const hasEvals = evalDone > 0;
              const hasAnyPublication = calSaved > 0 || finalPubCount > 0 || partialPubTotal > 0;
              const missing = ev.unassignedAreaNames ?? [];
              const evaluationsHref = `/evaluations?eventId=${ev.id}`;
              const matrixSummary = ev.conformityNeeded ? `Matriz ${ev.conformityFilled ?? 0}/${ev.conformityTotal ?? 0}` : "Matriz não exigida";
              const evalTooltip = `${evalDone} de ${evalTotal} critérios com avaliação completa · ${matrixSummary}`;

              // Accent bar color
              const accentColor = !ev.criteriaConfirmed && !hasEvals && !hasAnyPublication ? WARNING
                : ev.feedbackReleased ? GOOD
                : evalDone === evalTotal && evalTotal > 0 ? "var(--accent)"
                : evalDone > 0 ? AMBER
                : "var(--border)";

              // Score label
              const scoreLabel = finalPubCount > 0 && partialOnlyCount > 0
                  ? `${finalPubCount}F · ${partialOnlyCount}P`
                  : finalPubCount > 0 ? "Pub. Final"
                  : partialOnlyCount > 0 ? "Pub. Parcial"
                  : calSaved > 0 ? "Rascunho"
                  : "Avaliador";
              const scoreLabelColor = finalPubCount > 0 && partialOnlyCount === 0 ? GOOD
                : finalPubCount > 0 || partialOnlyCount > 0 ? AMBER
                : calSaved > 0 ? INFO
                : "var(--muted-foreground)";

              // MiniBar colors
              const evalColor = !isPureHistorical && evalDone === evalTotal && evalTotal > 0 ? GOOD : "var(--accent)";

              // Date display
              const dateStr = ev.startDate === ev.endDate
                ? fmtDate(ev.startDate)
                : `${fmtDate(ev.startDate)}–${fmtDate(ev.endDate)}`;

              // Mesma regra do chip/contador "Pub. Final" (isPubFinal): antes o badge
              // usava outra fórmula e eventos com "Pub. Final" sumiam do filtro.
              // `next` = destino do próximo passo quando o badge indica uma pendência acionável.
              const badge: { bg: string; fg: string; label: string; next?: { href: string; title: string } } = ev.isHistorical || isPubFinal(ev)
                ? { bg: "rgba(154,176,0,0.14)", fg: GOOD, label: "Pub. Final" }
                : !ev.criteriaConfirmed && !hasEvals && !hasAnyPublication
                ? { bg: "rgba(229,72,77,0.12)", fg: WARNING, label: "Aguardando RH", next: { href: evaluationsHref, title: "Aguardando RH: confirmar os critérios e atribuir avaliadores em Avaliações" } }
                    : partialOnlyCount > 0
                      ? { bg: "rgba(232,162,61,0.14)", fg: AMBER, label: "Pub. Parcial" }
                      : (calSaved > 0 || fc)
                        ? { bg: "rgba(91,141,239,0.14)", fg: INFO, label: "Rascunho" }
                      : concluded
                        ? { bg: "rgba(154,176,0,0.14)", fg: GOOD, label: "Concluído" }
                        : evalDone === evalTotal && evalTotal > 0
                          ? { bg: "rgba(154,176,0,0.14)", fg: GOOD, label: "Avaliado" }
                          : missing.length > 0
                            ? { bg: "rgba(229,72,77,0.12)", fg: WARNING, label: "Sem Avaliador", next: { href: evaluationsHref, title: `Sem avaliador em: ${missing.join(", ")}. Atribuir em Avaliações` } }
                            : evalDone > 0 || evalTotal > 0
                              ? { bg: "rgba(232,162,61,0.14)", fg: AMBER, label: "Em Avaliação" }
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
                      {!ev.criteriaConfirmed && !hasEvals && !hasAnyPublication && (
                        <span className="text-[10px] font-bold uppercase" title="Aguardando o RH confirmar os critérios do evento" style={{ color: WARNING }}>Aguardando RH ·</span>
                      )}
                      {!ev.resultsConfirmed && ev.criteriaConfirmed && (
                        <span className="text-[10px] font-bold uppercase" title="Resultados não confirmados: ainda não contam na elegibilidade nem na nota dos colaboradores" style={{ color: AMBER }}>Não confirmado ·</span>
                      )}
                      <span className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>
                        {[ev.clientName, ev.city].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    {missing.length > 0 && !hasEvals && !hasAnyPublication && (
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
                    {ev.isHistorical || evalTotal === 0 ? (
                      <span className="text-[11px] italic opacity-40" title={ev.isHistorical ? "Evento histórico: sem avaliações neste sistema" : "Nenhum critério ativo neste evento"}>—</span>
                    ) : (
                      <MiniBar value={evalDone} total={evalTotal} color={evalColor} title={evalTooltip} />
                    )}
                  </div>

                  {/* Calibrações mini bar */}
                  <div className="px-3.5 py-3">
                    {isPureHistorical || total === 0 ? (
                      <span className="text-[11px] italic opacity-40">—</span>
                    ) : (
                      <CalBar finalCount={finalPubCount} partialCount={partialOnlyCount} total={total} />
                    )}
                  </div>

                  {/* Matriz de Conformidade mini bar */}
                  <div className="px-3.5 py-3">
                    {!ev.conformityNeeded ? (
                      <span className="text-[11px] italic opacity-40">—</span>
                    ) : (
                      <MiniBar
                        value={ev.conformityFilled ?? 0}
                        total={ev.conformityTotal ?? 0}
                        color={ev.conformityComplete ? GOOD : (ev.conformityFilled ?? 0) > 0 ? AMBER : "var(--border)"}
                        title={`${ev.conformityFilled ?? 0} de ${ev.conformityTotal ?? 0} itens da Matriz de Conformidade respondidos`}
                      />
                    )}
                  </div>

                  {/* Score */}
                  <div className="px-3.5 py-3 text-center">
                    {score != null ? (
                      <div>
                        <span className="font-black text-lg leading-none block" style={{ fontFamily: CONDENSED, color: fc ? GOOD : "var(--foreground)" }}>
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
                    {badge.next ? (
                      <Link
                        href={badge.next.href}
                        title={badge.next.title}
                        data-testid={`badge-next-step-${ev.id}`}
                        className="text-[9px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1 transition-opacity hover:opacity-80 underline-offset-2 hover:underline"
                        style={{ backgroundColor: badge.bg, color: badge.fg }}
                      >
                        {badge.label} <ChevronRight size={9} aria-hidden="true" />
                      </Link>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap" style={{ backgroundColor: badge.bg, color: badge.fg }}>{badge.label}</span>
                    )}
                  </div>

                  {/* Action */}
                  <div className="px-2.5 py-3 flex items-center justify-center gap-1.5">
                    <Link
                      href={evaluationsHref}
                      data-testid={`link-evaluations-event-${ev.id}`}
                      title="Avaliações deste evento"
                      aria-label={`Avaliações de ${ev.name}`}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                      style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
                    >
                      <ClipboardList size={13} aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/events/${ev.id}`}
                      data-testid={`button-view-event-${ev.id}`}
                      title="Gerenciar evento"
                      aria-label={`Gerenciar ${ev.name}`}
                      className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <ChevronRight size={13} aria-hidden="true" />
                    </Link>
                    {user && (["admin", "rh", "diretoria"].includes(user.role) || hasRole(user, "operador")) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Mais ações para ${ev.name}`}
                            title="Mais ações"
                            className="h-7 w-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70"
                            style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)", color: "var(--foreground)" }}
                          >
                            <MoreHorizontal size={13} aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={6}
                          className="p-1.5 min-w-[170px] rounded-lg shadow-lg"
                          style={{ backgroundColor: "var(--card)", border: "2px solid var(--border)", color: "var(--foreground)", zIndex: 9999 }}
                        >
                          {user && (["admin", "rh"].includes(user.role) || hasRole(user, "operador")) && (
                            <DropdownMenuItem
                              data-testid={`button-edit-event-${ev.id}`}
                              onClick={() => setEditingEvent({ id: ev.id, name: ev.name, startDate: ev.startDate, endDate: ev.endDate, clientName: ev.clientName, city: ev.city, state: ev.state, location: ev.location })}
                              className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]"
                            >
                              <Pencil size={13} /> Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]">
                            <Link href={evaluationsHref}>
                              <ClipboardList size={13} /> Avaliações
                            </Link>
                          </DropdownMenuItem>
                          {user && ["admin", "rh", "diretoria"].includes(user.role) && (
                            <DropdownMenuItem asChild className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]">
                              <Link href={`/calibrations?eventId=${ev.id}`}>
                                <SlidersHorizontal size={13} /> Calibrações
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {user && ["admin", "operador"].includes(user.role) && (
                            <>
                              <DropdownMenuSeparator style={{ backgroundColor: "var(--border)", margin: "4px 0" }} />
                              {user.role === "admin" && (
                                <DropdownMenuItem
                                  data-testid={`button-merge-event-${ev.id}`}
                                  onClick={() => { setMergeForEvent({ id: ev.id, name: ev.name }); setMergeTargetId(""); }}
                                  className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2 hover:bg-[var(--secondary)]"
                                >
                                  <GitMerge size={13} /> Mesclar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                data-testid={`button-delete-event-${ev.id}`}
                                onClick={() => setDeleteTarget({ id: ev.id, name: ev.name })}
                                className="gap-2 font-bold text-[12px] uppercase cursor-pointer rounded-md px-3 py-2"
                                style={{ color: WARNING }}
                              >
                                <Trash2 size={13} /> Excluir
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
          </>
        )}

        {/* Legend + count */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center gap-5 mt-4 px-1 flex-wrap">
            {[
              { color: GOOD, label: "Pub. Final" },
              { color: "var(--accent)", label: "Avaliado" },
              { color: AMBER, label: "Em andamento" },
              { color: "var(--border)", label: "Aguardando" },
              { color: WARNING, label: "Aguardando RH" },
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
                            {selectedMergeTarget.name} — {fmtDate(selectedMergeTarget.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}{selectedMergeTarget.isHistorical ? " (histórico)" : ""}
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
                                    {fmtDate(e.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}{e.isHistorical ? " · histórico" : ""}
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
              <div data-testid="alert-merge-conflict" className="rounded-lg p-3 text-sm space-y-1" style={{ backgroundColor: "rgba(232,162,61,0.12)", border: `1px solid ${AMBER}`, color: AMBER }}>
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

      {/* ── Bulk confirm dialog ── */}
      <Dialog open={bulkConfirmOpen} onOpenChange={(open) => { if (!bulkConfirmMutation.isPending) setBulkConfirmOpen(open); }}>
        <DialogContent className="max-w-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
              Confirmar {bulkConfirmIds.length} evento(s)
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Os resultados destes eventos passam a contar na elegibilidade e na nota dos colaboradores. Dá para desfazer depois, evento a evento.
          </p>
          <ul className="max-h-60 overflow-y-auto rounded-lg text-[12px] divide-y" style={{ border: "1px solid var(--border)" }}>
            {bulkConfirmIds.map(ev => (
              <li key={ev.id} className="px-3 py-2 flex items-center justify-between gap-3" style={{ borderColor: "var(--border)" }}>
                <span className="font-semibold truncate">{ev.name}</span>
                <span className="shrink-0" style={{ color: "var(--muted-foreground)" }}>{fmtDate(ev.startDate)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setBulkConfirmOpen(false)}
              disabled={bulkConfirmMutation.isPending}
              className="h-10 px-4 rounded-lg text-[12px] font-bold uppercase disabled:opacity-50"
              style={{ border: "1px solid var(--border)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => bulkConfirmMutation.mutate(bulkConfirmIds.map(ev => ev.id))}
              disabled={bulkConfirmMutation.isPending || bulkConfirmIds.length === 0}
              className="h-10 px-5 rounded-lg text-[12px] font-bold uppercase inline-flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Check size={14} /> {bulkConfirmMutation.isPending ? "Confirmando..." : "Confirmar todos"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED, color: WARNING }}>Excluir Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Tem certeza que deseja excluir <strong style={{ color: "var(--foreground)" }}>{deleteTarget?.name}</strong>? Todos os participantes, avaliações, calibrações e resultados vinculados serão <strong style={{ color: "var(--foreground)" }}>permanentemente removidos</strong>. Essa ação não pode ser desfeita.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="delete-confirm-text" className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Digite EXCLUIR para confirmar</label>
              <Input id="delete-confirm-text" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)} placeholder="EXCLUIR" autoComplete="off" style={inputStyle} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-10 px-4 rounded-lg text-xs font-bold uppercase transition-opacity hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                disabled={deleteMutation.isPending || deleteConfirmText.trim().toUpperCase() !== "EXCLUIR"}
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
      <Dialog open={!!editingEvent} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Evento</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={handleSubmitEdit(d => { if (editingEvent) editMutation.mutate({ id: editingEvent.id, data: { ...d, name: d.name.trim(), endDate: d.startDate } }); })} className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="input-edit-event-name" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome do Evento <span style={{ color: WARNING }}>*</span></Label>
              <Input id="input-edit-event-name" data-testid="input-edit-event-name" {...registerEdit("name", nameRules)} aria-invalid={!!editErrors.name} className="h-11 rounded-lg" style={inputStyle} />
              <FieldError message={editErrors.name?.message} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Cliente</Label>
              <Input data-testid="input-edit-event-client" {...registerEdit("clientName")} className="h-11 rounded-lg" style={inputStyle} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="input-edit-event-start" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Data do Evento <span style={{ color: WARNING }}>*</span></Label>
              <Input id="input-edit-event-start" data-testid="input-edit-event-start" type="date" {...registerEdit("startDate", startDateRules)} aria-invalid={!!editErrors.startDate} className="h-11 rounded-lg" style={inputStyle} />
              <FieldError message={editErrors.startDate?.message} />
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
              <button type="button" onClick={closeEditDialog} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
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
