import type { ReactNode } from "react";
import type { Evaluation, EventCriterion, MyAreaCriterion } from "@workspace/api-client-react";
import { Check, ClipboardList, CornerDownRight, Link2, Lock, ShieldCheck, Users } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { CriterionCard, type CriterionCardHandlers } from "./criterion-card";
import { displayCriterionName } from "./helpers";
import { Eyebrow, btnSmall, scrollToItem } from "./ui";
import type { AreaGroup, CriterionAssignmentRow, PublicLinkEligibleCriterion } from "./types";

/** Progresso da Matriz de Conformidade de uma área (para o índice do formulário). */
export interface MatrixProgress { completed: number; total: number; readOnly: boolean }

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
  /** Critério cujo rascunho está sendo salvo agora (null = nenhum). */
  savingCriterionId: number | null;
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
  /** Progresso da matriz por área (índice do formulário). */
  matrixProgress?: Map<number, MatrixProgress>;
}

type ItemState = "todo" | "ready" | "done" | "locked";

function IndexItem({ n, label, state, targetId, detail }: { n: ReactNode; label: string; state: ItemState; targetId: string; detail?: string }) {
  const stateText = state === "done" ? "respondido" : state === "locked" ? "já respondido pela área" : state === "ready" ? "pronto para lançar" : "falta responder";
  return (
    <li>
      <button
        type="button"
        onClick={() => scrollToItem(targetId)}
        className={cn(
          "group w-full min-h-11 flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
          state === "todo" ? "border-border bg-card hover:bg-secondary" : "border-transparent bg-secondary/70 hover:bg-secondary",
        )}
      >
        <span aria-hidden className={cn(
          "font-condensed w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[13px] font-black leading-none",
          state === "todo" && "border border-border text-muted-foreground",
          state === "ready" && "bg-accent text-accent-foreground",
          state === "done" && "bg-primary text-primary-foreground",
          state === "locked" && "bg-card text-muted-foreground",
        )}>
          {state === "done" ? <Check size={13} strokeWidth={3} /> : state === "locked" ? <Lock size={11} /> : n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight text-foreground truncate">{label}</span>
          <span className="block text-[12px] leading-tight text-muted-foreground truncate">{detail ?? stateText}</span>
        </span>
      </button>
    </li>
  );
}

// Formulários por área: índice do que há para responder, os cartões de
// critério e a Matriz de Conformidade como parte final do MESMO formulário.
export function CriteriaColumn({
  myCriteria, myAreaGroups, areaMode, publicLinkEligibleCriteria, criterionAssignments, sharedCriterionIds, comments,
  getEval, currentScore, currentAudio, savingCriterionId, criterionInfo, closingEval, onRedirectArea, onOpenPublicLink,
  onScoreClick, onCommentChange, onAudioChange, onSaveDraft, onDiscardDraft, isDiscarding,
  matrixByArea, matrixOrphans, matrixProgress,
}: CriteriaColumnProps) {
  if (myCriteria.length === 0 && !matrixOrphans) {
    return (
      <div data-testid="notice-no-area-criteria" className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <span className="mx-auto mb-4 w-12 h-12 rounded-xl bg-secondary text-muted-foreground flex items-center justify-center"><ClipboardList size={22} aria-hidden /></span>
        <p className="font-condensed text-[20px] font-black uppercase text-foreground">Nenhum critério para você neste evento.</p>
        <p className="mt-1 text-[14px] text-muted-foreground">Os critérios da sua área já foram respondidos ou não fazem parte deste evento.</p>
      </div>
    );
  }

  const eligibleIds = new Set((publicLinkEligibleCriteria ?? []).map(ec => ec.criterionId));
  const stateOf = (c: EventCriterion): ItemState => {
    if (criterionInfo(c.criterionId)?.state === "closed") return "locked";
    if (getEval(c.criterionId)?.status === "submitted") return "done";
    const score = currentScore(c.criterionId);
    const comment = comments[c.criterionId] ?? getEval(c.criterionId)?.comments ?? "";
    return score != null && comment.trim() ? "ready" : "todo";
  };

  return (
    <div className="space-y-6">
      {myAreaGroups.map(g => {
        const areaEligible = g.criteria.filter(c => eligibleIds.has(c.criterionId)).map(c => c.criterionId);
        const allGroupDone = g.criteria.every(c => getEval(c.criterionId)?.status === "submitted" || criterionInfo(c.criterionId)?.state === "closed");
        // Redirecionar é do fluxo antigo (designação); pela área não há o que redirecionar.
        const canRedirect = g.criteria.some(c => criterionInfo(c.criterionId)?.access === "assigned" && criterionInfo(c.criterionId)?.state === "open");
        const matrix = matrixByArea?.get(g.areaId);
        const mp = matrixProgress?.get(g.areaId);
        const titleId = `form-title-${g.areaId}`;
        return (
          <section key={g.areaId} aria-labelledby={titleId} className="rounded-2xl border border-border bg-card">
            {/* Cabeçalho do formulário: área, regra da área, ações e índice */}
            <header className="px-5 sm:px-7 pt-5 sm:pt-6 pb-5 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0">
                  <Eyebrow>Formulário da área</Eyebrow>
                  <h3 id={titleId} className="font-condensed mt-1.5 text-[28px] font-black uppercase leading-none tracking-[-0.01em] text-foreground">{g.areaName}</h3>
                  <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
                    {plural(g.criteria.length, "critério", "critérios")}{matrix ? " + Matriz de Conformidade, tudo neste formulário" : ""}.
                  </p>
                  {areaMode && (
                    <p className="mt-1 text-[13px] text-muted-foreground flex items-start gap-1.5 max-w-xl leading-snug">
                      <Users size={14} className="shrink-0 mt-0.5" aria-hidden />
                      <span>Qualquer avaliador da área pode responder. A primeira resposta enviada fecha o critério para todos.</span>
                    </p>
                  )}
                </div>
                {!allGroupDone && (canRedirect || areaEligible.length > 0) && (
                  <div className="flex items-center gap-2 flex-wrap sm:justify-end sm:shrink-0">
                    {canRedirect && (
                      <button type="button" onClick={() => onRedirectArea(g)} className={btnSmall}>
                        <CornerDownRight size={14} aria-hidden /> Redirecionar formulário
                      </button>
                    )}
                    {areaEligible.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onOpenPublicLink(g, areaEligible)}
                        data-testid={`button-freela-link-${g.areaId}`}
                        className={btnSmall}
                      >
                        <Link2 size={14} aria-hidden /> Link para freela
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Índice: o que este formulário pede (pula para o item). */}
              <nav aria-label={`Itens do formulário ${g.areaName}`} className="mt-5">
                <ol className="grid grid-cols-1 @lg:grid-cols-2 @7xl:grid-cols-4 gap-2">
                  {g.criteria.map((c, i) => (
                    <IndexItem key={c.criterionId} n={i + 1} label={displayCriterionName(c.criterionName)} state={stateOf(c)} targetId={`crit-${c.criterionId}`} />
                  ))}
                  {matrix && (
                    <IndexItem
                      n={<ShieldCheck size={13} />}
                      label="Matriz de Conformidade"
                      state={mp?.readOnly ? "locked" : mp && mp.total > 0 && mp.completed >= mp.total ? "done" : "todo"}
                      targetId={`matriz-${g.areaId}`}
                      detail={mp?.readOnly ? "respondida por outra pessoa" : mp ? `${mp.completed} de ${plural(mp.total, "item respondido", "itens respondidos")}` : undefined}
                    />
                  )}
                </ol>
              </nav>
            </header>

            <div className="divide-y divide-border">
              {g.criteria.map((c, index) => {
                const ev = getEval(c.criterionId);
                const info = criterionInfo(c.criterionId);
                const closing = info?.state === "closed" ? closingEval(c.criterionId) : undefined;
                return (
                  <div key={c.criterionId} className="px-5 sm:px-7 py-7">
                    <CriterionCard
                      criterion={c}
                      index={index}
                      total={g.criteria.length}
                      ev={ev}
                      score={currentScore(c.criterionId)}
                      comment={comments[c.criterionId] ?? ev?.comments ?? ""}
                      audio={currentAudio(c.criterionId)}
                      assignment={criterionAssignments?.find(x => x.criterionId === c.criterionId)}
                      isSaving={savingCriterionId === c.criterionId}
                      anySaving={savingCriterionId != null}
                      sharedWithOtherAreas={sharedCriterionIds?.has(c.criterionId) ?? false}
                      closedBy={info?.state === "closed" ? { name: info.answeredByName, at: info.answeredAt, viaLink: info.answeredViaLink, score: closing?.score ?? null, comment: closing?.comments ?? null } : null}
                      answeredByLinkName={info?.state === "answered" && info.answeredViaLink ? info.answeredByName : null}
                      onScoreClick={onScoreClick}
                      onCommentChange={onCommentChange}
                      onAudioChange={onAudioChange}
                      onSaveDraft={onSaveDraft}
                      onDiscardDraft={onDiscardDraft}
                      isDiscarding={isDiscarding}
                    />
                  </div>
                );
              })}
              {matrix && (
                <div id={`matriz-${g.areaId}`} data-testid={`form-matrix-${g.areaId}`} className="scroll-mt-24 px-5 sm:px-7 py-7 bg-secondary/35 rounded-b-2xl">
                  {matrix}
                </div>
              )}
            </div>
          </section>
        );
      })}
      {matrixOrphans && (
        <section aria-label="Matriz de Conformidade" className="rounded-2xl border border-border bg-card px-5 sm:px-7 py-7">
          {matrixOrphans}
        </section>
      )}
    </div>
  );
}
