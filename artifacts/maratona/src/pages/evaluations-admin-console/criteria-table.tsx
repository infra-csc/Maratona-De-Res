import { Search, Copy, RefreshCw, Trash2, RotateCcw, ChevronUp, ChevronDown, Check } from "lucide-react";
import { DANGER_TEXT } from "@/lib/premium-theme";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldStyle } from "./helpers";
import type { CriteriaManagement } from "./use-criteria-management";

/** Aba Critérios — tabela de critérios do evento (peso, avaliador principal/backup, ações). */
export function CriteriaTable({ mgmt, isAdmin }: { mgmt: CriteriaManagement; isAdmin: boolean }) {
  const {
    config, showInactiveCriteria, setShowInactiveCriteria, setPendingRemoval, setPendingDelete,
    editingName, setEditingName, assignments, primaryEvaluator, setPrimaryEvaluator,
    redirectExpanded, setRedirectExpanded, redirectSearch, setRedirectSearch,
    setSwapDialog, setSwapSourceId, evaluatorsForArea, duplicateCriterion, deleteCriterion,
    critMeta, hasEvaluations, editLocked, setCriterionActive, criterionHasEvals, setCriterionWeight,
    handleDuplicate, handleRename, toggleBackupEvaluator,
  } = mgmt;
  return (
    <>
      <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
              <th className="px-4 py-3 text-[11px] font-bold uppercase">Critério</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase">Área</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase text-center">Peso</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase">Avaliador</th>
              <th className="px-4 py-3 text-[11px] font-bold uppercase text-right">Ações</th>
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
                  <tr key={item.criterionId} data-testid={`row-event-criterion-${item.criterionId}`} className="align-top" style={{ borderTop: "1px solid var(--border)", opacity: item.active ? 1 : 0.6 }}>
                    <td className="px-4 py-3 min-w-[180px]">
                      {isEditingName ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            data-testid={`input-event-criterion-name-${item.criterionId}`}
                            value={editingName[item.criterionId]}
                            autoFocus
                            onChange={e => setEditingName(prev => ({ ...prev, [item.criterionId]: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") handleRename(item.criterionId); if (e.key === "Escape") setEditingName(prev => { const n = { ...prev }; delete n[item.criterionId]; return n; }); }}
                            className="h-9 rounded-lg font-black text-sm"
                            style={fieldStyle}
                          />
                          <button type="button" data-testid={`button-save-name-${item.criterionId}`} onClick={() => handleRename(item.criterionId)} title="Salvar nome" aria-label="Salvar nome" className="h-9 w-9 flex items-center justify-center rounded-lg transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-black uppercase text-sm">{meta?.criterionName ?? item.name}</span>
                          {item.eventScoped && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-black uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Duplicado</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{meta?.responsibleAreaName ?? "—"}</span>
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
                        className="w-20 h-10 rounded-lg text-center font-black disabled:opacity-50 inline-block"
                        style={fieldStyle}
                      />
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      {!item.active || areaId == null ? (
                        <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>—</span>
                      ) : areaEvaluators.length === 0 ? (
                        <p className="text-[11px] font-bold uppercase" style={{ color: DANGER_TEXT }}>Nenhum avaliador vinculado a esta área</p>
                      ) : !isFirstForArea ? (
                        (() => {
                          const primary = primaryEvaluator[areaId] ?? null;
                          const primaryName = areaEvaluators.find(u => u.id === primary)?.name;
                          return (
                            <div className="space-y-1">
                              <p className="text-[11px] font-black uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliador Principal *</p>
                              {primaryName ? (
                                <span className="text-xs font-black">{primaryName}</span>
                              ) : (
                                <span className="text-[11px] font-bold uppercase" style={{ color: DANGER_TEXT }}>Sem avaliador principal</span>
                              )}
                              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Definido pela área acima</p>
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
                              <p className="text-[11px] font-black uppercase mb-1" style={{ color: "var(--muted-foreground)" }}>Avaliador Principal *</p>
                              <Select
                                disabled={hasEvaluations && primary != null && areaEvaluators.some(u => u.id === primary)}
                                value={primary?.toString() ?? ""}
                                onValueChange={val => setPrimaryEvaluator(prev => ({ ...prev, [areaId]: val ? Number(val) : null }))}
                              >
                                <SelectTrigger data-testid={`select-primary-evaluator-${item.criterionId}`} className="h-8 rounded-lg text-xs font-bold disabled:opacity-50 w-full" style={fieldStyle}>
                                  <SelectValue placeholder="Selecionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {areaEvaluators.map(u => (
                                    <SelectItem key={u.id} value={u.id.toString()} className="text-xs font-bold">{u.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!primary && (
                                <p className="mt-0.5 text-[11px] font-bold uppercase" style={{ color: DANGER_TEXT }}>Sem avaliador principal</p>
                              )}
                            </div>
                            {backupEvaluators.length > 0 && (
                              <div>
                                <button type="button" onClick={() => setRedirectExpanded(prev => ({ ...prev, [areaId]: !expanded }))} className="flex items-center gap-1 text-[11px] font-black uppercase transition-colors hover:opacity-70" style={{ color: "var(--muted-foreground)" }}>
                                  {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                  Pode redirecionar para
                                  {selectedBackupCount > 0 && (
                                    <span className="rounded px-1 py-px text-[11px] font-black" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{selectedBackupCount}</span>
                                  )}
                                </button>
                                {expanded && (
                                  <div className="mt-1.5 rounded-lg p-2 space-y-1.5" style={{ border: "1px solid var(--border)" }}>
                                    {backupEvaluators.length > 4 && (
                                      <div className="flex items-center gap-1 rounded px-2 py-1" style={{ border: "1px solid var(--border)" }}>
                                        <Search size={10} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
                                        <input
                                          type="text"
                                          value={searchVal}
                                          onChange={e => setRedirectSearch(prev => ({ ...prev, [areaId]: e.target.value }))}
                                          placeholder="Buscar..."
                                          className="flex-1 text-[11px] font-bold outline-none bg-transparent"
                                        />
                                      </div>
                                    )}
                                    {filteredBackups.map(u => {
                                      const checked = backups.includes(u.id);
                                      return (
                                        <label key={u.id} className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                                          <input
                                            type="checkbox"
                                            data-testid={`checkbox-evaluator-${item.criterionId}-${u.id}`}
                                            checked={checked}
                                            disabled={hasEvaluations}
                                            onChange={e => toggleBackupEvaluator(areaId, u.id, e.target.checked)}
                                            className="h-3.5 w-3.5 disabled:opacity-50 shrink-0"
                                          />
                                          {u.name}
                                        </label>
                                      );
                                    })}
                                    {filteredBackups.length === 0 && (
                                      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado.</p>
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
                          <button type="button" data-testid={`button-rename-event-criterion-${item.criterionId}`} onClick={() => setEditingName(prev => ({ ...prev, [item.criterionId]: item.name }))} title="Renomear cópia" className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
                            Renomear
                          </button>
                        )}
                        {hasEvaluations && item.eventScoped && isAdmin && !isEditingName && (
                          <button type="button" onClick={() => { setSwapDialog({ ecId: item.id, currentName: item.name }); setSwapSourceId(""); }} title="Corrigir critério de origem" className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)", color: DANGER_TEXT }}>
                            <RefreshCw size={13} /> Corrigir
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid={`button-duplicate-event-criterion-${item.criterionId}`}
                          disabled={editLocked || duplicateCriterion.isPending}
                          onClick={() => handleDuplicate(item.criterionId, item.name)}
                          title="Duplicar quesito"
                          aria-label="Duplicar quesito"
                          className="h-9 w-9 flex items-center justify-center rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-80"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          <Copy size={16} />
                        </button>
                        {item.eventScoped ? (
                          <button
                            type="button"
                            data-testid={`button-delete-event-criterion-${item.criterionId}`}
                            disabled={editLocked || deleteCriterion.isPending}
                            onClick={() => setPendingDelete(item.id)}
                            title="Excluir cópia"
                            aria-label="Excluir cópia"
                            className="h-9 w-9 flex items-center justify-center rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-80"
                            style={{ border: "1px solid var(--border)", color: DANGER_TEXT }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : item.active ? (
                          <button
                            type="button"
                            data-testid={`button-remove-event-criterion-${item.criterionId}`}
                            disabled={editLocked && criterionHasEvals(item.criterionId)}
                            onClick={() => setPendingRemoval(item.criterionId)}
                            title={editLocked && !criterionHasEvals(item.criterionId) ? "Desativar critério sem avaliações" : "Remover critério"}
                            aria-label={editLocked && !criterionHasEvals(item.criterionId) ? "Desativar critério sem avaliações" : "Remover critério"}
                            className="h-9 w-9 flex items-center justify-center rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-80"
                            style={{ border: "1px solid var(--border)", color: DANGER_TEXT }}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid={`button-restore-event-criterion-${item.criterionId}`}
                            disabled={editLocked}
                            onClick={() => setCriterionActive(item.criterionId, true)}
                            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[11px] font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-colors hover:opacity-80"
                            style={{ border: "1px solid var(--border)" }}
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
              <tr><td colSpan={5} className="p-6 text-center font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum critério vinculado a este evento.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {config.some(item => !item.active) && (
        <button type="button" onClick={() => setShowInactiveCriteria(v => !v)} className="mt-1 flex items-center gap-1.5 text-[11px] font-bold uppercase transition-colors hover:opacity-70" style={{ color: "var(--muted-foreground)" }}>
          <RotateCcw size={12} />
          {showInactiveCriteria ? "Ocultar critérios inativos" : `Mostrar critérios inativos (${config.filter(c => !c.active).length})`}
        </button>
      )}

      {config.some(item => item.active && (critMeta.get(item.criterionId)?.responsibleAreaId != null) && evaluatorsForArea(critMeta.get(item.criterionId)!.responsibleAreaId!).length === 0) && (
        <p className="text-xs font-bold uppercase" style={{ color: DANGER_TEXT }}>Há áreas sem nenhum avaliador vinculado. Cadastre avaliadores nessas áreas (em Usuários) para poder atribuí-los.</p>
      )}
    </>
  );
}
