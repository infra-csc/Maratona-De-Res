import { Crown } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";
import { contrastingTextColor, initials } from "./helpers";

const MEDAL: Record<1 | 2 | 3, { color: string; dimColor: string; bg: string; border: string; platformH: number; label: string }> = {
  1: { color: "#FFD700", dimColor: "#B8860B", bg: "rgba(255,215,0,0.13)", border: "rgba(255,215,0,0.55)", platformH: 72, label: "Ouro" },
  2: { color: "#D0D0D0", dimColor: "#888",    bg: "rgba(192,192,192,0.10)", border: "rgba(192,192,192,0.45)", platformH: 56, label: "Prata" },
  3: { color: "#CD7F32", dimColor: "#8B4513", bg: "rgba(205,127,50,0.11)", border: "rgba(205,127,50,0.45)", platformH: 46, label: "Bronze" },
};

export function PodiumStage({ top3, canViewDetail, onSelect }: { top3: any[]; canViewDetail: boolean; onSelect: (id: number) => void }) {
  // Classic podium layout: 2nd left · 1st centre · 3rd right
  const slots: [any | undefined, any | undefined, any | undefined] = [top3[1], top3[0], top3[2]];
  const ranks: (1 | 2 | 3)[] = [2, 1, 3];

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="flex items-end">
        {slots.map((entry, i) => {
          const rank = ranks[i];
          const med = MEDAL[rank];
          const isFirst = rank === 1;
          if (!entry) return <div key={i} className="flex-1" />;
          return (
            <button
              key={entry.employeeId}
              type="button"
              data-testid={`podium-card-${entry.employeeId}`}
              onClick={canViewDetail ? () => onSelect(entry.employeeId) : undefined}
              className={cn("flex-1 flex flex-col items-center gap-0 pt-4 pb-0 outline-none", canViewDetail && "cursor-pointer hover:opacity-80 transition-opacity")}
            >
              {/* Crown / spacer */}
              <div className="h-5 flex items-center justify-center mb-1">
                {isFirst && <Crown size={15} style={{ color: med.color }} />}
              </div>

              {/* Avatar circle */}
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ width: isFirst ? 54 : 42, height: isFirst ? 54 : 42, backgroundColor: med.bg, border: `2px solid ${med.border}` }}>
                <span style={{ fontFamily: CONDENSED, fontWeight: 900, fontSize: isFirst ? 17 : 13, color: med.color }}>
                  {initials(entry.employeeName)}
                </span>
              </div>

              {/* Score */}
              <span className="font-black leading-none mt-1.5"
                data-testid={`text-podium-result-${entry.employeeId}`}
                style={{ fontFamily: CONDENSED, fontSize: isFirst ? 22 : 17, color: "var(--foreground)" }}>
                {fmtNum(entry.finalResult, 1)}
              </span>

              {/* Tier badge */}
              {(entry as any).platoonColor && (
                <span
                  className="inline-flex items-center text-[11px] font-black uppercase px-2 py-0.5 rounded-full mt-0.5"
                  style={{ backgroundColor: (entry as any).platoonColor, color: contrastingTextColor((entry as any).platoonColor) }}
                >
                  {(entry as any).platoon ?? `${(entry as any).platoonMinScore}–${(entry as any).platoonMaxScore}`}
                </span>
              )}

              {/* Name (first two words) */}
              <p data-testid={`text-podium-name-${entry.employeeId}`}
                className="text-[11px] font-bold uppercase text-center w-full px-1 mt-0.5 mb-2 leading-tight"
                style={{ color: "var(--muted-foreground)" }}>
                {entry.employeeName.split(" ").slice(0, 2).join(" ")}
              </p>

              {/* Platform block */}
              <div className="w-full flex flex-col items-center justify-center rounded-t-sm"
                style={{ height: med.platformH, backgroundColor: med.bg, borderTop: `2px solid ${med.border}` }}>
                <span style={{ fontFamily: CONDENSED, fontWeight: 900, fontSize: isFirst ? 26 : 20, color: "var(--foreground)", lineHeight: 1 }}>
                  #{rank}
                </span>
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{med.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
