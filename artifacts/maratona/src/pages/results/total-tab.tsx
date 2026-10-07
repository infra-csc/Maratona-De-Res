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
import { ChevronDown, Download, Layers, Search, Users, Wallet2, CheckCircle2, Hourglass, Info, Trophy } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { BONUS_STATUS_LABELS, fieldStyle, fmtBRL, fmtBRLShort, fmtScore, type SortDir } from "./helpers";
import { FaixaBadge, SortIcon } from "./badges";

type SortKey = "position" | "employeeName" | "cyclesWithScore" | "avgFinalResult" | "eventsCount" | "bonusOfficial" | "bonusProjected" | "bonusPaid";

const COLS = "minmax(200px,1.7fr) 0.8fr 0.9fr 0.8fr 1fr 1fr 1fr 1.1fr 40px";

function csvOf(rows: RankingTotalRow[]): string {
  const head = ["Posição", "Colaborador", "Ciclos com nota", "Média final (ponderada pelos eventos)", "Eventos com nota", "Bônus oficial — ciclos fechados (R$)", "Bônus projetado — ciclo aberto (R$)", "Bônus pago (R$)", "Faixa do ciclo mais recente", "Ciclo mais recente"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map(r => [
    r.position, r.employeeName, r.cyclesWithScore, r.avgFinalResult == null ? "" : fmtNum(r.avgFinalResult, 1),
    r.eventsCount, fmtNum(r.bonusOfficial, 2), fmtNum(r.bonusProjected, 2), fmtNum(r.bonusPaid, 2), r.latest.platoon ?? "", r.latest.cycleName,
  ].map(esc).join(";"));
  return [head.map(esc).join(";"), ...lines].join("\n");
}

const muted = { color: "var(--muted-foreground)" } as const;
const money = (v: number) => (v > 0 ? fmtBRL(v) : <span style={muted}>—</span>);

/** Lista "ciclo a ciclo" de uma pessoa (mesma na tabela e no cartão). */
function CyclesList({ cycles, onOpenCycle }: { cycles: RankingTotalCycle[]; onOpenCycle: (cycleId: number, isCurrent: boolean) => void }) {
  return (
    <ul className="space-y-2">
      {cycles.map(c => {
        const st = c.bonusStatus ? BONUS_STATUS_LABELS[c.bonusStatus] : null;
        return (
          <li key={c.cycleId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
            <button type="button" onClick={() => onOpenCycle(c.cycleId, c.isCurrent)}
              className="font-bold underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-sm"
              title="Abrir este ciclo em Resultados & Ranking">
              {c.cycleName}
            </button>
            {c.isCurrent && <span className="text-[10px] font-bold uppercase rounded-full px-1.5" style={{ backgroundColor: "var(--status-ok-bg)", color: "var(--status-ok-text)" }}>Atual</span>}
            <span>Nota <strong>{fmtScore(c.finalResult)}</strong></span>
            <FaixaBadge name={c.platoon} color={c.platoonColor} compact />
            <span style={muted}>{plural(c.eventsCount, "evento com nota", "eventos com nota")} · {c.participatedEventsCount} {c.participatedEventsCount === 1 ? "participado" : "participados"}</span>
            <span>
              {c.eligible
                ? <>Bônus <strong>{fmtBRL(c.bonusValue)}</strong> <span className="text-[10px] font-bold uppercase rounded-full px-1.5 py-px" style={c.official ? { backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" } : { backgroundColor: "var(--status-warn-bg)", color: "var(--status-warn-text)" }}>{c.official ? "Oficial" : "Projeção"}</span></>
                : <span style={muted}>Não elegível</span>}
            </span>
            {st && c.eligible && <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export function TotalTab({ onOpenCycle }: { onOpenCycle: (cycleId: number, isCurrent: boolean) => void }) {
  const { data, isLoading, isError } = useGetRankingTotal({ query: { queryKey: getGetRankingTotalQueryKey(), staleTime: 60_000 } });
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

  const head = (label: string, k: SortKey, align: "left" | "center" = "center", title?: string) => (
    <div role="columnheader" aria-sort={sortKey === k ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-3 py-3 text-[11px] font-bold uppercase select-none", align === "center" && "text-center")}
      style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }} title={title}>
      <button type="button" onClick={() => sortBy(k)}
        className="inline-flex items-center gap-1 uppercase rounded-sm hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        style={{ fontFamily: CONDENSED, color: "inherit" }}>
        {label}<SortIcon active={sortKey === k} dir={sortDir} />
      </button>
    </div>
  );

  if (isLoading) return <div className="text-center py-20 font-bold uppercase" style={muted}>Carregando o total geral...</div>;
  if (isError) return <div className="text-center py-20 font-bold" style={{ color: DANGER_TEXT }}>Não foi possível carregar o total geral. Tente de novo em instantes.</div>;

  const expandButton = (r: RankingTotalRow, expanded: boolean, testId: string) => (
    <button type="button" onClick={() => setOpen(expanded ? null : r.employeeId)} aria-expanded={expanded}
      aria-label={`${expanded ? "Fechar" : "Ver"} os ciclos de ${r.employeeName}`}
      className="p-1.5 rounded-md hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      data-testid={testId}>
      <ChevronDown size={16} aria-hidden className={cn("transition-transform", expanded && "rotate-180")} style={muted} />
    </button>
  );

  return (
    <div className="space-y-5" data-testid="results-total">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          // Média geral do summary da API: a MESMA do Dashboard e de Análises no Total geral.
          { icon: Trophy, label: "Média geral", value: data?.summary?.avgFinalResult != null ? fmtScore(data.summary.avgFinalResult) : "—", title: "Ponderada pelos eventos com nota (a mesma do Dashboard e de Análises)", testId: "total-avg-final" },
          { icon: Layers, label: "Ciclos somados", value: String(cycles.length) },
          { icon: Users, label: "Pessoas", value: String(data?.summary?.people ?? rows.length) },
          { icon: Wallet2, label: "Bônus oficial", value: fmtBRLShort(bonusOfficial), title: "Ciclos fechados: o bônus que vale", testId: "total-bonus-official" },
          { icon: Hourglass, label: "Bônus projetado", value: fmtBRLShort(bonusProjected), title: "Ciclo ainda aberto: projeção que muda até o fechamento", testId: "total-bonus-projected" },
          { icon: CheckCircle2, label: "Bônus pago", value: fmtBRLShort(bonusPaid), title: "Soma do bônus marcado como pago" },
        ].map(t => (
          // 6 cartões: 2, 3 ou 6 por linha — nunca sobra buraco.
          <div key={t.label} className="rounded-xl px-4 py-3.5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} title={t.title} data-testid={t.testId}>
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={muted}><t.icon size={12} aria-hidden /> {t.label}</span>
            <span className="block font-black text-2xl mt-0.5 truncate" style={{ fontFamily: CONDENSED }}>{t.value}</span>
            {t.title && <span className="block text-[11px] mt-0.5 leading-snug" style={muted}>{t.title}</span>}
          </div>
        ))}
      </div>

      {openCycles.length > 0 && (
        <p role="note" data-testid="total-open-cycle-warning" className="flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px]"
          style={{ backgroundColor: "var(--status-warn-bg)", color: "var(--status-warn-text)" }}>
          <Info size={14} aria-hidden className="mt-[2px] shrink-0" />
          <span>
            <strong>{openCycles.map(c => c.name).join(", ")}</strong> {openCycles.length === 1 ? "ainda está aberto" : "ainda estão abertos"}: o bônus e a nota {openCycles.length === 1 ? "desse ciclo são uma projeção" : "desses ciclos são projeções"} e mudam até o fechamento. O bônus oficial soma só os ciclos fechados.
            {minRules.length > 1 && <> O mínimo de eventos para o bônus é o de cada ciclo ({cycles.filter(c => c.minEvents != null).map(c => `${c.name}: ${c.minEvents}`).join("; ")}).</>}
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={muted} />
          <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 h-11 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={fieldStyle} placeholder="Buscar colaborador..." aria-label="Buscar colaborador no total geral" data-testid="input-search-total" />
        </div>
        <button type="button" onClick={exportCsv} disabled={shown.length === 0}
          className="ml-auto rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80 disabled:opacity-50"
          style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }} data-testid="button-export-total">
          <Download size={15} aria-hidden /> Exportar
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-20 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
          <Layers size={44} className="mx-auto mb-4 opacity-20" aria-hidden />
          <h3 className="text-xl font-black uppercase tracking-tight mb-1" style={{ fontFamily: CONDENSED }}>Nenhum resultado apurado</h3>
          <p style={muted}>Nenhum ciclo tem resultado consolidado ainda.</p>
        </div>
      ) : (
        <>
        {/* Celular/tablet: um cartão por pessoa (a tabela de 9 colunas não cabe em 390 px). */}
        <ul className="grid gap-2.5 md:grid-cols-2 lg:hidden" aria-label="Total geral por colaborador" data-testid="total-cards">
          {shown.map(r => {
            const expanded = open === r.employeeId;
            return (
              <li key={r.employeeId} className="rounded-xl p-3.5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} data-testid={`card-total-${r.employeeId}`}>
                <div className="flex items-start gap-2.5">
                  <span className="w-7 shrink-0 text-center text-[13px] font-black pt-0.5" style={{ fontFamily: CONDENSED, ...muted }}>{String(r.position).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold uppercase text-sm break-words">{r.employeeName}</span>
                    <span className="text-[11px]" style={muted}>
                      {r.cyclesWithScore} de {plural(r.cyclesCount, "ciclo", "ciclos")} com nota · {plural(r.eventsCount, "evento", "eventos")} com nota
                      {!r.employeeActive && " · Desligado"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{r.avgFinalResult == null ? "—" : fmtScore(r.avgFinalResult)}</span>
                    <span className="text-[10px] font-bold uppercase" style={muted}>Média</span>
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
                  <div className="min-w-0"><dt className="text-[10px] font-bold uppercase" style={{ fontFamily: CONDENSED, ...muted }}>Oficial</dt><dd className="font-bold truncate">{money(r.bonusOfficial)}</dd></div>
                  <div className="min-w-0"><dt className="text-[10px] font-bold uppercase" style={{ fontFamily: CONDENSED, ...muted }}>Projetado</dt><dd className="font-bold truncate">{money(r.bonusProjected)}</dd></div>
                  <div className="min-w-0"><dt className="text-[10px] font-bold uppercase" style={{ fontFamily: CONDENSED, ...muted }}>Pago</dt><dd className="font-bold truncate">{money(r.bonusPaid)}</dd></div>
                </dl>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="min-w-0" title={`Faixa em ${r.latest.cycleName}`}><FaixaBadge name={r.latest.platoon} color={r.latest.platoonColor} compact /></span>
                  {expandButton(r, expanded, `button-total-card-expand-${r.employeeId}`)}
                </div>
                {expanded && (
                  <div className="mt-2.5 rounded-lg p-3" style={{ backgroundColor: "var(--secondary)" }}>
                    <CyclesList cycles={r.cycles} onOpenCycle={onOpenCycle} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="rounded-xl overflow-hidden hidden lg:block" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="overflow-x-auto">
            <div className="min-w-[980px]" role="table" aria-label="Total geral por colaborador">
              <div role="row" className="grid items-center" style={{ gridTemplateColumns: COLS, backgroundColor: "var(--secondary)" }}>
                {head("Colaborador", "employeeName", "left")}
                {head("Ciclos c/ nota", "cyclesWithScore", "center", "Ciclos em que teve evento com nota")}
                {head("Média final", "avgFinalResult", "center", "Média ponderada pelos eventos com nota: Σ (nota final do ciclo × eventos) ÷ Σ eventos")}
                {head("Eventos c/ nota", "eventsCount", "center", "Soma dos eventos com nota em todos os ciclos")}
                {head("Bônus oficial", "bonusOfficial", "center", "Ciclos fechados em que foi elegível")}
                {head("Bônus projetado", "bonusProjected", "center", "Ciclo aberto: projeção que muda até o fechamento")}
                {head("Bônus pago", "bonusPaid")}
                <div role="columnheader" className="px-3 py-3 text-[11px] font-bold uppercase text-center" style={{ fontFamily: CONDENSED, ...muted }} title="A faixa é de cada ciclo: aqui, a do ciclo mais recente da pessoa">Faixa (último ciclo)</div>
                <div role="columnheader" aria-label="Detalhar" />
              </div>
              {shown.map(r => {
                const expanded = open === r.employeeId;
                return (
                  <Fragment key={r.employeeId}>
                    <div role="row" className="grid items-center" style={{ gridTemplateColumns: COLS, borderTop: "1px solid var(--border)" }} data-testid={`row-total-${r.employeeId}`}>
                      <div role="cell" className="px-3 py-3 flex items-center gap-2.5 min-w-0">
                        <span className="w-8 shrink-0 text-center text-[13px] font-black" style={{ fontFamily: CONDENSED, ...muted }}>{String(r.position).padStart(2, "0")}</span>
                        <span className="min-w-0">
                          <span className="block font-bold uppercase text-sm truncate">{r.employeeName}</span>
                          {!r.employeeActive && <span className="text-[10.5px] font-bold uppercase" style={muted}>Desligado</span>}
                        </span>
                      </div>
                      <div role="cell" className="px-3 py-3 text-center text-sm font-bold">{r.cyclesWithScore}<span className="font-semibold" style={muted}> de {r.cyclesCount}</span></div>
                      <div role="cell" className="px-3 py-3 text-center">
                        <span className="font-black text-xl leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{r.avgFinalResult == null ? "—" : fmtScore(r.avgFinalResult)}</span>
                      </div>
                      <div role="cell" className="px-3 py-3 text-center text-sm font-bold">{r.eventsCount}</div>
                      <div role="cell" className="px-3 py-3 text-center text-sm font-bold">{money(r.bonusOfficial)}</div>
                      <div role="cell" className="px-3 py-3 text-center text-sm font-bold" style={r.bonusProjected > 0 ? { color: "var(--status-warn-text)" } : undefined}>{money(r.bonusProjected)}</div>
                      <div role="cell" className="px-3 py-3 text-center text-sm font-bold">{money(r.bonusPaid)}</div>
                      <div role="cell" className="px-3 py-3 text-center" title={`Faixa em ${r.latest.cycleName}`}>
                        <FaixaBadge name={r.latest.platoon} color={r.latest.platoonColor} compact />
                      </div>
                      <div role="cell" className="px-1 py-3 text-center">{expandButton(r, expanded, `button-total-expand-${r.employeeId}`)}</div>
                    </div>
                    {expanded && (
                      <div role="row" style={{ backgroundColor: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
                        <div role="cell" className="px-4 py-3 pl-14">
                          <p className="text-[11px] font-bold uppercase mb-2" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", ...muted }}>Ciclo a ciclo</p>
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
