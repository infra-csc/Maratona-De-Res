import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";
import { EditUserForm } from "./edit-user-form";
import type { UserActions } from "./use-user-actions";
import type { NamedOption } from "./types";

/** Diálogo "Redefinir Senha" (mínimo de 6 caracteres). */
export function ResetPasswordDialog({ actions }: { actions: UserActions }) {
  const { resetOpen, newPassword, setNewPassword, closeResetPassword, resetPwMutation } = actions;
  return (
    <Dialog open={resetOpen !== null} onOpenChange={v => { if (!v) closeResetPassword(); }}>
      <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Redefinir Senha</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-4">
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nova Senha Segura</Label>
            <Input
              data-testid="input-new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres..."
              className="h-11 rounded-lg"
              style={fieldStyle}
            />
            {newPassword.length > 0 && newPassword.length < 6 && (
              <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>A senha precisa ter pelo menos 6 caracteres.</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={closeResetPassword} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
            <button
              data-testid="button-confirm-reset-pw"
              disabled={newPassword.length < 6 || resetPwMutation.isPending}
              onClick={() => resetOpen && resetPwMutation.mutate({ id: resetOpen, data: { newPassword } })}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Atualizar Senha
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Diálogo "Editar Usuário" (o formulário remonta a cada usuário via `key`). */
export function EditUserDialog({
  actions, areas, employees, currentUserId,
}: {
  actions: UserActions;
  areas: NamedOption[] | undefined;
  employees: NamedOption[];
  currentUserId: number | undefined;
}) {
  const { editUser, setEditUser, updateUserMutation } = actions;
  return (
    <Dialog open={editUser !== null} onOpenChange={v => !v && setEditUser(null)}>
      <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Usuário</DialogTitle>
        </DialogHeader>
        {editUser && (
          <EditUserForm
            key={editUser.id}
            user={editUser}
            areas={areas ?? []}
            employees={employees}
            isSelf={editUser.id === currentUserId}
            isPending={updateUserMutation.isPending}
            onCancel={() => setEditUser(null)}
            onSubmit={data => updateUserMutation.mutate({ id: editUser.id, data })}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
