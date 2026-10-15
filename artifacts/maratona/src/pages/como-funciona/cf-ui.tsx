// Peças visuais de "Como funciona". A base (Chip, Eyebrow, busca, avisos,
// esqueleto) vem das telas já redesenhadas; aqui ficam a seção numerada, a
// linha de definição, o exemplo e o selo de faixa.
import type { ComponentType, ReactNode } from "react";
import { cn, faixaEdge } from "@/lib/utils";

export { Chip, Eyebrow, Bone, Notice, SearchField, FOCUS_RING, surfaceCls, type Tone } from "../criteria/criteria-ui";

export type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** Seção do guia: número, ícone, título e conteúdo — sem caixa pesada. */
export function GuideSection({ id, n, icon: Ico, title, lead, children }: {
  id: string; n: number; icon: Icon; title: string; lead?: ReactNode; children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="scroll-mt-24 border-t border-border pt-8 first:border-t-0 first:pt-0" data-testid={`guide-${id}`}>
      <p className="flex items-center gap-2 font-condensed text-[12px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="tabular-nums">{String(n).padStart(2, "0")}</span>
        <span aria-hidden className="h-px w-6 bg-border" />
        <Ico size={14} aria-hidden />
      </p>
      <h2 id={`${id}-t`} className="mt-2 font-condensed text-[28px] sm:text-[32px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-foreground">{title}</h2>
      {lead && <p className="mt-3 text-[15.5px] leading-relaxed text-muted-foreground max-w-[64ch]">{lead}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/** Lista de definições (rótulo à esquerda no desktop, em cima no celular). */
export function DefList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden", className)}>{children}</dl>;
}
export function Def({ term, children, strong }: { term: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn("grid gap-1 px-4 py-3.5 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-5 sm:px-5", strong && "bg-secondary/60")}>
      <dt className="font-condensed text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground sm:pt-0.5">{term}</dt>
      <dd className={cn("text-[14.5px] leading-relaxed", strong ? "font-semibold text-foreground" : "text-foreground")}>{children}</dd>
    </div>
  );
}

/** Caixa de exemplo (com a conta à vista). */
export function Example({ title = "Exemplo", children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary/50 px-4 py-4 sm:px-5">
      <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
      <div className="mt-2 text-[14.5px] leading-relaxed text-foreground">{children}</div>
    </div>
  );
}

/** Uma linha da conta do exemplo (operador, rótulo, valor). */
export function MathLine({ op, label, value, total, tone }: { op?: string; label: ReactNode; value: ReactNode; total?: boolean; tone?: "danger" | "ok" }) {
  const ink = tone === "danger" ? "text-[var(--status-danger-text)]" : tone === "ok" ? "text-[var(--status-ok-text)]" : "text-foreground";
  return (
    <div className={cn("flex items-baseline gap-3 py-1.5", total && "mt-1 border-t-2 border-foreground pt-2.5")}>
      <span aria-hidden className="w-4 shrink-0 text-center font-condensed text-[17px] font-black text-muted-foreground">{op}</span>
      <span className={cn("flex-1 min-w-0 text-[14px]", total ? "font-bold text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className={cn("font-condensed font-black tabular-nums leading-none", total ? "text-[26px]" : "text-[19px]", ink)}>{value}</span>
    </div>
  );
}

/** Quadradinho com a cor da faixa (contorno quando a cor é clara). */
export function Swatch({ color, className }: { color: string | null | undefined; className?: string }) {
  return <span aria-hidden className={cn("inline-block w-3 h-3 rounded-[3px] shrink-0", className)} style={{ backgroundColor: color ?? "var(--muted-foreground)", ...faixaEdge(color) }} />;
}
