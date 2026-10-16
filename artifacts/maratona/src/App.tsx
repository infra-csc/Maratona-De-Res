import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { BootScreen, PageFallback, RouteFallback } from "@/components/layout/shell-states";
import { AccessDenied } from "@/components/layout/access-denied";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

// Cada página vira um chunk próprio: o colaborador que só abre "Meu Desempenho"
// não baixa a planilha (xlsx), os gráficos nem as 4 mil linhas de Avaliações.
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const EventsPage = lazy(() => import("@/pages/events"));
const EventDetailPage = lazy(() => import("@/pages/event-detail"));
const EmployeesPage = lazy(() => import("@/pages/employees"));
const EvaluationsPage = lazy(() => import("@/pages/evaluations"));
const CalibrationsPage = lazy(() => import("@/pages/calibrations"));
const AbsencesPage = lazy(() => import("@/pages/absences"));
const PenaltyTypesPage = lazy(() => import("@/pages/penalty-types"));
const ResultsPage = lazy(() => import("@/pages/results"));
const AnalyticsPage = lazy(() => import("@/pages/analytics"));
const AnalyticsReportPage = lazy(() => import("@/pages/analytics-report"));
const AnalyticsEventsReportPage = lazy(() => import("@/pages/analytics-events-report"));
const AnalyticsTeamPage = lazy(() => import("@/pages/analytics-team"));
const AnalyticsPersonPage = lazy(() => import("@/pages/analytics-person"));
const ScoreTimelinePage = lazy(() => import("@/pages/score-timeline"));
const CyclesPage = lazy(() => import("@/pages/cycles"));
const CycleHistoryPage = lazy(() => import("@/pages/cycle-history"));
const CriteriaPage = lazy(() => import("@/pages/criteria"));
const AreasPage = lazy(() => import("@/pages/areas"));
const UsersPage = lazy(() => import("@/pages/users"));
const RulesPage = lazy(() => import("@/pages/rules"));
const IntegrationPage = lazy(() => import("@/pages/integration"));
const AuditPage = lazy(() => import("@/pages/audit"));
const MyPerformancePage = lazy(() => import("@/pages/my-performance"));
const ComoFuncionaPage = lazy(() => import("@/pages/como-funciona"));
const PublicEvalPage = lazy(() => import("@/pages/eval-public"));


function handleAuthError(error: unknown) {
  const status = (error as { status?: number })?.status;
  // "Senha atual incorreta" (troca de senha) também volta 401, mas a sessão
  // segue válida: o erro aparece no formulário, sem derrubar a pessoa para o login.
  const { url, data } = (error ?? {}) as { url?: string; data?: { error?: unknown } | null };
  if (status === 401 && /\/auth\/change-password$/.test(url ?? "") && data?.error === "Senha atual incorreta") return;
  if (status === 401 && localStorage.getItem("maratona_token")) {
    localStorage.removeItem("maratona_token");
    localStorage.removeItem("maratona_user");
    localStorage.removeItem("maratona_real_token");
    localStorage.removeItem("maratona_real_user");
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    // Sessão vencida no meio do uso: guarda o evento aberto para retomar
    // depois do login (a tela de Avaliações consome "maratona_destino").
    try {
      // A tela de login avisa "Sua sessão expirou" (só apresentação).
      sessionStorage.setItem("maratona_sessao_expirou", "1");
      if (/\/evaluations$/.test(window.location.pathname) && new URLSearchParams(window.location.search).get("evento")) {
        sessionStorage.setItem("maratona_destino", window.location.pathname + window.location.search);
      }
    } catch { /* sem storage: segue sem retomar */ }
    if (!window.location.pathname.endsWith("/login")) {
      window.location.assign(`${base}/login`);
    }
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

function ProtectedRoute({ component: Component, roles }: { component: React.ComponentType; roles?: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <BootScreen />;
  if (!user) return <Redirect to="/login" />;
  if (user.mustChangePassword) return <Redirect to="/trocar-senha" />;
  // Regra do dono: o avaliador só avalia — qualquer outra tela volta para /evaluations.
  if (user.role === "avaliador" && Component !== EvaluationsPage) return <Redirect to="/evaluations" />;
  if (roles && !roles.includes(user.role)) {
    return (
      <AppLayout>
        <AccessDenied role={user.role} />
      </AppLayout>
    );
  }
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    </AppLayout>
  );
}

function HomeRoute() {
  const { user, isLoading } = useAuth();
  // Avaliadores live entirely in the Avaliações page; send them there from "/".
  if (!isLoading && user?.role === "avaliador") return <Redirect to="/evaluations" />;
  // Colaboradores (visualizador) só veem Meu Desempenho.
  if (!isLoading && user?.role === "visualizador") return <Redirect to="/meu-desempenho" />;
  return <ProtectedRoute component={DashboardPage} />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <BootScreen />;
  return (
    <Suspense fallback={<RouteFallback />}>
    <Switch>
      <Route path="/eval/:token" component={PublicEvalPage} />
      <Route path="/login">
        {user ? (user.mustChangePassword ? <Redirect to="/trocar-senha" /> : <Redirect to="/" />) : <LoginPage />}
      </Route>
      <Route path="/trocar-senha">
        {!user ? <Redirect to="/login" /> : <ChangePasswordPage />}
      </Route>
      <Route path="/" component={HomeRoute} />
      <Route path="/dashboard"><Redirect to="/meu-desempenho" /></Route>
      <Route path="/events/:id">
        {(params: { id: string }) => <ProtectedRoute key={params.id} component={EventDetailPage} />}
      </Route>
      <Route path="/events" component={() => <ProtectedRoute component={EventsPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/evaluations" component={() => <ProtectedRoute component={EvaluationsPage} />} />
      <Route path="/calibrations" component={() => <ProtectedRoute component={CalibrationsPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/absences" component={() => <ProtectedRoute component={AbsencesPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/penalty-types" component={() => <ProtectedRoute component={PenaltyTypesPage} roles={["admin", "rh"]} />} />
      <Route path="/linha-do-tempo" component={() => <ProtectedRoute component={ScoreTimelinePage} roles={["admin", "rh"]} />} />
      <Route path="/results" component={() => <ProtectedRoute component={ResultsPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/ranking"><Redirect to="/results" /></Route>
      <Route path="/analytics/eventos" component={() => <ProtectedRoute component={AnalyticsEventsReportPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/analytics/colaborador" component={() => <ProtectedRoute component={AnalyticsPersonPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/analytics/apresentacao" component={() => <ProtectedRoute component={AnalyticsTeamPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/analytics/relatorio" component={() => <ProtectedRoute component={AnalyticsReportPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/cycles/:id" component={() => <ProtectedRoute component={CycleHistoryPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/cycles" component={() => <ProtectedRoute component={CyclesPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/criteria" component={() => <ProtectedRoute component={CriteriaPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/areas" component={() => <ProtectedRoute component={AreasPage} roles={["admin", "rh"]} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} roles={["admin", "rh"]} />} />
      <Route path="/rules" component={() => <ProtectedRoute component={RulesPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/integration" component={() => <ProtectedRoute component={IntegrationPage} roles={["admin", "rh"]} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} roles={["admin", "rh"]} />} />
      <Route path="/meu-desempenho" component={() => <ProtectedRoute component={MyPerformancePage} />} />
      <Route path="/como-funciona" component={() => <ProtectedRoute component={ComoFuncionaPage} />} />
      <Route>{user?.role === "avaliador" ? <Redirect to="/evaluations" /> : <NotFound />}</Route>
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
              <AppRoutes />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
