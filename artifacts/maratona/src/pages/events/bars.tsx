// Barras de progresso das colunas Avaliações / Publicadas / Matriz: trilho fino
// + número "feito/total" na fonte condensada (o número também vai para o leitor
// de tela; a cor nunca é o único sinal).
import { cn } from "@/lib/utils";

export type BarTone = "ok" | "progress" | "warn" | "muted";

const FILL: Record<BarTone, string> = {
  ok: "bg-[var(--status-ok)]",
  progress: "bg-foreground/70",
  warn: "bg-[var(--status-warn)]",
  muted: "bg-border",
};
const TEXT: Record<BarTone, string> = {
  ok: "text-[var(--status-ok-text)]",
  progress: "text-foreground",
  warn: "text-[var(--status-warn-text)]",
  muted: "text-muted-foreground",
};

function Track({ children }: { children: React.ReactNode }) {
  return <span aria-hidden className="relative block h-1.5 w-full rounded-full bg-secondary overflow-hidden">{children}</span>;
}

/** Barra simples: `value` de `total`. Sem nada feito, o número fica cinza. */
export function MiniBar({ value, total, tone, title, srLabel }: { value: number; total: number; tone: BarTone; title?: string; srLabel?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const t: BarTone = value === 0 ? "muted" : tone;
  return (
    <span className="flex flex-col gap-1.5 w-full" title={title}>
      <Track>
        <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 motion-reduce:transition-none", FILL[t])} style={{ width: `${pct}%` }} />
      </Track>
      <span className={cn("font-condensed text-[14px] font-bold leading-none tabular-nums", TEXT[t])}>
        <span aria-hidden>{value}/{total}</span>
        <span className="sr-only">{srLabel ?? `${value} de ${total}`}</span>
      </span>
    </span>
  );
}

/** Publicadas: final (verde) + só parcial (âmbar) sobre o total de critérios. */
export function CalBar({ finalCount, partialCount, total }: { finalCount: number; partialCount: number; total: number }) {
  const safeTotal = total > 0 ? total : 1;
  const finalPct = Math.min(100, (finalCount / safeTotal) * 100);
  const partialPct = Math.min(100 - finalPct, (partialCount / safeTotal) * 100);
  const totalCount = finalCount + partialCount;
  const t: BarTone = finalCount === total && total > 0 ? "ok" : totalCount > 0 ? "warn" : "muted";
  const label = `${finalCount} final · ${partialCount} parcial de ${total} critérios publicados`;
  return (
    <span className="flex flex-col gap-1.5 w-full" title={label}>
      <Track>
        {finalPct > 0 && <span className="absolute inset-y-0 left-0 bg-[var(--status-ok)]" style={{ width: `${finalPct}%` }} />}
        {partialPct > 0 && <span className="absolute inset-y-0 bg-[var(--status-warn)]" style={{ left: `${finalPct}%`, width: `${partialPct}%` }} />}
      </Track>
      <span className={cn("font-condensed text-[14px] font-bold leading-none tabular-nums", TEXT[t])}>
        <span aria-hidden>{totalCount}/{total}</span>
        <span className="sr-only">{label}</span>
      </span>
    </span>
  );
}
