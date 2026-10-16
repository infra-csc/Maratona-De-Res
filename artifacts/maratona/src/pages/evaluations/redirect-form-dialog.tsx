import { CornerDownRight, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { DialogHeading, Eyebrow, btnPrimary, btnSecondary, dialogCls } from "./ui";
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

// Avaliador redireciona o formulário inteiro (todos os critérios da área).
export function RedirectFormDialog({ area, targetId, onTargetChange, options, isPending, onClose, onConfirm }: RedirectFormDialogProps) {
  const target = options.find(o => o.id === targetId);
  return (
    <Dialog open={area !== null} onOpenChange={(v) => { if (!v && !isPending) onClose(); }}>
      <DialogContent className={dialogCls}>
        <DialogHeading
          icon={CornerDownRight}
          Title={DialogTitle}
          Description={DialogDescription}
          title="Redirecionar formulário"
          description={<>
            Escolha quem assume o formulário <b className="font-semibold text-foreground">{area?.areaName}</b>
            {area && area.criteriaIds.length > 1 ? <> — os {plural(area.criteriaIds.length, "critério", "critérios")} vão juntos</> : null}.
            Depois de confirmar, ele sai da sua lista.
          </>}
        />

        {options.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[14px] text-muted-foreground">
            Nenhuma opção de redirecionamento disponível para este critério.
          </p>
        ) : (
          <fieldset>
            <legend className="sr-only">Quem assume o formulário</legend>
            <Eyebrow className="mb-2">Quem assume</Eyebrow>
            <div className="rounded-xl border border-border divide-y divide-border max-h-60 overflow-y-auto">
              {options.map((opt) => {
                const on = targetId === opt.id;
                return (
                  <label key={opt.id} className={cn("flex items-center gap-3 px-4 min-h-12 cursor-pointer transition-colors duration-150", on ? "bg-secondary" : "hover:bg-secondary/50")}>
                    <input
                      type="radio"
                      name="redirect-target"
                      checked={on}
                      onChange={() => onTargetChange(opt.id)}
                      className="h-[18px] w-[18px] accent-[var(--primary)]"
                    />
                    <span className="text-[15px] font-semibold text-foreground flex-1">{opt.name}</span>
                    {on && <Check size={15} aria-hidden className="text-[var(--status-ok-text)]" />}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <button type="button" onClick={onClose} disabled={isPending} className={btnSecondary}>Cancelar</button>
          <button type="button" disabled={targetId === null || isPending} onClick={onConfirm} className={btnPrimary}>
            {isPending ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Redirecionando...</> : target ? `Passar para ${target.name.split(" ")[0]}` : "Confirmar transferência"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
