// Faixas de bônus: régua 0–100 com a cobertura (lacunas e sobreposições à
// vista), a conta do bônus e as faixas editáveis — TABELA nas telas largas,
// CARTÕES no celular/tablet — e o formulário de nova faixa.
import type { PlatoonRule } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, CircleDollarSign, Loader2, Plus, RefreshCw, RotateCcw, Save, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWideScreen } from "../events/use-wide-screen";
import { Chip, Eyebrow, FieldLabel, Notice, SectionTitle, brl, btnGhost, btnPrimary, btnSecondary, btnSmall, iconBtn, numCls, score, surfaceCls } from "./rules-ui";
import type { BandsState } from "./use-bands";

type Seg = { from: number; to: number; band?: PlatoonRule; kind: "band" | "gap" | "overlap" };

/** Segmentos da régua 0–100 (faixas, lacunas > 0,01 e sobreposições). */
function segments(bands: PlatoonRule[]): { segs: Seg[]; issues: string[] } {
  const sorted = [...bands].filter(b => b.active !== false).sort((a, b) => Number(a.minScore) - Number(b.minScore));
  const segs: Seg[] = [];
  const issues: string[] = [];
  let cursor = 0;
  for (const b of sorted) {
    const min = Number(b.minScore), max = Number(b.maxScore);
    const gap = Math.round((min - cursor) * 100) / 100;
    if (segs.length === 0 && min > 0) { segs.push({ from: 0, to: min, kind: "gap" }); issues.push(`Nenhuma faixa cobre 0 a ${score(min)}.`); }
    else if (segs.length > 0 && gap > 0.01) { segs.push({ from: cursor, to: min, kind: "gap" }); issues.push(`Lacuna entre ${score(cursor)} e ${score(min)}.`); }
    else if (segs.length > 0 && gap < 0) issues.push(`“${b.name}” sobrepõe a faixa anterior a partir de ${score(min)}.`);
    segs.push({ from: Math.max(min, segs.length ? cursor : min), to: max, band: b, kind: gap < 0 ? "overlap" : "band" });
    cursor = Math.max(cursor, max);
  }
  if (sorted.length > 0 && cursor < 100) { segs.push({ from: cursor, to: 100, kind: "gap" }); issues.push(`Nenhuma faixa cobre ${score(cursor)} a 100.`); }
  return { segs, issues };
}

function CoverageBar({ bands, draft }: { bands: PlatoonRule[]; draft: boolean }) {
  const { segs, issues } = segments(bands);
  if (bands.length === 0) return null;
  return (
    <div className="px-4 sm:px-5 py-4 border-b border-border" data-testid="bands-coverage">
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <Eyebrow as="p">Cobertura das notas</Eyebrow>
        {draft && <Chip className="h-5 text-[11px]" title="A régua já mostra as mudanças ainda não salvas">Com mudanças não salvas</Chip>}
        {issues.length === 0
          ? <Chip tone="ok" icon={CheckCircle2} className="h-5 text-[11px]">0 a 100 sem lacunas</Chip>
          : <Chip tone="warn" icon={AlertTriangle} className="h-5 text-[11px]">{issues[0]}</Chip>}
      </div>
      <div className="relative flex h-7 rounded-md overflow-hidden border border-border bg-secondary" role="img"
        aria-label={`Faixas de 0 a 100: ${[...bands].sort((a, b) => Number(a.minScore) - Number(b.minScore)).map(b => `${b.name} ${score(Number(b.minScore))} a ${score(Number(b.maxScore))}`).join("; ")}`}>
        {segs.map((s, i) => (
          <span key={i} title={s.band ? `${s.band.name}: ${score(s.from)}–${score(s.to)}` : `Sem faixa: ${score(s.from)}–${score(s.to)}`}
            className={cn("h-full border-r border-card last:border-r-0", s.kind === "gap" && "bg-[repeating-linear-gradient(135deg,var(--status-warn-bg),var(--status-warn-bg)_4px,transparent_4px,transparent_8px)]")}
            style={{ width: `${Math.max(0.6, s.to - s.from)}%`, backgroundColor: s.band ? s.band.color : undefined }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] tabular-nums text-muted-foreground" aria-hidden>
        <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
      </div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="w-3.5 h-3.5 shrink-0 rounded-[4px] border border-foreground/15" style={{ backgroundColor: color }} />;
}

type RowProps = { p: PlatoonRule; state: BandsState; canEdit: boolean; canDelete: boolean };

function useRow({ p, state }: RowProps) {
  const e = state.edits[p.id];
  const dirty = e !== undefined;
  const val = <K extends "minScore" | "maxScore" | "bonusValue" | "bonusPerExtraEvent">(k: K) => {
    const v = e?.[k] ?? Number(p[k] ?? 0);
    return typeof v === "number" && Number.isNaN(v) ? "" : v;
  };
  const name = e?.name ?? p.name ?? "";
  const base = e?.bonusValue ?? Number(p.bonusValue);
  const extra = e?.bonusPerExtraEvent ?? Number(p.bonusPerExtraEvent ?? 0);
  const example = base + 3 * extra;
  return { dirty, val, name, example, saving: state.savingId === p.id, error: state.rowErrors[p.id] };
}

function NameInput({ p, state, canEdit, name }: RowProps & { name: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Swatch color={p.color} />
      <input aria-label={`Nome da faixa ${p.name}`} value={name} disabled={!canEdit} placeholder="Nome da faixa"
        onChange={ev => state.editField(p.id, "name", ev.target.value)}
        className={cn(numCls, "w-full min-w-0 font-condensed text-[15px] font-bold uppercase tracking-[0.02em]")} />
    </div>
  );
}

function RangeInputs({ p, state, canEdit, val }: RowProps & { val: ReturnType<typeof useRow>["val"] }) {
  return (
    <div className="flex items-center gap-1.5">
      <input data-testid={`input-platoon-min-${p.id}`} aria-label={`Nota mínima da faixa ${p.name}`} type="number" inputMode="decimal" min="0" max="100" step="0.01"
        value={val("minScore")} disabled={!canEdit} onChange={ev => state.editField(p.id, "minScore", ev.target.value)} className={cn(numCls, "w-[78px] text-center")} />
      <span aria-hidden className="text-muted-foreground">–</span>
      <input data-testid={`input-platoon-max-${p.id}`} aria-label={`Nota máxima da faixa ${p.name}`} type="number" inputMode="decimal" min="0" max="100" step="0.01"
        value={val("maxScore")} disabled={!canEdit} onChange={ev => state.editField(p.id, "maxScore", ev.target.value)} className={cn(numCls, "w-[78px] text-center")} />
    </div>
  );
}

function MoneyInput({ p, state, canEdit, field, value, label, testId, step }: RowProps & { field: "bonusValue" | "bonusPerExtraEvent"; value: number | string; label: string; testId: string; step: string }) {
  return (
    <div className="relative w-full lg:w-[124px]">
      <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12.5px] font-semibold text-muted-foreground">R$</span>
      <input data-testid={testId} aria-label={`${label} da faixa ${p.name}, em reais`} type="number" inputMode="decimal" min="0" step={step}
        value={value} disabled={!canEdit} onChange={ev => state.editField(p.id, field, ev.target.value)} className={cn(numCls, "w-full pl-9 text-right")} />
    </div>
  );
}

function RowActions(props: RowProps & { r: ReturnType<typeof useRow> }) {
  const { p, state, canEdit, canDelete, r } = props;
  return (
    <div className="flex items-center justify-end gap-1.5 lg:min-w-[196px]">
      {canEdit && r.dirty && (
        <button type="button" onClick={() => state.discard(p.id)} disabled={r.saving} aria-label={`Desfazer mudanças na faixa ${p.name}`} title="Desfazer" className={cn(iconBtn, "motion-safe:animate-in motion-safe:fade-in-0 duration-150")}>
          <RotateCcw size={15} aria-hidden />
        </button>
      )}
      {/* "Salvar" só aparece quando a linha mudou (sete botões cinza à toa poluíam a tabela). */}
      {canEdit && r.dirty && (
        <button type="button" data-testid={`button-save-platoon-${p.id}`} onClick={() => state.save(p)} disabled={r.saving} aria-busy={r.saving || undefined}
          className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3 text-[13px] motion-safe:animate-in motion-safe:fade-in-0 duration-150")}>
          {r.saving ? <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" /> : <Save size={14} aria-hidden />} Salvar
        </button>
      )}
      {canDelete && (
        <button type="button" data-testid={`button-delete-platoon-${p.id}`} onClick={() => state.setDeleteTarget(p)}
          aria-label={`Remover faixa ${r.name || `${p.minScore}–${p.maxScore}`}`} title="Remover faixa"
          className={cn(iconBtn, "text-muted-foreground hover:text-[var(--status-danger-text)]")}>
          <Trash2 size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}

function BandRow(props: RowProps) {
  const r = useRow(props);
  const { p } = props;
  return (
    <>
      <tr data-testid={`row-platoon-${p.id}`} className={cn("border-t border-border align-middle transition-colors duration-150", r.dirty ? "bg-[var(--status-warn-bg)]/35" : "hover:bg-secondary/35")}>
        <td className="pl-5 pr-3 py-3 min-w-[220px]"><NameInput {...props} name={r.name} /></td>
        <td className="px-3 py-3"><RangeInputs {...props} val={r.val} /></td>
        <td className="px-3 py-3"><MoneyInput {...props} field="bonusValue" value={r.val("bonusValue")} label="Prêmio base" testId={`input-platoon-bonus-${p.id}`} step="100" /></td>
        <td className="px-3 py-3"><MoneyInput {...props} field="bonusPerExtraEvent" value={r.val("bonusPerExtraEvent")} label="Bônus por evento extra" testId={`input-platoon-extra-${p.id}`} step="50" /></td>
        <td className="px-3 py-3 text-right font-condensed text-[18px] font-black tabular-nums text-foreground whitespace-nowrap">{Number.isFinite(r.example) ? brl(r.example) : "—"}</td>
        <td className="pl-2 pr-4 py-3"><RowActions {...props} r={r} /></td>
      </tr>
      {r.error && (
        <tr className="bg-[var(--status-danger-bg)]">
          <td colSpan={6} className="pl-5 pr-4 py-2 text-[13px] font-semibold text-[var(--status-danger-text)]" role="alert">{r.error}</td>
        </tr>
      )}
    </>
  );
}

function BandCard(props: RowProps) {
  const r = useRow(props);
  const { p } = props;
  return (
    <li data-testid={`row-platoon-${p.id}`} className={cn("p-4 space-y-3", r.dirty && "bg-[var(--status-warn-bg)]/35")}>
      <NameInput {...props} name={r.name} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Eyebrow as="p" className="mb-1.5">Notas</Eyebrow><RangeInputs {...props} val={r.val} /></div>
        <div><Eyebrow as="p" className="mb-1.5">Prêmio base</Eyebrow><MoneyInput {...props} field="bonusValue" value={r.val("bonusValue")} label="Prêmio base" testId={`input-platoon-bonus-${p.id}`} step="100" /></div>
        <div><Eyebrow as="p" className="mb-1.5">Por evento extra</Eyebrow><MoneyInput {...props} field="bonusPerExtraEvent" value={r.val("bonusPerExtraEvent")} label="Bônus por evento extra" testId={`input-platoon-extra-${p.id}`} step="50" /></div>
      </div>
      {r.error && <p role="alert" className="text-[13px] font-semibold text-[var(--status-danger-text)]">{r.error}</p>}
      <div className="flex items-center gap-3 border-t border-border pt-3">
        <p className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">Com 3 extras: <span className="font-condensed text-[16px] font-black text-foreground tabular-nums">{Number.isFinite(r.example) ? brl(r.example) : "—"}</span></p>
        <RowActions {...props} r={r} />
      </div>
    </li>
  );
}

function AddBandForm({ state }: { state: BandsState }) {
  const f = state.newBand;
  const field = (id: string, label: string, key: keyof typeof f, cls: string, extra: Record<string, string> = {}, testId?: string, hint?: string) => (
    <div className={cls}>
      <FieldLabel htmlFor={id} hint={hint}>{label}</FieldLabel>
      <input id={id} data-testid={testId} value={f[key]} onChange={e => state.setNewBand(key, e.target.value)} {...extra}
        className={cn(numCls, "w-full h-11 lg:h-10")} />
    </div>
  );
  return (
    <form onSubmit={e => { e.preventDefault(); state.create(); }} noValidate data-testid="add-band-form"
      className="px-4 sm:px-5 py-4 border-t border-border bg-secondary/40 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
      <div className="flex items-center justify-between gap-3 mb-3">
        <Eyebrow as="p" className="text-foreground">Nova faixa</Eyebrow>
        <button type="button" onClick={() => state.setAddOpen(false)} aria-label="Fechar nova faixa" className={cn(btnGhost, "px-2 min-h-9")}><X size={15} aria-hidden /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto] gap-3 items-end">
        {field("new-band-name", "Nome", "name", "col-span-2 sm:col-span-3 lg:col-span-1", { placeholder: "Ex.: Elite", autoComplete: "off" }, undefined, "opcional")}
        {field("new-band-min", "Nota mínima", "minScore", "", { type: "number", inputMode: "decimal", min: "0", max: "100", step: "0.01", placeholder: "0" }, "input-new-platoon-min")}
        {field("new-band-max", "Nota máxima", "maxScore", "", { type: "number", inputMode: "decimal", min: "0", max: "100", step: "0.01", placeholder: "100" }, "input-new-platoon-max")}
        {field("new-band-bonus", "Prêmio base (R$)", "bonusValue", "", { type: "number", inputMode: "decimal", min: "0", step: "100", placeholder: "0" }, "input-new-platoon-bonus")}
        {field("new-band-extra", "Por extra (R$)", "bonusPerExtraEvent", "", { type: "number", inputMode: "decimal", min: "0", step: "50", placeholder: "0" }, "input-new-platoon-extra")}
        <button type="submit" data-testid="button-add-platoon" disabled={state.creating} aria-busy={state.creating || undefined}
          className={cn(btnPrimary, "col-span-2 sm:col-span-1 min-h-11 lg:min-h-10")}>
          {state.creating ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Plus size={15} aria-hidden />} Adicionar
        </button>
      </div>
      {state.newError && <p role="alert" className="mt-3 text-[13px] font-semibold text-[var(--status-danger-text)]">{state.newError}</p>}
      <p className="mt-3 text-[12.5px] text-muted-foreground">As faixas precisam cobrir de 0 a 100 sem lacunas nem sobreposições: ajuste os limites das faixas atuais antes de adicionar.</p>
    </form>
  );
}

const th = "font-condensed h-10 px-3 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground bg-secondary/40 border-b border-border";

export function BandsSection({ bands, state, canEdit, canDelete }: { bands: PlatoonRule[]; state: BandsState; canEdit: boolean; canDelete: boolean }) {
  const wide = useWideScreen();
  const sorted = [...bands].sort((a, b) => a.displayOrder - b.displayOrder || Number(a.minScore) - Number(b.minScore));
  const props = (p: PlatoonRule): RowProps => ({ p, state, canEdit, canDelete });
  // A régua acompanha o que está sendo digitado (só números válidos), para ver lacunas antes de salvar.
  const ok = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v);
  const withDrafts = sorted.map(p => {
    const e = state.edits[p.id];
    if (!e) return p;
    return { ...p, name: e.name ?? p.name, minScore: ok(e.minScore) ? e.minScore : p.minScore, maxScore: ok(e.maxScore) ? e.maxScore : p.maxScore };
  });
  return (
    <section aria-labelledby="rules-bands-title" className="space-y-2.5" data-testid="rules-bands">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
        <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-0.5">
          <SectionTitle icon={CircleDollarSign} className="mb-0"><span id="rules-bands-title">Faixas de bônus</span></SectionTitle>
          <p className="text-[13px] text-muted-foreground">A nota do colaborador define a faixa; a faixa define quanto ele recebe.</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" data-testid="button-replace-bands" onClick={() => state.setReplaceOpen(true)} className={btnSmall}>
              <RefreshCw size={14} aria-hidden /> Faixas 2026
            </button>
            {!state.addOpen && (
              <button type="button" data-testid="button-open-add-band" onClick={() => state.setAddOpen(true)} className={btnSmall}>
                <Plus size={14} aria-hidden /> Nova faixa
              </button>
            )}
          </div>
        )}
      </div>
      <div className={cn(surfaceCls, "overflow-hidden")}>
        <Notice icon={CircleDollarSign} className="rounded-none px-4 sm:px-5 py-3 border-b border-border" testId="bands-formula">
          <span className="font-semibold text-foreground">Bônus = prêmio base da faixa + eventos extras × valor por extra da mesma faixa.</span>{" "}
          Extras são os eventos acima do mínimo do ciclo.
        </Notice>
        <CoverageBar bands={withDrafts} draft={Object.keys(state.edits).length > 0} />
        {sorted.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="font-condensed text-[20px] font-black uppercase text-foreground">Nenhuma faixa cadastrada</p>
            <p className="mt-1 text-[14px] text-muted-foreground">Sem faixas, ninguém tem bônus calculado. {canEdit ? "Aplique as faixas de 2026 ou crie a primeira." : ""}</p>
            {canEdit && <button type="button" onClick={() => state.setReplaceOpen(true)} className={cn(btnSecondary, "mt-4")}><RefreshCw size={15} aria-hidden /> Aplicar faixas 2026</button>}
          </div>
        ) : wide ? (
          <table className="w-full border-collapse text-[14px]" aria-label="Faixas de bônus">
            <thead>
              <tr>
                <th className={cn(th, "pl-5")}>Faixa</th>
                <th className={th}>Notas</th>
                <th className={th}>Prêmio base</th>
                <th className={th}>Por evento extra</th>
                <th className={cn(th, "text-right")}>Com 3 extras</th>
                <th className={cn(th, "pr-4")}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>{sorted.map(p => <BandRow key={p.id} {...props(p)} />)}</tbody>
          </table>
        ) : (
          <ul className="divide-y divide-border" aria-label="Faixas de bônus">{sorted.map(p => <BandCard key={p.id} {...props(p)} />)}</ul>
        )}
        {canEdit && state.addOpen && <AddBandForm state={state} />}
      </div>
    </section>
  );
}
