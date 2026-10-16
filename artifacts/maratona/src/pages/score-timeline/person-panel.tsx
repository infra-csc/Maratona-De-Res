// Colaborador filtrado: quem é, a situação agora (nota, faixa, bônus, eventos)
// e a evolução da nota final. Fora do ranking (sem nota ou fora do ciclo), a
// situação vira um aviso e o gráfico mostra a nota que teve até sair.
import type { ScoreTimelineEntry } from "@workspace/api-client-react";
import { CheckCircle2, CircleSlash, UserMinus, UserX, X } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { Avatar, Chip, Eyebrow, FaixaChip, btnGhost } from "./tl-ui";
import { TimelineChart } from "./timeline-chart";
import { brl, score } from "./describe";

interface Person {
  name: string; functionName?: string | null; finalResult?: number | null; platoon?: string | null; platoonColor?: string | null;
  bonusValue?: number | null; eventsCount: number; eligible?: boolean | null;
}
interface Platoon { name: string; color?: string | null; minScore: number }

function Identity({ name, functionName, onClear }: { name: string; functionName?: string | null; onClear: () => void }) {
  return (
    <div className="flex items-start gap-3">
      <Avatar name={name} className="w-11 h-11 text-[16px]" />
      <div className="min-w-0 flex-1">
        <Eyebrow as="p">{functionName ?? "Colaborador"}</Eyebrow>
        <h2 className="mt-1 font-condensed text-[24px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-foreground break-words">{name}</h2>
      </div>
      <button type="button" onClick={onClear} className={cn(btnGhost, "shrink-0 -mr-2 -mt-1 px-2")} title="Voltar para todos os colaboradores" data-testid="button-clear-person">
        <X size={14} aria-hidden /><span className="hidden sm:inline">Ver todos</span><span className="sr-only sm:hidden">Ver todos os colaboradores</span>
      </button>
    </div>
  );
}

function MiniStat({ label, children, testId }: { label: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <Eyebrow as="p">{label}</Eyebrow>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function PersonPanel({ person, platoonColor, entries, platoons, onClear }: {
  person: Person; platoonColor: string | null; entries: ScoreTimelineEntry[]; platoons: Platoon[]; onClear: () => void;
}) {
  return (
    <section aria-label={`Situação de ${person.name}`} data-testid="timeline-person"
      className="rounded-2xl border border-border bg-card grid lg:grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
      <div className="p-4 lg:p-5 flex flex-col gap-5 border-b lg:border-b-0 lg:border-r border-border">
        <Identity name={person.name} functionName={person.functionName} onClear={onClear} />
        <div className="flex items-end justify-between gap-4">
          <MiniStat label="Nota final agora" testId="person-final">
            <span className="font-condensed text-[52px] font-black leading-[0.85] tracking-[-0.02em] tabular-nums text-foreground">{score(person.finalResult)}</span>
          </MiniStat>
          <div className="pb-1"><FaixaChip name={person.platoon} color={platoonColor} strong /></div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
          <MiniStat label="Bônus projetado">
            <span className="font-condensed text-[22px] font-black leading-none tabular-nums text-foreground">{brl(person.bonusValue)}</span>
          </MiniStat>
          <MiniStat label="Eventos com nota">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-condensed text-[22px] font-black leading-none tabular-nums text-foreground">{person.eventsCount.toLocaleString("pt-BR")}</span>
              {person.eligible
                ? <Chip tone="ok" icon={CheckCircle2}>Elegível</Chip>
                : <Chip icon={CircleSlash}>Não elegível</Chip>}
            </span>
          </MiniStat>
        </div>
      </div>
      <div className="p-4 lg:p-5 min-w-0">
        <h3 className="font-condensed text-[19px] font-black uppercase leading-none text-foreground">Evolução da nota final</h3>
        <p className="mt-1.5 mb-3 text-[13px] leading-snug text-muted-foreground">Em degraus: a nota muda no momento de cada acontecimento. Linhas pontilhadas marcam o começo de cada faixa.</p>
        <TimelineChart entries={entries} currentFinal={person.finalResult ?? null} platoons={platoons} name={person.name} height={260} />
      </div>
    </section>
  );
}

export function OutOfRankingPanel({ name, functionName, excluded, excludedReason, entries, platoons, onClear }: {
  name: string; functionName?: string | null; excluded: boolean; excludedReason?: string | null;
  entries: ScoreTimelineEntry[]; platoons: Platoon[]; onClear: () => void;
}) {
  const hasScore = entries.some(e => e.kind !== "info" && e.finalAfter != null);
  const changes = entries.filter(e => e.kind !== "info").length;
  return (
    <section aria-label={`Situação de ${name}`} data-testid="timeline-person-out"
      className="rounded-2xl border border-border bg-card grid lg:grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
      <div className="p-4 lg:p-5 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-border">
        <Identity name={name} functionName={functionName} onClear={onClear} />
        <div className={cn("flex items-start gap-3 rounded-xl px-3.5 py-3", excluded ? "bg-[var(--status-danger-bg)]" : "bg-secondary/70")}>
          {excluded
            ? <UserMinus size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--status-danger-text)]" />
            : <UserX size={18} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className={cn("font-condensed text-[17px] font-black uppercase leading-tight", excluded ? "text-[var(--status-danger-text)]" : "text-foreground")}>
              {excluded ? "Fora do ciclo" : "Sem nota no ciclo"}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground break-words">
              {excluded
                ? (excludedReason ? <>Motivo: “{excludedReason}”. </> : "Tirado do ciclo pelo admin. ")
                : "Ainda não tem evento com nota neste ciclo. "}
              Sem nota, ranking e bônus agora.
            </p>
          </div>
        </div>
        {changes > 0 && <p className="text-[12.5px] text-muted-foreground">{plural(changes, "mudança registrada", "mudanças registradas")} neste ciclo.</p>}
      </div>
      <div className="p-4 lg:p-5 min-w-0">
        <h3 className="font-condensed text-[19px] font-black uppercase leading-none text-foreground">Evolução da nota final</h3>
        {hasScore ? (
          <>
            <p className="mt-1.5 mb-3 text-[13px] leading-snug text-muted-foreground">A nota que teve no ciclo, até sair dele.</p>
            <TimelineChart entries={entries} currentFinal={null} platoons={platoons} name={name} height={260} />
          </>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-border px-4 py-10 text-center">
            <p className="text-[13.5px] text-muted-foreground">Nenhuma nota neste ciclo para desenhar.</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">A linha aparece quando o primeiro evento entrar na nota.</p>
          </div>
        )}
      </div>
    </section>
  );
}
