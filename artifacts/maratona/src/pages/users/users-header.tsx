import type { ReactNode } from "react";
import { ShieldCheck, Mail, GitMerge } from "lucide-react";
import { CONDENSED, WARNING } from "@/lib/premium-theme";

/**
 * Título da página + botões do topo. "Migrar Emails" e "Mesclar Avaliadores"
 * são só de admin; os diálogos entram pelos slots `emailMigrationDialog` e `createDialog`.
 */
export function UsersHeader({
  isAdmin, mergeMode, onOpenEmailMigration, onToggleMergeMode, emailMigrationDialog, createDialog,
}: {
  isAdmin: boolean;
  mergeMode: boolean;
  onOpenEmailMigration: () => void;
  onToggleMergeMode: () => void;
  emailMigrationDialog: ReactNode;
  createDialog: ReactNode;
}) {
  return (
    <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
      <div>
        <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none flex items-center gap-2.5" style={{ fontFamily: CONDENSED }}>
          <ShieldCheck size={26} style={{ color: "var(--accent-text)" }} /> Acessos &amp; Permissões
        </h1>
        <p className="text-sm mt-1.5 max-w-xl" style={{ color: "var(--muted-foreground)" }}>Controle quem pode acessar a plataforma e o que podem fazer.</p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {isAdmin && (
          <>
            <button
              onClick={onOpenEmailMigration}
              className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              <Mail size={16} /> Migrar Emails
            </button>
            {emailMigrationDialog}
          </>
        )}
        {isAdmin && (
          <button
            data-testid="button-merge-mode"
            onClick={onToggleMergeMode}
            className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-colors hover:opacity-85"
            style={mergeMode ? { backgroundColor: WARNING, color: "#fff" } : { border: "1px solid var(--border)" }}
          >
            <GitMerge size={16} /> {mergeMode ? "Cancelar Mescla" : "Mesclar Avaliadores"}
          </button>
        )}
        {createDialog}
      </div>
    </section>
  );
}
