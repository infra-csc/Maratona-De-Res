// Peças visuais da tela de Eventos (lista e diálogos). A base — Chip, Eyebrow,
// botões, cabeçalho de diálogo, campos, trilho, esqueleto, blocos de vazio/erro
// — vem das telas já redesenhadas (Avaliações, Calibração e Central), para o
// app parecer um produto só.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export { Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, type Tone } from "../evaluations/ui";
export { Bone, FOCUS_RING, fieldCls } from "../calibrations/cal-ui";
export { EmptyBlock, ErrorBlock, Notice, StackBar, surfaceCls } from "../evaluations-admin-console/console-ui";

/** Rótulo de campo de formulário (ligado ao campo por htmlFor). */
export function FieldLabel({ htmlFor, children, required, hint }: { htmlFor: string; children: ReactNode; required?: boolean; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="font-condensed flex items-baseline justify-between gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
      <span>
        {children}
        {required && <span aria-hidden className="ml-0.5 text-[var(--status-danger-text)]">*</span>}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </span>
      {hint && <span className="normal-case tracking-normal font-body text-[12px] font-normal">{hint}</span>}
    </label>
  );
}

/** Mensagem de erro de um campo (ligada por aria-describedby). */
export function FieldErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={id} role="alert" className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">{message}</p>;
}

/** Dia da semana curto ("sáb", "dom") de uma data "YYYY-MM-DD" — ajuda a achar o fim de semana. */
export function weekdayShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

/** Ícone-botão quadrado (36 px com mouse, 44 px no toque). */
export const iconBtn = cn(
  "inline-flex items-center justify-center shrink-0 w-11 h-11 lg:w-9 lg:h-9 rounded-lg border border-border bg-card text-foreground",
  "transition-[background-color,border-color,transform] duration-150 hover:bg-secondary motion-safe:active:scale-[0.96]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
);

/** Item dos menus suspensos da tela (mesma altura e foco). */
export const menuItemCls = "font-condensed gap-2.5 min-h-11 lg:min-h-9 px-2.5 rounded-md text-[14px] font-bold uppercase tracking-[0.04em] cursor-pointer focus:bg-secondary data-[highlighted]:bg-secondary";
