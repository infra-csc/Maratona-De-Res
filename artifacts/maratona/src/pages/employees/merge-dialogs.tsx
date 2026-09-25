import type { MergeEmployeeResult } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GitMerge } from "lucide-react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import type { EmployeeWithCycle } from "./types";

/** Barra fixa do modo mesclagem: escolhe o CANÔNICO entre os selecionados e abre a confirmação. */
export function MergeActionBar({
  employees,
  selectedIds,
  canonicalId,
  onSelectCanonical,
  onRequestMerge,
  isPending,
}: {
  employees: EmployeeWithCycle[] | undefined;
  selectedIds: Set<number>;
  canonicalId: number | null;
  onSelectCanonical: (id: number) => void;
  onRequestMerge: () => void;
  isPending: boolean;
}) {
  return (
    <section className="sticky bottom-4 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4" style={{ backgroundColor: "var(--card)", border: `1px solid var(--primary)` }}>
      <div className="flex-1">
        <p className="font-black uppercase text-sm">{selectedIds.size} colaboradores selecionados</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Selecione qual é o CANÔNICO (o que permanece):</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {Array.from(selectedIds).map(id => {
            const emp = (employees ?? []).find(e => e.id === id);
            if (!emp) return null;
            return (
              <button
                key={id}
                onClick={e => { e.stopPropagation(); onSelectCanonical(id); }}
                className="px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-colors"
                style={canonicalId === id ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
              >
                {emp.name}
              </button>
            );
          })}
        </div>
      </div>
      <button
        disabled={!canonicalId || isPending}
        onClick={() => { if (canonicalId) onRequestMerge(); }}
        className="px-5 py-3 rounded-lg font-black text-sm uppercase flex items-center gap-2 disabled:opacity-40 shrink-0 transition-opacity hover:opacity-90"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        <GitMerge size={16} />
        {isPending ? "Mesclando..." : `Mesclar → Manter "${(employees ?? []).find(e => e.id === canonicalId)?.name ?? "?"}"`}
      </button>
    </section>
  );
}

/** Confirmação da mesclagem: apaga os registros duplicados e seus resultados. */
export function MergeConfirmDialog({
  open,
  onOpenChange,
  employees,
  selectedIds,
  canonicalId,
  isPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: EmployeeWithCycle[] | undefined;
  selectedIds: Set<number>;
  canonicalId: number | null;
  isPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GitMerge size={18} /> Confirmar mesclagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          <p>
            Vai manter <strong>{(employees ?? []).find(e => e.id === canonicalId)?.name ?? "?"}</strong> e transferir para ele as participações em eventos e faltas de:
          </p>
          <ul className="rounded-lg text-xs divide-y max-h-40 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
            {Array.from(selectedIds).filter(id => id !== canonicalId).map(id => (
              <li key={id} className="px-3 py-1.5">{(employees ?? []).find(e => e.id === id)?.name ?? `#${id}`}</li>
            ))}
          </ul>
          <p className="text-xs font-semibold" style={{ color: "#b3261e" }}>
            Os registros duplicados e os resultados de ciclo calculados para eles são apagados. Não dá para desfazer.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={() => onOpenChange(false)} disabled={isPending} className="h-9 px-4 rounded-lg text-sm font-bold uppercase disabled:opacity-50" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
          <button
            type="button"
            disabled={!canonicalId || isPending}
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg text-sm font-black uppercase flex items-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <GitMerge size={14} /> {isPending ? "Mesclando..." : "Mesclar e apagar duplicados"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Resumo da mesclagem concluída. */
export function MergeResultDialog({
  mergeResult,
  onClose,
}: {
  mergeResult: MergeEmployeeResult | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!mergeResult} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}><GitMerge size={20} /> Mesclagem Concluída</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg p-4 space-y-2 text-sm" style={{ backgroundColor: "var(--secondary)" }}>
            <p><span className="font-black">{mergeResult?.merged.length ?? 0}</span> duplicata(s) removida(s)</p>
            <p><span className="font-black">{mergeResult?.movedParticipations ?? 0}</span> participações transferidas</p>
            {(mergeResult?.movedAbsences ?? 0) > 0 && <p><span className="font-black">{mergeResult?.movedAbsences}</span> penalidades/méritos transferidos</p>}
            {(mergeResult?.movedEvaluatorEvals ?? 0) > 0 && <p><span className="font-black">{mergeResult?.movedEvaluatorEvals}</span> avaliações de avaliador transferidas</p>}
            {(mergeResult?.removedUsers ?? 0) > 0 && <p style={{ color: DANGER_TEXT }}><span className="font-black">{mergeResult?.removedUsers}</span> conta(s) de usuário desativada(s)</p>}
          </div>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Agora você pode usar "Gerar Acessos em Massa" para criar as credenciais dos colaboradores mesclados.</p>
          <div className="flex justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => onClose()} className="h-10 px-4 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Fechar</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
