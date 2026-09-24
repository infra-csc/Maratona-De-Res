import type { Dispatch, SetStateAction } from "react";
import type { EventConformity, UserSummary } from "@workspace/api-client-react";
import { CheckCircle, Save, ShieldAlert, Link2, Copy, Loader2, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { CONDENSED, WARNING, AMBER, AMBER_TEXT } from "@/lib/premium-theme";
import { ConformityLinkHistory } from "./conformity-link-history";
import { ConformityRedirectPopover } from "./conformity-redirect-popover";
import { publicEvalBaseUrl } from "./helpers";
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
}

// ─── GRUPO 1: Ferramentas e Case (Cenografia) ───
export function FerramentasConformitySection({
  conformityEvalForm, setConformityEvalForm, myConformityData, ferramentasPublicTokenHistory, ferramentasUsers,
  redirectOpen, onRedirectOpenChange, redirectTargetId, onRedirectSelect, onOpenLinkDialog, saveConformity, isSaving, toast,
}: FerramentasConformitySectionProps) {
  const val = conformityEvalForm.guardaEquipamentos;
  const isNao = val === false;
  const commentMissing = isNao && !conformityEvalForm.guardaEquipamentosComment.trim();
  // O comentário na tela difere do que está salvo no servidor?
  const commentDirty = conformityEvalForm.guardaEquipamentosComment !== (myConformityData?.guardaEquipamentosComment ?? "");
  const canSave = !commentMissing && commentDirty;
  const hasSentLink = (ferramentasPublicTokenHistory?.length ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 px-1">
        <h3 className="text-xl md:text-2xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
          <ShieldAlert size={22} /> Ferramentas e Case (Cenografia)
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <ConformityRedirectPopover
            open={redirectOpen}
            onOpenChange={onRedirectOpenChange}
            users={ferramentasUsers}
            selectedUserId={redirectTargetId}
            onSelectUser={onRedirectSelect}
          />
          {(() => {
            const pendingFerr = (ferramentasPublicTokenHistory ?? []).find(t => !t.usedAt);
            const answeredFerr = (ferramentasPublicTokenHistory ?? []).find(t => t.usedAt);
            const ferrBase = publicEvalBaseUrl();
            if (pendingFerr) {
              const pendingUrl = `${ferrBase}/eval/${pendingFerr.id}`;
              return (
                <button type="button"
                  onClick={async () => { if (await copyToClipboard(pendingUrl)) toast({ title: "Link copiado!", description: `Para: ${pendingFerr.recipientName ?? "freelancer"}` }); else toast(COPY_FAILED_TOAST); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border border-border rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
                  title="Copiar link já enviado — só existe um link por evento"
                >
                  <Copy size={12} /> Copiar link ({pendingFerr.recipientName ?? "freelancer"})
                </button>
              );
            }
            if (answeredFerr) return null;
            return (
              <button type="button"
                onClick={onOpenLinkDialog}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border border-border rounded-lg bg-card hover:bg-secondary transition-colors"
                title="Gerar link único para um freelancer responder o formulário de Ferramentas"
              >
                <Link2 size={12} /> Link Freelancer
              </button>
            );
          })()}
        </div>
      </div>
      {hasSentLink ? (
        <>
          <p className="text-sm text-muted-foreground px-1 -mt-1">
            Link enviado para um freelancer preencher este formulário. Acompanhe abaixo.
          </p>
          <ConformityLinkHistory history={ferramentasPublicTokenHistory ?? []} />
        </>
      ) : null}
      {!hasSentLink && (
        <>
          <p className="text-sm text-muted-foreground px-1 -mt-1">
            Você foi designado para avaliar o retorno de equipamentos e ferramentas.
          </p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 transition-colors border-l-4" style={isNao ? { backgroundColor: "rgba(229,72,77,0.08)", borderLeftColor: WARNING } : val === null ? { backgroundColor: "rgba(232,162,61,0.08)", borderLeftColor: AMBER } : { borderLeftColor: "transparent" }}>
              <div className="flex flex-wrap items-center justify-between gap-3 min-h-[56px]">
                <span className="text-sm font-bold text-foreground leading-snug flex-1 min-w-[200px]">Todos os equipamentos e ferramentas retornaram?</span>
                <div className="flex items-center gap-2 shrink-0">
                  {isNao && <span className="text-[11px] font-black uppercase text-destructive whitespace-nowrap">-10 pts</span>}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button type="button"
                      onClick={() => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: null })); saveConformity({ guardaEquipamentos: null }, "Resposta salva"); }}
                      className={`px-3 py-1.5 text-[11px] font-black uppercase border-r border-border transition-all ${val === null ? "" : "bg-card text-muted-foreground hover:bg-secondary"}`}
                      style={val === null ? { backgroundColor: AMBER, color: "var(--accent-foreground)" } : undefined}
                    >Pendente</button>
                    <button type="button"
                      onClick={() => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: true })); saveConformity({ guardaEquipamentos: true }, "Resposta salva"); }}
                      className={`px-3 py-1.5 text-[11px] font-black uppercase border-r border-border transition-all ${val === true ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
                    >Sim</button>
                    <button type="button"
                      onClick={() => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: false })); saveConformity({ guardaEquipamentos: false }, "Resposta salva"); }}
                      className={`px-3 py-1.5 text-[11px] font-black uppercase transition-all ${val === false ? "bg-destructive text-destructive-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
                    >Não</button>
                  </div>
                </div>
              </div>
              {val !== null && (
                <div className="pb-3 space-y-1">
                  <label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                    Comentário {isNao ? <span className="text-destructive normal-case font-bold">* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                    {!commentDirty && conformityEvalForm.guardaEquipamentosComment && (
                      <span className="text-accent-text flex items-center gap-0.5 font-bold"><CheckCircle size={9} /> salvo</span>
                    )}
                  </label>
                  <Textarea
                    placeholder={isNao ? "Descreva o que aconteceu com os equipamentos/ferramentas..." : "Alguma observação? (opcional)"}
                    value={conformityEvalForm.guardaEquipamentosComment}
                    onChange={e => setConformityEvalForm(f => ({ ...f, guardaEquipamentosComment: e.target.value }))}
                    className="border border-border rounded-lg text-sm resize-none min-h-[72px]"
                  />
                  {commentMissing && <p className="text-[11px] font-bold text-destructive">Comentário obrigatório quando a resposta é Não.</p>}
                </div>
              )}
            </div>
            {/* Save comment — só aparece quando há alterações */}
            {val !== null && commentDirty && (
              <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "rgba(232,162,61,0.10)", borderTop: `1px solid ${AMBER}` }}>
                <span className="text-[11px] font-bold uppercase flex items-center gap-1" style={{ color: AMBER_TEXT }}><AlertCircle size={11} /> Alterações não salvas</span>
                <button type="button" disabled={!canSave || isSaving}
                  onClick={() => { if (canSave) saveConformity({ guardaEquipamentosComment: conformityEvalForm.guardaEquipamentosComment }, "Observação salva"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase bg-primary text-accent-text disabled:opacity-40 hover:opacity-90 transition-colors"
                >{isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
