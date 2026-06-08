import { useState } from "react";
import { useGetAbsences, useCreateAbsence, useDeleteAbsence, useGetEmployees, useGetEvents, getGetAbsencesQueryKey, exportAbsences } from "@workspace/api-client-react";
import type { AbsenceInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, UserMinus, Download, Search, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

const PENALTY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: "falta", label: "Falta", hint: "regra do sistema" },
  { value: "atraso_30", label: "Atraso (30 min)", hint: "50 pts" },
  { value: "atraso_60", label: "Atraso (1 hora)", hint: "100 pts" },
];
const penaltyLabel = (t: string) => PENALTY_OPTIONS.find(o => o.value === t)?.label ?? t;

export default function AbsencesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(currentQuarter);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const qKey = getGetAbsencesQueryKey({ year, quarter });
  const { data: absences, isLoading } = useGetAbsences({ year, quarter }, { query: { queryKey: qKey } });
  const { data: employees } = useGetEmployees({ active: true });
  const { data: events } = useGetEvents({ year });

  const { register, handleSubmit, reset, setValue, watch } = useForm<AbsenceInput>({
    defaultValues: { year: currentYear, quarter: currentQuarter, quantity: 1, penaltyType: "atraso_30" },
  });
  const selectedType = watch("penaltyType");

  const createMutation = useCreateAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Penalidade registrada com sucesso" });
        setOpen(false);
        reset({ year: currentYear, quarter: currentQuarter, quantity: 1, penaltyType: "atraso_30" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteAbsence({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
      onError: () => toast({ title: "Erro ao remover penalidade", variant: "destructive" }),
    },
  });

  const canEdit = user && ["admin", "rh", "diretoria"].includes(user.role);

  async function handleExport() {
    try {
      const data = await exportAbsences({ year, quarter });
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const filteredAbsences = (absences ?? []).filter(a =>
    search === "" || (a.employeeName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const totalCount = filteredAbsences.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPoints = filteredAbsences.reduce((acc, curr) => acc + curr.points * curr.quantity, 0);

  function handleEventChange(v: string) {
    setValue("eventId", Number(v));
    const ev = (events ?? []).find(e => String(e.id) === v);
    if (ev) {
      setValue("year", ev.year);
      setValue("quarter", ev.quarter);
    }
  }

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
                Controle de <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Penalidades</span>
              </h1>
              <p className="text-base text-[#444933] italic mt-2">Lançamento de penalidades por evento que impactam diretamente no cálculo do bônus.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex border-2 border-[#191c1e] bg-white p-1">
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger data-testid="select-year" className="w-24 border-none shadow-none rounded-none font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="w-0.5 bg-[#191c1e] my-1 mx-1" />
              <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
                <SelectTrigger data-testid="select-quarter" className="w-20 border-none shadow-none rounded-none font-bold italic uppercase text-xs tracking-wider focus:ring-0">
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

            <button
              data-testid="button-export-absences"
              onClick={handleExport}
              className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
            >
              <Download size={15} /> Exportar
            </button>

            {canEdit && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button
                    data-testid="button-register-absence"
                    className={`bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <Plus size={16} /> Lançar Penalidade
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2 text-[#ba1a1a]">
                      <AlertTriangle size={22} /> Registrar Penalidade
                    </DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={handleSubmit(d => createMutation.mutate({
                      data: { ...d, employeeId: Number(d.employeeId), eventId: Number(d.eventId), year: Number(d.year), quarter: Number(d.quarter), quantity: Number(d.quantity) },
                    }))}
                    className="space-y-4 pt-4"
                  >
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Penalidade <span className="text-[#ba1a1a]">*</span></Label>
                      <Select defaultValue="atraso_30" onValueChange={v => setValue("penaltyType", v as AbsenceInput["penaltyType"])}>
                        <SelectTrigger data-testid="select-penalty-type" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                          <SelectValue placeholder="Selecione o tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PENALTY_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label} — {o.hint}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Evento <span className="text-[#ba1a1a]">*</span></Label>
                      <Select onValueChange={handleEventChange}>
                        <SelectTrigger data-testid="select-penalty-event" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                          <SelectValue placeholder="Selecione o evento..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(events ?? []).map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.name} (T{e.quarter})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Colaborador <span className="text-[#ba1a1a]">*</span></Label>
                      <Select onValueChange={v => setValue("employeeId", Number(v))}>
                        <SelectTrigger data-testid="select-absence-employee" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                          <SelectValue placeholder="Busque pelo nome..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(employees ?? []).map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Data <span className="text-[#ba1a1a]">*</span></Label>
                        <Input data-testid="input-absence-date" type="date" {...register("date", { required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Quantidade <span className="text-[#ba1a1a]">*</span></Label>
                        <Input data-testid="input-absence-qty" type="number" min="1" {...register("quantity", { valueAsNumber: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Motivo / Observação</Label>
                      <Input data-testid="input-absence-reason" {...register("reason")} placeholder={selectedType === "falta" ? "Atestado não entregue, falta sem justificativa..." : "Detalhe do atraso..."} className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#eceef0]">
                      <button type="button" onClick={() => setOpen(false)} className="border-2 border-[#191c1e] bg-white px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider hover:bg-[#eceef0] transition-colors">
                        Cancelar
                      </button>
                      <button
                        data-testid="button-submit-absence"
                        type="submit"
                        disabled={createMutation.isPending}
                        className={`bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider ${HARD_SHADOW} ${HARD_SHADOW_HOVER} disabled:opacity-50`}
                      >
                        {createMutation.isPending ? "Registrando..." : "Confirmar Lançamento"}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </section>

        {/* Filter + totals */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1 w-full max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider"
              placeholder="Buscar colaborador..."
            />
          </div>
          <div className={`bg-white text-[#191c1e] px-5 py-3 border-2 border-[#191c1e] font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 shrink-0 ${HARD_SHADOW}`}>
            Total no período: <span className="text-base not-italic">{totalCount}</span> penalidades
          </div>
          <div className={`bg-[#ff5722] text-white px-5 py-3 border-2 border-[#191c1e] font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 shrink-0 ${HARD_SHADOW}`}>
            <AlertTriangle size={16} /> Desconto: <span className="text-base not-italic">{totalPoints}</span> pts
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando registros...</div>
        ) : (
          <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <UserMinus size={18} />
              <span className="font-black uppercase tracking-tight">Registros de Penalidades</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Penalidade</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Evento</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Data</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Qtd</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Pontos</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Motivo</th>
                    {canEdit && <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-right">Ação</th>}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {filteredAbsences.map(a => (
                    <tr key={a.id} data-testid={`row-absence-${a.id}`} className="hover:bg-[#f2f4f6] transition-all hover:translate-x-1 group">
                      <td className="px-6 py-4 font-black italic uppercase text-sm text-[#191c1e]">{a.employeeName}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block bg-[#191c1e] text-[#ccff00] font-black px-3 py-1 border-2 border-[#191c1e] text-[11px] uppercase italic">
                          {penaltyLabel(a.penaltyType)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold italic text-sm text-[#444933] max-w-xs truncate">{a.eventName || "—"}</td>
                      <td className="px-6 py-4 font-bold italic text-sm text-[#444933]">{new Date(a.date).toLocaleDateString('pt-BR')}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block bg-[#eceef0] text-[#191c1e] font-black px-3 py-1 border-2 border-[#191c1e] text-xs">
                          {String(a.quantity).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-block bg-[#ff5722] text-white font-black px-3 py-1 border-2 border-[#191c1e] text-xs">
                          -{a.points * a.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold italic text-[#747a60] uppercase tracking-tight max-w-xs truncate">{a.reason || "Sem justificativa"}</td>
                      {canEdit && (
                        <td className="px-6 py-4 text-right">
                          <button
                            data-testid={`button-delete-absence-${a.id}`}
                            className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-all"
                            onClick={() => deleteMutation.mutate({ id: a.id })}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filteredAbsences.length === 0 && (
                    <tr><td colSpan={canEdit ? 8 : 7} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhuma penalidade registrada no período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
