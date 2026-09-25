import type { ReactNode } from "react";
import { CONDENSED, WARNING } from "@/lib/premium-theme";

// Página externa (freelancer, sem conta no sistema): fica fora do AppLayout,
// então não recebe a classe `.dark` do provider. Os tokens vêm do mesmo
// espelho usado pelo app (`darkTokens`/`lightTokens` em premium-theme) e são
// injetados inline no shell — mantém a identidade escura/lima própria desta
// tela sem duplicar valores.

/** Botão pill Sim/Não reutilizado nos três formulários. "Não" usa uma cor de
 * alerta fixa (não faz parte do tema) porque sinaliza uma penalidade real. */
export function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2 shrink-0">
      <button
        type="button"
        onClick={() => onChange(true)}
        className="px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
        style={{
          fontFamily: CONDENSED,
          backgroundColor: value === true ? "var(--primary)" : "transparent",
          color: value === true ? "var(--primary-foreground)" : "var(--muted-foreground)",
          border: value === true ? "1px solid var(--primary)" : "1px solid var(--border)",
        }}
      >
        Sim
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className="px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
        style={{
          fontFamily: CONDENSED,
          backgroundColor: value === false ? WARNING : "transparent",
          color: value === false ? "var(--destructive-foreground)" : "var(--muted-foreground)",
          border: value === false ? `1px solid ${WARNING}` : "1px solid var(--border)",
        }}
      >
        Não
      </button>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl transition-colors duration-300 ${className}`}
      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
    >
      {children}
    </div>
  );
}
