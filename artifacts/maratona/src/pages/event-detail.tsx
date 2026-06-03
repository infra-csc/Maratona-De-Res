import { useRoute } from "wouter";
import { useGetEvent, useGetEventResult, getGetEventQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, MapPin, Users, BarChart3 } from "lucide-react";
import { Link } from "wouter";

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const id = params ? parseInt(params.id) : 0;

  const { data: event, isLoading } = useGetEvent(id, {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id) },
  });

  const { data: result } = useGetEventResult(id, {
    query: { enabled: !!id, queryKey: ["event-result", id] as unknown[] },
  });
  const participantResults = result?.participants ?? [];

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando evento...</div>;
  }

  if (!event) {
    return <div className="p-6 text-center text-muted-foreground">Evento não encontrado</div>;
  }

  const fmt = (v: number) => `${v.toFixed(1)}/100`;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <Link href="/events">
          <Button variant="ghost" size="sm" className="mt-0.5">
            <ArrowLeft size={15} className="mr-1.5" /> Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 data-testid="text-event-name" className="text-2xl font-bold">{event.name}</h1>
            <Badge variant={event.status === "open" ? "default" : "secondary"}>
              {event.status === "open" ? "Aberto" : event.status === "closed" ? "Fechado" : event.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            {event.clientName && <span>{event.clientName}</span>}
            <span className="flex items-center gap-1"><Calendar size={13} />{event.startDate} — {event.endDate}</span>
            {event.city && <span className="flex items-center gap-1"><MapPin size={13} />{event.city}, {event.state}</span>}
            <span>T{event.quarter}/{event.year}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Participantes</p>
                <p data-testid="text-participant-count" className="text-3xl font-bold mt-1">{event.participants?.length ?? 0}</p>
              </div>
              <Users className="text-primary opacity-60" size={24} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Critérios Ativos</p>
              <p className="text-3xl font-bold mt-1">{(event.criteria ?? []).filter(c => c.active).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Score da Equipe</p>
              <p className="text-3xl font-bold mt-1">{result && result.eventScore > 0 ? fmt(result.eventScore) : "—"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {event.participants && event.participants.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users size={15} /> Participantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {event.participants.map(p => (
                <div key={p.id} data-testid={`chip-participant-${p.employeeId}`} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary/50 shrink-0" />
                  <span className="font-medium truncate">{p.employeeName}</span>
                  <span className="text-xs text-muted-foreground truncate ml-auto">{p.functionName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.eventScore > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 size={15} /> Resultado da Equipe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-xs text-muted-foreground">Score do Evento</p>
                <p className="text-3xl font-bold text-primary">{fmt(result.eventScore)}</p>
              </div>
              {result.projectedPlatoon && (
                <div>
                  <p className="text-xs text-muted-foreground">Pelotão Projetado</p>
                  <span className="text-sm px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (result.projectedPlatoonColor ?? "#94a3b8") + "25", color: result.projectedPlatoonColor ?? "#94a3b8" }}>
                    {result.projectedPlatoon}
                  </span>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Critérios avaliados</p>
                <p className="text-lg font-semibold">{result.evaluatedCriteria}/{result.totalCriteria}</p>
              </div>
            </div>
            {participantResults.length > 0 && (
              <div className="border rounded-lg overflow-auto">
                <table className="w-full text-sm min-w-[400px]">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Colaborador</th>
                      <th className="px-4 py-2 text-center font-medium">Score (Equipe)</th>
                      <th className="px-4 py-2 text-center font-medium">Elegível</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {participantResults.map(p => (
                      <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">{p.employeeName}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-primary">{fmt(p.eventScore)}</td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{p.eligible === false ? "Não" : "Sim"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
