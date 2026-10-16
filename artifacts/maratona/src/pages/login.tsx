import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, Check, Clock, Link2, Loader2 } from "lucide-react";
import { login as loginRequest, ApiError } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { cn, plural } from "@/lib/utils";
import { AuthNotice, AuthShell, authButtonCls, authInputCls, authLabelCls } from "@/components/layout/auth-shell";

/** Traduz a resposta do login para uma frase que o colaborador entende (sem "HTTP 401"). */
function loginErrorMessage(status: number, serverError: string | undefined): string {
  // 401 do servidor é sempre "Credenciais inválidas": diz o que conferir.
  if (status === 401) return "CPF não encontrado ou sem acesso. Confira os números — se estiverem certos, fale com o RH.";
  if (status === 403 || status === 404) return serverError ?? "CPF não encontrado ou sem acesso à plataforma.";
  if (status === 429) return "Muitas tentativas seguidas. Aguarde um instante e tente de novo.";
  if (status >= 500) return "O sistema está indisponível no momento. Tente novamente em alguns minutos.";
  return serverError ?? "Não foi possível entrar. Verifique o CPF e tente novamente.";
}

/** 11144477735 → 111.444.777-35 (só na tela; o estado guarda os dígitos). */
function maskCpf(d: string): string {
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

// Avisos deixados por quem mandou a pessoa para cá (lidos uma vez ao abrir):
// sessão vencida no meio do uso, link do portal NORTE que não entrou e o
// evento que ela vai retomar depois de entrar.
function readArrival() {
  try {
    return {
      expired: sessionStorage.getItem("maratona_sessao_expirou") === "1",
      ssoFailed: sessionStorage.getItem("maratona_sso_falhou") === "1",
      resumesEvent: /[?&]evento=/.test(sessionStorage.getItem("maratona_destino") ?? ""),
    };
  } catch {
    return { expired: false, ssoFailed: false, resumesEvent: false };
  }
}

export default function LoginPage() {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrival] = useState(readArrival);
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    try {
      sessionStorage.removeItem("maratona_sessao_expirou");
      sessionStorage.removeItem("maratona_sso_falhou");
    } catch { /* sem storage */ }
  }, []);

  const isReady = /^\d{11}$/.test(cpf);
  const missing = 11 - cpf.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady || loading) return;
    setLoading(true);
    setError(null);
    try {
      let data: Awaited<ReturnType<typeof loginRequest>>;
      try {
        data = await loginRequest({ identifier: cpf, password: cpf });
      } catch (err) {
        // O corpo pode não ser JSON (proxy, queda do servidor): o ApiError guarda o
        // corpo já lido em `data` (ou texto/null) — nunca deixar isso quebrar a mensagem.
        if (err instanceof ApiError) {
          const body = err.data as { error?: unknown } | null;
          throw new Error(loginErrorMessage(err.status, typeof body?.error === "string" ? body.error : undefined));
        }
        throw new Error("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
      }
      if (!data?.token || !data.user) throw new Error("Não foi possível entrar. Tente novamente.");
      login(data.token, data.user);
      setLocation(data.user.mustChangePassword ? "/trocar-senha" : "/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sem conexão com o servidor. Verifique sua internet e tente de novo.");
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Entrar">
      <h1 className="font-condensed text-[32px] font-black uppercase leading-none tracking-[-0.01em] sm:text-[36px]">Entrar</h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
        Use o CPF cadastrado no RH. Quem chega pelo portal NORTE entra direto, sem digitar nada.
      </p>

      {(arrival.expired || arrival.ssoFailed || arrival.resumesEvent) && (
        <div className="mt-6 space-y-2.5">
          {arrival.expired && (
            <AuthNotice tone="warn" icon={Clock} title="Sua sessão expirou" role="status" data-testid="login-notice-expired">
              Entre de novo para continuar de onde parou.
            </AuthNotice>
          )}
          {arrival.ssoFailed && (
            <AuthNotice tone="danger" icon={Link2} title="O link do portal NORTE não abriu a sua sessão" role="status" data-testid="login-notice-sso">
              Ele pode ter vencido. Entre com o CPF ou abra o link de novo pelo portal.
            </AuthNotice>
          )}
          {arrival.resumesEvent && (
            <AuthNotice tone="info" icon={ArrowRight} role="status" data-testid="login-notice-resume">
              Depois de entrar, você volta direto ao evento que estava abrindo.
            </AuthNotice>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5" aria-busy={loading}>
        <div>
          <label htmlFor="login-cpf" className={authLabelCls}>CPF</label>
          <input
            id="login-cpf"
            name="cpf"
            type="text"
            inputMode="numeric"
            aria-describedby="login-cpf-hint"
            aria-invalid={!!error || undefined}
            maxLength={14}
            value={maskCpf(cpf)}
            onChange={e => { setCpf(e.target.value.replace(/\D/g, "").slice(0, 11)); if (error) setError(null); }}
            placeholder="000.000.000-00"
            readOnly={loading}
            required
            autoFocus
            autoComplete="off"
            className={cn(
              authInputCls,
              "mt-2 font-condensed text-[22px] font-bold tracking-[0.08em] placeholder:font-semibold placeholder:tracking-[0.08em] placeholder:text-muted-foreground/45",
              error && "border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]/25",
            )}
          />
          <p id="login-cpf-hint" aria-live="polite" className={cn("mt-2 flex min-h-5 items-center gap-1.5 text-[13px]", isReady ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>
            {cpf.length === 0
              ? "Só os 11 números — os pontos entram sozinhos."
              : isReady
              ? <><Check size={14} aria-hidden /> CPF completo</>
              : `Faltam ${plural(missing, "dígito")}`}
          </p>
        </div>

        {error && (
          <AuthNotice tone="danger" icon={AlertCircle} title="Não foi possível entrar" role="alert" data-testid="login-error">
            {error}
          </AuthNotice>
        )}

        <button type="submit" disabled={loading || !isReady} className={authButtonCls}>
          {loading ? (
            <><Loader2 size={17} aria-hidden className="motion-safe:animate-spin" /> Entrando…</>
          ) : (
            <>Acessar <ArrowRight size={17} aria-hidden /></>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
