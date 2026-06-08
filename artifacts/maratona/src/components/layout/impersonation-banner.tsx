import { useAuth } from "@/lib/auth-context";
import { Eye, LogOut } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  rh: "RH",
  avaliador: "Avaliador",
  diretoria: "Diretoria",
  visualizador: "Visualizador",
};

export function ImpersonationBanner() {
  const { isImpersonating, user, realUser, stopImpersonating } = useAuth();
  if (!isImpersonating || !user) return null;

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  function exitDevMode() {
    stopImpersonating();
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    window.location.assign(`${base}/`);
  }

  return (
    <div
      data-testid="impersonation-banner"
      className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#191c1e] bg-[#ccff00] px-6 py-2.5"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="flex items-center gap-3 text-[#161e00]">
        <span className="flex items-center gap-1.5 bg-[#191c1e] text-[#ccff00] px-2.5 py-1 text-[11px] font-black italic uppercase tracking-wider skew-x-[-8deg]">
          <span className="inline-flex items-center gap-1.5 skew-x-[8deg]">
            <Eye size={13} /> Modo Dev
          </span>
        </span>
        <span className="text-sm font-bold italic">
          Visualizando como <strong className="not-italic">{user.name}</strong>{" "}
          <span className="uppercase text-xs">({roleLabel}{user.areaName ? ` · ${user.areaName}` : ""})</span>
        </span>
      </div>
      <button
        data-testid="button-exit-dev-mode"
        onClick={exitDevMode}
        className="flex items-center gap-1.5 border-2 border-[#191c1e] bg-[#191c1e] text-[#ccff00] px-3 py-1.5 text-xs font-bold italic uppercase tracking-wider transition-all hover:bg-[#000]"
      >
        <LogOut size={13} /> Sair do modo dev{realUser ? ` (${realUser.name})` : ""}
      </button>
    </div>
  );
}
