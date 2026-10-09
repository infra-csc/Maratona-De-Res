import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { contrastingTextColor, type SortDir } from "./helpers";
import { fmtNum, faixaEdge } from "@/lib/utils";

/** Limite de faixa no padrão do app: vírgula e só as casas que existem ("90", "94,99"). */
export function fmtBound(v: number): string {
  return Number.isInteger(v) ? fmtNum(v, 0) : fmtNum(v, 2).replace(/,?0+$/, "");
}

export function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown size={12} style={{ color: "var(--muted-foreground)", opacity: 0.5 }} />;
  return dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

export function FaixaBadge({ name, minScore, maxScore, color, compact = false }: { name?: string | null; minScore?: number | null; maxScore?: number | null; color?: string | null; compact?: boolean }) {
  const hasData = name || minScore != null || maxScore != null;
  if (!hasData) return <span style={{ color: "var(--muted-foreground)" }} className="font-bold">—</span>;
  const bg = color ?? "var(--secondary)";
  const fg = color ? contrastingTextColor(color) : "var(--muted-foreground)";
  const range = minScore != null && maxScore != null
    ? `${fmtBound(minScore)}–${fmtBound(maxScore)}`
    : minScore != null ? `≥ ${fmtBound(minScore)}` : maxScore != null ? `≤ ${fmtBound(maxScore)}` : null;
  const primary = name ?? range ?? "";
  const secondary = name && range && !compact ? range : null;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color: fg, ...faixaEdge(color) }}
    >
      <span>{primary}</span>
      {/* Sem opacidade baixa: sobre o dourado o intervalo ficava ilegível. Um
          traço fino separa nome e intervalo; a cor é a mesma (contraste garantido). */}
      {secondary && <span className="text-[11px] font-bold tabular-nums pl-1 ml-0.5" style={{ borderLeft: `1px solid ${fg}` }}>{secondary}</span>}
    </span>
  );
}
