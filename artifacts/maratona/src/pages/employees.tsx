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
  useSetEmployeeCycleExclusion,
} from "@workspace/api-client-react";
import type { EmployeeInput, BulkGenerateAccessResult, MergeEmployeeResult, BulkSetCpfResult, CasaPin, SkippedPin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useAuth, hasRole } from "@/lib/auth-context";
import { GitMerge, Info, Plus, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { invalidateCycleResults } from "@/lib/invalidate-results";
import { plural } from "@/lib/utils";
import { nameKey, localizeBonusStatus, EmptyBlock, ErrorBlock, Bone, surfaceCls, btnPrimary, btnSmall, Notice } from "./employees/ui";
import { CycleToggleDialog } from "./employees/cycle-toggle-dialog";
import type { AttentionFilter, BulkTypeFilter, EmployeeWithCycle, EmploymentType, PinDialogData } from "./employees/types";
import { cycleStatus, getEligibilityStatus, hasCycleScore, parseCpfRows, serverErrorMessage, toTitleCase } from "./employees/utils";
import { EmployeesHeader, EmployeesPanel, EmployeesToolbar, MergeModeBanner } from "./employees/employees-header";
import { CreateEmployeeDialog, EditEmployeeDialog } from "./employees/employee-form-dialogs";
import { EmployeesTable } from "./employees/employees-table";
import { MergeActionBar, MergeConfirmDialog, MergeResultDialog } from "./employees/merge-dialogs";
import { BulkAccessDialog, NewAccessDialog } from "./employees/access-dialogs";
import { ResetTypesDialog } from "./employees/reset-types-dialog";
import { BulkPinDialog, PinDialog } from "./employees/pin-dialogs";
import { BulkCpfDialog } from "./employees/bulk-cpf-dialog";

// Página de Colaboradores. Todo o estado, as queries/mutações e os handlers ficam aqui
// (na mesma ordem de hooks de antes da divisão); os arquivos em ./employees/ só desenham.

/** Carregando: o panorama, a barra de ferramentas e algumas linhas. */
function EmployeesSkeleton() {
  return (
    <div role="status" aria-label="Carregando colaboradores" className="space-y-5">
      <div className={cn(surfaceCls, "grid grid-cols-2 lg:grid-cols-5 gap-px overflow-hidden bg-border")}>
        {Array.from({ length: 5 }, (_, i) => <div key={i} className={cn("bg-card px-5 py-4 space-y-3", i === 0 && "col-span-2 lg:col-span-1")}><Bone className="h-3 w-24" /><Bone className="h-8 w-16" /><Bone className="h-3 w-32" /></div>)}
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5"><Bone className="h-11 lg:h-10 w-full sm:w-[300px]" /><Bone className="h-11 lg:h-9 w-full sm:w-[440px]" /></div>
      <div className={cn(surfaceCls, "divide-y divide-border")}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Bone className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2"><Bone className="h-4 w-52 max-w-full" /><Bone className="h-3 w-36" /></div>
            <Bone className="h-6 w-20 hidden md:block" /><Bone className="h-6 w-24 hidden lg:block" /><Bone className="h-6 w-20 hidden lg:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

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
  // Lista padrão: quem tem nota no ciclo atual ("No ciclo") e quem o admin
  // tirou dele ("Fora do ciclo", para poder devolver). Quem ainda NÃO tem nota
  // (freela, recém-criado) aparece só pela busca, numa seção à parte "Sem nota
  // no ciclo" — assim ninguém fica inacessível (editar, PIN, mesclar).
  const [filterCycle, setFilterCycle] = useState<"in" | "out">("in");
  // Atalho do painel (elegíveis, casa sem acesso, nome repetido): só recorta a lista.
  const [attention, setAttention] = useState<AttentionFilter>(null);
  const [cycleTarget, setCycleTarget] = useState<EmployeeWithCycle | null>(null);
  const [cycleReason, setCycleReason] = useState("");
  // Recusa do servidor mostrada dentro do diálogo (ex.: 409 do bônus, 409 de ciclo fechado).
  const [cycleError, setCycleError] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);
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

  const qKey = getGetEmployeesQueryKey();
  const { data: employeesRaw, isLoading, isError, refetch, isRefetching } = useGetEmployees(
    undefined,
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
      onSuccess: (data, variables) => {
        qc.invalidateQueries({ queryKey: qKey });
        // Recém-criado ainda não tem nota: preenche a busca com o nome para ele
        // aparecer na hora (seção "Sem nota no ciclo").
        const createdName = (variables.data.name ?? "").trim();
        if (createdName) setSearch(createdName);
        toast({
          title: `${toTitleCase(createdName || "Colaborador")} criado`,
          description: "Aparece pela busca, em \"Sem nota no ciclo\". Entra em \"No ciclo\" quando tiver nota em algum evento.",
        });
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
        qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
        setMergeResult(data);
        setMergeMode(false);
        setMergeConfirmOpen(false);
        setSelectedIds(new Set());
        setCanonicalId(null);
      },
      // Fica no diálogo de confirmação (ex.: 409 — dados de ciclo fechado não mudam de cadastro).
      onError: (e: unknown) => setMergeError(serverErrorMessage(e, "Não foi possível mesclar. Tente novamente.")),
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
  const inCycle = (employees ?? []).filter(e => cycleStatus(e) === "in");
  const outOfCycle = (employees ?? []).filter(e => cycleStatus(e) === "out");
  const term = search.trim().toLowerCase();
  const matches = (e: EmployeeWithCycle) => !term ||
    e.name.toLowerCase().includes(term) ||
    e.department.toLowerCase().includes(term) ||
    e.functionName.toLowerCase().includes(term);
  // Nome repetido (sem acento/caixa/espaço duplo): pode ser a mesma pessoa — atalho para a mesclagem.
  const duplicateIds = (() => {
    const byName = new Map<string, number[]>();
    for (const e of employees ?? []) {
      const k = nameKey(e.name);
      byName.set(k, [...(byName.get(k) ?? []), e.id]);
    }
    return new Set([...byName.values()].filter(ids => ids.length > 1).flat());
  })();
  const passesAttention = (e: EmployeeWithCycle) =>
    attention === null ||
    (attention === "eligible" && hasCycleScore(e) && getEligibilityStatus(e) === "eligible") ||
    (attention === "noAccess" && e.employmentType === "casa" && !e.hasAccess) ||
    (attention === "dup" && duplicateIds.has(e.id));
  const filtered = (filterCycle === "in" ? inCycle : outOfCycle).filter(e => matches(e) && passesAttention(e));
  // Sem nota no ciclo: só com texto na busca (a lista padrão continua só com quem tem
  // nota) — ou no atalho "Nome repetido", que precisa mostrar o cadastro novo também.
  const noScoreMatches = term || attention === "dup"
    ? (employees ?? []).filter(e => cycleStatus(e) === "none" && matches(e) && passesAttention(e))
    : [];

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
      toast({ title: "Tipos atualizados", description: `${plural(casaSelection.size, "colaborador", "colaboradores")} Casa. Demais marcados como Freela. Ranking recalculado.` });
      setResetTypeOpen(false);
    } catch (e) {
      toast({ title: "Não foi possível atualizar os tipos", description: serverErrorMessage(e, "Não foi possível atualizar os tipos. Tente novamente."), variant: "destructive" });
    } finally {
      setResetTypePending(false);
    }
  }

  // "Com nota no ciclo" conta só quem tem nota; a lista "No ciclo" também traz
  // quem veio do ciclo anterior e ainda não tem nota no ciclo novo.
  const withScore = inCycle.filter(hasCycleScore);
  const stats = {
    noCiclo: withScore.length,
    listaNoCiclo: inCycle.length,
    elegiveis: withScore.filter(e => getEligibilityStatus(e) === "eligible").length,
    foraDoCiclo: outOfCycle.length,
    semAcesso: inCycle.filter(e => e.employmentType === "casa" && !e.hasAccess).length,
    repetidos: duplicateIds.size,
  };

  const cycleMutation = useSetEmployeeCycleExclusion();
  function confirmCycleToggle() {
    if (!cycleTarget) return;
    const excluded = cycleStatus(cycleTarget) !== "out";
    const name = toTitleCase(cycleTarget.name);
    cycleMutation.mutate({ id: cycleTarget.id, data: { excluded, reason: excluded ? cycleReason.trim() || null : null } }, {
      onSuccess: (res) => {
        qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
        invalidateCycleResults(qc);
        // Avisos do servidor (ex.: recálculo que não terminou) vão no próprio
        // toast, em vermelho — como nas outras telas (só cabe um toast por vez).
        const warnings = res?.warnings ?? [];
        toast({
          title: excluded ? `${name} saiu do ciclo` : `${name} voltou ao ciclo`,
          description: warnings.length > 0 ? warnings.join(" ")
            : excluded ? "Sem nota, ranking e bônus neste ciclo. Dá para devolver em \"Fora do ciclo\"." : "Entrou de novo no ranking, nas análises e no bônus. Ciclo recalculado.",
          variant: warnings.length > 0 ? "destructive" : undefined,
        });
        setCycleTarget(null);
        setCycleReason("");
      },
      // Fica no diálogo (ex.: 409 — bônus aprovado/agendado/pago/bloqueado), com o atalho para Resultados.
      onError: e => setCycleError(localizeBonusStatus(serverErrorMessage(e, "Tente novamente.")).replace(cycleTarget.name, name)),
    });
  }

  const exitMerge = () => { setMergeMode(false); setSelectedIds(new Set()); setCanonicalId(null); };
  const startMerge = () => { setMergeMode(true); setSelectedIds(new Set()); setCanonicalId(null); };
  const hasAny = (employees ?? []).length > 0;

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <EmployeesHeader
        canEdit={canEdit}
        canBulk={canBulk}
        mergeMode={mergeMode}
        onToggleMergeMode={() => { if (mergeMode) exitMerge(); else startMerge(); }}
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

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1680px] w-full mx-auto">
        {isLoading ? <EmployeesSkeleton /> : isError || !employees ? (
          <ErrorBlock title="Não foi possível carregar os colaboradores" onRetry={() => { void refetch(); }} />
        ) : !hasAny ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={Users} title="Nenhum colaborador cadastrado" testId="employees-empty"
              action={canEdit ? <button type="button" onClick={() => setCreateOpen(true)} className={btnPrimary}><Plus size={15} aria-hidden /> Cadastrar o primeiro</button> : undefined}>
              Os colaboradores chegam pela sincronização ou pelo cadastro manual.
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn("space-y-5 transition-opacity duration-150", isRefetching && "opacity-80")}>
            <EmployeesPanel
              stats={stats}
              canBulk={canBulk}
              tab={filterCycle}
              attention={attention}
              onTab={setFilterCycle}
              onAttention={setAttention}
            />
            {filterCycle === "in" && stats.noCiclo === 0 && stats.listaNoCiclo > 0 && (
              <Notice icon={Info} tone="info" testId="notice-new-cycle">
                <span className="font-semibold text-foreground">Ciclo novo, ninguém com nota ainda.</span> A lista “No ciclo” mostra quem estava no ciclo anterior; cada um passa a ter nota quando for avaliado em algum evento deste ciclo.
              </Notice>
            )}
            {mergeMode && <MergeModeBanner selected={selectedIds.size} onExit={exitMerge} />}
            <div className="space-y-3">
              <EmployeesToolbar
                search={search}
                onSearchChange={setSearch}
                filterCycle={filterCycle}
                onFilterCycleChange={setFilterCycle}
                counts={{ in: inCycle.length, out: outOfCycle.length }}
                attention={attention}
                onClearAttention={() => setAttention(null)}
                extra={attention === "dup" && canBulk && !mergeMode
                  ? <button type="button" onClick={startMerge} className={cn(btnSmall, "min-h-11 lg:min-h-7 text-[12.5px]")}><GitMerge size={13} aria-hidden /> Mesclar duplicatas</button>
                  : undefined}
              />
              <EmployeesTable
                filtered={filtered}
                noScore={noScoreMatches}
                total={filterCycle === "in" ? inCycle.length : outOfCycle.length}
                tab={filterCycle}
                search={search}
                attention={attention}
                onClearSearch={() => setSearch("")}
                onClearAttention={() => setAttention(null)}
                duplicateIds={canBulk ? duplicateIds : new Set()}
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
                onToggleCycle={isAdmin ? emp => { setCycleTarget(emp); setCycleReason(""); setCycleError(null); } : undefined}
              />
            </div>

            {mergeMode && selectedIds.size >= 2 && (
              <MergeActionBar
                employees={employees}
                selectedIds={selectedIds}
                canonicalId={canonicalId}
                onSelectCanonical={setCanonicalId}
                onRequestMerge={() => { setMergeError(null); setMergeConfirmOpen(true); }}
                isPending={mergeMutation.isPending}
              />
            )}
          </div>
        )}
      </div>

      <CycleToggleDialog
        target={cycleTarget}
        reason={cycleReason}
        onReasonChange={setCycleReason}
        pending={cycleMutation.isPending}
        error={cycleError}
        onConfirm={() => { setCycleError(null); confirmCycleToggle(); }}
        onClose={() => { setCycleTarget(null); setCycleError(null); }}
      />

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
        error={mergeError}
        onConfirm={() => {
          if (!canonicalId) return;
          setMergeError(null);
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
