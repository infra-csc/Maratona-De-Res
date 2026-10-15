// "Seus pontos fortes": média de cada critério no ciclo (só notas finais e com
// peso), o melhor e o que mais pode melhorar em destaque e a lista completa.
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { scoreBarColor } from "./helpers";
import { Eyebrow, Meter, Section, scoreInk, surfaceCls } from "./mp-ui";
import type { EventSummary } from "./types";

export function CycleHighlights({ events }: { events: EventSummary[] }) {
  const scoredEvents = (events ?? []).filter(ev => ev.resultsConfirmed && ev.countsForScore && ev.eventScore > 0);
  // Agrupa scoreUsed por critério (apenas critérios finalizados com peso).
  const map = new Map<string, number[]>();
  for (const ev of scoredEvents) {
    for (const c of ev.criteriaDetails) {
      if (c.scoreUsed === null || !c.finalPublishedAt || Number(c.weight) <= 0) continue;
      const name = displayCriterionName(c.criterionName);
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(c.scoreUsed);
    }
  }
  if (map.size < 2) return null;
  const entries = [...map.entries()].map(([name, scores]) => ({
    name,
    avg: scores.reduce((s, v) => s + v, 0) / scores.length,
    count: scores.length,
  })).sort((a, b) => b.avg - a.avg);
  const best = entries[0];
  const worst = entries[entries.length - 1];

  return (
    <Section id="mp-highlights" icon={Sparkles} title="Seus pontos fortes" testId="my-highlights"
      hint="A média de cada critério nos seus eventos do ciclo, de 0 a 10.">
      <div className={cn(surfaceCls, "overflow-hidden")}>
        {/* Empate (mesma média com 1 casa): "pode melhorar" seria injusto — diz que estão iguais. */}
        {fmtNum(best.avg, 1) === fmtNum(worst.avg, 1) ? (
          <p className="px-4 py-4 sm:px-5 flex items-baseline gap-2 text-[14.5px] text-foreground">
            <span className={cn("font-condensed text-[30px] font-black leading-none tabular-nums", scoreInk(best.avg * 10))}>{fmtNum(best.avg, 1)}</span>
            <span>Todos os seus critérios estão com a mesma média.</span>
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            <Highlight kind="best" name={best.name} avg={best.avg} count={best.count} />
            <Highlight kind="worst" name={worst.name} avg={worst.avg} count={worst.count} />
          </div>
        )}
        <div className="border-t border-border px-4 py-4 sm:px-5">
          <Eyebrow as="h3" className="mb-3">Todos os critérios</Eyebrow>
          <ol className="space-y-3">
            {entries.map((e, i) => (
              <li key={e.name} className="grid grid-cols-[20px_minmax(0,1fr)_44px] items-center gap-x-3 gap-y-1">
                <span aria-hidden className="text-right font-condensed text-[14px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="text-[13.5px] font-semibold leading-snug text-foreground break-words">{e.name}</span>
                <span className={cn("row-span-2 self-center text-right font-condensed text-[20px] font-black leading-none tabular-nums", scoreInk(e.avg * 10))}>{fmtNum(e.avg, 1)}</span>
                <span aria-hidden />
                <Meter pct={(e.avg / 10) * 100} fill={scoreBarColor(e.avg * 10)} className="h-1" />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Section>
  );
}

function Highlight({ kind, name, avg, count }: { kind: "best" | "worst"; name: string; avg: number; count: number }) {
  const best = kind === "best";
  const Icon = best ? TrendingUp : TrendingDown;
  return (
    <div className="px-4 py-4 sm:px-5 min-w-0">
      <p className={cn("flex items-center gap-1.5 font-condensed text-[12px] font-bold uppercase tracking-[0.08em]", best ? "text-[var(--status-ok-text)]" : "text-[var(--status-warn-text)]")}>
        <Icon size={14} aria-hidden /> {best ? "Ponto forte" : "Pode melhorar"}
      </p>
      <p className="mt-2 text-[16px] font-bold leading-snug text-foreground break-words">{name}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cn("font-condensed text-[30px] font-black leading-none tabular-nums", scoreInk(avg * 10))}>{fmtNum(avg, 1)}</span>
        <span className="text-[13px] text-muted-foreground">de 10 · média em {plural(count, "evento", "eventos")}</span>
      </p>
    </div>
  );
}
