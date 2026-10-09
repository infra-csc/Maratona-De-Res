// Faixa de indicadores do Painel de gestão: o ciclo num relance — nota,
// eventos, elegibilidade, avaliações e bônus — e cada número é um atalho para
// a tela que o detalha (mesma linguagem do Dashboard).
import type { AnalyticsOverview } from "@workspace/api-client-react";
import { BonusPair } from "@/components/shared";
import { bonusSplit } from "@/lib/bonus-split";
import { cn, fmtNum, plural } from "@/lib/utils";
import { StackBar, StatLink, surfaceCls } from "../dashboard/dashboard-ui";

export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const n1 = (v: number | null | undefined) => (v == null ? "—" : fmtNum(v, 1));
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export function GestaoIndicators({ data, isAll, readOnly, withCycle }: {
  data: AnalyticsOverview; isAll: boolean; readOnly: boolean; withCycle: (href: string) => string;
}) {
  const k = data.kpis;
  const closed = !isAll && data.scope?.status === "closed";
  // Oficial (ciclos fechados) × projetado (ciclo aberto): nunca somados num número só.
  const b = bonusSplit(k, brl, {
    label: isAll ? "Bônus somado" : closed ? "Bônus do ciclo" : "Bônus projetado",
    detail: isAll ? "Soma dos elegíveis de todos os ciclos" : closed ? "Valor apurado no fechamento"
      : k.collaborators === 0 ? "Sem projeção enquanto ninguém tiver nota." : "Soma dos elegíveis — muda até o fechamento",
  });
  const unconfirmed = Math.max(0, k.eventsTotal - k.eventsConfirmed);
  const noCiclo = isAll ? "nos ciclos" : "no ciclo";
  return (
    <section aria-label="Indicadores" data-testid="analytics-kpis"
      className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-border")}>
      <StatLink
        testId="kpi-avg-final"
        label={isAll ? "Nota média geral" : "Nota média"}
        value={n1(k.avgFinalResult)}
        unit={k.avgFinalResult != null ? "pontos" : undefined}
        title={isAll ? "Média de cada colaborador ponderada pelos eventos com nota" : "Média das notas finais de quem está no ranking"}
        sub={isAll
          ? `${plural(k.distinctCollaborators ?? k.collaborators, "colaborador", "colaboradores")} · ${plural(k.collaborators, "participação", "participações")}`
          : k.collaborators > 0 ? `${plural(k.collaborators, "colaborador", "colaboradores")} no ranking` : "Ninguém com nota ainda."}
        href={withCycle("/results")}
        action="Ver ranking"
      />
      <StatLink
        testId="kpi-avg-event"
        label="Nota dos eventos"
        value={n1(k.avgEventScore)}
        unit={k.avgEventScore != null ? "média" : undefined}
        title="Média da nota oficial dos eventos confirmados"
        sub={k.eventsScored > 0 ? `${plural(k.eventsScored, "evento", "eventos")} com nota oficial` : "Nenhum evento com nota oficial."}
        href={withCycle("/analytics/eventos")}
        action="Ver por evento"
      />
      <StatLink
        testId="kpi-events"
        label="Eventos confirmados"
        value={k.eventsConfirmed}
        unit={`de ${k.eventsTotal}`}
        title="Só os eventos com resultado confirmado entram na nota e no bônus"
        sub={k.eventsTotal === 0 ? `Nenhum evento ${noCiclo}.` : unconfirmed > 0
          ? <><b className="font-semibold text-foreground">{plural(unconfirmed, "sem confirmação", "sem confirmação")}</b> · {pct(k.eventsConfirmed, k.eventsTotal)}% confirmados</>
          : `Todos confirmados ${noCiclo}.`}
        href={readOnly ? withCycle("/events") : unconfirmed > 0 ? "/events?status=unconfirmed" : "/events"}
        action={!readOnly && unconfirmed > 0 ? "Ver os pendentes" : "Ver eventos"}
      >
        {k.eventsTotal > 0 && (
          <StackBar className="mt-3" label={`${k.eventsConfirmed} de ${k.eventsTotal} eventos confirmados`}
            parts={[{ value: k.eventsConfirmed, cls: "bg-[var(--status-ok)]" }, { value: unconfirmed, cls: "bg-[var(--status-warn)]" }]} />
        )}
      </StatLink>
      <StatLink
        testId="kpi-eligible"
        label="Elegíveis ao bônus"
        value={k.collaborators > 0 ? k.eligible : "—"}
        unit={k.collaborators > 0 ? `de ${k.collaborators}` : undefined}
        title={isAll ? "Participações elegíveis (cada ciclo com o seu mínimo de eventos)" : `Mínimo de ${k.minEvents} eventos participados`}
        sub={k.collaborators === 0 ? "Ninguém com nota ainda." : isAll ? `${plural(k.withBonus, "participação", "participações")} com bônus` : closed || readOnly ? `${k.withBonus} com bônus` : `${k.withBonus} com bônus hoje`}
        href={withCycle("/results")}
        action="Ver elegibilidade"
      />
      <StatLink
        testId="kpi-evaluations"
        label="Avaliações enviadas"
        value={k.evaluationsSubmitted}
        title="Notas enviadas pelos avaliadores"
        sub={k.evaluationsDraft > 0 && !readOnly ? `${plural(k.evaluationsDraft, "rascunho", "rascunhos")} em aberto` : `Notas enviadas pelos avaliadores ${noCiclo}.`}
        href={readOnly ? null : "/evaluations"}
        action="Abrir a Central"
        className={b.both ? "col-span-2 md:col-span-1" : undefined}
      />
      <StatLink
        testId="kpi-bonus"
        label={b.both ? "Bônus · oficial e projetado" : b.label}
        value={b.both ? undefined : brl(b.single ?? k.bonusTotal)}
        sub={b.both ? undefined : !isAll && !closed && k.collaborators === 0 ? "Sem projeção enquanto ninguém tiver nota." : b.detail}
        href={withCycle("/results")}
        action="Ver pagamentos"
        className={b.both ? "col-span-2 md:col-span-1" : undefined}
      >
        {b.both && (
          <span className="mt-2 block">
            <BonusPair official={b.official!} projected={b.projected!} format={brl} data-testid="kpi-bonus-pair" className="md:grid-cols-1 md:gap-2" />
          </span>
        )}
      </StatLink>
    </section>
  );
}
