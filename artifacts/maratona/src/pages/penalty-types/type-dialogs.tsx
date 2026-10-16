// Diálogos do cadastro de tipos: Novo/Editar tipo (com o alcance da mudança
// de pontos) e a confirmação de remover (com "desativar" como saída mais leve).
import type { PenaltyType } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pencil, Plus, PowerOff, Trash2 } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import {
  ConsequenceList, DialogHeading, KindChip, FieldErrorText, FieldLabel, Segmented, SignedNumber, SwitchRow, btnDanger, btnPrimary, btnSecondary,
  dialogCls, dialogFooterCls, inputCls, invalidCls, useReturnFocus,
} from "../absences/absences-ui";
import { slugify, type ApplyScope, type TypeFormState } from "./use-type-form";

/** Campo obrigatório que rejeita espaços em branco (o `required` nativo aceita "   "). */
const requiredText = (message: string) => ({
  validate: (v: unknown) => (typeof v === "string" && v.trim().length > 0) || message,
});

const SCOPES: { value: ApplyScope; title: string; text: string }[] = [
  { value: "future", title: "Só a partir de agora", text: "Os lançamentos já feitos neste ciclo mantêm o valor antigo; só os novos usam o valor novo." },
  { value: "cycle", title: "Todo o ciclo atual", text: "Atualiza também os lançamentos deste tipo já feitos no ciclo e recalcula os resultados." },
];

export function TypeFormDialog({ state }: { state: TypeFormState }) {
  const { open, editingType, closeDialog, form, onSubmit, applyScope, setApplyScope, slugTouched, setSlugTouched, isPending } = state;
  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const onCloseAutoFocus = useReturnFocus(open);
  const kind = watch("kind");
  const points = watch("points");
  const pts = Number.isFinite(points) ? Number(points) : 0;
  const editing = !!editingType;
  const pointsChanged = editing && Number(points) !== editingType.points && Number.isFinite(points);
  const merit = kind === "merit";
  const labelField = register("label", requiredText("Informe o nome do tipo."));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !isPending) closeDialog(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[540px] max-h-[92dvh] p-0 sm:p-0 gap-0 flex flex-col overflow-hidden")} data-testid="type-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (isPending) e.preventDefault(); }}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1" noValidate>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
        <DialogHeading icon={editing ? Pencil : Plus} tone={editing ? "neutral" : "brand"} Title={DialogTitle} Description={DialogDescription}
          title={editing ? `Editar “${editingType.label}”` : "Novo tipo de lançamento"}
          description={editing
            ? "Mudanças valem para os próximos lançamentos. Se mudar os pontos, você escolhe se os já feitos acompanham."
            : "Aparece no formulário de lançamento assim que for criado (se estiver ativo)."} />
        <div className="space-y-4">
          <div>
            <p aria-hidden className="font-condensed flex items-baseline justify-between gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
              <span>Natureza</span>
              {editing && <span className="normal-case tracking-normal font-body text-[12px] font-normal">não muda depois de criado</span>}
            </p>
            {editing ? (
              <KindChip kind={kind} className="h-7 px-2.5 text-[13px]">{merit ? "Mérito · soma" : "Penalidade · desconta"}</KindChip>
            ) : (
            <Segmented<"penalty" | "merit">
              label="Natureza do tipo"
              value={kind}
              onChange={v => setValue("kind", v)}
              options={[
                { value: "penalty", label: "Penalidade · desconta", testId: "ptype-kind-penalty", activeCls: "bg-card text-[var(--status-danger-text)] shadow-sm" },
                { value: "merit", label: "Mérito · soma", testId: "ptype-kind-merit", activeCls: "bg-card text-[var(--status-ok-text)] shadow-sm" },
              ]}
            />
            )}
          </div>

          <div>
            <FieldLabel htmlFor="ptype-label" required>Nome</FieldLabel>
            <input id="ptype-label" autoComplete="off" aria-invalid={!!errors.label} aria-describedby={errors.label ? "ptype-label-error" : undefined}
              {...labelField}
              onChange={e => { void labelField.onChange(e); if (!editing && !slugTouched) setValue("slug", slugify(e.target.value)); }}
              placeholder="Ex.: Atraso injustificado" className={cn(inputCls, errors.label && invalidCls)} />
            <FieldErrorText id="ptype-label-error" message={errors.label?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
            <div>
              <FieldLabel htmlFor="ptype-slug" required={!editing} hint={editing ? "não muda" : "gerado do nome"}>Identificador</FieldLabel>
              <input id="ptype-slug" autoComplete="off" disabled={editing} aria-invalid={!!errors.slug} aria-describedby={errors.slug ? "ptype-slug-error" : "ptype-slug-help"}
                {...register("slug", editing ? {} : { ...requiredText("Informe o identificador."), onChange: () => setSlugTouched(true) })}
                placeholder="ex.: atraso" className={cn(inputCls, "font-mono text-[14px] disabled:opacity-60 disabled:cursor-not-allowed", errors.slug && invalidCls)} />
              {!errors.slug && <p id="ptype-slug-help" className="mt-1.5 text-[12.5px] text-muted-foreground">Usado na planilha e na integração.</p>}
              <FieldErrorText id="ptype-slug-error" message={errors.slug?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="ptype-points" required>Pontos padrão</FieldLabel>
              <input id="ptype-points" type="number" inputMode="numeric" min="0" step="1" aria-invalid={!!errors.points} aria-describedby={errors.points ? "ptype-points-error" : undefined}
                {...register("points", { valueAsNumber: true, validate: v => (Number.isInteger(v) && v >= 0) || "Use um número inteiro, zero ou mais." })}
                className={cn(inputCls, "tabular-nums", errors.points && invalidCls)} />
              <FieldErrorText id="ptype-points-error" message={errors.points?.message} />
            </div>
          </div>

          {pointsChanged && (
            <fieldset className="rounded-xl border border-[var(--status-warn)]/40 bg-[var(--status-warn-bg)] px-3.5 py-3" data-testid="ptype-apply-scope">
              <legend className="sr-only">Aplicar a mudança de pontos a partir de</legend>
              <p className="font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-foreground mb-2">
                De {editingType.points} para {pts} pts — aplicar a partir de:
              </p>
              <div className="grid gap-2">
                {SCOPES.map(s => (
                  <label key={s.value} className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors duration-150",
                    applyScope === s.value ? "border-foreground/50 bg-card" : "border-border bg-card/60 hover:bg-card")}>
                    <input type="radio" name="ptype-apply-scope" value={s.value} checked={applyScope === s.value} onChange={() => setApplyScope(s.value)}
                      className="mt-1 h-4 w-4 accent-[var(--foreground)] shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-foreground">{s.title}</span>
                      <span className="block mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{s.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="grid gap-2.5">
            <SwitchRow id="ptype-requires-event" title="Exige evento vinculado"
              control={<Switch id="ptype-requires-event" checked={watch("requiresEvent")} onCheckedChange={v => setValue("requiresEvent", v)} />}>
              Ao lançar, é obrigatório escolher o evento em que aconteceu.
            </SwitchRow>
            <SwitchRow id="ptype-active" title="Ativo"
              control={<Switch id="ptype-active" checked={watch("active")} onCheckedChange={v => setValue("active", v)} />}>
              Aparece no formulário de lançamento. Inativo, some de lá — os lançamentos já feitos continuam valendo.
            </SwitchRow>
          </div>

          </div>
        </div>
          {/* Pé fixo fora da rolagem: o efeito e o envio ficam sempre à vista. */}
          <div className="shrink-0 px-5 sm:px-6 pt-3.5 pb-5 bg-card border-t border-border space-y-3 shadow-[0_-10px_20px_-16px_rgba(0,0,0,0.35)]">
          <div className={cn("rounded-xl border px-4 py-3 flex items-center gap-4", merit ? "border-[var(--status-ok)]/35 bg-[var(--status-ok-bg)]" : "border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)]")} data-testid="ptype-preview">
            <SignedNumber kind={kind} className="text-[26px] shrink-0">{merit ? "+" : "−"}{pts} pts</SignedNumber>
            <p className="min-w-0 text-[13px] leading-snug text-muted-foreground">
              por lançamento. Para quem tem 8 eventos no ciclo, {merit ? "soma" : "tira"} <span className="font-semibold text-foreground tabular-nums">{fmtNum(pts / 8, 1)}</span> {merit ? "na" : "da"} nota.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeDialog} disabled={isPending} className={btnSecondary}>Cancelar</button>
            <button type="submit" data-testid="button-submit-type" disabled={isPending} aria-busy={isPending || undefined} className={cn(btnPrimary, "flex-1 sm:flex-none")}>
              {isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : editing ? <Pencil size={15} aria-hidden /> : <Plus size={15} aria-hidden />}
              {isPending ? "Salvando…" : editing ? "Salvar alterações" : "Criar tipo"}
            </button>
          </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTypeDialog({ state, uses }: { state: TypeFormState; uses: (t: PenaltyType) => number }) {
  const { deleteTarget: t, setDeleteTarget, deleteMutation, toggleActive, togglingId } = state;
  const pending = deleteMutation.isPending;
  const open = t !== null;
  const onCloseAutoFocus = useReturnFocus(open);
  const n = t ? uses(t) : 0;
  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v && !pending) setDeleteTarget(null); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[500px]")} data-testid="delete-type-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {t && (
          <>
            <DialogHeading icon={Trash2} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
              title={`Remover “${t.label}”?`}
              description="O tipo sai do cadastro e do formulário de lançamento. Não dá para desfazer." />
            <ConsequenceList items={[
              n > 0
                ? <>{n === 1 ? "O" : "Os"} <span className="font-semibold text-foreground">{plural(n, "lançamento", "lançamentos")}</span> deste ciclo {n === 1 ? "continua" : "continuam"} valendo na nota, mas {n === 1 ? "passa" : "passam"} a mostrar o identificador <span className="font-mono text-foreground">{t.slug}</span> no lugar do nome.</>
                : <>Nenhum lançamento deste ciclo usa este tipo.</>,
              <>Lançamentos de ciclos anteriores não mudam.</>,
              t.active ? <>Se a ideia é só parar de usar, <span className="font-semibold text-foreground">desativar</span> é mais leve: some do formulário e mantém o nome no histórico.</> : <>Ele já está inativo: não aparece no formulário.</>,
            ]} />
            <div className={dialogFooterCls}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={pending} className={btnSecondary}>Cancelar</button>
              {t.active && (
                <button type="button" disabled={pending || togglingId === t.id} className={btnSecondary} data-testid="button-deactivate-instead"
                  onClick={() => { toggleActive(t, false); setDeleteTarget(null); }}>
                  <PowerOff size={15} aria-hidden /> Desativar
                </button>
              )}
              <button type="button" data-testid="button-confirm-delete-type" disabled={pending} aria-busy={pending || undefined}
                onClick={() => deleteMutation.mutate({ id: t.id })} className={btnDanger}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={15} aria-hidden />}
                {pending ? "Removendo…" : "Remover"}
              </button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
