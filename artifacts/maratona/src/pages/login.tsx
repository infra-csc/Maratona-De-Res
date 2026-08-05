import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";

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
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  const isReady = /^\d{11}$/.test(cpf);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: cpf, password: `Maratona@${cpf.slice(-4)}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "CPF não encontrado ou sem acesso");
      login(data.token, data.user);
      setLocation(data.user.mustChangePassword ? "/trocar-senha" : "/");
    } catch (err: unknown) {
      toast({
        title: "Acesso negado",
        description: err instanceof Error ? err.message : "CPF inválido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

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
          <form onSubmit={handleSubmit} className="px-6 py-8 space-y-5">
            <div>
              <label
                className="block text-[11px] font-black uppercase tracking-widest mb-2"
                style={{ fontFamily: CONDENSED, color: LABEL_COLOR }}
              >
                CPF
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={11}
                value={cpf}
                onChange={e => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="Somente números"
                required
                autoFocus
                autoComplete="off"
                className="w-full outline-none font-bold transition-all"
                style={{
                  fontFamily: CONDENSED,
                  height: 56,
                  padding: "0 16px",
                  fontSize: cpf.length > 0 ? 22 : 16,
                  letterSpacing: cpf.length > 0 ? "0.18em" : "0.02em",
                  backgroundColor: INPUT_BG,
                  border: `1px solid ${INPUT_BORDER}`,
                  color: TEXT_COLOR,
                  colorScheme: "dark",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = CARD_BORDER_ACCENT)}
                onBlur={e => (e.currentTarget.style.borderColor = INPUT_BORDER)}
              />
              <p
                className="text-[10px] mt-1.5"
                style={{ fontFamily: CONDENSED, color: HINT_COLOR }}
              >
                {cpf.length === 0
                  ? "Digite seu CPF (11 dígitos)"
                  : cpf.length < 11
                  ? `${11 - cpf.length} dígito${11 - cpf.length !== 1 ? "s" : ""} restante${11 - cpf.length !== 1 ? "s" : ""}`
                  : "✓ CPF completo"}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !isReady}
              className="w-full font-black uppercase flex items-center justify-center gap-2 transition-all"
              style={{
                fontFamily: CONDENSED,
                letterSpacing: "0.1em",
                backgroundColor: !isReady || loading ? `${ACCENT}40` : ACCENT,
                color: !isReady || loading ? `${ACCENT_FG}80` : ACCENT_FG,
                height: 52,
                border: "none",
                cursor: !isReady || loading ? "not-allowed" : "pointer",
                fontSize: 15,
              }}
              onMouseEnter={e => { if (isReady && !loading) e.currentTarget.style.backgroundColor = ACCENT_HOVER; }}
              onMouseLeave={e => { if (isReady && !loading) e.currentTarget.style.backgroundColor = !isReady || loading ? `${ACCENT}40` : ACCENT; }}
            >
              {loading ? "Autenticando…" : <><span>Acessar</span><ArrowRight size={16} /></>}
            </button>
          </form>
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
