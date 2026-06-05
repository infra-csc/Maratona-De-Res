import { useState } from "react";
import { useGetEmployees, useCreateEmployee, useUpdateEmployee, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import type { EmployeeInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, UserCheck, UserX, Building2, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "true" | "false">("true");
  const [open, setOpen] = useState(false);

  const qKey = getGetEmployeesQueryKey({ active: filterActive === "all" ? undefined : filterActive === "true" });
  const { data: employees, isLoading } = useGetEmployees(
    filterActive === "all" ? {} : { active: filterActive === "true" },
    { query: { queryKey: qKey } }
  );

  const { register, handleSubmit, reset } = useForm<EmployeeInput>({
    defaultValues: { department: "Geral", functionName: "Colaborador" },
  });

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Colaborador criado" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const canEdit = user && ["admin", "rh"].includes(user.role);
  const filtered = (employees ?? []).filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase()) ||
    e.functionName.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: employees?.length ?? 0,
    ativos: employees?.filter(e => e.active).length ?? 0,
    elegiveis: employees?.filter(e => e.eligibleForBonus !== false).length ?? 0,
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestão do time e elegibilidade da Maratona</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-employee" className="shadow-sm">
                <Plus size={16} className="mr-2" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-xl">Novo Colaborador</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-slate-700">Nome Completo <span className="text-destructive">*</span></Label>
                  <Input data-testid="input-employee-name" {...register("name", { required: true })} placeholder="Nome do colaborador" className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Departamento</Label>
                    <Input data-testid="input-employee-dept" {...register("department")} placeholder="Ex: Cenografia" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Função</Label>
                    <Input data-testid="input-employee-func" {...register("functionName")} placeholder="Ex: Montador" className="h-11" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">E-mail</Label>
                    <Input data-testid="input-employee-email" type="email" {...register("email")} placeholder="email@exemplo.com" className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-slate-700">Telefone</Label>
                    <Input data-testid="input-employee-phone" {...register("phone")} placeholder="(11) 99999-9999" className="h-11" />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-employee" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Colaborador"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total de Registros</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center text-green-600 shrink-0">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Ativos</p>
              <p className="text-2xl font-bold">{stats.ativos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Elegíveis</p>
              <p className="text-2xl font-bold">{stats.elegiveis}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-employees"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-11 bg-slate-50 border-transparent hover:bg-slate-100 focus:bg-white transition-colors"
            placeholder="Buscar por nome, função ou departamento..."
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(["all", "true", "false"] as const).map(v => (
            <button
              key={v}
              data-testid={`filter-active-${v}`}
              onClick={() => setFilterActive(v)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${filterActive === v ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {v === "all" ? "Todos" : v === "true" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Carregando colaboradores...</div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-6 py-4 text-left font-semibold text-slate-600">Colaborador</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-600">Departamento</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-600">Função</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-600">Status</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-600">Elegibilidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(emp => (
                  <tr key={emp.id} data-testid={`row-employee-${emp.id}`} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{emp.name}</div>
                      {emp.email && <div className="text-xs text-slate-500 mt-0.5">{emp.email}</div>}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700">{emp.department}</td>
                    <td className="px-6 py-4 text-slate-600">{emp.functionName}</td>
                    <td className="px-6 py-4 text-center">
                      {emp.active
                        ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 font-semibold"><UserCheck size={12} /> Ativo</Badge>
                        : <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 gap-1 font-semibold"><UserX size={12} /> Inativo</Badge>
                      }
                    </td>
                    <td className="px-6 py-4 text-center">
                      {emp.eligibleForBonus === false
                        ? <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Não Elegível</Badge>
                        : <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Elegível</Badge>
                      }
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-16 text-muted-foreground text-base">Nenhum colaborador encontrado com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
