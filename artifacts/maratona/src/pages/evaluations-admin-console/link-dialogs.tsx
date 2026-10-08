import type { Dispatch, SetStateAction } from "react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { Check, Link2, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { DialogHeading, Notice, btnGhost, btnPrimary, btnSecondary, dialogCls, inputCls } from "./console-ui";
import { AreaEvaluatorSelect } from "./pickers";
import { LinkEventCard, LinkHistory, LinkItems, LinkUrlBox } from "./link-bits";
import type { ToastFn } from "./use-event-mutations";
import type { ConformityLinkDialogState, LinkDialogState } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;
const labelCls = "font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-foreground mb-1.5";

/** Link para freela (critérios de uma área / de um avaliador). */
export function LinkDialog(props: {
  linkDialog: LinkDialogState;
  setLinkDialog: SetState<LinkDialogState | null>;
  linkRecipientName: string;
  setLinkRecipientName: SetState<string>;
  generatedLinkUrl: string | null;
  setGeneratedLinkUrl: SetState<string | null>;
  linkCopied: boolean;
  setLinkCopied: SetState<boolean>;
  /** Link pendente reaproveitado pela API — nome de quem responde atualizado para este valor. */
  linkReusedName: string | null;
  setLinkReusedName: SetState<string | null>;
  handleGenerateLink: () => void;
  generating: boolean;
  allTokens: AdminPublicToken[] | undefined;
  batchEventHeader: string;
  toast: ToastFn;
}) {
  const {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName, generatedLinkUrl, setGeneratedLinkUrl,
    linkCopied, setLinkCopied, linkReusedName, setLinkReusedName, handleGenerateLink, generating, allTokens, batchEventHeader, toast,
  } = props;
  const needsEvaluator = linkDialog.areaMode && linkDialog.assignedToId == null;
  const close = () => { setLinkDialog(null); setGeneratedLinkUrl(null); };
  const relevantTokens = (allTokens ?? []).filter(t =>
    (t.tokenType === "criteria" || t.tokenType === "criteria_with_conformity")
    && (t.criterionIds ?? []).some(id => linkDialog.criterionIds.includes(id)),
  );
  const generate = () => { if (!generating && !needsEvaluator) handleGenerateLink(); };
  return (
    <Dialog open onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className={dialogCls} data-testid="dialog-freela-link">
        <DialogHeading
          icon={generatedLinkUrl ? Check : Link2}
          tone={generatedLinkUrl ? "brand" : "neutral"}
          Title={DialogTitle}
          Description={DialogDescription}
          title={generatedLinkUrl ? "Link pronto" : "Link para freela"}
          description={generatedLinkUrl
            ? <>Copie e envie. A resposta conta como a de <b className="font-semibold text-foreground">{linkDialog.assignedToName ?? "avaliador da área"}</b>.</>
            : linkDialog.areaMode
              ? <>Um freela responde o formulário de <b className="font-semibold text-foreground">{linkDialog.areaName}</b> em nome de um avaliador da área.</>
              : <>Um freela responde estes critérios em nome de <b className="font-semibold text-foreground">{linkDialog.assignedToName}</b>.</>}
        />

        <div className="space-y-4">
          <LinkEventCard
            header={batchEventHeader}
            formLine={linkDialog.areaMode
              ? <>Formulário <b className="font-semibold">{linkDialog.areaName}</b></>
              : <>Avaliador <b className="font-semibold">{linkDialog.assignedToName}</b></>}
          />
          <LinkItems names={linkDialog.criterionNames} withMatrix={linkDialog.includeConformity} />

          {/* Ciclo por área: em nome de qual avaliador da área o link responde. */}
          {linkDialog.areaMode && linkDialog.areaId != null && (
            <div>
              <label htmlFor="link-area-evaluator" className={labelCls}>
                Em nome de qual avaliador? <span className="text-[var(--status-danger-text)]">· obrigatório</span>
              </label>
              <AreaEvaluatorSelect
                id="link-area-evaluator"
                areaId={linkDialog.areaId}
                areaName={linkDialog.areaName}
                value={linkDialog.assignedToId}
                onChange={(userId, name) => {
                  setLinkDialog(d => d ? { ...d, assignedToId: userId, assignedToName: name } : d);
                  setGeneratedLinkUrl(null);
                  setLinkReusedName(null);
                }}
              />
              <p className="text-[12.5px] mt-1.5 leading-snug text-muted-foreground">
                No ciclo por área, a resposta do link conta como a desse avaliador de {linkDialog.areaName}.
              </p>
            </div>
          )}

          {!generatedLinkUrl ? (
            <div>
              <label htmlFor="link-recipient" className={labelCls}>
                Para quem é o link <span className="font-body normal-case tracking-normal font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                id="link-recipient"
                type="text"
                autoComplete="off"
                value={linkRecipientName}
                onChange={e => setLinkRecipientName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") generate(); }}
                placeholder="Nome do freela — ex.: João da Silva"
                className={inputCls}
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              {linkReusedName && (
                <Notice icon={RotateCcw} tone="warn" testId="link-reused-notice">
                  <b className="font-semibold">Link já existente reaproveitado</b> — o nome foi atualizado para {linkReusedName}. O mesmo link continua valendo.
                </Notice>
              )}
              <LinkUrlBox
                id="freela-link-url"
                url={generatedLinkUrl}
                copied={linkCopied}
                onCopy={async () => {
                  const text = `${batchEventHeader} — ${linkDialog.assignedToName ?? "Avaliador"}: ${generatedLinkUrl}`;
                  if (await copyToClipboard(text)) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }
                  else toast(COPY_FAILED_TOAST);
                }}
              />
            </div>
          )}

          <LinkHistory tokens={relevantTokens} />
        </div>

        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          {generatedLinkUrl ? (
            <>
              <button type="button" onClick={() => { setGeneratedLinkUrl(null); setLinkReusedName(null); setLinkRecipientName(""); setLinkCopied(false); }} className={btnGhost}>
                <Link2 size={14} aria-hidden /> Gerar outro link
              </button>
              <button type="button" onClick={close} className={btnSecondary}>Fechar</button>
            </>
          ) : (
            <>
              <button type="button" onClick={close} className={btnSecondary}>Cancelar</button>
              <button
                type="button"
                data-testid="button-generate-freela-link"
                onClick={generate}
                disabled={generating || needsEvaluator}
                title={needsEvaluator ? "Escolha antes o avaliador da área" : undefined}
                className={btnPrimary}
              >
                {generating ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Gerando...</> : <><Link2 size={15} aria-hidden /> Gerar link</>}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Link para freela da Matriz de Conformidade (Cenografia ou Ferramentas). */
export function ConformityLinkDialog(props: {
  conformityLinkDialog: ConformityLinkDialogState;
  setConformityLinkDialog: SetState<ConformityLinkDialogState | null>;
  conformityLinkRecipientName: string;
  setConformityLinkRecipientName: SetState<string>;
  conformityLinkUrl: string | null;
  setConformityLinkUrl: SetState<string | null>;
  conformityLinkCopied: boolean;
  setConformityLinkCopied: SetState<boolean>;
  handleGenerateConformityLink: () => void;
  generating: boolean;
  batchEventHeader: string;
  toast: ToastFn;
}) {
  const {
    conformityLinkDialog, setConformityLinkDialog, conformityLinkRecipientName, setConformityLinkRecipientName,
    conformityLinkUrl, setConformityLinkUrl, conformityLinkCopied, setConformityLinkCopied,
    handleGenerateConformityLink, generating, batchEventHeader, toast,
  } = props;
  const canGenerate = !!conformityLinkRecipientName.trim() && !generating;
  const close = () => setConformityLinkDialog(null);
  return (
    <Dialog open onOpenChange={o => { if (!o) close(); }}>
      <DialogContent className={dialogCls} data-testid="dialog-conformity-link">
        <DialogHeading
          icon={conformityLinkUrl ? Check : ShieldCheck}
          tone={conformityLinkUrl ? "brand" : "neutral"}
          Title={DialogTitle}
          Description={DialogDescription}
          title={conformityLinkUrl ? "Link pronto" : `Link · ${conformityLinkDialog.label}`}
          description={conformityLinkUrl
            ? <>Copie e envie para <b className="font-semibold text-foreground">{conformityLinkRecipientName.trim() || "o freela"}</b>.</>
            : <>Um freela preenche a {conformityLinkDialog.key === "cenografia" ? "Matriz de Conformidade da Cenografia" : "Guarda de Ferramentas"} deste evento.</>}
        />
        <div className="space-y-4">
          <LinkEventCard
            header={batchEventHeader}
            formLine={conformityLinkDialog.evaluatorName ? <>Responsável <b className="font-semibold">{conformityLinkDialog.evaluatorName}</b></> : undefined}
          />
          {!conformityLinkUrl ? (
            <div>
              <label htmlFor="conformity-link-recipient" className={labelCls}>
                Para quem é o link <span className="text-[var(--status-danger-text)]">· obrigatório</span>
              </label>
              <input
                id="conformity-link-recipient"
                type="text"
                autoComplete="off"
                value={conformityLinkRecipientName}
                onChange={e => setConformityLinkRecipientName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && canGenerate) handleGenerateConformityLink(); }}
                placeholder="Nome do freela — ex.: João da Silva"
                className={inputCls}
              />
            </div>
          ) : (
            <LinkUrlBox
              id="conformity-link-url"
              url={conformityLinkUrl}
              copied={conformityLinkCopied}
              onCopy={async () => {
                const text = `${batchEventHeader} — Matriz ${conformityLinkDialog?.label ?? "de Conformidade"}: ${conformityLinkUrl}`;
                if (await copyToClipboard(text)) { setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2000); }
                else toast(COPY_FAILED_TOAST);
              }}
            />
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          {conformityLinkUrl ? (
            <>
              <button type="button" onClick={() => { setConformityLinkUrl(null); setConformityLinkRecipientName(""); }} className={btnGhost}>
                <Link2 size={14} aria-hidden /> Gerar outro link
              </button>
              <button type="button" onClick={close} className={btnSecondary}>Fechar</button>
            </>
          ) : (
            <>
              <button type="button" onClick={close} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-generate-conformity-link" disabled={!canGenerate} onClick={handleGenerateConformityLink} className={btnPrimary}
                title={!conformityLinkRecipientName.trim() ? "Informe para quem é o link" : undefined}>
                {generating ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Gerando...</> : <><Link2 size={15} aria-hidden /> Gerar link</>}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
