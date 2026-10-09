// Peças de gráfico do Painel de gestão (Análises). Regras de dataviz: uma
// série = uma cor (--viz-series-1, validada nos dois temas), marcas finas com
// ponta arredondada, rótulo de valor em tinta de texto (nunca na cor da
// série), dica ao passar o mouse/focar e sempre uma tabela alternativa.
import { useState, type ReactNode } from "react";
import { cn, faixaEdge } from "@/lib/utils";
import { Segmented } from "../calibrations/cal-ui";
import { SERIES, VizTooltipBox } from "../analytics-person/ui";

export type View = "grafico" | "tabela";

/** Alternância Gráfico | Tabela (aria-pressed), igual à do Dashboard. */
export function ViewToggle({ value, onChange, label, testId }: { value: View; onChange: (v: View) => void; label: string; testId?: string }) {
  return (
    <Segmented<View> size="sm" label={label} value={value} onChange={onChange}
      options={[
        { value: "grafico", label: "Gráfico", testId: testId ? `${testId}-chart` : undefined },
        { value: "tabela", label: "Tabela", testId: testId ? `${testId}-table` : undefined },
      ]} />
  );
}

export function useView(initial: View = "grafico") {
  return useState<View>(initial);
}

export interface BarRow {
  key: string;
  label: ReactNode;
  /** Texto do nome para o leitor de tela e a dica. */
  name: string;
  /** Linha de apoio sob o nome (área, faixa de notas…). */
  sub?: ReactNode;
  /** Valor da barra; null = sem dado (sem barra, "—"). */
  value: number | null;
  /** Valor como aparece na ponta. */
  display: string;
  /** Linhas da dica (hover/foco). */
  tip: { label: string; value: ReactNode }[];
  /** Cor de identidade (faixa do cadastro), com contorno quando clara. */
  swatch?: string | null;
  /** Cor da barra (padrão: série 1). */
  fill?: string;
  testId?: string;
}

/**
 * Barras horizontais em HTML: o nome inteiro (quebra a linha em vez de cortar),
 * a barra e o valor na ponta, numa grade alinhada. `reference` desenha um traço
 * vertical (ex.: média dos eventos) em todas as linhas — a legenda fica no bloco.
 */
export function BarList({ rows, max = 100, reference, ariaLabel, testId, dense }: {
  rows: BarRow[]; max?: number; reference?: number | null; ariaLabel: string; testId?: string; dense?: boolean;
}) {
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(1e-9, max)) * 100))}%`;
  return (
    <ul aria-label={ariaLabel} data-testid={testId} className="px-2 lg:px-3 pb-3">
      {rows.map(r => (
        <li key={r.key} data-testid={r.testId}
          tabIndex={0}
          aria-label={`${r.name}: ${r.value == null ? "sem dado" : r.display}`}
          className={cn(
            "group relative grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(150px,34%)_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-1.5 rounded-lg px-2 lg:px-2.5",
            dense ? "py-1.5" : "py-2",
            "transition-colors duration-150 hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          )}>
          <span className="min-w-0 flex items-start gap-2">
            {r.swatch !== undefined && (
              <span aria-hidden className="mt-[3px] h-3 w-3 rounded-[3px] shrink-0" style={{ backgroundColor: r.swatch ?? "var(--muted-foreground)", ...faixaEdge(r.swatch) }} />
            )}
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-snug text-foreground break-words">{r.label}</span>
              {r.sub && <span className="block text-[12px] leading-snug text-muted-foreground">{r.sub}</span>}
            </span>
          </span>
          <span className="sm:order-3 text-right font-condensed text-[17px] font-black leading-none tabular-nums text-foreground whitespace-nowrap">{r.value == null ? <span className="text-muted-foreground font-bold">—</span> : r.display}</span>
          <span aria-hidden className="col-span-2 sm:col-span-1 sm:order-2 relative h-2.5 rounded-full bg-secondary">
            {r.value != null && r.value > 0 && (
              <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 motion-reduce:transition-none" style={{ width: pct(r.value), backgroundColor: r.fill ?? SERIES }} />
            )}
            {reference != null && (
              <span className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-foreground/70" style={{ left: `calc(${pct(reference)} - 1px)` }} />
            )}
          </span>
          {/* Dica: aparece no hover e no foco do teclado, por cima da linha. */}
          <span role="presentation" className="pointer-events-none absolute right-2 bottom-[calc(100%-6px)] z-20 hidden group-hover:block group-focus-visible:block">
            <VizTooltipBox title={r.name} lines={r.tip} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Legenda curta do traço de referência ("│ Média dos eventos 82,3"). */
export function ReferenceKey({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] text-muted-foreground">
      <span aria-hidden className="inline-block h-3.5 w-[2px] rounded-full bg-foreground/70" />
      {label} <b className="font-semibold tabular-nums text-foreground">{value}</b>
    </span>
  );
}

type SortCell = string | number | null | undefined;

/**
 * Tabela das Análises. Com `sort` (valores crus de cada célula, na ordem das
 * linhas), o cabeçalho vira botão: 1º clique ordena (texto A→Z, número do
 * maior para o menor), 2º inverte. Vazio fica sempre no fim.
 */
export function DataTable({ head, rows, sort, caption, testId, minWidth, align }: {
  head: string[]; rows: ReactNode[][]; sort?: SortCell[][]; caption: string; testId?: string; minWidth?: number;
  /** Alinhamento por coluna (padrão: 1ª à esquerda, demais à direita). */
  align?: ("l" | "r")[];
}) {
  const [by, setBy] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const order = rows.map((_, i) => i);
  if (sort && by) {
    order.sort((x, y) => {
      const a = sort[x][by.col], b = sort[y][by.col];
      if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
      const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR", { numeric: true });
      return c * by.dir;
    });
  }
  const toggle = (col: number) => {
    const numeric = typeof sort?.find(r => r[col] != null)?.[col] === "number";
    setBy(prev => (prev?.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: numeric ? -1 : 1 }));
  };
  const left = (i: number) => (align?.[i] ?? (i === 0 ? "l" : "r")) === "l";
  return (
    <div className="overflow-x-auto px-4 lg:px-5 pb-3" data-testid={testId}>
      <table className="w-full text-[13.5px]" style={minWidth ? { minWidth } : undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            {head.map((h, i) => {
              const active = by?.col === i;
              const ariaSort = active ? (by!.dir === 1 ? "ascending" : "descending") : sort ? "none" : undefined;
              return (
                <th key={h} scope="col" aria-sort={ariaSort}
                  className={cn("py-2 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] whitespace-nowrap", i === 0 ? "pr-3" : "pl-3", left(i) ? "text-left" : "text-right", active ? "text-foreground" : "text-muted-foreground")}>
                  {sort ? (
                    <button type="button" onClick={() => toggle(i)}
                      className={cn("inline-flex items-center gap-1 min-h-8 uppercase tracking-[0.08em] font-bold rounded hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", !left(i) && "flex-row-reverse")}>
                      {h}
                      <span aria-hidden className="text-[10px] opacity-70">{active ? (by!.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {order.map(ri => (
            <tr key={ri} className="transition-colors duration-150 hover:bg-secondary/40">
              {rows[ri].map((c, ci) => (
                <td key={ci} className={cn("py-2.5 align-middle", ci === 0 ? "pr-3" : "pl-3", left(ci) ? "text-left" : "text-right tabular-nums")}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
