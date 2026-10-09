// Blocos de pessoas do Painel de gestão: avaliadores (envio e ajuste da
// calibração), penalidades e méritos por tipo, quem mais perdeu/ganhou pontos
// e a nota por cliente.
import { Link } from "wouter";
import type { AnalyticsOverview } from "@workspace/api-client-react";
import { Building2, ClipboardCheck, Scale, UserCheck } from "lucide-react";
import { fmtNum, plural } from "@/lib/utils";
import { Chip, Eyebrow } from "../dashboard/dashboard-ui";
import { Block, FooterLink, InlineState } from "./block";
import { BarList, DataTable, ViewToggle, useView } from "./viz";
import { n1 } from "./indicators";

type D = AnalyticsOverview;

function biasChip(bias: number | null, samples: number) {
  if (bias == null || samples < 3) return <span className="text-muted-foreground" title="Menos de 3 casos calibrados">—</span>;
  if (bias >= 5) return <Chip tone="info" title={`A calibração sobe as notas deste avaliador em média ${n1(bias)} pontos`}>Calibração sobe +{n1(bias)}</Chip>;
  if (bias <= -5) return <Chip tone="warn" title={`A calibração desce as notas deste avaliador em média ${n1(Math.abs(bias))} pontos`}>Calibração desce {n1(bias)}</Chip>;
  return <Chip tone="ok">Alinhado {bias > 0 ? "+" : ""}{n1(bias)}</Chip>;
}

export function EvaluatorsPanel({ data, isAll, readOnly, className }: { data: D; isAll: boolean; readOnly: boolean; className?: string }) {
  const rows = data.evaluators;
  return (
    <Block
      id="avaliadores"
      testId="analytics-evaluators"
      icon={ClipboardCheck}
      className={className}
      title="Avaliadores"
      sub='"Ajuste da calibração" compara a nota do avaliador com a calibrada (a partir de 3 casos). "Dias até enviar" conta a partir do fim do evento.'
      footer={!readOnly ? <FooterLink href="/evaluations">Central de avaliações</FooterLink> : undefined}
    >
      {rows.length === 0 ? (
        <InlineState icon={ClipboardCheck} title={`Nenhuma avaliação enviada ${isAll ? "em todos os ciclos" : "no ciclo"}.`}>
          Os avaliadores aparecem aqui quando enviarem as primeiras notas.
        </InlineState>
      ) : (
        <DataTable
          caption="Avaliadores"
          head={["Avaliador", "Enviadas", "Nota média dada", "Ajuste da calibração", "Dias até enviar"]}
          minWidth={560}
          rows={rows.map(e => [<span className="font-semibold">{e.name}</span>, e.submitted, n1(e.avgGiven), biasChip(e.calibrationBias ?? null, e.biasSamples), n1(e.avgDaysToSubmit)])}
          sort={rows.map(e => [e.name, e.submitted, e.avgGiven, e.biasSamples >= 3 ? e.calibrationBias : null, e.avgDaysToSubmit])}
        />
      )}
    </Block>
  );
}

export function AdjustmentsPanel({ data, isAll, readOnly, className }: { data: D; isAll: boolean; readOnly: boolean; className?: string }) {
  const rows = data.adjustments;
  return (
    <Block
      id="lancamentos"
      testId="analytics-adjustments"
      icon={Scale}
      className={className}
      title="Penalidades e méritos"
      sub={isAll ? "Lançamentos de todos os ciclos, por tipo." : "Lançamentos do ciclo, por tipo."}
      aside={rows.length > 0 ? <span className="flex gap-1.5"><Chip tone="danger">{plural(data.kpis.penaltiesCount, "penalidade", "penalidades")}</Chip><Chip tone="ok">{plural(data.kpis.meritsCount, "mérito", "méritos")}</Chip></span> : undefined}
      footer={!readOnly ? <FooterLink href="/absences">Lançamentos</FooterLink> : undefined}
    >
      {rows.length === 0 ? (
        <InlineState icon={Scale} title={`Nenhum lançamento ${isAll ? "em todos os ciclos" : "no ciclo"}.`}>Sem penalidades nem méritos: as notas são a média dos eventos.</InlineState>
      ) : (
        <DataTable
          caption="Penalidades e méritos por tipo"
          head={["Tipo", "Ocorr.", "Pontos", "Pessoas"]}
          rows={rows.map(a => [
            <span className="inline-flex flex-wrap items-center gap-2"><Chip tone={a.kind === "merit" ? "ok" : "danger"}>{a.kind === "merit" ? "Mérito" : "Penalidade"}</Chip><span className="font-semibold">{a.label}</span></span>,
            a.occurrences,
            <b className={a.kind === "merit" ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]"}>{a.kind === "merit" ? "+" : "−"}{a.points}</b>,
            a.employees,
          ])}
          sort={rows.map(a => [a.label, a.occurrences, a.kind === "merit" ? a.points : -a.points, a.employees])}
        />
      )}
    </Block>
  );
}

/** Quem mais perdeu (penalidades) e quem mais ganhou (méritos) pontos — até 10 de cada. */
export function PeoplePanel({ data, isAll, canTimeline, className }: { data: D; isAll: boolean; canTimeline: boolean; className?: string }) {
  const noCiclo = isAll ? "em todos os ciclos" : "no ciclo";
  const cols = [
    { key: "penalty", title: "Mais penalidades", people: data.topPenalized, sign: "−", tone: "danger" as const, empty: `Nenhuma penalidade ${noCiclo}.` },
    { key: "merit", title: "Mais méritos", people: data.topMerited, sign: "+", tone: "ok" as const, empty: `Nenhum mérito ${noCiclo}.` },
  ];
  return (
    <Block
      id="quem"
      testId="analytics-people"
      icon={UserCheck}
      className={className}
      title="Quem mais perdeu e quem mais ganhou"
      sub={`Colaboradores com mais pontos de penalidade e de mérito ${noCiclo} (até 10 de cada).`}
      footer={canTimeline ? <FooterLink href="/linha-do-tempo">Linha do tempo</FooterLink> : undefined}
    >
      <div className="grid md:grid-cols-2 md:divide-x divide-border border-t border-border">
        {cols.map(col => (
          <section key={col.key} aria-label={col.title} className="min-w-0 pt-3 border-b md:border-b-0 border-border last:border-b-0">
            <Eyebrow as="h3" className={`px-4 lg:px-5 ${col.tone === "danger" ? "text-[var(--status-danger-text)]" : "text-[var(--status-ok-text)]"}`}>{col.title}</Eyebrow>
            {col.people.length === 0 ? (
              <p className="px-4 lg:px-5 py-3 text-[13.5px] text-muted-foreground">{col.empty}</p>
            ) : (
              <ol className="mt-1.5 pb-2">
                {col.people.map((p, i) => (
                  <li key={p.employeeId} className="flex items-center gap-3 px-4 lg:px-5 py-2 transition-colors duration-150 hover:bg-secondary/40">
                    <span className="w-5 shrink-0 text-right font-condensed text-[13px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      {canTimeline ? (
                        <Link href={`/linha-do-tempo?colaborador=${p.employeeId}&tipo=lancamentos`} data-testid={`link-timeline-${col.key}-${p.employeeId}`}
                          title={`Ver na linha do tempo as faltas e méritos de ${p.name}`}
                          className="block truncate text-[13.5px] font-semibold text-foreground hover:underline underline-offset-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {p.name}
                        </Link>
                      ) : <span className="block truncate text-[13.5px] font-semibold text-foreground">{p.name}</span>}
                      <span className="block truncate text-[12px] text-muted-foreground" title={p.types.join(", ")}>{p.types.join(", ")} · {plural(p.occurrences, "ocorrência", "ocorrências")}</span>
                    </span>
                    <Chip tone={col.tone}>{col.sign}{fmtNum(p.points, Number.isInteger(p.points) ? 0 : 1)}</Chip>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>
    </Block>
  );
}

/** Nota média por cliente (só quando os eventos têm cliente informado). */
export function ClientsPanel({ clients, isAll, withCycle, className }: { clients: D["clients"]; isAll: boolean; withCycle: (h: string) => string; className?: string }) {
  const [view, setView] = useView();
  return (
    <Block
      id="clientes"
      testId="analytics-clients"
      icon={Building2}
      className={className}
      title="Nota média por cliente"
      sub={`Clientes com mais eventos confirmados ${isAll ? "em todos os ciclos" : "no ciclo"} (até 12).`}
      aside={<ViewToggle value={view} onChange={setView} label="Ver os clientes como" testId="clients-view" />}
      footer={<FooterLink href={withCycle("/analytics/eventos")}>Eventos de cada cliente</FooterLink>}
    >
      {view === "tabela" ? (
        <DataTable caption="Nota média por cliente" head={["Cliente", "Nota média", "Eventos"]}
          rows={clients.map(c => [<span className="font-semibold">{c.client}</span>, <b>{n1(c.avgScore)}</b>, c.events])}
          sort={clients.map(c => [c.client, c.avgScore, c.events])} />
      ) : (
        <BarList ariaLabel="Nota média por cliente" testId="clients-bars"
          rows={clients.map(c => ({
            key: c.client, name: c.client, label: c.client, sub: plural(c.events, "evento", "eventos"),
            value: c.avgScore, display: n1(c.avgScore),
            tip: [{ label: "Nota média", value: n1(c.avgScore) }, { label: "Eventos", value: String(c.events) }],
          }))} />
      )}
    </Block>
  );
}
