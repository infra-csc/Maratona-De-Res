import { useState } from "react";
import { useGetEvents, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useCreateCalibration, getGetCalibrationsQueryKey } from "@workspace/api-client-react";
import type { CalibrationInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Target, Plus, AlertCircle, Building2, CheckCircle2, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

const currentYear = new Date().getFullYear();

export default function CalibrationsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const { data: events } = useGetEvents({ year: currentYear });
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

  const { register, handleSubmit, reset, setValue } = useForm<CalibrationInput & { criterionId: number }>();

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

  function getAvgScore(critId: number) {
    const scores = (evaluations ?? [])
      .filter(e => e.criterionId === critId && e.status === "submitted")
      .map(e => parseFloat(e.score as unknown as string));
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  function getCalibration(critId: number) {
    return (calibrations ?? []).find(c => c.criterionId === critId);
  }

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const selectedEvent = events?.find(e => e.id === selectedEventId);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Target size={28} className="text-primary" /> Calibrações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Ajuste técnico de notas aplicadas aos critérios do evento.</p>
        </div>
        {selectedEventId && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-calibration" className="shadow-sm">
                <Plus size={16} className="mr-2" /> Nova Calibração
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-xl">Registrar Calibração</DialogTitle></DialogHeader>
              <form
                onSubmit={handleSubmit(d => {
                  const critId = Number(d.criterionId);
                  const avg = getAvgScore(critId);
                  createMutation.mutate({
                    data: {
                      eventId: selectedEventId,
                      criterionId: critId,
                      calibratedScore: Number(d.calibratedScore),
                      calibrationReason: d.calibrationReason,
                      originalAverageScore: avg ?? undefined,
                    },
                  });
                })}
                className="space-y-5 pt-4"
              >
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Critério <span className="text-destructive">*</span></Label>
                  <Select onValueChange={v => setValue("criterionId", Number(v))}>
                    <SelectTrigger data-testid="select-cal-criterion" className="h-11">
                      <SelectValue placeholder="Selecione um critério..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCriteria.map(c => (
                        <SelectItem key={c.criterionId} value={String(c.criterionId)}>{c.criterionName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Nota Calibrada Final <span className="text-destructive">*</span></Label>
                  <Input
                    data-testid="input-calibrated-score"
                    type="number"
                    min="1" max="5" step="1"
                    placeholder="Nota de 1 a 5"
                    className="h-11"
                    {...register("calibratedScore", { required: true, valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">Esta nota substituirá a média das avaliações neste critério.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Justificativa da Calibração <span className="text-destructive">*</span></Label>
                  <Input
                    data-testid="input-calibration-reason"
                    {...register("calibrationReason", { required: true })}
                    placeholder="Por que a nota original foi alterada?"
                    className="h-11"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-calibration" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Salvando..." : "Confirmar Calibração"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm w-full max-w-xl">
        <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Selecionar Evento</Label>
        <Select
          value={selectedEventId ? String(selectedEventId) : ""}
          onValueChange={v => setSelectedEventId(Number(v))}
        >
          <SelectTrigger data-testid="select-event" className="h-11 font-medium bg-slate-50 border-transparent hover:bg-slate-100 transition-colors">
            <SelectValue placeholder="Busque um evento para calibrar..." />
          </SelectTrigger>
          <SelectContent>
            {(events ?? []).map(ev => (
              <SelectItem key={ev.id} value={String(ev.id)}>{ev.name} — {ev.clientName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedEventId ? (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          {selectedEvent && (
            <div className="bg-slate-50 p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">{selectedEvent.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{selectedEvent.clientName}</p>
              </div>
              <StatusBadge status={selectedEvent.status} />
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs w-[30%]">Critério</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Área Responsável</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Nota Média Original</th>
                  <th className="px-6 py-4 text-center font-semibold text-primary uppercase tracking-wider text-xs bg-primary/5">Nota Calibrada</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs w-[30%]">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeCriteria.map(c => {
                  const avg = getAvgScore(c.criterionId);
                  const cal = getCalibration(c.criterionId);
                  const hasCalibration = !!cal;
                  
                  return (
                    <tr key={c.criterionId} data-testid={`row-cal-${c.criterionId}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{c.criterionName}</div>
                        <div className="text-xs text-slate-400 mt-1">Peso {c.weightOverride ?? c.originalWeight ?? 0}</div>
                      </td>
                      <td className="px-6 py-4">
                        {c.responsibleAreaName ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                            <Building2 size={10} /> {c.responsibleAreaName}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {avg != null ? (
                          <span className={`text-base font-black ${hasCalibration ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                            {avg.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center bg-primary/5">
                        {cal ? (
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-black text-xl text-primary leading-none">
                              {parseFloat(cal.calibratedScore as unknown as string).toFixed(2)}
                            </span>
                            <span className="text-[10px] font-bold text-primary/60 uppercase mt-1">Aplicada</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {cal ? (
                          <div className="text-xs text-slate-600 bg-amber-50 border border-amber-100 p-2 rounded-lg relative">
                            <AlertCircle size={12} className="text-amber-500 absolute top-2 right-2" />
                            <span className="block pr-4 italic">"{cal.calibrationReason}"</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {activeCriteria.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-16 text-muted-foreground text-base">Nenhum critério ativo para este evento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Target className="text-slate-300" size={32} />
          </div>
          <h2 className="text-xl font-semibold mb-2 text-slate-700">Área de Calibração</h2>
          <p className="text-muted-foreground max-w-md">Selecione um evento no campo acima para visualizar as médias originais e aplicar notas calibradas por critério.</p>
        </div>
      )}
    </div>
  );
}
