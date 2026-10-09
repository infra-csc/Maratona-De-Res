import { useGetRankingDetail, getGetRankingDetailQueryKey } from "@workspace/api-client-react";
import { Award, AlertTriangle, MapPin, History, Hourglass, Trophy, X, Wallet2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn, fmtDate, fmtNum, plural } from "@/lib/utils";
import { fmtBRL } from "./helpers";
import { BonusBreakdownSection } from "./bonus-breakdown-section";
import { FaixaBadge } from "./badges";
import { Bone, Chip, Drawer, DrawerClose, DrawerDescription, DrawerTitle, Eyebrow, Notice, SectionTitle, iconBtn, surfaceCls } from "./results-ui";

/** Pontos com sinal ("+2", "−1,5"); zero sai "0", sem sinal (antes "-0"/"+0"). */
function signedPoints(v: number): string {
  if (!v) return "0";
  const abs = Number.isInteger(v) ? fmtNum(Math.abs(v), 0) : fmtNum(Math.abs(v), 1);
  return `${v > 0 ? "+" : "−"}${abs}`;
}

type Summary = {
  platoon?: string | null; platoonColor?: string | null; platoonMinScore?: number | string | null; platoonMaxScore?: number | string | null;
};

export function EmployeeDetailSheet({
  employeeId,
  onClose,
  cycleId,
  readOnly = false,
}: {
  employeeId: number | null;
  onClose: () => void;
  /** Ciclo escolhido no seletor (undefined = atual). */
  cycleId?: string;
  /** Ciclo anterior: sem convite a recalcular. */
  readOnly?: boolean;
}) {
  const detailParams = cycleId ? { employeeId: employeeId ?? 0, cycleId } : { employeeId: employeeId ?? 0 };
  // Linha do tempo da nota: só admin e RH (a rota também barra).
  const { user } = useAuth();
  const canSeeTimeline = hasRole(user, "admin") || hasRole(user, "rh");
  const { data: detail, isLoading: detailLoading, isError } = useGetRankingDetail(detailParams, {
    query: { queryKey: getGetRankingDetailQueryKey(detailParams), enabled: !!employeeId },
  });

  const closeBtn = (
    <DrawerClose aria-label="Fechar ficha" className={cn(iconBtn, "shrink-0")}>
      <X size={16} aria-hidden />
    </DrawerClose>
  );

  return (
    <Drawer open={!!employeeId} onOpenChange={(o) => { if (!o) onClose(); }} testId="employee-detail-sheet">
      {detailLoading || !detail ? (
        <>
          <div className="px-5 sm:px-6 py-4 border-b border-border bg-card flex items-start gap-3">
            <div className="flex-1 space-y-2.5">
              <DrawerTitle className="sr-only">{isError ? "Não foi possível carregar a ficha" : "Carregando a ficha"}</DrawerTitle>
              <DrawerDescription className="sr-only">Ficha do colaborador no ciclo</DrawerDescription>
              {isError ? (
                <p className="font-condensed text-[22px] font-black uppercase leading-tight">Não foi possível carregar a ficha</p>
              ) : (
                <><Bone className="h-3 w-24" /><Bone className="h-7 w-64 max-w-full" /><Bone className="h-5 w-28" /></>
              )}
            </div>
            {closeBtn}
          </div>
          <div className="p-5 sm:p-6 space-y-4" role="status" aria-label={isError ? undefined : "Carregando a ficha"}>
            {isError ? (
              <Notice icon={AlertTriangle} tone="danger">Verifique a conexão e abra a ficha de novo.</Notice>
            ) : (
              <><Bone className="h-28 w-full rounded-xl" /><Bone className="h-40 w-full rounded-xl" /><Bone className="h-24 w-full rounded-xl" /></>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Cabeçalho fixo da ficha: quem é, ciclo e faixa. */}
          <div className="px-5 sm:px-6 pt-4 pb-4 border-b border-border bg-card flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {detail.employee.functionName && <Chip>{detail.employee.functionName}</Chip>}
                <Eyebrow as="span">{detail.cycle.name}</Eyebrow>
              </div>
              <DrawerTitle className="mt-2 font-condensed text-[28px] sm:text-[32px] font-black uppercase leading-[1.02] tracking-[-0.01em] break-words">
                {detail.employee.name}
              </DrawerTitle>
              <DrawerDescription className="sr-only">Ficha do colaborador em {detail.cycle.name}: nota, faixa, provas, penalidades, méritos e bônus.</DrawerDescription>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                {(detail.summary as Summary).platoon && (
                  <FaixaBadge
                    name={(detail.summary as Summary).platoon}
                    color={(detail.summary as Summary).platoonColor}
                    minScore={(detail.summary as Summary).platoonMinScore != null ? Number((detail.summary as Summary).platoonMinScore) : null}
                    maxScore={(detail.summary as Summary).platoonMaxScore != null ? Number((detail.summary as Summary).platoonMaxScore) : null}
                  />
                )}
                {canSeeTimeline && !readOnly && (
                  <Link
                    href={`/linha-do-tempo?colaborador=${detail.employee.id}`}
                    className="inline-flex items-center gap-1.5 min-h-11 md:min-h-0 font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--accent-text)] hover:underline underline-offset-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="link-score-timeline"
                  >
                    <History size={14} aria-hidden /> Linha do tempo da nota
                  </Link>
                )}
              </div>
            </div>
            {closeBtn}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-6">
            {/* Nota: final (com a conta) e média bruta; penalidades e méritos ao lado. */}
            <section aria-label="Nota do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 gap-px bg-border")}>
              <div className="bg-card px-4 py-4 min-w-0">
                <Eyebrow as="span" className="block">Nota final</Eyebrow>
                <p className="mt-2 font-condensed text-[36px] sm:text-[44px] font-black leading-none tracking-[-0.02em] tabular-nums" data-testid="detail-final-result">
                  {detail.summary.finalResult != null ? fmtNum(detail.summary.finalResult, 1) : "—"}
                </p>
                {detail.summary.finalResult != null && detail.summary.grossAverage != null &&
                 (detail.summary.penaltyPoints > 0 || detail.summary.meritPoints > 0) && (
                  <p className="mt-2 text-[12.5px] text-muted-foreground tabular-nums">
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
              <div className="bg-card px-4 py-4 min-w-0">
                <Eyebrow as="span" className="block">Média bruta</Eyebrow>
                <p className="mt-2 font-condensed text-[36px] sm:text-[44px] font-black leading-none tracking-[-0.02em] tabular-nums text-muted-foreground">
                  {detail.summary.grossAverage != null ? fmtNum(detail.summary.grossAverage, 1) : "—"}
                </p>
                {detail.summary.scoreSum != null && detail.summary.confirmedEventCount != null && (
                  <p className="mt-2 text-[12.5px] text-muted-foreground tabular-nums">
                    Soma {fmtNum(detail.summary.scoreSum, 1)} ÷ {plural(detail.summary.confirmedEventCount, "prova", "provas")}
                  </p>
                )}
              </div>
              <div className="bg-card px-4 py-3 flex items-center gap-2.5">
                <AlertTriangle size={16} aria-hidden className="shrink-0 text-[var(--status-danger-text)]" />
                <span className="min-w-0">
                  <Eyebrow as="span" className="block">Penalidades</Eyebrow>
                  <span className={cn("mt-1 block font-condensed text-[22px] font-black leading-none tabular-nums", detail.summary.penaltyPoints > 0 ? "text-[var(--status-danger-text)]" : "text-muted-foreground")}>{signedPoints(-detail.summary.penaltyPoints)}</span>
                </span>
              </div>
              <div className="bg-card px-4 py-3 flex items-center gap-2.5">
                <Award size={16} aria-hidden className="shrink-0 text-[var(--status-ok-text)]" />
                <span className="min-w-0">
                  <Eyebrow as="span" className="block">Méritos</Eyebrow>
                  <span className={cn("mt-1 block font-condensed text-[22px] font-black leading-none tabular-nums", detail.summary.meritPoints > 0 ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}>{signedPoints(detail.summary.meritPoints)}</span>
                </span>
              </div>
            </section>

            {!detail.summary.isQuarterClosed && (
              <Notice icon={Hourglass} tone="warn">Ciclo ainda aberto: os valores são parciais e mudam até o fechamento.</Notice>
            )}

            {detail.summary.bonusBreakdown && <BonusBreakdownSection bd={detail.summary.bonusBreakdown} readOnly={readOnly} />}

            {!detail.summary.bonusBreakdown && detail.summary.bonusValue != null && (
              <section>
                <SectionTitle icon={Wallet2}>Bônus do ciclo</SectionTitle>
                <div className={cn("rounded-xl px-4 py-3.5 flex items-center justify-between gap-3", detail.summary.bonusValue > 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  <Eyebrow as="span" className="text-current opacity-80">Total</Eyebrow>
                  <span className="font-condensed text-[30px] font-black leading-none tabular-nums" data-testid="detail-bonus-value">{fmtBRL(detail.summary.bonusValue > 0 ? detail.summary.bonusValue : 0)}</span>
                </div>
              </section>
            )}

            <section>
              {(() => {
                const confirmed = detail.events.filter(ev => ev.resultsConfirmed);
                return (
                  <>
                    <SectionTitle icon={Trophy} count={confirmed.length || undefined}>Desempenho nas provas</SectionTitle>
                    {confirmed.length === 0 ? (
                      <p className="text-[14px] text-muted-foreground">Nenhum evento confirmado no ciclo.</p>
                    ) : (
                      <ul className={cn(surfaceCls, "divide-y divide-border overflow-hidden")}>
                        {confirmed.map(ev => {
                          const reason = (ev as { noScoreReason?: string }).noScoreReason;
                          return (
                            <li key={ev.eventId} data-testid={`detail-event-${ev.eventId}`} className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className={cn("font-condensed text-[15px] font-bold uppercase leading-tight", !ev.countsForScore && "text-muted-foreground")}>{ev.eventName}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                                  {(ev.city || ev.state) && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden />{[ev.city, ev.state].filter(Boolean).join(" / ")}</span>}
                                  {!ev.countsForScore && (
                                    <span data-testid={`detail-event-no-score-${ev.eventId}`}
                                      title={reason === "sup_ceno" ? `Função: ${(ev as { participationFunction?: string }).participationFunction ?? "Sup Ceno"} — participação informativa, não entra na nota.` : reason === "freela" ? "Freela — não entra na nota." : "Participação informativa — não entra na nota."}>
                                      <Chip tone="warn">{reason === "sup_ceno" ? "Sup Ceno" : reason === "freela" ? "Freela" : "Não conta"}</Chip>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="block font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Nota do time</span>
                                <p className={cn("font-condensed text-[22px] font-black leading-none tabular-nums", !ev.countsForScore && "text-muted-foreground")}>{fmtNum(ev.eventScore, 1)}</p>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                );
              })()}
            </section>

            {detail.penalties.length > 0 && (
              <section>
                <SectionTitle icon={AlertTriangle} tone="danger" count={detail.penalties.length}>Penalidades</SectionTitle>
                <ul className={cn(surfaceCls, "divide-y divide-border overflow-hidden")}>
                  {detail.penalties.map(p => (
                    <li key={p.id} data-testid={`detail-penalty-${p.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-condensed text-[15px] font-bold uppercase leading-tight">{p.label}</p>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                          {fmtDate(p.date, { day: "2-digit", month: "2-digit", year: "numeric" })}
                          {p.eventName && <> · {p.eventName}</>}
                          {p.quantity > 1 && <> · {p.quantity}×</>}
                        </p>
                      </div>
                      <span className="font-condensed text-[20px] font-black tabular-nums text-[var(--status-danger-text)] shrink-0">−{fmtNum(p.total, Number.isInteger(p.total) ? 0 : 1)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {detail.merits.length > 0 && (
              <section>
                <SectionTitle icon={Award} tone="ok" count={detail.merits.length}>Méritos</SectionTitle>
                <ul className={cn(surfaceCls, "divide-y divide-border overflow-hidden")}>
                  {detail.merits.map(m => (
                    <li key={m.id} data-testid={`detail-merit-${m.id}`} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-condensed text-[15px] font-bold uppercase leading-tight">{m.label}</p>
                        <p className="mt-1 text-[12.5px] text-muted-foreground">
                          {fmtDate(m.date, { day: "2-digit", month: "2-digit", year: "numeric" })}
                          {m.eventName && <> · {m.eventName}</>}
                          {m.quantity > 1 && <> · {m.quantity}×</>}
                        </p>
                      </div>
                      <span className="font-condensed text-[20px] font-black tabular-nums text-[var(--status-ok-text)] shrink-0">+{fmtNum(m.total, Number.isInteger(m.total) ? 0 : 1)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
