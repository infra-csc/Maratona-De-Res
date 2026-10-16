import { useRef, useState, type ReactNode } from "react";
import { useSetAreaConformityRouting, getGetConformityRoutingQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Check, ChevronDown, Loader2, Search, UserCheck, Users } from "lucide-react";
import { useSaveCriterionRouting } from "@/lib/routing-api";
import type { CriterionRouting } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { Eyebrow, FOCUS_RING } from "./criteria-ui";
import { serverMessage } from "./helpers";
import type { EvaluatorOption } from "./types";

/** Texto do gatilho: nome, "qualquer avaliador da área" (ciclo por área) ou o alerta "sem avaliador". */
function TriggerLabel({ name, areaMode, testId }: { name: string | null; areaMode: boolean; testId?: string }) {
  if (name) {
    return (
      <span className="flex items-center gap-1.5 min-w-0 text-[14px] font-semibold text-foreground">
        <UserCheck size={14} aria-hidden className="shrink-0 text-[var(--accent-text)]" />
        <span className="truncate">{name}</span>
      </span>
    );
  }
  if (areaMode) {
    return (
      <span data-testid={testId} className="flex items-start gap-1.5 min-w-0 text-[13.5px] text-muted-foreground">
        <Users size={14} aria-hidden className="shrink-0 mt-0.5" />
        <span className="leading-snug">Qualquer avaliador da área</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--status-danger-text)]">
      <AlertCircle size={14} aria-hidden className="shrink-0" /> Sem avaliador
    </span>
  );
}

/** Popover de escolha: título, busca e a lista (selecionado com ✓). */
function PickerPanel({ title, hint, evaluators, currentId, pending, onPick }: {
  title: string;
  hint?: ReactNode;
  evaluators: EvaluatorOption[];
  currentId: number | null;
  pending: boolean;
  onPick: (id: number) => void;
}) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const filtered = evaluators.filter(u => u.name.toLowerCase().includes(q));
  return (
    <>
      <div className="p-3 space-y-2 border-b border-border">
        <Eyebrow>{title}</Eyebrow>
        {hint && <p className="text-[12.5px] leading-snug text-muted-foreground">{hint}</p>}
        <div className="relative">
          <Search size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input type="search" autoFocus value={search} onChange={e => setSearch(e.target.value)} aria-label="Buscar avaliador por nome" placeholder="Buscar por nome"
            className="w-full h-11 lg:h-9 rounded-lg border border-border bg-card pl-8 pr-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/40 focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:hidden" />
        </div>
      </div>
      <div role="listbox" aria-label={title} className="max-h-60 overflow-y-auto p-1">
        {filtered.length === 0 && (
          <p className="px-3 py-5 text-center text-[13px] text-muted-foreground">{evaluators.length === 0 ? "Nenhum avaliador ativo nesta área." : <>Ninguém com “{search.trim()}”.</>}</p>
        )}
        {filtered.map(u => {
          const on = u.id === currentId;
          return (
            <button key={u.id} type="button" role="option" aria-selected={on} disabled={pending} onClick={() => onPick(u.id)}
              className={cn("w-full flex items-center gap-2 min-h-11 lg:min-h-9 px-2.5 rounded-md text-left text-[14px] transition-colors duration-150 hover:bg-secondary disabled:opacity-60", on ? "font-semibold text-foreground bg-secondary/70" : "text-foreground", FOCUS_RING, "focus-visible:ring-offset-0")}>
              <span className="w-4 shrink-0">{on && <Check size={14} aria-hidden className="text-[var(--accent-text)]" />}</span>
              <span className="truncate">{u.name}</span>
            </button>
          );
        })}
      </div>
      {pending && (
        <div role="status" className="flex items-center justify-center gap-2 px-3 py-2 border-t border-border text-[12.5px] font-semibold text-muted-foreground">
          <Loader2 size={13} aria-hidden className="motion-safe:animate-spin" /> Salvando…
        </div>
      )}
    </>
  );
}

const popoverCls = "font-body w-[min(300px,calc(100vw-24px))] p-0 rounded-xl border-border bg-popover text-popover-foreground shadow-lg";
const triggerCls = cn("group/p -mx-2 -my-1 px-2 py-1 min-h-11 lg:min-h-9 max-w-full rounded-lg inline-flex items-center gap-1.5 text-left transition-colors duration-150 hover:bg-secondary data-[state=open]:bg-secondary", FOCUS_RING);

/** Avaliador padrão do critério, trocado direto na linha (mantém o resto do roteamento). */
export function EvaluatorPickerCell({
  criterionId, criterionName, currentRouting, evaluators, onSaved, areaMode, canEdit,
}: {
  criterionId: number;
  criterionName: string;
  currentRouting: CriterionRouting | undefined;
  evaluators: EvaluatorOption[];
  onSaved: () => void;
  /** Ciclo atual por área: sem avaliador padrão é o normal, não um alerta. */
  areaMode: boolean;
  canEdit: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const saveMutation = useSaveCriterionRouting(criterionId);
  const current = currentRouting?.defaultEvaluatorName ?? null;

  const handleSelect = (userId: number) => {
    // PUT substitui o roteamento inteiro: reenvia tudo o que já estava gravado.
    saveMutation.mutate({
      defaultEvaluatorId: userId,
      conformityEvaluatorId: currentRouting?.conformityEvaluatorId ?? null,
      commentRequired: currentRouting?.commentRequired ?? true,
      redirectMode: currentRouting?.redirectMode ?? "none",
      redirectAreaId: currentRouting?.redirectAreaId ?? null,
      redirectUserIds: currentRouting?.redirectUsers?.map(u => u.id) ?? [],
      allowPublicLink: currentRouting?.allowPublicLink ?? false,
    }, {
      onSuccess: () => {
        setOpen(false);
        onSaved();
        toast({ title: "Avaliador padrão salvo", description: evaluators.find(u => u.id === userId)?.name });
      },
      onError: (e: unknown) => toast({ title: "Não foi possível salvar o avaliador", description: serverMessage(e), variant: "destructive" }),
    });
  };

  const label = <TriggerLabel name={current} areaMode={areaMode} testId={`criterion-area-mode-any-${criterionId}`} />;
  if (!canEdit) return <div className="min-h-9 flex items-center">{label}</div>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={triggerRef} type="button" data-testid={`button-evaluator-picker-${criterionId}`} className={triggerCls}
          aria-label={`Avaliador padrão de ${criterionName}: ${current ?? (areaMode ? "qualquer avaliador da área" : "sem avaliador")}. Trocar`}>
          {label}
          <ChevronDown size={13} aria-hidden className="shrink-0 text-muted-foreground opacity-60 group-hover/p:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={popoverCls} align="start" sideOffset={6} onClick={e => e.stopPropagation()}
        onCloseAutoFocus={e => { e.preventDefault(); triggerRef.current?.focus(); }}>
        <PickerPanel
          title="Avaliador padrão"
          hint={areaMode ? "Neste ciclo qualquer avaliador da área responde. O padrão vale nos ciclos com designação." : "Vem marcado ao liberar as avaliações de um evento."}
          evaluators={evaluators}
          currentId={currentRouting?.defaultEvaluatorId ?? null}
          pending={saveMutation.isPending}
          onPick={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}

/** Avaliador padrão de uma área da matriz de conformidade (Cenografia / Ferramentas e Case). */
export function ConformityAreaEvaluatorPicker({
  areaId, areaName, currentEvaluatorId, currentEvaluatorName, evaluators, areaMode, canEdit,
}: {
  areaId: number;
  areaName: string;
  currentEvaluatorId: number | null;
  currentEvaluatorName: string | null;
  evaluators: EvaluatorOption[];
  areaMode: boolean;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const saveMutation = useSetAreaConformityRouting({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetConformityRoutingQueryKey() });
        setOpen(false);
        toast({ title: "Avaliador padrão da matriz salvo", description: areaName });
      },
      onError: (e: unknown) => toast({ title: "Não foi possível salvar", description: serverMessage(e), variant: "destructive" }),
    },
  });

  const label = <TriggerLabel name={currentEvaluatorName} areaMode={areaMode} testId={`conformity-area-mode-any-${areaId}`} />;
  if (!canEdit) return <div className="min-h-9 flex items-center">{label}</div>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button ref={triggerRef} type="button" data-testid={`button-conformity-picker-${areaId}`} className={triggerCls}
          aria-label={`Avaliador padrão da matriz de ${areaName}: ${currentEvaluatorName ?? (areaMode ? "qualquer avaliador da área" : "sem avaliador")}. Trocar`}>
          {label}
          <ChevronDown size={13} aria-hidden className="shrink-0 text-muted-foreground opacity-60 group-hover/p:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className={popoverCls} align="end" sideOffset={6} onClick={e => e.stopPropagation()}
        onCloseAutoFocus={e => { e.preventDefault(); triggerRef.current?.focus(); }}>
        <PickerPanel
          title={`Matriz · ${areaName}`}
          hint={areaMode ? "Neste ciclo a matriz é respondida no formulário da área. O padrão vale nos ciclos com designação." : "Vem preenchido na matriz ao liberar as avaliações de um evento."}
          evaluators={evaluators}
          currentId={currentEvaluatorId}
          pending={saveMutation.isPending}
          onPick={id => saveMutation.mutate({ id: areaId, data: { defaultEvaluatorId: id } })}
        />
      </PopoverContent>
    </Popover>
  );
}
