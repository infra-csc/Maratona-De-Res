// O ciclo atual em destaque: nome, situação, onde está no calendário, as
// regras e os números — e, ao lado, o caminho até o próximo ciclo (fechar
// este, depois criar o próximo) com o que acontece ao criar.
import { Link } from "wouter";
import type { CycleSummary } from "@workspace/api-client-react";
import { ArrowRight, CalendarPlus, Check, History, Pencil } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { CycleRules, CycleStatBand } from "./cycle-overview";
import { CycleStatusChip, Eyebrow, FOCUS_RING, PeriodTrack, btnSmall, fmtFull, surfaceCls } from "./cycles-ui";

function Step({ n, done, title, children }: { n: number; done?: boolean; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className={cn("mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center font-condensed text-[13px] font-black",
        done ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-card border border-border text-foreground")}>
        {done ? <Check size={13} aria-label="Feito" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold leading-snug text-foreground">{title}</p>
        {children && <div className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{children}</div>}
      </div>
    </li>
  );
}

/** "Próximo ciclo": fechar este e criar o próximo, com as consequências à vista. */
function NextCycle({ cycle, isAdmin, needsClose, suggestedStart, onCreate }: {
  cycle: CycleSummary; isAdmin: boolean; needsClose: boolean; suggestedStart?: string; onCreate: () => void;
}) {
  const closed = cycle.status === "closed";
  const moving = cycle.stats.eventsAfterEnd ?? 0;
  return (
    <aside aria-labelledby="next-cycle-title" className="rounded-xl bg-secondary/60 px-4 py-4 lg:px-5" data-testid="next-cycle">
      <Eyebrow as="h3" id="next-cycle-title" className="text-foreground">Próximo ciclo</Eyebrow>
      <ol className="mt-3.5 space-y-3.5">
        <Step n={1} done={closed || !needsClose} title={closed ? "Este ciclo está fechado" : needsClose ? "Fechar este ciclo" : "Sem evento no período"}>
          {closed
            ? `Resultado oficial guardado${cycle.closedAt ? ` em ${new Date(cycle.closedAt).toLocaleDateString("pt-BR")}` : ""}.`
            : needsClose
              ? (
                <span id="new-cycle-blocked" data-testid="new-cycle-blocked">
                  O próximo só pode ser criado depois. O fechamento guarda os resultados oficiais no histórico.{" "}
                  <Link href="/results" className={cn("group inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2 rounded-sm", FOCUS_RING)}>
                    Fechar em Resultados &amp; Ranking<ArrowRight size={12} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                  </Link>
                </span>
              )
              : "Não precisa fechar antes de criar o próximo."}
        </Step>
        <Step n={2} title="Criar o próximo">
          <span className="block">
            {suggestedStart ? <>Começa em <b className="font-semibold text-foreground tabular-nums">{fmtFull(suggestedStart)}</b> (sugestão) e vira o atual na hora.</> : "Vira o ciclo atual na hora."}
          </span>
          <span className="block mt-0.5" data-testid="next-cycle-moving">
            {moving > 0
              ? <><b className="font-semibold text-[var(--status-warn-text)]">{plural(moving, "evento muda", "eventos mudam")} para ele</b> — {moving === 1 ? "começa" : "começam"} depois do fim deste.</>
              : "Nenhum evento muda de ciclo."}
          </span>
          {/* Só quando dá para criar: bloqueado, o passo 1 já diz o que fazer. */}
          {isAdmin && !needsClose && (
            <button type="button" onClick={onCreate} className={cn(btnSmall, "mt-3 w-full sm:w-auto")} data-testid="button-new-cycle-inline">
              <CalendarPlus size={14} aria-hidden /> Novo ciclo
            </button>
          )}
        </Step>
      </ol>
    </aside>
  );
}

export function CurrentCycle({ cycle, isAdmin, needsClose, suggestedStart, onEdit, onCreate }: {
  cycle: CycleSummary;
  isAdmin: boolean;
  /** Atual aberto com eventos: o próximo só nasce depois de fechar este. */
  needsClose: boolean;
  suggestedStart?: string;
  onEdit: () => void;
  onCreate: () => void;
}) {
  const closed = cycle.status === "closed";
  return (
    <div className="space-y-4">
      <section aria-labelledby="current-cycle-title" className={cn(surfaceCls, "overflow-hidden")} data-testid="current-cycle">
        <div className="px-4 pt-4 pb-5 lg:px-6 lg:pt-5 lg:pb-6 grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
          <div className="min-w-0 flex flex-col">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Eyebrow as="span">Ciclo atual</Eyebrow>
                  <CycleStatusChip cycle={cycle} />
                </div>
                <h2 id="current-cycle-title" className="mt-2 font-condensed text-[30px] sm:text-[36px] lg:text-[42px] font-black uppercase leading-[0.95] tracking-[-0.015em] text-foreground break-words">
                  {cycle.name}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Link href={`/cycles/${cycle.id}`} className={cn(btnSmall, "flex-1 sm:flex-none")} data-testid="link-current-history"><History size={15} aria-hidden /> Ver histórico</Link>
                {isAdmin && <button type="button" onClick={onEdit} className={cn(btnSmall, "flex-1 sm:flex-none")} data-testid="button-edit-current"><Pencil size={15} aria-hidden /> Editar</button>}
              </div>
            </div>
            <PeriodTrack start={cycle.startDate} end={cycle.endDate} closed={closed} className="mt-5" />
            <div className="mt-5 border-t border-border pt-4 lg:pt-5">
              <CycleRules cycle={cycle} cols="grid-cols-2 2xl:grid-cols-4" />
            </div>
          </div>
          <NextCycle cycle={cycle} isAdmin={isAdmin} needsClose={needsClose} suggestedStart={suggestedStart} onCreate={onCreate} />
        </div>
      </section>
      <CycleStatBand cycle={cycle} />
    </div>
  );
}
