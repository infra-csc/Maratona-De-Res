import type { QuarterlyResult } from "@workspace/api-client-react";
import { cn, faixaEdge, fmtNum, plural } from "@/lib/utils";
import { fmtBRLShort } from "./helpers";
import { FaixaBadge } from "./badges";
import { Eyebrow, surfaceCls } from "./results-ui";

export type PlatoonGroup = {
  platoon: string;
  color: string | null;
  minScore: number | null;
  maxScore: number | null;
  count: number;
  avgScore: number;
  totalBonus: number;
};

export function buildPlatoonGroups(rows: QuarterlyResult[]): PlatoonGroup[] {
  const grouped = new Map<string, { items: QuarterlyResult[]; color: string | null; min: number | null; max: number | null }>();
  for (const r of rows) {
    const key = r.platoon ?? "Sem faixa";
    if (!grouped.has(key)) {
      grouped.set(key, { items: [], color: r.platoonColor ?? null, min: r.platoonMinScore ?? null, max: r.platoonMaxScore ?? null });
    }
    grouped.get(key)!.items.push(r);
  }
  return [...grouped.entries()]
    .map(([platoon, { items, color, min, max }]) => ({
      platoon,
      color,
      minScore: min,
      maxScore: max,
      count: items.length,
      avgScore: items.reduce((s, r) => s + r.finalResult, 0) / items.length,
      totalBonus: items.reduce((s, r) => s + (r.bonusValue ?? 0), 0),
    }))
    .sort((a, b) => (b.minScore ?? -1) - (a.minScore ?? -1));
}

/**
 * Distribuição por faixa: uma linha por faixa (da mais alta para a mais baixa)
 * com a barra de pessoas, a média e o bônus somado. A média define a faixa.
 */
export function PlatoonDistributionPanel({ rows, cycleClosed = false }: { rows: QuarterlyResult[]; /** Ciclo fechado: bônus OFICIAL; aberto, PROJETADO. */ cycleClosed?: boolean }) {
  const bonusHead = cycleClosed ? "Bônus oficial" : "Bônus projetado";
  const groups = buildPlatoonGroups(rows);
  if (groups.length === 0) return null;
  const max = Math.max(...groups.map(g => g.count));
  const cols = "grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(150px,1.1fr)_minmax(0,2fr)_64px_72px_120px]";

  return (
    <section aria-labelledby="faixas-title" className={cn(surfaceCls, "overflow-hidden")} data-testid="platoon-distribution">
      <div className="px-4 lg:px-5 pt-3.5 pb-2 flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow as="h2" id="faixas-title">Distribuição por faixa</Eyebrow>
        <span className="text-[12.5px] text-muted-foreground">{plural(rows.length, "colaborador", "colaboradores")} · a média define a faixa</span>
      </div>
      <div role="table" aria-labelledby="faixas-title">
        <div role="row" className={cn("hidden lg:grid items-center gap-4 px-4 lg:px-5 py-2 border-y border-border bg-secondary/60 font-condensed text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground", cols)}>
          <span role="columnheader">Faixa</span>
          <span role="columnheader">Pessoas</span>
          <span role="columnheader" className="text-right">Qtd.</span>
          <span role="columnheader" className="text-right">Média</span>
          <span role="columnheader" className="text-right" data-testid="platoon-bonus-head"
            title={cycleClosed ? "Soma do bônus oficial, apurado no fechamento do ciclo" : "Soma do bônus projetado: o ciclo está aberto e o valor muda até o fechamento"}>{bonusHead}</span>
        </div>
        {groups.map(g => (
          <div role="row" key={g.platoon} className={cn("grid items-center gap-x-4 gap-y-2 px-4 lg:px-5 py-3 border-t border-border first:border-t-0 lg:first:border-t-0", cols)}>
            <span role="cell" className="min-w-0"><FaixaBadge name={g.platoon} minScore={g.minScore} maxScore={g.maxScore} color={g.color} /></span>
            <span role="cell" className="col-span-2 lg:col-span-1 row-start-2 lg:row-start-auto flex items-center gap-2.5 min-w-0">
              <span className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden" aria-hidden>
                <span className="block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${Math.max(4, (g.count / max) * 100)}%`, backgroundColor: g.color ?? "var(--muted-foreground)", ...faixaEdge(g.color) }} />
              </span>
              <span className="lg:hidden text-[12.5px] text-muted-foreground whitespace-nowrap">média {fmtNum(g.avgScore, 1)} · {fmtBRLShort(g.totalBonus)}</span>
            </span>
            <span role="cell" className="text-right font-condensed text-[20px] font-black tabular-nums leading-none">
              {g.count}<span className="lg:hidden font-body text-[12px] font-normal text-muted-foreground"> {g.count === 1 ? "pessoa" : "pessoas"}</span>
            </span>
            <span role="cell" className="hidden lg:block text-right font-condensed text-[17px] font-bold tabular-nums">{fmtNum(g.avgScore, 1)}</span>
            <span role="cell" className={cn("hidden lg:block text-right font-condensed text-[17px] font-bold tabular-nums whitespace-nowrap", g.totalBonus <= 0 && "text-muted-foreground")}>{fmtBRLShort(g.totalBonus)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
