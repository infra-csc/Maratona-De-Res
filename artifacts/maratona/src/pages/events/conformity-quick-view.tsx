import { useGetEventConformity } from "@workspace/api-client-react";
import type { EventConformity } from "@workspace/api-client-react";
import { CONDENSED } from "@/lib/premium-theme";

type Item = {
  label: string;
  get: (data: EventConformity) => boolean | null | undefined;
  report?: (data: EventConformity) => string | null | undefined;
};

const groups: { label: string; items: Item[] }[] = [
  {
    label: "Cenografia",
    items: [
      { label: "Uso de EPI", get: d => d.epi },
      { label: "Estaiamentos / Aterramentos", get: d => d.estaiamentos },
      { label: "Conduta", get: d => d.conduta },
      { label: "Ausências / Registro", get: d => d.absencesResponse, report: d => d.absencesReport },
    ],
  },
  {
    label: "Ferramentas e Case",
    items: [{ label: "Guarda de Equipamentos", get: d => d.guardaEquipamentos }],
  },
];

function Status({ value, report }: { value: boolean | null | undefined; report?: string | null }) {
  if (value == null && report) {
    return <span className="text-[10px] font-bold max-w-[180px] truncate text-right" style={{ color: "var(--muted-foreground)" }}>{report}</span>;
  }
  const label = value === true ? "SIM" : value === false ? "NÃO" : report === undefined ? "PENDENTE" : "Sem registro";
  const color = value === true ? "#4a7c00" : value === false ? "#e5484d" : "#c97800";
  return <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full" style={{ color }}>{label}</span>;
}

export function ConformityQuickView({ eventId }: { eventId: number }) {
  const { data, isLoading, isError } = useGetEventConformity(eventId, {
    query: { enabled: !!eventId, queryKey: ["event-conformity-popup", eventId] as unknown[] },
  });

  if (isLoading) return <p className="py-10 text-center text-xs font-bold uppercase">Carregando…</p>;
  if (isError) return <p role="alert" className="py-8 text-center text-sm">Não foi possível carregar a matriz.</p>;
  const items = groups.flatMap(g => g.items);
  const filled = data ? items.filter(item => item.get(data) != null).length : 0;
  const allSim = !!data && items.every(item => item.get(data) === true);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: allSim ? "#9ab000" : filled > 0 ? "#e8a23d" : "var(--border)" }} />
        <span className="text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
          {filled}/{items.length} {filled === items.length ? "completo" : "preenchido(s)"}
        </span>
      </div>
      {!data ? (
        <p className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Matriz não preenchida</p>
      ) : groups.map(group => (
        <div key={group.label} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: "var(--secondary)", fontFamily: CONDENSED }}>
            {group.label}
          </div>
          {group.items.map(item => (
            <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-sm font-bold uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>{item.label}</span>
              <Status value={item.get(data)} report={item.report?.(data)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}