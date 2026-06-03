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
import { Plus, Search, UserCheck, UserX } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold">Colaboradores</h1>
          <p className="text-muted-foreground text-sm">Cadastro de colaboradores avaliados</p>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-employee" size="sm">
                <Plus size={16} className="mr-1.5" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Nome Completo *</Label>
                  <Input data-testid="input-employee-name" {...register("name", { required: true })} placeholder="Nome do colaborador" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Departamento</Label>
                    <Input data-testid="input-employee-dept" {...register("department")} placeholder="Cenografia" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Função</Label>
                    <Input data-testid="input-employee-func" {...register("functionName")} placeholder="Montador" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>E-mail</Label>
                    <Input data-testid="input-employee-email" type="email" {...register("email")} placeholder="email@exemplo.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Telefone</Label>
                    <Input data-testid="input-employee-phone" {...register("phone")} placeholder="(11) 99999-9999" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-employee" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="input-search-employees"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            placeholder="Buscar colaborador..."
          />
        </div>
        <div className="flex rounded-md border overflow-hidden">
          {(["all", "true", "false"] as const).map(v => (
            <button
              key={v}
              data-testid={`filter-active-${v}`}
              onClick={() => setFilterActive(v)}
              className={`px-3 py-1.5 text-sm transition-colors ${filterActive === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
            >
              {v === "all" ? "Todos" : v === "true" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Departamento</th>
                <th className="px-4 py-3 text-left font-medium">Função</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(emp => (
                <tr key={emp.id} data-testid={`row-employee-${emp.id}`} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{emp.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.functionName}</td>
                  <td className="px-4 py-3">
                    {emp.active
                      ? <Badge variant="default" className="gap-1"><UserCheck size={11} />Ativo</Badge>
                      : <Badge variant="secondary" className="gap-1"><UserX size={11} />Inativo</Badge>
                    }
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum colaborador encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
