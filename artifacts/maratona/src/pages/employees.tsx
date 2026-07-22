import { useState, useEffect, useCallback } from "react";
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
import type { EmployeeInput, GeneratedCredential, BulkGenerateAccessResult, MergeEmployeeResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Building2, Users, Zap, CheckCircle2, XCircle, Filter, Pencil, KeyRound, Download, AlertTriangle, GitMerge, X, RefreshCw, Lock, Eye, Wifi, WifiOff, Hash, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CONDENSED, BODY, WARNING, PremiumCard } from "@/lib/premium-theme";

const GOOD = "#9ab000";
const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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
  linkedUserId: number | null;
  hasAccess: boolean;
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const APP_LINK = (() => {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return `${window.location.origin}${base}/login`;
})();

function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      title="Copiar link de acesso"
      onClick={() => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase transition-all hover:opacity-90"
      style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
    >
      {copied ? <><Check size={11} /> Link copiado</> : <><Copy size={11} /> Copiar link</>}
    </button>
  );
}

export default function EmployeesPage() {
  const { user, impersonate, token } = useAuth();
  const { toast } = useToast();
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  const handlePreviewAs = useCallback(async (emp: EmployeeWithCycle) => {
    if (!emp.linkedUserId) return;
    setPreviewingId(emp.id);
    try {
      const res = await fetch("/api/auth/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ userId: emp.linkedUserId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      const { token: newToken, user: impUser } = await res.json() as { token: string; user: import("@workspace/api-client-react").User };
      impersonate(newToken, impUser);
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      window.location.assign(`${base}/`);
    } catch (e) {
      toast({ title: "Não foi possível visualizar como este colaborador", description: (e as Error).message, variant: "destructive" });
      setPreviewingId(null);
    }
  }, [impersonate, toast, token]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"true" | "false">("true");
  const [filterType, setFilterType] = useState<"all" | EmploymentType>("all");
  const [open, setOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithCycle | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkGenerateAccessResult | null>(null);
  const [bulkTypeFilter, setBulkTypeFilter] = useState<"casa" | "freela" | "all">("casa");
  const [newAccess, setNewAccess] = useState<{ cpfLogin: string; password: string } | null>(null);

  const [pinDialog, setPinDialog] = useState<{ empName: string; pin: string; cpfLogin: string; created: boolean } | null>(null);
  const [generatingPinId, setGeneratingPinId] = useState<number | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  type BulkPinEntry = { name: string; cpfLogin: string; pin: string };
  type BulkPinSkip = { name: string; reason: string };
  const [bulkPinOpen, setBulkPinOpen] = useState(false);
  const [bulkPinLoading, setBulkPinLoading] = useState(false);
  const [bulkPinResult, setBulkPinResult] = useState<{ results: BulkPinEntry[]; skipped: BulkPinSkip[] } | null>(null);

  const handleBulkGeneratePins = useCallback(async () => {
    setBulkPinLoading(true);
    try {
      const res = await fetch("/api/employees/bulk-generate-pins", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      const data = await res.json() as { results: BulkPinEntry[]; skipped: BulkPinSkip[] };
      setBulkPinResult(data);
      qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
    } catch (e) {
      toast({ title: "Erro ao gerar PINs", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBulkPinLoading(false);
    }
  }, [token, toast, qc]);

  const handleGeneratePin = useCallback(async (emp: EmployeeWithCycle) => {
    setGeneratingPinId(emp.id);
    try {
      const res = await fetch(`/api/employees/${emp.id}/generate-pin`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      const data = await res.json() as { pin: string; cpfLogin: string; userCreated: boolean };
      setPinDialog({ empName: emp.name, pin: data.pin, cpfLogin: data.cpfLogin, created: data.userCreated });
      setPinCopied(false);
      qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
    } catch (e) {
      toast({ title: "Erro ao gerar PIN", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGeneratingPinId(null);
    }
  }, [token, toast, qc]);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [resetTypeOpen, setResetTypeOpen] = useState(false);
  const [resetTypePending, setResetTypePending] = useState(false);

  // IDs dos colaboradores "casa" do Galpão Casa (Marceneiros + Montadores)
  const GALP_CASA_IDS = [179,192,161,196,146,133,200,219,182,189,169,185,154,139,183,175,147,166,150,177,143,208];
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
  } = useGetCollaboratorsWithoutAccess(
    bulkTypeFilter !== "all" ? { employmentType: bulkTypeFilter } : {},
    { query: { enabled: bulkOpen, queryKey: [...getGetCollaboratorsWithoutAccessQueryKey(), bulkTypeFilter] } }
  );

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
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>Colaboradores</h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>Gestão do time e elegibilidade da Maratona</p>
          </div>
          {canEdit && (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={() => { setMergeMode(v => !v); setSelectedIds(new Set()); setCanonicalId(null); }}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-85"
                style={mergeMode ? { backgroundColor: WARNING, color: "#fff" } : { border: "1px solid var(--border)" }}
              >
                {mergeMode ? <><X size={16} /> Cancelar Mesclagem</> : <><GitMerge size={16} /> Mesclar Duplicatas</>}
              </button>
              <button
                data-testid="button-bulk-generate-access"
                onClick={() => { setBulkOpen(true); setBulkResult(null); }}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                <KeyRound size={16} /> Gerar Acessos em Massa
              </button>
              <button
                onClick={() => { setBulkPinOpen(true); setBulkPinResult(null); }}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "#000" }}
                title="Gera um PIN de 4 dígitos para todos os colaboradores casa"
              >
                <Hash size={16} /> Gerar PINs (Casa)
              </button>
              <button
                onClick={() => setResetTypeOpen(true)}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
                title="Define quais colaboradores contam no ranking (Casa vs Freela)"
              >
                <RefreshCw size={15} /> Redefinir Tipos
              </button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button
                    data-testid="button-create-employee"
                    className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Plus size={16} /> Novo Colaborador
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Novo Colaborador</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, department: "Geral", functionName: "Colaborador" } }))}
                    className="space-y-5 pt-4"
                  >
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: WARNING }}>*</span></Label>
                      <Input data-testid="input-employee-name" {...register("name", { required: true })} placeholder="Nome do colaborador" className="h-11 rounded-lg" style={fieldStyle} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>CPF</Label>
                      <Input data-testid="input-employee-document" {...register("document")} placeholder="000.000.000-00" className="h-11 rounded-lg" style={fieldStyle} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail</Label>
                        <Input data-testid="input-employee-email" type="email" {...register("email")} placeholder="email@exemplo.com" className="h-11 rounded-lg" style={fieldStyle} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Telefone</Label>
                        <Input data-testid="input-employee-phone" {...register("phone")} placeholder="(11) 99999-9999" className="h-11 rounded-lg" style={fieldStyle} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Tipo de Contratação</Label>
                      <Select defaultValue="casa" value={watchedEmploymentType} onValueChange={v => setValue("employmentType", v as EmploymentType)}>
                        <SelectTrigger data-testid="select-employment-type" className="h-11 rounded-lg" style={fieldStyle}>
                          <SelectValue placeholder="Selecione o tipo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casa">Casa</SelectItem>
                          <SelectItem value="freela">Freela</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                      <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                      <button
                        data-testid="button-submit-employee"
                        type="submit"
                        disabled={createMutation.isPending}
                        className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
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
          <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Colaborador</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleEditSubmit(d => {
                if (!editingEmployee) return;
                updateMutation.mutate({ id: editingEmployee.id, data: d });
              })}
              className="space-y-5 pt-4"
            >
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: WARNING }}>*</span></Label>
                <Input data-testid="input-edit-employee-name" {...registerEdit("name", { required: true })} placeholder="Nome do colaborador" className="h-11 rounded-lg" style={fieldStyle} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>CPF</Label>
                <Input data-testid="input-edit-employee-document" {...registerEdit("document")} placeholder="000.000.000-00" className="h-11 rounded-lg" style={fieldStyle} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Função</Label>
                <Select value={watchedEditFunctionName} onValueChange={v => setValueEdit("functionName", v)}>
                  <SelectTrigger data-testid="select-edit-employee-func" className="h-11 rounded-lg" style={fieldStyle}>
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
                  <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail</Label>
                  <Input data-testid="input-edit-employee-email" type="email" {...registerEdit("email")} placeholder="email@exemplo.com" className="h-11 rounded-lg" style={fieldStyle} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Telefone</Label>
                  <Input data-testid="input-edit-employee-phone" {...registerEdit("phone")} placeholder="(11) 99999-9999" className="h-11 rounded-lg" style={fieldStyle} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Tipo de Contratação</Label>
                <Select value={watchedEditEmploymentType} onValueChange={v => setValueEdit("employmentType", v as EmploymentType)}>
                  <SelectTrigger data-testid="select-edit-employment-type" className="h-11 rounded-lg" style={fieldStyle}>
                    <SelectValue placeholder="Selecione o tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casa">Casa</SelectItem>
                    <SelectItem value="freela">Freela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={() => setEditingEmployee(null)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                <button
                  data-testid="button-submit-edit-employee"
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* KPIs */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Total de Registros</span>
            <p data-testid="stat-total" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{stats.total}</p>
            <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: "100%", backgroundColor: "var(--foreground)" }} /></div>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Ativos</span>
            <p data-testid="stat-ativos" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{stats.ativos}</p>
            <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(stats.ativos)}%`, backgroundColor: "var(--primary)" }} /></div>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Elegíveis para Bônus</span>
            <p data-testid="stat-elegiveis" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: GOOD }}>{stats.elegiveis}</p>
            <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(stats.elegiveis)}%`, backgroundColor: GOOD }} /></div>
          </div>
        </section>

        {/* Search + filter */}
        <section className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              data-testid="input-search-employees"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 h-11 rounded-lg text-sm outline-none"
              style={fieldStyle}
              placeholder="Buscar por nome, função ou departamento..."
            />
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {(["true", "false"] as const).map(v => {
              const active = filterActive === v;
              return (
                <button
                  key={v}
                  data-testid={`filter-active-${v}`}
                  onClick={() => setFilterActive(v)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
                  style={{ fontFamily: CONDENSED, backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                >
                  {v === "true" ? "Ativos" : "Inativos"}
                </button>
              );
            })}
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {(["all", "casa", "freela"] as const).map(v => {
              const active = filterType === v;
              return (
                <button
                  key={v}
                  data-testid={`filter-type-${v}`}
                  onClick={() => setFilterType(v)}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
                  style={{ fontFamily: CONDENSED, backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                >
                  {v === "all" ? "Todos os Tipos" : employmentTypeLabel(v)}
                </button>
              );
            })}
          </div>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando colaboradores...</div>
        ) : (
          <PremiumCard className="overflow-hidden">
            <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Grid de Colaboradores</h3>
              <Filter size={16} style={{ color: "var(--muted-foreground)" }} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    {mergeMode && <th className="px-4 py-3 text-[10px] font-bold uppercase text-center w-10" style={{ color: "var(--muted-foreground)" }}>✓</th>}
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Atleta / Colaborador</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Departamento</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Cargo</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Tipo</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Elegibilidade</th>
                    {canEdit && !mergeMode && <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Acesso</th>}
                    {canEdit && !mergeMode && <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp, i) => {
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
                      className="transition-colors group"
                      style={{
                        borderTop: i > 0 ? "1px solid var(--border)" : "none",
                        cursor: mergeMode ? "pointer" : "default",
                        backgroundColor: mergeMode && isSelected ? "rgba(154,176,0,0.10)" : "transparent",
                      }}
                    >
                      {mergeMode && (
                        <td className="px-4 py-3.5 text-center">
                          <div className="w-5 h-5 rounded inline-flex items-center justify-center" style={{ border: "1px solid var(--border)", backgroundColor: isSelected ? GOOD : "transparent" }}>
                            {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                          </div>
                        </td>
                      )}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isCanonical ? "var(--primary)" : "var(--secondary)" }}>
                            <span className="text-sm font-black" style={{ color: isCanonical ? "var(--primary-foreground)" : "var(--foreground)" }}>{initials(emp.name)}</span>
                          </div>
                          <div>
                            <p className="font-bold">{emp.name}</p>
                            {isCanonical && <span className="text-[10px] font-black uppercase rounded px-1" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>CANÔNICO</span>}
                            {emp.email && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{emp.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold uppercase text-sm">{emp.department}</td>
                      <td className="px-5 py-3.5" style={{ color: "var(--muted-foreground)" }}>{emp.functionName}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: emp.employmentType === "freela" ? "var(--secondary)" : "transparent", border: "1px solid var(--border)" }}>
                          {employmentTypeLabel(emp.employmentType)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {emp.active ? (
                          <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Ativo</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>Inativo</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col items-center justify-center gap-0.5 font-bold uppercase text-sm">
                          {(() => {
                            const status = getEligibilityStatus(emp);
                            if (status === "freela") return (
                              <span className="flex items-center gap-1.5 opacity-60" style={{ color: "var(--muted-foreground)" }}>— Não pontua</span>
                            );
                            if (status === "eligible") return (
                              <>
                                <span className="flex items-center gap-1.5" style={{ color: GOOD }}><CheckCircle2 size={16} /> Elegível</span>
                                {emp.participatedEventsCount !== null && (
                                  <span className="text-[10px] font-normal normal-case opacity-60" style={{ color: "var(--muted-foreground)" }}>{emp.participatedEventsCount} eventos</span>
                                )}
                              </>
                            );
                            if (status === "not_eligible") return (
                              <>
                                <span className="flex items-center gap-1.5 opacity-70" style={{ color: "var(--muted-foreground)" }}><XCircle size={16} /> Não Elegível</span>
                                {emp.participatedEventsCount !== null && (
                                  <span className="text-[10px] font-normal normal-case opacity-60" style={{ color: "var(--muted-foreground)" }}>{emp.participatedEventsCount} eventos</span>
                                )}
                              </>
                            );
                            return (
                              <span className="flex items-center gap-1.5 opacity-60" style={{ color: "var(--muted-foreground)" }}>— Sem dados</span>
                            );
                          })()}
                        </div>
                      </td>
                      {canEdit && !mergeMode && (
                        <td className="px-5 py-3.5 text-center">
                          {emp.hasAccess ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: GOOD }}>
                                <Wifi size={11} /> Com acesso
                              </span>
                              <button
                                title={`Visualizar app como ${emp.name}`}
                                disabled={previewingId === emp.id}
                                onClick={() => handlePreviewAs(emp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                              >
                                {previewingId === emp.id
                                  ? <><Eye size={11} className="animate-pulse" /> Abrindo…</>
                                  : <><Eye size={11} /> Ver visão</>}
                              </button>
                              {emp.employmentType === "casa" && (<>
                                <button
                                  title={`Gerar novo PIN para ${emp.name}`}
                                  disabled={generatingPinId === emp.id}
                                  onClick={() => handleGeneratePin(emp)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase transition-all hover:opacity-90 disabled:opacity-50"
                                  style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                                >
                                  {generatingPinId === emp.id
                                    ? <><Hash size={11} className="animate-spin" /> Gerando…</>
                                    : <><Hash size={11} /> Gerar PIN</>}
                                </button>
                                <CopyLinkButton link={APP_LINK} />
                              </>)}
                            </div>
                          ) : emp.employmentType === "casa" ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold opacity-50" style={{ color: "var(--muted-foreground)" }}>
                                <WifiOff size={11} /> Sem acesso
                              </span>
                              <button
                                title={`Criar acesso com PIN para ${emp.name}`}
                                disabled={generatingPinId === emp.id}
                                onClick={() => handleGeneratePin(emp)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-[10px] uppercase transition-all hover:opacity-90 disabled:opacity-50"
                                style={{ backgroundColor: "var(--accent)", color: "#000" }}
                              >
                                {generatingPinId === emp.id
                                  ? <><Hash size={11} className="animate-spin" /> Gerando…</>
                                  : <><Hash size={11} /> Gerar PIN</>}
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold opacity-50" style={{ color: "var(--muted-foreground)" }}>
                              <WifiOff size={11} /> Sem acesso
                            </span>
                          )}
                        </td>
                      )}
                      {canEdit && !mergeMode && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            data-testid={`button-edit-employee-${emp.id}`}
                            onClick={() => setEditingEmployee(emp)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-colors hover:opacity-80"
                            style={{ border: "1px solid var(--border)" }}
                          >
                            <Pencil size={13} /> Editar
                          </button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={(canEdit && !mergeMode) ? 7 : mergeMode ? 7 : 6} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador encontrado com os filtros atuais.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Mostrando {filtered.length} de {stats.total} colaboradores</span>
            </div>
          </PremiumCard>
        )}

        {/* Merge action bar */}
        {mergeMode && selectedIds.size >= 2 && (
          <section className="sticky bottom-4 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-4" style={{ backgroundColor: "var(--card)", border: `1px solid var(--primary)` }}>
            <div className="flex-1">
              <p className="font-black uppercase text-sm">{selectedIds.size} colaboradores selecionados</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Selecione qual é o CANÔNICO (o que permanece):</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.from(selectedIds).map(id => {
                  const emp = (employees ?? []).find(e => e.id === id);
                  if (!emp) return null;
                  return (
                    <button
                      key={id}
                      onClick={e => { e.stopPropagation(); setCanonicalId(id); }}
                      className="px-3 py-1.5 rounded-lg font-bold text-[11px] uppercase transition-colors"
                      style={canonicalId === id ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
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
              className="px-5 py-3 rounded-lg font-black text-sm uppercase flex items-center gap-2 disabled:opacity-40 shrink-0 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <GitMerge size={16} />
              {mergeMutation.isPending ? "Mesclando..." : `Mesclar → Manter "${(employees ?? []).find(e => e.id === canonicalId)?.name ?? "?"}"`}
            </button>
          </section>
        )}
      </div>

      {/* Bulk generate access dialog */}
      <Dialog open={bulkOpen} onOpenChange={v => { setBulkOpen(v); if (!v) setBulkResult(null); }}>
        <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Gerar Acessos em Massa</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {isBulkPreviewLoading ? (
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Carregando prévia...</p>
            ) : !bulkResult ? (
              <>
                <div className="flex gap-2">
                  {(["casa", "freela", "all"] as const).map(t => {
                    const active = bulkTypeFilter === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setBulkTypeFilter(t)}
                        className="px-4 py-2 rounded-lg font-bold text-[11px] uppercase transition-colors"
                        style={active ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
                      >
                        {t === "all" ? "Todos" : t.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  Serão criados logins por CPF para colaboradores {bulkTypeFilter === "all" ? "ativos" : `tipo ${bulkTypeFilter.toUpperCase()}`} sem acesso à plataforma. A senha inicial será gerada automaticamente e exibida apenas uma vez, junto com o arquivo CSV para download.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--secondary)" }}>
                    <p className="text-3xl font-black" style={{ fontFamily: CONDENSED }}>{bulkPreview?.eligibleCount ?? 0}</p>
                    <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Prontos para gerar acesso</p>
                  </div>
                  <div className="rounded-lg p-4 text-center" style={{ backgroundColor: "var(--secondary)" }}>
                    <p className="text-3xl font-black" style={{ fontFamily: CONDENSED, color: WARNING }}>{bulkPreview?.missingCpfCount ?? 0}</p>
                    <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Sem CPF cadastrado</p>
                  </div>
                </div>
                {bulkPreview && bulkPreview.missingCpf.length > 0 && (
                  <div className="rounded-lg max-h-40 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                    <div className="px-3 py-1.5 flex items-center gap-2 text-[11px] font-bold uppercase" style={{ backgroundColor: WARNING, color: "#fff" }}>
                      <AlertTriangle size={14} /> Precisam de CPF cadastrado
                    </div>
                    <ul>
                      {bulkPreview.missingCpf.map((m, i) => (
                        <li key={m.id} className="px-3 py-2 text-sm" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>{m.name}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <button type="button" onClick={() => setBulkOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                  <button
                    data-testid="button-confirm-bulk-generate"
                    disabled={!bulkPreview || bulkPreview.eligibleCount === 0 || bulkGenerateMutation.isPending}
                    onClick={() => bulkGenerateMutation.mutate({ data: { dryRun: false, ...(bulkTypeFilter !== "all" ? { employmentType: bulkTypeFilter } : {}) } })}
                    className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    {bulkGenerateMutation.isPending ? "Gerando..." : `Gerar ${bulkPreview?.eligibleCount ?? 0} Acessos`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                  <strong style={{ color: "var(--foreground)" }}>{bulkResult.createdCount}</strong> acesso(s) gerado(s) com sucesso. Baixe o arquivo CSV agora — as senhas não poderão ser visualizadas novamente.
                </p>
                {bulkResult.conflicts.length > 0 && (
                  <p className="text-xs" style={{ color: WARNING }}>{bulkResult.conflicts.length} colaborador(es) já possuíam acesso e foram ignorados.</p>
                )}
                <button
                  data-testid="button-download-credentials-csv"
                  onClick={() => downloadCredentialsCsv(bulkResult.created)}
                  disabled={bulkResult.created.length === 0}
                  className="w-full h-12 rounded-lg font-black uppercase text-[13px] tracking-tight flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Download size={16} /> Baixar CSV com Credenciais
                </button>
                <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => { setBulkOpen(false); setBulkResult(null); refetchBulkPreview(); }}
                    className="h-10 px-4 rounded-lg font-bold uppercase text-xs transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    Fechar
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Redefinir Tipos em Massa (Galpão Casa) */}
      <Dialog open={resetTypeOpen} onOpenChange={v => { if (!resetTypePending) setResetTypeOpen(v); }}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}><RefreshCw size={18} /> Redefinir Tipos — Galpão Casa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg p-3.5 text-sm space-y-1.5" style={{ backgroundColor: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.25)" }}>
              <p className="font-black text-[11px] uppercase" style={{ color: WARNING }}>⚠ Ação irreversível</p>
              <p style={{ color: "var(--foreground)" }}>Os <strong>22 colaboradores do Galpão Casa</strong> (abaixo) permanecerão como <strong>Casa</strong>. <strong>Todos os demais ativos</strong> serão marcados como <strong>Freela</strong> e deixarão de contar no ranking.</p>
            </div>
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                <Lock size={10} /> Marceneiros
              </div>
              {[
                "Alonso Lucas Trindade","Adriano Silva de Araújo","Bruno da Silva Cordeiro",
                "Everton de Jesus Marinho","Gabriel Nascimento Menezes","Iago Dias Temoteo",
                "José Marcio da Silva Menino","João Jorge da Silva Menino","José Renato Albuquerque de Souza",
                "Matheus da Silva Cordeiro","Luan Miguel Marques","Willians Silva de Jesus",
              ].map((n, i) => (
                <div key={n} className="px-3 py-1.5 text-xs font-semibold" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>{n}</div>
              ))}
              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-wide flex items-center gap-1.5" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", borderTop: "1px solid var(--border)" }}>
                <Lock size={10} /> Montadores
              </div>
              {[
                "Caue Sousa Lima","Douglas Ferreira dos Reis","Erick Ramos da Silva",
                "Jamerson Rodrigues da Silva","João Marcos Nascimento Leite","Kaio Gabriel Ferreira Barbosa",
                "Lyrick Andrade Alves da Silva","Ulisses Damazio Fernandes","Vinicius da Silva",
                "Edgard Jose Soares Mariano",
              ].map((n, i) => (
                <div key={n} className="px-3 py-1.5 text-xs font-semibold" style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>{n}</div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                disabled={resetTypePending}
                onClick={() => setResetTypeOpen(false)}
                className="h-10 px-4 rounded-lg font-bold uppercase text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={resetTypePending}
                onClick={async () => {
                  setResetTypePending(true);
                  try {
                    const res = await fetch("/api/employees/bulk-employment-reset", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ casaIds: GALP_CASA_IDS }),
                    });
                    if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
                    await qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
                    toast({ title: "Tipos atualizados", description: "22 colaboradores Casa confirmados. Demais marcados como Freela. Ranking recalculado." });
                    setResetTypeOpen(false);
                  } catch (e) {
                    toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
                  } finally {
                    setResetTypePending(false);
                  }
                }}
                className="h-10 px-5 rounded-lg font-black text-xs uppercase flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: WARNING, color: "#fff" }}
              >
                <RefreshCw size={14} className={resetTypePending ? "animate-spin" : ""} />
                {resetTypePending ? "Atualizando..." : "Confirmar e Aplicar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge result dialog */}
      <Dialog open={!!mergeResult} onOpenChange={v => { if (!v) setMergeResult(null); }}>
        <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}><GitMerge size={20} /> Mesclagem Concluída</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg p-4 space-y-2 text-sm" style={{ backgroundColor: "var(--secondary)" }}>
              <p><span className="font-black">{mergeResult?.merged.length ?? 0}</span> duplicata(s) removida(s)</p>
              <p><span className="font-black">{mergeResult?.movedParticipations ?? 0}</span> participações transferidas</p>
              {(mergeResult?.movedAbsences ?? 0) > 0 && <p><span className="font-black">{mergeResult?.movedAbsences}</span> penalidades/méritos transferidos</p>}
              {(mergeResult?.movedEvaluatorEvals ?? 0) > 0 && <p><span className="font-black">{mergeResult?.movedEvaluatorEvals}</span> avaliações de avaliador transferidas</p>}
              {(mergeResult?.removedUsers ?? 0) > 0 && <p style={{ color: WARNING }}><span className="font-black">{mergeResult?.removedUsers}</span> conta(s) de usuário desativada(s)</p>}
            </div>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Agora você pode usar "Gerar Acessos em Massa" para criar as credenciais dos colaboradores mesclados.</p>
            <div className="flex justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => setMergeResult(null)} className="h-10 px-4 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Fechar</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Newly generated single-employee access */}
      <Dialog open={!!newAccess} onOpenChange={v => { if (!v) setNewAccess(null); }}>
        <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Acesso Gerado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Anote ou compartilhe estas credenciais agora — a senha não será exibida novamente.</p>
            <div className="rounded-lg p-4 space-y-2" style={{ backgroundColor: "var(--secondary)" }}>
              <div>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Login (CPF)</p>
                <p className="text-lg font-black" data-testid="text-new-access-cpf">{newAccess?.cpfLogin}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Senha Inicial</p>
                <p className="text-lg font-black" data-testid="text-new-access-password">{newAccess?.password}</p>
              </div>
            </div>
            <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                data-testid="button-close-new-access"
                onClick={() => setNewAccess(null)}
                className="h-10 px-4 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Entendi
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk PIN dialog */}
      <Dialog open={bulkPinOpen} onOpenChange={v => { if (!v) { setBulkPinOpen(false); setBulkPinResult(null); } }}>
        <DialogContent className="max-w-2xl rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
              Gerar PINs — Colaboradores Casa
            </DialogTitle>
          </DialogHeader>

          {!bulkPinResult ? (
            <div className="space-y-4 pt-1">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Gera uma senha de 4 dígitos nova para <strong>todos</strong> os colaboradores casa ativos com CPF cadastrado.
                Senhas anteriores serão substituídas imediatamente.
              </p>
              <div className="flex justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={() => setBulkPinOpen(false)} className="h-10 px-4 rounded-lg font-bold text-sm uppercase" style={{ border: "1px solid var(--border)" }}>Cancelar</button>
                <button
                  onClick={handleBulkGeneratePins}
                  disabled={bulkPinLoading}
                  className="h-10 px-5 rounded-lg font-black text-sm uppercase flex items-center gap-2 disabled:opacity-60"
                  style={{ backgroundColor: "#ccff00", color: "#000" }}
                >
                  {bulkPinLoading ? <><Hash size={15} className="animate-spin" /> Gerando…</> : <><Hash size={15} /> Gerar todos os PINs</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Stats */}
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "#ccff00" }}>{bulkPinResult.results.length}</p>
                  <p className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Senhas geradas</p>
                </div>
                {bulkPinResult.skipped.length > 0 && (
                  <div className="flex-1 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                    <p className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: WARNING }}>{bulkPinResult.skipped.length}</p>
                    <p className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Sem CPF (ignorados)</p>
                  </div>
                )}
              </div>

              {/* Scrollable table */}
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  <table className="w-full text-sm border-collapse">
                    <thead style={{ backgroundColor: "var(--secondary)", position: "sticky", top: 0, zIndex: 10 }}>
                      <tr>
                        <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, borderBottom: "1px solid var(--border)" }}>Nome</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-widest" style={{ fontFamily: CONDENSED, borderBottom: "1px solid var(--border)" }}>Senha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkPinResult.results.map((r, i) => (
                        <tr key={r.cpfLogin} style={{ borderBottom: i < bulkPinResult.results.length - 1 ? "1px solid var(--border)" : "none", backgroundColor: i % 2 === 0 ? "transparent" : "hsl(var(--secondary))" }}>
                          <td className="px-4 py-2.5 font-medium">{r.name}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="text-xl font-black tracking-[0.25em]" style={{ fontFamily: CONDENSED, color: "#ccff00" }}>{r.pin}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center gap-2 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const bom = "\uFEFF";
                      const header = "Nome,Senha";
                      const body = bulkPinResult.results.map(r => `"${r.name.replace(/"/g, '""')}","${r.pin}"`).join("\n");
                      const blob = new Blob([bom + header + "\n" + body], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = "senhas-colaboradores.csv"; a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg font-bold text-xs uppercase"
                    style={{ backgroundColor: "#ccff00", color: "#000", border: "none", cursor: "pointer" }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Baixar Excel
                  </button>
                  <button
                    onClick={() => {
                      const lines = ["Nome | Senha", ...bulkPinResult.results.map(r => `${r.name} | ${r.pin}`)];
                      navigator.clipboard.writeText(lines.join("\n"));
                      toast({ title: "Lista copiada!", description: `${bulkPinResult.results.length} colaboradores` });
                    }}
                    className="flex items-center gap-2 h-9 px-4 rounded-lg font-bold text-xs uppercase"
                    style={{ border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    <Copy size={13} /> Copiar lista
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBulkPinResult(null)}
                    className="h-9 px-4 rounded-lg font-bold text-xs uppercase"
                    style={{ border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    <Hash size={13} className="inline mr-1" />Gerar novamente
                  </button>
                  <button
                    onClick={() => { setBulkPinOpen(false); setBulkPinResult(null); }}
                    className="h-9 px-4 rounded-lg font-bold text-xs uppercase"
                    style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", cursor: "pointer" }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN gerado dialog */}
      <Dialog open={!!pinDialog} onOpenChange={v => { if (!v) setPinDialog(null); }}>
        <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
              {pinDialog?.created ? "Acesso Criado" : "Novo PIN Gerado"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              {pinDialog?.created
                ? "Acesso criado com sucesso. Anote as credenciais abaixo — o PIN não será exibido novamente."
                : `PIN redefinido para ${pinDialog?.empName}. Anote — o PIN não será exibido novamente.`}
            </p>

            <div className="rounded-xl overflow-hidden" style={{ border: "2px solid var(--border)" }}>
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--muted-foreground)", fontFamily: CONDENSED }}>Login (CPF)</p>
                <p className="text-base font-black tracking-widest">{pinDialog?.cpfLogin}</p>
              </div>
              <div className="px-4 py-4" style={{ backgroundColor: "var(--primary)", borderBottom: "1px solid rgba(0,0,0,0.15)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--primary-foreground)", opacity: 0.65, fontFamily: CONDENSED }}>Senha (PIN)</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-5xl font-black tracking-[0.25em]" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>
                    {pinDialog?.pin}
                  </span>
                  <button
                    onClick={() => {
                      if (!pinDialog) return;
                      navigator.clipboard.writeText(pinDialog.pin);
                      setPinCopied(true);
                      setTimeout(() => setPinCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-[11px] uppercase transition-all hover:opacity-80"
                    style={{ backgroundColor: "rgba(0,0,0,0.25)", color: "var(--primary-foreground)" }}
                  >
                    {pinCopied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                  </button>
                </div>
              </div>
              <div className="px-4 py-3" style={{ backgroundColor: "var(--secondary)" }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--muted-foreground)", fontFamily: CONDENSED }}>Link de Acesso</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--foreground)" }}>{APP_LINK}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(APP_LINK);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all hover:opacity-80"
                    style={{ border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    {linkCopied ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => setPinDialog(null)}
                className="h-10 px-5 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
              >
                Fechar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
