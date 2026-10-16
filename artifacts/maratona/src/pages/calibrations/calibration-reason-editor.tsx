// Justificativa da calibração (editável), com indicadores "Salvo"/"Não salvo"
// e auto-save ao perder o foco quando já existe calibração.
import type React from "react";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, btnSmall } from "../evaluations/ui";
import { fieldCls } from "./cal-ui";
import { fmtCalScore, formatDateTime } from "./helpers";
import type { CalibrationRecord } from "./derive";

export type CalibrationReasonEditorProps = {
  criterionId: number;
  cal: CalibrationRecord | undefined;
  calVal: number | null;
  reasonVal: string;
  reasonChanged: boolean;
  isSaving: boolean;
  savedReasonIds: Set<number>;
  setSavedReasonIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  saveCalibration: (critId: number) => Promise<void>;
};

function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

export function CalibrationReasonEditor({
  criterionId, cal, calVal, reasonVal, reasonChanged, isSaving, savedReasonIds, setSavedReasonIds, setCalReasons, saveCalibration,
}: CalibrationReasonEditorProps) {
  const fieldId = `cal-reason-${criterionId}`;
  const justSaved = savedReasonIds.has(criterionId) && !reasonChanged;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 min-h-5">
        <Eyebrow as="span"><label htmlFor={fieldId}>Justificativa da calibração</label></Eyebrow>
        <span className="ml-auto text-[12px] font-semibold" aria-live="polite">
          {isSaving ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 size={12} className="animate-spin" aria-hidden /> Salvando…</span>
          ) : reasonChanged ? (
            <span className="inline-flex items-center gap-1 text-[var(--status-warn-text)]"><AlertCircle size={12} aria-hidden /> Não salvo</span>
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1 text-[var(--status-ok-text)] motion-safe:animate-in motion-safe:fade-in-0 duration-200"><Check size={12} aria-hidden /> Salvo</span>
          ) : null}
        </span>
      </div>
      <textarea
        id={fieldId}
        data-testid={`input-cal-reason-inline-${criterionId}`}
        rows={2}
        value={reasonVal}
        onChange={e => {
          setSavedReasonIds(prev => { const n = new Set(prev); n.delete(criterionId); return n; });
          setCalReasons(prev => ({ ...prev, [criterionId]: e.target.value }));
          grow(e.target);
        }}
        onFocus={e => grow(e.target)}
        onBlur={() => {
          // Auto-save ao perder foco quando há uma calibração existente e razão mudou.
          // O indicador "Salvo" é ligado por saveCalibration só após sucesso.
          if (reasonChanged && cal && !isSaving) void saveCalibration(criterionId);
        }}
        placeholder={cal ? "Por que a nota foi calibrada? Salva sozinha ao sair do campo." : "Por que a nota foi calibrada?"}
        className={cn(fieldCls, "w-full min-h-[64px] px-3 py-2.5 text-[14px] leading-relaxed resize-none overflow-hidden",
          reasonChanged && "border-[var(--status-warn)] bg-[var(--status-warn-bg)]")}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        {cal ? (
          <p className="text-[12.5px] text-muted-foreground" title="Calibração salva: só vale para o colaborador depois de publicada">
            <span className="font-semibold text-foreground">Calibração salva</span>
            {cal.calibratedByName && <> · {cal.calibratedByName}</>}
            {calVal != null && <> <span className="font-semibold text-foreground tabular-nums">→ {fmtCalScore(calVal)}</span></>}
            {cal.calibratedAt && <> · {formatDateTime(new Date(cal.calibratedAt))}</>}
          </p>
        ) : reasonChanged ? (
          <p className="text-[12.5px] text-muted-foreground inline-flex items-center gap-1.5">
            <AlertCircle size={13} aria-hidden /> Salve a nota calibrada para gravar a justificativa junto.
          </p>
        ) : null}
        {reasonChanged && cal && (
          <button type="button" disabled={isSaving} onClick={() => void saveCalibration(criterionId)} className={cn(btnSmall, "ml-auto")}>
            <Save size={14} aria-hidden /> Salvar justificativa
          </button>
        )}
      </div>
    </div>
  );
}
