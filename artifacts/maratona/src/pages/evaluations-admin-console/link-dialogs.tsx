import type { Dispatch, SetStateAction } from "react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { Link2, Copy, X, CheckCircle } from "lucide-react";
import { CONDENSED, GOOD_TEXT } from "@/lib/premium-theme";
import { fieldStyle, fmtDT } from "./helpers";
import type { ToastFn } from "./use-event-mutations";
import type { ConformityLinkDialogState, LinkDialogState } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Link Freelancer dialog (critério) */
export function LinkDialog(props: {
  linkDialog: LinkDialogState;
  setLinkDialog: SetState<LinkDialogState | null>;
  linkRecipientName: string;
  setLinkRecipientName: SetState<string>;
  generatedLinkUrl: string | null;
  setGeneratedLinkUrl: SetState<string | null>;
  linkCopied: boolean;
  setLinkCopied: SetState<boolean>;
  handleGenerateLink: () => void;
  generating: boolean;
  allTokens: AdminPublicToken[] | undefined;
  batchEventHeader: string;
  toast: ToastFn;
}) {
  const {
    linkDialog, setLinkDialog, linkRecipientName, setLinkRecipientName, generatedLinkUrl, setGeneratedLinkUrl,
    linkCopied, setLinkCopied, handleGenerateLink, generating, allTokens, batchEventHeader, toast,
  } = props;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Link freelancer: ${linkDialog.criterionNames.join(", ")}`} className="rounded-xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
              Link Freelancer{linkDialog.criterionIds.length > 1 ? ` · ${linkDialog.criterionIds.length} critérios` : ""}
            </p>
            {linkDialog.criterionNames.length === 1 ? (
              <h3 className="font-black uppercase text-sm truncate" style={{ fontFamily: CONDENSED }}>{linkDialog.criterionNames[0]}</h3>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {linkDialog.criterionNames.map((n, i) => (
                  <li key={i} className="font-black uppercase text-[12.5px] truncate leading-tight" style={{ fontFamily: CONDENSED }}>{n}</li>
                ))}
              </ul>
            )}
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Avaliador: <span className="font-bold" style={{ color: "var(--foreground)" }}>{linkDialog.assignedToName}</span></p>
          </div>
          <button
            type="button"
            onClick={() => { setLinkDialog(null); setGeneratedLinkUrl(null); }}
            aria-label="Fechar diálogo de link"
            title="Fechar"
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:opacity-80"
            style={{ border: "1px solid var(--border)" }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* nota de conformidade bundled */}
          {linkDialog?.includeConformity && (
            <div className="rounded-lg px-3 py-2 text-[11px] flex items-start gap-2" style={{ border: "1px solid var(--primary)", backgroundColor: "var(--secondary)" }}>
              <CheckCircle size={13} className="shrink-0 mt-0.5" style={{ color: GOOD_TEXT }} />
              <span>Este link incluirá o critério <strong>e</strong> a Matriz de Conformidade de Cenografia no mesmo questionário.</span>
            </div>
          )}
          {/* recipient + generate */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>
              Para quem é o link? <span className="font-normal normal-case">(opcional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={linkRecipientName}
                aria-label="Para quem é o link"
                onChange={e => setLinkRecipientName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleGenerateLink(); }}
                placeholder="Nome do freelancer"
                className="flex-1 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={generating}
                className="rounded-lg px-3 py-2 text-[11px] font-bold uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Link2 size={12} /> {generating ? "Gerando…" : "Gerar Link"}
              </button>
            </div>
          </div>

          {/* generated URL */}
          {generatedLinkUrl && (
            <div className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GOOD_TEXT }}>Link gerado — copie e envie</p>
              <div className="flex gap-2 items-start">
                <input
                  readOnly
                  aria-label="Link gerado"
                  value={generatedLinkUrl}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs font-mono truncate focus:outline-none"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  onFocus={e => e.target.select()}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const text = `${batchEventHeader} — ${linkDialog?.assignedToName ?? "Avaliador"}: ${generatedLinkUrl}`;
                    if (await copyToClipboard(text)) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }
                    else toast(COPY_FAILED_TOAST);
                  }}
                  className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 shrink-0 transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {linkCopied ? <><CheckCircle size={11} style={{ color: GOOD_TEXT }} /> Copiado!</> : <><Copy size={11} /> Copiar</>}
                </button>
              </div>
            </div>
          )}

          {/* history */}
          {(() => {
            const relevantTokens: AdminPublicToken[] = (allTokens ?? []).filter(t =>
              (t.tokenType === "criteria" || t.tokenType === "criteria_with_conformity")
              && (t.criterionIds ?? []).some(id => linkDialog.criterionIds.includes(id)),
            );
            if (relevantTokens.length === 0) return null;
            return (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Histórico de links enviados</p>
                <div className="rounded-lg max-h-48 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                  {relevantTokens.map((t, i) => (
                    <div key={t.id} className="flex items-start justify-between px-3 py-2.5 gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-[11px] font-bold truncate">
                          {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
                        </p>
                        {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
                          <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>Para: {t.recipientName}</p>
                        )}
                        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Enviado: {fmtDT(t.createdAt)}</p>
                        {t.usedAt && (
                          <p className="text-[11px] font-bold" style={{ color: GOOD_TEXT }}>Respondido: {fmtDT(t.usedAt)}</p>
                        )}
                      </div>
                      {t.usedAt ? (
                        <span className="shrink-0 text-[11px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 mt-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>
                          <CheckCircle size={10} /> Respondido
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] font-bold uppercase px-2 py-0.5 rounded-full mt-0.5" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                          Pendente
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/** Conformity Link dialog */
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Link freelancer de conformidade: ${conformityLinkDialog.label}`} className="rounded-xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Link Freelancer · Conformidade</p>
            <h3 className="font-black uppercase text-sm truncate" style={{ fontFamily: CONDENSED }}>{conformityLinkDialog.label}</h3>
            {conformityLinkDialog.evaluatorName && (
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Avaliador: <span className="font-bold" style={{ color: "var(--foreground)" }}>{conformityLinkDialog.evaluatorName}</span></p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setConformityLinkDialog(null)}
            aria-label="Fechar diálogo de link de conformidade"
            title="Fechar"
            className="shrink-0 ml-3 transition-colors hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {!conformityLinkUrl ? (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                Para quem é o link?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={conformityLinkRecipientName}
                  aria-label="Para quem é o link"
                  onChange={e => setConformityLinkRecipientName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleGenerateConformityLink(); }}
                  placeholder="Nome do freelancer"
                  className="flex-1 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                  style={fieldStyle}
                />
                <button
                  type="button"
                  onClick={handleGenerateConformityLink}
                  disabled={generating}
                  className="rounded-lg px-3 py-2 text-[11px] font-bold uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Link2 size={12} /> Gerar Link
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: GOOD_TEXT }}>Link gerado — copie e envie</p>
              <div className="flex gap-2 items-start">
                <input
                  readOnly
                  aria-label="Link gerado"
                  value={conformityLinkUrl}
                  className="flex-1 rounded-lg px-2 py-1.5 text-xs font-mono truncate focus:outline-none"
                  style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  onFocus={e => e.target.select()}
                />
                <button
                  type="button"
                  onClick={async () => {
                    const text = `${batchEventHeader} — Matriz ${conformityLinkDialog?.label ?? "de Conformidade"}: ${conformityLinkUrl}`;
                    if (await copyToClipboard(text)) { setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2000); }
                    else toast(COPY_FAILED_TOAST);
                  }}
                  className="shrink-0 rounded-lg px-2.5 py-2 flex items-center gap-1 text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {conformityLinkCopied ? <><CheckCircle size={12} style={{ color: GOOD_TEXT }} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                </button>
              </div>
              <button
                type="button"
                onClick={() => { setConformityLinkUrl(null); setConformityLinkRecipientName(""); }}
                className="text-[11px] font-bold uppercase underline transition-colors hover:opacity-70"
                style={{ color: "var(--muted-foreground)" }}
              >
                Gerar outro link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
