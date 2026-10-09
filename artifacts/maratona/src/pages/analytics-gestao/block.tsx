// Bloco do Painel de gestão: o mesmo desenho do Panel do Dashboard (título
// condensado, linha de apoio, ação à direita, rodapé de atalhos), mas sem
// cortar o que sai da borda — as dicas dos gráficos podem passar por cima.
import type { ComponentType, ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { surfaceCls } from "../dashboard/dashboard-ui";

export { FooterLink, InlineState, InlineError } from "../dashboard/dashboard-ui";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

export function Block({ id, title, icon: IconC = BarChart3, sub, aside, legend, footer, children, className, testId }: {
  id: string; title: ReactNode; icon?: Icon; sub?: ReactNode; aside?: ReactNode;
  /** Legenda/leitura do gráfico, logo abaixo do título. */
  legend?: ReactNode;
  footer?: ReactNode; children: ReactNode; className?: string; testId?: string;
}) {
  const labelId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={labelId} data-testid={testId} className={cn(surfaceCls, "min-w-0 flex flex-col scroll-mt-32 outline-none", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5 px-4 pt-4 pb-3 lg:px-5 lg:pt-5">
        <div className="min-w-0 flex-1 basis-[240px]">
          <h2 id={labelId} className="flex items-center gap-2 font-condensed text-[17px] lg:text-[18px] font-black uppercase leading-tight tracking-[-0.005em] text-foreground">
            <IconC size={16} aria-hidden className="shrink-0 text-muted-foreground" />
            {title}
          </h2>
          {sub && <p className="mt-1 text-[13px] leading-snug text-muted-foreground max-w-[68ch]">{sub}</p>}
          {legend && <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className="flex-1 min-w-0">{children}</div>
      {footer && <footer className="mt-auto border-t border-border px-2 py-1.5 lg:px-3 flex flex-wrap gap-x-1 rounded-b-2xl">{footer}</footer>}
    </section>
  );
}
