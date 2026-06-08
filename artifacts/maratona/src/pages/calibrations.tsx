import { useState, useEffect } from "react";
import { useGetEvents, useGetCalibrations, useGetEventCriteria, useGetEvaluations, useCreateCalibration, getGetCalibrationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { Target, AlertCircle, Building2, SlidersHorizontal, CalendarDays, ChevronsUpDown, Check, Info, Save, CheckCircle } from "lucide-react";
import { cn, formatEventSubtitle } from "@/lib/utils";

const currentYear = new Date().getFullYear();

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

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
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [calScores, setCalScores] = useState<Record<number, string>>({});
  const [calReasons, setCalReasons] = useState<Record<number, string>>({});
  const [savingCritId, setSavingCritId] = useState<number | null>(null);

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

  // Only events that finished all evaluations OR were closed by RH in event management.
  // evaluationProgress is a 0–1 fraction (submitted / total evaluations).
  const calibratableEvents = (events ?? []).filter(
    e => (e.evaluationProgress ?? 0) >= 1 || e.status === "closed" || e.forcedClosed
  );
  const pickedEvent = calibratableEvents.find(e => e.id === selectedEventId);

  // Clear selection if the picked event is no longer calibratable (e.g. reopened by RH)
  useEffect(() => {
    if (selectedEventId && !calibratableEvents.some(e => e.id === selectedEventId)) {
      setSelectedEventId(null);
      setCalScores({});
      setCalReasons({});
    }
  }, [selectedEventId, calibratableEvents]);

  const createMutation = useCreateCalibration({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: calQKey });
        toast({ title: "Calibração registrada" });
        setSavingCritId(null);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Erro", description: e.message, variant: "destructive" });
        setSavingCritId(null);
      },
    },
  });

  // Mutation usada na gravação em lote ("salvar todas") — sem toast por item,
  // para não disparar uma notificação por critério. O resumo é exibido no fim.
  const bulkMutation = useCreateCalibration();
  const [savingAll, setSavingAll] = useState(false);

  function getAreaScores(critId: number) {
    return (evaluations ?? [])
      .filter(e => e.criterionId === critId && e.status === "submitted")
      .map(e => ({ name: e.evaluatorName ?? "Avaliador", score: parseFloat(e.score as unknown as string) }));
  }

  function getAvgScore(critId: number) {
    const scores = getAreaScores(critId).map(s => s.score);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  }

  function getCalibration(critId: number) {
    return (calibrations ?? []).find(c => c.criterionId === critId);
  }

  function saveCalibration(critId: number) {
    const existing = getCalibration(critId);
    const raw = calScores[critId] ?? (existing ? String(parseFloat(existing.calibratedScore as unknown as string)) : "");
    const reason = (calReasons[critId] ?? existing?.calibrationReason ?? "").trim();
    const score = Number(raw);
    if (!raw || isNaN(score) || score < 1 || score > 5) {
      toast({ title: "Nota inválida", description: "Informe uma nota calibrada de 1 a 5.", variant: "destructive" });
      return;
    }
    setSavingCritId(critId);
    const avg = getAvgScore(critId);
    createMutation.mutate({
      data: {
        eventId: selectedEventId!,
        criterionId: critId,
        calibratedScore: score,
        calibrationReason: reason,
        originalAverageScore: avg ?? undefined,
      },
    });
  }

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const pendingCount = selectedEventId
    ? activeCriteria.filter(c => getAvgScore(c.criterionId) != null && !getCalibration(c.criterionId)).length
    : 0;

  // Quantos critérios têm uma nota calibrada preenchida (e válida) pronta para salvar.
  function pendingScore(critId: number) {
    const existing = getCalibration(critId);
    const raw = calScores[critId] ?? (existing ? String(parseFloat(existing.calibratedScore as unknown as string)) : "");
    const score = Number(raw);
    if (!raw || isNaN(score) || score < 1 || score > 5) return null;
    return score;
  }
  const fillableCount = activeCriteria.filter(c => pendingScore(c.criterionId) != null).length;

  // Grava TODAS as calibrações preenchidas de uma vez (a diretoria preenche tudo
  // e salva em um clique, em vez de critério por critério).
  async function saveAllCalibrations() {
    const toSave = activeCriteria
      .map(c => ({ critId: c.criterionId, score: pendingScore(c.criterionId), reason: (calReasons[c.criterionId] ?? getCalibration(c.criterionId)?.calibrationReason ?? "").trim() }))
      .filter((x): x is { critId: number; score: number; reason: string } => x.score != null);
    if (toSave.length === 0) {
      toast({ title: "Nada para salvar", description: "Preencha ao menos uma nota calibrada (1 a 5).", variant: "destructive" });
      return;
    }
    setSavingAll(true);
    let ok = 0;
    const failed: number[] = [];
    for (const x of toSave) {
      try {
        await bulkMutation.mutateAsync({
          data: {
            eventId: selectedEventId!,
            criterionId: x.critId,
            calibratedScore: x.score,
            calibrationReason: x.reason,
            originalAverageScore: getAvgScore(x.critId) ?? undefined,
          },
        });
        ok++;
      } catch {
        failed.push(x.critId);
      }
    }
    setSavingAll(false);
    qc.invalidateQueries({ queryKey: calQKey });
    if (failed.length === 0) {
      toast({ title: `${ok} calibraç${ok === 1 ? "ão salva" : "ões salvas"}` });
    } else {
      toast({ title: `${ok} salva(s), ${failed.length} com erro`, description: "Revise os critérios destacados e tente novamente.", variant: "destructive" });
    }
  }

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Hero panel */}
        <section className="relative">
          <div className="bg-[#191c1e] text-white p-8 skew-x-[-2deg] shadow-[8px_8px_0px_0px_#ccff00]">
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

        {/* Event selector */}
        <section className="bg-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1.5 bg-[#ccff00] border-l-2 border-b-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wider">ETAPA 01</div>
          <Label className="text-xs font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-2 relative">
            <CalendarDays size={16} /> Selecionar Evento
          </Label>

          <div className="w-full max-w-2xl">
            <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={eventPickerOpen}
                  data-testid="select-event"
                  disabled={calibratableEvents.length === 0}
                  className={`w-full min-h-[3.25rem] px-4 py-3 flex items-center justify-between gap-3 text-left border-2 border-[#191c1e] bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#f7f9fb] ${HARD_SHADOW}`}
                >
                  {pickedEvent ? (
                    <span className="flex flex-col min-w-0">
                      <span className="font-black italic uppercase text-sm leading-tight text-[#191c1e] truncate">{pickedEvent.name}</span>
                      {formatEventSubtitle(pickedEvent) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] truncate">{formatEventSubtitle(pickedEvent)}</span>}
                    </span>
                  ) : (
                    <span className="font-bold italic uppercase text-xs tracking-wider text-[#747a60]">
                      {calibratableEvents.length === 0 ? "Nenhum evento pronto para calibração" : "Busque um evento para calibrar..."}
                    </span>
                  )}
                  <ChevronsUpDown size={18} className="shrink-0 text-[#191c1e]" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                <Command className="rounded-none">
                  <CommandInput data-testid="input-event-search" placeholder="Buscar por evento ou cliente..." className="italic" />
                  <CommandList className="max-h-[320px]">
                    <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
                    <CommandGroup>
                      {calibratableEvents.map(ev => (
                        <CommandItem
                          key={ev.id}
                          value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                          data-testid={`option-event-${ev.id}`}
                          onSelect={() => { setSelectedEventId(ev.id); setCalScores({}); setCalReasons({}); setEventPickerOpen(false); }}
                          className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3 items-start"
                        >
                          <Check size={16} className={cn("mt-0.5 shrink-0", selectedEventId === ev.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex flex-col min-w-0">
                            <span className="font-black italic uppercase text-sm leading-tight whitespace-normal">{ev.name}</span>
                            {formatEventSubtitle(ev) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-normal">{formatEventSubtitle(ev)}</span>}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="mt-4 flex items-start gap-2.5 bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
              <Info size={16} className="shrink-0 mt-0.5 text-[#444933]" />
              <p className="text-[11px] md:text-xs font-bold italic uppercase tracking-wide text-[#444933]">
                Apenas eventos com todas as avaliações concluídas ou já fechados pelo RH na gestão de eventos aparecem nesta lista.
              </p>
            </div>
          </div>
        </section>

        {/* Inline calibration */}
        {selectedEventId ? (
          <section className="space-y-5">
            {pickedEvent && (
              <div className="bg-white border-2 border-[#191c1e] p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#e0e3e5] flex items-center justify-center shrink-0">
                    <span className="skew-x-[4deg]"><Target size={20} /></span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black italic uppercase tracking-tight text-[#191c1e] truncate">{pickedEvent.name}</h3>
                    <p className="text-xs font-bold italic uppercase text-[#747a60] truncate">{pickedEvent.clientName}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block shrink-0 ${statusChip(pickedEvent.status).cls}`}>
                  <span className="inline-block skew-x-[8deg]">{statusChip(pickedEvent.status).label}</span>
                </span>
              </div>
            )}

            {activeCriteria.length === 0 && (
              <div className="bg-white border-2 border-[#191c1e] text-center py-16 italic uppercase font-bold text-[#747a60]">
                Nenhum critério ativo para este evento.
              </div>
            )}

            {activeCriteria.length > 0 && (
              <div className="sticky top-2 z-20 bg-[#191c1e] text-white border-2 border-[#191c1e] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[6px_6px_0px_0px_#ccff00]">
                <div className="flex items-center gap-3 min-w-0">
                  <SlidersHorizontal size={20} className="text-[#ccff00] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-black italic uppercase tracking-tight leading-tight">Salvar todas de uma vez</p>
                    <p className="text-[11px] font-bold italic uppercase text-white/60 leading-tight">
                      {fillableCount > 0 ? `${fillableCount} critério(s) com nota preenchida` : "Preencha as notas calibradas (1 a 5) abaixo"}
                    </p>
                  </div>
                </div>
                <button
                  data-testid="button-save-all-cal"
                  type="button"
                  disabled={savingAll || fillableCount === 0}
                  onClick={saveAllCalibrations}
                  className="bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-6 py-3 font-black text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all enabled:hover:bg-white enabled:hover:border-white"
                >
                  <Save size={16} /> {savingAll ? "Salvando..." : `Salvar Todas${fillableCount > 0 ? ` (${fillableCount})` : ""}`}
                </button>
              </div>
            )}

            {activeCriteria.map(c => {
              const areaScores = getAreaScores(c.criterionId);
              const avg = getAvgScore(c.criterionId);
              const cal = getCalibration(c.criterionId);
              const scoreVal = calScores[c.criterionId] ?? (cal ? String(parseFloat(cal.calibratedScore as unknown as string)) : "");
              const reasonVal = calReasons[c.criterionId] ?? (cal?.calibrationReason ?? "");
              const isSaving = savingCritId === c.criterionId && createMutation.isPending;

              return (
                <article key={c.criterionId} data-testid={`row-cal-${c.criterionId}`} className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                  {/* Criterion header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                    <div className="min-w-0">
                      <div className="font-black italic uppercase tracking-tight text-[#191c1e]">{c.criterionName}</div>
                      <div className="text-[11px] font-bold italic uppercase text-[#747a60] mt-0.5">Peso {c.weightOverride ?? c.originalWeight ?? 0}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.responsibleAreaName && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#444933] bg-[#eceef0] border-2 border-[#191c1e] px-2 py-1 skew-x-[-6deg]">
                          <span className="inline-flex items-center gap-1.5 skew-x-[6deg]"><Building2 size={12} /> {c.responsibleAreaName}</span>
                        </span>
                      )}
                      {cal ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#506600] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1">
                          <CheckCircle size={12} /> Calibrado
                        </span>
                      ) : avg != null ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ffb5a0] text-[#3b0900] border-2 border-[#191c1e] px-2 py-1">Pendente</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y-2 lg:divide-y-0 lg:divide-x-2 divide-[#191c1e]">
                    {/* Left: scores from the area */}
                    <div className="p-5">
                      <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-1.5">
                        <Building2 size={13} /> Notas da Área
                      </p>
                      {areaScores.length > 0 ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {areaScores.map((s, i) => (
                              <div key={i} className="flex items-center gap-2 border-2 border-[#191c1e] bg-white pl-2.5 pr-1.5 py-1">
                                <span className="text-[11px] font-bold italic uppercase text-[#444933] truncate max-w-[140px]">{s.name}</span>
                                <span className="text-sm font-black italic text-[#191c1e] bg-[#eceef0] border-l-2 border-[#191c1e] px-2 leading-6">{s.score.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-[11px] font-bold uppercase italic tracking-wider text-[#747a60]">Média Original</span>
                            <span className={`text-2xl font-black italic ${cal ? "text-[#c4c9ac] line-through" : "text-[#191c1e]"}`}>{avg?.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm italic text-[#747a60] font-bold uppercase">Nenhuma nota enviada pela área para este critério.</p>
                      )}
                    </div>

                    {/* Right: inline calibration */}
                    <div className="p-5 bg-[#fbfcfd]">
                      <p className="text-[11px] font-bold uppercase italic tracking-wider text-[#444933] mb-3 flex items-center gap-1.5">
                        <SlidersHorizontal size={13} /> Calibração
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                        <div className="sm:w-28 shrink-0">
                          <Label className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Nota (1–5)</Label>
                          <Input
                            data-testid={`input-cal-score-${c.criterionId}`}
                            type="number"
                            min="1" max="5" step="1"
                            value={scoreVal}
                            onChange={e => setCalScores(prev => ({ ...prev, [c.criterionId]: e.target.value }))}
                            placeholder="—"
                            className="h-11 mt-1 rounded-none border-2 border-[#191c1e] text-lg font-black italic"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Justificativa</Label>
                          <Textarea
                            data-testid={`input-cal-reason-${c.criterionId}`}
                            value={reasonVal}
                            onChange={e => setCalReasons(prev => ({ ...prev, [c.criterionId]: e.target.value }))}
                            placeholder="Por que a nota original foi alterada?"
                            rows={2}
                            className="mt-1 rounded-none border-2 border-[#191c1e] resize-none"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <button
                          data-testid={`button-save-cal-${c.criterionId}`}
                          type="button"
                          disabled={isSaving || savingAll}
                          onClick={() => saveCalibration(c.criterionId)}
                          className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} transition-all enabled:hover:shadow-[2px_2px_0px_0px_#191c1e] enabled:hover:translate-x-[2px] enabled:hover:translate-y-[2px]`}
                        >
                          <Save size={16} /> {isSaving ? "Salvando..." : cal ? "Atualizar Calibração" : "Salvar Calibração"}
                        </button>
                      </div>
                      {cal && (
                        <div className="mt-3 text-xs italic text-[#444933] bg-[#f2f4f6] border-l-4 border-[#ff5722] p-3 relative">
                          <AlertCircle size={12} className="text-[#ff5722] absolute top-2 right-2" />
                          <span className="block pr-4">Calibração atual: <strong className="not-italic">{parseFloat(cal.calibratedScore as unknown as string).toFixed(2)}</strong>{cal.calibratedByName ? ` · por ${cal.calibratedByName}` : ""}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white border-2 border-dashed border-[#191c1e]">
            <div className="w-16 h-16 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#eceef0] flex items-center justify-center mb-5">
              <span className="skew-x-[4deg]"><Target className="text-[#747a60]" size={32} /></span>
            </div>
            <h2 className="text-2xl font-black italic uppercase tracking-tight mb-2 text-[#191c1e]">Área de Calibração</h2>
            <p className="text-[#747a60] italic max-w-md">Selecione um evento no campo acima para visualizar as notas da área e calibrar cada critério diretamente.</p>
          </div>
        )}
      </div>
    </div>
  );
}
