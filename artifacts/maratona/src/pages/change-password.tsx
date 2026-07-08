import { useState } from "react";
import { useLocation } from "wouter";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, ArrowRight } from "lucide-react";

export default function ChangePasswordPage() {
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
    changePasswordMutation.mutate({ data: { newPassword, confirmPassword } });
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-3 bg-[#191c1e]" />
      <div className="absolute bottom-0 left-0 w-full h-3 bg-[#191c1e]" />

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center mx-auto mb-4 -skew-x-6">
            <KeyRound size={28} className="text-[#161e00] skew-x-6" />
          </div>
          <h1 className="text-2xl italic font-black text-[#191c1e] uppercase tracking-tighter leading-tight">Primeiro Acesso</h1>
          <h1 className="text-2xl italic font-black text-[#506600] uppercase tracking-tighter leading-tight">Troque sua Senha</h1>
        </div>

        <div className="bg-white border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e]">
          <div className="bg-[#f2f4f6] px-6 py-4 border-b-2 border-[#191c1e]">
            <p className="text-sm font-black italic text-[#191c1e] uppercase tracking-tight">Olá, {user?.name}</p>
            <p className="text-[11px] font-bold italic text-[#747a60] uppercase tracking-wider">Por segurança, defina uma nova senha antes de continuar</p>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-[13px] font-black italic text-[#191c1e] uppercase tracking-tight">
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
                  className="w-full h-12 px-4 border-2 border-[#191c1e] bg-white text-[#191c1e] text-sm font-bold italic placeholder:text-[#747a60] placeholder:font-bold placeholder:italic focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:ring-offset-2 focus:ring-offset-[#f7f9fb]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-[13px] font-black italic text-[#191c1e] uppercase tracking-tight">
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
                  className="w-full h-12 px-4 border-2 border-[#191c1e] bg-white text-[#191c1e] text-sm font-bold italic placeholder:text-[#747a60] placeholder:font-bold placeholder:italic focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:ring-offset-2 focus:ring-offset-[#f7f9fb]"
                />
              </div>

              <button
                data-testid="button-submit-change-password"
                type="submit"
                disabled={changePasswordMutation.isPending}
                className="w-full h-12 mt-4 bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] font-black italic uppercase text-[13px] tracking-tight shadow-[3px_3px_0px_0px_#191c1e] hover:shadow-[1px_1px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

        <p className="text-center text-[10px] font-bold italic text-[#747a60] uppercase tracking-widest mt-6">
          Sistema Exclusivo • Uso Restrito
        </p>
      </div>
    </div>
  );
}
