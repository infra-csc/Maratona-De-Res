// Barras de progresso das colunas Avaliações / Calibrações / Matriz.
import { GOOD, AMBER } from "@/lib/premium-theme";

export function MiniBar({ value, total, color, title }: { value: number; total: number; color: string; title?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1 w-full" title={title}>
      <div className="h-[5px] rounded-full w-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[11px] font-bold" style={{ color }}>{value}/{total}</span>
    </div>
  );
}

export function CalBar({ finalCount, partialCount, total }: { finalCount: number; partialCount: number; total: number }) {
  const safeTotal = total > 0 ? total : 1;
  const finalPct   = Math.min(100, (finalCount   / safeTotal) * 100);
  const partialPct = Math.min(100 - finalPct, (partialCount / safeTotal) * 100);
  const totalCount = finalCount + partialCount;
  const labelColor = finalCount === total && total > 0 ? GOOD
    : finalCount > 0 || partialCount > 0 ? AMBER
    : "var(--muted-foreground)";
  return (
    <div className="flex flex-col gap-1 w-full" title={`${finalCount} final · ${partialCount} parcial de ${total} critérios`}>
      <div className="relative h-[5px] rounded-full w-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
        {finalPct > 0 && (
          <div className="absolute left-0 top-0 h-full" style={{ width: `${finalPct}%`, backgroundColor: GOOD }} />
        )}
        {partialPct > 0 && (
          <div className="absolute top-0 h-full" style={{ left: `${finalPct}%`, width: `${partialPct}%`, backgroundColor: AMBER }} />
        )}
      </div>
      <span className="text-[11px] font-bold" style={{ color: labelColor }}>{totalCount}/{total}</span>
    </div>
  );
}
