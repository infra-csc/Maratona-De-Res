// Topo fixo de Resultados & Ranking (o único h1): título, ciclo e as ações do
// ciclo — recalcular e fechar —, à mão em qualquer aba.
import type { ReactNode } from "react";
import { Lock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, btnGhost } from "./results-ui";

export function ResultsHeader({ cycleSlot, actions, closedLabel, recompute }: {
  cycleSlot: ReactNode;
  /** Botão/diálogo "Fechar ciclo" (só no ciclo atual aberto, para quem gerencia). */
  actions?: ReactNode;
  /** Ciclo atual já fechado: selo no lugar das ações. */
  closedLabel?: string | null;
  /** Recalcular (só no ciclo atual aberto, para quem gerencia). */
  recompute?: { run: () => void; pending: boolean } | null;
}) {
  const hasActions = !!(actions || closedLabel || recompute);
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:gap-5">
      <h1 data-testid="text-page-title" className="order-1 min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">
        Resultados &amp; Ranking
      </h1>
      <div className="order-3 col-span-2 lg:order-2 w-full lg:w-auto min-w-0">{cycleSlot}</div>
      {hasActions && (
        <div className="order-2 lg:order-3 lg:ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">
          {closedLabel && <Chip icon={Lock} data-testid="chip-cycle-closed">{closedLabel}</Chip>}
          {recompute && (
            <button
              type="button"
              data-testid="button-recompute-quarter"
              onClick={recompute.run}
              disabled={recompute.pending}
              aria-busy={recompute.pending || undefined}
              aria-label="Recalcular ciclo"
              title="Recalcula os resultados do ciclo atual agora, sem fechar o ciclo (ex.: após alterar o cargo de um colaborador)"
              className={cn(btnGhost, "px-2.5 lg:px-3")}
            >
              <RefreshCw size={15} aria-hidden className={recompute.pending ? "motion-safe:animate-spin" : undefined} />
              <span className="hidden lg:inline">{recompute.pending ? "Recalculando…" : "Recalcular"}</span>
            </button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
