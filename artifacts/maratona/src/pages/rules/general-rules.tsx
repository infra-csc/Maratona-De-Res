// Regras gerais em grupos (Avaliação, Elegibilidade, Pagamento, Outras):
// cada regra numa linha com o que ela faz, o valor e "Salvar" quando muda.
// O mínimo de eventos mostra o que vale no ciclo atual (geral × do ciclo).
import { Link } from "wouter";
import type { Cycle, Rule } from "@workspace/api-client-react";
import { ArrowRight, CalendarRange, Loader2, RotateCcw, Save, Settings } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, plural } from "@/lib/utils";
import { Chip, FOCUS_RING, SectionTitle, btnGhost, btnPrimary, inputCls, surfaceCls } from "./rules-ui";
import { GROUP_META, PAYMENT_OPTIONS, RULE_META, type GroupKey } from "./rule-meta";

export type RuleEditing = {
  values: Record<string, string>;
  setValue: (key: string, v: string) => void;
  reset: (key: string) => void;
  save: (key: string, value: string) => void;
  savingKey: string | null;
  canEdit: boolean;
};

function CycleOverride({ cycle }: { cycle: Cycle | undefined }) {
  if (!cycle) return null;
  const own = cycle.minEvents != null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] leading-snug" data-testid="rule-cycle-override">
      <Chip tone={own ? "warn" : "info"} icon={CalendarRange} className="h-5 text-[11px]">{cycle.name}</Chip>
      {own
        ? <span className="text-foreground">usa <span className="font-semibold">{plural(cycle.minEvents ?? 0, "evento", "eventos")}</span>, definido no próprio ciclo — esta regra não vale para ele.</span>
        : <span className="text-muted-foreground">usa esta regra geral.</span>}
    </p>
  );
}

function RuleRow({ rule, editing, cycle }: { rule: Rule; editing: RuleEditing; cycle?: Cycle }) {
  const meta = RULE_META[rule.key];
  const current = editing.values[rule.key] ?? rule.value;
  const dirty = editing.values[rule.key] !== undefined && editing.values[rule.key] !== rule.value;
  const saving = editing.savingKey === rule.key;
  const id = `rule-${rule.key}`;
  const invalid = meta?.inputType === "number" && dirty && (current.trim() === "" || !Number.isFinite(Number(current)));
  const field = meta?.inputType === "select" ? (
    <Select value={PAYMENT_OPTIONS.some(o => o.value === current) ? current : "outro"} onValueChange={v => editing.setValue(rule.key, v)} disabled={!editing.canEdit || saving}>
      <SelectTrigger id={id} data-testid={`input-rule-${rule.key}`} className={cn(inputCls, "h-11 lg:h-10 justify-between font-semibold text-[14.5px] w-full sm:w-[220px]")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{PAYMENT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  ) : (
    <div className="relative w-full sm:w-[160px]">
      <input id={id} data-testid={`input-rule-${rule.key}`} type={meta?.inputType === "number" ? "number" : "text"} inputMode={meta?.inputType === "number" ? "decimal" : undefined}
        value={current} disabled={!editing.canEdit || saving} aria-invalid={invalid || undefined} aria-describedby={`${id}-help`}
        onChange={e => editing.setValue(rule.key, e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && dirty && !invalid) editing.save(rule.key, current); if (e.key === "Escape" && dirty) { e.stopPropagation(); editing.reset(rule.key); } }}
        className={cn(inputCls, "h-11 lg:h-10 font-semibold tabular-nums", meta?.unit && "pr-[84px]", invalid && "border-[var(--status-danger)]")} />
      {meta?.unit && <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12.5px] text-muted-foreground">{meta.unit}</span>}
    </div>
  );
  return (
    <li data-testid={`row-rule-${rule.key}`} className={cn("px-4 sm:px-5 py-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start transition-colors duration-150", dirty && "bg-[var(--status-warn-bg)]/40")}>
      <div className="min-w-0">
        <label htmlFor={id} className="flex flex-wrap items-center gap-2 text-[15px] font-semibold leading-snug text-foreground">
          {meta?.label ?? rule.description}
          {dirty && <Chip tone="warn" className="h-5 text-[11px]">Não salvo</Chip>}
        </label>
        <p id={`${id}-help`} className="mt-1 text-[13px] leading-relaxed text-muted-foreground max-w-[70ch]">{meta?.help ?? <>Chave interna: <code className="text-[12.5px]">{rule.key}</code></>}</p>
        {rule.key === "min_events_eligibility" && <CycleOverride cycle={cycle} />}
        {invalid && <p role="alert" className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Use um número.</p>}
      </div>
      <div className="flex flex-col sm:items-end gap-2">
        <div className="flex items-center gap-2">
          {field}
          {editing.canEdit && (
            <button type="button" data-testid={`button-save-rule-${rule.key}`} onClick={() => editing.save(rule.key, current)}
              disabled={!dirty || invalid || saving} aria-busy={saving || undefined}
              className={cn(btnPrimary, "min-h-11 lg:min-h-10 px-3.5 text-[13px] shrink-0")}>
              {saving ? <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" /> : <Save size={14} aria-hidden />}
              <span className="hidden sm:inline">{saving ? "Salvando…" : "Salvar"}</span>
              <span className="sr-only sm:hidden">Salvar</span>
            </button>
          )}
        </div>
        {dirty && !saving && (
          <button type="button" onClick={() => editing.reset(rule.key)} className={cn(btnGhost, "self-start sm:self-end px-2 min-h-9 text-[12px]", FOCUS_RING)}>
            <RotateCcw size={12} aria-hidden /> Desfazer ({rule.value || "vazio"})
          </button>
        )}
      </div>
    </li>
  );
}

export function RulesGroup({ group, rules, editing, cycle }: { group: GroupKey | "outras"; rules: Rule[]; editing: RuleEditing; cycle?: Cycle }) {
  if (rules.length === 0) return null;
  const meta = group === "outras" ? { icon: Settings, title: "Outras regras", subtitle: "Regras sem descrição própria nesta tela." } : GROUP_META[group];
  return (
    <section aria-labelledby={`rules-group-${group}`} className="space-y-2.5" data-testid={`rules-group-${group}`}>
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-0.5">
        <SectionTitle icon={meta.icon} className="mb-0"><span id={`rules-group-${group}`}>{meta.title}</span></SectionTitle>
        <p className="text-[13px] text-muted-foreground">{meta.subtitle}</p>
      </div>
      <ul className={cn(surfaceCls, "divide-y divide-border overflow-hidden")}>
        {rules.map(r => <RuleRow key={r.key} rule={r} editing={editing} cycle={cycle} />)}
      </ul>
    </section>
  );
}

/** Faixa no topo: o que é geral × o que é do ciclo atual. */
export function CycleRulesPanel({ cycle, generalMin }: { cycle: Cycle | undefined; generalMin: string | undefined }) {
  if (!cycle) return null;
  const own = cycle.minEvents != null;
  const min = cycle.effectiveMinEvents ?? cycle.minEvents ?? (generalMin != null && generalMin !== "" ? Number(generalMin) : null);
  const items: { label: string; value: string; note: string }[] = [
    { label: "Mínimo de eventos", value: min != null && Number.isFinite(min) ? plural(min, "evento", "eventos") : "—", note: own ? "Definido no ciclo" : "Vem da regra geral" },
    { label: "Avaliação", value: cycle.areaEvaluation ? "Por área" : "Por designação", note: cycle.areaEvaluation ? "A 1ª resposta da área fecha o critério" : "Avaliadores designados por evento" },
    { label: "Matriz de conformidade", value: cycle.conformityWithoutConduta ? "Sem Conduta" : "Com Conduta", note: cycle.conformityWithoutConduta ? "Conduta vai no critério Proatividade/Conduta" : "Conduta dentro da matriz" },
    { label: "Pagamento previsto", value: cycle.paymentDate ? new Date(`${cycle.paymentDate}T12:00:00`).toLocaleDateString("pt-BR") : "Sem data", note: "Data do ciclo" },
  ];
  return (
    <section aria-label="Regras do ciclo atual" data-testid="cycle-rules-panel" className={cn(surfaceCls, "overflow-hidden")}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-border">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-foreground">
            <CalendarRange size={15} aria-hidden className="text-muted-foreground" /> Ciclo atual: {cycle.name}
            <Chip tone={cycle.status === "closed" ? "neutral" : "brand"} className="h-5 text-[11px]">{cycle.status === "closed" ? "Fechado" : "Aberto"}</Chip>
          </p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Estas regras são do ciclo e se mudam em Ciclos. As regras gerais abaixo valem quando o ciclo não define a sua.</p>
        </div>
        <Link href="/cycles" className={cn(btnGhost, "self-start sm:self-center px-3 -ml-3 sm:ml-0")} data-testid="link-cycle-rules">
          Abrir Ciclos <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border">
        {items.map(it => (
          <div key={it.label} className="bg-card px-4 sm:px-5 py-3">
            <dt className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{it.label}</dt>
            <dd className="mt-1.5 text-[15px] font-semibold text-foreground">{it.value}</dd>
            <dd className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{it.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
