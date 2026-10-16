import { useState } from "react";
import { useLocation } from "wouter";
import { AlertCircle, ArrowRight, Check, Circle, Eye, EyeOff, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useChangePassword, ApiError } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AuthNotice, AuthShell, authButtonCls, authInputCls, authLabelCls } from "@/components/layout/auth-shell";

const MIN = 6; // a mesma regra da API (POST /auth/change-password)

/** Mensagem do servidor (`{ error }`), sem o prefixo "HTTP 4xx" do cliente gerado. */
function serverMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const data = e.data as { error?: unknown } | null;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
  }
  const msg = (e as { message?: string } | null)?.message ?? "";
  return msg.replace(/^HTTP \d{3}[^:]*:\s*/, "") || "Verifique os dados e tente novamente.";
}

/** Só orientação (a regra que vale é o mínimo de 6): 0 curta, 1 fraca, 2 razoável, 3 forte. */
function strength(p: string): 0 | 1 | 2 | 3 {
  if (p.length < MIN) return 0;
  const pts = Number(p.length >= 10) + Number(/[a-zA-Z]/.test(p) && /\d/.test(p)) + Number(/[^a-zA-Z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p)));
  return pts === 0 ? 1 : pts === 1 ? 2 : 3;
}
const STRENGTH = [
  { label: "", bar: "", text: "" },
  { label: "Fraca", bar: "bg-[var(--status-danger)]", text: "text-[var(--status-danger-text)]" },
  { label: "Razoável", bar: "bg-[var(--status-warn)]", text: "text-[var(--status-warn-text)]" },
  { label: "Forte", bar: "bg-[var(--status-ok)]", text: "text-[var(--status-ok-text)]" },
] as const;

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-2 text-[13px] transition-colors duration-150", ok ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>
      {ok ? <Check size={14} aria-hidden className="shrink-0" /> : <Circle size={14} aria-hidden className="shrink-0 opacity-60" />}
      <span>{children}</span>
      <span className="sr-only">{ok ? "(cumprido)" : "(pendente)"}</span>
    </li>
  );
}

function PasswordField({ id, testId, label, value, onChange, autoFocus, autoComplete, describedBy, invalid }: {
  id: string; testId: string; label: string; value: string; onChange: (v: string) => void;
  autoFocus?: boolean; autoComplete: string; describedBy?: string; invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className={authLabelCls}>{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          data-testid={testId}
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required
          className={cn(authInputCls, "pr-14 text-[16px] font-semibold [&::-ms-reveal]:hidden [&::-ms-clear]:hidden", invalid && "border-[var(--status-danger)] focus:border-[var(--status-danger)] focus:ring-[var(--status-danger)]/25")}
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          aria-label={show ? `Esconder ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { user, login, logout } = useAuth();
  const { toast } = useToast();
  const firstAccess = !!user?.mustChangePassword;

  const changePasswordMutation = useChangePassword({
    mutation: {
      onSuccess: (data) => {
        login(data.token, data.user);
        toast({ title: "Senha atualizada com sucesso" });
        setLocation(data.user.role === "visualizador" ? "/meu-desempenho" : "/");
      },
      onError: (err: unknown) => setError(serverMessage(err)),
    },
  });
  const saving = changePasswordMutation.isPending;

  const longEnough = newPassword.length >= MIN;
  const matches = confirmPassword.length > 0 && confirmPassword === newPassword;
  const hasCurrent = firstAccess || currentPassword.length > 0;
  const canSubmit = longEnough && matches && hasCurrent && !saving;
  const level = strength(newPassword);
  const mismatch = confirmPassword.length > 0 && !newPassword.startsWith(confirmPassword) && !matches;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    changePasswordMutation.mutate({ data: { newPassword, confirmPassword, ...(firstAccess ? {} : { currentPassword }) } });
  };
  const edit = (set: (v: string) => void) => (v: string) => { set(v); if (error) setError(null); };
  const firstName = (user?.name ?? "").trim().split(/\s+/)[0];

  return (
    <AuthShell
      title={firstAccess ? "Crie sua senha" : "Trocar senha"}
      footer={
        <button
          type="button"
          onClick={logout}
          className="font-condensed inline-flex min-h-11 items-center gap-2 rounded-lg px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground transition-colors duration-150 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut size={15} aria-hidden /> {firstAccess ? "Não é você? Sair" : "Sair"}
        </button>
      }
    >
      <p className="font-condensed inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--accent-text)]">
        <ShieldCheck size={14} aria-hidden /> {firstAccess ? "Primeiro acesso" : "Segurança da conta"}
      </p>
      <h1 className="font-condensed mt-2 text-[32px] font-black uppercase leading-none tracking-[-0.01em] sm:text-[36px]">
        {firstAccess ? "Crie sua senha" : "Trocar senha"}
      </h1>
      <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
        {firstName ? <>Olá, <span className="font-semibold text-foreground">{firstName}</span>. </> : null}
        {firstAccess
          ? "Por segurança, defina uma senha sua antes de continuar."
          : "Confirme a senha atual e escolha a nova. As outras sessões abertas serão encerradas."}
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5" aria-busy={saving}>
        {!firstAccess && (
          <PasswordField id="currentPassword" testId="input-current-password" label="Senha atual" value={currentPassword} onChange={edit(setCurrentPassword)} autoComplete="current-password" autoFocus />
        )}
        <div>
          <PasswordField id="newPassword" testId="input-new-password" label="Nova senha" value={newPassword} onChange={edit(setNewPassword)} autoComplete="new-password" autoFocus={firstAccess} describedBy="pw-rules" />
          <div className="mt-3 flex items-center gap-3" aria-live="polite">
            <div className="grid flex-1 grid-cols-3 gap-1.5" aria-hidden="true">
              {[1, 2, 3].map(i => (
                <span key={i} className={cn("h-1 rounded-full transition-colors duration-200", level >= i ? STRENGTH[level].bar : "bg-secondary")} />
              ))}
            </div>
            <span className={cn("font-condensed w-16 text-right text-[12px] font-bold uppercase tracking-[0.08em]", STRENGTH[level].text)}>
              {level > 0 ? STRENGTH[level].label : ""}
            </span>
          </div>
        </div>
        <PasswordField id="confirmPassword" testId="input-confirm-password" label="Confirmar nova senha" value={confirmPassword} onChange={edit(setConfirmPassword)} autoComplete="new-password" describedBy="pw-rules" invalid={mismatch} />

        <ul id="pw-rules" className="space-y-1.5 rounded-xl border border-border bg-background/60 px-3.5 py-3">
          {!firstAccess && <Rule ok={hasCurrent}>Senha atual informada</Rule>}
          <Rule ok={longEnough}>Pelo menos {MIN} caracteres</Rule>
          <Rule ok={matches}>Confirmação igual à nova senha</Rule>
        </ul>
        {level > 0 && level < 3 && (
          <p className="-mt-2 text-[12px] leading-snug text-muted-foreground">Dica: mais de 10 caracteres, misturando letras e números, deixa a senha mais forte.</p>
        )}

        {error && (
          <AuthNotice tone="danger" icon={AlertCircle} title="Não foi possível trocar a senha" role="alert" data-testid="change-password-error">
            {error}
          </AuthNotice>
        )}

        <button data-testid="button-submit-change-password" type="submit" disabled={!canSubmit} className={authButtonCls}>
          {saving ? (
            <><Loader2 size={17} aria-hidden className="motion-safe:animate-spin" /> Salvando…</>
          ) : (
            <>Salvar e continuar <ArrowRight size={17} aria-hidden /></>
          )}
        </button>
      </form>
    </AuthShell>
  );
}
