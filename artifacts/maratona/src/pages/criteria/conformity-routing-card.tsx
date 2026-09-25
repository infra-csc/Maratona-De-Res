import type { AreaConformityRoutingListItem } from "@workspace/api-client-react";
import { Building2 } from "lucide-react";
import { CONDENSED, PremiumCard } from "@/lib/premium-theme";
import { conformityAreasOf } from "./helpers";
import { ConformityAreaEvaluatorPicker } from "./evaluator-pickers";
import type { AreaOption, EvaluatorOption } from "./types";

/** Avaliador padrão de cada área da matriz de conformidade (Cenografia e Ferramentas e Case). */
export function ConformityRoutingCard({
  areas, conformityRoutings, evaluators,
}: {
  areas: AreaOption[] | undefined;
  conformityRoutings: AreaConformityRoutingListItem[] | undefined;
  evaluators: EvaluatorOption[];
}) {
  const conformityAreas = conformityAreasOf(areas ?? []);
  return (
    <PremiumCard className="overflow-hidden">
      <div className="px-5 py-4" style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
        <h2 className="text-lg font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Avaliador Padrão — Matriz de Conformidade</h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Ao liberar as avaliações de um evento, estes dois avaliadores já vêm preenchidos na matriz — troque no evento só se precisar.</p>
      </div>
      {conformityAreas.length === 0 ? (
        <div className="py-8 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Áreas "Cenografia" e "Ferramentas e Case" não encontradas.</div>
      ) : (
        <ul>
          {conformityAreas.map((a, i) => {
            const routing = (conformityRoutings ?? []).find(r => r.areaId === a.id);
            return (
              <li key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-2 font-bold uppercase text-sm">
                    <Building2 size={14} style={{ color: "var(--muted-foreground)" }} /> {a.name}
                  </span>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{a.description}</p>
                </div>
                <ConformityAreaEvaluatorPicker
                  areaId={a.id}
                  currentEvaluatorId={routing?.defaultEvaluatorId ?? null}
                  currentEvaluatorName={routing?.defaultEvaluatorName ?? null}
                  evaluators={evaluators}
                />
              </li>
            );
          })}
        </ul>
      )}
    </PremiumCard>
  );
}
