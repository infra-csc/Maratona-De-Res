import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Copy } from "lucide-react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, requiredText } from "./helpers";
import { FieldError } from "./form-bits";
import type { CreateCriterionForm, DuplicateCriterionState } from "./use-criterion-forms";
import type { AreaOption, ResyncSummary } from "./types";

/** Conteúdo do diálogo "Novo Critério de Avaliação" (o botão que abre fica no cabeçalho). */
export function CreateCriterionDialog({ state, areas }: { state: CreateCriterionForm; areas: AreaOption[] | undefined }) {
  const { open, setCreateOpen, form, createMutation } = state;
  const { register, handleSubmit, setValue, formState: { errors } } = form;
  return (
    <Dialog open={open} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Novo Critério de Avaliação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, name: d.name.trim(), defaultWeight: Number(d.defaultWeight) } }))} className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Input data-testid="input-criterion-name" aria-invalid={!!errors.name} {...register("name", requiredText("Informe o nome do critério."))} placeholder="Ex: Pontualidade" className="h-11 rounded-lg" style={fieldStyle} />
            <FieldError message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Descrição do que é avaliado</Label>
            <Input data-testid="input-criterion-desc" {...register("description")} placeholder="Instruções para o avaliador..." className="h-11 rounded-lg" style={fieldStyle} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Peso Padrão</Label>
            <Input
              data-testid="input-criterion-weight"
              type="number"
              min="0"
              step="1"
              aria-invalid={!!errors.defaultWeight}
              {...register("defaultWeight", { valueAsNumber: true, validate: v => (v == null || (Number.isFinite(v) && v >= 0)) || "Informe um peso maior ou igual a zero." })}
              className="h-11 rounded-lg"
              style={fieldStyle}
            />
            <FieldError message={errors.defaultWeight?.message} />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área Responsável (Opcional)</Label>
            <Select onValueChange={v => setValue("responsibleAreaId", Number(v))}>
              <SelectTrigger data-testid="select-criterion-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {(areas ?? []).map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button type="button" onClick={() => setCreateOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-submit-criterion"
              type="submit"
              disabled={createMutation.isPending}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {createMutation.isPending ? "Criando..." : "Criar Critério"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo "Duplicar Critério": mesma descrição e peso, outra área responsável. */
export function DuplicateCriterionDialog({ state, areas }: { state: DuplicateCriterionState; areas: AreaOption[] | undefined }) {
  const { duplicateSourceId, duplicateSource, duplicateAreaId, setDuplicateAreaId, duplicateMutation, closeDuplicate, handleDuplicate } = state;
  return (
    <Dialog open={duplicateSourceId !== null} onOpenChange={(v) => { if (!v) closeDuplicate(); }}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <Copy size={18} /> Duplicar Critério
          </DialogTitle>
        </DialogHeader>
        {duplicateSource && (
          <div className="space-y-5 pt-2">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Cria uma cópia de <span className="font-bold" style={{ color: "var(--foreground)" }}>"{duplicateSource.name}"</span> (mesma descrição e peso) vinculada a outra área. Útil quando mais de uma área avalia o mesmo quesito e a nota final é a média entre elas.
            </p>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nova Área Responsável <span style={{ color: DANGER_TEXT }}>*</span></Label>
              <Select value={duplicateAreaId} onValueChange={setDuplicateAreaId}>
                <SelectTrigger data-testid="select-duplicate-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                  <SelectValue placeholder="Selecione a área..." />
                </SelectTrigger>
                <SelectContent>
                  {(areas ?? [])
                    .filter(a => a.id !== duplicateSource.responsibleAreaId)
                    .map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={closeDuplicate} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
              <button
                type="button"
                data-testid="button-confirm-duplicate"
                disabled={!duplicateAreaId || duplicateMutation.isPending}
                onClick={handleDuplicate}
                className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {duplicateMutation.isPending ? "Duplicando..." : "Duplicar Critério"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Resumo de "Sync. Todos os Eventos": contadores + lista por evento. */
export function ResyncSummaryDialog({ summary, onClose }: { summary: ResyncSummary | null; onClose: () => void }) {
  return (
    <Dialog open={summary != null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Sincronização em Massa</DialogTitle>
        </DialogHeader>
        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { val: summary.processed, label: "Atualizados" },
                { val: summary.totalAdded, label: "Adicionados" },
                { val: summary.totalActivated, label: "Reativados" },
                { val: summary.totalDeactivated, label: "Desativados" },
              ].map((s, i) => (
                <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "var(--secondary)" }}>
                  <p className="text-2xl font-black" style={{ fontFamily: CONDENSED }}>{s.val}</p>
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                </div>
              ))}
            </div>
            {summary.skipped > 0 && (
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {summary.skipped} evento(s) pulado(s) por erro interno.
              </p>
            )}
            {summary.processed === 0 && summary.skipped === 0 && (
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Todos os eventos já estavam sincronizados com o catálogo ativo.
              </p>
            )}
            {summary.events.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
                {summary.events.map((ev, i) => (
                  <div key={ev.id} className="px-4 py-2 flex items-center justify-between gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                    <span className="font-bold uppercase text-xs truncate">{ev.name}</span>
                    <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                      +{ev.added} novo(s){ev.activated > 0 ? ` ↺${ev.activated} reativado(s)` : ""}{ev.deactivated > 0 ? ` -${ev.deactivated}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            Fechar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
