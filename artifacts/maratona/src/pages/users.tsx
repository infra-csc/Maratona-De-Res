// Tela "Usuários": quem entra no sistema, com que papel e por qual área
// avalia. Dados, filtros e orquestração aqui; as peças vivem em ./users/
// (topo, panorama, lista, diálogos e os hooks de cada fluxo).
import { useMemo, useState } from "react";
import { useGetUsers, useGetAreas, useGetEmployees, getGetUsersQueryKey } from "@workspace/api-client-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useCreateUserForm } from "./users/use-create-user";
import { useUserActions } from "./users/use-user-actions";
import { useUserMerge } from "./users/use-user-merge";
import { useEmailMigration } from "./users/use-email-migration";
import { UsersHeader } from "./users/users-header";
import { UsersStats, type UsersQuick } from "./users/users-stats";
import { UsersList, UsersToolbar, type StatusFilter } from "./users/users-table";
import { EmailMigrationDialog } from "./users/email-migration-dialog";
import { CreateUserDialog } from "./users/create-user-dialog";
import { MergeActionBar, MergeConfirmDialog, MergeResultDialog } from "./users/merge-dialogs";
import { DeleteUserDialog, EditUserDialog, ResetPasswordDialog } from "./users/user-dialogs";
import { Bone, ErrorBlock, surfaceCls } from "./users/users-ui";

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function UsersSkeleton() {
  return (
    <div role="status" aria-label="Carregando usuários" className="space-y-5">
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-4 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="bg-card px-5 py-4 space-y-3"><Bone className="h-3 w-24" /><Bone className="h-8 w-16" /><Bone className="h-3 w-36 max-w-full" /></div>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5"><Bone className="h-11 lg:h-9 w-full sm:w-[400px]" /><Bone className="h-11 lg:h-9 w-full sm:w-[220px]" /></div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2"><Bone className="h-4 w-44 max-w-full" /><Bone className="h-3 w-56 max-w-full" /></div>
            <Bone className="h-6 w-24 hidden md:block" /><Bone className="h-5 w-28 hidden lg:block" /><Bone className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  // Espelha o backend: criar/editar/redefinir senha = admin|rh; remover, impersonar, mesclar e migrar e-mails = admin (como antes).
  const isAdmin = hasRole(currentUser, "admin");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("__all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [quick, setQuick] = useState<UsersQuick>(null);

  const qKey = getGetUsersQueryKey();
  const { data: users, isLoading, isError, refetch, isRefetching } = useGetUsers({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: employees } = useGetEmployees({ active: true });
  const sortedEmployees = useMemo(() => [...(employees ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [employees]);
  const areaOptions = useMemo(() => [...(areas ?? [])].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name, "pt-BR")), [areas]);

  const create = useCreateUserForm(qKey);
  const actions = useUserActions(qKey);
  const merge = useUserMerge(qKey);
  const emailMigration = useEmailMigration(qKey);

  const all = useMemo(() => [...(users ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [users]);
  const stats = useMemo(() => {
    const evaluators = all.filter(u => u.active && u.role === "avaliador");
    const roleCounts: Record<string, number> = {};
    for (const u of all) roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1;
    return {
      total: all.length,
      active: all.filter(u => u.active).length,
      evaluators: evaluators.length,
      evaluatorsNoArea: evaluators.filter(u => u.areaId == null).length,
      admins: all.filter(u => u.active && u.role === "admin").length,
      rh: all.filter(u => u.active && u.role === "rh").length,
      mustChange: all.filter(u => u.active && u.mustChangePassword).length,
      roleCounts,
    };
  }, [all]);

  const q = norm(search.trim());
  const shown = all.filter(u => {
    // Mescla é só entre avaliadores: o modo mostra só eles.
    if (merge.mergeMode && u.role !== "avaliador") return false;
    if (quick === "noArea" && !(u.active && u.role === "avaliador" && u.areaId == null)) return false;
    if (quick === "mustChange" && !(u.active && u.mustChangePassword)) return false;
    if (role !== "__all" && u.role !== role) return false;
    if (status === "active" && !u.active) return false;
    if (status === "inactive" && u.active) return false;
    if (!q) return true;
    return norm([u.name, u.email, u.cpfLogin, u.employeeName, u.areaName].filter(Boolean).join(" ")).includes(q);
  });
  const filtering = q !== "" || role !== "__all" || status !== "all" || quick !== null || merge.mergeMode;
  const clearFilters = () => { setSearch(""); setRole("__all"); setStatus("all"); setQuick(null); };
  const statusCounts = { all: all.length, active: stats.active, inactive: all.length - stats.active };

  return (
    <div className={cn("min-h-full flex flex-col min-w-0 font-body", merge.mergeMode && merge.selectedIds.size > 0 && "pb-36 sm:pb-24")}>
      <UsersHeader isAdmin={isAdmin} mergeMode={merge.mergeMode} onCreate={() => create.setCreateOpen(true)}
        onOpenEmailMigration={emailMigration.openMigration} onToggleMergeMode={merge.toggleMergeMode} />

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {isLoading ? <UsersSkeleton /> : isError || !users ? (
          <ErrorBlock title="Não foi possível carregar os usuários" onRetry={() => { void refetch(); }} />
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", isRefetching && "opacity-80")}>
            <UsersStats total={stats.total} active={stats.active} evaluators={stats.evaluators} evaluatorsNoArea={stats.evaluatorsNoArea}
              admins={stats.admins} rh={stats.rh} mustChange={stats.mustChange} quick={quick} onQuick={setQuick} />
            <UsersToolbar search={search} onSearch={setSearch} role={role} onRole={setRole} roleCounts={stats.roleCounts}
              status={status} onStatus={setStatus} statusCounts={statusCounts} />
            <UsersList users={shown} total={all.length} filtering={filtering} onClearFilters={clearFilters}
              isAdmin={isAdmin} currentUserId={currentUser?.id} merge={merge} actions={actions} />
          </div>
        )}
      </div>

      <MergeActionBar merge={merge} users={all} />
      <MergeConfirmDialog merge={merge} users={all} />
      <MergeResultDialog merge={merge} />
      <CreateUserDialog state={create} areas={areaOptions} employees={sortedEmployees} />
      <EmailMigrationDialog state={emailMigration} />
      <ResetPasswordDialog actions={actions} />
      <EditUserDialog actions={actions} areas={areaOptions} employees={sortedEmployees} currentUserId={currentUser?.id} />
      <DeleteUserDialog actions={actions} />
    </div>
  );
}
