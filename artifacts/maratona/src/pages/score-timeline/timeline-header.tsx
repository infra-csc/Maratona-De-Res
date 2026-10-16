// Topo fixo: o único h1, o ciclo e o período (atalhos "Ciclo todo / Hoje /
// 7 dias / 30 dias"). No celular o período desce para os filtros.
import { CalendarRange } from "lucide-react";
import { Chip, Segmented } from "./tl-ui";
import { PRESETS, type PresetKey } from "./filters";

export const PERIOD_OPTIONS: { value: PresetKey; label: string }[] = [
  { value: "tudo", label: "Ciclo todo" },
  ...PRESETS.map(p => ({ value: p.key as PresetKey, label: p.label })),
];

export function PeriodSwitch({ value, onChange, className, size = "md" }: { value: PresetKey; onChange: (k: PresetKey) => void; className?: string; size?: "sm" | "md" }) {
  return (
    <Segmented<PresetKey>
      label="Período"
      size={size}
      value={value === "custom" ? null : value}
      onChange={onChange}
      className={className}
      options={PERIOD_OPTIONS.map(o => ({ value: o.value, label: o.label, testId: `period-${o.value}` }))}
    />
  );
}

export function TimelineHeader({ cycleName, preset, onPreset }: { cycleName: string | null; preset: PresetKey; onPreset: (k: PresetKey) => void }) {
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 md:py-0 md:h-16 flex items-center gap-3 lg:gap-5">
      <div className="min-w-0 flex items-center gap-3">
        <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-[0.95] text-foreground">
          Linha do tempo
        </h1>
        {cycleName && <Chip icon={CalendarRange} className="hidden sm:inline-flex" title="Ciclo mostrado">{cycleName}</Chip>}
      </div>
      <p className="hidden 2xl:block min-w-0 truncate text-[13px] text-muted-foreground">O que mudou nas notas, para quem e por quê — dia a dia.</p>
      <div className="ml-auto hidden lg:flex items-center gap-2 shrink-0">
        {preset === "custom" && <span className="text-[12.5px] font-semibold text-muted-foreground">Período escolhido</span>}
        <PeriodSwitch value={preset} onChange={onPreset} size="sm" className="w-[340px]" />
      </div>
    </div>
  );
}
