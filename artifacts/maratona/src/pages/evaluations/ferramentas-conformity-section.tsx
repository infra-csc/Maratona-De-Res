import type { Dispatch, SetStateAction } from "react";
import type { EventConformity, UserSummary } from "@workspace/api-client-react";
import { CheckCircle2, Save, Link2, Copy, Loader2, AlertCircle, Lock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { ConformityLinkHistory } from "./conformity-link-history";
import { ConformityRedirectPopover } from "./conformity-redirect-popover";
import { MatrixHeader, MatrixQuestion, Segmented, matrixLabelCls, matrixTextareaCls } from "./conformity-bits";
import { fmtDT, publicEvalBaseUrl } from "./helpers";
import { Chip, btnSmall } from "./ui";
import type { ConformityEvalForm, SaveConformityFn, ToastFn } from "./types";

interface FerramentasConformitySectionProps {
  conformityEvalForm: ConformityEvalForm;
  setConformityEvalForm: Dispatch<SetStateAction<ConformityEvalForm>>;
  myConformityData: EventConformity | null | undefined;
  ferramentasPublicTokenHistory: PublicToken[] | undefined;
  ferramentasUsers: UserSummary[] | undefined;
  redirectOpen: boolean;
  onRedirectOpenChange: (open: boolean) => void;
  redirectTargetId: number | null;
  onRedirectSelect: (userId: number) => void;
  onOpenLinkDialog: () => void;
  saveConformity: SaveConformityFn;
  isSaving: boolean;
  toast: ToastFn;
  /** Guarda de equipamentos já respondida por OUTRA pessoa (link, RH…): só leitura. */
  answeredByOther?: { name: string | null; at: string | null } | null;
}

const QUESTION = "Todos os equipamentos e ferramentas retornaram?";

/** Resposta gravada, só leitura. */
function FerramentasAnswer({ data }: { data: EventConformity | null | undefined }) {
  const v = data?.guardaEquipamentos;
  const comment = data?.guardaEquipamentosComment?.trim();
  return (
    <dl className="rounded-xl border border-border bg-card px-4 sm:px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <dt className="text-[15px] font-semibold text-foreground leading-snug flex-1 min-w-[200px]">{QUESTION}</dt>
        <dd className="flex items-center gap-2">
          {v === false && <Chip tone="danger">-10 pts</Chip>}
          <span className={cn("font-condensed text-[16px] font-black uppercase", v === false ? "text-[var(--status-danger-text)]" : v === true ? "text-foreground" : "text-muted-foreground")}>
            {v === true ? "Sim" : v === false ? "Não" : "Não respondida"}
          </span>
        </dd>
      </div>
      {comment && <dd className="mt-1.5 text-[14px] text-muted-foreground break-words">“{comment}”</dd>}
    </dl>
  );
}

// ─── Matriz de Conformidade — Ferramentas e Case (guarda de equipamentos) ───
export function FerramentasConformitySection({
  conformityEvalForm, setConformityEvalForm, myConformityData, ferramentasPublicTokenHistory, ferramentasUsers,
  redirectOpen, onRedirectOpenChange, redirectTargetId, onRedirectSelect, onOpenLinkDialog, saveConformity, isSaving, toast,
  answeredByOther,
}: FerramentasConformitySectionProps) {
  const val = conformityEvalForm.guardaEquipamentos;
  const isNao = val === false;
  const commentMissing = isNao && !conformityEvalForm.guardaEquipamentosComment.trim();
  // O comentário na tela difere do que está salvo no servidor?
  const commentDirty = conformityEvalForm.guardaEquipamentosComment !== (myConformityData?.guardaEquipamentosComment ?? "");
  const canSave = !commentMissing && commentDirty;
  const hasSentLink = (ferramentasPublicTokenHistory?.length ?? 0) > 0;
  const pendingFerr = (ferramentasPublicTokenHistory ?? []).find(t => !t.usedAt);
  const answeredFerr = (ferramentasPublicTokenHistory ?? []).find(t => t.usedAt);
  const title = "Matriz de Conformidade — Ferramentas e case";

  if (answeredByOther && !hasSentLink) {
    return (
      <div className="space-y-5">
        <MatrixHeader
          title={title}
          status={<Chip icon={Lock}>Só leitura</Chip>}
          description={<>
            <span className="font-semibold text-foreground">Respondida{answeredByOther.name ? ` por ${answeredByOther.name}` : ""}{answeredByOther.at ? ` em ${fmtDT(answeredByOther.at)}` : ""}.</span>{" "}
            Se algo precisar mudar, fale com o RH.
          </>}
        />
        <FerramentasAnswer data={myConformityData} />
      </div>
    );
  }

  const linkAction = (() => {
    if (pendingFerr) {
      const pendingUrl = `${publicEvalBaseUrl()}/eval/${pendingFerr.id}`;
      return (
        <button type="button"
          onClick={async () => { if (await copyToClipboard(pendingUrl)) toast({ title: "Link copiado!", description: `Para: ${pendingFerr.recipientName ?? "freela"}` }); else toast(COPY_FAILED_TOAST); }}
          className={btnSmall}
          title="Copiar link já enviado — só existe um link por evento"
        >
          <Copy size={14} aria-hidden /> Copiar link ({pendingFerr.recipientName ?? "freela"})
        </button>
      );
    }
    if (answeredFerr) return null;
    return (
      <button type="button" onClick={onOpenLinkDialog} className={btnSmall} title="Gerar link único para um freela responder o formulário de Ferramentas">
        <Link2 size={14} aria-hidden /> Link para freela
      </button>
    );
  })();

  return (
    <div className="space-y-5">
      <MatrixHeader
        title={title}
        status={!hasSentLink && val !== null ? <Chip tone="ok" icon={CheckCircle2}>Respondida</Chip> : undefined}
        description={hasSentLink
          ? "Link enviado para um freela preencher este formulário. Acompanhe abaixo."
          : "Retorno de equipamentos e ferramentas da equipe neste evento. A resposta é salva na hora."}
        actions={<>
          <ConformityRedirectPopover open={redirectOpen} onOpenChange={onRedirectOpenChange} users={ferramentasUsers} selectedUserId={redirectTargetId} onSelectUser={onRedirectSelect} />
          {linkAction}
        </>}
      />
      {hasSentLink ? (
        <>
          {answeredFerr && myConformityData?.guardaEquipamentos != null && <FerramentasAnswer data={myConformityData} />}
          <ConformityLinkHistory history={ferramentasPublicTokenHistory ?? []} />
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <MatrixQuestion
            id="ferr-q"
            question={QUESTION}
            penalty={isNao}
            unanswered={val === null}
            control={
              <Segmented
                value={val}
                labelledBy="ferr-q"
                options={[
                  { value: null, label: "Pendente", tone: "warn" },
                  { value: true, label: "Sim", tone: "yes" },
                  { value: false, label: "Não", tone: "no" },
                ]}
                onChange={(v) => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: v })); saveConformity({ guardaEquipamentos: v }, "Resposta salva"); }}
              />
            }
          >
            {val !== null && (
              <>
                <label htmlFor="ferr-comment" className={cn(matrixLabelCls, "flex items-center gap-1.5")}>
                  Comentário {isNao ? <span className="text-[var(--status-danger-text)]">· obrigatório</span> : <span className="normal-case tracking-normal font-normal">(opcional)</span>}
                  {!commentDirty && conformityEvalForm.guardaEquipamentosComment && (
                    <span className="text-[var(--status-ok-text)] flex items-center gap-1 normal-case tracking-normal"><CheckCircle2 size={12} aria-hidden /> salvo</span>
                  )}
                </label>
                <Textarea
                  id="ferr-comment"
                  placeholder={isNao ? "Descreva o que aconteceu com os equipamentos/ferramentas..." : "Alguma observação? (opcional)"}
                  value={conformityEvalForm.guardaEquipamentosComment}
                  aria-invalid={commentMissing || undefined}
                  onChange={e => setConformityEvalForm(f => ({ ...f, guardaEquipamentosComment: e.target.value }))}
                  className={cn(matrixTextareaCls, "min-h-[72px]", commentMissing && "border-[var(--status-danger)]")}
                />
                {commentMissing && <p className="mt-1.5 text-[12px] font-semibold text-[var(--status-danger-text)]">Comentário obrigatório quando a resposta é Não.</p>}
              </>
            )}
          </MatrixQuestion>
          {/* Salvar comentário — só aparece quando há alterações */}
          {val !== null && commentDirty && (
            <div role="status" className="m-3 mt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-[var(--status-warn-bg)] px-4 py-3">
              <span className="text-[14px] font-semibold flex items-center gap-2 text-[var(--status-warn-text)]"><AlertCircle size={15} aria-hidden /> Comentário ainda não salvo</span>
              <button type="button" disabled={!canSave || isSaving}
                onClick={() => { if (canSave) saveConformity({ guardaEquipamentosComment: conformityEvalForm.guardaEquipamentosComment }, "Observação salva"); }}
                className={btnSmall}
              >{isSaving ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Save size={14} aria-hidden />} Salvar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
