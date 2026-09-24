import { useState } from "react";
import { useUsersByArea } from "@/lib/routing-api";
import { Search, ChevronDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Seletor de evento com busca (abas Critérios, Tabela e Avaliadores). */
export function EventCombobox({ events, value, onChange, accentStyle }: {
  events: { id: number; name: string }[];
  value: number | null;
  onChange: (id: number) => void;
  accentStyle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sorted = [...events].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const filtered = search.trim()
    ? sorted.filter(ev => ev.name.toLowerCase().includes(search.toLowerCase()))
    : sorted;
  const selectedName = events.find(e => e.id === value)?.name;
  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase truncate max-w-xs transition-opacity hover:opacity-80"
          style={{
            border: accentStyle ? "1px solid var(--accent)" : "1px solid var(--border)",
            color: accentStyle ? "var(--accent)" : "var(--foreground)",
            backgroundColor: "transparent",
            height: accentStyle ? "24px" : "28px",
            minWidth: accentStyle ? "180px" : "200px",
          }}
        >
          <span className="truncate flex-1 text-left">{selectedName ?? "Selecione um evento"}</span>
          <ChevronDown size={11} className="shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-80" style={{ maxHeight: "340px", display: "flex", flexDirection: "column" }}>
        <div className="px-2.5 pt-2.5 pb-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
            <Search size={11} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar evento..."
              className="flex-1 bg-transparent text-[11px] font-bold uppercase outline-none placeholder:normal-case placeholder:font-normal"
              style={{ color: "var(--foreground)" }}
            />
          </div>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "280px" }}>
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px]" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado.</p>
          ) : filtered.map(ev => (
            <button
              key={ev.id}
              type="button"
              onClick={() => { onChange(ev.id); setOpen(false); setSearch(""); }}
              className="w-full text-left px-3 py-2 text-[11px] font-bold uppercase transition-colors hover:opacity-80 flex items-center justify-between gap-2"
              style={{ backgroundColor: ev.id === value ? "var(--secondary)" : "transparent", color: "var(--foreground)" }}
            >
              <span className="truncate">{ev.name}</span>
              {ev.id === value && <Check size={12} className="shrink-0" style={{ color: "var(--primary)" }} />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Picker inline de avaliadores de uma área — usado para atribuir critérios e a matriz de conformidade. */
export function InlinePicker({ areaId, excludeId, onPick, disabled }: { areaId: number; excludeId?: number | null; onPick: (userId: number, name: string) => void; disabled?: boolean }) {
  const { data: users, isLoading } = useUsersByArea(areaId);
  const candidates = (users ?? []).filter(u => u.id !== excludeId);
  if (isLoading) return <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Carregando avaliadores...</p>;
  if (candidates.length === 0) return <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Nenhum avaliador ativo nesta área.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidates.map(u => (
        <button
          key={u.id}
          type="button"
          disabled={disabled}
          aria-busy={disabled || undefined}
          onClick={() => onPick(u.id, u.name)}
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-wait"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
        >
          + {u.name}
        </button>
      ))}
    </div>
  );
}
