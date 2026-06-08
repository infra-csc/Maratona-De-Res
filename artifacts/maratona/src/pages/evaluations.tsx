import { useState } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useGetEventResult, useCreateEvaluation, useSubmitEvaluation, useReleaseEventFeedback, getGetEvaluationsQueryKey, exportPendingEvaluations } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Send, Users, MessageSquareShare, Download, Calendar, MapPin, Building2, Save, Flag, Target, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function ScoreButton({ score, current, onClick, disabled, label }: { score: number, current: number, onClick: () => void, disabled: boolean, label: string }) {
  const isSelected = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-2 border-[#191c1e] p-3 md:p-4 flex flex-col items-center gap-1.5 transition-all w-full",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 active:translate-y-0",
        isSelected
          ? "bg-[#ccff00] text-[#161e00]"
          : "bg-white text-[#191c1e]"
      )}
    >
      <span className="text-2xl italic font-black">{score}</span>
      <span className="text-[10px] leading-tight text-center font-bold uppercase italic">{label}</span>
    </button>
  );
}

export default function EvaluationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});

  const { data: events } = useGetEvents({ year: currentYear, quarter: currentQuarter, status: "open" });

  const { data: participants } = useGetEventParticipants(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-participants", selectedEventId] as unknown[] },
  });

  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-criteria", selectedEventId] as unknown[] },
  });

  const evalsQKey = getGetEvaluationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: evalsQKey } }
  );

  const { data: eventResult } = useGetEventResult(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-result-eval", selectedEventId] as unknown[] },
  });

  const createMutation = useCreateEvaluation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: evalsQKey }),
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const submitMutation = useSubmitEvaluation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: evalsQKey });
        toast({ title: "Avaliação submetida com sucesso" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao submeter", description: e.message, variant: "destructive" }),
    },
  });

  const releaseMutation = useReleaseEventFeedback({
    mutation: {
      onSuccess: () => toast({ title: "Feedback liberado para a equipe" }),
      onError: (e: { message?: string }) => toast({ title: "Erro ao liberar feedback", description: e.message, variant: "destructive" }),
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const openEvents = (events ?? []).filter(e => e.status === "open");
  const canRelease = user && ["admin", "rh", "diretoria"].includes(user.role);
  const eventComplete = eventResult?.isComplete ?? false;
  const feedbackReleased = eventResult?.feedbackReleased ?? false;

  const currentEvent = events?.find(e => e.id === selectedEventId);
  const criteriaLocked = currentEvent ? !currentEvent.criteriaConfirmed : false;

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function currentScore(criterionId: number) {
    if (scores[criterionId] != null) return scores[criterionId];
    const ev = getEval(criterionId);
    return ev ? parseFloat(ev.score as unknown as string) : 0;
  }

  function handleSaveDraft(criterionId: number) {
    if (!selectedEventId) return;
    const score = currentScore(criterionId);
    if (score === 0) return;

    const comment = comments[criterionId] ?? getEval(criterionId)?.comments ?? "";
    if (score < 3 && (!comment || comment.trim().length === 0)) {
      toast({ title: "Comentário obrigatório", description: "Notas abaixo de 3 exigem uma justificativa.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ data: { eventId: selectedEventId, criterionId, score, comments: comment || undefined } });
  }

  function handleScoreClick(criterionId: number, score: number) {
    setScores(s => ({ ...s, [criterionId]: score }));
  }

  function handleSubmitAll() {
    const myDrafts = (evaluations ?? []).filter(e => e.evaluatorUserId === user?.id && e.status === "draft");
    if (myDrafts.length === 0) {
      toast({ title: "Nenhuma avaliação pendente para submeter" });
      return;
    }
    myDrafts.forEach(e => submitMutation.mutate({ id: e.id }));
  }

  const allEvaled = activeCriteria.length > 0 && activeCriteria.every(c => {
    const ev = getEval(c.criterionId);
    return ev && ev.status === "submitted";
  });
  const hasDrafts = activeCriteria.some(c => getEval(c.criterionId)?.status === "draft");

  const completedCount = activeCriteria.filter(c => {
    const ev = getEval(c.criterionId);
    return ev && (ev.status === "submitted" || ev.status === "draft");
  }).length;

  const progressPct = activeCriteria.length ? (completedCount / activeCriteria.length) * 100 : 0;

  async function handleExportPending() {
    try {
      const data = await exportPendingEvaluations();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const labels = {
    1: "Crítico",
    2: "Abaixo do esperado",
    3: "Atendeu minimamente",
    4: "Atendeu bem",
    5: "Excelência"
  };

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">Central de Avaliações</h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2">Mantenha o ritmo. Avalie a sprint e impulsione a equipe.</p>
          </div>
          <button
            data-testid="button-export-pending"
            onClick={handleExportPending}
            className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          >
            <Download size={18} /> Exportar Pendentes
          </button>
        </section>

        {/* STEP 01 — Selecionar Evento */}
        <section className="bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1.5 bg-[#ccff00] border-l-2 border-b-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wider">ETAPA 01</div>
          <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight mb-4">Selecionar Evento</h3>
          <div className="w-full max-w-md">
            <Select
              value={selectedEventId ? String(selectedEventId) : ""}
              onValueChange={v => { setSelectedEventId(Number(v)); setScores({}); setComments({}); }}
            >
              <SelectTrigger data-testid="select-event" className="h-12 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider focus:ring-0">
                <SelectValue placeholder="Selecione um evento para avaliar..." />
              </SelectTrigger>
              <SelectContent>
                {openEvents.map(ev => (
                  <SelectItem key={ev.id} value={String(ev.id)}>{ev.name} — {ev.clientName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {!selectedEventId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-[#191c1e] bg-white">
            <div className="w-16 h-16 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center mb-4 skew-x-[-6deg]">
              <CheckCircle className="text-[#161e00] skew-x-[6deg]" size={32} />
            </div>
            <h2 className="text-2xl italic uppercase font-black tracking-tight mb-2">Pronto para avaliar</h2>
            <p className="text-[#444933] italic max-w-md">Selecione um evento no menu acima para iniciar ou continuar a avaliação da equipe responsável.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Header Card */}
            {currentEvent && (
              <section className={`bg-[#191c1e] text-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden ${HARD_SHADOW}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Users size={120} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-[#ccff00] text-[#161e00] px-3 py-1 border-2 border-[#ccff00] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                        <span className="inline-block skew-x-[8deg]">Aberto</span>
                      </span>
                      <span className="bg-transparent text-white px-3 py-1 border-2 border-white/30 font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                        <span className="inline-block skew-x-[8deg]">T{currentEvent.quarter}/{currentEvent.year}</span>
                      </span>
                    </div>
                    <h2 className="text-3xl md:text-4xl italic uppercase font-black tracking-tighter leading-none mb-1">{currentEvent.name}</h2>
                    <p className="text-[#ccff00] font-bold italic uppercase text-lg">{currentEvent.clientName}</p>

                    <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-white/70 italic">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{new Date(currentEvent.startDate).toLocaleDateString('pt-BR')} — {new Date(currentEvent.endDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{currentEvent.city}, {currentEvent.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>{currentEvent.participantCount} participantes</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <div className="bg-black/30 border-2 border-white/20 p-4 w-full md:w-64">
                      <p className="text-xs text-white/80 font-bold italic uppercase mb-2">Progresso Geral (Todo o time)</p>
                      <div className="flex items-center justify-between mb-1 text-xs italic font-bold">
                        <span>{currentEvent.evaluationProgress}% Concluído</span>
                      </div>
                      <div className="w-full bg-black/40 border border-white/20 h-2.5">
                        <div className="bg-[#ccff00] h-full transition-[width]" style={{ width: `${currentEvent.evaluationProgress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Criteria Column / Evaluation Form */}
              <div className="space-y-4">
                <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight px-1">Critérios de Avaliação</h3>

                {criteriaLocked ? (
                  <div data-testid="notice-criteria-locked" className="text-center py-14 bg-[#fff4e5] border-2 border-[#191c1e] px-6">
                    <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#ff5722] text-white flex items-center justify-center mx-auto mb-4">
                      <Lock size={26} />
                    </div>
                    <h2 className="text-2xl italic uppercase font-black tracking-tight text-[#b02f00] mb-1">Avaliação bloqueada</h2>
                    <p className="text-sm md:text-base italic text-[#444933] max-w-md mx-auto">Os critérios deste evento ainda não foram confirmados pelo RH. Aguarde a liberação para iniciar a avaliação da equipe.</p>
                  </div>
                ) : activeCriteria.length === 0 ? (
                  <div className="text-center py-12 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60]">Nenhum critério ativo neste evento.</div>
                ) : (
                  <div className={`bg-white border-2 border-[#191c1e] p-6 md:p-8 ${HARD_SHADOW}`}>
                    <div className="space-y-10">
                      {activeCriteria.map((c, index) => {
                        const ev = getEval(c.criterionId);
                        const submitted = ev?.status === "submitted";
                        const isDraft = ev?.status === "draft";
                        const score = currentScore(c.criterionId);
                        const comment = comments[c.criterionId] ?? ev?.comments ?? "";

                        // Show requirement alert if score < 3 and comment is empty
                        const needsComment = score > 0 && score < 3 && (!comment || comment.trim().length === 0);

                        return (
                          <div key={c.criterionId} className={cn("criterion-row border-l-4 pl-6 py-2", submitted ? "border-[#506600]" : isDraft ? "border-[#ff5722]" : score > 0 ? "border-[#ccff00]" : "border-[#191c1e]/20")}>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="bg-[#e6e8ea] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-black italic uppercase">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
                                  {c.responsibleAreaName && (
                                    <span className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <Building2 size={11} /> {c.responsibleAreaName}
                                    </span>
                                  )}
                                  {submitted && (
                                    <span className="bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <CheckCircle size={12} /> Submetido
                                    </span>
                                  )}
                                  {isDraft && (
                                    <span className="bg-[#ffdbd1] text-[#862200] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <Clock size={12} /> Rascunho
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">{index + 1}. {c.criterionName}</h4>
                                <p className="text-sm text-[#444933] italic mt-1 leading-relaxed">
                                  Avalie o desempenho da equipe considerando este critério específico para o evento atual.
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-bold italic uppercase text-[#747a60]">Ritmo Atual</p>
                                <p className="text-[40px] leading-none italic font-black">{score > 0 ? score : "-"}</p>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="grid grid-cols-5 gap-2 md:gap-3">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <ScoreButton
                                    key={val}
                                    score={val}
                                    current={score}
                                    label={labels[val as keyof typeof labels]}
                                    onClick={() => handleScoreClick(c.criterionId, val)}
                                    disabled={submitted}
                                  />
                                ))}
                              </div>
                            </div>

                            {!submitted && (
                              <div className={cn("mt-4 border-2 p-4", needsComment ? "border-[#ba1a1a] bg-[#ffdad6]/20" : "border-[#191c1e] bg-[#f2f4f6]")}>
                                <label className="text-xs font-black italic uppercase flex items-center gap-2 mb-2">
                                  Justificativa / Feedback
                                  {score > 0 && score < 3 && <span className="text-[10px] text-white bg-[#ba1a1a] px-2 py-0.5 font-bold italic uppercase">Obrigatório para nota {score}</span>}
                                </label>
                                <Textarea
                                  placeholder={score > 0 && score < 3 ? "Explique os motivos que levaram a esta nota baixa..." : "Comentários opcionais para a equipe (serão vistos anonimamente)..."}
                                  value={comment}
                                  onChange={e => setComments(s => ({ ...s, [c.criterionId]: e.target.value }))}
                                  className={cn("bg-white rounded-none border-2 resize-y min-h-24 italic focus-visible:ring-0", needsComment ? "border-[#ba1a1a]" : "border-[#191c1e]")}
                                />

                                <div className="flex justify-end pt-3">
                                  <button
                                    onClick={() => handleSaveDraft(c.criterionId)}
                                    disabled={score === 0 || needsComment}
                                    className="bg-white border-2 border-[#191c1e] px-4 py-2 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                                  >
                                    <Save size={14} />
                                    {isDraft ? "Atualizar Rascunho" : "Salvar Rascunho"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {submitted && comment && (
                              <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 mt-4">
                                <p className="text-xs font-black italic uppercase mb-1">Seu Feedback:</p>
                                <p className="text-sm text-[#444933] italic">"{comment}"</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sprint goal footer */}
                    <div className="mt-12 pt-8 border-t-4 border-dashed border-[#191c1e] flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center">
                          <Flag size={20} className="text-[#161e00]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold italic uppercase">Meta da Avaliação</p>
                          <div className="w-48 h-2 bg-[#eceef0] mt-1 border border-[#191c1e] overflow-hidden">
                            <div className="h-full bg-[#ccff00]" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Sticky Panel */}
              <div className="sticky top-6 space-y-6">
                <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                  <div className="bg-[#191c1e] text-[#ccff00] px-5 py-4 italic">
                    <h3 className="text-lg font-black uppercase tracking-tight">Resumo da Avaliação</h3>
                    <p className="text-[11px] font-bold uppercase text-white/70">Sua avaliação para este evento</p>
                  </div>

                  <div className="p-5 border-b-2 border-[#eceef0]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold italic uppercase text-[#444933]">Progresso</span>
                      <span className="text-sm font-black italic text-[#506600]">{Math.round(progressPct)}%</span>
                    </div>
                    <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2.5 mb-2">
                      <div className="bg-[#ccff00] h-full transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#747a60] italic">
                      {completedCount} de {activeCriteria.length} critérios preenchidos (rascunho ou submetido).
                    </p>
                  </div>

                  <div className="p-5 bg-[#f2f4f6] space-y-4 border-b-2 border-[#eceef0]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold italic uppercase text-[#444933]">Equipe</span>
                      <span className="text-sm font-black italic">{participants?.length || 0} pessoas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold italic uppercase text-[#444933]">Critérios Pendentes</span>
                      <span className="text-sm font-black italic text-[#b02f00]">{activeCriteria.length - completedCount}</span>
                    </div>
                    {eventResult && (
                      <div className="flex justify-between items-center pt-2 border-t-2 border-[#e0e3e5]">
                        <span className="text-xs font-black italic uppercase">Nota Parcial da Equipe</span>
                        <div className="text-right">
                          <span className="text-xl font-black italic text-[#506600]">{eventResult.eventScore.toFixed(1)}</span>
                          <span className="text-xs text-[#747a60] italic">/100</span>
                        </div>
                      </div>
                    )}
                    {eventResult?.projectedPlatoon && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold italic uppercase text-[#444933]">Pelotão Projetado</span>
                        <PlatoonBadge platoon={eventResult.projectedPlatoon} colorHex={eventResult.projectedPlatoonColor} />
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    {hasDrafts ? (
                      <button
                        data-testid="button-submit-eval"
                        onClick={handleSubmitAll}
                        disabled={submitMutation.isPending}
                        className={`w-full bg-[#ccff00] border-2 border-[#191c1e] py-4 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                      >
                        <Send size={16} /> Submeter Avaliações
                      </button>
                    ) : allEvaled ? (
                      <div className="flex items-center justify-center gap-2 text-[#506600] bg-[#ccff00]/30 border-2 border-[#506600] p-3 font-bold italic uppercase text-sm">
                        <CheckCircle size={16} /> Você já concluiu sua avaliação
                      </div>
                    ) : (
                      <button disabled className="w-full bg-[#eceef0] border-2 border-[#191c1e] py-4 font-bold text-sm italic uppercase tracking-wider opacity-60 cursor-not-allowed">
                        Preencha os critérios
                      </button>
                    )}

                    {hasDrafts && (
                      <p className="text-[11px] text-center text-[#747a60] italic mt-3 leading-relaxed">
                        Critérios em <strong>rascunho</strong> precisam ser submetidos para compor a nota final da equipe.
                      </p>
                    )}
                  </div>
                </div>

                {/* Release Feedback Card (Admin only) */}
                {canRelease && eventComplete && (
                  <div className="bg-white border-2 border-dashed border-[#191c1e] p-5">
                    <h4 className="text-xs font-black italic uppercase flex items-center gap-2 mb-2"><Target size={14} /> Ação de Gestão</h4>
                    {feedbackReleased ? (
                      <div className="flex items-center gap-2 text-sm text-[#506600] font-bold italic uppercase">
                        <CheckCircle size={16} /> Feedback liberado para a equipe
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-[#747a60] italic">O evento está fechado. Libere o feedback consolidado para que a equipe possa visualizar no painel "Meu Desempenho".</p>
                        <button
                          data-testid="button-release-feedback"
                          onClick={() => releaseMutation.mutate({ id: selectedEventId })}
                          disabled={releaseMutation.isPending}
                          className="w-full bg-[#ff5722] text-white border-2 border-[#191c1e] py-3 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-[#b02f00]"
                        >
                          <MessageSquareShare size={15} /> Liberar Feedback
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
