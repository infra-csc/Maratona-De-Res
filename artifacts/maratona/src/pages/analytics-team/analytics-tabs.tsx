// Topo e abas das Análises. Mesma linguagem do topo de Resultados & Ranking e
// do Dashboard: barra fixa com o título (único h1), o seletor de ciclo e as
// ações; logo abaixo, as visões das Análises (rotas próprias, links
// compartilháveis — o ?ciclo= acompanha a troca de aba).
import type { ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { AlertTriangle, ArrowLeft, RotateCw } from "lucide-react";
import { CYCLE_URL_PARAM, CycleSelect, CycleScopeNotice, type CycleScopeState } from "@/components/cycle-select";
import { cn } from "@/lib/utils";
import { Bone, btnSecondary, surfaceCls } from "../dashboard/dashboard-ui";

export type AnalyticsTab = "gestao" | "eventos" | "colaborador" | "equipe";

const TABS: { key: AnalyticsTab; href: string; label: string; short: string }[] = [
  { key: "gestao", href: "/analytics", label: "Painel de gestão", short: "Painel" },
  { key: "eventos", href: "/analytics/eventos", label: "Por evento", short: "Por evento" },
  { key: "colaborador", href: "/analytics/colaborador", label: "Por colaborador", short: "Por colaborador" },
  { key: "equipe", href: "/analytics/apresentacao", label: "Apresentação para a equipe", short: "Apresentação" },
];

/**
 * Visões das Análises: abas sublinhadas (rola na horizontal no celular, sem
 * rolar a página). Fora do topo (Apresentação), com a linha de base própria.
 */
export function AnalyticsTabs({ current, className = "border-b border-border" }: { current: AnalyticsTab; className?: string }) {
  const ciclo = new URLSearchParams(useSearch()).get(CYCLE_URL_PARAM);
  const suffix = ciclo ? `?${CYCLE_URL_PARAM}=${encodeURIComponent(ciclo)}` : "";
  return (
    <nav aria-label="Visões de Análises" className={cn("no-print min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:[mask-image:linear-gradient(to_right,#000_86%,transparent)]", className)}>
      <ul className="flex min-w-max gap-1">
        {TABS.map(t => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <Link
                href={`${t.href}${suffix}`}
                aria-current={active ? "page" : undefined}
                data-testid={`tab-analytics-${t.key}`}
                className={cn(
                  "group relative font-condensed inline-flex items-center min-h-11 lg:min-h-10 px-3 rounded-t-md text-[13px] font-bold uppercase tracking-[0.06em] whitespace-nowrap",
                  "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
                <span aria-hidden className={cn(
                  "absolute left-2 right-2 bottom-0 h-[3px] rounded-full transition-[background-color,opacity] duration-150",
                  active ? "bg-foreground" : "bg-transparent group-hover:bg-border",
                )} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Topo fixo das Análises: título, seletor de ciclo e ações à direita; as abas
 * ficam na mesma barra (linha de baixo), à mão em qualquer ponto da rolagem.
 */
export function AnalyticsTopBar({ scope, current, actions, back }: {
  scope: CycleScopeState;
  current: AnalyticsTab;
  actions?: ReactNode;
  /** Atalho de volta (ex.: relatório aberto a partir do painel). */
  back?: { href: string; label: string } | null;
}) {
  return (
    <div className="no-print md:sticky md:top-0 z-30 bg-card border-b border-border">
      <div className="px-4 md:px-6 pt-3 lg:pt-0 pb-2 lg:pb-0 lg:h-16 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:gap-5">
        <div className="order-1 min-w-0 flex items-center gap-2">
          {back && (
            <Link href={back.href} aria-label={back.label} title={back.label}
              className="shrink-0 -ml-1 w-9 h-9 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft size={17} aria-hidden />
            </Link>
          )}
          <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">
            Análises
          </h1>
        </div>
        <div className="order-3 col-span-2 lg:order-2 w-full lg:w-auto min-w-0"><CycleSelect scope={scope} /></div>
        {actions && <div className="order-2 lg:order-3 lg:ml-auto flex items-center gap-1.5 lg:gap-2 shrink-0">{actions}</div>}
      </div>
      <AnalyticsTabs current={current} className="px-2 md:px-4" />
    </div>
  );
}

/** Corpo padrão das abas: largura máxima e ritmo vertical iguais ao Dashboard. */
export const analyticsBody = "flex-1 px-4 md:px-6 py-5 space-y-4 max-w-[1680px] w-full mx-auto min-w-0";

/** Carregando: o desenho da tela (faixa de indicadores + blocos), sem "nada" antes de os dados chegarem. */
export function AnalyticsSkeleton({ label, cells = 5 }: { label: string; cells?: number }) {
  return (
    <div role="status" aria-live="polite" data-testid="analytics-skeleton" className="space-y-4">
      <span className="sr-only">{label}…</span>
      <div className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-5 gap-px bg-border")} aria-hidden>
        {Array.from({ length: cells }, (_, i) => (
          <div key={i} className={cn("bg-card px-4 py-4 lg:px-5 space-y-2.5", i === cells - 1 && cells % 2 === 1 && "col-span-2 lg:col-span-1")}>
            <Bone className="h-3 w-24" /><Bone className="h-8 w-20" /><Bone className="h-3 w-36 max-w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn(surfaceCls, "p-5 space-y-4")}>
            <Bone className="h-5 w-48" /><Bone className="h-3 w-72 max-w-full" />
            <div className="space-y-3 pt-1">
              {[0, 1, 2, 3].map(j => <Bone key={j} className="h-4" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Falha ao carregar uma visão inteira: o que houve e tentar de novo (fora do ciclo atual, o aviso de consulta logo acima já tem "Voltar ao ciclo atual"). */
export function AnalyticsError({ title, detail, onRetry, testId = "analytics-error-block" }: {
  title: string; detail?: string | null; onRetry?: () => void; scope?: CycleScopeState; testId?: string;
}) {
  return (
    <div role="alert" data-testid={testId} className="rounded-2xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-5 py-6 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <span className="w-10 h-10 shrink-0 rounded-full bg-card text-[var(--status-danger-text)] flex items-center justify-center"><AlertTriangle size={18} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="font-condensed text-[20px] font-black uppercase leading-tight text-foreground">{title}</p>
        <p className="text-[14px] text-muted-foreground mt-0.5">{detail || "Verifique a conexão e tente de novo. Nenhum dado se perdeu."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRetry && <button type="button" onClick={onRetry} className={btnSecondary} data-testid="button-analytics-retry"><RotateCw size={15} aria-hidden /> Tentar de novo</button>}
      </div>
    </div>
  );
}

/**
 * Carregando / erro das Análises SEM perder o topo, as abas e o seletor de
 * ciclo (a tela inteira virar "carregando" ou "erro" escondia o seletor — sem
 * jeito de voltar).
 */
export function AnalyticsScopeFallback({ scope, current, state, loadingLabel, errorTitle, errorDetail, onRetry }: {
  scope: CycleScopeState;
  current: AnalyticsTab;
  state: "loading" | "error";
  loadingLabel: string;
  errorTitle: string;
  errorDetail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="min-h-full flex flex-col min-w-0" data-testid={`analytics-${state}`}>
      <AnalyticsTopBar scope={scope} current={current} />
      <div className={analyticsBody}>
        <CycleScopeNotice scope={scope} />
        {state === "loading"
          ? <AnalyticsSkeleton label={loadingLabel} />
          : <AnalyticsError title={errorTitle} detail={errorDetail} onRetry={onRetry} scope={scope} />}
      </div>
    </div>
  );
}
