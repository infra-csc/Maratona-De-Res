import type { EventCriterion } from "@workspace/api-client-react";
import { Link2, Copy, CheckCheck, Trash2, AlertCircle, Loader2, CalendarDays, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { displayCriterionName } from "./helpers";
import { cenografiaItemsLabel } from "./constants";
import { LinkHistoryRow } from "./conformity-link-history";
import { DialogHeading, Eyebrow, btnPrimary, btnSecondary, dialogCls, inputCls } from "./ui";
import type { PublicLinkEligibleCriterion, ToastFn } from "./types";

/** Evento do link: o avaliador confere para qual evento está gerando. */
export type LinkEventInfo = { name: string; detail: string | null } | null;

/** "Evento" no topo dos diálogos de link para freela (e, opcionalmente, o formulário). */
export function LinkEventLine({ event, formName }: { event: LinkEventInfo; formName?: string | null }) {
  if (!event) return null;
  return (
    <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 flex items-start gap-3" data-testid="public-link-event">
      <CalendarDays size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <Eyebrow>Evento</Eyebrow>
        <p className="font-condensed mt-1 text-[17px] font-black uppercase leading-tight break-words text-foreground">{event.name}</p>
        {event.detail && <p className="text-[13px] text-muted-foreground mt-0.5">{event.detail}</p>}
        {formName && <p className="text-[13px] text-foreground mt-1.5">Formulário <b className="font-semibold">{formName}</b></p>}
      </div>
    </div>
  );
}

/** URL gerada, pronta para copiar (campo só leitura + botão com retorno). */
export function GeneratedLinkBox({ url, copied, onCopy }: { url: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <label className="sr-only" htmlFor="generated-link">Link gerado</label>
      <input id="generated-link" readOnly value={url} onFocus={e => e.currentTarget.select()} className={cn(inputCls, "font-mono text-[13px] bg-secondary/60")} />
      <button type="button" onClick={onCopy} className={cn(btnPrimary, "sm:shrink-0 min-w-[120px]")} aria-live="polite">
        {copied ? <><CheckCheck size={15} aria-hidden /> Copiado</> : <><Copy size={15} aria-hidden /> Copiar</>}
      </button>
    </div>
  );
}

interface PublicLinkDialogProps {
  criteriaIds: number[] | null;
  event: LinkEventInfo;
  areaName: string | null;
  recipientName: string;
  setRecipientName: (value: string) => void;
  includeConformity: boolean;
  setIncludeConformity: (value: boolean) => void;
  forceConformity: boolean;
  /**
   * Pode incluir a Matriz de Conformidade? Só o responsável pela matriz do
   * evento, e só enquanto ela não tem resposta (o servidor confere igual).
   */
  canIncludeConformity: boolean;
  /** Ciclo sem "Conduta" na matriz: a lista de itens não a mostra. */
  withoutConduta: boolean;
  generatedUrl: string | null;
  linkCopied: boolean;
  setLinkCopied: (value: boolean) => void;
  eligibleCriteria: PublicLinkEligibleCriterion[] | undefined;
  activeCriteria: EventCriterion[];
  history: PublicToken[] | undefined;
  isGenerating: boolean;
  isDeleting: boolean;
  onGenerate: (linkCriterionIds: number[]) => void;
  onDeleteToken: (tokenId: string) => void;
  onClose: () => void;
  toast: ToastFn;
}

// Link único por formulário/área para um freela responder.
export function PublicLinkDialog({
  criteriaIds, event, areaName, recipientName, setRecipientName, includeConformity, setIncludeConformity, forceConformity,
  canIncludeConformity, withoutConduta, generatedUrl, linkCopied, setLinkCopied, eligibleCriteria, activeCriteria, history, isGenerating, isDeleting,
  onGenerate, onDeleteToken, onClose, toast,
}: PublicLinkDialogProps) {
  // Critérios do formulário que o backend aceita num link público
  // (interseção entre os critérios da área e os elegíveis). Os que
  // ficaram de fora precisam ser respondidos pelo próprio avaliador.
  const requestedIds = criteriaIds ?? [];
  const eligibleById = new Map((eligibleCriteria ?? []).map(c => [c.criterionId, c]));
  const dialogEligible = requestedIds.flatMap(id => { const c = eligibleById.get(id); return c ? [c] : []; });
  const excluded = requestedIds
    .filter(id => !eligibleById.has(id))
    .map(id => displayCriterionName(activeCriteria.find(c => c.criterionId === id)?.criterionName) || `critério #${id}`);
  const linkCriterionIds = requestedIds.filter(id => eligibleById.has(id));
  const noEligible = linkCriterionIds.length === 0;
  const canGenerate = !!recipientName.trim() && !isGenerating && !noEligible;

  return (
    <Dialog open={criteriaIds !== null} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={dialogCls}>
        <DialogHeading
          icon={generatedUrl ? Check : Link2}
          tone={generatedUrl ? "brand" : "neutral"}
          Title={DialogTitle}
          Description={DialogDescription}
          title={generatedUrl ? "Link pronto" : "Link para freela"}
          description={generatedUrl
            ? <>Copie e envie para <b className="font-semibold text-foreground">{recipientName}</b>. O link vale para um único envio.</>
            : "Um freela responde este formulário por você. A resposta dele vale como a sua e o link expira no primeiro envio."}
        />

        <div className="space-y-4">
          <LinkEventLine event={event} formName={areaName} />

          {eligibleCriteria !== undefined && (dialogEligible.length === 0 ? (
            <div data-testid="notice-public-link-no-criteria" role="alert" className="rounded-xl bg-[var(--status-danger-bg)] px-4 py-3 flex items-start gap-2.5">
              <AlertCircle size={16} aria-hidden className="shrink-0 mt-0.5 text-[var(--status-danger-text)]" />
              <div className="space-y-1 text-[var(--status-danger-text)]">
                <p className="text-[14px] font-semibold">Nenhum critério disponível para link</p>
                <p className="text-[13px] leading-snug">
                  Nenhum dos critérios deste formulário pode ir num link de freela — em geral porque a área já respondeu, o critério não permite link ou está com outra pessoa. Responda os critérios diretamente nesta tela.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <Eyebrow className="mb-2">No link · {dialogEligible.length + (canIncludeConformity && includeConformity ? 1 : 0)}</Eyebrow>
              <ul className="flex flex-wrap gap-1.5">
                {dialogEligible.map(c => (
                  <li key={c.criterionId} className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8 text-[13px] font-semibold text-foreground">
                    <Check size={13} aria-hidden className="text-[var(--status-ok-text)]" /> {displayCriterionName(c.criterionName)}
                  </li>
                ))}
                {canIncludeConformity && includeConformity && (
                  <li className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8 text-[13px] font-semibold text-foreground">
                    <Check size={13} aria-hidden className="text-[var(--status-ok-text)]" /> Matriz de Conformidade
                  </li>
                )}
              </ul>
              {excluded.length > 0 && (
                <div data-testid="notice-public-link-partial" className="mt-3 rounded-lg bg-[var(--status-warn-bg)] px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-[var(--status-warn-text)] flex items-center gap-1.5">
                    <AlertCircle size={13} aria-hidden /> Fora do link: {excluded.join(", ")}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                    Já respondidos, sem permissão de link ou com outra pessoa — continuam sendo respondidos nesta tela.
                  </p>
                </div>
              )}
            </div>
          ))}

          {!generatedUrl ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="freela-recipient" className="font-condensed block text-[12px] font-bold uppercase tracking-[0.08em] text-foreground mb-1.5">
                  Para quem é o link <span className="text-[var(--status-danger-text)]">· obrigatório</span>
                </label>
                <input
                  id="freela-recipient"
                  type="text"
                  autoComplete="off"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && canGenerate) onGenerate(linkCriterionIds); }}
                  placeholder="Nome do freela — ex.: João da Silva"
                  className={inputCls}
                />
              </div>
              {canIncludeConformity && (
                <label className={cn("flex items-start gap-3 rounded-xl border border-border px-3.5 py-3 select-none", forceConformity ? "cursor-not-allowed" : "cursor-pointer hover:bg-secondary/50")}>
                  <input
                    type="checkbox"
                    checked={includeConformity}
                    disabled={forceConformity}
                    onChange={e => setIncludeConformity(e.target.checked)}
                    className="mt-0.5 w-[18px] h-[18px] accent-[var(--primary)] shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <span className="text-[14px] leading-snug">
                    <span className="font-semibold text-foreground">Incluir a Matriz de Conformidade</span>
                    <span className="block text-[12px] text-muted-foreground mt-0.5">{cenografiaItemsLabel(withoutConduta)}</span>
                    {forceConformity && (
                      <span className="block text-[12px] text-foreground mt-1">Você responde pela matriz deste evento: critério e matriz vão no mesmo formulário.</span>
                    )}
                  </span>
                </label>
              )}
            </div>
          ) : (
            <GeneratedLinkBox
              url={generatedUrl}
              copied={linkCopied}
              onCopy={async () => {
                if (await copyToClipboard(generatedUrl ?? "")) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }
                else toast(COPY_FAILED_TOAST);
              }}
            />
          )}

          {(history ?? []).length > 0 && (
            <div>
              <Eyebrow className="mb-2">Links já enviados</Eyebrow>
              <ul className="rounded-xl border border-border divide-y divide-border max-h-44 overflow-y-auto">
                {(history ?? []).map(t => (
                  <LinkHistoryRow
                    key={t.id}
                    t={t}
                    trailing={!t.usedAt ? (
                      <button
                        type="button"
                        title="Excluir link"
                        aria-label={`Excluir link enviado para ${t.recipientName ?? "destinatário sem nome"}`}
                        disabled={isDeleting}
                        onClick={() => onDeleteToken(t.id)}
                        className="w-11 h-11 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {isDeleting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Trash2 size={14} aria-hidden />}
                      </button>
                    ) : undefined}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {generatedUrl ? "Fechar" : "Cancelar"}
          </button>
          {!generatedUrl && (
            <button
              type="button"
              data-testid="button-generate-public-link"
              disabled={!canGenerate}
              title={noEligible ? "Nenhum critério disponível para gerar link" : undefined}
              onClick={() => { if (canGenerate) onGenerate(linkCriterionIds); }}
              className={btnPrimary}
            >
              {isGenerating ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Gerando...</> : <><Link2 size={15} aria-hidden /> Gerar link</>}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
