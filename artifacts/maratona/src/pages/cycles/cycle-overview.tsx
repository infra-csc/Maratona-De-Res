// Regras e números de um ciclo — a mesma leitura no topo de Ciclos (ciclo
// atual) e no histórico de qualquer ciclo.
import type { CycleSummary } from "@workspace/api-client-react";
import { cn, plural } from "@/lib/utils";
import { RuleItem, StatCell, brl, fmtFull, minEventsText, n1, surfaceCls } from "./cycles-ui";

/**
 * As quatro regras do ciclo, cada uma com o que ela significa. `locked`: ciclo
 * fechado — as regras geraram o resultado oficial e não mudam mais.
 */
export function CycleRules({ cycle, className, cols = "grid-cols-2 lg:grid-cols-4" }: { cycle: CycleSummary; className?: string; cols?: string }) {
  const closed = cycle.status === "closed";
  const min = minEventsText(cycle);
  return (
    <dl className={cn("grid gap-x-6 gap-y-4", cols, className)} data-testid={`cycle-rules-${cycle.id}`}>
      <RuleItem label="Mínimo para o bônus" value={min.value} note={min.note} />
      <RuleItem
        label="Pagamento do bônus"
        value={cycle.paymentDate ? fmtFull(cycle.paymentDate) : <span className="text-muted-foreground">Não definido</span>}
        note={closed ? "Ainda pode mudar (ciclo fechado)" : "Pode mudar a qualquer momento"}
      />
      <RuleItem
        label="Conduta na Matriz"
        value={cycle.conformityWithoutConduta ? "Fora da Matriz" : "Dentro da Matriz"}
        note={cycle.conformityWithoutConduta ? "Avaliada no critério Proatividade/Conduta" : "A pergunta de Conduta desconta na Matriz"}
      />
      <RuleItem
        label="Forma de avaliação"
        value={cycle.areaEvaluation ? "Por área" : "Por designação"}
        note={(cycle.areaEvaluation ? "1ª resposta da área fecha o critério" : "Só quem foi designado no evento") + (closed ? " · travada no fechamento" : " · fixa após a 1ª avaliação")}
      />
    </dl>
  );
}

/** Faixa de indicadores do ciclo (uma superfície, células separadas por fio). */
export function CycleStatBand({ cycle }: { cycle: CycleSummary }) {
  const s = cycle.stats;
  const closed = cycle.status === "closed";
  const after = s.eventsAfterEnd ?? 0;
  // "Abertos" = abertos para avaliação, a regra única do app (o servidor conta
  // igual a Event.openForEvaluation — a mesma de Eventos, Dashboard e Central).
  return (
    <section aria-label="Números do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-5 gap-px bg-border")} data-testid="cycle-stat-band">
      <StatCell
        className="col-span-2 lg:col-span-1"
        testId="cycle-stat-avg"
        label="Nota média"
        value={n1(s.avgFinalResult)}
        sub={`${plural(s.collaborators, "colaborador", "colaboradores")} no ranking`}
      />
      <StatCell
        testId="cycle-stat-events"
        label="Eventos confirmados"
        value={<>{s.eventsConfirmed}<span className="text-muted-foreground text-[0.6em] font-bold"> /{s.eventsTotal}</span></>}
        sub={<>
          {s.eventsOpen > 0 ? plural(s.eventsOpen, "aberto para avaliação", "abertos para avaliação") : "Nenhum aberto para avaliação"}
          {after > 0 && <span className="block" data-testid="cycle-stat-after-end">+{plural(after, "fora do período", "fora do período")} ({after === 1 ? "vai" : "vão"} para o próximo ciclo)</span>}
        </>}
      />
      <StatCell
        testId="cycle-stat-eligible"
        label="Elegíveis ao bônus"
        value={<>{s.eligible}<span className="text-muted-foreground text-[0.6em] font-bold"> /{s.collaborators}</span></>}
        sub={`${plural(s.withBonus, "pessoa", "pessoas")} com bônus`}
      />
      <StatCell
        testId="cycle-stat-bonus"
        label={closed ? "Bônus oficial" : "Bônus projetado"}
        value={brl(s.bonusTotal)}
        sub={closed ? "Apurado no fechamento · soma dos elegíveis" : "Muda até o fechamento · soma dos elegíveis"}
      />
      <StatCell
        testId="cycle-stat-paid"
        label="Bônus pago"
        value={brl(s.bonusPaid)}
        sub={s.bonusTotal > 0 ? `${Math.round((s.bonusPaid / s.bonusTotal) * 100)}% do ${closed ? "oficial" : "projetado"}` : "Nada a pagar"}
      />
    </section>
  );
}
