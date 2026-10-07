// Textos do critério no ciclo com avaliação POR ÁREA (Atribuição e Tabela):
// qualquer avaliador da área responde; designação antiga é só informação.
import { UserCheck } from "lucide-react";
import type { CritRow } from "./types";

/** Quem responde / quem respondeu o critério no modo por área. */
export function AreaModeResponder({ c }: { c: CritRow }) {
  if (c.state === "done") {
    return c.formSubmitterName ? (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--foreground)" }}>
        <UserCheck size={11} aria-hidden /> Respondido por {c.formSubmitterName} <span style={{ color: "var(--muted-foreground)" }}>(área)</span>
      </span>
    ) : (
      <span className="text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>Respondido pela área</span>
    );
  }
  return (
    <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }} data-testid={`area-mode-any-${c.criterionId}`}>
      Qualquer avaliador da área responde
    </span>
  );
}

/** Designação feita antes (fluxo antigo): fica à vista, mas não vale no ciclo por área. */
export function AreaModeOldDesignation({ c }: { c: CritRow }) {
  if (c.assignedToId == null || !c.assignedToName) return null;
  return (
    <span
      className="block text-[11px] mt-0.5"
      style={{ color: "var(--muted-foreground)" }}
      data-testid={`area-mode-old-designation-${c.criterionId}`}
      title="Designação feita antes. No ciclo por área ela não restringe quem responde: qualquer avaliador da área pode responder."
    >
      Designação antiga: {c.assignedToName} — no ciclo por área não vale
    </span>
  );
}
