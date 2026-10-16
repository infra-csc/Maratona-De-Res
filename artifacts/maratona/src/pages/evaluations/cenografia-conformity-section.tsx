import { useState, type Dispatch, type SetStateAction } from "react";
import type { EventConformity, EventConformityInput, UserSummary } from "@workspace/api-client-react";
import { CheckCircle2, Save, Link2, Copy, AlertCircle, Lock, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { cenografiaItemsFor } from "./constants";
import { ConformityLinkHistory } from "./conformity-link-history";
import { ConformityRedirectPopover } from "./conformity-redirect-popover";
import { MatrixHeader, MatrixQuestion, Segmented, matrixLabelCls, matrixTextareaCls } from "./conformity-bits";
import { fmtDT, publicEvalBaseUrl } from "./helpers";
import { Chip, btnPrimary, btnSmall } from "./ui";
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
  /** Ciclo sem "Conduta" na matriz: a pergunta não aparece (GET /evaluations/my-area). */
  withoutConduta: boolean;
  /**
   * A matriz já foi respondida por OUTRA pessoa (link combinado, link de
   * conformidade, outro avaliador ou o RH): a tela só mostra a resposta.
   */
  answeredByOther: { name: string | null; at: string | null } | null;
}

const YES_NO = [
  { value: true, label: "Sim", tone: "yes" as const },
  { value: false, label: "Não", tone: "no" as const },
];

// ─── Matriz de Conformidade da Cenografia (parte final do formulário) ───
export function CenografiaConformitySection({
  conformityEvalForm, setConformityEvalForm, myConformityData, conformityPublicTokenHistory, cenografiaUsers,
  redirectOpen, onRedirectOpenChange, redirectTargetId, onRedirectSelect, onOpenLinkDialog, saveConformity, isSaving, toast,
  withoutConduta, answeredByOther,
}: CenografiaConformitySectionProps) {
  const cenografiaItems = cenografiaItemsFor(withoutConduta);
  // Aviso de campo obrigatório vazio só depois de tentar salvar.
  const [triedSave, setTriedSave] = useState(false);
  if (answeredByOther) {
    return (
      <CenografiaReadOnly
        data={myConformityData}
        items={cenografiaItems}
        answeredBy={answeredByOther}
        history={conformityPublicTokenHistory ?? []}
      />
    );
  }
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
  const conformes = cenografiaItems.filter(i => conformityEvalForm[i.key] === true).length;

  const pendingCeno = (conformityPublicTokenHistory ?? []).find(t => !t.usedAt);
  const answeredCeno = (conformityPublicTokenHistory ?? []).find(t => t.usedAt);
  const linkAction = (() => {
    if (pendingCeno) {
      const pendingUrl = `${publicEvalBaseUrl()}/eval/${pendingCeno.id}`;
      return (
        <button type="button"
          onClick={async () => { if (await copyToClipboard(pendingUrl)) toast({ title: "Link copiado!", description: `Para: ${pendingCeno.recipientName ?? "freela"}` }); else toast(COPY_FAILED_TOAST); }}
          className={btnSmall}
          title="Copiar link já enviado — só existe um link por evento"
        >
          <Copy size={14} aria-hidden /> Copiar link ({pendingCeno.recipientName ?? "freela"})
        </button>
      );
    }
    // Só esconde o botão se um link já foi usado E a conformidade
    // realmente foi preenchida. Se o link foi usado mas a matriz
    // seguiu vazia (0 itens), ainda é preciso poder reenviar — senão
    // fica "sem como" responder a conformidade.
    if (answeredCeno && filledCount > 0) return null;
    return (
      <button type="button" onClick={onOpenLinkDialog} className={btnSmall} title="Gerar link único para um freela responder o formulário de Cenografia">
        <Link2 size={14} aria-hidden /> {answeredCeno ? "Reenviar link para freela" : "Link para freela"}
      </button>
    );
  })();

  return (
    <div className="space-y-5">
      <MatrixHeader
        title="Matriz de Conformidade"
        status={!hasSentLink && filledCount === cenografiaItems.length
          ? <Chip tone="ok" icon={CheckCircle2}>{conformes}/{cenografiaItems.length} conformes</Chip>
          : undefined}
        description={hasSentLink
          ? "Link enviado para um freela preencher a matriz. Acompanhe abaixo."
          : "Sobre a equipe de Cenografia neste evento. Cada Sim/Não é salvo na hora; os textos, no botão “Salvar observações”."}
        actions={<>
          <ConformityRedirectPopover open={redirectOpen} onOpenChange={onRedirectOpenChange} users={cenografiaUsers} selectedUserId={redirectTargetId} onSelectUser={onRedirectSelect} />
          {linkAction}
        </>}
      />

      {hasSentLink ? (
        <ConformityLinkHistory history={conformityPublicTokenHistory ?? []} />
      ) : (
        <>
          {/* Perguntas Sim/Não (sem "Conduta" no ciclo novo) */}
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {cenografiaItems.map(item => {
              const val = conformityEvalForm[item.key];
              const isNao = val === false;
              const qId = `ceno-q-${item.key}`;
              const cId = `ceno-c-${item.key}`;
              const missing = isNao && !conformityEvalForm[item.commentKey].trim();
              return (
                <MatrixQuestion
                  key={item.key}
                  id={qId}
                  question={item.question}
                  penalty={isNao}
                  unanswered={val === null}
                  control={
                    <Segmented
                      value={val}
                      options={YES_NO}
                      labelledBy={qId}
                      onChange={(v) => { setConformityEvalForm(f => ({ ...f, [item.key]: v })); saveConformity({ [item.key]: v }, "Resposta salva"); }}
                    />
                  }
                >
                  {val !== null && (
                    <>
                      <label htmlFor={cId} className={matrixLabelCls}>
                        Comentário {isNao ? <span className="text-[var(--status-danger-text)]">· obrigatório</span> : <span className="normal-case tracking-normal font-normal">(opcional)</span>}
                      </label>
                      <Textarea
                        id={cId}
                        placeholder={isNao ? `Descreva o que aconteceu com ${item.label.toLowerCase()}...` : "Alguma observação? (opcional)"}
                        value={conformityEvalForm[item.commentKey]}
                        aria-invalid={missing || undefined}
                        onChange={e => setConformityEvalForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                        className={cn(matrixTextareaCls, "min-h-[64px]", missing && "border-[var(--status-danger)]")}
                      />
                      {missing && <p className="mt-1.5 text-[12px] font-semibold text-[var(--status-danger-text)]">Comentário obrigatório quando a resposta é Não.</p>}
                    </>
                  )}
                </MatrixQuestion>
              );
            })}

            {/* Faltas/atrasos — texto livre sempre obrigatório */}
            <div className="px-4 sm:px-5 py-4">
              <label htmlFor="ceno-absences-report" className="text-[15px] font-semibold leading-snug text-foreground flex items-start gap-2">
                <span aria-hidden className={cn("mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full", absencesNeedsReport ? "bg-[var(--status-warn)]" : "bg-transparent")} />
                <span>Alguém faltou ou atrasou por mais de 30 minutos? Especifique. <span className="text-[var(--status-danger-text)] font-normal text-[13px]">· obrigatório</span></span>
              </label>
              <div className="mt-3 pl-3.5">
                <Textarea
                  id="ceno-absences-report"
                  placeholder={"Ex.: João Silva — faltou sem aviso. Maria Souza — 45 min de atraso. Se ninguém faltou ou atrasou, escreva “Ninguém faltou ou atrasou”."}
                  value={conformityEvalForm.absencesReport}
                  aria-invalid={(triedSave && absencesNeedsReport) || undefined}
                  onChange={e => setConformityEvalForm(f => ({ ...f, absencesReport: e.target.value }))}
                  className={cn(matrixTextareaCls, "min-h-[72px]", triedSave && absencesNeedsReport && "border-[var(--status-danger)]")}
                />
                {triedSave && absencesNeedsReport && <p className="mt-1.5 text-[12px] font-semibold text-[var(--status-danger-text)]">Especifique antes de salvar.</p>}
              </div>
            </div>

            {/* Destaque */}
            <div className="px-4 sm:px-5 py-4">
              <p id="ceno-standout-q" className="text-[15px] font-semibold leading-snug text-foreground flex items-start gap-2">
                <span aria-hidden className={cn("mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full", conformityEvalForm.standoutResponse === null ? "bg-[var(--status-warn)]" : "bg-transparent")} />
                <span>Algum profissional teve um desempenho fora da curva?</span>
              </p>
              <div role="group" aria-labelledby="ceno-standout-q" className="mt-3 pl-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { v: false, label: "Não, dentro do padrão esperado" },
                  { v: true, label: "Sim, houve um grande destaque" },
                ] as const).map(o => {
                  const on = conformityEvalForm.standoutResponse === o.v;
                  return (
                    <button key={String(o.v)} type="button" aria-pressed={on}
                      onClick={() => {
                        if (o.v) setConformityEvalForm(f => ({ ...f, standoutResponse: true }));
                        else { setConformityEvalForm(f => ({ ...f, standoutResponse: false, standoutJustification: '' })); saveConformity({ standoutResponse: false, standoutJustification: null }, "Resposta salva"); }
                      }}
                      className={cn(
                        "min-h-11 rounded-lg border px-4 py-2.5 text-left text-[14px] font-semibold leading-snug transition-[background-color,border-color,color] duration-150 flex items-center gap-2.5",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                        on ? (o.v ? "border-transparent bg-accent text-accent-foreground" : "border-transparent bg-primary text-primary-foreground") : "border-border bg-background text-foreground hover:bg-secondary",
                      )}
                    >
                      <span aria-hidden className={cn("w-4 h-4 shrink-0 rounded-full border-2 flex items-center justify-center", on ? "border-current" : "border-muted-foreground/50")}>
                        {on && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                      </span>
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {conformityEvalForm.standoutResponse === true && (
                <div className="mt-3 pl-3.5">
                  <label htmlFor="ceno-standout-just" className={matrixLabelCls}>Detalhe o destaque <span className="text-[var(--status-danger-text)]">· obrigatório</span></label>
                  <Textarea
                    id="ceno-standout-just"
                    placeholder="Nome do profissional e por que se destacou..."
                    value={conformityEvalForm.standoutJustification}
                    aria-invalid={standoutNeedsJustification || undefined}
                    onChange={e => setConformityEvalForm(f => ({ ...f, standoutJustification: e.target.value }))}
                    className={cn(matrixTextareaCls, "min-h-[72px]")}
                  />
                  {standoutNeedsJustification && <p className="mt-1.5 text-[12px] font-semibold text-[var(--status-danger-text)]">Descreva o destaque antes de salvar.</p>}
                </div>
              )}
            </div>
          </div>

          {/* Salvar textos — só aparece quando há alterações */}
          {textsDirty && (
            <div role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-[var(--status-warn-bg)] px-4 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-200">
              <span className="text-[14px] font-semibold flex items-center gap-2 text-[var(--status-warn-text)]">
                <AlertCircle size={15} aria-hidden className="shrink-0" /> Observações ainda não salvas
              </span>
              <button type="button" disabled={isSaving} aria-disabled={!canSaveTexts}
                onClick={() => {
                  if (!canSaveTexts) { setTriedSave(true); return; }
                  const payload: Record<string, unknown> = { absencesResponse: true, absencesReport: conformityEvalForm.absencesReport, standoutResponse: conformityEvalForm.standoutResponse, standoutJustification: conformityEvalForm.standoutJustification || null };
                  cenografiaItems.forEach(item => { payload[item.commentKey] = conformityEvalForm[item.commentKey] || null; });
                  saveConformity(payload as EventConformityInput, "Observações salvas");
                }}
                className={cn(btnPrimary, "aria-disabled:opacity-60")}
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />} Salvar observações
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Matriz já respondida por outra pessoa: só leitura, sem Sim/Não, redirecionar ou link. */
function CenografiaReadOnly({ data, items, answeredBy, history }: {
  data: EventConformity | null | undefined;
  items: ReturnType<typeof cenografiaItemsFor>;
  answeredBy: { name: string | null; at: string | null };
  history: PublicToken[];
}) {
  const answer = (v: boolean | null | undefined) => v === true ? "Sim" : v === false ? "Não" : "Não respondida";
  return (
    <div className="space-y-5">
      <MatrixHeader
        title="Matriz de Conformidade"
        status={<Chip icon={Lock}>Só leitura</Chip>}
        description={<>
          <span className="font-semibold text-foreground">Respondida{answeredBy.name ? ` por ${answeredBy.name}` : ""}{answeredBy.at ? ` em ${fmtDT(answeredBy.at)}` : ""}.</span>{" "}
          A matriz deste evento já tem resposta e não pode ser alterada por aqui. Se algo precisar mudar, fale com o RH.
        </>}
      />
      <dl className="rounded-xl border border-border bg-card divide-y divide-border">
        {items.map(item => {
          const v = data?.[item.key];
          const comment = data?.[item.commentKey]?.trim();
          return (
            <div key={item.key} className="px-4 sm:px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <dt className="text-[15px] font-semibold text-foreground leading-snug flex-1 min-w-[200px]">{item.question}</dt>
                <dd className="flex items-center gap-2">
                  {v === false && <Chip tone="danger">-10 pts</Chip>}
                  <span className={cn("font-condensed text-[16px] font-black uppercase", v === false ? "text-[var(--status-danger-text)]" : v === true ? "text-foreground" : "text-muted-foreground")}>{answer(v)}</span>
                </dd>
              </div>
              {comment && <dd className="mt-1.5 text-[14px] text-muted-foreground break-words">“{comment}”</dd>}
            </div>
          );
        })}
        <div className="px-4 sm:px-5 py-4">
          <dt className="text-[15px] font-semibold text-foreground">Alguém faltou ou atrasou por mais de 30 minutos?</dt>
          <dd className="mt-1.5 text-[14px] text-muted-foreground break-words">{data?.absencesReport?.trim() || "Não respondida"}</dd>
        </div>
        <div className="px-4 sm:px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <dt className="text-[15px] font-semibold text-foreground leading-snug flex-1 min-w-[200px]">Algum profissional teve um desempenho fora da curva?</dt>
            <dd className={cn("font-condensed text-[16px] font-black uppercase", data?.standoutResponse == null ? "text-muted-foreground" : "text-foreground")}>
              {answer(data?.standoutResponse)}
            </dd>
          </div>
          {data?.standoutResponse === true && data.standoutJustification?.trim() && (
            <dd className="mt-1.5 text-[14px] text-muted-foreground break-words">“{data.standoutJustification.trim()}”</dd>
          )}
        </div>
      </dl>
      {history.length > 0 && <ConformityLinkHistory history={history} />}
    </div>
  );
}
