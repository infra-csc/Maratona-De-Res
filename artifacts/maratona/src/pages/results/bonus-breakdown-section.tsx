import type { RankingDetailBonusBreakdown } from "@workspace/api-client-react";
import { AlertTriangle, Info, Wallet2 } from "lucide-react";
import { cn, fmtDate, fmtNum, plural } from "@/lib/utils";
import { fmtBRL, fmtBRLShort } from "./helpers";
import { FaixaBadge } from "./badges";
import { PayStatusChip } from "./payments-list";
import { Notice, SectionTitle, surfaceCls } from "./results-ui";

type BonusBreakdownData = RankingDetailBonusBreakdown;

/** Conta completa do bônus na ficha: base da faixa + cada evento extra (valor da MESMA faixa) = total. */
export function BonusBreakdownSection({ bd, readOnly = false }: { bd: BonusBreakdownData; readOnly?: boolean }) {
  const dateFull = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
  const zeroMsg = bd.zeroReason === "not_eligible"
    ? "Não elegível ao bônus: " + (bd.eligibilityReason ?? "motivo não informado") + "."
    : bd.zeroReason === "no_bonus_platoon"
    ? "Nota final " + (bd.baseScore != null ? fmtNum(bd.baseScore, 1) : "—") + " está na faixa “" + (bd.basePlatoon ?? "sem faixa") + "”, que não paga bônus. Nesse caso os eventos extras também não são pagos."
    : bd.zeroReason === "no_result"
    ? "Resultado do ciclo ainda não calculado para este colaborador (nenhum evento confirmado que conte para nota)."
    : null;
  const diverges = bd.storedTotal != null && Math.abs(bd.storedTotal - bd.totalValue) > 0.01;
  const struck = !bd.applied && "line-through text-muted-foreground";
  return (
    <section data-testid="detail-bonus-breakdown">
      <SectionTitle icon={Wallet2}>Composição do bônus</SectionTitle>

      {zeroMsg && <Notice icon={Info} tone="warn" className="mb-2.5">{zeroMsg}</Notice>}

      <div className={cn(surfaceCls, "overflow-hidden")}>
        {/* Prêmio base */}
        <div className="flex items-start gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <p className="font-condensed text-[15px] font-bold uppercase leading-tight">Prêmio base da faixa</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
              {bd.basePlatoon
                ? <FaixaBadge name={bd.basePlatoon} color={bd.basePlatoonColor} minScore={bd.basePlatoonMinScore} maxScore={bd.basePlatoonMaxScore} />
                : <span>Sem faixa</span>}
              <span className="tabular-nums">nota final {bd.baseScore != null ? fmtNum(bd.baseScore, 2) : "—"}</span>
            </div>
          </div>
          <span className={cn("font-condensed text-[20px] font-black tabular-nums shrink-0", struck)}>{fmtBRL(bd.baseValue)}</span>
        </div>

        {/* Eventos extras */}
        <div className="px-4 py-3.5 border-t border-border">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-condensed text-[15px] font-bold uppercase leading-tight">Bônus por evento extra</p>
              <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
                {plural(bd.scoredEventsCount, "prova pontuada", "provas pontuadas")} · mínimo {bd.minEvents} · {plural(bd.extraEvents.length, "extra", "extras")} × {fmtBRL(bd.extraEvents[0]?.value ?? 0)}, o valor por evento adicional da faixa da média. Extras contados a partir da {bd.minEvents + 1}ª prova, em ordem de data.
              </p>
            </div>
            <span className={cn("font-condensed text-[20px] font-black tabular-nums shrink-0", struck)}>{fmtBRL(bd.extraValue)}</span>
          </div>
          {bd.extraEvents.length > 0 ? (
            <ol className="mt-3 rounded-lg border border-border divide-y divide-border overflow-hidden bg-secondary/40">
              {bd.extraEvents.map(ev => (
                <li key={ev.eventId} data-testid={"detail-bonus-extra-" + ev.eventId} className="flex items-center gap-3 px-3 py-2">
                  <span className="font-condensed text-[13px] font-bold w-7 text-center text-muted-foreground tabular-nums shrink-0">{ev.position}ª</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-condensed text-[14px] font-bold uppercase leading-tight truncate" title={ev.eventName}>{ev.eventName}</p>
                    <p className="text-[12px] text-muted-foreground tabular-nums">
                      {ev.startDate && <>{fmtDate(ev.startDate, dateFull)} · </>}nota {fmtNum(ev.eventScore, 1)}
                    </p>
                  </div>
                  <span className={cn("font-condensed text-[15px] font-bold tabular-nums shrink-0", ev.value > 0 ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>
                    {ev.value > 0 ? "+" + fmtBRLShort(ev.value) : "R$ 0"}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[12.5px] text-muted-foreground">
              Nenhum evento extra: {plural(bd.scoredEventsCount, "prova pontuada", "provas pontuadas")} para um mínimo de {bd.minEvents}.
            </p>
          )}
        </div>

        {/* Total */}
        <div className={cn("flex items-center justify-between gap-3 px-4 py-4 border-t border-border", bd.applied ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
          <div className="min-w-0">
            <span className="block font-condensed text-[12px] font-bold uppercase tracking-[0.08em] opacity-80">Bônus do ciclo</span>
            {bd.applied && <span className="block mt-0.5 text-[12px] opacity-75 tabular-nums">{fmtBRLShort(bd.baseValue)} base + {fmtBRLShort(bd.extraValue)} extra</span>}
          </div>
          <span className="font-condensed text-[32px] font-black leading-none tabular-nums whitespace-nowrap" data-testid="detail-bonus-value">{fmtBRL(bd.totalValue)}</span>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted-foreground">
        {bd.bonusStatus && <span className="inline-flex items-center gap-1.5">Situação <PayStatusChip status={bd.bonusStatus} /></span>}
        {bd.paymentMethod && <span>Pagamento: {bd.paymentMethod}</span>}
        {bd.paymentDueDate && <span>Previsto: {fmtDate(bd.paymentDueDate.slice(0, 10), dateFull)}</span>}
        {bd.paidAt && <span>Pago em: <b className="font-semibold text-foreground">{fmtDate(bd.paidAt.slice(0, 10), dateFull)}</b></span>}
      </div>

      {diverges && (
        <Notice icon={AlertTriangle} tone="danger" className="mt-2.5">
          O valor gravado no ciclo é {fmtBRL(bd.storedTotal ?? 0)}, diferente da conta acima. {readOnly ? "Algum dado mudou depois do último cálculo deste ciclo; vale o valor gravado." : <>Algum dado mudou depois do último cálculo: use <strong>Recalcular</strong>, no topo da tela.</>}
        </Notice>
      )}
    </section>
  );
}
