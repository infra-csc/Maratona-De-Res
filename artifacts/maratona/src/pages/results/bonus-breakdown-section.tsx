import type { RankingDetailBonusBreakdown } from "@workspace/api-client-react";
import { Wallet2 } from "lucide-react";
import { cn, fmtDate, fmtNum } from "@/lib/utils";
import { CONDENSED, WARNING, AMBER, GOOD } from "@/lib/premium-theme";
import { contrastingTextColor, fmtBRL, fmtBRLShort } from "./helpers";

const BONUS_STATUS_LABEL: Record<string, string> = {
  projected: "Projetado",
  approved: "Aprovado",
  scheduled: "Agendado",
  paid: "Pago",
  blocked: "Bloqueado",
  not_eligible: "Não elegível",
};

type BonusBreakdownData = RankingDetailBonusBreakdown;

/** Conta completa do bônus no detalhamento: base + cada evento extra + total. */
export function BonusBreakdownSection({ bd }: { bd: BonusBreakdownData }) {
  const dateFull = { day: "2-digit", month: "2-digit", year: "numeric" } as const;
  const zeroMsg = bd.zeroReason === "not_eligible"
    ? "Não elegível ao bônus: " + (bd.eligibilityReason ?? "motivo não informado") + "."
    : bd.zeroReason === "no_bonus_platoon"
    ? "Nota final " + (bd.baseScore != null ? fmtNum(bd.baseScore, 2) : "—") + " está na faixa “" + (bd.basePlatoon ?? "sem faixa") + "”, que não paga bônus. Nesse caso os eventos extras também não são pagos."
    : bd.zeroReason === "no_result"
    ? "Resultado do ciclo ainda não calculado para este colaborador (nenhum evento confirmado que conte para nota)."
    : null;
  const diverges = bd.storedTotal != null && Math.abs(bd.storedTotal - bd.totalValue) > 0.01;
  const rowStyle: React.CSSProperties = { backgroundColor: "var(--card)" };
  const muted: React.CSSProperties = { color: "var(--muted-foreground)" };
  return (
    <section className="space-y-2.5" data-testid="detail-bonus-breakdown">
      <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
        <Wallet2 size={14} /> Composição do Bônus
      </h4>

      {zeroMsg && (
        <div className="px-3 py-2.5 text-[12px] font-semibold leading-snug" style={{ border: "2px solid " + AMBER, color: "var(--foreground)", backgroundColor: "rgba(232,162,61,0.08)" }}>
          {zeroMsg}
        </div>
      )}

      <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--border)" }}>
        {/* Prêmio base */}
        <div className="flex items-start gap-3 px-3 py-3" style={rowStyle}>
          <div className="flex-1 min-w-0">
            <p className="font-black uppercase text-[12px] leading-tight">Prêmio base da faixa</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] font-bold" style={muted}>
              {bd.basePlatoon ? (
                <span className="px-1.5 py-0.5 rounded font-black uppercase" style={{ backgroundColor: bd.basePlatoonColor ?? "var(--secondary)", color: bd.basePlatoonColor ? contrastingTextColor(bd.basePlatoonColor) : "var(--muted-foreground)" }}>
                  {bd.basePlatoon}
                  {bd.basePlatoonMinScore != null && bd.basePlatoonMaxScore != null && (
                    <span className="opacity-60 ml-1">{bd.basePlatoonMinScore}–{bd.basePlatoonMaxScore}</span>
                  )}
                </span>
              ) : <span>Sem faixa</span>}
              <span>· nota final {bd.baseScore != null ? fmtNum(bd.baseScore, 2) : "—"}</span>
            </div>
          </div>
          <span className={cn("font-black text-lg shrink-0", !bd.applied && "line-through opacity-50")} style={{ fontFamily: CONDENSED }}>{fmtBRL(bd.baseValue)}</span>
        </div>

        {/* Eventos extras */}
        <div className="px-3 py-3" style={{ ...rowStyle, borderTop: "1px solid var(--border)" }}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-black uppercase text-[12px] leading-tight">Bônus por evento extra</p>
              <p className="mt-1 text-[11px] font-bold" style={muted}>
                {bd.scoredEventsCount} prova(s) pontuada(s) · mínimo {bd.minEvents} · {bd.extraEvents.length} extra(s) × {fmtBRL(bd.extraEvents[0]?.value ?? 0)}, o valor por evento adicional da faixa da média. Extras contados a partir da {bd.minEvents + 1}ª prova, em ordem de data.
              </p>
            </div>
            <span className={cn("font-black text-lg shrink-0", !bd.applied && "line-through opacity-50")} style={{ fontFamily: CONDENSED }}>{fmtBRL(bd.extraValue)}</span>
          </div>
          {bd.extraEvents.length > 0 ? (
            <div className="mt-2.5 rounded-md overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {bd.extraEvents.map((ev, idx) => (
                <div key={ev.eventId} data-testid={"detail-bonus-extra-" + ev.eventId} className="flex items-center gap-2.5 px-2.5 py-2" style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined, backgroundColor: "var(--secondary)" }}>
                  <span className="text-[11px] font-black shrink-0 w-7 text-center" style={muted}>{ev.position}ª</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold uppercase text-[11px] leading-tight truncate" title={ev.eventName}>{ev.eventName}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] font-bold" style={muted}>
                      {ev.startDate && <span>{fmtDate(ev.startDate, dateFull)}</span>}
                      <span>· nota {fmtNum(ev.eventScore, 1)}</span>
                    </div>
                  </div>
                  <span className="font-black text-[12px] shrink-0" style={{ color: ev.value > 0 ? GOOD : "var(--muted-foreground)" }}>
                    {ev.value > 0 ? "+" + fmtBRLShort(ev.value) : "R$ 0"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-semibold" style={muted}>
              Nenhum evento extra: {bd.scoredEventsCount} prova(s) pontuada(s) para um mínimo de {bd.minEvents}.
            </p>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between px-4 py-3.5" style={{ backgroundColor: bd.applied ? "var(--primary)" : "var(--secondary)", borderTop: "2px solid var(--border)" }}>
          <div>
            <span className="text-xs font-black uppercase tracking-widest block" style={{ fontFamily: CONDENSED, color: bd.applied ? "var(--primary-foreground)" : "var(--muted-foreground)", opacity: 0.8 }}>Bônus do Ciclo</span>
            {bd.applied && (
              <span className="text-[11px] font-bold block mt-0.5" style={{ color: "var(--primary-foreground)", opacity: 0.65 }}>
                {fmtBRLShort(bd.baseValue)} base + {fmtBRLShort(bd.extraValue)} extra
              </span>
            )}
          </div>
          <span className="text-3xl font-black" style={{ fontFamily: CONDENSED, color: bd.applied ? "var(--primary-foreground)" : "var(--muted-foreground)" }} data-testid="detail-bonus-value">{fmtBRL(bd.totalValue)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold" style={muted}>
        {bd.bonusStatus && <span>Status: <strong style={{ color: "var(--foreground)" }}>{BONUS_STATUS_LABEL[bd.bonusStatus] ?? bd.bonusStatus}</strong></span>}
        {bd.paymentMethod && <span>· Pagamento: {bd.paymentMethod}</span>}
        {bd.paymentDueDate && <span>· Previsto: {fmtDate(bd.paymentDueDate.slice(0, 10), dateFull)}</span>}
        {bd.paidAt && <span>· Pago em: {fmtDate(bd.paidAt.slice(0, 10), dateFull)}</span>}
      </div>

      {diverges && (
        <div className="px-3 py-2.5 text-[12px] font-semibold leading-snug" style={{ border: "2px solid " + WARNING, color: "var(--foreground)", backgroundColor: "rgba(229,72,77,0.08)" }}>
          O valor gravado no ciclo é {fmtBRL(bd.storedTotal ?? 0)}, diferente da conta acima. Algum dado mudou depois do último cálculo: use "Recalcular Ciclo" na aba Bônus &amp; Pagamentos.
        </div>
      )}
    </section>
  );
}
