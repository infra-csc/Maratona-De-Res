import { useState } from "react";
import { useGetAbsences, useCreateAbsence, useDeleteAbsence, useGetEmployees, getGetAbsencesQueryKey, exportAbsences } from "@workspace/api-client-react";
import type { AbsenceInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, UserMinus, Download, Search, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

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

  const { register, handleSubmit, reset, setValue } = useForm<AbsenceInput>({
    defaultValues: { year: currentYear, quarter: currentQuarter, quantity: 1 },
  });

  const createMutation = useCreateAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Falta registrada com sucesso" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteAbsence({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
      onError: () => toast({ title: "Erro ao remover falta", variant: "destructive" }),
    },
  });

  const canEdit = user && ["admin", "rh", "avaliador"].includes(user.role);

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

  const totalAbsences = filteredAbsences.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
            <UserMinus size={28} className="text-destructive" /> Controle de Faltas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Lançamento de ausências que impactam diretamente no cálculo do bônus.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-white p-1 rounded-lg border shadow-sm">
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger data-testid="select-year" className="w-24 border-none shadow-none font-medium bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-px bg-border my-1 mx-1" />
            <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
              <SelectTrigger data-testid="select-quarter" className="w-24 border-none shadow-none font-medium bg-slate-50">
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

          <Button data-testid="button-export-absences" variant="outline" className="bg-white shadow-sm" onClick={handleExport}>
            <Download size={15} className="mr-2" /> Exportar
          </Button>

          {canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-register-absence" variant="destructive" className="shadow-sm">
                  <Plus size={16} className="mr-2" /> Lançar Falta
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle className="text-xl text-destructive flex items-center gap-2"><AlertTriangle size={20}/> Registrar Ausência</DialogTitle></DialogHeader>
                <form
                  onSubmit={handleSubmit(d => createMutation.mutate({
                    data: { ...d, employeeId: Number(d.employeeId), year: Number(d.year), quarter: Number(d.quarter), quantity: Number(d.quantity) },
                  }))}
                  className="space-y-4 pt-4"
                >
                  <div className="space-y-1.5">
                    <Label className="font-semibold">Colaborador <span className="text-destructive">*</span></Label>
                    <Select onValueChange={v => setValue("employeeId", Number(v))}>
                      <SelectTrigger data-testid="select-absence-employee" className="h-11">
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
                      <Label className="font-semibold">Data da Falta <span className="text-destructive">*</span></Label>
                      <Input data-testid="input-absence-date" type="date" {...register("date", { required: true })} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-semibold">Dias (Qtd) <span className="text-destructive">*</span></Label>
                      <Input data-testid="input-absence-qty" type="number" min="1" {...register("quantity", { valueAsNumber: true })} className="h-11" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-semibold">Ano Contábil</Label>
                      <Input type="number" {...register("year", { valueAsNumber: true })} className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-semibold">Trimestre Contábil</Label>
                      <Select defaultValue={String(currentQuarter)} onValueChange={v => setValue("quarter", Number(v))}>
                        <SelectTrigger data-testid="select-absence-quarter" className="h-11 bg-slate-50">
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
                  <div className="space-y-1.5">
                    <Label className="font-semibold">Motivo / Observação</Label>
                    <Input data-testid="input-absence-reason" {...register("reason")} placeholder="Atestado não entregue, falta sem justificativa..." className="h-11" />
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button data-testid="button-submit-absence" type="submit" variant="destructive" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Registrando..." : "Confirmar Lançamento"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white shadow-sm border-transparent hover:border-slate-300 transition-colors"
            placeholder="Buscar colaborador..."
          />
        </div>
        <div className="bg-red-50 text-red-800 px-4 py-2.5 rounded-lg border border-red-100 font-medium text-sm flex items-center gap-2 shrink-0">
          <AlertTriangle size={16} /> Total no período: <strong>{totalAbsences} faltas</strong>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Carregando registros...</div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Colaborador</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Data Registrada</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Quantidade</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Motivo</th>
                  {canEdit && <th className="px-6 py-4 text-right font-semibold text-slate-500 uppercase tracking-wider text-xs">Ação</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAbsences.map(a => (
                  <tr key={a.id} data-testid={`row-absence-${a.id}`} className="hover:bg-red-50/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{a.employeeName}</td>
                    <td className="px-6 py-4 font-medium text-slate-600">{new Date(a.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block bg-red-100 text-red-700 font-black px-2.5 py-0.5 rounded-md">
                        {a.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">{a.reason || "Sem justificativa"}</td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <Button
                          data-testid={`button-delete-absence-${a.id}`}
                          size="sm" variant="ghost"
                          className="text-slate-400 hover:text-destructive hover:bg-red-50 rounded-full h-8 w-8 p-0"
                          onClick={() => deleteMutation.mutate({ id: a.id })}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredAbsences.length === 0 && (
                  <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-16 text-slate-500 text-base">Nenhuma falta registrada no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
