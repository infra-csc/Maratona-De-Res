// Senhas dos colaboradores casa (senha = CPF): a lista em massa (carregada ou
// recém-definida) e o acesso individual criado/redefinido.
import type { CasaPin, SkippedPin } from "@workspace/api-client-react";
import { AlertTriangle, Check, Copy, Download, Hash, KeyRound, Link, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { cn, plural } from "@/lib/utils";
import { Bone, DialogHeading, Eyebrow, Notice, btnPrimary, btnSecondary, btnSmall, dialogCls, dialogFooterCls, iconBtn, useReturnFocus } from "./ui";
import { toTitleCase } from "./utils";
import type { PinDialogData, ToastFn } from "./types";

const fmtCpf = (v: string) => v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

function downloadPinsCsv(results: CasaPin[]) {
  const bom = "﻿";
  const header = "Nome,Senha";
  const body = results.map(r => `"${r.name.replace(/"/g, '""')}","${r.pin}"`).join("\n");
  const blob = new Blob([bom + header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "senhas-colaboradores.csv"; a.click();
  URL.revokeObjectURL(url);
}

/**
 * "Gerar senhas — colaboradores casa": mostra as senhas carregadas (casa-pins) ou recém-definidas
 * (bulk-generate-pins). Carga, geração e estado ficam no pai.
 */
export function BulkPinDialog({
  open, onOpenChange, loading, result, source, confirmRegen, onConfirmRegenChange, onGenerate, onCancel, onClose, appLink, linkCopied, onLinkCopiedChange, toast,
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
  const onCloseAutoFocus = useReturnFocus(open);
  return (
    <Dialog open={open} onOpenChange={v => { if (!loading || v) onOpenChange(v); }}>
      <DialogContent className={cn(dialogCls, "max-w-[640px] max-h-[92dvh] overflow-y-auto")} data-testid="bulk-pin-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Hash} Title={DialogTitle} Description={DialogDescription} title="Senhas dos colaboradores casa"
          description="A senha de cada colaborador casa é o próprio CPF (11 dígitos, sem pontuação). O login também é o CPF." />

        {loading && !result ? (
          <div role="status" aria-label="Carregando as senhas" className="rounded-xl border border-border divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex items-center justify-between px-4 py-3"><Bone className="h-4 w-44" /><Bone className="h-4 w-28" /></div>)}
          </div>
        ) : !result ? (
          <>
            <Notice icon={KeyRound} tone="neutral">Nenhuma senha definida ainda. Defina agora a senha de todos os colaboradores casa ativos com CPF cadastrado.</Notice>
            <div className={dialogFooterCls}>
              <button type="button" onClick={onCancel} className={btnSecondary}>Cancelar</button>
              <button type="button" onClick={onGenerate} disabled={loading} aria-busy={loading || undefined} className={btnPrimary} data-testid="button-define-pins">
                {loading ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Hash size={15} aria-hidden />} {loading ? "Definindo…" : "Definir senhas (CPF)"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border px-4 py-3">
                <Eyebrow as="span" className="block">{source === "generated" ? "Definidas agora" : "Senhas ativas"}</Eyebrow>
                <span className="mt-2 block font-condensed text-[30px] font-black leading-none tabular-nums">{result.results.length}</span>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <Eyebrow as="span" className="block">Sem CPF (ignorados)</Eyebrow>
                <span className={cn("mt-2 block font-condensed text-[30px] font-black leading-none tabular-nums", result.skipped.length > 0 && "text-[var(--status-warn-text)]")}>{result.skipped.length}</span>
              </div>
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-[14px] border-collapse" aria-label="Senhas dos colaboradores casa">
                  <thead className="sticky top-0 z-10 bg-card">
                    <tr className="border-b border-border">
                      <th className="font-condensed px-4 h-10 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nome</th>
                      <th className="font-condensed px-4 h-10 text-right text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Senha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((r, i) => (
                      <tr key={r.cpfLogin ?? `${r.name}-${i}`} className="border-t border-border first:border-t-0">
                        <td className="px-4 py-2.5 font-medium" title={r.name}>{toTitleCase(r.name)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums whitespace-nowrap">{fmtCpf(r.pin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-secondary/70 pl-3.5 pr-1.5 py-1.5">
              <Link size={14} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-muted-foreground" title={appLink}>{appLink}</span>
              <button type="button" aria-label="Copiar o link do app" title="Copiar o link do app"
                onClick={async () => {
                  if (await copyToClipboard(appLink)) { onLinkCopiedChange(true); setTimeout(() => onLinkCopiedChange(false), 2000); }
                  else toast(COPY_FAILED_TOAST);
                }}
                className={cn(btnSmall, "min-h-11 lg:min-h-8")}>
                {linkCopied ? <><Check size={13} aria-hidden /> Copiado</> : <><Copy size={13} aria-hidden /> Copiar link</>}
              </button>
            </div>

            {confirmRegen && (
              <Notice icon={AlertTriangle} tone="warn" testId="confirm-regen-pins">
                <p className="font-semibold text-foreground">Redefinir a senha de todos os colaboradores casa para o CPF?</p>
                <p className="mt-0.5">Quem tiver CPF cadastrado volta a entrar com o CPF como senha.</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button type="button" onClick={onGenerate} disabled={loading} aria-busy={loading || undefined} className={cn(btnPrimary, "min-h-10 text-[13px]")}>
                    {loading ? <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" /> : <Hash size={14} aria-hidden />} {loading ? "Redefinindo…" : "Sim, redefinir"}
                  </button>
                  <button type="button" onClick={() => onConfirmRegenChange(false)} disabled={loading} className={cn(btnSecondary, "min-h-10 text-[13px]")}>Não</button>
                </div>
              </Notice>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                <button type="button" onClick={() => downloadPinsCsv(result.results)} className={btnSecondary}><Download size={15} aria-hidden /> Baixar planilha</button>
                <button type="button"
                  onClick={async () => {
                    const lines = ["Nome | Senha", ...result.results.map(r => `${r.name} | ${r.pin}`)];
                    if (await copyToClipboard(lines.join("\n"))) toast({ title: "Lista copiada", description: plural(result.results.length, "colaborador", "colaboradores") });
                    else toast(COPY_FAILED_TOAST);
                  }}
                  className={btnSecondary}><Copy size={15} aria-hidden /> Copiar lista</button>
              </div>
              <div className="sm:ml-auto flex gap-2 [&>button]:flex-1 sm:[&>button]:flex-none">
                {!confirmRegen && (
                  <button type="button" onClick={() => onConfirmRegenChange(true)} className={btnSecondary} data-testid="button-regen-pins"><Hash size={15} aria-hidden /> Redefinir senhas</button>
                )}
                <button type="button" onClick={onClose} disabled={loading} className={btnPrimary}>Fechar</button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Acesso individual ("Acesso criado" ou "Senha redefinida"): login e senha = CPF. */
export function PinDialog({ pinDialog, onClose, pinCopied, onPinCopiedChange, toast }: {
  pinDialog: PinDialogData | null;
  onClose: () => void;
  pinCopied: boolean;
  onPinCopiedChange: (v: boolean) => void;
  toast: ToastFn;
}) {
  const onCloseAutoFocus = useReturnFocus(!!pinDialog);
  const name = pinDialog ? toTitleCase(pinDialog.empName) : "";
  return (
    <Dialog open={!!pinDialog} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[440px]")} data-testid="pin-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={KeyRound} tone="brand" Title={DialogTitle} Description={DialogDescription}
          title={pinDialog?.created ? "Acesso criado" : "Senha redefinida"}
          description={pinDialog?.created ? `${name} já pode entrar no app. Login e senha são o CPF.` : `A senha de ${name} voltou a ser o CPF.`} />
        <dl className="rounded-xl border border-border divide-y divide-border">
          <div className="px-4 py-3">
            <dt><Eyebrow as="span">Login (CPF)</Eyebrow></dt>
            <dd className="mt-1.5 font-mono text-[17px] font-bold tracking-wider">{pinDialog?.cpfLogin}</dd>
          </div>
          <div className="px-4 py-3 bg-secondary/50 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <dt><Eyebrow as="span">Senha</Eyebrow></dt>
              <dd className="mt-1.5 font-mono text-[22px] font-black tracking-wider tabular-nums">{pinDialog ? fmtCpf(pinDialog.pin) : ""}</dd>
            </div>
            <button type="button" aria-label={pinCopied ? "Senha copiada" : "Copiar a senha"} title="Copiar a senha"
              onClick={async () => {
                if (!pinDialog) return;
                if (await copyToClipboard(pinDialog.pin)) { onPinCopiedChange(true); setTimeout(() => onPinCopiedChange(false), 2000); }
                else toast(COPY_FAILED_TOAST);
              }}
              className={cn(iconBtn, pinCopied && "text-[var(--status-ok-text)]")}>
              {pinCopied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            </button>
          </div>
        </dl>
        <div className={dialogFooterCls}>
          <button type="button" onClick={onClose} className={btnPrimary}>Fechar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
