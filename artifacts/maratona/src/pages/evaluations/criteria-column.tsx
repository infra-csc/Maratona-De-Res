import type { Evaluation, EventCriterion } from "@workspace/api-client-react";
import { Building2, Flag, Target, Lock, CornerDownRight, Link2 } from "lucide-react";
import { CONDENSED, AMBER, AMBER_TEXT } from "@/lib/premium-theme";
import { CriterionCard, type CriterionCardHandlers } from "./criterion-card";
import type { AreaGroup, CriterionAssignmentRow, PublicLinkEligibleCriterion } from "./types";

interface CriteriaColumnProps extends CriterionCardHandlers {
  criteriaLocked: boolean;
  myCriteria: EventCriterion[];
  myAreaGroups: AreaGroup[];
  publicLinkEligibleCriteria: PublicLinkEligibleCriterion[] | undefined;
  criterionAssignments: CriterionAssignmentRow[] | undefined;
  comments: Record<number, string>;
  getEval: (criterionId: number) => Evaluation | undefined;
  currentScore: (criterionId: number) => number | null;
  currentAudio: (criterionId: number) => string | null;
  isSaving: boolean;
  progressPct: number;
  onRedirectArea: (group: AreaGroup) => void;
  onOpenPublicLink: (group: AreaGroup, areaEligible: number[]) => void;
}

// Coluna "Critérios de Avaliação": formulários por área com os cartões de
// critério e a meta de progresso no rodapé.
export function CriteriaColumn({
  criteriaLocked, myCriteria, myAreaGroups, publicLinkEligibleCriteria, criterionAssignments, comments,
  getEval, currentScore, currentAudio, isSaving, progressPct, onRedirectArea, onOpenPublicLink,
  onScoreClick, onCommentChange, onAudioChange, onSaveDraft,
}: CriteriaColumnProps) {
  return (
    <div className="space-y-4 order-2 lg:order-none">
      <div className="flex items-center justify-between gap-4 px-1">
        <h3 className="text-xl md:text-2xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
          <Target size={20} /> Critérios de Avaliação
        </h3>
      </div>

      {criteriaLocked ? (
        <div data-testid="notice-criteria-locked" className="text-center py-14 rounded-xl px-6" style={{ backgroundColor: "rgba(232,162,61,0.10)", border: `1px solid ${AMBER}` }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: AMBER, color: "var(--accent-foreground)" }}>
            <Lock size={26} />
          </div>
          <h2 className="text-2xl uppercase font-black tracking-tight mb-1" style={{ fontFamily: CONDENSED, color: AMBER_TEXT }}>Avaliação bloqueada</h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">Os critérios deste evento ainda não foram confirmados pelo RH. Aguarde a liberação para iniciar a avaliação da equipe.</p>
        </div>
      ) : myCriteria.length === 0 ? (
        <div data-testid="notice-no-area-criteria" className="text-center py-12 bg-card border border-border rounded-lg px-6">
          <div className="w-14 h-14 border border-border rounded-lg bg-secondary text-muted-foreground flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} />
          </div>
          <p className="uppercase font-bold text-muted-foreground max-w-md mx-auto">Nenhum critério atribuído à sua área neste evento.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl p-6 md:p-8">
          <div className="space-y-12">
            {myAreaGroups.map(g => {
              const eligibleIds = new Set((publicLinkEligibleCriteria ?? []).map(ec => ec.criterionId));
              const areaEligible = g.criteria.filter(c => eligibleIds.has(c.criterionId)).map(c => c.criterionId);
              const allGroupDone = g.criteria.every(c => getEval(c.criterionId)?.status === "submitted");
              return (
                <div key={g.areaId} className="space-y-10">
                  {/* Header do formulário com botões de redirecionar e link público por grupo/área */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-accent pl-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">Formulário</p>
                      <h3 className="text-xl uppercase font-black tracking-tight" style={{ fontFamily: CONDENSED }}>{g.areaName}</h3>
                    </div>
                    {!allGroupDone && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => onRedirectArea(g)}
                          className="border border-border rounded-lg bg-card px-3 py-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-secondary transition-all"
                        >
                          <CornerDownRight size={13} /> Redirecionar Formulário
                        </button>
                        {areaEligible.length > 0 && (
                          <button
                            type="button"
                            onClick={() => onOpenPublicLink(g, areaEligible)}
                            className="border border-border rounded-lg bg-card px-3 py-2 font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-secondary transition-all"
                          >
                            <Link2 size={13} /> Link Freelancer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {g.criteria.map((c, index) => {
                    const ev = getEval(c.criterionId);
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
                        onScoreClick={onScoreClick}
                        onCommentChange={onCommentChange}
                        onAudioChange={onAudioChange}
                        onSaveDraft={onSaveDraft}
                      />
                    );
                  })}
                </div>
              );
            })}
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
