import type { BulkGenerateAccessResult, CollaboratorsWithoutAccessPreview } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, AlertTriangle } from "lucide-react";
import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { downloadCredentialsCsv } from "./utils";
import type { BulkTypeFilter } from "./types";

/**
 * "Gerar Acessos em Massa": prévia (prontos / sem CPF) → geração → CSV com as senhas.
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Gerar Acessos em Massa</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          {isPreviewLoading ? (
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Carregando prévia...</p>
          ) : !result ? (
            <>
              <div className="flex gap-2">
                {(["casa", "freela", "all"] as const).map(t => {
                  const active = typeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => onTypeFilterChange(t)}
                      className="px-4 py-2 rounded-lg font-bold text-[11px] uppercase transition-colors"
                      style={active ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
                    >
                      {t === "all" ? "Todos" : t.toUpperCase()}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Serão criados logins por CPF para colaboradores {typeFilter === "all" ? "ativos" : `tipo ${typeFilter.toUpperCase()}`} sem acesso à plataforma. A senha inicial será gerada automaticamente e exibida apenas uma vez, junto com o arquivo CSV para download.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--secondary)" }}>
                  <p className="text-3xl font-black" style={{ fontFamily: CONDENSED }}>{preview?.eligibleCount ?? 0}</p>
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Prontos para gerar acesso</p>
                </div>
                <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--secondary)" }}>
                  <p className="text-3xl font-black" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>{preview?.missingCpfCount ?? 0}</p>
                  <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Sem CPF cadastrado</p>
                </div>
              </div>
              {preview && preview.missingCpf.length > 0 && (
                <div className="rounded-lg max-h-40 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                  <div className="px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold uppercase" style={{ backgroundColor: WARNING, color: "#fff" }}>
                    <AlertTriangle size={14} /> Precisam de CPF cadastrado
                  </div>
                  <ul>
                    {preview.missingCpf.map((m, i) => (
                      <li key={m.id} className="px-3 py-2 text-sm" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>{m.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={() => onCancel()} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                <button
                  data-testid="button-confirm-bulk-generate"
                  disabled={!preview || preview.eligibleCount === 0 || isGenerating}
                  onClick={() => onGenerate()}
                  className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {isGenerating ? "Gerando..." : `Gerar ${preview?.eligibleCount ?? 0} Acessos`}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                <strong style={{ color: "var(--foreground)" }}>{result.createdCount}</strong> acesso(s) gerado(s) com sucesso. Baixe o arquivo CSV agora — as senhas não poderão ser visualizadas novamente.
              </p>
              {result.conflicts.length > 0 && (
                <p className="text-xs" style={{ color: DANGER_TEXT }}>{result.conflicts.length} colaborador(es) já possuíam acesso e foram ignorados.</p>
              )}
              <button
                data-testid="button-download-credentials-csv"
                onClick={() => downloadCredentialsCsv(result.created)}
                disabled={result.created.length === 0}
                className="w-full h-12 rounded-lg font-black uppercase text-[13px] tracking-tight flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Download size={16} /> Baixar CSV com Credenciais
              </button>
              <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => onDone()}
                  className="h-10 px-4 rounded-lg font-bold uppercase text-xs transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  Fechar
                </button>
              </div>
            </>
          )}
        </div>
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
      <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Acesso Gerado</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Anote ou compartilhe estas credenciais agora — a senha não será exibida novamente.</p>
          <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "var(--secondary)" }}>
            <div>
              <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Login (CPF)</p>
              <p className="text-lg font-black" data-testid="text-new-access-cpf">{newAccess?.cpfLogin}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Senha Inicial</p>
              <p className="text-lg font-black" data-testid="text-new-access-password">{newAccess?.password}</p>
            </div>
          </div>
          <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              data-testid="button-close-new-access"
              onClick={() => onClose()}
              className="h-10 px-4 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Entendi
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
