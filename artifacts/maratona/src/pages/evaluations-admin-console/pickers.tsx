import { useEffect, useState } from "react";
import { useUsersByArea } from "@/lib/routing-api";
import { Search, ChevronsUpDown, Check, UserPlus, AlertCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, fmtDate } from "@/lib/utils";
import { Bone, FOCUS_RING, selectCls } from "./console-ui";

/** Seletor de evento com busca (abas Critérios, Tabela e Avaliadores). */
export function EventCombobox({ events, value, onChange, label = "Evento" }: {
  events: { id: number; name: string; startDate?: string | null }[];
  value: number | null;
  onChange: (id: number) => void;
  /** Rótulo acessível do seletor. */
  label?: string;
  /** @deprecated o seletor tem um visual só. */
  accentStyle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const sorted = [...events].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const filtered = search.trim()
    ? sorted.filter(ev => ev.name.toLowerCase().includes(search.toLowerCase()))
    : sorted;
  const current = events.find(e => e.id === value);
  return (
    <Popover open={open} onOpenChange={o => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${current?.name ?? "nenhum"} — trocar`}
          data-testid="event-combobox"
          className={cn(
            "w-full sm:w-[360px] max-w-full min-h-11 lg:min-h-10 rounded-lg border border-border bg-card pl-3 pr-2.5 flex items-center gap-2 text-left transition-colors duration-150 hover:bg-secondary/60",
            FOCUS_RING,
          )}
        >
          <span className="min-w-0 flex-1 flex items-baseline gap-2">
            <span className="font-condensed truncate text-[15px] font-black uppercase leading-tight text-foreground">{current?.name ?? "Selecione um evento"}</span>
            {current?.startDate && <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">{fmtDate(current.startDate)}</span>}
          </span>
          <ChevronsUpDown size={15} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[min(380px,calc(100vw-24px))] rounded-xl border-border bg-card overflow-hidden">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search size={15} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              aria-label="Buscar evento"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar evento"
              className="w-full h-10 rounded-lg bg-secondary/60 pl-8 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">Nenhum evento com esse nome.</p>
          ) : filtered.map(ev => (
            <button
              key={ev.id}
              type="button"
              onClick={() => { onChange(ev.id); setOpen(false); setSearch(""); }}
              className={cn(
                "w-full text-left px-3 min-h-11 lg:min-h-9 py-1.5 flex items-center gap-2 transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:bg-secondary",
                ev.id === value && "bg-secondary/70",
              )}
            >
              <span className="font-condensed min-w-0 flex-1 truncate text-[14px] font-bold uppercase text-foreground">{ev.name}</span>
              {ev.startDate && <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">{fmtDate(ev.startDate)}</span>}
              <Check size={14} aria-hidden className={cn("shrink-0", ev.id === value ? "text-foreground" : "invisible")} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Picker inline de avaliadores de uma área — usado para atribuir critérios e a matriz de conformidade. */
export function InlinePicker({ areaId, excludeId, onPick, disabled }: { areaId: number; excludeId?: number | null; onPick: (userId: number, name: string) => void; disabled?: boolean }) {
  const { data: users, isLoading, isError } = useUsersByArea(areaId);
  const candidates = (users ?? []).filter(u => u.id !== excludeId);
  if (isLoading) return <div className="flex gap-1.5" aria-label="Carregando avaliadores" role="status"><Bone className="h-9 w-32 rounded-lg" /><Bone className="h-9 w-28 rounded-lg" /></div>;
  if (isError) return <p className="text-[13px] text-[var(--status-danger-text)] flex items-center gap-1.5"><AlertCircle size={14} aria-hidden /> Não foi possível carregar os avaliadores desta área.</p>;
  if (candidates.length === 0) return <p className="text-[13px] text-muted-foreground">Nenhum outro avaliador ativo nesta área — cadastre em Usuários.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidates.map(u => (
        <button
          key={u.id}
          type="button"
          disabled={disabled}
          aria-busy={disabled || undefined}
          onClick={() => onPick(u.id, u.name)}
          className={cn(
            "inline-flex items-center gap-1.5 min-h-11 lg:min-h-8 px-3 rounded-lg border border-border bg-card text-[13px] font-semibold text-foreground transition-colors duration-150 enabled:hover:bg-secondary enabled:hover:border-foreground/25 disabled:opacity-50 disabled:cursor-wait",
            FOCUS_RING,
          )}
        >
          <UserPlus size={14} aria-hidden className="text-muted-foreground" /> {u.name}
        </button>
      ))}
    </div>
  );
}

/** Ciclo por área: escolhe em nome de qual avaliador ATIVO da área o link sai
 *  (a API recusa outro papel/área com 409 AREA_MODE_OTHER_AREA). Com um
 *  avaliador só na área, já vem escolhido. */
export function AreaEvaluatorSelect({ areaId, areaName, value, onChange, id, compact }: {
  areaId: number;
  areaName: string;
  value: number | null;
  onChange: (userId: number | null, name: string | null) => void;
  id?: string;
  compact?: boolean;
}) {
  const { data: users, isLoading, isError } = useUsersByArea(areaId);
  const evaluators = (users ?? []).filter(u => (u.role ?? "").trim().toLowerCase() === "avaliador");
  const only = evaluators.length === 1 ? evaluators[0] : null;
  useEffect(() => {
    if (only && value == null) onChange(only.id, only.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [only?.id, value]);
  if (isLoading) return <Bone className={cn("w-full rounded-lg", compact ? "h-11 lg:h-9" : "h-11")} />;
  if (isError) return <p className="text-[13px] font-semibold text-[var(--status-danger-text)] flex items-center gap-1.5"><AlertCircle size={14} aria-hidden /> Não foi possível carregar os avaliadores de {areaName}.</p>;
  if (evaluators.length === 0) {
    return <p className="text-[13px] text-muted-foreground" data-testid={`area-evaluator-none-${areaId}`}>Nenhum avaliador ativo em {areaName} — cadastre um em Usuários.</p>;
  }
  return (
    <select
      id={id}
      aria-label={id ? undefined : `Avaliador de ${areaName} em nome de quem o link responde`}
      data-testid={`area-evaluator-select-${areaId}`}
      value={value ?? ""}
      onChange={e => {
        const u = evaluators.find(x => x.id === Number(e.target.value));
        onChange(u ? u.id : null, u ? u.name : null);
      }}
      className={cn(selectCls, !compact && "lg:h-11 text-[15px] lg:text-[15px] px-3.5", value == null && "text-muted-foreground")}
    >
      <option value="">Escolha o avaliador…</option>
      {evaluators.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
    </select>
  );
}
