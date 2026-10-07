// Lista de Eventos → clicar na barra de Avaliações, Publicadas ou Matriz (só
// admin) abre o detalhe do evento: quem respondeu cada critério (as cópias por
// área dos critérios multiárea ficam sob o critério de origem), a situação da
// calibração de cada critério e os itens da Matriz de Conformidade. Os dados
// carregam só ao abrir (GET /events/:id, /evaluations, /calibrations e os links).
import { useMemo } from "react";
import {
  useGetEvent, getGetEventQueryKey, useGetEvaluations, getGetEvaluationsQueryKey,
  useGetCalibrations, getGetCalibrationsQueryKey,
  type Calibration, type EventCriterion, type EventDetail, type Evaluation,
} from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAllPublicTokens, type AdminPublicToken } from "@/lib/routing-api";
import { displayCriterionName } from "@/lib/criterion-name";
import { plural, fmtNum } from "@/lib/utils";
import { CONDENSED, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { fmtDT } from "../evaluations-admin-console/helpers";
import type { EventItem } from "./types";
import { areaResponseCounts } from "./criteria-rules";

export type EventDetailsKind = "evaluations" | "calibrations" | "matrix";

const TITLES: Record<EventDetailsKind, string> = {
  evaluations: "Avaliações",
  calibrations: "Calibrações publicadas",
  matrix: "Matriz de conformidade",
};

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

const muted = { color: "var(--muted-foreground)" } as const;

function Line({ area, children, right }: { area: string | null | undefined; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2 text-[12.5px]" style={{ borderTop: "1px solid var(--border)" }}>
      <span className="w-[34%] max-w-[180px] shrink-0 font-bold uppercase text-[11px] pt-[1px] break-words" style={{ ...muted, fontFamily: CONDENSED, letterSpacing: "0.03em" }}>{area || "Sem área"}</span>
      <span className="min-w-0 flex-1 leading-snug">{children}</span>
      {right != null && <span className="shrink-0 font-black tabular-nums text-[14px]" style={{ fontFamily: CONDENSED }}>{right}</span>}
    </li>
  );
}

function EvaluationsBody({ detail, evals, tokens, areaMode }: { detail: EventDetail; evals: Evaluation[]; tokens: AdminPublicToken[]; areaMode: boolean }) {
  const groups = groupByOrigin((detail.criteria ?? []).filter(c => c.active));
  const byCrit = new Map<number, Evaluation[]>();
  for (const e of evals) byCrit.set(e.criterionId, [...(byCrit.get(e.criterionId) ?? []), e]);
  const viaLink = (e: Evaluation) => tokens.find(t => t.usedAt != null && t.createdByUserId === e.evaluatorUserId && (t.criterionIds ?? []).includes(e.criterionId));
  if (groups.length === 0) return <p className="text-sm" style={muted}>Nenhum critério ativo neste evento.</p>;
  const counts = areaResponseCounts(detail.criteria ?? [], evals);
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] font-bold" data-testid="event-details-count">
        {counts.done} de {areaMode ? plural(counts.total, "resposta das áreas", "respostas das áreas") : plural(counts.total, "critério completo", "critérios completos")}
      </p>
      {groups.map(g => (
        <section key={g.name} aria-label={g.name}>
          <h3 className="font-black uppercase text-[14px] tracking-tight" style={{ fontFamily: CONDENSED }}>
            {g.name}
            {g.rows.length > 1 && <span className="ml-2 text-[11px] font-bold normal-case" style={muted}>{plural(g.rows.length, "área", "áreas")} · a nota é a média das áreas</span>}
          </h3>
          <ul className="mt-1">
            {g.rows.map(c => {
              const list = (byCrit.get(c.criterionId) ?? []).sort((a, b) => (a.status === "submitted" ? 0 : 1) - (b.status === "submitted" ? 0 : 1));
              const published = c.finalPublishedAt != null || c.partialPublishedAt != null;
              if (list.length === 0) {
                return (
                  <Line key={c.criterionId} area={c.responsibleAreaName}>
                    {published
                      ? <span style={{ color: GOOD_TEXT }} className="font-bold">Publicado na calibração (sem resposta de avaliador)</span>
                      : <span style={muted}>Pendente{areaMode ? " · qualquer avaliador da área" : ""}</span>}
                  </Line>
                );
              }
              return list.map((e, i) => {
                const link = e.status === "submitted" ? viaLink(e) : undefined;
                return (
                  <Line key={`${c.criterionId}-${e.id}`} area={i === 0 ? c.responsibleAreaName : ""} right={e.score != null ? fmtNum(Number(e.score), 0) : undefined}>
                    {e.status === "submitted" ? (
                      <span className="font-bold" style={{ color: GOOD_TEXT }}>
                        Respondido {link ? `via link por ${e.evaluatorName ?? link.submitterName ?? "freela"}${link.createdByName ? ` (em nome de ${link.createdByName})` : ""}` : `por ${e.evaluatorName ?? "avaliador"}`}
                        {e.submittedAt ? ` em ${fmtDT(e.submittedAt)}` : ""}
                      </span>
                    ) : (
                      <span className="font-bold" style={{ color: AMBER_TEXT }}>Rascunho de {e.evaluatorName ?? "avaliador"} (não enviado)</span>
                    )}
                  </Line>
                );
              });
            })}
          </ul>
        </section>
      ))}
      <p className="text-[11.5px]" style={muted}>Notas de 0 a 10, como o avaliador enviou.</p>
    </div>
  );
}

function CalibrationsBody({ detail, cals }: { detail: EventDetail; cals: Calibration[] }) {
  const groups = groupByOrigin((detail.criteria ?? []).filter(c => c.active || cals.some(k => k.criterionId === c.criterionId)));
  const calOf = new Map(cals.map(k => [k.criterionId, k]));
  if (groups.length === 0) return <p className="text-sm" style={muted}>Nenhum critério ativo neste evento.</p>;
  return (
    <div className="space-y-4">
      {groups.map(g => (
        <section key={g.name} aria-label={g.name}>
          <h3 className="font-black uppercase text-[14px] tracking-tight" style={{ fontFamily: CONDENSED }}>{g.name}</h3>
          <ul className="mt-1">
            {g.rows.map(c => {
              const cal = calOf.get(c.criterionId);
              const final = c.finalPublishedAt != null;
              const partial = !final && c.partialPublishedAt != null;
              const publishedScore = c.publishedScore ?? (cal && !cal.pendingPublish ? cal.calibratedScore : null);
              let body: React.ReactNode;
              let right: string | undefined;
              if (final || partial) {
                const by = final ? c.finalPublishedByUserName : c.partialPublishedByUserName;
                const at = final ? c.finalPublishedAt : c.partialPublishedAt;
                body = (
                  <>
                    <span className="font-bold" style={{ color: final ? GOOD_TEXT : AMBER_TEXT }}>Publicado {final ? "final" : "parcial"}{by ? ` por ${by}` : ""}{at ? ` em ${fmtDT(at)}` : ""}</span>
                    {cal?.pendingPublish && <span className="block text-[11.5px]" style={{ color: AMBER_TEXT }}>Falta publicar a calibração salva depois: {fmtNum(cal.calibratedScore, 1)}{cal.calibratedAt ? ` em ${fmtDT(cal.calibratedAt)}` : ""}</span>}
                  </>
                );
                right = publishedScore != null ? fmtNum(publishedScore, 1) : "sem calibração";
              } else if (cal) {
                body = <span className="font-bold" style={{ color: AMBER_TEXT }}>Falta publicar · salva {fmtNum(cal.calibratedScore, 1)}{cal.calibratedByName ? ` por ${cal.calibratedByName}` : ""}{cal.calibratedAt ? ` em ${fmtDT(cal.calibratedAt)}` : ""}</span>;
              } else {
                body = <span style={muted}>Sem calibração</span>;
              }
              return (
                <Line key={c.criterionId} area={c.responsibleAreaName} right={right}>
                  {body}
                  {cal?.calibrationReason && <span className="block text-[11.5px] mt-0.5 whitespace-pre-line" style={muted}>Motivo: {cal.calibrationReason}</span>}
                </Line>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="text-[11.5px]" style={muted}>Nota publicada na escala do critério (0 a 10). Calibração salva só vale na nota depois de publicar.</p>
    </div>
  );
}

function MatrixBody({ detail }: { detail: EventDetail }) {
  const cf = detail.conformity ?? null;
  const yesNo = (v: boolean | null | undefined) => v == null
    ? <span style={muted}>Pendente</span>
    : <span className="font-bold" style={{ color: v ? GOOD_TEXT : DANGER_TEXT }}>{v ? "Sim" : "Não"}</span>;
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
    <div className="space-y-4">
      {sides.map(s => (
        <section key={s.key} aria-label={s.title}>
          <h3 className="font-black uppercase text-[14px] tracking-tight" style={{ fontFamily: CONDENSED }}>{s.title}</h3>
          <p className="text-[12px] mt-0.5" style={muted}>
            Responsável: <strong style={{ color: "var(--foreground)" }}>{s.responsible ?? "sem responsável"}</strong>
            {" · "}{s.answeredBy ? <>respondida por <strong style={{ color: "var(--foreground)" }}>{s.answeredBy}</strong>{cf?.updatedAt ? ` (última alteração em ${fmtDT(cf.updatedAt)})` : ""}</> : "ainda não respondida"}
          </p>
          <ul className="mt-1">
            {s.items.map(it => (
              <Line key={it.label} area={it.label}>
                {yesNo(it.v)}
                {it.note && <span className="block text-[11.5px] mt-0.5 whitespace-pre-line" style={muted}>{it.note}</span>}
              </Line>
            ))}
          </ul>
        </section>
      ))}
      {detail.conformityWithoutConduta && <p className="text-[11.5px]" style={muted}>Neste ciclo a Conduta saiu da Matriz (é avaliada no critério Proatividade/Conduta).</p>}
    </div>
  );
}

export function EventDetailsDialog({ ev, kind, areaMode, onClose }: { ev: EventItem; kind: EventDetailsKind; areaMode: boolean; onClose: () => void }) {
  const { data: detail, isLoading, isError } = useGetEvent(ev.id, { query: { queryKey: getGetEventQueryKey(ev.id) } });
  const evalParams = { eventId: ev.id };
  const evals = useGetEvaluations(evalParams, { query: { enabled: kind === "evaluations", queryKey: getGetEvaluationsQueryKey(evalParams) } });
  const cals = useGetCalibrations(evalParams, { query: { enabled: kind === "calibrations", queryKey: getGetCalibrationsQueryKey(evalParams) } });
  const tokens = useAllPublicTokens(kind === "evaluations" ? ev.id : null);
  const loading = isLoading || (kind === "evaluations" && evals.isLoading) || (kind === "calibrations" && cals.isLoading);
  const failed = isError || (kind === "evaluations" && evals.isError) || (kind === "calibrations" && cals.isError);
  const subtitle = useMemo(() => [ev.clientName, ev.city].filter(Boolean).join(" · "), [ev]);
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent
        data-testid={`event-details-${kind}`}
        className="max-w-2xl max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:p-4 content-start"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      >
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="text-xl font-black uppercase tracking-tight leading-tight" style={{ fontFamily: CONDENSED }}>{TITLES[kind]} · {ev.name}</DialogTitle>
          <DialogDescription className="text-[12px]" style={muted}>{subtitle || "Detalhe do evento"}</DialogDescription>
        </DialogHeader>
        {loading ? (
          <div role="status" aria-live="polite" className="space-y-2">
            <span className="sr-only">Carregando…</span>
            {[0, 1, 2].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />)}
          </div>
        ) : failed || !detail ? (
          <p role="alert" className="text-sm font-bold" style={{ color: DANGER_TEXT }}>Não foi possível carregar o detalhe deste evento.</p>
        ) : kind === "evaluations" ? (
          <EvaluationsBody detail={detail} evals={evals.data ?? []} tokens={tokens.data ?? []} areaMode={areaMode} />
        ) : kind === "calibrations" ? (
          <CalibrationsBody detail={detail} cals={cals.data ?? []} />
        ) : (
          <MatrixBody detail={detail} />
        )}
      </DialogContent>
    </Dialog>
  );
}
