import { CornerDownRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CONDENSED } from "@/lib/premium-theme";
import type { RedirectDialogArea, RedirectOption } from "./types";

interface RedirectFormDialogProps {
  area: RedirectDialogArea | null;
  targetId: number | null;
  onTargetChange: (userId: number) => void;
  options: RedirectOption[];
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

// Redirect dialog — avaliador redireciona o formulário inteiro (todos os critérios da área)
export function RedirectFormDialog({ area, targetId, onTargetChange, options, isPending, onClose, onConfirm }: RedirectFormDialogProps) {
  return (
    <Dialog open={area !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-xl border-border" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <CornerDownRight size={18} /> Redirecionar Formulário
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {area != null && (
            <div className="bg-secondary border border-border rounded-lg px-4 py-3">
              <p className="text-[11px] font-black uppercase text-muted-foreground mb-0.5">Formulário</p>
              <p className="text-sm font-black uppercase">{area.areaName}</p>
              {area.criteriaIds.length > 1 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {area.criteriaIds.length} critérios serão transferidos juntos.
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Selecione quem assumirá a responsabilidade por este formulário. Após a confirmação, todos os critérios saem da sua lista e passam para o usuário escolhido.
          </p>
          {options.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border rounded-lg font-bold text-muted-foreground text-xs uppercase">
              Nenhuma opção de redirecionamento disponível para este critério.
            </div>
          ) : (
            <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
              {options.map((opt) => (
                <label key={opt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary cursor-pointer">
                  <input
                    type="radio"
                    name="redirect-target"
                    checked={targetId === opt.id}
                    onChange={() => onTargetChange(opt.id)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm font-bold uppercase">{opt.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {targetId != null && (
          <div className="bg-accent/10 border border-accent rounded-lg px-4 py-3 text-xs font-bold text-accent-text">
            ↳ Confirmar: transferir para <strong>{options.find(o => o.id === targetId)?.name ?? "?"}</strong>. Esta ação é imediata.
          </div>
        )}
        <DialogFooter className="gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-border rounded-lg px-5 py-2.5 font-bold uppercase text-xs hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={targetId === null || isPending}
            onClick={onConfirm}
            className="bg-primary text-primary-foreground border border-primary rounded-lg px-5 py-2.5 font-bold uppercase text-xs disabled:opacity-50"
          >
            {isPending ? "Redirecionando..." : "Confirmar Transferência"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
