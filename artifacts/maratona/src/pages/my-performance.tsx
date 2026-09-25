import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGetCurrentCycle, useGetMyPerformance, getGetMyPerformanceQueryKey, ApiError } from "@workspace/api-client-react";
import type { MyPerformanceEvent } from "@workspace/api-client-react";
import { CycleBadge } from "@/components/cycle-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Calendar, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronRight,
  MapPin, Search, Award,
} from "lucide-react";
import { cn, fmtDate, fmtDateTime, fmtNum } from "@/lib/utils";
import { INFO } from "@/lib/premium-theme";

// Tipos do contrato (GET /my-performance em lib/api-spec/openapi.yaml).
type EventSummary = MyPerformanceEvent;

/** Mensagem do servidor (`{ error }`) sem o prefixo "HTTP 404 ..." do ApiError. */
function performanceErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    return typeof data?.error === "string" && data.error.trim() ? data.error : "Erro ao carregar desempenho";
  }
  return e instanceof Error ? e.message : "Erro ao carregar desempenho";
}

function contrastingTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

/** Cor de TEXTO para uma nota 0–100 (tokens legíveis nos dois temas). */
function scoreColor(score: number | null): string {
  if (score === null) return "var(--muted-foreground)";
  if (score >= 80) return "var(--status-ok-text)";
  if (score >= 60) return "var(--status-warn-text)";
  return "var(--status-danger-text)";
}

/** Cor de BARRA/preenchimento para uma nota 0–100 (a lima da marca só em fundo). */
function scoreBarColor(score: number | null): string {
  if (score === null) return "var(--muted)";
  if (score >= 80) return "var(--accent)";
  if (score >= 60) return "var(--status-warn)";
  return "var(--status-danger)";
}

function scoreLabel(score: number | null): string {
  if (score === null) return "";
  if (score >= 90) return "Excelente";
  if (score >= 80) return "Muito bom";
  if (score >= 60) return "Regular";
  return "Abaixo da meta";
}

function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);
  const visibleCriteria = event.criteriaDetails.filter(c => c.scoreUsed !== null && c.weight > 0);
  // "Avaliado" = feedbackReleased OU todos os quesitos com peso têm finalPublishedAt OU histórico.
  const allScoredAreFinal = visibleCriteria.length > 0 && (
    visibleCriteria.every(c => !!c.finalPublishedAt) ||
    !!event.isHistorical
  );
  const isAvaliadoFinal = event.feedbackReleased || allScoredAreFinal;
  // "Avaliado · Parcial" = algum critério já tem publicação parcial (mas não final total).
  const hasAnyPartial = visibleCriteria.some(c => !!c.partialPublishedAt) || !!event.partialPublishedAt;
  const isAvaliadoParcial = !isAvaliadoFinal && hasAnyPartial;
  const isEmAvaliacao = !isAvaliadoFinal && !isAvaliadoParcial && !!event.criteriaConfirmed;
  // Log do "Avaliado Final": data do feedbackReleased ou a data mais recente de finalPublishedAt.
  const avaliadoDate: string | null = isAvaliadoFinal
    ? (event.feedbackReleasedAt
        ?? ([...visibleCriteria]
            .map(c => c.finalPublishedAt)
            .filter((d): d is string => !!d)
            .sort()
            .at(-1)
            ?? null))
    : null;
  const publishLabel = isAvaliadoFinal
    ? `Avaliado · Final${avaliadoDate ? ` · ${fmtDateTime(avaliadoDate)}` : ""}`
    : isAvaliadoParcial
      ? "Avaliado · Parcial"
      : isEmAvaliacao
        ? "Em Avaliação"
        : "Aguardando";

  return (
    <div className="mb-3 rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}>
      {/* Header do evento */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(v => !v); }}
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-[14px_18px] transition-colors text-left gap-4 cursor-pointer hover:brightness-95"
      >
        <div className="flex items-start gap-4 min-w-0 w-full">
          <div className="mt-1 shrink-0 p-1.5 rounded-md" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={cn(
                "text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full",
                isAvaliadoFinal
                  ? "bg-[#191c1e] text-[#ccff00]"
                  : isAvaliadoParcial
                    ? "bg-[#1a5c2e] text-[#4ade80]"
                    : isEmAvaliacao
                      ? "bg-[#506600] text-[#ccff00]"
                      : "text-muted-foreground"
              )} style={!isAvaliadoFinal && !isAvaliadoParcial && !isEmAvaliacao ? { backgroundColor: "var(--muted)" } : {}}>
                {publishLabel}
              </span>
              {!event.countsForScore && (
                <span
                  title="Participação apenas histórica/informativa — não entra na sua média nem na elegibilidade."
                  className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                >
                  Não conta p/ nota
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[13px] text-foreground">{event.eventName}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-bold text-muted-foreground">
              {(event.city || event.location) && (
                <span className="flex items-center gap-1"><MapPin size={11} /> {event.city ? `${event.city}${event.state ? `/${event.state}` : ""}` : event.location}</span>
              )}
              {event.startDate && <span>{fmtDate(event.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>}
              <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>Quesitos: {visibleCriteria.length}/{event.criteriaDetails.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pl-10 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0" style={{ borderColor: "var(--border)" }}>
          {event.eventScore > 0 && (
            <div className="flex flex-col items-end gap-1">
              {(event.conformityPenalty ?? 0) > 0 ? (
                <>
                  {/* Nota bruta riscada */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] uppercase font-bold text-muted-foreground">Nota time</span>
                    <span className="font-black text-[14px] leading-none line-through text-muted-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {fmtNum((event.rawTeamScore ?? event.eventScore + (event.conformityPenalty ?? 0)), 1)}
                    </span>
                  </div>
                  {/* Desconto Matriz + itens reprovados */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(192,57,43,0.12)", color: "var(--status-danger-text)" }}>
                      Matriz −{fmtNum((event.conformityPenalty ?? 0), 1)}
                    </span>
                    {(event.conformityFailedItems ?? []).map((item, i) => (
                      <span key={i} className="text-[11px] font-bold px-1.5 py-0.5 rounded text-right" style={{ backgroundColor: "rgba(192,57,43,0.07)", color: "var(--status-danger-text)" }}
                        title={item.comment ?? undefined}>
                        NÃO: {item.label}{item.comment ? " ⓘ" : ""}
                      </span>
                    ))}
                  </div>
                  {/* Nota final em destaque */}
                  <div className="text-right">
                    <span className="block text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Nota final</span>
                    <span className="font-black text-[19px] leading-none" style={{ color: scoreColor(event.eventScore) }}>
                      {fmtNum(event.eventScore, 1)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-right">
                  <span className="block text-[11px] uppercase font-bold text-muted-foreground mb-0.5">Nota</span>
                  <span className="font-black text-[19px] leading-none" style={{ color: scoreColor(event.eventScore) }}>
                    {fmtNum(event.eventScore, 1)}
                  </span>
                </div>
              )}
              {event.projectedPlatoon && event.projectedPlatoonColor && (
                <span
                  className="text-[11px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: event.projectedPlatoonColor, color: contrastingTextColor(event.projectedPlatoonColor) }}
                >
                  {event.projectedPlatoon}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Detalhamento dos critérios */}
      {open && (
        <div className="p-5 md:p-6 space-y-4" style={{ borderTop: "1px solid var(--border)", backgroundColor: "var(--muted)" }}>
          <h4 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">Detalhamento dos Critérios</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {visibleCriteria.map(c => (
              <div key={c.criterionId} className="p-4 rounded-xl relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] font-bold uppercase text-muted-foreground px-2 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>Peso {c.weight}</span>
                      {event.feedbackReleased || c.finalPublishedAt ? (
                        <span
                          title={c.finalPublishedAt ? `Avaliado em ${fmtDateTime(c.finalPublishedAt)}` : event.feedbackReleasedAt ? `Avaliado em ${fmtDateTime(event.feedbackReleasedAt)}` : undefined}
                          className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#191c1e] text-[#ccff00] flex items-center gap-1"
                        >
                          <CheckCircle2 size={11}/> Avaliado{c.finalPublishedAt ? ` · ${fmtDateTime(c.finalPublishedAt)}` : ""}
                        </span>
                      ) : c.partialPublishedAt ? (
                        <span
                          title={`Publicação parcial em ${fmtDateTime(c.partialPublishedAt)}`}
                          className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#ccff00] text-[#191c1e]"
                        >
                          Projeção Parcial
                        </span>
                      ) : null}
                    </div>
                    <p className="font-bold text-[13px] text-foreground leading-tight">{c.criterionName}</p>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    {c.scoreUsed !== null ? (
                      <div className="flex items-end gap-1">
                        <span className="font-black text-2xl leading-none" style={{ color: scoreColor(c.scoreUsed * 10) }}>{fmtNum(c.scoreUsed, 1)}</span>
                        <span className="text-xs font-bold text-muted-foreground pb-1">/10</span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold uppercase px-2 py-1 rounded text-muted-foreground" style={{ backgroundColor: "var(--muted)" }}>Pendente</span>
                    )}
                  </div>
                </div>
                {c.scoreUsed !== null && (
                  <div className="h-[4px] rounded-full overflow-hidden mb-3" style={{ backgroundColor: "var(--muted)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(c.scoreUsed / 10) * 100}%`, backgroundColor: scoreBarColor(c.scoreUsed * 10) }} />
                  </div>
                )}

                {c.publicComments.length > 0 && (
                  <div className="mt-4 space-y-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-black uppercase text-muted-foreground">Feedbacks da equipe avaliadora</p>
                    {c.publicComments.map((comment, i) => (
                      <div key={i} className="text-xs text-foreground p-3 rounded border-l-2 border-[var(--accent)]" style={{ backgroundColor: "var(--muted)" }}>
                        <span className="italic leading-relaxed">"{comment}"</span>
                      </div>
                    ))}
                  </div>
                )}
                {c.calibrationReason && (
                  <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-black uppercase text-muted-foreground mb-2">Comentário de calibração</p>
                    <div className="text-xs text-foreground p-3 rounded border-l-2" style={{ backgroundColor: "var(--muted)", borderLeftColor: INFO }}>
                      <span className="italic leading-relaxed">"{c.calibrationReason}"</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyPerformancePage() {
  const { user } = useAuth();
  // Mantém o cache do ciclo aquecido para o CycleBadge; o resultado não é lido aqui.
  useGetCurrentCycle();
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "avaliado" | "em_avaliacao">("all");

  const { data, isLoading, error } = useGetMyPerformance({
    query: { queryKey: getGetMyPerformanceQueryKey(), enabled: !!user?.employeeId },
  });

  if (!user?.employeeId) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 rounded-xl text-center space-y-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-[var(--status-danger-text)] mb-2" style={{ backgroundColor: "var(--muted)" }}>
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Meu Desempenho: acesso restrito</h1>
        <p className="text-muted-foreground text-sm">
          Seu perfil de usuário não está vinculado a um colaborador no sistema. O painel Meu Desempenho é exclusivo para participantes da Maratona de Resultados.
        </p>
        <p className="text-sm font-bold pt-4 text-muted-foreground" style={{ borderTop: "1px solid var(--border)" }}>Contate o RH ou o administrador do sistema para realizar a vinculação.</p>
      </div>
    );
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;

  // Eventos ainda sem confirmação do RH ficam fora da lista e da nota; contamos
  // para avisar o colaborador em vez de escondê-los em silêncio.
  const pendingConfirmationCount = (data?.events ?? []).filter(ev => !ev.resultsConfirmed).length;

  const filteredEvents = (data?.events ?? []).filter(ev => {
    if (!ev.resultsConfirmed) return false;
    const matchesText = !eventFilter ||
      ev.eventName.toLowerCase().includes(eventFilter.toLowerCase()) ||
      (ev.city?.toLowerCase() ?? "").includes(eventFilter.toLowerCase()) ||
      (ev.state?.toLowerCase() ?? "").includes(eventFilter.toLowerCase());
    // "Avaliado" = feedbackReleased OU todos os quesitos (com score) têm publicação final OU histórico.
    const visibleCriteria = ev.criteriaDetails.filter(c => c.scoreUsed !== null);
    const allScoredAreFinal = visibleCriteria.length > 0 && (
      visibleCriteria.every(c => !!c.finalPublishedAt) || !!ev.isHistorical
    );
    const allFinal = ev.feedbackReleased || allScoredAreFinal;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "avaliado" && allFinal)
      || (statusFilter === "em_avaliacao" && !allFinal && !!ev.criteriaConfirmed);
    return matchesText && matchesStatus;
  });

  return (
    <div className="min-h-full text-foreground" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-14 md:top-0 z-30 flex flex-wrap gap-4 justify-between items-center px-6 md:px-10 py-[18px]" style={{ backgroundColor: "var(--background)", borderBottom: "1px solid var(--border)" }}>
        <h1 className="font-black text-[24px] uppercase tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>
          <TrendingUp size={24} />
          Meu Desempenho
        </h1>
        <CycleBadge />
      </header>

      <div className="p-4 sm:p-6 md:p-10 space-y-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-[14px] uppercase px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "'Barlow Condensed', sans-serif" }}>{data?.employee.name ?? user?.name}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{data?.employee.functionName}</span>
        </div>

        {data && summary && (
          <div className={cn(
            "rounded-xl px-4 py-3 text-[12px] font-bold uppercase flex items-center gap-2",
            summary.isQuarterClosed
              ? "bg-[rgba(154,176,0,0.12)] text-[var(--status-ok-text)]"
              : "bg-[rgba(232,162,61,0.14)] text-[var(--status-warn-text)]"
          )} style={{ border: `1px solid ${summary.isQuarterClosed ? "rgba(154,176,0,0.3)" : "rgba(232,162,61,0.35)"}` }}>
            {summary.isQuarterClosed ? <CheckCircle2 size={15} /> : <Clock size={15} />}
            {summary.isQuarterClosed
              ? "Ciclo fechado — resultado oficial"
              : "Ciclo em andamento — nota e bônus são projeções parciais e podem mudar até o fechamento oficial"}
          </div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="rounded-xl bg-[var(--status-danger-bg)] border-[#862200]/30 text-[var(--status-danger-text)]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-bold ml-2">{performanceErrorMessage(error)}</AlertDescription>
          </Alert>
        )}

        {data && summary && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
              {/* Média do Ciclo */}
              <div className="rounded-xl p-[18px] relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Média do Ciclo</span>
                {result !== null ? (
                  <>
                    <div className="mt-1.5 flex items-baseline gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      <span className="font-black text-[34px] leading-none" style={{ color: scoreColor(result) }}>{fmtNum(result, 1)}</span>
                      <span className="text-[15px] text-muted-foreground">/100</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <p className="text-[11px] font-bold uppercase text-muted-foreground">
                        {summary.isQuarterClosed ? "Resultado oficial" : "Projeção parcial"}
                      </p>
                      {result !== null && (
                        <span className="text-[11px] font-bold text-muted-foreground">{scoreLabel(result)}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-lg text-muted-foreground mt-4">—</div>
                )}
                <div className="mt-3 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${result ?? 0}%`, backgroundColor: scoreBarColor(result) }} />
                </div>
              </div>

              {/* Eventos Confirmados — barra de progresso para elegibilidade */}
              {(() => {
                // Elegibilidade usa eventos PARTICIPADOS (mesma métrica do grid
                // de colaboradores), não eventos com nota já calculada.
                const confirmed = summary.participatedEventsCount ?? summary.confirmedEvents ?? 0;
                const target = summary.minEventsForEligibility ?? 8;
                const faltam = Math.max(0, target - confirmed);
                const atingiu = confirmed >= target;
                const steps = Array.from({ length: target }, (_, i) => i < confirmed);
                return (
                  <div className="rounded-xl p-[18px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Elegibilidade ao Bônus</span>
                    <div className="mt-1.5 flex items-baseline gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      <span className="font-black text-[34px] leading-none" style={{ color: atingiu ? "var(--accent-text)" : "var(--foreground)" }}>{confirmed}</span>
                      <span className="text-[15px] text-muted-foreground">/ {target} eventos</span>
                    </div>
                    <p className={cn("mt-1 text-[11px] font-bold uppercase", atingiu ? "text-[var(--status-ok-text)]" : "text-[var(--status-warn-text)]")}>
                      {atingiu ? "✓ Meta atingida — elegível ao bônus" : `Faltam ${faltam} evento${faltam !== 1 ? "s" : ""} confirmados`}
                    </p>
                    {/* Step dots */}
                    <div className="mt-3 flex gap-1 flex-wrap">
                      {steps.map((filled, i) => (
                        <div
                          key={i}
                          className="rounded-sm transition-all duration-300"
                          style={{
                            width: `calc(${100 / target}% - 3px)`,
                            minWidth: 10,
                            height: 8,
                            backgroundColor: filled ? (atingiu ? "var(--accent)" : "var(--foreground)") : "var(--muted)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Faixa — 3ª coluna da grade de resumo */}
              {summary.currentPlatoon && (() => {
                const score = summary.finalResult;
                const min = summary.currentPlatoonMinScore;
                const max = summary.currentPlatoonMaxScore;
                const progressPct = (score != null && min != null && max != null && max > min)
                  ? Math.min(100, Math.max(0, ((score - min) / (max - min)) * 100))
                  : null;
                const gapToNext = (score != null && summary.nextPlatoonMinScore != null)
                  ? Math.max(0, summary.nextPlatoonMinScore - score)
                  : null;
                return (
                  <div
                    className="rounded-xl p-[18px] relative overflow-hidden"
                    style={{
                      backgroundColor: summary.currentPlatoonColor ? `${summary.currentPlatoonColor}18` : "var(--card)",
                      border: `1px solid ${summary.currentPlatoonColor ? `${summary.currentPlatoonColor}55` : "var(--border)"}`,
                      borderLeft: `4px solid ${summary.currentPlatoonColor ?? "var(--accent)"}`,
                    }}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Faixa</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      {summary.currentPlatoonColor && (
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: summary.currentPlatoonColor, boxShadow: "0 0 0 1px var(--border)" }} />
                      )}
                      <span
                        className="font-black text-[24px] leading-none"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}
                      >
                        {summary.currentPlatoon}
                      </span>
                    </div>
                    {min != null && max != null && (
                      <p className="text-[11px] font-bold mt-1 text-muted-foreground">
                        {min}–{max}
                      </p>
                    )}

                    {/* Barra de progresso dentro da faixa atual */}
                    {progressPct !== null && (
                      <div className="mt-2.5">
                        <div
                          className="w-full h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: summary.currentPlatoonColor ? `${summary.currentPlatoonColor}30` : "var(--muted)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progressPct}%`,
                              backgroundColor: summary.currentPlatoonColor ?? "var(--accent)",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Falta para a próxima faixa */}
                    {gapToNext !== null && summary.nextPlatoon && (
                      <p className="text-[11px] font-semibold mt-2 leading-tight" style={{ color: summary.nextPlatoonColor ?? "var(--muted-foreground)" }}>
                        +{gapToNext.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts → {summary.nextPlatoon}
                      </p>
                    )}

                    {/* Mensagem de conquista para o tier máximo */}
                    {!summary.nextPlatoon && summary.currentPlatoon && (
                      <p className="text-[11px] font-semibold mt-2 leading-tight" style={{ color: summary.currentPlatoonColor ?? "var(--accent)" }}>
                        🏆 Nível máximo atingido!
                      </p>
                    )}

                    {summary.projectedBonus != null && summary.eligible && summary.projectedBonus > 0 && (
                      <p
                        className="text-[11px] font-bold mt-1.5"
                        style={{ color: summary.currentPlatoonColor ?? "var(--accent)" }}
                      >
                        Bônus: {summary.projectedBonus.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Detalhamento dos eventos que compõem a média */}
            {(() => {
              const scoredEvts = (data.events ?? [])
                .filter(ev => ev.resultsConfirmed && ev.countsForScore && ev.eventScore > 0)
                .sort((a, b) => a.startDate.localeCompare(b.startDate));
              // Usa o grossAverage do snapshot quando disponível (já vem do API
              // com o valor oficial); fallback para o cálculo ao vivo.
              const officialAvg = summary.grossAverage ?? null;
              const officialCount = summary.scoredEventsCount ?? scoredEvts.length;
              if (scoredEvts.length === 0 && officialAvg === null) return null;
              const liveTotal = scoredEvts.reduce((s, e) => s + e.eventScore, 0);
              const liveAvg = scoredEvts.length > 0 ? liveTotal / scoredEvts.length : null;
              // Exibe o footer com "Soma ÷ Qtd = Média" apenas quando o cálculo
              // ao vivo é consistente com o snapshot (mesma qtd de eventos e avg
              // com diferença ≤ 0,1). Quando há divergência (ex.: evento
              // confirmado/desconfirmado depois do snapshot), mostra a média
              // oficial diretamente para não exibir uma conta que não fecha.
              const liveConsistent = liveAvg !== null
                && officialAvg !== null
                && scoredEvts.length === officialCount
                && Math.abs(liveAvg - officialAvg) < 0.11;
              const displayAvg = officialAvg ?? liveAvg ?? 0;
              const N = officialCount > 0 ? officialCount : scoredEvts.length;
              const pen = summary.penaltyPoints ?? 0;
              const mer = summary.meritPoints ?? 0;
              const netPenalty = pen - mer;
              const penPerEvent = N > 0 ? netPenalty / N : 0;
              const rawFinal = displayAvg - penPerEvent;
              const isClamped = rawFinal < 0 || rawFinal > 100;
              const finalVal = result ?? Math.min(100, Math.max(0, Math.round(rawFinal * 100) / 100));
              return (
                <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                      Como sua nota é calculada
                    </p>
                  </div>

                  {/* Lista de eventos */}
                  <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {scoredEvts.map((ev, i) => (
                      <div key={ev.eventId} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-[11px] font-black text-muted-foreground w-5 shrink-0 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <p className="text-[12px] font-bold text-foreground truncate">{ev.eventName}</p>
                            {ev.startDate && (
                              <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(ev.startDate)}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                              <div className="h-full rounded-full" style={{ width: `${ev.eventScore}%`, backgroundColor: scoreBarColor(ev.eventScore) }} />
                            </div>
                            <span className="text-[15px] font-black shrink-0 w-[42px] text-right" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: scoreColor(ev.eventScore) }}>
                              {fmtNum(ev.eventScore, 1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fórmula de cálculo */}
                  <div className="px-5 py-5" style={{ backgroundColor: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                    {/* Rótulo da fórmula */}
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">
                      {netPenalty !== 0
                        ? `( soma das notas ${pen > 0 ? "− penalidades" : ""}${mer > 0 ? " + méritos" : ""} ) ÷ nº de provas = nota final`
                        : "soma das notas ÷ nº de provas = nota final"}
                    </p>

                    {/* Blocos da fórmula */}
                    <div className="flex items-stretch gap-0 flex-wrap">

                      {/* SOMA */}
                      <div className="flex flex-col items-center justify-center px-4 py-3 rounded-l-lg min-w-[72px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                        <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Soma</span>
                        <span className="font-black text-[24px] leading-none text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {liveConsistent ? fmtNum(liveTotal, 1) : fmtNum((displayAvg * N), 1)}
                        </span>
                      </div>

                      {/* − PENALIDADES */}
                      {pen > 0 && (
                        <>
                          <div className="flex items-center px-2 self-center">
                            <span className="text-[18px] font-black text-muted-foreground">−</span>
                          </div>
                          <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]" style={{ backgroundColor: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.25)" }}>
                            <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--status-danger-text)" }}>Penalidades</span>
                            <span className="font-black text-[24px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--status-danger-text)" }}>{pen}</span>
                          </div>
                        </>
                      )}

                      {/* + MÉRITOS */}
                      {mer > 0 && (
                        <>
                          <div className="flex items-center px-2 self-center">
                            <span className="text-[18px] font-black text-muted-foreground">+</span>
                          </div>
                          <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]" style={{ backgroundColor: "rgba(22,163,74,0.10)", border: "1px solid rgba(22,163,74,0.30)" }}>
                            <span className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--status-ok-text)" }}>Méritos</span>
                            <span className="font-black text-[24px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--status-ok-text)" }}>{mer}</span>
                          </div>
                        </>
                      )}

                      {/* ÷ N PROVAS */}
                      <div className="flex items-center px-2 self-center">
                        <span className="text-[18px] font-black text-muted-foreground">÷</span>
                      </div>
                      <div className="flex flex-col items-center justify-center px-4 py-3 min-w-[72px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                        <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">Provas</span>
                        <span className="font-black text-[24px] leading-none text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{N}</span>
                      </div>

                      {/* = NOTA FINAL */}
                      <div className="flex items-center px-2 self-center">
                        <span className="text-[18px] font-black text-muted-foreground">=</span>
                      </div>
                      <div className="flex flex-col items-center justify-center px-4 py-3 rounded-r-lg flex-1 min-w-[88px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                        <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-1">
                          Nota Final{isClamped ? " (limitado a 0–100)" : ""}
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-[28px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: scoreColor(finalVal) }}>{fmtNum(finalVal, 1)}</span>
                          <span className="text-[11px] text-muted-foreground">/100</span>
                        </div>
                      </div>
                    </div>

                    {/* Explicação textual — só quando há penalidade/mérito */}
                    {netPenalty !== 0 && (
                      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                        Penalidades e méritos são somados ao total antes de dividir pelas provas —
                        {" "}por isso o impacto depende de quantos eventos você participou.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Penalidades e Méritos */}
            <div>
              <h3 className="font-black text-[16px] uppercase mb-3 flex items-center gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>
                <AlertTriangle size={18} /> Penalidades e Méritos
              </h3>
              {(data.adjustments?.length ?? 0) === 0 ? (
                <div className="rounded-xl py-9 text-center text-[13px] text-muted-foreground" style={{ border: "1px dashed var(--border)" }}>
                  Nenhuma penalidade ou mérito registrado neste ciclo.
                </div>
              ) : (
                <>
                  {(() => {
                    const pen = data.adjustments.filter(a => a.kind === "penalty").reduce((s, a) => s + a.totalPoints, 0);
                    const mer = data.adjustments.filter(a => a.kind === "merit").reduce((s, a) => s + a.totalPoints, 0);
                    const net = mer - pen;
                    return (
                      <div className="flex items-center gap-3 flex-wrap mb-3">
                        {mer > 0 && <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-[#ccff00] text-[#161e00]">+{mer} pts méritos</span>}
                        {pen > 0 && <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]">−{pen} pts penalidades</span>}
                        <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full text-foreground" style={{ backgroundColor: "var(--muted)" }}>
                          Líquido: {net >= 0 ? `+${net}` : net} pts
                        </span>
                      </div>
                    );
                  })()}
                  <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    {data.adjustments.map((adj, idx) => (
                      <div key={adj.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              adj.kind === "merit" ? "bg-[#16a34a]/15 text-[var(--status-ok-text)]" : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                            }`}>
                              {adj.kind === "merit" ? "Mérito" : "Penalidade"}
                            </span>
                            <span className="text-[12px] font-bold text-foreground">{adj.penaltyType}</span>
                            {adj.quantity > 1 && (
                              <span className="text-[11px] font-bold text-muted-foreground px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>×{adj.quantity}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            {adj.date && <span>{fmtDate(adj.date, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>}
                            {adj.eventName && <span className="flex items-center gap-1"><Calendar size={11} /> {adj.eventName}</span>}
                          </div>
                          {adj.reason && <p className="text-[11px] text-muted-foreground italic mt-1">"{adj.reason}"</p>}
                        </div>
                        <span className={`font-black text-[18px] shrink-0 ${adj.kind === "merit" ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {adj.kind === "merit" ? "+" : "−"}{adj.totalPoints} pts
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] font-bold uppercase text-muted-foreground mt-2">
                    Méritos somam e penalidades descontam pontos na sua nota final do ciclo (limitada entre 0 e 100).
                  </p>
                </>
              )}
            </div>

            {/* Item 6 — Destaques do Ciclo (critério mais forte / mais fraco) */}
            {(() => {
              const scoredEvents = (data.events ?? []).filter(ev => ev.resultsConfirmed && ev.countsForScore && ev.eventScore > 0);
              // Agrupa scoreUsed por criterionName (apenas critérios finalizados com peso)
              const map = new Map<string, number[]>();
              for (const ev of scoredEvents) {
                for (const c of ev.criteriaDetails) {
                  if (c.scoreUsed === null || !c.finalPublishedAt || Number(c.weight) <= 0) continue;
                  const name = c.criterionName;
                  if (!map.has(name)) map.set(name, []);
                  map.get(name)!.push(c.scoreUsed);
                }
              }
              if (map.size < 2) return null;
              const entries = [...map.entries()].map(([name, scores]) => ({
                name,
                avg: scores.reduce((s, v) => s + v, 0) / scores.length,
                count: scores.length,
              })).sort((a, b) => b.avg - a.avg);
              const best = entries[0];
              const worst = entries[entries.length - 1];
              return (
                <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <Award size={13} /> Destaques do Ciclo
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Ponto forte */}
                    <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(204,255,0,0.06)", border: "1px solid rgba(204,255,0,0.2)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp size={14} style={{ color: "var(--accent-text)" }} />
                        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--accent-text)" }}>Ponto Forte</span>
                      </div>
                      <p className="font-black text-[14px] text-foreground leading-tight mb-1">{best.name}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-[22px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>{fmtNum(best.avg, 1)}</span>
                        <span className="text-[11px] text-muted-foreground">/10 média · {best.count} evento{best.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-2 h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(best.avg / 10) * 100}%`, backgroundColor: "var(--accent)" }} />
                      </div>
                    </div>
                    {/* A desenvolver */}
                    <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(134,34,0,0.06)", border: "1px solid rgba(134,34,0,0.2)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown size={14} className="text-[var(--status-danger-text)]" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-[var(--status-danger-text)]">A Desenvolver</span>
                      </div>
                      <p className="font-black text-[14px] text-foreground leading-tight mb-1">{worst.name}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-[22px] leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: scoreColor(worst.avg * 10) }}>{fmtNum(worst.avg, 1)}</span>
                        <span className="text-[11px] text-muted-foreground">/10 média · {worst.count} evento{worst.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="mt-2 h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(worst.avg / 10) * 100}%`, backgroundColor: scoreBarColor(worst.avg * 10) }} />
                      </div>
                    </div>
                  </div>
                  {/* Ranking completo de todos os critérios */}
                  <div className="mt-4 pt-3 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">Ranking de Quesitos</p>
                    {entries.map((e, i) => {
                      const isFirst = i === 0;
                      const isLast = i === entries.length - 1;
                      return (
                        <div key={e.name} className="flex items-center gap-3">
                          <span className="text-[11px] font-black text-muted-foreground w-4 shrink-0 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-[11px] font-bold text-foreground truncate">{e.name}</span>
                              {isFirst && <span className="text-[11px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(204,255,0,0.15)", color: "var(--status-ok-text)" }}>melhor</span>}
                              {isLast && entries.length > 1 && <span className="text-[11px] font-black uppercase tracking-wider shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(134,34,0,0.08)", color: "var(--status-danger-text)" }}>a desenvolver</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                                <div className="h-full rounded-full" style={{ width: `${(e.avg / 10) * 100}%`, backgroundColor: isFirst ? "var(--accent)" : scoreBarColor(e.avg * 10) }} />
                              </div>
                              <span className="text-[12px] font-black shrink-0 w-[28px] text-right" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: isFirst ? "var(--status-ok-text)" : scoreColor(e.avg * 10) }}>
                                {fmtNum(e.avg, 1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}


            {/* Histórico de Eventos */}
            <div>
              <div className="flex flex-col gap-3 mb-[14px]">
                <h3 className="font-black text-[16px] uppercase flex items-center gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>
                  <Calendar size={18} /> Histórico de Eventos
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex rounded-lg overflow-hidden flex-1 sm:flex-none" style={{ border: "1px solid var(--border)" }}>
                    {[
                      { key: "all", label: "Todos" },
                      { key: "avaliado", label: "Avaliados" },
                      { key: "em_avaliacao", label: "Em Aval." },
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onClick={() => setStatusFilter(btn.key as typeof statusFilter)}
                        className="flex-1 sm:flex-none px-3 sm:px-[14px] py-2 text-[11px] font-bold uppercase transition-colors border-none"
                        style={statusFilter === btn.key
                          ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
                          : { backgroundColor: "transparent", color: "var(--muted-foreground)" }
                        }
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <Search size={12} className="text-muted-foreground shrink-0" />
                    <input
                      type="search"
                      aria-label="Buscar evento por nome, cidade ou UF"
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      placeholder="Buscar evento..."
                      className="border-none bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground flex-1 min-w-0"
                    />
                  </div>
                </div>
                {pendingConfirmationCount > 0 && (
                  <p
                    data-testid="text-pending-confirmation"
                    className="text-[11px] font-semibold flex items-center gap-1.5"
                    title="Estes eventos só entram na sua nota e na elegibilidade depois que o RH confirmar os resultados."
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Clock size={12} className="shrink-0" aria-hidden="true" />
                    {pendingConfirmationCount} evento(s) aguardando confirmação do RH — ainda não aparecem na lista nem contam na nota.
                  </p>
                )}
              </div>

              {filteredEvents.length === 0 ? (() => {
                const confirmedCount = (data.events ?? []).filter(ev => ev.resultsConfirmed).length;
                const totalCount = (data.events ?? []).length;
                let icon = "🔍";
                let title = "Nenhum evento encontrado";
                let detail = "";
                if (eventFilter) {
                  title = `Sem resultados para "${eventFilter}"`;
                  detail = "Tente um nome diferente ou limpe a busca.";
                  icon = "🔍";
                } else if (statusFilter === "avaliado") {
                  title = "Nenhum evento totalmente avaliado";
                  detail = confirmedCount > 0 ? "Há eventos com resultados confirmados, mas as notas por quesito ainda estão sendo finalizadas." : "As avaliações estão em andamento neste ciclo.";
                  icon = "⏳";
                } else if (statusFilter === "em_avaliacao") {
                  title = "Todos os eventos já foram avaliados";
                  detail = "Todos os seus eventos confirmados têm notas finalizadas. ";
                  icon = "✅";
                } else if (confirmedCount === 0 && totalCount > 0) {
                  title = "Resultados ainda não confirmados";
                  detail = `Você tem ${totalCount} evento(s) no ciclo, mas nenhum resultado foi confirmado pelo RH ainda. As notas aparecerão aqui após a confirmação.`;
                  icon = "🕐";
                } else if (totalCount === 0) {
                  title = "Nenhum evento no ciclo";
                  detail = `Você ainda não tem eventos registrados no ciclo ${data.cycle.name}.`;
                  icon = "📋";
                }
                return (
                  <div className="rounded-xl py-16 text-center space-y-2" style={{ border: "1px dashed var(--border)" }}>
                    <div className="text-3xl mb-1">{icon}</div>
                    <p className="font-black text-[14px] uppercase text-foreground" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{title}</p>
                    {detail && <p className="text-[12px] text-muted-foreground max-w-xs mx-auto">{detail}</p>}
                  </div>
                );
              })() : (
                <div>
                  {filteredEvents.map(ev => <EventCard key={ev.eventId} event={ev} />)}
                </div>
              )}
            </div>

            {/* Privacy note */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Sigilo de Avaliação</p>
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                Para garantir imparcialidade, as notas e comentários exibidos são consolidados. A identidade dos avaliadores é estritamente confidencial.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
