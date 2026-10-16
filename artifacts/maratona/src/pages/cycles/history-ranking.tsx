// Ranking do histórico do ciclo: "parcial" com o ciclo aberto (muda até o
// fechamento), "final" com ele fechado. Tabela no tablet/desktop, cartões no celular.
import { useMemo, useState } from "react";
import type { CycleHistory, CycleHistoryEntry } from "@workspace/api-client-react";
import { Download, Search, Trophy } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Panel } from "../dashboard/dashboard-ui";
import { Chip, EmptyBlock, SearchField, btnSmall, brl, n1, type Tone } from "./cycles-ui";

const BONUS_STATUS: Record<string, { label: string; tone: Tone }> = {
  projected: { label: "Projetado", tone: "neutral" },
  approved: { label: "Aprovado", tone: "ok" },
  scheduled: { label: "Agendado", tone: "info" },
  paid: { label: "Pago", tone: "brand" },
  blocked: { label: "Bloqueado", tone: "danger" },
  not_eligible: { label: "Não elegível", tone: "neutral" },
};
const payOf = (r: CycleHistoryEntry) => BONUS_STATUS[r.bonusStatus] ?? { label: r.bonusStatus, tone: "neutral" as Tone };

function csvCell(v: string | number | null | undefined): string {
  const text = v == null ? "" : String(v);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportRankingCsv(history: CycleHistory) {
  const head = ["Posição", "Colaborador", "Situação", "Nota final", "Faixa", "Eventos com nota", "Eventos participados", "Faltas", "Elegível", "Motivo", "Bônus (R$)", "Pagamento"];
  const lines = history.ranking.map(r => [
    r.position, r.employeeName, r.employeeActive ? "Ativo" : "Desligado",
    r.finalResult.toFixed(2).replace(".", ","), r.platoon ?? "", r.eventsCount, r.participatedEventsCount, r.totalAbsences,
    r.eligible ? "Sim" : "Não", r.eligibilityReason ?? "", r.bonusValue.toFixed(2).replace(".", ","),
    BONUS_STATUS[r.bonusStatus]?.label ?? r.bonusStatus,
  ].map(csvCell).join(";"));
  // BOM para o Excel abrir os acentos corretamente.
  const blob = new Blob(["﻿" + [head.join(";"), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ranking-${history.cycle.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Swatch({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm border border-border" style={{ backgroundColor: color ?? "var(--muted)" }} />;
}

function Eligibility({ r }: { r: CycleHistoryEntry }) {
  if (r.eligible) return <Chip tone="ok">Elegível</Chip>;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Chip tone="warn">Não elegível</Chip>
      {r.eligibilityReason && <span className="text-[12px] leading-snug text-muted-foreground">{r.eligibilityReason}</span>}
    </span>
  );
}

const TH = "py-2.5 px-3 first:pl-5 last:pr-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap border-b border-border";
const TD = "py-2.5 px-3 first:pl-5 last:pr-5 border-b border-border";

export function HistoryRanking({ history }: { history: CycleHistory }) {
  const { cycle, ranking } = history;
  // Ranking só é "final" com o ciclo fechado; aberto, ele muda até o fechamento.
  const final = cycle.status === "closed";
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return term ? ranking.filter(r => r.employeeName.toLocaleLowerCase("pt-BR").includes(term)) : ranking;
  }, [ranking, search]);

  return (
    <Panel
      labelId="history-ranking-title"
      testId="history-ranking"
      title={<>{final ? "Ranking final" : "Ranking parcial"} <Chip tone={final ? "ok" : "warn"} className="ml-1">{final ? "Oficial" : "Muda até o fechamento"}</Chip></>}
      sub={!final
        ? "Nota, faixa e bônus projetado de cada colaborador. Mesmos colaboradores do Ranking (ativos)."
        : cycle.isCurrent
          ? "Nota final, faixa e bônus de cada colaborador. Mesmos colaboradores do Ranking (ativos)."
          : "Nota final, faixa e bônus de cada colaborador neste ciclo. Quem foi desligado depois continua aqui."}
      aside={ranking.length > 0 && (
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <SearchField value={search} onChange={setSearch} label="Buscar colaborador" testId="input-search-history" className="flex-1 sm:flex-none sm:w-60" />
          <button type="button" onClick={() => exportRankingCsv(history)} className={btnSmall} data-testid="button-export-history">
            <Download size={14} aria-hidden /> CSV
          </button>
        </div>
      )}
    >
      {ranking.length === 0 ? (
        <EmptyBlock icon={Trophy} title="Sem resultados neste ciclo" className="py-10">O ranking aparece depois que há eventos com resultados confirmados e o ciclo é calculado.</EmptyBlock>
      ) : filtered.length === 0 ? (
        <EmptyBlock icon={Search} title="Ninguém encontrado" className="py-10"
          action={<button type="button" onClick={() => setSearch("")} className={btnSmall}>Limpar busca</button>}>
          Nenhum colaborador com &ldquo;{search.trim()}&rdquo; no nome.
        </EmptyBlock>
      ) : (
        <>
          <ul className="lg:hidden border-t border-border divide-y divide-border" data-testid="list-history-ranking-mobile">
            {filtered.map(r => {
              const pay = payOf(r);
              return (
                <li key={r.employeeId} className="px-4 py-3.5 flex items-start gap-3">
                  <span className="w-8 shrink-0 pt-0.5 font-condensed text-[20px] font-black tabular-nums text-muted-foreground">{r.position}</span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 font-semibold leading-snug">{r.employeeName}{!r.employeeActive && <Chip className="ml-2 h-5 text-[11px]">Desligado</Chip>}</span>
                      <span className="font-condensed text-[22px] font-black leading-none tabular-nums">{n1(r.finalResult)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 text-foreground"><Swatch color={r.platoonColor} />{r.platoon ?? "Sem faixa"}</span>
                      <span className="tabular-nums">{r.eventsCount}/{r.participatedEventsCount} eventos</span>
                      <span className="tabular-nums">{plural(r.totalAbsences, "falta", "faltas")}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Eligibility r={r} />
                      <span className="inline-flex items-center gap-2 tabular-nums font-semibold">{brl(r.bonusValue)} <Chip tone={pay.tone} className="h-5 text-[11px]">{pay.label}</Chip></span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden lg:block overflow-x-auto relative">
            <table className="w-full min-w-[760px] text-[13.5px]" data-testid="table-history-ranking">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, "text-right w-12")}>#</th>
                  <th scope="col" className={cn(TH, "text-left")}>Colaborador</th>
                  <th scope="col" className={cn(TH, "text-right")}>Nota final</th>
                  <th scope="col" className={cn(TH, "text-left")}>Faixa</th>
                  <th scope="col" className={cn(TH, "text-right")} title="Eventos com nota / eventos participados">Eventos</th>
                  <th scope="col" className={cn(TH, "text-right")}>Faltas</th>
                  <th scope="col" className={cn(TH, "text-left")}>Elegibilidade</th>
                  <th scope="col" className={cn(TH, "text-right")}>{final ? "Bônus" : "Bônus projetado"}</th>
                  <th scope="col" className={cn(TH, "text-left")}>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const pay = payOf(r);
                  return (
                    <tr key={r.employeeId} data-testid={`row-history-${r.employeeId}`} className="transition-colors duration-150 hover:bg-secondary/40">
                      <td className={cn(TD, "text-right font-condensed text-[17px] font-black tabular-nums text-muted-foreground")}>{r.position}</td>
                      <td className={TD}>
                        <span className="font-semibold">{r.employeeName}</span>
                        {!r.employeeActive && <Chip className="ml-2 h-5 text-[11px]">Desligado</Chip>}
                      </td>
                      <td className={cn(TD, "text-right font-condensed text-[19px] font-black tabular-nums")}>{n1(r.finalResult)}</td>
                      <td className={TD}><span className="inline-flex items-center gap-2 whitespace-nowrap"><Swatch color={r.platoonColor} />{r.platoon ?? "—"}</span></td>
                      <td className={cn(TD, "text-right tabular-nums")} title="Eventos com nota / eventos participados">{r.eventsCount}<span className="text-muted-foreground">/{r.participatedEventsCount}</span></td>
                      <td className={cn(TD, "text-right tabular-nums")}>{r.totalAbsences}</td>
                      <td className={cn(TD, "max-w-[260px]")}><Eligibility r={r} /></td>
                      <td className={cn(TD, "text-right tabular-nums whitespace-nowrap")}>
                        <span className="font-semibold">{brl(r.bonusValue)}</span>
                        {r.extraBonusValue > 0 && <span className="block text-[12px] text-muted-foreground">inclui {brl(r.extraBonusValue)} de extras</span>}
                      </td>
                      <td className={cn(TD, "hidden lg:table-cell")}><Chip tone={pay.tone}>{pay.label}</Chip></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
