// Seções 4–6: penalidades e méritos (tipos ativos), elegibilidade ao bônus
// (mínimo do ciclo atual) e o Bônus Caju (faixas com base e extra por evento).
import { Award, Gift, Info, MinusCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bone, Def, DefList, Example, GuideSection, MathLine, Notice, Swatch } from "./cf-ui";
import { fmtBRL, fmtRange, type GuideData } from "./use-guide-data";

function TypeList({ kind, rows, loading }: { kind: "penalty" | "merit"; rows: GuideData["penalties"]; loading: boolean }) {
  const merit = kind === "merit";
  const ink = merit ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]";
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden min-w-0">
      <p className={cn("flex items-center gap-2 px-4 py-3 sm:px-5 border-b border-border font-condensed text-[13px] font-bold uppercase tracking-[0.06em]", ink)}>
        {merit ? <Award size={15} aria-hidden /> : <MinusCircle size={15} aria-hidden />}
        {merit ? "Méritos (somam pontos ao total)" : "Penalidades (descontam pontos do total)"}
      </p>
      {loading ? (
        <div className="p-4 space-y-3" role="status" aria-label="Carregando tipos"><Bone className="h-4 w-2/3" /><Bone className="h-4 w-1/2" /></div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 sm:px-5 text-[14px] text-muted-foreground">Nenhum tipo de {merit ? "mérito" : "penalidade"} cadastrado.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map(r => (
            <li key={r.id} className="flex items-baseline justify-between gap-4 px-4 py-3 sm:px-5">
              <span className="min-w-0 text-[14.5px] font-semibold leading-snug text-foreground break-words">{r.label}</span>
              <span className={cn("shrink-0 font-condensed text-[20px] font-black leading-none tabular-nums", ink)}>{merit ? "+" : "−"}{r.points}<span className="ml-0.5 text-[12px] font-bold">pts</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AdjustmentsSection({ n, d }: { n: number; d: GuideData }) {
  return (
    <GuideSection id="penalidades" n={n} icon={MinusCircle} title="Penalidades e méritos"
      lead="Além da nota dos eventos, seu resultado final pode ser ajustado por penalidades (descontos) e méritos (acréscimos) registrados pelo RH ao longo do ciclo.">
      <div className="grid gap-4 lg:grid-cols-2">
        <TypeList kind="penalty" rows={d.penalties} loading={d.typesLoading} />
        <TypeList kind="merit" rows={d.merits} loading={d.typesLoading} />
      </div>
      <Example title="Por que o peso muda">
        Os pontos são descontados da <strong>soma total das notas</strong> e depois divididos pelo número de eventos — por isso o impacto na sua média depende de quantos eventos você participou. Exemplo: uma penalidade de 50 pts em 10 eventos reduz a média em 5 pts. O RH pode ajustar os valores ou criar novos tipos conforme as regras do ciclo.
      </Example>
    </GuideSection>
  );
}

export function EligibilitySection({ n, d }: { n: number; d: GuideData }) {
  return (
    <GuideSection id="elegibilidade" n={n} icon={Trophy} title="Elegibilidade ao bônus"
      lead={<>Para ter direito ao Bônus Caju, você precisa atingir o número mínimo de <strong className="text-foreground">eventos confirmados</strong> definido pelo RH para o ciclo.</>}>
      <div className="rounded-2xl bg-primary text-primary-foreground px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6" data-testid="guide-min-events">
        {d.minEvents !== null && (
          <p className="shrink-0 flex items-baseline gap-2">
            <span className="font-condensed text-[64px] font-black leading-[0.8] tabular-nums">{d.minEvents}</span>
            <span className="font-condensed text-[16px] font-bold uppercase tracking-[0.04em] opacity-80">eventos</span>
          </p>
        )}
        <p className="text-[15px] leading-relaxed">
          {d.minEvents !== null
            ? <>Você precisa de pelo menos <strong>{d.minEvents} eventos confirmados</strong> neste ciclo para ter direito ao bônus.</>
            : "O número mínimo de eventos é definido pelo RH por ciclo."}{" "}
          <span className="opacity-80">Esse número é definido pelo RH e pode mudar a cada ciclo — acompanhe seu progresso em “Eventos que contam”, em Meu desempenho.</span>
        </p>
      </div>
      <DefList>
        <Def term="Não elegível">Se você não atingir o mínimo de eventos confirmados, o bônus aparece como “Sem bônus” (não elegível para este ciclo).</Def>
        <Def term="Eventos extras" strong>Cada evento confirmado acima do mínimo gera um bônus adicional. O valor de cada evento extra é o da faixa da sua nota média no ciclo (a mesma faixa do bônus base) — a nota de um evento sozinho não muda esse valor.</Def>
      </DefList>
      <Notice icon={Info} tone="warn">
        Atenção: participações marcadas com <strong>“Não conta para a nota”</strong> nos seus eventos não entram na contagem de elegibilidade nem na sua média.
      </Notice>
    </GuideSection>
  );
}

export function BonusSection({ n, d }: { n: number; d: GuideData }) {
  const tiers = d.bonusTiers;
  // Exemplo com as faixas de verdade: a faixa do meio, com 2 eventos extras.
  const ex = tiers.length > 0 ? tiers[Math.floor((tiers.length - 1) / 2)] : null;
  const extras = 2;
  return (
    <GuideSection id="bonus" n={n} icon={Gift} title="O Bônus Caju"
      lead="O Bônus Caju é o benefício financeiro que você recebe ao ser elegível e atingir uma boa pontuação no ciclo.">
      <DefList>
        <Def term="Como é calculado">Depende da sua Nota Final no ciclo. Quanto maior a nota, maior o bônus (definido por faixas de nota).</Def>
        <Def term="Bônus base">É o valor fixo correspondente à sua faixa de nota.</Def>
        <Def term="Bônus extra" strong>Para cada evento que você participou além {d.minEvents !== null ? `dos ${d.minEvents} mínimos` : "do mínimo exigido"}, você recebe um valor fixo por evento, definido pela faixa da sua nota média (a mesma faixa do prêmio base).</Def>
        <Def term="Pagamento">O bônus é pago via Caju Saldo Livre após o fechamento e aprovação do ciclo pelo RH.</Def>
      </DefList>

      {d.tiersLoading ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3" role="status" aria-label="Carregando faixas"><Bone className="h-4 w-1/2" /><Bone className="h-4 w-2/3" /><Bone className="h-4 w-1/3" /></div>
      ) : tiers.length > 0 && (
        <div data-testid="guide-tiers">
          {/* Celular: uma linha por faixa, com os dois valores lado a lado. */}
          <ul className="md:hidden rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {[...tiers].reverse().map(t => (
              <li key={t.id} className="px-4 py-3.5">
                <p className="flex items-center gap-2"><Swatch color={t.color} /><span className="text-[15px] font-bold text-foreground">{t.name}</span><span className="ml-auto text-[13px] tabular-nums text-muted-foreground">nota {fmtRange(t.minScore, t.maxScore, t.maxInclusive)}</span></p>
                <p className="mt-2 grid grid-cols-2 gap-3">
                  <span><span className="block font-condensed text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Bônus base</span><span className="font-condensed text-[22px] font-black tabular-nums text-foreground">{fmtBRL(t.bonusValue)}</span></span>
                  <span><span className="block font-condensed text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Extra por evento</span><span className="font-condensed text-[22px] font-black tabular-nums text-foreground">{t.bonusPerExtraEvent > 0 ? `+${fmtBRL(t.bonusPerExtraEvent)}` : "—"}</span></span>
                </p>
              </li>
            ))}
          </ul>
          {/* Tablet/desktop: tabela. */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left border-collapse">
              <caption className="sr-only">Faixas de nota e valores do bônus no ciclo atual</caption>
              <thead>
                <tr className="border-b border-border">
                  {["Faixa", "Nota", "Bônus base", "Extra por evento"].map((h, i) => (
                    <th key={h} scope="col" className={cn("px-5 py-3 font-condensed text-[12.5px] font-bold uppercase tracking-[0.08em] text-muted-foreground", i > 1 && "text-right")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...tiers].reverse().map(t => (
                  <tr key={t.id} className="transition-colors duration-150 hover:bg-secondary/40">
                    <th scope="row" className="px-5 py-3.5 text-[15px] font-bold text-foreground"><span className="inline-flex items-center gap-2.5"><Swatch color={t.color} />{t.name}</span></th>
                    <td className="px-5 py-3.5 text-[14px] tabular-nums text-muted-foreground">{fmtRange(t.minScore, t.maxScore, t.maxInclusive)}</td>
                    <td className="px-5 py-3.5 text-right font-condensed text-[20px] font-black tabular-nums text-foreground">{fmtBRL(t.bonusValue)}</td>
                    <td className="px-5 py-3.5 text-right font-condensed text-[18px] font-bold tabular-nums text-muted-foreground">{t.bonusPerExtraEvent > 0 ? `+${fmtBRL(t.bonusPerExtraEvent)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">As faixas acima são as vigentes no ciclo atual, definidas pelo RH, e podem ser ajustadas entre ciclos.</p>
        </div>
      )}

      {ex && ex.bonusPerExtraEvent > 0 && (
        <Example title="Exemplo com as faixas de hoje">
          <p className="text-muted-foreground">
            A <strong className="text-foreground">nota média</strong> define a faixa. Quem fecha o ciclo na faixa <strong className="text-foreground">{ex.name}</strong>
            {d.minEvents !== null ? <> com {d.minEvents + extras} eventos ({extras} acima do mínimo)</> : <> com {extras} eventos acima do mínimo</>} recebe:
          </p>
          <div className="mt-2 max-w-sm">
            <MathLine label={`Bônus base da faixa ${ex.name}`} value={fmtBRL(ex.bonusValue)} />
            <MathLine op="+" label={`${extras} eventos extras × ${fmtBRL(ex.bonusPerExtraEvent)}`} value={fmtBRL(extras * ex.bonusPerExtraEvent)} />
            <MathLine op="=" label="Bônus do ciclo" value={fmtBRL(ex.bonusValue + extras * ex.bonusPerExtraEvent)} total />
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">O valor de cada evento extra é sempre o da mesma faixa da média — a nota de um evento sozinho não muda esse valor.</p>
        </Example>
      )}
    </GuideSection>
  );
}
