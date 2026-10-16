// Palco da Apresentação para a equipe. Cada parte é desenhada num quadro de
// 1920×1080 e escala com a largura que tem (unidade --u = 1/1920 da largura):
// a mesma peça aparece na prévia da página, no telão e no PDF. No celular, os
// textos têm piso em px para continuarem legíveis.
import type { CSSProperties, ReactNode } from "react";
import { AMBER } from "@/lib/premium-theme";
import { cn } from "@/lib/utils";

/** Medida do palco: `n` px num telão de 1920 de largura; `floor` = mínimo em px. */
export const u = (n: number, floor?: number) => (floor ? `max(calc(var(--u) * ${n}), ${floor}px)` : `calc(var(--u) * ${n})`);

export type SlideTone = "neutral" | "good" | "improve";

/** Cor do traço de cada parte (só marca, nunca texto). */
export const TONE_MARK: Record<SlideTone, string> = {
  neutral: "var(--foreground)",
  good: "var(--viz-series-1)",
  improve: AMBER,
};

/** Tipografia do palco — uma escala só para todas as partes. */
export const TYPE = {
  eyebrow: { fontSize: u(22, 12), letterSpacing: "0.1em" },
  title: { fontSize: u(92, 30), lineHeight: 0.92, letterSpacing: "-0.01em" },
  lead: { fontSize: u(30, 15), lineHeight: 1.45 },
  heading: { fontSize: u(24, 12), letterSpacing: "0.08em" },
  label: { fontSize: u(34, 16), lineHeight: 1.15 },
  detail: { fontSize: u(22, 13), lineHeight: 1.3 },
  body: { fontSize: u(28, 14), lineHeight: 1.45 },
  value: { fontSize: u(64, 24), lineHeight: 0.9 },
  stat: { fontSize: u(132, 48), lineHeight: 0.85, letterSpacing: "-0.02em" },
  hero: { fontSize: u(300, 104), lineHeight: 0.8, letterSpacing: "-0.03em" },
} satisfies Record<string, CSSProperties>;

/**
 * Moldura de uma parte. `stage` = no telão (ocupa o quadro inteiro); fora dele
 * a prévia guarda a proporção 16:9 como altura mínima.
 */
export function Slide({ id, index, total, eyebrow, title, lead, tone = "neutral", meta, stage, children }: {
  id: string; index: number; total: number; eyebrow: string; title: string; lead?: ReactNode;
  tone?: SlideTone; meta: string; stage?: boolean; children: ReactNode;
}) {
  const titleId = `slide-${id}-title`;
  return (
    <div className={cn("@container w-full min-w-0", stage && "h-full")}>
      <section
        id={`slide-${id}`}
        aria-labelledby={titleId}
        data-testid={`team-slide-${id}`}
        className={cn("flex flex-col min-w-0 text-foreground print-avoid-break", stage ? "min-h-full" : "")}
        style={{
          ["--u" as string]: "calc(100cqw / 1920)",
          minHeight: stage ? undefined : u(1080),
          padding: `${u(72, 20)} ${u(112, 18)} ${u(52, 18)}`,
        } as CSSProperties}
      >
        <header className="min-w-0">
          <p className="flex items-center font-condensed font-bold uppercase text-muted-foreground" style={{ ...TYPE.eyebrow, gap: u(16, 8) }}>
            <span aria-hidden className="rounded-full shrink-0" style={{ width: u(48, 20), height: u(6, 3), backgroundColor: TONE_MARK[tone] }} />
            {eyebrow}
          </p>
          <h2 id={titleId} className="font-condensed font-black uppercase text-foreground text-balance" style={{ ...TYPE.title, marginTop: u(22, 8) }}>
            {title}
          </h2>
          {lead ? <p className="text-muted-foreground text-pretty" style={{ ...TYPE.lead, marginTop: u(24, 10), maxWidth: "62ch" }}>{lead}</p> : null}
        </header>
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ marginTop: u(48, 20) }}>{children}</div>
        <footer className="flex items-center justify-between gap-4 font-condensed font-bold uppercase text-muted-foreground" style={{ ...TYPE.eyebrow, marginTop: u(48, 18) }}>
          <span className="truncate min-w-0">{meta}</span>
          <span className="tabular-nums shrink-0" aria-label={`Parte ${index + 1} de ${total}`}>{index + 1} / {total}</span>
        </footer>
      </section>
    </div>
  );
}

/** Rótulo de coluna dentro de uma parte ("Critérios mais fortes"). */
export function ColumnHeading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <h3 className="font-condensed font-bold uppercase text-muted-foreground border-b border-border" style={{ ...TYPE.heading, paddingBottom: u(16, 8), marginBottom: u(32, 14) }}>
      {children}
      {hint ? <span className="font-sans font-medium normal-case tracking-normal" style={{ marginLeft: u(12, 6), fontSize: "0.9em" }}>· {hint}</span> : null}
    </h3>
  );
}

/** Mensagem curta quando uma coluna não tem o que mostrar. */
export function SlideNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground" style={TYPE.body}>{children}</p>;
}
