// Diálogos da tela: novo critério, duplicar para outra área, áreas que
// avaliam e a confirmação de desativar. Todos no padrão do app (cabeçalho
// com ícone, campos com rótulo ligado, rodapé Cancelar/ação, foco devolvido).
import type { Criterion } from "@workspace/api-client-react";
import { Copy, Info, Loader2, Plus, Power, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, fmtNum, plural } from "@/lib/utils";
import {
  AreaChip, ConsequenceList, DialogHeading, FieldErrorText, FieldLabel, Notice, btnDanger, btnPrimary, btnSecondary,
  dialogCls, dialogFooterCls, inputCls, useReturnFocus,
} from "./criteria-ui";
import { requiredText } from "./helpers";
import type { CreateCriterionForm, CriterionAreasEditor, DuplicateCriterionState } from "./use-criterion-forms";
import { EvaluatingAreasField } from "./evaluating-areas";
import type { AreaOption } from "./types";

const invalidCls = "border-[var(--status-danger)] focus:border-[var(--status-danger)]";

/** "Novo critério de avaliação". */
export function CreateCriterionDialog({ state, areas }: { state: CreateCriterionForm; areas: AreaOption[] | undefined }) {
  const { open, setCreateOpen, form, createMutation, areasValue, setAreasValue, submit } = state;
  const { register, handleSubmit, setValue, watch, formState: { errors } } = form;
  const responsibleAreaId = watch("responsibleAreaId");
  const pending = createMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  const activeAreas = (areas ?? []).filter(a => a.active !== false);
  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) setCreateOpen(o); }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px] max-h-[92dvh] overflow-y-auto")} data-testid="create-criterion-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Plus} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Novo critério"
          description="Entra nos eventos novos. Para levar aos eventos já criados, use “Sincronizar todos os eventos” em Mais ações." />
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <div>
            <FieldLabel htmlFor="create-criterion-name" required>Nome</FieldLabel>
            <input id="create-criterion-name" data-testid="input-criterion-name" autoComplete="off" aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "create-criterion-name-error" : undefined}
              {...register("name", requiredText("Informe o nome do critério."))} placeholder="Ex.: Pontualidade"
              className={cn(inputCls, errors.name && invalidCls)} />
            <FieldErrorText id="create-criterion-name-error" message={errors.name?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="create-criterion-desc" hint="o avaliador lê isto">O que é avaliado</FieldLabel>
            <textarea id="create-criterion-desc" data-testid="input-criterion-desc" rows={2} {...register("description")}
              placeholder="Ex.: chegou no horário combinado e cumpriu o cronograma da montagem."
              className={cn(inputCls, "h-auto min-h-[76px] py-2.5 leading-snug resize-y")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div>
              <FieldLabel htmlFor="create-criterion-weight">Peso padrão</FieldLabel>
              <input id="create-criterion-weight" data-testid="input-criterion-weight" type="number" inputMode="decimal" min="0" step="1"
                aria-invalid={!!errors.defaultWeight} aria-describedby={errors.defaultWeight ? "create-criterion-weight-error" : undefined}
                {...register("defaultWeight", { valueAsNumber: true, validate: v => (v == null || (Number.isFinite(v) && v >= 0)) || "Use um número maior ou igual a zero." })}
                className={cn(inputCls, "tabular-nums", errors.defaultWeight && invalidCls)} />
              <FieldErrorText id="create-criterion-weight-error" message={errors.defaultWeight?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="create-criterion-area" hint="opcional">Área responsável</FieldLabel>
              <Select value={responsibleAreaId != null ? String(responsibleAreaId) : undefined} onValueChange={v => setValue("responsibleAreaId", Number(v))}>
                <SelectTrigger id="create-criterion-area" data-testid="select-criterion-area" className={cn(inputCls, "justify-between")}>
                  <SelectValue placeholder="Selecione a área…" />
                </SelectTrigger>
                <SelectContent>
                  {activeAreas.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <EvaluatingAreasField
            idPrefix="create-criterion-areas"
            value={areasValue}
            onChange={setAreasValue}
            areas={areas}
            responsibleAreaId={responsibleAreaId}
            disabled={pending}
          />
          <div className={cn(dialogFooterCls, "pt-1")}>
            <button type="button" onClick={() => setCreateOpen(false)} disabled={pending} className={btnSecondary}>Cancelar</button>
            <button data-testid="button-submit-criterion" type="submit" disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
              {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Plus size={15} aria-hidden />}
              {pending ? "Criando…" : "Criar critério"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Duplicar para outra área": mesma descrição e peso, outra área responsável. */
export function DuplicateCriterionDialog({ state, areas }: { state: DuplicateCriterionState; areas: AreaOption[] | undefined }) {
  const { duplicateSourceId, duplicateSource, duplicateAreaId, setDuplicateAreaId, duplicateMutation, closeDuplicate, handleDuplicate } = state;
  const open = duplicateSourceId !== null;
  const pending = duplicateMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  const name = displayCriterionName(duplicateSource?.name);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !pending) closeDuplicate(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[500px]")} data-testid="duplicate-criterion-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Copy} Title={DialogTitle} Description={DialogDescription} title="Duplicar para outra área"
          description={<>Cria uma cópia de <span className="font-semibold text-foreground">“{name}”</span> — mesma descrição e peso — com outra área responsável.</>} />
        {duplicateSource && (
          <>
            <div className="rounded-xl border border-border px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
              <span>Hoje:</span>
              {duplicateSource.responsibleAreaName ? <AreaChip name={duplicateSource.responsibleAreaName} responsible /> : <span>sem área</span>}
              <span className="tabular-nums">peso {fmtNum(Number(duplicateSource.defaultWeight), Number.isInteger(Number(duplicateSource.defaultWeight)) ? 0 : 1)}</span>
            </div>
            <div>
              <FieldLabel htmlFor="duplicate-criterion-area" required>Nova área responsável</FieldLabel>
              <Select value={duplicateAreaId} onValueChange={setDuplicateAreaId} disabled={pending}>
                <SelectTrigger id="duplicate-criterion-area" data-testid="select-duplicate-area" className={cn(inputCls, "justify-between")}>
                  <SelectValue placeholder="Selecione a área…" />
                </SelectTrigger>
                <SelectContent>
                  {(areas ?? [])
                    .filter(a => a.id !== duplicateSource.responsibleAreaId && a.active !== false)
                    .map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Notice icon={Info} tone="neutral">
              Para a <span className="font-semibold text-foreground">mesma nota</span> vir de várias áreas (média), prefira “Áreas que avaliam” no critério original — a cópia vira um critério separado, com peso próprio.
            </Notice>
            <div className={dialogFooterCls}>
              <button type="button" onClick={closeDuplicate} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-duplicate" disabled={!duplicateAreaId || pending} aria-busy={pending || undefined}
                onClick={handleDuplicate} className={btnPrimary}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Copy size={15} aria-hidden />}
                {pending ? "Duplicando…" : "Duplicar critério"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Áreas que avaliam" de um critério já existente. */
export function CriterionAreasDialog({ editor, areas }: { editor: CriterionAreasEditor; areas: AreaOption[] | undefined }) {
  const { target, value, setValue, mutation, close, save } = editor;
  const open = target !== null;
  const pending = mutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !pending) close(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px] max-h-[92dvh] overflow-y-auto")} data-testid="criterion-areas-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Users} Title={DialogTitle} Description={DialogDescription} title="Áreas que avaliam"
          description={target ? <><span className="font-semibold text-foreground">{displayCriterionName(target.name)}</span>{target.responsibleAreaName ? <> · responsável: {target.responsibleAreaName}</> : " · sem área responsável"}</> : undefined} />
        {target && (
          <>
            <EvaluatingAreasField
              idPrefix={`criterion-areas-${target.id}`}
              value={value}
              onChange={setValue}
              areas={areas}
              responsibleAreaId={target.responsibleAreaId}
              disabled={pending}
            />
            <div className={dialogFooterCls}>
              <button type="button" onClick={close} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-save-criterion-areas" disabled={pending} aria-busy={pending || undefined} onClick={save} className={btnPrimary}>
                {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
                {pending ? "Salvando…" : "Salvar áreas"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de desativar: o que sai, o que fica (reativar não pede confirmação). */
export function DeactivateCriterionDialog({ target, pending, onConfirm, onClose }: {
  target: Criterion | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(!!target);
  const events = (target as { eventCount?: number } | null)?.eventCount ?? 0;
  return (
    <AlertDialog open={!!target} onOpenChange={o => { if (!o && !pending) onClose(); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[500px]")} data-testid="deactivate-criterion-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {target && (
          <>
            <DialogHeading icon={Power} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
              title={`Desativar “${displayCriterionName(target.name)}”?`}
              description="O critério sai do catálogo ativo. Nada é apagado e dá para reativar depois." />
            <ConsequenceList items={[
              <>Sai dos <span className="font-semibold text-foreground">eventos novos</span> e dos eventos <span className="font-semibold text-foreground">ainda não confirmados</span>.</>,
              <>Eventos já confirmados <span className="font-semibold text-foreground">mantêm</span> o critério e as notas como histórico.</>,
              events > 0 ? <>Hoje aparece em {plural(events, "evento", "eventos")}, contando os já confirmados.</> : <>Hoje não aparece em nenhum evento.</>,
            ]} />
            <div className={dialogFooterCls}>
              <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-deactivate" onClick={onConfirm} disabled={pending} aria-busy={pending || undefined} className={btnDanger}>
                {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Power size={15} aria-hidden />}
                {pending ? "Desativando…" : "Desativar"}
              </button>
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
