// Panorama (faixa única de indicadores com atalhos de filtro) e o gráfico
// "Atividade por dia" com os destaques do período (maior alta / maior queda).
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, Panel, StatCell } from "./tl-ui";
import { ActivityChart } from "./activity-chart";
import { dayKey, shortDay, signed, type DayGroup, type Direction, type Tally } from "./describe";

export interface Summary extends Tally {
  topUp: { e: ScoreTimelineEntry; d: number } | null;
  topDown: { e: ScoreTimelineEntry; d: number } | null;
}

const n = (v: number) => v.toLocaleString("pt-BR");
/** Frase de apoio do indicador: some no celular (a faixa fica compacta). */
const M = ({ children }: { children: React.ReactNode }) => <span className="hidden sm:inline">{children}</span>;
const cell = "flex flex-col justify-start";

export function Panorama({ stats, dir, faixa, onDir, onFaixa }: {
  stats: Summary; dir: Direction; faixa: boolean; onDir: (d: Direction) => void; onFaixa: (v: boolean) => void;
}) {
  return (
    <section aria-label="Resumo com os filtros" data-testid="timeline-panorama"
      className="rounded-2xl border border-border overflow-hidden grid gap-px bg-border grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
      <StatCell className={cell} label="Mudanças" value={n(stats.changes)} sub={<M>nota, faixa, bônus ou elegibilidade</M>} title="Cada mudança de uma pessoa num acontecimento" />
      <StatCell className={cell} label="Colaboradores" value={n(stats.people)} sub={<M>com alguma mudança</M>} />
      <StatCell className={cell} label="Subiram" value={n(stats.ups)} tone={stats.ups > 0 ? "ok" : "neutral"} sub={<M>nota maior que antes</M>}
        onClick={() => onDir(dir === "alta" ? "todas" : "alta")} pressed={dir === "alta"} action={dir === "alta" ? "Mostrando" : "Ver só estes"} testId="stat-ups" />
      <StatCell className={cell} label="Caíram" value={n(stats.downs)} tone={stats.downs > 0 ? "danger" : "neutral"} sub={<M>nota menor que antes</M>}
        onClick={() => onDir(dir === "queda" ? "todas" : "queda")} pressed={dir === "queda"} action={dir === "queda" ? "Mostrando" : "Ver só estes"} testId="stat-downs" />
      <StatCell className={cell} label="Entraram na nota" value={n(stats.entered)} sub={<M>sem nota antes</M>} title="Sem nota antes e com nota depois (primeiro evento com nota, volta ao ciclo)" />
      <StatCell className={cell} label="Saíram do ciclo" value={n(stats.left)} sub={<M>retirados pelo admin</M>} title="Com nota antes e sem nota depois (tirados do ciclo pelo admin)" />
      <StatCell label="Mudanças de faixa" value={n(stats.faixas)} sub={<M>trocaram de faixa</M>} className={cn(cell, "col-span-2 lg:col-span-1")}
        onClick={() => onFaixa(!faixa)} pressed={faixa} action={faixa ? "Mostrando" : "Ver só estas"} testId="stat-faixas" />
    </section>
  );
}

function Highlight({ kind, top, fallbackName }: { kind: "up" | "down"; top: Summary["topUp"]; fallbackName: string | null }) {
  const up = kind === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0 lg:py-3 lg:first:pt-0">
      <Eyebrow as="p" className="flex items-center gap-1.5"><Icon size={13} aria-hidden className={up ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]"} />{up ? "Maior alta" : "Maior queda"}</Eyebrow>
      {top ? (
        <>
          <p className={cn("mt-1.5 font-condensed text-[28px] font-black leading-none tabular-nums", up ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]")}>{signed(top.d)}</p>
          <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground break-words">{top.e.employeeName ?? fallbackName ?? "Colaborador"}</p>
          <p className="text-[12.5px] tabular-nums text-muted-foreground">em {shortDay(dayKey(top.e.at))}</p>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] text-muted-foreground">{up ? "Nenhuma nota subiu" : "Nenhuma nota caiu"} com estes filtros.</p>
      )}
    </div>
  );
}

export function ActivityPanel({ days, from, to, onPick, stats, filteredName, hint, emptyText }: {
  days: DayGroup[]; from: string; to: string; onPick: (k: string) => void; stats: Summary; filteredName: string | null; hint: string; emptyText: string | null;
}) {
  return (
    <Panel labelledBy="tl-activity-title" title="Atividade por dia" hint={hint} testId="timeline-activity">
      <div className="grid gap-x-6 gap-y-3 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="min-w-0">
          {emptyText ? (
            <p className="py-10 text-center text-[13.5px] text-muted-foreground">{emptyText}</p>
          ) : (
            <ActivityChart days={days} from={from} to={to} onPick={onPick} height={240} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 border-t border-border pt-3 lg:pt-0 lg:border-t-0 lg:border-l lg:pl-5 lg:grid-cols-1 lg:content-start lg:divide-y lg:divide-border">
          <Highlight kind="up" top={stats.topUp} fallbackName={filteredName} />
          <Highlight kind="down" top={stats.topDown} fallbackName={filteredName} />
        </div>
      </div>
    </Panel>
  );
}
