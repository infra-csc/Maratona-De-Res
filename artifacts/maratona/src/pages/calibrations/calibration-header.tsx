// Cabeçalho fixo da página: título, seletor de eventos e badges de publicação/pendências.
import { SlidersHorizontal } from "lucide-react";
import { CONDENSED, AMBER_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import { EventPicker, type EventPickerProps } from "./event-picker";

export type CalibrationHeaderProps = {
  pickerProps: EventPickerProps;
  showPubBadge: boolean;
  alreadyReleased: boolean;
  allCriteriaFinalPublished: boolean;
  partialPublishedAtDate: Date | null;
  feedbackReleasedAtDate: Date | null;
  pendingCount: number;
};

export function CalibrationHeader({
  pickerProps,
  showPubBadge,
  alreadyReleased,
  allCriteriaFinalPublished,
  partialPublishedAtDate,
  feedbackReleasedAtDate,
  pendingCount,
}: CalibrationHeaderProps) {
  return (
      <div className="sticky top-0 z-30 px-3 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ border: "2px solid var(--accent)" }} />
        {/* Único h1 da tela; no celular fica só para leitor de tela (falta espaço). */}
        <h1 className="font-black uppercase text-[13px] tracking-tight shrink-0 sr-only sm:not-sr-only sm:inline" style={{ fontFamily: CONDENSED }}>Calibrações</h1>

        {/* Event picker inline */}
        <EventPicker {...pickerProps} />

        {/* Publication status badge */}
        {showPubBadge && (
          <span className="shrink-0 px-2.5 py-1 rounded-full font-bold text-[11px] uppercase hidden sm:inline"
            style={{
              backgroundColor: (alreadyReleased || allCriteriaFinalPublished) ? "var(--primary)" : partialPublishedAtDate ? "rgba(232,162,61,0.14)" : "var(--secondary)",
              color: (alreadyReleased || allCriteriaFinalPublished) ? "var(--primary-foreground)" : partialPublishedAtDate ? AMBER_TEXT : "var(--muted-foreground)",
            }}
            title={(alreadyReleased || allCriteriaFinalPublished) ? `Final liberado em ${feedbackReleasedAtDate ? formatDateTime(feedbackReleasedAtDate) : ""}` : partialPublishedAtDate ? `Parcial publicado em ${formatDateTime(partialPublishedAtDate)}` : "Notas não publicadas"}
          >
            {(alreadyReleased || allCriteriaFinalPublished) ? "Final" : partialPublishedAtDate ? "Parcial" : "Não pub."}
          </span>
        )}

        {/* Pending calibrations badge */}
        {pendingCount > 0 && (
          <span
            title={`${pendingCount} critério(s) sem calibração`}
            className="shrink-0 font-black text-[11px] uppercase px-2.5 py-1 rounded-full flex items-center gap-1"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <SlidersHorizontal size={11} /> {pendingCount}
          </span>
        )}
      </div>
  );
}
