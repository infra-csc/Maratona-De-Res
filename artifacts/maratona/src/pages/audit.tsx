import { useState } from "react";
import { useGetAuditLogs, getGetAuditLogsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderLock, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-50 text-green-700 border-green-200",
  update: "bg-blue-50 text-blue-700 border-blue-200",
  delete: "bg-red-50 text-red-700 border-red-200",
  login: "bg-slate-100 text-slate-600 border-slate-200",
  close: "bg-orange-50 text-orange-700 border-orange-200",
  calibrate: "bg-purple-50 text-purple-700 border-purple-200",
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
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
            <FolderLock size={28} className="text-primary" /> Trilhas de Auditoria
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico imutável de todas as ações e modificações na plataforma.</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2 bg-slate-50 rounded-lg text-slate-400 shrink-0">
            <Filter size={18} />
          </div>
          <Select value={entity || "all"} onValueChange={v => { setEntity(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger data-testid="select-audit-entity" className="w-full sm:w-48 h-10 font-medium">
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
            <SelectTrigger data-testid="select-audit-action" className="w-full sm:w-40 h-10 font-medium">
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
        </div>
        
        {data && (
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border">
            {data.total} registros encontrados
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Carregando logs de auditoria...</div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-slate-300 border-b-0">
                  <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs w-[180px]">Data & Hora</th>
                  <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Ação</th>
                  <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">Entidade</th>
                  <th className="px-6 py-4 text-left font-bold uppercase tracking-wider text-xs">ID Afetado</th>
                  <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-xs">Usuário Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.data ?? []).map(log => (
                  <tr key={log.id} data-testid={`row-audit-${log.id}`} className="hover:bg-slate-50/50 transition-colors font-mono text-sm">
                    <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                    <td className="px-6 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold border tracking-wider ${ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-700">{log.entity}</td>
                    <td className="px-6 py-3 text-slate-400">{log.entityId ?? "—"}</td>
                    <td className="px-6 py-3 text-right font-sans">
                      <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-md border text-slate-700 font-semibold text-xs">
                        {log.userName ?? "Sistema"}
                      </div>
                    </td>
                  </tr>
                ))}
                {(!data?.data || data.data.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-16 text-slate-400 font-sans text-base">Nenhum log encontrado para os filtros selecionados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
          <Button
            data-testid="button-prev-page"
            variant="outline"
            className="shadow-sm"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={16} className="mr-2" /> Anterior
          </Button>
          <span className="px-4 py-2 font-bold text-sm text-slate-600">
            Página {page} de {totalPages}
          </span>
          <Button
            data-testid="button-next-page"
            variant="outline"
            className="shadow-sm"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Próxima <ChevronRight size={16} className="ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
