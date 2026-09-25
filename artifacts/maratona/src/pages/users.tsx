// Tela "Acessos & Permissões": dados, busca e orquestração. As peças visuais
// vivem em ./users/: cabeçalho, cartões de totais, grade (tabela + linha),
// diálogos (novo usuário, editar, redefinir senha, migrar e-mails, mescla) e
// os hooks de cada fluxo (use-*.ts).
import { useState } from "react";
import { useGetUsers, useGetAreas, useGetEmployees, getGetUsersQueryKey } from "@workspace/api-client-react";
import { useAuth, hasRole } from "@/lib/auth-context";
import { BODY } from "@/lib/premium-theme";
import { useCreateUserForm } from "./users/use-create-user";
import { useUserActions } from "./users/use-user-actions";
import { useUserMerge } from "./users/use-user-merge";
import { useEmailMigration } from "./users/use-email-migration";
import { UsersHeader } from "./users/users-header";
import { UsersStats } from "./users/users-stats";
import { UsersTable } from "./users/users-table";
import { EmailMigrationDialog } from "./users/email-migration-dialog";
import { CreateUserDialog } from "./users/create-user-dialog";
import { MergeActionBar, MergeResultDialog } from "./users/merge-dialogs";
import { ResetPasswordDialog, EditUserDialog } from "./users/user-dialogs";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  // Espelha o backend: criar/editar/redefinir senha = admin|rh; remover, impersonar e migrar e-mails = admin.
  const isAdmin = hasRole(currentUser, "admin");
  const [userSearch, setUserSearch] = useState("");

  const qKey = getGetUsersQueryKey();
  const { data: users, isLoading } = useGetUsers({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: employees } = useGetEmployees({ active: true });
  const sortedEmployees = [...(employees ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const create = useCreateUserForm(qKey);
  const actions = useUserActions(qKey);
  const merge = useUserMerge(qKey);
  const emailMigration = useEmailMigration(qKey);

  const sortedUsers = [...(users ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .filter(u => {
      const q = userSearch.trim().toLowerCase();
      if (!q) return true;
      const haystack = [u.name, u.email, u.cpfLogin, u.employeeName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

  const stats = {
    total: users?.length ?? 0,
    ativos: users?.filter(u => u.active).length ?? 0,
    admins: users?.filter(u => u.role === "admin").length ?? 0,
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Page header */}
        <UsersHeader
          isAdmin={isAdmin}
          mergeMode={merge.mergeMode}
          onOpenEmailMigration={emailMigration.openMigration}
          onToggleMergeMode={merge.toggleMergeMode}
          emailMigrationDialog={<EmailMigrationDialog state={emailMigration} />}
          createDialog={<CreateUserDialog state={create} areas={areas} employees={sortedEmployees} />}
        />

        {/* Stats bar */}
        <UsersStats total={stats.total} ativos={stats.ativos} admins={stats.admins} />

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando usuários...</div>
        ) : (
          <UsersTable
            sortedUsers={sortedUsers}
            total={stats.total}
            userSearch={userSearch}
            onSearchChange={setUserSearch}
            isAdmin={isAdmin}
            currentUserId={currentUser?.id}
            merge={merge}
            actions={actions}
          />
        )}
      </div>

      {/* Merge action bar */}
      <MergeActionBar merge={merge} sortedUsers={sortedUsers} />

      {/* Merge result dialog */}
      <MergeResultDialog merge={merge} />

      <ResetPasswordDialog actions={actions} />

      <EditUserDialog actions={actions} areas={areas} employees={sortedEmployees} currentUserId={currentUser?.id} />
    </div>
  );
}
