// Um critério da calibração. À esquerda, a evidência (respostas por área,
// justificativa, histórico e comentários); à direita, a decisão (peso, nota das
// áreas, nota calibrada e publicação). No celular/tablet a decisão vem logo
// abaixo do nome, antes da evidência.
import type React from "react";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { cn, fmtNum, plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import type { AdminPublicToken } from "@/lib/routing-api";
import { Chip, btnSmall } from "../evaluations/ui";
import { fieldCls } from "./cal-ui";
import { fmtCalScore } from "./helpers";
import type { DerivedCriteria } from "./derive";
import { EvaluatorScores } from "./evaluator-scores";
import { CalibrationReasonEditor } from "./calibration-reason-editor";
import { CalibrationAuditTrail } from "./calibration-audit-trail";
import { CriterionComments } from "./criterion-comments";
import { PublishStatusCell } from "./publish-status-cell";
import type {
  AddCommentMutation,
  CalibrationAuditItem,
  CalibrationCommentItem,
  DeleteCommentMutation,
  EventCriterion,
  PublishIntent,
  ToastFn,
} from "./types";

// Props comuns a todas as linhas (estado e ações vêm do componente pai).
export type CriterionRowSharedProps = {
  getAreaScores: DerivedCriteria["getAreaScores"];
  getMembers: DerivedCriteria["getMembers"];
  getAvgScore: DerivedCriteria["getAvgScore"];
  /** Links do evento (admin/RH) — para "via link: Freela". */
  tokens: AdminPublicToken[] | undefined;
  getCalibration: DerivedCriteria["getCalibration"];
  childCriterionIdsMap: DerivedCriteria["childCriterionIdsMap"];
  activeCriteria: EventCriterion[];
  calScores: Record<number, string>;
  setCalScores: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  calReasons: Record<number, string>;
  setCalReasons: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  savedReasonIds: Set<number>;
  setSavedReasonIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  savingCritId: number | null;
  savingAll: boolean;
  saveCalibration: (critId: number) => Promise<void>;
  expandedEvalComments: Set<string>;
  setExpandedEvalComments: React.Dispatch<React.SetStateAction<Set<string>>>;
  calAudit: CalibrationAuditItem[] | undefined;
  calComments: CalibrationCommentItem[] | undefined;
  newCommentTexts: Record<number, string>;
  setNewCommentTexts: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  canFinalize: boolean;
  addCommentMutation: AddCommentMutation;
  deleteCommentMutation: DeleteCommentMutation;
  toast: ToastFn;
  canEditWeights: boolean;
  weightEdits: Record<number, string>;
  setWeightEdits: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  savingWeightId: number | null;
  updateWeightPending: boolean;
  saveWeight: (critId: number, active: boolean) => void;
  publishIntents: Record<number, PublishIntent>;
  setPublishIntents: React.Dispatch<React.SetStateAction<Record<number, PublishIntent>>>;
};

export type CriterionRowProps = CriterionRowSharedProps & { c: EventCriterion };

const LABEL = "font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] leading-none text-muted-foreground mb-2";

export function CriterionRow(props: CriterionRowProps) {
  const {
    c, getMembers, getAvgScore, tokens, getCalibration, calScores, setCalScores, calReasons, setCalReasons,
    savedReasonIds, setSavedReasonIds, savingCritId, savingAll, saveCalibration, calAudit, calComments,
    newCommentTexts, setNewCommentTexts, canFinalize, addCommentMutation, deleteCommentMutation, toast,
    canEditWeights, weightEdits, setWeightEdits, savingWeightId, updateWeightPending, saveWeight,
    publishIntents, setPublishIntents,
  } = props;
  const id = c.criterionId;
  const name = displayCriterionName(c.criterionName);
  const members = getMembers(id);
  const multiArea = members.length > 1;
  const answeredAreas = members.filter(m => m.answers.length > 0).length;
  const answerCount = members.reduce((n, m) => n + m.answers.length, 0);
  const avg = getAvgScore(id);
  const cal = getCalibration(id);
  // Number(): o contrato diz number, mas colunas numeric do Postgres podem chegar como string.
  const calVal = cal ? Number(cal.calibratedScore) : null;
  // Nota salva no padrão brasileiro ("8,5", não "8.5"); inteiro fica sem casas.
  const scoreVal = calScores[id] ?? (calVal != null ? fmtCalScore(calVal) : "");
  const isSaving = savingCritId === id;
  const peso = c.weightOverride ?? c.originalWeight ?? 0;
  const hasUnsaved = calScores[id] !== undefined;
  const changedFromSaved = hasUnsaved && String(calVal) !== calScores[id];
  const typed = calScores[id];
  const invalid = typed !== undefined && typed !== "" && Number(typed) > 10;
  const justSaved = savedReasonIds.has(id) && !hasUnsaved;
  const reasonVal = calReasons[id] ?? (cal?.calibrationReason ?? "");
  const reasonChanged = calReasons[id] !== undefined && calReasons[id] !== (cal?.calibrationReason ?? "");
  const weightDirty = weightEdits[id] != null && Number(weightEdits[id].replace(",", ".")) !== Number(peso);
  const savingWeight = savingWeightId === id && updateWeightPending;

  const scoreState: "invalid" | "dirty" | "saved" | "empty" = invalid ? "invalid" : changedFromSaved ? "dirty" : calVal != null ? "saved" : "empty";
  const scoreHint = {
    invalid: <span className="text-[var(--status-danger-text)] inline-flex items-center gap-1"><AlertCircle size={12} aria-hidden /> De 0 a 10</span>,
    dirty: <span className="text-[var(--status-warn-text)]">Não salva</span>,
    saved: <span className={cn("inline-flex items-center gap-1", justSaved ? "text-[var(--status-ok-text)]" : "text-muted-foreground")}><Check size={12} aria-hidden /> {justSaved ? "Salva agora" : "Salva"}</span>,
    empty: <span className="text-muted-foreground">Sem calibração</span>,
  }[scoreState];

  return (
    <article
      role="listitem"
      data-testid={`row-cal-${id}`}
      aria-labelledby={`cal-crit-name-${id}`}
      className="p-4 sm:p-5 grid gap-x-6 gap-y-4 @2xl:grid-cols-[minmax(0,1fr)_252px] @4xl:grid-cols-[minmax(0,1fr)_288px] transition-colors duration-200"
    >
      {/* Nome e selos */}
      <header className="min-w-0 @2xl:col-start-1">
        <h3 id={`cal-crit-name-${id}`} className="font-condensed text-[21px] font-black uppercase leading-[1.05] tracking-[-0.005em] text-foreground break-words">{name}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {multiArea
            ? <Chip title="Critério de várias áreas: a nota é a média das áreas que responderam">{members.length} áreas · média das áreas</Chip>
            : c.responsibleAreaName && <Chip>{c.responsibleAreaName}</Chip>}
          {!c.active && <Chip tone="warn" title="Critério desativado neste evento, mas com calibração salva">Desativado no evento</Chip>}
          {Number(peso) === 0 && <Chip title="Peso 0: o critério não entra na nota do evento">Fora da nota · peso 0</Chip>}
        </div>
      </header>

      {/* Decisão: peso, nota das áreas, nota calibrada e publicação */}
      <div className="min-w-0 rounded-xl bg-secondary/45 p-3 @2xl:p-0 @2xl:pl-6 @2xl:rounded-none @2xl:bg-transparent @2xl:col-start-2 @2xl:row-start-1 @2xl:row-span-2 @2xl:border-l @2xl:border-border">
        <div className="grid grid-cols-[60px_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-start">
          {/* Peso */}
          <div className="min-w-0">
            {canEditWeights ? (
              <>
                <label htmlFor={`cal-weight-${id}`} className={LABEL}>Peso</label>
                <input
                  id={`cal-weight-${id}`}
                  data-testid={`input-weight-${id}`}
                  aria-label={`Peso de ${name}`}
                  type="text"
                  inputMode="decimal"
                  value={weightEdits[id] ?? String(peso)}
                  onChange={e => setWeightEdits(prev => ({ ...prev, [id]: e.target.value.replace(/[^0-9.,]/g, "") }))}
                  className={cn(fieldCls, "w-full h-11 px-2 text-center font-condensed text-[19px] font-black tabular-nums", weightDirty && "border-[var(--status-warn)] bg-[var(--status-warn-bg)]")}
                />
              </>
            ) : (
              <>
                <span className={LABEL}>Peso</span>
                <span className="font-condensed block h-11 leading-[44px] text-[19px] font-black tabular-nums text-foreground">{peso}</span>
              </>
            )}
          </div>

          {/* Nota das áreas (avaliadores) */}
          <div className="min-w-0" title="Nota enviada pela área; no critério de várias áreas, a média das áreas que responderam">
            <span className={LABEL}>Áreas</span>
            <span className={cn("font-condensed block h-11 leading-[44px] text-[22px] font-black tabular-nums",
              calVal != null ? "text-muted-foreground line-through decoration-2 decoration-muted-foreground/60" : "text-foreground")}>
              {avg != null ? fmtNum(avg, 2) : "—"}
            </span>
            <span className="block text-[12px] leading-tight text-muted-foreground mt-1">
              {multiArea ? `${answeredAreas}/${members.length} áreas` : answerCount > 1 ? plural(answerCount, "resposta") : answerCount === 1 ? "1 área" : "Sem resposta"}
            </span>
          </div>

          {/* Nota calibrada */}
          <div className="min-w-0">
            <label htmlFor={`cal-score-${id}`} className={cn(LABEL, "text-foreground")}>Calibrada</label>
            <input
              id={`cal-score-${id}`}
              data-testid={`input-cal-score-${id}`}
              type="text"
              inputMode="numeric"
              value={scoreVal}
              onChange={e => setCalScores(prev => ({ ...prev, [id]: e.target.value.replace(/[^0-9]/g, "") }))}
              onKeyDown={e => { if (e.key === "Enter" && changedFromSaved && !invalid && !isSaving && !savingAll) void saveCalibration(id); }}
              placeholder="—"
              aria-invalid={invalid || undefined}
              aria-describedby={`cal-score-hint-${id}`}
              className={cn(fieldCls, "w-full h-11 px-2 text-center font-condensed text-[22px] font-black tabular-nums",
                scoreState === "invalid" && "border-[var(--status-danger)] bg-[var(--status-danger-bg)] focus:ring-[var(--status-danger)]/25",
                scoreState === "dirty" && "border-[var(--status-warn)] bg-[var(--status-warn-bg)]",
                scoreState === "saved" && "border-[var(--status-ok)] bg-[var(--status-ok-bg)]",
                scoreState === "empty" && "border-dashed")}
            />
            <span id={`cal-score-hint-${id}`} className="block text-[12px] leading-tight font-semibold mt-1" aria-live="polite">{scoreHint}</span>
          </div>
        </div>

        {(changedFromSaved || weightDirty) && (
          <div className="mt-3 flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 duration-150">
            {changedFromSaved && (
              <button
                data-testid={`button-save-cal-${id}`}
                type="button"
                disabled={isSaving || savingAll || invalid}
                onClick={() => void saveCalibration(id)}
                title="Salvar a nota calibrada (não publica)"
                className={cn(btnSmall, "w-full bg-primary text-primary-foreground border-primary enabled:hover:bg-primary enabled:hover:opacity-90")}
              >
                {isSaving ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={14} aria-hidden /> Salvar nota calibrada</>}
              </button>
            )}
            {weightDirty && (
              <button
                data-testid={`button-save-weight-${id}`}
                type="button"
                disabled={savingWeight}
                onClick={() => saveWeight(id, c.active)}
                title="Salvar peso"
                className={cn(btnSmall, "w-full")}
              >
                {savingWeight ? <><Loader2 size={14} className="animate-spin" aria-hidden /> Salvando peso…</> : <><Check size={14} aria-hidden /> Salvar peso</>}
              </button>
            )}
          </div>
        )}

        <PublishStatusCell
          c={c}
          cal={cal}
          avg={avg}
          isFinalPublished={!!c.finalPublishedAt}
          canFinalize={canFinalize}
          publishIntents={publishIntents}
          setPublishIntents={setPublishIntents}
        />
      </div>

      {/* Evidência e registro */}
      <div className="min-w-0 @2xl:col-start-1 space-y-4">
        <EvaluatorScores criterionId={id} members={members} avg={avg} tokens={tokens} setCalReasons={setCalReasons} />
        <CalibrationReasonEditor
          criterionId={id}
          cal={cal}
          calVal={calVal}
          reasonVal={reasonVal}
          reasonChanged={reasonChanged}
          isSaving={isSaving}
          savedReasonIds={savedReasonIds}
          setSavedReasonIds={setSavedReasonIds}
          setCalReasons={setCalReasons}
          saveCalibration={saveCalibration}
        />
        <CalibrationAuditTrail criterionId={id} calAudit={calAudit} />
        <CriterionComments
          criterionId={id}
          criterionName={name}
          calComments={calComments}
          newCommentTexts={newCommentTexts}
          setNewCommentTexts={setNewCommentTexts}
          canFinalize={canFinalize}
          addCommentMutation={addCommentMutation}
          deleteCommentMutation={deleteCommentMutation}
          toast={toast}
        />
      </div>
    </article>
  );
}
