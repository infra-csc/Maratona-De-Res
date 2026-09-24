import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";

export type StatusVariant = "ok" | "warn" | "danger" | "info" | "neutral";

export interface StatusBadgeProps {
  variant: StatusVariant;
  /** Texto SEMPRE presente: a cor nunca é o único sinal. */
  label: React.ReactNode;
  icon?: LucideIcon;
  size?: "sm" | "md";
  /** Texto para leitores de tela quando o label for abreviado (ex.: "3/5" → "3 de 5 avaliadas"). */
  srLabel?: string;
  className?: string;
  "data-testid"?: string;
}

const STYLES: Record<StatusVariant, React.CSSProperties> = {
  ok: { color: "var(--status-ok-text)", backgroundColor: "var(--status-ok-bg)", borderColor: "color-mix(in srgb, var(--status-ok) 35%, transparent)" },
  warn: { color: "var(--status-warn-text)", backgroundColor: "var(--status-warn-bg)", borderColor: "color-mix(in srgb, var(--status-warn) 40%, transparent)" },
  danger: { color: "var(--status-danger-text)", backgroundColor: "var(--status-danger-bg)", borderColor: "color-mix(in srgb, var(--status-danger) 40%, transparent)" },
  info: { color: "var(--status-info-text)", backgroundColor: "var(--status-info-bg)", borderColor: "color-mix(in srgb, var(--status-info) 40%, transparent)" },
  neutral: { color: "var(--muted-foreground)", backgroundColor: "var(--muted)", borderColor: "var(--border)" },
};

/**
 * Chip de status semântico. Cores vêm dos tokens `--status-*` (index.css),
 * legíveis nos dois temas. Sempre exibe texto; ícone é reforço.
 */
export function StatusBadge({
  variant,
  label,
  icon: Icon,
  size = "md",
  srLabel,
  className,
  ...rest
}: StatusBadgeProps) {
  return (
    <span
      data-testid={rest["data-testid"]}
      data-variant={variant}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border font-bold uppercase",
        size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-[12px]",
        className,
      )}
      style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", ...STYLES[variant] }}
    >
      {Icon ? <Icon aria-hidden="true" size={size === "sm" ? 11 : 13} strokeWidth={2.5} /> : null}
      <span aria-hidden={srLabel ? true : undefined}>{label}</span>
      {srLabel ? <span className="sr-only">{srLabel}</span> : null}
    </span>
  );
}
