import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Trophy, ArrowRight } from "lucide-react";

function isCpfLike(val: string) {
  return val.replace(/\D/g, "").length >= 11;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const isPin = isCpfLike(identifier);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation(data.user.mustChangePassword ? "/trocar-senha" : "/");
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Acesso Negado", description: err?.message ?? "Credenciais inválidas", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { identifier, password } });
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative strip */}
      <div className="absolute top-0 left-0 w-full h-3 bg-[#191c1e]" />
      <div className="absolute bottom-0 left-0 w-full h-3 bg-[#191c1e]" />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center mx-auto mb-4 -skew-x-6">
            <Trophy size={28} className="text-[#161e00] skew-x-6" />
          </div>
          <h1 className="text-2xl italic font-black text-[#191c1e] uppercase tracking-tighter leading-tight">Maratona de</h1>
          <h1 className="text-2xl italic font-black text-[#506600] uppercase tracking-tighter leading-tight">Resultados</h1>
        </div>

        {/* Card */}
        <div className="bg-white border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e]">
          {/* Header */}
          <div className="bg-[#f2f4f6] px-6 py-4 border-b-2 border-[#191c1e] flex items-center justify-between">
            <div>
              <p className="text-sm font-black italic text-[#191c1e] uppercase tracking-tight">Acesso Corporativo</p>
              <p className="text-[11px] font-bold italic text-[#747a60] uppercase tracking-wider">Cenográfica Eventos</p>
            </div>
            <div className="w-8 h-8 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center -skew-x-6">
              <span className="text-[10px] font-black italic text-[#161e00] skew-x-6">CE</span>
            </div>
          </div>

          {/* Form */}
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="identifier" className="text-[13px] font-black italic text-[#191c1e] uppercase tracking-tight">
                  CPF ou E-mail
                </label>
                <input
                  id="identifier"
                  data-testid="input-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="000.000.000-00 ou nome@cenografica.com.br"
                  required
                  autoFocus
                  className="w-full h-12 px-4 border-2 border-[#191c1e] bg-white text-[#191c1e] text-sm font-bold italic placeholder:text-[#747a60] placeholder:font-bold placeholder:italic focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:ring-offset-2 focus:ring-offset-[#f7f9fb]"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-[13px] font-black italic text-[#191c1e] uppercase tracking-tight">
                  {isPin ? "PIN (4 dígitos)" : "Senha"}
                </label>
                <input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  inputMode={isPin ? "numeric" : undefined}
                  maxLength={isPin ? 4 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isPin ? "••••" : "••••••••"}
                  required
                  className="w-full h-12 px-4 border-2 border-[#191c1e] bg-white text-[#191c1e] text-sm font-bold italic placeholder:text-[#747a60] placeholder:font-bold placeholder:italic focus:outline-none focus:ring-2 focus:ring-[#ccff00] focus:ring-offset-2 focus:ring-offset-[#f7f9fb]"
                />
                {isPin && (
                  <p className="text-[11px] italic text-[#747a60] font-bold">
                    Digite seu CPF acima e o PIN de 4 dígitos recebido do RH.
                  </p>
                )}
              </div>

              <button
                data-testid="button-submit-login"
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-12 mt-4 bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] font-black italic uppercase text-[13px] tracking-tight shadow-[3px_3px_0px_0px_#191c1e] hover:shadow-[1px_1px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loginMutation.isPending ? "Autenticando..." : (
                  <>
                    Acessar Plataforma
                    <ArrowRight size={16} className="shrink-0" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-bold italic text-[#747a60] uppercase tracking-widest mt-6">
          Sistema Exclusivo • Uso Restrito
        </p>
      </div>
    </div>
  );
}
