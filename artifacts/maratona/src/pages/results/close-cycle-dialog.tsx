import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { LockKeyhole } from "lucide-react";
import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";

/** Botão "Fechar Ciclo" + confirmação (com fechamento forçado). O estado fica na aba Bônus & Pagamentos. */
export function CloseCycleDialog({
  forceClose,
  setForceClose,
  forceReason,
  setForceReason,
  onConfirm,
  isPending,
}: {
  forceClose: boolean;
  setForceClose: (v: boolean) => void;
  forceReason: string;
  setForceReason: (v: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <AlertDialog onOpenChange={(o) => { if (!o) { setForceClose(false); setForceReason(""); } }}>
      <AlertDialogTrigger asChild>
        <button
          data-testid="button-close-quarter"
          className="rounded-lg px-4 py-2.5 font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
          style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <LockKeyhole size={15} /> Fechar Ciclo
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: "var(--primary)" }}>
            <LockKeyhole size={22} style={{ color: "var(--primary-foreground)" }} />
          </div>
          <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Consolidar Resultados do Ciclo?</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            O fechamento irá congelar as notas, calcular as faixas de bônus e gerar a projeção de premiação baseada nos eventos já finalizados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4 px-4 rounded-lg mt-2" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
          <div className="flex items-start gap-3">
            <Checkbox
              id="force-close"
              data-testid="checkbox-force-close"
              checked={forceClose}
              onCheckedChange={(c) => setForceClose(c === true)}
              className="mt-0.5"
              style={{ borderColor: WARNING }}
            />
            <Label htmlFor="force-close" className="text-sm font-bold leading-snug cursor-pointer" style={{ color: "var(--foreground)" }}>
              Existem eventos pendentes. Forçar o fechamento ignorando esses eventos?
            </Label>
          </div>
          {forceClose && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
              <Label htmlFor="force-reason" className="text-xs font-black uppercase tracking-wide" style={{ color: DANGER_TEXT }}>Justificativa Obrigatória</Label>
              <Textarea
                id="force-reason"
                data-testid="input-force-reason"
                value={forceReason}
                onChange={(e) => setForceReason(e.target.value)}
                placeholder="Por que o ciclo deve ser fechado agora?"
                className="rounded-lg"
                style={fieldStyle}
                rows={3}
              />
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs tracking-wide" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending || (forceClose && !forceReason.trim())}
            className="rounded-lg font-bold uppercase text-xs tracking-wide"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {isPending ? "Processando..." : "Confirmar Fechamento"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
