// Topo fixo (o único h1 e as ações) e o panorama do catálogo: quantos
// critérios valem no ciclo, quais áreas avaliam, o peso total e os inativos.
import { Fragment } from "react";
import { Building2, ChevronDown, Eye, MoreHorizontal, Plus, RefreshCw, Wrench } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn, fmtNum, plural } from "@/lib/utils";
import { Chip, StatCell, btnGhost, btnPrimary, menuItemCls, surfaceCls, triggerMemo } from "./criteria-ui";
import type { MaintenanceKind } from "./use-criteria-maintenance";

/** Título + "Mais ações" (manutenção) + "Novo critério". */
export function CriteriaHeader({ isAdmin, canEdit, onMaintenance, onCreate }: {
  isAdmin: boolean;
  canEdit: boolean;
  onMaintenance: (kind: MaintenanceKind) => void;
  onCreate: () => void;
}) {
  // Espelha o backend: rótulos e calibrações só admin; sincronizar eventos admin|rh.
  const actions = [
    isAdmin && { key: "labels" as const, label: "Sincronizar rótulos de área", hint: "Regrava o nome da área em cada critério, depois de renomear uma área.", Icon: Building2, testId: "button-sync-area-labels" },
    isAdmin && { key: "calibrations" as const, label: "Corrigir calibrações", hint: "Leva calibrações dos critérios de nome antigo para o critério atual.", Icon: Wrench, testId: "button-fix-calibrations" },
    canEdit && { key: "resync" as const, label: "Sincronizar todos os eventos", hint: "Aplica o catálogo ativo aos eventos do ciclo atual.", Icon: RefreshCw, testId: "button-resync-all-events" },
  ].filter(Boolean) as { key: MaintenanceKind; label: string; hint: string; Icon: typeof RefreshCw; testId: string }[];

  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
      <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Critérios</h1>
      <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">O que vale neste ciclo, quem avalia cada critério e com que peso.</p>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" data-testid="button-criteria-more-actions" aria-label="Mais ações" {...triggerMemo}
                className={cn(btnGhost, "px-2.5 lg:px-3 data-[state=open]:bg-secondary data-[state=open]:text-foreground")}>
                <MoreHorizontal size={16} aria-hidden />
                <span className="hidden lg:inline">Mais ações</span>
                <ChevronDown size={14} aria-hidden className="hidden lg:block opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} className="font-body w-[min(330px,calc(100vw-24px))] rounded-xl border-border bg-popover text-popover-foreground p-1.5 shadow-lg">
              <DropdownMenuLabel className="font-condensed px-2.5 pt-1.5 pb-1 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Manutenção</DropdownMenuLabel>
              {actions.map((a, i) => (
                <Fragment key={a.key}>
                  {i > 0 && a.key === "resync" && <DropdownMenuSeparator className="my-1 bg-border" />}
                  <DropdownMenuItem data-testid={a.testId} onClick={() => onMaintenance(a.key)} className={cn(menuItemCls, "items-start py-2 h-auto")}>
                    <a.Icon size={15} aria-hidden className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block">{a.label}</span>
                      <span className="font-body block mt-0.5 text-[12.5px] font-normal normal-case tracking-normal text-muted-foreground leading-snug">{a.hint}</span>
                    </span>
                  </DropdownMenuItem>
                </Fragment>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canEdit ? (
          <button type="button" data-testid="button-create-criterion" onClick={onCreate} className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
            <Plus size={15} aria-hidden /> Novo<span className="hidden sm:inline"> critério</span>
          </button>
        ) : (
          <Chip icon={Eye} title="Seu perfil só consulta os critérios">Só consulta</Chip>
        )}
      </div>
    </div>
  );
}

export type CriteriaStats = {
  active: number;
  inactive: number;
  multiArea: number;
  totalWeight: number;
  areaNames: string[];
};

/** Panorama do catálogo. "Inativos" é atalho para mostrar o grupo dos inativos. */
export function CriteriaPanel({ stats, showInactive, onToggleInactive }: {
  stats: CriteriaStats;
  showInactive: boolean;
  onToggleInactive: () => void;
}) {
  const areas = stats.areaNames;
  const areasSub = areas.length === 0 ? "Nenhuma área vinculada ainda." : areas.length <= 4 ? areas.join(", ") : `${areas.slice(0, 3).join(", ")} e mais ${areas.length - 3}`;
  return (
    <section aria-label="Panorama do catálogo" className={cn(surfaceCls, "overflow-hidden grid grid-cols-2 lg:grid-cols-4 gap-px bg-border")}>
      <StatCell
        testId="stat-criteria-active"
        label="Valem neste ciclo"
        value={stats.active}
        unit={stats.active === 1 ? "critério" : "critérios"}
        sub={<span className="hidden sm:inline">Entram nos eventos novos e nos ainda não confirmados.</span>}
      />
      <StatCell
        testId="stat-criteria-areas"
        label="Áreas que avaliam"
        value={areas.length}
        sub={<>
          <span className="hidden sm:inline">{areasSub}</span>
          {stats.multiArea > 0 && <span className="block sm:mt-0.5">{plural(stats.multiArea, "critério com várias áreas", "critérios com várias áreas")}</span>}
        </>}
      />
      <StatCell
        testId="stat-criteria-weight"
        label="Peso total"
        value={fmtNum(stats.totalWeight, Number.isInteger(stats.totalWeight) ? 0 : 1)}
        sub={<span className="hidden sm:inline">Soma dos ativos. Cada linha mostra a fatia do critério.</span>}
      />
      <StatCell
        testId="stat-criteria-inactive"
        label="Inativos"
        value={stats.inactive}
        sub={<span className="hidden sm:inline">{stats.inactive > 0 ? "Fora dos eventos novos; o histórico fica." : "Nenhum critério desativado."}</span>}
        onClick={stats.inactive > 0 ? onToggleInactive : undefined}
        pressed={stats.inactive > 0 ? showInactive : undefined}
        action={showInactive ? "Esconder" : "Mostrar"}
      />
    </section>
  );
}
