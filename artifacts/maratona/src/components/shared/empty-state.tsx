import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONDENSED, BODY } from "@/lib/premium-theme";

export interface EmptyStateProps {
  /** Ícone lucide (ex.: `Inbox`, `SearchX`). Decorativo — o texto carrega o sentido. */
  icon?: LucideIcon;
  title: React.ReactNode;
  /** O que fazer para sair desse estado. Evite só "Nenhum item". */
  description?: React.ReactNode;
  /** Botão/link de ação (já pronto, ex.: `<Button>Novo evento</Button>`). */
  action?: React.ReactNode;
  /** Versão menor para dentro de cards/tabelas. */
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * Estado vazio com a linguagem premium: borda tracejada, ícone em círculo
 * neutro, título condensado. Use quando uma lista/consulta não tem resultados.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      role="status"
      data-testid={rest["data-testid"]}
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
      style={{ border: "1px dashed var(--border)", backgroundColor: "var(--card)" }}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            compact ? "size-9" : "size-12",
          )}
          style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
        >
          <Icon size={compact ? 16 : 22} strokeWidth={2} />
        </span>
      ) : null}
      <p
        className={cn("font-black uppercase leading-tight", compact ? "text-[15px]" : "text-[19px]")}
        style={{ fontFamily: CONDENSED, letterSpacing: "-0.01em", color: "var(--foreground)" }}
      >
        {title}
      </p>
      {description ? (
        <p
          className="max-w-sm text-[13px] leading-relaxed"
          style={{ fontFamily: BODY, color: "var(--muted-foreground)" }}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
