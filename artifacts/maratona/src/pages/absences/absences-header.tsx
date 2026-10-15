// Topo fixo: o único h1, o ciclo que a lista mostra e as ações (tipos,
// exportar e "Novo lançamento").
import { useState } from "react";
import { Link } from "wouter";
import { exportAbsences } from "@workspace/api-client-react";
import { Download, Eye, Loader2, Plus, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, cn } from "@/lib/utils";
import { Chip, btnGhost, btnPrimary } from "./absences-ui";

export function AbsencesHeader({ canEdit, canManageTypes, onCreate }: {
  canEdit: boolean;
  /** Admin e RH abrem o cadastro de tipos (a rota é deles). */
  canManageTypes: boolean;
  onCreate: () => void;
}) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportAbsences();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
      toast({ title: "Planilha exportada", description: data.filename });
    } catch (e) {
      toast({ title: "Não foi possível exportar", description: apiErrorMessage(e, "Tente de novo em instantes."), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
      <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[22px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-[0.95] text-foreground sm:truncate">
        Penalidades e méritos
      </h1>
      <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">O que foi lançado, para quem, e quanto isso mexe na nota.</p>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
        {canManageTypes && (
          <Link href="/penalty-types" data-testid="link-penalty-types" aria-label="Tipos de lançamento" title="Tipos de lançamento"
            className={cn(btnGhost, "px-2.5 lg:px-3")}>
            <Tags size={16} aria-hidden /><span className="hidden lg:inline">Tipos</span>
          </Link>
        )}
        <button type="button" data-testid="button-export-absences" onClick={handleExport} disabled={exporting} aria-busy={exporting || undefined}
          aria-label="Exportar planilha" title="Exportar planilha (CSV)" className={cn(btnGhost, "px-2.5 lg:px-3")}>
          {exporting ? <Loader2 size={16} aria-hidden className="motion-safe:animate-spin" /> : <Download size={16} aria-hidden />}
          <span className="hidden lg:inline">{exporting ? "Exportando…" : "Exportar"}</span>
        </button>
        {canEdit ? (
          <button type="button" data-testid="button-register-absence" onClick={onCreate} className={cn(btnPrimary, "hidden md:inline-flex min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")}>
            <Plus size={15} aria-hidden /> Novo<span className="hidden lg:inline"> lançamento</span>
          </button>
        ) : (
          <Chip icon={Eye} title="Seu perfil só consulta os lançamentos">Só consulta</Chip>
        )}
      </div>
    </div>
  );
}
