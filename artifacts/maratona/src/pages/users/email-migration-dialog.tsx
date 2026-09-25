import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import type { EmailMigrationState } from "./use-email-migration";

/** Diálogo "Migrar Emails Office 365": prévia do que muda → confirmar e aplicar. */
export function EmailMigrationDialog({ state }: { state: EmailMigrationState }) {
  const { emailMigOpen, emailMigPreview, emailMigLoading, runEmailMigration, closeMigration, onMigrationOpenChange } = state;
  return (
    <Dialog open={emailMigOpen} onOpenChange={onMigrationOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Migrar Emails Office 365</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Atualiza os emails dos avaliadores identificados no Office 365. Clique em <em>Prévia</em> para ver o que será alterado antes de confirmar.</p>
          {!emailMigPreview && (
            <button
              onClick={() => runEmailMigration(true)}
              disabled={emailMigLoading}
              className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide disabled:opacity-50 transition-colors hover:opacity-80"
              style={{ border: "1px solid var(--border)" }}
            >
              {emailMigLoading ? "Carregando..." : "Ver Prévia"}
            </button>
          )}
          {emailMigPreview && (
            <div className="space-y-3">
              <div className="flex gap-4 text-xs font-bold uppercase tracking-wide">
                <span style={{ color: GOOD_TEXT }}>{emailMigPreview.filter(p => p.status === "will_update").length} para atualizar</span>
                <span style={{ color: "var(--muted-foreground)" }}>{emailMigPreview.filter(p => p.status === "no_change").length} sem mudança</span>
                {emailMigPreview.filter(p => p.status === "not_found").length > 0 && (
                  <span style={{ color: DANGER_TEXT }}>{emailMigPreview.filter(p => p.status === "not_found").length} não encontrado</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
                {emailMigPreview.filter(p => p.status === "will_update").map((p, i) => (
                  <div key={p.id} className="px-3 py-2 text-xs" style={{ backgroundColor: "rgba(154,176,0,0.08)", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                    <span className="font-bold">{p.name}</span>
                    <div className="line-through" style={{ color: "var(--muted-foreground)" }}>{p.emailFrom ?? <em>sem email</em>}</div>
                    <div className="font-mono" style={{ color: GOOD_TEXT }}>{p.emailTo}</div>
                  </div>
                ))}
                {emailMigPreview.filter(p => p.status === "no_change").map((p, i) => (
                  <div key={p.id} className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                    <span className="font-bold">{p.name}</span> — já atualizado
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => runEmailMigration(false)}
                  disabled={emailMigLoading || emailMigPreview.filter(p => p.status === "will_update").length === 0}
                  className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {emailMigLoading ? "Aplicando..." : "Confirmar e Aplicar"}
                </button>
                <button
                  onClick={closeMigration}
                  className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
