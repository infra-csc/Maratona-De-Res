import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { useGetCycleHistory, getGetCycleHistoryQueryKey, type CycleHistory, type CycleHistoryEntry } from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, CalendarRange, Download, Search, Trophy } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, StatusBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { fmtDate } from "@/lib/utils";
import { CycleStatus, CycleStatTiles, cyclePeriod, apiErrorMessage, brl, n1 } from "./cycles";

const BONUS_STATUS: Record<string, { label: string; variant: "ok" | "warn" | "danger" | "info" | "neutral" }> = {
  projected: { label: "Projetado", variant: "neutral" },
  approved: { label: "Aprovado", variant: "info" },
  scheduled: { label: "Agendado", variant: "info" },
  paid: { label: "Pago", variant: "ok" },
  blocked: { label: "Bloqueado", variant: "danger" },
  not_eligible: { label: "Não elegível", variant: "neutral" },
};

const TH = "py-2 px-3 font-bold uppercase text-[11px] whitespace-nowrap";
const thStyle = { fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" } as const;
const tdStyle = { borderBottom: "1px solid var(--border)" } as const;

function Swatch({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: color ?? "var(--muted)", border: "1px solid var(--border)" }} />;
}

function Section({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <header className="px-5 pt-4 pb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>{title}</h2>
          {subtitle && <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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

export default function CycleHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, isError, error } = useGetCycleHistory(id, {
    query: { queryKey: getGetCycleHistoryQueryKey(id), enabled: valid, staleTime: 30_000 },
  });

  if (!valid) {
    return <div className="px-6 py-10"><EmptyState icon={AlertTriangle} title="Ciclo inválido" action={<Button variant="outline" asChild><Link href="/cycles">Ver todos os ciclos</Link></Button>} /></div>;
  }
  if (isLoading) return <div className="px-6 py-6"><LoadingState lines={8} withHeader label="Carregando histórico do ciclo" /></div>;
  if (isError || !data) {
    return (
      <div className="px-6 py-10">
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar o histórico" description={apiErrorMessage(error, "Tente novamente em instantes.")}
          action={<Button variant="outline" asChild><Link href="/cycles">Ver todos os ciclos</Link></Button>} />
      </div>
    );
  }
  return <HistoryView history={data} />;
}

function HistoryView({ history }: { history: CycleHistory }) {
  const { cycle, ranking, events } = history;
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim().toLocaleLowerCase("pt-BR");
    return s ? ranking.filter(r => r.employeeName.toLocaleLowerCase("pt-BR").includes(s)) : ranking;
  }, [ranking, search]);

  // Distribuição por faixa (a faixa é gravada no resultado do ciclo, então
  // reflete as regras que valiam quando o ciclo foi calculado).
  const faixas = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; count: number; eligible: number; bonus: number; top: number }>();
    for (const r of ranking) {
      const key = r.platoon ?? "Sem faixa";
      const f = map.get(key) ?? { name: key, color: r.platoonColor ?? null, count: 0, eligible: 0, bonus: 0, top: -1 };
      f.count += 1;
      if (r.eligible) { f.eligible += 1; f.bonus += r.bonusValue; }
      f.top = Math.max(f.top, r.finalResult);
      map.set(key, f);
    }
    return [...map.values()].sort((a, b) => b.top - a.top);
  }, [ranking]);
  const maxCount = Math.max(1, ...faixas.map(f => f.count));

  return (
    <div className="px-6 py-6 space-y-6" style={{ fontFamily: BODY }}>
      <Link href="/cycles" className="inline-flex items-center gap-1.5 text-[13px] font-semibold hover:underline underline-offset-2" style={{ color: "var(--muted-foreground)" }}>
        <ArrowLeft size={14} aria-hidden /> Todos os ciclos
      </Link>
      <PageHeader
        eyebrow={<span className="inline-flex items-center gap-2">Histórico do ciclo <CycleStatus cycle={cycle} /></span>}
        title={cycle.name}
        description={
          cycle.isCurrent && cycle.status !== "closed"
            ? `${cyclePeriod(cycle)}. Este é o ciclo atual: os números mudam conforme os eventos são confirmados.`
            : `${cyclePeriod(cycle)}. Resultado guardado como ficou no fechamento; somente consulta.`
        }
      />

      <CycleStatTiles cycle={cycle} />

      {faixas.length > 0 && (
        <Section title="Distribuição por faixa" subtitle="Quantos colaboradores terminaram em cada faixa e o bônus somado dos elegíveis.">
          <ul className="px-5 pb-4 space-y-2" data-testid="list-faixas">
            {faixas.map(f => (
              <li key={f.name} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3 text-[13px]">
                <span className="flex items-center gap-2 min-w-0"><Swatch color={f.color} /><span className="truncate font-semibold">{f.name}</span></span>
                <span className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }} aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(f.count / maxCount) * 100}%`, backgroundColor: "var(--viz-series-1)" }} />
                </span>
                <span className="tabular-nums whitespace-nowrap text-right">
                  <strong>{f.count}</strong> <span style={{ color: "var(--muted-foreground)" }}>· {brl(f.bonus)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Ranking final"
        subtitle="Nota final, faixa e bônus de cada colaborador neste ciclo. Quem foi desligado depois continua aqui."
        actions={ranking.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar colaborador" aria-label="Buscar colaborador" className="pl-8 h-9 w-56" data-testid="input-search-history" />
            </div>
            <Button variant="outline" size="sm" className="h-9" onClick={() => exportRankingCsv(history)} data-testid="button-export-history">
              <Download size={14} aria-hidden /> Exportar CSV
            </Button>
          </div>
        )}
      >
        {ranking.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState compact icon={Trophy} title="Sem resultados neste ciclo" description="O ranking aparece depois que há eventos com resultados confirmados e o ciclo é calculado." /></div>
        ) : filtered.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState compact icon={Search} title="Ninguém encontrado" description="Confira o nome digitado na busca." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-[13px]" data-testid="table-history-ranking">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} text-right w-12`} style={thStyle}>#</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Colaborador</th>
                  <th scope="col" className={`${TH} text-right`} style={thStyle}>Nota final</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Faixa</th>
                  <th scope="col" className={`${TH} text-right`} style={thStyle}>Eventos</th>
                  <th scope="col" className={`${TH} text-right`} style={thStyle}>Faltas</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Elegível</th>
                  <th scope="col" className={`${TH} text-right`} style={thStyle}>Bônus</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: CycleHistoryEntry) => {
                  const pay = BONUS_STATUS[r.bonusStatus] ?? { label: r.bonusStatus, variant: "neutral" as const };
                  return (
                    <tr key={r.employeeId} data-testid={`row-history-${r.employeeId}`}>
                      <td className="py-2 px-3 text-right tabular-nums font-bold" style={tdStyle}>{r.position}</td>
                      <td className="py-2 px-3" style={tdStyle}>
                        <span className="font-semibold">{r.employeeName}</span>
                        {!r.employeeActive && <StatusBadge variant="neutral" size="sm" label="Desligado" className="ml-2" />}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-bold" style={tdStyle}>{n1(r.finalResult)}</td>
                      <td className="py-2 px-3" style={tdStyle}>
                        <span className="inline-flex items-center gap-2 whitespace-nowrap"><Swatch color={r.platoonColor} />{r.platoon ?? "—"}</span>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums" style={tdStyle} title="Eventos com nota / eventos participados">{r.eventsCount}/{r.participatedEventsCount}</td>
                      <td className="py-2 px-3 text-right tabular-nums" style={tdStyle}>{r.totalAbsences}</td>
                      <td className="py-2 px-3" style={tdStyle}>
                        {r.eligible
                          ? <StatusBadge variant="ok" size="sm" label="Sim" />
                          : <span className="inline-flex flex-col items-start gap-0.5"><StatusBadge variant="warn" size="sm" label="Não" />{r.eligibilityReason && <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{r.eligibilityReason}</span>}</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap" style={tdStyle}>
                        {brl(r.bonusValue)}
                        {r.extraBonusValue > 0 && <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>inclui {brl(r.extraBonusValue)} de extras</span>}
                      </td>
                      <td className="py-2 px-3" style={tdStyle}><StatusBadge variant={pay.variant} size="sm" label={pay.label} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Eventos do ciclo" subtitle={`${events.length} evento(s). Só os confirmados entram na nota.`}>
        {events.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState compact icon={CalendarRange} title="Nenhum evento neste ciclo" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]" data-testid="table-history-events">
              <thead>
                <tr>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Data</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Evento</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Cliente</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Local</th>
                  <th scope="col" className={`${TH} text-left`} style={thStyle}>Resultados</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id}>
                    <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={tdStyle}>
                      {fmtDate(e.startDate)}{e.endDate && e.endDate !== e.startDate ? ` a ${fmtDate(e.endDate)}` : ""}
                      <span className="sr-only"> de {e.startDate.slice(0, 4)}</span>
                    </td>
                    <td className="py-2 px-3" style={tdStyle}>
                      <Link href={`/events/${e.id}`} className="font-semibold hover:underline underline-offset-2">{e.name}</Link>
                      {e.isHistorical && <span className="ml-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>importado</span>}
                    </td>
                    <td className="py-2 px-3" style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{e.clientName ?? "—"}</td>
                    <td className="py-2 px-3 whitespace-nowrap" style={{ ...tdStyle, color: "var(--muted-foreground)" }}>{[e.city, e.state].filter(Boolean).join("/") || "—"}</td>
                    <td className="py-2 px-3" style={tdStyle}>
                      {e.resultsConfirmed
                        ? <StatusBadge variant="ok" size="sm" label="Confirmados" />
                        : <StatusBadge variant="warn" size="sm" label={e.status === "open" ? "Evento aberto" : "Não confirmados"} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
