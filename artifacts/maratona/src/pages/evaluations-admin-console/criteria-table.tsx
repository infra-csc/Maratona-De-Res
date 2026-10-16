import { Search, Copy, RefreshCw, Trash2, RotateCcw, ChevronUp, ChevronDown, Check, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Chip, Eyebrow, btnGhost, btnPrimary, btnSmall, fieldCls, FOCUS_RING } from "./console-ui";

const TH = "font-condensed px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap";
const SMALL = cn(btnSmall, "min-h-11 lg:min-h-9 px-2.5 text-[12.5px]");
const ICON = cn("min-h-11 min-w-11 lg:min-h-9 lg:min-w-9 inline-flex items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors duration-150 enabled:hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed", FOCUS_RING);
import type { CriteriaManagement } from "./use-criteria-management";
import { displayCriterionName } from "@/lib/criterion-name";

/** Aba Critérios — tabela de critérios do evento (peso, avaliador principal/backup, ações). */
export function CriteriaTable({ mgmt, isAdmin, areaMode = false }: { mgmt: CriteriaManagement; isAdmin: boolean; areaMode?: boolean }) {
  const {
    config, showInactiveCriteria, setShowInactiveCriteria, setPendingRemoval, setPendingDelete,
    editingName, setEditingName, assignments, primaryEvaluator, setPrimaryEvaluator,
    redirectExpanded, setRedirectExpanded, redirectSearch, setRedirectSearch,
    setSwapDialog, setSwapSourceId, evaluatorsForArea, duplicateCriterion, deleteCriterion,
    critMeta, hasEvaluations, editLocked, setCriterionActive, criterionHasEvals, setCriterionWeight,
    handleDuplicate, handleRename, toggleBackupEvaluator,
    areaCopies, areasLockedReason, openAreasDialog, setCriterionAreas,
  } = mgmt;
  // Cópia de área (criada por "Áreas" ou pelo padrão) → id do critério original.
  const areaCopyParent = new Map<number, number>();
  for (const [parentId, copies] of areaCopies) for (const c of copies) areaCopyParent.set(c.criterionId, parentId);
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left border-collapse text-[13.5px]">
          <thead>
            <tr className="bg-secondary/50">
              <th className={TH}>Critério</th>
              <th className={TH}>Área</th>
              <th className={cn(TH, "text-center")}>Peso</th>
              <th className={TH}>Avaliador</th>
              <th className={cn(TH, "text-right")}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const firstCriterionPerArea: Map<number, number> = new Map();
              for (const item of config.filter(i => i.active || showInactiveCriteria)) {
                const aId = critMeta.get(item.criterionId)?.responsibleAreaId;
                if (aId != null && !firstCriterionPerArea.has(aId)) firstCriterionPerArea.set(aId, item.criterionId);
              }
              return config.filter(item => item.active || showInactiveCriteria).map(item => {
                const meta = critMeta.get(item.criterionId);
                const isEditingName = editingName[item.criterionId] !== undefined;
                const areaId = meta?.responsibleAreaId ?? null;
                const areaEvaluators = areaId != null ? [...evaluatorsForArea(areaId)].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) : [];
                const isFirstForArea = areaId != null && firstCriterionPerArea.get(areaId) === item.criterionId;
                return (
                  <tr key={item.criterionId} data-testid={`row-event-criterion-${item.criterionId}`} className={cn("align-top border-t border-border transition-colors duration-150 hover:bg-secondary/30", !item.active && "opacity-60")}>
                    <td className="px-4 py-3.5 min-w-[200px]">
                      {isEditingName ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            data-testid={`input-event-criterion-name-${item.criterionId}`}
                            value={editingName[item.criterionId]}
                            autoFocus
                            onChange={e => setEditingName(prev => ({ ...prev, [item.criterionId]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleRename(item.criterionId); if (e.key === "Escape") setEditingName(prev => { const n = { ...prev }; delete n[item.criterionId]; return n; }); }}
                            className={cn(fieldCls, "h-10 font-condensed font-black uppercase text-[15px]")}
                          />
                          <button type="button" data-testid={`button-save-name-${item.criterionId}`} onClick={() => handleRename(item.criterionId)} title="Salvar nome" aria-label="Salvar nome" className={cn(btnPrimary, "min-h-10 w-10 px-0")}>
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-condensed font-black uppercase text-[15px] leading-tight text-foreground">{displayCriterionName(meta?.criterionName ?? item.name)}</span>
                          {item.eventScoped && (areaCopyParent.has(item.criterionId) ? (
                            <span
                              className="font-condensed inline-flex items-center h-5 px-1.5 rounded-md border border-border text-[11px] font-bold uppercase tracking-[0.05em] whitespace-nowrap text-muted-foreground"
                              title={`Área extra de "${displayCriterionName(critMeta.get(areaCopyParent.get(item.criterionId)!)?.criterionName) || "critério original"}": a nota do critério é a média das áreas`}
                            >
                              Área extra
                            </span>
                          ) : (
                            <Chip tone="brand" className="h-5 px-1.5 text-[11px]">Duplicado</Chip>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">{meta?.responsibleAreaName ?? "—"}</span>
                      {!item.eventScoped && (areaCopies.get(item.criterionId)?.length ?? 0) > 0 && (() => {
                        const extras = areaCopies.get(item.criterionId)!;
                        return (
                          <div className="mt-1 flex flex-wrap gap-1" data-testid={`event-criterion-areas-${item.criterionId}`} title={`Também avaliam neste evento: ${extras.map(x => x.areaName).join(", ")}. A nota é a média das áreas.`}>
                            <span className="sr-only">Também avaliam neste evento:</span>
                            {extras.map(x => (
                              <span key={x.areaId} className="font-condensed inline-flex items-center h-5 px-1.5 rounded-md bg-secondary text-[11.5px] font-bold uppercase tracking-[0.04em] whitespace-nowrap text-muted-foreground">
                                + {x.areaName}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input
                        data-testid={`input-event-criterion-weight-${item.criterionId}`}
                        type="number"
                        min="0"
                        step="1"
                        value={item.active ? item.weight : 0}
                        disabled={!item.active}
                        onChange={e => setCriterionWeight(item.criterionId, Number(e.target.value))}
                        aria-label={`Peso de ${displayCriterionName(meta?.criterionName ?? item.name)}`}
                        className={cn(fieldCls, "w-20 h-11 lg:h-10 text-center font-condensed text-[17px] font-black tabular-nums disabled:opacity-50 inline-block")}
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      {!item.active || areaId == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : areaEvaluators.length === 0 ? (
                        <p className="text-[13px] font-semibold text-[var(--status-danger-text)]">Nenhum avaliador vinculado a esta área</p>
                      ) : areaMode ? (
                        // Ciclo por área: qualquer avaliador da área responde — sem
                        // "Avaliador principal *" para escolher (nem o vermelho de falta).
                        <div className="space-y-0.5" data-testid={`area-mode-evaluators-${item.criterionId}`}>
                          <p className="font-semibold text-foreground">Qualquer avaliador da área</p>
                          <p className="text-[12.5px] text-muted-foreground" title={areaEvaluators.map(u => u.name).join(", ")}>
                            {areaEvaluators.length === 1 ? `${areaEvaluators[0].name} responde` : `${areaEvaluators.length} avaliadores podem responder`}
                          </p>
                        </div>
                      ) : !isFirstForArea ? (
                        (() => {
                          const primary = primaryEvaluator[areaId] ?? null;
                          const primaryName = areaEvaluators.find(u => u.id === primary)?.name;
                          return (
                            <div className="space-y-1">
                              <Eyebrow>Avaliador principal *</Eyebrow>
                              {primaryName ? (
                                <span className="block font-semibold text-foreground">{primaryName}</span>
                              ) : (
                                <span className="block text-[13px] font-semibold text-[var(--status-danger-text)]">Sem avaliador principal</span>
                              )}
                              <p className="text-[12.5px] text-muted-foreground">Definido pela área acima</p>
                            </div>
                          );
                        })()
                      ) : (() => {
                        const primary = primaryEvaluator[areaId] ?? null;
                        const backups = (assignments[areaId] ?? []).filter(uid => uid !== primary);
                        const backupEvaluators = areaEvaluators.filter(u => u.id !== primary);
                        const searchVal = redirectSearch[areaId] ?? "";
                        const filteredBackups = backupEvaluators.filter(u => u.name.toLowerCase().includes(searchVal.toLowerCase()));
                        const expanded = redirectExpanded[areaId] ?? false;
                        const selectedBackupCount = backupEvaluators.filter(u => backups.includes(u.id)).length;
                        return (
                          <div className="space-y-2" data-testid={`select-assignment-${item.criterionId}`}>
                            <div>
                              <Eyebrow className="mb-1.5">Avaliador principal *</Eyebrow>
                              <Select
                                disabled={hasEvaluations && primary != null && areaEvaluators.some(u => u.id === primary)}
                                value={primary?.toString() ?? ""}
                                onValueChange={val => setPrimaryEvaluator(prev => ({ ...prev, [areaId]: val ? Number(val) : null }))}
                              >
                                <SelectTrigger data-testid={`select-primary-evaluator-${item.criterionId}`} className={cn(fieldCls, "h-11 lg:h-9 text-[13.5px] font-semibold disabled:opacity-50 w-full")}>
                                  <SelectValue placeholder="Selecionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {areaEvaluators.map(u => (
                                    <SelectItem key={u.id} value={u.id.toString()} className="text-xs font-bold">{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!primary && (
                                <p className="mt-1 text-[12.5px] font-semibold text-[var(--status-danger-text)]">Sem avaliador principal</p>
                              )}
                            </div>
                            {backupEvaluators.length > 0 && (
                              <div>
                                <button type="button" onClick={() => setRedirectExpanded(prev => ({ ...prev, [areaId]: !expanded }))} aria-expanded={expanded} className={cn(btnGhost, "min-h-9 lg:min-h-7 px-1.5 -ml-1.5 text-[12px]")}>
                                  {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                  Pode redirecionar para
                                  {selectedBackupCount > 0 && (
                                    <span className="min-w-5 h-5 px-1 rounded-md bg-primary text-primary-foreground text-[11.5px] inline-flex items-center justify-center tabular-nums">{selectedBackupCount}</span>
                                  )}
                                </button>
                                {expanded && (
                                  <div className="mt-1.5 rounded-lg border border-border bg-card p-2 space-y-0.5">
                                    {backupEvaluators.length > 4 && (
                                      <div className="flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 h-9 mb-1">
                                        <Search size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                                        <input
                                          type="text"
                                          value={searchVal}
                                          onChange={e => setRedirectSearch(prev => ({ ...prev, [areaId]: e.target.value }))}
                                          placeholder="Buscar..."
                                          aria-label="Buscar avaliador" className="flex-1 min-w-0 text-[13px] outline-none bg-transparent"
                                        />
                                      </div>
                                    )}
                                    {filteredBackups.map(u => {
                                      const checked = backups.includes(u.id);
                                      return (
                                        <label key={u.id} className="flex items-center gap-2.5 min-h-10 lg:min-h-8 px-1.5 rounded-md text-[13px] cursor-pointer hover:bg-secondary/60">
                                          <input
                                            type="checkbox"
                                            data-testid={`checkbox-evaluator-${item.criterionId}-${u.id}`}
                                            checked={checked}
                                            disabled={hasEvaluations}
                                            onChange={e => toggleBackupEvaluator(areaId, u.id, e.target.checked)}
                                            className="h-4 w-4 accent-[var(--primary)] disabled:opacity-50 shrink-0"
                                          />
                                          {u.name}
                                        </label>
                                      );
                                    })}
                                    {filteredBackups.length === 0 && (
                                      <p className="px-1.5 py-1 text-[12.5px] text-muted-foreground">Nenhum avaliador com esse nome.</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {!editLocked && item.eventScoped && !isEditingName && (
                          <button type="button" data-testid={`button-rename-event-criterion-${item.criterionId}`} onClick={() => setEditingName(prev => ({ ...prev, [item.criterionId]: item.name }))} title="Renomear cópia" className={SMALL}>
                            Renomear
                          </button>
                        )}
                        {hasEvaluations && item.eventScoped && isAdmin && !isEditingName && (
                          <button type="button" onClick={() => { setSwapDialog({ ecId: item.id, currentName: item.name }); setSwapSourceId(""); }} title="Corrigir critério de origem" className={SMALL}>
                            <RefreshCw size={13} /> Corrigir
                          </button>
                        )}
                        {!item.eventScoped && item.active && (
                          <button
                            type="button"
                            data-testid={`button-event-criterion-areas-${item.criterionId}`}
                            disabled={areasLockedReason != null || setCriterionAreas.isPending}
                            onClick={() => openAreasDialog(item.criterionId)}
                            title={areasLockedReason ?? "Escolher as áreas que avaliam este critério neste evento"}
                            aria-label={`Áreas que avaliam ${displayCriterionName(meta?.criterionName ?? item.name)}`}
                            className={SMALL}
                          >
                            <Users size={14} aria-hidden="true" /> Áreas
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid={`button-duplicate-event-criterion-${item.criterionId}`}
                          disabled={editLocked || duplicateCriterion.isPending}
                          onClick={() => handleDuplicate(item.criterionId, item.name)}
                          title="Duplicar quesito"
                          aria-label="Duplicar quesito"
                          className={ICON}
                        >
                          <Copy size={15} aria-hidden />
                        </button>
                        {item.eventScoped ? (
                          <button
                            type="button"
                            data-testid={`button-delete-event-criterion-${item.criterionId}`}
                            disabled={editLocked || deleteCriterion.isPending}
                            onClick={() => setPendingDelete(item.id)}
                            title="Excluir cópia"
                            aria-label="Excluir cópia"
                            className={cn(ICON, "text-[var(--status-danger-text)] enabled:hover:bg-[var(--status-danger-bg)]")}
                          >
                            <Trash2 size={15} aria-hidden />
                          </button>
                        ) : item.active ? (
                          <button
                            type="button"
                            data-testid={`button-remove-event-criterion-${item.criterionId}`}
                            disabled={editLocked && criterionHasEvals(item.criterionId)}
                            onClick={() => setPendingRemoval(item.criterionId)}
                            title={editLocked && !criterionHasEvals(item.criterionId) ? "Desativar critério sem avaliações" : "Remover critério"}
                            aria-label={editLocked && !criterionHasEvals(item.criterionId) ? "Desativar critério sem avaliações" : "Remover critério"}
                            className={cn(ICON, "text-[var(--status-danger-text)] enabled:hover:bg-[var(--status-danger-bg)]")}
                          >
                            <Trash2 size={15} aria-hidden />
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid={`button-restore-event-criterion-${item.criterionId}`}
                            disabled={editLocked}
                            onClick={() => setCriterionActive(item.criterionId, true)}
                            className={SMALL}
                          >
                            <RotateCcw size={14} /> Reativar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });
            })()}
            {config.filter(item => item.active || showInactiveCriteria).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhum critério vinculado a este evento.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {config.some(item => !item.active) && (
        <button type="button" onClick={() => setShowInactiveCriteria(v => !v)} aria-pressed={showInactiveCriteria} className={cn(btnGhost, "mx-4 sm:mx-5 my-2")}>
          <RotateCcw size={12} />
          {showInactiveCriteria ? "Ocultar critérios inativos" : `Mostrar critérios inativos (${config.filter(c => !c.active).length})`}
        </button>
      )}

      {config.some(item => item.active && (critMeta.get(item.criterionId)?.responsibleAreaId != null) && evaluatorsForArea(critMeta.get(item.criterionId)!.responsibleAreaId!).length === 0) && (
        <p className="mx-4 sm:mx-5 mb-3 text-[13px] font-semibold text-[var(--status-danger-text)]">Há áreas sem nenhum avaliador vinculado. Cadastre avaliadores nessas áreas (em Usuários) para poder atribuí-los.</p>
      )}
    </>
  );
}
