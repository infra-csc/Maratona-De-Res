import type { RankingEntry } from "@workspace/api-client-react";
import { Crown } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { initials } from "./helpers";
import { FaixaBadge } from "./badges";
import { Eyebrow, FOCUS_RING, surfaceCls } from "./results-ui";

/** Medalhas: a cor só no anel/topo do degrau; o texto fica no contraste do tema. */
export const MEDAL: Record<1 | 2 | 3, { ring: string; tint: string; label: string }> = {
  1: { ring: "#D4A017", tint: "rgba(212,160,23,0.14)", label: "Ouro" },
  2: { ring: "#9AA1A9", tint: "rgba(154,161,169,0.16)", label: "Prata" },
  3: { ring: "#B87333", tint: "rgba(184,115,51,0.14)", label: "Bronze" },
};

const HEIGHT: Record<1 | 2 | 3, string> = { 1: "h-[72px]", 2: "h-[54px]", 3: "h-[42px]" };

export function PodiumStage({ top3, canViewDetail, onSelect, className }: { top3: RankingEntry[]; canViewDetail: boolean; onSelect: (id: number) => void; className?: string }) {
  // Pódio clássico na tela: 2º à esquerda · 1º no centro · 3º à direita
  // (ordem visual por CSS; o leitor de tela ouve 1º, 2º, 3º).
  const slots: (RankingEntry | undefined)[] = [top3[0], top3[1], top3[2]];
  const ranks: (1 | 2 | 3)[] = [1, 2, 3];

  return (
    <section aria-label="Pódio" className={cn(surfaceCls, "overflow-hidden", className)}>
      <div className="px-4 pt-3.5 pb-1 flex items-center justify-between">
        <Eyebrow as="h2">Pódio</Eyebrow>
        <span className="text-[12px] text-muted-foreground">Os 3 primeiros</span>
      </div>
      <ol className="flex items-end px-2">
        {slots.map((entry, i) => {
          const rank = ranks[i];
          const med = MEDAL[rank];
          const first = rank === 1;
          if (!entry) return <li key={i} className={cn("flex-1", rank === 2 ? "order-1" : rank === 1 ? "order-2" : "order-3")} aria-hidden />;
          return (
            <li key={entry.employeeId} className={cn("flex-1 min-w-0", first ? "order-2" : rank === 2 ? "order-1" : "order-3")}>
              <button
                type="button"
                data-testid={`podium-card-${entry.employeeId}`}
                onClick={canViewDetail ? () => onSelect(entry.employeeId) : undefined}
                aria-label={`${rank}º lugar: ${entry.employeeName}, nota ${fmtNum(entry.finalResult, 1)}${canViewDetail ? ". Ver ficha" : ""}`}
                className={cn("group w-full flex flex-col items-center pt-2 rounded-t-lg", canViewDetail ? "cursor-pointer" : "cursor-default", FOCUS_RING)}
              >
                <span className="h-4 flex items-center" aria-hidden>{first && <Crown size={14} style={{ color: med.ring }} />}</span>
                <span
                  aria-hidden
                  className={cn("mt-1 rounded-full flex items-center justify-center font-condensed font-black text-foreground transition-transform duration-150 motion-safe:group-hover:-translate-y-0.5", first ? "w-14 h-14 text-[18px]" : "w-11 h-11 text-[14px]")}
                  style={{ backgroundColor: med.tint, boxShadow: `inset 0 0 0 2px ${med.ring}` }}
                >
                  {initials(entry.employeeName)}
                </span>
                <span className={cn("mt-1.5 font-condensed font-black leading-none tabular-nums", first ? "text-[24px]" : "text-[19px]")} data-testid={`text-podium-result-${entry.employeeId}`}>
                  {fmtNum(entry.finalResult, 1)}
                </span>
                <span data-testid={`text-podium-name-${entry.employeeId}`} className="mt-1 w-full px-1 text-center font-condensed text-[12.5px] font-bold uppercase leading-tight text-muted-foreground group-hover:text-foreground truncate">
                  {entry.employeeName.split(" ").slice(0, 2).join(" ")}
                </span>
                {entry.platoon && <span className="mt-1 mb-2 max-w-full"><FaixaBadge name={entry.platoon} color={entry.platoonColor} compact /></span>}
                {!entry.platoon && <span className="mb-2" />}
                <span className={cn("w-full flex flex-col items-center justify-center rounded-t-md", HEIGHT[rank])} style={{ backgroundColor: med.tint, borderTop: `3px solid ${med.ring}` }}>
                  <span className={cn("font-condensed font-black leading-none", first ? "text-[24px]" : "text-[19px]")}>{rank}º</span>
                  <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{med.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
