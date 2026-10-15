// Combobox com busca (colaborador / evento); "Todos" limpa o filtro. O X de
// limpar é um botão IRMÃO do gatilho (nada de botão dentro de botão).
import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { cn, faixaEdge } from "@/lib/utils";
import { FOCUS_RING, selectCls } from "./tl-ui";

export interface PickerOption { id: number; label: string; hint?: string; color?: string | null }

const itemCls = "data-[selected=true]:bg-secondary data-[selected=true]:text-foreground gap-2 min-h-11 lg:min-h-9";

export function SearchPicker({ id, label, value, onChange, options, placeholder, emptyText, allLabel, clearLabel, fallbackLabel, groupLabel, icon: Icon, testId, className }: {
  id: string; label: string; value: number | null; onChange: (id: number | null) => void;
  options: PickerOption[];
  placeholder: string; emptyText: string; allLabel: string; clearLabel: string;
  /** Rótulo quando o valor não está nas opções (ex.: colaborador fora do ranking). */
  fallbackLabel?: string | null;
  groupLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  testId?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.id === value);
  const shown = current?.label ?? (value != null ? fallbackLabel ?? null : null);
  return (
    <div className={cn("relative min-w-0", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open} aria-label={`${label}: ${shown ?? placeholder}`} data-testid={testId}
            className={cn(selectCls, "w-full flex items-center gap-2 text-left pr-10", shown ? "border-foreground/40 text-foreground" : "font-medium text-muted-foreground", FOCUS_RING)}>
            <Icon size={15} aria-hidden className="shrink-0 text-muted-foreground" />
            <span className="flex-1 min-w-0 truncate">{shown ?? placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[min(380px,calc(100vw-24px))] rounded-xl border-border">
          <Command>
            <CommandInput placeholder="Buscar pelo nome…" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem value={`__todos ${allLabel}`} onSelect={() => { onChange(null); setOpen(false); }} className={itemCls}>
                  <Check size={14} aria-hidden className={value == null ? "opacity-100" : "opacity-0"} />
                  <span className="flex-1 font-semibold">{allLabel}</span>
                </CommandItem>
              </CommandGroup>
              {options.length > 0 && <CommandSeparator />}
              <CommandGroup heading={groupLabel}>
                {options.map(o => (
                  <CommandItem key={o.id} value={`${o.label} ${o.id}`} onSelect={() => { onChange(o.id); setOpen(false); }} className={itemCls}>
                    <Check size={14} aria-hidden className={cn("shrink-0", o.id === value ? "opacity-100" : "opacity-0")} />
                    {o.color !== undefined && <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: o.color ?? "var(--muted-foreground)", ...faixaEdge(o.color) }} />}
                    <span className="flex-1 min-w-0 truncate">{o.label}</span>
                    {o.hint && <span className="ml-2 font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">{o.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value != null ? (
        <button type="button" aria-label={clearLabel} title={clearLabel} onClick={() => onChange(null)}
          className={cn("absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 lg:w-7 lg:h-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
          <X size={14} aria-hidden />
        </button>
      ) : (
        <ChevronsUpDown size={14} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      )}
    </div>
  );
}
