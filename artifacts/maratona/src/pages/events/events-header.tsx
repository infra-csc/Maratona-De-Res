// Topo da tela (o único h1, seletor de ciclo e ações) e o panorama do ciclo:
// quantos eventos, quantos abertos e o que falta publicar — num relance.
import type { ReactNode } from "react";
import { ArrowRight, CalendarCog } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Eyebrow, FOCUS_RING, btnGhost, surfaceCls } from "./events-ui";
import { hasPartialPublication, isPubFinal, type CycleEventCounts } from "./rules";
import type { EventItem } from "./types";

type EventsHeaderProps = {
  /** Título (muda no Total geral). */
  title?: string;
  /** Seletor de ciclo (atual, anteriores e Total geral). */
  cycleSlot: ReactNode;
  /** Só admin vê "Unificar Datas". */
  showNormalize: boolean;
  normalizePending: boolean;
  onNormalizePreview: () => void;
  /** Botão/diálogo "Novo Evento" (quando o usuário pode criar). */
  children?: ReactNode;
};

/**
 * Topo fixo no tablet e no desktop, como em Avaliações, Calibração e Central:
 * título, ciclo e as ações da tela.
 */
export function EventsHeader({ title = "Eventos do Ciclo", cycleSlot, showNormalize, normalizePending, onNormalizePreview, children }: EventsHeaderProps) {
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:gap-5">
      <h1 data-testid="text-page-title" className="order-1 min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">
        {title}
      </h1>
      <div className="order-3 col-span-2 lg:order-2 w-full lg:w-auto min-w-0">{cycleSlot}</div>
      {(showNormalize || children) && (
        <div className="order-2 lg:order-3 lg:ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
          {showNormalize && (
            <button
              type="button"
              onClick={onNormalizePreview}
              title="Unificar datas: mostra a prévia das datas que mudariam antes de aplicar"
              aria-label="Unificar datas"
              disabled={normalizePending}
              aria-busy={normalizePending || undefined}
              className={cn(btnGhost, "px-2.5 sm:px-3")}
            >
              <CalendarCog size={16} aria-hidden />
              <span className="hidden sm:inline">{normalizePending ? "Verificando…" : "Unificar datas"}</span>
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

type CellTone = "neutral" | "ok" | "warn" | "info";
const VALUE_TONE: Record<CellTone, string> = {
  neutral: "text-foreground",
  ok: "text-[var(--status-ok-text)]",
  warn: "text-[var(--status-warn-text)]",
  info: "text-[var(--status-info-text)]",
};

/** Uma célula do panorama. Com `onClick` vira atalho para o filtro (aria-pressed). */
function Cell({ label, value, sub, tone = "neutral", onClick, pressed, testId, title, className }: {
  label: ReactNode; value: ReactNode; sub: ReactNode; tone?: CellTone;
  onClick?: () => void; pressed?: boolean; testId?: string; title?: string; className?: string;
}) {
  const body = (
    <>
      <Eyebrow as="span" className={cn("block", pressed && "text-foreground")}>{label}</Eyebrow>
      <span className={cn("mt-2 block font-condensed text-[28px] lg:text-[32px] font-black leading-none tracking-[-0.02em] tabular-nums", VALUE_TONE[tone])}>{value}</span>
      <span className="mt-1.5 hidden sm:block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>
      {onClick && (
        <span className={cn("mt-2 hidden sm:inline-flex items-center gap-1 font-condensed text-[12px] font-bold uppercase tracking-[0.06em]", pressed ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
          {pressed ? "Filtro ativo · limpar" : "Filtrar a lista"}
          <ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      )}
    </>
  );
  const cls = cn("min-w-0 bg-card px-4 py-3.5 lg:px-5 lg:py-4 text-left", className);
  if (!onClick) return <div data-testid={testId} title={title} className={cls}>{body}</div>;
  return (
    <button type="button" data-testid={testId} title={title} onClick={onClick} aria-pressed={pressed}
      className={cn(cls, "group transition-colors duration-150 hover:bg-secondary/50", pressed && "bg-secondary/70 hover:bg-secondary/70", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
      {body}
    </button>
  );
}

/**
 * Panorama do ciclo: total (com os de fora do período), abertos e a situação da
 * publicação. As três últimas células filtram a lista pelo chip equivalente.
 */
export function EventsPanorama({ events: all, counts, cardFilter, setCardFilter }: {
  /** Todos os eventos do ciclo (sem filtro), base dos contadores. */
  events: EventItem[];
  /** Contagens pela regra única (countCycleEvents): as mesmas de Ciclos e da Central. */
  counts: CycleEventCounts;
  cardFilter: string | null;
  setCardFilter: (v: string | null) => void;
}) {
  const pendingPub = all.filter(e => (e.pendingPublishCount ?? 0) > 0).length;
  const partial = all.filter(e => hasPartialPublication(e)).length;
  const final = all.filter(e => isPubFinal(e)).length;
  const toggle = (key: string) => setCardFilter(cardFilter === key ? null : key);
  return (
    <section aria-label="Panorama do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-5 gap-px bg-border")}>
      <Cell
        className="col-span-2 lg:col-span-1"
        testId="events-stat-total"
        label="Eventos"
        value={counts.stored}
        title={counts.afterEnd > 0 ? `${counts.stored} na lista: ${counts.inPeriod} do período do ciclo e ${counts.afterEnd} fora do período (do próximo ciclo)` : undefined}
        sub={counts.afterEnd > 0
          ? <>{counts.inPeriod} do período · <span data-testid="events-stat-after-end">{counts.afterEnd} fora do período</span></>
          : "Todos do período do ciclo."}
      />
      <Cell
        testId="events-stat-open"
        label="Abertos"
        value={counts.open}
        title="Abertos: ainda não fechados, do período do ciclo e com a avaliação já aberta (a partir do dia seguinte ao fim do evento) — a mesma conta de Ciclos e da Central de Avaliações"
        sub={counts.notOpenYet > 0 ? `Avaliação aberta. Mais ${counts.notOpenYet} abre${counts.notOpenYet === 1 ? "" : "m"} depois do evento.` : "Avaliação aberta e ainda não fechados."}
      />
      <Cell
        testId="events-stat-pending-pub"
        label="Falta publicar"
        value={pendingPub}
        tone={pendingPub > 0 ? "warn" : "neutral"}
        title="Eventos com calibração salva e ainda não publicada: só vale na nota depois de publicar"
        sub={pendingPub > 0 ? `${plural(pendingPub, "evento com calibração salva", "eventos com calibração salva")}.` : "Nada salvo esperando publicação."}
        onClick={() => toggle("pendingPub")}
        pressed={cardFilter === "pendingPub"}
      />
      <Cell
        testId="events-stat-partial"
        label="Pub. parcial"
        value={partial}
        tone={partial > 0 ? "warn" : "neutral"}
        title="Publicação parcial: nem todos os critérios têm publicação final"
        sub="Nem todos os critérios com publicação final."
        onClick={() => toggle("partialPub")}
        pressed={cardFilter === "partialPub"}
      />
      <Cell
        testId="events-stat-final"
        label="Pub. final"
        value={final}
        tone={final > 0 ? "ok" : "neutral"}
        title="Publicação final: todos os critérios publicados"
        sub="Todos os critérios publicados: fechados."
        onClick={() => toggle("fullyEval")}
        pressed={cardFilter === "fullyEval"}
      />
    </section>
  );
}
