import * as React from "react";
import { cn } from "@/lib/utils";
import { CONDENSED, BODY } from "@/lib/premium-theme";

export interface PageHeaderProps {
  /** Rótulo pequeno acima do título (ex.: nome do ciclo, módulo). */
  eyebrow?: React.ReactNode;
  /** Título da página. Vira o único <h1> da tela. */
  title: React.ReactNode;
  /** Uma frase explicando o que a tela faz ou o estado atual. */
  description?: React.ReactNode;
  /** Botões/filtros alinhados à direita (empilham abaixo no mobile). */
  actions?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
  /** testid do <h1>. Padrão: "text-page-title" (convenção das páginas). */
  titleTestId?: string;
}

/**
 * Cabeçalho padrão de página: eyebrow + h1 condensado + descrição + ações.
 * Um por tela. O h1 é obrigatório para leitores de tela e para os testes.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  titleTestId = "text-page-title",
  ...rest
}: PageHeaderProps) {
  return (
    <header
      data-testid={rest["data-testid"]}
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p
            className="mb-1 text-[11px] font-bold uppercase"
            style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1
          data-testid={titleTestId}
          className="text-2xl md:text-[32px] font-black uppercase leading-none"
          style={{ fontFamily: CONDENSED, letterSpacing: "-0.02em", color: "var(--foreground)" }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="mt-2 max-w-2xl text-[13px] leading-relaxed"
            style={{ fontFamily: BODY, color: "var(--muted-foreground)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}
