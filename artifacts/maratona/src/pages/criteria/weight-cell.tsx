import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Pencil, Check, X } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import { fmtNum } from "@/lib/utils";
import { fieldStyle } from "./helpers";

/** Peso do critério editável na própria linha (Enter salva, Esc cancela). */
export function CriterionWeightCell({
  criterionId, weight, isSaving, onSave,
}: {
  criterionId: number; weight: number; isSaving: boolean; onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(weight));

  if (!editing) {
    return (
      <button
        type="button"
        data-testid={`button-edit-weight-${criterionId}`}
        onClick={() => { setValue(String(weight)); setEditing(true); }}
        className="rounded-lg px-3 py-1.5 inline-flex items-center gap-2 min-w-[48px] transition-colors hover:opacity-80 group/weight"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <span className="text-lg font-black" style={{ fontFamily: CONDENSED }}>{fmtNum(weight, 0)}</span>
        <Pencil size={11} className="opacity-0 group-hover/weight:opacity-100 transition-opacity" style={{ color: "var(--muted-foreground)" }} />
      </button>
    );
  }

  const submit = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) { setEditing(false); return; }
    if (parsed !== weight) onSave(parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        data-testid={`input-edit-weight-${criterionId}`}
        type="number"
        min="0"
        step="1"
        autoFocus
        value={value}
        disabled={isSaving}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
        className="h-9 w-20 rounded-lg text-center font-black"
        style={fieldStyle}
      />
      <button type="button" data-testid={`button-save-weight-${criterionId}`} onClick={submit} className="p-1.5 rounded-lg transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
        <X size={14} />
      </button>
    </div>
  );
}
