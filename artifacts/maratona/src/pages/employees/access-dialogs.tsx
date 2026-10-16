// Acessos ao app: geração em massa (prévia → geração → CSV com as senhas) e
// as credenciais do colaborador recém-criado (mostradas uma vez só).
import type { BulkGenerateAccessResult, CollaboratorsWithoutAccessPreview } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Download, KeyRound, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { Bone, DialogHeading, Eyebrow, Notice, Segmented, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, useReturnFocus } from "./ui";
import { downloadCredentialsCsv, toTitleCase } from "./utils";
import type { BulkTypeFilter } from "./types";

function CountTile({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <Eyebrow as="span" className="block">{label}</Eyebrow>
      <span className={cn("mt-2 block font-condensed text-[30px] font-black leading-none tabular-nums", tone === "warn" && value > 0 && "text-[var(--status-warn-text)]")}>{value}</span>
    </div>
  );
}

/**
 * "Gerar acessos em massa": prévia (prontos / sem CPF) → geração → CSV com as senhas.
 * A prévia (query), a mutação e o estado ficam no pai.
 */
export function BulkAccessDialog({
  open,
  onOpenChange,
  isPreviewLoading,
  preview,
  result,
  typeFilter,
  onTypeFilterChange,
  isGenerating,
  onGenerate,
  onCancel,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isPreviewLoading: boolean;
  preview: CollaboratorsWithoutAccessPreview | undefined;
  result: BulkGenerateAccessResult | null;
  typeFilter: BulkTypeFilter;
  onTypeFilterChange: (t: BulkTypeFilter) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  /** "Cancelar" antes de gerar. */
  onCancel: () => void;
  /** "Fechar" depois de gerar (limpa o resultado e recarrega a prévia). */
  onDone: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const ready = preview?.eligibleCount ?? 0;
  const typeText = typeFilter === "all" ? "ativos" : typeFilter === "casa" ? "casa" : "freela";
  return (
    <Dialog open={open} onOpenChange={v => { if (!isGenerating) onOpenChange(v); }}>
      <DialogContent className={cn(dialogCls, "max-w-[520px] max-h-[90dvh] overflow-y-auto")} data-testid="bulk-access-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={KeyRound} Title={DialogTitle} Description={DialogDescription} title="Gerar acessos em massa"
          description={result ? "Pronto. As senhas só ficam no arquivo CSV — não aparecem de novo." : "Cria o login por CPF de quem ainda não entra no app. A senha inicial aparece uma vez só, no arquivo CSV."} />
        {!result ? (
          <>
            <div>
              <Eyebrow as="span" className="block mb-2" id="bulk-access-type">Para quem</Eyebrow>
              <Segmented<BulkTypeFilter>
                label="Tipo de colaborador"
                value={typeFilter}
                onChange={onTypeFilterChange}
                disabled={isGenerating}
                options={[{ value: "casa", label: "Casa" }, { value: "freela", label: "Freela" }, { value: "all", label: "Todos" }]}
              />
            </div>
            {isPreviewLoading ? (
              <div role="status" aria-label="Carregando a prévia" className="grid grid-cols-2 gap-3">
                {[0, 1].map(i => <div key={i} className="rounded-xl border border-border px-4 py-3 space-y-3"><Bone className="h-3 w-24" /><Bone className="h-7 w-12" /></div>)}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3" aria-live="polite">
                <CountTile label="Prontos para gerar" value={ready} />
                <CountTile label="Sem CPF cadastrado" value={preview?.missingCpfCount ?? 0} tone="warn" />
              </div>
            )}
            {!isPreviewLoading && preview && preview.missingCpf.length > 0 && (
              <Notice icon={AlertTriangle} tone="warn">
                <p className="font-semibold text-foreground">Precisam de CPF antes de ter acesso</p>
                <ul className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5 pr-1">
                  {preview.missingCpf.map(m => <li key={m.id}>{toTitleCase(m.name)}</li>)}
                </ul>
                <p className="mt-1.5 text-muted-foreground">Preencha em Editar ou em “Importar CPFs”.</p>
              </Notice>
            )}
            {!isPreviewLoading && preview && ready === 0 && preview.missingCpf.length === 0 && (
              <Notice icon={CheckCircle2} tone="ok">Todo colaborador {typeText} já tem acesso. Nada a gerar.</Notice>
            )}
            <div className={dialogFooterCls}>
              <button type="button" onClick={onCancel} disabled={isGenerating} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-bulk-generate" disabled={!preview || ready === 0 || isGenerating || isPreviewLoading}
                aria-busy={isGenerating || undefined} onClick={onGenerate} className={btnPrimary}>
                {isGenerating ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <KeyRound size={15} aria-hidden />}
                {isGenerating ? "Gerando…" : `Gerar ${plural(ready, "acesso", "acessos")}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <Notice icon={CheckCircle2} tone="ok" testId="bulk-access-result">
              <p><strong className="text-foreground">{plural(result.createdCount, "acesso gerado", "acessos gerados")}.</strong> Baixe o arquivo antes de fechar.</p>
            </Notice>
            {result.conflicts.length > 0 && (
              <Notice icon={AlertTriangle} tone="warn">{result.conflicts.length === 1 ? "1 colaborador já tinha acesso e foi ignorado." : `${result.conflicts.length} colaboradores já tinham acesso e foram ignorados.`}</Notice>
            )}
            <button type="button" data-testid="button-download-credentials-csv" onClick={() => downloadCredentialsCsv(result.created)} disabled={result.created.length === 0}
              className={cn(btnPrimary, "w-full min-h-12")}>
              <Download size={16} aria-hidden /> Baixar CSV com as credenciais
            </button>
            <div className={dialogFooterCls}>
              <button type="button" onClick={onDone} className={btnSecondary}>Fechar</button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Credenciais do colaborador recém-criado (exibidas uma única vez). */
export function NewAccessDialog({
  newAccess,
  onClose,
}: {
  newAccess: { cpfLogin: string; password: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!newAccess} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[420px]")} data-testid="new-access-dialog">
        <DialogHeading icon={KeyRound} tone="brand" Title={DialogTitle} Description={DialogDescription} title="Acesso gerado"
          description="Anote ou compartilhe agora — a senha não aparece de novo." />
        <dl className="rounded-xl border border-border divide-y divide-border">
          <div className="px-4 py-3">
            <dt><Eyebrow as="span">Login (CPF)</Eyebrow></dt>
            <dd className="mt-1.5 font-mono text-[18px] font-bold tracking-wider" data-testid="text-new-access-cpf">{newAccess?.cpfLogin}</dd>
          </div>
          <div className="px-4 py-3 bg-secondary/50">
            <dt><Eyebrow as="span">Senha inicial</Eyebrow></dt>
            <dd className="mt-1.5 font-mono text-[18px] font-bold tracking-wider" data-testid="text-new-access-password">{newAccess?.password}</dd>
          </div>
        </dl>
        <div className={dialogFooterCls}>
          <button type="button" data-testid="button-close-new-access" onClick={onClose} className={btnPrimary}>Entendi</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
