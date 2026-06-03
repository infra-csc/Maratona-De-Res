import { useState } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useCreateEvaluation, useSubmitEvaluation, getGetEvaluationsQueryKey, getGetEventsQueryKey } from "@workspace/api-client-react";
import type { EvaluationInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Send } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const currentYear = new Date().getFullYear();
const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

export default function EvaluationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

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
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const openEvents = (events ?? []).filter(e => e.status === "open");

  function getEval(employeeId: number, criterionId: number) {
    return (evaluations ?? []).find(e => e.employeeId === employeeId && e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function handleScore(employeeId: number, criterionId: number, score: number) {
    if (!selectedEventId) return;
    createMutation.mutate({ data: { eventId: selectedEventId, employeeId, criterionId, score } });
  }

  function handleSubmitAll(employeeId: number) {
    const myEvals = (evaluations ?? []).filter(e => e.employeeId === employeeId && e.evaluatorUserId === user?.id && e.status === "draft");
    myEvals.forEach(e => submitMutation.mutate({ id: e.id }));
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 data-testid="text-page-title" className="text-2xl font-bold">Avaliações</h1>
        <p className="text-muted-foreground text-sm">Avalie os colaboradores por critério</p>
      </div>

      <div className="flex gap-3 items-center">
        <div className="w-80">
          <Select
            value={selectedEventId ? String(selectedEventId) : ""}
            onValueChange={v => setSelectedEventId(Number(v))}
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
          <p>Selecione um evento acima para iniciar as avaliações.</p>
        </div>
      ) : !participants || participants.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum participante neste evento.</div>
      ) : (
        <div className="space-y-4">
          {participants.map(p => {
            const allEvaled = activeCriteria.length > 0 && activeCriteria.every(c => {
              const ev = getEval(p.employeeId, c.criterionId);
              return ev && ev.status === "submitted";
            });
            const hasDrafts = activeCriteria.some(c => {
              const ev = getEval(p.employeeId, c.criterionId);
              return ev && ev.status === "draft";
            });

            return (
              <Card key={p.employeeId} data-testid={`card-eval-${p.employeeId}`}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{p.employeeName}</CardTitle>
                      <p className="text-xs text-muted-foreground">{p.functionName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {allEvaled ? (
                        <Badge variant="default" className="gap-1 text-xs"><CheckCircle size={11} />Concluído</Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs"><Clock size={11} />Pendente</Badge>
                      )}
                      {hasDrafts && !allEvaled && (
                        <Button
                          data-testid={`button-submit-eval-${p.employeeId}`}
                          size="sm"
                          onClick={() => handleSubmitAll(p.employeeId)}
                          disabled={submitMutation.isPending}
                        >
                          <Send size={13} className="mr-1" /> Submeter
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="space-y-3">
                    {activeCriteria.map(c => {
                      const ev = getEval(p.employeeId, c.criterionId);
                      const score = ev ? parseFloat(ev.score as unknown as string) : 3;
                      const submitted = ev?.status === "submitted";
                      return (
                        <div key={c.criterionId} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{c.criterionName}</span>
                            <span className={`font-medium ${submitted ? "text-muted-foreground" : "text-primary"}`}>
                              {ev ? score.toFixed(1) : "—"} / 5.0
                              {submitted && <CheckCircle size={11} className="inline ml-1 text-green-500" />}
                            </span>
                          </div>
                          <Slider
                            data-testid={`slider-criterion-${p.employeeId}-${c.criterionId}`}
                            min={0} max={5} step={0.5}
                            value={[ev ? score : 3]}
                            disabled={submitted}
                            onValueCommit={([v]) => handleScore(p.employeeId, c.criterionId, v)}
                            className={submitted ? "opacity-50" : ""}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
