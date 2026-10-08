import { CheckCircle2, Link2, Loader2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { fmtDT, publicEvalBaseUrl } from "./helpers";
import { cenografiaItemsLabel } from "./constants";
import type { ConformityLinkType, ToastFn } from "./types";
import { LinkEventLine, GeneratedLinkBox, type LinkEventInfo } from "./public-link-dialog";
import { LinkHistoryRow } from "./conformity-link-history";
import { DialogHeading, Eyebrow, btnPrimary, btnSecondary, dialogCls, inputCls } from "./ui";

interface ConformityPublicLinkDialogProps {
  linkType: ConformityLinkType | null;
  event: LinkEventInfo;
  recipientName: string;
  setRecipientName: (value: string) => void;
  generatedUrl: string | null;
  linkCopied: boolean;
  setLinkCopied: (value: boolean) => void;
  conformityHistory: PublicToken[] | undefined;
  ferramentasHistory: PublicToken[] | undefined;
  isGenerating: boolean;
  // Gera o link do tipo aberto; `base` é a origem pública usada para montar a URL.
  onGenerate: (base: string) => void;
  onClose: () => void;
  toast: ToastFn;
  /** Ciclo sem "Conduta" na matriz: o texto lista só os itens que existem. */
  withoutConduta: boolean;
}

// ── Dialog: Link para freela da Matriz de Conformidade (Cenografia / Ferramentas) ──
export function ConformityPublicLinkDialog({
  linkType, event, recipientName, setRecipientName, generatedUrl, linkCopied, setLinkCopied,
  conformityHistory, ferramentasHistory, isGenerating, onGenerate, onClose, toast, withoutConduta,
}: ConformityPublicLinkDialogProps) {
  // Um link só por formulário: se já existe um pendente, mostramos o
  // MESMO link pra reenviar; se já foi respondido, não há o que gerar.
  const hist = linkType === "cenografia" ? (conformityHistory ?? []) : (ferramentasHistory ?? []);
  const answered = hist.find(t => t.usedAt != null);
  const pending = hist.find(t => t.usedAt == null);
  const base = publicEvalBaseUrl();
  const existingUrl = pending ? `${base}/eval/${pending.id}` : null;
  const shownUrl = generatedUrl ?? existingUrl;
  const canGenerate = !!recipientName.trim() && !isGenerating;
  const formName = linkType === "cenografia" ? "Matriz de Conformidade — Cenografia" : "Matriz de Conformidade — Ferramentas e case";

  return (
    <Dialog open={linkType !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={dialogCls}>
        <DialogHeading
          icon={shownUrl && !answered ? Check : Link2}
          tone={generatedUrl ? "brand" : "neutral"}
          Title={DialogTitle}
          Description={DialogDescription}
          title={linkType === "cenografia" ? "Link para freela — Cenografia" : "Link para freela — Ferramentas"}
          description={answered
            ? "Este formulário já foi respondido pelo link."
            : shownUrl
              ? (pending && !generatedUrl
                ? <>Já existe um link enviado para <b className="font-semibold text-foreground">{pending.recipientName ?? "—"}</b> aguardando resposta. Se a pessoa perdeu, copie e reenvie o mesmo link.</>
                : "Link gerado. Copie e envie ao freela — ele vale para um único envio.")
              : linkType === "cenografia"
                ? `Um freela preenche a matriz da Cenografia (${cenografiaItemsLabel(withoutConduta)}). Só pode existir um link por evento.`
                : "Um freela responde a guarda de equipamentos. Só pode existir um link por evento."}
        />

        <div className="space-y-4">
          <LinkEventLine event={event} formName={formName} />

          {answered ? (
            <div className="rounded-xl bg-[var(--status-ok-bg)] px-4 py-3 flex items-start gap-2.5">
              <CheckCircle2 size={16} aria-hidden className="text-[var(--status-ok-text)] shrink-0 mt-0.5" />
              <p className="text-[14px] text-[var(--status-ok-text)] font-semibold">
                Respondido por {answered.submitterName ?? answered.recipientName ?? "freela"}
                {answered.usedAt ? ` em ${fmtDT(answered.usedAt)}` : ""}. Não é possível gerar outro link.
              </p>
            </div>
          ) : shownUrl ? (
            <GeneratedLinkBox
              url={shownUrl}
              copied={linkCopied}
              onCopy={async () => { if (await copyToClipboard(shownUrl)) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); } else toast(COPY_FAILED_TOAST); }}
            />
          ) : (
            <div>
              <label htmlFor="conformity-recipient" className="font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-foreground mb-1.5">
                Para quem é o link <span className="text-[var(--status-danger-text)]">· obrigatório</span>
              </label>
              <input
                id="conformity-recipient"
                type="text"
                autoComplete="off"
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && canGenerate) onGenerate(base); }}
                placeholder="Nome do freela — ex.: Fred Ribeiro"
                className={inputCls}
              />
            </div>
          )}

          {hist.length > 0 && (
            <div>
              <Eyebrow className="mb-2">Registro</Eyebrow>
              <ul className="rounded-xl border border-border divide-y divide-border max-h-44 overflow-y-auto">
                {hist.map(t => <LinkHistoryRow key={t.id} t={t} />)}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {shownUrl || answered ? "Fechar" : "Cancelar"}
          </button>
          {!shownUrl && !answered && (
            <button type="button" disabled={!canGenerate} onClick={() => { if (canGenerate) onGenerate(base); }} className={btnPrimary}>
              {isGenerating ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Gerando...</> : <><Link2 size={15} aria-hidden /> Gerar link</>}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
