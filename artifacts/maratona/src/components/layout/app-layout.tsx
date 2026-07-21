import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ImpersonationBanner } from "./impersonation-banner";
import { PremiumThemeProvider, usePremiumTheme, darkTokens, lightTokens, BODY } from "@/lib/premium-theme";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isDark } = usePremiumTheme();
  const tokens = isDark ? darkTokens : lightTokens;

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors duration-300"
      style={{ ...tokens, backgroundColor: "var(--background)", fontFamily: BODY }}
    >
      {/* Desktop: sidebar persistente */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile: drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="absolute left-0 top-0 h-full z-10">
            <Sidebar onClose={() => setMobileOpen(false)} />
          </div>
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      <main className="flex-1 h-full overflow-y-auto relative flex flex-col">
        {/* Barra superior mobile */}
        <div
          className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 shrink-0 transition-colors duration-300"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <button
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
            <span className="block font-bold text-[10px] uppercase tracking-wider leading-none mt-0.5" style={{ color: "var(--accent)" }}>
              Resultados
            </span>
          </div>
          {/* espaçador para centralizar o título */}
          <div className="w-9" />
        </div>

        <ImpersonationBanner />
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
