import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { EventConformity, EventDetail } from "@workspace/api-client-react";
import { MessageSquareText, ShieldCheck, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { cn, fmtNum } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { AudioPlayer } from "@/components/audio-recorder";
import { fmtDT } from "./helpers";
import { cenografiaItemCount } from "../evaluations/constants";
import { Chip, DialogHeading, Eyebrow, btnSecondary, dialogCls } from "./console-ui";
import type { ConformityKey, CritRow } from "./types";

/** Ver resposta enviada (só leitura): quem, quando, nota, comentário e áudio. */
export function ViewEvaluationDialog({ viewEvalCrit, setViewEvalCrit }: {
  viewEvalCrit: CritRow;
  setViewEvalCrit: Dispatch<SetStateAction<CritRow | null>>;
}) {
  const c = viewEvalCrit;
  const who = c.formSubmitterName ?? c.assignedToName ?? "—";
  const score = c.score;
  const rounded = score != null ? Math.round(score) : null;
  return (
    <Dialog open onOpenChange={o => { if (!o) setViewEvalCrit(null); }}>
      <DialogContent className={dialogCls} data-testid="dialog-view-evaluation">
        <DialogHeading
          icon={MessageSquareText}
          Title={DialogTitle}
          Description={DialogDescription}
          title={displayCriterionName(c.criterionName)}
          description={<>{c.areaName} · respondido por <b className="font-semibold text-foreground">{who}</b>{c.submittedAt ? <> em <span className="tabular-nums">{fmtDT(c.submittedAt)}</span></> : null}</>}
        />
        <div className="space-y-4">
          {score != null && (
            <div className="rounded-xl border border-border px-4 py-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <Eyebrow>Nota enviada</Eyebrow>
                <p className="flex items-baseline gap-1">
                  <span className="font-condensed text-[34px] font-black leading-none tabular-nums text-foreground">{fmtNum(score, Number.isInteger(score) ? 0 : 1)}</span>
                  <span className="font-condensed text-[15px] font-bold text-muted-foreground">/10</span>
                </p>
              </div>
              {/* Régua 1–10 só para leitura (a mesma escala do formulário). */}
              <div className="mt-3 grid grid-cols-10 gap-1" aria-hidden>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <span key={n} className={cn(
                    "font-condensed h-8 rounded-md flex items-center justify-center text-[13px] font-black tabular-nums",
                    n === rounded ? "bg-primary text-primary-foreground" : rounded != null && n < rounded ? "bg-secondary text-foreground/70" : "bg-secondary/50 text-muted-foreground",
                  )}>{n}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <Eyebrow className="mb-2">Comentário</Eyebrow>
            {c.comments
              ? <p className="rounded-xl bg-secondary/60 px-4 py-3 text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">{c.comments}</p>
              : <p className="text-[14px] text-muted-foreground">Sem comentário registrado.</p>}
          </div>
          {c.audioUrl && (
            <div>
              <Eyebrow className="mb-2">Áudio</Eyebrow>
              <AudioPlayer objectPath={c.audioUrl} className="w-full" />
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <button type="button" onClick={() => setViewEvalCrit(null)} className={btnSecondary}>Fechar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Answer({ val }: { val: boolean | null | undefined }) {
  if (val == null) return <Chip>Pendente</Chip>;
  return val ? <Chip tone="ok">Sim</Chip> : <Chip tone="danger">Não</Chip>;
}

function Item({ label, val, comment, children }: { label: string; val?: boolean | null; comment?: string | null; children?: ReactNode }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-foreground">{label}</span>
        {children ?? <Answer val={val} />}
      </div>
      {comment && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">“{comment}”</p>}
    </li>
  );
}

/** Ver Matriz de Conformidade (só leitura). */
export function ViewConformityDialog({ viewConformity, setViewConformity, conformity, selectedDetail }: {
  viewConformity: ConformityKey;
  setViewConformity: Dispatch<SetStateAction<ConformityKey | null>>;
  conformity: EventConformity;
  selectedDetail: EventDetail | undefined;
}) {
  const ceno = viewConformity === "cenografia";
  const who = ceno ? selectedDetail?.conformityEvaluatorName : selectedDetail?.conformityEvaluatorFerramentasName;
  return (
    <Dialog open onOpenChange={o => { if (!o) setViewConformity(null); }}>
      <DialogContent className={dialogCls} data-testid="dialog-view-conformity">
        <DialogHeading
          icon={ceno ? ShieldCheck : Wrench}
          Title={DialogTitle}
          Description={DialogDescription}
          title={ceno ? "Matriz de Conformidade" : "Guarda de Ferramentas"}
          description={<>{ceno ? `Cenografia · ${cenografiaItemCount(selectedDetail?.conformityWithoutConduta)} itens` : "Ferramentas e Case · 1 item"} · responsável <b className="font-semibold text-foreground">{who ?? "—"}</b></>}
        />
        <ul className="rounded-xl border border-border divide-y divide-border">
          {ceno ? (
            <>
              <Item label="Uso de EPI" val={conformity.epi} comment={conformity.epiComment} />
              <Item label="Estaiamentos" val={conformity.estaiamentos} comment={conformity.estaiamentosComment} />
              {/* Ciclo sem "Conduta" na matriz: a pergunta não existe (nem aparece). */}
              {!selectedDetail?.conformityWithoutConduta && <Item label="Conduta" val={conformity.conduta} comment={conformity.condutaComment} />}
              <li className="px-4 py-3">
                <span className="text-[14px] font-semibold text-foreground">Faltas e atrasos</span>
                <p className={cn("mt-1 text-[13px] leading-snug whitespace-pre-wrap", conformity.absencesReport ? "text-foreground" : "text-muted-foreground")}>{conformity.absencesReport || "Sem registro."}</p>
              </li>
              {conformity.standoutResponse != null && (
                <Item label="Destaque no evento" val={conformity.standoutResponse} comment={conformity.standoutJustification} />
              )}
            </>
          ) : (
            <Item label="Guarda de Equipamentos" val={conformity.guardaEquipamentos} comment={conformity.guardaEquipamentosComment} />
          )}
        </ul>
        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <button type="button" onClick={() => setViewConformity(null)} className={btnSecondary}>Fechar</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
