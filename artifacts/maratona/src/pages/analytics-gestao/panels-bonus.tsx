// Blocos de bônus do Painel de gestão: funil (sempre decrescente, na ordem
// fixa de lib/bonus-funnel), faixas com o bônus OFICIAL e o PROJETADO
// separados, e quem está perto da próxima faixa.
import type { AnalyticsOverview } from "@workspace/api-client-react";
import { AlertTriangle, Filter, Layers, Target } from "lucide-react";
import type { FaixaBonus } from "@/lib/faixa-bonus-split";
import { funnelSteps, isFunnelMonotonic } from "@/lib/bonus-funnel";
import { cn, fmtNum, plural } from "@/lib/utils";
import { Chip } from "../dashboard/dashboard-ui";
import { SERIES } from "../analytics-person/ui";
import { Block, FooterLink, InlineState } from "./block";
import { BarList, DataTable, ViewToggle, useView } from "./viz";
import { brl, n1, pct } from "./indicators";

type D = AnalyticsOverview;

/** Funil do bônus: participaram → atingiram o mínimo → elegíveis → com bônus. */
export function FunnelPanel({ data, isAll, withCycle, className }: { data: D; isAll: boolean; withCycle: (h: string) => string; className?: string }) {
  const k = data.kpis;
  const steps = funnelSteps(data.funnel, { isAll, minEvents: isAll ? null : k.minEvents });
  const total = steps[0]?.count ?? 0;
  const who = isAll ? "participações" : "colaboradores";
  return (
    <Block
      id="funil"
      testId="analytics-funnel"
      icon={Filter}
      className={className}
      title="Funil do bônus"
      sub={isAll ? "Participações de todos os ciclos até quem recebeu bônus (cada ciclo com o seu mínimo de eventos)." : `De quem participou do ciclo até quem recebe bônus (mínimo de ${k.minEvents} eventos).`}
      footer={<FooterLink href={withCycle("/results")}>Elegibilidade e bônus</FooterLink>}
    >
      {total === 0 ? (
        <InlineState icon={Filter} title={`Nenhum ${isAll ? "participante" : "colaborador"} no ranking ainda.`}>O funil aparece quando houver resultado apurado.</InlineState>
      ) : (
        <div className="px-4 lg:px-5 pb-4">
          {!isFunnelMonotonic(steps) && (
            <p role="note" data-testid="funnel-inconsistent" className="mb-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug bg-[var(--status-warn-bg)] text-foreground">
              <AlertTriangle size={15} aria-hidden className="mt-[1px] shrink-0 text-[var(--status-warn-text)]" />
              Uma etapa tem mais {who} que a anterior (por exemplo, elegibilidade definida manualmente pelo RH sem o mínimo de eventos).
            </p>
          )}
          <ol aria-label="Funil do bônus" className="space-y-3">
            {steps.map((f, i) => {
              const p = pct(f.count, total);
              const drop = i > 0 ? steps[i - 1].count - f.count : 0;
              return (
                <li key={f.stage} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] font-semibold text-foreground leading-snug">{f.label}</span>
                    <span className="shrink-0 tabular-nums text-[12.5px] text-muted-foreground">
                      <b className="font-condensed text-[18px] font-black text-foreground">{f.count}</b> · {p}%
                    </span>
                  </div>
                  {/* Barra ancorada à esquerda: cada etapa, a fração do total que chegou até ali. */}
                  <div aria-hidden className="mt-1.5 h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.max(p, f.count > 0 ? 2 : 0)}%`, backgroundColor: SERIES }} />
                  </div>
                  {drop > 0 && <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">−{drop} desde a etapa anterior</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Block>
  );
}

/**
 * Colaboradores por faixa: cores do cadastro (contorno nas claras), a contagem
 * e o bônus da faixa — oficial e projetado SEMPRE separados (Total geral: os
 * dois, quando a soma pessoa × ciclo fecha; num ciclo, o tipo do ciclo).
 */
export function FaixasPanel({ data, isAll, readOnly, split, nearCount, withCycle, className }: {
  data: D; isAll: boolean; readOnly: boolean; split: Map<string, FaixaBonus> | null;
  /** Elegíveis perto da próxima faixa (ciclo); null = não se aplica (Total geral). */
  nearCount: number | null;
  withCycle: (h: string) => string; className?: string;
}) {
  const [view, setView] = useView();
  const closed = !isAll && data.scope?.status === "closed";
  const kind = closed ? "Oficial" : "Projetado";
  const max = Math.max(1, ...data.faixas.map(f => f.count));
  const who = (n: number) => (isAll ? plural(n, "participação", "participações") : plural(n, "colaborador", "colaboradores"));
  const bonusOf = (f: D["faixas"][number]) => {
    if (isAll && split) {
      const s = split.get(f.name) ?? { official: 0, projected: 0 };
      return { official: s.official, projected: s.projected, mixed: false };
    }
    if (isAll) return { official: 0, projected: 0, mixed: true };
    return closed ? { official: f.bonusTotal, projected: 0, mixed: false } : { official: 0, projected: f.bonusTotal, mixed: false };
  };
  const bonusText = (f: D["faixas"][number]) => {
    const b = bonusOf(f);
    if (b.mixed) return f.bonusTotal > 0 ? `Oficial + projetado ${brl(f.bonusTotal)}` : "sem bônus";
    const parts = [b.official > 0 ? `Oficial ${brl(b.official)}` : null, b.projected > 0 ? `Projetado ${brl(b.projected)}` : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : "sem bônus";
  };
  const total = data.faixas.reduce((s, f) => s + f.count, 0);
  return (
    <Block
      id="faixas"
      testId="analytics-faixas"
      icon={Layers}
      className={className}
      title="Colaboradores por faixa"
      sub={isAll
        ? "Resultados de todos os ciclos por faixa (cada pessoa conta uma vez por ciclo) e o bônus da faixa: oficial (ciclos fechados) e projetado (ciclo aberto), separados."
        : closed || readOnly ? "Em que faixa cada um terminou pela nota final do ciclo, e o bônus da faixa." : "Em que faixa cada um está hoje pela nota final, e o bônus projetado da faixa."}
      aside={total > 0 ? <ViewToggle value={view} onChange={setView} label="Ver as faixas como" testId="faixas-view" /> : undefined}
      footer={<FooterLink href={withCycle("/results")}>Ranking por faixa</FooterLink>}
    >
      {total === 0 ? (
        <InlineState icon={Layers} title="Ninguém com faixa ainda.">A distribuição aparece quando houver resultado apurado.</InlineState>
      ) : view === "tabela" ? (
        <DataTable
          caption="Colaboradores por faixa"
          head={isAll && split ? ["Faixa", "Participações", "Bônus oficial", "Bônus projetado"] : ["Faixa", isAll ? "Participações" : "Colaboradores", isAll ? "Bônus (oficial + projetado)" : `Bônus ${kind.toLowerCase()}`]}
          rows={data.faixas.map(f => {
            const b = bonusOf(f);
            return isAll && split
              ? [<span className="font-semibold">{f.name}</span>, f.count, b.official > 0 ? brl(b.official) : "—", b.projected > 0 ? brl(b.projected) : "—"]
              : [<span className="font-semibold">{f.name}</span>, f.count, f.bonusTotal > 0 ? brl(f.bonusTotal) : "—"];
          })}
          sort={data.faixas.map(f => {
            const b = bonusOf(f);
            return isAll && split ? [f.minScore ?? 0, f.count, b.official, b.projected] : [f.minScore ?? 0, f.count, f.bonusTotal];
          })}
        />
      ) : (
        <>
          <BarList
            ariaLabel="Colaboradores por faixa"
            testId="faixas-bars"
            max={max}
            rows={data.faixas.map(f => ({
              key: f.name,
              testId: "faixa-row",
              name: f.name,
              swatch: f.color ?? null,
              label: <>{f.name}{f.minScore != null && <span className="ml-1.5 text-[12px] font-normal tabular-nums text-muted-foreground">{fmtNum(f.minScore, 2)}–{fmtNum(f.maxScore ?? 0, 2)}</span>}</>,
              sub: <span data-testid={isAll && split ? "faixa-bonus-split" : undefined} className={cn(bonusText(f) === "sem bônus" && "text-muted-foreground")}>{bonusText(f)}</span>,
              value: f.count,
              display: String(f.count),
              tip: [
                { label: isAll ? "Participações" : "Colaboradores", value: String(f.count) },
                { label: "Do total", value: `${pct(f.count, total)}%` },
                { label: "Bônus da faixa", value: bonusText(f) },
              ],
            }))}
          />
          <p className="px-4 lg:px-5 pb-3 -mt-1 text-[12.5px] text-muted-foreground">
            {who(total)} no total.{" "}
            {nearCount === 0 && <span data-testid="near-next-faixa-empty">Ninguém a menos de 3 pontos da próxima faixa que paga bônus.</span>}
          </p>
        </>
      )}
    </Block>
  );
}

/** Elegíveis a até 3 pontos da próxima faixa que paga bônus (só num ciclo). */
export function NearPanel({ data, readOnly, withCycle, className }: { data: D; readOnly: boolean; withCycle: (h: string) => string; className?: string }) {
  const rows = data.nearNextFaixa;
  return (
    <Block
      id="perto"
      testId="analytics-near"
      icon={Target}
      className={className}
      title="Perto da próxima faixa"
      sub={readOnly ? "Elegíveis que ficaram a até 3 pontos da próxima faixa que paga bônus, e quanto teriam recebido." : "Elegíveis a até 3 pontos da próxima faixa que paga bônus, e quanto passariam a receber."}
      aside={<Chip tone="info">{plural(rows.length, "pessoa", "pessoas")}</Chip>}
      footer={<FooterLink href={withCycle("/results")}>Ranking completo</FooterLink>}
    >
      <DataTable
        caption="Perto da próxima faixa"
        head={["Colaborador", "Nota", "Faixa atual", "Próxima", "Faltam", "Bônus hoje", "Na próxima"]}
        align={["l", "r", "l", "l", "r", "r", "r"]}
        minWidth={640}
        rows={rows.map(r => [
          <span className="font-semibold">{r.name}</span>, <b>{n1(r.finalResult)}</b>, r.currentFaixa ?? "—", r.nextFaixa,
          <span className="font-semibold text-[var(--status-info-text)]">{n1(r.gap)} pt</span>, brl(r.currentBonus), <b>{brl(r.potentialBonus)}</b>,
        ])}
        sort={rows.map(r => [r.name, r.finalResult, r.currentFaixa, r.nextFaixa, r.gap, r.currentBonus, r.potentialBonus])}
      />
    </Block>
  );
}
