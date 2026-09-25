import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { contrastingTextColor, type SortDir } from "./helpers";

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
    ? `${minScore}–${maxScore}`
    : minScore != null ? `≥ ${minScore}` : maxScore != null ? `≤ ${maxScore}` : null;
  const primary = name ?? range ?? "";
  const secondary = name && range && !compact ? range : null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span>{primary}</span>
      {secondary && <span className="opacity-55 text-[11px] font-bold">{secondary}</span>}
    </span>
  );
}
