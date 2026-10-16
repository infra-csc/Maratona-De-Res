// Peças visuais próprias da Central de Avaliações. A base (Chip, Eyebrow,
// botões, cabeçalho de diálogo, campo) vem de ../evaluations/ui e o trilho de
// alternância/esqueleto de ../calibrations/cal-ui — a mesma linguagem das
// telas de Avaliações, do link público e da Calibração.
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { btnSecondary, type Tone } from "../evaluations/ui";
import type { CritState } from "./types";

export { Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, type Tone } from "../evaluations/ui";
export { Segmented, Bone, FOCUS_RING, fieldCls } from "../calibrations/cal-ui";

/** Situação do critério → tom do selo. */
export const STATE_TONE: Record<CritState, Tone> = { done: "ok", partial: "warn", pending: "neutral", unassigned: "danger" };

/** Situação do critério → cor da barra/marca (classe de fundo). */
export const STATE_BAR: Record<CritState, string> = {
  done: "bg-[var(--status-ok)]",
  partial: "bg-[var(--status-warn)]",
  pending: "bg-border",
  unassigned: "bg-[var(--status-danger)]",
};

/** Select nativo com a cara dos campos da tela (44 px no toque, 36 px com mouse). */
export const selectCls = "w-full min-w-0 h-11 lg:h-9 rounded-lg border border-border bg-card px-3 text-[14px] lg:text-[13px] font-semibold text-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30 disabled:opacity-50";

/** Superfície padrão dos blocos da tela. */
export const surfaceCls = "rounded-2xl border border-border bg-card";

/** Barra empilhada (respondidos · rascunho · pendentes · sem avaliador). */
export function StackBar({ parts, className, label }: { parts: { value: number; cls: string }[]; className?: string; label?: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn("flex h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      {total > 0 && parts.filter(p => p.value > 0).map((p, i) => (
        <span key={i} className={cn("h-full transition-[width] duration-300 motion-reduce:transition-none first:rounded-l-full last:rounded-r-full", p.cls)} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </span>
  );
}

/** Estado vazio/neutro dentro de um bloco (ícone, título, frase e ação). */
export function EmptyBlock({ icon: Icon, title, children, action, className, testId }: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className={cn("px-6 py-12 text-center", className)}>
      <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Icon size={20} aria-hidden /></span>
      <p className="font-condensed mt-3 text-[20px] font-black uppercase leading-tight text-foreground">{title}</p>
      {children && <p className="text-[14px] leading-relaxed text-muted-foreground mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Falha ao carregar, com nova tentativa. */
export function ErrorBlock({ title, onRetry, className }: { title: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-2xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-5 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4", className)}>
      <span className="w-10 h-10 shrink-0 rounded-full bg-card text-[var(--status-danger-text)] flex items-center justify-center"><AlertTriangle size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[20px] font-black uppercase leading-tight text-foreground">{title}</p>
        <p className="text-[14px] text-muted-foreground mt-0.5">Verifique a conexão e tente de novo. Nada do que já foi enviado se perdeu.</p>
      </div>
      {onRetry && <button type="button" onClick={onRetry} className={btnSecondary}><RotateCw size={15} aria-hidden /> Tentar de novo</button>}
    </div>
  );
}

/** Aviso curto em linha (info/atenção) — texto + ícone, sem caixa pesada. */
export function Notice({ icon: Icon, tone = "neutral", children, className, testId }: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  tone?: "neutral" | "info" | "warn" | "danger" | "ok";
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const cls = {
    neutral: "bg-secondary/70 text-muted-foreground",
    info: "bg-[var(--status-info-bg)] text-foreground",
    warn: "bg-[var(--status-warn-bg)] text-foreground",
    danger: "bg-[var(--status-danger-bg)] text-foreground",
    ok: "bg-[var(--status-ok-bg)] text-foreground",
  }[tone];
  const iconCls = {
    neutral: "text-muted-foreground", info: "text-[var(--status-info-text)]", warn: "text-[var(--status-warn-text)]",
    danger: "text-[var(--status-danger-text)]", ok: "text-[var(--status-ok-text)]",
  }[tone];
  return (
    <div data-testid={testId} className={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug", cls, className)}>
      <Icon size={15} aria-hidden className={cn("shrink-0 mt-[1px]", iconCls)} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Rola até um elemento (respeita "reduzir movimento"). */
export function smoothScrollTo(el: HTMLElement | null, block: ScrollLogicalPosition = "start") {
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block });
}
