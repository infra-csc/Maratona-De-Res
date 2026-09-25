import { useState } from "react";
import { useSetAreaConformityRouting, getGetConformityRoutingQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Check, UserCheck, AlertCircle } from "lucide-react";
import { useSaveCriterionRouting } from "@/lib/routing-api";
import type { CriterionRouting } from "@/lib/routing-api";
import { DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";
import type { EvaluatorOption } from "./types";

/** Avaliador padrão do critério, trocado direto na linha da tabela (mantém o resto do roteamento). */
export function EvaluatorPickerCell({
  criterionId, currentRouting, evaluators, onSaved,
}: {
  criterionId: number;
  currentRouting: CriterionRouting | undefined;
  evaluators: EvaluatorOption[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const saveMutation = useSaveCriterionRouting(criterionId);

  const handleSelect = (userId: number | null) => {
    saveMutation.mutate({
      defaultEvaluatorId: userId,
      commentRequired: currentRouting?.commentRequired ?? true,
      redirectMode: currentRouting?.redirectMode ?? "none",
      redirectAreaId: currentRouting?.redirectAreaId ?? null,
      redirectUserIds: currentRouting?.redirectUsers?.map(u => u.id) ?? [],
    }, {
      onSuccess: () => { setOpen(false); setSearch(""); onSaved(); },
    });
  };

  const filtered = evaluators.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const current = currentRouting?.defaultEvaluatorName ?? null;

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 text-left" title="Clique para definir o avaliador padrão">
          {current ? (
            <span className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:opacity-80">
              <UserCheck size={13} className="shrink-0" style={{ color: "var(--accent-text)" }} />
              {current}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ color: DANGER_TEXT }}>
              <AlertCircle size={12} /> Sem avaliador
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-xl" align="start" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[11px] font-black uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>Avaliador Padrão</p>
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs rounded-lg" style={fieldStyle} autoFocus />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-xs py-4" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado para "{search}"</p>
          )}
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u.id)}
              disabled={saveMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors hover:opacity-90"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: u.id === currentRouting?.defaultEvaluatorId ? "rgba(154,176,0,0.10)" : "transparent", color: u.id === currentRouting?.defaultEvaluatorId ? "var(--accent)" : "var(--foreground)" }}
            >
              {u.id === currentRouting?.defaultEvaluatorId && <Check size={11} className="shrink-0" style={{ color: "var(--accent-text)" }} />}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {saveMutation.isPending && (
          <div className="p-2 text-center text-[11px] font-bold" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Salvando...</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Avaliador padrão de uma área da matriz de conformidade (Cenografia / Ferramentas e Case). */
export function ConformityAreaEvaluatorPicker({
  areaId, currentEvaluatorId, currentEvaluatorName, evaluators,
}: {
  areaId: number;
  currentEvaluatorId: number | null;
  currentEvaluatorName: string | null;
  evaluators: EvaluatorOption[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const saveMutation = useSetAreaConformityRouting({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetConformityRoutingQueryKey() });
        setOpen(false);
        setSearch("");
        toast({ title: "Avaliador padrão da matriz salvo" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const handleSelect = (userId: number | null) => {
    saveMutation.mutate({ id: areaId, data: { defaultEvaluatorId: userId } });
  };

  const filtered = evaluators.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 text-left" title="Clique para definir o avaliador padrão da matriz">
          {currentEvaluatorName ? (
            <span className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:opacity-80">
              <UserCheck size={13} className="shrink-0" style={{ color: "var(--accent-text)" }} />
              {currentEvaluatorName}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ color: DANGER_TEXT }}>
              <AlertCircle size={12} /> Sem avaliador
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-xl" align="start" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[11px] font-black uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>Avaliador Padrão da Matriz</p>
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs rounded-lg" style={fieldStyle} autoFocus />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-xs py-4" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado para "{search}"</p>
          )}
          {filtered.map((u, i) => (
            <button key={u.id} type="button" onClick={() => handleSelect(u.id)} disabled={saveMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors hover:opacity-90"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: u.id === currentEvaluatorId ? "rgba(154,176,0,0.10)" : "transparent", color: u.id === currentEvaluatorId ? "var(--accent)" : "var(--foreground)" }}
            >
              {u.id === currentEvaluatorId && <Check size={11} className="shrink-0" style={{ color: "var(--accent-text)" }} />}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {saveMutation.isPending && (
          <div className="p-2 text-center text-[11px] font-bold" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Salvando...</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
