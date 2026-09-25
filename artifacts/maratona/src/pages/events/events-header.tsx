// Cabeçalho da tela: título, ciclo atual, contadores rápidos e botões de ação.
import type { ReactNode } from "react";
import type { Cycle } from "@workspace/api-client-react";
import { CalendarRange } from "lucide-react";
import { CONDENSED, AMBER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { hasPartialPublication, isPubFinal } from "./rules";
import type { EventItem } from "./types";

type EventsHeaderProps = {
  cycle: Cycle | undefined;
  cyclePeriod: string | null;
  /** Todos os eventos do ciclo (sem filtro), base dos contadores. */
  events: EventItem[];
  /** Só admin vê "Unificar Datas". */
  showNormalize: boolean;
  normalizePending: boolean;
  onNormalizePreview: () => void;
  /** Botão/diálogo "Novo Evento" (quando o usuário pode criar). */
  children?: ReactNode;
};

export function EventsHeader({ cycle, cyclePeriod, events: all, showNormalize, normalizePending, onNormalizePreview, children }: EventsHeaderProps) {
  return (
    <div className="px-6 py-4 flex items-center gap-5 shrink-0 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] block" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Gerenciar</span>
        <h1 data-testid="text-page-title" className="font-black uppercase text-2xl tracking-tight leading-none mt-0.5" style={{ fontFamily: CONDENSED }}>Eventos do Ciclo</h1>
      </div>

      {cycle && (
        <div className="shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
          <CalendarRange size={16} className="shrink-0" style={{ color: "var(--accent-text)" }} />
          <span className="flex flex-col leading-tight">
            <span className="font-black uppercase text-xs" style={{ fontFamily: CONDENSED }}>{cycle.name}</span>
            <span className="text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>{cyclePeriod ?? "Período não definido"}</span>
          </span>
        </div>
      )}

      {/* Quick stats */}
      <div className="flex items-stretch shrink-0 pl-5" style={{ borderLeft: "1px solid var(--border)" }}>
        {[
          { val: all.length,                                        label: "Eventos",     color: "var(--foreground)" },
          { val: all.filter(e => e.status === "open").length,      label: "Abertos",     color: "var(--accent)" },
          { val: all.filter(e => hasPartialPublication(e)).length,  label: "Pub. Parcial", color: AMBER_TEXT },
          { val: all.filter(e => isPubFinal(e)).length, label: "Pub. Final",  color: GOOD_TEXT },
        ].map((s, i) => (
          <div key={i} className="px-4 text-center" style={{ borderRight: i < 3 ? "1px solid var(--border)" : "none" }}>
            <span className="block font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: s.color }}>{s.val}</span>
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="ml-auto flex items-center gap-2.5 shrink-0">
        {showNormalize && (
          <button
            onClick={onNormalizePreview}
            title="Mostra a prévia das datas que mudariam antes de aplicar"
            disabled={normalizePending}
            className="h-9 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-colors disabled:opacity-50 hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            {normalizePending ? "..." : "Unificar Datas"}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
