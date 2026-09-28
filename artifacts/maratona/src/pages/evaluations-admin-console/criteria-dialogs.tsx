import type { EventDetail } from "@workspace/api-client-react";
import { Copy, Trash2, Users, AlertTriangle } from "lucide-react";
import { CONDENSED, WARNING, GOOD_TEXT, AMBER_TEXT } from "@/lib/premium-theme";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fieldStyle } from "./helpers";
import type { CriteriaManagement } from "./use-criteria-management";
import type { EnrichedEvent } from "./types";

/** Aba Critérios — diálogos de duplicar, excluir cópia, remover critério e corrigir origem. */
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
        <DialogContent className="rounded-xl max-w-md" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tight text-lg" style={{ fontFamily: CONDENSED }}>Duplicar Quesito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label htmlFor="duplicate-event-criterion-name" className="text-[11px] font-black uppercase" style={{ color: "var(--muted-foreground)" }}>Nome do novo quesito</label>
              <Input id="duplicate-event-criterion-name" value={duplicateName} onChange={e => setDuplicateName(e.target.value)} className="rounded-lg font-black text-sm h-10" style={fieldStyle} autoFocus />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="duplicate-event-criterion-area" className="text-[11px] font-black uppercase" style={{ color: "var(--muted-foreground)" }}>
                Área responsável <span className="font-normal normal-case" style={{ color: "var(--muted-foreground)" }}>(opcional — padrão: mesma área de origem)</span>
              </label>
              <Select value={duplicateAreaId} onValueChange={setDuplicateAreaId}>
                <SelectTrigger id="duplicate-event-criterion-area" className="rounded-lg font-bold text-sm h-10" style={fieldStyle}>
                  <SelectValue placeholder="Manter área original..." />
                </SelectTrigger>
                <SelectContent>
                  {(areasList ?? []).map(a => (
                    <SelectItem key={a.id} value={a.id.toString()} className="font-bold">{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {duplicateAreaId && (
              <p className="text-[11px] font-bold" style={{ color: GOOD_TEXT }}>
                O novo quesito será vinculado à área selecionada. Os avaliadores da nova área aparecerão para atribuição.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <button type="button" onClick={() => setDuplicateDialog(null)} className="px-4 py-2 rounded-lg font-bold uppercase text-xs transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
            <button
              type="button"
              disabled={duplicateCriterion.isPending || !duplicateName.trim()}
              onClick={handleConfirmDuplicate}
              className="px-4 py-2 rounded-lg font-black uppercase text-xs disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <Copy size={13} className="inline mr-1.5" />
              {duplicateCriterion.isPending ? "Duplicando..." : "Duplicar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={o => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase font-black tracking-tight">Excluir cópia?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
              Esta cópia será <strong>removida permanentemente</strong> deste evento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-criterion" className="rounded-lg uppercase font-bold" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-criterion"
              onClick={() => { if (pendingDelete !== null && selected) deleteCriterion.mutate({ id: selected.id, eventCriterionId: pendingDelete }); setPendingDelete(null); }}
              className="rounded-lg uppercase font-bold"
              style={{ backgroundColor: WARNING, color: "#fff" }}
            >
              <Trash2 size={16} className="mr-1.5" /> Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingRemoval !== null} onOpenChange={o => { if (!o) setPendingRemoval(null); }}>
        <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase font-black tracking-tight">Remover critério?</AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
              O critério <strong>{critMeta.get(pendingRemoval ?? -1)?.criterionName ?? ""}</strong> deixará de ser avaliado neste evento. Você precisará redistribuir o peso dele entre os critérios restantes para que a soma volte a ser <strong>{fmtW(targetWeightSum)}</strong> antes de salvar ou confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-remove-criterion" className="rounded-lg uppercase font-bold" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-remove-criterion"
              onClick={() => { if (pendingRemoval !== null) { setCriterionActive(pendingRemoval, false); setPendingRemoval(null); } }}
              className="rounded-lg uppercase font-bold"
              style={{ backgroundColor: WARNING, color: "#fff" }}
            >
              <Trash2 size={16} className="mr-1.5" /> Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={swapDialog !== null} onOpenChange={o => { if (!o) { setSwapDialog(null); setSwapSourceId(""); } }}>
        <DialogContent className="rounded-xl max-w-md" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tight text-lg" style={{ fontFamily: CONDENSED }}>Corrigir Origem do Duplicado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
              Quesito duplicado: <span style={{ color: "var(--foreground)" }}>{swapDialog?.currentName}</span>
            </p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              As avaliações existentes permanecem vinculadas — só o critério de origem muda. A calibração passará a mesclar este duplicado com o novo critério escolhido.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="swap-source-criterion" className="text-[11px] font-black uppercase" style={{ color: "var(--muted-foreground)" }}>Novo critério de origem *</label>
              <Select value={swapSourceId} onValueChange={setSwapSourceId}>
                <SelectTrigger id="swap-source-criterion" className="h-9 rounded-lg text-sm font-bold" style={{ border: "1px solid var(--border)" }}>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  {(selectedDetail?.criteria ?? [])
                    .filter(c => !c.eventScoped && c.active)
                    .map(c => (
                      <SelectItem key={c.criterionId} value={c.criterionId.toString()} className="text-sm font-bold">
                        {c.criterionName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => { setSwapDialog(null); setSwapSourceId(""); }} className="h-9 px-4 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
            <button type="button" disabled={!swapSourceId || swapPending} onClick={handleSwapSource} className="h-9 px-4 rounded-lg text-[11px] font-bold uppercase disabled:opacity-40 transition-colors hover:opacity-90" style={{ backgroundColor: WARNING, color: "#fff" }}>
              {swapPending ? "Salvando..." : "Confirmar correção"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={areasDialog !== null} onOpenChange={o => { if (!o && !setCriterionAreas.isPending) setAreasDialog(null); }}>
        <DialogContent className="rounded-xl max-w-md max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="uppercase font-black tracking-tight text-lg flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <Users size={18} aria-hidden="true" /> Áreas que avaliam
            </DialogTitle>
          </DialogHeader>
          {areasDialog && (
            <div className="space-y-4 py-1">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                <span className="font-bold" style={{ color: "var(--foreground)" }}>{areasDialog.name}</span> neste evento. Cada área marcada responde o critério e a nota é a média das áreas. O padrão do catálogo não muda.
              </p>
              <fieldset className="rounded-lg p-3 space-y-2 max-h-72 overflow-y-auto" style={{ border: "1px solid var(--border)" }} disabled={setCriterionAreas.isPending}>
                <legend className="px-1 text-[11px] font-black uppercase" style={{ color: "var(--muted-foreground)" }}>Áreas</legend>
                {areasDialog.responsibleAreaId != null && (
                  <label htmlFor="event-criterion-area-responsible" className="flex items-center gap-2 text-xs font-bold uppercase opacity-70">
                    <input id="event-criterion-area-responsible" type="checkbox" checked disabled readOnly className="h-4 w-4 shrink-0" />
                    {areasDialog.responsibleAreaName ?? `Área ${areasDialog.responsibleAreaId}`}
                    <span className="normal-case font-normal">(responsável)</span>
                  </label>
                )}
                {areaOptions.map(a => {
                  const id = `event-criterion-area-${a.id}`;
                  return (
                    <label key={a.id} htmlFor={id} className="flex items-center gap-2 text-xs font-bold uppercase cursor-pointer">
                      <input
                        id={id}
                        type="checkbox"
                        data-testid={`checkbox-event-criterion-area-${a.id}`}
                        checked={areasSelection.includes(a.id)}
                        onChange={e => setAreasSelection(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id))}
                        className="h-4 w-4 shrink-0"
                      />
                      {a.name}
                    </label>
                  );
                })}
                {areaOptions.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Não há outras áreas ativas.</p>
                )}
              </fieldset>
              {doomedCopies.length > 0 && (
                <p role="note" className="flex items-start gap-2 text-xs font-bold" style={{ color: AMBER_TEXT }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
                  Ao salvar, sai também a cópia feita à mão na mesma área: {doomedCopies.map(c => c.criterionName).join(", ")}.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <button type="button" disabled={setCriterionAreas.isPending} onClick={() => setAreasDialog(null)} className="px-4 py-2 rounded-lg font-bold uppercase text-xs disabled:opacity-40 transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
            <button
              type="button"
              data-testid="button-save-event-criterion-areas"
              disabled={setCriterionAreas.isPending}
              onClick={handleSaveAreas}
              className="px-4 py-2 rounded-lg font-black uppercase text-xs disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {setCriterionAreas.isPending ? "Salvando..." : "Salvar áreas"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
