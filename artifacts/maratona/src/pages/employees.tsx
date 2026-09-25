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
  impersonate as requestImpersonation,
  bulkSetEmployeeCpf,
  getCasaPins,
  bulkGenerateCasaPins,
  generateEmployeePin,
  bulkEmploymentReset,
} from "@workspace/api-client-react";
import type { EmployeeInput, BulkGenerateAccessResult, MergeEmployeeResult, BulkSetCpfResult, CasaPin, SkippedPin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useAuth, hasRole } from "@/lib/auth-context";
import { BODY } from "@/lib/premium-theme";
import type { BulkTypeFilter, EmployeeWithCycle, EmploymentType, PinDialogData } from "./employees/types";
import { getEligibilityStatus, parseCpfRows, serverErrorMessage } from "./employees/utils";
import { EmployeesFilters, EmployeesHeader, EmployeesKpis } from "./employees/employees-header";
import { CreateEmployeeDialog, EditEmployeeDialog } from "./employees/employee-form-dialogs";
import { EmployeesTable } from "./employees/employees-table";
import { MergeActionBar, MergeConfirmDialog, MergeResultDialog } from "./employees/merge-dialogs";
import { BulkAccessDialog, NewAccessDialog } from "./employees/access-dialogs";
import { ResetTypesDialog } from "./employees/reset-types-dialog";
import { BulkPinDialog, PinDialog } from "./employees/pin-dialogs";
import { BulkCpfDialog } from "./employees/bulk-cpf-dialog";

// Página de Colaboradores. Todo o estado, as queries/mutações e os handlers ficam aqui
// (na mesma ordem de hooks de antes da divisão); os arquivos em ./employees/ só desenham.

export default function EmployeesPage() {
  const APP_LINK = (() => {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    return `${window.location.origin}${base}/login`;
  })();
  const { user, impersonate } = useAuth();
  const { toast } = useToast();
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  const handlePreviewAs = useCallback(async (emp: EmployeeWithCycle) => {
    if (!emp.linkedUserId) return;
    setPreviewingId(emp.id);
    try {
      const { token: newToken, user: impUser } = await requestImpersonation({ userId: emp.linkedUserId });
      impersonate(newToken, impUser);
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      window.location.assign(`${base}/`);
    } catch (e) {
      toast({ title: "Não foi possível visualizar como este colaborador", description: serverErrorMessage(e, "Não foi possível abrir a visão deste colaborador. Tente novamente."), variant: "destructive" });
      setPreviewingId(null);
    }
  }, [impersonate, toast]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"true" | "false">("true");
  const [filterType, setFilterType] = useState<"all" | EmploymentType>("all");
  const [open, setOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithCycle | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkGenerateAccessResult | null>(null);
  const [bulkTypeFilter, setBulkTypeFilter] = useState<BulkTypeFilter>("casa");
  const [newAccess, setNewAccess] = useState<{ cpfLogin: string; password: string } | null>(null);

  const [pinDialog, setPinDialog] = useState<PinDialogData | null>(null);
  const [generatingPinId, setGeneratingPinId] = useState<number | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [bulkLinkCopied, setBulkLinkCopied] = useState(false);

  // Senhas carregadas (casa-pins) ou recém-geradas (bulk-generate-pins).
  const [bulkPinOpen, setBulkPinOpen] = useState(false);
  const [bulkPinLoading, setBulkPinLoading] = useState(false);
  const [bulkPinResult, setBulkPinResult] = useState<{ results: CasaPin[]; skipped: SkippedPin[] } | null>(null);
  const [bulkPinSource, setBulkPinSource] = useState<"loaded" | "generated">("loaded");
  const [confirmRegen, setConfirmRegen] = useState(false);

  const [bulkCpfOpen, setBulkCpfOpen] = useState(false);
  const [bulkCpfLoading, setBulkCpfLoading] = useState(false);
  const [bulkCpfResult, setBulkCpfResult] = useState<BulkSetCpfResult | null>(null);

  // Lista "Nome;CPF" colada pelo admin no diálogo (nunca dado pessoal no código).
  const [bulkCpfText, setBulkCpfText] = useState("");
  const parsedCpfRows = parseCpfRows(bulkCpfText);

  const handleBulkSetCpf = useCallback(async () => {
    setBulkCpfLoading(true);
    setBulkCpfResult(null);
    try {
      const data = await bulkSetEmployeeCpf(parsedCpfRows);
      setBulkCpfResult(data);
      qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
    } catch (e) {
      toast({ title: "Não foi possível importar os CPFs", description: serverErrorMessage(e, "Não foi possível importar os CPFs. Tente novamente."), variant: "destructive" });
    } finally {
      setBulkCpfLoading(false);
    }
    // parsedCpfRows nas dependências: sem ele o callback ficava preso à lista
    // do primeiro render (vazia) e o servidor recebia [].
  }, [parsedCpfRows, toast, qc]);

  // Load current PINs from DB whenever the dialog opens (for employees marked as "casa")
  useEffect(() => {
    if (!bulkPinOpen) return;
    let cancelled = false;
    setBulkPinLoading(true);
    const casaIds = (employees ?? [])
      .filter(e => e.employmentType === "casa")
      .map(e => e.id);
    const idsParam = casaIds.length > 0 ? casaIds.join(",") : "0";
    getCasaPins({ ids: idsParam })
      .then((data) => {
        if (!cancelled) {
          setBulkPinResult(data.results.length > 0 ? { results: data.results, skipped: [] } : null);
          setBulkPinSource("loaded");
          setConfirmRegen(false);
        }
      })
      .catch(() => { if (!cancelled) setBulkPinResult(null); })
      .finally(() => { if (!cancelled) setBulkPinLoading(false); });
    return () => { cancelled = true; };
  }, [bulkPinOpen]);

  const handleBulkGeneratePins = useCallback(async () => {
    setBulkPinLoading(true);
    setConfirmRegen(false);
    try {
      // Sem ids → o backend gera para TODOS os casa ativos, independente dos filtros da tela
      const data = await bulkGenerateCasaPins({});
      setBulkPinResult(data);
      setBulkPinSource("generated");
      qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
    } catch (e) {
      toast({ title: "Não foi possível definir as senhas", description: serverErrorMessage(e, "Não foi possível definir as senhas. Tente novamente."), variant: "destructive" });
    } finally {
      setBulkPinLoading(false);
    }
  }, [toast, qc]);

  const handleGeneratePin = useCallback(async (emp: EmployeeWithCycle) => {
    setGeneratingPinId(emp.id);
    try {
      const data = await generateEmployeePin(emp.id);
      setPinDialog({ empName: emp.name, pin: data.pin, cpfLogin: data.cpfLogin, created: data.userCreated });
      setPinCopied(false);
      qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
    } catch (e) {
      toast({ title: "Não foi possível gerar a senha", description: serverErrorMessage(e, "Não foi possível gerar a senha. Tente novamente."), variant: "destructive" });
    } finally {
      setGeneratingPinId(null);
    }
  }, [toast, qc]);

  const [mergeMode, setMergeMode] = useState(false);
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [resetTypeOpen, setResetTypeOpen] = useState(false);
  const [resetTypePending, setResetTypePending] = useState(false);
  const [casaSelection, setCasaSelection] = useState<Set<number>>(new Set());
  const [resetTypeSearch, setResetTypeSearch] = useState("");

  const qKey = getGetEmployeesQueryKey({ active: filterActive === "true" });
  const { data: employeesRaw, isLoading } = useGetEmployees(
    { active: filterActive === "true" },
    { query: { queryKey: qKey } }
  );
  const employees = employeesRaw as EmployeeWithCycle[] | undefined;

  // Só ao ABRIR o diálogo: com "employees" nas dependências, qualquer refetch
  // de fundo apagava a seleção que o usuário estava fazendo.
  useEffect(() => {
    if (!resetTypeOpen) return;
    setCasaSelection(new Set((employees ?? []).filter(e => e.employmentType === "casa").map(e => e.id)));
    setResetTypeSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTypeOpen]);
  const [canonicalId, setCanonicalId] = useState<number | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeEmployeeResult | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeInput>({
    defaultValues: { department: "Geral", functionName: "Colaborador", employmentType: "casa" },
  });
  // Fechar o diálogo (X, Esc, Cancelar) descarta o rascunho e os erros — não só no sucesso.
  function setCreateOpen(o: boolean) {
    setOpen(o);
    if (!o) reset();
  }

  const createMutation = useCreateEmployee({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Colaborador criado" });
        setCreateOpen(false);
        if (data.generatedAccess?.cpfLogin && data.generatedAccess?.password) {
          setNewAccess({ cpfLogin: data.generatedAccess.cpfLogin, password: data.generatedAccess.password });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Não foi possível criar o colaborador", description: e.message ?? "Tente novamente.", variant: "destructive" }),
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
        setMergeConfirmOpen(false);
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
    formState: { errors: editErrors },
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
      onError: (e: { message?: string }) => toast({ title: "Não foi possível salvar o colaborador", description: e.message ?? "Tente novamente.", variant: "destructive" }),
    },
  });

  // Espelha o backend (routes/employees.ts): criar/editar = admin|rh|operador;
  // mesclar, acessos em massa, PINs, redefinir tipos e importar CPFs = admin|rh;
  // "Ver visão" (POST /auth/impersonate) = só admin.
  const isAdmin = hasRole(user, "admin");
  const canBulk = isAdmin || hasRole(user, "rh");
  const canEdit = canBulk || hasRole(user, "operador");
  const filtered = (employees ?? []).filter(e =>
    (filterType === "all" || (e.employmentType ?? "casa") === filterType) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()) ||
      e.functionName.toLowerCase().includes(search.toLowerCase()))
  );

  function toggleMergeSelection(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); if (canonicalId === id) setCanonicalId(null); }
      else next.add(id);
      return next;
    });
  }

  // Redefinir Tipos: recriado a cada render (como o antigo onClick inline), então sempre lê a seleção atual.
  async function handleResetTypes() {
    setResetTypePending(true);
    try {
      await bulkEmploymentReset({ casaIds: Array.from(casaSelection) });
      await qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
      toast({ title: "Tipos atualizados", description: `${casaSelection.size} colaborador(es) Casa. Demais marcados como Freela. Ranking recalculado.` });
      setResetTypeOpen(false);
    } catch (e) {
      toast({ title: "Não foi possível atualizar os tipos", description: serverErrorMessage(e, "Não foi possível atualizar os tipos. Tente novamente."), variant: "destructive" });
    } finally {
      setResetTypePending(false);
    }
  }

  const stats = {
    total: employees?.length ?? 0,
    ativos: employees?.filter(e => e.active).length ?? 0,
    elegiveis: employees?.filter(e => getEligibilityStatus(e) === "eligible").length ?? 0,
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Page header */}
        <EmployeesHeader
          canEdit={canEdit}
          canBulk={canBulk}
          mergeMode={mergeMode}
          onToggleMergeMode={() => { setMergeMode(v => !v); setSelectedIds(new Set()); setCanonicalId(null); }}
          onOpenBulkAccess={() => { setBulkOpen(true); setBulkResult(null); }}
          onOpenBulkPin={() => { setBulkPinOpen(true); setBulkPinResult(null); }}
          onOpenResetTypes={() => setResetTypeOpen(true)}
          onOpenBulkCpf={() => { setBulkCpfOpen(true); setBulkCpfResult(null); }}
          createDialog={
            <CreateEmployeeDialog
              open={open}
              onOpenChange={setCreateOpen}
              register={register}
              handleSubmit={handleSubmit}
              errors={errors}
              onSubmit={d => createMutation.mutate({ data: { ...d, name: d.name.trim(), department: "Geral", functionName: "Colaborador", employmentType: "casa" } })}
              isPending={createMutation.isPending}
            />
          }
        />

        {/* Edit dialog */}
        <EditEmployeeDialog
          open={!!editingEmployee}
          onClose={() => setEditingEmployee(null)}
          register={registerEdit}
          handleSubmit={handleEditSubmit}
          errors={editErrors}
          setValue={setValueEdit}
          functionName={watchedEditFunctionName}
          employmentType={watchedEditEmploymentType}
          onSubmit={d => {
            if (!editingEmployee) return;
            updateMutation.mutate({ id: editingEmployee.id, data: { ...d, name: d.name.trim() } });
          }}
          isPending={updateMutation.isPending}
        />

        {/* KPIs */}
        <EmployeesKpis stats={stats} />

        {/* Search + filter */}
        <EmployeesFilters
          search={search}
          onSearchChange={setSearch}
          filterActive={filterActive}
          onFilterActiveChange={setFilterActive}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
        />

        {/* Table */}
        <EmployeesTable
          isLoading={isLoading}
          filtered={filtered}
          total={stats.total}
          mergeMode={mergeMode}
          selectedIds={selectedIds}
          canonicalId={canonicalId}
          canBulk={canBulk}
          canEdit={canEdit}
          isAdmin={isAdmin}
          previewingId={previewingId}
          generatingPinId={generatingPinId}
          onToggleMergeSelection={toggleMergeSelection}
          onPreviewAs={handlePreviewAs}
          onGeneratePin={handleGeneratePin}
          onEdit={setEditingEmployee}
        />

        {/* Merge action bar */}
        {mergeMode && selectedIds.size >= 2 && (
          <MergeActionBar
            employees={employees}
            selectedIds={selectedIds}
            canonicalId={canonicalId}
            onSelectCanonical={setCanonicalId}
            onRequestMerge={() => setMergeConfirmOpen(true)}
            isPending={mergeMutation.isPending}
          />
        )}
      </div>

      {/* Bulk generate access dialog */}
      <BulkAccessDialog
        open={bulkOpen}
        onOpenChange={v => { setBulkOpen(v); if (!v) setBulkResult(null); }}
        isPreviewLoading={isBulkPreviewLoading}
        preview={bulkPreview}
        result={bulkResult}
        typeFilter={bulkTypeFilter}
        onTypeFilterChange={setBulkTypeFilter}
        isGenerating={bulkGenerateMutation.isPending}
        onGenerate={() => bulkGenerateMutation.mutate({ data: { dryRun: false, ...(bulkTypeFilter !== "all" ? { employmentType: bulkTypeFilter } : {}) } })}
        onCancel={() => setBulkOpen(false)}
        onDone={() => { setBulkOpen(false); setBulkResult(null); refetchBulkPreview(); }}
      />

      {/* Redefinir Tipos em Massa — seleção dinâmica */}
      <ResetTypesDialog
        open={resetTypeOpen}
        onOpenChange={setResetTypeOpen}
        pending={resetTypePending}
        employees={employees}
        casaSelection={casaSelection}
        onCasaSelectionChange={setCasaSelection}
        search={resetTypeSearch}
        onSearchChange={setResetTypeSearch}
        onConfirm={handleResetTypes}
      />

      {/* Merge result dialog */}
      <MergeResultDialog mergeResult={mergeResult} onClose={() => setMergeResult(null)} />

      {/* Newly generated single-employee access */}
      <NewAccessDialog newAccess={newAccess} onClose={() => setNewAccess(null)} />

      {/* Bulk PIN dialog */}
      <BulkPinDialog
        open={bulkPinOpen}
        onOpenChange={v => { if (!v) { setBulkPinOpen(false); setBulkPinResult(null); } }}
        loading={bulkPinLoading}
        result={bulkPinResult}
        source={bulkPinSource}
        confirmRegen={confirmRegen}
        onConfirmRegenChange={setConfirmRegen}
        onGenerate={handleBulkGeneratePins}
        onCancel={() => setBulkPinOpen(false)}
        onClose={() => { setBulkPinOpen(false); setBulkPinResult(null); setConfirmRegen(false); }}
        appLink={APP_LINK}
        linkCopied={bulkLinkCopied}
        onLinkCopiedChange={setBulkLinkCopied}
        toast={toast}
      />

      {/* PIN gerado dialog */}
      <PinDialog
        pinDialog={pinDialog}
        onClose={() => setPinDialog(null)}
        pinCopied={pinCopied}
        onPinCopiedChange={setPinCopied}
        toast={toast}
      />

      {/* Confirmação da mesclagem: apaga os registros duplicados e seus resultados */}
      <MergeConfirmDialog
        open={mergeConfirmOpen}
        onOpenChange={setMergeConfirmOpen}
        employees={employees}
        selectedIds={selectedIds}
        canonicalId={canonicalId}
        isPending={mergeMutation.isPending}
        onConfirm={() => {
          if (!canonicalId) return;
          const dupIds = Array.from(selectedIds).filter(id => id !== canonicalId);
          mergeMutation.mutate({ id: canonicalId, data: { duplicateIds: dupIds } });
        }}
      />

      {/* Diálogo de importação em lote de CPFs */}
      <BulkCpfDialog
        open={bulkCpfOpen}
        onOpenChange={v => { setBulkCpfOpen(v); if (!v) setBulkCpfResult(null); }}
        text={bulkCpfText}
        onTextChange={setBulkCpfText}
        validCount={parsedCpfRows.length}
        loading={bulkCpfLoading}
        result={bulkCpfResult}
        onConfirm={handleBulkSetCpf}
        onClose={() => setBulkCpfOpen(false)}
      />
    </div>
  );
}
