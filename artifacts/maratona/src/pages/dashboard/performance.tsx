// Desempenho do ciclo: Top colaboradores e distribuição por faixa.
import type { PlatoonDistribution, PlatoonRule, QuarterlyResult } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Medal, Shapes } from "lucide-react";
import { cn, faixaEdge, fmtNum, plural } from "@/lib/utils";
import { Bone, FooterLink, InlineError, InlineState, Panel, RowArrow, rowLinkCls } from "./dashboard-ui";

const TOP_N = 5;

/** Nome da faixa sem o prefixo antigo ("Pelotão Quênia" → "Quênia"). */
export function faixaLabel(name: string | null | undefined) {
  if (!name) return "Sem faixa";
  return name === "Sem Faixa" ? "Sem faixa" : name.replace(/^Pelot[aã]o\s*/i, "");
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="px-4 lg:px-5 pb-5 space-y-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-3"><Bone className="h-6 w-7" /><Bone className="h-4 flex-1" /><Bone className="h-6 w-12" /></div>)}
    </div>
  );
}

export function TopPanel({ rows, loading, error, onRetry, isAll, withCycle }: {
  rows: QuarterlyResult[] | undefined; loading: boolean; error: boolean; onRetry: () => void; isAll: boolean; withCycle: (href: string) => string;
}) {
  const top = (rows ?? []).slice(0, TOP_N);
  return (
    <Panel
      labelId="dash-top-title"
      testId="dashboard-top"
      icon={Medal}
      title="Top colaboradores"
      sub={isAll ? "Média final de cada um nos ciclos, ponderada pelos eventos com nota." : "Maiores notas finais do ciclo, no mesmo recorte do ranking."}
      footer={<FooterLink href={withCycle("/results")}>Ranking completo</FooterLink>}
    >
      {loading ? <ListSkeleton /> : error && !rows ? (
        <InlineError what="o Top" onRetry={onRetry} testId="dashboard-top-error" />
      ) : top.length === 0 ? (
        <InlineState icon={Medal} title="Nenhum resultado consolidado." />
      ) : (
        <ol className="border-t border-border divide-y divide-border">
          {top.map((emp, i) => (
            <li key={emp.employeeId}>
              <Link href={withCycle(`/analytics/colaborador?colaborador=${emp.employeeId}`)} className={rowLinkCls} data-testid={`dashboard-top-${emp.employeeId}`}>
                <span className={cn("w-7 shrink-0 font-condensed text-[18px] font-black tabular-nums leading-none", i === 0 ? "text-foreground" : "text-muted-foreground")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-foreground truncate" title={emp.employeeName}>{emp.employeeName}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground min-w-0">
                    {emp.platoon && <span aria-hidden className="w-2 h-2 rounded-[2px] shrink-0" style={{ backgroundColor: emp.platoonColor ?? "var(--border)", ...faixaEdge(emp.platoonColor) }} />}
                    <span className="truncate">{[emp.platoon ? faixaLabel(emp.platoon) : null, plural(emp.eventsCount ?? 0, "evento")].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
                <span className="font-condensed text-[22px] font-black tabular-nums leading-none text-foreground">{fmtNum(emp.finalResult, 1)}</span>
                <RowArrow />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function FaixasPanel({ data, rules, loading, error, onRetry, isAll, withCycle }: {
  data: PlatoonDistribution[] | undefined; rules: PlatoonRule[] | undefined; loading: boolean; error: boolean; onRetry: () => void;
  isAll: boolean; withCycle: (href: string) => string;
}) {
  // Melhor faixa primeiro (pela nota mínima da regra); "Sem faixa" no fim.
  const minOf = new Map((rules ?? []).map(r => [r.name, r.minScore]));
  const groups = [...(data ?? [])].sort((a, b) => (minOf.get(b.platoonName) ?? -1) - (minOf.get(a.platoonName) ?? -1));
  const total = groups.reduce((s, g) => s + g.count, 0);
  return (
    <Panel
      labelId="dash-faixas-title"
      testId="dashboard-faixas"
      icon={Shapes}
      title="Distribuição por faixa"
      sub={isAll ? "Resultados de todos os ciclos (cada pessoa conta uma vez por ciclo)." : "Quem tem resultado apurado no ciclo, por faixa de bônus."}
      footer={<FooterLink href={withCycle("/results")}>Faixas e bônus</FooterLink>}
    >
      {loading ? <ListSkeleton rows={3} /> : error && !data ? (
        <InlineError what="as faixas" onRetry={onRetry} testId="dashboard-faixas-error" />
      ) : groups.length === 0 ? (
        <InlineState icon={Shapes} title="Nenhum resultado apurado ainda." />
      ) : (
        <div className="px-4 lg:px-5 pb-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-condensed text-[30px] font-black leading-none tabular-nums text-foreground">{total}</span>
            <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{total === 1 ? "pessoa" : "pessoas"}</span>
          </div>
          <span role="img" aria-label={groups.map(g => `${faixaLabel(g.platoonName)}: ${plural(g.count, "pessoa", "pessoas")}`).join("; ")}
            className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
            {groups.map(g => (
              <span key={g.platoonName} className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${g.percentage}%`, backgroundColor: g.color, ...faixaEdge(g.color) }} />
            ))}
          </span>
          <ul className="mt-4 space-y-1">
            {groups.map(g => (
              <li key={g.platoonName} className="flex items-center gap-2.5 min-h-8 text-[14px]">
                <span aria-hidden className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: g.color, ...faixaEdge(g.color) }} />
                <span className="flex-1 min-w-0 font-semibold text-foreground truncate">{faixaLabel(g.platoonName)}</span>
                <span className="tabular-nums font-semibold text-foreground">{g.count}</span>
                <span className="w-11 text-right tabular-nums text-[13px] text-muted-foreground">{fmtNum(g.percentage, 0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
