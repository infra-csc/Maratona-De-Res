// Peças visuais de Resultados & Ranking. A base — Chip, Eyebrow, botões,
// cabeçalho de diálogo, campos, esqueleto, blocos de vazio/erro — vem das
// telas já redesenhadas (Avaliações, Calibração, Central e Eventos), para o
// app parecer um produto só.
import type { ComponentType, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bone, Eyebrow, FOCUS_RING, surfaceCls as surfaceClsLocal, type Tone } from "../events/events-ui";
import { Segmented } from "../calibrations/cal-ui";

export { Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING, fieldCls, EmptyBlock, ErrorBlock, Notice, StackBar, surfaceCls, FieldLabel, FieldErrorText, iconBtn, type Tone } from "../events/events-ui";
export { Segmented } from "../calibrations/cal-ui";

/** Situação do pagamento do bônus → tom do selo (cor + texto). */
export const BONUS_TONE: Record<string, Tone> = {
  projected: "neutral",
  approved: "ok",
  scheduled: "info",
  paid: "brand",
  blocked: "danger",
  not_eligible: "neutral",
};

/** Situação do pagamento → cor da barra de progresso do pagamento. */
export const BONUS_BAR: Record<string, string> = {
  projected: "bg-muted-foreground/40",
  approved: "bg-[var(--status-ok)]",
  scheduled: "bg-[var(--status-info)]",
  paid: "bg-foreground",
  blocked: "bg-[var(--status-danger)]",
  not_eligible: "bg-secondary",
};

/** Campo de busca da barra de ferramentas (44 px no toque, 36 px com mouse). */
export function SearchField({ value, onChange, label, placeholder = "Buscar colaborador", testId, className }: {
  value: string; onChange: (v: string) => void; label: string; placeholder?: string; testId?: string; className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search size={15} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        data-testid={testId}
        className="w-full h-11 lg:h-9 rounded-lg border border-border bg-card pl-9 pr-9 text-[14px] text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Limpar busca"
          className={cn("absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}

type CellTone = "neutral" | "ok" | "warn" | "info" | "danger";
const VALUE_TONE: Record<CellTone, string> = {
  neutral: "text-foreground",
  ok: "text-[var(--status-ok-text)]",
  warn: "text-[var(--status-warn-text)]",
  info: "text-[var(--status-info-text)]",
  danger: "text-[var(--status-danger-text)]",
};

/** Uma célula de panorama (faixa única de indicadores). Com `onClick` vira atalho de filtro (aria-pressed). */
export function StatCell({ label, value, unit, sub, tone = "neutral", onClick, pressed, action, testId, title, className, children }: {
  label: ReactNode; value?: ReactNode; unit?: ReactNode; sub?: ReactNode; tone?: CellTone;
  onClick?: () => void; pressed?: boolean; action?: string; testId?: string; title?: string; className?: string; children?: ReactNode;
}) {
  const body = (
    <>
      <Eyebrow as="span" className={cn("block", pressed && "text-foreground")}>{label}</Eyebrow>
      {value != null && (
        <span className="mt-2 flex items-baseline gap-1.5 min-w-0">
          <span className={cn("font-condensed text-[28px] lg:text-[32px] font-black leading-none tracking-[-0.02em] tabular-nums whitespace-nowrap", VALUE_TONE[tone])}>{value}</span>
          {unit && <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground truncate">{unit}</span>}
        </span>
      )}
      {children}
      {sub && <span className="mt-1.5 block text-[12.5px] leading-snug text-muted-foreground">{sub}</span>}
      {onClick && action && (
        <span className={cn("mt-2 hidden sm:inline-flex items-center gap-1 font-condensed text-[12px] font-bold uppercase tracking-[0.06em]", pressed ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
          {action}
          <ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      )}
    </>
  );
  const cls = cn("min-w-0 bg-card px-4 py-3.5 lg:px-5 lg:py-4 text-left", className);
  if (!onClick) return <div data-testid={testId} title={title} className={cls}>{body}</div>;
  return (
    <button type="button" data-testid={testId} title={title} onClick={onClick} aria-pressed={pressed}
      className={cn(cls, "group transition-colors duration-150 hover:bg-secondary/50", pressed && "bg-secondary/40 hover:bg-secondary/40 shadow-[inset_0_-3px_0_var(--foreground)]", FOCUS_RING, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
      {body}
    </button>
  );
}

/**
 * Gaveta lateral (ficha do colaborador): entra pela direita no desktop/tablet,
 * ocupa a tela no celular. Radix Dialog por baixo — Esc fecha, o foco fica
 * preso dentro e volta ao gatilho ao fechar.
 */
export function Drawer({ open, onOpenChange, children, labelledBy, describedBy, testId }: {
  open: boolean; onOpenChange: (o: boolean) => void; children: ReactNode; labelledBy?: string; describedBy?: string; testId?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          data-testid={testId}
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          className={cn(
            "font-body fixed inset-y-0 right-0 z-50 flex w-full sm:w-[min(680px,calc(100vw-48px))] flex-col bg-background text-foreground sm:border-l border-border shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right duration-200 motion-reduce:animate-none",
          )}
        >
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export const DrawerTitle = DialogPrimitive.Title;
export const DrawerDescription = DialogPrimitive.Description;
export const DrawerClose = DialogPrimitive.Close;

/** Rótulo de seção dentro da ficha/abas: ícone + eyebrow + contagem opcional. */
export function SectionTitle({ icon: Icon, children, count, className, tone }: {
  icon?: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  children: ReactNode; count?: ReactNode; className?: string; tone?: "danger" | "ok";
}) {
  const color = tone === "danger" ? "text-[var(--status-danger-text)]" : tone === "ok" ? "text-[var(--status-ok-text)]" : "text-muted-foreground";
  return (
    <h3 className={cn("flex items-center gap-2 mb-2.5", className)}>
      {Icon && <Icon size={14} aria-hidden className={color} />}
      <Eyebrow as="span" className={color}>{children}</Eyebrow>
      {count != null && <span className="font-condensed text-[12px] font-bold text-muted-foreground tabular-nums">{count}</span>}
    </h3>
  );
}

export type EligFilter = "all" | "eligible" | "ineligible";

/** Todos / Elegíveis / Não elegíveis, com a contagem de cada um (aria-pressed). */
export function EligibilityFilter({ value, onChange, counts, className }: {
  value: EligFilter; onChange: (v: EligFilter) => void; counts: Record<EligFilter, number>; className?: string;
}) {
  const opt = (v: EligFilter, label: string, testId: string) => ({
    value: v, testId,
    label: <>{label} <span className="tabular-nums font-semibold opacity-70">{counts[v]}</span></>,
  });
  return (
    <Segmented<EligFilter>
      label="Filtrar por elegibilidade ao bônus"
      value={value}
      onChange={onChange}
      className={className}
      options={[opt("all", "Todos", "filter-elig-all"), opt("eligible", "Elegíveis", "filter-elig-eligible"), opt("ineligible", "Não elegíveis", "filter-elig-ineligible")]}
    />
  );
}

/** Carregando: algumas linhas de lista. */
export function ListSkeleton({ label, rows = 5 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className={cn(surfaceClsLocal, "divide-y divide-border")}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <Bone className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-2"><Bone className="h-4 w-48 max-w-full" /><Bone className="h-3 w-32" /></div>
          <Bone className="h-6 w-14 hidden sm:block" />
          <Bone className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}
