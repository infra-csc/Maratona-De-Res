import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Peças visuais da tela do avaliador (lista, formulário, matriz, resumo e
// diálogos) — uma linguagem só: rótulo condensado em caixa alta, chips com
// cor de status + texto, botões com a mesma altura e o mesmo foco.

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "bg-secondary text-muted-foreground",
  ok: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]",
  warn: "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  info: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  brand: "bg-primary text-primary-foreground",
};

/** Selo de estado: cor + texto (a cor nunca é o único sinal). */
export function Chip({ tone = "neutral", icon: Icon, children, className, title, "data-testid": testId }: {
  tone?: Tone;
  icon?: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode;
  className?: string;
  title?: string;
  "data-testid"?: string;
}) {
  return (
    <span
      title={title}
      data-testid={testId}
      className={cn(
        "font-condensed inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] font-bold uppercase tracking-[0.05em] leading-none whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon size={12} aria-hidden className="shrink-0" />}
      {children}
    </span>
  );
}

/** Rótulo pequeno de seção (eyebrow). */
export function Eyebrow({ children, className, as: Tag = "p", id }: { children: ReactNode; className?: string; as?: "p" | "span" | "h2" | "h3" | "div"; id?: string }) {
  return (
    <Tag id={id} className={cn("font-condensed text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-muted-foreground", className)}>
      {children}
    </Tag>
  );
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const BASE_BTN = `font-condensed inline-flex items-center justify-center gap-2 rounded-lg font-bold uppercase tracking-[0.06em] leading-none whitespace-nowrap transition-[background-color,opacity,transform,border-color] duration-150 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${FOCUS}`;

/** Ação principal (preto no claro, lima no escuro). */
export const btnPrimary = `${BASE_BTN} min-h-11 px-5 text-[14px] bg-primary text-primary-foreground enabled:hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground disabled:opacity-100`;
/** Ação secundária com contorno. */
export const btnSecondary = `${BASE_BTN} min-h-11 px-4 text-[14px] border border-border bg-card text-foreground enabled:hover:bg-secondary`;
/** Ação secundária compacta (cabeçalhos de seção) — 44 px no toque, 36 px com mouse. */
export const btnSmall = `${BASE_BTN} min-h-11 md:min-h-9 px-3 text-[13px] border border-border bg-card text-foreground enabled:hover:bg-secondary`;
/** Ação discreta, sem contorno. */
export const btnGhost = `${BASE_BTN} min-h-11 md:min-h-9 px-3 text-[13px] text-muted-foreground enabled:hover:text-foreground enabled:hover:bg-secondary`;

/** Campo de texto de uma linha (diálogos). */
export const inputCls = "w-full h-11 rounded-lg border border-border bg-card px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30";

/** Rolagem suave até um item do formulário (respeita "reduzir movimento"). */
export function scrollToItem(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  // Foco acompanha o salto (teclado e leitor de tela continuam dali).
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el.style.outline = "none";
  el.focus({ preventScroll: true });
  // Destaque curto para o olho achar o item.
  el.classList.add("eval-flash");
  window.setTimeout(() => el.classList.remove("eval-flash"), 1200);
}

type RadixText = ComponentType<{ className?: string; children?: ReactNode }>;

/**
 * Cabeçalho padrão dos diálogos da tela: ícone, título e uma frase. Recebe o
 * Title/Description do Radix (Dialog ou AlertDialog) para manter o nome e a
 * descrição acessíveis do diálogo.
 */
export function DialogHeading({ icon: Icon, Title, Description, title, description, tone = "neutral" }: {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  Title: RadixText;
  Description?: RadixText;
  title: ReactNode;
  description?: ReactNode;
  tone?: "neutral" | "danger" | "brand";
}) {
  const tile = tone === "danger"
    ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
    : tone === "brand" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground";
  return (
    <div className="flex items-start gap-3 pr-8 text-left">
      <span className={cn("mt-0.5 w-10 h-10 shrink-0 rounded-lg flex items-center justify-center", tile)}>
        <Icon size={18} aria-hidden />
      </span>
      <div className="min-w-0 space-y-1.5">
        <Title className="font-condensed text-[22px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-foreground">{title}</Title>
        {description && Description && <Description className="text-[14px] leading-relaxed text-muted-foreground">{description}</Description>}
      </div>
    </div>
  );
}

/** Largura/forma dos diálogos: com margem no celular, cantos e borda do sistema. */
export const dialogCls = "font-body w-[calc(100%-24px)] max-w-[480px] rounded-2xl border-border bg-card text-foreground p-5 sm:p-6 gap-5";
