// Peças visuais do Dashboard. A base — Chip, Eyebrow, botões, esqueleto,
// superfície, foco — vem das telas já redesenhadas (Avaliações, Calibração,
// Central, Eventos e Resultados), para o app parecer um produto só.
import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, FOCUS_RING, btnSecondary, btnSmall, surfaceCls } from "../results/results-ui";

export { Chip, Eyebrow, Bone, FOCUS_RING, StackBar, surfaceCls, btnSmall, btnSecondary, btnGhost } from "../results/results-ui";
export { StatCell } from "../results/results-ui";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
type CellTone = "neutral" | "ok" | "warn" | "danger";

const VALUE_TONE: Record<CellTone, string> = {
  neutral: "text-foreground",
  ok: "text-[var(--status-ok-text)]",
  warn: "text-[var(--status-warn-text)]",
  danger: "text-[var(--status-danger-text)]",
};

/**
 * Célula da faixa de indicadores que leva a outra tela (atalho). Mesmo
 * desenho do StatCell de Resultados, mas é um link — não uma alternância.
 */
export function StatLink({ href, label, value, unit, sub, tone = "neutral", action, testId, title, className, children }: {
  href?: string | null; label: ReactNode; value?: ReactNode; unit?: ReactNode; sub?: ReactNode; tone?: CellTone;
  action?: string; testId?: string; title?: string; className?: string; children?: ReactNode;
}) {
  const body = (
    <>
      <Eyebrow as="span" className="block">{label}</Eyebrow>
      {value != null && (
        <span className="mt-2 flex items-baseline gap-1.5 min-w-0">
          <span className={cn("font-condensed text-[30px] lg:text-[34px] font-black leading-none tracking-[-0.02em] tabular-nums whitespace-nowrap", VALUE_TONE[tone])}>{value}</span>
          {unit && <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground truncate">{unit}</span>}
        </span>
      )}
      {children}
      {sub && <span className="mt-1.5 block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>}
      {href && action && (
        <span className="mt-auto pt-3 inline-flex items-center gap-1 font-condensed text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground group-hover:text-foreground transition-colors duration-150">
          {action}
          <ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      )}
    </>
  );
  const cls = cn("min-w-0 bg-card px-4 py-4 lg:px-5 lg:py-[18px] text-left flex flex-col", className);
  if (!href) return <div data-testid={testId} title={title} className={cls}>{body}</div>;
  return (
    <Link href={href} data-testid={testId} title={title}
      className={cn(cls, "group transition-colors duration-150 hover:bg-secondary/50", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
      {body}
    </Link>
  );
}

/** Bloco do painel: título condensado, linha de apoio, ação à direita e rodapé de atalhos. */
export function Panel({ title, icon: IconC, sub, aside, footer, children, className, testId, labelId, tone }: {
  title: ReactNode; icon?: Icon; sub?: ReactNode; aside?: ReactNode; footer?: ReactNode; children: ReactNode;
  className?: string; testId?: string; labelId: string; tone?: "warn";
}) {
  return (
    <section aria-labelledby={labelId} data-testid={testId} className={cn(surfaceCls, "min-w-0 flex flex-col overflow-hidden", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5 px-4 pt-4 pb-3 lg:px-5 lg:pt-5">
        <div className="min-w-0 flex-1 basis-[220px]">
          <h2 id={labelId} className="flex items-center gap-2 font-condensed text-[17px] lg:text-[18px] font-black uppercase leading-tight tracking-[-0.005em] text-foreground">
            {IconC && <IconC size={16} aria-hidden className={cn("shrink-0", tone === "warn" ? "text-[var(--status-warn-text)]" : "text-muted-foreground")} />}
            {title}
          </h2>
          {sub && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{sub}</p>}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </header>
      <div className="flex-1 min-w-0">{children}</div>
      {footer && <footer className="mt-auto border-t border-border px-2 py-1.5 lg:px-3 flex flex-wrap gap-x-1">{footer}</footer>}
    </section>
  );
}

/** Atalho do rodapé de um bloco ("Ver ranking completo →"). */
export function FooterLink({ href, children, testId }: { href: string; children: ReactNode; testId?: string }) {
  return (
    <Link href={href} data-testid={testId}
      className={cn("group inline-flex items-center gap-1.5 min-h-11 lg:min-h-9 px-2.5 rounded-md font-condensed text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
      {children}
      <ArrowRight size={13} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </Link>
  );
}

/** Linha clicável de lista (44 px no toque), com seta que aparece no hover. */
export const rowLinkCls = cn(
  "group flex items-center gap-3 min-h-12 px-4 lg:px-5 py-2.5 transition-colors duration-150 hover:bg-secondary/50",
  FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0",
);

export function RowArrow() {
  return <ArrowRight size={14} aria-hidden className="shrink-0 text-muted-foreground opacity-40 transition-[opacity,transform] duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 motion-reduce:transition-none" />;
}

/** Mensagem curta dentro de um bloco (nada pendente, sem dados ainda). */
export function InlineState({ icon: IconC, tone = "neutral", title, children, className, testId }: {
  icon: Icon; tone?: "neutral" | "ok"; title: ReactNode; children?: ReactNode; className?: string; testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn("flex items-start gap-3 px-4 lg:px-5 py-4", className)}>
      <span className={cn("w-9 h-9 shrink-0 rounded-full flex items-center justify-center",
        tone === "ok" ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-secondary text-muted-foreground")}>
        <IconC size={16} aria-hidden />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[14px] font-semibold text-foreground leading-snug">{title}</p>
        {children && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{children}</p>}
      </div>
    </div>
  );
}

/** Falha ao carregar um bloco, com nova tentativa (em linha, sem caixa pesada). */
export function InlineError({ what, onRetry, testId }: { what: string; onRetry: () => void; testId?: string }) {
  return (
    <div role="alert" data-testid={testId} className="flex flex-wrap items-center gap-3 px-4 lg:px-5 py-4">
      <AlertTriangle size={16} aria-hidden className="shrink-0 text-[var(--status-danger-text)]" />
      <p className="flex-1 min-w-[180px] text-[14px]"><b className="font-semibold">Não foi possível carregar {what}.</b></p>
      <button type="button" onClick={onRetry} className={btnSmall}><RotateCw size={14} aria-hidden /> Tentar de novo</button>
    </div>
  );
}

/** Falha geral do painel (os números principais não vieram). */
export function PanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" data-testid="dashboard-error" className="rounded-2xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-5 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <span className="w-10 h-10 shrink-0 rounded-full bg-card text-[var(--status-danger-text)] flex items-center justify-center"><AlertTriangle size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[20px] font-black uppercase leading-tight text-foreground">Não foi possível carregar o painel</p>
        <p className="text-[14px] text-muted-foreground mt-0.5">Verifique a conexão e tente de novo. Nenhum dado se perdeu.</p>
      </div>
      <button type="button" onClick={onRetry} className={btnSecondary} data-testid="button-dashboard-retry"><RotateCw size={15} aria-hidden /> Tentar de novo</button>
    </div>
  );
}
