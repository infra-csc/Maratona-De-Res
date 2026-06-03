import { useState } from "react";
import { useGetEvents, useGetCalibrations, useGetEventParticipants, useGetEventCriteria, useGetEvaluations, useCreateCalibration, getGetCalibrationsQueryKey } from "@workspace/api-client-react";
import type { CalibrationInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Target, Plus } from "lucide-react";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function CalibrationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const { data: events } = useGetEvents({ year: currentYear });
  const { data: participants } = useGetEventParticipants(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["ep", selectedEventId] as unknown[] },
  });
  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["ec", selectedEventId] as unknown[] },
  });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: ["evals", selectedEventId] as unknown[] } }
  );
  const calQKey = getGetCalibrationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: calibrations } = useGetCalibrations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: calQKey } }
  );

  const { register, handleSubmit, reset, setValue, watch } = useForm<CalibrationInput & { employeeId: number; criterionId: number }>();

  const createMutation = useCreateCalibration({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: calQKey });
        toast({ title: "Calibração registrada" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  function getAvgScore(empId: number, critId: number) {
    const scores = (evaluations ?? [])
      .filter(e => e.employeeId === empId && e.criterionId === critId && e.status === "submitted")
      .map(e => parseFloat(e.score as unknown as string));
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  function getCalibration(empId: number, critId: number) {
    return (calibrations ?? []).find(c => c.employeeId === empId && c.criterionId === critId);
  }

  const activeCriteria = (criteria ?? []).filter(c => c.active);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <Target size={22} className="text-primary" /> Calibrações
          </h1>
          <p className="text-muted-foreground text-sm">Ajuste as notas por responsável de área</p>
        </div>
        {selectedEventId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-calibration" size="sm">
                <Plus size={16} className="mr-1.5" /> Nova Calibração
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Registrar Calibração</DialogTitle></DialogHeader>
              <form
                onSubmit={handleSubmit(d => createMutation.mutate({
                  data: {
                    eventId: selectedEventId,
                    employeeId: Number(d.employeeId),
                    criterionId: Number(d.criterionId),
                    calibratedScore: Number(d.calibratedScore),
                    calibrationReason: d.calibrationReason,
                  },
                }))}
                className="space-y-3 pt-2"
              >
                <div className="space-y-1.5">
                  <Label>Colaborador</Label>
                  <Select onValueChange={v => setValue("employeeId", Number(v))}>
                    <SelectTrigger data-testid="select-cal-employee"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(participants ?? []).map(p => (
                        <SelectItem key={p.employeeId} value={String(p.employeeId)}>{p.employeeName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Critério</Label>
                  <Select onValueChange={v => setValue("criterionId", Number(v))}>
                    <SelectTrigger data-testid="select-cal-criterion"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {activeCriteria.map(c => (
                        <SelectItem key={c.criterionId} value={String(c.criterionId)}>{c.criterionName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nota Calibrada (0-5)</Label>
                  <Input
                    data-testid="input-calibrated-score"
                    type="number"
                    min="0" max="5" step="0.1"
                    {...register("calibratedScore", { required: true, valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Justificativa *</Label>
                  <Input
                    data-testid="input-calibration-reason"
                    {...register("calibrationReason", { required: true })}
                    placeholder="Motivo da calibração..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-calibration" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Salvar Calibração"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Select
        value={selectedEventId ? String(selectedEventId) : ""}
        onValueChange={v => setSelectedEventId(Number(v))}
      >
        <SelectTrigger data-testid="select-event" className="w-80">
          <SelectValue placeholder="Selecione um evento..." />
        </SelectTrigger>
        <SelectContent>
          {(events ?? []).map(ev => (
            <SelectItem key={ev.id} value={String(ev.id)}>{ev.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedEventId && (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Colaborador</th>
                <th className="px-4 py-3 text-left font-medium">Critério</th>
                <th className="px-4 py-3 text-center font-medium">Nota Média</th>
                <th className="px-4 py-3 text-center font-medium">Nota Calibrada</th>
                <th className="px-4 py-3 text-left font-medium">Justificativa</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(participants ?? []).flatMap(p =>
                activeCriteria.map(c => {
                  const avg = getAvgScore(p.employeeId, c.criterionId);
                  const cal = getCalibration(p.employeeId, c.criterionId);
                  return (
                    <tr key={`${p.employeeId}-${c.criterionId}`} data-testid={`row-cal-${p.employeeId}-${c.criterionId}`} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{p.employeeName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.criterionName}</td>
                      <td className="px-4 py-2.5 text-center">{avg != null ? avg.toFixed(2) : "—"}</td>
                      <td className="px-4 py-2.5 text-center">
                        {cal ? (
                          <span className="font-bold text-primary">{parseFloat(cal.calibratedScore as unknown as string).toFixed(2)}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-48">{cal?.calibrationReason ?? "—"}</td>
                    </tr>
                  );
                })
              )}
              {(!participants || participants.length === 0) && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum participante</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
