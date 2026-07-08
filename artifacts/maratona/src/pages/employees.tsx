import { useState, useEffect } from "react";
import {
  useGetEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useMergeEmployee,
  useGetCollaboratorsWithoutAccess,
  useBulkGenerateCollaboratorAccess,
  getGetEmployeesQueryKey,
  getGetCollaboratorsWithoutAccessQueryKey,
} from "@workspace/api-client-react";
import type { EmployeeInput, Employee, GeneratedCredential, BulkGenerateAccessResult, MergeEmployeeResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Building2, Users, Zap, CheckCircle2, XCircle, Filter, Pencil, KeyRound, Download, AlertTriangle, GitMerge, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

function downloadCredentialsCsv(created: GeneratedCredential[]) {
  const header = "Nome,CPF (login),Senha";
  const rows = created.map(c => `"${c.name.replace(/"/g, '""')}",${c.cpfLogin},${c.password}`);
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `credenciais-colaboradores-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type EmploymentType = "casa" | "freela";
const employmentTypeLabel = (t?: string) => (t === "freela" ? "Freela" : "Casa");

// Extra fields injected by GET /employees from quarterly_results for current cycle
type EmployeeWithCycle = import("@workspace/api-client-react").Employee & {
  cycleEligible: boolean | null;
  participatedEventsCount: number | null;
};

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"true" | "false">("true");
  const [filterType, setFilterType] = useState<"all" | EmploymentType>("all");
  const [open, setOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithCycle | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkGenerateAccessResult | null>(null);
  const [newAccess, setNewAccess] = useState<{ cpfLogin: string; password: string } | null>(null);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [canonicalId, setCanonicalId] = useState<number | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeEmployeeResult | null>(null);

  const qKey = getGetEmployeesQueryKey({ active: filterActive === "true" });
  const { data: employeesRaw, isLoading } = useGetEmployees(
    { active: filterActive === "true" },
    { query: { queryKey: qKey } }
  );
  const employees = employeesRaw as EmployeeWithCycle[] | undefined;

  const { register, handleSubmit, reset, setValue, watch } = useForm<EmployeeInput>({
    defaultValues: { department: "Geral", functionName: "Colaborador", employmentType: "casa" },
  });
  const watchedEmploymentType = watch("employmentType");

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Colaborador criado" });
        setOpen(false);
        reset();
        if (data.generatedAccess?.cpfLogin && data.generatedAccess?.password) {
          setNewAccess({ cpfLogin: data.generatedAccess.cpfLogin, password: data.generatedAccess.password });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const {
    data: bulkPreview,
    isLoading: isBulkPreviewLoading,
    refetch: refetchBulkPreview,
  } = useGetCollaboratorsWithoutAccess({ query: { enabled: bulkOpen, queryKey: getGetCollaboratorsWithoutAccessQueryKey() } });

  const mergeMutation = useMergeEmployee({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey({ active: true }) });
        qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey({ active: false }) });
        setMergeResult(data);
        setMergeMode(false);
        setSelectedIds(new Set());
        setCanonicalId(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao mesclar", description: e.message, variant: "destructive" }),
    },
  });

  const bulkGenerateMutation = useBulkGenerateCollaboratorAccess({
    mutation: {
      onSuccess: (data) => {
        setBulkResult(data);
        if (!data.dryRun) {
          qc.invalidateQueries({ queryKey: qKey });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao gerar acessos", description: e.message, variant: "destructive" }),
    },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    setValue: setValueEdit,
    watch: watchEdit,
  } = useForm<EmployeeInput>();
  const watchedEditEmploymentType = watchEdit("employmentType");
  const watchedEditFunctionName = watchEdit("functionName");

  useEffect(() => {
    if (editingEmployee) {
      resetEdit({
        name: editingEmployee.name,
        document: editingEmployee.document ?? "",
        functionName: editingEmployee.functionName,
        email: editingEmployee.email ?? "",
        phone: editingEmployee.phone ?? "",
        employmentType: (editingEmployee.employmentType as EmploymentType) ?? "casa",
      });
    }
  }, [editingEmployee, resetEdit]);

  const updateMutation = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Colaborador atualizado" });
        setEditingEmployee(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const canEdit = user && ["admin", "rh"].includes(user.role);
  const filtered = (employees ?? []).filter(e =>
    (filterType === "all" || (e.employmentType ?? "casa") === filterType) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()) ||
      e.functionName.toLowerCase().includes(search.toLowerCase()))
  );

  // cycleEligible = computed quarterly eligibility (8-event rule); null = no cycle data yet
  // Freelas never have quarterly_results entries, so cycleEligible is always null for them
  const getEligibilityStatus = (e: EmployeeWithCycle): "eligible" | "not_eligible" | "freela" | "pending" => {
    if (e.employmentType === "freela") return "freela";
    if (e.cycleEligible === true) return "eligible";
    if (e.cycleEligible === false) return "not_eligible";
    // No cycle data yet: fall back to admin flag
    return e.eligibleForBonus === false ? "not_eligible" : "pending";
  };

  const stats = {
    total: employees?.length ?? 0,
    ativos: employees?.filter(e => e.active).length ?? 0,
    elegiveis: employees?.filter(e => getEligibilityStatus(e) === "eligible").length ?? 0,
  };
  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">Colaboradores</h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2">Gestão do time e elegibilidade da Maratona</p>
          </div>
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => { setMergeMode(v => !v); setSelectedIds(new Set()); setCanonicalId(null); }}
                className={`border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 transition-all ${mergeMode ? "bg-[#ff5722] text-white" : "bg-white hover:bg-[#eceef0]"}`}
              >
                {mergeMode ? <><X size={18} /> Cancelar Mesclagem</> : <><GitMerge size={18} /> Mesclar Duplicatas</>}
              </button>
              <button
                data-testid="button-bulk-generate-access"
                onClick={() => { setBulkOpen(true); setBulkResult(null); }}
                className="bg-white border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 hover:bg-[#eceef0] transition-all"
              >
                <KeyRound size={18} /> Gerar Acessos em Massa
              </button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button
                    data-testid="button-create-employee"
                    className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <Plus size={18} /> Novo Colaborador
                  </button>
                </DialogTrigger>
              <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                <DialogHeader>
                  <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Novo Colaborador</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, department: "Geral", functionName: "Colaborador" } }))}
                  className="space-y-5 pt-4"
                >
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome Completo <span className="text-[#ba1a1a]">*</span></Label>
                    <Input data-testid="input-employee-name" {...register("name", { required: true })} placeholder="Nome do colaborador" className="h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">CPF</Label>
                    <Input data-testid="input-employee-document" {...register("document")} placeholder="000.000.000-00" className="h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">E-mail</Label>
                      <Input data-testid="input-employee-email" type="email" {...register("email")} placeholder="email@exemplo.com" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Telefone</Label>
                      <Input data-testid="input-employee-phone" {...register("phone")} placeholder="(11) 99999-9999" className="h-11 rounded-none border-2 border-[#191c1e]" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Tipo de Contratação</Label>
                    <Select defaultValue="casa" value={watchedEmploymentType} onValueChange={v => setValue("employmentType", v as EmploymentType)}>
                      <SelectTrigger data-testid="select-employment-type" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casa">Casa</SelectItem>
                        <SelectItem value="freela">Freela</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                    <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setOpen(false)}>Cancelar</Button>
                    <button
                      data-testid="button-submit-employee"
                      type="submit"
                      disabled={createMutation.isPending}
                      className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                    >
                      {createMutation.isPending ? "Criando..." : "Criar Colaborador"}
                    </button>
                  </div>
                </form>
              </DialogContent>
              </Dialog>
            </div>
          )}
        </section>

        {/* Edit dialog */}
        <Dialog open={!!editingEmployee} onOpenChange={o => { if (!o) setEditingEmployee(null); }}>
          <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
            <DialogHeader>
              <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Editar Colaborador</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleEditSubmit(d => {
                if (!editingEmployee) return;
                updateMutation.mutate({ id: editingEmployee.id, data: d });
              })}
              className="space-y-5 pt-4"
            >
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome Completo <span className="text-[#ba1a1a]">*</span></Label>
                <Input data-testid="input-edit-employee-name" {...registerEdit("name", { required: true })} placeholder="Nome do colaborador" className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">CPF</Label>
                <Input data-testid="input-edit-employee-document" {...registerEdit("document")} placeholder="000.000.000-00" className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Função</Label>
                <Select
                  value={watchedEditFunctionName}
                  onValueChange={v => setValueEdit("functionName", v)}
                >
                  <SelectTrigger data-testid="select-edit-employee-func" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                    <SelectValue placeholder="Selecione a função..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cenotécnica">Cenotécnica</SelectItem>
                    <SelectItem value="Sup Ceno">Sup Ceno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">E-mail</Label>
                  <Input data-testid="input-edit-employee-email" type="email" {...registerEdit("email")} placeholder="email@exemplo.com" className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Telefone</Label>
                  <Input data-testid="input-edit-employee-phone" {...registerEdit("phone")} placeholder="(11) 99999-9999" className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Tipo de Contratação</Label>
                <Select
                  value={watchedEditEmploymentType}
                  onValueChange={v => setValueEdit("employmentType", v as EmploymentType)}
                >
                  <SelectTrigger data-testid="select-edit-employment-type" className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casa">Casa</SelectItem>
                    <SelectItem value="freela">Freela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setEditingEmployee(null)}>Cancelar</Button>
                <button
                  data-testid="button-submit-edit-employee"
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total */}
          <div className="bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
              <Users size={120} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Total de Registros</span>
            <p data-testid="stat-total" className="text-[40px] leading-none italic font-black mt-2">{stats.total}</p>
            <div className="w-full h-1.5 bg-[#eceef0] mt-4"><div className="h-full bg-[#191c1e]" style={{ width: "100%" }} /></div>
          </div>
          {/* Ativos */}
          <div className={`bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden group ${HARD_SHADOW}`}>
            <div className="absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
              <Zap size={120} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Ativos</span>
            <p data-testid="stat-ativos" className="text-[40px] leading-none italic font-black mt-2 text-[#506600]">{stats.ativos}</p>
            <div className="w-full h-1.5 bg-[#eceef0] mt-4"><div className="h-full bg-[#ccff00]" style={{ width: `${pct(stats.ativos)}%` }} /></div>
          </div>
          {/* Elegíveis */}
          <div className="bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
              <Building2 size={120} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Elegíveis para Bônus</span>
            <p data-testid="stat-elegiveis" className="text-[40px] leading-none italic font-black mt-2 text-[#b02f00]">{stats.elegiveis}</p>
            <div className="w-full h-1.5 bg-[#eceef0] mt-4"><div className="h-full bg-[#ff5722]" style={{ width: `${pct(stats.elegiveis)}%` }} /></div>
          </div>
        </section>

        {/* Search + filter */}
        <section className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
            <Input
              data-testid="input-search-employees"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
              placeholder="Buscar por nome, função ou departamento..."
            />
          </div>
          <div className="flex border-2 border-[#191c1e] bg-white">
            {(["true", "false"] as const).map(v => (
              <button
                key={v}
                data-testid={`filter-active-${v}`}
                onClick={() => setFilterActive(v)}
                className={`px-5 py-2.5 text-xs font-bold italic uppercase tracking-wider transition-all ${filterActive === v ? "bg-[#191c1e] text-[#ccff00]" : "text-[#444933] hover:bg-[#eceef0]"}`}
              >
                {v === "true" ? "Ativos" : "Inativos"}
              </button>
            ))}
          </div>
          <div className="flex border-2 border-[#191c1e] bg-white">
            {(["all", "casa", "freela"] as const).map(v => (
              <button
                key={v}
                data-testid={`filter-type-${v}`}
                onClick={() => setFilterType(v)}
                className={`px-5 py-2.5 text-xs font-bold italic uppercase tracking-wider transition-all ${filterType === v ? "bg-[#191c1e] text-[#ccff00]" : "text-[#444933] hover:bg-[#eceef0]"}`}
              >
                {v === "all" ? "Todos os Tipos" : employmentTypeLabel(v)}
              </button>
            ))}
          </div>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 italic uppercase font-bold text-[#747a60]">Carregando colaboradores...</div>
        ) : (
          <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex justify-between items-center italic">
              <h3 className="text-xs font-bold uppercase tracking-widest">Grid de Colaboradores</h3>
              <Filter size={18} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                    {mergeMode && <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center w-10">✓</th>}
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Atleta / Colaborador</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Departamento</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Cargo</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Tipo</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Elegibilidade</th>
                    {canEdit && !mergeMode && <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {filtered.map(emp => {
                    const isSelected = selectedIds.has(emp.id);
                    const isCanonical = canonicalId === emp.id;
                    return (
                    <tr
                      key={emp.id}
                      data-testid={`row-employee-${emp.id}`}
                      onClick={mergeMode ? () => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (next.has(emp.id)) { next.delete(emp.id); if (canonicalId === emp.id) setCanonicalId(null); }
                          else next.add(emp.id);
                          return next;
                        });
                      } : undefined}
                      className={`transition-all ${mergeMode ? "cursor-pointer " + (isSelected ? "bg-[#eeffc0]" : "hover:bg-[#f2f4f6]") : "hover:bg-[#f2f4f6] hover:translate-x-1"} group`}
                    >
                      {mergeMode && (
                        <td className="px-4 py-4 text-center">
                          <div className={`w-5 h-5 border-2 border-[#191c1e] inline-flex items-center justify-center ${isSelected ? "bg-[#506600]" : "bg-white"}`}>
                            {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 border-2 border-[#191c1e] skew-x-[-4deg] flex items-center justify-center shrink-0 ${isCanonical ? "bg-[#ccff00]" : "bg-[#e0e3e5]"}`}>
                            <span className="skew-x-[4deg] text-sm font-black italic">{initials(emp.name)}</span>
                          </div>
                          <div>
                            <p className="font-bold italic text-[#191c1e]">{emp.name}</p>
                            {isCanonical && <span className="text-[10px] font-black italic uppercase text-[#506600] bg-[#ccff00] px-1">CANÔNICO</span>}
                            {emp.email && <p className="text-xs text-[#747a60] mt-0.5">{emp.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold italic uppercase text-sm">{emp.department}</td>
                      <td className="px-6 py-4 text-[#444933]">{emp.functionName}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block ${emp.employmentType === "freela" ? "bg-[#e0e3e5] text-[#444933]" : "bg-white text-[#191c1e]"}`}>
                          <span className="inline-block skew-x-[8deg]">{employmentTypeLabel(emp.employmentType)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {emp.active ? (
                          <span className="bg-[#ccff00] text-[#161e00] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                            <span className="inline-block skew-x-[8deg]">Ativo</span>
                          </span>
                        ) : (
                          <span className="bg-[#d8dadc] text-[#444933] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block opacity-70">
                            <span className="inline-block skew-x-[8deg]">Inativo</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center justify-center gap-0.5 font-bold italic uppercase text-sm">
                          {(() => {
                            const status = getEligibilityStatus(emp);
                            if (status === "freela") return (
                              <span className="flex items-center gap-1.5 text-[#888] opacity-60">— Não pontua</span>
                            );
                            if (status === "eligible") return (
                              <>
                                <span className="flex items-center gap-1.5 text-[#506600]"><CheckCircle2 size={16} /> Elegível</span>
                                {emp.participatedEventsCount !== null && (
                                  <span className="text-[10px] font-normal normal-case opacity-60 not-italic">{emp.participatedEventsCount} eventos</span>
                                )}
                              </>
                            );
                            if (status === "not_eligible") return (
                              <>
                                <span className="flex items-center gap-1.5 text-[#747a60] opacity-70"><XCircle size={16} /> Não Elegível</span>
                                {emp.participatedEventsCount !== null && (
                                  <span className="text-[10px] font-normal normal-case opacity-60 not-italic">{emp.participatedEventsCount} eventos</span>
                                )}
                              </>
                            );
                            // pending: no cycle data yet
                            return (
                              <span className="flex items-center gap-1.5 text-[#888] opacity-60">— Sem dados</span>
                            );
                          })()}
                        </div>
                      </td>
                      {canEdit && !mergeMode && (
                        <td className="px-6 py-4 text-center">
                          <button
                            data-testid={`button-edit-employee-${emp.id}`}
                            onClick={() => setEditingEmployee(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase hover:bg-[#eceef0] transition-all"
                          >
                            <Pencil size={14} /> Editar
                          </button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={(canEdit && !mergeMode) ? 7 : mergeMode ? 7 : 6} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum colaborador encontrado com os filtros atuais.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t-2 border-[#eceef0] flex justify-between items-center">
              <span className="text-xs font-bold italic uppercase text-[#747a60]">Mostrando {filtered.length} de {stats.total} colaboradores</span>
            </div>
          </section>
        )}

        {/* Merge action bar */}
        {mergeMode && selectedIds.size >= 2 && (
          <section className="sticky bottom-4 bg-[#191c1e] border-2 border-[#ccff00] p-4 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-[6px_6px_0px_0px_#ccff00]">
            <div className="flex-1">
              <p className="text-[#ccff00] font-black italic uppercase text-sm">{selectedIds.size} colaboradores selecionados</p>
              <p className="text-[#747a60] text-xs italic mt-0.5">Selecione qual é o CANÔNICO (o que permanece):</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.from(selectedIds).map(id => {
                  const emp = (employees ?? []).find(e => e.id === id);
                  if (!emp) return null;
                  return (
                    <button
                      key={id}
                      onClick={e => { e.stopPropagation(); setCanonicalId(id); }}
                      className={`px-3 py-1.5 border-2 font-bold text-[11px] italic uppercase transition-all ${canonicalId === id ? "border-[#ccff00] bg-[#ccff00] text-[#161e00]" : "border-[#747a60] text-white hover:border-[#ccff00]"}`}
                    >
                      {emp.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              disabled={!canonicalId || mergeMutation.isPending}
              onClick={() => {
                if (!canonicalId) return;
                const dupIds = Array.from(selectedIds).filter(id => id !== canonicalId);
                mergeMutation.mutate({ id: canonicalId, data: { duplicateIds: dupIds } });
              }}
              className="bg-[#ccff00] border-2 border-[#ccff00] px-6 py-3 font-black text-sm italic uppercase text-[#161e00] flex items-center gap-2 disabled:opacity-40 shrink-0"
            >
              <GitMerge size={16} />
              {mergeMutation.isPending ? "Mesclando..." : `Mesclar → Manter "${(employees ?? []).find(e => e.id === canonicalId)?.name ?? "?"}"`}
            </button>
          </section>
        )}
      </div>

      {/* Bulk generate access dialog */}
      <Dialog open={bulkOpen} onOpenChange={v => { setBulkOpen(v); if (!v) setBulkResult(null); }}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Gerar Acessos em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {isBulkPreviewLoading ? (
              <p className="text-sm italic text-[#747a60]">Carregando prévia...</p>
            ) : !bulkResult ? (
              <>
                <p className="text-sm text-[#444933] italic">
                  Serão criados logins por CPF para colaboradores ativos sem acesso à plataforma. A senha inicial será gerada automaticamente e exibida apenas uma vez, junto com o arquivo CSV para download.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 text-center">
                    <p className="text-3xl italic font-black">{bulkPreview?.eligibleCount ?? 0}</p>
                    <p className="text-[11px] font-bold italic uppercase text-[#444933]">Prontos para gerar acesso</p>
                  </div>
                  <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 text-center">
                    <p className="text-3xl italic font-black text-[#ba1a1a]">{bulkPreview?.missingCpfCount ?? 0}</p>
                    <p className="text-[11px] font-bold italic uppercase text-[#444933]">Sem CPF cadastrado</p>
                  </div>
                </div>
                {bulkPreview && bulkPreview.missingCpf.length > 0 && (
                  <div className="border-2 border-[#191c1e] max-h-40 overflow-y-auto">
                    <div className="bg-[#ba1a1a] text-white px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold italic uppercase">
                      <AlertTriangle size={14} /> Precisam de CPF cadastrado
                    </div>
                    <ul className="divide-y-2 divide-[#eceef0]">
                      {bulkPreview.missingCpf.map(m => (
                        <li key={m.id} className="px-3 py-2 text-sm italic">{m.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                  <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setBulkOpen(false)}>Cancelar</Button>
                  <button
                    data-testid="button-confirm-bulk-generate"
                    disabled={!bulkPreview || bulkPreview.eligibleCount === 0 || bulkGenerateMutation.isPending}
                    onClick={() => bulkGenerateMutation.mutate({ data: { dryRun: false } })}
                    className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                  >
                    {bulkGenerateMutation.isPending ? "Gerando..." : `Gerar ${bulkPreview?.eligibleCount ?? 0} Acessos`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[#444933] italic">
                  <strong>{bulkResult.createdCount}</strong> acesso(s) gerado(s) com sucesso. Baixe o arquivo CSV agora — as senhas não poderão ser visualizadas novamente.
                </p>
                {bulkResult.conflicts.length > 0 && (
                  <p className="text-xs text-[#ba1a1a] italic">{bulkResult.conflicts.length} colaborador(es) já possuíam acesso e foram ignorados.</p>
                )}
                <button
                  data-testid="button-download-credentials-csv"
                  onClick={() => downloadCredentialsCsv(bulkResult.created)}
                  disabled={bulkResult.created.length === 0}
                  className="w-full h-12 bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] font-black italic uppercase text-[13px] tracking-tight flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={16} /> Baixar CSV com Credenciais
                </button>
                <div className="flex justify-end pt-4 border-t-2 border-[#e0e3e5]">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold"
                    onClick={() => { setBulkOpen(false); setBulkResult(null); refetchBulkPreview(); }}
                  >
                    Fechar
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge result dialog */}
      <Dialog open={!!mergeResult} onOpenChange={v => { if (!v) setMergeResult(null); }}>
        <DialogContent className="max-w-sm rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2"><GitMerge size={20} /> Mesclagem Concluída</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 space-y-2 text-sm italic">
              <p><span className="font-black">{mergeResult?.merged.length ?? 0}</span> duplicata(s) removida(s)</p>
              <p><span className="font-black">{mergeResult?.movedParticipations ?? 0}</span> participações transferidas</p>
              {(mergeResult?.movedAbsences ?? 0) > 0 && <p><span className="font-black">{mergeResult?.movedAbsences}</span> penalidades/méritos transferidos</p>}
            </div>
            <p className="text-xs text-[#747a60] italic">Agora você pode usar "Gerar Acessos em Massa" para criar as credenciais dos colaboradores mesclados.</p>
            <div className="flex justify-end pt-2 border-t-2 border-[#e0e3e5]">
              <button onClick={() => setMergeResult(null)} className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase">Fechar</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Newly generated single-employee access */}
      <Dialog open={!!newAccess} onOpenChange={v => { if (!v) setNewAccess(null); }}>
        <DialogContent className="max-w-sm rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Acesso Gerado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-[#444933] italic">Anote ou compartilhe estas credenciais agora — a senha não será exibida novamente.</p>
            <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 space-y-2">
              <div>
                <p className="text-[11px] font-bold italic uppercase text-[#747a60]">Login (CPF)</p>
                <p className="text-lg font-black italic" data-testid="text-new-access-cpf">{newAccess?.cpfLogin}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold italic uppercase text-[#747a60]">Senha Inicial</p>
                <p className="text-lg font-black italic" data-testid="text-new-access-password">{newAccess?.password}</p>
              </div>
            </div>
            <div className="flex justify-end pt-4 border-t-2 border-[#e0e3e5]">
              <button
                data-testid="button-close-new-access"
                onClick={() => setNewAccess(null)}
                className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase"
              >
                Entendi
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
