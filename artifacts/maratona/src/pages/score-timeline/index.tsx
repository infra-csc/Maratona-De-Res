import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useGetScoreTimeline, getGetScoreTimelineQueryKey, type ScoreTimelineEntry } from "@workspace/api-client-react";
import { Check, ChevronsUpDown, History, Search, SearchX, X } from "lucide-react";
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
  brl, categoryOf, dayKey, dayTitle, daysAgoKey, deltaOf, faixaChanged, groupByDay, score, sentenceOf, shortDay, signed, todayKey, toHappenings, type Category,
} from "./describe";

// ── Filtros na URL — atalhos de outras telas chegam já filtrados ───────────
// /linha-do-tempo?colaborador=12&evento=40&tipo=calibracao&de=2026-09-01&ate=2026-09-30&direcao=queda&quem=Renata&faixa=1&q=…
type TypeFilter = "todos" | "eventos" | "lancamentos" | "calibracao" | "outros";
type Direction = "todas" | "alta" | "queda";
const TYPES: { value: TypeFilter; label: string; cats?: Category[] }[] = [
  { value: "todos", label: "Tudo" },
  { value: "eventos", label: "Eventos", cats: ["event", "confirm"] },
  { value: "lancamentos", label: "Faltas e méritos", cats: ["penalty", "merit"] },
  { value: "calibracao", label: "Calibração e publicação", cats: ["calibration", "publish"] },
  { value: "outros", label: "Outros", cats: ["other"] },
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
 */
export default function ScoreTimelinePage() {
  const [f, setF] = useState<Filters>(readFilters);
  useEffect(() => writeFilters(f), [f]);
  const patch = (p: Partial<Filters>) => { setF(prev => ({ ...prev, ...p })); setShownDays(PAGE_DAYS); };
  const [shownDays, setShownDays] = useState(PAGE_DAYS);

  const params = f.employee ? { employeeId: f.employee } : {};
  const q = useGetScoreTimeline(params, { query: { queryKey: getGetScoreTimelineQueryKey(params), staleTime: 30_000 } });
  const data = q.data;

  const platoonColor = (name: string | null | undefined) => (name ? data?.platoons.find(p => p.name === name)?.color ?? null : null);
  const person = f.employee ? data?.people.find(p => p.employeeId === f.employee) ?? null : null;

  // Opções dos filtros a partir dos dados do ciclo.
  const { events, authors } = useMemo(() => {
    const ev = new Map<number, string>(); const by = new Set<string>();
    for (const e of data?.entries ?? []) { if (e.eventId != null && e.eventName) ev.set(e.eventId, e.eventName); if (e.by) by.add(e.by); }
    return {
      events: [...ev.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
      authors: [...by].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [data]);

  const filteredEntries = useMemo(() => {
    const text = f.q.trim().toLowerCase();
    const cats = TYPES.find(t => t.value === f.type)?.cats;
    return (data?.entries ?? []).filter(e => {
      const isInfo = e.kind === "info";
      if (cats && !cats.includes(categoryOf(e))) return false;
      if (f.event && e.eventId !== f.event) return false;
      if (f.by && e.by !== f.by) return false;
      const d = dayKey(e.at);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
      if (f.dir !== "todas") { if (isInfo) return false; const dl = deltaOf(e) ?? 0; if (f.dir === "alta" ? dl <= 0 : dl >= 0) return false; }
      if (f.faixa && !faixaChanged(e)) return false;
      if (text) {
        const s = sentenceOf(e);
        const hay = [s.title, s.detail, e.by, e.eventName, e.criterionName, e.label, e.reason, e.employeeName].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(text)) return false;
      }
      return true;
    });
  }, [data, f]);

  const happenings = useMemo(() => toHappenings(filteredEntries), [filteredEntries]);
  const days = useMemo(() => groupByDay(happenings), [happenings]);
  const allDays = useMemo(() => groupByDay(toHappenings(data?.entries ?? [])), [data]);
  const stats = useMemo(() => summarize(filteredEntries), [filteredEntries]);
  const hasFilters = !!(f.event || f.type !== "todos" || f.dir !== "todas" || f.by || f.from || f.to || f.faixa || f.q);
  const clearFilters = () => patch({ ...EMPTY });
  const presetActive = PRESETS.find(p => f.from === p.from() && f.to === p.to())?.key ?? (f.from || f.to ? "custom" : "tudo");

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
            <SearchPicker id="tl-emp" placeholder="Todos os colaboradores" emptyText="Ninguém com esse nome." allLabel="Todos os colaboradores"
              value={f.employee} onChange={id => patch({ employee: id })}
              options={(data?.people ?? []).map(p => ({ id: p.employeeId, label: p.name, hint: score(p.finalResult), color: p.platoonColor ?? platoonColor(p.platoon) }))} />
          </Field>
          <Field label="Evento" htmlFor="tl-ev" className="col-span-2 sm:col-span-1">
            <SearchPicker id="tl-ev" placeholder="Todos os eventos" emptyText="Nenhum evento com esse nome." allLabel="Todos os eventos"
              value={f.event} onChange={id => patch({ event: id })} options={events.map(e => ({ id: e.id, label: e.name }))} />
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
          <div role="group" aria-label="Direção da mudança" className="flex gap-1.5">
            <Pill active={f.dir === "todas"} onClick={() => patch({ dir: "todas" })}>Subiu ou caiu</Pill>
            <Pill active={f.dir === "alta"} onClick={() => patch({ dir: "alta" })} tone="up">▲ Subiu</Pill>
            <Pill active={f.dir === "queda"} onClick={() => patch({ dir: "queda" })} tone="down">▼ Caiu</Pill>
          </div>
          <label htmlFor="tl-faixa" className="flex items-center gap-2 text-[13px] font-semibold cursor-pointer">
            <Switch id="tl-faixa" checked={f.faixa} onCheckedChange={v => patch({ faixa: v })} /> Só mudança de faixa
          </label>
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <Input aria-label="Buscar" value={f.q} onChange={e => patch({ q: e.target.value })} placeholder="Buscar critério, motivo, pessoa…" className="h-9 pl-8" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]" style={{ color: "var(--muted-foreground)" }}>
          <span aria-live="polite">
            {data ? <><strong style={{ color: "var(--foreground)" }}>{happenings.length}</strong> {happenings.length === 1 ? "acontecimento" : "acontecimentos"} em <strong style={{ color: "var(--foreground)" }}>{days.length}</strong> {days.length === 1 ? "dia" : "dias"}{hasFilters || f.employee ? " com estes filtros" : ""}</> : " "}
            {data?.recordedSince && <> · registro exato desde {shortDay(dayKey(data.recordedSince))}, antes disso remontado</>}
          </span>
          {(hasFilters || f.employee) && (
            <button type="button" onClick={() => patch({ ...EMPTY, employee: null })} className="inline-flex items-center gap-1 font-semibold hover:underline">
              <X size={13} aria-hidden /> Limpar tudo
            </button>
          )}
        </div>
      </section>

      {q.isLoading ? (
        <LoadingState lines={8} withHeader label="Montando a linha do tempo" />
      ) : q.isError || !data ? (
        <EmptyState icon={SearchX} title="Não foi possível carregar a linha do tempo" description="Tente de novo em instantes." action={<Button variant="outline" onClick={() => q.refetch()}>Tentar de novo</Button>} />
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
                <TimelineChart entries={data.entries} currentFinal={person.finalResult} platoons={data.platoons} name={person.name} height={240} />
              </div>
            </section>
          )}

          {/* ── Atividade por dia + resumo ── */}
          <section aria-label="Atividade por dia" className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl p-5 min-w-0" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <h2 className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>Atividade por dia</h2>
              <p className="text-[12px] mb-3" style={{ color: "var(--muted-foreground)" }}>Quantas notas subiram e caíram em cada dia{person ? ` (${person.name})` : ""}.</p>
              {allDays.some(d => d.ups > 0 || d.downs > 0) ? (
                <ActivityChart days={person ? groupByDay(toHappenings(data.entries)) : allDays} selected={f.from && f.from === f.to ? f.from : null}
                  onPick={k => patch(f.from === k && f.to === k ? { from: "", to: "" } : { from: k, to: k })} height={300} />
              ) : (
                <p className="text-[13px] py-8 text-center" style={{ color: "var(--muted-foreground)" }}>Nenhuma nota mudou ainda neste ciclo.</p>
              )}
            </div>
            <ul className="grid gap-3 content-start grid-cols-2 lg:grid-cols-2" aria-label="Resumo com os filtros">
              <Kpi label="Notas alteradas" value={String(stats.changes)} />
              <Kpi label="Colaboradores" value={String(stats.people)} />
              <Kpi label="Subiram" value={String(stats.ups)} color={GOOD_TEXT} />
              <Kpi label="Caíram" value={String(stats.downs)} color={DANGER_TEXT} />
              <Kpi label="Mudanças de faixa" value={String(stats.faixas)} wide />
              {stats.topUp && <Kpi label="Maior alta" value={signed(stats.topUp.d)} color={GOOD_TEXT} detail={`${stats.topUp.e.employeeName ?? ""} · ${shortDay(dayKey(stats.topUp.e.at))}`} wide />}
              {stats.topDown && <Kpi label="Maior queda" value={signed(stats.topDown.d)} color={DANGER_TEXT} detail={`${stats.topDown.e.employeeName ?? ""} · ${shortDay(dayKey(stats.topDown.e.at))}`} wide />}
            </ul>
          </section>

          {/* ── Dia a dia ── */}
          {days.length === 0 ? (
            <EmptyState icon={History} title={hasFilters ? "Nada com estes filtros" : "Ainda não há mudanças neste ciclo"}
              description={hasFilters ? "Amplie o período ou limpe os filtros." : "Quando um evento entrar na nota, houver falta, mérito ou publicação de calibração, aparece aqui."}
              action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button> : undefined} />
          ) : (
            <div className="space-y-7">
              {days.slice(0, shownDays).map(d => (
                <section key={d.key} aria-labelledby={`tl-day-${d.key}`}>
                  <div className="sticky top-0 z-[3] -mx-2 px-2 py-2.5 mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1" style={{ backgroundColor: "var(--background)" }}>
                    <h2 id={`tl-day-${d.key}`} className="text-[16px] font-black uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.03em" }}>{dayTitle(d.key)}</h2>
                    <p className="text-[12px] tabular-nums" style={{ color: "var(--muted-foreground)" }}>
                      {d.people > 0 ? <><strong style={{ color: "var(--foreground)" }}>{d.people}</strong> {d.people === 1 ? "colaborador" : "colaboradores"} com nota alterada</> : "sem mudança de nota"}
                      {d.ups > 0 && <strong className="ml-2" style={{ color: GOOD_TEXT }}>▲ {d.ups}</strong>}
                      {d.downs > 0 && <strong className="ml-2" style={{ color: DANGER_TEXT }}>▼ {d.downs}</strong>}
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

function summarize(entries: ScoreTimelineEntry[]) {
  const rows = entries.filter(e => e.kind !== "info" && e.finalAfter != null);
  const withDelta = rows.map(e => ({ e, d: deltaOf(e) ?? 0 }));
  const topUp = withDelta.reduce<(typeof withDelta)[number] | null>((m, x) => (x.d > 0 && (!m || x.d > m.d) ? x : m), null);
  const topDown = withDelta.reduce<(typeof withDelta)[number] | null>((m, x) => (x.d < 0 && (!m || x.d < m.d) ? x : m), null);
  return {
    changes: rows.length,
    people: new Set(rows.map(r => r.employeeId)).size,
    ups: withDelta.filter(x => x.d > 0).length,
    downs: withDelta.filter(x => x.d < 0).length,
    faixas: rows.filter(faixaChanged).length,
    topUp, topDown,
  };
}

function Field({ label, htmlFor, children, className = "" }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="block mb-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{label}</label>
      {children}
    </div>
  );
}

function Pill({ active, onClick, children, tone }: { active: boolean; onClick: () => void; children: ReactNode; tone?: "up" | "down" }) {
  const activeColor = tone === "up" ? "var(--status-ok-bg)" : tone === "down" ? "var(--status-danger-bg)" : "var(--primary)";
  const activeText = tone === "up" ? GOOD_TEXT : tone === "down" ? DANGER_TEXT : "var(--primary-foreground)";
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
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

function Kpi({ label, value, detail, color, wide }: { label: string; value: string; detail?: string; color?: string; wide?: boolean }) {
  return (
    <li className={`rounded-2xl px-4 py-3 ${wide ? "col-span-2" : ""}`} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{label}</p>
      <p className="mt-0.5 text-[26px] font-black leading-none tabular-nums" style={{ fontFamily: CONDENSED, color: color ?? "var(--foreground)" }}>{value}</p>
      {detail && <p className="mt-1 text-[12px] truncate" style={{ color: "var(--muted-foreground)" }}>{detail}</p>}
    </li>
  );
}

/** Combobox com busca (colaborador / evento); "Todos" limpa o filtro. */
function SearchPicker({ id, value, onChange, options, placeholder, emptyText, allLabel }: {
  id: string; value: number | null; onChange: (id: number | null) => void;
  options: { id: number; label: string; hint?: string; color?: string | null }[];
  placeholder: string; emptyText: string; allLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button id={id} type="button" role="combobox" aria-expanded={open}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--input)", color: current ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: current ? 600 : 400 }}>
          <span className="truncate">{current ? current.label : placeholder}</span>
          {current ? (
            <span role="button" tabIndex={0} aria-label="Limpar" onClick={e => { e.stopPropagation(); onChange(null); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onChange(null); } }}
              className="rounded p-0.5 hover:bg-[var(--secondary)]"><X size={14} aria-hidden /></span>
          ) : <ChevronsUpDown size={14} aria-hidden style={{ color: "var(--muted-foreground)" }} />}
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
  );
}
