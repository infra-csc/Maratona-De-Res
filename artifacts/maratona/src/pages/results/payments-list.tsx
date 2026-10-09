// Lista da aba Bônus & Pagamentos: tabela no desktop, um cartão por pessoa no
// celular/tablet. O bônus já INCLUI a parcela extra (a coluna Extra é só a
// parte dele que veio de eventos extras — não se soma).
import type { QuarterlyResult } from "@workspace/api-client-react";
import { CheckCircle2, ChevronRight, Wallet } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { BONUS_STATUS_LABELS, fmtBRL, fmtScore, type SortDir } from "./helpers";
import { FaixaBadge, SortIcon, fmtBound } from "./badges";
import { BONUS_TONE, Chip, FOCUS_RING, btnSmall, surfaceCls } from "./results-ui";

type SortKey = keyof QuarterlyResult;

export function PayStatusChip({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <Chip tone={BONUS_TONE[status] ?? "neutral"}>{BONUS_STATUS_LABELS[status]?.label ?? status}</Chip>;
}

export function EligibilityChip({ r }: { r: QuarterlyResult }) {
  return r.eligible === false
    ? <Chip tone="danger" title={r.eligibilityReason ?? undefined}>Não elegível</Chip>
    : <Chip tone="ok" icon={CheckCircle2}>Elegível</Chip>;
}

function activity(r: QuarterlyResult) {
  return <>{r.eventsCount ?? 0} com nota · {plural(r.participatedEventsCount ?? 0, "participado", "participados")}</>;
}

export function PaymentsTable({ rows, cycleClosed, canPay, sortKey, sortDir, onSort, onOpen, onPay }: {
  rows: QuarterlyResult[];
  cycleClosed: boolean;
  canPay: boolean;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  onOpen: (r: QuarterlyResult) => void;
  onPay: (r: QuarterlyResult) => void;
}) {
  const cols = ["minmax(150px,1.6fr)", "76px", "92px", "minmax(96px,0.7fr)", "112px", "minmax(120px,1fr)", "minmax(124px,0.8fr)", "104px", ...(canPay ? ["124px"] : [])].join(" ");
  const head = (label: string, key: SortKey, align: "left" | "right" | "center" = "left", title?: string) => (
    <div role="columnheader" aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none"} title={title}
      className={cn("px-3 py-2.5", align === "right" && "text-right", align === "center" && "text-center")}>
      <button type="button" onClick={() => onSort(key)}
        className={cn("font-condensed inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.06em] rounded-sm transition-colors duration-150", sortKey === key ? "text-foreground" : "text-muted-foreground hover:text-foreground", FOCUS_RING)}>
        {label}<SortIcon active={sortKey === key} dir={sortDir} />
      </button>
    </div>
  );
  return (
    <div className={cn(surfaceCls, "hidden xl:block overflow-hidden")}>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Bônus e pagamentos por colaborador" className={cn("min-w-[880px]", canPay && "min-w-[1000px]")}>
          <div role="row" className="grid items-center bg-secondary/60 border-b border-border" style={{ gridTemplateColumns: cols }}>
            {head("Colaborador", "employeeName")}
            {head("Eventos", "eventsCount", "center", "Eventos com nota (os participados aparecem na linha do nome)")}
            {head("Nota final", "finalResult", "right")}
            {head("Faixa", "platoon")}
            {head("Elegibilidade", "eligible")}
            {head(cycleClosed ? "Bônus" : "Bônus projetado", "bonusValue", "right", "Valor total do bônus, já incluindo a parcela extra")}
            {head("Extra (incluso)", "extraBonusValue", "right", "Parcela do bônus referente a eventos extras — já está incluída no total da coluna Bônus, não some as duas")}
            {head("Status", "bonusStatus")}
            {canPay && <div role="columnheader" className="px-3 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground text-right">Ação</div>}
          </div>
          {rows.map(r => (
            <div key={r.employeeId} role="row" data-testid={`row-result-${r.employeeId}`} onClick={() => onOpen(r)}
              className="group grid items-center border-b border-border last:border-b-0 cursor-pointer transition-colors duration-150 hover:bg-secondary/40"
              style={{ gridTemplateColumns: cols }}>
              <div role="cell" className="px-3 py-3 min-w-0">
                <button type="button" onClick={e => { e.stopPropagation(); onOpen(r); }} aria-label={`Ver ficha de ${r.employeeName}`}
                  className={cn("block max-w-full text-left font-condensed text-[16px] font-bold uppercase tracking-[0.02em] leading-tight truncate rounded-sm group-hover:underline underline-offset-2", FOCUS_RING)}>
                  {r.employeeName}
                </button>
                <span className="mt-0.5 block text-[12.5px] text-muted-foreground truncate">
                  {plural(r.participatedEventsCount ?? 0, "participado", "participados")}
                  {(r.totalAbsences ?? 0) > 0 && <> · <span className="text-[var(--status-danger-text)] font-semibold">{plural(r.totalAbsences ?? 0, "penalidade", "penalidades")}</span></>}
                </span>
              </div>
              <div role="cell" className="px-3 py-3 text-center font-condensed text-[18px] font-bold tabular-nums">{r.eventsCount ?? 0}</div>
              <div role="cell" className="px-3 py-3 text-right font-condensed text-[22px] font-black leading-none tabular-nums">{fmtScore(r.finalResult)}</div>
              <div role="cell" className="px-3 py-3 min-w-0" title={r.platoonMinScore != null && r.platoonMaxScore != null ? `Faixa ${r.platoon ?? ""}: ${fmtBound(r.platoonMinScore)}–${fmtBound(r.platoonMaxScore)}` : undefined}><FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} compact /></div>
              <div role="cell" className="px-3 py-3"><EligibilityChip r={r} /></div>
              <div role="cell" className={cn("px-3 py-3 text-right font-condensed text-[18px] font-black tabular-nums whitespace-nowrap", (r.bonusValue ?? 0) <= 0 && "text-muted-foreground font-bold")}>{fmtBRL(r.bonusValue ?? 0)}</div>
              <div role="cell" className="px-3 py-3 text-right text-[14px] font-semibold tabular-nums whitespace-nowrap text-muted-foreground" title="Já incluído no total da coluna Bônus">{fmtBRL(r.extraBonusValue ?? 0)}</div>
              <div role="cell" className="px-3 py-3"><PayStatusChip status={r.bonusStatus} /></div>
              {canPay && (
                <div role="cell" className="px-3 py-3 text-right">
                  {r.id != null && (
                    <button type="button" data-testid={`button-payment-${r.employeeId}`} aria-label={`Gerir pagamento de ${r.employeeName}`}
                      onClick={e => { e.stopPropagation(); onPay(r); }} className={cn(btnSmall, "md:min-h-8 px-2.5")}>
                      <Wallet size={14} aria-hidden /> Pagamento
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PaymentsCards({ rows, cycleClosed, canPay, onOpen, onPay }: {
  rows: QuarterlyResult[];
  cycleClosed: boolean;
  canPay: boolean;
  onOpen: (r: QuarterlyResult) => void;
  onPay: (r: QuarterlyResult) => void;
}) {
  return (
    <ul className="grid gap-2.5 md:grid-cols-2 xl:hidden" aria-label="Bônus e pagamentos por colaborador" data-testid="payments-cards">
      {rows.map(r => (
        <li key={r.employeeId} className={cn(surfaceCls, "p-4 min-w-0 flex flex-col")} data-testid={`card-result-${r.employeeId}`}>
          <button type="button" onClick={() => onOpen(r)} aria-label={`Ver ficha de ${r.employeeName}`}
            className={cn("-m-1 p-1 rounded-lg flex items-start gap-3 text-left", FOCUS_RING)}>
            <span className="min-w-0 flex-1">
              <span className="block font-condensed text-[17px] font-bold uppercase leading-tight break-words">{r.employeeName}</span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
                {activity(r)}
                {(r.totalAbsences ?? 0) > 0 && <> · <span className="text-[var(--status-danger-text)] font-semibold">{plural(r.totalAbsences ?? 0, "penalidade", "penalidades")}</span></>}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block font-condensed text-[26px] font-black leading-none tabular-nums">{fmtScore(r.finalResult)}</span>
              <span className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Nota final</span>
            </span>
            <ChevronRight size={16} aria-hidden className="mt-1 shrink-0 text-muted-foreground" />
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <FaixaBadge name={r.platoon} minScore={r.platoonMinScore} maxScore={r.platoonMaxScore} color={r.platoonColor} compact />
            <EligibilityChip r={r} />
            {!(r.eligible === false && r.bonusStatus === "not_eligible") && <PayStatusChip status={r.bonusStatus} />}
          </div>
          {r.eligible === false && r.eligibilityReason && <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{r.eligibilityReason}</p>}
          <div className="mt-3 pt-3 flex items-end justify-between gap-3 border-t border-border/70">
            <dl className="flex flex-wrap gap-x-6 gap-y-1 min-w-0">
              <div className="min-w-0">
                <dt className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{cycleClosed ? "Bônus" : "Bônus projetado"}</dt>
                <dd className="font-condensed text-[20px] font-black leading-tight tabular-nums whitespace-nowrap">{fmtBRL(r.bonusValue ?? 0)}</dd>
              </div>
              <div className="min-w-0" title="Já incluído no bônus">
                <dt className="font-condensed text-[11px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Extra (incluso)</dt>
                <dd className="text-[14px] font-semibold leading-tight tabular-nums whitespace-nowrap text-muted-foreground mt-1">{fmtBRL(r.extraBonusValue ?? 0)}</dd>
              </div>
            </dl>
            {canPay && r.id != null && (
              <button type="button" data-testid={`button-payment-card-${r.employeeId}`} aria-label={`Gerir pagamento de ${r.employeeName}`}
                onClick={() => onPay(r)} className={cn(btnSmall, "shrink-0")}>
                <Wallet size={14} aria-hidden /> Pagamento
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
