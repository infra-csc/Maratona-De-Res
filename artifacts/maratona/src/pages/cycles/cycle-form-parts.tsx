// Partes do diálogo de ciclo: o que acontece ao criar (antes) e o resultado
// da criação (depois).
import { Link } from "wouter";
import type { Cycle, CycleSummary } from "@workspace/api-client-react";
import { AlertTriangle, ArrowRight, CalendarCheck2, CalendarRange, History, Inbox, Lock, MoveRight, Star } from "lucide-react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { Chip, DialogHeading, Eyebrow, Notice, btnPrimary, btnSecondary, cyclePeriod } from "./cycles-ui";

type Icon = typeof Star;

function Consequence({ icon: I, children, tone }: { icon: Icon; children: React.ReactNode; tone?: "warn" }) {
  return (
    <li className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
      <span className={cn("mt-0.5 w-7 h-7 shrink-0 rounded-md flex items-center justify-center",
        tone === "warn" ? "bg-[var(--status-warn-bg)] text-[var(--status-warn-text)]" : "bg-secondary text-foreground")}>
        <I size={14} aria-hidden />
      </span>
      <span className="min-w-0 text-[13.5px] leading-snug text-foreground">{children}</span>
    </li>
  );
}

/** "Ao criar": o que muda no app no instante em que o ciclo é criado. */
export function CreateConsequences({ previous, form }: { previous: CycleSummary | null; form: { name: string; areaEvaluation: boolean } }) {
  const name = form.name.trim() ? `"${form.name.trim()}"` : "o ciclo novo";
  const moving = previous?.endDate ? (previous.stats.eventsAfterEnd ?? 0) : null;
  return (
    <section aria-labelledby="cycle-consequences-title" className="rounded-xl border border-border bg-secondary/40 px-4 py-3.5" data-testid="cycle-consequences">
      <Eyebrow as="h3" id="cycle-consequences-title" className="mb-3 text-foreground">Ao criar</Eyebrow>
      <ul className="divide-y divide-border">
        <Consequence icon={Star}>
          <b className="font-semibold">{name} vira o ciclo atual.</b> Eventos, avaliações, resultados e a sincronização passam a usar ele.
          {previous && <> &ldquo;{previous.name}&rdquo; fica no histórico.</>}
        </Consequence>
        {previous && (
          <Consequence icon={MoveRight} tone={moving ? "warn" : undefined}>
            {moving == null
              ? <>Os eventos de &ldquo;{previous.name}&rdquo; dentro do período novo <b className="font-semibold">mudam para {name}</b>, com as faltas e méritos ligados.</>
              : moving > 0
                ? <><b className="font-semibold" data-testid="cycle-consequence-moving">{plural(moving, "evento muda", "eventos mudam")} de ciclo:</b> {moving === 1 ? "o de" : "os de"} &ldquo;{previous.name}&rdquo; que começa{moving === 1 ? "" : "m"} depois do fim dele {moving === 1 ? "vem" : "vêm"} para {name}, com as faltas e méritos ligados.</>
                : <>Nenhum evento muda de ciclo: &ldquo;{previous.name}&rdquo; não tem evento depois do fim dele.</>}
          </Consequence>
        )}
        <Consequence icon={Lock}>
          <b className="font-semibold">Avaliação {form.areaEvaluation ? "por área" : "por designação"}</b> fica fixa depois da primeira avaliação enviada. Ao fechar o ciclo, o período e as regras também travam.
        </Consequence>
      </ul>
    </section>
  );
}

/** Resultado da criação: o ciclo novo, os eventos que vieram e os avisos. */
export function CreateResult({ cycle, previousName, onDone }: { cycle: Cycle; previousName?: string; onDone: () => void }) {
  const moved = cycle.movedEvents ?? [];
  const outside = moved.filter(e => e.outsidePeriod);
  const absences = cycle.movedAbsences ?? 0;
  // Os de fora do período já aparecem marcados na lista; os demais avisos
  // (recálculo, respostas antigas para revisar na Central) vêm à parte.
  const warnings = (cycle.warnings ?? []).filter(w => !/fora do período dele/.test(w));
  const from = previousName ? `de “${previousName}”` : "do ciclo anterior";
  return (
    <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in duration-200" data-testid="cycle-create-result">
      <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <DialogHeading
          icon={CalendarCheck2}
          tone="brand"
          Title={DialogTitle}
          Description={DialogDescription}
          title={`${cycle.name} criado`}
          description={<>Já é o ciclo atual · {cyclePeriod(cycle)}.</>}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border px-5 py-5 sm:px-6 space-y-5">
        <section aria-labelledby="moved-title" data-testid="cycle-moved-events">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2.5">
            <Eyebrow as="h3" id="moved-title" className="text-foreground">Eventos que vieram {from}</Eyebrow>
            <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground tabular-nums">
              {plural(moved.length, "evento", "eventos")}{absences > 0 && ` · ${plural(absences, "falta/mérito", "faltas/méritos")}`}
            </span>
          </div>
          {moved.length === 0 ? (
            <p className="flex items-center gap-2.5 rounded-xl bg-secondary/60 px-3.5 py-3 text-[13.5px] text-muted-foreground">
              <Inbox size={16} aria-hidden className="shrink-0" /> Nenhum evento mudou de ciclo.
            </p>
          ) : (
            <ul className="rounded-xl border border-border divide-y divide-border">
              {moved.map(e => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5" data-testid={`moved-event-${e.id}`}>
                  <Link href={`/events/${e.id}`} onClick={onDone} className="min-w-0 truncate text-[14px] font-semibold hover:underline underline-offset-2">{e.name}</Link>
                  {e.outsidePeriod
                    ? <Chip tone="warn" icon={AlertTriangle}>Fora do período</Chip>
                    : <Chip tone="ok">No período</Chip>}
                </li>
              ))}
            </ul>
          )}
          {absences > 0 && <p className="mt-2 text-[12.5px] text-muted-foreground">As faltas e méritos ligados a esses eventos vieram junto.</p>}
        </section>

        {outside.length > 0 && (
          <Notice icon={CalendarRange} tone="warn" testId="cycle-outside-notice">
            <b className="font-semibold">{outside.length === 1 ? "1 evento ficou fora do período do ciclo novo" : `${outside.length} eventos ficaram fora do período do ciclo novo`}.</b> Confira a data do evento ou o período do ciclo — fora do período, ele não conta no resultado.
          </Notice>
        )}
        {warnings.length > 0 && (
          <section aria-labelledby="warnings-title" data-testid="cycle-warnings">
            <Eyebrow as="h3" id="warnings-title" className="mb-2.5 text-[var(--status-warn-text)]">Avisos para conferir</Eyebrow>
            <ul className="space-y-2">
              {warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                  <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0 text-[var(--status-warn-text)]" /> <span>{w}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:px-6">
        <Link href={`/cycles/${cycle.id}`} onClick={onDone} className={btnSecondary} data-testid="link-created-history">
          <History size={15} aria-hidden /> Ver histórico do ciclo
        </Link>
        <button type="button" onClick={onDone} className={btnPrimary} data-testid="button-created-done" autoFocus>
          Concluir <ArrowRight size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
