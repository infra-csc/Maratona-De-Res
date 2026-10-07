import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ImpersonationBanner } from "./impersonation-banner";
import { PremiumThemeProvider, BODY, ACCENT_TEXT } from "@/lib/premium-theme";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Avaliador tem um item só no menu: no tablet (abaixo de lg) o menu lateral
  // fica recolhido no botão de topo e a tela de avaliação ganha a largura.
  const { user } = useAuth();
  const compactUntilLg = hasRole(user, "avaliador");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Menu do celular como diálogo: Esc fecha, o Tab fica preso dentro dele e,
  // ao fechar, o foco volta ao botão que o abriu.
  useEffect(() => {
    if (!mobileOpen) {
      if (wasOpen.current) menuButtonRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const focusables = () => Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])",
    ) ?? []).filter(el => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setMobileOpen(false); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0], last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && !!drawerRef.current?.contains(active);
      if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  return (
    <div
      className="app-shell flex h-screen overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}
    >
      {/* Desktop: sidebar persistente */}
      <div className={cn("no-print hidden shrink-0", compactUntilLg ? "lg:flex" : "md:flex")}>
        <Sidebar />
      </div>

      {/* Mobile: drawer overlay */}
      {mobileOpen && (
        <div className={cn("no-print fixed inset-0 z-50 flex", compactUntilLg ? "lg:hidden" : "md:hidden")}>
          <div ref={drawerRef} role="dialog" aria-modal="true" aria-label="Menu" className="absolute left-0 top-0 h-full z-10">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <main className="app-main flex-1 h-full overflow-y-auto relative flex flex-col">
        {/* Barra superior mobile */}
        <div
          className={cn("no-print sticky top-0 z-30 flex items-center justify-between px-4 h-14 shrink-0 transition-colors duration-300", compactUntilLg ? "lg:hidden" : "md:hidden")}
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="text-center">
            <span className="block font-black text-base uppercase tracking-tight leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Maratona
            </span>
            <span className="block font-bold text-[11px] uppercase tracking-wider leading-none mt-0.5" style={{ color: ACCENT_TEXT }}>
              Resultados
            </span>
          </div>
          {/* espaçador para centralizar o título */}
          <div className="w-9" />
        </div>

        <div className="no-print"><ImpersonationBanner /></div>
        <div className="relative z-10 min-h-full pb-12 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PremiumThemeProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </PremiumThemeProvider>
  );
}
