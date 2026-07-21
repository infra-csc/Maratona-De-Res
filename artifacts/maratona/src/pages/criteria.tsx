import { useState, useMemo } from "react";
import { useGetCriteria, useCreateCriterion, useUpdateCriterion, useGetAreas, useResyncAllEventsCriteria, useGetUsers, getGetCriteriaQueryKey, useGetConformityRouting, useSetAreaConformityRouting, getGetConformityRoutingQueryKey } from "@workspace/api-client-react";
import type { CriterionInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Building2, Zap, Pencil, Check, X, RefreshCw, Route, UserCheck, ChevronDown, ChevronUp, Users, AlertCircle, Settings2, Search, Calendar, Copy } from "lucide-react";
import { useAllCriterionRoutings, useSaveCriterionRouting } from "@/lib/routing-api";
import type { CriterionRouting } from "@/lib/routing-api";
import { CONDENSED, BODY, WARNING, PremiumCard } from "@/lib/premium-theme";

const GOOD = "#9ab000";
const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

function CriterionWeightCell({
  criterionId, weight, isSaving, onSave,
}: {
  criterionId: number; weight: number; isSaving: boolean; onSave: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(weight));

  if (!editing) {
    return (
      <button
        type="button"
        data-testid={`button-edit-weight-${criterionId}`}
        onClick={() => { setValue(String(weight)); setEditing(true); }}
        className="rounded-lg px-3 py-1.5 inline-flex items-center gap-2 min-w-[48px] transition-colors hover:opacity-80 group/weight"
        style={{ backgroundColor: "var(--secondary)" }}
      >
        <span className="text-lg font-black" style={{ fontFamily: CONDENSED }}>{weight.toFixed(0)}</span>
        <Pencil size={11} className="opacity-0 group-hover/weight:opacity-100 transition-opacity" style={{ color: "var(--muted-foreground)" }} />
      </button>
    );
  }

  const submit = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) { setEditing(false); return; }
    if (parsed !== weight) onSave(parsed);
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        data-testid={`input-edit-weight-${criterionId}`}
        type="number"
        min="0"
        step="1"
        autoFocus
        value={value}
        disabled={isSaving}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
        className="h-9 w-20 rounded-lg text-center font-black"
        style={fieldStyle}
      />
      <button type="button" data-testid={`button-save-weight-${criterionId}`} onClick={submit} className="p-1.5 rounded-lg transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
        <X size={14} />
      </button>
    </div>
  );
}

function EvaluatorPickerCell({
  criterionId, currentRouting, evaluators, onSaved,
}: {
  criterionId: number;
  currentRouting: CriterionRouting | undefined;
  evaluators: { id: number; name: string }[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const saveMutation = useSaveCriterionRouting(criterionId);

  const handleSelect = (userId: number | null) => {
    saveMutation.mutate({
      defaultEvaluatorId: userId,
      commentRequired: currentRouting?.commentRequired ?? true,
      redirectMode: currentRouting?.redirectMode ?? "none",
      redirectAreaId: currentRouting?.redirectAreaId ?? null,
      redirectUserIds: currentRouting?.redirectUsers?.map(u => u.id) ?? [],
    }, {
      onSuccess: () => { setOpen(false); setSearch(""); onSaved(); },
    });
  };

  const filtered = evaluators.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const current = currentRouting?.defaultEvaluatorName ?? null;

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 text-left" title="Clique para definir o avaliador padrão">
          {current ? (
            <span className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:opacity-80">
              <UserCheck size={13} className="shrink-0" style={{ color: "var(--accent)" }} />
              {current}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ color: WARNING }}>
              <AlertCircle size={12} /> Sem avaliador
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-xl" align="start" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>Avaliador Padrão</p>
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs rounded-lg" style={fieldStyle} autoFocus />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-xs py-4" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado para "{search}"</p>
          )}
          {filtered.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u.id)}
              disabled={saveMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors hover:opacity-90"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: u.id === currentRouting?.defaultEvaluatorId ? "rgba(154,176,0,0.10)" : "transparent", color: u.id === currentRouting?.defaultEvaluatorId ? "var(--accent)" : "var(--foreground)" }}
            >
              {u.id === currentRouting?.defaultEvaluatorId && <Check size={11} className="shrink-0" style={{ color: "var(--accent)" }} />}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {saveMutation.isPending && (
          <div className="p-2 text-center text-[10px] font-bold" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Salvando...</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ConformityAreaEvaluatorPicker({
  areaId, currentEvaluatorId, currentEvaluatorName, evaluators,
}: {
  areaId: number;
  currentEvaluatorId: number | null;
  currentEvaluatorName: string | null;
  evaluators: { id: number; name: string }[];
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const saveMutation = useSetAreaConformityRouting({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetConformityRoutingQueryKey() });
        setOpen(false);
        setSearch("");
        toast({ title: "Avaliador padrão da matriz salvo" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const handleSelect = (userId: number | null) => {
    saveMutation.mutate({ id: areaId, data: { defaultEvaluatorId: userId } });
  };

  const filtered = evaluators.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 text-left" title="Clique para definir o avaliador padrão da matriz">
          {currentEvaluatorName ? (
            <span className="flex items-center gap-1.5 text-sm font-bold transition-colors hover:opacity-80">
              <UserCheck size={13} className="shrink-0" style={{ color: "var(--accent)" }} />
              {currentEvaluatorName}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ color: WARNING }}>
              <AlertCircle size={12} /> Sem avaliador
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 rounded-xl" align="start" onClick={e => e.stopPropagation()} style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-[10px] font-black uppercase tracking-wider mb-1.5" style={{ color: "var(--muted-foreground)" }}>Avaliador Padrão da Matriz</p>
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="h-7 text-xs rounded-lg" style={fieldStyle} autoFocus />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-center text-xs py-4" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado para "{search}"</p>
          )}
          {filtered.map((u, i) => (
            <button key={u.id} type="button" onClick={() => handleSelect(u.id)} disabled={saveMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors hover:opacity-90"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: u.id === currentEvaluatorId ? "rgba(154,176,0,0.10)" : "transparent", color: u.id === currentEvaluatorId ? "var(--accent)" : "var(--foreground)" }}
            >
              {u.id === currentEvaluatorId && <Check size={11} className="shrink-0" style={{ color: "var(--accent)" }} />}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {saveMutation.isPending && (
          <div className="p-2 text-center text-[10px] font-bold" style={{ borderTop: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Salvando...</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RoutingConfigDialog({
  criterionId, currentRouting, areas, evaluators, onClose,
}: {
  criterionId: number;
  criterionName: string;
  currentRouting: CriterionRouting | undefined;
  areas: { id: number; name: string }[];
  evaluators: { id: number; name: string }[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const saveMutation = useSaveCriterionRouting(criterionId);

  const [defaultEvaluatorId, setDefaultEvaluatorId] = useState<number | null>(currentRouting?.defaultEvaluatorId ?? null);
  const [redirectMode, setRedirectMode] = useState<"none" | "area" | "specific">(currentRouting?.redirectMode ?? "none");
  const [redirectAreaId, setRedirectAreaId] = useState<number | null>(currentRouting?.redirectAreaId ?? null);
  const [selectedRedirectUsers, setSelectedRedirectUsers] = useState<Set<number>>(
    new Set(currentRouting?.redirectUsers?.map(u => u.id) ?? []),
  );
  const [redirectSearch, setRedirectSearch] = useState("");
  const [redirectCollapsed, setRedirectCollapsed] = useState(true);
  const [evalSearch, setEvalSearch] = useState("");
  const [allowPublicLink, setAllowPublicLink] = useState(currentRouting?.allowPublicLink ?? false);

  const toggleRedirectUser = (userId: number) => {
    setSelectedRedirectUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const filteredRedirectEvaluators = evaluators.filter(u =>
    u.name.toLowerCase().includes(redirectSearch.toLowerCase()),
  );

  const filteredEvaluators = evaluators.filter(u =>
    u.name.toLowerCase().includes(evalSearch.toLowerCase()),
  );

  const redirectCount = selectedRedirectUsers.size;

  const handleSave = () => {
    saveMutation.mutate({
      defaultEvaluatorId,
      redirectMode,
      redirectAreaId: redirectMode === "area" ? redirectAreaId : null,
      redirectUserIds: redirectMode === "specific" ? Array.from(selectedRedirectUsers) : undefined,
      allowPublicLink,
    }, {
      onSuccess: () => { toast({ title: "Roteamento salvo" }); onClose(); },
      onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-5 pt-2">
      {/* Avaliador Principal */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Avaliador Principal</Label>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Obrigatório</span>
        </div>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Responsável padrão por este critério. Pré-selecionado ao gerar atribuições para um evento.</p>
        <Input placeholder="Buscar avaliador..." value={evalSearch} onChange={e => setEvalSearch(e.target.value)} className="h-9 rounded-lg text-sm" style={fieldStyle} />
        <div className="rounded-lg max-h-40 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
          {defaultEvaluatorId == null && (
            <button type="button" onClick={() => setDefaultEvaluatorId(null)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left" style={{ backgroundColor: "var(--secondary)" }}>
              <span>— Sem avaliador</span>
            </button>
          )}
          {filteredEvaluators.map((u, i) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setDefaultEvaluatorId(u.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-left transition-colors hover:opacity-90"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: u.id === defaultEvaluatorId ? "rgba(154,176,0,0.10)" : "transparent", color: u.id === defaultEvaluatorId ? "var(--accent)" : "var(--foreground)" }}
            >
              {u.id === defaultEvaluatorId && <Check size={11} className="shrink-0" style={{ color: "var(--accent)" }} />}
              <span className="flex items-center gap-2"><UserCheck size={13} style={{ color: "var(--accent)" }} />{u.name}</span>
            </button>
          ))}
        </div>
        {defaultEvaluatorId == null && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: WARNING }}>
            <AlertCircle size={12} /> Sem avaliador principal definido
          </p>
        )}
      </div>

      {/* Redirecionamento */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Pode Redirecionar Para</Label>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Quando o principal não puder avaliar, para onde pode redirecionar?</p>
        <Select value={redirectMode} onValueChange={v => { setRedirectMode(v as "none" | "area" | "specific"); setRedirectCollapsed(true); }}>
          <SelectTrigger className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem redirecionamento</SelectItem>
            <SelectItem value="area">Qualquer usuário da área</SelectItem>
            <SelectItem value="specific">Usuários específicos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {redirectMode === "area" && (
        <div className="space-y-2">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área de Redirecionamento</Label>
          <Select value={redirectAreaId != null ? String(redirectAreaId) : "__none"} onValueChange={v => setRedirectAreaId(v === "__none" ? null : parseInt(v))}>
            <SelectTrigger className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
              <SelectValue placeholder="Selecione a área..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Selecione</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {redirectMode === "specific" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setRedirectCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <span className="flex items-center gap-2 font-bold uppercase text-xs" style={{ color: "var(--muted-foreground)" }}>
              <Users size={13} />
              {redirectCount === 0
                ? "Nenhum avaliador de backup selecionado"
                : `${redirectCount} avaliador${redirectCount > 1 ? "es" : ""} de backup selecionado${redirectCount > 1 ? "s" : ""}`}
            </span>
            {redirectCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {!redirectCollapsed && (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Input placeholder="Buscar avaliador..." value={redirectSearch} onChange={e => setRedirectSearch(e.target.value)} className="h-8 rounded-lg text-sm" style={fieldStyle} />
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filteredRedirectEvaluators.length === 0 ? (
                  <p className="px-4 py-3 text-xs" style={{ color: "var(--muted-foreground)" }}>Nenhum resultado para "{redirectSearch}"</p>
                ) : filteredRedirectEvaluators.map((u, i) => (
                  <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:opacity-90" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: selectedRedirectUsers.has(u.id) ? "rgba(154,176,0,0.10)" : "transparent" }}>
                    <input type="checkbox" checked={selectedRedirectUsers.has(u.id)} onChange={() => toggleRedirectUser(u.id)} className="h-4 w-4" />
                    <span className="text-sm font-bold uppercase">{u.name}</span>
                    {u.id === defaultEvaluatorId && (
                      <span className="ml-auto text-[9px] font-black uppercase rounded px-1.5 py-0.5" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Principal</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Link Freelancer */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={allowPublicLink} onChange={e => setAllowPublicLink(e.target.checked)} className="h-4 w-4 mt-0.5" />
          <span>
            <span className="block font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Permite Link Freelancer</span>
            <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>Libera gerar um link público de avaliação (sem conta no sistema) para este critério — use só para áreas que recebem freelancers (ex.: Ativação, Produção, Cenografia). Logística e Atendimento são sempre time da casa, não precisam disso.</span>
          </span>
        </label>
      </div>

      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg font-bold uppercase text-xs transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg font-bold uppercase text-xs disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar Roteamento"}
        </button>
      </div>
    </div>
  );
}

export default function CriteriaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [routingDialogId, setRoutingDialogId] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAreaId, setFilterAreaId] = useState<string>("__all");

  const qKey = getGetCriteriaQueryKey();
  const { data: criteria, isLoading } = useGetCriteria({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: usersList } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });
  const { data: routings } = useAllCriterionRoutings();
  const { data: conformityRoutings } = useGetConformityRouting();

  const evaluators = useMemo(() =>
    (usersList ?? [])
      .filter(u => u.active && u.role !== "visualizador")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [usersList],
  );

  const routingMap = new Map((routings ?? []).map(r => [r.criterionId, r]));

  const { register, handleSubmit, reset, setValue } = useForm<CriterionInput>({
    defaultValues: { defaultWeight: 3 },
  });

  const createMutation = useCreateCriterion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Critério criado" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateCriterion({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    },
  });

  const [fixCalibRunning, setFixCalibRunning] = useState(false);
  const [fixCalibResult, setFixCalibResult] = useState<{ totalUpdated: number; results: { from: string; to: string; updated: number }[] } | null>(null);
  async function runFixCalibrationCriteria() {
    setFixCalibRunning(true);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
      const resp = await fetch(`${base}/events/admin/fix-calibration-criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setFixCalibResult(data);
      toast({ title: `Calibrações corrigidas — ${data.totalUpdated} linha(s) atualizada(s)` });
    } catch (e: unknown) {
      toast({ title: "Erro ao corrigir calibrações", description: (e as Error).message, variant: "destructive" });
    } finally {
      setFixCalibRunning(false);
    }
  }

  const [syncLabelsRunning, setSyncLabelsRunning] = useState(false);
  const [syncLabelsResult, setSyncLabelsResult] = useState<number | null>(null);
  async function runSyncAreaLabels() {
    setSyncLabelsRunning(true);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");
      const resp = await fetch(`${base}/criteria/admin/sync-area-labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      setSyncLabelsResult(data.updated);
      toast({ title: `Rótulos de área sincronizados — ${data.updated} critério(s) atualizado(s)` });
      qc.invalidateQueries({ queryKey: qKey });
    } catch (e: unknown) {
      toast({ title: "Erro ao sincronizar rótulos", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncLabelsRunning(false);
    }
  }

  const [resyncSummary, setResyncSummary] = useState<{ processed: number; skipped: number; totalAdded: number; totalDeactivated: number; totalActivated: number; events: { id: number; name: string; added: number; deactivated: number; activated: number }[] } | null>(null);
  const resyncAllMutation = useResyncAllEventsCriteria({
    mutation: {
      onSuccess: (data) => {
        setResyncSummary({
          processed: data.processed ?? 0,
          skipped: data.skipped ?? 0,
          totalAdded: data.totalAdded ?? 0,
          totalDeactivated: data.totalDeactivated ?? 0,
          totalActivated: (data as { totalActivated?: number }).totalActivated ?? 0,
          events: (data.events ?? []).map(ev => ({
            id: ev.id ?? 0, name: ev.name ?? "", added: ev.added ?? 0, deactivated: ev.deactivated ?? 0,
            activated: (ev as { activated?: number }).activated ?? 0,
          })),
        });
        toast({ title: `Sincronização concluída — ${data.processed ?? 0} evento(s) atualizado(s)` });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const inactiveCriteria = (criteria ?? []).filter(c => !c.active);
  const baseDisplayed = showInactive ? (criteria ?? []) : activeCriteria;

  const displayedCriteria = useMemo(() => {
    let list = baseDisplayed;
    if (filterAreaId !== "__all") {
      const areaIdNum = parseInt(filterAreaId);
      list = list.filter(c => (c.responsibleAreaId ?? null) === (Number.isNaN(areaIdNum) ? null : areaIdNum));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q));
    }
    return list.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [baseDisplayed, filterAreaId, searchQuery]);

  const routingCriterion = routingDialogId != null ? (criteria ?? []).find(c => c.id === routingDialogId) : null;

  const [duplicateSourceId, setDuplicateSourceId] = useState<number | null>(null);
  const [duplicateAreaId, setDuplicateAreaId] = useState<string>("");
  const duplicateSource = duplicateSourceId != null ? (criteria ?? []).find(c => c.id === duplicateSourceId) : null;

  const duplicateMutation = useCreateCriterion({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Critério duplicado" });
        setDuplicateSourceId(null);
        setDuplicateAreaId("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
    },
  });

  const handleDuplicate = () => {
    if (!duplicateSource || !duplicateAreaId) return;
    duplicateMutation.mutate({
      data: {
        name: duplicateSource.name,
        description: duplicateSource.description ?? undefined,
        defaultWeight: Number(duplicateSource.defaultWeight),
        responsibleAreaId: Number(duplicateAreaId),
      },
    });
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>Configuração de Performance</span>
            <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none mt-1" style={{ fontFamily: CONDENSED }}>
              Critérios de Avaliação
            </h1>
            <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>Configure os quesitos de avaliação com nota, seus respectivos pesos e roteamento de avaliadores.</p>
          </div>
        </section>

        {/* Actions */}
        <section className="flex justify-end gap-3 flex-wrap items-start">
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              disabled={syncLabelsRunning}
              onClick={runSyncAreaLabels}
              className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              <Building2 size={15} className={syncLabelsRunning ? "animate-pulse" : ""} />
              {syncLabelsRunning ? "Sincronizando..." : syncLabelsResult != null ? `✓ ${syncLabelsResult} sync` : "Sync. Rótulos de Área"}
            </button>
            <p className="text-[10px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Atualiza o nome da área exibido em cada critério</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              disabled={fixCalibRunning || fixCalibResult != null}
              onClick={runFixCalibrationCriteria}
              className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, backgroundColor: "rgba(232,162,61,0.14)", color: "#8a5f1a" }}
            >
              <Zap size={15} className={fixCalibRunning ? "animate-pulse" : ""} />
              {fixCalibRunning ? "Corrigindo..." : fixCalibResult != null ? `✓ ${fixCalibResult.totalUpdated} corr.` : "Corrigir Calibrações"}
            </button>
            <p className="text-[10px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Recalcula calibrações com erro no servidor</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              data-testid="button-resync-all-events"
              disabled={resyncAllMutation.isPending}
              onClick={() => resyncAllMutation.mutate()}
              className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
              style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
            >
              <RefreshCw size={15} className={resyncAllMutation.isPending ? "animate-spin" : ""} />
              {resyncAllMutation.isPending ? "Sincronizando..." : "Sync. Todos os Eventos"}
            </button>
            <p className="text-[10px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Aplica critérios ativos a todos os eventos abertos</p>
          </div>

          <div className="flex flex-col items-center gap-1">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="button-create-criterion"
                  className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
                  style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Plus size={16} /> Novo Critério
                </button>
              </DialogTrigger>
            </Dialog>
            <p className="text-[10px] text-center max-w-[140px]" style={{ color: "var(--muted-foreground)" }}>Adiciona um critério de avaliação com nota e peso</p>
          </div>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando critérios...</div>
        ) : (
          <PremiumCard className="overflow-hidden">
            {/* Filter bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar critério ou descrição..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                  style={fieldStyle}
                />
              </div>
              <select
                value={filterAreaId}
                onChange={e => setFilterAreaId(e.target.value)}
                className="rounded-lg px-3 py-2 text-xs font-bold outline-none min-w-[160px]"
                style={fieldStyle}
              >
                <option value="__all">Todas as áreas</option>
                {(areas ?? []).map(a => (
                  <option key={a.id} value={String(a.id)}>{a.name}</option>
                ))}
                <option value="__none">Sem área</option>
              </select>
              <div className="flex items-center gap-3 ml-auto shrink-0">
                <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
                  {displayedCriteria.length} de {baseDisplayed.length}
                </span>
                {inactiveCriteria.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowInactive(v => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors"
                    style={showInactive ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                  >
                    {showInactive ? "Ocultar Inativos" : `+ Inativos (${inactiveCriteria.length})`}
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Critério &amp; Descrição</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Área</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Peso</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliador Padrão</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-right" style={{ color: "var(--muted-foreground)" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCriteria.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
                        {searchQuery || filterAreaId !== "__all"
                          ? "Nenhum critério encontrado para esses filtros."
                          : "Nenhum critério configurado."}
                      </td>
                    </tr>
                  )}
                  {displayedCriteria.map((c, i) => {
                    const routing = routingMap.get(c.id);
                    const areaFiltered = c.responsibleAreaId != null
                      ? evaluators.filter(u => (u.areaId ?? null) === c.responsibleAreaId)
                      : [];
                    const pickerEvaluators = areaFiltered.length > 0 ? areaFiltered : evaluators;
                    const eventCount = (c as { eventCount?: number }).eventCount ?? 0;
                    return (
                      <tr key={c.id} data-testid={`row-criterion-${c.id}`} className="transition-colors group" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", opacity: c.active ? 1 : 0.6 }}>
                        <td className="px-5 py-3.5">
                          <p className="font-bold uppercase transition-colors">{c.name}</p>
                          {c.description && <p className="text-xs mt-1 max-w-md leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{c.description}</p>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {c.responsibleAreaName ? (
                              <span className="rounded-lg px-2.5 py-1 font-bold text-[11px] uppercase inline-flex items-center gap-1.5" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                                <Building2 size={12} /> {c.responsibleAreaName}
                              </span>
                            ) : (
                              <span style={{ color: "var(--muted-foreground)" }}>—</span>
                            )}
                            <button
                              type="button"
                              data-testid={`button-duplicate-criterion-${c.id}`}
                              onClick={() => {
                                setDuplicateSourceId(c.id);
                                const suggestedArea = c.name.trim().toLowerCase() === "qualidade da entrega"
                                  ? (areas ?? []).find(a => a.name.trim().toLowerCase() === "ativação" && a.id !== c.responsibleAreaId)
                                  : undefined;
                                setDuplicateAreaId(suggestedArea ? String(suggestedArea.id) : "");
                              }}
                              title="Duplicar este critério para outra área"
                              className="p-1 transition-colors shrink-0 hover:opacity-70"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <CriterionWeightCell
                            criterionId={c.id}
                            weight={Number(c.defaultWeight)}
                            isSaving={updateMutation.isPending}
                            onSave={(value) => updateMutation.mutate({ id: c.id, data: { defaultWeight: value } })}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <EvaluatorPickerCell
                              criterionId={c.id}
                              currentRouting={routing}
                              evaluators={pickerEvaluators}
                              onSaved={() => qc.invalidateQueries()}
                            />
                            <button
                              type="button"
                              onClick={() => setRoutingDialogId(c.id)}
                              title="Configurar roteamento e redirecionamento"
                              className="p-1 transition-colors shrink-0 hover:opacity-70"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              <Settings2 size={13} />
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase" style={{ color: c.active ? GOOD : "var(--muted-foreground)" }}>
                                {c.active ? 'Ativo' : 'Inativo'}
                              </span>
                              <Switch
                                data-testid={`switch-criterion-${c.id}`}
                                checked={c.active}
                                onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { active: v } })}
                              />
                            </div>
                            {eventCount > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                                <Calendar size={10} /> {eventCount} evento{eventCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        )}

        {/* Avaliador Padrão da Matriz de Conformidade */}
        <PremiumCard className="overflow-hidden">
          <div className="px-5 py-4" style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
            <h2 className="text-lg font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Avaliador Padrão — Matriz de Conformidade</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>Ao liberar as avaliações de um evento, estes dois avaliadores já vêm preenchidos na matriz — troque no evento só se precisar.</p>
          </div>
          {(() => {
            const conformityAreas = (areas ?? [])
              .filter(a => {
                const n = a.name.trim().toLowerCase();
                return n.includes("cenografia") || n.includes("ferramentas");
              })
              .map(a => ({
                ...a,
                description: a.name.trim().toLowerCase().includes("ferramentas")
                  ? "1 pergunta: Guarda de Equipamentos"
                  : "3 perguntas (EPI, Estaiamentos, Conduta) + faltas/atrasos e destaque",
              }));
            if (conformityAreas.length === 0) {
              return <div className="py-8 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Áreas "Cenografia" e "Ferramentas e Case" não encontradas.</div>;
            }
            return (
              <ul>
                {conformityAreas.map((a, i) => {
                  const routing = (conformityRoutings ?? []).find(r => r.areaId === a.id);
                  return (
                    <li key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-2 font-bold uppercase text-sm">
                          <Building2 size={14} style={{ color: "var(--muted-foreground)" }} /> {a.name}
                        </span>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{a.description}</p>
                      </div>
                      <ConformityAreaEvaluatorPicker
                        areaId={a.id}
                        currentEvaluatorId={routing?.defaultEvaluatorId ?? null}
                        currentEvaluatorName={routing?.defaultEvaluatorName ?? null}
                        evaluators={evaluators}
                      />
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </PremiumCard>
      </div>

      {/* Create Criterion Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Novo Critério de Avaliação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, defaultWeight: Number(d.defaultWeight) } }))} className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome <span style={{ color: WARNING }}>*</span></Label>
              <Input data-testid="input-criterion-name" {...register("name", { required: true })} placeholder="Ex: Pontualidade" className="h-11 rounded-lg" style={fieldStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Descrição do que é avaliado</Label>
              <Input data-testid="input-criterion-desc" {...register("description")} placeholder="Instruções para o avaliador..." className="h-11 rounded-lg" style={fieldStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Peso Padrão</Label>
              <Input data-testid="input-criterion-weight" type="number" min="0" step="1" {...register("defaultWeight", { valueAsNumber: true })} className="h-11 rounded-lg" style={fieldStyle} />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área Responsável (Opcional)</Label>
              <Select onValueChange={v => setValue("responsibleAreaId", Number(v))}>
                <SelectTrigger data-testid="select-criterion-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(areas ?? []).map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
              <button
                data-testid="button-submit-criterion"
                type="submit"
                disabled={createMutation.isPending}
                className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {createMutation.isPending ? "Criando..." : "Criar Critério"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Routing config dialog */}
      <Dialog open={routingDialogId !== null} onOpenChange={(v) => { if (!v) setRoutingDialogId(null); }}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <Route size={18} /> Roteamento — {routingCriterion?.name}
            </DialogTitle>
          </DialogHeader>
          {routingDialogId !== null && routingCriterion && (
            <RoutingConfigDialog
              criterionId={routingDialogId}
              criterionName={routingCriterion.name}
              currentRouting={routingMap.get(routingDialogId)}
              areas={areas ?? []}
              evaluators={(() => {
                const areaFiltered = routingCriterion.responsibleAreaId != null
                  ? evaluators.filter(u => (u.areaId ?? null) === routingCriterion.responsibleAreaId)
                  : [];
                return areaFiltered.length > 0 ? areaFiltered : evaluators;
              })()}
              onClose={() => setRoutingDialogId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate criterion dialog */}
      <Dialog open={duplicateSourceId !== null} onOpenChange={(v) => { if (!v) { setDuplicateSourceId(null); setDuplicateAreaId(""); } }}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <Copy size={18} /> Duplicar Critério
            </DialogTitle>
          </DialogHeader>
          {duplicateSource && (
            <div className="space-y-5 pt-2">
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Cria uma cópia de <span className="font-bold" style={{ color: "var(--foreground)" }}>"{duplicateSource.name}"</span> (mesma descrição e peso) vinculada a outra área. Útil quando mais de uma área avalia o mesmo quesito e a nota final é a média entre elas.
              </p>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nova Área Responsável <span style={{ color: WARNING }}>*</span></Label>
                <Select value={duplicateAreaId} onValueChange={setDuplicateAreaId}>
                  <SelectTrigger data-testid="select-duplicate-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                    <SelectValue placeholder="Selecione a área..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(areas ?? [])
                      .filter(a => a.id !== duplicateSource.responsibleAreaId)
                      .map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <button type="button" onClick={() => { setDuplicateSourceId(null); setDuplicateAreaId(""); }} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                <button
                  type="button"
                  data-testid="button-confirm-duplicate"
                  disabled={!duplicateAreaId || duplicateMutation.isPending}
                  onClick={handleDuplicate}
                  className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {duplicateMutation.isPending ? "Duplicando..." : "Duplicar Critério"}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resync summary dialog */}
      <Dialog open={resyncSummary != null} onOpenChange={(v) => { if (!v) setResyncSummary(null); }}>
        <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Sincronização em Massa</DialogTitle>
          </DialogHeader>
          {resyncSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { val: resyncSummary.processed, label: "Atualizados" },
                  { val: resyncSummary.totalAdded, label: "Adicionados" },
                  { val: resyncSummary.totalActivated, label: "Reativados" },
                  { val: resyncSummary.totalDeactivated, label: "Desativados" },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "var(--secondary)" }}>
                    <p className="text-2xl font-black" style={{ fontFamily: CONDENSED }}>{s.val}</p>
                    <p className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {resyncSummary.skipped > 0 && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {resyncSummary.skipped} evento(s) pulado(s) por erro interno.
                </p>
              )}
              {resyncSummary.processed === 0 && resyncSummary.skipped === 0 && (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Todos os eventos já estavam sincronizados com o catálogo ativo.
                </p>
              )}
              {resyncSummary.events.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
                  {resyncSummary.events.map((ev, i) => (
                    <div key={ev.id} className="px-4 py-2 flex items-center justify-between gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                      <span className="font-bold uppercase text-xs truncate">{ev.name}</span>
                      <span className="text-[10px] font-bold uppercase whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                        +{ev.added} novo(s){ev.activated > 0 ? ` ↺${ev.activated} reativado(s)` : ""}{ev.deactivated > 0 ? ` -${ev.deactivated}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setResyncSummary(null)}
              className="h-10 px-5 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
