// Linha do tempo das notas (admin e RH): o que mudou em cada dia, para quem e
// por quê. Visão principal = todos os colaboradores, por dia, agrupado por
// acontecimento; filtra por colaborador, evento, período, tipo, direção, quem
// fez e mudança de faixa. Outras telas trazem atalhos já filtrados (?colaborador,
// ?evento…). As peças visuais vivem ao lado: topo fixo, filtros, panorama,
// gráfico de atividade, painel do colaborador e o cartão do acontecimento.
//
// Ordem: agrupa TODAS as entradas em acontecimentos (uma vez por resposta da
// API) e só depois filtra — o título do cartão mantém o critério e quem fez.
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useGetScoreTimeline, getGetScoreTimelineQueryKey } from "@workspace/api-client-react";
import { History, SearchX } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Bone, EmptyBlock, ErrorBlock, btnSecondary, surfaceCls } from "./tl-ui";
import { TimelineHeader } from "./timeline-header";
import { FilterSummary, TimelineFilters } from "./timeline-filters";
import { ActivityPanel, Panorama, type Summary } from "./activity-panel";
import { OutOfRankingPanel, PersonPanel } from "./person-panel";
import { DayHeader } from "./day-header";
import { HappeningCard } from "./happening-card";
import { EMPTY, PRESETS, TYPES, presetOf, readFilters, writeFilters, type Filters, type PresetKey } from "./filters";
import { deltaOf, filterHappenings, groupByDay, moveOf, score, tally, toHappenings, type Happening } from "./describe";

const PAGE_DAYS = 15;

function TimelineSkeleton() {
  return (
    <div role="status" aria-label="Montando a linha do tempo" className="space-y-5">
      <div className={cn(surfaceCls, "grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 7 }, (_, i) => <div key={i} className={cn("bg-card px-4 py-4 space-y-3", i === 6 && "col-span-2 lg:col-span-1")}><Bone className="h-3 w-20" /><Bone className="h-8 w-12" /><Bone className="h-3 w-28 max-w-full" /></div>)}
      </div>
      <div className={cn(surfaceCls, "p-5 space-y-4")}><Bone className="h-5 w-40" /><Bone className="h-3 w-72 max-w-full" /><Bone className="h-[200px] w-full" /></div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="grid grid-cols-[32px_1fr] md:grid-cols-[44px_32px_1fr] gap-3">
          <Bone className="hidden md:block h-4 w-10 mt-2" /><Bone className="h-8 w-8 rounded-full" />
          <div className={cn(surfaceCls, "rounded-xl p-4 space-y-3")}><Bone className="h-4 w-56 max-w-full" /><Bone className="h-3 w-40" /><Bone className="h-9 w-full" /></div>
        </div>
      ))}
    </div>
  );
}

export default function ScoreTimelinePage() {
  const [f, setF] = useState<Filters>(readFilters);
  useEffect(() => writeFilters(f), [f]);
  const [shownDays, setShownDays] = useState(PAGE_DAYS);
  const patch = (p: Partial<Filters>) => { setF(prev => ({ ...prev, ...p })); setShownDays(PAGE_DAYS); };
  // A busca digitada não trava a digitação: a lista acompanha logo em seguida.
  const q = useDeferredValue(f.q);

  const params = f.employee ? { employeeId: f.employee } : {};
  const query = useGetScoreTimeline(params, { query: { queryKey: getGetScoreTimelineQueryKey(params), staleTime: 30_000 } });
  const data = query.data;

  const platoonColor = (name: string | null | undefined) => (name ? data?.platoons.find(p => p.name === name)?.color ?? null : null);
  const person = f.employee ? data?.people.find(p => p.employeeId === f.employee) ?? null : null;
  /**
   * Quem está filtrado. A API nova manda `subject` (inclusive para quem está
   * fora do ranking); na antiga, monta pelo que dá: o nome que aparecer nas
   * entradas e "fora do ciclo" se a última mudança dele foi a retirada.
   */
  const subject = useMemo(() => {
    if (!f.employee || !data) return null;
    if (data.subject && data.subject.employeeId === f.employee) return data.subject;
    const own = data.entries.filter(e => e.employeeId === f.employee && e.kind !== "info");
    const name = person?.name ?? own.find(e => e.employeeName)?.employeeName ?? `Colaborador nº ${f.employee}`;
    const last = [...own].sort((a, b) => a.at.localeCompare(b.at)).pop();
    const excluded = !person && (last?.type === "cycle_excluded");
    return { employeeId: f.employee, name, functionName: person?.functionName ?? null, inRanking: !!person, excluded, excludedReason: excluded ? last?.reason ?? null : null };
  }, [data, f.employee, person]);

  // Entradas com o nome de quem está filtrado mesmo fora do ranking (a API
  // antiga não preenchia employeeName nas linhas remontadas de quem saiu do ciclo).
  const entries = useMemo(() => {
    const list = data?.entries ?? [];
    if (!subject) return list;
    return list.map(e => (e.employeeId === subject.employeeId && !e.employeeName ? { ...e, employeeName: subject.name } : e));
  }, [data, subject]);
  /** Nome de quem está filtrado (nunca vazio). */
  const filteredName = !f.employee ? null : person?.name ?? subject?.name ?? `Colaborador nº ${f.employee}`;

  const all = useMemo(() => toHappenings(entries), [entries]);

  // Opções dos filtros a partir dos dados do ciclo.
  const { events, authors } = useMemo(() => {
    const ev = new Map<number, string>(); const by = new Set<string>();
    for (const e of entries) { if (e.eventId != null && e.eventName) ev.set(e.eventId, e.eventName); if (e.by) by.add(e.by); }
    return {
      events: [...ev.entries()].map(([id, name]) => ({ id, label: name })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      authors: [...by].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [entries]);

  const pickerPeople = useMemo(() => {
    const opts = (data?.people ?? []).map(p => ({ id: p.employeeId, label: p.name, hint: score(p.finalResult), color: p.platoonColor ?? data?.platoons.find(x => x.name === p.platoon)?.color ?? null }));
    if (subject && !opts.some(o => o.id === subject.employeeId)) {
      opts.unshift({ id: subject.employeeId, label: subject.name, hint: subject.excluded ? "fora do ciclo" : "sem nota", color: null });
    }
    return opts;
  }, [data, subject]);

  // Todos os filtros menos o período: alimenta o gráfico "Atividade por dia"
  // (clicar num dia não pode sumir com os outros dias do gráfico).
  const cats = TYPES.find(t => t.value === f.type)?.cats;
  const base = useMemo(
    () => filterHappenings(all, { cats, event: f.event, by: f.by, dir: f.dir, faixa: f.faixa, q }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, f.type, f.event, f.by, f.dir, f.faixa, q],
  );
  const happenings = useMemo(() => (f.from || f.to ? filterHappenings(base, { from: f.from, to: f.to }) : base), [base, f.from, f.to]);
  const days = useMemo(() => groupByDay(happenings), [happenings]);
  const activityDays = useMemo(() => groupByDay(base), [base]);
  const stats = useMemo(() => summarize(happenings), [happenings]);
  const everMoved = useMemo(() => all.some(h => h.people.some(p => { const m = moveOf(p); return m != null && m !== "same"; })), [all]);
  const activityHas = activityDays.some(d => d.ups + d.downs + d.entered + d.left > 0);

  const hasFilters = !!(f.event || f.type !== "todos" || f.dir !== "todas" || f.by || f.from || f.to || f.faixa || f.q);
  const clearFilters = () => patch({ ...EMPTY });
  const preset = presetOf(f);
  const onPreset = (k: PresetKey) => { const pr = PRESETS.find(x => x.key === k); patch(pr ? { from: pr.from(), to: pr.to() } : { from: "", to: "" }); };
  const outOfRanking = !!f.employee && !!data && !person;
  const otherFilters = !!(f.event || f.type !== "todos" || f.by || f.dir !== "todas" || f.faixa || f.q);
  const activityHint = `Quantas notas subiram e caíram em cada dia${filteredName ? ` (${filteredName})` : ""}${otherFilters ? ", com estes filtros" : ""}${f.from || f.to ? " — o período escolhido fica em destaque" : ""}. Toque num dia para ver só ele.`;
  const toTop = () => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduce ? "auto" : "smooth";
    window.scrollTo({ top: 0, behavior });
    document.querySelector("main")?.scrollTo({ top: 0, behavior });
  };

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <TimelineHeader cycleName={data?.cycle.name ?? null} preset={preset} onPreset={onPreset} />

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        <div className="space-y-2">
          <TimelineFilters f={f} patch={patch} people={pickerPeople} events={events} authors={authors}
            preset={preset} onPreset={onPreset} filteredName={filteredName} />
          {query.isLoading ? <Bone className="h-4 w-56 my-2" /> : data && (all.length > 0 || hasFilters || !!f.employee) && (
            <FilterSummary happenings={happenings.length} days={days.length} filtered={hasFilters || !!f.employee}
              suffix={hasFilters ? " com estes filtros" : f.employee ? ` de ${filteredName}` : ""}
              recordedSince={data.recordedSince} onClear={() => patch({ ...EMPTY, employee: null })} />
          )}
        </div>

        {query.isLoading ? <TimelineSkeleton /> : query.isError || !data ? (
          <ErrorBlock title="Não foi possível carregar a linha do tempo" onRetry={() => { void query.refetch(); }} />
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", query.isFetching && "opacity-80")}>
            {person && (
              <PersonPanel person={person} platoonColor={person.platoonColor ?? platoonColor(person.platoon)} entries={entries} platoons={data.platoons}
                onClear={() => patch({ employee: null })} />
            )}
            {outOfRanking && (
              <OutOfRankingPanel name={filteredName ?? "Colaborador"} functionName={subject?.functionName} excluded={!!subject?.excluded}
                excludedReason={subject?.excludedReason} entries={entries} platoons={data.platoons} onClear={() => patch({ employee: null })} />
            )}

            {/* Sem nada na tela, os números zerados só atrapalham; o gráfico fica
                se ainda tiver outro dia para escolher (filtro de período). */}
            {happenings.length > 0 && <Panorama stats={stats} dir={f.dir} faixa={f.faixa} onDir={dir => patch({ dir })} onFaixa={faixa => patch({ faixa })} />}
            {(happenings.length > 0 || activityHas) && (
              <>
                <ActivityPanel days={activityDays} from={f.from} to={f.to} stats={stats} filteredName={filteredName} hint={activityHint}
                  emptyText={activityHas ? null : everMoved ? "Nenhuma nota subiu ou caiu com estes filtros." : "Nenhuma nota mudou ainda neste ciclo."}
                  onPick={k => patch(f.from === k && f.to === k ? { from: "", to: "" } : { from: k, to: k })} />
              </>
            )}

            {days.length === 0 && outOfRanking && !hasFilters ? null : days.length === 0 ? (
              <div className={surfaceCls}>
                {hasFilters ? (
                  <EmptyBlock icon={SearchX} title="Nada com estes filtros" testId="timeline-no-results"
                    action={<button type="button" onClick={clearFilters} className={btnSecondary}>Limpar filtros</button>}>
                    Amplie o período, troque o tipo ou limpe a busca.
                  </EmptyBlock>
                ) : (
                  <EmptyBlock icon={History} testId="timeline-empty"
                    title={f.employee ? `Nenhuma mudança para ${filteredName} neste ciclo` : "Ainda não há mudanças neste ciclo"}>
                    Quando um evento entrar na nota, houver falta, mérito ou publicação de calibração, aparece aqui — com quem fez, o antes e o depois.
                  </EmptyBlock>
                )}
              </div>
            ) : (
              <div className="space-y-6" data-testid="timeline-days">
                {days.slice(0, shownDays).map(d => (
                  <section key={d.key} aria-labelledby={`tl-day-${d.key}`}>
                    <DayHeader d={d} />
                    <ol>
                      {d.happenings.map(h => (
                        <HappeningCard key={h.id} h={h} focusPerson={!!f.employee} platoonColor={platoonColor}
                          onPickPerson={id => { patch({ employee: id }); toTop(); }} />
                      ))}
                    </ol>
                  </section>
                ))}
                {days.length > shownDays && (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <button type="button" onClick={() => setShownDays(n => n + PAGE_DAYS)} className={btnSecondary} data-testid="button-more-days">
                      Ver mais {plural(Math.min(PAGE_DAYS, days.length - shownDays), "dia", "dias")}
                    </button>
                    <p className="text-[12.5px] text-muted-foreground tabular-nums">Mostrando {shownDays.toLocaleString("pt-BR")} de {plural(days.length, "dia", "dias")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function summarize(happenings: Happening[]): Summary {
  const rows = happenings.flatMap(h => h.people);
  type Top = { e: (typeof rows)[number]; d: number };
  let topUp = null as Top | null;
  let topDown = null as Top | null;
  for (const e of rows) {
    if (moveOf(e) !== "up" && moveOf(e) !== "down") continue;
    const d = deltaOf(e) ?? 0;
    if (d > 0 && (!topUp || d > topUp.d)) topUp = { e, d };
    if (d < 0 && (!topDown || d < topDown.d)) topDown = { e, d };
  }
  return { ...tally(rows), topUp, topDown };
}
