import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCycles, useSetCurrentCycle, getListCyclesQueryKey, type CycleSummary,
} from "@workspace/api-client-react";
import { CalendarPlus, CalendarRange, Eye, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasRole } from "@/lib/auth-context";
import { apiErrorMessage, cn } from "@/lib/utils";
import { Bone, Chip, EmptyBlock, ErrorBlock, addDay, btnPrimary, surfaceCls } from "./cycles/cycles-ui";
import { CurrentCycle } from "./cycles/current-cycle";
import { CyclesList } from "./cycles/cycles-list";
import { CycleFormDialog } from "./cycles/cycle-form-dialog";
import { MakeCurrentDialog } from "./cycles/make-current-dialog";

/** Topo fixo (o único h1), como em Eventos, Resultados e Dashboard. */
function CyclesHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
      <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Ciclos</h1>
      <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Cada ciclo guarda seus eventos, notas, ranking e bônus.</p>
      {children && <div className="ml-auto flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

function CyclesSkeleton() {
  return (
    <div role="status" aria-label="Carregando ciclos" className="space-y-4">
      <div className={cn(surfaceCls, "p-4 lg:p-6 space-y-5")}>
        <Bone className="h-4 w-40" />
        <Bone className="h-9 w-72 max-w-full" />
        <Bone className="h-2 w-full max-w-[720px]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><Bone className="h-3 w-24" /><Bone className="h-4 w-32" /></div>)}</div>
      </div>
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-5 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 5 }, (_, i) => <div key={i} className={cn("bg-card px-5 py-4 space-y-3", i === 0 && "col-span-2 lg:col-span-1")}><Bone className="h-3 w-24" /><Bone className="h-8 w-20" /><Bone className="h-3 w-28" /></div>)}
      </div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center gap-6 px-5 py-4"><Bone className="h-5 w-40" /><Bone className="h-4 w-28 hidden sm:block" /><Bone className="h-4 w-44 hidden lg:block" /><Bone className="h-5 w-16 ml-auto" /></div>)}
      </div>
    </div>
  );
}

export default function CyclesPage() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, refetch, isRefetching } = useListCycles({ query: { queryKey: getListCyclesQueryKey(), staleTime: 30_000 } });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CycleSummary | null>(null);
  const [makeCurrent, setMakeCurrent] = useState<CycleSummary | null>(null);

  const setCurrent = useSetCurrentCycle({
    mutation: {
      onSuccess: c => { void qc.invalidateQueries(); toast({ title: `"${c.name}" agora é o ciclo atual` }); setMakeCurrent(null); },
      onError: e => toast({ title: "Não foi possível trocar o ciclo atual", description: apiErrorMessage(e, "Tente novamente."), variant: "destructive" }),
    },
  });

  const cycles = data ?? [];
  const current = cycles.find(c => c.isCurrent) ?? null;
  const latestEnd = cycles.map(c => c.endDate).filter((d): d is string => !!d).sort().at(-1);
  const suggestedStart = latestEnd ? addDay(latestEnd) : undefined;
  // Ciclo atual aberto com eventos: o servidor recusa o ciclo novo até ele
  // ser fechado — o botão já nasce desligado, com o motivo no ciclo atual.
  const currentNeedsClose = !!current && current.status !== "closed" && current.stats.eventsTotal > 0;
  // De onde os eventos vêm ao criar (o servidor usa o atual ou, sem atual, o mais novo).
  const previous = current ?? [...cycles].sort((a, b) => b.id - a.id)[0] ?? null;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <CyclesHeader>
        {isAdmin && data && (
          <button type="button" onClick={() => setCreating(true)} disabled={currentNeedsClose}
            aria-describedby={currentNeedsClose ? "new-cycle-blocked" : undefined}
            title={currentNeedsClose ? "Feche o ciclo atual antes, em Resultados & Ranking" : "Criar o próximo ciclo (ele vira o atual)"}
            data-testid="button-new-cycle" className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
            {currentNeedsClose ? <Lock size={15} aria-hidden /> : <CalendarPlus size={15} aria-hidden />} Novo ciclo
          </button>
        )}
        {!isAdmin && data && <Chip icon={Eye} title="Só administradores criam e editam ciclos">Só consulta</Chip>}
      </CyclesHeader>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {isLoading ? <CyclesSkeleton /> : isError || !data ? (
          <ErrorBlock title="Não foi possível carregar os ciclos" onRetry={() => { void refetch(); }} />
        ) : cycles.length === 0 ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={CalendarRange} title="Nenhum ciclo cadastrado" testId="cycles-empty"
              action={isAdmin ? <button type="button" onClick={() => setCreating(true)} className={btnPrimary}><CalendarPlus size={15} aria-hidden /> Criar o primeiro ciclo</button> : undefined}>
              {isAdmin ? "Crie o primeiro ciclo para poder cadastrar eventos e avaliações." : "Peça a um administrador para criar o primeiro ciclo."}
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", isRefetching && "opacity-80")}>
            {current && (
              <CurrentCycle cycle={current} isAdmin={isAdmin} needsClose={currentNeedsClose} suggestedStart={suggestedStart}
                onEdit={() => setEditing(current)} onCreate={() => setCreating(true)} />
            )}
            <CyclesList cycles={cycles} isAdmin={isAdmin} onEdit={setEditing} onMakeCurrent={setMakeCurrent} />
          </div>
        )}
      </div>

      {creating && (
        <CycleFormDialog mode="create" suggestedStart={suggestedStart} previous={previous} others={cycles}
          open onOpenChange={v => { if (!v) setCreating(false); }} />
      )}
      {editing && (
        <CycleFormDialog key={editing.id} mode="edit" cycle={editing} others={cycles.filter(c => c.id !== editing.id)}
          open onOpenChange={v => { if (!v) setEditing(null); }} />
      )}
      <MakeCurrentDialog target={makeCurrent} current={current} pending={setCurrent.isPending}
        onOpenChange={v => { if (!v) setMakeCurrent(null); }}
        onConfirm={() => { if (makeCurrent) setCurrent.mutate({ id: makeCurrent.id }); }} />
    </div>
  );
}
