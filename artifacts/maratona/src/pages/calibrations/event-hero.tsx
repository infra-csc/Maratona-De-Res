// Cabeçalho do evento na Calibração: quem é o evento, em que pé está a
// publicação e o PLACAR — a média das avaliações e a prévia com a calibração
// (o que ainda não vale) lado a lado com a nota OFICIAL (o que está publicado).
import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, CalendarDays, MapPin, ShieldCheck, Users } from "lucide-react";
import type { EventFeedback } from "@workspace/api-client-react";
import { cn, fmtDate, fmtNum, plural } from "@/lib/utils";
import { Chip, Eyebrow, btnSmall } from "../evaluations/ui";
import { Bone } from "./cal-ui";
import { calibrationEventChip, formatDateTime } from "./helpers";
import type { ApiEvent } from "./types";

export type EventHeroProps = {
  event: ApiEvent;
  teamCount: number | null;
  average: number | null;
  calibrated: number | null;
  feedback: EventFeedback | undefined;
  /** Algo já foi publicado (parcial ou final) — só então a nota oficial existe. */
  hasPublication: boolean;
  finalReleased: boolean;
  feedbackReleasedAtDate: Date | null;
  partialPublishedAtDate: Date | null;
  /** Dados do evento (critérios, avaliações, calibrações): carregando, com erro ou prontos. */
  dataState: "loading" | "error" | "ready";
};

function ScoreCell({ label, value, sub, tone = "preview", testId, valueTestId, children }: {
  label: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  tone?: "preview" | "official";
  testId?: string;
  valueTestId?: string;
  children?: ReactNode;
}) {
  return (
    <div data-testid={testId} className={cn("min-w-0 px-3 py-3 @lg:px-5 @lg:py-3.5", tone === "official" && "bg-secondary/60")}>
      <Eyebrow as="div" className={cn("flex items-center gap-1.5", tone === "official" && "text-foreground")}>{label}</Eyebrow>
      <div className="mt-2 flex items-baseline gap-x-2 gap-y-1 flex-wrap">
        <span data-testid={valueTestId} className="font-condensed text-[28px] @lg:text-[34px] font-black leading-none tracking-[-0.02em] tabular-nums text-foreground">{value}</span>
        {children}
      </div>
      <p className={cn("mt-1.5 text-[12.5px] leading-snug text-muted-foreground", tone === "preview" && "hidden @md:block")}>{sub}</p>
    </div>
  );
}

const per100 = <span className="font-condensed text-[15px] font-bold text-muted-foreground">/100</span>;

export function EventHero({
  event, teamCount, average, calibrated, feedback, hasPublication, finalReleased, feedbackReleasedAtDate, partialPublishedAtDate, dataState,
}: EventHeroProps) {
  const chip = calibrationEventChip(event);
  const place = event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location;
  const fmt = (d: string) => fmtDate(d, { day: "2-digit", month: "2-digit", year: "numeric" });
  const sameDay = !event.endDate || event.endDate === event.startDate;
  const notReady = dataState !== "ready";
  const pendingValue = dataState === "loading" ? <Bone className="h-[28px] @lg:h-[34px] w-16" /> : "—";
  const pendingSub = dataState === "loading" ? "Carregando…" : "Indisponível no momento.";
  const delta = average != null && calibrated != null ? calibrated - average : null;
  const pubLine = finalReleased
    ? (feedbackReleasedAtDate ? `Final publicado em ${formatDateTime(feedbackReleasedAtDate)}` : null)
    : partialPublishedAtDate ? `Parcial publicado em ${formatDateTime(partialPublishedAtDate)}` : null;

  return (
    <section aria-label="Evento" className="@container rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 @lg:px-6 pt-5 pb-4 flex flex-col @xl:flex-row @xl:items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>{event.clientName ? `Evento · ${event.clientName}` : "Evento"}</Eyebrow>
          <h2 className="font-condensed mt-2 text-[26px] md:text-[32px] font-black uppercase leading-[0.98] tracking-[-0.015em] text-foreground break-words">{event.name}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
            {event.startDate && <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} aria-hidden />{sameDay ? fmt(event.startDate) : `${fmt(event.startDate)} – ${fmt(event.endDate)}`}</span>}
            {place && <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden />{place}</span>}
            {teamCount != null && <span className="inline-flex items-center gap-1.5"><Users size={14} aria-hidden />Equipe de {plural(teamCount, "pessoa", "pessoas")}</span>}
          </p>
        </div>
        <div className="flex flex-col items-start @xl:items-end gap-2 @xl:shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tone={chip.tone} data-testid="cal-event-pub-chip">{chip.label}</Chip>
            <Link href={`/events/${event.id}`} className={btnSmall}>
              Ver evento <ArrowUpRight size={14} aria-hidden />
            </Link>
          </div>
          {pubLine && <p className="text-[12.5px] text-muted-foreground">{pubLine}</p>}
        </div>
      </div>

      {/* Placar: prévias (não valem) × nota oficial (publicada). */}
      <div data-testid="calibration-event-score" className="border-t border-border grid grid-cols-3 divide-x divide-border">
        <ScoreCell
          label="Média das avaliações"
          valueTestId="calibration-event-score-average"
          value={notReady ? pendingValue : average != null ? fmtNum(average, 1) : "—"}
          sub={notReady ? pendingSub : average != null ? "O que as áreas enviaram, sem calibração." : "Nenhuma avaliação enviada ainda."}
        >{!notReady && average != null && per100}</ScoreCell>
        <ScoreCell
          label="Com a calibração"
          valueTestId={calibrated != null ? "calibration-event-score-calibrated" : undefined}
          value={notReady ? pendingValue : calibrated != null ? fmtNum(calibrated, 1) : "—"}
          sub={notReady ? pendingSub : calibrated != null ? "Prévia com as notas calibradas, salvas ou digitadas." : "Aparece quando houver nota calibrada."}
        >
          {!notReady && calibrated != null && per100}
          {!notReady && delta != null && Math.abs(delta) >= 0.05 && (
            <Chip tone={delta > 0 ? "ok" : "warn"} className="self-center">{delta > 0 ? "+" : "−"}{fmtNum(Math.abs(delta), 1)}</Chip>
          )}
        </ScoreCell>
        <ScoreCell
          tone="official"
          label={<><ShieldCheck size={13} aria-hidden /> Nota oficial</>}
          value={!feedback ? <Bone className="h-[34px] w-20" /> : hasPublication
            ? <span data-testid="cal-final-score">{fmtNum(feedback.eventScore, 1)}</span>
            : <span data-testid="cal-final-score-none" className="text-muted-foreground" title="Nada publicado neste evento ainda: a nota oficial aparece depois de publicar">—</span>}
          sub={hasPublication ? "Publicada: é a que vale para o colaborador." : "Nada publicado ainda."}
        >{feedback && hasPublication && per100}</ScoreCell>
      </div>
      <p className="border-t border-border px-4 @lg:px-6 py-2.5 text-[12px] leading-snug text-muted-foreground">
        Média ponderada pelos pesos; critério de várias áreas entra pela média das áreas. As prévias não têm o desconto da Matriz de Conformidade.
      </p>
    </section>
  );
}
