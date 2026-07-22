import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft } from "lucide-react";

const CONDENSED = "'Barlow Condensed', 'Barlow', sans-serif";

const inputStyle: React.CSSProperties = {
  backgroundColor: "#13161a",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  fontFamily: CONDENSED,
  outline: "none",
  width: "100%",
  height: "56px",
  padding: "0 16px",
  fontSize: "16px",
  fontWeight: 700,
  letterSpacing: "0.04em",
  transition: "border-color 0.15s",
};

function focusStyle(el: HTMLInputElement) { el.style.borderColor = "#ccff00"; }
function blurStyle(el: HTMLInputElement) { el.style.borderColor = "rgba(255,255,255,0.1)"; }

export default function LoginPage() {
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"main" | "password">("main");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const isPin = /^\d{4}$/.test(value);
  const isEmail = value.includes("@");

  async function doLogin(body: Record<string, string>) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao autenticar");
      login(data.token, data.user);
      setLocation(data.user.mustChangePassword ? "/trocar-senha" : "/");
    } catch (err: unknown) {
      toast({ title: "Acesso negado", description: err instanceof Error ? err.message : "Senha incorreta", variant: "destructive" });
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  const handleMain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (isPin) {
      // PIN-only login — direct, no password step
      doLogin({ pin: value });
    } else {
      // Email/CPF — go to password step
      setStep("password");
    }
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin({ identifier: value, password });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#191c1e" }}
    >
      {/* Branding */}
      <div className="mb-10 text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 mb-4 font-black -skew-x-6"
          style={{ backgroundColor: "#ccff00", color: "#161e00", fontFamily: CONDENSED, fontSize: 15 }}
        >
          <span className="skew-x-6">CE</span>
        </div>
        <p className="text-4xl font-black uppercase leading-none tracking-tight" style={{ fontFamily: CONDENSED, color: "#ccff00" }}>
          Maratona
        </p>
        <p className="text-4xl font-black uppercase leading-none tracking-tight" style={{ fontFamily: CONDENSED, color: "rgba(204,255,0,0.35)" }}>
          de Resultados
        </p>
      </div>

      {/* Card */}
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div style={{ backgroundColor: "#22262a", border: "1px solid rgba(204,255,0,0.3)" }}>

          {/* Step: main (Senha / e-mail) */}
          {step === "main" && (
            <form onSubmit={handleMain} className="px-6 py-8 space-y-6">
              <div>
                <label
                  className="block text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.4)" }}
                >
                  {isPin ? "Senha" : "Senha ou E-mail"}
                </label>
                <input
                  type={isPin ? "password" : "text"}
                  inputMode={isPin ? "numeric" : undefined}
                  maxLength={isPin ? 4 : undefined}
                  value={value}
                  onChange={e => {
                    const v = e.target.value;
                    // If it looks like a number being built, keep digits only up to 4
                    if (/^\d*$/.test(v) && v.length <= 4) {
                      setValue(v);
                    } else if (!/^\d/.test(v)) {
                      // Email/text path — allow freely
                      setValue(v);
                    } else {
                      setValue(v);
                    }
                  }}
                  placeholder={isPin ? "• • • •" : "Senha de 4 dígitos ou e-mail"}
                  required
                  autoFocus
                  style={{
                    ...inputStyle,
                    ...(isPin ? { fontSize: 28, letterSpacing: "0.6em", textAlign: "center", paddingLeft: 0 } : {}),
                  }}
                  onFocus={e => focusStyle(e.currentTarget)}
                  onBlur={e => blurStyle(e.currentTarget)}
                />
                {!isPin && value.length === 0 && (
                  <p className="text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)", fontFamily: CONDENSED }}>
                    Colaboradores: digitem a senha de 4 dígitos recebida
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !value.trim()}
                className="w-full font-black uppercase flex items-center justify-center gap-2"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.1em",
                  backgroundColor: loading || !value.trim() ? "rgba(204,255,0,0.5)" : "#ccff00",
                  color: "#161e00",
                  height: 52,
                  border: "none",
                  cursor: loading || !value.trim() ? "not-allowed" : "pointer",
                  fontSize: 15,
                }}
                onMouseEnter={e => { if (!loading && value.trim()) e.currentTarget.style.backgroundColor = "#b8e600"; }}
                onMouseLeave={e => { if (!loading && value.trim()) e.currentTarget.style.backgroundColor = "#ccff00"; }}
              >
                {loading
                  ? "Autenticando…"
                  : isPin
                    ? <><span>Acessar</span><ArrowRight size={16} /></>
                    : <><span>Continuar</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {/* Step: password (for email/CPF logins) */}
          {step === "password" && (
            <form onSubmit={handlePassword} className="px-6 py-8 space-y-6">
              {/* Who */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ backgroundColor: "rgba(204,255,0,0.05)", border: "1px solid rgba(204,255,0,0.15)" }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "rgba(204,255,0,0.5)" }}>
                    {isEmail ? "E-mail" : "CPF"}
                  </p>
                  <p className="font-black text-sm truncate" style={{ fontFamily: CONDENSED, color: "#fff" }}>
                    {value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep("main"); setPassword(""); }}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer" }}
                >
                  <ArrowLeft size={11} /> Trocar
                </button>
              </div>

              <div>
                <label
                  className="block text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.4)" }}
                >
                  Senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoFocus
                  style={inputStyle}
                  onFocus={e => focusStyle(e.currentTarget)}
                  onBlur={e => blurStyle(e.currentTarget)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full font-black uppercase flex items-center justify-center gap-2"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.1em",
                  backgroundColor: loading ? "rgba(204,255,0,0.5)" : "#ccff00",
                  color: "#161e00",
                  height: 52,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 15,
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = "#b8e600"; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = "#ccff00"; }}
              >
                {loading ? "Autenticando…" : <><span>Acessar</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[9px] font-bold uppercase tracking-widest mt-5" style={{ color: "rgba(255,255,255,0.15)" }}>
          Sistema exclusivo • Uso restrito
        </p>
      </div>
    </div>
  );
}
