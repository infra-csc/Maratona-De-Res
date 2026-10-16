// Lista de Eventos → clicar na barra de Avaliações, Publicadas ou Matriz (só
// admin) abre o detalhe do evento: quem respondeu cada critério (as cópias por
// área dos critérios multiárea ficam sob o critério de origem), a situação da
// calibração de cada critério e os itens da Matriz de Conformidade. Os dados
// carregam só ao abrir (GET /events/:id, /evaluations, /calibrations e os links).
import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import {
  useGetEvent, getGetEventQueryKey, useGetEvaluations, getGetEvaluationsQueryKey,
  useGetCalibrations, getGetCalibrationsQueryKey,
  type Calibration, type EventCriterion, type EventDetail, type Evaluation,
} from "@workspace/api-client-react";
import { ArrowUpRight, ClipboardList, Link2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAllPublicTokens, type AdminPublicToken } from "@/lib/routing-api";
import { displayCriterionName } from "@/lib/criterion-name";
import { cn, plural, fmtNum } from "@/lib/utils";
import { fmtDT } from "../evaluations-admin-console/helpers";
import type { EventItem } from "./types";
import { areaResponseCounts } from "./criteria-rules";
import { Bone, Chip, DialogHeading, ErrorBlock, Eyebrow, StackBar, btnSmall, dialogCls, type Tone } from "./events-ui";

export type EventDetailsKind = "evaluations" | "calibrations" | "matrix";

const TITLES: Record<EventDetailsKind, string> = {
  evaluations: "Avaliações",
  calibrations: "Calibrações publicadas",
  matrix: "Matriz de conformidade",
};
const ICONS = { evaluations: ClipboardList, calibrations: SlidersHorizontal, matrix: ShieldCheck } as const;

/** Critérios ativos do evento agrupados pelo critério de origem (cópias por área juntas). */
function groupByOrigin(criteria: EventCriterion[]) {
  const map = new Map<string, { name: string; rows: EventCriterion[] }>();
  for (const c of criteria) {
    const name = displayCriterionName(c.criterionName);
    const key = name.toLocaleLowerCase("pt-BR");
    const g = map.get(key) ?? { name, rows: [] };
    g.rows.push(c);
    map.set(key, g);
  }
  return [...map.values()]
    .map(g => ({ ...g, rows: g.rows.sort((a, b) => (a.responsibleAreaName ?? "").localeCompare(b.responsibleAreaName ?? "", "pt-BR")) }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

/** Uma linha: área (ou item) à esquerda, situação no meio, nota à direita. */
function Line({ area, children, right }: { area: string | null | undefined; children: ReactNode; right?: ReactNode }) {
  return (
    <li className="grid grid-cols-[minmax(0,34%)_minmax(0,1fr)_auto] sm:grid-cols-[180px_minmax(0,1fr)_auto] items-start gap-x-3 py-2.5 border-t border-border first:border-t-0">
      <span className="font-condensed pt-0.5 text-[12.5px] font-bold uppercase tracking-[0.05em] leading-tight text-muted-foreground break-words">{area === "" ? "" : area || "Sem área"}</span>
      <span className="min-w-0 text-[13.5px] leading-snug text-foreground">{children}</span>
      {right != null ? <span className="font-condensed text-[18px] font-black leading-none tabular-nums text-foreground pt-0.5">{right}</span> : <span />}
    </li>
  );
}

/** Situação + texto da linha (selo colorido e frase). */
function State({ tone, label, children }: { tone: Tone; label: string; children?: ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Chip tone={tone}>{label}</Chip>
      {children && <span className="text-muted-foreground">{children}</span>}
    </span>
  );
}

function GroupBlock({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-border">
      <header className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border bg-secondary/40 rounded-t-xl">
        <h3 className="font-condensed text-[16px] font-black uppercase leading-tight tracking-[-0.005em] text-foreground">{title}</h3>
        {aside && <span className="text-[12.5px] text-muted-foreground">{aside}</span>}
      </header>
      <ul className="px-4">{children}</ul>
    </section>
  );
}

function EvaluationsBody({ detail, evals, tokens, areaMode }: { detail: EventDetail; evals: Evaluation[]; tokens: AdminPublicToken[]; areaMode: boolean }) {
  const groups = groupByOrigin((detail.criteria ?? []).filter(c => c.active));
  const byCrit = new Map<number, Evaluation[]>();
  for (const e of evals) byCrit.set(e.criterionId, [...(byCrit.get(e.criterionId) ?? []), e]);
  const viaLink = (e: Evaluation) => tokens.find(t => t.usedAt != null && t.createdByUserId === e.evaluatorUserId && (t.criterionIds ?? []).includes(e.criterionId));
  if (groups.length === 0) return <p className="text-[14px] text-muted-foreground">Nenhum critério ativo neste evento.</p>;
  const counts = areaResponseCounts(detail.criteria ?? [], evals);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="font-condensed text-[15px] font-bold uppercase tracking-[0.03em] tabular-nums text-foreground shrink-0" data-testid="event-details-count">
          {counts.done} de {areaMode ? plural(counts.total, "resposta das áreas", "respostas das áreas") : plural(counts.total, "critério completo", "critérios completos")}
        </p>
        <StackBar className="flex-1" parts={[{ value: counts.done, cls: "bg-[var(--status-ok)]" }, { value: Math.max(0, counts.total - counts.done), cls: "bg-transparent" }]} />
      </div>
      {groups.map(g => (
        <GroupBlock key={g.name} title={g.name} aside={g.rows.length > 1 ? `${plural(g.rows.length, "área", "áreas")} · a nota é a média das áreas` : undefined}>
          {g.rows.map(c => {
            const list = (byCrit.get(c.criterionId) ?? []).sort((a, b) => (a.status === "submitted" ? 0 : 1) - (b.status === "submitted" ? 0 : 1));
            const published = c.finalPublishedAt != null || c.partialPublishedAt != null;
            if (list.length === 0) {
              return (
                <Line key={c.criterionId} area={c.responsibleAreaName}>
                  {published
                    ? <State tone="ok" label="Publicado">na calibração, sem resposta de avaliador</State>
                    : <State tone="neutral" label="Pendente">{areaMode ? "qualquer avaliador da área responde" : undefined}</State>}
                </Line>
              );
            }
            return list.map((e, i) => {
              const link = e.status === "submitted" ? viaLink(e) : undefined;
              return (
                <Line key={`${c.criterionId}-${e.id}`} area={i === 0 ? c.responsibleAreaName : ""} right={e.score != null ? fmtNum(Number(e.score), 0) : undefined}>
                  {e.status === "submitted" ? (
                    <State tone="ok" label="Respondido">
                      {link
                        ? <><Link2 size={12} aria-hidden className="inline -mt-0.5 mr-1" />via link por <b className="font-semibold text-foreground">{e.evaluatorName ?? link.submitterName ?? "freela"}</b>{link.createdByName ? ` (em nome de ${link.createdByName})` : ""}</>
                        : <>por <b className="font-semibold text-foreground">{e.evaluatorName ?? "avaliador"}</b></>}
                      {e.submittedAt ? ` · ${fmtDT(e.submittedAt)}` : ""}
                    </State>
                  ) : (
                    <State tone="warn" label="Rascunho">de {e.evaluatorName ?? "avaliador"}, não enviado</State>
                  )}
                </Line>
              );
            });
          })}
        </GroupBlock>
      ))}
      <p className="text-[12.5px] text-muted-foreground">Notas de 0 a 10, como o avaliador enviou.</p>
    </div>
  );
}

function CalibrationsBody({ detail, cals }: { detail: EventDetail; cals: Calibration[] }) {
  const groups = groupByOrigin((detail.criteria ?? []).filter(c => c.active || cals.some(k => k.criterionId === c.criterionId)));
  const calOf = new Map(cals.map(k => [k.criterionId, k]));
  if (groups.length === 0) return <p className="text-[14px] text-muted-foreground">Nenhum critério ativo neste evento.</p>;
  return (
    <div className="space-y-3">
      {groups.map(g => (
        <GroupBlock key={g.name} title={g.name}>
          {g.rows.map(c => {
            const cal = calOf.get(c.criterionId);
            const final = c.finalPublishedAt != null;
            const partial = !final && c.partialPublishedAt != null;
            const publishedScore = c.publishedScore ?? (cal && !cal.pendingPublish ? cal.calibratedScore : null);
            let body: ReactNode;
            let right: string | undefined;
            if (final || partial) {
              const by = final ? c.finalPublishedByUserName : c.partialPublishedByUserName;
              const at = final ? c.finalPublishedAt : c.partialPublishedAt;
              body = (
                <>
                  <State tone={final ? "ok" : "warn"} label={final ? "Final" : "Parcial"}>
                    {by ? <>por <b className="font-semibold text-foreground">{by}</b></> : "publicado"}{at ? ` · ${fmtDT(at)}` : ""}
                  </State>
                  {cal?.pendingPublish && <span className="mt-1 block text-[12.5px] text-[var(--status-warn-text)]">Falta publicar a calibração salva depois: {fmtNum(cal.calibratedScore, 1)}{cal.calibratedAt ? ` em ${fmtDT(cal.calibratedAt)}` : ""}</span>}
                </>
              );
              right = publishedScore != null ? fmtNum(publishedScore, 1) : "sem calibração";
            } else if (cal) {
              body = (
                <State tone="warn" label="Falta publicar">
                  salva {fmtNum(cal.calibratedScore, 1)}{cal.calibratedByName ? <> por <b className="font-semibold text-foreground">{cal.calibratedByName}</b></> : ""}{cal.calibratedAt ? ` · ${fmtDT(cal.calibratedAt)}` : ""}
                </State>
              );
            } else {
              body = <State tone="neutral" label="Sem calibração" />;
            }
            return (
              <Line key={c.criterionId} area={c.responsibleAreaName} right={right}>
                {body}
                {cal?.calibrationReason && <span className="mt-1 block text-[12.5px] text-muted-foreground whitespace-pre-line">Motivo: {cal.calibrationReason}</span>}
              </Line>
            );
          })}
        </GroupBlock>
      ))}
      <p className="text-[12.5px] text-muted-foreground">Nota publicada na escala do critério (0 a 10). Calibração salva só vale na nota depois de publicar.</p>
    </div>
  );
}

function MatrixBody({ detail }: { detail: EventDetail }) {
  const cf = detail.conformity ?? null;
  const yesNo = (v: boolean | null | undefined) => v == null
    ? <Chip>Pendente</Chip>
    : <Chip tone={v ? "ok" : "danger"}>{v ? "Sim" : "Não"}</Chip>;
  const sides = [
    {
      key: "cenografia", title: "Cenografia", responsible: detail.conformityEvaluatorName, answeredBy: cf?.cenografiaSubmittedByName,
      items: [
        { label: "Uso de EPI", v: cf?.epi, note: cf?.epiComment },
        { label: "Estaiamentos / Aterramentos", v: cf?.estaiamentos, note: cf?.estaiamentosComment },
        ...(detail.conformityWithoutConduta ? [] : [{ label: "Conduta", v: cf?.conduta, note: cf?.condutaComment }]),
      ],
    },
    {
      key: "ferramentas", title: "Ferramentas e case", responsible: detail.conformityEvaluatorFerramentasName, answeredBy: cf?.ferramentasSubmittedByName,
      items: [{ label: "Guarda de Equipamentos", v: cf?.guardaEquipamentos, note: cf?.guardaEquipamentosComment }],
    },
  ];
  return (
    <div className="space-y-3">
      {sides.map(s => (
        <GroupBlock key={s.key} title={s.title} aside={
          <>Responsável: <b className="font-semibold text-foreground">{s.responsible ?? "sem responsável"}</b>
            {" · "}{s.answeredBy ? <>respondida por <b className="font-semibold text-foreground">{s.answeredBy}</b>{cf?.updatedAt ? ` (última alteração em ${fmtDT(cf.updatedAt)})` : ""}</> : "ainda não respondida"}</>
        }>
          {s.items.map(it => (
            <Line key={it.label} area={it.label}>
              {yesNo(it.v)}
              {it.note && <span className="mt-1 block text-[12.5px] text-muted-foreground whitespace-pre-line">{it.note}</span>}
            </Line>
          ))}
        </GroupBlock>
      ))}
      {detail.conformityWithoutConduta && <p className="text-[12.5px] text-muted-foreground">Neste ciclo a Conduta saiu da Matriz (é avaliada no critério Proatividade/Conduta).</p>}
    </div>
  );
}

export function EventDetailsDialog({ ev, kind, areaMode, onClose }: { ev: EventItem; kind: EventDetailsKind; areaMode: boolean; onClose: () => void }) {
  const { data: detail, isLoading, isError, refetch } = useGetEvent(ev.id, { query: { queryKey: getGetEventQueryKey(ev.id) } });
  const evalParams = { eventId: ev.id };
  const evals = useGetEvaluations(evalParams, { query: { enabled: kind === "evaluations", queryKey: getGetEvaluationsQueryKey(evalParams) } });
  const cals = useGetCalibrations(evalParams, { query: { enabled: kind === "calibrations", queryKey: getGetCalibrationsQueryKey(evalParams) } });
  const tokens = useAllPublicTokens(kind === "evaluations" ? ev.id : null);
  const loading = isLoading || (kind === "evaluations" && evals.isLoading) || (kind === "calibrations" && cals.isLoading);
  const failed = isError || (kind === "evaluations" && evals.isError) || (kind === "calibrations" && cals.isError);
  const subtitle = useMemo(() => [ev.name, ev.clientName, ev.city].filter(Boolean).join(" · "), [ev]);
  const retry = () => { void refetch(); if (kind === "evaluations") void evals.refetch(); if (kind === "calibrations") void cals.refetch(); };
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent
        data-testid={`event-details-${kind}`}
        className={cn(dialogCls, "max-w-[720px] p-0 gap-0 flex flex-col overflow-hidden max-h-[88dvh]",
          "max-sm:w-full max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:rounded-none max-sm:border-0")}
      >
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border shrink-0">
          <DialogHeading icon={ICONS[kind]} Title={DialogTitle} Description={DialogDescription} title={TITLES[kind]} description={subtitle} />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5">
          {loading ? (
            <div role="status" aria-live="polite" className="space-y-3">
              <span className="sr-only">Carregando…</span>
              <Bone className="h-4 w-48" />
              {[0, 1, 2].map(i => <Bone key={i} className="h-[92px] w-full rounded-xl" />)}
            </div>
          ) : failed || !detail ? (
            <ErrorBlock title="Não foi possível carregar o detalhe" onRetry={retry} />
          ) : kind === "evaluations" ? (
            <EvaluationsBody detail={detail} evals={evals.data ?? []} tokens={tokens.data ?? []} areaMode={areaMode} />
          ) : kind === "calibrations" ? (
            <CalibrationsBody detail={detail} cals={cals.data ?? []} />
          ) : (
            <MatrixBody detail={detail} />
          )}
        </div>
        <div className="px-5 sm:px-6 py-3.5 border-t border-border shrink-0 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow as="span" className="hidden sm:block">Detalhe só de leitura</Eyebrow>
          <Link href={kind === "calibrations" ? `/calibrations?eventId=${ev.id}` : `/events/${ev.id}`} className={cn(btnSmall, "ml-auto")} onClick={onClose}>
            {kind === "calibrations" ? "Abrir a calibração" : "Abrir o evento"} <ArrowUpRight size={14} aria-hidden />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
