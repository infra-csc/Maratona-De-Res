import { useState } from "react";
import { useGetEvents, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useCreateCalibration, getGetCalibrationsQueryKey } from "@workspace/api-client-react";
import type { CalibrationInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Target, Plus, AlertCircle, Building2, ArrowRight, SlidersHorizontal, CalendarDays } from "lucide-react";

const currentYear = new Date().getFullYear();

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function statusChip(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Em avaliação", cls: "bg-[#ccff00] text-[#161e00]" },
    closed: { label: "Fechado", cls: "bg-[#d8dadc] text-[#444933]" },
    calibration: { label: "Calibração", cls: "bg-[#ff5722] text-white" },
    calibrated: { label: "Calibrado", cls: "bg-[#506600] text-[#ccff00]" },
    computed: { label: "Computado", cls: "bg-[#191c1e] text-[#ccff00]" },
    pending: { label: "Pendente", cls: "bg-[#ffb5a0] text-[#3b0900]" },
  };
  return map[status] ?? { label: status, cls: "bg-[#d8dadc] text-[#444933]" };
}

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

  const pendingCount = selectedEventId
    ? activeCriteria.filter(c => getAvgScore(c.criterionId) != null && !getCalibration(c.criterionId)).length
    : 0;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Hero panel */}
        <section className="relative">
          <div className={`bg-[#191c1e] text-white p-8 skew-x-[-2deg] shadow-[8px_8px_0px_0px_#ccff00]`}>
            <div className="skew-x-[2deg] flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h1 data-testid="text-page-title" className="text-3xl md:text-5xl italic uppercase font-black tracking-tighter leading-none mb-3 flex items-center gap-3">
                  <Target size={36} className="text-[#ccff00]" /> Calibrações Técnicas
                </h1>
                <p className="text-base md:text-lg italic text-white/70 max-w-2xl">
                  Ajuste técnico de notas aplicadas aos critérios do evento. A precisão é a diferença entre um resultado justo e um campeão.
                </p>
              </div>
              {selectedEventId && pendingCount > 0 && (
                <div className="bg-[#ccff00] text-[#161e00] p-4 border-2 border-white skew-x-[-6deg] shrink-0">
                  <div className="skew-x-[6deg] flex items-center gap-3">
                    <SlidersHorizontal size={32} />
                    <div>
                      <p className="text-xs font-bold uppercase italic tracking-wider">Ações Pendentes</p>
                      <p className="text-4xl font-black italic leading-none mt-1">{pendingCount}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Event selector + new calibration */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-full bg-[#eceef0] opacity-30 skew-x-[-12deg] translate-x-16" />
            <Label className="text-xs font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-2 relative">
              <CalendarDays size={16} /> Selecionar Evento
            </Label>
            <Select
              value={selectedEventId ? String(selectedEventId) : ""}
              onValueChange={v => setSelectedEventId(Number(v))}
            >
              <SelectTrigger data-testid="select-event" className="h-12 rounded-none border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic uppercase text-sm tracking-wider focus:ring-0 relative">
                <SelectValue placeholder="Busque um evento para calibrar..." />
              </SelectTrigger>
              <SelectContent>
                {(events ?? []).map(ev => (
                  <SelectItem key={ev.id} value={String(ev.id)}>{ev.name} — {ev.clientName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-4 bg-white border-2 border-[#191c1e] p-6 flex flex-col justify-between">
            <h3 className="text-xs font-bold uppercase italic tracking-wider text-[#444933] mb-4">Nova Calibração</h3>
            {selectedEventId ? (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button
                    data-testid="button-add-calibration"
                    className={`w-full bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <Plus size={18} /> Nova Calibração
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                  <DialogHeader>
                    <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Registrar Calibração</DialogTitle>
                  </DialogHeader>
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
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Critério <span className="text-[#ba1a1a]">*</span></Label>
                      <Select onValueChange={v => setValue("criterionId", Number(v))}>
                        <SelectTrigger data-testid="select-cal-criterion" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
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
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nota Calibrada Final <span className="text-[#ba1a1a]">*</span></Label>
                      <Input
                        data-testid="input-calibrated-score"
                        type="number"
                        min="1" max="5" step="1"
                        placeholder="Nota de 1 a 5"
                        className="h-11 rounded-none border-2 border-[#191c1e]"
                        {...register("calibratedScore", { required: true, valueAsNumber: true })}
                      />
                      <p className="text-xs text-[#747a60] italic">Esta nota substituirá a média das avaliações neste critério.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Justificativa da Calibração <span className="text-[#ba1a1a]">*</span></Label>
                      <Input
                        data-testid="input-calibration-reason"
                        {...register("calibrationReason", { required: true })}
                        placeholder="Por que a nota original foi alterada?"
                        className="h-11 rounded-none border-2 border-[#191c1e]"
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                      <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setOpen(false)}>Cancelar</Button>
                      <button
                        data-testid="button-submit-calibration"
                        type="submit"
                        disabled={createMutation.isPending}
                        className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                      >
                        {createMutation.isPending ? "Salvando..." : "Confirmar Calibração"}
                      </button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <p className="text-sm italic text-[#747a60] font-bold uppercase">Selecione um evento para iniciar.</p>
            )}
          </div>
        </section>

        {/* Comparison table */}
        {selectedEventId ? (
          <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
            {selectedEvent && (
              <div className="bg-[#f2f4f6] p-5 border-b-2 border-[#191c1e] flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#e0e3e5] flex items-center justify-center shrink-0">
                    <span className="skew-x-[4deg]"><Target size={20} /></span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black italic uppercase tracking-tight text-[#191c1e] truncate">{selectedEvent.name}</h3>
                    <p className="text-xs font-bold italic uppercase text-[#747a60] truncate">{selectedEvent.clientName}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block ${statusChip(selectedEvent.status).cls}`}>
                  <span className="inline-block skew-x-[8deg]">{statusChip(selectedEvent.status).label}</span>
                </span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#191c1e] text-[#ccff00]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic tracking-wider w-[28%]">Critério</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic tracking-wider">Área Responsável</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic tracking-wider text-center">Nota Média Original</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic tracking-wider text-center">Nota Calibrada</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic tracking-wider w-[28%]">Justificativa</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {activeCriteria.map(c => {
                    const avg = getAvgScore(c.criterionId);
                    const cal = getCalibration(c.criterionId);
                    const hasCalibration = !!cal;

                    return (
                      <tr key={c.criterionId} data-testid={`row-cal-${c.criterionId}`} className="hover:bg-[#f2f4f6] transition-all hover:translate-x-1 group">
                        <td className="px-6 py-4">
                          <div className="font-bold italic text-[#191c1e]">{c.criterionName}</div>
                          <div className="text-xs font-bold italic uppercase text-[#747a60] mt-1">Peso {c.weightOverride ?? c.originalWeight ?? 0}</div>
                        </td>
                        <td className="px-6 py-4">
                          {c.responsibleAreaName ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-1 skew-x-[-6deg]">
                              <span className="inline-flex items-center gap-1.5 skew-x-[6deg]"><Building2 size={12} /> {c.responsibleAreaName}</span>
                            </span>
                          ) : (
                            <span className="text-[#c4c9ac]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {avg != null ? (
                            <span className={`text-lg font-black italic ${hasCalibration ? "text-[#c4c9ac] line-through" : "text-[#191c1e]"}`}>
                              {avg.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#c4c9ac]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {cal ? (
                            <div className="flex items-center justify-center gap-2">
                              <ArrowRight size={18} className="text-[#506600]" />
                              <div className="flex flex-col items-center justify-center bg-[#ccff00] border-2 border-[#191c1e] px-3 py-1 skew-x-[-8deg]">
                                <span className="skew-x-[8deg] text-xl font-black italic text-[#191c1e] leading-none">
                                  {parseFloat(cal.calibratedScore as unknown as string).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center"><span className="text-[#c4c9ac]">—</span></div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {cal ? (
                            <div className="text-xs italic text-[#444933] bg-[#f2f4f6] border-l-4 border-[#ff5722] p-3 relative">
                              <AlertCircle size={12} className="text-[#ff5722] absolute top-2 right-2" />
                              <span className="block pr-4">"{cal.calibrationReason}"</span>
                            </div>
                          ) : (
                            <span className="text-[#c4c9ac]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {activeCriteria.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum critério ativo para este evento.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white border-2 border-dashed border-[#191c1e]">
            <div className="w-16 h-16 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#eceef0] flex items-center justify-center mb-5">
              <span className="skew-x-[4deg]"><Target className="text-[#747a60]" size={32} /></span>
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight mb-2 text-[#191c1e]">Área de Calibração</h2>
            <p className="text-[#747a60] italic max-w-md">Selecione um evento no campo acima para visualizar as médias originais e aplicar notas calibradas por critério.</p>
          </div>
        )}
      </div>
    </div>
  );
}
