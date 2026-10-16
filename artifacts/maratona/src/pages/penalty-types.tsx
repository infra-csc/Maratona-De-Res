// Tela "Tipos de lançamento": o cadastro das penalidades e dos méritos que
// aparecem no formulário de Penalidades e méritos. Peças em ./penalty-types/
// (colunas, diálogos e o hook do formulário/mutações).
import { useMemo } from "react";
import { Link } from "wouter";
import { useGetPenaltyTypes, useGetAbsences, getGetPenaltyTypesQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Info, Loader2, Plus, RefreshCw, Tags } from "lucide-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Bone, EmptyBlock, ErrorBlock, Notice, btnGhost, btnPrimary, btnSecondary, surfaceCls } from "./absences/absences-ui";
import { useTypeForm } from "./penalty-types/use-type-form";
import { TypeColumn } from "./penalty-types/type-list";
import { DeleteTypeDialog, TypeFormDialog } from "./penalty-types/type-dialogs";

function TypesSkeleton() {
  return (
    <div role="status" aria-label="Carregando tipos" className="grid lg:grid-cols-2 gap-5">
      {[0, 1].map(c => (
        <div key={c} className={cn(surfaceCls, "divide-y divide-border")}>
          <div className="px-5 py-4 flex items-center gap-3"><Bone className="h-8 w-8 rounded-lg" /><div className="space-y-2"><Bone className="h-4 w-28" /><Bone className="h-3 w-40" /></div></div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="px-5 py-4 flex items-center gap-4"><div className="flex-1 space-y-2"><Bone className="h-4 w-40" /><Bone className="h-3 w-24" /></div><Bone className="h-7 w-14" /><Bone className="h-9 w-24 hidden sm:block" /></div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PenaltyTypesPage() {
  const { user } = useAuth();
  // Espelha o backend: criar/editar/remover admin|rh; restaurar padrões só admin.
  const isAdmin = hasRole(user, "admin");
  const canEdit = isAdmin || hasRole(user, "rh");

  const qKey = getGetPenaltyTypesQueryKey();
  const { data: types, isLoading, isError, refetch } = useGetPenaltyTypes({ query: { queryKey: qKey } });
  const { data: absences } = useGetAbsences();
  const state = useTypeForm(qKey, types);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of absences ?? []) m.set(a.penaltyType, (m.get(a.penaltyType) ?? 0) + 1);
    return m;
  }, [absences]);
  const penaltyTypes = (types ?? []).filter(t => t.kind === "penalty");
  const meritTypes = (types ?? []).filter(t => t.kind === "merit");
  const seeding = state.seedMutation.isPending;
  const seedBtn = (cls: string, compact = false) => (
    <button type="button" onClick={() => state.seedMutation.mutate()} disabled={seeding} aria-busy={seeding || undefined} data-testid="button-seed-types" aria-label="Restaurar padrões"
      title="Insere os tipos padrão (falta, atraso, conformidade, rei do galpão, estrela, colega top) que ainda não existem" className={cls}>
      {seeding ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <RefreshCw size={15} aria-hidden />}
      <span className={compact ? "hidden lg:inline" : undefined}>Restaurar padrões</span>
    </button>
  );

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
        <Link href="/absences" aria-label="Voltar para Penalidades e méritos" title="Penalidades e méritos" className={cn(btnGhost, "px-2 -ml-1.5 shrink-0")}>
          <ArrowLeft size={16} aria-hidden />
        </Link>
        <h1 className="min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-[0.95] text-foreground sm:truncate">Tipos de lançamento</h1>
        <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">As penalidades e os méritos do formulário, com os pontos padrão de cada um.</p>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {isAdmin && (types?.length ?? 0) > 0 && seedBtn(cn(btnGhost, "px-2.5 lg:px-3"), true)}
          {canEdit && (
            <button type="button" onClick={() => state.openCreate()} data-testid="button-create-type" className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
              <Plus size={15} aria-hidden /> Novo<span className="hidden sm:inline"> tipo</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {isLoading ? <TypesSkeleton /> : isError || !types ? (
          <ErrorBlock title="Não foi possível carregar os tipos" onRetry={() => { void refetch(); }} />
        ) : types.length === 0 ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={Tags} title="Nenhum tipo cadastrado" testId="types-empty"
              action={canEdit ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  {isAdmin && seedBtn(btnPrimary)}
                  <button type="button" onClick={() => state.openCreate()} className={isAdmin ? btnSecondary : btnPrimary}><Plus size={15} aria-hidden /> Criar um tipo</button>
                </div>
              ) : undefined}>
              Sem tipos, não há o que lançar em Penalidades e méritos. {isAdmin ? "Restaure os padrões (falta, atraso, estrela do evento…) ou crie o seu." : "Crie o primeiro tipo."}
            </EmptyBlock>
          </div>
        ) : (
          <>
            <Notice icon={Info} testId="types-rule-notice">
              <span className="font-semibold text-foreground">Os pontos padrão entram em cada lançamento novo.</span>{" "}
              Na nota, eles são divididos pelos eventos com nota do colaborador no ciclo. Tipo inativo some do formulário, mas o que já foi lançado continua valendo.
            </Notice>
            <div className="grid lg:grid-cols-2 gap-5 items-start">
              <TypeColumn kind="penalty" types={penaltyTypes} usage={usage} canEdit={canEdit} togglingId={state.togglingId}
                onCreate={() => state.openCreate("penalty")} onEdit={state.openEdit} onDelete={state.setDeleteTarget} onToggle={state.toggleActive} />
              <TypeColumn kind="merit" types={meritTypes} usage={usage} canEdit={canEdit} togglingId={state.togglingId}
                onCreate={() => state.openCreate("merit")} onEdit={state.openEdit} onDelete={state.setDeleteTarget} onToggle={state.toggleActive} />
            </div>
          </>
        )}
      </div>

      <TypeFormDialog state={state} />
      <DeleteTypeDialog state={state} uses={t => usage.get(t.slug) ?? 0} />
    </div>
  );
}
