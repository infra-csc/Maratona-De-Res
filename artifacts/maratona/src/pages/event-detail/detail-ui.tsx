// Peças visuais do Detalhe do Evento — a mesma linguagem da lista de Eventos e
// das telas já redesenhadas (Avaliações, Calibração e Central).
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls,
  Bone, FOCUS_RING, fieldCls, EmptyBlock, ErrorBlock, Notice, StackBar, surfaceCls, FieldLabel, iconBtn, type Tone,
} from "../events/events-ui";

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/**
 * Bloco de seção: título condensado (h2), contagem, uma frase de contexto e a
 * ação da seção à direita. Sem cartão dentro de cartão: o corpo é livre.
 */
export function Section({ id, title, icon: Icon, count, description, action, children, className, testId }: {
  id: string;
  title: ReactNode;
  icon?: IconType;
  count?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section aria-labelledby={`${id}-title`} data-testid={testId} className={cn("rounded-2xl border border-border bg-card overflow-hidden", className)}>
      <header className="px-4 sm:px-5 py-3.5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border">
        {Icon && <Icon size={17} aria-hidden className="shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 id={`${id}-title`} className="font-condensed text-[19px] font-black uppercase leading-none tracking-[-0.005em] text-foreground">{title}</h2>
            {count != null && <span className="font-condensed text-[15px] font-bold leading-none tabular-nums text-muted-foreground">{count}</span>}
          </div>
          {description && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** Iniciais para o avatar (até duas letras). */
export function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

/** Avatar redondo com as iniciais. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={cn("w-9 h-9 shrink-0 rounded-full bg-secondary text-foreground flex items-center justify-center font-condensed text-[13px] font-black tracking-[0.02em]", className)}>
      {initials(name)}
    </span>
  );
}
