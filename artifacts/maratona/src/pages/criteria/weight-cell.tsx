import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { cn, fmtNum } from "@/lib/utils";
import { FOCUS_RING } from "./criteria-ui";

const fmtWeight = (w: number) => fmtNum(w, Number.isInteger(w) ? 0 : 1);

/**
 * Peso do critério com a fatia dele no total dos ativos. Editável na própria
 * linha (Enter salva, Esc cancela); valor inválido avisa em vez de sumir.
 */
export function CriterionWeightCell({
  criterionId, criterionName, weight, share, active, canEdit, isSaving, onSave,
}: {
  criterionId: number;
  criterionName: string;
  weight: number;
  /** Fatia do total de pesos dos ativos (0–100); null quando inativo ou total zero. */
  share: number | null;
  active: boolean;
  canEdit: boolean;
  isSaving: boolean;
  onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(weight));
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // Ao sair da edição, o foco volta ao número (teclado não se perde).
  useEffect(() => {
    if (wasEditing.current && !editing) triggerRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const display = (
    <span className="flex flex-col items-start gap-1.5 min-w-0">
      <span className="flex items-baseline gap-1.5">
        <span className="font-condensed text-[22px] font-black leading-none tabular-nums text-foreground">{fmtWeight(weight)}</span>
        {share != null && <span className="text-[12.5px] font-semibold tabular-nums text-muted-foreground">{fmtNum(share, share < 10 ? 1 : 0)}%</span>}
        {isSaving && <Loader2 size={13} aria-label="Salvando o peso" className="motion-safe:animate-spin text-muted-foreground" />}
      </span>
      {active && (
        <span aria-hidden className="block h-1 w-[72px] overflow-hidden rounded-full bg-secondary">
          <span className="block h-full rounded-full bg-foreground/70 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(100, share ?? 0)}%` }} />
        </span>
      )}
    </span>
  );

  if (!canEdit) {
    return <div title={share != null ? `${fmtNum(share, 1)}% do peso total dos critérios ativos` : undefined}>{display}</div>;
  }

  if (!editing) {
    return (
      <button
        ref={triggerRef}
        type="button"
        data-testid={`button-edit-weight-${criterionId}`}
        aria-label={`Peso de ${criterionName}: ${fmtWeight(weight)}${share != null ? `, ${fmtNum(share, 0)}% do total` : ""}. Editar`}
        onClick={() => { setValue(String(weight)); setError(null); setEditing(true); }}
        className={cn("group/w -mx-2 -my-1.5 px-2 py-1.5 min-h-11 lg:min-h-0 rounded-lg inline-flex items-center gap-2 text-left transition-colors duration-150 hover:bg-secondary", FOCUS_RING)}
      >
        {display}
        <Pencil size={12} aria-hidden className="text-muted-foreground opacity-100 lg:opacity-0 lg:group-hover/w:opacity-100 lg:group-focus-visible/w:opacity-100 transition-opacity duration-150" />
      </button>
    );
  }

  const submit = () => {
    const parsed = Number(value.replace(",", "."));
    if (value.trim() === "" || !Number.isFinite(parsed) || parsed < 0) { setError("Use um número maior ou igual a zero."); return; }
    if (parsed !== weight) onSave(parsed);
    setEditing(false);
  };
  const errId = `weight-error-${criterionId}`;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          data-testid={`input-edit-weight-${criterionId}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          autoFocus
          aria-label={`Novo peso de ${criterionName}`}
          aria-invalid={!!error}
          aria-describedby={error ? errId : undefined}
          value={value}
          disabled={isSaving}
          onChange={e => { setValue(e.target.value); setError(null); }}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); }
          }}
          className={cn(
            "h-11 lg:h-9 w-[72px] rounded-lg border bg-card px-2 text-center font-condensed text-[18px] font-black tabular-nums text-foreground transition-[border-color,box-shadow] duration-150 focus:outline-none focus:ring-2 focus:ring-ring/30",
            error ? "border-[var(--status-danger)]" : "border-border focus:border-foreground/40",
          )}
        />
        <button type="button" data-testid={`button-save-weight-${criterionId}`} onClick={submit} aria-label="Salvar peso" title="Salvar (Enter)"
          className={cn("w-11 h-11 lg:w-9 lg:h-9 rounded-lg inline-flex items-center justify-center bg-primary text-primary-foreground transition-opacity duration-150 hover:opacity-90", FOCUS_RING)}>
          <Check size={15} aria-hidden />
        </button>
        <button type="button" onClick={() => setEditing(false)} aria-label="Cancelar edição do peso" title="Cancelar (Esc)"
          className={cn("w-11 h-11 lg:w-9 lg:h-9 rounded-lg inline-flex items-center justify-center border border-border bg-card text-foreground transition-colors duration-150 hover:bg-secondary", FOCUS_RING)}>
          <X size={15} aria-hidden />
        </button>
      </div>
      {error && <p id={errId} role="alert" className="text-[12.5px] font-semibold text-[var(--status-danger-text)]">{error}</p>}
    </div>
  );
}
