// Barra de filtros: busca, colaborador e evento sempre à vista; tipo, direção,
// "só mudança de faixa", quem fez e período num segundo nível — aberto no
// desktop, recolhível no celular ("Filtros · 2"). Abaixo, o resumo do que
// está na tela e "Limpar tudo".
import { useId, useState, type ReactNode } from "react";
import { CalendarCheck2, SlidersHorizontal, User, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn, plural } from "@/lib/utils";
import { FOCUS_RING, SearchField, Segmented, btnGhost, btnSmall, selectCls } from "./tl-ui";
import { SearchPicker, type PickerOption } from "./search-picker";
import { PeriodSwitch } from "./timeline-header";
import { TYPES, advancedCount, type Filters, type PresetKey } from "./filters";
import { dayKey, shortDay, type Direction } from "./describe";

const dateCls = cn(selectCls, "w-full pl-10 pr-2 tabular-nums font-medium");
const datePrefix = "font-condensed absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground pointer-events-none";

function Group({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p aria-hidden className="font-condensed mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function TimelineFilters({ f, patch, people, events, authors, preset, onPreset, filteredName }: {
  f: Filters;
  patch: (p: Partial<Filters>) => void;
  people: PickerOption[];
  events: PickerOption[];
  authors: string[];
  preset: PresetKey;
  onPreset: (k: PresetKey) => void;
  filteredName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const extra = advancedCount(f);

  return (
    <section aria-label="Filtros" className="space-y-2.5">
      <div className="grid gap-2.5 grid-cols-[minmax(0,1fr)_auto] md:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SearchField value={f.q} onChange={q => patch({ q })} label="Buscar critério, motivo ou pessoa" placeholder="Buscar critério, motivo, pessoa…"
          testId="input-search-timeline" className="md:col-span-2 lg:col-span-1" />
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId} data-testid="button-toggle-filters"
          className={cn(btnSmall, "md:hidden px-3", extra > 0 && "border-foreground/40")}>
          <SlidersHorizontal size={15} aria-hidden />
          Filtros{extra > 0 && <span className="tabular-nums">· {extra}</span>}
        </button>
        <SearchPicker id="tl-emp" label="Colaborador" icon={User} groupLabel="Colaboradores do ciclo" testId="filter-employee"
          placeholder="Todos os colaboradores" emptyText="Ninguém com esse nome." allLabel="Todos os colaboradores" clearLabel="Limpar colaborador"
          value={f.employee} fallbackLabel={filteredName} onChange={id => patch({ employee: id })} options={people}
          className="col-span-2 md:col-span-1" />
        <SearchPicker id="tl-ev" label="Evento" icon={CalendarCheck2} groupLabel="Eventos com mudança" testId="filter-event"
          placeholder="Todos os eventos" emptyText="Nenhum evento com esse nome." allLabel="Todos os eventos" clearLabel="Limpar evento"
          value={f.event} fallbackLabel={f.event ? `Evento nº ${f.event}` : null} onChange={id => patch({ event: id })} options={events}
          className="col-span-2 md:col-span-1" />
      </div>

      <div id={panelId} className={cn(open ? "block" : "hidden", "md:block rounded-2xl border border-border bg-card px-4 py-3.5 lg:px-5")}>
        <div className="flex flex-col gap-y-3.5">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-x-6 gap-y-3.5">
          <Group label="Tipo de acontecimento">
            <div role="group" aria-label="Tipo de acontecimento" className="flex flex-wrap gap-1.5">
              {TYPES.map(t => {
                const on = f.type === t.value;
                return (
                  <button key={t.value} type="button" aria-pressed={on} onClick={() => patch({ type: t.value })} data-testid={`filter-type-${t.value}`}
                    className={cn(
                      "font-condensed inline-flex items-center min-h-11 lg:min-h-8 px-3 rounded-lg text-[13px] font-bold uppercase tracking-[0.04em] leading-none whitespace-nowrap transition-colors duration-150",
                      on ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                      FOCUS_RING,
                    )}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </Group>
          <label htmlFor="tl-faixa" className="flex items-center gap-2.5 min-h-11 lg:min-h-8 text-[13.5px] font-semibold text-foreground cursor-pointer select-none sm:mb-px">
            <Switch id="tl-faixa" checked={f.faixa} onCheckedChange={v => patch({ faixa: v })} data-testid="filter-faixa" />
            Só mudança de faixa
          </label>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-x-6 gap-y-3.5">
            <Group label="Direção da nota">
              <Segmented<Direction>
                label="Direção da mudança"
                size="sm"
                value={f.dir}
                onChange={dir => patch({ dir })}
                className="sm:w-[288px]"
                options={[
                  { value: "todas", label: "Subiu ou caiu", testId: "filter-dir-todas" },
                  { value: "alta", label: <><span aria-hidden>▲</span> Subiu</>, ariaLabel: "Subiu", testId: "filter-dir-alta", title: "Nota maior que a anterior (quem entrou na nota agora não entra aqui)", activeCls: "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)] shadow-sm" },
                  { value: "queda", label: <><span aria-hidden>▼</span> Caiu</>, ariaLabel: "Caiu", testId: "filter-dir-queda", title: "Nota menor que a anterior (quem saiu do ciclo não entra aqui)", activeCls: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] shadow-sm" },
                ]}
              />
            </Group>
            <Group label="Quem fez" className="sm:w-[220px]">
              <select id="tl-by" aria-label="Quem fez" value={f.by} onChange={e => patch({ by: e.target.value })} data-testid="filter-by"
                className={cn(selectCls, "w-full", f.by && "border-foreground/40")}>
                <option value="">Qualquer pessoa</option>
                {authors.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Group>
            <Group label="Período" className="sm:w-[340px]">
              <fieldset className="grid grid-cols-2 gap-2 min-w-0">
                <legend className="sr-only">Período</legend>
                <label className="relative min-w-0">
                  <span aria-hidden className={datePrefix}>De</span>
                  <input id="tl-from" type="date" value={f.from} max={f.to || undefined} onChange={e => patch({ from: e.target.value })}
                    aria-label="Mudanças a partir de" data-testid="filter-from" className={cn(dateCls, f.from && "border-foreground/40")} />
                </label>
                <label className="relative min-w-0">
                  <span aria-hidden className={datePrefix}>Até</span>
                  <input id="tl-to" type="date" value={f.to} min={f.from || undefined} onChange={e => patch({ to: e.target.value })}
                    aria-label="Mudanças até" data-testid="filter-to" className={cn(dateCls, f.to && "border-foreground/40")} />
                </label>
              </fieldset>
            </Group>
            <Group label="Atalhos de período" className="w-full lg:hidden">
              <PeriodSwitch value={preset} onChange={onPreset} size="sm" />
            </Group>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "14 acontecimentos em 9 dias · registro exato desde 15/10" + Limpar tudo. */
export function FilterSummary({ happenings, days, filtered, suffix, recordedSince, onClear }: {
  happenings: number; days: number; filtered: boolean; suffix: string; recordedSince: string | null | undefined; onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-h-8 text-[13px] text-muted-foreground">
      <span aria-live="polite" className="tabular-nums" data-testid="timeline-count">
        <strong className="font-semibold text-foreground">{plural(happenings, "acontecimento", "acontecimentos")}</strong>
        {" em "}{plural(days, "dia", "dias")}{suffix}
      </span>
      {recordedSince && (
        <span className="hidden sm:inline" title="Antes desta data, a linha do tempo foi remontada a partir dos dados atuais (eventos confirmados e lançamentos).">
          · registro exato desde {shortDay(dayKey(recordedSince))}; antes disso, remontado
        </span>
      )}
      {filtered && (
        <button type="button" onClick={onClear} data-testid="button-clear-filters" className={cn(btnGhost, "min-h-9 md:min-h-8 px-2 -ml-1 text-[12.5px]")}>
          <X size={13} aria-hidden /> Limpar tudo
        </button>
      )}
    </div>
  );
}
