import { useGetRankingDetail, getGetRankingDetailQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trophy, Award, AlertTriangle, MapPin } from "lucide-react";
import { cn, fmtDate, fmtNum } from "@/lib/utils";
import { CONDENSED, WARNING, AMBER, GOOD, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { contrastingTextColor, fmtBRL } from "./helpers";
import { BonusBreakdownSection } from "./bonus-breakdown-section";

export function EmployeeDetailSheet({
  employeeId,
  onClose,
}: {
  employeeId: number | null;
  onClose: () => void;
}) {
  const detailParams = { employeeId: employeeId ?? 0 };
  const { data: detail, isLoading: detailLoading } = useGetRankingDetail(detailParams, {
    query: { queryKey: getGetRankingDetailQueryKey(detailParams), enabled: !!employeeId },
  });

  return (
    <Dialog open={!!employeeId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-5xl max-h-[90vh] overflow-y-auto p-0 gap-0 sm:rounded-xl"
        style={{ backgroundColor: "var(--background)", border: "2px solid var(--border)" }}
      >
        {detailLoading || !detail ? (
          <div className="p-10 text-center font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
            <DialogTitle className="sr-only">Carregando detalhamento</DialogTitle>
            Carregando detalhamento...
          </div>
        ) : (
          <div>
            {/* Header brutalist */}
            <DialogHeader className="p-0 text-left space-y-0" style={{ borderBottom: "2px solid var(--border)" }}>
              <div className="px-6 pt-6 pb-4 pr-14 rounded-t-xl" style={{ backgroundColor: "var(--secondary)" }}>
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {detail.employee.functionName && (
                    <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded" style={{ backgroundColor: "var(--accent)", color: "#191c1e" }}>{detail.employee.functionName}</span>
                  )}
                  <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{detail.cycle.name}</span>
                </div>
                <DialogTitle className="text-3xl font-black uppercase tracking-tight leading-tight" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
                  {detail.employee.name}
                </DialogTitle>
                {/* Platoon badge — shown prominently below the name */}
                {(detail.summary as any).platoon && (
                  <div className="mt-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide"
                      style={{
                        backgroundColor: (detail.summary as any).platoonColor ?? "var(--secondary)",
                        color: (detail.summary as any).platoonColor ? contrastingTextColor((detail.summary as any).platoonColor) : "var(--muted-foreground)",
                      }}
                    >
                      {(detail.summary as any).platoon}
                      {(detail.summary as any).platoonMinScore != null && (detail.summary as any).platoonMaxScore != null && (
                        <span className="opacity-60 text-[11px] font-bold">
                          {(detail.summary as any).platoonMinScore}–{(detail.summary as any).platoonMaxScore}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </DialogHeader>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-6 min-w-0">
              {/* Stats grid — brutalist */}
              <section className="grid grid-cols-2 gap-0 rounded-lg overflow-hidden" style={{ border: "2px solid var(--border)" }}>
                <div className="p-4" style={{ backgroundColor: "var(--primary)", borderRight: "2px solid var(--border)" }}>
                  <span className="text-[11px] font-black uppercase tracking-wider block" style={{ color: "var(--primary-foreground)", opacity: 0.7 }}>Nota Final</span>
                  <p className="text-4xl font-black leading-none mt-1" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }} data-testid="detail-final-result">
                    {detail.summary.finalResult != null ? fmtNum(detail.summary.finalResult, 1) : "—"}
                  </p>
                  {detail.summary.finalResult != null && detail.summary.grossAverage != null &&
                   (detail.summary.penaltyPoints > 0 || detail.summary.meritPoints > 0) && (
                    <p className="text-[11px] font-bold mt-1.5" style={{ color: "var(--primary-foreground)", opacity: 0.6 }}>
                      {detail.summary.scoreSum != null && detail.summary.confirmedEventCount != null ? (
                        <>
                          ({fmtNum(detail.summary.scoreSum, 1)}
                          {detail.summary.penaltyPoints > 0 && <> − {detail.summary.penaltyPoints}</>}
                          {detail.summary.meritPoints > 0 && <> + {detail.summary.meritPoints}</>}
                          ) ÷ {detail.summary.confirmedEventCount}
                        </>
                      ) : (
                        <>
                          {fmtNum(detail.summary.grossAverage, 1)}
                          {detail.summary.penaltyPoints > 0 && <> − {fmtNum((detail.summary.penaltyPoints / (detail.summary.confirmedEventCount ?? 1)), 1)}</>}
                          {detail.summary.meritPoints > 0 && <> + {fmtNum((detail.summary.meritPoints / (detail.summary.confirmedEventCount ?? 1)), 1)}</>}
                        </>
                      )}
                      {" "}= {fmtNum(detail.summary.finalResult, 1)}
                    </p>
                  )}
                </div>
                <div className="p-4" style={{ backgroundColor: "var(--card)" }}>
                  <span className="text-[11px] font-black uppercase tracking-wider block" style={{ color: "var(--muted-foreground)" }}>Média Bruta</span>
                  <p className="text-4xl font-black leading-none mt-1" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>
                    {detail.summary.grossAverage != null ? fmtNum(detail.summary.grossAverage, 1) : "—"}
                  </p>
                  {detail.summary.scoreSum != null && detail.summary.confirmedEventCount != null && (
                    <p className="text-[11px] font-bold mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                      Soma: {fmtNum(detail.summary.scoreSum, 1)} ÷ {detail.summary.confirmedEventCount} provas
                    </p>
                  )}
                </div>
                <div className="p-3 flex items-center gap-2" style={{ borderTop: "2px solid var(--border)", borderRight: "2px solid var(--border)", backgroundColor: "var(--card)" }}>
                  <AlertTriangle size={16} className="shrink-0" style={{ color: DANGER_TEXT }} />
                  <div>
                    <span className="text-[11px] font-black uppercase block leading-none" style={{ color: "var(--muted-foreground)" }}>Penalidades</span>
                    <p className="text-xl font-black leading-none mt-0.5" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>-{detail.summary.penaltyPoints}</p>
                  </div>
                </div>
                <div className="p-3 flex items-center gap-2" style={{ borderTop: "2px solid var(--border)", backgroundColor: "var(--card)" }}>
                  <Award size={16} className="shrink-0" style={{ color: GOOD_TEXT }} />
                  <div>
                    <span className="text-[11px] font-black uppercase block leading-none" style={{ color: "var(--muted-foreground)" }}>Méritos</span>
                    <p className="text-xl font-black leading-none mt-0.5" style={{ fontFamily: CONDENSED, color: GOOD_TEXT }}>+{detail.summary.meritPoints}</p>
                  </div>
                </div>
              </section>

              {!detail.summary.isQuarterClosed && (
                <div className="px-4 py-3 text-xs font-black uppercase" style={{ border: "2px solid " + AMBER, color: AMBER_TEXT, backgroundColor: "rgba(232,162,61,0.08)" }}>
                  ⚠ Ciclo ainda não fechado — valores parciais.
                </div>
              )}

              <section className="space-y-2.5">
                <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
                  <Trophy size={14} /> Desempenho nas Provas
                </h4>
                {detail.events.filter(ev => ev.resultsConfirmed).length === 0 ? (
                  <p className="text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum evento confirmado no ciclo.</p>
                ) : (
                  <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--border)" }}>
                    {detail.events.filter(ev => ev.resultsConfirmed).map((ev, idx) => (
                      <div
                        key={ev.eventId}
                        data-testid={`detail-event-${ev.eventId}`}
                        className={cn("flex items-center gap-3 px-3 py-2.5", !ev.countsForScore && "opacity-60")}
                        style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined, backgroundColor: "var(--card)" }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold uppercase text-[12px] leading-tight">{ev.eventName}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                            {(ev.city || ev.state) && (
                              <span className="inline-flex items-center gap-1"><MapPin size={10} />{[ev.city, ev.state].filter(Boolean).join(" / ")}</span>
                            )}
                            {!ev.countsForScore && (
                              <span
                                data-testid={`detail-event-no-score-${ev.eventId}`}
                                className="px-1.5 py-0.5 font-bold text-[11px] uppercase shrink-0"
                                style={{ border: "1px solid " + AMBER, color: AMBER_TEXT }}
                                title={(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno" ? `Função: ${(ev as { participationFunction?: string }).participationFunction ?? "Sup Ceno"} — participação informativa, não entra na nota.` : (ev as { noScoreReason?: string }).noScoreReason === "freela" ? "Freela — não entra na nota." : "Participação informativa — não entra na nota."}
                              >
                                {(ev as { noScoreReason?: string }).noScoreReason === "sup_ceno"
                                  ? "Sup Ceno"
                                  : (ev as { noScoreReason?: string }).noScoreReason === "freela"
                                  ? "Freela"
                                  : "Não conta"}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[11px] uppercase font-bold leading-none mb-0.5" style={{ color: "var(--muted-foreground)" }}>Nota Time</span>
                          <p className="text-xl font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{fmtNum(ev.eventScore, 1)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              </div>

              <div className="space-y-6 min-w-0">
              {detail.summary.bonusBreakdown && <BonusBreakdownSection bd={detail.summary.bonusBreakdown} />}

              {!detail.summary.bonusBreakdown && detail.summary.bonusValue != null && (
                detail.summary.bonusValue > 0 ? (
                  <section className="p-4 flex items-center justify-between" style={{ backgroundColor: "var(--primary)", border: "2px solid var(--primary)" }}>
                    <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)", opacity: 0.75 }}>Bônus do Ciclo</span>
                    <span className="text-3xl font-black" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }} data-testid="detail-bonus-value">{fmtBRL(detail.summary.bonusValue)}</span>
                  </section>
                ) : (
                  <section className="p-4 flex items-center justify-between" style={{ backgroundColor: "var(--secondary)", border: "2px solid var(--border)" }}>
                    <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Bônus do Ciclo</span>
                    <span className="text-3xl font-black" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }} data-testid="detail-bonus-value">{fmtBRL(0)}</span>
                  </section>
                )
              )}

              {detail.penalties.length > 0 && (
                <section className="space-y-2.5">
                  <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>
                    <AlertTriangle size={14} /> Penalidades
                  </h4>
                  <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--border)" }}>
                    {detail.penalties.map((p, idx) => (
                      <div key={p.id} data-testid={`detail-penalty-${p.id}`} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined, backgroundColor: "var(--card)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold uppercase text-[12px]">{p.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                            <span>{fmtDate(p.date, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            {p.eventName && <span>· {p.eventName}</span>}
                            {p.quantity > 1 && <span>· {p.quantity}×</span>}
                          </div>
                        </div>
                        <span className="font-black px-2.5 py-1 text-xs shrink-0" style={{ backgroundColor: WARNING, color: "#fff" }}>-{p.total}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {detail.merits.length > 0 && (
                <section className="space-y-2.5">
                  <h4 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2" style={{ fontFamily: CONDENSED, color: GOOD_TEXT }}>
                    <Award size={14} /> Méritos
                  </h4>
                  <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--border)" }}>
                    {detail.merits.map((m, idx) => (
                      <div key={m.id} data-testid={`detail-merit-${m.id}`} className="flex items-center gap-3 px-3 py-2.5" style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined, backgroundColor: "var(--card)" }}>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold uppercase text-[12px]">{m.label}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                            <span>{fmtDate(m.date, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            {m.eventName && <span>· {m.eventName}</span>}
                            {m.quantity > 1 && <span>· {m.quantity}×</span>}
                          </div>
                        </div>
                        <span className="font-black px-2.5 py-1 text-xs shrink-0" style={{ border: "2px solid " + GOOD, color: GOOD_TEXT }}>+{m.total}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
