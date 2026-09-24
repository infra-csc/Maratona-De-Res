import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  /** Quantidade de linhas fantasma. Padrão 3. */
  lines?: number;
  /** Adiciona um bloco de título antes das linhas. */
  withHeader?: boolean;
  /** Texto anunciado por leitores de tela. Padrão "Carregando…". */
  label?: string;
  className?: string;
  "data-testid"?: string;
}

/**
 * Skeleton de N linhas com `role="status"`: anuncia uma vez e não pisca
 * texto na tela. Substitui os "Carregando..." soltos das páginas.
 */
export function LoadingState({
  lines = 3,
  withHeader = false,
  label = "Carregando…",
  className,
  ...rest
}: LoadingStateProps) {
  const count = Math.max(1, Math.floor(lines));
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid={rest["data-testid"]}
      className={cn("flex flex-col gap-3", className)}
    >
      <span className="sr-only">{label}</span>
      {withHeader ? <Skeleton className="h-6 w-1/3" /> : null}
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          // Larguras alternadas para parecer texto, não uma tabela de blocos iguais.
          style={{ width: `${[92, 76, 84, 64][i % 4]}%` }}
        />
      ))}
    </div>
  );
}
