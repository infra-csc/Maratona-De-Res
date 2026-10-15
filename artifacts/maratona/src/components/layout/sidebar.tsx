import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, Users, Trophy, Star,
  Settings, ClipboardList, UserCheck, Building2, ShieldCheck, CalendarRange,
  Database, LogOut, Target, TrendingUp, PanelLeftClose, PanelLeftOpen,
  FolderLock, BookOpen, Settings2, Sun, Moon, BarChart3, History } from "lucide-react";
import { Fragment, useState } from "react";
import type { User } from "@workspace/api-client-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePremiumTheme } from "@/lib/premium-theme";
import { BrandMark, Wordmark, initials, roleLabel } from "./shell-ui";

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
      { label: "Resultados & Ranking", path: "/results", icon: Trophy, roles: ["admin", "rh", "diretoria"] },
      { label: "Análises", path: "/analytics", icon: BarChart3, roles: ["admin", "rh", "diretoria"] },
      { label: "Linha do tempo", path: "/linha-do-tempo", icon: History, roles: ["admin", "rh"] },
    ]
  },
  {
    name: "Cadastros",
    items: [
      { label: "Ciclos", path: "/cycles", icon: CalendarRange, roles: ["admin", "rh", "diretoria"] },
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

/** Quem vê cada item — a mesma regra de antes, só tirada de dentro do JSX. */
function canSee(user: User | null, item: NavItem): boolean {
  if (user?.role === "avaliador") return item.path === "/evaluations";
  if (user?.role === "visualizador") return ["/meu-desempenho", "/como-funciona"].includes(item.path);
  // "operador": confirma equipes por evento, envia avaliação (Atribuição)
  // e cadastra/edita colaboradores — nada de bônus, regras, auditoria,
  // critérios, calibrações, ranking ou o guia "Como Funciona" (voltado
  // a colaborador, não a este papel operacional).
  if (hasRole(user, "operador")) return ["/events", "/evaluations", "/employees"].includes(item.path);
  if (user?.role === "diretoria") {
    return ["/", "/calibrations", "/results", "/analytics", "/cycles", "/rules", "/absences", "/criteria"].includes(item.path);
  }
  return !item.roles || (!!user && item.roles.includes(user.role));
}

// Menu recolhido é preferência de quem usa (sobrevive ao recarregar).
const COLLAPSED_KEY = "maratona_menu_recolhido";
function readCollapsed(fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(COLLAPSED_KEY);
    return v === null ? fallback : v === "1";
  } catch { return fallback; }
}

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
const tipCls = "font-condensed rounded-lg border-0 bg-foreground px-2.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-background shadow-md";

/** Dica ao lado do item quando só o ícone aparece. */
function Tip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children;
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className={tipCls}>{label}</TooltipContent>
    </Tooltip>
  );
}

interface SidebarProps {
  /** Chamado ao clicar em um item de nav no mobile — fecha o drawer */
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps = {}) {
  const { user, logout, isImpersonating } = useAuth();
  const [location] = useLocation();
  const { isDark, toggle } = usePremiumTheme();
  const isMobile = !!onClose;
  // Avaliador tem um item só: por padrão o menu começa recolhido e a tela de
  // avaliação ganha a largura (quem expandir fica com a escolha salva).
  const [collapsedPref, setCollapsedPref] = useState(() => readCollapsed(hasRole(user, "avaliador")));
  const collapsed = !isMobile && collapsedPref;
  const isEvaluator = user?.role === "avaliador";

  function toggleCollapsed() {
    setCollapsedPref(v => {
      try { localStorage.setItem(COLLAPSED_KEY, v ? "0" : "1"); } catch { /* sem storage */ }
      return !v;
    });
  }

  const groups = navGroups
    .map(g => ({ ...g, items: g.items.filter(item => canSee(user, item)) }))
    .filter(g => g.items.length > 0);

  // 1366×768: o menu do admin (19 itens) cabe sem rolar — itens de 28 px em
  // telas baixas, 36 px a partir de 880 px de altura, 44 px no toque.
  const rowH = isMobile ? "min-h-11" : "h-7 [@media(min-height:880px)]:h-9 [@media(pointer:coarse)]:min-h-11";
  const iconBtn = cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-secondary hover:text-foreground",
    FOCUS,
    isMobile ? "size-11" : "size-8 [@media(pointer:coarse)]:size-11",
  );
  const themeLabel = isDark ? "Modo claro" : "Modo escuro";

  return (
    <aside
      className={cn(
        "flex h-full flex-col shrink-0 z-20 bg-card border-r border-border motion-safe:transition-[width] motion-safe:duration-200 ease-out",
        isMobile ? "w-[280px] max-w-[85vw]" : collapsed ? "w-[68px]" : "w-64",
      )}
    >
      {/* Marca + recolher. 64 px: a linha de baixo encontra a dos cabeçalhos fixos das telas. */}
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-border", collapsed ? "justify-center px-2" : "pl-4 pr-3")}>
        {!collapsed && (
          <Link href={isEvaluator ? "/evaluations" : "/"} onClick={onClose} aria-label="Maratona de Resultados — início" className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-lg", FOCUS)}>
            <BrandMark size={32} />
            <Wordmark />
          </Link>
        )}
        {isMobile ? (
          <button type="button" onClick={onClose} aria-label="Fechar menu" className={iconBtn}>
            <PanelLeftClose size={18} aria-hidden="true" />
          </button>
        ) : (
          <Tip label={collapsed ? "Expandir menu" : "Recolher menu"} show>
            <button
              type="button"
              data-testid="button-toggle-sidebar"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
              aria-expanded={!collapsed}
              className={cn(iconBtn, collapsed && "group/tog size-10 [@media(pointer:coarse)]:size-11")}
            >
              {/* Recolhido, o topo mostra a marca; o ícone de expandir aparece no
                  hover/foco — não fica um ícone igual ao lado do de outra coluna. */}
              {collapsed ? (
                <>
                  <span className="group-hover/tog:hidden group-focus-visible/tog:hidden"><BrandMark size={32} /></span>
                  <PanelLeftOpen size={18} aria-hidden="true" className="hidden group-hover/tog:block group-focus-visible/tog:block" />
                </>
              ) : <PanelLeftClose size={18} aria-hidden="true" />}
            </button>
          </Tip>
        )}
      </div>

      <ScrollArea type="auto" className="flex-1 min-h-0">
        <nav className={cn("px-3", collapsed ? "py-1" : "pt-1 pb-2")} aria-label="Navegação principal">
          {groups.map((group, gi) => (
            <Fragment key={group.name}>
              {/* Avaliador tem um item só (Avaliações): sem título de seção —
                  "Gestão" em cima dele não descrevia nada do que ele faz.
                  Recolhido, o título vira um fio entre os grupos. */}
              {collapsed ? (
                gi > 0 && <div aria-hidden="true" className="mx-2 my-1 h-px bg-border" />
              ) : !isEvaluator ? (
                <p
                  className={cn(
                    "font-condensed flex items-end px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
                    "h-5 [@media(min-height:880px)]:h-7", gi > 0 && "mt-1 [@media(min-height:880px)]:mt-2",
                    isMobile && "h-8",
                  )}
                >
                  {group.name}
                </p>
              ) : (
                <div className="h-2" />
              )}
              <ul className={collapsed ? undefined : "space-y-px"}>
                {group.items.map(item => {
                  const Icon = item.icon;
                  const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                  return (
                    <li key={item.path}>
                      <Tip label={item.label} show={collapsed}>
                        <Link
                          href={item.path}
                          data-testid={`nav-${item.path.replace("/", "") || "dashboard"}`}
                          aria-label={collapsed ? item.label : undefined}
                          aria-current={isActive ? "page" : undefined}
                          onClick={onClose}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 font-condensed text-[13px] uppercase tracking-[0.05em] leading-none transition-colors duration-150",
                            FOCUS,
                            rowH,
                            collapsed && "justify-center px-0",
                            isActive
                              ? "bg-secondary font-bold text-foreground"
                              : "font-semibold text-foreground/75 hover:bg-secondary/70 hover:text-foreground",
                          )}
                        >
                          {/* Trilho do item ativo, colado na borda do menu. */}
                          {isActive && <span aria-hidden="true" className="absolute -left-3 top-1 bottom-1 w-[3px] rounded-r-full bg-[var(--accent)]" />}
                          <Icon
                            size={17}
                            aria-hidden="true"
                            className={cn("shrink-0 transition-colors duration-150", isActive ? "text-[var(--accent-text)]" : "text-muted-foreground group-hover:text-foreground")}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      </Tip>
                    </li>
                  );
                })}
              </ul>
            </Fragment>
          ))}
        </nav>
      </ScrollArea>

      {/* Quem está usando + tema + sair, numa linha só (recolhido: em coluna). */}
      <div className={cn("shrink-0 border-t border-border", collapsed ? "flex flex-col items-center gap-1 p-2" : "flex items-center gap-2.5 p-2.5")}>
        {user && (
          <Tip label={`${user.name} · ${roleLabel(user.role)}`} show={collapsed}>
            <div
              data-testid="sidebar-user"
              tabIndex={collapsed ? 0 : undefined}
              aria-label={collapsed ? `${user.name}, ${roleLabel(user.role)}` : undefined}
              className={cn("flex min-w-0 items-center gap-2.5 rounded-lg", collapsed ? FOCUS : "flex-1 pl-0.5")}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "font-condensed inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-black tracking-[0.02em]",
                  isImpersonating ? "bg-[#d4ff00] text-[#111111]" : "bg-secondary text-foreground",
                )}
              >
                {initials(user.name)}
              </span>
              {!collapsed && (
                <span className="min-w-0 leading-none">
                  <span className="block truncate text-[13px] font-semibold text-foreground">{user.name}</span>
                  <span className="font-condensed mt-1 block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {roleLabel(user.role)}{user.areaName ? ` · ${user.areaName}` : ""}
                  </span>
                </span>
              )}
            </div>
          </Tip>
        )}
        <div className={cn("flex shrink-0", collapsed ? "flex-col gap-1" : "gap-0.5")}>
          <Tip label={themeLabel} show>
            <button type="button" onClick={toggle} aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"} aria-pressed={isDark} className={iconBtn}>
              {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
          </Tip>
          {user && (
            <Tip label="Sair" show>
              <button
                type="button"
                data-testid="button-logout"
                onClick={logout}
                aria-label="Encerrar sessão"
                className={cn(iconBtn, "hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)]")}
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </Tip>
          )}
        </div>
      </div>
    </aside>
  );
}

/** Nome da tela atual pelo menu (aba do navegador: "Eventos · Maratona de Resultados"). */
export function navLabelFor(path: string): string | null {
  for (const g of navGroups) {
    for (const item of g.items) {
      if (path === item.path || (item.path !== "/" && path.startsWith(item.path))) return item.label;
    }
  }
  return null;
}
