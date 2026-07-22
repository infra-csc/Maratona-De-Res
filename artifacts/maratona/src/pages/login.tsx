import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft } from "lucide-react";

const CONDENSED = "'Barlow Condensed', 'Barlow', sans-serif";

function isCpfLike(val: string) {
  return val.replace(/\D/g, "").length === 11;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: "#13161a",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  fontFamily: CONDENSED,
  outline: "none",
  width: "100%",
  height: "52px",
  padding: "0 16px",
  fontSize: "16px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  transition: "border-color 0.15s",
};

export default function LoginPage() {
  const [step, setStep] = useState<1 | 2>(1);
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
        setPassword("");
      },
    },
  });

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setStep(2);
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { identifier, password } });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#191c1e" }}
    >
      {/* Branding */}
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 mb-4 font-black text-base -skew-x-6"
          style={{ backgroundColor: "#ccff00", color: "#161e00", fontFamily: CONDENSED }}
        >
          <span className="skew-x-6">CE</span>
        </div>
        <div>
          <p className="text-4xl font-black uppercase leading-none tracking-tight" style={{ fontFamily: CONDENSED, color: "#ccff00" }}>
            Maratona
          </p>
          <p className="text-4xl font-black uppercase leading-none tracking-tight" style={{ fontFamily: CONDENSED, color: "rgba(204,255,0,0.35)" }}>
            de Resultados
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div style={{ backgroundColor: "#22262a", border: "1px solid rgba(204,255,0,0.3)" }}>

          {/* Step indicator */}
          <div
            className="flex items-center gap-3 px-6 py-3"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="flex items-center gap-1.5"
              style={{ fontFamily: CONDENSED }}
            >
              {[1, 2].map(n => (
                <div
                  key={n}
                  className="text-[10px] font-black uppercase tracking-widest"
                  style={{
                    color: step === n ? "#ccff00" : "rgba(255,255,255,0.2)",
                  }}
                >
                  {n === 1 ? "Identificação" : "Senha"}
                  {n < 2 && <span className="mx-2" style={{ color: "rgba(255,255,255,0.15)" }}>›</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1 — CPF / E-mail */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="px-6 py-8 space-y-6">
              <div>
                <label
                  className="block text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.4)" }}
                >
                  CPF ou E-mail
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="00000000000"
                  required
                  autoFocus
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = "#ccff00")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
              </div>
              <button
                type="submit"
                className="w-full font-black uppercase text-sm flex items-center justify-center gap-2"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.1em",
                  backgroundColor: "#ccff00",
                  color: "#161e00",
                  height: 52,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#b8e600")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#ccff00")}
              >
                Continuar <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Step 2 — Senha */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="px-6 py-8 space-y-6">
              {/* Who they are */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ backgroundColor: "rgba(204,255,0,0.05)", border: "1px solid rgba(204,255,0,0.15)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "rgba(204,255,0,0.5)" }}>
                    {isCpf ? "CPF" : "E-mail"}
                  </p>
                  <p className="font-black text-sm truncate" style={{ fontFamily: CONDENSED, color: "#fff", letterSpacing: isCpf ? "0.12em" : undefined }}>
                    {isCpf ? identifier.replace(/\D/g, "").replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : identifier}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep(1); setPassword(""); }}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}
                >
                  <ArrowLeft size={11} /> Trocar
                </button>
              </div>

              {/* Senha */}
              <div>
                <label
                  className="block text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.4)" }}
                >
                  Senha
                </label>
                {isCpf ? (
                  /* 4-digit PIN — big visual boxes */
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={password}
                    onChange={e => setPassword(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="••••"
                    required
                    autoFocus
                    style={{
                      ...inputStyle,
                      fontSize: 32,
                      letterSpacing: "0.5em",
                      textAlign: "center",
                      paddingLeft: 0,
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "#ccff00")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                ) : (
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                    style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = "#ccff00")}
                    onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                )}
              </div>

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full font-black uppercase flex items-center justify-center gap-2"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.1em",
                  backgroundColor: loginMutation.isPending ? "rgba(204,255,0,0.5)" : "#ccff00",
                  color: "#161e00",
                  height: 52,
                  border: "none",
                  cursor: loginMutation.isPending ? "not-allowed" : "pointer",
                  fontSize: 15,
                }}
                onMouseEnter={e => { if (!loginMutation.isPending) e.currentTarget.style.backgroundColor = "#b8e600"; }}
                onMouseLeave={e => { if (!loginMutation.isPending) e.currentTarget.style.backgroundColor = "#ccff00"; }}
              >
                {loginMutation.isPending ? "Autenticando…" : <><span>Acessar</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p
          className="text-center text-[9px] font-bold uppercase tracking-widest mt-5"
          style={{ color: "rgba(255,255,255,0.15)" }}
        >
          Sistema exclusivo • Uso restrito
        </p>
      </div>
    </div>
  );
}
