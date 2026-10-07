import { Link, useSearch } from "wouter";
import { AlertTriangle } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import { CYCLE_URL_PARAM, CycleSelect, CycleScopeNotice, type CycleScopeState } from "@/components/cycle-select";
import { PageHeader, EmptyState, LoadingState } from "@/components/shared";
import { Button } from "@/components/ui/button";

/**
 * Carregando / erro das Análises SEM perder o cabeçalho, as abas e o seletor
 * de ciclo (antes a tela inteira virava "carregando" ou "erro" e o seletor
 * sumia — sem jeito de voltar). No erro, "Voltar ao ciclo atual".
 */
export function AnalyticsScopeFallback({ scope, current, state, loadingLabel, errorTitle, errorDetail }: {
  scope: CycleScopeState;
  current: "gestao" | "equipe" | "colaborador";
  state: "loading" | "error";
  loadingLabel: string;
  errorTitle: string;
  errorDetail?: string | null;
}) {
  return (
    <div className="px-4 md:px-6 py-6 space-y-5" data-testid={`analytics-${state}`}>
      <PageHeader eyebrow={scope.label} title="Análises" actions={<CycleSelect scope={scope} />} />
      <AnalyticsTabs current={current} />
      <CycleScopeNotice scope={scope} />
      {state === "loading" ? (
        <LoadingState lines={8} label={loadingLabel} />
      ) : (
        <EmptyState
          icon={AlertTriangle}
          title={errorTitle}
          description={errorDetail || "Tente novamente em instantes."}
          action={!scope.isCurrent && scope.current ? (
            <Button variant="outline" onClick={() => scope.select("atual")} data-testid="button-analytics-back-current">Voltar ao ciclo atual</Button>
          ) : undefined}
        />
      )}
    </div>
  );
}

/** Troca entre o painel de gestão, a apresentação para a equipe e a análise por colaborador (rotas próprias, links compartilháveis). */
export function AnalyticsTabs({ current }: { current: "gestao" | "equipe" | "colaborador" }) {
  // O ciclo escolhido (?ciclo=) acompanha a troca de aba.
  const ciclo = new URLSearchParams(useSearch()).get(CYCLE_URL_PARAM);
  const suffix = ciclo ? `?${CYCLE_URL_PARAM}=${encodeURIComponent(ciclo)}` : "";
  const tabs = [
    { key: "gestao", href: "/analytics", label: "Painel de gestão" },
    { key: "equipe", href: "/analytics/apresentacao", label: "Apresentação para a equipe" },
    { key: "colaborador", href: "/analytics/colaborador", label: "Por colaborador" },
  ] as const;
  return (
    <nav aria-label="Visões de Análises" className="no-print">
      <ul className="inline-flex flex-wrap rounded-lg p-1 gap-1" style={{ backgroundColor: "var(--secondary)" }}>
        {tabs.map(t => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <Link
                href={`${t.href}${suffix}`}
                aria-current={active ? "page" : undefined}
                data-testid={`tab-analytics-${t.key}`}
                className="inline-flex items-center h-8 px-3 rounded-md text-[12px] font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  fontFamily: CONDENSED,
                  letterSpacing: "0.04em",
                  backgroundColor: active ? "var(--card)" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : undefined,
                }}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
