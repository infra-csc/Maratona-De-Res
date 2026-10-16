import { Check } from "lucide-react";
import type { Criterion } from "@workspace/api-client-react";
import { cn, plural } from "@/lib/utils";
import { AreaChip, Chip, Eyebrow } from "./criteria-ui";
import type { AreaOption } from "./types";

/**
 * "Áreas que avaliam" um critério do catálogo: só a responsável, todas as
 * áreas ativas ou uma lista escolhida. No evento, cada área extra vira uma
 * cópia do critério e a nota é a média das áreas (backend: lib/area-copies).
 */
export type AreaMode = "responsible" | "all" | "chosen";
export type EvaluatingAreasValue = { mode: AreaMode; areaIds: number[] };

export const EMPTY_AREAS_VALUE: EvaluatingAreasValue = { mode: "responsible", areaIds: [] };

const isActive = (a: AreaOption) => a.active !== false;

/** Estado do campo a partir do critério salvo. */
export function areasValueOf(c: Pick<Criterion, "evaluateAllAreas" | "evaluatingAreaIds" | "responsibleAreaId"> | null | undefined): EvaluatingAreasValue {
  if (!c) return EMPTY_AREAS_VALUE;
  if (c.evaluateAllAreas) return { mode: "all", areaIds: [] };
  const ids = (c.evaluatingAreaIds ?? []).filter(id => id !== c.responsibleAreaId);
  return ids.length > 0 ? { mode: "chosen", areaIds: ids } : EMPTY_AREAS_VALUE;
}

/** Corpo enviado ao POST/PATCH /criteria (a responsável nunca vai na lista). */
export function areasPayload(v: EvaluatingAreasValue, responsibleAreaId: number | null | undefined) {
  if (v.mode === "all") return { evaluateAllAreas: true, evaluatingAreaIds: [] as number[] };
  if (v.mode === "chosen") {
    return { evaluateAllAreas: false, evaluatingAreaIds: [...new Set(v.areaIds)].filter(id => id !== responsibleAreaId) };
  }
  return { evaluateAllAreas: false, evaluatingAreaIds: [] as number[] };
}

/** Áreas extras (além da responsável) que respondem o critério, pelo padrão do catálogo. */
export function extraAreasOf(c: Pick<Criterion, "evaluateAllAreas" | "evaluatingAreaIds" | "responsibleAreaId">, areas: AreaOption[]): AreaOption[] {
  if (c.evaluateAllAreas) return areas.filter(a => isActive(a) && a.id !== c.responsibleAreaId);
  const ids = new Set((c.evaluatingAreaIds ?? []).filter(id => id !== c.responsibleAreaId));
  return areas.filter(a => ids.has(a.id));
}

const MODES: { value: AreaMode; label: string; hint: string }[] = [
  { value: "responsible", label: "Só a responsável", hint: "Uma área responde." },
  { value: "chosen", label: "Áreas escolhidas", hint: "A responsável e as marcadas." },
  { value: "all", label: "Todas as áreas", hint: "Toda área ativa responde." },
];

/** Campo "Áreas que avaliam" dos diálogos de criar critério e de editar as áreas. */
export function EvaluatingAreasField({ idPrefix, value, onChange, areas, responsibleAreaId, disabled }: {
  idPrefix: string;
  value: EvaluatingAreasValue;
  onChange: (v: EvaluatingAreasValue) => void;
  areas: AreaOption[] | undefined;
  responsibleAreaId: number | null | undefined;
  disabled?: boolean;
}) {
  const options = (areas ?? []).filter(a => isActive(a) && a.id !== responsibleAreaId);
  const responsible = (areas ?? []).find(a => a.id === responsibleAreaId);
  const helpId = `${idPrefix}-help`;
  const chosen = options.filter(a => value.areaIds.includes(a.id));
  const total = 1 + (value.mode === "all" ? options.length : value.mode === "chosen" ? chosen.length : 0);
  return (
    <fieldset className="min-w-0 space-y-2.5" aria-describedby={helpId} disabled={disabled}>
      <legend className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">Áreas que avaliam</legend>
      <div role="radiogroup" aria-label="Áreas que avaliam" className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {MODES.map(m => {
          const checked = value.mode === m.value;
          const id = `${idPrefix}-mode-${m.value}`;
          return (
            <label
              key={m.value}
              htmlFor={id}
              className={cn(
                "relative flex sm:flex-col items-center sm:items-start gap-x-2 gap-y-0.5 rounded-xl border px-3 py-2.5 min-h-11 cursor-pointer transition-[background-color,border-color,box-shadow] duration-150",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
                checked ? "border-foreground bg-secondary/60 shadow-[inset_0_0_0_1px_var(--foreground)]" : "border-border hover:border-foreground/30",
              )}
            >
              <input
                id={id}
                type="radio"
                name={`${idPrefix}-mode`}
                value={m.value}
                checked={checked}
                onChange={() => onChange({ mode: m.value, areaIds: m.value === "chosen" ? value.areaIds : [] })}
                className="sr-only"
                data-testid={`${idPrefix}-mode-${m.value}`}
              />
              <span className="font-condensed text-[14px] font-bold uppercase tracking-[0.04em] leading-tight text-foreground">{m.label}</span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">{m.hint}</span>
              {checked && <Check size={14} aria-hidden className="absolute right-2.5 top-2.5 hidden sm:block text-foreground" />}
            </label>
          );
        })}
      </div>

      {value.mode === "chosen" && (
        <div className="rounded-xl border border-border p-3">
          {options.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Não há outras áreas ativas além da responsável.</p>
          ) : (
            <>
              <Eyebrow as="p" className="mb-2">Marque as áreas que também respondem</Eyebrow>
              <div className="flex flex-wrap gap-1.5">
                {options.map(a => {
                  const id = `${idPrefix}-area-${a.id}`;
                  const checked = value.areaIds.includes(a.id);
                  return (
                    <label key={a.id} htmlFor={id}
                      className={cn(
                        "font-condensed inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-lg border text-[13px] font-bold uppercase tracking-[0.04em] cursor-pointer select-none transition-[background-color,border-color,color] duration-150",
                        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        checked ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                      )}>
                      <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        onChange={e => onChange({
                          mode: "chosen",
                          areaIds: e.target.checked ? [...value.areaIds, a.id] : value.areaIds.filter(x => x !== a.id),
                        })}
                        className="sr-only"
                        data-testid={`${idPrefix}-area-${a.id}`}
                      />
                      {checked && <Check size={13} aria-hidden />}
                      {a.name}
                    </label>
                  );
                })}
              </div>
              {chosen.length === 0 && (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Nenhuma marcada: só a responsável responde.</p>
              )}
            </>
          )}
        </div>
      )}

      <p id={helpId} className="text-[12.5px] leading-relaxed text-muted-foreground">
        {responsible
          ? <><span className="font-semibold text-foreground">{plural(total, "área responde", "áreas respondem")}</span>{total > 1 ? " — a nota do critério é a média das áreas." : ` — ${responsible.name}.`}</>
          : "Escolha a área responsável para definir quem avalia."}
        {" "}Vale para eventos novos; nos já criados, use “Aplicar áreas do padrão” na Central.
      </p>
      {value.mode === "all" && options.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Áreas que respondem">
          {responsible && <AreaChip name={responsible.name} responsible />}
          {options.map(a => <AreaChip key={a.id} name={a.name} />)}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Quem avalia, na linha do catálogo: a área responsável em destaque e as que
 * também respondem. Com "todas as áreas", um selo só (a lista vai no título).
 */
export function EvaluatingAreasCell({ criterion, areas, max = 3 }: { criterion: Criterion; areas: AreaOption[]; max?: number }) {
  const extras = extraAreasOf(criterion, areas);
  const all = !!criterion.evaluateAllAreas;
  const shown = all ? [] : extras.slice(0, max);
  const hidden = all ? [] : extras.slice(max);
  const count = 1 + extras.length;
  return (
    <span className="flex flex-col gap-1.5 min-w-0">
      <span className="flex flex-wrap items-center gap-1">
        {criterion.responsibleAreaName
          ? <AreaChip name={criterion.responsibleAreaName} responsible />
          : <Chip tone="warn" title="Critério sem área responsável">Sem área</Chip>}
        {all && (
          <Chip tone="info" data-testid={`chip-evaluating-areas-${criterion.id}`}
            title={extras.length > 0 ? `Também avaliam: ${extras.map(a => a.name).join(", ")}` : "Todas as áreas ativas avaliam"}>
            + Todas as áreas
          </Chip>
        )}
        {shown.map((a, i) => (
          <span key={a.id} data-testid={i === 0 ? `chip-evaluating-areas-${criterion.id}` : undefined} className="contents">
            <AreaChip name={a.name} />
          </span>
        ))}
        {hidden.length > 0 && (
          <span title={hidden.map(a => a.name).join(", ")} className="font-condensed inline-flex items-center h-6 px-1.5 text-[12px] font-bold text-muted-foreground">
            +{hidden.length}<span className="sr-only"> {hidden.map(a => a.name).join(", ")}</span>
          </span>
        )}
      </span>
      {extras.length > 0 && (
        <span className="text-[12.5px] leading-snug text-muted-foreground">Nota = média das {count} áreas</span>
      )}
    </span>
  );
}
