// Topo fixo do Dashboard (o único h1): título, ciclo e "Atualizar" — mesma
// linguagem do topo de Resultados & Ranking.
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnGhost } from "./dashboard-ui";

export function DashboardHeader({ cycleSlot, refreshing, onRefresh, updatedAt }: {
  cycleSlot: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
  /** Hora da última leitura dos números (ms), para "Atualizado às HH:MM". */
  updatedAt: number | null;
}) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:gap-5">
      <h1 data-testid="text-page-title" className="order-1 min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">
        Painel de Controle
      </h1>
      <div className="order-3 col-span-2 lg:order-2 w-full lg:w-auto min-w-0">{cycleSlot}</div>
      <div className="order-2 lg:order-3 lg:ml-auto flex items-center gap-2 shrink-0">
        {time && (
          <span className="hidden xl:inline text-[12.5px] text-muted-foreground tabular-nums" aria-live="polite">
            {refreshing ? "Atualizando…" : `Atualizado às ${time}`}
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-busy={refreshing || undefined}
          aria-label="Atualizar os números do painel"
          title="Busca os números de novo"
          data-testid="button-dashboard-refresh"
          className={cn(btnGhost, "px-2.5 lg:px-3")}
        >
          <RefreshCw size={15} aria-hidden className={refreshing ? "motion-safe:animate-spin" : undefined} />
          <span className="hidden lg:inline">Atualizar</span>
        </button>
      </div>
    </div>
  );
}
