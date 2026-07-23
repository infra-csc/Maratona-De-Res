import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, Users, BarChart3, Trophy, Star,
  Settings, ClipboardList, UserCheck, Building2, ShieldCheck,
  Database, LogOut, Target, Menu, X, TrendingUp,
  FolderLock, BookOpen, Settings2, Sun, Moon
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePremiumTheme, CONDENSED, WARNING } from "@/lib/premium-theme";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    name: "Gestão",
    items: [
      { label: "Dashboard", path: "/", icon: LayoutDashboard },
      { label: "Eventos", path: "/events", icon: Calendar },
      { label: "Avaliações", path: "/evaluations", icon: ClipboardList },
      { label: "Calibrações", path: "/calibrations", icon: Target, roles: ["admin", "rh", "diretoria"] },
      { label: "Resultados & Ranking", path: "/results", icon: Trophy },
    ]
  },
  {
    name: "Cadastros",
    items: [
      { label: "Colaboradores", path: "/employees", icon: Users },
      { label: "Critérios", path: "/criteria", icon: Star, roles: ["admin", "rh"] },
      { label: "Áreas", path: "/areas", icon: Building2, roles: ["admin", "rh"] },
      { label: "Usuários", path: "/users", icon: ShieldCheck, roles: ["admin", "rh"] },
      { label: "Tipos de Lançamento", path: "/penalty-types", icon: Settings2, roles: ["admin", "rh"] },
    ]
  },
  {
    name: "Controle",
    items: [
      { label: "Penalidades e Méritos", path: "/absences", icon: UserCheck, roles: ["admin", "rh", "diretoria"] },
      { label: "Regras do Sistema", path: "/rules", icon: Settings, roles: ["admin", "rh"] },
      { label: "Integração", path: "/integration", icon: Database, roles: ["admin", "rh"] },
      { label: "Auditoria", path: "/audit", icon: FolderLock, roles: ["admin", "rh"] },
    ]
  },
  {
    name: "Colaborador",
    items: [
      { label: "Meu Desempenho", path: "/meu-desempenho", icon: TrendingUp },
      { label: "Como Funciona", path: "/como-funciona", icon: BookOpen },
    ]
  }
];

interface SidebarProps {
  /** Chamado ao clicar em um item de nav no mobile — fecha o drawer */
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { isDark, toggle } = usePremiumTheme();

  const isMobile = !!onClose;

  return (
    <aside
      className={cn(
        "flex flex-col h-screen transition-all duration-300 shrink-0 z-20",
        isMobile ? "w-64" : (collapsed ? "w-[72px]" : "w-64")
      )}
      style={{ backgroundColor: "var(--card)", borderRight: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between px-4 h-16 shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        {(!collapsed || isMobile) && (
          <div className="flex flex-col min-w-0">
            <span className="font-black text-lg uppercase tracking-tight leading-none truncate" style={{ fontFamily: CONDENSED }}>
              Maratona
            </span>
            <span className="font-bold text-[11px] uppercase tracking-wider leading-none mt-1 truncate" style={{ color: "var(--accent)" }}>
              Resultados
            </span>
          </div>
        )}
        {isMobile ? (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors shrink-0 hover:opacity-70"
            style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            <X size={18} />
          </button>
        ) : (
          <button
            data-testid="button-toggle-sidebar"
            onClick={() => setCollapsed(v => !v)}
            className={cn("p-1.5 rounded-lg transition-colors shrink-0 hover:opacity-70", collapsed && "mx-auto")}
            style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            {collapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        )}
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {navGroups.map(group => {
            const visibleItems = group.items.filter(item => {
              if (user?.role === "avaliador") return item.path === "/evaluations";
              if (user?.role === "visualizador") return ["/meu-desempenho", "/como-funciona"].includes(item.path);
              if (user?.role === "diretoria") {
                return ["/", "/calibrations", "/results", "/rules", "/absences", "/criteria"].includes(item.path);
              }
              return !item.roles || (user && item.roles.includes(user.role));
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.name} className="space-y-1.5">
                {(!collapsed || isMobile) && (
                  <p className="px-2 text-[10px] font-bold uppercase tracking-[0.15em] mb-2" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                    {group.name}
                  </p>
                )}
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                      title={collapsed && !isMobile ? item.label : undefined}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-semibold uppercase tracking-tight transition-all hover:opacity-80",
                        collapsed && !isMobile && "justify-center",
                      )}
                      style={{
                        fontFamily: CONDENSED,
                        backgroundColor: isActive ? "var(--primary)" : "transparent",
                        color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      }}
                    >
                      <Icon size={18} className="shrink-0" />
                      {(!collapsed || isMobile) && <span className="whitespace-nowrap pr-1.5">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-4 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={toggle}
          className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all w-full hover:opacity-70", collapsed && !isMobile && "justify-center")}
          style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          title={collapsed && !isMobile ? (isDark ? "Modo claro" : "Modo escuro") : undefined}
        >
          {isDark ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
          {(!collapsed || isMobile) && <span>{isDark ? "Modo Claro" : "Modo Escuro"}</span>}
        </button>

        {user && (
          <>
            <div className={cn("flex items-center gap-3", collapsed && !isMobile && "justify-center")}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                <span className="text-sm font-black" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>
                  {user.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
                </span>
              </div>
              {(!collapsed || isMobile) && (
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{user.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>{user.role}</p>
                </div>
              )}
            </div>
            <button
              data-testid="button-logout"
              onClick={logout}
              title={collapsed && !isMobile ? "Sair" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-bold uppercase text-[13px] tracking-tight transition-all hover:opacity-70",
                collapsed && !isMobile ? "justify-center w-full" : "w-full"
              )}
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: WARNING }}
            >
              <LogOut size={18} className="shrink-0" />
              {(!collapsed || isMobile) && <span>Encerrar Sessão</span>}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
