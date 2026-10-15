// Diálogos da tela Áreas: nova área e a confirmação de desativar (reativar é
// direto). No padrão do app: cabeçalho com ícone, rótulos ligados, erro no
// campo, rodapé Cancelar/ação e foco devolvido ao gatilho.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { AreaInput } from "@workspace/api-client-react";
import { Loader2, Plus, Power } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn, plural } from "@/lib/utils";
import {
  ConsequenceList, DialogHeading, FieldErrorText, FieldLabel, btnDanger, btnPrimary, btnSecondary, dialogCls, dialogFooterCls,
  inputCls, invalidCls, requiredText, useReturnFocus,
} from "./areas-ui";
import type { AreaSummary } from "./model";

export function CreateAreaDialog({ open, onOpenChange, pending, error, onSubmit }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pending: boolean;
  /** Erro do servidor (fica no diálogo, junto do campo). */
  error: string | null;
  onSubmit: (d: AreaInput) => void;
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AreaInput>({ defaultValues: { name: "", description: "" } });
  const onCloseAutoFocus = useReturnFocus(open);
  // Fechar (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  useEffect(() => { if (!open) reset({ name: "", description: "" }); }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={o => { if (!pending) onOpenChange(o); }}>
      <DialogContent className={cn(dialogCls, "max-w-[500px]")} data-testid="create-area-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Plus} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Nova área"
          description="Depois de criar, ligue os avaliadores e os critérios dela em “Critérios e pessoas”." />
        <form onSubmit={handleSubmit(d => onSubmit({ name: d.name.trim(), description: d.description?.trim() || undefined }))} className="space-y-4" noValidate>
          <div>
            <FieldLabel htmlFor="create-area-name" required>Nome</FieldLabel>
            <input id="create-area-name" data-testid="input-area-name" autoComplete="off" autoFocus aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "create-area-name-error" : undefined}
              {...register("name", requiredText("Informe o nome da área."))}
              placeholder="Ex.: Cenografia" className={cn(inputCls, errors.name && invalidCls)} />
            <FieldErrorText id="create-area-name-error" message={errors.name?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="create-area-desc" hint="opcional">Descrição</FieldLabel>
            <textarea id="create-area-desc" data-testid="input-area-desc" rows={2} {...register("description")}
              placeholder="Ex.: monta e desmonta o cenário dos eventos."
              className={cn(inputCls, "h-auto min-h-[76px] py-2.5 leading-snug resize-y")} />
          </div>
          {error && <p role="alert" className="text-[13px] font-semibold text-[var(--status-danger-text)]">{error}</p>}
          <div className={dialogFooterCls}>
            <button type="button" onClick={() => onOpenChange(false)} disabled={pending} className={btnSecondary}>Cancelar</button>
            <button type="submit" data-testid="button-submit-area" disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
              {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {pending ? "Criando…" : "Criar área"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirmação de desativar: o que muda e o que fica. */
export function DeactivateAreaDialog({ target, pending, onConfirm, onClose }: {
  target: AreaSummary | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(!!target);
  const linked = target ? target.responsible.length + target.alsoEvaluates.length : 0;
  return (
    <AlertDialog open={!!target} onOpenChange={o => { if (!o && !pending) onClose(); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[500px]")} data-testid="deactivate-area-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {target && (
          <>
            <DialogHeading icon={Power} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
              title={`Desativar ${target.area.name}?`}
              description="Nada é apagado e dá para reativar depois." />
            <ConsequenceList items={[
              <>Deixa de aparecer para escolher como <span className="font-semibold text-foreground">área responsável</span> em critérios novos.</>,
              <>Critérios marcados como <span className="font-semibold text-foreground">“todas as áreas”</span> deixam de incluir esta área nos próximos eventos.</>,
              <>
                Avaliadores e critérios continuam ligados a ela
                {target.evaluators.length + linked > 0 && <> ({[
                  target.evaluators.length > 0 && plural(target.evaluators.length, "avaliador", "avaliadores"),
                  linked > 0 && plural(linked, "critério", "critérios"),
                ].filter(Boolean).join(" e ")})</>}
                ; mude em “Critérios e pessoas” se for o caso.
              </>,
            ]} />
            <div className={dialogFooterCls}>
              <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-deactivate-area" onClick={onConfirm} disabled={pending} aria-busy={pending || undefined} className={btnDanger}>
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
