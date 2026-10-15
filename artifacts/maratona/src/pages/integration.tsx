// Tela "Integração e dados": a sincronização com o sistema externo, as
// importações e as correções de dados. Cada ferramenta é autocontida em
// ./integration/ (chamada + diálogo confirmar → resultado); aqui ficam o
// status da integração, a ordem das seções e quem vê o quê (mesmos papéis).
import { useGetIntegrationStatus, getGetIntegrationStatusQueryKey } from "@workspace/api-client-react";
import { ShieldAlert, Upload, Wrench } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { ErrorBlock, SectionTitle, btnPrimary, surfaceCls } from "./integration/integration-ui";
import { ErpSyncCard, IntegrationLogsCard, SyncButton, SyncDialog, useErpSync } from "./integration/erp-sync-section";
import { EmployeesImportCard } from "./integration/employees-import-card";
import { HistoricalImportSection } from "./integration/historical-import-section";
import { SurveyImportSection } from "./integration/survey-import-section";
import { DedupeEvaluationsCard, FixCalibrationCriteriaCard, MigrateCriteriaCatalogCard, FixOrphanedEvaluationsCard } from "./integration/maintenance-cards";
import { DateSyncCard } from "./integration/date-sync-card";
import { RecomputeCard } from "./integration/recompute-card";
import { ResetDataCard } from "./integration/reset-data-card";

function Section({ id, icon, title, subtitle, children, danger }: { id: string; icon: typeof Upload; title: string; subtitle: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section aria-labelledby={id} className="space-y-2.5" data-testid={`section-${id}`}>
      <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-0.5">
        <SectionTitle icon={icon} tone={danger ? "danger" : undefined} className="mb-0"><span id={id}>{title}</span></SectionTitle>
        <p className="text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      <ul className={cn(surfaceCls, "divide-y divide-border overflow-hidden", danger && "border-[var(--status-danger)]/40")}>{children}</ul>
    </section>
  );
}

export default function IntegrationPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const canRecompute = isAdmin || currentUser?.role === "rh";

  const qKey = getGetIntegrationStatusQueryKey();
  const { data: status, isLoading, isError, refetch } = useGetIntegrationStatus({ query: { queryKey: qKey } });
  const sync = useErpSync(qKey);

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
        <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Integração e dados</h1>
        <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Sincronização com o sistema externo, importações e correções. Tudo mostra o que vai acontecer antes de gravar.</p>
        <div className="ml-auto shrink-0 hidden sm:block">
          <SyncButton sync={sync} status={status} testId="button-trigger-sync-top" className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3.5 lg:px-4 text-[13px]")} />
        </div>
      </div>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-7 max-w-[1280px] w-full mx-auto">
        {isError
          ? <ErrorBlock title="Não foi possível ver a situação da integração" onRetry={() => { void refetch(); }} />
          : <ErpSyncCard status={status} isLoading={isLoading} sync={sync} />}

        <Section id="integration-imports" icon={Upload} title="Importações" subtitle="Escolha o arquivo; nada é gravado antes de você confirmar.">
          <EmployeesImportCard />
          <HistoricalImportSection />
          <SurveyImportSection />
          {isAdmin && <DateSyncCard />}
        </Section>

        {canRecompute && (
          <Section id="integration-fixes" icon={Wrench} title="Recálculo e correções" subtitle="Cada uma explica o que muda e mostra o resultado. Ciclo fechado nunca é alterado.">
            <RecomputeCard />
            {isAdmin && <DedupeEvaluationsCard />}
            {isAdmin && <FixCalibrationCriteriaCard />}
            {isAdmin && <MigrateCriteriaCatalogCard />}
            {isAdmin && <FixOrphanedEvaluationsCard />}
          </Section>
        )}

        {isAdmin && (
          <Section id="integration-danger" icon={ShieldAlert} title="Zona de risco" subtitle="Ações permanentes, só para administrador." danger>
            <ResetDataCard />
          </Section>
        )}

        {status?.logs && status.logs.length > 0 && <IntegrationLogsCard logs={status.logs} />}
      </div>

      <SyncDialog sync={sync} />
    </div>
  );
}
