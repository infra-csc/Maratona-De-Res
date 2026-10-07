// Análises → Por colaborador no "Total geral": a análise detalhada (conta da
// nota, penalidades, bônus) é sempre de UM ciclo; aqui fica o resumo de todos
// os ciclos por pessoa (GET /ranking/total) e, para cada pessoa, o histórico
// ciclo a ciclo com atalho para a análise daquele ciclo.
import { useMemo, useState } from "react";
import type { RankingTotalRow } from "@workspace/api-client-react";
import { ArrowRight, Search, UserMinus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, StatTile } from "@/components/shared";
import { CONDENSED } from "@/lib/premium-theme";
import { Card, FaixaChip } from "./ui";
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
    <th title={title} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`py-2 px-2 text-[11px] font-bold uppercase ${left ? "text-left" : "text-right"}`}
      style={{ fontFamily: CONDENSED, color: sort.key === key ? "var(--foreground)" : "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
      <button type="button" onClick={() => toggle(key)} className="uppercase font-bold rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {label} <span aria-hidden>{sort.key === key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );

  return (
    <div className="space-y-5" data-testid="person-total-team">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile hero label="Média final" value={n1(avg)} detail="Ponderada pelos eventos com nota" />
        <StatTile label="Pessoas" value={rows.length} detail="Com resultado em algum ciclo" />
        <StatTile label="Bônus oficial" value={brl(official)} detail="Ciclos fechados" />
        <StatTile label="Bônus projetado" value={brl(projected)} detail="Ciclo aberto: muda até o fechamento" />
        <StatTile className="col-span-2 md:col-span-1" label="Bônus pago" value={brl(rows.reduce((s, r) => s + r.bonusPaid, 0))} detail="Marcado como pago" />
      </div>
      <Card title="Todos os colaboradores, todos os ciclos" subtitle="Uma linha por pessoa. A faixa é a do ciclo mais recente dela (não existe faixa do total). Clique no nome para ver o histórico ciclo a ciclo.">
        <div className="relative w-full sm:w-[280px]">
          <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <Input aria-label="Buscar colaborador" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pelo nome…" className="h-9 pl-8" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr>
                {th("Colaborador", "name", true)}
                {th("Ciclos c/ nota", "cycles")}
                {th("Média final", "avg")}
                {th("Eventos c/ nota", "events")}
                {/* Oficial (ciclos fechados) e projetado (ciclo aberto) nunca somados
                    numa coluna só — como em Resultados → Total geral. */}
                {th("Bônus oficial", "official", false, "Ciclos fechados: o bônus que vale")}
                {th("Bônus projetado", "projected", false, "Ciclo aberto: projeção que muda até o fechamento")}
                <th className="py-2 px-2 text-[11px] font-bold uppercase text-right" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>Faixa (último ciclo)</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.employeeId} data-testid={`row-person-total-${r.employeeId}`}>
                  <td className="py-2 px-2" style={{ borderBottom: "1px solid var(--border)" }}>
                    <button type="button" onClick={() => onPick(r.employeeId)} className="font-semibold text-left hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {r.employeeName}
                    </button>
                    {!r.employeeActive && <span className="ml-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>desligado</span>}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{r.cyclesWithScore} de {r.cyclesCount}</td>
                  <td className="py-2 px-2 text-right tabular-nums font-bold" style={{ borderBottom: "1px solid var(--border)" }}>{n1(r.avgFinalResult)}</td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{r.eventsCount}</td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }} data-testid={`person-total-official-${r.employeeId}`}>{r.bonusOfficial > 0 ? brl(r.bonusOfficial) : "—"}</td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)", color: r.bonusProjected > 0 ? "var(--status-warn-text)" : undefined }} data-testid={`person-total-projected-${r.employeeId}`}>{r.bonusProjected > 0 ? brl(r.bonusProjected) : "—"}</td>
                  <td className="py-2 px-2 text-right" style={{ borderBottom: "1px solid var(--border)" }} title={`Faixa em ${r.latest.cycleName}`}><FaixaChip name={r.latest.platoon} color={r.latest.platoonColor} size="sm" /></td>
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
      action={<Button variant="outline" onClick={onBack}><Users size={15} className="mr-1.5" aria-hidden /> Ver toda a equipe</Button>} />;
  }
  return (
    <div className="space-y-5" data-testid="person-total-detail">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatTile hero label="Média final" value={n1(row.avgFinalResult)} detail={`Ponderada pelos eventos · ${plural(row.cyclesWithScore, "ciclo com nota", "ciclos com nota")}`} />
        <StatTile label="Eventos com nota" value={row.eventsCount} detail={plural(row.participatedEventsCount, "participado", "participados")} />
        <StatTile label="Ciclos elegíveis" value={`${row.eligibleCycles}/${row.cyclesCount}`} detail="Ao bônus" />
        <StatTile label="Bônus oficial" value={brl(row.bonusOfficial)} detail="Ciclos fechados" />
        <StatTile label="Bônus projetado" value={brl(row.bonusProjected)} detail={row.bonusProjected > 0 ? "Ciclo aberto: muda até o fechamento" : "Nenhum ciclo aberto com bônus"} />
        <StatTile label="Bônus pago" value={brl(row.bonusPaid)} detail="Marcado como pago" />
      </div>
      <Card title="Ciclo a ciclo" subtitle="A análise completa (conta da nota, penalidades, eventos e critérios) é de um ciclo: abra o ciclo que quiser.">
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {row.cycles.map(c => (
            <li key={c.cycleId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3" style={{ borderColor: "var(--border)" }}>
              <div className="min-w-[160px] flex-1">
                <p className="font-black uppercase text-[14px]" style={{ fontFamily: CONDENSED }}>
                  {c.cycleName}
                  {c.isCurrent && <span className="ml-2 align-middle text-[11px] font-bold uppercase rounded-full px-1.5 py-px" style={{ backgroundColor: "var(--status-ok-bg)", color: "var(--status-ok-text)" }}>Atual</span>}
                </p>
                <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{c.eventsCount} com nota · {plural(c.participatedEventsCount, "participado", "participados")}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[20px] font-black tabular-nums" style={{ fontFamily: CONDENSED }}>{n1(c.finalResult)}</span>
                <FaixaChip name={c.platoon} color={c.platoonColor} size="sm" />
              </div>
              <div className="text-[12.5px] min-w-[150px]">
                {c.eligible ? <><strong>{brl(c.bonusValue)}</strong> <span className="text-[10px] font-bold uppercase rounded-full px-1.5 py-px" style={c.official ? { backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" } : { backgroundColor: "var(--status-warn-bg)", color: "var(--status-warn-text)" }}>{c.official ? "Oficial" : "Projeção"}</span>{c.bonusStatus && <span style={{ color: "var(--muted-foreground)" }}> · {BONUS_STATUS[c.bonusStatus] ?? c.bonusStatus}</span>}</>
                  : <span style={{ color: "var(--muted-foreground)" }}>Não elegível</span>}
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenCycle(c.cycleId, c.isCurrent)} data-testid={`button-open-cycle-${c.cycleId}`}>
                Ver análise do ciclo <ArrowRight size={14} aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
