// Peças visuais próprias da Calibração. O resto (Chip, Eyebrow, botões,
// cabeçalho de diálogo) vem de ../evaluations/ui — a mesma linguagem das
// telas de Avaliações e do link público.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Foco visível padrão (anel do sistema). */
export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Campo de texto pequeno (peso, nota, comentários): 44 px no toque, compacto com mouse. */
export const fieldCls = "rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/25";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Classe do botão quando escolhido (padrão: cartão sobre o trilho). */
  activeCls?: string;
  title?: string;
  ariaLabel?: string;
  testId?: string;
};

/**
 * Alternância de poucas opções (aria-pressed): trilho cinza, a escolhida em
 * destaque. `size="sm"` para dentro de linhas densas (36 px com mouse, 44 no toque).
 */
export function Segmented<T extends string>({ value, options, onChange, label, size = "md", className, disabled }: {
  value: T | null;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex gap-0.5 p-0.5 rounded-lg bg-secondary", className)}>
      {options.map(o => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.ariaLabel}
            title={o.title}
            data-testid={o.testId}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "font-condensed flex-1 inline-flex items-center justify-center gap-1 rounded-md font-bold uppercase tracking-[0.04em] leading-none whitespace-nowrap",
              "transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              size === "sm" ? "min-h-11 lg:min-h-8 px-2 text-[12.5px]" : "min-h-11 lg:min-h-10 px-3 text-[13px]",
              on ? (o.activeCls ?? "bg-card text-foreground shadow-sm") : "text-muted-foreground enabled:hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Esqueleto (carregando) — respeita "reduzir movimento". */
export function Bone({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded-md bg-secondary motion-safe:animate-pulse", className)} />;
}
