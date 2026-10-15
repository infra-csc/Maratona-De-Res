// Peças visuais de Meu desempenho. A base — Chip, Eyebrow, botões, busca,
// alternância, blocos de vazio/erro — vem das telas já redesenhadas: um
// produto só. Aqui ficam o bloco com título, o número de nota e o selo de faixa.
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn, faixaEdge, fmtNum } from "@/lib/utils";
import { btnSecondary as btnSecondaryLocal } from "../criteria/criteria-ui";
import { contrastingTextColor } from "./helpers";

export {
  Chip, Eyebrow, btnPrimary, btnSecondary, btnSmall, btnGhost, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, SearchField, Segmented, type Tone,
} from "../criteria/criteria-ui";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** Nota com 1 casa ("91,9"); vazio vira "—". */
export const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Tinta da nota 0–100 (texto com contraste AA nos dois temas; a cor nunca vem sozinha). */
export function scoreInk(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-[var(--status-ok-text)]";
  if (score >= 60) return "text-[var(--status-warn-text)]";
  return "text-[var(--status-danger-text)]";
}

/**
 * Seção da página: título condensado com ícone, frase de apoio e conteúdo. Os
 * blocos ficam soltos na página (sem cartão em volta de tudo); quem precisa
 * de superfície usa `surfaceCls` por dentro.
 */
export function Section({ id, icon: Ico, title, hint, action, children, className, testId }: {
  id: string; icon?: Icon; title: ReactNode; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("min-w-0 scroll-mt-20", className)} data-testid={testId}>
      <header className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={id} className="font-condensed flex items-center gap-2 text-[20px] font-black uppercase leading-none tracking-[-0.005em] text-foreground">
            {Ico && <Ico size={17} aria-hidden className="shrink-0 text-muted-foreground" />}
            {title}
          </h2>
          {hint && <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground max-w-[64ch]">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Selo da faixa com a cor do cadastro (contorno quando a cor é clara). */
export function FaixaBadge({ name, color, size = "md", className }: { name: string; color: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const sz = size === "lg" ? "h-9 px-3.5 text-[17px]" : size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-7 px-2.5 text-[13px]";
  return (
    <span className={cn("font-condensed inline-flex items-center rounded-md font-black uppercase tracking-[0.04em] leading-none whitespace-nowrap", sz, !color && "bg-secondary text-foreground", className)}
      style={color ? { backgroundColor: color, color: contrastingTextColor(color), ...faixaEdge(color) } : undefined}>
      {name}
    </span>
  );
}

/** Barra fina de 0–100% (trilho cinza + preenchimento). */
export function Meter({ pct, fill, className, label }: { pct: number; fill: string; className?: string; label?: string }) {
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <span className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: fill }} />
    </span>
  );
}

/** Falha ao carregar (linguagem do colaborador): o que houve, o detalhe do servidor e "Tentar de novo". */
export function LoadError({ detail, onRetry, retrying }: { detail?: string | null; onRetry: () => void; retrying?: boolean }) {
  return (
    <div role="alert" data-testid="my-performance-error" className="rounded-2xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-5 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <span className="w-10 h-10 shrink-0 rounded-full bg-card text-[var(--status-danger-text)] flex items-center justify-center"><AlertTriangle size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[20px] font-black uppercase leading-tight text-foreground">Não foi possível mostrar sua nota agora</p>
        <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">Confira a internet e tente de novo. Se continuar, avise o RH.</p>
        {detail && <p className="mt-1.5 text-[12.5px] text-muted-foreground">Detalhe: {detail}</p>}
      </div>
      <button type="button" onClick={onRetry} disabled={retrying} className={btnSecondaryLocal}>
        <RotateCw size={15} aria-hidden className={retrying ? "motion-safe:animate-spin" : undefined} /> Tentar de novo
      </button>
    </div>
  );
}
