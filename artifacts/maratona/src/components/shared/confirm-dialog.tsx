import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CONDENSED, BODY } from "@/lib/premium-theme";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Padrão: "Confirmar". Use verbo concreto: "Excluir evento", "Publicar". */
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  /** Botão de confirmar em vermelho (`--destructive`). */
  destructive?: boolean;
  /**
   * Palavra que o usuário precisa digitar para liberar o botão (ex.: "EXCLUIR"
   * ou o nome do evento). Comparação exata, sem espaços nas pontas.
   */
  confirmText?: string;
  /** Desabilita os botões e mostra spinner enquanto a mutação roda. */
  isPending?: boolean;
  /**
   * Chamado ao confirmar. O diálogo NÃO fecha sozinho: feche via
   * `onOpenChange(false)` no sucesso da mutação (assim o erro mantém o diálogo aberto).
   */
  onConfirm: () => void;
  /** Conteúdo extra entre a descrição e o rodapé (lista de itens afetados etc.). */
  children?: React.ReactNode;
  "data-testid"?: string;
}

/**
 * Confirmação padronizada sobre o AlertDialog do Radix (foco preso, Esc fecha,
 * `role="alertdialog"`). Para ações irreversíveis use `destructive` e,
 * se o dano for grande, `confirmText`.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  confirmText,
  isPending = false,
  onConfirm,
  children,
  ...rest
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState("");
  const inputId = React.useId();

  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  const needsText = typeof confirmText === "string" && confirmText.length > 0;
  const textOk = !needsText || typed.trim() === confirmText;
  const canConfirm = textOk && !isPending;

  const handleOpenChange = (next: boolean) => {
    if (isPending && !next) return; // não fecha no meio da mutação
    onOpenChange(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        data-testid={rest["data-testid"]}
        className="rounded-xl"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-[19px] font-black uppercase leading-tight"
            style={{ fontFamily: CONDENSED, letterSpacing: "-0.01em" }}
          >
            {title}
          </AlertDialogTitle>
          {description ? (
            <AlertDialogDescription
              className="text-[13px] leading-relaxed"
              style={{ fontFamily: BODY, color: "var(--muted-foreground)" }}
            >
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {children}

        {needsText ? (
          <div className="grid gap-1.5">
            <label
              htmlFor={inputId}
              className="text-[11px] font-bold uppercase"
              style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}
            >
              Digite <span style={{ color: "var(--foreground)" }}>{confirmText}</span> para continuar
            </label>
            <Input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoFocus
              disabled={isPending}
              aria-invalid={typed.length > 0 && !textOk ? true : undefined}
              data-testid="input-confirm-text"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) {
                  e.preventDefault();
                  onConfirm();
                }
              }}
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} data-testid="button-cancel">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm"
            disabled={!canConfirm}
            aria-busy={isPending || undefined}
            className={cn(destructive && "bg-destructive text-destructive-foreground border-destructive-border hover:bg-destructive/90")}
            onClick={(e) => {
              e.preventDefault(); // caller decide quando fechar
              if (canConfirm) onConfirm();
            }}
          >
            {isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
