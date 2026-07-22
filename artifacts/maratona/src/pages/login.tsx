import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

const CONDENSED = "'Barlow Condensed', 'Barlow', sans-serif";

function isCpfLike(val: string) {
  return val.replace(/\D/g, "").length >= 11;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const isCpf = isCpfLike(identifier);

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        setLocation(data.user.mustChangePassword ? "/trocar-senha" : "/");
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Acesso negado", description: err?.message ?? "Credenciais inválidas", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { identifier, password } });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: "#191c1e" }}
    >
      <div className="w-full max-w-[400px]">

        {/* Branding */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 flex items-center justify-center font-black text-sm -skew-x-6 flex-shrink-0"
              style={{ backgroundColor: "#ccff00", color: "#161e00", fontFamily: CONDENSED }}
            >
              <span className="skew-x-6">CE</span>
            </div>
            <div>
              <p
                className="text-2xl font-black uppercase leading-none tracking-tight"
                style={{ fontFamily: CONDENSED, color: "#ccff00" }}
              >
                Maratona
              </p>
              <p
                className="text-2xl font-black uppercase leading-none tracking-tight"
                style={{ fontFamily: CONDENSED, color: "rgba(204,255,0,0.5)" }}
              >
                de Resultados
              </p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-none"
          style={{
            backgroundColor: "#22262a",
            border: "2px solid #ccff00",
          }}
        >
          {/* Card header */}
          <div
            className="px-6 py-3"
            style={{ borderBottom: "1px solid rgba(204,255,0,0.2)", backgroundColor: "rgba(204,255,0,0.05)" }}
          >
            <p
              className="text-xs font-black uppercase tracking-widest"
              style={{ fontFamily: CONDENSED, color: "rgba(204,255,0,0.6)" }}
            >
              Acesso à plataforma
            </p>
          </div>

          {/* Form */}
          <div className="px-6 py-6 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* CPF / E-mail */}
              <div className="space-y-1.5">
                <label
                  htmlFor="identifier"
                  className="text-[11px] font-black uppercase tracking-widest block"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.5)" }}
                >
                  CPF ou E-mail
                </label>
                <input
                  id="identifier"
                  data-testid="input-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="00000000000 ou nome@empresa.com"
                  required
                  autoFocus
                  className="w-full h-12 px-4 text-sm font-bold focus:outline-none"
                  style={{
                    backgroundColor: "#191c1e",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                    fontFamily: CONDENSED,
                    letterSpacing: "0.02em",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#ccff00")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-[11px] font-black uppercase tracking-widest block"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.5)" }}
                >
                  Senha
                </label>
                <input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  inputMode={isCpf ? "numeric" : undefined}
                  maxLength={isCpf ? 4 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isCpf ? "••••" : "••••••••"}
                  required
                  className="w-full h-12 px-4 text-sm font-bold focus:outline-none"
                  style={{
                    backgroundColor: "#191c1e",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                    fontFamily: CONDENSED,
                    letterSpacing: isCpf ? "0.4em" : "0.1em",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = "#ccff00")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>

              {/* Submit */}
              <button
                data-testid="button-submit-login"
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full h-12 font-black uppercase text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.08em",
                  backgroundColor: "#ccff00",
                  color: "#161e00",
                  border: "2px solid #ccff00",
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#b8e600"; e.currentTarget.style.borderColor = "#b8e600"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ccff00"; e.currentTarget.style.borderColor = "#ccff00"; }}
              >
                {loginMutation.isPending
                  ? "Autenticando…"
                  : <><span>Acessar</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        </div>

        <p
          className="text-center text-[10px] font-bold uppercase tracking-widest mt-6"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Sistema exclusivo • Uso restrito
        </p>
      </div>
    </div>
  );
}
