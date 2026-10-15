// Diálogos por usuário: editar, redefinir senha e remover acesso. No padrão
// do app (cabeçalho com ícone, rótulos ligados, erro no diálogo, rodapé
// Cancelar/ação, foco devolvido ao gatilho).
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Pencil, Power, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  ConsequenceList, DialogHeading, FieldErrorText, FieldLabel, FOCUS_RING, RoleChip, btnDanger, btnPrimary, btnSecondary,
  dialogCls, dialogFooterCls, inputCls, invalidCls, useReturnFocus,
} from "./users-ui";
import { EditUserForm } from "./edit-user-form";
import type { UserActions } from "./use-user-actions";
import type { NamedOption } from "./types";

/** "Redefinir senha" (mínimo de 6 caracteres). */
export function ResetPasswordDialog({ actions }: { actions: UserActions }) {
  const { resetUser, newPassword, setNewPassword, closeResetPassword, resetPwMutation, resetError } = actions;
  const open = resetUser !== null;
  const pending = resetPwMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState(false);
  const short = newPassword.length < 6;
  const fieldError = touched && short ? (newPassword.length === 0 ? "Informe a nova senha." : "A senha precisa ter pelo menos 6 caracteres.") : undefined;
  const close = () => { if (!pending) { closeResetPassword(); setShow(false); setTouched(false); } };
  const submit = () => {
    setTouched(true);
    if (short || !resetUser) return;
    resetPwMutation.mutate({ id: resetUser.id, data: { newPassword } });
  };
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[460px]")} data-testid="reset-password-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={KeyRound} Title={DialogTitle} Description={DialogDescription} title="Redefinir senha"
          description={resetUser ? <><span className="font-semibold text-foreground">{resetUser.name}</span> recebe uma senha provisória.</> : undefined} />
        <form onSubmit={e => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
          <div>
            <FieldLabel htmlFor="reset-new-password" required hint="mín. 6 caracteres">Nova senha</FieldLabel>
            <div className="relative">
              <input id="reset-new-password" data-testid="input-new-password" type={show ? "text" : "password"} autoComplete="new-password" autoFocus
                value={newPassword} onChange={e => setNewPassword(e.target.value)} onBlur={() => newPassword && setTouched(true)}
                aria-invalid={!!fieldError} aria-describedby={fieldError ? "reset-new-password-error" : undefined}
                className={cn(inputCls, "pr-12", fieldError && invalidCls)} />
              <button type="button" onClick={() => setShow(v => !v)} aria-pressed={show} aria-label={show ? "Esconder senha" : "Mostrar senha"}
                className={cn("absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
                {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
              </button>
            </div>
            <FieldErrorText id="reset-new-password-error" message={fieldError} />
          </div>
          <ConsequenceList items={[
            <>No próximo acesso, a pessoa <span className="font-semibold text-foreground">cria uma senha nova</span>.</>,
            <>As sessões abertas com a senha antiga são encerradas.</>,
          ]} />
          {resetError && <p role="alert" className="text-[13px] font-semibold text-[var(--status-danger-text)]">{resetError}</p>}
          <div className={dialogFooterCls}>
            <button type="button" onClick={close} disabled={pending} className={btnSecondary}>Cancelar</button>
            <button type="submit" data-testid="button-confirm-reset-pw" disabled={pending} aria-busy={pending || undefined} className={btnPrimary}>
              {pending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {pending ? "Redefinindo…" : "Redefinir senha"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Editar usuário" (o formulário remonta a cada usuário via `key`). */
export function EditUserDialog({ actions, areas, employees, currentUserId }: {
  actions: UserActions;
  areas: NamedOption[] | undefined;
  employees: NamedOption[];
  currentUserId: number | undefined;
}) {
  const { editUser, setEditUser, updateUserMutation, editError } = actions;
  const open = editUser !== null;
  const pending = updateUserMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !pending) setEditUser(null); }}>
      <DialogContent className={cn(dialogCls, "max-w-[560px] max-h-[92dvh] overflow-y-auto")} data-testid="edit-user-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Pencil} Title={DialogTitle} Description={DialogDescription} title="Editar usuário"
          description={editUser ? <span className="inline-flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{editUser.name}</span><RoleChip role={editUser.role} className="h-5 text-[11px]" /></span> : undefined} />
        {editUser && (
          <EditUserForm key={editUser.id} user={editUser} areas={areas ?? []} employees={employees}
            isSelf={editUser.id === currentUserId} isPending={pending} serverError={editError}
            onCancel={() => setEditUser(null)}
            onSubmit={data => updateUserMutation.mutate({ id: editUser.id, data })} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Remover acesso". Se o servidor recusar (há histórico), oferece desativar. */
export function DeleteUserDialog({ actions }: { actions: UserActions }) {
  const { deleteTarget: u, setDeleteTarget, deleteMutation, deleteError, updateUserMutation } = actions;
  const open = u !== null;
  const pending = deleteMutation.isPending || updateUserMutation.isPending;
  const onCloseAutoFocus = useReturnFocus(open);
  const close = () => { if (!pending) setDeleteTarget(null); };
  return (
    <AlertDialog open={open} onOpenChange={o => { if (!o) close(); }}>
      <AlertDialogContent className={cn(dialogCls, "max-w-[500px] outline-none")} data-testid="delete-user-dialog" onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        {u && (
          <>
            <DialogHeading icon={Trash2} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
              title="Remover acesso?"
              description={<><span className="font-semibold text-foreground">{u.name}</span> perde o acesso na hora.</>} />
            <ConsequenceList items={[
              <>Só dá para remover quem <span className="font-semibold text-foreground">não tem histórico</span> (logins, avaliações ou registros).</>,
              <>Com histórico, o caminho é <span className="font-semibold text-foreground">desativar</span>: a pessoa não entra mais e o histórico fica.</>,
            ]} />
            {deleteError && (
              <div role="alert" className="rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-3.5 py-3 text-[13px] leading-snug text-foreground">
                {deleteError}
              </div>
            )}
            <div className={dialogFooterCls}>
              <button type="button" onClick={close} disabled={pending} className={btnSecondary}>Cancelar</button>
              {deleteError && u.active ? (
                <button type="button" data-testid="button-deactivate-instead" disabled={pending} aria-busy={pending || undefined}
                  onClick={() => updateUserMutation.mutate({ id: u.id, data: { active: false } })} className={btnDanger}>
                  {updateUserMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Power size={15} aria-hidden />}
                  {updateUserMutation.isPending ? "Desativando…" : "Desativar acesso"}
                </button>
              ) : (
                <button type="button" data-testid="button-confirm-delete-user" disabled={pending || !!deleteError} aria-busy={pending || undefined}
                  onClick={() => deleteMutation.mutate({ id: u.id })} className={btnDanger}>
                  {deleteMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Trash2 size={15} aria-hidden />}
                  {deleteMutation.isPending ? "Removendo…" : "Remover acesso"}
                </button>
              )}
            </div>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
