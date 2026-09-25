import { exportAbsences } from "@workspace/api-client-react";
import { Plus, UserMinus, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CycleBadge } from "@/components/cycle-badge";
import { CONDENSED } from "@/lib/premium-theme";

/** Título da tela + ações "Exportar" (CSV) e "Novo Lançamento". */
export function AbsencesHeader({ canEdit, onCreate }: { canEdit: boolean | null; onCreate: () => void }) {
  const { toast } = useToast();

  async function handleExport() {
    try {
      const data = await exportAbsences();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  return (
    <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e84000" }}>
          <UserMinus size={26} className="text-white" />
        </div>
        <div>
          <h1 data-testid="text-page-title" className="font-black uppercase leading-none" style={{ fontFamily: CONDENSED, fontSize: "clamp(2rem,5vw,3.2rem)", letterSpacing: "-0.02em" }}>
            Penalidades e <span style={{ color: "var(--accent-text)" }}>Méritos</span>
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
            Penalidades descontam e méritos somam pontos na nota final do colaborador.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <CycleBadge />
        <button
          data-testid="button-export-absences"
          onClick={handleExport}
          className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-opacity hover:opacity-70"
          style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          <Download size={14} /> Exportar
        </button>
        {canEdit && (
          <button
            data-testid="button-register-absence"
            onClick={onCreate}
            className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-opacity hover:opacity-85"
            style={{ backgroundColor: "#e84000", color: "white" }}
          >
            <Plus size={15} /> Novo Lançamento
          </button>
        )}
      </div>
    </section>
  );
}
