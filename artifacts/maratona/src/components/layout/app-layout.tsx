import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu } from "lucide-react";
import { Sidebar, navLabelFor } from "./sidebar";
import { ImpersonationBanner } from "./impersonation-banner";
import { BrandMark, Wordmark } from "./shell-ui";
import { PremiumThemeProvider, BODY } from "@/lib/premium-theme";
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
  const [location] = useLocation();

  // Aba do navegador com o nome da tela (várias abas abertas deixam de ser iguais).
  useEffect(() => {
    const label = navLabelFor(location);
    document.title = label ? `${label} · Maratona` : "Maratona de Resultados";
  }, [location]);

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
    // Começa no item da tela atual (onde a pessoa está); sem ele, no primeiro.
    (drawerRef.current?.querySelector<HTMLElement>("[aria-current=\"page\"]") ?? focusables()[0])?.focus();
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
    // A faixa do Modo Dev fica FORA da área que rola: nunca cobre os cabeçalhos
    // fixos das telas (antes, presa em top:0 dentro do <main>, cobria).
    <div className="app-shell flex h-dvh flex-col overflow-hidden bg-background text-foreground" style={{ fontFamily: BODY }}>
      {/* Teclado: pula os itens do menu direto para a tela. */}
      <a
        href="#conteudo"
        onClick={e => { e.preventDefault(); document.getElementById("conteudo")?.focus(); }}
        className="font-condensed sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-[13px] focus:font-bold focus:uppercase focus:tracking-[0.06em] focus:text-primary-foreground focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>
      <div className="no-print shrink-0"><ImpersonationBanner /></div>

      <div className="app-row flex min-h-0 flex-1">
        {/* Desktop: menu persistente */}
        <div className={cn("no-print hidden shrink-0", compactUntilLg ? "lg:flex" : "md:flex")}>
          <Sidebar />
        </div>

        {/* Celular/tablet: menu como diálogo sobre a tela */}
        {mobileOpen && (
          <div className={cn("no-print fixed inset-0 z-50 flex", compactUntilLg ? "lg:hidden" : "md:hidden")}>
            <div
              className="absolute inset-0 bg-black/55 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
              aria-hidden="true"
              onClick={() => setMobileOpen(false)}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="relative h-full shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-left motion-safe:duration-200"
            >
              <Sidebar onClose={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="app-main relative flex h-full min-w-0 flex-1 flex-col overflow-y-auto">
          {/* Barra superior do celular/tablet: menu à esquerda, marca ao centro. */}
          <div className={cn("no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-1.5", compactUntilLg ? "lg:hidden" : "md:hidden")}>
            <button
              ref={menuButtonRef}
              type="button"
              aria-expanded={mobileOpen}
              aria-haspopup="dialog"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors duration-150 hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <Link
              href={compactUntilLg ? "/evaluations" : "/"}
              aria-label="Maratona de Resultados — início"
              className="mx-auto flex min-w-0 items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandMark size={28} />
              <Wordmark compact />
            </Link>
            {/* Contrapeso do botão de menu: a marca fica no centro de verdade. */}
            <span className="size-11 shrink-0" aria-hidden="true" />
          </div>

          <div id="conteudo" tabIndex={-1} className="relative z-10 min-h-full pb-12 flex-1 outline-none">
            {children}
          </div>
        </main>
      </div>
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
