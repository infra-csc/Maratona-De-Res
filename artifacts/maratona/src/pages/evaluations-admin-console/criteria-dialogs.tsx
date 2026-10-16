import type { EventDetail } from "@workspace/api-client-react";
import { Copy, Trash2, Users, AlertTriangle, GitCompareArrows, Loader2, MinusCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { DialogHeading, Eyebrow, Notice, btnPrimary, btnSecondary, dialogCls, fieldCls, inputCls } from "./console-ui";
import type { CriteriaManagement } from "./use-criteria-management";
import type { EnrichedEvent } from "./types";

const labelCls = "font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-foreground mb-1.5";
const dangerBtn = cn(btnSecondary, "bg-[var(--destructive)] text-[var(--destructive-foreground)] border-transparent enabled:hover:bg-[var(--destructive)] enabled:hover:opacity-90");
const footerCls = "gap-2 sm:gap-2 sm:space-x-0";
const spin = <Loader2 size={15} className="animate-spin" aria-hidden />;

/** Aba Critérios — diálogos de duplicar, excluir cópia, remover critério, corrigir origem e áreas. */
export function CriteriaDialogs({ mgmt, selected, selectedDetail }: {
  mgmt: CriteriaManagement;
  selected: EnrichedEvent;
  selectedDetail: EventDetail;
}) {
  const {
    pendingRemoval, setPendingRemoval, pendingDelete, setPendingDelete,
    duplicateDialog, setDuplicateDialog, duplicateName, setDuplicateName, duplicateAreaId, setDuplicateAreaId,
    swapDialog, setSwapDialog, swapSourceId, setSwapSourceId, swapPending,
    areasList, duplicateCriterion, deleteCriterion,
    critMeta, targetWeightSum, setCriterionActive, handleConfirmDuplicate, handleSwapSource, fmtW,
    areasDialog, setAreasDialog, areasSelection, setAreasSelection, setCriterionAreas, handleSaveAreas, sameAreaCopiesOf,
  } = mgmt;
  const areaOptions = (areasList ?? []).filter(a => a.active !== false && a.id !== areasDialog?.responsibleAreaId);
  const doomedCopies = areasDialog ? sameAreaCopiesOf(areasDialog.criterionId) : [];
  return (
    <>
      <Dialog open={duplicateDialog !== null} onOpenChange={o => { if (!o) setDuplicateDialog(null); }}>
        <DialogContent className={dialogCls} data-testid="dialog-duplicate-criterion">
          <DialogHeading icon={Copy} Title={DialogTitle} Description={DialogDescription}
            title="Duplicar quesito"
            description="Cria uma cópia deste critério só neste evento — por exemplo, para outra área responder." />
          <div className="space-y-4">
            <div>
              <label htmlFor="duplicate-event-criterion-name" className={labelCls}>Nome do novo quesito</label>
              <input id="duplicate-event-criterion-name" value={duplicateName} onChange={e => setDuplicateName(e.target.value)} className={inputCls} autoFocus autoComplete="off" />
              {!duplicateName.trim() && <p className="mt-1.5 text-[12.5px] text-[var(--status-danger-text)]">Dê um nome ao quesito.</p>}
            </div>
            <div>
              <label htmlFor="duplicate-event-criterion-area" className={labelCls}>
                Área responsável <span className="font-body normal-case tracking-normal font-normal text-muted-foreground">(opcional — padrão: a mesma do original)</span>
              </label>
              <Select value={duplicateAreaId} onValueChange={setDuplicateAreaId}>
                <SelectTrigger id="duplicate-event-criterion-area" className={cn(fieldCls, "h-11 text-[15px]")}>
                  <SelectValue placeholder="Manter a área original" />
                </SelectTrigger>
                <SelectContent>
                  {(areasList ?? []).map(a => (
                    <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {duplicateAreaId && (
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">O novo quesito fica com a área escolhida; os avaliadores dela aparecem para atribuição.</p>
              )}
            </div>
          </div>
          <DialogFooter className={footerCls}>
            <button type="button" onClick={() => setDuplicateDialog(null)} className={btnSecondary}>Cancelar</button>
            <button type="button" disabled={duplicateCriterion.isPending || !duplicateName.trim()} onClick={handleConfirmDuplicate} className={btnPrimary}>
              {duplicateCriterion.isPending ? spin : <Copy size={15} aria-hidden />} {duplicateCriterion.isPending ? "Duplicando..." : "Duplicar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={o => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent className={dialogCls}>
          <DialogHeading icon={Trash2} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
            title="Excluir cópia?"
            description={<>Esta cópia será <b className="font-semibold text-foreground">removida permanentemente</b> deste evento.</>} />
          <AlertDialogFooter className={footerCls}>
            <AlertDialogCancel data-testid="button-cancel-delete-criterion" className={cn(btnSecondary, "mt-0")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-criterion"
              onClick={() => { if (pendingDelete !== null && selected) deleteCriterion.mutate({ id: selected.id, eventCriterionId: pendingDelete }); setPendingDelete(null); }}
              className={dangerBtn}
            >
              <Trash2 size={15} aria-hidden /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingRemoval !== null} onOpenChange={o => { if (!o) setPendingRemoval(null); }}>
        <AlertDialogContent className={dialogCls}>
          <DialogHeading icon={MinusCircle} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
            title="Remover critério?"
            description={<><b className="font-semibold text-foreground">{displayCriterionName(critMeta.get(pendingRemoval ?? -1)?.criterionName)}</b> deixa de ser avaliado neste evento. Redistribua o peso dele entre os demais para a soma voltar a <b className="font-semibold text-foreground">{fmtW(targetWeightSum)}</b> antes de salvar ou confirmar.</>} />
          <AlertDialogFooter className={footerCls}>
            <AlertDialogCancel data-testid="button-cancel-remove-criterion" className={cn(btnSecondary, "mt-0")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-remove-criterion"
              onClick={() => { if (pendingRemoval !== null) { setCriterionActive(pendingRemoval, false); setPendingRemoval(null); } }}
              className={dangerBtn}
            >
              <MinusCircle size={15} aria-hidden /> Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={swapDialog !== null} onOpenChange={o => { if (!o) { setSwapDialog(null); setSwapSourceId(""); } }}>
        <DialogContent className={dialogCls} data-testid="dialog-swap-source">
          <DialogHeading icon={GitCompareArrows} tone="danger" Title={DialogTitle} Description={DialogDescription}
            title="Corrigir origem do duplicado"
            description={<>Quesito duplicado: <b className="font-semibold text-foreground">{swapDialog?.currentName}</b>.</>} />
          <div className="space-y-4">
            <Notice icon={AlertTriangle} tone="warn">
              As avaliações existentes continuam ligadas — só o critério de origem muda. A calibração passa a mesclar este duplicado com o critério escolhido.
            </Notice>
            <div>
              <label htmlFor="swap-source-criterion" className={labelCls}>Novo critério de origem <span className="text-[var(--status-danger-text)]">· obrigatório</span></label>
              <Select value={swapSourceId} onValueChange={setSwapSourceId}>
                <SelectTrigger id="swap-source-criterion" className={cn(fieldCls, "h-11 text-[15px]")}>
                  <SelectValue placeholder="Escolha o critério" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedDetail?.criteria ?? [])
                    .filter(c => !c.eventScoped && c.active)
                    .map(c => (
                      <SelectItem key={c.criterionId} value={c.criterionId.toString()}>{displayCriterionName(c.criterionName)}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className={footerCls}>
            <button type="button" onClick={() => { setSwapDialog(null); setSwapSourceId(""); }} className={btnSecondary}>Cancelar</button>
            <button type="button" disabled={!swapSourceId || swapPending} onClick={handleSwapSource} className={dangerBtn}>
              {swapPending ? spin : null} {swapPending ? "Salvando..." : "Confirmar correção"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={areasDialog !== null} onOpenChange={o => { if (!o && !setCriterionAreas.isPending) setAreasDialog(null); }}>
        <DialogContent className={dialogCls} data-testid="dialog-criterion-areas">
          <DialogHeading icon={Users} Title={DialogTitle} Description={DialogDescription}
            title="Áreas que avaliam"
            description={areasDialog ? <><b className="font-semibold text-foreground">{areasDialog.name}</b> neste evento. Cada área marcada responde o critério e a nota é a média das áreas. O padrão do catálogo não muda.</> : null} />
          {areasDialog && (
            <div className="space-y-3">
              <fieldset className="rounded-xl border border-border divide-y divide-border max-h-72 overflow-y-auto" disabled={setCriterionAreas.isPending}>
                <legend className="sr-only">Áreas</legend>
                {areasDialog.responsibleAreaId != null && (
                  <label htmlFor="event-criterion-area-responsible" className="flex items-center gap-3 px-3.5 min-h-11 text-[14px] text-muted-foreground">
                    <input id="event-criterion-area-responsible" type="checkbox" checked disabled readOnly className="h-[18px] w-[18px] accent-[var(--primary)] shrink-0" />
                    <span className="font-semibold text-foreground">{areasDialog.responsibleAreaName ?? `Área ${areasDialog.responsibleAreaId}`}</span>
                    <Eyebrow as="span" className="ml-auto">Responsável</Eyebrow>
                  </label>
                )}
                {areaOptions.map(a => {
                  const id = `event-criterion-area-${a.id}`;
                  return (
                    <label key={a.id} htmlFor={id} className="flex items-center gap-3 px-3.5 min-h-11 text-[14px] cursor-pointer transition-colors duration-150 hover:bg-secondary/50">
                      <input
                        id={id}
                        type="checkbox"
                        data-testid={`checkbox-event-criterion-area-${a.id}`}
                        checked={areasSelection.includes(a.id)}
                        onChange={e => setAreasSelection(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id))}
                        className="h-[18px] w-[18px] accent-[var(--primary)] shrink-0"
                      />
                      <span className="text-foreground">{a.name}</span>
                    </label>
                  );
                })}
                {areaOptions.length === 0 && (
                  <p className="px-3.5 py-3 text-[13px] text-muted-foreground">Não há outras áreas ativas.</p>
                )}
              </fieldset>
              {doomedCopies.length > 0 && (
                <Notice icon={AlertTriangle} tone="warn">
                  Ao salvar, sai também a cópia feita à mão na mesma área: {doomedCopies.map(c => displayCriterionName(c.criterionName)).join(", ")}.
                </Notice>
              )}
            </div>
          )}
          <DialogFooter className={footerCls}>
            <button type="button" disabled={setCriterionAreas.isPending} onClick={() => setAreasDialog(null)} className={btnSecondary}>Cancelar</button>
            <button type="button" data-testid="button-save-event-criterion-areas" disabled={setCriterionAreas.isPending} onClick={handleSaveAreas} className={btnPrimary}>
              {setCriterionAreas.isPending ? spin : null} {setCriterionAreas.isPending ? "Salvando..." : "Salvar áreas"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
