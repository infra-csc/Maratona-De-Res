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
      { label: "Calibrações", path: "/calibrations", icon: Target, roles: ["admin", "rh", "avaliador", "diretoria"] },
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
      { label: "Faltas", path: "/absences", icon: UserCheck, roles: ["admin", "rh", "avaliador"] },
      { label: "Regras do Sistema", path: "/rules", icon: Settings, roles: ["admin", "rh"] },
      { label: "Integração", path: "/integration", icon: Database, roles: ["admin", "rh"] },
      { label: "Auditoria", path: "/audit", icon: FolderLock, roles: ["admin", "rh", "diretoria"] },
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
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0 shadow-2xl shadow-black/10 z-20",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="flex items-center justify-between px-5 h-16 border-b border-white/10 shrink-0">
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-white font-black text-sm uppercase tracking-wider leading-tight truncate">
              Maratona de
            </span>
            <span className="text-primary font-black text-sm uppercase tracking-wider leading-tight truncate">
              Resultados
            </span>
          </div>
        )}
        <button
          data-testid="button-toggle-sidebar"
          onClick={() => setCollapsed(v => !v)}
          className={cn(
            "p-1.5 rounded-lg text-sidebar-foreground hover:bg-white/10 hover:text-white transition-colors shrink-0",
            collapsed && "mx-auto"
          )}
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {navGroups.map(group => {
            const visibleItems = group.items.filter(item => 
              !item.roles || (user && item.roles.includes(user.role))
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.name} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/50 mb-2">
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
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                          : "text-sidebar-foreground hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <Icon size={18} className={cn("shrink-0", isActive ? "text-primary-foreground" : "text-sidebar-foreground group-hover:text-white transition-colors")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {user && (
        <div className="border-t border-white/10 p-4 bg-black/10">
          <div className={cn("flex items-center gap-3 mb-4", collapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-primary-foreground">
                {user.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white text-sm font-bold truncate">{user.name}</p>
                <p className="text-sidebar-foreground text-xs uppercase tracking-wider mt-0.5 truncate">{user.role}</p>
              </div>
            )}
          </div>
          <button
            data-testid="button-logout"
            onClick={logout}
            title={collapsed ? "Sair" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground hover:bg-red-500/10 hover:text-red-400 font-medium text-sm transition-all",
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
