import type { Dispatch, SetStateAction } from "react";
import type { EventConformity, EventConformityInput, UserSummary } from "@workspace/api-client-react";
import { CheckCircle, Save, ShieldAlert, Link2, Copy, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { CONDENSED, WARNING, AMBER, AMBER_TEXT } from "@/lib/premium-theme";
import { CENOGRAFIA_ITEMS } from "./constants";
import { ConformityLinkHistory } from "./conformity-link-history";
import { ConformityRedirectPopover } from "./conformity-redirect-popover";
import { publicEvalBaseUrl } from "./helpers";
import type { ConformityEvalForm, SaveConformityFn, ToastFn } from "./types";

interface CenografiaConformitySectionProps {
  conformityEvalForm: ConformityEvalForm;
  setConformityEvalForm: Dispatch<SetStateAction<ConformityEvalForm>>;
  myConformityData: EventConformity | null | undefined;
  conformityPublicTokenHistory: PublicToken[] | undefined;
  cenografiaUsers: UserSummary[] | undefined;
  redirectOpen: boolean;
  onRedirectOpenChange: (open: boolean) => void;
  redirectTargetId: number | null;
  onRedirectSelect: (userId: number) => void;
  onOpenLinkDialog: () => void;
  saveConformity: SaveConformityFn;
  isSaving: boolean;
  toast: ToastFn;
}

// ─── GRUPO 2: Cenografia ───
export function CenografiaConformitySection({
  conformityEvalForm, setConformityEvalForm, myConformityData, conformityPublicTokenHistory, cenografiaUsers,
  redirectOpen, onRedirectOpenChange, redirectTargetId, onRedirectSelect, onOpenLinkDialog, saveConformity, isSaving, toast,
}: CenografiaConformitySectionProps) {
  const cenografiaItems = CENOGRAFIA_ITEMS;
  const standoutNeedsJustification = conformityEvalForm.standoutResponse === true && !conformityEvalForm.standoutJustification.trim();
  const absencesNeedsReport = !conformityEvalForm.absencesReport.trim();
  const missingRequiredComments = cenografiaItems.some(i => conformityEvalForm[i.key] === false && !conformityEvalForm[i.commentKey].trim());
  // Algum campo de texto na tela difere do que está salvo no servidor?
  const textsDirty =
    cenografiaItems.some(i => conformityEvalForm[i.commentKey] !== (myConformityData?.[i.commentKey] ?? "")) ||
    conformityEvalForm.absencesReport !== (myConformityData?.absencesReport ?? "") ||
    conformityEvalForm.standoutJustification !== (myConformityData?.standoutJustification ?? "");
  const canSaveTexts = !standoutNeedsJustification && !absencesNeedsReport && !missingRequiredComments && textsDirty;
  const filledCount = cenografiaItems.filter(i => conformityEvalForm[i.key] !== null).length;
  const hasSentLink = (conformityPublicTokenHistory?.length ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 px-1">
        <h3 className="text-xl md:text-2xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
          <ShieldAlert size={22} /> Cenografia
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <ConformityRedirectPopover
            open={redirectOpen}
            onOpenChange={onRedirectOpenChange}
            users={cenografiaUsers}
            selectedUserId={redirectTargetId}
            onSelectUser={onRedirectSelect}
          />
          {(() => {
            const pendingCeno = (conformityPublicTokenHistory ?? []).find(t => !t.usedAt);
            const answeredCeno = (conformityPublicTokenHistory ?? []).find(t => t.usedAt);
            const cenoBase = publicEvalBaseUrl();
            if (pendingCeno) {
              const pendingUrl = `${cenoBase}/eval/${pendingCeno.id}`;
              return (
                <button type="button"
                  onClick={async () => { if (await copyToClipboard(pendingUrl)) toast({ title: "Link copiado!", description: `Para: ${pendingCeno.recipientName ?? "freelancer"}` }); else toast(COPY_FAILED_TOAST); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border border-border rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
                  title="Copiar link já enviado — só existe um link por evento"
                >
                  <Copy size={12} /> Copiar link ({pendingCeno.recipientName ?? "freelancer"})
                </button>
              );
            }
            // Só esconde o botão se um link já foi usado E a conformidade
            // realmente foi preenchida. Se o link foi usado mas a matriz
            // seguiu vazia (0 itens), ainda é preciso poder reenviar — senão
            // fica "sem como" responder a conformidade.
            if (answeredCeno && filledCount > 0) return null;
            return (
              <button type="button"
                onClick={onOpenLinkDialog}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border border-border rounded-lg bg-card hover:bg-secondary transition-colors"
                title="Gerar link único para um freelancer responder o formulário de Cenografia"
              >
                <Link2 size={12} /> {answeredCeno ? "Reenviar Link" : "Link Freelancer"}
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
          <ConformityLinkHistory history={conformityPublicTokenHistory ?? []} />
        </>
      ) : (
        <>
      <p className="text-sm text-muted-foreground px-1 -mt-1">
        Você foi designado para avaliar a conformidade da equipe de Cenografia neste evento.
      </p>

      {/* 3 conformity items */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {cenografiaItems.map(item => {
            const val = conformityEvalForm[item.key];
            const isNao = val === false;
            return (
              <div key={item.key} className="px-5 transition-colors border-l-4" style={isNao ? { backgroundColor: "rgba(229,72,77,0.08)", borderLeftColor: WARNING } : val === null ? { backgroundColor: "rgba(232,162,61,0.08)", borderLeftColor: AMBER } : { borderLeftColor: "transparent" }}>
                <div className="flex flex-wrap items-center justify-between gap-3 min-h-[56px]">
                  <span className="text-sm font-bold text-foreground leading-snug flex-1 min-w-[200px]">{item.question}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {isNao && <span className="text-[11px] font-black uppercase text-destructive whitespace-nowrap">-10 pts</span>}
                    <div className="flex items-center border border-border rounded-lg overflow-hidden">
                      <button type="button"
                        onClick={() => { setConformityEvalForm(f => ({ ...f, [item.key]: true })); saveConformity({ [item.key]: true }, "Resposta salva"); }}
                        className={`px-3 py-1.5 text-[11px] font-black uppercase border-r border-border transition-all ${val === true ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
                      >Sim</button>
                      <button type="button"
                        onClick={() => { setConformityEvalForm(f => ({ ...f, [item.key]: false })); saveConformity({ [item.key]: false }, "Resposta salva"); }}
                        className={`px-3 py-1.5 text-[11px] font-black uppercase transition-all ${val === false ? "bg-destructive text-destructive-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
                      >Não</button>
                    </div>
                  </div>
                </div>
                {val !== null && (
                  <div className="pb-3 space-y-1">
                    <label className="text-[11px] font-bold uppercase text-muted-foreground">
                      Comentário {isNao ? <span className="text-destructive normal-case">* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                    </label>
                    <Textarea
                      placeholder={isNao ? `Descreva o que aconteceu com ${item.label.toLowerCase()}...` : "Alguma observação? (opcional)"}
                      value={conformityEvalForm[item.commentKey]}
                      onChange={e => setConformityEvalForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                      className="border border-border rounded-lg text-sm resize-none min-h-[64px]"
                    />
                    {isNao && !conformityEvalForm[item.commentKey].trim() && (
                      <p className="text-[11px] font-bold text-destructive">Comentário obrigatório quando a resposta é Não.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {filledCount === cenografiaItems.length && (
          <div className="px-5 py-3 bg-secondary border-t border-border flex items-center gap-2">
            <CheckCircle size={14} className="text-accent-text" />
            <span className="text-xs font-bold uppercase text-accent-text">Itens preenchidos — {cenografiaItems.filter(i => conformityEvalForm[i.key] === true).length}/{cenografiaItems.length} conformes</span>
          </div>
        )}
      </div>

      {/* Absences question — texto livre sempre obrigatório */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 space-y-1">
          <label className="block text-sm font-black uppercase text-foreground">
            Alguém faltou ou atrasou por mais de 30 minutos? Especifique. <span className="text-destructive">*</span> obrigatório
          </label>
          <Textarea
            placeholder="Ex.: João Silva — faltou sem aviso. Maria Souza — 45 min de atraso por trânsito. Se ninguém faltou/atrasou, escreva &quot;Ninguém faltou ou atrasou&quot;."
            value={conformityEvalForm.absencesReport}
            onChange={e => setConformityEvalForm(f => ({ ...f, absencesReport: e.target.value }))}
            className="border border-border rounded-lg text-sm resize-none min-h-[72px]"
          />
          {absencesNeedsReport && <p className="text-[11px] font-bold text-destructive">Especifique antes de salvar.</p>}
        </div>
      </div>

      {/* Standout question */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 space-y-3">
          <label className="block text-sm font-black uppercase text-foreground">Algum profissional teve um desempenho fora da curva?</label>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => { setConformityEvalForm(f => ({ ...f, standoutResponse: false, standoutJustification: '' })); saveConformity({ standoutResponse: false, standoutJustification: null }, "Resposta salva"); }}
              className={`flex-1 px-4 py-2.5 text-xs font-black uppercase border border-border rounded-lg transition-all ${conformityEvalForm.standoutResponse === false ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
            >Não, dentro do padrão esperado</button>
            <button type="button"
              onClick={() => setConformityEvalForm(f => ({ ...f, standoutResponse: true }))}
              className={`flex-1 px-4 py-2.5 text-xs font-black uppercase border border-border rounded-lg transition-all ${conformityEvalForm.standoutResponse === true ? "bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:bg-secondary"}`}
            >Sim, houve um grande destaque</button>
          </div>
          {conformityEvalForm.standoutResponse === true && (
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-accent-text">Detalhe o destaque <span>*</span> obrigatório</label>
              <Textarea
                placeholder="Nome do profissional e por que se destacou..."
                value={conformityEvalForm.standoutJustification}
                onChange={e => setConformityEvalForm(f => ({ ...f, standoutJustification: e.target.value }))}
                className="border border-border rounded-lg text-sm resize-none min-h-[72px]"
              />
              {standoutNeedsJustification && <p className="text-[11px] font-bold text-destructive">Descreva o destaque antes de salvar.</p>}
            </div>
          )}
        </div>
      </div>

      {/* Save text fields — só aparece quando há alterações */}
      {textsDirty && (
        <div className="flex items-center justify-between gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(232,162,61,0.10)", border: `1px solid ${AMBER}` }}>
          <span className="text-[11px] font-bold uppercase flex items-center gap-1" style={{ color: AMBER_TEXT }}><AlertCircle size={12} /> Alterações não salvas</span>
          <button type="button" disabled={!canSaveTexts || isSaving}
            onClick={() => {
              if (!canSaveTexts) return;
              const payload: Record<string, unknown> = { absencesResponse: true, absencesReport: conformityEvalForm.absencesReport, standoutResponse: conformityEvalForm.standoutResponse, standoutJustification: conformityEvalForm.standoutJustification || null };
              cenografiaItems.forEach(item => { payload[item.commentKey] = conformityEvalForm[item.commentKey] || null; });
              saveConformity(payload as EventConformityInput, "Observações salvas");
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-black uppercase bg-primary text-accent-text disabled:opacity-40 hover:opacity-90 transition-colors"
          ><Save size={14} /> Salvar observações</button>
        </div>
      )}
        </>
      )}

    </div>
  );
}
