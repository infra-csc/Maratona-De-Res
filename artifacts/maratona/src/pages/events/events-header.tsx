// Cabeçalho da tela: título, seletor de ciclo, contadores rápidos e botões de ação.
import type { ReactNode } from "react";
import { CONDENSED, AMBER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { hasPartialPublication, isPubFinal, type CycleEventCounts } from "./rules";
import type { EventItem } from "./types";

type EventsHeaderProps = {
  /** Título (muda no Total geral). */
  title?: string;
  /** Seletor de ciclo (atual, anteriores e Total geral). */
  cycleSlot: ReactNode;
  /** Todos os eventos do ciclo (sem filtro), base dos contadores. */
  events: EventItem[];
  /** Contagens pela regra única (countCycleEvents): total, fora do período e abertos — as mesmas de Ciclos e da Central. */
  counts: CycleEventCounts;
  /** Só admin vê "Unificar Datas". */
  showNormalize: boolean;
  normalizePending: boolean;
  onNormalizePreview: () => void;
  /** Botão/diálogo "Novo Evento" (quando o usuário pode criar). */
  children?: ReactNode;
};

export function EventsHeader({ title = "Eventos do Ciclo", cycleSlot, events: all, counts, showNormalize, normalizePending, onNormalizePreview, children }: EventsHeaderProps) {
  return (
    <div className="px-4 sm:px-6 py-4 flex items-center gap-x-5 gap-y-3 shrink-0 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] block" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Gerenciar</span>
        <h1 data-testid="text-page-title" className="font-black uppercase text-2xl tracking-tight leading-none mt-0.5" style={{ fontFamily: CONDENSED }}>{title}</h1>
      </div>

      <div className="w-full sm:w-auto shrink-0">{cycleSlot}</div>

      {/* Quick stats — no celular, 4 colunas iguais na largura toda (antes a
          faixa passava da tela e cortava "Pub. Final"). */}
      <div className="grid w-full grid-cols-4 rounded-lg border py-2 sm:flex sm:w-auto sm:shrink-0 sm:items-stretch sm:rounded-none sm:border-y-0 sm:border-r-0 sm:py-0 sm:pl-5"
        style={{ borderColor: "var(--border)" }}>
        {[
          {
            val: counts.stored, label: "Eventos", color: "var(--foreground)", testId: "events-stat-total",
            note: counts.afterEnd > 0 ? `${counts.afterEnd} fora do período` : null,
            title: counts.afterEnd > 0 ? `${counts.stored} na lista: ${counts.inPeriod} do período do ciclo e ${counts.afterEnd} fora do período (do próximo ciclo)` : undefined,
          },
          {
            val: counts.open, label: "Abertos", color: "var(--accent-text)", testId: "events-stat-open", note: null,
            title: "Abertos: ainda não fechados, do período do ciclo e com a avaliação já aberta (a partir do dia seguinte ao fim do evento) — a mesma conta de Ciclos e da Central de Avaliações",
          },
          { val: all.filter(e => hasPartialPublication(e)).length, label: "Pub. Parcial", color: AMBER_TEXT, testId: "events-stat-partial", note: null, title: undefined },
          { val: all.filter(e => isPubFinal(e)).length, label: "Pub. Final", color: GOOD_TEXT, testId: "events-stat-final", note: null, title: undefined },
        ].map((s, i) => (
          <div key={i} data-testid={s.testId} title={s.title} className="min-w-0 px-1 sm:px-4 text-center" style={{ borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
            <span className="block font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: s.color }}>{s.val}</span>
            <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
            {s.note && <span className="block text-[10px] leading-tight mt-0.5" style={{ color: "var(--muted-foreground)" }}>({s.note})</span>}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {showNormalize && (
          <button
            onClick={onNormalizePreview}
            title="Mostra a prévia das datas que mudariam antes de aplicar"
            disabled={normalizePending}
            className="h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            {normalizePending ? "..." : "Unificar Datas"}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
