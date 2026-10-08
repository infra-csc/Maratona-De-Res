import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "../evaluations/ui";

// Página externa (freela, sem conta no sistema): fica fora do AppLayout. O
// tema usa a MESMA classe `.dark` no <html> do app (tokens de src/index.css,
// inclusive os de status), então o freela vê o mesmo produto do avaliador.

const THEME_KEY = "premium_theme_dark";

/** Tema da página pública: preferência salva → tema do aparelho → claro. */
export function usePublicTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === "1" || saved === "0") return saved === "1";
    } catch { /* armazenamento indisponível */ }
    return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("dark", isDark);
    return () => { el.classList.remove("dark"); };
  }, [isDark]);
  const toggle = () => setIsDark((d) => {
    const next = !d;
    try { localStorage.setItem(THEME_KEY, next ? "1" : "0"); } catch { /* segue sem salvar */ }
    return next;
  });
  return { isDark, toggle };
}

export const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Barra de topo: marca do produto (o freela sabe onde está) e o tema. */
export function TopBar({ isDark, onToggleTheme, frame = "max-w-[1048px]" }: { isDark: boolean; onToggleTheme: () => void; frame?: string }) {
  return (
    <header className="border-b border-border bg-card/70">
      <div className={cn("mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-6", frame)}>
        <div className="flex flex-col leading-none" aria-label="Maratona de Resultados">
          <span className="font-condensed text-[17px] font-black uppercase tracking-tight text-foreground">Maratona</span>
          <span className="font-condensed mt-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">Resultados</span>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-pressed={isDark}
          aria-label="Tema escuro"
          title={isDark ? "Usar o tema claro" : "Usar o tema escuro"}
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground motion-safe:active:scale-95",
            FOCUS_RING,
          )}
        >
          {isDark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
        </button>
      </div>
    </header>
  );
}

/** Casca de toda a página pública (formulário e telas de estado). */
export function PublicShell({ isDark, onToggleTheme, children, className, frame }: { isDark: boolean; onToggleTheme: () => void; children: ReactNode; className?: string; frame?: string }) {
  return (
    <div className={cn("font-body min-h-dvh bg-background text-foreground antialiased transition-colors duration-200", className)}>
      <TopBar isDark={isDark} onToggleTheme={onToggleTheme} frame={frame} />
      {children}
    </div>
  );
}

export type StatusTone = "success" | "neutral" | "info" | "danger" | "warn";

const TILE: Record<StatusTone, string> = {
  success: "bg-accent text-accent-foreground",
  neutral: "bg-secondary text-foreground",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  warn: "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]",
};

/**
 * Tela de estado (enviado, já usado, inválido, ciclo fechado…): um bloco só,
 * alinhado à esquerda, com o evento como contexto, título, explicação, o
 * detalhe (quando houver) e o que fazer agora.
 */
export function StatusScreen({ shell, tone, icon: Icon, eventName, title, titleTestId, children, details, actions, footer = "Dúvidas? Fale com quem enviou este link para você." }: {
  shell: { isDark: boolean; onToggleTheme: () => void };
  tone: StatusTone;
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;
  eventName?: string | null;
  title: ReactNode;
  titleTestId?: string;
  children?: ReactNode;
  details?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode | null;
}) {
  return (
    <PublicShell {...shell} frame="max-w-[560px]">
      <main className="mx-auto flex w-full max-w-[560px] flex-col px-4 pb-16 pt-10 sm:px-6 sm:pt-20">
        <div role="status" aria-live="polite" className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 duration-300">
          <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl motion-safe:animate-in motion-safe:zoom-in-75 duration-300", TILE[tone])}>
            <Icon size={26} strokeWidth={2} aria-hidden />
          </span>
          {eventName && <Eyebrow className="mt-6 leading-snug break-words">{eventName}</Eyebrow>}
          <h1 data-testid={titleTestId} className={cn("font-condensed text-[34px] sm:text-[42px] font-black uppercase leading-[0.95] tracking-[-0.015em] text-foreground break-words", eventName ? "mt-2" : "mt-6")}>
            {title}
          </h1>
          {children && <div className="mt-3 space-y-2 text-[16px] leading-relaxed text-muted-foreground">{children}</div>}
        </div>
        {details && <div className="mt-7">{details}</div>}
        {actions && <div className="mt-7 flex flex-wrap gap-3">{actions}</div>}
        {footer && <p className="mt-10 border-t border-border pt-5 text-[13px] leading-relaxed text-muted-foreground">{footer}</p>}
      </main>
    </PublicShell>
  );
}

/** Classe dos campos de texto: 16 px no celular (o iPhone não dá zoom ao focar). */
export const fieldCls = "w-full rounded-lg border border-border bg-card text-[16px] md:text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/80 transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-foreground/40";
