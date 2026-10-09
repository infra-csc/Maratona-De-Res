// Análises → Por colaborador no "Total geral": a análise detalhada (conta da
// nota, penalidades, bônus) é sempre de UM ciclo; aqui fica o resumo de todos
// os ciclos por pessoa (GET /ranking/total) e, para cada pessoa, o histórico
// ciclo a ciclo com atalho para a análise daquele ciclo.
import { useMemo, useState } from "react";
import type { RankingTotalRow } from "@workspace/api-client-react";
import { ArrowRight, UserMinus, Users } from "lucide-react";
import { Chip, SearchField, btnSecondary, btnSmall } from "../results/results-ui";

import { Card, EmptyState, FaixaChip, KpiStrip, StatTile, TH_BTN, TH_CLS } from "./ui";
import { brl, n1, plural } from "./derive";

const BONUS_STATUS: Record<string, string> = {
  projected: "Projetado", approved: "Aprovado", scheduled: "Agendado", paid: "Pago", blocked: "Bloqueado", not_eligible: "Não elegível",
};

type SortKey = "pos" | "name" | "cycles" | "avg" | "events" | "official" | "projected";

export function TotalTeamView({ rows, onPick }: { rows: RankingTotalRow[]; onPick: (id: number) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "pos", dir: 1 });
  const shown = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("pt-BR");
    const list = term ? rows.filter(r => r.employeeName.toLocaleLowerCase("pt-BR").includes(term)) : rows;
    const val = (r: RankingTotalRow): number | string | null => ({
      pos: r.position, name: r.employeeName, cycles: r.cyclesWithScore, avg: r.avgFinalResult, events: r.eventsCount, official: r.bonusOfficial, projected: r.bonusProjected,
    })[sort.key];
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR")) * sort.dir;
    });
  }, [rows, q, sort]);

  if (rows.length === 0) {
    return <EmptyState icon={Users} title="Ninguém com resultado em nenhum ciclo ainda" description="O total aparece quando algum ciclo tiver resultados consolidados." />;
  }
  // Média da equipe com a mesma régua de cada pessoa: ponderada pelos eventos com nota.
  const withScore = rows.filter(r => r.avgFinalResult != null && r.eventsCount > 0);
  const weight = withScore.reduce((s, r) => s + r.eventsCount, 0);
  const avg = weight > 0 ? withScore.reduce((s, r) => s + (r.avgFinalResult ?? 0) * r.eventsCount, 0) / weight : null;
  const official = rows.reduce((s, r) => s + r.bonusOfficial, 0);
  const projected = rows.reduce((s, r) => s + r.bonusProjected, 0);
  const toggle = (key: SortKey) => setSort(p => (p.key === key ? { key, dir: p.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key === "pos" ? 1 : -1 }));
  const th = (label: string, key: SortKey, left = false, title?: string) => (
    <th title={title} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} scope="col" className={`${TH_CLS} ${sort.key === key ? "text-foreground" : "text-muted-foreground"} ${left ? "text-left" : "text-right"}`}>
      <button type="button" onClick={() => toggle(key)} className={`${TH_BTN} ${left ? "" : "flex-row-reverse"}`}>
        {label}<span aria-hidden className="text-[10px] opacity-70">{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-5" data-testid="person-total-team">
      <KpiStrip className="grid-cols-2 md:grid-cols-5">
        <StatTile hero label="Nota média geral" value={n1(avg)} detail="Ponderada pelos eventos com nota" />
        <StatTile label="Colaboradores" value={rows.length} detail="Com resultado em algum ciclo" />
        <StatTile label="Bônus oficial" value={brl(official)} detail="Ciclos fechados" />
        <StatTile label="Bônus projetado" value={brl(projected)} detail="Ciclo aberto: muda até o fechamento" />
        <StatTile className="col-span-2 md:col-span-1" label="Bônus pago" value={brl(rows.reduce((s, r) => s + r.bonusPaid, 0))} detail="Marcado como pago" />
      </KpiStrip>
      <Card title="Todos os colaboradores, todos os ciclos" subtitle="Uma linha por pessoa. A faixa é a do ciclo mais recente dela (não existe faixa do total). Clique no nome para ver o histórico ciclo a ciclo.">
        <SearchField value={q} onChange={setQ} label="Buscar colaborador" placeholder="Buscar pelo nome…" className="w-full sm:w-[280px]" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr>
                {th("Colaborador", "name", true)}
                {th("Ciclos c/ nota", "cycles")}
                {th("Nota média geral", "avg")}
                {th("Eventos c/ nota", "events")}
                {/* Oficial (ciclos fechados) e projetado (ciclo aberto) nunca somados
                    numa coluna só — como em Resultados → Total geral. */}
                {th("Bônus oficial", "official", false, "Ciclos fechados: o bônus que vale")}
                {th("Bônus projetado", "projected", false, "Ciclo aberto: projeção que muda até o fechamento")}
                <th scope="col" className={`${TH_CLS} text-muted-foreground text-right`}>Faixa (último ciclo)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.employeeId} data-testid={`row-person-total-${r.employeeId}`} className="transition-colors duration-150 hover:bg-secondary/40">
                  <td className="py-2.5 px-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <button type="button" onClick={() => onPick(r.employeeId)} className="font-semibold text-left hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {r.employeeName}
                    </button>
                    {!r.employeeActive && <span className="ml-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>desligado</span>}
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{r.cyclesWithScore} de {r.cyclesCount}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums font-bold" style={{ borderBottom: "1px solid var(--border)" }}>{n1(r.avgFinalResult)}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{r.eventsCount}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }} data-testid={`person-total-official-${r.employeeId}`}>{r.bonusOfficial > 0 ? brl(r.bonusOfficial) : "—"}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)", color: r.bonusProjected > 0 ? "var(--status-warn-text)" : undefined }} data-testid={`person-total-projected-${r.employeeId}`}>{r.bonusProjected > 0 ? brl(r.bonusProjected) : "—"}</td>
                  <td className="py-2.5 px-2 text-right" style={{ borderBottom: "1px solid var(--border)" }} title={`Faixa em ${r.latest.cycleName}`}><FaixaChip name={r.latest.platoon} color={r.latest.platoonColor} size="sm" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function TotalPersonView({ row, onOpenCycle, onBack }: {
  row: RankingTotalRow | null;
  onOpenCycle: (cycleId: number, isCurrent: boolean) => void;
  onBack: () => void;
}) {
  if (!row) {
    return <EmptyState icon={UserMinus} title="Sem resultado em nenhum ciclo" description="Este colaborador não tem resultado apurado em nenhum ciclo. Escolha outra pessoa ou volte para a equipe."
      action={<button type="button" onClick={onBack} className={btnSecondary}><Users size={15} aria-hidden /> Ver toda a equipe</button>} />;
  }
  return (
    <div className="space-y-5" data-testid="person-total-detail">
      <KpiStrip className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatTile hero label="Nota média geral" value={n1(row.avgFinalResult)} detail={`Ponderada pelos eventos · ${plural(row.cyclesWithScore, "ciclo com nota", "ciclos com nota")}`} />
        <StatTile label="Eventos com nota" value={row.eventsCount} detail={plural(row.participatedEventsCount, "participado", "participados")} />
        <StatTile label="Ciclos elegíveis" value={`${row.eligibleCycles}/${row.cyclesCount}`} detail="Ao bônus" />
        <StatTile label="Bônus oficial" value={brl(row.bonusOfficial)} detail="Ciclos fechados" />
        <StatTile label="Bônus projetado" value={brl(row.bonusProjected)} detail={row.bonusProjected > 0 ? "Ciclo aberto: muda até o fechamento" : "Nenhum ciclo aberto com bônus"} />
        <StatTile label="Bônus pago" value={brl(row.bonusPaid)} detail="Marcado como pago" />
      </KpiStrip>
      <Card title="Ciclo a ciclo" subtitle="A análise completa (conta da nota, penalidades, eventos e critérios) é de um ciclo: abra o ciclo que quiser.">
        <ul className="divide-y divide-border">
          {row.cycles.map(c => (
            <li key={c.cycleId} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5">
              <div className="min-w-[160px] flex-1">
                <p className="flex flex-wrap items-center gap-2 font-condensed font-black uppercase text-[16px] text-foreground">
                  {c.cycleName}
                  {c.isCurrent && <Chip tone="ok">Atual</Chip>}
                </p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{c.eventsCount} com nota · {plural(c.participatedEventsCount, "participado", "participados")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-condensed text-[24px] font-black leading-none tabular-nums text-foreground">{n1(c.finalResult)}</span>
                <FaixaChip name={c.platoon} color={c.platoonColor} size="sm" />
              </div>
              <div className="text-[13.5px] min-w-[150px] flex flex-wrap items-center gap-1.5">
                {c.eligible ? <><strong>{brl(c.bonusValue)}</strong> <Chip tone={c.official ? "neutral" : "warn"}>{c.official ? "Oficial" : "Projeção"}</Chip>{c.bonusStatus && <span style={{ color: "var(--muted-foreground)" }}> · {BONUS_STATUS[c.bonusStatus] ?? c.bonusStatus}</span>}</>
                  : <span style={{ color: "var(--muted-foreground)" }}>Não elegível</span>}
              </div>
              <button type="button" className={btnSmall} onClick={() => onOpenCycle(c.cycleId, c.isCurrent)} data-testid={`button-open-cycle-${c.cycleId}`}>
                Ver análise do ciclo <ArrowRight size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
