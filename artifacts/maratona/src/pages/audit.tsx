import { useState } from "react";
import { useGetAuditLogs, getGetAuditLogsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  login: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  close: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  calibrate: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  const qKey = getGetAuditLogsQueryKey({ page, limit: 50, entity: entity || undefined, action: action || undefined });
  const { data, isLoading } = useGetAuditLogs(
    { page, limit: 50, entity: entity || undefined, action: action || undefined },
    { query: { queryKey: qKey } }
  );

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  function fmtDate(d: string) {
    try {
      return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return d;
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck size={22} className="text-primary" /> Auditoria
        </h1>
        <p className="text-muted-foreground text-sm">Histórico de ações na plataforma</p>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <Select value={entity || "all"} onValueChange={v => { setEntity(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger data-testid="select-audit-entity" className="w-40">
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            <SelectItem value="users">Usuários</SelectItem>
            <SelectItem value="events">Eventos</SelectItem>
            <SelectItem value="employees">Colaboradores</SelectItem>
            <SelectItem value="evaluations">Avaliações</SelectItem>
            <SelectItem value="calibrations">Calibrações</SelectItem>
            <SelectItem value="absences">Faltas</SelectItem>
            <SelectItem value="rules">Regras</SelectItem>
          </SelectContent>
        </Select>
        <Select value={action || "all"} onValueChange={v => { setAction(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger data-testid="select-audit-action" className="w-36">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas ações</SelectItem>
            <SelectItem value="create">Criar</SelectItem>
            <SelectItem value="update">Atualizar</SelectItem>
            <SelectItem value="delete">Remover</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="close">Fechar</SelectItem>
            <SelectItem value="calibrate">Calibrar</SelectItem>
          </SelectContent>
        </Select>
        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.total} registro(s) — Pág. {page}/{totalPages}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Data/Hora</th>
                <th className="px-4 py-3 text-left font-medium">Usuário</th>
                <th className="px-4 py-3 text-center font-medium">Ação</th>
                <th className="px-4 py-3 text-left font-medium">Entidade</th>
                <th className="px-4 py-3 text-left font-medium">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.data ?? []).map(log => (
                <tr key={log.id} data-testid={`row-audit-${log.id}`} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                  <td className="px-4 py-2.5 text-sm">{log.userName ?? "Sistema"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground"}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">{log.entity}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{log.entityId ?? "—"}</td>
                </tr>
              ))}
              {(!data?.data || data.data.length === 0) && (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            data-testid="button-prev-page"
            variant="outline" size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={15} />
          </Button>
          <span className="px-4 py-1.5 text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button
            data-testid="button-next-page"
            variant="outline" size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      )}
    </div>
  );
}
