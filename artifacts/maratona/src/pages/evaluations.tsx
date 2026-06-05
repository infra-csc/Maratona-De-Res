import { useState } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useGetEventResult, useCreateEvaluation, useSubmitEvaluation, useReleaseEventFeedback, getGetEvaluationsQueryKey, exportPendingEvaluations } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Send, Users, MessageSquareShare, Download, Calendar, MapPin, Building2, Save } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

function ScoreButton({ score, current, onClick, disabled, label }: { score: number, current: number, onClick: () => void, disabled: boolean, label: string }) {
  const isSelected = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 w-full",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/50 hover:bg-muted/50",
        isSelected 
          ? "border-primary bg-primary/10 text-primary shadow-sm" 
          : "border-transparent bg-muted text-muted-foreground"
      )}
    >
      <span className="text-xl font-bold">{score}</span>
      <span className="text-[10px] leading-tight text-center mt-1 font-medium">{label}</span>
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
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto bg-slate-50/50 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold tracking-tight text-foreground">Central de Avaliações</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Avalie o desempenho da equipe de forma justa, meritocrática e sigilosa.
          </p>
        </div>
        <div className="flex gap-2">
          <Button data-testid="button-export-pending" size="sm" variant="outline" className="bg-white" onClick={handleExportPending}>
            <Download size={15} className="mr-1.5" /> Exportar Pendentes
          </Button>
        </div>
      </div>

      <div className="w-full max-w-md">
        <Select
          value={selectedEventId ? String(selectedEventId) : ""}
          onValueChange={v => { setSelectedEventId(Number(v)); setScores({}); setComments({}); }}
        >
          <SelectTrigger data-testid="select-event" className="bg-white h-11 border-slate-300 shadow-sm">
            <SelectValue placeholder="Selecione um evento para avaliar..." />
          </SelectTrigger>
          <SelectContent>
            {openEvents.map(ev => (
              <SelectItem key={ev.id} value={String(ev.id)}>{ev.name} — {ev.clientName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedEventId ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="text-slate-300" size={32} />
          </div>
          <h2 className="text-xl font-semibold mb-2">Pronto para avaliar</h2>
          <p className="text-muted-foreground max-w-md">Selecione um evento no menu acima para iniciar ou continuar a avaliação da equipe responsável.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header Card */}
          {currentEvent && (
            <Card className="border-none shadow-md overflow-hidden bg-gradient-to-r from-sidebar to-sidebar-accent text-white">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Users size={120} />
              </div>
              <CardContent className="p-6 md:p-8 relative z-10">
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <StatusBadge status="open" className="bg-white/10 text-white border-white/20" />
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20">T{currentEvent.quarter}/{currentEvent.year}</Badge>
                    </div>
                    <h2 className="text-3xl font-bold mb-1">{currentEvent.name}</h2>
                    <p className="text-white/80 font-medium text-lg">{currentEvent.clientName}</p>
                    
                    <div className="flex items-center gap-6 mt-6 text-sm text-white/70">
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
                    <div className="bg-black/20 backdrop-blur-sm p-4 rounded-xl border border-white/10 w-full md:w-64">
                      <p className="text-sm text-white/80 font-medium mb-2">Progresso Geral (Todo o time)</p>
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span>{currentEvent.evaluationProgress}% Concluído</span>
                      </div>
                      <div className="w-full bg-black/30 rounded-full h-2">
                        <div className="bg-primary-foreground h-2 rounded-full transition-all" style={{ width: `${currentEvent.evaluationProgress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            
            {/* Criteria Column */}
            <div className="space-y-4">
              <h3 className="font-bold text-xl px-1">Critérios de Avaliação</h3>
              
              {activeCriteria.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed">Nenhum critério ativo neste evento.</div>
              ) : (
                <div className="space-y-6">
                  {activeCriteria.map((c, index) => {
                    const ev = getEval(c.criterionId);
                    const submitted = ev?.status === "submitted";
                    const isDraft = ev?.status === "draft";
                    const score = currentScore(c.criterionId);
                    const comment = comments[c.criterionId] ?? ev?.comments ?? "";
                    
                    // Show requirement alert if score < 3 and comment is empty
                    const needsComment = score > 0 && score < 3 && (!comment || comment.trim().length === 0);
                    
                    return (
                      <Card key={c.criterionId} className={cn("overflow-hidden transition-all duration-300", submitted ? "border-green-200 bg-slate-50/50" : isDraft ? "border-amber-200" : "hover:border-primary/30")}>
                        <div className="flex items-stretch">
                          <div className={cn("w-2 shrink-0", submitted ? "bg-green-500" : isDraft ? "bg-amber-400" : "bg-primary")} />
                          <CardContent className="p-6 flex-1">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline" className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-semibold">Peso {c.weightOverride ?? c.originalWeight ?? 0}</Badge>
                                  {c.responsibleAreaName && (
                                    <Badge variant="secondary" className="font-medium bg-secondary text-secondary-foreground">
                                      <Building2 size={10} className="mr-1" /> {c.responsibleAreaName}
                                    </Badge>
                                  )}
                                  {submitted && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle size={12} className="mr-1" /> Submetido</Badge>}
                                  {isDraft && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock size={12} className="mr-1" /> Rascunho</Badge>}
                                </div>
                                <h4 className="text-lg font-bold">{index + 1}. {c.criterionName}</h4>
                                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                  Avalie o desempenho da equipe considerando este critério específico para o evento atual.
                                </p>
                              </div>
                              
                              <div className="shrink-0 flex items-center justify-center w-16 h-16 rounded-xl bg-slate-100 border text-2xl font-black">
                                {score > 0 ? score : "-"}
                              </div>
                            </div>

                            <div className="mb-6">
                              <div className="grid grid-cols-5 gap-2">
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
                              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <label className="text-sm font-semibold flex items-center gap-2">
                                  Justificativa / Feedback
                                  {score > 0 && score < 3 && <span className="text-xs text-destructive bg-destructive/10 px-2 py-0.5 rounded-full font-medium">Obrigatório para nota {score}</span>}
                                </label>
                                <Textarea
                                  placeholder={score > 0 && score < 3 ? "Explique os motivos que levaram a esta nota baixa..." : "Comentários opcionais para a equipe (serão vistos anonimamente)..."}
                                  value={comment}
                                  onChange={e => setComments(s => ({ ...s, [c.criterionId]: e.target.value }))}
                                  className={cn("bg-white resize-y min-h-24", needsComment ? "border-destructive focus-visible:ring-destructive" : "")}
                                />
                                
                                <div className="flex justify-end pt-2">
                                  <Button 
                                    size="sm" 
                                    variant={isDraft ? "outline" : "default"}
                                    onClick={() => handleSaveDraft(c.criterionId)}
                                    disabled={score === 0 || needsComment}
                                  >
                                    <Save size={14} className="mr-1.5" /> 
                                    {isDraft ? "Atualizar Rascunho" : "Salvar Rascunho"}
                                  </Button>
                                </div>
                              </div>
                            )}

                            {submitted && comment && (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                                <p className="text-sm font-semibold mb-1">Seu Feedback:</p>
                                <p className="text-sm text-slate-700 italic">"{comment}"</p>
                              </div>
                            )}
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Sticky Panel */}
            <div className="sticky top-6 space-y-4">
              <Card className="shadow-lg border-primary/20">
                <CardHeader className="bg-slate-50/50 pb-4 border-b">
                  <CardTitle className="text-lg">Resumo da Avaliação</CardTitle>
                  <CardDescription>Sua avaliação para este evento</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-5 border-b">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Progresso</span>
                      <span className="text-sm font-bold text-primary">{Math.round(progressPct)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                      <div className="bg-primary h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {completedCount} de {activeCriteria.length} critérios preenchidos (rascunho ou submetido).
                    </p>
                  </div>

                  <div className="p-5 bg-slate-50 space-y-4 border-b">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Equipe</span>
                      <span className="text-sm font-semibold">{participants?.length || 0} pessoas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-slate-600">Critérios Pendentes</span>
                      <span className="text-sm font-semibold text-amber-600">{activeCriteria.length - completedCount}</span>
                    </div>
                    {eventResult && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                        <span className="text-sm font-semibold">Nota Parcial da Equipe</span>
                        <div className="text-right">
                          <span className="text-xl font-bold text-primary">{eventResult.eventScore.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                      </div>
                    )}
                    {eventResult?.projectedPlatoon && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-600">Pelotão Projetado</span>
                        <PlatoonBadge platoon={eventResult.projectedPlatoon} colorHex={eventResult.projectedPlatoonColor} />
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    {hasDrafts ? (
                      <Button
                        data-testid="button-submit-eval"
                        className="w-full shadow-md"
                        onClick={handleSubmitAll}
                        disabled={submitMutation.isPending}
                      >
                        <Send size={16} className="mr-2" /> Submeter Avaliações
                      </Button>
                    ) : allEvaled ? (
                      <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 p-3 rounded-lg border border-green-200 font-medium text-sm">
                        <CheckCircle size={16} /> Você já concluiu sua avaliação
                      </div>
                    ) : (
                      <Button className="w-full" disabled variant="outline">
                        Preencha os critérios
                      </Button>
                    )}
                    
                    {hasDrafts && (
                      <p className="text-[11px] text-center text-muted-foreground mt-3 leading-relaxed">
                        Critérios em <strong>rascunho</strong> precisam ser submetidos para compor a nota final da equipe.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Release Feedback Card (Admin only) */}
              {canRelease && eventComplete && (
                <Card className="border-dashed border-2">
                  <CardContent className="p-5">
                    <h4 className="font-semibold text-sm mb-2">Ação de Gestão</h4>
                    {feedbackReleased ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                        <CheckCircle size={16} /> Feedback liberado para a equipe
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">O evento está fechado. Libere o feedback consolidado para que a equipe possa visualizar no painel "Meu Desempenho".</p>
                        <Button
                          data-testid="button-release-feedback"
                          variant="secondary"
                          className="w-full"
                          onClick={() => releaseMutation.mutate({ id: selectedEventId })}
                          disabled={releaseMutation.isPending}
                        >
                          <MessageSquareShare size={15} className="mr-2" /> Liberar Feedback
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
