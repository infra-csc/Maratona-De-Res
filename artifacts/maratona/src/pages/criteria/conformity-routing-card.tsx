import type { AreaConformityRoutingListItem } from "@workspace/api-client-react";
import { Building2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyBlock, Eyebrow, surfaceCls } from "./criteria-ui";
import { conformityAreasOf } from "./helpers";
import { ConformityAreaEvaluatorPicker } from "./evaluator-pickers";
import type { AreaOption, EvaluatorOption } from "./types";

/** Avaliador padrão de cada área da matriz de conformidade (Cenografia e Ferramentas e Case). */
export function ConformityRoutingCard({
  areas, conformityRoutings, evaluators, withoutConduta, areaMode, canEdit,
}: {
  areas: AreaOption[] | undefined;
  conformityRoutings: AreaConformityRoutingListItem[] | undefined;
  evaluators: EvaluatorOption[];
  /** Ciclo atual sem "Conduta" na matriz. */
  withoutConduta: boolean;
  areaMode: boolean;
  canEdit: boolean;
}) {
  const conformityAreas = conformityAreasOf(areas ?? [], { withoutConduta });
  return (
    <section aria-labelledby="conformity-routing-title" data-testid="conformity-routing-card" className={cn(surfaceCls, "overflow-hidden")}>
      <header className="px-5 py-4 flex items-start gap-3 border-b border-border">
        <span className="mt-0.5 w-9 h-9 shrink-0 rounded-lg bg-secondary text-foreground flex items-center justify-center"><ShieldCheck size={17} aria-hidden /></span>
        <div className="min-w-0">
          <Eyebrow as="p">Matriz de Conformidade</Eyebrow>
          <h2 id="conformity-routing-title" className="font-condensed mt-1 text-[20px] font-black uppercase leading-tight text-foreground">Avaliador padrão da matriz</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground max-w-[70ch]">
            {areaMode
              ? "Neste ciclo a matriz é respondida dentro do formulário da área, por qualquer avaliador dela. O avaliador padrão só vale nos ciclos com designação."
              : "Ao liberar as avaliações de um evento, estes avaliadores já vêm preenchidos na matriz — troque no evento só se precisar."}
          </p>
        </div>
      </header>
      {conformityAreas.length === 0 ? (
        <EmptyBlock icon={Building2} title="Áreas da matriz não encontradas" className="py-8">
          A matriz usa as áreas “Cenografia” e “Ferramentas e Case”. Confira os nomes em Áreas.
        </EmptyBlock>
      ) : (
        <ul className="divide-y divide-border">
          {conformityAreas.map(a => {
            const routing = (conformityRoutings ?? []).find(r => r.areaId === a.id);
            return (
              <li key={a.id} data-testid={`conformity-area-${a.id}`} className="px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-x-4 gap-y-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-condensed inline-flex items-center gap-2 text-[16px] font-black uppercase leading-tight text-foreground">
                    <Building2 size={14} aria-hidden className="text-muted-foreground" /> {a.name}
                  </p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="sr-only">Perguntas: </span>
                    {a.questions.map(q => (
                      <span key={q} className="font-condensed inline-flex items-center h-6 px-2 rounded-md border border-border text-[12px] font-bold uppercase tracking-[0.05em] text-muted-foreground">{q}</span>
                    ))}
                    {a.extra && <span className="text-[12.5px] text-muted-foreground">+ {a.extra}</span>}
                  </p>
                  {a.note && <p className="mt-1 text-[12.5px] text-muted-foreground" data-testid="conformity-without-conduta">{a.note}</p>}
                </div>
                <div className="lg:w-[260px] shrink-0 lg:flex lg:justify-end">
                  <ConformityAreaEvaluatorPicker
                    areaId={a.id}
                    areaName={a.name}
                    currentEvaluatorId={routing?.defaultEvaluatorId ?? null}
                    currentEvaluatorName={routing?.defaultEvaluatorName ?? null}
                    evaluators={evaluators}
                    areaMode={areaMode}
                    canEdit={canEdit}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
