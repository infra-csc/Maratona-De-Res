// Topo da página do colaborador: a nota do ciclo em destaque, a faixa, quanto
// falta para a próxima, o bônus (previsto ou oficial) e os eventos que contam
// para ter bônus. Ciclo novo sem nota tem a sua própria versão, explicando
// quando a nota aparece.
import type { MyPerformanceSummary } from "@workspace/api-client-react";
import { CalendarClock, CheckCircle2, Clock, Trophy } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { scoreLabel } from "./helpers";
import { Chip, Eyebrow, FaixaBadge, Meter, brl, n1, scoreInk, type Tone } from "./mp-ui";

type SummaryProps = { summary: MyPerformanceSummary };

const BONUS_STATUS: Record<string, { label: string; tone: Tone }> = {
  projected: { label: "Previsto", tone: "neutral" },
  approved: { label: "Aprovado", tone: "ok" },
  scheduled: { label: "Pagamento agendado", tone: "info" },
  paid: { label: "Pago", tone: "brand" },
  blocked: { label: "Bloqueado", tone: "danger" },
};

/** Nota, faixa e progresso até a próxima faixa. */
export function SummaryCards({ summary, result }: SummaryProps & { result: number | null }) {
  const closed = summary.isQuarterClosed;
  return (
    <section aria-label="Sua nota no ciclo" data-testid="my-score-hero" className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="p-5 sm:p-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Eyebrow as="p">Sua nota no ciclo</Eyebrow>
            {closed
              ? <Chip tone="ok" icon={CheckCircle2}>Resultado oficial</Chip>
              : <Chip tone="warn" icon={Clock} title="Pode mudar até o fechamento do ciclo">Parcial</Chip>}
          </div>
          {result != null ? <ScoreBlock summary={summary} result={result} /> : <NoScoreYet />}
        </div>
        <div className="border-t lg:border-t-0 lg:border-l border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 divide-y sm:divide-y-0 sm:divide-x lg:divide-x-0 lg:divide-y divide-border">
          <BonusCell summary={summary} />
          <EligibilityCell summary={summary} />
        </div>
      </div>
      {!closed && (
        <p className="flex items-start gap-2 border-t border-border bg-secondary/50 px-5 sm:px-6 py-3 text-[13px] leading-snug text-muted-foreground">
          <Clock size={14} aria-hidden className="mt-0.5 shrink-0" />
          O ciclo ainda está aberto: sua nota e seu bônus são uma previsão e podem mudar até o fechamento.
        </p>
      )}
    </section>
  );
}

function ScoreBlock({ summary, result }: SummaryProps & { result: number }) {
  const { currentPlatoon: faixa, currentPlatoonColor: color, currentPlatoonMinScore: min, currentPlatoonMaxScore: max, nextPlatoon, nextPlatoonMinScore } = summary;
  const pct = min != null && max != null && max > min ? ((result - min) / (max - min)) * 100 : null;
  const gap = nextPlatoonMinScore != null ? Math.max(0, nextPlatoonMinScore - result) : null;
  return (
    <>
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <p className="flex items-baseline gap-1.5" data-testid="my-final-score">
          <span className={cn("font-condensed text-[76px] sm:text-[88px] font-black leading-[0.8] tracking-[-0.03em] tabular-nums", scoreInk(result))}>{n1(result)}</span>
          <span className="font-condensed text-[18px] font-bold text-muted-foreground">/100</span>
        </p>
        <div className="pb-1 flex flex-col items-start gap-1.5">
          {faixa && <FaixaBadge name={faixa} color={color} size="lg" />}
          <span className="text-[13px] font-semibold text-muted-foreground">{scoreLabel(result)}</span>
        </div>
      </div>

      {faixa && pct != null && (
        <div className="mt-5" data-testid="my-next-faixa">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px] font-semibold tabular-nums text-muted-foreground">
            <span>Faixa {faixa} · {fmtNum(min!, 0)}</span>
            {nextPlatoon && nextPlatoonMinScore != null
              ? <span>{nextPlatoon} · {fmtNum(nextPlatoonMinScore, 0)}</span>
              : <span>até {fmtNum(max!, 0)}</span>}
          </div>
          <Meter className="mt-1.5 h-2" pct={pct} fill={color ?? "var(--foreground)"} label={`Você está a ${Math.round(pct)}% do caminho dentro da faixa ${faixa}`} />
          <p className="mt-2.5 text-[14.5px] leading-snug text-foreground">
            {nextPlatoon && gap != null ? (
              gap > 0
                ? <>Faltam <strong className="font-condensed text-[18px] font-black tabular-nums">{fmtNum(gap, 1)}</strong> pontos na nota para chegar na faixa <strong>{nextPlatoon}</strong>.</>
                : <>Você já tem nota para a faixa <strong>{nextPlatoon}</strong>.</>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold"><Trophy size={15} aria-hidden className="text-[var(--status-ok-text)]" /> Você está na faixa mais alta.</span>
            )}
          </p>
        </div>
      )}
    </>
  );
}

/** Ciclo novo: ainda não há evento com nota. */
function NoScoreYet() {
  return (
    <div className="mt-3" data-testid="my-no-score">
      <p className="font-condensed text-[34px] sm:text-[40px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-foreground">Ainda sem nota</p>
      <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground max-w-[46ch]">
        Sua nota aparece aqui quando o primeiro evento do ciclo for avaliado e o RH confirmar o resultado. A avaliação de cada evento abre no dia seguinte ao fim dele.
      </p>
    </div>
  );
}

function BonusCell({ summary }: SummaryProps) {
  const closed = summary.isQuarterClosed;
  const status = summary.bonusStatus ? BONUS_STATUS[summary.bonusStatus] : undefined;
  const value = summary.projectedBonus;
  const has = summary.eligible && value != null && value > 0;
  const target = summary.minEventsForEligibility ?? 8;
  const done = summary.participatedEventsCount ?? summary.confirmedEvents ?? 0;
  const missing = Math.max(0, target - done);
  return (
    <div className="p-5 sm:p-6 min-w-0" data-testid="my-bonus">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow as="p">{closed ? "Bônus do ciclo" : "Bônus previsto"}</Eyebrow>
        {has && status && closed && <Chip tone={status.tone}>{status.label}</Chip>}
      </div>
      {has ? (
        <>
          <p className="mt-2 font-condensed text-[34px] font-black leading-none tabular-nums text-foreground">{brl(value!)}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
            {closed ? "Valor oficial do ciclo." : "Se a sua nota e seus eventos ficarem como estão até o fechamento."}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 font-condensed text-[26px] font-black uppercase leading-none text-muted-foreground">Sem bônus{closed ? "" : " por enquanto"}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
            {missing > 0
              ? <>Para ter bônus, é preciso ter {plural(target, "evento", "eventos")} com resultado confirmado no ciclo.</>
              : closed ? "Você não entrou no bônus deste ciclo." : "Você ainda não está no bônus deste ciclo."}
          </p>
        </>
      )}
    </div>
  );
}

function EligibilityCell({ summary }: SummaryProps) {
  // Elegibilidade conta eventos PARTICIPADOS (mesma métrica do RH), não eventos com nota.
  const done = summary.participatedEventsCount ?? summary.confirmedEvents ?? 0;
  const target = summary.minEventsForEligibility ?? 8;
  const reached = done >= target;
  const missing = Math.max(0, target - done);
  return (
    <div className="p-5 sm:p-6 min-w-0" data-testid="my-eligibility">
      <Eyebrow as="p">Eventos que contam</Eyebrow>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-condensed text-[34px] font-black leading-none tabular-nums text-foreground">{done}</span>
        <span className="font-condensed text-[16px] font-bold text-muted-foreground">de {target} para ter bônus</span>
      </p>
      <ol aria-label={`${done} de ${target} eventos`} className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(target, 12)}, minmax(0, 1fr))` }}>
        {Array.from({ length: target }, (_, i) => (
          <li key={i} aria-hidden className={cn("h-2 rounded-full transition-colors duration-300", i < done ? (reached ? "bg-[var(--status-ok)]" : "bg-foreground") : "bg-secondary")} />
        ))}
      </ol>
      <p className={cn("mt-2.5 flex items-center gap-1.5 text-[13px] font-semibold", reached ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>
        {reached
          ? <><CheckCircle2 size={14} aria-hidden /> Meta de eventos atingida</>
          : <><CalendarClock size={14} aria-hidden /> {missing === 1 ? "Falta 1 evento" : `Faltam ${missing} eventos`}</>}
      </p>
    </div>
  );
}
