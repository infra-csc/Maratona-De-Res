import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, Users, BarChart3, Trophy, Star,
  Settings, ClipboardList, UserCheck, Building2, ShieldCheck,
  Database, LogOut, ChevronDown, ChevronRight, Target, Menu, X, TrendingUp
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Eventos", path: "/events", icon: Calendar },
  { label: "Colaboradores", path: "/employees", icon: Users },
  { label: "Avaliações", path: "/evaluations", icon: ClipboardList },
  { label: "Calibrações", path: "/calibrations", icon: Target, roles: ["admin", "rh", "avaliador", "diretoria"] },
  { label: "Faltas", path: "/absences", icon: UserCheck, roles: ["admin", "rh", "avaliador"] },
  { label: "Resultados Trimestrais", path: "/results", icon: BarChart3, roles: ["admin", "rh", "diretoria"] },
  { label: "Maratona / Ranking", path: "/ranking", icon: Trophy },
  { label: "Critérios", path: "/criteria", icon: Star, roles: ["admin", "rh"] },
  { label: "Áreas", path: "/areas", icon: Building2, roles: ["admin", "rh"] },
  { label: "Usuários", path: "/users", icon: ShieldCheck, roles: ["admin", "rh"] },
  { label: "Regras do Sistema", path: "/rules", icon: Settings, roles: ["admin", "rh"] },
  { label: "Integração", path: "/integration", icon: Database, roles: ["admin", "rh"] },
  { label: "Auditoria", path: "/audit", icon: ShieldCheck, roles: ["admin", "rh", "diretoria"] },
  { label: "Meu Desempenho", path: "/meu-desempenho", icon: TrendingUp },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = navItems.filter(item =>
    !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sidebar-accent-foreground font-bold text-sm leading-tight truncate">
              Maratona de
            </span>
            <span className="text-sidebar-primary font-bold text-sm leading-tight truncate">
              Resultados
            </span>
            <span className="text-sidebar-foreground text-xs mt-0.5 truncate opacity-60">
              Cenográfica
            </span>
          </div>
        )}
        <button
          data-testid="button-toggle-sidebar"
          onClick={() => setCollapsed(v => !v)}
          className="p-1.5 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0"
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
          return (
            <Link key={item.path} href={item.path}>
              <a
                data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon size={16} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </a>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-sidebar-border p-3">
          {!collapsed && (
            <div className="mb-2 px-1">
              <p className="text-sidebar-accent-foreground text-xs font-medium truncate">{user.name}</p>
              <p className="text-sidebar-foreground text-xs opacity-60 capitalize">{user.role}</p>
            </div>
          )}
          <button
            data-testid="button-logout"
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sm w-full transition-colors"
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      )}
    </aside>
  );
}
