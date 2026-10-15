// A lista do ciclo: TABELA nas telas largas e CARTÕES no celular/tablet
// (renderiza um dos dois). Também a visão "Por pessoa": o saldo de cada
// colaborador e quanto ele mexe na nota.
import { ChevronRight, SearchX } from "lucide-react";
import { cn, fmtNum, fmtScore, plural } from "@/lib/utils";
import { useWideScreen } from "../events/use-wide-screen";
import { Avatar, EmptyBlock, FOCUS_RING, SignedNumber, btnSecondary, surfaceCls } from "./absences-ui";
import { AbsenceCard, AbsenceRow, type AbsenceRowProps } from "./absence-row";
import { fmtNet } from "./helpers";
import type { PersonImpact } from "./people";

const th = "font-condensed h-11 px-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-card border-b border-border md:sticky md:top-16 z-10";

export function NoResults({ onClear }: { onClear: () => void }) {
  return (
    <div className={surfaceCls}>
      <EmptyBlock icon={SearchX} title="Nenhum lançamento encontrado" testId="absences-empty"
        action={<button type="button" onClick={onClear} className={btnSecondary}>Limpar filtros</button>}>
        Nada com essa busca ou esses filtros. Tente outro termo, outro evento ou um período maior.
      </EmptyBlock>
    </div>
  );
}

export function AbsencesList({ rows, canEdit }: { rows: AbsenceRowProps[]; canEdit: boolean }) {
  const wide = useWideScreen();
  if (!wide) {
    return (
      <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]" data-testid="absences-cards">
        {rows.map(p => <AbsenceCard key={p.a.id} {...p} />)}
      </ul>
    );
  }
  return (
    <div className={cn(surfaceCls, "overflow-clip")}>
      <table className="w-full border-collapse text-[14px]" aria-label="Lançamentos do ciclo">
        <thead>
          <tr>
            <th className={cn(th, "pl-5 w-[20%] min-w-[200px] rounded-tl-2xl")}>Colaborador</th>
            <th className={cn(th, "w-[19%]")}>Lançamento</th>
            <th className={cn(th, "w-[110px]")}>Data</th>
            <th className={cn(th, "w-[96px] text-right")}>Pontos</th>
            <th className={cn(th, "w-[116px] text-right")} title="Pontos ÷ eventos com nota do colaborador no ciclo">Efeito na nota</th>
            <th className={cn(th, !canEdit && "rounded-tr-2xl")}>Observação</th>
            {canEdit && <th className={cn(th, "pr-4 w-[104px] rounded-tr-2xl")}><span className="sr-only">Ações</span></th>}
          </tr>
        </thead>
        <tbody>{rows.map(p => <AbsenceRow key={p.a.id} {...p} />)}</tbody>
      </table>
    </div>
  );
}

/** Saldo de uma pessoa: "−6,3" (desconto) ou "+3,1" (soma), com a conta embaixo. */
function NetEffect({ p, align = "right" }: { p: PersonImpact; align?: "right" | "left" }) {
  const kind = p.net > 0 ? "penalty" : "merit";
  return (
    <span className={cn("block", align === "right" && "text-right")}>
      {p.effect == null
        ? <span className="text-[13px] text-muted-foreground">sem eventos</span>
        : p.net === 0
          ? <SignedNumber kind="none" className="text-[20px]">0,0</SignedNumber>
          : <SignedNumber kind={kind} className="text-[20px]">{p.net > 0 ? "−" : "+"}{fmtNum(Math.abs(p.effect), 1)}</SignedNumber>}
      <span className="block mt-1 text-[12px] text-muted-foreground tabular-nums">
        {fmtNet(p.net)} pts{p.events ? ` ÷ ${plural(p.events, "evento", "eventos")}` : ""}
      </span>
    </span>
  );
}

function Counts({ p }: { p: PersonImpact }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] tabular-nums">
      {p.penaltyCount > 0 && <span className="text-[var(--status-danger-text)] font-semibold">−{p.penaltyPoints.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">em {plural(p.penaltyCount, "penalidade", "penalidades")}</span></span>}
      {p.meritCount > 0 && <span className="text-[var(--status-ok-text)] font-semibold">+{p.meritPoints.toLocaleString("pt-BR")} <span className="font-normal text-muted-foreground">em {plural(p.meritCount, "mérito", "méritos")}</span></span>}
    </span>
  );
}

export function PeopleList({ people, onPick }: { people: PersonImpact[]; onPick: (id: number) => void }) {
  const wide = useWideScreen();
  if (!wide) {
    return (
      <ul className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]" data-testid="absences-people">
        {people.map(p => (
          <li key={p.employeeId}>
            <button type="button" onClick={() => onPick(p.employeeId)} data-testid={`person-${p.employeeId}`}
              className={cn(surfaceCls, "w-full p-4 text-left flex items-start gap-3 transition-colors duration-150 hover:bg-secondary/40", FOCUS_RING)}>
              <Avatar name={p.name} className="w-9 h-9 text-[13px]" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground leading-tight truncate">{p.name}</span>
                <span className="block mt-1"><Counts p={p} /></span>
                {p.score && <span className="block mt-1 text-[12.5px] text-muted-foreground tabular-nums">Nota hoje {fmtScore(p.score.finalResult)}{p.score.grossAverage != null ? ` · média sem lançamentos ${fmtScore(p.score.grossAverage)}` : ""}</span>}
              </span>
              <NetEffect p={p} />
            </button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className={cn(surfaceCls, "overflow-clip")}>
      <table className="w-full border-collapse text-[14px]" aria-label="Efeito por colaborador" data-testid="absences-people">
        <thead>
          <tr>
            <th className={cn(th, "pl-5 w-[30%] rounded-tl-2xl")}>Colaborador</th>
            <th className={th}>Lançamentos</th>
            <th className={cn(th, "w-[150px] text-right")} title="Saldo de pontos ÷ eventos com nota no ciclo">Efeito na nota</th>
            <th className={cn(th, "w-[220px] text-right")}>Nota do ciclo</th>
            <th className={cn(th, "pr-4 w-12 rounded-tr-2xl")}><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {people.map(p => (
            <tr key={p.employeeId} data-testid={`person-${p.employeeId}`} className="group border-t border-border transition-colors duration-150 hover:bg-secondary/40 cursor-pointer" onClick={() => onPick(p.employeeId)}>
              <td className="pl-5 pr-3 py-3.5">
                <span className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.name} className="w-9 h-9 text-[13px]" />
                  <span className="min-w-0 font-semibold text-foreground truncate">{p.name}</span>
                </span>
              </td>
              <td className="px-3 py-3.5"><Counts p={p} /></td>
              <td className="px-3 py-3.5"><NetEffect p={p} /></td>
              <td className="px-3 py-3.5 text-right tabular-nums">
                {p.score ? (
                  <>
                    <span className="font-condensed text-[20px] font-black leading-none text-foreground">{fmtScore(p.score.finalResult)}</span>
                    {p.score.grossAverage != null && <span className="block mt-1 text-[12px] text-muted-foreground">sem lançamentos: {fmtScore(p.score.grossAverage)}</span>}
                  </>
                ) : <span className="text-[13px] text-muted-foreground">sem nota ainda</span>}
              </td>
              <td className="pr-4 py-3.5 text-right">
                <button type="button" onClick={e => { e.stopPropagation(); onPick(p.employeeId); }} aria-label={`Ver os lançamentos de ${p.name}`}
                  className={cn("w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground group-hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
                  <ChevronRight size={16} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
