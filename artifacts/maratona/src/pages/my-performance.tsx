import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useGetCurrentCycle } from "@workspace/api-client-react";
import { formatCyclePeriod, CycleBadge } from "@/components/cycle-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Calendar, TrendingUp, AlertTriangle,
  CheckCircle2, Clock, ChevronDown, ChevronRight,
  MapPin, Search, Flag, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface PerformanceData {
  employee: { id: number; name: string; department: string; functionName: string; eligible?: boolean; eligibilityStatus?: string | null };
  cycle: { id: number; name: string };
  summary: {
    grossAverage: number | null;
    currentPlatoon: string | null;
    projectedBonus: number | null;
    bonusStatus: string | null;
    eligible: boolean;
    totalEvents: number;
    closedEvents: number;
    openEvents: number;
    confirmedEvents: number;
    minEventsForEligibility: number;
    totalAbsences: number;
    penaltyPoints: number;
    meritPoints: number;
    isQuarterClosed: boolean;
    finalResult: number | null;
    absencePenalty: number | null;
  };
  adjustments: Adjustment[];
  events: EventSummary[];
}

interface Adjustment {
  id: number;
  kind: "penalty" | "merit";
  penaltyType: string;
  points: number;
  quantity: number;
  totalPoints: number;
  date: string | null;
  reason: string | null;
  eventName: string | null;
}

interface ReviewRequest {
  id: number;
  comment: string;
  status: "pending" | "resolved" | "approved" | "denied";
  createdAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

interface EventSummary {
  eventId: number;
  eventName: string;
  city: string | null;
  state: string | null;
  location: string | null;
  startDate: string;
  status: string;
  feedbackReleased?: boolean;
  feedbackReleasedAt?: string | null;
  partialPublishedAt?: string | null;
  eventScore: number;
  projectedPlatoon: string | null;
  projectedPlatoonColor: string | null;
  evaluatedCriteria: number;
  totalCriteria: number;
  criteriaDetails: CriterionDetail[];
  countsForScore: boolean;
  resultsConfirmed: boolean;
  reviewRequest: ReviewRequest | null;
}

interface CriterionDetail {
  criterionId: number;
  criterionName: string;
  criterionDescription: string;
  weight: number;
  scoreUsed: number | null;
  criterionTotal: number | null;
  publicComments: string[];
  evaluated: boolean;
  partialPublishedAt?: string | null;
  finalPublishedAt?: string | null;
  reviewRequest?: ReviewRequest | null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Rótulo/cores por desfecho do pedido de revisão. "resolved" é legado
// (resolvido antes de existir aprovado/negado).
function reviewStatusInfo(status: string | undefined | null) {
  switch (status) {
    case "pending": return { label: "Revisão solicitada", badgeCls: "bg-[#fff3cd] text-[#862200]", btnCls: "border-[#862200] text-[#862200] bg-[#862200]/10" };
    case "approved": return { label: "Revisão aprovada", badgeCls: "bg-[#506600] text-white", btnCls: "border-[#506600] text-[#506600] bg-[#506600]/10" };
    case "denied": return { label: "Revisão negada", badgeCls: "bg-[#862200] text-white", btnCls: "border-[#862200] text-[#862200] bg-[#862200]/10" };
    case "resolved": return { label: "Revisão resolvida", badgeCls: "bg-[#506600] text-white", btnCls: "border-[#506600] text-[#506600] bg-[#506600]/10" };
    default: return null;
  }
}

function bonusStatusLabel(isQuarterClosed: boolean, bonusStatus: string | null): string {
  if (!isQuarterClosed) return "Valor parcial — projeção do ciclo em andamento";
  switch (bonusStatus) {
    case "paid": return "Bônus pago";
    case "approved": return "Aprovado — aguardando pagamento";
    case "scheduled": return "Pagamento agendado";
    case "blocked": return "Bloqueado — contate o RH";
    default: return "Resultado final — aguardando aprovação do RH";
  }
}

function CriterionReviewRequest({ event, criterion }: { event: EventSummary; criterion: CriterionDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [comment, setComment] = useState(criterion.reviewRequest?.comment ?? "");

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const token = localStorage.getItem("maratona_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/my-performance/events/${event.eventId}/review-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment: `[Critério: ${criterion.criterionName}] ${text}` }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Não foi possível enviar a sinalização.");
      }
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      setResubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["my-performance"] });
    },
  });

  const hasRequest = !!criterion.reviewRequest;
  const showForm = !hasRequest || resubmitting;
  const statusInfo = reviewStatusInfo(criterion.reviewRequest?.status);
  const isResolved = hasRequest && criterion.reviewRequest!.status !== "pending";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setResubmitting(false); setComment(criterion.reviewRequest?.comment ?? ""); }
      }}
    >
      <DialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1 text-[10px] font-bold uppercase italic px-1.5 py-0.5 border shrink-0 transition-colors mt-1",
            statusInfo ? statusInfo.btnCls : "border-[#862200] text-[#862200] hover:bg-[#862200]/10"
          )}
        >
          <Flag size={9} />
          {statusInfo ? statusInfo.label : "Sinalizar Revisão"}
        </button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()} className="bg-white border-2 border-[#191c1e]">
        <DialogHeader>
          <DialogTitle className="italic uppercase font-black flex items-center gap-2 text-[#191c1e]">
            <Flag size={16} className="text-[#862200]" /> Sinalizar Revisão do Critério
          </DialogTitle>
          <DialogDescription className="italic text-[#444933]">
            <span className="font-bold">{criterion.criterionName}</span> · {event.eventName}
          </DialogDescription>
        </DialogHeader>

        {hasRequest && !showForm && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-[10px] font-bold uppercase italic px-2 py-0.5 border-2 border-[#191c1e]",
                statusInfo?.badgeCls ?? "bg-[#fff3cd] text-[#862200]"
              )}>
                {statusInfo?.label ?? "Revisão sinalizada"}
              </span>
              <span className="text-[10px] font-medium italic text-[#747a60]">{formatDateTime(criterion.reviewRequest!.createdAt)}</span>
            </div>
            <p className="text-sm text-[#444933] italic">"{criterion.reviewRequest!.comment}"</p>
            {isResolved && criterion.reviewRequest!.resolutionNotes && (
              <p className="text-sm text-[#506600] font-bold">Resposta: {criterion.reviewRequest!.resolutionNotes}</p>
            )}
            <button
              onClick={() => { setComment(""); setResubmitting(true); }}
              className="text-[11px] font-bold uppercase italic text-[#747a60] hover:text-[#191c1e] underline"
            >
              Sinalizar novamente
            </button>
          </div>
        )}

        {showForm && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase italic text-[#747a60]">Descreva o motivo da revisão</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Ex: acredito que minha nota em "${criterion.criterionName}" não reflete minha atuação no evento...`}
              className="bg-white text-sm"
              rows={4}
              autoFocus
            />
            {mutation.isError && (
              <p className="text-xs font-bold text-[#862200]">{(mutation.error as Error).message}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-row items-center gap-2 sm:justify-end">
          {showForm ? (
            <>
              {hasRequest && (
                <button
                  onClick={() => { setResubmitting(false); setComment(criterion.reviewRequest?.comment ?? ""); }}
                  className="text-[11px] font-bold uppercase italic text-[#747a60] hover:text-[#191c1e]"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={() => mutation.mutate(comment)}
                disabled={!comment.trim() || mutation.isPending}
                className="flex items-center gap-2 text-[11px] font-bold uppercase italic px-4 py-2 bg-[#191c1e] text-[#ccff00] hover:bg-[#191c1e]/90 transition-colors disabled:opacity-50"
              >
                <Send size={14} /> {mutation.isPending ? "Enviando..." : "Confirmar Revisão"}
              </button>
            </>
          ) : (
            <DialogClose asChild>
              <button className="text-[11px] font-bold uppercase italic px-4 py-2 border-2 border-[#191c1e]">Fechar</button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventReviewRequest({ event }: { event: EventSummary }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [comment, setComment] = useState(event.reviewRequest?.comment ?? "");

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      const token = localStorage.getItem("maratona_token");
      const res = await fetch(`${import.meta.env.BASE_URL}api/my-performance/events/${event.eventId}/review-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ comment: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Não foi possível enviar a sinalização.");
      }
      return res.json();
    },
    onSuccess: () => {
      setOpen(false);
      setResubmitting(false);
      queryClient.invalidateQueries({ queryKey: ["my-performance"] });
    },
  });

  const hasRequest = !!event.reviewRequest;
  const showForm = !hasRequest || resubmitting;
  const statusInfo = reviewStatusInfo(event.reviewRequest?.status);
  const isResolved = hasRequest && event.reviewRequest!.status !== "pending";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) { setResubmitting(false); setComment(event.reviewRequest?.comment ?? ""); }
      }}
    >
      <DialogTrigger asChild>
        <button
          data-testid="button-open-review-request"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-bold uppercase italic px-2 py-1 border-2 shrink-0 transition-colors",
            statusInfo ? statusInfo.btnCls : "border-[#862200] text-[#862200] hover:bg-[#862200]/10"
          )}
        >
          <Flag size={12} /> {statusInfo ? statusInfo.label : "Sinalizar Revisão"}
        </button>
      </DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()} className="bg-white border-2 border-[#191c1e]">
        <DialogHeader>
          <DialogTitle className="italic uppercase font-black flex items-center gap-2 text-[#191c1e]">
            <Flag size={16} className="text-[#862200]" /> Sinalizar Revisão
          </DialogTitle>
          <DialogDescription className="italic text-[#444933]">{event.eventName}</DialogDescription>
        </DialogHeader>

        {hasRequest && !showForm && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "text-[10px] font-bold uppercase italic px-2 py-0.5 border-2 border-[#191c1e]",
                statusInfo?.badgeCls ?? "bg-[#fff3cd] text-[#862200]"
              )}>
                {statusInfo?.label ?? "Revisão sinalizada"}
              </span>
              <span className="text-[10px] font-medium italic text-[#747a60]">{formatDateTime(event.reviewRequest!.createdAt)}</span>
            </div>
            <p className="text-sm text-[#444933] italic">"{event.reviewRequest!.comment}"</p>
            {isResolved && event.reviewRequest!.resolutionNotes && (
              <p className="text-sm text-[#506600] font-bold">Resposta: {event.reviewRequest!.resolutionNotes}</p>
            )}
            <button
              data-testid="button-review-request-again"
              onClick={() => { setComment(""); setResubmitting(true); }}
              className="text-[11px] font-bold uppercase italic text-[#747a60] hover:text-[#191c1e] underline"
            >
              Sinalizar novamente
            </button>
          </div>
        )}

        {showForm && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase italic text-[#747a60]">Descreva o motivo da revisão</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: acredito que a nota do critério X não reflete minha participação..."
              className="bg-white text-sm"
              rows={4}
              autoFocus
            />
            {mutation.isError && (
              <p className="text-xs font-bold text-[#862200]">{(mutation.error as Error).message}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-row items-center gap-2 sm:justify-end">
          {showForm ? (
            <>
              {hasRequest && (
                <button
                  onClick={() => { setResubmitting(false); setComment(event.reviewRequest?.comment ?? ""); }}
                  className="text-[11px] font-bold uppercase italic text-[#747a60] hover:text-[#191c1e]"
                >
                  Cancelar
                </button>
              )}
              <button
                data-testid="button-confirm-review-request"
                onClick={() => mutation.mutate(comment)}
                disabled={!comment.trim() || mutation.isPending}
                className="flex items-center gap-2 text-[11px] font-bold uppercase italic px-4 py-2 bg-[#191c1e] text-[#ccff00] hover:bg-[#191c1e]/90 transition-colors disabled:opacity-50"
              >
                <Send size={14} /> {mutation.isPending ? "Enviando..." : "Confirmar Revisão"}
              </button>
            </>
          ) : (
            <DialogClose asChild>
              <button className="text-[11px] font-bold uppercase italic px-4 py-2 border-2 border-[#191c1e]">Fechar</button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventCard({ event }: { event: EventSummary }) {
  const [open, setOpen] = useState(false);
  // Apenas critérios calibrados (finalPublishedAt) e com peso > 0
  const visibleCriteria = event.criteriaDetails.filter(c => !!c.finalPublishedAt && Number(c.weight) > 0);
  // 3-state: feedbackReleased > algum critério finalPublishedAt > partialPublishedAt (evento) > pendente
  const anyCriterionFinal = event.criteriaDetails.some(c => !!c.finalPublishedAt);
  const publishLabel = event.feedbackReleased
    ? `Nota Final Confirmada${event.feedbackReleasedAt ? ` · ${formatDateTime(event.feedbackReleasedAt)}` : ""}`
    : anyCriterionFinal
      ? "Avaliado — Projeção Parcial"
      : event.partialPublishedAt
        ? `Avaliação Parcial · ${formatDateTime(event.partialPublishedAt)}`
        : "Pendente";

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
                "text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full",
                event.feedbackReleased
                  ? "bg-[#191c1e] text-[#ccff00]"
                  : anyCriterionFinal
                    ? "bg-[#506600] text-[#ccff00]"
                    : event.partialPublishedAt
                      ? "bg-[#ccff00] text-[#191c1e]"
                      : "text-muted-foreground"
              )} style={!event.feedbackReleased && !anyCriterionFinal && !event.partialPublishedAt ? { backgroundColor: "var(--muted)" } : {}}>
                {publishLabel}
              </span>
              {!event.countsForScore && (
                <span
                  title="Participação apenas histórica/informativa — não entra na sua média nem na elegibilidade."
                  className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#862200]/10 text-[#862200]"
                >
                  Não conta p/ nota
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-[13px] text-foreground">{event.eventName}</p>
              {event.eventScore > 0 && <EventReviewRequest event={event} />}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-bold text-muted-foreground">
              {(event.city || event.location) && (
                <span className="flex items-center gap-1"><MapPin size={11} /> {event.city ? `${event.city}${event.state ? `/${event.state}` : ""}` : event.location}</span>
              )}
              {event.startDate && <span>{new Date(event.startDate).toLocaleDateString("pt-BR")}</span>}
              <span className="px-2 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>Quesitos: {visibleCriteria.filter(c => c.evaluated).length}/{visibleCriteria.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pl-10 sm:pl-0 border-t sm:border-t-0 pt-3 sm:pt-0" style={{ borderColor: "var(--border)" }}>
          {event.eventScore > 0 && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="text-right">
                <span className="block text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Nota</span>
                <span className={cn(
                  "font-black text-[19px] leading-none",
                  event.countsForScore && !event.resultsConfirmed ? "text-muted-foreground" : ""
                )} style={event.countsForScore && event.resultsConfirmed ? { color: "var(--accent)" } : {}}>
                  {event.eventScore.toFixed(1)}
                </span>
                {event.countsForScore && !event.resultsConfirmed && (
                  <span className="block text-[8px] uppercase font-bold text-[#a15c00] mt-0.5 whitespace-nowrap">Não confirmada</span>
                )}
              </div>
              {(() => {
                const rs = reviewStatusInfo(event.reviewRequest?.status);
                if (!rs) return null;
                return (
                  <span className={cn("flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full whitespace-nowrap", rs.badgeCls)}>
                    <Flag size={9} /> {rs.label}
                  </span>
                );
              })()}
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
                      <span className="text-[9px] font-bold uppercase text-muted-foreground px-2 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>Peso {c.weight}</span>
                      {c.evaluated && (
                        <span className="text-[9px] font-bold uppercase text-[#506600] flex items-center gap-1">
                          <CheckCircle2 size={11}/> Avaliado
                        </span>
                      )}
                      {event.feedbackReleased || c.finalPublishedAt ? (
                        <span
                          title={c.finalPublishedAt ? `Nota Final publicada em ${formatDateTime(c.finalPublishedAt)}` : event.feedbackReleasedAt ? `Publicado em ${formatDateTime(event.feedbackReleasedAt)}` : undefined}
                          className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#191c1e] text-[#ccff00] flex items-center gap-1"
                        >
                          ✓ Nota Final Confirmada
                        </span>
                      ) : c.partialPublishedAt ? (
                        <span
                          title={`Publicado em ${formatDateTime(c.partialPublishedAt)}`}
                          className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#ccff00] text-[#191c1e]"
                        >
                          Projeção Parcial
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full text-muted-foreground" style={{ backgroundColor: "var(--muted)" }}>
                          Pendente
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-[13px] text-foreground leading-tight">{c.criterionName}</p>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    {c.scoreUsed !== null ? (
                      <>
                        <div className="flex items-end gap-1">
                          <span className="font-black text-2xl leading-none" style={{ color: "var(--accent)" }}>{c.scoreUsed.toFixed(1)}</span>
                          <span className="text-xs font-bold text-muted-foreground pb-1">/10</span>
                        </div>
                        <CriterionReviewRequest event={event} criterion={c} />
                      </>
                    ) : (
                      <span className="text-[9px] font-bold uppercase px-2 py-1 rounded text-muted-foreground" style={{ backgroundColor: "var(--muted)" }}>Pendente</span>
                    )}
                  </div>
                </div>

                {c.publicComments.length > 0 && (
                  <div className="mt-4 space-y-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Feedbacks da equipe avaliadora</p>
                    {c.publicComments.map((comment, i) => (
                      <div key={i} className="text-xs text-foreground p-3 rounded border-l-2 border-[#ccff00]" style={{ backgroundColor: "var(--muted)" }}>
                        <span className="italic leading-relaxed">"{comment}"</span>
                      </div>
                    ))}
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
  const { data: currentCycle } = useGetCurrentCycle();
  const [eventFilter, setEventFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "closed" | "open">("all");

  const { data, isLoading, error } = useQuery<PerformanceData>({
    queryKey: ["my-performance"],
    queryFn: async () => {
      const token = localStorage.getItem("maratona_token");
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api";
      const resp = await fetch(`${apiBase}/my-performance`, {
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
      <div className="p-8 max-w-2xl mx-auto mt-12 rounded-xl text-center space-y-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-[#862200] mb-2" style={{ backgroundColor: "var(--muted)" }}>
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground text-sm">
          Seu perfil de usuário não está vinculado a um colaborador no sistema. O painel Meu Desempenho é exclusivo para participantes da Maratona de Resultados.
        </p>
        <p className="text-sm font-bold pt-4 text-muted-foreground" style={{ borderTop: "1px solid var(--border)" }}>Contate o RH ou o administrador do sistema para realizar a vinculação.</p>
      </div>
    );
  }

  const summary = data?.summary;
  const result = summary?.finalResult ?? summary?.grossAverage ?? null;
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const filteredEvents = (data?.events ?? []).filter(ev => {
    if (!ev.resultsConfirmed) return false;
    const matchesText = !eventFilter ||
      ev.eventName.toLowerCase().includes(eventFilter.toLowerCase()) ||
      (ev.city?.toLowerCase() ?? "").includes(eventFilter.toLowerCase()) ||
      (ev.state?.toLowerCase() ?? "").includes(eventFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || ev.status === statusFilter;
    return matchesText && matchesStatus;
  });

  return (
    <div className="min-h-full text-foreground" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-14 md:top-0 z-30 flex flex-wrap gap-4 justify-between items-center px-6 md:px-10 py-[18px]" style={{ backgroundColor: "var(--background)", borderBottom: "1px solid var(--border)" }}>
        <h1 className="font-black text-[24px] uppercase tracking-tight flex items-center gap-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent)" }}>
          <TrendingUp size={24} />
          Meu Desempenho
        </h1>
        <CycleBadge />
      </header>

      <div className="p-6 md:p-10 space-y-8">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-[14px] uppercase px-3 py-1.5 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)", fontFamily: "'Barlow Condensed', sans-serif" }}>{data?.employee.name ?? user?.name}</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{data?.employee.functionName}</span>
        </div>

        {data && summary && (
          <div className={cn(
            "rounded-xl px-4 py-3 text-[12px] font-bold uppercase flex items-center gap-2",
            summary.isQuarterClosed
              ? "bg-[rgba(154,176,0,0.12)] text-[#506600]"
              : "bg-[rgba(232,162,61,0.14)] text-[#c98a1f]"
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
          <Alert variant="destructive" className="rounded-xl bg-[#862200]/10 border-[#862200]/30 text-[#862200]">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-bold ml-2">{(error as Error).message}</AlertDescription>
          </Alert>
        )}

        {data && summary && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px]">
              {/* Média do Ciclo */}
              <div className="rounded-xl p-[18px] relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Média do Ciclo</span>
                {result !== null ? (
                  <>
                    <div className="mt-1.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      <span className="font-black text-[34px] leading-none text-foreground">{result.toFixed(1)}</span>
                      <span className="text-[15px] text-muted-foreground">/100</span>
                    </div>
                    <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">
                      {summary.isQuarterClosed ? "Resultado oficial" : "Projeção parcial"}
                    </p>
                  </>
                ) : (
                  <div className="text-lg text-muted-foreground mt-4">—</div>
                )}
                <div className="mt-3 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${result ?? 0}%`, backgroundColor: "var(--foreground)" }} />
                </div>
              </div>

              {/* Bônus Caju */}
              <div className="rounded-xl p-[18px] relative overflow-hidden bg-[#ccff00]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#161e00]/70">Bônus Caju</span>
                {!summary.eligible ? (
                  <>
                    <div className="mt-1.5 font-black text-[34px] leading-none text-[#747a60]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>—</div>
                    <p className="mt-1 text-[10px] font-bold uppercase text-[#862200]">Não elegível para bônus neste ciclo</p>
                  </>
                ) : summary.projectedBonus !== null ? (
                  <>
                    <div className="mt-1.5 font-black text-[34px] leading-none text-[#506600]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{fmtBRL(summary.projectedBonus)}</div>
                    <p className="mt-1 text-[10px] font-bold uppercase text-[#506600]/80">{bonusStatusLabel(summary.isQuarterClosed, summary.bonusStatus)}</p>
                  </>
                ) : (
                  <div className="mt-1.5 font-black text-[34px] leading-none text-[#747a60]" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>—</div>
                )}
                <div className="mt-3 h-[5px] rounded-full overflow-hidden bg-black/15">
                  <div className="h-full rounded-full" style={{ width: "0%" }} />
                </div>
              </div>

              {/* Eventos Confirmados */}
              {(() => {
                const confirmed = summary.confirmedEvents ?? 0;
                const target = summary.minEventsForEligibility ?? 8;
                const faltam = Math.max(0, target - confirmed);
                const atingiu = confirmed >= target;
                return (
                  <div className="rounded-xl p-[18px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Eventos Confirmados</span>
                    <div className="mt-1.5 flex items-baseline gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                      <span className="font-black text-[34px] leading-none text-foreground">{confirmed}</span>
                      <span className="text-[15px] text-muted-foreground">de {target} p/ elegibilidade</span>
                    </div>
                    <p className={cn("mt-1 text-[10px] font-bold uppercase", atingiu ? "text-[#506600]" : "text-[#862200]")}>
                      {atingiu ? "Elegível ao bônus" : `Faltam ${faltam} evento${faltam !== 1 ? "s" : ""} para elegibilidade`}
                    </p>
                    <div className="mt-3 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--muted)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (confirmed / target) * 100)}%`, backgroundColor: atingiu ? "#ccff00" : "var(--foreground)" }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Penalidades e Méritos */}
            <div>
              <h3 className="font-black text-[16px] uppercase mb-3 flex items-center gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent)" }}>
                <AlertTriangle size={18} /> Penalidades e Méritos
              </h3>
              {(data.adjustments?.length ?? 0) === 0 ? (
                <div className="rounded-xl py-9 text-center text-[13px] text-muted-foreground" style={{ border: "1px dashed var(--border)" }}>
                  Nenhuma penalidade ou mérito registrado neste ciclo.
                </div>
              ) : (
                <>
                  <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    {data.adjustments.map((adj, idx) => (
                      <div key={adj.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                              adj.kind === "merit" ? "bg-[#ccff00] text-[#161e00]" : "bg-[#862200]/15 text-[#862200]"
                            }`}>
                              {adj.kind === "merit" ? "Mérito" : "Penalidade"}
                            </span>
                            <span className="text-[12px] font-bold text-foreground">{adj.penaltyType}</span>
                            {adj.quantity > 1 && (
                              <span className="text-[10px] font-bold text-muted-foreground px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>×{adj.quantity}</span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            {adj.date && <span>{new Date(`${adj.date}T00:00:00`).toLocaleDateString("pt-BR")}</span>}
                            {adj.eventName && <span className="flex items-center gap-1"><Calendar size={11} /> {adj.eventName}</span>}
                          </div>
                          {adj.reason && <p className="text-[11px] text-muted-foreground italic mt-1">"{adj.reason}"</p>}
                        </div>
                        <span className={`font-black text-[18px] shrink-0 ${adj.kind === "merit" ? "text-[#506600]" : "text-[#862200]"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                          {adj.kind === "merit" ? "+" : "−"}{adj.totalPoints} pts
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mt-2">
                    Méritos somam e penalidades descontam pontos na sua nota final do ciclo (limitada entre 0 e 100).
                  </p>
                </>
              )}
            </div>

            {/* Histórico de Eventos */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-[14px]">
                <h3 className="font-black text-[16px] uppercase flex items-center gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent)" }}>
                  <Calendar size={18} /> Histórico de Eventos
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    {[
                      { key: "all", label: "Todos" },
                      { key: "closed", label: "Avaliados" },
                      { key: "open", label: "Em Avaliação" },
                    ].map(btn => (
                      <button
                        key={btn.key}
                        onClick={() => setStatusFilter(btn.key as typeof statusFilter)}
                        className="px-[14px] py-2 text-[11px] font-bold uppercase transition-colors border-none"
                        style={statusFilter === btn.key
                          ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
                          : { backgroundColor: "transparent", color: "var(--muted-foreground)" }
                        }
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 px-[14px] py-2 rounded-lg" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <Search size={12} className="text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      placeholder="Buscar evento..."
                      className="border-none bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground w-40"
                    />
                  </div>
                </div>
              </div>

              {filteredEvents.length === 0 ? (
                <div className="rounded-xl py-16 text-center text-[13px] text-muted-foreground" style={{ border: "1px dashed var(--border)" }}>
                  {eventFilter
                    ? `Nenhum evento encontrado para "${eventFilter}".`
                    : `Nenhum evento registrado no ciclo ${data.cycle.name}.`}
                </div>
              ) : (
                <div>
                  {filteredEvents.map(ev => <EventCard key={ev.eventId} event={ev} />)}
                </div>
              )}
            </div>

            {/* Privacy note */}
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sigilo de Avaliação</p>
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
