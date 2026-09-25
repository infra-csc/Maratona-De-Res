import type { Criterion, useUpdateCriterion } from "@workspace/api-client-react";
import { Switch } from "@/components/ui/switch";
import { Building2, Settings2, Calendar, Copy } from "lucide-react";
import type { CriterionRouting } from "@/lib/routing-api";
import { GOOD_TEXT } from "@/lib/premium-theme";
import { CriterionWeightCell } from "./weight-cell";
import { EvaluatorPickerCell } from "./evaluator-pickers";
import type { EvaluatorOption } from "./types";

/** Uma linha da tabela de critérios: nome, área (+ duplicar), peso, avaliador padrão e status. */
export function CriterionRow({
  criterion: c, index: i, routing, pickerEvaluators, updateMutation, onDuplicate, onOpenRouting, onRoutingSaved,
}: {
  criterion: Criterion;
  index: number;
  routing: CriterionRouting | undefined;
  pickerEvaluators: EvaluatorOption[];
  updateMutation: ReturnType<typeof useUpdateCriterion>;
  onDuplicate: (c: Criterion) => void;
  onOpenRouting: (id: number) => void;
  onRoutingSaved: () => void;
}) {
  const eventCount = (c as { eventCount?: number }).eventCount ?? 0;
  return (
    <tr data-testid={`row-criterion-${c.id}`} className="transition-colors group" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", opacity: c.active ? 1 : 0.6 }}>
      <td className="px-5 py-3.5">
        <p className="font-bold uppercase transition-colors">{c.name}</p>
        {c.description && <p className="text-xs mt-1 max-w-md leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{c.description}</p>}
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          {c.responsibleAreaName ? (
            <span className="rounded-lg px-2.5 py-1 font-bold text-[11px] uppercase inline-flex items-center gap-1.5" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
              <Building2 size={12} /> {c.responsibleAreaName}
            </span>
          ) : (
            <span style={{ color: "var(--muted-foreground)" }}>—</span>
          )}
          <button
            type="button"
            data-testid={`button-duplicate-criterion-${c.id}`}
            onClick={() => onDuplicate(c)}
            title="Duplicar este critério para outra área"
            className="p-1 transition-colors shrink-0 hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Copy size={13} />
          </button>
        </div>
      </td>
      <td className="px-5 py-3.5 text-center">
        <CriterionWeightCell
          criterionId={c.id}
          weight={Number(c.defaultWeight)}
          isSaving={updateMutation.isPending}
          onSave={(value) => updateMutation.mutate({ id: c.id, data: { defaultWeight: value } })}
        />
      </td>
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <EvaluatorPickerCell
            criterionId={c.id}
            currentRouting={routing}
            evaluators={pickerEvaluators}
            onSaved={onRoutingSaved}
          />
          <button
            type="button"
            onClick={() => onOpenRouting(c.id)}
            title="Configurar roteamento e redirecionamento"
            className="p-1 transition-colors shrink-0 hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Settings2 size={13} />
          </button>
        </div>
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase" style={{ color: c.active ? GOOD_TEXT : "var(--muted-foreground)" }}>
              {c.active ? 'Ativo' : 'Inativo'}
            </span>
            <Switch
              data-testid={`switch-criterion-${c.id}`}
              aria-label={`Critério ${c.name} ${c.active ? "ativo" : "inativo"}`}
              checked={c.active}
              onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { active: v } })}
            />
          </div>
          {eventCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
              <Calendar size={10} /> {eventCount} evento{eventCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
