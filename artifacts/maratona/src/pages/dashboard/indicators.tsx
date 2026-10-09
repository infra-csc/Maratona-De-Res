// Faixa de indicadores do Dashboard: responde num relance "como está o
// ciclo" — nota média, eventos, avaliações e bônus —, e cada célula é um
// atalho para a tela que detalha aquele número.
import type { DashboardSummary } from "@workspace/api-client-react";
import { BonusPair } from "@/components/shared";
import { cn, fmtNum, plural } from "@/lib/utils";
import { Bone, StackBar, StatLink, surfaceCls } from "./dashboard-ui";

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const STRIP = cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border");

export function IndicatorsSkeleton() {
  return (
    <div role="status" aria-live="polite" data-testid="dashboard-loading" className={STRIP}>
      <span className="sr-only">Carregando o painel…</span>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="bg-card px-4 py-4 lg:px-5 lg:py-[18px] space-y-2.5">
          <Bone className="h-3 w-24" /><Bone className="h-8 w-20" /><Bone className="h-3 w-36 max-w-full" />
          <Bone className="h-3 w-20 hidden lg:block" />
        </div>
      ))}
    </div>
  );
}

export function Indicators({ summary, isAll, pastCycle, afterEnd, withCycle }: {
  summary: DashboardSummary;
  isAll: boolean;
  pastCycle: boolean;
  /** Eventos do próximo ciclo cadastrados neste (fora do período). */
  afterEnd: number;
  withCycle: (href: string) => string;
}) {
  // Bônus: oficial (ciclos fechados) × projetado (ciclo aberto, muda até o
  // fechamento) — nunca somados num número só sem dizer o que é cada parte.
  const bonusOfficial = summary.bonusOfficial ?? null;
  const bonusProjected = summary.bonusProjected ?? null;
  const hasSplit = bonusOfficial != null && bonusProjected != null;
  const showBoth = hasSplit && bonusOfficial > 0 && bonusProjected > 0;
  // Com as duas partes, NENHUM número principal: oficial e projetado lado a
  // lado (a soma dos dois não é um valor que exista para ninguém).
  const bonusMain = showBoth ? null
    : !hasSplit ? summary.totalBonusPreview
    : bonusOfficial > 0 ? bonusOfficial : bonusProjected;
  const bonusTitle = showBoth ? "Bônus · oficial e projetado"
    : isAll ? "Bônus · todos os ciclos"
    : hasSplit && bonusOfficial > 0 && bonusProjected === 0 ? "Bônus do ciclo · oficial"
    : pastCycle ? "Bônus do ciclo" : "Bônus projetado";
  const bonusDetail = showBoth ? null
    : !pastCycle && !isAll && bonusMain === 0 && summary.quarterAverage == null ? "Sem projeção enquanto ninguém tiver nota."
    : hasSplit && bonusOfficial > 0 ? "Oficial — ciclo fechado."
    : hasSplit ? (isAll ? "Projetado — só o ciclo aberto tem bônus." : "Projetado — muda até o fechamento do ciclo.")
    : isAll ? "Soma dos ciclos (o atual é estimativa)." : pastCycle ? "Valor apurado no ciclo." : "Estimativa do ciclo.";

  // submitted + pending = eventos abertos para avaliação; o percentual é a
  // parte com todas as avaliações concluídas.
  const submitted = summary.submittedEvaluations ?? 0;
  const pending = summary.pendingEvaluations ?? 0;
  const evalTotal = submitted + pending;
  const progress = evalTotal > 0 ? Math.round((submitted / evalTotal) * 100) : 0;
  const avg = summary.quarterAverage;

  return (
    <section aria-label="Indicadores do ciclo" data-testid="dashboard-indicators" className={STRIP}>
      <StatLink
        testId="kpi-avg"
        label={isAll ? "Nota média geral" : "Nota média"}
        value={<span data-testid="text-quarter-avg">{avg != null ? fmtNum(avg, 1) : "—"}</span>}
        unit={avg != null ? "pontos" : undefined}
        title={isAll ? "Média de cada colaborador ponderada pelos eventos com nota" : "Média das notas finais de quem tem evento com nota no ciclo"}
        sub={isAll ? "Ponderada pelos eventos com nota de cada pessoa." : avg == null ? "Nenhum evento com nota ainda." : "De quem tem evento com nota."}
        href={withCycle("/results")}
        action="Ver ranking"
      />
      <StatLink
        testId="kpi-events"
        label="Eventos confirmados"
        value={<span data-testid="text-total-events">{summary.totalEvents}</span>}
        unit={`de ${summary.eventsInCycle} ${isAll ? "nos ciclos" : "no ciclo"}`}
        title="Eventos do período com resultado confirmado; os que começam depois do fim do ciclo ficam à parte"
        sub={<>
          {summary.eventsInCycle === 0 ? "Nenhum evento no período." : "Com resultado confirmado."}
          {afterEnd > 0 && <span data-testid="text-events-after-end"> · +{afterEnd} fora do período</span>}
        </>}
        href={withCycle("/events")}
        action="Ver eventos"
      />
      <StatLink
        testId="kpi-evaluations"
        label={isAll ? "Avaliações · ciclo atual" : "Avaliações concluídas"}
        value={<span data-testid="text-eval-progress">{evalTotal > 0 ? `${progress}%` : "—"}</span>}
        title="Eventos abertos para avaliação com todos os critérios respondidos"
        sub={evalTotal > 0 && pending === 0
          ? <>{plural(evalTotal, "evento concluído", "eventos concluídos")} — nada pendente.</>
          : evalTotal > 0
          ? <><b className="font-semibold text-foreground">{plural(pending, "evento pendente", "eventos pendentes")}</b> · {submitted} de {evalTotal} {evalTotal === 1 ? "concluído" : "concluídos"}</>
          : "Nenhum evento aberto para avaliação ainda."}
        href={pastCycle ? null : "/evaluations"}
        action="Abrir a Central"
      >
        {evalTotal > 0 && (
          <StackBar
            className="mt-3"
            label={`${submitted} de ${evalTotal} eventos com avaliação concluída; ${pending} pendentes`}
            parts={[{ value: submitted, cls: "bg-[var(--status-ok)]" }, { value: pending, cls: "bg-[var(--status-warn)]" }]}
          />
        )}
      </StatLink>
      <StatLink
        testId="kpi-bonus"
        label={bonusTitle}
        value={showBoth ? undefined : <span data-testid="text-projected-bonus">{bonusMain != null ? fmtBRL(bonusMain) : "—"}</span>}
        sub={bonusDetail}
        href={withCycle("/results")}
        action="Ver pagamentos"
      >
        {showBoth && (
          <span className="mt-2 block" data-testid="text-projected-bonus">
            <BonusPair official={bonusOfficial!} projected={bonusProjected!} format={fmtBRL} data-testid="dashboard-bonus" className="max-sm:grid-cols-1 max-sm:gap-2" />
          </span>
        )}
      </StatLink>
    </section>
  );
}
