import type { ReactNode } from "react";
import type { Evaluation, EventCriterion } from "@workspace/api-client-react";
import { CheckCircle2, Lock, Rocket, Loader2, ArrowDown, ShieldCheck, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { cn, plural } from "@/lib/utils";
import { displayCriterionName } from "./helpers";
import { DialogHeading, Eyebrow, btnPrimary, btnSecondary, btnGhost, dialogCls, scrollToItem } from "./ui";
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
  /** A Matriz deste evento ainda tem item sem resposta (o lançamento não a envia). */
  matrixPending?: boolean;
}

/** "Falta 1 critério" / "Faltam 2 critérios". */
export function missingLabel(n: number) {
  return n === 1 ? "Falta 1 critério" : `Faltam ${plural(n, "critério", "critérios")}`;
}

// Modal de confirmação do "Lançar avaliação" (envia e bloqueia as notas).
export function ConfirmLaunchDialog({
  open, onOpenChange, launching, toSubmitCount, eventName, onLaunch, isEvaluator, myCriteria, getEval, currentScore, matrixPending,
}: ConfirmLaunchDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!launching) onOpenChange(o); }}>
      <AlertDialogContent className={dialogCls} data-testid="dialog-confirm-launch">
        <DialogHeading
          icon={Rocket}
          tone="brand"
          Title={AlertDialogTitle}
          Description={AlertDialogDescription}
          title="Confirmar lançamento"
          description={<>
            {toSubmitCount === 1 ? "1 nota" : `${plural(toSubmitCount, "nota", "notas")}`} para <b className="font-semibold text-foreground">{eventName}</b>.
            Depois de lançadas, as notas ficam <b className="font-semibold text-foreground">bloqueadas para edição</b> e compõem a nota final da equipe.
          </>}
        />
        {isEvaluator && myCriteria.length > 0 && (
          <div>
            <Eyebrow className="mb-2">Notas que serão lançadas</Eyebrow>
            <ul className="rounded-xl border border-border divide-y divide-border max-h-60 overflow-y-auto">
              {myCriteria.map(c => {
                const ev = getEval(c.criterionId);
                const score = currentScore(c.criterionId);
                const isSubmitted = ev?.status === "submitted";
                return (
                  <li key={c.criterionId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-[14px] font-semibold text-foreground min-w-0 break-words leading-snug flex items-center gap-2">
                      {displayCriterionName(c.criterionName)}
                      {isSubmitted && <Lock size={12} aria-label="já lançado" className="shrink-0 text-muted-foreground" />}
                    </span>
                    <span className="font-condensed shrink-0 text-[20px] font-black leading-none tabular-nums text-foreground">
                      {score != null ? <>{score}<span className="text-[13px] text-muted-foreground font-bold">/10</span></> : <span className="text-muted-foreground">—</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {matrixPending && (
          <p className="rounded-lg bg-[var(--status-warn-bg)] px-3.5 py-2.5 text-[13px] text-[var(--status-warn-text)] font-semibold flex items-start gap-2">
            <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" />
            A Matriz de Conformidade ainda tem itens sem resposta. Ela não vai junto: o evento continua aberto até você terminá-la.
          </p>
        )}
        <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={launching} data-testid="button-cancel-launch" className={cn(btnSecondary, "mt-0")}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onLaunch(); }}
            disabled={launching}
            data-testid="button-confirm-launch"
            className={btnPrimary}
          >
            {launching ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Lançando...</> : "Lançar agora"}
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
  // Critérios já respondidos por outra pessoa (modo por área) → nome completo e nota de quem respondeu.
  closedNames?: Map<number, { name: string; score: number | null }>;
  // Critérios que ainda posso enviar (sem os fechados) — vão no modal.
  launchCriteria: EventCriterion[];
  /** Ciclo sem "Conduta" na matriz: o resumo não mostra a pergunta. */
  withoutConduta: boolean;
  /** Matriz de Cenografia respondida por OUTRA pessoa: não é pendência minha; vazio = "não respondida". */
  cenografiaByOther?: string | null;
  /** Primeiro critério que falta preencher (atalho "Ir para o que falta"). */
  firstPendingId?: number | null;
  /** Ids das âncoras da matriz (pular do resumo para a pergunta). */
  cenografiaAnchor?: string;
  ferramentasAnchor?: string;
}

function Row({ label, value, onClick, muted, testId, sub }: { label: ReactNode; value: ReactNode; onClick?: () => void; muted?: boolean; testId?: string; sub?: ReactNode }) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14px] leading-snug break-words", muted ? "text-muted-foreground" : "text-foreground font-semibold")}>{label}</span>
        {sub}
      </span>
      <span className="shrink-0 text-right">{value}</span>
    </>
  );
  return (
    <li data-testid={testId}>
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full flex items-start justify-between gap-3 rounded-lg px-2 -mx-2 py-1.5 text-left transition-colors duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {body}
        </button>
      ) : (
        <div className="flex items-start justify-between gap-3 py-1.5">{body}</div>
      )}
    </li>
  );
}

const pendingTag = (label = "pendente") => <span className="font-condensed text-[13px] font-bold uppercase tracking-[0.05em] text-[var(--status-warn-text)]">{label}</span>;
const scoreTag = (n: number) => <span className="font-condensed text-[20px] font-black leading-none tabular-nums text-foreground">{n}<span className="text-[13px] text-muted-foreground font-bold">/10</span></span>;

// Painel "Resumo da avaliação": progresso, o que falta (critérios + matriz),
// atalhos para cada item e o lançamento. No celular e em telas médias vem
// DEPOIS do formulário, e o botão de lançar fica fixo no rodapé.
export function EvaluationSummaryPanel({
  isEvaluator, myCriteria, getEval, currentScore, comments, progressPct, totalItems, totalCompleted, completedCount,
  extraConformityItemsTotal, extraConformityItemsCompleted, isFerramentasEvaluatorForEvent, isConformityEvaluatorForEvent,
  conformityEvalForm, allEvaled, allReady, pendingToFill, launching, confirmLaunchOpen, setConfirmLaunchOpen,
  toSubmitCount, eventName, onLaunch, closedNames, launchCriteria, withoutConduta, cenografiaByOther, firstPendingId,
  cenografiaAnchor, ferramentasAnchor,
}: EvaluationSummaryPanelProps) {
  const byOther = cenografiaByOther !== undefined && cenografiaByOther !== null;
  // Item da matriz vazio: pendência minha (âmbar) ou, se a matriz foi respondida por outra pessoa, só "não respondida".
  const emptyMark = () => byOther ? <span className="text-[13px] text-muted-foreground">não respondida</span> : pendingTag();
  // Tudo respondido por OUTRA pessoa da área (e nenhuma matriz minha): não é
  // "sua avaliação" nem "100%" — é "respondido pela área".
  const allByOthers = myCriteria.length > 0 && extraConformityItemsTotal === 0
    && !!closedNames && myCriteria.every(c => closedNames.has(c.criterionId));
  const pct = Math.round(progressPct);
  const matrixPending = extraConformityItemsCompleted < extraConformityItemsTotal;
  const yesNo = (v: boolean | null, neutral = false) => v === null ? emptyMark()
    : <span className={cn("font-condensed text-[15px] font-black uppercase", v ? "text-foreground" : neutral ? "text-foreground" : "text-[var(--status-danger-text)]")}>{v ? "Sim" : "Não"}</span>;

  return (
    <aside aria-label="Resumo da avaliação" className="@4xl:sticky @4xl:top-4">
      <div className="rounded-2xl border border-border bg-card">
        <div className="px-5 pt-5 pb-4">
          <h3 className="font-condensed text-[13px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Resumo da avaliação</h3>
          <p className="text-[13px] text-muted-foreground mt-0.5" data-testid="summary-subtitle">{allByOthers ? "Respondido pela área" : "Sua avaliação para este evento"}</p>

          {allByOthers ? (
            <p className="mt-4 text-[14px] text-foreground leading-relaxed" data-testid="summary-answered-by-area">
              {myCriteria.length === 1
                ? "O critério deste evento já foi respondido por outra pessoa da sua área. Nada a enviar por você."
                : `Os ${myCriteria.length} critérios deste evento já foram respondidos pela sua área. Nada a enviar por você.`}
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="font-condensed leading-none text-foreground">
                  <span className="text-[40px] font-black tabular-nums">{totalCompleted}</span>
                  <span className="text-[20px] font-bold text-muted-foreground"> de {totalItems}</span>
                  <span className="font-body text-[13px] font-semibold text-muted-foreground"> {totalItems === 1 ? "item concluído" : "itens concluídos"}</span>
                </p>
                <span className="font-condensed text-[15px] font-bold tabular-nums text-muted-foreground mb-1">{pct}%</span>
              </div>
              <div role="progressbar" aria-label="Itens concluídos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-2.5 h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2.5 text-[13px] text-muted-foreground leading-snug">
                {extraConformityItemsTotal > 0
                  ? `${completedCount} de ${plural(myCriteria.length, "critério respondido", "critérios respondidos")} e ${byOther ? `matriz respondida por ${cenografiaByOther}.` : `${extraConformityItemsCompleted} de ${plural(extraConformityItemsTotal, "pergunta da matriz respondida", "perguntas da matriz respondidas")}.`}`
                  : `${completedCount} de ${plural(myCriteria.length, "critério respondido", "critérios respondidos")}${closedNames && closedNames.size > 0 ? ` (${closedNames.size} ${closedNames.size === 1 ? "fechado por quem respondeu primeiro" : "fechados por quem respondeu primeiro"})` : ""}.`}
              </p>
            </>
          )}
        </div>

        {/* Itens: critérios + perguntas da Matriz (nada do que o avaliador
            responde fica de fora). Cada linha pula para o item. */}
        {isEvaluator && (myCriteria.length > 0 || extraConformityItemsTotal > 0) && (
          <div className="px-5 py-4 border-t border-border space-y-4">
            {myCriteria.length > 0 && (
              <div>
                <Eyebrow className="mb-1.5">Critérios</Eyebrow>
                <ul>
                  {myCriteria.map(c => {
                    const ev = getEval(c.criterionId);
                    const score = currentScore(c.criterionId);
                    const isSubmitted = ev?.status === "submitted";
                    const isDraft = ev?.status === "draft";
                    const commentText = comments[c.criterionId] ?? ev?.comments ?? "";
                    const missingComment = !isSubmitted && score != null && !commentText.trim();
                    const closedBy = closedNames?.get(c.criterionId);
                    const go = () => scrollToItem(`crit-${c.criterionId}`);
                    if (closedBy != null) {
                      return (
                        <Row key={c.criterionId} testId={`summary-closed-${c.criterionId}`} onClick={go} muted
                          label={<span className="inline-flex items-center gap-1.5">{displayCriterionName(c.criterionName)} <Lock size={12} aria-label="Fechado" /></span>}
                          sub={<span className="block text-[12px] text-muted-foreground" title={`Respondido por ${closedBy.name}`}>por {closedBy.name}</span>}
                          value={closedBy.score != null ? scoreTag(closedBy.score) : <span className="text-[13px] text-muted-foreground">fechado</span>}
                        />
                      );
                    }
                    return (
                      <Row key={c.criterionId} onClick={go}
                        label={<span className="inline-flex items-center gap-1.5">{displayCriterionName(c.criterionName)}{isSubmitted && <Lock size={12} aria-label="Lançado" className="text-muted-foreground" />}</span>}
                        sub={missingComment
                          ? <span className="block text-[12px] font-semibold text-[var(--status-danger-text)]">Falta preencher o comentário</span>
                          : isDraft ? <span className="block text-[12px] text-[var(--status-warn-text)]">rascunho</span>
                          : isSubmitted ? <span className="block text-[12px] text-muted-foreground">lançado</span> : undefined}
                        value={score != null ? scoreTag(score) : pendingTag("sem nota")}
                      />
                    );
                  })}
                </ul>
              </div>
            )}
            {(isFerramentasEvaluatorForEvent || isConformityEvaluatorForEvent) && (
              <div>
                <Eyebrow className="mb-1.5">Matriz de Conformidade</Eyebrow>
                <ul>
                  {isFerramentasEvaluatorForEvent && (
                    <Row label="Guarda de Equipamentos" onClick={ferramentasAnchor ? () => scrollToItem(ferramentasAnchor) : undefined}
                      value={conformityEvalForm.guardaEquipamentos === null ? pendingTag() : yesNo(conformityEvalForm.guardaEquipamentos)} />
                  )}
                  {isConformityEvaluatorForEvent && [
                    { label: "EPI", val: conformityEvalForm.epi },
                    { label: "Estaiamentos / Aterramentos", val: conformityEvalForm.estaiamentos },
                    ...(withoutConduta ? [] : [{ label: "Conduta", val: conformityEvalForm.conduta }]),
                    // Destaque não é conformidade: "Não" é a resposta comum, não uma falha.
                    { label: "Desempenho fora da curva", val: conformityEvalForm.standoutResponse, neutral: true },
                  ].map(item => (
                    <Row key={item.label} label={item.label} onClick={cenografiaAnchor ? () => scrollToItem(cenografiaAnchor) : undefined}
                      value={yesNo(item.val, "neutral" in item)} />
                  ))}
                  {isConformityEvaluatorForEvent && (
                    <Row label="Faltas/Atrasos" onClick={cenografiaAnchor ? () => scrollToItem(cenografiaAnchor) : undefined}
                      value={conformityEvalForm.absencesReport.trim() ? <span className="font-condensed text-[15px] font-black uppercase text-foreground">Respondido</span> : emptyMark()} />
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Lançamento — só avaliador */}
        {isEvaluator && myCriteria.length > 0 && (
          <div className="px-5 pb-5 pt-4 border-t border-border">
            {allEvaled ? (
              <div role="status" className="flex items-center gap-2.5 rounded-xl bg-[var(--status-ok-bg)] px-4 py-3 text-[var(--status-ok-text)]">
                <CheckCircle2 size={18} aria-hidden className="shrink-0" />
                <span className="font-condensed text-[15px] font-bold uppercase tracking-[0.04em] leading-tight">
                  {closedNames && closedNames.size === myCriteria.length ? "Sua área já respondeu este evento" : "Você já concluiu sua avaliação"}
                </span>
              </div>
            ) : (
              <div className="hidden md:block">
                {allReady ? (
                  <button data-testid="button-submit-eval" type="button" onClick={() => setConfirmLaunchOpen(true)} disabled={launching} className={cn(btnPrimary, "w-full min-h-12 text-[15px]")}>
                    {launching ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Rocket size={16} aria-hidden />} Lançar avaliação
                  </button>
                ) : (
                  <>
                    <button type="button" disabled className={cn(btnPrimary, "w-full min-h-12 text-[15px]")}>
                      <AlertCircle size={16} aria-hidden /> {missingLabel(pendingToFill)}
                    </button>
                    {firstPendingId != null && (
                      <button type="button" onClick={() => scrollToItem(`crit-${firstPendingId}`)} className={cn(btnGhost, "w-full mt-1.5")}>
                        <ArrowDown size={14} aria-hidden /> Ir para o que falta
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {!allEvaled && (
              <p className="text-[13px] text-muted-foreground mt-3 leading-relaxed">
                {allReady
                  ? <>Ao lançar, as notas são enviadas e <b className="font-semibold text-foreground">bloqueadas</b>.{matrixPending ? " A Matriz é salva a cada resposta, à parte." : ""}</>
                  : <>Cada critério precisa de nota e justificativa (o áudio é opcional). Rascunho é opcional — dá para lançar direto.</>}
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
              myCriteria={launchCriteria}
              getEval={getEval}
              currentScore={currentScore}
              matrixPending={matrixPending && !byOther}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
