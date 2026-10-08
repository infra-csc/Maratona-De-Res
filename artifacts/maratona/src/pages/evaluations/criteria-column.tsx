import type { ReactNode } from "react";
import type { Evaluation, EventCriterion, MyAreaCriterion } from "@workspace/api-client-react";
import { Building2, Flag, Target, CornerDownRight, Link2, Users } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import { CriterionCard, type CriterionCardHandlers } from "./criterion-card";
import type { AreaGroup, CriterionAssignmentRow, PublicLinkEligibleCriterion } from "./types";

interface CriteriaColumnProps extends CriterionCardHandlers {
  myCriteria: EventCriterion[];
  myAreaGroups: AreaGroup[];
  // Ciclo com avaliação por área: qualquer avaliador da área responde e a
  // primeira resposta enviada fecha o critério para todos.
  areaMode: boolean;
  publicLinkEligibleCriteria: PublicLinkEligibleCriterion[] | undefined;
  criterionAssignments: CriterionAssignmentRow[] | undefined;
  // Critérios respondidos por mais de uma área neste evento.
  sharedCriterionIds?: Set<number>;
  comments: Record<number, string>;
  getEval: (criterionId: number) => Evaluation | undefined;
  currentScore: (criterionId: number) => number | null;
  currentAudio: (criterionId: number) => string | null;
  isSaving: boolean;
  progressPct: number;
  // Estado do critério para mim (GET /evaluations/my-area): aberto, respondido, fechado pela área.
  criterionInfo: (criterionId: number) => MyAreaCriterion | undefined;
  // Avaliação que fechou o critério (nota e comentário de quem respondeu).
  closingEval: (criterionId: number) => Evaluation | undefined;
  onRedirectArea: (group: AreaGroup) => void;
  onOpenPublicLink: (group: AreaGroup, areaEligible: number[]) => void;
  /**
   * Matriz de Conformidade DENTRO do formulário (dono, 07/10: "tem que ser
   * junto, para a pessoa ver que tem que avaliar tudo"): por área do
   * formulário (Cenografia → matriz da Cenografia; Ferramentas → guarda de
   * equipamentos). A de uma área sem critério para mim vem em `matrixOrphans`.
   */
  matrixByArea?: Map<number, ReactNode>;
  matrixOrphans?: ReactNode;
}

// Coluna "Critérios de Avaliação": formulários por área com os cartões de
// critério e a meta de progresso no rodapé.
export function CriteriaColumn({
  myCriteria, myAreaGroups, areaMode, publicLinkEligibleCriteria, criterionAssignments, sharedCriterionIds, comments,
  getEval, currentScore, currentAudio, isSaving, progressPct, criterionInfo, closingEval, onRedirectArea, onOpenPublicLink,
  onScoreClick, onCommentChange, onAudioChange, onSaveDraft, onDiscardDraft, isDiscarding,
  matrixByArea, matrixOrphans,
}: CriteriaColumnProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 px-1">
        <h3 className="text-xl md:text-2xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
          <Target size={20} /> Critérios de Avaliação
        </h3>
      </div>

      {myCriteria.length === 0 && !matrixOrphans ? (
        <div data-testid="notice-no-area-criteria" className="text-center py-12 bg-card border border-border rounded-lg px-6">
          <div className="w-14 h-14 border border-border rounded-lg bg-secondary text-muted-foreground flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} />
          </div>
          <p className="uppercase font-bold text-muted-foreground max-w-md mx-auto">Nenhum critério para você neste evento.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-6 md:p-8">
          <div className="space-y-12">
            {myAreaGroups.map(g => {
              const eligibleIds = new Set((publicLinkEligibleCriteria ?? []).map(ec => ec.criterionId));
              const areaEligible = g.criteria.filter(c => eligibleIds.has(c.criterionId)).map(c => c.criterionId);
              const allGroupDone = g.criteria.every(c => getEval(c.criterionId)?.status === "submitted" || criterionInfo(c.criterionId)?.state === "closed");
              // Redirecionar é do fluxo antigo (designação); pela área não há o que redirecionar.
              const canRedirect = g.criteria.some(c => criterionInfo(c.criterionId)?.access === "assigned" && criterionInfo(c.criterionId)?.state === "open");
              const byArea = areaMode;
              return (
                <div key={g.areaId} className="space-y-10">
                  {/* Header do formulário com botões de redirecionar e link público por grupo/área */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-accent pl-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Formulário</p>
                      <h3 className="text-xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>{g.areaName}</h3>
                      {byArea && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1.5 max-w-md leading-snug">
                          <Users size={12} className="shrink-0 mt-0.5" aria-hidden />
                          Qualquer avaliador da área pode responder. A primeira resposta enviada fecha o critério para todos.
                        </p>
                      )}
                    </div>
                    {!allGroupDone && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {canRedirect && <button
                          type="button"
                          onClick={() => onRedirectArea(g)}
                          className="border border-border rounded-lg bg-card px-3 py-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-secondary transition-all"
                        >
                          <CornerDownRight size={13} /> Redirecionar Formulário
                        </button>}
                        {areaEligible.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenPublicLink(g, areaEligible)}
                            data-testid={`button-freela-link-${g.areaId}`}
                            className="border border-border rounded-lg bg-card px-3 py-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2 whitespace-nowrap hover:bg-secondary transition-all"
                          >
                            <Link2 size={13} /> Link para freela
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {g.criteria.map((c, index) => {
                    const ev = getEval(c.criterionId);
                    const info = criterionInfo(c.criterionId);
                    return (
                      <CriterionCard
                        key={c.criterionId}
                        criterion={c}
                        index={index}
                        total={g.criteria.length}
                        ev={ev}
                        score={currentScore(c.criterionId)}
                        comment={comments[c.criterionId] ?? ev?.comments ?? ""}
                        audio={currentAudio(c.criterionId)}
                        assignment={criterionAssignments?.find(x => x.criterionId === c.criterionId)}
                        isSaving={isSaving}
                        sharedWithOtherAreas={sharedCriterionIds?.has(c.criterionId) ?? false}
                        closedBy={info?.state === "closed" ? { name: info.answeredByName, at: info.answeredAt, viaLink: info.answeredViaLink, score: closingEval(c.criterionId)?.score ?? null, comment: closingEval(c.criterionId)?.comments ?? null } : null}
                        answeredByLinkName={info?.state === "answered" && info.answeredViaLink ? info.answeredByName : null}
                        onScoreClick={onScoreClick}
                        onCommentChange={onCommentChange}
                        onAudioChange={onAudioChange}
                        onSaveDraft={onSaveDraft}
                        onDiscardDraft={onDiscardDraft}
                        isDiscarding={isDiscarding}
                      />
                    );
                  })}
                  {matrixByArea?.get(g.areaId) && (
                    <div data-testid={`form-matrix-${g.areaId}`} className="pt-8 border-t border-dashed border-border">
                      {matrixByArea.get(g.areaId)}
                    </div>
                  )}
                </div>
              );
            })}
            {matrixOrphans}
          </div>

          {/* Sprint goal footer */}
          <div className="mt-12 pt-8 border-t border-dashed border-border flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary text-primary-foreground border border-primary rounded-lg flex items-center justify-center">
                <Flag size={20} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase">Meta da Avaliação</p>
                <div className="w-48 h-2 bg-secondary mt-1 border border-border overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
