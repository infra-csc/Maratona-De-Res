// Barra de ações compacta: Liberar Sem Cal., progresso, filtros, log de publicação, Salvar e Publicar.
import type React from "react";
import { Check, Save, Send, Filter, ShieldCheck } from "lucide-react";
import { GOOD, AMBER, GOOD_TEXT } from "@/lib/premium-theme";
import { formatDateTime } from "./helpers";
import type { CriterionFilter } from "./types";

export type CalibrationActionBarProps = {
  autoFillableCount: number;
  canFinalize: boolean;
  savingAutoFill: boolean;
  savingAll: boolean;
  publishingAll: boolean;
  autoFillFromEvaluator: () => Promise<void>;
  finalPublishedCount: number;
  scorableCount: number;
  criterionFilter: CriterionFilter;
  setCriterionFilter: React.Dispatch<React.SetStateAction<CriterionFilter>>;
  alreadyReleased: boolean;
  allCriteriaFinalPublished: boolean;
  feedbackReleasedAtDate: Date | null;
  partialPublishedAtDate: Date | null;
  totalDirtyCount: number;
  unsavedEditsCount: number;
  handleSaveAll: () => Promise<void>;
  handlePublishAll: () => Promise<void>;
};

export function CalibrationActionBar({
  autoFillableCount,
  canFinalize,
  savingAutoFill,
  savingAll,
  publishingAll,
  autoFillFromEvaluator,
  finalPublishedCount,
  scorableCount,
  criterionFilter,
  setCriterionFilter,
  alreadyReleased,
  allCriteriaFinalPublished,
  feedbackReleasedAtDate,
  partialPublishedAtDate,
  totalDirtyCount,
  unsavedEditsCount,
  handleSaveAll,
  handlePublishAll,
}: CalibrationActionBarProps) {
  return (
              <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  {/* Liberar Sem Cal. — à esquerda */}
                  {autoFillableCount > 0 && canFinalize && (
                    <button
                      data-testid="button-autofill-from-evaluator"
                      type="button"
                      disabled={savingAutoFill || savingAll}
                      onClick={autoFillFromEvaluator}
                      title="Cria calibrações iguais à nota do avaliador para todos os critérios ainda sem calibração"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs uppercase disabled:opacity-50 transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <Check size={13} /> {savingAutoFill ? "Preenchendo..." : `Liberar Sem Cal. (${autoFillableCount})`}
                    </button>
                  )}

                  {/* Progress + filtros */}
                  <span className="text-[11px] font-bold uppercase flex items-center gap-1" style={{ color: "var(--muted-foreground)" }} title={`${finalPublishedCount} de ${scorableCount} critérios (peso > 0) publicados como Final`}>
                    <ShieldCheck size={11} style={{ color: GOOD_TEXT }} /> {finalPublishedCount}/{scorableCount} final
                  </span>
                  <div className="flex items-center gap-1">
                    <Filter size={11} className="mr-0.5" style={{ color: "var(--muted-foreground)" }} />
                    {([
                      { value: "all", label: "Todos" },
                      { value: "uncalibrated", label: "Pendentes" },
                      { value: "calibrated", label: "Calibrados" },
                    ] as const).map(opt => {
                      const active = criterionFilter === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCriterionFilter(opt.value)}
                          className="text-[11px] font-black uppercase px-2 py-1 rounded transition-colors"
                          style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                        >{opt.label}</button>
                      );
                    })}
                  </div>

                  {/* Grupo direito: log de publicação + Salvar + Publicar */}
                  <div className="ml-auto flex items-center gap-2">
                    {/* Log de publicação */}
                    {(alreadyReleased || allCriteriaFinalPublished || partialPublishedAtDate) && (
                      <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: alreadyReleased || allCriteriaFinalPublished ? GOOD : AMBER }}>
                        {alreadyReleased || allCriteriaFinalPublished ? <ShieldCheck size={11} /> : <Send size={11} />}
                        {alreadyReleased || allCriteriaFinalPublished
                          ? `Final ${feedbackReleasedAtDate ? formatDateTime(feedbackReleasedAtDate) : ""}`
                          : `Parcial ${partialPublishedAtDate ? formatDateTime(partialPublishedAtDate) : ""}`}
                      </span>
                    )}
                    {/* Salvar — sempre visível quando há alterações */}
                    <button
                      data-testid="button-save-all-cal"
                      type="button"
                      disabled={savingAll || totalDirtyCount === 0}
                      onClick={handleSaveAll}
                      title={totalDirtyCount === 0 ? "Nenhuma alteração pendente" : `Salvar ${totalDirtyCount} alteração(ões) pendente(s)`}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-black text-xs uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <Save size={13} /> {savingAll ? "Salvando..." : `Salvar${totalDirtyCount > 0 ? ` (${totalDirtyCount})` : ""}`}
                    </button>
                    {/* Publicar */}
                    {canFinalize && (
                      <button
                        data-testid="button-publish-all"
                        type="button"
                        disabled={publishingAll || savingAll}
                        onClick={handlePublishAll}
                        title={unsavedEditsCount > 0 ? "Há notas não salvas — salve antes de publicar" : "Publicar os critérios calibrados conforme a intenção Parc./Final de cada um"}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-black text-xs uppercase transition-colors hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <Send size={13} /> {publishingAll ? "Publicando..." : "Publicar"}
                      </button>
                    )}
                  </div>
                </div>
  );
}
