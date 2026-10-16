import { useMemo, useState } from "react";
import type { QuarterlyResult } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowRight, ChevronRight, SearchX, Users } from "lucide-react";
import { SearchField, btnSecondary } from "../results/results-ui";
import { CONDENSED, DANGER_TEXT, GOOD_TEXT } from "@/lib/premium-theme";
import { brl, impactOfRow, mean, n1, plural, pts, signed, type Faixa, type Impact } from "./derive";
import { TeamStrip } from "./charts";
import { Card, EmptyState, FaixaChip, KpiStrip, Pill, StatTile, StatusBadge, TH_BTN, TH_CLS } from "./ui";

type Filter = "todos" | "penalidade" | "merito" | "faixa" | "elegiveis";
type SortKey = "pos" | "name" | "faixa" | "final" | "gross" | "events" | "penalty" | "merit" | "lost" | "bonus";

interface Row { q: QuarterlyResult; pos: number; impact: Impact; lostFaixa: boolean }

/**
 * Sem colaborador escolhido: a equipe inteira, uma linha por pessoa, com o que
 * as penalidades e os méritos fizeram com cada nota. Clicar abre a análise.
 */
export function TeamView({ rows, faixas, minEvents, onPick, readOnly = false }: {
  rows: QuarterlyResult[]; faixas: Faixa[];
  /** Mínimo de eventos PARTICIPADOS para o bônus; null = regras do ciclo não carregaram. */
  minEvents: number | null;
  onPick: (id: number) => void;
  /** Ciclo anterior (seletor de ciclo): o bônus é o apurado, não projeção. */
  readOnly?: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "pos", dir: 1 });

  const all: Row[] = useMemo(() => rows.map(r => {
    const impact = impactOfRow(r, minEvents, faixas);
    return {
      q: r, impact,
      pos: rows.filter(x => x.finalResult > r.finalResult).length + 1,
      lostFaixa: impact.verified && !!impact.faixaNoPenalty && impact.faixa?.name !== impact.faixaNoPenalty.name,
    };
  }), [rows, faixas, minEvents]);

  const finals = all.map(r => r.q.finalResult);
  const teamAvg = mean(finals);
  const withPenalty = all.filter(r => (r.q.absencePenalty ?? 0) > 0);
  const penaltyPts = withPenalty.reduce((s, r) => s + (r.q.absencePenalty ?? 0), 0);
  const lostFaixa = all.filter(r => r.lostFaixa);
  const eligible = all.filter(r => r.q.eligible);
  const bonusTotal = all.reduce((s, r) => s + (r.q.bonusValue ?? 0), 0);
  const bonusLost = all.reduce((s, r) => s + (r.impact.bonus?.lost ?? 0), 0);

  const counts: Record<Filter, number> = {
    todos: all.length, penalidade: withPenalty.length, merito: all.filter(r => (r.q.meritPoints ?? 0) > 0).length,
    faixa: lostFaixa.length, elegiveis: eligible.length,
  };

  const visible = useMemo(() => {
    const text = q.trim().toLocaleLowerCase("pt-BR");
    const val = (r: Row): string | number => {
      switch (sort.key) {
        case "pos": return r.pos;
        case "name": return r.q.employeeName;
        case "faixa": return r.q.platoonMinScore ?? r.q.finalResult;
        case "final": return r.q.finalResult;
        case "gross": return r.q.grossAverage ?? 0;
        case "events": return r.q.participatedEventsCount ?? 0;
        case "penalty": return r.q.absencePenalty ?? 0;
        case "merit": return r.q.meritPoints ?? 0;
        case "lost": return r.impact.lostPoints; // não conferidos vão para o fim (abaixo)
        case "bonus": return r.q.bonusValue ?? 0;
      }
    };
    return all
      .filter(r => !text || r.q.employeeName.toLocaleLowerCase("pt-BR").includes(text))
      .filter(r => filter === "todos" ? true
        : filter === "penalidade" ? (r.q.absencePenalty ?? 0) > 0
        : filter === "merito" ? (r.q.meritPoints ?? 0) > 0
        : filter === "faixa" ? r.lostFaixa
        : !!r.q.eligible)
      .sort((a, b) => {
        if (sort.key === "lost") {
          // Só valores conferidos entram na ordem; com penalidade e sem conferência, sempre no fim.
          const ua = unverified(a), ub = unverified(b);
          if (ua !== ub) return ua ? 1 : -1;
        }
        const x = val(a), y = val(b);
        const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
        return c * sort.dir || a.pos - b.pos || a.q.employeeName.localeCompare(b.q.employeeName, "pt-BR");
      });
  }, [all, q, filter, sort]);

  function unverified(r: Row) { return (r.q.absencePenalty ?? 0) > 0 && !r.impact.verified; }

  const toggle = (key: SortKey) => setSort(prev => prev.key === key
    ? { key, dir: prev.dir === 1 ? -1 : 1 }
    : { key, dir: key === "name" || key === "pos" ? 1 : -1 });

  if (all.length === 0) {
    return <EmptyState icon={Users} title="Ninguém no ranking deste ciclo ainda" description="A análise por colaborador aparece quando houver eventos com resultados confirmados e o ciclo for recalculado."
      action={readOnly ? undefined : <Link href="/evaluations" className={btnSecondary}>Acompanhar as avaliações <ArrowRight size={15} aria-hidden /></Link>} />;
  }

  return (
    <div className="space-y-5">
      <KpiStrip className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6" data-testid="person-team-kpis">
        <StatTile hero label="Nota média" value={n1(teamAvg)} detail={`${plural(all.length, "colaborador", "colaboradores")} no ranking`} />
        <StatTile label="Com penalidade" value={withPenalty.length} detail={withPenalty.length ? `${pts(penaltyPts)} pontos lançados no total` : "Nenhuma penalidade no ciclo"} />
        <StatTile label="Faixa perdida por penalidade" value={lostFaixa.length} detail={lostFaixa.length ? "Sem as penalidades, estariam numa faixa acima" : "Ninguém mudou de faixa por penalidade"} />
        <StatTile label="Com mérito" value={counts.merito} detail="Ganharam pontos por mérito" />
        <StatTile label="Elegíveis ao bônus" value={`${eligible.length}/${all.length}`} detail={minEvents != null ? `Mínimo de ${minEvents} eventos participados` : "Mínimo de eventos indisponível"} />
        <StatTile label={readOnly ? "Bônus do ciclo" : "Bônus projetado"} value={brl(bonusTotal)} detail={bonusLost > 0 ? `${brl(bonusLost)} a menos por penalidades` : "Nenhum real perdido por penalidades"} />
      </KpiStrip>

      <Card title="A equipe numa linha" subtitle="Cada ponto é uma pessoa, pela nota final do ciclo; o fundo mostra as faixas e a linha tracejada, a média da equipe. Clique num ponto para abrir a análise.">
        <TeamStrip people={all.map(r => ({ id: r.q.employeeId, name: r.q.employeeName, final: r.q.finalResult, color: r.q.platoonColor ?? null }))}
          faixas={faixas} onPick={onPick} teamAvg={teamAvg} />
        <p className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          <span aria-hidden className="inline-block h-3 w-0" style={{ borderLeft: "2px dashed var(--muted-foreground)" }} /> Média da equipe <strong className="tabular-nums" style={{ color: "var(--foreground)" }}>{n1(teamAvg)}</strong>
        </p>
      </Card>

      <Card
        title="Todos os colaboradores"
        subtitle="Nota, eventos, penalidades, méritos e bônus de cada um no ciclo (valores do último recálculo). O efeito das penalidades é quanto a nota final subiria sem elas."
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SearchField value={q} onChange={setQ} label="Buscar colaborador" placeholder="Buscar pelo nome…" testId="input-person-search" className="w-full sm:w-[280px]" />
          <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-1.5">
            {([
              ["todos", "Todos"], ["penalidade", "Com penalidade"], ["merito", "Com mérito"], ["faixa", "Perderam faixa"], ["elegiveis", "Elegíveis"],
            ] as [Filter, string][]).map(([k, label]) => (
              <Pill key={k} active={filter === k} onClick={() => setFilter(k)}>{label} · {counts[k]}</Pill>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState compact icon={SearchX} title="Ninguém com esse filtro" description="Mude a busca ou volte para Todos." />
        ) : (
          <>
            {/* Tabela: telas largas */}
            <div className="hidden lg:block overflow-x-auto -mx-1">
              <table className="w-full text-[13.5px]" data-testid="table-person-team">
                <thead>
                  <tr>
                    {([
                      ["pos", "#", "left"], ["name", "Colaborador", "left"], ["faixa", "Faixa", "left"], ["final", "Nota final", "right"], ["gross", "Média bruta", "right"],
                      ["events", "Participou / mín.", "right"], ["penalty", "Penalidades", "right"], ["merit", "Méritos", "right"],
                      ["lost", "Efeito das penalidades", "left"], ["bonus", "Bônus", "right"],
                    ] as [SortKey, string, "left" | "right"][]).map(([key, label, align]) => {
                      const active = sort.key === key;
                      return (
                        <th key={key} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                          scope="col" className={`${TH_CLS} ${active ? "text-foreground" : "text-muted-foreground"} ${align === "right" ? "text-right" : "text-left"}`}>
                          <button type="button" onClick={() => toggle(key)} className={`${TH_BTN} ${align === "right" ? "flex-row-reverse" : ""}`}>
                            {label}<span aria-hidden className="text-[10px] opacity-70">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                          </button>
                        </th>
                      );
                    })}
                    <th className="w-8 border-b border-border"><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(r => (
                    <tr key={r.q.employeeId} onClick={() => onPick(r.q.employeeId)} className="cursor-pointer transition-colors hover:bg-[var(--secondary)]" data-testid={`row-person-${r.q.employeeId}`}>
                      <Td className="tabular-nums font-bold" muted>{r.pos}º</Td>
                      <Td>
                        <button type="button" onClick={e => { e.stopPropagation(); onPick(r.q.employeeId); }} className="font-semibold text-left hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                          {r.q.employeeName}
                        </button>
                      </Td>
                      <Td><FaixaChip size="sm" name={r.q.platoon} color={r.q.platoonColor} muted /></Td>
                      <Td right><span className="text-[16px] font-black tabular-nums" style={{ fontFamily: CONDENSED }}>{n1(r.q.finalResult)}</span></Td>
                      <Td right muted>{n1(r.q.grossAverage)}</Td>
                      <Td right>
                        <span className="flex flex-col items-end tabular-nums whitespace-nowrap">
                          <span><strong>{r.q.participatedEventsCount ?? "—"}</strong><span style={{ color: "var(--muted-foreground)" }}> / {minEvents ?? "—"}</span></span>
                          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{r.q.eventsCount ?? 0} na nota</span>
                        </span>
                      </Td>
                      <Td right>{(r.q.absencePenalty ?? 0) > 0 ? <strong className="tabular-nums" style={{ color: DANGER_TEXT }}>−{pts(r.q.absencePenalty ?? 0)} pts</strong> : <Dash />}</Td>
                      <Td right>{(r.q.meritPoints ?? 0) > 0 ? <strong className="tabular-nums" style={{ color: GOOD_TEXT }}>+{pts(r.q.meritPoints ?? 0)} pts</strong> : <Dash />}</Td>
                      <Td><EffectCell r={r} /></Td>
                      <Td right><BonusCell q={r.q} lost={r.impact.bonus?.lost ?? 0} /></Td>
                      <Td><ChevronRight size={16} aria-hidden style={{ color: "var(--muted-foreground)" }} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartões: celular e tablet */}
            <ul className="lg:hidden grid gap-2.5" aria-label="Colaboradores">
              {visible.map(r => (
                <li key={r.q.employeeId}>
                  <article className="relative rounded-xl p-3.5 flex flex-col gap-2.5 transition-colors hover:bg-[var(--secondary)] has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-ring"
                    style={{ border: "1px solid var(--border)" }} data-testid={`card-person-${r.q.employeeId}`} aria-label={r.q.employeeName}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold tabular-nums" style={{ color: "var(--muted-foreground)" }}>{r.pos}º no ranking</p>
                        <h3 className="font-bold leading-tight truncate">
                          {/* O ::after estica a área de clique sobre o cartão inteiro; o resto do cartão é texto. */}
                          <button type="button" onClick={() => onPick(r.q.employeeId)} aria-label={`Ver análise de ${r.q.employeeName}`}
                            className="text-left font-bold focus-visible:outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']">
                            {r.q.employeeName}
                          </button>
                        </h3>
                        <div className="mt-1.5"><FaixaChip size="sm" name={r.q.platoon} color={r.q.platoonColor} muted /></div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[28px] font-black leading-none tabular-nums" style={{ fontFamily: CONDENSED }}>{n1(r.q.finalResult)}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>média bruta {n1(r.q.grossAverage)}</p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 text-[12px]">
                      <MiniStat label="Particip." value={`${r.q.participatedEventsCount ?? "—"}/${minEvents ?? "—"}`} />
                      <MiniStat label="Penalid." value={(r.q.absencePenalty ?? 0) > 0 ? `−${pts(r.q.absencePenalty ?? 0)}` : "—"} color={(r.q.absencePenalty ?? 0) > 0 ? DANGER_TEXT : undefined} />
                      <MiniStat label="Méritos" value={(r.q.meritPoints ?? 0) > 0 ? `+${pts(r.q.meritPoints ?? 0)}` : "—"} color={(r.q.meritPoints ?? 0) > 0 ? GOOD_TEXT : undefined} />
                      <MiniStat label="Bônus" value={r.q.eligible ? brl(r.q.bonusValue) : "Não eleg."} />
                    </dl>
                    {((r.q.absencePenalty ?? 0) > 0) && <EffectCell r={r} />}
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-[12px]" aria-live="polite" style={{ color: "var(--muted-foreground)" }}>
          Mostrando {plural(visible.length, "colaborador", "colaboradores")} de {all.length}.
        </p>
      </Card>
    </div>
  );
}

function Td({ children, right, muted, className = "" }: { children: React.ReactNode; right?: boolean; muted?: boolean; className?: string }) {
  return (
    <td className={`py-2.5 px-2 align-middle ${right ? "text-right" : "text-left"} ${className}`} style={{ borderBottom: "1px solid var(--border)", color: muted ? "var(--muted-foreground)" : undefined }}>
      {children}
    </td>
  );
}

const Dash = () => <span style={{ color: "var(--muted-foreground)" }}>—</span>;

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <dt className="font-condensed text-[11.5px] font-bold uppercase tracking-[0.06em] truncate text-muted-foreground">{label}</dt>
      <dd className="font-bold tabular-nums truncate" style={{ color }}>{value}</dd>
    </div>
  );
}

function EffectCell({ r }: { r: Row }) {
  if ((r.q.absencePenalty ?? 0) <= 0) return <Dash />;
  if (!r.impact.verified) return <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Recalcule o ciclo para ver</span>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12.5px] tabular-nums whitespace-nowrap"><strong style={{ color: DANGER_TEXT }}>{signed(-r.impact.lostPoints)}</strong> na nota</span>
      {r.lostFaixa && r.impact.faixaNoPenalty && (
        <StatusBadge size="sm" variant="danger" label={`Perdeu a faixa ${r.impact.faixaNoPenalty.name}`} />
      )}
    </span>
  );
}

function BonusCell({ q, lost }: { q: QuarterlyResult; lost: number }) {
  if (!q.eligible) {
    return <span title={q.eligibilityReason ?? undefined}><StatusBadge size="sm" variant="neutral" label="Não elegível" /></span>;
  }
  return (
    <span className="flex flex-col items-end">
      <strong className="tabular-nums">{brl(q.bonusValue)}</strong>
      {lost > 0 && <span className="text-[11px] tabular-nums" style={{ color: DANGER_TEXT }}>−{brl(lost)} por penalidades</span>}
    </span>
  );
}
