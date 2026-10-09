// Peças visuais da tela Critérios. A base — Chip, Eyebrow, botões, cabeçalho
// de diálogo, campos, faixa de indicadores, blocos de vazio/erro, foco
// devolvido — vem das telas já redesenhadas (Avaliações, Eventos, Resultados,
// Ciclos e Colaboradores): um produto só.
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, SearchField, type Tone,
  Segmented, menuItemCls, btnDanger, dialogFooterCls, useReturnFocus, triggerMemo, rememberTrigger,
} from "../employees/ui";

/** Select nativo da barra de ferramentas (44 px no toque, 36 px com mouse). */
export const selectCls = "h-11 lg:h-9 rounded-lg border border-border bg-card pl-3 pr-8 text-[14px] font-semibold text-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30";

/** Área responsável: o selo mais forte da linha (é ela que "dona" do critério). */
export function AreaChip({ name, responsible, className }: { name: string; responsible?: boolean; className?: string }) {
  return (
    <span
      title={responsible ? `Área responsável: ${name}` : `Também avalia: ${name}`}
      className={cn(
        "font-condensed inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] font-bold uppercase tracking-[0.05em] leading-none whitespace-nowrap",
        responsible ? "bg-secondary text-foreground" : "border border-border text-muted-foreground",
        className,
      )}
    >
      {responsible && <Building2 size={12} aria-hidden className="shrink-0" />}
      {name}
      {responsible && <span className="sr-only"> (responsável)</span>}
    </span>
  );
}

/** Lista de pontos curtos dos diálogos de confirmação ("o que acontece"). */
export function ConsequenceList({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cn("space-y-1.5 text-[13.5px] leading-snug text-muted-foreground", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}
