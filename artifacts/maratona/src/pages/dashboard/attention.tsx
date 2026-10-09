// "Precisa da sua atenção": avaliações em aberto (com atalho para o evento na
// Central) e quem está abaixo de 50 pontos (zona de risco). É sempre de UM
// ciclo — o escolhido ou, no Total geral, o atual (regra da API).
import type { DashboardSummary } from "@workspace/api-client-react";
import { Link } from "wouter";
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Hourglass, TrendingDown } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { Bone, Chip, Eyebrow, FooterLink, InlineState, Panel, RowArrow, rowLinkCls } from "./dashboard-ui";

function SubHead({ icon: Icon, children, count }: { icon: typeof ClipboardList; children: string; count?: number }) {
  return (
    <h3 className="flex items-center gap-2 px-4 lg:px-5 pt-1 pb-2">
      <Icon size={14} aria-hidden className="text-muted-foreground" />
      <Eyebrow as="span">{children}</Eyebrow>
      {count != null && count > 0 && <span className="font-condensed text-[12px] font-bold text-muted-foreground tabular-nums">{count}</span>}
    </h3>
  );
}

export function AttentionPanel({ summary, loading, isAll, pastCycle, hasResults, withCycle }: {
  summary: DashboardSummary | undefined;
  loading: boolean;
  isAll: boolean;
  pastCycle: boolean;
  /** O ciclo já tem resultado apurado (alguém com nota). */
  hasResults: boolean;
  withCycle: (href: string) => string;
}) {
  const opName = summary?.operationalCycleName ?? null;
  const pendingEvents = summary?.eventsWithPendencies ?? [];
  const pending = summary?.pendingEvaluations ?? 0;
  const evalTotal = pending + (summary?.submittedEvaluations ?? 0);
  const atRisk = summary?.atRiskEmployees ?? [];
  // Zona de risco do Total geral é do ciclo atual: a análise abre sem ?ciclo.
  const personHref = (id: number) => {
    const href = `/analytics/colaborador?colaborador=${id}`;
    return isAll ? href : withCycle(href);
  };

  return (
    <Panel
      labelId="dash-attention-title"
      testId="dashboard-attention"
      icon={AlertTriangle}
      tone={pending > 0 || atRisk.length > 0 ? "warn" : undefined}
      title={<>Precisa da sua atenção{isAll && opName ? <span className="text-muted-foreground"> · {opName}</span> : null}</>}
      sub={pastCycle ? "O que ficou em aberto e quem terminou abaixo de 50 pontos." : "Eventos com critério sem resposta e quem está abaixo de 50 pontos."}
      footer={pastCycle ? (
        <FooterLink href={withCycle("/analytics")}>Análises do ciclo</FooterLink>
      ) : (
        <>
          <FooterLink href="/evaluations" testId="link-dashboard-central">Central de Avaliações</FooterLink>
          <FooterLink href="/calibrations" testId="link-dashboard-calibrations">Calibração</FooterLink>
        </>
      )}
    >
      {loading ? (
        <div className="grid lg:grid-cols-2 gap-4 px-4 lg:px-5 pb-5" aria-hidden>
          {[0, 1].map(c => (
            <div key={c} className="space-y-3"><Bone className="h-3 w-32" />{[0, 1, 2].map(i => <Bone key={i} className="h-9 w-full" />)}</div>
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 lg:divide-x divide-border border-border max-lg:divide-y">
          {/* Avaliações em aberto */}
          <div className="min-w-0 pb-2 pt-1" data-testid="dashboard-pending-events">
            <SubHead icon={ClipboardList} count={pending}>Avaliações em aberto</SubHead>
            {pendingEvents.length > 0 ? (
              <>
                <ul className="divide-y divide-border border-y border-border">
                  {pendingEvents.map(ev => (
                    <li key={ev.eventId}>
                      <Link href={`/evaluations?eventId=${ev.eventId}`} className={rowLinkCls} data-testid={`dashboard-pending-${ev.eventId}`}>
                        <span className="flex-1 min-w-0 text-[14px] font-semibold leading-snug text-foreground line-clamp-2 break-words" title={ev.eventName}>{ev.eventName}</span>
                        <Chip tone="warn" icon={Hourglass} title={plural(ev.pendingCount, "critério sem resposta", "critérios sem resposta")}>{plural(ev.pendingCount, "critério", "critérios")}</Chip>
                        <RowArrow />
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="px-4 lg:px-5 pt-2 text-[12.5px] text-muted-foreground">
                  {pending > pendingEvents.length
                    ? <>Os {pendingEvents.length} com mais critérios sem resposta de {plural(pending, "evento pendente", "eventos pendentes")}.</>
                    : "Critérios ainda sem resposta da área. Clique para acompanhar na Central."}
                </p>
              </>
            ) : evalTotal === 0 ? (
              <InlineState icon={CalendarClock} title={pastCycle ? "Nenhuma pendência neste ciclo." : "Nenhum evento aberto para avaliação ainda."}>
                {pastCycle ? null : "Cada evento abre para avaliação sozinho no dia seguinte ao fim."}
              </InlineState>
            ) : (
              <InlineState icon={CheckCircle2} tone="ok" title="Nenhuma avaliação pendente." testId="dashboard-no-pending">
                Todos os eventos abertos já têm os critérios respondidos.
              </InlineState>
            )}
          </div>

          {/* Zona de risco */}
          <div className="min-w-0 pb-2 pt-1 max-lg:pt-3" data-testid="dashboard-at-risk">
            <SubHead icon={TrendingDown} count={atRisk.length}>Abaixo de 50 pontos</SubHead>
            {atRisk.length > 0 ? (
              <ul className="divide-y divide-border border-y border-border">
                {atRisk.map(emp => (
                  <li key={emp.employeeId}>
                    <Link href={personHref(emp.employeeId)} className={rowLinkCls}>
                      <span className="flex-1 min-w-0 text-[14px] font-semibold text-foreground truncate" title={emp.employeeName}>{emp.employeeName}</span>
                      <span className={cn("font-condensed text-[18px] font-black tabular-nums leading-none text-[var(--status-danger-text)]")}>
                        {fmtNum(emp.currentScore ?? 0, 1)}
                      </span>
                      <RowArrow />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : !hasResults ? (
              <InlineState icon={Hourglass} title="Sem resultado apurado ainda.">
                A zona de risco aparece quando houver evento com resultado confirmado.
              </InlineState>
            ) : (
              <InlineState icon={CheckCircle2} tone="ok" title="Ninguém abaixo de 50 pontos." />
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
