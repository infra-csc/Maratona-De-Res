// Histórico de calibrações de um critério (trilha de auditoria): quem mudou a
// nota, de quanto para quanto e quando. Recolhido por padrão — é registro.
import { ChevronDown, History } from "lucide-react";
import { Chip, Eyebrow } from "../evaluations/ui";
import { fmtCalScore, formatDateTime } from "./helpers";
import type { CalibrationAuditItem } from "./types";

export type CalibrationAuditTrailProps = {
  criterionId: number;
  calAudit: CalibrationAuditItem[] | undefined;
};

function parse(json: string | null | undefined): { score?: number | string | null } | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

export function CalibrationAuditTrail({ criterionId, calAudit }: CalibrationAuditTrailProps) {
  const entries = (calAudit ?? []).filter(a => a.criterionId === criterionId);
  if (!entries.length) return null;
  return (
    <details className="group/hist" data-testid={`cal-history-${criterionId}`}>
      <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none inline-flex items-center gap-2 min-h-9 -ml-1 px-1 rounded-md text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <History size={14} aria-hidden />
        <Eyebrow as="span" className="text-inherit">Histórico de calibração · {entries.length}</Eyebrow>
        <ChevronDown size={14} aria-hidden className="transition-transform duration-200 group-open/hist:rotate-180" />
      </summary>
      <ol className="mt-1.5 ml-[7px] border-l border-border pl-4 space-y-2.5">
        {entries.map(entry => {
          const before = parse(entry.beforeJson);
          const after = parse(entry.afterJson);
          const isRecal = entry.action === "recalibrate_released";
          const scoreText = after?.score != null
            ? (before?.score != null ? `${fmtCalScore(before.score)} → ${fmtCalScore(after.score)}` : `→ ${fmtCalScore(after.score)}`)
            : null;
          return (
            <li key={entry.id} className="relative text-[13px] leading-snug">
              <span aria-hidden className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-border ring-2 ring-card" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Chip tone={isRecal ? "warn" : "neutral"} className="h-5 text-[11px]">{isRecal ? "Recalibrou após publicar" : "Calibrou"}</Chip>
                <span className="font-semibold text-foreground">{entry.userName ?? "—"}</span>
                {scoreText && <span className="font-condensed text-[15px] font-black tabular-nums text-foreground">{scoreText}</span>}
                <span className="text-muted-foreground text-[12.5px] ml-auto">{formatDateTime(new Date(entry.createdAt))}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
