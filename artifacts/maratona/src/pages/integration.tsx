import { useGetIntegrationStatus, getGetIntegrationStatusQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Database } from "lucide-react";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { THEME_VARS } from "./integration/shared";
import { ErpSyncCard, IntegrationLogsCard } from "./integration/erp-sync-section";
import { EmployeesImportCard } from "./integration/employees-import-card";
import { HistoricalImportSection } from "./integration/historical-import-section";
import { SurveyImportSection } from "./integration/survey-import-section";
import { DedupeEvaluationsCard, FixCalibrationCriteriaCard, MigrateCriteriaCatalogCard, FixOrphanedEvaluationsCard } from "./integration/maintenance-cards";
import { DateSyncCard } from "./integration/date-sync-card";
import { RecomputeCard } from "./integration/recompute-card";
import { ResetDataCard } from "./integration/reset-data-card";

// Página "Integração & Dados". Cada card é um componente autocontido em
// ./integration/ (com as suas mutações e o seu diálogo, que renderiza em
// portal); aqui fica só o status da integração, compartilhado pelo card do
// ERP e pelo terminal de logs, e o controle de acesso por papel.
export default function IntegrationPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";

  const qKey = getGetIntegrationStatusQueryKey();
  const { data: status, isLoading } = useGetIntegrationStatus({ query: { queryKey: qKey } });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-background text-foreground min-h-full" style={{ fontFamily: BODY, ...THEME_VARS }}>
      <div>
        <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase flex items-center gap-3 tracking-tight text-foreground" style={{ fontFamily: CONDENSED }}>
          <Database size={28} className="text-primary" /> Integração & Dados
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Conexão com sistemas externos e importação em lote.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ErpSyncCard status={status} isLoading={isLoading} statusQueryKey={qKey} />
        <EmployeesImportCard />
      </div>

      <HistoricalImportSection />

      <SurveyImportSection />

      {isAdmin && <DedupeEvaluationsCard />}

      {isAdmin && <FixCalibrationCriteriaCard />}

      {isAdmin && <MigrateCriteriaCatalogCard />}

      {isAdmin && <FixOrphanedEvaluationsCard />}

      {isAdmin && <DateSyncCard />}

      {(isAdmin || currentUser?.role === "rh") && <RecomputeCard />}

      {isAdmin && <ResetDataCard />}

      {status?.logs && status.logs.length > 0 && <IntegrationLogsCard logs={status.logs} />}
    </div>
  );
}
