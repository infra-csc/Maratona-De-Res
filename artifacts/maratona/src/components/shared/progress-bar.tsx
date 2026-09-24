import * as React from "react";
import { cn } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";

export interface ProgressBarProps {
  /** Quantidade concluída. É limitada a [0, total]. */
  value: number;
  /** Total. Padrão 100 (value já em %). */
  total?: number;
  /** Cor da barra. Qualquer cor completa: `var(--accent)`, `WARNING`, `#hex`. */
  color?: string;
  /** Rótulo visível à esquerda. Sem rótulo, informe `aria-label`. */
  label?: React.ReactNode;
  /** Texto à direita. Padrão: "value/total" quando total ≠ 100, senão "NN%". */
  valueText?: React.ReactNode;
  /** Oculta o texto à direita (mantém o aria). */
  hideValue?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}

/**
 * Barra de progresso acessível (`role="progressbar"` com aria-valuenow/max).
 * Sem dependência do Radix: é uma div com largura em %.
 */
export function ProgressBar({
  value,
  total = 100,
  color = "var(--accent)",
  label,
  valueText,
  hideValue = false,
  size = "md",
  className,
  ...rest
}: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 1;
  const clamped = Math.min(Math.max(value, 0), safeTotal);
  const pct = (clamped / safeTotal) * 100;
  const defaultText = total === 100 ? `${Math.round(pct)}%` : `${clamped}/${safeTotal}`;
  const labelId = React.useId();
  const hasLabel = label !== undefined && label !== null;

  return (
    <div data-testid={rest["data-testid"]} className={cn("w-full", className)}>
      {(hasLabel || !hideValue) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {hasLabel ? (
            <span
              id={labelId}
              className="truncate text-[11px] font-bold uppercase"
              style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}
            >
              {label}
            </span>
          ) : <span />}
          {!hideValue ? (
            <span
              className="shrink-0 text-[12px] font-bold tabular-nums"
              style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}
            >
              {valueText ?? defaultText}
            </span>
          ) : null}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={clamped}
        aria-valuetext={typeof (valueText ?? defaultText) === "string" ? String(valueText ?? defaultText) : undefined}
        aria-labelledby={hasLabel ? labelId : undefined}
        aria-label={!hasLabel ? rest["aria-label"] : undefined}
        className={cn("w-full overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2.5")}
        style={{ backgroundColor: "var(--muted)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
