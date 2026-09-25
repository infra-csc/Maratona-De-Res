import type { User } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { GitMerge, X } from "lucide-react";
import { CONDENSED, GOOD, DANGER_TEXT } from "@/lib/premium-theme";
import type { UserMergeState } from "./use-user-merge";

/** Barra flutuante da mescla (aparece com 2+ selecionados) com a confirmação. */
export function MergeActionBar({ merge, sortedUsers }: { merge: UserMergeState; sortedUsers: User[] }) {
  const { mergeMode, selectedIds, canonicalId, mergeMutation, confirmMerge, cancelMerge } = merge;
  if (!(mergeMode && selectedIds.size >= 2)) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-4 flex items-center gap-6 min-w-[500px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--primary)" }}>
      <div className="flex-1">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent-text)" }}>Mescla de Avaliadores</p>
        <p className="text-sm font-bold mt-0.5">
          {selectedIds.size} selecionados
          {canonicalId ? ` — canônico: ${sortedUsers.find(u => u.id === canonicalId)?.name ?? canonicalId}` : " — defina o canônico nas ações"}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            disabled={!canonicalId || mergeMutation.isPending}
            className="px-4 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            <GitMerge size={16} /> Mesclar Agora
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Confirmar Mescla?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2" style={{ color: "var(--muted-foreground)" }}>
              <span className="block">O usuário canônico <strong style={{ color: "var(--foreground)" }}>{sortedUsers.find(u => u.id === canonicalId)?.name}</strong> receberá todas as avaliações e calibrações dos {selectedIds.size - 1} usuário(s) duplicado(s):</span>
              <ul className="list-disc pl-4 text-xs">
                {[...selectedIds].filter(id => id !== canonicalId).map(id => (
                  <li key={id}>{sortedUsers.find(u => u.id === id)?.name ?? id}</li>
                ))}
              </ul>
              <span className="block font-bold" style={{ color: DANGER_TEXT }}>Os duplicados serão desativados. Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg font-bold uppercase text-xs disabled:opacity-50"
              style={{ backgroundColor: GOOD, color: "#fff" }}
              disabled={mergeMutation.isPending}
              onClick={confirmMerge}
            >
              <GitMerge size={14} className="mr-2" /> Confirmar Mescla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <button
        onClick={cancelMerge}
        className="p-2 rounded-lg transition-colors hover:opacity-70"
        title="Cancelar"
      >
        <X size={18} />
      </button>
    </div>
  );
}

/** Diálogo "Mescla Concluída" com o que foi transferido para o canônico. */
export function MergeResultDialog({ merge }: { merge: UserMergeState }) {
  const { mergeResult, setMergeResult } = merge;
  return (
    <Dialog open={mergeResult !== null} onOpenChange={v => !v && setMergeResult(null)}>
      <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <GitMerge size={22} style={{ color: "var(--accent-text)" }} /> Mescla Concluída
          </DialogTitle>
        </DialogHeader>
        {mergeResult && (
          <div className="pt-4 space-y-4">
            <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(154,176,0,0.10)", border: `1px solid ${GOOD}` }}>
              <p className="text-sm font-bold">
                {mergeResult.merged.length} usuário(s) mesclado(s) no canônico
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {[
                { val: mergeResult.movedEvaluations ?? 0, label: "Avaliações transferidas" },
                { val: mergeResult.movedCalibrations ?? 0, label: "Calibrações transferidas" },
                { val: mergeResult.movedAssignments ?? 0, label: "Atribuições transferidas" },
                { val: mergeResult.movedConformities ?? 0, label: "Conformidades transferidas" },
              ].map((s, i) => (
                <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "var(--secondary)" }}>
                  <p className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{s.val}</p>
                  <p className="text-[11px] font-bold uppercase mt-1" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setMergeResult(null)}
              className="w-full h-11 rounded-lg font-bold text-sm uppercase tracking-wide transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Fechar
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
