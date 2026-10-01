import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CONDENSED } from "@/lib/premium-theme";
import { inkOn } from "./derive";

export const SERIES = "var(--viz-series-1)";
export const SERIES_2 = "var(--viz-series-2)";
export const GRID = "var(--viz-grid)";
export const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
export const LABEL_STYLE = { fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" } as const;

/** Cartão padrão das Análises: título condensado, subtítulo e ação opcional à direita. */
export function Card({ title, subtitle, action, children, className = "", id }: {
  title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={`rounded-xl p-4 sm:p-5 flex flex-col gap-4 min-w-0 ${className}`} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-[240px]">
          <h2 className="text-[15px] font-black uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.01em" }}>{title}</h2>
          {subtitle && <p className="text-[12px] mt-0.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SmallLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[11px] font-bold uppercase ${className}`} style={LABEL_STYLE}>{children}</p>;
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
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open} data-testid="picker-colaborador"
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--input)", color: current ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: current ? 600 : 400 }}>
          <span className="flex items-center gap-2 min-w-0">
            {current?.color !== undefined && current && <span aria-hidden className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: current.color ?? "var(--muted-foreground)" }} />}
            <span className="truncate">{current ? current.label : placeholder}</span>
          </span>
          {current ? (
            <span role="button" tabIndex={0} aria-label="Limpar colaborador" onClick={e => { e.stopPropagation(); onChange(null); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(null); } }}
              className="rounded p-0.5 hover:bg-[var(--secondary)]"><X size={14} aria-hidden /></span>
          ) : <ChevronsUpDown size={14} aria-hidden style={{ color: "var(--muted-foreground)" }} />}
        </button>
      </PopoverTrigger>
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
                  {o.color !== undefined && <span aria-hidden className="mr-2 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color ?? "var(--muted-foreground)" }} />}
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
      className="h-8 px-3 rounded-full text-[12px] font-bold uppercase whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: active ? "var(--primary)" : "var(--secondary)", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
      {children}
    </button>
  );
}
