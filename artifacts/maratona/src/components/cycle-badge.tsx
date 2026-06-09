import { useGetCurrentCycle } from "@workspace/api-client-react";
import { CalendarRange } from "lucide-react";

// Formata "YYYY-MM-DD" -> "DD/MM/YYYY" sem usar new Date() para evitar
// deslocamento de fuso horário (datas de ciclo são dias civis, não instantes).
function formatCycleDate(value?: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatCyclePeriod(startDate?: string | null, endDate?: string | null): string | null {
  const start = formatCycleDate(startDate);
  const end = formatCycleDate(endDate);
  if (start && end) return `${start} – ${end}`;
  if (start) return `A partir de ${start}`;
  if (end) return `Até ${end}`;
  return null;
}

interface CycleBadgeProps {
  className?: string;
  showName?: boolean;
}

// Selo reutilizável que mostra o ciclo atual e o período (datas) que ele
// está considerando. Usar em qualquer tela que exibe informação do ciclo.
export function CycleBadge({ className = "", showName = true }: CycleBadgeProps) {
  const { data: cycle } = useGetCurrentCycle();
  if (!cycle) return null;

  const period = formatCyclePeriod(cycle.startDate, cycle.endDate);

  return (
    <div
      data-testid="badge-cycle-period"
      className={`inline-flex items-center gap-2 border-2 border-[#191c1e] bg-white px-3 py-2 ${className}`}
    >
      <CalendarRange size={16} className="shrink-0 text-[#191c1e]" />
      <span className="flex flex-col leading-tight">
        {showName && (
          <span className="font-black italic uppercase text-xs tracking-wider text-[#191c1e]">{cycle.name}</span>
        )}
        <span className="text-[11px] font-bold italic uppercase tracking-wide text-[#444933]">
          {period ?? "Período não definido"}
        </span>
      </span>
    </div>
  );
}
