import * as React from "react";
import { cn } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";

export interface SectionLabelProps {
  children: React.ReactNode;
  /** Elemento renderizado. Use h2/h3 quando abre uma seção; `p`/`span` para rótulos soltos. */
  as?: "h2" | "h3" | "h4" | "p" | "span" | "div";
  /** Conteúdo à direita (contador, link "ver tudo"). */
  trailing?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Rótulo de seção: 11px, uppercase, tracking 0.08em, cor muted. É o "eyebrow"
 * que separa blocos dentro de uma página ou de um card.
 */
export function SectionLabel({
  children,
  as: Tag = "h2",
  trailing,
  className,
  ...rest
}: SectionLabelProps) {
  const label = (
    <Tag
      className="text-[11px] font-bold uppercase leading-none"
      style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}
    >
      {children}
    </Tag>
  );

  if (!trailing) {
    return (
      <div data-testid={rest["data-testid"]} className={cn(className)}>
        {label}
      </div>
    );
  }

  return (
    <div
      data-testid={rest["data-testid"]}
      className={cn("flex items-center justify-between gap-3", className)}
    >
      {label}
      <div className="shrink-0 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
        {trailing}
      </div>
    </div>
  );
}
