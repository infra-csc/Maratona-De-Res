import { CheckCircle, Link2, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import type { PublicToken } from "@/lib/routing-api";
import { CONDENSED } from "@/lib/premium-theme";
import { fmtDT, publicEvalBaseUrl } from "./helpers";
import type { ConformityLinkType, ToastFn } from "./types";

interface ConformityPublicLinkDialogProps {
  linkType: ConformityLinkType | null;
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
}

// ── Dialog: Link Público de Conformidade (Cenografia / Ferramentas) ──
export function ConformityPublicLinkDialog({
  linkType, recipientName, setRecipientName, generatedUrl, linkCopied, setLinkCopied,
  conformityHistory, ferramentasHistory, isGenerating, onGenerate, onClose, toast,
}: ConformityPublicLinkDialogProps) {
  return (
    <Dialog open={linkType !== null} onOpenChange={o => { if (!o) { onClose(); } }}>
      <DialogContent className="max-w-md rounded-xl border-border" style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-xl uppercase font-black tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <Link2 size={18} />
            {linkType === "cenografia" ? "Link Freelancer — Cenografia" : "Link Freelancer — Ferramentas"}
          </DialogTitle>
        </DialogHeader>

        {(() => {
          // Um link só por formulário: se já existe um pendente, mostramos o
          // MESMO link pra reenviar; se já foi respondido, não há o que gerar.
          const hist = linkType === "cenografia"
            ? (conformityHistory ?? [])
            : (ferramentasHistory ?? []);
          const answered = hist.find(t => t.usedAt != null);
          const pending = hist.find(t => t.usedAt == null);
          const base = publicEvalBaseUrl();
          const existingUrl = pending ? `${base}/eval/${pending.id}` : null;
          const shownUrl = generatedUrl ?? existingUrl;
          return (
            <>
              <div className="space-y-4 py-2">
                {answered ? (
                  <div className="border border-accent rounded-lg bg-accent/10 p-3 flex items-start gap-2">
                    <CheckCircle size={16} className="text-accent-text shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-accent-text">
                      Formulário já respondido por <span className="uppercase">{answered.submitterName ?? answered.recipientName ?? "freelancer"}</span>
                      {answered.usedAt ? ` em ${fmtDT(answered.usedAt)}` : ""}. Não é possível gerar outro link.
                    </p>
                  </div>
                ) : shownUrl ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {pending && !generatedUrl
                        ? <>Já existe um link enviado para <strong>{pending.recipientName ?? "—"}</strong> aguardando resposta. Se a pessoa perdeu, copie e reenvie o mesmo link.</>
                        : "Link gerado com sucesso! Copie e envie ao freelancer."}
                    </p>
                    <div className="border border-border rounded-lg bg-secondary px-3 py-2 flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground truncate flex-1">{shownUrl}</span>
                      <button type="button"
                        onClick={async () => { if (await copyToClipboard(shownUrl)) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); } else toast(COPY_FAILED_TOAST); }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black uppercase bg-primary text-primary-foreground border border-primary rounded-lg hover:opacity-90 transition-colors"
                      >
                        <Copy size={12} />{linkCopied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Este link é de uso único e expira após o freelancer submeter o formulário.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {linkType === "cenografia"
                        ? "Gere um link único para um freelancer preencher o formulário de conformidade de Cenografia (EPI, Estaiamentos, Conduta, Ausências e Destaque). Só pode existir um link por evento."
                        : "Gere um link único para um freelancer preencher o formulário de Guarda de Equipamentos. Só pode existir um link por evento."}
                    </p>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase">Nome do destinatário</Label>
                      <input
                        type="text"
                        value={recipientName}
                        onChange={e => setRecipientName(e.target.value)}
                        placeholder="Ex.: Fred Ribeiro"
                        className="w-full border border-border rounded-lg px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </>
                )}

                {/* Registro do envio */}
                {hist.length > 0 && (
                  <div>
                    <p className="text-[11px] font-black uppercase text-muted-foreground mb-2">Registro</p>
                    <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                      {hist.map(t => (
                        <div key={t.id} className="flex items-center justify-between px-3 py-2 gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">
                              {t.usedAt ? (t.submitterName ?? t.recipientName ?? "—") : (t.recipientName ?? "—")}
                            </p>
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
                            <span className="shrink-0 text-[11px] font-bold uppercase bg-primary text-primary-foreground border border-primary rounded-lg px-2 py-0.5 flex items-center gap-1">
                              <CheckCircle size={10} /> Respondido
                            </span>
                          ) : (
                            <span className="shrink-0 text-[11px] font-bold uppercase bg-secondary text-muted-foreground border border-border rounded-lg px-2 py-0.5">
                              Pendente
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 pt-4">
                <button type="button"
                  onClick={onClose}
                  className="border border-border rounded-lg px-5 py-2.5 font-bold uppercase text-xs hover:bg-secondary transition-colors"
                >
                  {shownUrl || answered ? "Fechar" : "Cancelar"}
                </button>
                {!shownUrl && !answered && (
                  <button type="button"
                    disabled={!recipientName.trim() || isGenerating}
                    onClick={() => {
                      if (!recipientName.trim()) return;
                      onGenerate(base);
                    }}
                    className="bg-primary text-primary-foreground border border-primary rounded-lg px-5 py-2.5 font-bold uppercase text-xs disabled:opacity-50"
                  >
                    {isGenerating ? "Gerando..." : "Gerar Link"}
                  </button>
                )}
              </DialogFooter>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
