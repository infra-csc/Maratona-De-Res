import * as React from "react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CONDENSED } from "@/lib/premium-theme";
import { inkOn } from "./derive";
import { cn, faixaEdge } from "@/lib/utils";
import { Bone, Chip, StatCell } from "../results/results-ui";

export const SERIES = "var(--viz-series-1)";
export const SERIES_2 = "var(--viz-series-2)";
export const GRID = "var(--viz-grid)";
export const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
export const LABEL_STYLE = { fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" } as const;

/**
 * Bloco padrão das Análises (mesma linguagem do Painel de gestão e do
 * Dashboard): superfície, título condensado com linha de apoio e ação à direita.
 */
export function Card({ title, subtitle, action, children, className = "", id }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl border border-border bg-card p-4 lg:p-5 flex flex-col gap-4 min-w-0", className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
        <div className="min-w-0 flex-1 basis-[240px]">
          <h2 className="font-condensed text-[17px] lg:text-[18px] font-black uppercase leading-tight tracking-[-0.005em] text-foreground">{title}</h2>
          {subtitle && <p className="mt-1 text-[13px] leading-snug text-muted-foreground max-w-[72ch]">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SmallLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={cn("font-condensed text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-muted-foreground", className)}>{children}</p>;
}

/** Faixa de indicadores (células coladas, separadas por fio) — a mesma do Dashboard e do Painel. */
export function KpiStrip({ className, children, "data-testid": testId }: { className?: string; children: ReactNode; "data-testid"?: string }) {
  return <section aria-label="Indicadores" data-testid={testId} className={cn("rounded-2xl border border-border overflow-hidden grid gap-px bg-border", className)}>{children}</section>;
}

/** Indicador dentro da KpiStrip (mesmas props do StatTile antigo; `hero` não muda o desenho). */
export function StatTile({ label, value, detail, className, "data-testid": testId }: {
  label: ReactNode; value: ReactNode; detail?: ReactNode; hero?: boolean; className?: string; "data-testid"?: string;
}) {
  return <StatCell label={label} value={value} sub={detail} className={className} testId={testId} />;
}

/** Chip da faixa: cor da regra + nome (o nome é sempre o sinal; a cor só reforça). */
export function FaixaChip({ name, color, size = "md", muted }: { name: string | null | undefined; color?: string | null; size?: "sm" | "md" | "lg"; muted?: boolean }) {
  if (!name) return <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Sem faixa</span>;
  const cls = size === "lg" ? "h-8 px-3 text-[14px]" : size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-6 px-2 text-[12px]";
  if (muted) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md font-bold uppercase whitespace-nowrap ${cls}`} style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <span aria-hidden className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: color ?? "var(--muted-foreground)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }} />
        {name}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-md font-bold uppercase whitespace-nowrap ${cls}`}
      style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: color ?? "var(--secondary)", color: color ? inkOn(color) : "var(--foreground)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.12)" }}>
      {name}
    </span>
  );
}

export function VizTooltipBox({ title, lines }: { title: ReactNode; lines: { label: string; value: ReactNode }[] }) {
  return (
    <div className="rounded-lg px-3 py-2 text-[12px] shadow-md max-w-[280px]" style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}>
      <div className="font-bold leading-snug">{title}</div>
      {lines.map((l, i) => (
        <div key={i} className="mt-0.5 flex justify-between gap-5">
          <span style={{ color: "var(--muted-foreground)" }}>{l.label}</span>
          <span className="font-semibold tabular-nums text-right">{l.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Largura do contêiner (gráficos em div precisam dela para posicionar). */
export function useWidth<E extends HTMLElement>() {
  const ref = useRef<E>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(entries => setWidth(entries[0]?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Combobox com busca (mesmo padrão da Linha do tempo); "Todos" limpa a escolha. */
export function SearchPicker({ id, value, onChange, options, placeholder, emptyText, allLabel }: {
  id: string; value: number | null; onChange: (id: number | null) => void;
  options: { id: number; label: string; hint?: string; color?: string | null }[];
  placeholder: string; emptyText: string; allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* O botão de limpar é IRMÃO do combobox (posicionado por cima), não filho: botão dentro de botão é marcação inválida. */}
      <div className="relative">
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} data-testid="picker-colaborador"
            className={`flex h-11 lg:h-10 w-full items-center justify-between gap-2 rounded-lg pl-3 text-left text-[14px] transition-[border-color,box-shadow,background-color] duration-150 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:border-foreground/40 ${current ? "pr-[76px]" : "pr-3"}`}
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--input)", color: current ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: current ? 600 : 400 }}>
            <span className="flex items-center gap-2 min-w-0">
              {current?.color !== undefined && current && <span aria-hidden className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: current.color ?? "var(--muted-foreground)", ...faixaEdge(current.color) }} />}
              <span className="truncate">{current ? current.label : placeholder}</span>
            </span>
            <ChevronsUpDown size={14} aria-hidden className={current ? "absolute right-3 top-1/2 -translate-y-1/2" : ""} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </PopoverTrigger>
        {current && (
          <button type="button" aria-label="Limpar colaborador" title="Limpar (toda a equipe)" onClick={() => onChange(null)} data-testid="picker-colaborador-clear"
            className="absolute right-8 top-1/2 -translate-y-1/2 h-9 w-9 lg:h-8 lg:w-8 inline-flex items-center justify-center rounded-md hover:bg-[var(--secondary)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ color: "var(--muted-foreground)" }}>
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="p-0 w-[min(92vw,380px)]">
        <Command>
          <CommandInput placeholder="Buscar pelo nome…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={`__todos ${allLabel}`} onSelect={() => { onChange(null); setOpen(false); }}>
                <span className="flex-1">{allLabel}</span>{value == null && <Check size={14} aria-hidden />}
              </CommandItem>
              {options.map(o => (
                <CommandItem key={o.id} value={`${o.label} ${o.id}`} onSelect={() => { onChange(o.id); setOpen(false); }}>
                  {o.color !== undefined && <span aria-hidden className="mr-2 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color ?? "var(--muted-foreground)", ...faixaEdge(o.color) }} />}
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="ml-2 text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{o.hint}</span>}
                  {o.id === value && <Check size={14} className="ml-2" aria-hidden />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Botão-pílula de filtro (mesmo visual da Linha do tempo). */
export function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className="font-condensed inline-flex items-center min-h-11 lg:min-h-8 px-3 rounded-lg text-[13px] font-bold uppercase whitespace-nowrap transition-[background-color,color] duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: active ? "var(--primary)" : "var(--secondary)", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
      {children}
    </button>
  );
}

type IconT = React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/**
 * Vazio / falha dentro das Análises por colaborador, na linguagem dos blocos:
 * `compact` = em linha dentro de um bloco (ícone, frase, ação); sem ele, um
 * bloco próprio centralizado (ex.: ciclo novo, ainda sem ranking).
 */
export function EmptyState({ icon: Icon, title, description, action, compact, "data-testid": testId }: {
  icon?: IconT; title: ReactNode; description?: ReactNode; action?: ReactNode; compact?: boolean; "data-testid"?: string;
}) {
  if (compact) {
    return (
      <div role="status" data-testid={testId} className="flex items-start gap-3 py-1">
        {Icon && <span className="w-9 h-9 shrink-0 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Icon size={16} aria-hidden /></span>}
        <div className="min-w-0 pt-0.5">
          <p className="text-[14px] font-semibold text-foreground leading-snug">{title}</p>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>}
          {action && <div className="mt-2.5">{action}</div>}
        </div>
      </div>
    );
  }
  return (
    <div role="status" data-testid={testId} className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
      {Icon && <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Icon size={20} aria-hidden /></span>}
      <p className="font-condensed mt-3 text-[20px] font-black uppercase leading-tight text-foreground">{title}</p>
      {description && <p className="text-[14px] leading-relaxed text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Selo de estado (mesmas props do StatusBadge antigo) no desenho do Chip das outras telas: cor + texto. */
export function StatusBadge({ variant, label, icon, srLabel, "data-testid": testId }: {
  variant: "neutral" | "ok" | "warn" | "danger" | "info"; label: ReactNode; icon?: IconT; srLabel?: string; size?: "sm" | "md"; "data-testid"?: string;
}) {
  return (
    <Chip tone={variant} icon={icon} title={srLabel} data-testid={testId}>
      <span aria-hidden={srLabel ? true : undefined}>{label}</span>
      {srLabel && <span className="sr-only">{srLabel}</span>}
    </Chip>
  );
}

/** Carregando dentro de um bloco: linhas-esqueleto (mesmo Bone das outras abas). */
export function BlockSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 py-1">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3" aria-hidden>
          <Bone className="h-4 flex-1" /><Bone className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

/** Cabeçalho de coluna das tabelas das Análises (mesmo do Painel e de Resultados). */
export const TH_CLS = "py-2 px-2 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap border-b border-border";
/** Botão de ordenação dentro do cabeçalho. */
export const TH_BTN = "inline-flex items-center gap-1 min-h-8 uppercase tracking-[0.08em] font-bold rounded hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/** Célula padrão das tabelas das Análises. */
export const TD_CLS = "py-2.5 px-2 align-middle border-b border-border";
