import { Users } from "lucide-react";
import type { Criterion } from "@workspace/api-client-react";
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

const MODES: { value: AreaMode; label: string }[] = [
  { value: "responsible", label: "Só a área responsável" },
  { value: "all", label: "Todas as áreas" },
  { value: "chosen", label: "Áreas escolhidas" },
];

/** Campo do diálogo de criar/editar critério. */
export function EvaluatingAreasField({ idPrefix, value, onChange, areas, responsibleAreaId, disabled }: {
  idPrefix: string;
  value: EvaluatingAreasValue;
  onChange: (v: EvaluatingAreasValue) => void;
  areas: AreaOption[] | undefined;
  responsibleAreaId: number | null | undefined;
  disabled?: boolean;
}) {
  const options = (areas ?? []).filter(a => isActive(a) && a.id !== responsibleAreaId);
  const helpId = `${idPrefix}-help`;
  const chosenCount = value.areaIds.filter(id => options.some(a => a.id === id)).length;
  return (
    <fieldset className="space-y-2" aria-describedby={helpId} disabled={disabled}>
      <legend className="font-bold uppercase text-xs tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>Áreas que avaliam</legend>
      <div role="radiogroup" aria-label="Áreas que avaliam" className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {MODES.map(m => {
          const checked = value.mode === m.value;
          const id = `${idPrefix}-mode-${m.value}`;
          return (
            <label
              key={m.value}
              htmlFor={id}
              className="flex items-center justify-center text-center rounded-lg px-2 py-2 text-xs font-bold uppercase cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]"
              style={checked
                ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", border: "1px solid var(--primary)" }
                : { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
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
              {m.label}
            </label>
          );
        })}
      </div>
      <p id={helpId} className="text-[11px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        Cada área responde o critério e a nota é a média das áreas. Vale para eventos novos; em eventos já criados use "Aplicar áreas do padrão" na Central.
      </p>
      {value.mode === "all" && (
        <p className="text-xs font-bold" style={{ color: "var(--foreground)" }}>
          {options.length === 0
            ? "Não há outras áreas ativas além da responsável."
            : `${options.length} área${options.length !== 1 ? "s" : ""} além da responsável: ${options.map(a => a.name).join(", ")}.`}
        </p>
      )}
      {value.mode === "chosen" && (
        <div className="rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
          {options.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Não há outras áreas ativas além da responsável.</p>
          ) : options.map(a => {
            const id = `${idPrefix}-area-${a.id}`;
            const checked = value.areaIds.includes(a.id);
            return (
              <label key={a.id} htmlFor={id} className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer">
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  onChange={e => onChange({
                    mode: "chosen",
                    areaIds: e.target.checked ? [...value.areaIds, a.id] : value.areaIds.filter(x => x !== a.id),
                  })}
                  className="h-4 w-4 shrink-0"
                  data-testid={`${idPrefix}-area-${a.id}`}
                />
                {a.name}
              </label>
            );
          })}
          {options.length > 0 && chosenCount === 0 && (
            <p className="text-[11px] pt-1" style={{ color: "var(--muted-foreground)" }}>Nenhuma área marcada: só a responsável responde.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}

/** Chip discreto da linha do catálogo quando mais de uma área responde o critério. */
export function EvaluatingAreasChip({ criterion, areas }: { criterion: Criterion; areas: AreaOption[] }) {
  const extras = extraAreasOf(criterion, areas);
  if (!criterion.evaluateAllAreas && extras.length === 0) return null;
  const label = criterion.evaluateAllAreas ? "Todas as áreas" : `+${extras.length} área${extras.length !== 1 ? "s" : ""}`;
  const title = extras.length > 0
    ? `Também avaliam: ${extras.map(a => a.name).join(", ")}. A nota é a média das áreas.`
    : "Todas as áreas ativas avaliam. A nota é a média das áreas.";
  return (
    <span
      data-testid={`chip-evaluating-areas-${criterion.id}`}
      title={title}
      className="rounded-lg px-2 py-1 font-bold text-[11px] uppercase inline-flex items-center gap-1 whitespace-nowrap"
      style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
    >
      <Users size={11} aria-hidden="true" /> {label}
      <span className="sr-only"> — {title}</span>
    </span>
  );
}
