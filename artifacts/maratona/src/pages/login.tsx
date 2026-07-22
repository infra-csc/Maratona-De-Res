import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, ArrowLeft } from "lucide-react";

const CONDENSED = "'Barlow Condensed', 'Barlow', sans-serif";
const ACCENT = "#ccff00";
const ACCENT_HOVER = "#b8e600";
const ACCENT_FG = "#161e00";

// Login page always uses its own dark palette — independent of system theme
const PAGE_BG = "#0b1200";
const CARD_BG = "#0d0d0d";
const CARD_BORDER = "#ccff00";
const CARD_BORDER_ACCENT = "#ccff00";
const INPUT_BG = "#181818";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const LABEL_COLOR = ACCENT;
const TEXT_COLOR = "rgba(255,255,255,0.9)";
const MUTED_COLOR = "#ccff0055";
const HINT_COLOR = "rgba(255,255,255,0.35)";

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
      toast({
        title: "Acesso negado",
        description: err instanceof Error ? err.message : "Senha incorreta",
        variant: "destructive",
      });
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  const handleMain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (isPin) {
      doLogin({ pin: value });
    } else {
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
      style={{ backgroundColor: PAGE_BG }}
    >
      {/* Branding */}
      <div className="mb-10 text-center select-none">
        <p
          className="text-6xl font-black uppercase leading-none tracking-tight"
          style={{ fontFamily: CONDENSED, color: ACCENT }}
        >
          Maratona
        </p>
        <p
          className="text-6xl font-black uppercase leading-none tracking-tight"
          style={{ fontFamily: CONDENSED, color: "rgba(255,255,255,0.30)" }}
        >
          de Resultados
        </p>
      </div>

      {/* Card */}
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div
          style={{
            backgroundColor: CARD_BG,
            border: `1.5px solid ${CARD_BORDER}`,
            color: TEXT_COLOR,
          }}
        >
          {step === "main" && (
            <form onSubmit={handleMain} className="px-6 py-8 space-y-5">
              <div>
                <label
                  className="block text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ fontFamily: CONDENSED, color: LABEL_COLOR }}
                >
                  {isPin ? "Senha" : "Senha ou E-mail"}
                </label>
                <input
                  type={isPin ? "password" : "text"}
                  inputMode={isPin ? "numeric" : undefined}
                  maxLength={isPin ? 4 : undefined}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder="Senha de 4 dígitos ou e-mail"
                  required
                  autoFocus
                  className="w-full outline-none font-bold transition-all"
                  style={{
                    fontFamily: CONDENSED,
                    height: 56,
                    padding: isPin ? "0" : "0 16px",
                    fontSize: isPin ? 32 : 16,
                    letterSpacing: isPin ? "0.55em" : "0.02em",
                    textAlign: isPin ? "center" : "left",
                    backgroundColor: INPUT_BG,
                    border: `1px solid ${INPUT_BORDER}`,
                    color: TEXT_COLOR,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = CARD_BORDER_ACCENT)}
                  onBlur={e => (e.currentTarget.style.borderColor = INPUT_BORDER)}
                />
                {!isPin && value.length === 0 && (
                  <p
                    className="text-[10px] mt-1.5"
                    style={{ fontFamily: CONDENSED, color: HINT_COLOR }}
                  >
                    Colaboradores: digitem a senha de 4 dígitos recebida
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full font-black uppercase flex items-center justify-center gap-2 transition-all"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.1em",
                  backgroundColor: loading ? `${ACCENT}60` : ACCENT,
                  color: ACCENT_FG,
                  height: 52,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 15,
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = ACCENT_HOVER; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = ACCENT; }}
              >
                {loading
                  ? "Autenticando…"
                  : isPin
                  ? <><span>Acessar</span><ArrowRight size={16} /></>
                  : <><span>Continuar</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={handlePassword} className="px-6 py-8 space-y-5">
              {/* Identifier chip */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  backgroundColor: `${ACCENT}0a`,
                  border: `1px solid ${ACCENT}25`,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ fontFamily: CONDENSED, color: LABEL_COLOR }}
                  >
                    {isEmail ? "E-mail" : "CPF"}
                  </p>
                  <p
                    className="font-black text-sm truncate"
                    style={{ fontFamily: CONDENSED, color: TEXT_COLOR }}
                  >
                    {value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setStep("main"); setPassword(""); }}
                  className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wide"
                  style={{
                    fontFamily: CONDENSED,
                    color: LABEL_COLOR,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={11} /> Trocar
                </button>
              </div>

              <div>
                <label
                  className="block text-[11px] font-black uppercase tracking-widest mb-2"
                  style={{ fontFamily: CONDENSED, color: LABEL_COLOR }}
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
                  className="w-full outline-none font-bold transition-all"
                  style={{
                    fontFamily: CONDENSED,
                    height: 56,
                    padding: "0 16px",
                    fontSize: 16,
                    letterSpacing: "0.02em",
                    backgroundColor: INPUT_BG,
                    border: `1px solid ${INPUT_BORDER}`,
                    color: TEXT_COLOR,
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = CARD_BORDER_ACCENT)}
                  onBlur={e => (e.currentTarget.style.borderColor = INPUT_BORDER)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full font-black uppercase flex items-center justify-center gap-2"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.1em",
                  backgroundColor: loading ? `${ACCENT}40` : ACCENT,
                  color: loading ? `${ACCENT_FG}80` : ACCENT_FG,
                  height: 52,
                  border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontSize: 15,
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.backgroundColor = ACCENT_HOVER; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.backgroundColor = ACCENT; }}
              >
                {loading ? "Autenticando…" : <><span>Acessar</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p
          className="text-center text-[9px] font-bold uppercase tracking-widest mt-5"
          style={{ color: MUTED_COLOR }}
        >
          Sistema exclusivo • Uso restrito
        </p>
      </div>
    </div>
  );
}
