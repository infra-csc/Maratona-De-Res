// "Migrar e-mails (Office 365)" em dois passos: prévia (dryRun) → aplicar.
// Nada muda até "Aplicar"; a prévia mostra o antes → depois de cada pessoa.
import { ArrowRight, CheckCircle2, Loader2, Mail, SearchX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { Chip, DialogHeading, Notice, btnPrimary, btnSecondary, dialogCls, dialogFooterCls, surfaceCls, useReturnFocus } from "./users-ui";
import type { EmailMigrationState } from "./use-email-migration";

export function EmailMigrationDialog({ state }: { state: EmailMigrationState }) {
  const { emailMigOpen, emailMigPreview: preview, emailMigLoading: loading, runEmailMigration, closeMigration, onMigrationOpenChange } = state;
  const onCloseAutoFocus = useReturnFocus(emailMigOpen);
  const toUpdate = (preview ?? []).filter(p => p.status === "will_update");
  const same = (preview ?? []).filter(p => p.status === "no_change");
  const notFound = (preview ?? []).filter(p => p.status === "not_found");

  return (
    <Dialog open={emailMigOpen} onOpenChange={o => { if (!loading) onMigrationOpenChange(o); }}>
      <DialogContent className={cn(dialogCls, "max-w-[640px] max-h-[92dvh] flex flex-col overflow-hidden outline-none")} data-testid="email-migration-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={Mail} Title={DialogTitle} Description={DialogDescription} title="Migrar e-mails (Office 365)"
          description="Troca o e-mail dos avaliadores encontrados no Office 365. Veja a prévia antes: nada muda até você aplicar." />

        {!preview ? (
          <div className={cn(surfaceCls, "px-5 py-8 text-center")}>
            <span className="mx-auto w-11 h-11 rounded-full bg-secondary text-muted-foreground flex items-center justify-center"><Mail size={20} aria-hidden /></span>
            <p className="mt-3 text-[14px] text-muted-foreground max-w-sm mx-auto">A prévia lista quem muda de e-mail, quem já está certo e quem não foi encontrado.</p>
            <button type="button" data-testid="button-email-preview" onClick={() => runEmailMigration(true)} disabled={loading} aria-busy={loading || undefined} className={cn(btnPrimary, "mt-4")}>
              {loading && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {loading ? "Buscando…" : "Ver prévia"}
            </button>
          </div>
        ) : (
          <div className="min-h-0 flex-1 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" data-testid="email-preview-summary">
              <Chip tone={toUpdate.length > 0 ? "ok" : "neutral"}>{plural(toUpdate.length, "para atualizar", "para atualizar")}</Chip>
              <Chip>{plural(same.length, "já certo", "já certos")}</Chip>
              {notFound.length > 0 && <Chip tone="warn">{plural(notFound.length, "não encontrado", "não encontrados")}</Chip>}
            </div>
            {toUpdate.length === 0 && (
              <Notice icon={CheckCircle2} tone="ok">Nenhum e-mail para trocar. Todos os encontrados já estão atualizados.</Notice>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-border divide-y divide-border max-h-[46dvh]">
              {toUpdate.map(p => (
                <div key={`u-${p.id}`} className="px-3.5 py-2.5">
                  <p className="text-[14px] font-semibold text-foreground">{p.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px]">
                    <span className="text-muted-foreground line-through break-all">{p.emailFrom ?? "sem e-mail"}</span>
                    <ArrowRight size={12} aria-hidden className="text-muted-foreground shrink-0" />
                    <span className="font-semibold text-[var(--status-ok-text)] break-all">{p.emailTo}</span>
                  </p>
                </div>
              ))}
              {notFound.map(p => (
                <div key={`n-${p.id}`} className="px-3.5 py-2.5 flex items-center gap-2 text-[13px]">
                  <SearchX size={14} aria-hidden className="text-[var(--status-warn-text)] shrink-0" />
                  <span className="text-muted-foreground break-all">{p.email ?? "—"}</span>
                  <span className="text-muted-foreground">· sem usuário com este e-mail</span>
                </div>
              ))}
              {same.map(p => (
                <div key={`s-${p.id}`} className="px-3.5 py-2 text-[13px] text-muted-foreground">
                  <span className="font-semibold">{p.name}</span> · já atualizado
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={dialogFooterCls}>
          <button type="button" onClick={closeMigration} disabled={loading} className={btnSecondary}>Cancelar</button>
          {preview && (
            <button type="button" data-testid="button-email-apply" onClick={() => runEmailMigration(false)} disabled={loading || toUpdate.length === 0} aria-busy={loading || undefined} className={btnPrimary}>
              {loading && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {loading ? "Aplicando…" : toUpdate.length > 0 ? `Aplicar ${plural(toUpdate.length, "troca", "trocas")}` : "Nada a aplicar"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
