import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, Eyebrow } from "./ui";

export interface SegOption<T> { value: T; label: string; tone?: "neutral" | "yes" | "no" | "warn" }

/** Escolha única (Sim/Não…) em botões de 44 px; o selecionado leva aria-pressed. */
export function Segmented<T extends string | boolean | null>({ value, options, onChange, labelledBy, disabled }: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  labelledBy?: string;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-labelledby={labelledBy} className="inline-flex shrink-0 rounded-lg border border-border bg-background p-0.5">
      {options.map(o => {
        const on = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "font-condensed min-h-11 md:min-h-9 min-w-[64px] px-3 rounded-md text-[14px] font-bold uppercase tracking-[0.05em] leading-none transition-[background-color,color,transform] duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-safe:active:scale-[0.97] disabled:opacity-50",
              !on && "text-muted-foreground hover:text-foreground hover:bg-secondary",
              on && (o.tone === "no" ? "bg-destructive text-destructive-foreground"
                : o.tone === "warn" ? "bg-[var(--status-warn)] text-[#111]"
                : "bg-primary text-primary-foreground"),
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Cabeçalho da Matriz dentro do formulário: deixa claro que é parte do mesmo envio. */
export function MatrixHeader({ title, description, actions, status }: { title: string; description: ReactNode; actions?: ReactNode; status?: ReactNode }) {
  return (
    <div className="flex flex-col @6xl:flex-row @6xl:items-start justify-between gap-4">
      <div className="min-w-0 flex items-start gap-3">
        <span aria-hidden className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-card border border-border flex items-center justify-center text-foreground"><ShieldCheck size={16} /></span>
        <div className="min-w-0">
          <Eyebrow>Parte final do formulário</Eyebrow>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h4 className="font-condensed text-[22px] md:text-[24px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-foreground">{title}</h4>
            {status}
          </div>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground max-w-[62ch]">{description}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap @6xl:justify-end @6xl:shrink-0 pl-11 @6xl:pl-0">{actions}</div>}
    </div>
  );
}

/** Uma pergunta da matriz: texto, escolha e (abaixo) o comentário. */
export function MatrixQuestion({ id, question, control, penalty, unanswered, children }: {
  id: string;
  question: ReactNode;
  control: ReactNode;
  penalty?: boolean;
  unanswered?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="px-4 sm:px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p id={id} className="flex-1 min-w-[200px] text-[15px] font-semibold leading-snug text-foreground flex items-start gap-2">
          <span aria-hidden className={cn("mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full", unanswered ? "bg-[var(--status-warn)]" : "bg-transparent")} />
          <span>{question}{unanswered && <span className="sr-only"> (sem resposta)</span>}</span>
        </p>
        <div className="flex items-center gap-2 shrink-0 pl-3.5 sm:pl-0">
          {penalty && <Chip tone="danger">-10 pts</Chip>}
          {control}
        </div>
      </div>
      {children && <div className="mt-3 pl-3.5">{children}</div>}
    </div>
  );
}

export const matrixTextareaCls = "rounded-lg bg-card text-[15px] leading-relaxed border-border resize-y transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-foreground/40";
export const matrixLabelCls = "font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5";
