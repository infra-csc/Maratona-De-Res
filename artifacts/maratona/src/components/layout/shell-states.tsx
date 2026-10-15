// Estados globais da casca: abrindo o app, trocando de tela, sem permissão
// e endereço inexistente — a mesma linguagem das telas (Barlow Condensed,
// tokens do tema), nunca um "Carregando..." solto.
import type { ComponentType, ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandMark } from "./shell-ui";

/** O tema salvo, para telas que aparecem antes do provedor de tema existir. */
export function savedDark(): boolean {
  try { return localStorage.getItem("premium_theme_dark") === "1"; } catch { return false; }
}

/** Abrindo o app (conferindo a sessão): marca + barra correndo. Aparece só se demorar. */
export function BootScreen() {
  return (
    <div className={cn(savedDark() && "dark")}>
      <div role="status" aria-live="polite" className="flex h-dvh flex-col items-center justify-center gap-5 bg-background">
        <span className="sr-only">Carregando…</span>
        <div className="flex flex-col items-center gap-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 [animation-delay:200ms] [animation-fill-mode:both]">
          <BrandMark size={44} />
          <span aria-hidden="true" className="relative block h-[3px] w-28 overflow-hidden rounded-full bg-secondary">
            <span className="shell-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-[var(--accent)]" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Trocando de tela dentro do app: o esqueleto do cabeçalho fixo + blocos. */
export function PageFallback() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 [animation-delay:150ms] [animation-fill-mode:both]">
      <span className="sr-only">Carregando a tela…</span>
      <div className="flex h-16 items-center gap-4 border-b border-border bg-card px-4 md:px-6">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="ml-auto h-9 w-28 rounded-lg" />
      </div>
      <div className="space-y-5 p-4 md:p-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Trocando de tela fora do app (troca de senha, link público): só a barra. */
export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="flex h-dvh items-center justify-center bg-background">
      <span className="sr-only">Carregando…</span>
      <span aria-hidden="true" className="relative block h-[3px] w-28 overflow-hidden rounded-full bg-secondary motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 [animation-delay:200ms] [animation-fill-mode:both]">
        <span className="shell-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-[var(--accent)]" />
      </span>
    </div>
  );
}

const ACTION = "font-condensed inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-[14px] font-bold uppercase tracking-[0.06em] leading-none transition-[background-color,opacity,transform] duration-150 motion-safe:active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-10";
export const stateBtnPrimary = `${ACTION} bg-primary text-primary-foreground hover:opacity-90`;
export const stateBtnSecondary = `${ACTION} border border-border bg-card text-foreground hover:bg-secondary`;

/** Bloco central de estado de tela inteira (sem permissão, 404, erro). */
export function StatePanel({ icon: Icon, tone = "neutral", eyebrow, title, children, actions, detail, className }: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;
  tone?: "neutral" | "warn" | "danger";
  eyebrow: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  const toneCls = tone === "danger"
    ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
    : tone === "warn"
    ? "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]"
    : "bg-secondary text-muted-foreground";
  return (
    <div className={cn("flex min-h-[70vh] w-full items-center justify-center px-5 py-12", className)}>
      <div className="w-full max-w-[520px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
        <span aria-hidden="true" className={cn("inline-flex size-12 items-center justify-center rounded-xl", toneCls)}>
          <Icon size={22} strokeWidth={2} aria-hidden />
        </span>
        <p className="font-condensed mt-6 text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{eyebrow}</p>
        <h1 className="font-condensed mt-1.5 text-[30px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-foreground sm:text-[36px]">{title}</h1>
        {children && <div className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>}
        {actions && <div className="mt-7 flex flex-wrap gap-2.5">{actions}</div>}
        {detail && <div className="mt-8">{detail}</div>}
      </div>
    </div>
  );
}

/** Link interno com a aparência das ações de estado. */
export function StateLink({ href, primary, children }: { href: string; primary?: boolean; children: ReactNode }) {
  return <Link href={href} className={primary ? stateBtnPrimary : stateBtnSecondary}>{children}</Link>;
}
