// Resultados & Ranking → "Total geral": uma linha por pessoa somando todos os
// ciclos (GET /ranking/total). Somente leitura. A linha abre o histórico da
// pessoa ciclo a ciclo, com atalho para consultar cada ciclo.
//
// Regras do dono (06/10/2026):
//  - a média é PONDERADA pelos eventos com nota (Σ nota final × eventos ÷ Σ eventos);
//  - o bônus OFICIAL (ciclos fechados) fica separado do PROJETADO (ciclo
//    aberto, que ainda muda até o fechamento).
import { Fragment, useMemo, useState } from "react";
import { useGetRankingTotal, getGetRankingTotalQueryKey, type RankingTotalRow, type RankingTotalCycle } from "@workspace/api-client-react";
import { ArrowUpRight, ChevronDown, Download, Hourglass, Layers, SearchX, X } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { fmtBRL, fmtBRLShort, fmtScore, type SortDir } from "./helpers";
import { FaixaBadge, SortIcon } from "./badges";
import { PayStatusChip } from "./payments-list";
import { Bone, Chip, EmptyBlock, ErrorBlock, FOCUS_RING, ListSkeleton, Notice, SearchField, StatCell, btnSmall, surfaceCls } from "./results-ui";

type SortKey = "position" | "employeeName" | "cyclesWithScore" | "avgFinalResult" | "eventsCount" | "bonusOfficial" | "bonusProjected" | "bonusPaid";

const COLS = "minmax(170px,1.6fr) 120px 104px 124px minmax(110px,1fr) minmax(120px,1fr) minmax(110px,1fr) minmax(120px,1fr) 52px";

function csvOf(rows: RankingTotalRow[]): string {
  const head = ["Posição", "Colaborador", "Ciclos com nota", "Nota média geral (ponderada pelos eventos)", "Eventos com nota", "Bônus oficial — ciclos fechados (R$)", "Bônus projetado — ciclo aberto (R$)", "Bônus pago (R$)", "Faixa do ciclo mais recente", "Ciclo mais recente"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(r => [
    r.position, r.employeeName, r.cyclesWithScore, r.avgFinalResult == null ? "" : fmtNum(r.avgFinalResult, 1),
    r.eventsCount, fmtNum(r.bonusOfficial, 2), fmtNum(r.bonusProjected, 2), fmtNum(r.bonusPaid, 2), r.latest.platoon ?? "", r.latest.cycleName,
  ].map(esc).join(";"));
  return [head.map(esc).join(";"), ...lines].join("\n");
}

const money = (v: number) => (v > 0 ? fmtBRL(v) : <span className="text-muted-foreground font-normal">—</span>);

/** Lista "ciclo a ciclo" de uma pessoa (mesma na tabela e no cartão). */
function CyclesList({ cycles, onOpenCycle }: { cycles: RankingTotalCycle[]; onOpenCycle: (cycleId: number, isCurrent: boolean) => void }) {
  return (
    <ul className="divide-y divide-border/70">
      {cycles.map(c => (
        <li key={c.cycleId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2 first:pt-0 last:pb-0 text-[13px]">
          <button type="button" onClick={() => onOpenCycle(c.cycleId, c.isCurrent)}
            className={cn("inline-flex items-center gap-1 min-h-11 md:min-h-0 font-condensed text-[14px] font-bold uppercase tracking-[0.03em] underline underline-offset-2 hover:text-[var(--accent-text)] rounded-sm", FOCUS_RING)}
            title="Abrir este ciclo em Resultados & Ranking">
            {c.cycleName}<ArrowUpRight size={13} aria-hidden />
          </button>
          {c.isCurrent && <Chip tone="ok">Atual</Chip>}
          <span className="tabular-nums">Nota <strong>{fmtScore(c.finalResult)}</strong></span>
          <FaixaBadge name={c.platoon} color={c.platoonColor} compact />
          <span className="text-muted-foreground">{plural(c.eventsCount, "evento com nota", "eventos com nota")} · {c.participatedEventsCount} {c.participatedEventsCount === 1 ? "participado" : "participados"}</span>
          <span className="inline-flex items-center gap-1.5">
            {c.eligible
              ? <>Bônus <strong className="tabular-nums">{fmtBRL(c.bonusValue)}</strong> <Chip tone={c.official ? "neutral" : "warn"}>{c.official ? "Oficial" : "Projeção"}</Chip></>
              : <span className="text-muted-foreground">Não elegível</span>}
          </span>
          {c.bonusStatus && c.eligible && <PayStatusChip status={c.bonusStatus} />}
        </li>
      ))}
    </ul>
  );
}

export function TotalTab({ onOpenCycle }: { onOpenCycle: (cycleId: number, isCurrent: boolean) => void }) {
  const { data, isLoading, isError, refetch } = useGetRankingTotal({ query: { queryKey: getGetRankingTotalQueryKey(), staleTime: 60_000 } });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("position");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [open, setOpen] = useState<number | null>(null);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term ? rows.filter(r => r.employeeName.toLowerCase().includes(term)) : rows;
    const val = (r: RankingTotalRow): string | number | null => r[sortKey] as string | number | null;
    return [...list].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR");
      return sortDir === "asc" ? c : -c;
    });
  }, [rows, search, sortKey, sortDir]);

  const bonusOfficial = data?.summary?.bonusOfficial ?? rows.reduce((s, r) => s + r.bonusOfficial, 0);
  const bonusProjected = data?.summary?.bonusProjected ?? rows.reduce((s, r) => s + r.bonusProjected, 0);
  const bonusPaid = rows.reduce((s, r) => s + r.bonusPaid, 0);
  const cycles = data?.cycles ?? [];
  const openCycles = cycles.filter(c => c.status !== "closed");
  const minRules = [...new Set(cycles.map(c => c.minEvents).filter((m): m is number => m != null))];

  function sortBy(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "employeeName" || k === "position" ? "asc" : "desc"); }
  }

  function exportCsv() {
    const blob = new Blob(["﻿" + csvOf(shown)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "ranking-total-geral.csv";
    a.click(); URL.revokeObjectURL(url);
  }

  const head = (label: string, k: SortKey, align: "left" | "right" = "right", title?: string) => (
    <div role="columnheader" aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"} title={title}
      className={cn("px-3 py-2.5", align === "right" && "text-right")}>
      <button type="button" onClick={() => sortBy(k)}
        className={cn("font-condensed inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.06em] rounded-sm transition-colors duration-150", sortKey === k ? "text-foreground" : "text-muted-foreground hover:text-foreground", FOCUS_RING)}>
        {label}<SortIcon active={sortKey === k} dir={sortDir} />
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Carregando o total geral">
        <div className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-6 gap-px bg-border")}>
          {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="bg-card px-4 py-4 space-y-2.5"><Bone className="h-3 w-20" /><Bone className="h-8 w-16" /></div>)}
        </div>
        <ListSkeleton label="Carregando colaboradores" />
      </div>
    );
  }
  if (isError) return <ErrorBlock title="Não foi possível carregar o total geral" onRetry={() => { void refetch(); }} />;

  const expandButton = (r: RankingTotalRow, expanded: boolean, testId: string) => (
    <button type="button" onClick={() => setOpen(expanded ? null : r.employeeId)} aria-expanded={expanded}
      aria-label={`${expanded ? "Fechar" : "Ver"} os ciclos de ${r.employeeName}`}
      className={cn("inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}
      data-testid={testId}>
      <ChevronDown size={16} aria-hidden className={cn("transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} />
    </button>
  );

  return (
    <div className="space-y-4" data-testid="results-total">
      <section aria-label="Panorama de todos os ciclos" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-6 gap-px bg-border")}>
        {/* Média geral do summary da API: a MESMA do Dashboard e de Análises no Total geral. */}
        <StatCell testId="total-avg-final" label="Nota média geral" value={data?.summary?.avgFinalResult != null ? fmtScore(data.summary.avgFinalResult) : "—"} sub="Ponderada pelos eventos com nota." />
        <StatCell label="Ciclos somados" value={cycles.length} sub={openCycles.length > 0 ? `${openCycles.length} ainda aberto${openCycles.length === 1 ? "" : "s"}.` : "Todos fechados."} />
        <StatCell label="Colaboradores" value={data?.summary?.people ?? rows.length} sub="Com resultado em algum ciclo." />
        <StatCell testId="total-bonus-official" label="Bônus oficial" value={fmtBRLShort(bonusOfficial)} sub="Ciclos fechados: o que vale." />
        <StatCell testId="total-bonus-projected" label="Bônus projetado" tone={bonusProjected > 0 ? "warn" : "neutral"} value={fmtBRLShort(bonusProjected)} sub="Ciclo aberto: muda até fechar." />
        <StatCell label="Bônus pago" value={fmtBRLShort(bonusPaid)} sub="Marcado como pago." />
      </section>

      {openCycles.length > 0 && (
        <div role="note" data-testid="total-open-cycle-warning">
          <Notice icon={Hourglass} tone="warn">
            <strong>{openCycles.map(c => c.name).join(", ")}</strong> {openCycles.length === 1 ? "ainda está aberto" : "ainda estão abertos"}: o bônus e a nota {openCycles.length === 1 ? "desse ciclo são uma projeção" : "desses ciclos são projeções"} e mudam até o fechamento. O bônus oficial soma só os ciclos fechados — os dois nunca são somados.
            {minRules.length > 1 && <> O mínimo de eventos para o bônus é o de cada ciclo ({cycles.filter(c => c.minEvents != null).map(c => `${c.name}: ${c.minEvents}`).join("; ")}).</>}
          </Notice>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <SearchField value={search} onChange={setSearch} label="Buscar colaborador no total geral" testId="input-search-total" className="sm:w-72" />
        <button type="button" onClick={exportCsv} disabled={shown.length === 0} className={cn(btnSmall, "sm:ml-auto self-start sm:self-auto")} data-testid="button-export-total">
          <Download size={15} aria-hidden /> Exportar CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <div className={cn(surfaceCls, "border-dashed")}>
          <EmptyBlock icon={Layers} title="Nenhum resultado apurado" testId="total-empty">Nenhum ciclo tem resultado consolidado ainda.</EmptyBlock>
        </div>
      ) : shown.length === 0 ? (
        <div className={surfaceCls}>
          <EmptyBlock icon={SearchX} title="Ninguém encontrado" action={<button type="button" className={btnSmall} onClick={() => setSearch("")}><X size={14} aria-hidden /> Limpar busca</button>}>
            Nenhum colaborador com esse nome em nenhum ciclo.
          </EmptyBlock>
        </div>
      ) : (
        <>
          {/* Celular/tablet: um cartão por pessoa (a tabela de 9 colunas não cabe em 390 px). */}
          <ul className="grid gap-2.5 md:grid-cols-2 lg:hidden items-start" aria-label="Total geral por colaborador" data-testid="total-cards">
            {shown.map(r => {
              const expanded = open === r.employeeId;
              return (
                <li key={r.employeeId} className={cn(surfaceCls, "p-4 min-w-0")} data-testid={`card-total-${r.employeeId}`}>
                  <div className="flex items-start gap-3">
                    <span className="w-8 shrink-0 text-center font-condensed text-[18px] font-black tabular-nums text-muted-foreground pt-0.5">{r.position}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-condensed text-[17px] font-bold uppercase leading-tight break-words">{r.employeeName}</span>
                      <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                        {r.cyclesWithScore} de {plural(r.cyclesCount, "ciclo", "ciclos")} com nota · {plural(r.eventsCount, "evento", "eventos")} com nota
                        {!r.employeeActive && " · Desligado"}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-condensed text-[26px] font-black leading-none tabular-nums">{r.avgFinalResult == null ? "—" : fmtScore(r.avgFinalResult)}</span>
                      <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Média geral</span>
                    </span>
                  </div>
                  <dl className="mt-3 pt-3 border-t border-border/70 grid grid-cols-3 gap-2">
                    {([["Oficial", r.bonusOfficial], ["Projetado", r.bonusProjected], ["Pago", r.bonusPaid]] as const).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{k}</dt>
                        <dd className={cn("font-condensed text-[16px] font-bold tabular-nums truncate", k === "Projetado" && v > 0 && "text-[var(--status-warn-text)]")}>{money(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 inline-flex items-center gap-2 text-[12px] text-muted-foreground" title={`Faixa em ${r.latest.cycleName}`}>
                      <FaixaBadge name={r.latest.platoon} color={r.latest.platoonColor} compact /> último ciclo
                    </span>
                    {expandButton(r, expanded, `button-total-card-expand-${r.employeeId}`)}
                  </div>
                  {expanded && (
                    <div className="mt-2.5 rounded-lg bg-secondary/60 p-3 motion-safe:animate-in motion-safe:fade-in duration-150">
                      <CyclesList cycles={r.cycles} onOpenCycle={onOpenCycle} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className={cn(surfaceCls, "overflow-hidden hidden lg:block")}>
            <div className="overflow-x-auto">
              <div className="min-w-[1050px]" role="table" aria-label="Total geral por colaborador">
                <div role="row" className="grid items-center bg-secondary/60 border-b border-border" style={{ gridTemplateColumns: COLS }}>
                  {head("Colaborador", "employeeName", "left")}
                  {head("Ciclos c/ nota", "cyclesWithScore", "right", "Ciclos em que teve evento com nota")}
                  {head("Média geral", "avgFinalResult", "right", "Média ponderada pelos eventos com nota: Σ (nota final do ciclo × eventos) ÷ Σ eventos")}
                  {head("Eventos c/ nota", "eventsCount", "right", "Soma dos eventos com nota em todos os ciclos")}
                  {head("Bônus oficial", "bonusOfficial", "right", "Ciclos fechados em que foi elegível")}
                  {head("Bônus projetado", "bonusProjected", "right", "Ciclo aberto: projeção que muda até o fechamento")}
                  {head("Bônus pago", "bonusPaid")}
                  <div role="columnheader" className="px-3 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-[0.06em] whitespace-nowrap text-muted-foreground" title="A faixa é de cada ciclo: aqui, a do ciclo mais recente da pessoa">Última faixa</div>
                  <div role="columnheader" aria-label="Detalhar" />
                </div>
                {shown.map(r => {
                  const expanded = open === r.employeeId;
                  return (
                    <Fragment key={r.employeeId}>
                      <div role="row" className={cn("grid items-center border-b border-border transition-colors duration-150 hover:bg-secondary/40", expanded && "bg-secondary/40")} style={{ gridTemplateColumns: COLS }} data-testid={`row-total-${r.employeeId}`}>
                        <div role="cell" className="px-3 py-3 flex items-center gap-3 min-w-0">
                          <span className="w-7 shrink-0 text-center font-condensed text-[17px] font-black tabular-nums text-muted-foreground">{r.position}</span>
                          <span className="min-w-0">
                            <span className="block font-condensed text-[16px] font-bold uppercase tracking-[0.02em] leading-tight truncate">{r.employeeName}</span>
                            {!r.employeeActive && <span className="text-[12px] text-muted-foreground">Desligado</span>}
                          </span>
                        </div>
                        <div role="cell" className="px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums">{r.cyclesWithScore}<span className="text-muted-foreground font-semibold text-[14px]"> de {r.cyclesCount}</span></div>
                        <div role="cell" className="px-3 py-3 text-right font-condensed text-[24px] font-black leading-none tabular-nums">{r.avgFinalResult == null ? "—" : fmtScore(r.avgFinalResult)}</div>
                        <div role="cell" className="px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums">{r.eventsCount}</div>
                        <div role="cell" className="px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums whitespace-nowrap">{money(r.bonusOfficial)}</div>
                        <div role="cell" className={cn("px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums whitespace-nowrap", r.bonusProjected > 0 && "text-[var(--status-warn-text)]")}>{money(r.bonusProjected)}</div>
                        <div role="cell" className="px-3 py-3 text-right font-condensed text-[17px] font-bold tabular-nums whitespace-nowrap">{money(r.bonusPaid)}</div>
                        <div role="cell" className="px-3 py-3 min-w-0" title={`Faixa em ${r.latest.cycleName}`}>
                          <FaixaBadge name={r.latest.platoon} color={r.latest.platoonColor} compact />
                        </div>
                        <div role="cell" className="px-1 py-2 text-center">{expandButton(r, expanded, `button-total-expand-${r.employeeId}`)}</div>
                      </div>
                      {expanded && (
                        <div role="row" className="border-b border-border bg-secondary/40">
                          <div role="cell" className="px-4 py-3 pl-[52px] motion-safe:animate-in motion-safe:fade-in duration-150">
                            <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">Ciclo a ciclo</p>
                            <CyclesList cycles={r.cycles} onOpenCycle={onOpenCycle} />
                          </div>
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
