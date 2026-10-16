// "Todos os ciclos": tabela no tablet/desktop, um cartão por ciclo no celular.
import { Link } from "wouter";
import type { CycleSummary } from "@workspace/api-client-react";
import { History, Pencil, Star } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import {
  Chip, CycleStatusChip, Eyebrow, FOCUS_RING, btnGhost, btnSmall, brl, cyclePeriod, fmtFull, iconBtn, minEventsText, n1, periodDays, surfaceCls,
} from "./cycles-ui";

type Actions = { isAdmin: boolean; onEdit: (c: CycleSummary) => void; onMakeCurrent: (c: CycleSummary) => void };

const bonusKind = (c: CycleSummary) => (c.status === "closed" ? "Oficial" : "Projetado");
const canMakeCurrent = (c: CycleSummary) => !c.isCurrent && c.status !== "closed";

function RulesCell({ c, testId }: { c: CycleSummary; testId?: string }) {
  const min = minEventsText(c);
  return (
    <span className="flex flex-col gap-0.5 text-[12.5px] leading-snug" data-testid={testId}>
      <span className="font-semibold text-foreground whitespace-nowrap">
        Mín. {min.value}{c.minEvents == null && c.effectiveMinEvents != null ? " (geral)" : ""}
      </span>
      <span className="text-muted-foreground">
        {c.conformityWithoutConduta ? "Conduta fora da Matriz" : "Conduta na Matriz"} · {c.areaEvaluation ? "por área" : "por designação"}
      </span>
    </span>
  );
}

function EventsFigure({ c, testId }: { c: CycleSummary; testId?: string }) {
  const s = c.stats;
  const after = s.eventsAfterEnd ?? 0;
  return (
    <>
      <span className="font-semibold tabular-nums">{s.eventsConfirmed}<span className="text-muted-foreground font-normal">/{s.eventsTotal}</span></span>
      <span className="sr-only"> confirmados</span>
      {s.eventsOpen > 0 && <span className="block text-[11.5px] text-[var(--status-warn-text)] font-semibold">{plural(s.eventsOpen, "aberto", "abertos")}</span>}
      {after > 0 && <span className="block text-[11.5px] text-muted-foreground" data-testid={testId}>+{after} fora do período</span>}
    </>
  );
}

const TH = "py-2.5 px-3 first:pl-5 last:pr-5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap border-b border-border bg-card";
const TD = "py-3 px-3 first:pl-5 last:pr-5 border-b border-border align-middle";

export function CyclesList({ cycles, isAdmin, onEdit, onMakeCurrent }: { cycles: CycleSummary[] } & Actions) {
  return (
    <section aria-labelledby="all-cycles-title" className={cn(surfaceCls, "overflow-hidden")}>
      <header className="flex flex-wrap items-end justify-between gap-2 px-4 pt-4 pb-3 lg:px-5">
        <div className="min-w-0">
          <h2 id="all-cycles-title" className="font-condensed text-[18px] font-black uppercase leading-tight text-foreground">Todos os ciclos</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">Do mais recente ao mais antigo. Ciclos nunca são excluídos: abra um para ver ranking, bônus e eventos.</p>
        </div>
        <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground tabular-nums">{plural(cycles.length, "ciclo", "ciclos")}</span>
      </header>

      {/* Celular: um cartão por ciclo (a tabela larga rolaria a página de lado). */}
      <ul className="lg:hidden border-t border-border divide-y divide-border" data-testid="list-cycles-mobile">
        {cycles.map(c => (
          <li key={c.id} className={cn("px-4 py-4 space-y-3", c.isCurrent && "shadow-[inset_3px_0_0_var(--foreground)]")} data-testid={`card-cycle-${c.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/cycles/${c.id}`} className={cn("font-condensed text-[19px] font-black uppercase leading-tight break-words hover:underline underline-offset-2 rounded-sm", FOCUS_RING)}>{c.name}</Link>
                <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">{cyclePeriod(c)}</p>
              </div>
              <CycleStatusChip cycle={c} className="shrink-0 mt-0.5" />
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border text-[13px]">
              <div className="bg-card px-3 py-2.5">
                <dt><Eyebrow as="span" className="block text-[11px]">Eventos</Eyebrow></dt>
                <dd className="mt-1"><EventsFigure c={c} /></dd>
              </div>
              <div className="bg-card px-3 py-2.5">
                <dt><Eyebrow as="span" className="block text-[11px]">Ranking</Eyebrow></dt>
                <dd className="mt-1 font-semibold tabular-nums">{plural(c.stats.collaborators, "pessoa", "pessoas")}<span className="block text-[11.5px] font-normal text-muted-foreground">nota média {n1(c.stats.avgFinalResult)}</span></dd>
              </div>
              <div className="bg-card px-3 py-2.5">
                <dt><Eyebrow as="span" className="block text-[11px]">Bônus {bonusKind(c).toLowerCase()}</Eyebrow></dt>
                <dd className="mt-1 font-semibold tabular-nums">{brl(c.stats.bonusTotal)}</dd>
              </div>
              <div className="bg-card px-3 py-2.5">
                <dt><Eyebrow as="span" className="block text-[11px]">Pagamento</Eyebrow></dt>
                <dd className={cn("mt-1 font-semibold tabular-nums", !c.paymentDate && "text-muted-foreground font-normal")}>{c.paymentDate ? fmtFull(c.paymentDate) : "Não definido"}</dd>
              </div>
            </dl>
            <RulesCell c={c} />
            <div className="flex flex-wrap gap-2">
              <Link href={`/cycles/${c.id}`} aria-label={`Histórico de ${c.name}`} className={cn(btnSmall, "flex-1")}><History size={15} aria-hidden /> Histórico</Link>
              {isAdmin && <button type="button" onClick={() => onEdit(c)} aria-label={`Editar ${c.name}`} className={cn(btnSmall, "flex-1")}><Pencil size={15} aria-hidden /> Editar</button>}
              {isAdmin && canMakeCurrent(c) && (
                <button type="button" onClick={() => onMakeCurrent(c)} className={cn(btnSmall, "w-full")} data-testid={`button-make-current-${c.id}`}><Star size={15} aria-hidden /> Tornar atual</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* "relative": os textos sr-only (position absolute) ficam presos aqui dentro. */}
      <div className="hidden lg:block overflow-x-auto relative">
        <table className="w-full min-w-[720px] text-[13.5px]" data-testid="table-cycles">
          <thead>
            <tr>
              <th scope="col" className={cn(TH, "text-left")}>Ciclo</th>
              <th scope="col" className={cn(TH, "text-left")}>Período</th>
              <th scope="col" className={cn(TH, "text-left")}>Regras e pagamento</th>
              <th scope="col" className={cn(TH, "text-right")}>Eventos</th>
              <th scope="col" className={cn(TH, "text-right")}>Ranking</th>
              <th scope="col" className={cn(TH, "text-right")}>Bônus</th>
              <th scope="col" className={cn(TH, "text-right hidden xl:table-cell")}>Nota média</th>
              <th scope="col" className={TH}><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {cycles.map(c => {
              const days = periodDays(c.startDate, c.endDate);
              return (
                <tr key={c.id} data-testid={`row-cycle-${c.id}`} className="group transition-colors duration-150 hover:bg-secondary/40">
                  <td className={cn(TD, "min-w-[170px]", c.isCurrent && "shadow-[inset_3px_0_0_var(--foreground)]")}>
                    <Link href={`/cycles/${c.id}`} className={cn("font-condensed text-[17px] font-black uppercase leading-tight break-words hover:underline underline-offset-2 rounded-sm", FOCUS_RING)}>{c.name}</Link>
                    <span className="mt-1.5 block"><CycleStatusChip cycle={c} /></span>
                  </td>
                  <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                    <span className="block text-foreground">{fmtFull(c.startDate)}</span>
                    <span className="block text-muted-foreground">a {fmtFull(c.endDate)}{days != null && <span className="text-[12px]"> · {days} dias</span>}</span>
                  </td>
                  <td className={cn(TD, "min-w-[200px]")}>
                    <RulesCell c={c} testId={`cycle-rules-cell-${c.id}`} />
                    <span className={cn("mt-0.5 block text-[12.5px] leading-snug", c.paymentDate ? "text-foreground" : "text-muted-foreground")} data-testid={`cycle-payment-${c.id}`}>
                      {c.paymentDate ? `Pagamento em ${fmtFull(c.paymentDate)}` : "Pagamento: data não definida"}
                    </span>
                  </td>
                  <td className={cn(TD, "text-right whitespace-nowrap")}><EventsFigure c={c} testId={`cycle-after-end-${c.id}`} /></td>
                  <td className={cn(TD, "text-right tabular-nums whitespace-nowrap")}>
                    <span className="font-semibold">{c.stats.collaborators}</span>
                    <span className="block text-[11.5px] text-muted-foreground">{c.stats.eligible} elegíve{c.stats.eligible === 1 ? "l" : "is"}</span>
                  </td>
                  <td className={cn(TD, "text-right tabular-nums whitespace-nowrap")} data-testid={`cycle-bonus-${c.id}`}>
                    <span className="block font-semibold">{brl(c.stats.bonusTotal)}</span>
                    <Chip tone={c.status === "closed" ? "neutral" : "info"} className="mt-1 h-5 text-[11px]">{bonusKind(c)}</Chip>
                  </td>
                  <td className={cn(TD, "text-right tabular-nums font-condensed text-[18px] font-black hidden xl:table-cell")}>{n1(c.stats.avgFinalResult)}</td>
                  <td className={TD}>
                    <div className="flex items-center justify-end gap-1.5">
                      {isAdmin && canMakeCurrent(c) && (
                        <button type="button" onClick={() => onMakeCurrent(c)} className={cn(btnSmall, "px-2.5 2xl:px-3")} aria-label={`Tornar ${c.name} o ciclo atual`} title="Tornar atual" data-testid={`button-make-current-${c.id}`}><Star size={14} aria-hidden /><span className="hidden 2xl:inline">Tornar atual</span></button>
                      )}
                      <Link href={`/cycles/${c.id}`} aria-label={`Histórico de ${c.name}`} title="Ver histórico" className={cn(btnGhost, "px-2.5")}><History size={15} aria-hidden /><span className="hidden 2xl:inline">Histórico</span></Link>
                      {isAdmin && (
                        <button type="button" onClick={() => onEdit(c)} aria-label={`Editar ${c.name}`} title="Editar ciclo" className={cn(iconBtn, "border-transparent bg-transparent")}><Pencil size={15} aria-hidden /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
