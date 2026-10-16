// Panorama do ciclo: quantos lançamentos, quanto desconta, quanto soma e
// quem a nota mais sente. Penalidades/Méritos são atalhos de filtro;
// "Colaboradores" abre a visão por pessoa.
import type { Absence } from "@workspace/api-client-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { StatCell, surfaceCls } from "./absences-ui";
import { totalPoints } from "./helpers";
import type { PersonImpact } from "./people";
import type { FilterKind, ListView } from "./types";

export function AbsencesPanel({ rows, people, cycleLabel, kind, onKind, view, onView }: {
  rows: Absence[];
  people: PersonImpact[];
  cycleLabel: string | null;
  kind: FilterKind;
  onKind: (k: FilterKind) => void;
  view: ListView;
  onView: (v: ListView) => void;
}) {
  const pen = rows.filter(a => a.kind !== "merit");
  const mer = rows.filter(a => a.kind === "merit");
  const penPts = pen.reduce((s, a) => s + totalPoints(a), 0);
  const merPts = mer.reduce((s, a) => s + totalPoints(a), 0);
  const penPeople = new Set(pen.map(a => a.employeeId)).size;
  const merPeople = new Set(mer.map(a => a.employeeId)).size;
  const top = people.find(p => p.effect != null && p.effect > 0);

  return (
    <section aria-label="Panorama do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border [&>*]:flex [&>*]:flex-col [&>*]:justify-start")}>
      <StatCell
        testId="stat-absences-total"
        label="Lançamentos"
        value={rows.length}
        sub={cycleLabel ? <span className="line-clamp-2">{cycleLabel}</span> : undefined}
      />
      <StatCell
        testId="stat-absences-penalty"
        label="Penalidades"
        tone={penPts > 0 ? "danger" : "neutral"}
        value={penPts > 0 ? `−${penPts.toLocaleString("pt-BR")}` : "0"}
        unit="pts"
        sub={pen.length > 0 ? `${plural(pen.length, "lançamento")} · ${plural(penPeople, "pessoa")}` : "Nenhum desconto lançado."}
        onClick={pen.length > 0 || kind === "penalty" ? () => onKind(kind === "penalty" ? "all" : "penalty") : undefined}
        pressed={kind === "penalty"}
        action={kind === "penalty" ? "Ver todos" : "Só penalidades"}
      />
      <StatCell
        testId="stat-absences-merit"
        label="Méritos"
        tone={merPts > 0 ? "ok" : "neutral"}
        value={merPts > 0 ? `+${merPts.toLocaleString("pt-BR")}` : "0"}
        unit="pts"
        sub={mer.length > 0 ? `${plural(mer.length, "lançamento")} · ${plural(merPeople, "pessoa")}` : "Nenhum mérito lançado."}
        onClick={mer.length > 0 || kind === "merit" ? () => onKind(kind === "merit" ? "all" : "merit") : undefined}
        pressed={kind === "merit"}
        action={kind === "merit" ? "Ver todos" : "Só méritos"}
      />
      <StatCell
        testId="stat-absences-people"
        label="Colaboradores"
        value={people.length}
        sub={top
          ? <>Maior desconto: <span className="font-semibold text-foreground">{top.name}</span>, −{fmtNum(top.effect ?? 0, 1)} na nota</>
          : people.length > 0 ? "Nenhum desconto líquido na nota." : "Ninguém com lançamento no ciclo."}
        onClick={people.length > 0 ? () => onView(view === "people" ? "entries" : "people") : undefined}
        pressed={view === "people"}
        action={view === "people" ? "Ver lançamentos" : "Ver por pessoa"}
      />
    </section>
  );
}
