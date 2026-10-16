// Filtros da Auditoria: o quê, ação, quem e período (com atalhos Hoje / 7 /
// 30 dias), o total encontrado e as etiquetas dos filtros ligados — cada uma
// remove o seu filtro.
import type { User } from "@workspace/api-client-react";
import { CalendarRange, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FOCUS_RING, btnGhost, inputCls, surfaceCls } from "../criteria/criteria-ui";
import { ACTIONS, CATEGORIES, type CategoryKey } from "./labels";
import { dayKey } from "./dates";

export interface Filters { cat: CategoryKey | ""; action: string; user: string; from: string; to: string; page: number }
export const EMPTY_FILTERS: Filters = { cat: "", action: "", user: "", from: "", to: "", page: 1 };

// Ações em ordem alfabética do rótulo, para o seletor.
const ACTION_OPTIONS = Object.entries(ACTIONS)
  .map(([code, d]) => ({ code, label: d.label.charAt(0).toUpperCase() + d.label.slice(1) }))
  .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

const labelCls = "font-condensed block mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground";
const triggerCls = cn(inputCls, "h-11 lg:h-10 justify-between text-[14px] font-semibold");

function daysAgo(n: number) { return dayKey(new Date(Date.now() - n * 86_400_000)); }

export function AuditFilters({ f, update, clear, people, total, loaded }: {
  f: Filters; update: (p: Partial<Filters>) => void; clear: () => void; people: User[]; total: number; loaded: boolean;
}) {
  const today = dayKey(new Date());
  const quick = [
    { key: "hoje", label: "Hoje", from: today },
    { key: "7", label: "7 dias", from: daysAgo(6) },
    { key: "30", label: "30 dias", from: daysAgo(29) },
  ];
  const activeQuick = quick.find(q => f.from === q.from && f.to === today)?.key;
  const chips: { key: string; label: string; clear: Partial<Filters> }[] = [];
  if (f.cat) chips.push({ key: "cat", label: CATEGORIES.find(c => c.key === f.cat)?.label ?? f.cat, clear: { cat: "" } });
  if (f.action) chips.push({ key: "action", label: ACTION_OPTIONS.find(a => a.code === f.action)?.label ?? f.action, clear: { action: "" } });
  if (f.user) chips.push({ key: "user", label: people.find(u => String(u.id) === f.user)?.name ?? "Pessoa", clear: { user: "" } });
  if (f.from || f.to) {
    const fmt = (d: string) => d.split("-").reverse().join("/");
    chips.push({ key: "period", label: f.from && f.to ? (f.from === f.to ? fmt(f.from) : `${fmt(f.from)} a ${fmt(f.to)}`) : f.from ? `Desde ${fmt(f.from)}` : `Até ${fmt(f.to)}`, clear: { from: "", to: "" } });
  }
  const hasFilters = chips.length > 0;

  return (
    <section aria-label="Filtros" className={cn(surfaceCls, "p-4 sm:p-5 space-y-4")}>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.1fr_1.3fr_1.1fr_1.6fr]">
        <div className="min-w-0">
          <label htmlFor="audit-cat" className={labelCls}>O quê</label>
          <Select value={f.cat || "all"} onValueChange={v => update({ cat: v === "all" ? "" : (v as CategoryKey) })}>
            <SelectTrigger id="audit-cat" data-testid="select-audit-entity" className={triggerCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tudo</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-action" className={labelCls}>Ação</label>
          <Select value={f.action || "all"} onValueChange={v => update({ action: v === "all" ? "" : v })}>
            <SelectTrigger id="audit-action" data-testid="select-audit-action" className={triggerCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {ACTION_OPTIONS.map(a => <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label htmlFor="audit-user" className={labelCls}>Quem</label>
          <Select value={f.user || "all"} onValueChange={v => update({ user: v === "all" ? "" : v })}>
            <SelectTrigger id="audit-user" data-testid="select-audit-user" className={triggerCls}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as pessoas</SelectItem>
              {people.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <fieldset className="min-w-0">
          <legend className={labelCls}>Período</legend>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <label htmlFor="audit-from" className="sr-only">De</label>
              <input id="audit-from" type="date" value={f.from} max={f.to || undefined} onChange={e => update({ from: e.target.value })} aria-label="De"
                className={cn(inputCls, "h-11 lg:h-10 text-[14px] tabular-nums")} />
            </div>
            <div className="relative">
              <label htmlFor="audit-to" className="sr-only">Até</label>
              <input id="audit-to" type="date" value={f.to} min={f.from || undefined} onChange={e => update({ to: e.target.value })} aria-label="Até"
                className={cn(inputCls, "h-11 lg:h-10 text-[14px] tabular-nums")} />
            </div>
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3 border-t border-border pt-3.5">
        <div role="group" aria-label="Atalhos de período" className="flex items-center gap-1.5 flex-wrap">
          <CalendarRange size={14} aria-hidden className="text-muted-foreground mr-0.5" />
          {quick.map(q => (
            <button key={q.key} type="button" aria-pressed={activeQuick === q.key} data-testid={`audit-quick-${q.key}`}
              onClick={() => activeQuick === q.key ? update({ from: "", to: "" }) : update({ from: q.from, to: today })}
              className={cn("font-condensed h-11 lg:h-8 px-3.5 rounded-full border text-[12.5px] font-bold uppercase tracking-[0.05em] transition-colors duration-150", FOCUS_RING,
                activeQuick === q.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40")}>
              {q.label}
            </button>
          ))}
        </div>
        <p className="md:ml-auto text-[13.5px] text-muted-foreground" aria-live="polite" data-testid="audit-total">
          {loaded ? <><span className="font-semibold text-foreground tabular-nums">{total.toLocaleString("pt-BR")}</span> {total === 1 ? "ação registrada" : "ações registradas"}{hasFilters ? " com estes filtros" : ""}</> : " "}
        </p>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros ligados">
          {chips.map(c => (
            <button key={c.key} type="button" onClick={() => update(c.clear)} aria-label={`Tirar o filtro ${c.label}`}
              className={cn("inline-flex items-center gap-1.5 h-11 lg:h-8 pl-3 pr-2.5 rounded-full bg-secondary text-[12.5px] font-semibold text-foreground transition-colors duration-150 hover:bg-secondary/70", FOCUS_RING)}>
              {c.label} <X size={13} aria-hidden className="text-muted-foreground" />
            </button>
          ))}
          <button type="button" onClick={clear} className={cn(btnGhost, "lg:min-h-8 px-2.5 text-[12px]")}>Limpar tudo</button>
        </div>
      )}
    </section>
  );
}
