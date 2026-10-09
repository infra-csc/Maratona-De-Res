import { useMemo } from "react";
import { Link, useParams } from "wouter";
import { useGetCycleHistory, getGetCycleHistoryQueryKey, useListCycles, getListCyclesQueryKey, type CycleHistory } from "@workspace/api-client-react";
import { AlertTriangle, ArrowLeft, Eye, Layers, LockKeyhole, RefreshCw } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Panel } from "./dashboard/dashboard-ui";
import { Bone, CycleStatusChip, EmptyBlock, ErrorBlock, Eyebrow, FOCUS_RING, PeriodTrack, btnSecondary, brl, surfaceCls } from "./cycles/cycles-ui";
import { CycleRules, CycleStatBand } from "./cycles/cycle-overview";
import { HistoryRanking, Swatch } from "./cycles/history-ranking";
import { HistoryEvents } from "./cycles/history-events";

/** Topo fixo: voltar para a lista, nome do ciclo (o único h1) e a situação. */
function HistoryHeader({ cycle }: { cycle?: CycleHistory["cycle"] }) {
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3">
      <Link href="/cycles" aria-label="Voltar para todos os ciclos" title="Todos os ciclos"
        className={cn("inline-flex items-center justify-center shrink-0 w-11 h-11 lg:w-9 lg:h-9 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
        <ArrowLeft size={18} aria-hidden />
      </Link>
      <div className="min-w-0 flex-1 flex items-center gap-3">
        <div className="min-w-0">
          <Eyebrow as="span" className="hidden sm:block text-[11px] mb-1">Histórico do ciclo</Eyebrow>
          <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[22px] sm:text-[24px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">
            {cycle ? cycle.name : "Histórico do ciclo"}
          </h1>
        </div>
        {cycle && <CycleStatusChip cycle={cycle} className="shrink-0 hidden sm:inline-flex" />}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div role="status" aria-label="Carregando histórico do ciclo" className="space-y-4">
      <div className={cn(surfaceCls, "p-4 lg:p-6 space-y-5")}>
        <Bone className="h-2 w-full max-w-[720px]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-4 w-32" /></div>)}</div>
      </div>
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-5 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 5 }, (_, i) => <div key={i} className={cn("bg-card px-5 py-4 space-y-3", i === 0 && "col-span-2 lg:col-span-1")}><Bone className="h-3 w-24" /><Bone className="h-8 w-20" /></div>)}
      </div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center gap-6 px-5 py-3.5"><Bone className="h-4 w-6" /><Bone className="h-4 w-44" /><Bone className="h-5 w-12 ml-auto" /></div>)}
      </div>
    </div>
  );
}

export default function CycleHistoryPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, isError, refetch } = useGetCycleHistory(id, {
    query: { queryKey: getGetCycleHistoryQueryKey(id), enabled: valid, staleTime: 30_000 },
  });

  const back = <Link href="/cycles" className={btnSecondary}>Ver todos os ciclos</Link>;
  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <HistoryHeader cycle={data?.cycle} />
      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {!valid ? (
          <div className={surfaceCls}><EmptyBlock icon={AlertTriangle} title="Ciclo inválido" action={back}>O endereço não aponta para um ciclo.</EmptyBlock></div>
        ) : isLoading ? <HistorySkeleton /> : isError || !data ? (
          <ErrorBlock title="Não foi possível carregar o histórico" onRetry={() => { void refetch(); }} />
        ) : (
          <HistoryView history={data} />
        )}
      </div>
    </div>
  );
}

function HistoryView({ history }: { history: CycleHistory }) {
  const { ranking } = history;
  // O histórico não traz o mínimo que vale de fato (regra geral); a lista de
  // ciclos traz — usa o mesmo dado (cache compartilhado com a tela Ciclos).
  const { data: list } = useListCycles({ query: { queryKey: getListCyclesQueryKey(), staleTime: 30_000 } });
  const fromList = list?.find(c => c.id === history.cycle.id);
  const cycle = history.cycle.effectiveMinEvents == null && fromList?.effectiveMinEvents != null
    ? { ...history.cycle, effectiveMinEvents: fromList.effectiveMinEvents } : history.cycle;
  const final = cycle.status === "closed";
  const live = cycle.isCurrent && !final;

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
    <>
      <section aria-label="Período e regras do ciclo" className={cn(surfaceCls, "overflow-hidden")}>
        <div className="px-4 pt-4 pb-5 lg:px-6 lg:pt-5 grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,720px)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0">
            <CycleStatusChip cycle={cycle} className="sm:hidden mb-3" />
            <PeriodTrack start={cycle.startDate} end={cycle.endDate} closed={final} />
          </div>
          <p className={cn("flex items-start gap-2 text-[13.5px] leading-snug", live ? "text-foreground" : "text-muted-foreground")} data-testid="history-mode">
            {live
              ? <><RefreshCw size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--status-info-text)]" /><span><b className="font-semibold">Ciclo atual, ainda aberto:</b> os números mudam conforme os eventos são confirmados.</span></>
              : final
                ? <><LockKeyhole size={14} aria-hidden className="mt-0.5 shrink-0" /><span>Resultado guardado como ficou no fechamento. <b className="font-semibold text-foreground">Somente consulta.</b></span></>
                : <><Eye size={14} aria-hidden className="mt-0.5 shrink-0" /><span>Ciclo aberto que não é o atual: ainda não foi fechado.</span></>}
          </p>
        </div>
        <div className="border-t border-border px-4 py-4 lg:px-6 lg:py-5"><CycleRules cycle={cycle} /></div>
      </section>

      <CycleStatBand cycle={cycle} />

      {faixas.length > 0 && (
        <Panel labelId="history-faixas-title" icon={Layers} title="Distribuição por faixa" testId="history-faixas"
          sub={final ? "Quantos colaboradores terminaram em cada faixa e o bônus somado dos elegíveis." : "Quantos estão em cada faixa agora e o bônus projetado dos elegíveis (muda até o fechamento)."}>
          <ul className="px-4 pb-4 lg:px-5 lg:pb-5 space-y-2.5" data-testid="list-faixas">
            {faixas.map(f => (
              <li key={f.name} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] sm:grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-[13.5px]">
                <span className="flex items-center gap-2 min-w-0"><Swatch color={f.color} /><span className="truncate font-semibold">{f.name}</span></span>
                <span className="h-2 rounded-full overflow-hidden bg-secondary" aria-hidden>
                  <span className="block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${(f.count / maxCount) * 100}%`, backgroundColor: f.color ?? "var(--viz-series-1)" }} />
                </span>
                <span className="tabular-nums whitespace-nowrap text-right">
                  <b className="font-semibold">{plural(f.count, "pessoa", "pessoas")}</b> <span className="text-muted-foreground">· {brl(f.bonus)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <HistoryRanking history={history} />
      <HistoryEvents history={history} />
    </>
  );
}
