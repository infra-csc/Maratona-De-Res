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

  const { data: results } = useGetEventResult(id, {
    query: { enabled: !!id, queryKey: ["event-result", id] as unknown[] },
  });

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando evento...</div>;
  }

  if (!event) {
    return <div className="p-6 text-center text-muted-foreground">Evento não encontrado</div>;
  }

  const fmt = (v: number) => `${(v * 100).toFixed(1)}%`;

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
              <p className="text-sm text-muted-foreground">Com Resultado</p>
              <p className="text-3xl font-bold mt-1">{results?.filter(r => r.eventScore > 0).length ?? 0}</p>
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

      {results && results.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 size={15} /> Resultados do Evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Colaborador</th>
                    <th className="px-4 py-2 text-center font-medium">Score do Evento</th>
                    <th className="px-4 py-2 text-center font-medium">Pelotão Projetado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...results].sort((a, b) => b.eventScore - a.eventScore).map(r => (
                    <tr key={r.employeeId} data-testid={`row-event-result-${r.employeeId}`} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 font-medium">{r.employeeName}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-primary">{fmt(r.eventScore)}</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">{r.projectedPlatoon ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
