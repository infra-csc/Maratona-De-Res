import { useState } from "react";
import { useLocation } from "wouter";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ArrowRight } from "lucide-react";
import { CONDENSED, BODY } from "@/lib/premium-theme";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [, setLocation] = useLocation();
  const { user, login } = useAuth();
  const { toast } = useToast();

  const changePasswordMutation = useChangePassword({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        toast({ title: "Senha atualizada com sucesso" });
        setLocation(data.user.role === "visualizador" ? "/meu-desempenho" : "/");
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Não foi possível trocar a senha", description: err?.message ?? "Verifique os dados e tente novamente", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ data: { newPassword, confirmPassword, ...(user?.mustChangePassword ? {} : { currentPassword }) } });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 relative overflow-hidden" style={{ fontFamily: BODY }}>
      <div className="absolute top-0 left-0 w-full h-1 bg-accent" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
            <KeyRound size={28} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tight leading-tight" style={{ fontFamily: CONDENSED }}>Primeiro Acesso</h1>
          <h1 className="text-3xl font-black text-accent-text uppercase tracking-tight leading-tight" style={{ fontFamily: CONDENSED }}>Troque sua Senha</h1>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="bg-secondary px-6 py-4 border-b border-border">
            <p className="text-base font-black text-foreground uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Olá, {user?.name}</p>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{user?.mustChangePassword ? "Por segurança, defina uma nova senha antes de continuar" : "Confirme a senha atual e escolha a nova"}</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!user?.mustChangePassword && (
                <div className="space-y-1.5">
                  <label htmlFor="currentPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Senha Atual
                  </label>
                  <input
                    id="currentPassword"
                    data-testid="input-current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="w-full h-12 px-4 border border-border rounded-lg bg-secondary text-foreground text-sm font-semibold placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Nova Senha
                </label>
                <input
                  id="newPassword"
                  data-testid="input-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                  autoFocus
                  className="w-full h-12 px-4 border border-border rounded-lg bg-secondary text-foreground text-sm font-semibold placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Confirmar Nova Senha
                </label>
                <input
                  id="confirmPassword"
                  data-testid="input-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="w-full h-12 px-4 border border-border rounded-lg bg-secondary text-foreground text-sm font-semibold placeholder:text-muted-foreground placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                />
              </div>

              <button
                data-testid="button-submit-change-password"
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="w-full h-12 mt-4 bg-primary text-primary-foreground border border-primary rounded-lg font-black uppercase text-[13px] tracking-wide transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ fontFamily: CONDENSED }}
              >
                {changePasswordMutation.isPending ? "Salvando..." : (
                  <>
                    Confirmar Nova Senha
                    <ArrowRight size={16} className="shrink-0" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-6">
          Sistema Exclusivo • Uso Restrito
        </p>
      </div>
    </div>
  );
}
