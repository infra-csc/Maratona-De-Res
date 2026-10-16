// Peças visuais da Linha do tempo. A base — Chip, Eyebrow, botões, faixa de
// indicadores, busca, blocos de vazio/erro — vem das telas já redesenhadas
// (Resultados, Ciclos, Colaboradores, Critérios e Penalidades): um produto só.
import type { ReactNode } from "react";
import { cn, faixaEdge } from "@/lib/utils";
import { contrastingTextColor } from "../results/helpers";

export {
  Chip, Eyebrow, btnPrimary, btnSecondary, btnSmall, btnGhost, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, iconBtn, StatCell, SearchField, Segmented, selectCls, type Tone,
} from "../criteria/criteria-ui";
export { Avatar } from "../employees/ui";
export { VizTooltipBox } from "../analytics-person/ui";

/** Cor dos números de alta/queda (tinta de texto com contraste AA nos dois temas). */
export const UP_TEXT = "text-[var(--status-ok-text)]";
export const DOWN_TEXT = "text-[var(--status-danger-text)]";

/**
 * Selo de faixa com a cor do cadastro. `strong` (a faixa de agora) vem cheio
 * na cor da faixa; o "antes" fica com contorno e um quadradinho da cor. Faixa
 * clara ganha contorno para não sumir no fundo. O nome nunca é cortado.
 */
export function FaixaChip({ name, color, strong, className }: { name: string | null | undefined; color: string | null; strong?: boolean; className?: string }) {
  const base = "font-condensed inline-flex items-center gap-1.5 min-h-6 px-2 py-[3px] rounded-md text-[12px] font-bold uppercase tracking-[0.04em] leading-none max-w-full";
  if (!name) return <span className={cn(base, "border border-dashed border-border text-muted-foreground", className)}>Sem faixa</span>;
  if (strong && color) {
    return (
      <span className={cn(base, className)} style={{ backgroundColor: color, color: contrastingTextColor(color), ...faixaEdge(color) }}>
        <span className="min-w-0 break-words">{name}</span>
      </span>
    );
  }
  return (
    <span className={cn(base, "border border-border text-foreground", className)}>
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: color ?? "var(--muted-foreground)", ...faixaEdge(color) }} />
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}

/** Bloco com cabeçalho (eyebrow + título + frase de apoio) e conteúdo. */
export function Panel({ title, eyebrow, hint, action, children, className, bodyCls, labelledBy, testId }: {
  title: ReactNode; eyebrow?: ReactNode; hint?: ReactNode; action?: ReactNode; children: ReactNode;
  className?: string; bodyCls?: string; labelledBy: string; testId?: string;
}) {
  return (
    <section aria-labelledby={labelledBy} data-testid={testId} className={cn("rounded-2xl border border-border bg-card min-w-0", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 lg:px-5 lg:pt-5">
        <div className="min-w-0">
          {eyebrow && <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-muted-foreground mb-1.5">{eyebrow}</p>}
          <h2 id={labelledBy} className="font-condensed text-[19px] font-black uppercase leading-none tracking-[-0.005em] text-foreground">{title}</h2>
          {hint && <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground max-w-[70ch]">{hint}</p>}
        </div>
        {action}
      </header>
      <div className={cn("px-4 pb-4 pt-3 lg:px-5 lg:pb-5", bodyCls)}>{children}</div>
    </section>
  );
}

/** Variação de nota: seta + número com sinal, no tom da direção (cor nunca é o único sinal). */
export function DeltaPill({ d, className }: { d: number; className?: string }) {
  const up = d > 0;
  return (
    <span className={cn(
      "font-condensed inline-flex items-center gap-0.5 h-6 px-1.5 rounded-md text-[13px] font-bold tabular-nums leading-none whitespace-nowrap",
      up ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
      className,
    )}>
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      <span className="sr-only">{up ? "subiu " : "caiu "}</span>
      {`${up ? "+" : "−"}${Math.abs(d).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
    </span>
  );
}
