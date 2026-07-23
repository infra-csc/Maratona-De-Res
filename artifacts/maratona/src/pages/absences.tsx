import { useState, useEffect } from "react";
import {
  useGetAbsences, useCreateAbsence, useUpdateAbsence, useDeleteAbsence,
  useGetEmployees, useGetEvents, useGetPenaltyTypes,
  getGetAbsencesQueryKey, exportAbsences,
} from "@workspace/api-client-react";
import type { Absence } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, Pencil, UserMinus, Download, Search, AlertTriangle, Award, ChevronsUpDown, Check, X, Filter } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CycleBadge } from "@/components/cycle-badge";
import { cn } from "@/lib/utils";
import { usePremiumTheme, CONDENSED, BODY } from "@/lib/premium-theme";

type EntryKind = "penalty" | "merit";

interface AbsenceFormData {
  penaltyType: string;
  employeeId: number | null;
  eventId: number | null;
  date: string;
  quantity: number;
  reason: string;
}

export default function AbsencesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  usePremiumTheme();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "penalty" | "merit">("all");
  const [filterEventId, setFilterEventId] = useState<string>("__all");
  const [filterEventPickerOpen, setFilterEventPickerOpen] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const qKey = getGetAbsencesQueryKey();
  const { data: absences, isLoading } = useGetAbsences(undefined, { query: { queryKey: qKey } });
  const { data: employees } = useGetEmployees({ active: true });
  const { data: events } = useGetEvents();
  const { data: penaltyTypes } = useGetPenaltyTypes();

  const activeTypes = (penaltyTypes ?? []).filter(t => t.active);
  const getTypeInfo = (slug: string) => activeTypes.find(t => t.slug === slug) ?? penaltyTypes?.find(t => t.slug === slug);
  const typeLabel = (slug: string) => getTypeInfo(slug)?.label ?? slug;
  const typeKind = (slug: string): EntryKind => (getTypeInfo(slug)?.kind as EntryKind) ?? "penalty";
  const typePoints = (slug: string) => getTypeInfo(slug)?.points ?? 0;
  const typeRequiresEvent = (slug: string) => getTypeInfo(slug)?.requiresEvent ?? false;

  const defaultType = activeTypes[0]?.slug ?? "falta";

  const { register, handleSubmit, reset, setValue, watch } = useForm<AbsenceFormData>({
    defaultValues: { quantity: 1, penaltyType: defaultType, employeeId: null, eventId: null, date: "", reason: "" },
  });

  const selectedType = watch("penaltyType");
  const watchedEmployeeId = watch("employeeId");
  const watchedEventId = watch("eventId");
  const watchedQty = watch("quantity");
  const selectedEmployee = (employees ?? []).find(e => e.id === Number(watchedEmployeeId));
  const selectedEvent = (events ?? []).find(e => e.id === Number(watchedEventId));
  const requiresEvent = typeRequiresEvent(selectedType);
  const previewPoints = typePoints(selectedType) * Math.max(1, Number(watchedQty) || 1);
  const previewKind = typeKind(selectedType);

  useEffect(() => {
    if (!open) return;
    if (editingAbsence) {
      reset({
        penaltyType: editingAbsence.penaltyType,
        employeeId: editingAbsence.employeeId,
        eventId: editingAbsence.eventId ?? null,
        date: editingAbsence.date,
        quantity: editingAbsence.quantity,
        reason: editingAbsence.reason ?? "",
      });
    } else {
      reset({ quantity: 1, penaltyType: defaultType, employeeId: null, eventId: null, date: "", reason: "" });
    }
  }, [open, editingAbsence, defaultType]);

  const createMutation = useCreateAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Lançamento registrado com sucesso" });
        setOpen(false);
        setEditingAbsence(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Lançamento atualizado com sucesso" });
        setOpen(false);
        setEditingAbsence(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteAbsence({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setDeleteTargetId(null); },
      onError: () => toast({ title: "Erro ao remover lançamento", variant: "destructive" }),
    },
  });

  const canEdit = user && ["admin", "rh", "diretoria"].includes(user.role);

  async function handleExport() {
    try {
      const data = await exportAbsences();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  function openCreate() {
    setEditingAbsence(null);
    setOpen(true);
  }

  function openEdit(a: Absence) {
    setEditingAbsence(a);
    setOpen(true);
  }

  function onSubmit(d: AbsenceFormData) {
    if (requiresEvent && !d.eventId) {
      toast({ title: "Evento obrigatório", description: `${typeLabel(d.penaltyType)} exige um evento vinculado.`, variant: "destructive" });
      return;
    }
    if (!d.employeeId) {
      toast({ title: "Colaborador obrigatório", variant: "destructive" });
      return;
    }
    if (editingAbsence) {
      updateMutation.mutate({
        id: editingAbsence.id,
        data: {
          penaltyType: d.penaltyType,
          eventId: d.eventId ? Number(d.eventId) : null,
          date: d.date,
          quantity: Number(d.quantity),
          reason: d.reason || null,
        },
      });
    } else {
      createMutation.mutate({
        data: {
          penaltyType: d.penaltyType,
          employeeId: Number(d.employeeId),
          eventId: d.eventId ? Number(d.eventId) : null,
          date: d.date,
          quantity: Number(d.quantity),
          reason: d.reason || undefined,
        },
      });
    }
  }

  const filteredAbsences = (absences ?? []).filter(a => {
    if (search && !(a.employeeName ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterKind !== "all" && a.kind !== filterKind) return false;
    if (filterEventId !== "__all") {
      if (filterEventId === "__none" && a.eventId != null) return false;
      if (filterEventId !== "__none" && String(a.eventId) !== filterEventId) return false;
    }
    if (filterDateFrom && a.date < filterDateFrom) return false;
    if (filterDateTo && a.date > filterDateTo) return false;
    return true;
  });

  const penaltyRows = filteredAbsences.filter(a => a.kind !== "merit");
  const meritRows = filteredAbsences.filter(a => a.kind === "merit");
  const totalPenaltyPoints = penaltyRows.reduce((acc, curr) => acc + curr.points * curr.quantity, 0);
  const totalMeritPoints = meritRows.reduce((acc, curr) => acc + curr.points * curr.quantity, 0);

  const isModalPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-8">

        {/* ── Header ── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e84000" }}>
              <UserMinus size={26} className="text-white" />
            </div>
            <div>
              <h1 data-testid="text-page-title" className="font-black uppercase leading-none" style={{ fontFamily: CONDENSED, fontSize: "clamp(2rem,5vw,3.2rem)", letterSpacing: "-0.02em" }}>
                Penalidades e <span style={{ color: "var(--accent)" }}>Méritos</span>
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                Penalidades descontam e méritos somam pontos na nota final do colaborador.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <CycleBadge />
            <button
              data-testid="button-export-absences"
              onClick={handleExport}
              className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-opacity hover:opacity-70"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              <Download size={14} /> Exportar
            </button>
            {canEdit && (
              <button
                data-testid="button-register-absence"
                onClick={openCreate}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-opacity hover:opacity-85"
                style={{ backgroundColor: "#e84000", color: "white" }}
              >
                <Plus size={15} /> Novo Lançamento
              </button>
            )}
          </div>
        </section>

        {/* ── Filters ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 w-full rounded-lg text-sm font-medium outline-none"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                placeholder="Buscar colaborador..."
              />
            </div>
            <Select value={filterKind} onValueChange={v => setFilterKind(v as typeof filterKind)}>
              <SelectTrigger className="h-10 rounded-lg w-[180px] text-xs font-bold uppercase" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                <Filter size={13} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="penalty">Penalidades</SelectItem>
                <SelectItem value="merit">Méritos</SelectItem>
              </SelectContent>
            </Select>
            <Popover open={filterEventPickerOpen} onOpenChange={setFilterEventPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  className="h-10 rounded-lg px-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider shrink-0 transition-opacity hover:opacity-80"
                  style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", minWidth: 200, maxWidth: 280 }}
                >
                  <Filter size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                  <span className="flex-1 text-left truncate">
                    {filterEventId === "__all"
                      ? "Todos os eventos"
                      : filterEventId === "__none"
                      ? "Sem evento (ciclo)"
                      : ((events ?? []).find(e => String(e.id) === filterEventId)?.name ?? "Evento")}
                  </span>
                  <ChevronsUpDown size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[320px]" align="start">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput placeholder="Buscar evento..." />
                  <CommandList>
                    <CommandEmpty>Nenhum evento encontrado.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="Todos os eventos"
                        onSelect={() => { setFilterEventId("__all"); setFilterEventPickerOpen(false); }}
                        className="flex items-center gap-2"
                      >
                        <Check size={13} className={filterEventId === "__all" ? "opacity-100" : "opacity-0"} />
                        Todos os eventos
                      </CommandItem>
                      <CommandItem
                        value="Sem evento ciclo"
                        onSelect={() => { setFilterEventId("__none"); setFilterEventPickerOpen(false); }}
                        className="flex items-center gap-2"
                      >
                        <Check size={13} className={filterEventId === "__none" ? "opacity-100" : "opacity-0"} />
                        Sem evento (ciclo)
                      </CommandItem>
                      {(events ?? []).map(e => (
                        <CommandItem
                          key={e.id}
                          value={e.name}
                          onSelect={() => { setFilterEventId(String(e.id)); setFilterEventPickerOpen(false); }}
                          className="flex items-center gap-2"
                        >
                          <Check size={13} className={filterEventId === String(e.id) ? "opacity-100" : "opacity-0"} />
                          {e.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1 shrink-0">
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="h-10 rounded-lg px-3 text-sm outline-none w-[148px]"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                title="Data início"
              />
              <span className="font-bold text-xs" style={{ color: "var(--muted-foreground)" }}>–</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="h-10 rounded-lg px-3 text-sm outline-none w-[148px]"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
                title="Data fim"
              />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0" style={{ backgroundColor: "rgba(229,72,77,0.15)", color: "#e5484d" }}>
              <AlertTriangle size={13} /> Desconto: <span className="text-sm font-black">−{totalPenaltyPoints}</span> pts
            </div>
            <div className="px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0" style={{ backgroundColor: "rgba(154,176,0,0.15)", color: "var(--accent)" }}>
              <Award size={13} /> Bônus: <span className="text-sm font-black">+{totalMeritPoints}</span> pts
            </div>
            {(filterKind !== "all" || filterEventId !== "__all" || filterDateFrom || filterDateTo || search) && (
              <button
                onClick={() => { setSearch(""); setFilterKind("all"); setFilterEventId("__all"); setFilterDateFrom(""); setFilterDateTo(""); }}
                className="px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-opacity hover:opacity-70"
                style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              >
                <X size={12} /> Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* ── Table ── */}
        {isLoading ? (
          <div className="text-center py-20 text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
            Carregando registros...
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3.5 flex items-center gap-2" style={{ backgroundColor: "#191c1e" }}>
              <UserMinus size={16} style={{ color: "#d4ff00" }} />
              <span className="font-black uppercase text-sm tracking-tight" style={{ color: "#d4ff00", fontFamily: CONDENSED }}>
                Registros de Penalidades e Méritos
              </span>
              <span className="ml-auto text-[11px] font-bold" style={{ color: "rgba(212,255,0,0.55)" }}>
                {filteredAbsences.length} registro{filteredAbsences.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Colaborador</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Lançamento</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Evento</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Data</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Qtd</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--muted-foreground)" }}>Pontos</th>
                    <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Motivo</th>
                    {canEdit && <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-right" style={{ color: "var(--muted-foreground)" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredAbsences.map(a => {
                    const isMerit = a.kind === "merit";
                    return (
                      <tr
                        key={a.id}
                        data-testid={`row-absence-${a.id}`}
                        className="transition-colors group"
                        style={{ borderTop: "1px solid var(--border)", borderLeft: `3px solid ${isMerit ? "#9ab000" : "#e84000"}` }}
                        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--secondary)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
                      >
                        <td className="px-5 py-3.5 font-black uppercase text-[13px]" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
                          {a.employeeName}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={cn(
                            "inline-flex items-center gap-1 font-black px-2.5 py-1 rounded text-[11px] uppercase",
                            isMerit ? "bg-[rgba(154,176,0,0.15)] text-[#9ab000]" : "bg-[rgba(229,72,77,0.15)] text-[#e5484d]",
                          )}>
                            {isMerit ? <Award size={11} /> : <AlertTriangle size={11} />}
                            {typeLabel(a.penaltyType)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
                          {a.eventName || <span className="text-xs opacity-50">Ciclo</span>}
                        </td>
                        <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
                          {new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-block font-black px-2.5 py-1 rounded text-xs" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
                            {String(a.quantity).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-block font-black px-2.5 py-1 rounded text-xs" style={{ backgroundColor: isMerit ? "rgba(154,176,0,0.15)" : "rgba(229,72,77,0.15)", color: isMerit ? "#9ab000" : "#e5484d" }}>
                            {isMerit ? "+" : "−"}{a.points * a.quantity}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm max-w-xs truncate" style={{ color: "var(--muted-foreground)" }} title={a.reason || undefined}>
                          {a.reason || <span className="text-xs opacity-50">Sem justificativa</span>}
                        </td>
                        {canEdit && (
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                data-testid={`button-edit-absence-${a.id}`}
                                className="p-1.5 rounded transition-opacity hover:opacity-60"
                                style={{ color: "var(--muted-foreground)" }}
                                onClick={() => openEdit(a)}
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                data-testid={`button-delete-absence-${a.id}`}
                                className="p-1.5 rounded transition-colors"
                                style={{ color: "var(--muted-foreground)" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e5484d"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; }}
                                onClick={() => setDeleteTargetId(a.id)}
                                title="Excluir"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredAbsences.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 8 : 7} className="text-center py-16 text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                        Nenhum lançamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ── */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingAbsence(null); }}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
              <AlertTriangle size={19} /> {editingAbsence ? "Editar Lançamento" : "Registrar Lançamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Tipo de Lançamento <span style={{ color: "#e5484d" }}>*</span>
              </Label>
              <Select
                value={selectedType || defaultType}
                onValueChange={v => { setValue("penaltyType", v); setValue("eventId", null); }}
              >
                <SelectTrigger data-testid="select-penalty-type" className="h-11 rounded-lg" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.filter(t => t.kind === "penalty").length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#e5484d" }}>Penalidades (−)</div>
                      {activeTypes.filter(t => t.kind === "penalty").map(t => (
                        <SelectItem key={t.slug} value={t.slug}>{t.label} — −{t.points} pts{t.requiresEvent ? " 📍" : ""}</SelectItem>
                      ))}
                    </>
                  )}
                  {activeTypes.filter(t => t.kind === "merit").length > 0 && (
                    <>
                      <div className="px-2 py-1 mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#9ab000" }}>Méritos (+)</div>
                      {activeTypes.filter(t => t.kind === "merit").map(t => (
                        <SelectItem key={t.slug} value={t.slug}>{t.label} — +{t.points} pts{t.requiresEvent ? " 📍" : ""}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {requiresEvent && (
                <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: "#e5484d" }}>
                  📍 Este tipo exige um evento vinculado
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                Evento{" "}
                {requiresEvent
                  ? <span style={{ color: "#e5484d" }}>*</span>
                  : <span className="normal-case font-normal text-xs">(opcional para lançamentos no ciclo)</span>
                }
              </Label>
              <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    data-testid="select-penalty-event"
                    className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-lg text-left"
                    style={{
                      backgroundColor: "var(--secondary)",
                      border: requiresEvent && !watchedEventId ? "1px solid #e5484d" : "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <span className={cn("truncate text-sm", selectedEvent ? "font-bold" : "font-medium text-xs")} style={{ color: selectedEvent ? "var(--foreground)" : "var(--muted-foreground)" }}>
                      {selectedEvent ? `${selectedEvent.name}${selectedEvent.cycleName ? ` (${selectedEvent.cycleName})` : ""}` : "Selecione o evento..."}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {selectedEvent && (
                        <X size={13} style={{ color: "var(--muted-foreground)" }}
                          onClick={e => { e.stopPropagation(); setValue("eventId", null); }} />
                      )}
                      <ChevronsUpDown size={14} style={{ color: "var(--muted-foreground)" }} />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <Command>
                    <CommandInput placeholder="Buscar por evento..." />
                    <CommandList className="max-h-[260px]">
                      <CommandEmpty className="py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum evento encontrado.</CommandEmpty>
                      <CommandGroup>
                        {(events ?? []).map(e => (
                          <CommandItem
                            key={e.id}
                            value={`${e.name} ${e.cycleName ?? ""}`}
                            onSelect={() => { setValue("eventId", e.id); setEventPickerOpen(false); }}
                            className="cursor-pointer py-2 gap-2 items-start"
                          >
                            <Check size={14} className={cn("mt-0.5 shrink-0", Number(watchedEventId) === e.id ? "opacity-100" : "opacity-0")} />
                            <span className="flex flex-col min-w-0">
                              <span className="font-black uppercase text-sm leading-tight whitespace-normal">{e.name}</span>
                              {e.cycleName && <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>{e.cycleName}</span>}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {requiresEvent && !watchedEventId && (
                <p className="text-[11px] font-bold" style={{ color: "#e5484d" }}>Selecione um evento para continuar.</p>
              )}
            </div>

            {!editingAbsence && (
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Colaborador <span style={{ color: "#e5484d" }}>*</span>
                </Label>
                <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      data-testid="select-absence-employee"
                      className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-lg text-left"
                      style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                    >
                      <span className={cn("truncate text-sm", selectedEmployee ? "font-black uppercase" : "font-medium text-xs")} style={{ color: selectedEmployee ? "var(--foreground)" : "var(--muted-foreground)" }}>
                        {selectedEmployee ? selectedEmployee.name : "Busque pelo nome..."}
                      </span>
                      <ChevronsUpDown size={14} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <Command>
                      <CommandInput placeholder="Buscar pelo nome..." />
                      <CommandList className="max-h-[260px]">
                        <CommandEmpty className="py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {(employees ?? []).map(e => (
                            <CommandItem
                              key={e.id}
                              value={e.name}
                              onSelect={() => { setValue("employeeId", e.id); setEmployeePickerOpen(false); }}
                              className="cursor-pointer py-2 gap-2"
                            >
                              <Check size={14} className={cn("shrink-0", Number(watchedEmployeeId) === e.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-black uppercase text-sm truncate">{e.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Data <span style={{ color: "#e5484d" }}>*</span>
                </Label>
                <Input type="date" {...register("date", { required: true })} className="h-11 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                  Quantidade <span style={{ color: "#e5484d" }}>*</span>
                </Label>
                <Input type="number" min="1" {...register("quantity", { valueAsNumber: true })} className="h-11 rounded-lg" />
              </div>
            </div>

            <div className="flex items-center justify-between px-4 py-3 rounded-lg font-black uppercase tracking-tight" style={{
              backgroundColor: previewKind === "merit" ? "rgba(154,176,0,0.15)" : "rgba(229,72,77,0.15)",
              color: previewKind === "merit" ? "#9ab000" : "#e5484d",
              border: `1px solid ${previewKind === "merit" ? "rgba(154,176,0,0.3)" : "rgba(229,72,77,0.3)"}`,
            }}>
              <span className="text-xs">Total a lançar:</span>
              <span className="text-2xl leading-none">{previewKind === "merit" ? "+" : "−"}{previewPoints} pts</span>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Motivo / Observação</Label>
              <Input {...register("reason")} placeholder="Detalhe do lançamento..." className="h-11 rounded-lg" />
            </div>

            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => { setOpen(false); setEditingAbsence(null); }}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-70"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                data-testid="button-submit-absence"
                type="submit"
                disabled={isModalPending}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-85 disabled:opacity-50"
                style={{ backgroundColor: "#e84000", color: "white" }}
              >
                {isModalPending ? (editingAbsence ? "Salvando..." : "Registrando...") : (editingAbsence ? "Salvar Alterações" : "Confirmar Lançamento")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
              <Trash2 size={18} /> Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
              Este lançamento será removido permanentemente. O cálculo do resultado final do colaborador será atualizado no próximo reprocessamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteTargetId && deleteMutation.mutate({ id: deleteTargetId })}
              className="rounded-lg font-bold uppercase text-xs disabled:opacity-50"
              style={{ backgroundColor: "#e5484d", color: "white", border: "none" }}
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
