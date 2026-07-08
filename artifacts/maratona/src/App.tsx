import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AppLayout } from "@/components/layout/app-layout";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import EventsPage from "@/pages/events";
import EventDetailPage from "@/pages/event-detail";
import EmployeesPage from "@/pages/employees";
import EvaluationsPage from "@/pages/evaluations";
import CalibrationsPage from "@/pages/calibrations";
import AbsencesPage from "@/pages/absences";
import ResultsPage from "@/pages/results";
import CriteriaPage from "@/pages/criteria";
import AreasPage from "@/pages/areas";
import UsersPage from "@/pages/users";
import RulesPage from "@/pages/rules";
import IntegrationPage from "@/pages/integration";
import AuditPage from "@/pages/audit";
import MyPerformancePage from "@/pages/my-performance";
import ComoFuncionaPage from "@/pages/como-funciona";
import ReviewRequestsPage from "@/pages/review-requests";
import PublicEvalPage from "@/pages/eval-public";
import NotFound from "@/pages/not-found";

function handleAuthError(error: unknown) {
  const status = (error as { status?: number })?.status;
  if (status === 401 && localStorage.getItem("maratona_token")) {
    localStorage.removeItem("maratona_token");
    localStorage.removeItem("maratona_user");
    localStorage.removeItem("maratona_real_token");
    localStorage.removeItem("maratona_real_user");
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
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
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
          <h2 className="text-xl font-semibold">Acesso negado</h2>
          <p className="text-muted-foreground text-sm">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </AppLayout>
    );
  }
  return (
    <AppLayout>
      <Component />
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
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }
  return (
    <Switch>
      <Route path="/eval/:token" component={PublicEvalPage} />
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/" component={HomeRoute} />
      <Route path="/dashboard"><Redirect to="/meu-desempenho" /></Route>
      <Route path="/events/:id" component={() => <ProtectedRoute component={EventDetailPage} />} />
      <Route path="/events" component={() => <ProtectedRoute component={EventsPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/evaluations" component={() => <ProtectedRoute component={EvaluationsPage} />} />
      <Route path="/calibrations" component={() => <ProtectedRoute component={CalibrationsPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/absences" component={() => <ProtectedRoute component={AbsencesPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/review-requests" component={() => <ProtectedRoute component={ReviewRequestsPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/results" component={() => <ProtectedRoute component={ResultsPage} />} />
      <Route path="/ranking"><Redirect to="/results" /></Route>
      <Route path="/criteria" component={() => <ProtectedRoute component={CriteriaPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/areas" component={() => <ProtectedRoute component={AreasPage} roles={["admin", "rh"]} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} roles={["admin", "rh"]} />} />
      <Route path="/rules" component={() => <ProtectedRoute component={RulesPage} roles={["admin", "rh", "diretoria"]} />} />
      <Route path="/integration" component={() => <ProtectedRoute component={IntegrationPage} roles={["admin", "rh"]} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} roles={["admin", "rh"]} />} />
      <Route path="/meu-desempenho" component={() => <ProtectedRoute component={MyPerformancePage} />} />
      <Route path="/como-funciona" component={() => <ProtectedRoute component={ComoFuncionaPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
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
  );
}

export default App;
