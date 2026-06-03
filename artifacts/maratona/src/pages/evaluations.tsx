import { useState } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useGetEventResult, useCreateEvaluation, useSubmitEvaluation, useReleaseEventFeedback, getGetEvaluationsQueryKey, exportPendingEvaluations } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Send, Users, MessageSquareShare, Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

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

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function currentScore(criterionId: number) {
    if (scores[criterionId] != null) return scores[criterionId];
    const ev = getEval(criterionId);
    return ev ? parseFloat(ev.score as unknown as string) : 3;
  }

  function handleScore(criterionId: number, score: number) {
    if (!selectedEventId) return;
    const comment = comments[criterionId] ?? getEval(criterionId)?.comments ?? "";
    if (score < 3 && (!comment || comment.trim().length === 0)) {
      toast({ title: "Comentário obrigatório", description: "Notas abaixo de 3 exigem uma justificativa.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ data: { eventId: selectedEventId, criterionId, score, comments: comment || undefined } });
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold">Avaliação da Equipe</h1>
          <p className="text-muted-foreground text-sm">
            A nota é única por critério e aplicada igualmente a toda a equipe do evento (escala 1 a 5).
          </p>
        </div>
        <Button data-testid="button-export-pending" size="sm" variant="outline" onClick={handleExportPending}>
          <Download size={15} className="mr-1.5" /> Exportar Pendentes
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <div className="w-80">
          <Select
            value={selectedEventId ? String(selectedEventId) : ""}
            onValueChange={v => { setSelectedEventId(Number(v)); setScores({}); setComments({}); }}
          >
            <SelectTrigger data-testid="select-event">
              <SelectValue placeholder="Selecione um evento aberto..." />
            </SelectTrigger>
            <SelectContent>
              {openEvents.map(ev => (
                <SelectItem key={ev.id} value={String(ev.id)}>{ev.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedEventId ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Selecione um evento acima para iniciar a avaliação da equipe.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <Card data-testid="card-team-evaluation">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Notas por Critério</CardTitle>
                  <div className="flex items-center gap-2">
                    {allEvaled ? (
                      <Badge variant="default" className="gap-1 text-xs"><CheckCircle size={11} />Concluído</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs"><Clock size={11} />Pendente</Badge>
                    )}
                    {hasDrafts && (
                      <Button
                        data-testid="button-submit-eval"
                        size="sm"
                        onClick={handleSubmitAll}
                        disabled={submitMutation.isPending}
                      >
                        <Send size={13} className="mr-1" /> Submeter
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">
                {activeCriteria.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Nenhum critério ativo neste evento.</div>
                ) : (
                  <div className="space-y-5">
                    {activeCriteria.map(c => {
                      const ev = getEval(c.criterionId);
                      const submitted = ev?.status === "submitted";
                      const score = currentScore(c.criterionId);
                      const comment = comments[c.criterionId] ?? ev?.comments ?? "";
                      return (
                        <div key={c.criterionId} className="space-y-2 border-b last:border-0 pb-4 last:pb-0">
                          <div className="flex justify-between items-start text-sm gap-3">
                            <div>
                              <span className="font-medium">{c.criterionName}</span>
                              {c.normalizedWeight != null && (
                                <span className="text-xs text-muted-foreground ml-2">Peso {c.normalizedWeight}</span>
                              )}
                            </div>
                            <span className={`font-medium shrink-0 ${submitted ? "text-muted-foreground" : "text-primary"}`}>
                              {ev || scores[c.criterionId] != null ? score.toFixed(0) : "—"} / 5
                              {submitted && <CheckCircle size={11} className="inline ml-1 text-green-500" />}
                            </span>
                          </div>
                          <Slider
                            data-testid={`slider-criterion-${c.criterionId}`}
                            min={1} max={5} step={1}
                            value={[score]}
                            disabled={submitted}
                            onValueChange={([v]) => setScores(s => ({ ...s, [c.criterionId]: v }))}
                            onValueCommit={([v]) => handleScore(c.criterionId, v)}
                            className={submitted ? "opacity-50" : ""}
                          />
                          {!submitted && score < 3 && (
                            <Textarea
                              data-testid={`textarea-comment-${c.criterionId}`}
                              placeholder="Justificativa obrigatória para notas abaixo de 3..."
                              value={comment}
                              onChange={e => setComments(s => ({ ...s, [c.criterionId]: e.target.value }))}
                              onBlur={() => { if (comment.trim()) handleScore(c.criterionId, score); }}
                              className="text-sm min-h-16"
                            />
                          )}
                          {submitted && ev?.comments && (
                            <p className="text-xs text-muted-foreground italic">"{ev.comments}"</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {canRelease && eventComplete && (
              feedbackReleased ? (
                <Badge variant="outline" className="gap-1 text-xs bg-green-50 text-green-700 border-green-200 w-fit">
                  <CheckCircle size={12} /> Feedback liberado para a equipe
                </Badge>
              ) : (
                <Button
                  data-testid="button-release-feedback"
                  variant="outline"
                  onClick={() => releaseMutation.mutate({ id: selectedEventId })}
                  disabled={releaseMutation.isPending}
                >
                  <MessageSquareShare size={15} className="mr-1.5" /> Liberar Feedback para a Equipe
                </Button>
              )
            )}
          </div>

          <Card className="h-fit">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={15} className="text-primary" /> Equipe do Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              {!participants || participants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum participante.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-2">
                    {participants.length} participante(s) — todos recebem a mesma nota da equipe.
                  </p>
                  <ul className="space-y-1.5">
                    {participants.map(p => (
                      <li key={p.employeeId} data-testid={`team-member-${p.employeeId}`} className="text-sm">
                        <span className="font-medium">{p.employeeName}</span>
                        <span className="text-xs text-muted-foreground block">{p.functionName}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
