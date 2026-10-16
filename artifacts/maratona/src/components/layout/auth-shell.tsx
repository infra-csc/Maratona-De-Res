// Casca das telas de entrada (login e troca de senha): sempre no tema escuro
// da marca — a tinta e a lima do app —, palco da marca à esquerda no desktop
// e o formulário à direita; no celular, marca compacta em cima.
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BrandMark, Wordmark } from "./shell-ui";
import { ImpersonationBanner } from "./impersonation-banner";

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Maratona de Resultados`;
  }, [title]);

  return (
    // A classe `dark` aqui aplica os tokens escuros só a esta árvore.
    <div className="dark flex min-h-dvh flex-col bg-background">
      {/* Modo Dev numa conta com troca de senha pendente: a saída fica à mão. */}
      <ImpersonationBanner />
      <div className="font-body grid flex-1 bg-background text-foreground lg:grid-cols-[minmax(0,1.15fr)_minmax(460px,1fr)]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border px-12 py-11 lg:flex xl:px-16">
          <div className="flex items-center gap-3">
            <BrandMark size={36} />
            <Wordmark />
          </div>
          <div>
            <p className="font-condensed text-[clamp(64px,7.4vw,120px)] font-black uppercase leading-[0.86] tracking-[-0.02em]">
              <span className="block text-[#d4ff00]">Maratona</span>
              <span className="block text-foreground/40">de Resultados</span>
            </p>
            <span aria-hidden="true" className="mt-8 block h-1 w-16 rounded-full bg-[#d4ff00]" />
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              Avaliação dos eventos, calibração das notas e bônus de cada ciclo — num lugar só.
            </p>
          </div>
          <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Sistema exclusivo · Uso restrito
          </p>
        </section>

        <main className="flex min-w-0 flex-col items-center justify-center px-5 py-10 sm:px-8 lg:bg-card">
          <div className="w-full max-w-[400px]">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <BrandMark size={40} />
              <Wordmark />
            </div>
            {children}
            {footer && <div className="mt-8">{footer}</div>}
            <p className={cn("font-condensed mt-10 text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground lg:hidden")}>
              Sistema exclusivo · Uso restrito
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

type Tone = "info" | "warn" | "danger";
const TONE: Record<Tone, string> = {
  info: "border-[var(--status-info)]/40 bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  warn: "border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]",
  danger: "border-[var(--status-danger)]/45 bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
};

/** Aviso de uma ou duas linhas acima do formulário (sessão, portal, erro). */
export function AuthNotice({ tone, icon: Icon, title, children, role, "data-testid": testId }: {
  tone: Tone;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  title?: ReactNode;
  children?: ReactNode;
  role?: "alert" | "status";
  "data-testid"?: string;
}) {
  return (
    <div role={role} data-testid={testId} className={cn("flex gap-3 rounded-xl border px-3.5 py-3 text-[13px] leading-snug motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200", TONE[tone])}>
      <Icon size={16} aria-hidden className="mt-px shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <p className={cn(title && "mt-0.5", "text-foreground/80")}>{children}</p>}
      </div>
    </div>
  );
}

/** Rótulo de campo das telas de entrada. */
export const authLabelCls = "font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground";
/** Campo das telas de entrada (56 px: confortável no toque e na leitura). */
export const authInputCls = "w-full h-14 rounded-xl border border-border bg-background px-4 text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-150 outline-none focus:border-[#d4ff00]/70 focus:ring-2 focus:ring-[#d4ff00]/25 disabled:opacity-60";
/** Ação principal (lima no escuro). */
export const authButtonCls = "font-condensed inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-bold uppercase tracking-[0.08em] text-primary-foreground transition-[opacity,transform,background-color] duration-150 enabled:hover:opacity-90 motion-safe:enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
