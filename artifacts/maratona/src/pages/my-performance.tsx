import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Trophy, Target, Calendar, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronRight, Award,
  Users, MapPin, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";


const QUARTER_LABELS = ["1º Trimestre", "2º Trimestre", "3º Trimestre", "4º Trimestre"];
const YEAR_OPTIONS = [2024, 2025, 2026, 2027];

function usePeriod() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

interface PerformanceData {
  employee: { id: number; name: string; department: string; functionName: string };
  period: { year: number; quarter: number };
  summary: {
    grossAverage: number | null;
    currentPlatoon: string | null;
    projectedBonus: number | null;
    evaluatedEvents: number;
    pendingEvents: number;
    totalAbsences: number;
    isQuarterClosed: boolean;
    finalResult: number | null;
    absencePenalty: number | null;
  };
  events: EventSummary[];
}

interface EventSummary {
  eventId: number;
  eventName: string;
  city: string;
  state: string;
  startDate: string;
  status: string;
  eventScore: number;
  projectedPlatoon: string | null;
  projectedPlatoonColor: string | null;
  evaluatedCriteria: number;
  totalCriteria: number;
  isPending: boolean;
  criteriaDetails: CriterionDetail[];
}

interface CriterionDetail {
  criterionId: number;
  criterionName: string;
  criterionDescription: string;
  weight: number;
  scoreUsed: number | null;
  criterionTotal: number | null;
  hasCalibration: boolean;
  publicComments: string[];
  evaluated: boolean;
}

const PLATOON_COLORS: Record<string, string> = {
  "Pelotão Quênia": "bg-red-100 text-red-800 border-red-200",
  "Pelotão Azul": "bg-blue-100 text-blue-800 border-blue-200",
  "Pelotão Verde": "bg-green-100 text-green-800 border-green-200",
  "Pelotão Branco": "bg-slate-100 text-slate-700 border-slate-200",
};

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = value >= 90 ? "bg-red-500" : value >= 80 ? "bg-blue-500" : value >= 70 ? "bg-green-500" : "bg-slate-400";
  return (
    <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);
  const statusBadge = {
    closed: { label: "Fechado", class: "bg-slate-100 text-slate-700" },
    open: { label: "Em avaliação", class: "bg-blue-100 text-blue-700" },
    calibration: { label: "Calibração", class: "bg-amber-100 text-amber-700" },
  }[event.status] ?? { label: event.status, class: "bg-gray-100 text-gray-700" };

  const platoonStyle = event.projectedPlatoon ? (PLATOON_COLORS[event.projectedPlatoon] ?? "bg-slate-100 text-slate-700") : "";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">
              {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{event.eventName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin size={10} />
                  {event.city}/{event.state}
                </span>
                {event.startDate && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.startDate).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge.class)}>{statusBadge.label}</span>
            {event.eventScore > 0 && (
              <div className="text-right">
                <span className="font-bold text-lg text-foreground">{event.eventScore.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            )}
            {event.projectedPlatoon && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full border", platoonStyle)}>{event.projectedPlatoon}</span>
            )}
          </div>
        </button>

        {open && (
          <div className="border-t bg-muted/20 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <span>Quesitos avaliados: {event.evaluatedCriteria}/{event.totalCriteria}</span>
              {event.isPending && <span className="text-amber-600 flex items-center gap-1"><Clock size={12} />Pendente</span>}
            </div>
            <div className="space-y-2">
              {event.criteriaDetails.map(c => (
                <div key={c.criterionId} className="bg-card rounded-lg border p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{c.criterionName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.criterionDescription}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.scoreUsed !== null ? (
                        <>
                          <span className="font-bold text-base">{c.scoreUsed.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">/5</span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Total: <span className="font-semibold text-foreground">{(c.criterionTotal ?? 0).toFixed(1)}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Pendente</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Peso: {c.weight}</span>
                    {c.hasCalibration && (
                      <Badge variant="outline" className="text-xs h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">Calibrado</Badge>
                    )}
                    {c.evaluated && !c.hasCalibration && (
                      <Badge variant="outline" className="text-xs h-4 px-1.5 bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 size={10} className="mr-1" />Avaliado
                      </Badge>
                    )}
                  </div>
                  {c.publicComments.map((comment, i) => (
                    <div key={i} className="text-xs bg-blue-50 text-blue-800 p-2 rounded border border-blue-100 mt-1">
                      💬 {comment}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MyPerformancePage() {
  const { user } = useAuth();
  const { year: defaultYear, quarter: defaultQuarter } = usePeriod();
  const [year, setYear] = useState(defaultYear);
  const [quarter, setQuarter] = useState(defaultQuarter);

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ["my-performance", year, quarter],
    queryFn: async () => {
      const token = localStorage.getItem("maratona_token");
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
      const resp = await fetch(`${apiBase}/my-performance?year=${year}&quarter=${quarter}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error ?? "Erro ao carregar desempenho");
      }
      return resp.json();
    },
    enabled: !!user?.employeeId,
  });

  if (!user?.employeeId) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Seu usuário não está vinculado a um colaborador. Solicite ao administrador para vincular seu perfil a um colaborador no sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;
  const platoon = summary?.currentPlatoon;
  const platoonStyle = platoon ? (PLATOON_COLORS[platoon] ?? "bg-slate-100 text-slate-700") : "";

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="text-primary" size={24} />
            Meu Desempenho
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.employee.name} · {data?.employee.functionName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-24 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(quarter)} onValueChange={v => setQuarter(Number(v))}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUARTER_LABELS.map((q, i) => <SelectItem key={i + 1} value={String(i + 1)}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {data && summary && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Resultado</span>
                  <Trophy size={16} className="text-primary" />
                </div>
                {result !== null ? (
                  <>
                    <div className="text-3xl font-bold">{result.toFixed(0)}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                    <ScoreBar value={result} />
                  </>
                ) : (
                  <div className="text-lg font-medium text-muted-foreground">Em andamento</div>
                )}
                {summary.isQuarterClosed && (
                  <Badge className="mt-1 text-xs" variant="outline">Trimestre Fechado</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Pelotão</span>
                  <Target size={16} className="text-primary" />
                </div>
                {platoon ? (
                  <>
                    <div className="text-base font-bold">{platoon}</div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border mt-1 inline-block", platoonStyle)}>
                      {summary.isQuarterClosed ? "Final" : "Projetado"}
                    </span>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Bônus Caju</span>
                  <Banknote size={16} className="text-primary" />
                </div>
                {summary.projectedBonus !== null ? (
                  <>
                    <div className="text-xl font-bold">
                      {summary.projectedBonus.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </div>
                    <span className="text-xs text-muted-foreground">{summary.isQuarterClosed ? "Confirmado" : "Projeção"}</span>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">Eventos</span>
                  <Calendar size={16} className="text-primary" />
                </div>
                <div className="text-2xl font-bold">{summary.evaluatedEvents}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summary.pendingEvents > 0 && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock size={10} />{summary.pendingEvents} pendente{summary.pendingEvents > 1 ? "s" : ""}
                    </span>
                  )}
                  {summary.totalAbsences > 0 && (
                    <span className="text-red-600 block">{summary.totalAbsences} falta{summary.totalAbsences > 1 ? "s" : ""}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Absence penalty info */}
          {summary.absencePenalty !== null && summary.absencePenalty > 0 && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Desconto por faltas: <strong>−{summary.absencePenalty} pontos</strong>
                {summary.grossAverage !== null && (
                  <> (média bruta {summary.grossAverage.toFixed(1)} → resultado final {result?.toFixed(1)})</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Score progress bar */}
          {result !== null && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Distribuição por pelotão</span>
                  <span className="text-xs text-muted-foreground">Escala 0–100</span>
                </div>
                <div className="relative">
                  <div className="flex h-6 rounded-full overflow-hidden text-xs font-medium">
                    <div className="bg-slate-300 flex items-center justify-center text-slate-700" style={{ width: "70%" }}>Branco (0-70)</div>
                    <div className="bg-green-400 flex items-center justify-center text-white" style={{ width: "10%" }}>Verde</div>
                    <div className="bg-blue-500 flex items-center justify-center text-white" style={{ width: "10%" }}>Azul</div>
                    <div className="bg-red-500 flex items-center justify-center text-white" style={{ width: "10%" }}>Quênia</div>
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground shadow-md"
                    style={{ left: `${Math.min(99, result)}%`, transform: "translateX(-50%)" }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0</span><span>70</span><span>80</span><span>90</span><span>100</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event breakdown */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Eventos do {QUARTER_LABELS[quarter - 1]} de {year}
            </h2>
            {data.events.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum evento encontrado para este período.
                </CardContent>
              </Card>
            ) : (
              data.events.map(ev => <EventCard key={ev.eventId} event={ev} />)
            )}
          </div>

          {/* Privacy note */}
          <p className="text-xs text-muted-foreground text-center pb-4">
            🔒 Notas e comentários são apresentados de forma consolidada. Identidades dos avaliadores não são exibidas.
          </p>
        </>
      )}
    </div>
  );
}
