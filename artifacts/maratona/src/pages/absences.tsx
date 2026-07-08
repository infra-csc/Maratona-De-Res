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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

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
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "penalty" | "merit">("all");
  const [filterEventId, setFilterEventId] = useState<string>("__all");
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
    if (filterEventId !== "__all" && String(a.eventId ?? "") !== filterEventId) return false;
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
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 bg-[#ff5722] border-2 border-[#191c1e] flex items-center justify-center shrink-0 ${HARD_SHADOW}`}>
              <UserMinus size={32} className="text-white" />
            </div>
            <div>
              <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
                Penalidades e <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Méritos</span>
              </h1>
              <p className="text-base text-[#444933] italic mt-2">Penalidades descontam e méritos somam pontos na nota final do colaborador.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <CycleBadge />
            <button
              data-testid="button-export-absences"
              onClick={handleExport}
              className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
            >
              <Download size={15} /> Exportar
            </button>

            {canEdit && (
              <button
                data-testid="button-register-absence"
                onClick={openCreate}
                className={`bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <Plus size={16} /> Novo Lançamento
              </button>
            )}
          </div>
        </section>

        {/* Filters row */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-3 items-stretch">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider"
                placeholder="Buscar colaborador..."
              />
            </div>
            {/* Kind filter */}
            <Select value={filterKind} onValueChange={v => setFilterKind(v as typeof filterKind)}>
              <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] bg-white w-[180px] font-bold italic uppercase text-xs tracking-wider">
                <Filter size={14} className="text-[#747a60] shrink-0" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="penalty">Penalidades</SelectItem>
                <SelectItem value="merit">Méritos</SelectItem>
              </SelectContent>
            </Select>
            {/* Event filter */}
            <Select value={filterEventId} onValueChange={setFilterEventId}>
              <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] bg-white w-[220px] font-bold italic uppercase text-xs tracking-wider">
                <SelectValue placeholder="Evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos os eventos</SelectItem>
                <SelectItem value="">Sem evento (ciclo)</SelectItem>
                {(events ?? []).map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Date range */}
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="h-11 rounded-none border-2 border-[#191c1e] bg-white w-[148px] font-bold text-xs"
                title="Data início"
              />
              <span className="text-[#747a60] font-bold text-xs">–</span>
              <Input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="h-11 rounded-none border-2 border-[#191c1e] bg-white w-[148px] font-bold text-xs"
                title="Data fim"
              />
            </div>
          </div>
          {/* Totals */}
          <div className="flex gap-3 flex-wrap">
            <div className={`bg-[#ff5722] text-white px-5 py-3 border-2 border-[#191c1e] font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 shrink-0 ${HARD_SHADOW}`}>
              <AlertTriangle size={16} /> Desconto: <span className="text-base not-italic">-{totalPenaltyPoints}</span> pts
            </div>
            <div className={`bg-[#ccff00] text-[#191c1e] px-5 py-3 border-2 border-[#191c1e] font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 shrink-0 ${HARD_SHADOW}`}>
              <Award size={16} /> Bônus: <span className="text-base not-italic">+{totalMeritPoints}</span> pts
            </div>
            {(filterKind !== "all" || filterEventId !== "__all" || filterDateFrom || filterDateTo || search) && (
              <button
                onClick={() => { setSearch(""); setFilterKind("all"); setFilterEventId("__all"); setFilterDateFrom(""); setFilterDateTo(""); }}
                className="border-2 border-[#191c1e] bg-white px-4 py-2 font-bold text-xs italic uppercase tracking-wider hover:bg-[#eceef0] flex items-center gap-1.5 transition-colors"
              >
                <X size={13} /> Limpar filtros
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando registros...</div>
        ) : (
          <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <UserMinus size={18} />
              <span className="font-black uppercase tracking-tight">Registros de Penalidades e Méritos</span>
              <span className="ml-auto text-xs font-bold not-italic text-[#ccff00]/60">{filteredAbsences.length} registro{filteredAbsences.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Lançamento</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Evento</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Data</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Qtd</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Pontos</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Motivo</th>
                    {canEdit && <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {filteredAbsences.map(a => {
                    const isMerit = a.kind === "merit";
                    return (
                      <tr
                        key={a.id}
                        data-testid={`row-absence-${a.id}`}
                        className={cn(
                          "hover:bg-[#f2f4f6] transition-all group",
                          isMerit ? "border-l-4 border-l-[#84cc16]" : "border-l-4 border-l-[#ff5722]",
                        )}
                      >
                        <td className="px-6 py-4 font-black italic uppercase text-sm text-[#191c1e]">{a.employeeName}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 font-black px-3 py-1 border-2 border-[#191c1e] text-[11px] uppercase italic",
                            isMerit ? "bg-[#ccff00] text-[#191c1e]" : "bg-[#191c1e] text-[#ccff00]",
                          )}>
                            {isMerit ? <Award size={12} /> : <AlertTriangle size={12} />}
                            {typeLabel(a.penaltyType)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold italic text-sm text-[#444933]">{a.eventName || <span className="text-[#b0b7a0] text-xs">Ciclo</span>}</td>
                        <td className="px-6 py-4 font-bold italic text-sm text-[#444933]">{new Date(a.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-block bg-[#eceef0] text-[#191c1e] font-black px-3 py-1 border-2 border-[#191c1e] text-xs">
                            {String(a.quantity).padStart(2, "0")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "inline-block font-black px-3 py-1 border-2 border-[#191c1e] text-xs",
                            isMerit ? "bg-[#ccff00] text-[#191c1e]" : "bg-[#ff5722] text-white",
                          )}>
                            {isMerit ? "+" : "-"}{a.points * a.quantity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold italic text-[#747a60] uppercase tracking-tight max-w-xs truncate">
                          {a.reason || <span className="text-[#b0b7a0] not-italic normal-case font-normal">Sem justificativa</span>}
                        </td>
                        {canEdit && (
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                data-testid={`button-edit-absence-${a.id}`}
                                className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#191c1e] hover:bg-[#eceef0] transition-all"
                                onClick={() => openEdit(a)}
                                title="Editar"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                data-testid={`button-delete-absence-${a.id}`}
                                className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-all"
                                onClick={() => setDeleteTargetId(a.id)}
                                title="Excluir"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {filteredAbsences.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 8 : 7} className="text-center py-16 italic uppercase font-bold text-[#747a60]">
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

      {/* Create / Edit modal */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingAbsence(null); }}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2 text-[#191c1e]">
              <AlertTriangle size={22} /> {editingAbsence ? "Editar Lançamento" : "Registrar Lançamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">
                Tipo de Lançamento <span className="text-[#ba1a1a]">*</span>
              </Label>
              <Select
                value={selectedType || defaultType}
                onValueChange={v => { setValue("penaltyType", v); setValue("eventId", null); }}
              >
                <SelectTrigger data-testid="select-penalty-type" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.filter(t => t.kind === "penalty").length > 0 && (
                    <>
                      <div className="px-2 py-1 text-[10px] font-bold uppercase italic text-[#ba1a1a] tracking-wider">Penalidades (−)</div>
                      {activeTypes.filter(t => t.kind === "penalty").map(t => (
                        <SelectItem key={t.slug} value={t.slug}>
                          {t.label} — −{t.points} pts{t.requiresEvent ? " 📍" : ""}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {activeTypes.filter(t => t.kind === "merit").length > 0 && (
                    <>
                      <div className="px-2 py-1 mt-1 text-[10px] font-bold uppercase italic text-[#506600] tracking-wider">Méritos (+)</div>
                      {activeTypes.filter(t => t.kind === "merit").map(t => (
                        <SelectItem key={t.slug} value={t.slug}>
                          {t.label} — +{t.points} pts{t.requiresEvent ? " 📍" : ""}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {requiresEvent && (
                <p className="text-[11px] font-bold italic uppercase tracking-wide text-[#ba1a1a] flex items-center gap-1">
                  📍 Este tipo exige um evento vinculado
                </p>
              )}
            </div>

            {/* Evento */}
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">
                Evento{" "}
                {requiresEvent
                  ? <span className="text-[#ba1a1a]">*</span>
                  : <span className="text-[#747a60] not-italic normal-case">(opcional para lançamentos no ciclo)</span>
                }
              </Label>
              <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    data-testid="select-penalty-event"
                    className={cn(
                      "h-11 w-full flex items-center justify-between gap-2 px-3 rounded-none border-2 bg-white text-left",
                      requiresEvent && !watchedEventId ? "border-[#ba1a1a]" : "border-[#191c1e]",
                    )}
                  >
                    <span className={cn("truncate text-sm", selectedEvent ? "font-bold italic text-[#191c1e]" : "font-bold italic uppercase text-xs tracking-wider text-[#747a60]")}>
                      {selectedEvent ? `${selectedEvent.name}${selectedEvent.cycleName ? ` (${selectedEvent.cycleName})` : ""}` : "Selecione o evento..."}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {selectedEvent && (
                        <X size={14} className="text-[#747a60] hover:text-[#ba1a1a]"
                          onClick={e => { e.stopPropagation(); setValue("eventId", null); }} />
                      )}
                      <ChevronsUpDown size={16} className="text-[#191c1e] opacity-60" />
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                  <Command className="rounded-none">
                    <CommandInput placeholder="Buscar por evento..." className="italic" />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
                      <CommandGroup>
                        {(events ?? []).map(e => (
                          <CommandItem
                            key={e.id}
                            value={`${e.name} ${e.cycleName ?? ""}`}
                            onSelect={() => { setValue("eventId", e.id); setEventPickerOpen(false); }}
                            className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-2 items-start"
                          >
                            <Check size={16} className={cn("mt-0.5 shrink-0", Number(watchedEventId) === e.id ? "opacity-100" : "opacity-0")} />
                            <span className="flex flex-col min-w-0">
                              <span className="font-black italic uppercase text-sm leading-tight whitespace-normal">{e.name}</span>
                              {e.cycleName && <span className="text-[11px] font-bold italic uppercase text-[#747a60]">{e.cycleName}</span>}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {requiresEvent && !watchedEventId && (
                <p className="text-[11px] font-bold text-[#ba1a1a]">Selecione um evento para continuar.</p>
              )}
            </div>

            {/* Colaborador (apenas no create) */}
            {!editingAbsence && (
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Colaborador <span className="text-[#ba1a1a]">*</span></Label>
                <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      data-testid="select-absence-employee"
                      className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-none border-2 border-[#191c1e] bg-white text-left"
                    >
                      <span className={cn("truncate text-sm", selectedEmployee ? "font-black italic uppercase text-[#191c1e]" : "font-bold italic uppercase text-xs tracking-wider text-[#747a60]")}>
                        {selectedEmployee ? selectedEmployee.name : "Busque pelo nome..."}
                      </span>
                      <ChevronsUpDown size={16} className="text-[#191c1e] opacity-60 shrink-0" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                    <Command className="rounded-none">
                      <CommandInput placeholder="Buscar pelo nome..." className="italic" />
                      <CommandList className="max-h-[280px]">
                        <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum colaborador encontrado.</CommandEmpty>
                        <CommandGroup>
                          {(employees ?? []).map(e => (
                            <CommandItem
                              key={e.id}
                              value={e.name}
                              onSelect={() => { setValue("employeeId", e.id); setEmployeePickerOpen(false); }}
                              className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-2"
                            >
                              <Check size={16} className={cn("shrink-0", Number(watchedEmployeeId) === e.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-black italic uppercase text-sm truncate">{e.name}</span>
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
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Data <span className="text-[#ba1a1a]">*</span></Label>
                <Input type="date" {...register("date", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Quantidade <span className="text-[#ba1a1a]">*</span></Label>
                <Input type="number" min="1" {...register("quantity", { valueAsNumber: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
            </div>

            {/* Total preview */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 border-2 border-[#191c1e] font-black italic uppercase tracking-tight",
              previewKind === "merit" ? "bg-[#ccff00] text-[#191c1e]" : "bg-[#191c1e] text-[#ccff00]",
            )}>
              <span className="text-xs">Total a lançar:</span>
              <span className="text-2xl leading-none">
                {previewKind === "merit" ? "+" : "-"}{previewPoints} pts
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Motivo / Observação</Label>
              <Input
                {...register("reason")}
                placeholder="Detalhe do lançamento..."
                className="h-11 rounded-none border-2 border-[#191c1e]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#eceef0]">
              <button
                type="button"
                onClick={() => { setOpen(false); setEditingAbsence(null); }}
                className="border-2 border-[#191c1e] bg-white px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider hover:bg-[#eceef0] transition-colors"
              >
                Cancelar
              </button>
              <button
                data-testid="button-submit-absence"
                type="submit"
                disabled={isModalPending}
                className={`bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider ${HARD_SHADOW} ${HARD_SHADOW_HOVER} disabled:opacity-50`}
              >
                {isModalPending ? (editingAbsence ? "Salvando..." : "Registrando...") : (editingAbsence ? "Salvar Alterações" : "Confirmar Lançamento")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl italic uppercase font-black tracking-tight text-[#191c1e] flex items-center gap-2">
              <Trash2 size={20} /> Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#444933] font-bold italic">
              Este lançamento será removido permanentemente. O cálculo do resultado final do colaborador será atualizado no próximo reprocessamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs tracking-wider">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate({ id: deleteTargetId })}
              className="rounded-none bg-[#ba1a1a] text-white border-2 border-[#191c1e] font-bold italic uppercase text-xs tracking-wider hover:bg-[#93000a]"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
