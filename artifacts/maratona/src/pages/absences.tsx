import { useState } from "react";
import { useGetAbsences, useCreateAbsence, useDeleteAbsence, useGetEmployees, getGetAbsencesQueryKey, exportAbsences } from "@workspace/api-client-react";
import type { AbsenceInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, UserX, Download } from "lucide-react";
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

  const qKey = getGetAbsencesQueryKey({ year, quarter });
  const { data: absences, isLoading } = useGetAbsences({ year, quarter }, { query: { queryKey: qKey } });
  const { data: employees } = useGetEmployees({ active: true });

  const { register, handleSubmit, reset, setValue, watch } = useForm<AbsenceInput>({
    defaultValues: { year: currentYear, quarter: currentQuarter, quantity: 1 },
  });

  const createMutation = useCreateAbsence({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Falta registrada" });
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <UserX size={22} className="text-destructive" /> Controle de Faltas
          </h1>
          <p className="text-muted-foreground text-sm">Registre e gerencie ausências</p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="button-export-absences" size="sm" variant="outline" onClick={handleExport}>
            <Download size={15} className="mr-1.5" /> Exportar CSV
          </Button>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-register-absence" size="sm">
                <Plus size={16} className="mr-1.5" /> Registrar Falta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Falta</DialogTitle></DialogHeader>
              <form
                onSubmit={handleSubmit(d => createMutation.mutate({
                  data: { ...d, employeeId: Number(d.employeeId), year: Number(d.year), quarter: Number(d.quarter), quantity: Number(d.quantity) },
                }))}
                className="space-y-3 pt-2"
              >
                <div className="space-y-1.5">
                  <Label>Colaborador *</Label>
                  <Select onValueChange={v => setValue("employeeId", Number(v))}>
                    <SelectTrigger data-testid="select-absence-employee"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(employees ?? []).map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Data *</Label>
                    <Input data-testid="input-absence-date" type="date" {...register("date", { required: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantidade</Label>
                    <Input data-testid="input-absence-qty" type="number" min="1" {...register("quantity", { valueAsNumber: true })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Ano</Label>
                    <Input type="number" {...register("year", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trimestre</Label>
                    <Select defaultValue={String(currentQuarter)} onValueChange={v => setValue("quarter", Number(v))}>
                      <SelectTrigger data-testid="select-absence-quarter"><SelectValue /></SelectTrigger>
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
                  <Label>Motivo</Label>
                  <Input data-testid="input-absence-reason" {...register("reason")} placeholder="Opcional..." />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-absence" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Registrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger data-testid="select-year" className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
          <SelectTrigger data-testid="select-quarter" className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">T1</SelectItem>
            <SelectItem value="2">T2</SelectItem>
            <SelectItem value="3">T3</SelectItem>
            <SelectItem value="4">T4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Colaborador</th>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-center font-medium">Qtd.</th>
                <th className="px-4 py-3 text-left font-medium">Motivo</th>
                {canEdit && <th className="px-4 py-3 text-center font-medium">Ação</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(absences ?? []).map(a => (
                <tr key={a.id} data-testid={`row-absence-${a.id}`} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{a.employeeName}</td>
                  <td className="px-4 py-2.5">{a.date}</td>
                  <td className="px-4 py-2.5 text-center font-medium text-destructive">{a.quantity}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.reason ?? "—"}</td>
                  {canEdit && (
                    <td className="px-4 py-2.5 text-center">
                      <Button
                        data-testid={`button-delete-absence-${a.id}`}
                        size="sm" variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: a.id })}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {(!absences || absences.length === 0) && (
                <tr><td colSpan={canEdit ? 5 : 4} className="text-center py-10 text-muted-foreground">Nenhuma falta registrada</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
