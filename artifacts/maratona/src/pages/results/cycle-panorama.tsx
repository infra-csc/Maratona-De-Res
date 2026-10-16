// Panorama do ciclo, acima das abas: responde num relance "quem está em qual
// faixa, quanto vamos pagar e o que falta para fechar o ciclo".
import type { QuarterlyResult } from "@workspace/api-client-react";
import { cn, faixaEdge, fmtNum, plural } from "@/lib/utils";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Bone, StatCell, btnSmall, surfaceCls } from "./results-ui";
import { buildPlatoonGroups } from "./platoon-distribution-panel";
import { fmtBRL, fmtBRLShort } from "./helpers";

export type PanoramaEvents = { total: number; confirmed: number; open: number } | null;

export function CyclePanorama({ rows, loading, error, onRetry, cycleClosed, closedAt, minEvents, events, onFaixas, onBonus, activeTab }: {
  rows: QuarterlyResult[];
  loading: boolean;
  /** Falha ao carregar o resultado do ciclo: nada de zeros enganosos. */
  error?: boolean;
  onRetry?: () => void;
  cycleClosed: boolean;
  /** Data do fechamento (ISO) quando o ciclo está fechado. */
  closedAt?: string | null;
  minEvents: number | null;
  /** Eventos do período do ciclo (null enquanto carrega ou sem permissão). */
  events: PanoramaEvents;
  onFaixas?: () => void;
  onBonus?: () => void;
  activeTab?: string;
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Carregando o panorama do ciclo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-6 gap-px bg-border")}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={cn("bg-card px-4 py-4 lg:px-5 space-y-2.5", i === 2 && "col-span-2")}>
            <Bone className="h-3 w-20" /><Bone className="h-8 w-16" /><Bone className="h-3 w-32 hidden sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" data-testid="results-panorama-error" className={cn(surfaceCls, "px-4 py-3.5 lg:px-5 flex flex-wrap items-center gap-3")}>
        <AlertTriangle size={16} aria-hidden className="text-[var(--status-danger-text)] shrink-0" />
        <span className="text-[14px] flex-1 min-w-[200px]"><b className="font-semibold">Panorama indisponível.</b> <span className="text-muted-foreground">Não foi possível carregar o resultado do ciclo.</span></span>
        {onRetry && <button type="button" onClick={onRetry} className={btnSmall}><RotateCw size={14} aria-hidden /> Tentar de novo</button>}
      </div>
    );
  }

  const eligible = rows.filter(r => r.eligible !== false).length;
  const scored = rows.filter(r => (r.eventsCount ?? 0) > 0);
  const avg = scored.length > 0 ? scored.reduce((s, r) => s + r.finalResult, 0) / scored.length : null;
  const bonusTotal = rows.reduce((s, r) => s + (r.bonusValue ?? 0), 0);
  const withBonus = rows.filter(r => (r.bonusValue ?? 0) > 0).length;
  const paid = rows.filter(r => r.bonusStatus === "paid").reduce((s, r) => s + (r.bonusValue ?? 0), 0);
  const groups = buildPlatoonGroups(rows);
  const total = rows.length;

  return (
    <section aria-label="Panorama do ciclo" data-testid="results-panorama" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-6 gap-px bg-border")}>
      <StatCell
        testId="panorama-people"
        label="Colaboradores"
        value={total}
        sub={total > 0 ? <><b className="font-semibold text-foreground">{eligible}</b> {eligible === 1 ? "elegível" : "elegíveis"} ao bônus{minEvents != null ? ` · mín. ${plural(minEvents, "evento")}` : ""}</> : "Sem resultado apurado."}
      />
      <StatCell
        testId="panorama-avg"
        label="Nota média"
        value={avg != null ? fmtNum(avg, 1) : "—"}
        title="Média das notas finais de quem tem evento com nota no ciclo"
        sub="De quem tem evento com nota."
      />
      <StatCell
        className="col-span-2"
        testId="panorama-faixas"
        label="Quem está em cada faixa"
        onClick={groups.length > 0 ? onFaixas : undefined}
        pressed={activeTab === "consolidacao"}
        action={activeTab === "consolidacao" ? "Voltar ao ranking" : "Ver distribuição"}
        title="A média final de cada pessoa define a faixa"
      >
        {groups.length === 0 ? (
          <span className="mt-2 block font-condensed text-[28px] font-black leading-none text-muted-foreground">—</span>
        ) : (
          <>
            <span role="img" aria-label={groups.map(g => `${g.platoon}: ${plural(g.count, "pessoa", "pessoas")}`).join("; ")}
              className="mt-3 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full">
              {groups.map(g => (
                <span key={g.platoon} className="h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${(g.count / total) * 100}%`, backgroundColor: g.color ?? "var(--border)", ...faixaEdge(g.color) }} />
              ))}
            </span>
            <span className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
              {groups.map(g => (
                <span key={g.platoon} className="inline-flex items-center gap-1.5 text-[12.5px] leading-none">
                  <span aria-hidden className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: g.color ?? "var(--border)", ...faixaEdge(g.color) }} />
                  <span className="font-semibold text-foreground">{g.platoon}</span>
                  <span className="text-muted-foreground tabular-nums">{g.count}</span>
                </span>
              ))}
            </span>
          </>
        )}
      </StatCell>
      <StatCell
        testId="panorama-bonus"
        label={cycleClosed ? "Bônus oficial" : "Bônus projetado"}
        value={fmtBRLShort(bonusTotal)}
        title={cycleClosed ? "Bônus oficial, apurado no fechamento do ciclo" : `Bônus projetado: o ciclo está aberto e o valor muda até o fechamento (${fmtBRL(bonusTotal)})`}
        sub={<>{plural(withBonus, "pessoa", "pessoas")} · {paid > 0 ? <>{fmtBRLShort(paid)} pago</> : "nada pago ainda"}</>}
        onClick={onBonus}
        pressed={activeTab === "bonus"}
        action={activeTab === "bonus" ? "Voltar ao ranking" : "Ver pagamentos"}
      />
      <StatCell
        testId="panorama-closing"
        label="Fechamento"
        tone={!cycleClosed && events && events.open > 0 ? "warn" : "neutral"}
        value={cycleClosed ? "Fechado" : events ? <>{events.confirmed}<span className="text-[0.55em] text-muted-foreground font-bold">/{events.total}</span></> : <Bone className="h-7 w-14" />}
        unit={!cycleClosed && events ? "confirmados" : undefined}
        title={cycleClosed ? undefined : "Eventos do período do ciclo com resultado confirmado e eventos ainda abertos para avaliação"}
        sub={cycleClosed
          ? (closedAt ? `Em ${new Date(closedAt).toLocaleDateString("pt-BR")}. Bônus oficial.` : "Bônus oficial.")
          : events ? (events.open > 0 ? `${plural(events.open, "evento aberto", "eventos abertos")} para avaliação.` : "Nenhum evento aberto para avaliação.") : "Carregando eventos…"}
      />
    </section>
  );
}
