// "Penalidades e méritos" do colaborador: os totais e cada lançamento (o que
// foi, quando, em qual evento, o motivo e quantos pontos).
import type { MyPerformanceAdjustment } from "@workspace/api-client-react";
import { Award, CalendarDays, MinusCircle, Scale } from "lucide-react";
import { cn, fmtDate } from "@/lib/utils";
import { Chip, Section, surfaceCls } from "./mp-ui";

const FULL: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };

export function AdjustmentsSection({ adjustments }: { adjustments: MyPerformanceAdjustment[] }) {
  const list = adjustments ?? [];
  const pen = list.filter(a => a.kind === "penalty").reduce((s, a) => s + a.totalPoints, 0);
  const mer = list.filter(a => a.kind === "merit").reduce((s, a) => s + a.totalPoints, 0);
  const net = mer - pen;
  return (
    <Section id="mp-adjustments" icon={Scale} title="Penalidades e méritos" testId="my-adjustments"
      hint="Penalidade tira pontos da sua nota; mérito soma. Os pontos entram na conta antes da divisão pelos eventos."
      action={list.length > 0 ? (
        <p className="flex flex-wrap items-center gap-1.5" aria-label="Totais do ciclo">
          {mer > 0 && <Chip tone="ok" icon={Award}>+{mer} méritos</Chip>}
          {pen > 0 && <Chip tone="danger" icon={MinusCircle}>−{pen} penalidades</Chip>}
          <Chip title="Méritos menos penalidades">Saldo {net > 0 ? `+${net}` : net < 0 ? `−${Math.abs(net)}` : "0"} pts</Chip>
        </p>
      ) : undefined}>
      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
          <p className="text-[14px] font-semibold text-foreground">Nenhuma penalidade ou mérito neste ciclo.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Quando houver, aparece aqui com o motivo e os pontos.</p>
        </div>
      ) : (
        <ul className={cn(surfaceCls, "divide-y divide-border overflow-hidden")}>
          {list.map(adj => {
            const merit = adj.kind === "merit";
            return (
              <li key={adj.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5" data-testid={`my-adjustment-${adj.id}`}>
                <span aria-hidden className={cn("mt-0.5 w-9 h-9 shrink-0 rounded-lg flex items-center justify-center",
                  merit ? "bg-[var(--status-ok-bg)] text-[var(--status-ok-text)]" : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]")}>
                  {merit ? <Award size={17} /> : <MinusCircle size={17} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold leading-snug text-foreground break-words">
                    <span className="sr-only">{merit ? "Mérito: " : "Penalidade: "}</span>{adj.penaltyType}
                    {adj.quantity > 1 && <span className="ml-1.5 text-[13px] font-bold text-muted-foreground tabular-nums">×{adj.quantity}</span>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted-foreground">
                    <span>{merit ? "Mérito" : "Penalidade"}</span>
                    {adj.date && <span className="tabular-nums">{fmtDate(adj.date, FULL)}</span>}
                    {adj.eventName && <span className="inline-flex items-center gap-1 min-w-0"><CalendarDays size={12} aria-hidden className="shrink-0" /><span className="break-words">{adj.eventName}</span></span>}
                  </p>
                  {adj.reason && <p className="mt-1.5 text-[13px] leading-snug text-foreground/80 break-words">“{adj.reason}”</p>}
                </div>
                <span className={cn("shrink-0 font-condensed text-[22px] font-black leading-none tabular-nums whitespace-nowrap pt-1",
                  merit ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]")}>
                  {merit ? "+" : "−"}{adj.totalPoints}<span className="ml-0.5 text-[13px] font-bold">pts</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
