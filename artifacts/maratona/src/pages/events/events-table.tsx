// Tabela de eventos (cabeçalho ordenável + linhas) e a legenda/contagem abaixo dela.
import type { User } from "@workspace/api-client-react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { PremiumCard, CONDENSED, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { cn } from "@/lib/utils";
import { EventRow, type EventRowActions } from "./event-row";
import { nextColSort, isColActive, isColAsc } from "./url-filters";
import type { EventItem } from "./types";

const GRID_COLS = "1fr 90px 56px 130px 130px 110px 80px 120px 72px";

const COLUMNS = ["name", "date", "participants", "evaluated", "calibr", "matrix", "score"] as const;
const COLUMN_LABELS: Record<(typeof COLUMNS)[number], string> = {
  name: "Evento", date: "Data", participants: "Part.",
  evaluated: "Avaliações", calibr: "Calibrações", matrix: "Matriz", score: "Nota",
};

type EventsTableProps = EventRowActions & {
  events: EventItem[];
  user: User | null;
  sortBy: string;
  setSortBy: (v: string) => void;
};

export function EventsTable({ events, user, sortBy, setSortBy, ...actions }: EventsTableProps) {
  return (
    <PremiumCard className="overflow-hidden">
      {/* Table header */}
      <div
        className="grid sticky top-0 z-10"
        style={{ gridTemplateColumns: GRID_COLS, backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}
      >
        {COLUMNS.map((col) => {
          const label = COLUMN_LABELS[col];
          if (col === "matrix") {
            return (
              <div key={col} role="columnheader" className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                {label}
              </div>
            );
          }
          const active = isColActive(sortBy, col);
          const asc = isColAsc(sortBy, col);
          return (
            <div
              key={col}
              role="columnheader"
              aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
              className={cn("flex items-center", col === "name" && "pl-0.5")}
            >
              <button
                type="button"
                onClick={() => setSortBy(nextColSort(sortBy, col))}
                aria-label={`Ordenar por ${label}${active ? (asc ? " (crescente)" : " (decrescente)") : ""}`}
                className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider select-none flex items-center gap-1 transition-colors group bg-transparent rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                style={{ fontFamily: CONDENSED, color: active ? "var(--accent-text)" : "var(--muted-foreground)", outlineColor: "var(--ring)" }}
              >
                {label}
                <span aria-hidden="true" className={cn("inline-flex flex-col leading-none transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-40")}>
                  <ChevronUp size={8} style={{ opacity: active && !asc ? 0.35 : 1 }} />
                  <ChevronDown size={8} style={{ marginTop: -2, opacity: active && asc ? 0.35 : 1 }} />
                </span>
              </button>
            </div>
          );
        })}
        <div role="columnheader" className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Status</div>
        <div role="columnheader" className="px-3 py-2.5"><span className="sr-only">Ações</span></div>
      </div>

      {/* Rows */}
      {events.map((ev) => (
        <EventRow key={ev.id} ev={ev} user={user} gridCols={GRID_COLS} {...actions} />
      ))}
    </PremiumCard>
  );
}

const LEGEND = [
  { color: GOOD_TEXT, label: "Pub. Final" },
  { color: "var(--accent-text)", label: "Avaliado" },
  { color: AMBER_TEXT, label: "Em andamento" },
  { color: "var(--border)", label: "Aguardando" },
  { color: DANGER_TEXT, label: "Aguardando RH" },
];

/** Legenda das cores da barra lateral + "N de M eventos". */
export function EventsLegend({ shown, total }: { shown: number; total: number }) {
  return (
    <div className="flex items-center gap-5 mt-4 px-1 flex-wrap">
      {LEGEND.map(l => (
        <div key={l.label} className="flex items-center gap-1.5">
          <div className="w-[3px] h-3 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{l.label}</span>
        </div>
      ))}
      <span className="ml-auto text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {shown === total
          ? `${total} eventos no ciclo`
          : `${shown} de ${total} eventos`}
      </span>
    </div>
  );
}
