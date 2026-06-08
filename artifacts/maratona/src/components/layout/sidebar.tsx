import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, Users, BarChart3, Trophy, Star,
  Settings, ClipboardList, UserCheck, Building2, ShieldCheck,
  Database, LogOut, Target, Menu, X, TrendingUp,
  FolderLock
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      { label: "Resultados Trimestrais", path: "/results", icon: BarChart3, roles: ["admin", "rh", "diretoria"] },
      { label: "Maratona / Ranking", path: "/ranking", icon: Trophy },
    ]
  },
  {
    name: "Cadastros",
    items: [
      { label: "Colaboradores", path: "/employees", icon: Users },
      { label: "Critérios", path: "/criteria", icon: Star, roles: ["admin", "rh"] },
      { label: "Áreas", path: "/areas", icon: Building2, roles: ["admin", "rh"] },
      { label: "Usuários", path: "/users", icon: ShieldCheck, roles: ["admin", "rh"] },
    ]
  },
  {
    name: "Controle",
    items: [
      { label: "Penalidades", path: "/absences", icon: UserCheck, roles: ["admin", "rh", "diretoria"] },
      { label: "Regras do Sistema", path: "/rules", icon: Settings, roles: ["admin", "rh"] },
      { label: "Integração", path: "/integration", icon: Database, roles: ["admin", "rh"] },
      { label: "Auditoria", path: "/audit", icon: FolderLock, roles: ["admin", "rh"] },
    ]
  },
  {
    name: "Colaborador",
    items: [
      { label: "Meu Desempenho", path: "/meu-desempenho", icon: TrendingUp },
    ]
  }
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-white border-r-2 border-[#191c1e] transition-all duration-300 shrink-0 z-20",
        collapsed ? "w-[72px]" : "w-64"
      )}
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b-2 border-[#191c1e] shrink-0">
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[#191c1e] font-black italic text-lg uppercase tracking-tighter leading-none truncate">
              Maratona
            </span>
            <span className="text-[#506600] font-bold italic text-[11px] uppercase tracking-wider leading-none mt-1 truncate">
              Resultados
            </span>
          </div>
        )}
        <button
          data-testid="button-toggle-sidebar"
          onClick={() => setCollapsed(v => !v)}
          className={cn(
            "p-1.5 border-2 border-[#191c1e] text-[#191c1e] hover:bg-[#ccff00] transition-colors shrink-0",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {navGroups.map(group => {
            const visibleItems = group.items.filter(item => {
              // Avaliadores have a focused experience: only the Avaliações tab.
              if (user?.role === "avaliador") return item.path === "/evaluations";
              // Diretoria sees a focused set of sections (calibração e acompanhamento).
              if (user?.role === "diretoria") {
                return ["/", "/calibrations", "/results", "/ranking", "/rules", "/absences", "/criteria"].includes(item.path);
              }
              return !item.roles || (user && item.roles.includes(user.role));
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.name} className="space-y-1.5">
                {!collapsed && (
                  <p className="px-2 text-[10px] font-black italic uppercase tracking-widest text-[#747a60] mb-2">
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
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-[13px] font-bold italic uppercase tracking-tight transition-all",
                        collapsed && "justify-center",
                        isActive
                          ? "bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] -skew-x-6"
                          : "text-[#444933] border-2 border-transparent hover:text-[#506600] hover:-skew-x-3"
                      )}
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && <span className="whitespace-nowrap pr-1.5">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {user && (
        <div className="border-t-2 border-[#191c1e] p-4 bg-[#f2f4f6]">
          <div className={cn("flex items-center gap-3 mb-4", collapsed && "justify-center")}>
            <div className="w-10 h-10 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center shrink-0 -skew-x-6">
              <span className="text-sm font-black italic text-[#161e00] skew-x-6">
                {user.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-[#191c1e] text-sm font-black italic truncate">{user.name}</p>
                <p className="text-[#747a60] text-[10px] font-bold uppercase tracking-widest mt-0.5 truncate">{user.role}</p>
              </div>
            )}
          </div>
          <button
            data-testid="button-logout"
            onClick={logout}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 border-2 border-[#191c1e] text-[#191c1e] hover:bg-[#ba1a1a] hover:text-white font-bold italic uppercase text-[13px] tracking-tight transition-all",
              collapsed ? "justify-center w-full" : "w-full"
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Encerrar Sessão</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
