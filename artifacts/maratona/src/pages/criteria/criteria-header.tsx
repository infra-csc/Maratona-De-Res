import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Building2, Zap, RefreshCw } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import type { useCriteriaMaintenance } from "./use-criteria-maintenance";

/** Título da página + botões de manutenção e "Novo Critério". */
export function CriteriaHeader({
  maintenance, canEdit, createOpen, onCreateOpenChange,
}: {
  maintenance: ReturnType<typeof useCriteriaMaintenance>;
  canEdit: boolean;
  createOpen: boolean;
  onCreateOpenChange: (o: boolean) => void;
}) {
  const {
    fixCalibRunning, fixCalibResult, runFixCalibrationCriteria,
    syncLabelsRunning, syncLabelsResult, runSyncAreaLabels,
    resyncAllMutation,
  } = maintenance;

  return (
    <>
      {/* Page header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Configuração de Performance</span>
          <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none mt-1" style={{ fontFamily: CONDENSED }}>
            Critérios de Avaliação
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>Configure os quesitos de avaliação com nota, seus respectivos pesos e roteamento de avaliadores.</p>
        </div>
      </section>

      {/* Actions */}
      <section className="flex justify-end gap-3 flex-wrap items-start">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={syncLabelsRunning}
            onClick={runSyncAreaLabels}
            className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
          >
            <Building2 size={15} className={syncLabelsRunning ? "animate-pulse" : ""} />
            {syncLabelsRunning ? "Sincronizando..." : syncLabelsResult != null ? `✓ ${syncLabelsResult} sync` : "Sync. Rótulos de Área"}
          </button>
          <p className="text-[11px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Atualiza o nome da área exibido em cada critério</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            disabled={fixCalibRunning || fixCalibResult != null}
            onClick={runFixCalibrationCriteria}
            className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
            style={{ fontFamily: CONDENSED, backgroundColor: "rgba(232,162,61,0.14)", color: "#8a5f1a" }}
          >
            <Zap size={15} className={fixCalibRunning ? "animate-pulse" : ""} />
            {fixCalibRunning ? "Corrigindo..." : fixCalibResult != null ? `✓ ${fixCalibResult.totalUpdated} corr.` : "Corrigir Calibrações"}
          </button>
          <p className="text-[11px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Recalcula calibrações com erro no servidor</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            data-testid="button-resync-all-events"
            disabled={resyncAllMutation.isPending}
            onClick={() => resyncAllMutation.mutate()}
            className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
            style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
          >
            <RefreshCw size={15} className={resyncAllMutation.isPending ? "animate-spin" : ""} />
            {resyncAllMutation.isPending ? "Sincronizando..." : "Sync. Todos os Eventos"}
          </button>
          <p className="text-[11px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Aplica critérios ativos a todos os eventos abertos</p>
        </div>

        {canEdit && (
          <div className="flex flex-col items-center gap-1">
            <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  data-testid="button-create-criterion"
                  className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Plus size={16} /> Novo Critério
                </button>
              </DialogTrigger>
            </Dialog>
            <p className="text-[11px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Adiciona um critério de avaliação com nota e peso</p>
          </div>
        )}
      </section>
    </>
  );
}
