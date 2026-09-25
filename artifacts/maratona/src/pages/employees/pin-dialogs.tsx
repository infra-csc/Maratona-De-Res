import type { CasaPin, SkippedPin } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { Hash, Copy, Check, Link } from "lucide-react";
import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import type { PinDialogData, ToastFn } from "./types";

/**
 * "Gerar Senhas — Colaboradores Casa": mostra as senhas carregadas (casa-pins) ou recém-definidas
 * (bulk-generate-pins). Carga, geração e estado ficam no pai.
 */
export function BulkPinDialog({
  open,
  onOpenChange,
  loading,
  result,
  source,
  confirmRegen,
  onConfirmRegenChange,
  onGenerate,
  onCancel,
  onClose,
  appLink,
  linkCopied,
  onLinkCopiedChange,
  toast,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  loading: boolean;
  result: { results: CasaPin[]; skipped: SkippedPin[] } | null;
  source: "loaded" | "generated";
  confirmRegen: boolean;
  onConfirmRegenChange: (v: boolean) => void;
  onGenerate: () => void;
  /** "Cancelar" quando ainda não há senhas. */
  onCancel: () => void;
  /** "Fechar" com a lista na tela. */
  onClose: () => void;
  appLink: string;
  linkCopied: boolean;
  onLinkCopiedChange: (v: boolean) => void;
  toast: ToastFn;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
            Gerar Senhas — Colaboradores Casa
          </DialogTitle>
        </DialogHeader>

        {loading && !result ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Hash size={24} className="animate-spin" style={{ color: "#ccff00" }} />
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontFamily: CONDENSED }}>Carregando…</p>
          </div>
        ) : !result ? (
          <div className="space-y-4 pt-1">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Nenhuma senha definida ainda. Clique abaixo para definir a senha de todos os colaboradores casa ativos com CPF cadastrado. A senha de cada um será o próprio CPF (11 dígitos sem pontuação).
            </p>
            <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => onCancel()} className="h-10 px-4 rounded-lg font-bold text-sm uppercase" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
              <button
                onClick={onGenerate}
                disabled={loading}
                className="h-10 px-5 rounded-lg font-black text-sm uppercase flex items-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: "#ccff00", color: "#000" }}
              >
                <Hash size={15} /> Definir senhas (CPF)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {/* Stats + source badge */}
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                <p className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "#ccff00" }}>{result.results.length}</p>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
                  {source === "generated" ? "Senhas definidas agora" : "Senhas ativas"}
                </p>
              </div>
              {result.skipped.length > 0 && (
                <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>{result.skipped.length}</p>
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Sem CPF (ignorados)</p>
                </div>
              )}
            </div>

            {/* Scrollable table */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                <table className="w-full text-sm border-collapse">
                  <thead style={{ backgroundColor: "var(--secondary)", position: "sticky", top: 0, zIndex: 10 }}>
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, borderBottom: "1px solid var(--border)" }}>Nome</th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, borderBottom: "1px solid var(--border)" }}>Senha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={r.cpfLogin ?? `${r.name}-${i}`} style={{ borderBottom: i < result.results.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: i % 2 === 0 ? "transparent" : "var(--secondary)" }}>
                        <td className="px-4 py-2.5 font-medium">{r.name}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className="text-sm font-black font-mono" style={{ color: "#ccff00" }}>
                            {r.pin.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Shared access link */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
              <Link size={12} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
              <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--muted-foreground)" }}>{appLink}</span>
              <button
                onClick={async () => {
                  if (await copyToClipboard(appLink)) { onLinkCopiedChange(true); setTimeout(() => onLinkCopiedChange(false), 2000); }
                  else toast(COPY_FAILED_TOAST);
                }}
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded font-black text-[11px] uppercase transition-all hover:opacity-80"
                style={{ border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer" }}
              >
                {linkCopied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Link</>}
              </button>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const bom = "﻿";
                    const header = "Nome,Senha";
                    const body = result.results.map(r => `"${r.name.replace(/"/g, '""')}","${r.pin}"`).join("\n");
                    const blob = new Blob([bom + header + "\n" + body], { type: "text/csv;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "senhas-colaboradores.csv"; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg font-bold text-xs uppercase"
                  style={{ backgroundColor: "#ccff00", color: "#000", border: "none", cursor: "pointer" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Baixar Excel
                </button>
                <button
                  onClick={async () => {
                    const lines = ["Nome | Senha", ...result.results.map(r => `${r.name} | ${r.pin}`)];
                    if (await copyToClipboard(lines.join("\n"))) toast({ title: "Lista copiada!", description: `${result.results.length} colaboradores` });
                    else toast(COPY_FAILED_TOAST);
                  }}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg font-bold text-xs uppercase"
                  style={{ border: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <Copy size={13} /> Copiar lista
                </button>
              </div>
              <div className="flex gap-2 items-center">
                {confirmRegen ? (
                  <>
                    <span className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Redefinir senhas para CPF?</span>
                    <button
                      onClick={onGenerate}
                      disabled={loading}
                      className="h-9 px-3 rounded-lg font-black text-xs uppercase flex items-center gap-1 disabled:opacity-60"
                      style={{ backgroundColor: WARNING, color: "#000", cursor: "pointer" }}
                    >
                      {loading ? <Hash size={12} className="animate-spin" /> : <Hash size={12} />} Confirmar
                    </button>
                    <button onClick={() => onConfirmRegenChange(false)} className="h-9 px-3 rounded-lg font-bold text-xs uppercase" style={{ border: "1px solid var(--border)", cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onConfirmRegenChange(true)}
                    className="h-9 px-4 rounded-lg font-bold text-xs uppercase flex items-center gap-1"
                    style={{ border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    <Hash size={13} /> Redefinir senhas (CPF)
                  </button>
                )}
                <button
                  onClick={() => onClose()}
                  className="h-9 px-4 rounded-lg font-bold text-xs uppercase"
                  style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", cursor: "pointer" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** PIN individual gerado ("Acesso Criado" ou "Senha Redefinida"). */
export function PinDialog({
  pinDialog,
  onClose,
  pinCopied,
  onPinCopiedChange,
  toast,
}: {
  pinDialog: PinDialogData | null;
  onClose: () => void;
  pinCopied: boolean;
  onPinCopiedChange: (v: boolean) => void;
  toast: ToastFn;
}) {
  return (
    <Dialog open={!!pinDialog} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
            {pinDialog?.created ? "Acesso Criado" : "Senha Redefinida"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {pinDialog?.created
              ? "Acesso criado com sucesso. A senha é o CPF do colaborador (11 dígitos)."
              : `Senha redefinida para ${pinDialog?.empName}. A senha é o CPF do colaborador.`}
          </p>

          <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)", fontFamily: CONDENSED }}>Login (CPF)</p>
              <p className="text-base font-black tracking-widest">{pinDialog?.cpfLogin}</p>
            </div>
            <div className="px-4 py-4" style={{ backgroundColor: "var(--primary)", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
              <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--primary-foreground)", opacity: 0.65, fontFamily: CONDENSED }}>Senha (CPF)</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-black font-mono tracking-wider" style={{ color: "var(--primary-foreground)" }}>
                  {pinDialog?.pin.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")}
                </span>
                <button
                  onClick={async () => {
                    if (!pinDialog) return;
                    if (await copyToClipboard(pinDialog.pin)) { onPinCopiedChange(true); setTimeout(() => onPinCopiedChange(false), 2000); }
                    else toast(COPY_FAILED_TOAST);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-[11px] uppercase transition-all hover:opacity-80"
                  style={{ backgroundColor: "rgba(0,0,0,0.25)", color: "var(--primary-foreground)" }}
                >
                  {pinCopied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              onClick={() => onClose()}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
            >
              Fechar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
