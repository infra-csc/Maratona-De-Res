import type { Evaluation, EventCriterion } from "@workspace/api-client-react";
import { CheckCircle, Lock, Rocket } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { CONDENSED, AMBER_TEXT } from "@/lib/premium-theme";
import type { ConformityEvalForm } from "./types";

interface CriteriaScoreProps {
  isEvaluator: boolean;
  myCriteria: EventCriterion[];
  getEval: (criterionId: number) => Evaluation | undefined;
  currentScore: (criterionId: number) => number | null;
}

interface ConfirmLaunchDialogProps extends CriteriaScoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  launching: boolean;
  toSubmitCount: number;
  eventName: string | undefined;
  onLaunch: () => void;
}

// Modal de confirmação do "Lançar Avaliação" (submete e bloqueia as notas).
export function ConfirmLaunchDialog({
  open, onOpenChange, launching, toSubmitCount, eventName, onLaunch, isEvaluator, myCriteria, getEval, currentScore,
}: ConfirmLaunchDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!launching) onOpenChange(o); }}>
      <AlertDialogContent className="rounded-xl border-border" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }} data-testid="dialog-confirm-launch">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <Rocket size={22} className="text-accent-text" /> Confirmar lançamento
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Você está prestes a submeter {toSubmitCount} {toSubmitCount === 1 ? "avaliação" : "avaliações"} para
            {" "}<strong>{eventName}</strong>. Após o lançamento, as notas ficam
            {" "}<strong>bloqueadas para edição</strong> e compõem a nota final da equipe. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isEvaluator && myCriteria.length > 0 && (
          <div className="border border-border rounded-lg bg-secondary p-4 max-h-60 overflow-y-auto">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Resumo das Notas</p>
            <div className="space-y-2">
              {myCriteria.map(c => {
                const ev = getEval(c.criterionId);
                const score = currentScore(c.criterionId);
                const hasScore = score != null;
                const isSubmitted = ev?.status === "submitted";
                const isDraft = ev?.status === "draft";
                return (
                  <div key={c.criterionId} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold uppercase text-foreground truncate">{c.criterionName}</span>
                      {isSubmitted && <Lock size={11} className="shrink-0 text-accent-text" />}
                      {isDraft && !isSubmitted && <span className="shrink-0 text-[11px] font-black uppercase tracking-wide" style={{ color: AMBER_TEXT }}>rascunho</span>}
                    </div>
                    {hasScore ? (
                      <span className="shrink-0 text-sm font-black text-accent-text">{score}<span className="text-[11px] text-muted-foreground">/10</span></span>
                    ) : (
                      <span className="shrink-0 text-sm font-black text-muted-foreground/50">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={launching}
            data-testid="button-cancel-launch"
            className="border border-border rounded-lg font-bold uppercase text-xs tracking-wider"
          >
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onLaunch(); }}
            disabled={launching}
            data-testid="button-confirm-launch"
            className="border border-border rounded-lg bg-primary text-primary-foreground font-bold uppercase text-xs tracking-wider hover:opacity-90 disabled:opacity-60"
          >
            {launching ? "Lançando..." : "Lançar agora"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface EvaluationSummaryPanelProps extends Omit<ConfirmLaunchDialogProps, "open" | "onOpenChange"> {
  comments: Record<number, string>;
  progressPct: number;
  totalItems: number;
  totalCompleted: number;
  completedCount: number;
  extraConformityItemsTotal: number;
  extraConformityItemsCompleted: number;
  isFerramentasEvaluatorForEvent: boolean;
  isConformityEvaluatorForEvent: boolean;
  conformityEvalForm: ConformityEvalForm;
  allEvaled: boolean;
  allReady: boolean;
  pendingToFill: number;
  confirmLaunchOpen: boolean;
  setConfirmLaunchOpen: (open: boolean) => void;
}

// Painel lateral fixo "Resumo da Avaliação": progresso, resumo das notas
// (critérios + perguntas da matriz) e o fluxo de lançamento.
export function EvaluationSummaryPanel({
  isEvaluator, myCriteria, getEval, currentScore, comments, progressPct, totalItems, totalCompleted, completedCount,
  extraConformityItemsTotal, extraConformityItemsCompleted, isFerramentasEvaluatorForEvent, isConformityEvaluatorForEvent,
  conformityEvalForm, allEvaled, allReady, pendingToFill, launching, confirmLaunchOpen, setConfirmLaunchOpen,
  toSubmitCount, eventName, onLaunch,
}: EvaluationSummaryPanelProps) {
  return (
    <div className="order-1 lg:order-none sticky top-16 md:top-2 lg:top-6 space-y-6 z-10">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="bg-secondary px-5 py-4 border-b border-border">
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground" style={{ fontFamily: CONDENSED }}>Resumo da Avaliação</h3>
          <p className="text-[11px] font-bold uppercase text-muted-foreground">Sua avaliação para este evento</p>
        </div>

        <div className="p-5 border-b-2 border-border">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">Progresso</span>
            <span className="text-sm font-black text-accent-text">{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full bg-secondary border border-border h-2.5 mb-2">
            <div className="bg-accent h-full transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {extraConformityItemsTotal > 0
              ? `${totalCompleted} de ${totalItems} itens concluídos — ${completedCount} de ${myCriteria.length} critérios submetidos e ${extraConformityItemsCompleted} de ${extraConformityItemsTotal} perguntas da matriz respondidas.`
              : `${completedCount} de ${myCriteria.length} critérios submetidos.`}
          </p>
        </div>

        {/* Grade summary — evaluators only. Includes both scored
            criteria AND the extra Sim/Não questions from the
            Matriz de Conformidade (Ferramentas e Case / Cenografia),
            so nothing an avaliador has to fill out is left off the
            summary. */}
        {isEvaluator && (myCriteria.length > 0 || extraConformityItemsTotal > 0) && (
          <div className="p-5 border-b-2 border-border">
            <p className="text-xs font-bold uppercase text-muted-foreground mb-3">Resumo das Notas</p>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {myCriteria.map(c => {
                const ev = getEval(c.criterionId);
                const score = currentScore(c.criterionId);
                const hasScore = score != null;
                const isSubmitted = ev?.status === "submitted";
                const isDraft = ev?.status === "draft";
                const commentText = comments[c.criterionId] ?? ev?.comments ?? "";
                const missingComment = !isSubmitted && hasScore && !commentText.trim();
                return (
                  <div key={c.criterionId} className="space-y-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold uppercase text-foreground truncate">{c.criterionName}</span>
                        {isSubmitted && <Lock size={11} className="shrink-0 text-accent-text" />}
                        {isDraft && !isSubmitted && <span className="shrink-0 text-[11px] font-black uppercase tracking-wide" style={{ color: AMBER_TEXT }}>rascunho</span>}
                      </div>
                      {hasScore ? (
                        <span className="shrink-0 text-sm font-black text-accent-text">{score}<span className="text-[11px] text-muted-foreground">/10</span></span>
                      ) : (
                        <span className="shrink-0 text-sm font-black text-muted-foreground/50">—</span>
                      )}
                    </div>
                    {missingComment && (
                      <p className="text-[11px] font-bold uppercase text-destructive">Falta preencher o comentário</p>
                    )}
                  </div>
                );
              })}
              {isFerramentasEvaluatorForEvent && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase text-foreground truncate">Guarda de Equipamentos</span>
                  {conformityEvalForm.guardaEquipamentos === null ? (
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-wide" style={{ color: AMBER_TEXT }}>pendente</span>
                  ) : (
                    <span className={`shrink-0 text-sm font-black ${conformityEvalForm.guardaEquipamentos ? "text-accent-text" : "text-destructive"}`}>{conformityEvalForm.guardaEquipamentos ? "Sim" : "Não"}</span>
                  )}
                </div>
              )}
              {isConformityEvaluatorForEvent && [
                { label: "EPI", val: conformityEvalForm.epi },
                { label: "Estaiamentos / Aterramentos", val: conformityEvalForm.estaiamentos },
                { label: "Conduta", val: conformityEvalForm.conduta },
                { label: "Desempenho fora da curva", val: conformityEvalForm.standoutResponse },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase text-foreground truncate">{item.label}</span>
                  {item.val === null ? (
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-wide" style={{ color: AMBER_TEXT }}>pendente</span>
                  ) : (
                    <span className={`shrink-0 text-sm font-black ${item.val ? "text-accent-text" : "text-destructive"}`}>{item.val ? "Sim" : "Não"}</span>
                  )}
                </div>
              ))}
              {isConformityEvaluatorForEvent && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-bold uppercase text-foreground truncate">Faltas/Atrasos</span>
                  {conformityEvalForm.absencesReport.trim() ? (
                    <span className="shrink-0 text-sm font-black text-accent-text">Respondido</span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-wide" style={{ color: AMBER_TEXT }}>pendente</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Link Freelancer — movido para o cabeçalho de cada formulário/área */}

        {/* Submission — evaluators only */}
        {isEvaluator && myCriteria.length > 0 && (
          <div className="p-5">
            {allEvaled ? (
              <div className="flex items-center justify-center gap-2 text-accent-text bg-accent/15 border border-accent rounded-lg p-3 font-bold uppercase text-sm">
                <CheckCircle size={16} /> Você já concluiu sua avaliação
              </div>
            ) : allReady ? (
              <button
                data-testid="button-submit-eval"
                onClick={() => setConfirmLaunchOpen(true)}
                disabled={launching}
                className="w-full bg-primary text-primary-foreground border border-primary rounded-lg py-4 font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
              >
                <Rocket size={16} /> Lançar Avaliação
              </button>
            ) : (
              <button disabled className="w-full bg-secondary border border-border rounded-lg py-4 font-bold text-sm uppercase tracking-wider opacity-60 cursor-not-allowed">
                {pendingToFill} {pendingToFill === 1 ? "critério pendente" : "critérios pendentes"}
              </button>
            )}

            {!allEvaled && (
              <p className="text-[11px] text-center text-muted-foreground mt-3 leading-relaxed">
                {allReady
                  ? <>Ao lançar, suas notas são <strong>submetidas e bloqueadas</strong>. Salvar rascunho é opcional.</>
                  : <>Dê nota, preencha o comentário e grave o áudio de cada critério. <strong>Salvar rascunho é opcional</strong> — você pode lançar direto.</>}
              </p>
            )}

            <ConfirmLaunchDialog
              open={confirmLaunchOpen}
              onOpenChange={setConfirmLaunchOpen}
              launching={launching}
              toSubmitCount={toSubmitCount}
              eventName={eventName}
              onLaunch={onLaunch}
              isEvaluator={isEvaluator}
              myCriteria={myCriteria}
              getEval={getEval}
              currentScore={currentScore}
            />
          </div>
        )}
      </div>
    </div>
  );
}
