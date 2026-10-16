// Cabeçalho de cada dia: fica preso no alto enquanto o dia rola (abaixo do
// topo fixo no tablet/desktop), com o resumo do dia em números.
import { cn } from "@/lib/utils";
import { DOWN_TEXT, UP_TEXT } from "./tl-ui";
import { dayTitle, type DayGroup } from "./describe";

export function DayHeader({ d }: { d: DayGroup }) {
  const bits: string[] = [];
  if (d.entered > 0) bits.push(`${d.entered} ${d.entered === 1 ? "entrou" : "entraram"} na nota`);
  if (d.left > 0) bits.push(`${d.left} ${d.left === 1 ? "saiu" : "saíram"} do ciclo`);
  if (d.faixas > 0) bits.push(`${d.faixas} ${d.faixas === 1 ? "mudança" : "mudanças"} de faixa`);
  return (
    <div className="sticky top-0 md:top-16 z-[5] -mx-4 md:-mx-6 px-4 md:px-6 py-2.5 mb-3 bg-background/95 backdrop-blur-sm border-b border-border/70">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`tl-day-${d.key}`} className="font-condensed text-[17px] font-black uppercase tracking-[0.02em] leading-tight text-foreground">{dayTitle(d.key)}</h2>
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[12.5px] tabular-nums text-muted-foreground">
          {d.people > 0
            ? <span><strong className="font-semibold text-foreground">{d.people.toLocaleString("pt-BR")}</strong> {d.people === 1 ? "colaborador com mudança" : "colaboradores com mudança"}</span>
            : <span>sem mudança de nota</span>}
          {d.ups > 0 && <strong className={cn("font-bold", UP_TEXT)} title={`${d.ups} subiram`}><span aria-hidden>▲ </span>{d.ups}<span className="sr-only"> subiram</span></strong>}
          {d.downs > 0 && <strong className={cn("font-bold", DOWN_TEXT)} title={`${d.downs} caíram`}><span aria-hidden>▼ </span>{d.downs}<span className="sr-only"> caíram</span></strong>}
          {bits.map(b => <span key={b}>· {b}</span>)}
        </p>
      </div>
    </div>
  );
}
