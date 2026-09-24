import type { EventCriterion } from "@workspace/api-client-react";
import { CheckCircle, Link2, Copy, CheckCheck, Trash2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { CONDENSED } from "@/lib/premium-theme";
import { fmtDT } from "./helpers";
import type { PublicLinkEligibleCriterion, ToastFn } from "./types";

interface PublicLinkDialogProps {
  criteriaIds: number[] | null;
  areaName: string | null;
  recipientName: string;
  setRecipientName: (value: string) => void;
  includeConformity: boolean;
  setIncludeConformity: (value: boolean) => void;
  forceConformity: boolean;
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

// Public link dialog — link único por formulário/área para freelancers
export function PublicLinkDialog({
  criteriaIds, areaName, recipientName, setRecipientName, includeConformity, setIncludeConformity, forceConformity,
  generatedUrl, linkCopied, setLinkCopied, eligibleCriteria, activeCriteria, history, isGenerating, isDeleting,
  onGenerate, onDeleteToken, onClose, toast,
}: PublicLinkDialogProps) {
  return (
    <Dialog
      open={criteriaIds !== null}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md rounded-xl border-border" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <Link2 size={18} /> Link para Freelancer
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {areaName && (
            <div className="border-l-4 border-accent pl-3">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">Formulário</p>
              <p className="text-sm font-black uppercase">{areaName}</p>
            </div>
          )}
          {(() => {
            // Critérios do formulário que o backend aceita num link público
            // (interseção entre os critérios da área e os elegíveis). Os que
            // ficaram de fora precisam ser respondidos pelo próprio avaliador.
            const requestedIds = criteriaIds ?? [];
            const eligibleById = new Map((eligibleCriteria ?? []).map(c => [c.criterionId, c]));
            const dialogEligible = requestedIds.flatMap(id => { const c = eligibleById.get(id); return c ? [c] : []; });
            const excluded = requestedIds
              .filter(id => !eligibleById.has(id))
              .map(id => activeCriteria.find(c => c.criterionId === id)?.criterionName ?? `critério #${id}`);
            if (eligibleCriteria === undefined) return null;
            if (dialogEligible.length === 0) {
              return (
                <div data-testid="notice-public-link-no-criteria" className="bg-destructive/10 border border-destructive rounded-lg px-4 py-3 flex items-start gap-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-destructive" />
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-destructive">Nenhum critério disponível para link</p>
                    <p className="text-xs text-destructive leading-snug">
                      Nenhum dos critérios deste formulário pode ser respondido por link público para este avaliador/área — em geral porque já foram submetidos ou estão atribuídos a outra pessoa. Responda os critérios diretamente nesta tela ou use "Redirecionar Formulário" para passá-los a um colega.
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <div className="bg-secondary border border-border rounded-lg px-4 py-3 space-y-2">
                <div>
                  <p className="text-[11px] font-black uppercase text-muted-foreground mb-1">
                    Critérios inclusos ({dialogEligible.length})
                  </p>
                  <ul className="space-y-0.5">
                    {dialogEligible.map(c => (
                      <li key={c.criterionId} className="text-sm font-black uppercase">{c.criterionName}</li>
                    ))}
                  </ul>
                </div>
                {excluded.length > 0 && (
                  <div data-testid="notice-public-link-partial" className="border-t border-dashed border-border pt-2">
                    <p className="text-[11px] font-black uppercase text-destructive mb-1 flex items-center gap-1">
                      <AlertCircle size={11} /> Fora do link ({excluded.length})
                    </p>
                    <ul className="space-y-0.5">
                      {excluded.map((name, i) => (
                        <li key={i} className="text-xs text-destructive">{name}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                      Estes critérios não podem ir no link (já submetidos ou atribuídos a outra pessoa) e continuam sob sua responsabilidade nesta tela.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {!generatedUrl ? (
            <>
              <p className="text-sm text-muted-foreground">
                Gere um link único para que um freelancer responda este formulário. O link expira após o primeiro uso.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase mb-2">
                    Nome de quem vai receber o link
                    <span className="text-destructive text-[11px] ml-2 bg-destructive/10 px-2 py-0.5 border border-border">Obrigatório</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="Ex: João Freelancer"
                    className="w-full border border-border rounded-lg bg-card px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <label className={cn("flex items-start gap-2.5 select-none", forceConformity ? "cursor-not-allowed opacity-90" : "cursor-pointer")}>
                  <input
                    type="checkbox"
                    checked={includeConformity}
                    disabled={forceConformity}
                    onChange={e => setIncludeConformity(e.target.checked)}
                    className="mt-0.5 w-4 h-4 border border-border rounded-lg accent-primary cursor-pointer shrink-0 disabled:cursor-not-allowed"
                  />
                  <span className="text-xs font-bold text-muted-foreground leading-tight">
                    Incluir matriz de conformidade no questionário<br />
                    <span className="font-normal text-muted-foreground">EPI · Estaiamentos · Conduta · Faltas/Atrasos · Destaque</span>
                    {forceConformity && (
                      <><br /><span className="font-bold text-accent-text">Obrigatório para Cenografia — o avaliador responde critério e conformidade no mesmo formulário.</span></>
                    )}
                  </span>
                </label>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-accent-text font-bold">
                Link gerado! Copie e envie para <strong>{recipientName}</strong>.
              </p>
              <div className="border border-border rounded-lg bg-secondary p-3 flex items-center gap-2">
                <span className="text-xs font-bold break-all flex-1 select-all">{generatedUrl}</span>
                <button
                  type="button"
                  onClick={async () => {
                    if (await copyToClipboard(generatedUrl ?? "")) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }
                    else toast(COPY_FAILED_TOAST);
                  }}
                  className="shrink-0 bg-primary text-primary-foreground border border-primary rounded-lg px-3 py-2 flex items-center gap-1.5 font-bold text-xs uppercase hover:opacity-90 transition-colors"
                >
                  {linkCopied ? <><CheckCheck size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Este link é de uso único e expira após o freelancer submeter a avaliação.
              </p>
            </>
          )}

          {/* Token history */}
          {(history ?? []).length > 0 && (
            <div>
              <p className="text-[11px] font-black uppercase text-muted-foreground mb-2">Histórico de links enviados</p>
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                {(history ?? []).map(t => (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
                      </p>
                      {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
                        <p className="text-[11px] text-muted-foreground truncate">Para: {t.recipientName}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        Enviado: {fmtDT(t.createdAt)}
                      </p>
                      {t.usedAt && (
                        <p className="text-[11px] font-bold text-accent-text">
                          Respondido: {fmtDT(t.usedAt)}
                        </p>
                      )}
                    </div>
                    {t.usedAt ? (
                      <span className="shrink-0 text-[11px] font-bold uppercase bg-primary text-primary-foreground border border-primary rounded-lg px-2 py-0.5 flex items-center gap-1 mt-0.5">
                        <CheckCircle size={10} /> Respondido
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-bold uppercase bg-secondary text-muted-foreground border border-border rounded-lg px-2 py-0.5 mt-0.5">
                          Pendente
                        </span>
                        <button
                          type="button"
                          title="Excluir link"
                          aria-label={`Excluir link enviado para ${t.recipientName ?? "destinatário sem nome"}`}
                          disabled={isDeleting}
                          onClick={() => onDeleteToken(t.id)}
                          className="mt-0.5 border border-border rounded-lg p-0.5 hover:bg-destructive/10 hover:border-destructive transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} className="text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-border rounded-lg px-5 py-2.5 font-bold uppercase text-xs hover:bg-secondary transition-colors"
          >
            {generatedUrl ? "Fechar" : "Cancelar"}
          </button>
          {!generatedUrl && (() => {
            const eligibleIds = new Set((eligibleCriteria ?? []).map(c => c.criterionId));
            const linkCriterionIds = (criteriaIds ?? []).filter(id => eligibleIds.has(id));
            const noEligible = linkCriterionIds.length === 0;
            return (
            <button
              type="button"
              data-testid="button-generate-public-link"
              disabled={!recipientName.trim() || isGenerating || noEligible}
              title={noEligible ? "Nenhum critério disponível para gerar link" : undefined}
              onClick={() => {
                if (!recipientName.trim() || noEligible) return;
                onGenerate(linkCriterionIds);
              }}
              className="bg-primary text-primary-foreground border border-primary rounded-lg px-5 py-2.5 font-bold uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Gerando..." : "Gerar Link"}
            </button>
            );
          })()}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
