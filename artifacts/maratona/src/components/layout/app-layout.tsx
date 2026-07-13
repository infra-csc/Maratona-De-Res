import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./sidebar";
import { ImpersonationBanner } from "./impersonation-banner";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fb] selection:bg-[#ccff00] selection:text-[#161e00]">
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

      <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative flex flex-col">
        {/* Barra superior mobile */}
        <div
          className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white border-b-2 border-[#191c1e] shrink-0"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 border-2 border-[#191c1e] text-[#191c1e] hover:bg-[#ccff00] transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="text-center">
            <span className="block text-[#191c1e] font-black italic text-base uppercase tracking-tighter leading-none">
              Maratona
            </span>
            <span className="block text-[#506600] font-bold italic text-[10px] uppercase tracking-wider leading-none mt-0.5">
              Resultados
            </span>
          </div>
          {/* espaçador para centralizar o título */}
          <div className="w-9" />
        </div>

        <ImpersonationBanner />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-50" />
        <div className="relative z-10 min-h-full pb-12 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
