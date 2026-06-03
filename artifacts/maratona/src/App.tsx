import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import RankingPage from "@/pages/ranking";
import CriteriaPage from "@/pages/criteria";
import AreasPage from "@/pages/areas";
import UsersPage from "@/pages/users";
import RulesPage from "@/pages/rules";
import IntegrationPage from "@/pages/integration";
import AuditPage from "@/pages/audit";
import MyPerformancePage from "@/pages/my-performance";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 30,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Carregando...</div>
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
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
      <Route path="/login">
        {user ? <Redirect to="/" /> : <LoginPage />}
      </Route>
      <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/events/:id" component={() => <ProtectedRoute component={EventDetailPage} />} />
      <Route path="/events" component={() => <ProtectedRoute component={EventsPage} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/evaluations" component={() => <ProtectedRoute component={EvaluationsPage} />} />
      <Route path="/calibrations" component={() => <ProtectedRoute component={CalibrationsPage} />} />
      <Route path="/absences" component={() => <ProtectedRoute component={AbsencesPage} />} />
      <Route path="/results" component={() => <ProtectedRoute component={ResultsPage} />} />
      <Route path="/ranking" component={() => <ProtectedRoute component={RankingPage} />} />
      <Route path="/criteria" component={() => <ProtectedRoute component={CriteriaPage} />} />
      <Route path="/areas" component={() => <ProtectedRoute component={AreasPage} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />
      <Route path="/rules" component={() => <ProtectedRoute component={RulesPage} />} />
      <Route path="/integration" component={() => <ProtectedRoute component={IntegrationPage} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditPage} />} />
      <Route path="/meu-desempenho" component={() => <ProtectedRoute component={MyPerformancePage} />} />
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
