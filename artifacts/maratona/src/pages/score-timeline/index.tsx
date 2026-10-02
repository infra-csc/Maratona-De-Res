import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { useGetScoreTimeline, getGetScoreTimelineQueryKey } from "@workspace/api-client-react";
import { Check, ChevronsUpDown, History, Search, SearchX, UserMinus, UserX, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, LoadingState } from "@/components/shared";
import { BODY, CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { TimelineChart } from "./timeline-chart";
import { ActivityChart } from "./activity-chart";
import { HappeningCard, FaixaChip } from "./happening-card";
import {
  brl, dayKey, dayTitle, daysAgoKey, deltaOf, filterHappenings, groupByDay, moveOf, score, shortDay, signed, tally, todayKey, toHappenings,
  type Category, type Direction, type Happening,
} from "./describe";

// ── Filtros na URL — atalhos de outras telas chegam já filtrados ───────────
// /linha-do-tempo?colaborador=12&evento=40&tipo=calibracao&de=2026-09-01&ate=2026-09-30&direcao=queda&quem=Renata&faixa=1&q=…
type TypeFilter = "todos" | "eventos" | "lancamentos" | "calibracao" | "outros";
const TYPES: { value: TypeFilter; label: string; cats?: Category[] }[] = [
  { value: "todos", label: "Tudo" },
  { value: "eventos", label: "Eventos", cats: ["event", "confirm"] },
  { value: "lancamentos", label: "Faltas e méritos", cats: ["penalty", "merit"] },
  { value: "calibracao", label: "Calibração e publicação", cats: ["calibration", "publish"] },
  { value: "outros", label: "Saída do ciclo e outros", cats: ["exclusion", "other"] },
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
interface Filters { employee: number | null; event: number | null; type: TypeFilter; dir: Direction; by: string; from: string; to: string; faixa: boolean; q: string }
const EMPTY: Omit<Filters, "employee"> = { event: null, type: "todos", dir: "todas", by: "", from: "", to: "", faixa: false, q: "" };

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const int = (k: string) => { const n = Number(p.get(k)); return Number.isInteger(n) && n > 0 ? n : null; };
  const type = p.get("tipo") as TypeFilter | null;
  const dir = p.get("direcao") as Direction | null;
  return {
    employee: int("colaborador"), event: int("evento"),
    type: TYPES.some(t => t.value === type) ? (type as TypeFilter) : "todos",
    dir: dir === "alta" || dir === "queda" ? dir : "todas",
    by: p.get("quem") ?? "",
    from: DATE_RE.test(p.get("de") ?? "") ? p.get("de")! : "",
    to: DATE_RE.test(p.get("ate") ?? "") ? p.get("ate")! : "",
    faixa: p.get("faixa") === "1",
    q: p.get("q") ?? "",
  };
}
function writeFilters(f: Filters) {
  const url = new URL(window.location.href);
  const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
  set("colaborador", f.employee ? String(f.employee) : ""); set("evento", f.event ? String(f.event) : "");
  set("tipo", f.type === "todos" ? "" : f.type); set("direcao", f.dir === "todas" ? "" : f.dir);
  set("quem", f.by); set("de", f.from); set("ate", f.to); set("faixa", f.faixa ? "1" : ""); set("q", f.q);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const PRESETS: { key: string; label: string; from: () => string; to: () => string }[] = [
  { key: "hoje", label: "Hoje", from: todayKey, to: todayKey },
  { key: "7", label: "7 dias", from: () => daysAgoKey(6), to: todayKey },
  { key: "30", label: "30 dias", from: () => daysAgoKey(29), to: todayKey },
];
const PAGE_DAYS = 15;

/**
 * Linha do tempo das notas (admin e RH): o que mudou em cada dia, para quem e
 * por quê. Visão principal = todos os colaboradores, por dia, agrupado por
 * acontecimento; filtra por colaborador, evento, período, tipo, direção, quem
 * fez e mudança de faixa. Outras telas trazem atalhos já filtrados.
 *
 * Ordem: agrupa TODAS as entradas em acontecimentos (uma vez por resposta da
 * API) e só depois filtra — o título do cartão mantém o critério e quem fez.
 */
export default function ScoreTimelinePage() {
  const [f, setF] = useState<Filters>(readFilters);
  useEffect(() => writeFilters(f), [f]);
  const patch = (p: Partial<Filters>) => { setF(prev => ({ ...prev, ...p })); setShownDays(PAGE_DAYS); };
  const [shownDays, setShownDays] = useState(PAGE_DAYS);
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
      events: [...ev.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
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
  const presetActive = PRESETS.find(p => f.from === p.from() && f.to === p.to())?.key ?? (f.from || f.to ? "custom" : "tudo");
  const outOfRanking = !!f.employee && !!data && !person;

  return (
    <div className="px-4 md:px-8 py-6 space-y-5 max-w-[1240px] mx-auto" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow={data?.cycle.name ?? "Ciclo atual"}
        title="Linha do tempo"
        description="O que mudou nas notas, dia a dia: eventos que entraram, faltas e méritos, calibrações e publicações — quem teve a nota alterada, o antes e o depois, a faixa e o bônus."
        actions={
          <div role="group" aria-label="Período" className="inline-flex rounded-lg p-1 gap-1" style={{ backgroundColor: "var(--secondary)" }}>
            {[{ key: "tudo", label: "Ciclo todo" }, ...PRESETS].map(p => {
              const active = presetActive === p.key;
              return (
                <button key={p.key} type="button" aria-pressed={active}
                  onClick={() => { const pr = PRESETS.find(x => x.key === p.key); patch(pr ? { from: pr.from(), to: pr.to() } : { from: "", to: "" }); }}
                  className="h-8 px-3 rounded-md text-[12px] font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: active ? "var(--card)" : "transparent", color: active ? "var(--foreground)" : "var(--muted-foreground)", boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : undefined }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        }
      />

      {/* ── Filtros ── */}
      <section aria-label="Filtros" className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="grid gap-3 grid-cols-2 xl:grid-cols-[1.3fr_1.3fr_1fr_0.85fr_0.85fr]">
          <Field label="Colaborador" htmlFor="tl-emp" className="col-span-2 sm:col-span-1">
            <SearchPicker id="tl-emp" placeholder="Todos os colaboradores" emptyText="Ninguém com esse nome." allLabel="Todos os colaboradores" clearLabel="Limpar colaborador"
              value={f.employee} fallbackLabel={filteredName} onChange={id => patch({ employee: id })} options={pickerPeople} />
          </Field>
          <Field label="Evento" htmlFor="tl-ev" className="col-span-2 sm:col-span-1">
            <SearchPicker id="tl-ev" placeholder="Todos os eventos" emptyText="Nenhum evento com esse nome." allLabel="Todos os eventos" clearLabel="Limpar evento"
              value={f.event} fallbackLabel={f.event ? `Evento nº ${f.event}` : null} onChange={id => patch({ event: id })} options={events.map(e => ({ id: e.id, label: e.name }))} />
          </Field>
          <Field label="Quem fez" htmlFor="tl-by" className="col-span-2 xl:col-span-1">
            <Select value={f.by || "all"} onValueChange={v => patch({ by: v === "all" ? "" : v })}>
              <SelectTrigger id="tl-by" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer pessoa</SelectItem>
                {authors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="De" htmlFor="tl-from"><Input id="tl-from" type="date" value={f.from} max={f.to || undefined} onChange={e => patch({ from: e.target.value })} className="h-10" /></Field>
          <Field label="Até" htmlFor="tl-to"><Input id="tl-to" type="date" value={f.to} min={f.from || undefined} onChange={e => patch({ to: e.target.value })} className="h-10" /></Field>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div role="group" aria-label="Tipo de acontecimento" className="flex flex-wrap gap-1.5">
            {TYPES.map(t => <Pill key={t.value} active={f.type === t.value} onClick={() => patch({ type: t.value })}>{t.label}</Pill>)}
          </div>
          <span aria-hidden className="hidden md:block h-6 w-px" style={{ backgroundColor: "var(--border)" }} />
          <div role="group" aria-label="Direção da mudança" className="flex flex-wrap gap-1.5">
            <Pill active={f.dir === "todas"} onClick={() => patch({ dir: "todas" })}>Subiu ou caiu</Pill>
            <Pill active={f.dir === "alta"} onClick={() => patch({ dir: "alta" })} tone="up" title="Nota maior que a anterior (quem entrou na nota agora não entra aqui)">▲ Subiu</Pill>
            <Pill active={f.dir === "queda"} onClick={() => patch({ dir: "queda" })} tone="down" title="Nota menor que a anterior (quem saiu do ciclo não entra aqui)">▼ Caiu</Pill>
          </div>
          <label htmlFor="tl-faixa" className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
            <Switch id="tl-faixa" checked={f.faixa} onCheckedChange={v => patch({ faixa: v })} /> Só mudança de faixa
          </label>
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <Input aria-label="Buscar" type="search" value={f.q} onChange={e => patch({ q: e.target.value })} placeholder="Buscar critério, motivo, pessoa…" className="h-9 pl-8" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          <span aria-live="polite">
            {data ? <><strong style={{ color: "var(--foreground)" }}>{happenings.length}</strong> {happenings.length === 1 ? "acontecimento" : "acontecimentos"} em <strong style={{ color: "var(--foreground)" }}>{days.length}</strong> {days.length === 1 ? "dia" : "dias"}{hasFilters || f.employee ? " com estes filtros" : ""}</> : " "}
            {data?.recordedSince && <> · registro exato desde {shortDay(dayKey(data.recordedSince))}, antes disso remontado</>}
          </span>
          {(hasFilters || f.employee) && (
            <button type="button" onClick={() => patch({ ...EMPTY, employee: null })} className="inline-flex items-center gap-1 font-semibold hover:underline">
              <X size={13} aria-hidden /> Limpar tudo
            </button>
          )}
        </div>
      </section>

      {query.isLoading ? (
        <LoadingState lines={8} withHeader label="Montando a linha do tempo" />
      ) : query.isError || !data ? (
        <EmptyState icon={SearchX} title="Não foi possível carregar a linha do tempo" description="Tente de novo em instantes." action={<Button variant="outline" onClick={() => query.refetch()}>Tentar de novo</Button>} />
      ) : (
        <>
          {/* ── Colaborador filtrado: situação e evolução ── */}
          {person && (
            <section aria-label={`Situação de ${person.name}`} className="grid gap-5 lg:grid-cols-[300px_1fr]">
              <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div>
                  <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{person.functionName ?? "Colaborador"}</p>
                  <h2 className="mt-1 text-[24px] font-black uppercase leading-none" style={{ fontFamily: CONDENSED }}>{person.name}</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Stat label="Nota final" value={score(person.finalResult)} big />
                  <div><p className="mb-1.5 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Faixa</p><FaixaChip name={person.platoon} color={person.platoonColor ?? platoonColor(person.platoon)} strong /></div>
                  <Stat label="Bônus projetado" value={brl(person.bonusValue)} />
                  <Stat label="Eventos" value={String(person.eventsCount)} detail={person.eligible ? "elegível" : "não elegível"} />
                </div>
              </div>
              <div className="rounded-2xl p-5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>Evolução da nota final</h2>
                <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>Degraus no momento de cada mudança. Linhas pontilhadas: começo de cada faixa.</p>
                <TimelineChart entries={entries} currentFinal={person.finalResult} platoons={data.platoons} name={person.name} height={240} />
              </div>
            </section>
          )}

          {/* ── Colaborador filtrado FORA do ranking: fora do ciclo ou sem nota ── */}
          {outOfRanking && (
            <section aria-label={`Situação de ${filteredName}`} className="grid gap-5 lg:grid-cols-[300px_1fr]">
              <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div>
                  <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{subject?.functionName ?? "Colaborador"}</p>
                  <h2 className="mt-1 text-[24px] font-black uppercase leading-none break-words" style={{ fontFamily: CONDENSED }}>{filteredName}</h2>
                </div>
                <div className="flex items-start gap-3 rounded-xl p-3" style={{ backgroundColor: subject?.excluded ? "var(--status-danger-bg)" : "var(--secondary)" }}>
                  {subject?.excluded
                    ? <UserMinus size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: DANGER_TEXT }} />
                    : <UserX size={18} aria-hidden className="mt-0.5 shrink-0" style={{ color: "var(--muted-foreground)" }} />}
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold" style={{ color: subject?.excluded ? DANGER_TEXT : "var(--foreground)" }}>
                      {subject?.excluded ? "Fora do ciclo" : "Sem nota no ciclo"}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug break-words" style={{ color: "var(--muted-foreground)" }}>
                      {subject?.excluded
                        ? (subject.excludedReason ? <>Motivo: “{subject.excludedReason}”. </> : "Tirado do ciclo pelo admin. ")
                        : "Ainda não tem evento com nota neste ciclo. "}
                      Sem nota, ranking e bônus agora.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl p-5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>Evolução da nota final</h2>
                {entries.some(e => e.kind !== "info" && e.finalAfter != null) ? (
                  <>
                    <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>A nota que teve no ciclo, até sair dele.</p>
                    <TimelineChart entries={entries} currentFinal={null} platoons={data.platoons} name={filteredName ?? "colaborador"} height={240} />
                  </>
                ) : (
                  <p className="text-[13px] py-10 text-center" style={{ color: "var(--muted-foreground)" }}>Nenhuma nota neste ciclo para desenhar.</p>
                )}
              </div>
            </section>
          )}

          {/* ── Atividade por dia + resumo ── */}
          <section aria-label="Atividade por dia" className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl p-5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>Atividade por dia</h2>
              <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>
                Quantas notas subiram e caíram em cada dia{filteredName ? ` (${filteredName})` : ""}{f.event || f.type !== "todos" || f.by || f.dir !== "todas" || f.faixa || f.q ? ", com estes filtros" : ""}{f.from || f.to ? " — o período escolhido fica em destaque" : ""}.
              </p>
              {activityHas ? (
                <ActivityChart days={activityDays} from={f.from} to={f.to}
                  onPick={k => patch(f.from === k && f.to === k ? { from: "", to: "" } : { from: k, to: k })} height={300} />
              ) : (
                <p className="text-[13px] py-8 text-center" style={{ color: "var(--muted-foreground)" }}>
                  {everMoved ? "Nenhuma nota subiu ou caiu com estes filtros." : "Nenhuma nota mudou ainda neste ciclo."}
                </p>
              )}
            </div>
            <ul className="grid gap-3 content-start grid-cols-2" aria-label="Resumo com os filtros">
              <Kpi label="Mudanças" value={String(stats.changes)} title="Cada mudança de uma pessoa: nota, faixa, bônus ou elegibilidade" />
              <Kpi label="Colaboradores" value={String(stats.people)} title="Pessoas com alguma mudança" />
              <Kpi label="Subiram" value={String(stats.ups)} color={GOOD_TEXT} />
              <Kpi label="Caíram" value={String(stats.downs)} color={DANGER_TEXT} />
              <Kpi label="Entraram na nota" value={String(stats.entered)} title="Sem nota antes e com nota depois (primeiro evento com nota, volta ao ciclo)" muted={stats.entered === 0} />
              <Kpi label="Saíram do ciclo" value={String(stats.left)} title="Com nota antes e sem nota depois (tirados do ciclo pelo admin)" muted={stats.left === 0} />
              <Kpi label="Mudanças de faixa" value={String(stats.faixas)} wide />
              {stats.topUp && <Kpi label="Maior alta" value={signed(stats.topUp.d)} color={GOOD_TEXT} detail={who(stats.topUp.e.employeeName ?? filteredName)} sub={shortDay(dayKey(stats.topUp.e.at))} />}
              {stats.topDown && <Kpi label="Maior queda" value={signed(stats.topDown.d)} color={DANGER_TEXT} detail={who(stats.topDown.e.employeeName ?? filteredName)} sub={shortDay(dayKey(stats.topDown.e.at))} />}
            </ul>
          </section>

          {/* ── Dia a dia ── */}
          {days.length === 0 ? (
            <EmptyState icon={History}
              title={hasFilters ? "Nada com estes filtros" : f.employee ? `Nenhuma mudança para ${filteredName} neste ciclo` : "Ainda não há mudanças neste ciclo"}
              description={hasFilters ? "Amplie o período ou limpe os filtros." : "Quando um evento entrar na nota, houver falta, mérito ou publicação de calibração, aparece aqui."}
              action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button> : undefined} />
          ) : (
            <div className="space-y-7">
              {days.slice(0, shownDays).map(d => (
                <section key={d.key} aria-labelledby={`tl-day-${d.key}`}>
                  <div className="sticky top-0 z-[3] -mx-2 px-2 py-2.5 mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" style={{ backgroundColor: "var(--background)" }}>
                    <h2 id={`tl-day-${d.key}`} className="text-[16px] font-black uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.03em" }}>{dayTitle(d.key)}</h2>
                    <p className="text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                      {d.people > 0 ? <><strong style={{ color: "var(--foreground)" }}>{d.people}</strong> {d.people === 1 ? "colaborador com mudança" : "colaboradores com mudança"}</> : "sem mudança de nota"}
                      {d.ups > 0 && <strong className="ml-2" style={{ color: GOOD_TEXT }} title={`${d.ups} subiram`}>▲ {d.ups}</strong>}
                      {d.downs > 0 && <strong className="ml-2" style={{ color: DANGER_TEXT }} title={`${d.downs} caíram`}>▼ {d.downs}</strong>}
                      {d.entered > 0 && <span className="ml-2">· {d.entered} {d.entered === 1 ? "entrou" : "entraram"} na nota</span>}
                      {d.left > 0 && <span className="ml-2">· {d.left} {d.left === 1 ? "saiu" : "saíram"} do ciclo</span>}
                      {d.faixas > 0 && <span className="ml-2">· {d.faixas} {d.faixas === 1 ? "mudança" : "mudanças"} de faixa</span>}
                    </p>
                  </div>
                  <ol>
                    {d.happenings.map(h => (
                      <HappeningCard key={h.id} h={h} focusPerson={!!f.employee} platoonColor={platoonColor}
                        onPickPerson={id => { patch({ employee: id }); window.scrollTo({ top: 0, behavior: "smooth" }); document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" }); }} />
                    ))}
                  </ol>
                </section>
              ))}
              {days.length > shownDays && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => setShownDays(n => n + PAGE_DAYS)}>Ver mais {Math.min(PAGE_DAYS, days.length - shownDays)} dias</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const who = (name: string | null | undefined) => name || "Colaborador";

function summarize(happenings: Happening[]) {
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

function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="block mb-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{label}</label>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children, tone, title }: { active: boolean; onClick: () => void; children: ReactNode; tone?: "up" | "down"; title?: string }) {
  const activeColor = tone === "up" ? "var(--status-ok-bg)" : tone === "down" ? "var(--status-danger-bg)" : "var(--primary)";
  const activeText = tone === "up" ? GOOD_TEXT : tone === "down" ? DANGER_TEXT : "var(--primary-foreground)";
  return (
    <button type="button" aria-pressed={active} onClick={onClick} title={title}
      className="h-8 px-3 rounded-full text-[12px] font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: active ? activeColor : "var(--secondary)", color: active ? activeText : "var(--muted-foreground)" }}>
      {children}
    </button>
  );
}

function Stat({ label, value, detail, big }: { label: string; value: string; detail?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{label}</p>
      <p className={`mt-1 font-black leading-none tabular-nums ${big ? "text-[40px]" : "text-[22px]"}`} style={{ fontFamily: CONDENSED }}>{value}</p>
      {detail && <p className="mt-1 text-[12px]" style={{ color: "var(--muted-foreground)" }}>{detail}</p>}
    </div>
  );
}

function Kpi({ label, value, detail, sub, color, wide, title, muted }: { label: string; value: string; detail?: string; sub?: string; color?: string; wide?: boolean; title?: string; muted?: boolean }) {
  return (
    <li className={`rounded-2xl px-4 py-3 min-w-0 ${wide ? "col-span-2" : ""}`} title={title} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-bold uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{label}</p>
      <p className="mt-0.5 text-[26px] font-black leading-none tabular-nums" style={{ fontFamily: CONDENSED, color: muted ? "var(--muted-foreground)" : color ?? "var(--foreground)" }}>{value}</p>
      {detail && <p className="mt-1 text-[12px] font-semibold truncate" title={detail}>{detail}</p>}
      {sub && <p className="text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{sub}</p>}
    </li>
  );
}

/** Combobox com busca (colaborador / evento); "Todos" limpa o filtro. O X de
 *  limpar é um botão IRMÃO do gatilho (nada de botão dentro de botão). */
function SearchPicker({ id, value, onChange, options, placeholder, emptyText, allLabel, clearLabel, fallbackLabel }: {
  id: string; value: number | null; onChange: (id: number | null) => void;
  options: { id: number; label: string; hint?: string; color?: string | null }[];
  placeholder: string; emptyText: string; allLabel: string; clearLabel: string;
  /** Rótulo quando o valor não está nas opções (ex.: colaborador fora do ranking, API antiga). */
  fallbackLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.id === value);
  const label = current?.label ?? (value != null ? fallbackLabel ?? null : null);
  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button id={id} type="button" role="combobox" aria-expanded={open}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-md pl-3 pr-10 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--input)", color: label ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: label ? 600 : 400 }}>
            <span className="truncate">{label ?? placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 w-[min(92vw,380px)]">
          <Command>
            <CommandInput placeholder="Buscar…" />
            <CommandList className="max-h-[320px]">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem value={`__todos ${allLabel}`} onSelect={() => { onChange(null); setOpen(false); }}>
                  <span className="flex-1">{allLabel}</span>{value == null && <Check size={14} aria-hidden />}
                </CommandItem>
                {options.map(o => (
                  <CommandItem key={o.id} value={`${o.label} ${o.id}`} onSelect={() => { onChange(o.id); setOpen(false); }}>
                    {o.color !== undefined && <span aria-hidden className="mr-2 h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color ?? "var(--muted-foreground)" }} />}
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="ml-2 text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>{o.hint}</span>}
                    {o.id === value && <Check size={14} className="ml-2" aria-hidden />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value != null ? (
        <button type="button" aria-label={clearLabel} title={clearLabel} onClick={() => onChange(null)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ color: "var(--foreground)" }}>
          <X size={14} aria-hidden />
        </button>
      ) : (
        <ChevronsUpDown size={14} aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
      )}
    </div>
  );
}
