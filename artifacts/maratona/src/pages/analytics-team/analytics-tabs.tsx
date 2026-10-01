import { Link } from "wouter";
import { CONDENSED } from "@/lib/premium-theme";

/** Troca entre o painel de gestão, a apresentação para a equipe e a análise por colaborador (rotas próprias, links compartilháveis). */
export function AnalyticsTabs({ current }: { current: "gestao" | "equipe" | "colaborador" }) {
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
                href={t.href}
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
