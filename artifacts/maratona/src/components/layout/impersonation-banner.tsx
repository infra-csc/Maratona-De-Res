import { useAuth } from "@/lib/auth-context";
import { Eye, LogOut } from "lucide-react";
import { roleLabel } from "./shell-ui";

// Faixa do "Modo Dev" (admin vendo o app como outra pessoa): lima de ponta a
// ponta no topo, nos dois temas — impossível esquecer que não é a própria conta.
export function ImpersonationBanner() {
  const { isImpersonating, user, realUser, stopImpersonating } = useAuth();
  if (!isImpersonating || !user) return null;

  const who = `${roleLabel(user.role)}${user.areaName ? ` · ${user.areaName}` : ""}`;

  function exitDevMode() {
    stopImpersonating();
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    window.location.assign(`${base}/`);
  }

  return (
    <div
      data-testid="impersonation-banner"
      role="status"
      className="flex min-h-11 items-center gap-2.5 bg-[#d4ff00] px-2.5 py-1 text-[#111111] sm:gap-3 sm:px-4 lg:min-h-10"
    >
      <span className="font-condensed inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-[#111111] px-2 text-[12px] font-bold uppercase leading-none tracking-[0.08em] text-[#d4ff00]">
        <Eye size={13} aria-hidden="true" /> Modo dev
      </span>
      <p className="min-w-0 flex-1 truncate text-[13px] leading-tight">
        <span className="sr-only sm:not-sr-only">Visualizando como </span>
        <strong className="font-semibold">{user.name}</strong>
        <span className="font-condensed ml-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#111111]/75 max-md:sr-only">{who}</span>
      </p>
      <button
        type="button"
        data-testid="button-exit-dev-mode"
        onClick={exitDevMode}
        title={realUser ? `Voltar para a conta de ${realUser.name}` : undefined}
        className="font-condensed inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-[#111111] px-3 text-[12px] font-bold uppercase leading-none tracking-[0.06em] text-[#d4ff00] transition-colors duration-150 hover:bg-black motion-safe:active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 focus-visible:ring-offset-[#d4ff00] lg:min-h-8"
      >
        <LogOut size={14} aria-hidden="true" />
        <span>Sair<span className="max-sm:sr-only"> do modo dev</span></span>
        {realUser && <span className="hidden xl:inline font-semibold normal-case tracking-normal opacity-80">({realUser.name})</span>}
      </button>
    </div>
  );
}
