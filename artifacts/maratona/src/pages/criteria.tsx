import { useState } from "react";
import { useGetCriteria, useCreateCriterion, useUpdateCriterion, useGetAreas, useResyncAllEventsCriteria, useGetUsers, getGetCriteriaQueryKey } from "@workspace/api-client-react";
import type { CriterionInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Building2, Zap, Pencil, Check, X, RefreshCw, Route, UserCheck, ChevronDown, ChevronUp, Users, AlertCircle, Settings2 } from "lucide-react";
import { useAllCriterionRoutings, useSaveCriterionRouting } from "@/lib/routing-api";
import type { CriterionRouting } from "@/lib/routing-api";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

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
        className="bg-[#eceef0] border-2 border-[#191c1e] px-3 py-1.5 inline-flex items-center gap-2 min-w-[48px] hover:bg-[#e0e3e5] transition-colors group/weight"
      >
        <span className="text-lg font-black italic">{weight.toFixed(0)}</span>
        <Pencil size={11} className="text-[#747a60] opacity-0 group-hover/weight:opacity-100 transition-opacity" />
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
        className="h-9 w-20 rounded-none border-2 border-[#191c1e] text-center font-black italic"
      />
      <button type="button" data-testid={`button-save-weight-${criterionId}`} onClick={submit} className="p-1.5 border-2 border-[#191c1e] bg-[#ccff00] hover:translate-y-[1px] transition-all">
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setEditing(false)} className="p-1.5 border-2 border-[#191c1e] bg-white hover:bg-[#eceef0] transition-colors">
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
        <button
          type="button"
          className="flex items-center gap-1.5 group/ev text-left"
          title="Clique para definir o avaliador padrão"
        >
          {current ? (
            <span className="flex items-center gap-1.5 text-sm font-bold italic text-[#191c1e] group-hover/ev:text-[#506600] transition-colors">
              <UserCheck size={13} className="text-[#506600] shrink-0" />
              {current}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#e55050] group-hover/ev:text-[#c03030] transition-colors">
              <AlertCircle size={12} /> Sem avaliador
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e]"
        align="start"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-2 border-b-2 border-[#191c1e] bg-[#f7f9fb]">
          <p className="text-[10px] font-black uppercase italic tracking-wider text-[#444933] mb-1.5">Avaliador Padrão</p>
          <Input
            placeholder="Buscar avaliador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs rounded-none border-2 border-[#191c1e] focus-visible:ring-0"
            autoFocus
          />
        </div>
        <div className="max-h-52 overflow-y-auto">
          {current && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              disabled={saveMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold italic text-[#e55050] hover:bg-[#fff0f0] border-b border-[#eceef0] transition-colors"
            >
              <X size={11} /> Remover avaliador
            </button>
          )}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-[#747a60] italic py-4">Nenhum encontrado</p>
          )}
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u.id)}
              disabled={saveMutation.isPending}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold italic text-left hover:bg-[#f0f5e0] transition-colors border-b border-[#eceef0] last:border-b-0 ${u.id === currentRouting?.defaultEvaluatorId ? "bg-[#f0f5e0] text-[#506600]" : "text-[#191c1e]"}`}
            >
              {u.id === currentRouting?.defaultEvaluatorId && <Check size={11} className="shrink-0 text-[#506600]" />}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {saveMutation.isPending && (
          <div className="p-2 border-t-2 border-[#191c1e] bg-[#f7f9fb] text-center text-[10px] font-bold italic text-[#747a60]">
            Salvando...
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ConformityEvaluatorPickerCell({
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
      conformityEvaluatorId: userId,
      defaultEvaluatorId: currentRouting?.defaultEvaluatorId ?? null,
      commentRequired: currentRouting?.commentRequired ?? true,
      redirectMode: currentRouting?.redirectMode ?? "none",
      redirectAreaId: currentRouting?.redirectAreaId ?? null,
      redirectUserIds: currentRouting?.redirectUsers?.map(u => u.id) ?? [],
    }, {
      onSuccess: () => { setOpen(false); setSearch(""); onSaved(); },
    });
  };

  const filtered = evaluators.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const current = currentRouting?.conformityEvaluatorName ?? null;

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 group/ev text-left"
          title="Clique para definir o avaliador da Matriz de Conformidade"
        >
          {current ? (
            <span className="flex items-center gap-1.5 text-sm font-bold italic text-[#191c1e] group-hover/ev:text-[#506600] transition-colors">
              <UserCheck size={13} className="text-[#506600] shrink-0" />
              {current}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#9aa088] group-hover/ev:text-[#747a60] transition-colors">
              <AlertCircle size={12} /> Sem avaliador
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e]"
        align="start"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-2 border-b-2 border-[#191c1e] bg-[#f0f5e0]">
          <p className="text-[10px] font-black uppercase italic tracking-wider text-[#506600] mb-1.5">Av. Matriz de Conformidade</p>
          <Input
            placeholder="Buscar avaliador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs rounded-none border-2 border-[#191c1e] focus-visible:ring-0"
            autoFocus
          />
        </div>
        <div className="max-h-52 overflow-y-auto">
          {current && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              disabled={saveMutation.isPending}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold italic text-[#e55050] hover:bg-[#fff0f0] border-b border-[#eceef0] transition-colors"
            >
              <X size={11} /> Remover avaliador
            </button>
          )}
          {filtered.length === 0 && (
            <p className="text-center text-xs text-[#747a60] italic py-4">Nenhum encontrado</p>
          )}
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u.id)}
              disabled={saveMutation.isPending}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold italic text-left hover:bg-[#f0f5e0] transition-colors border-b border-[#eceef0] last:border-b-0 ${u.id === currentRouting?.conformityEvaluatorId ? "bg-[#f0f5e0] text-[#506600]" : "text-[#191c1e]"}`}
            >
              {u.id === currentRouting?.conformityEvaluatorId && <Check size={11} className="shrink-0 text-[#506600]" />}
              <span>{u.name}</span>
            </button>
          ))}
        </div>
        {saveMutation.isPending && (
          <div className="p-2 border-t-2 border-[#191c1e] bg-[#f7f9fb] text-center text-[10px] font-bold italic text-[#747a60]">
            Salvando...
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function RoutingConfigDialog({
  criterionId, criterionName, currentRouting, areas, evaluators, onClose,
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

  const redirectCount = selectedRedirectUsers.size;

  const handleSave = () => {
    saveMutation.mutate({
      defaultEvaluatorId,
      redirectMode,
      redirectAreaId: redirectMode === "area" ? redirectAreaId : null,
      redirectUserIds: redirectMode === "specific" ? Array.from(selectedRedirectUsers) : undefined,
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
          <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Avaliador Principal</Label>
          <span className="bg-[#ccff00] border border-[#506600] px-1.5 py-0.5 text-[9px] font-black uppercase italic tracking-wider text-[#191c1e]">Obrigatório</span>
        </div>
        <p className="text-[11px] text-[#747a60] italic">Responsável padrão por este critério. Pré-selecionado ao gerar atribuições para um evento.</p>
        <Select
          value={defaultEvaluatorId != null ? String(defaultEvaluatorId) : "__none"}
          onValueChange={v => setDefaultEvaluatorId(v === "__none" ? null : parseInt(v))}
        >
          <SelectTrigger className={`h-11 rounded-none border-2 font-bold italic uppercase text-xs focus:ring-0 ${defaultEvaluatorId == null ? "border-[#e55050] bg-[#fff5f5]" : "border-[#191c1e]"}`}>
            <SelectValue placeholder="Selecione o avaliador principal..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— Sem avaliador principal</SelectItem>
            {evaluators.map(u => (
              <SelectItem key={u.id} value={String(u.id)}>
                <span className="flex items-center gap-2"><UserCheck size={13} className="text-[#506600]" />{u.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {defaultEvaluatorId == null && (
          <p className="flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#e55050]">
            <AlertCircle size={12} /> Sem avaliador principal definido
          </p>
        )}
      </div>

      {/* Redirecionamento */}
      <div className="space-y-2 border-t-2 border-[#eceef0] pt-4">
        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Pode Redirecionar Para</Label>
        <p className="text-[11px] text-[#747a60] italic">Quando o principal não puder avaliar, para onde pode redirecionar?</p>
        <Select value={redirectMode} onValueChange={v => { setRedirectMode(v as "none" | "area" | "specific"); setRedirectCollapsed(true); }}>
          <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
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
          <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Área de Redirecionamento</Label>
          <Select
            value={redirectAreaId != null ? String(redirectAreaId) : "__none"}
            onValueChange={v => setRedirectAreaId(v === "__none" ? null : parseInt(v))}
          >
            <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
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
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setRedirectCollapsed(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#f2f4f6] border-2 border-[#191c1e] hover:bg-[#eceef0] transition-colors"
          >
            <span className="flex items-center gap-2 font-bold italic uppercase text-xs text-[#444933]">
              <Users size={13} />
              {redirectCount === 0
                ? "Nenhum avaliador de backup selecionado"
                : `${redirectCount} avaliador${redirectCount > 1 ? "es" : ""} de backup selecionado${redirectCount > 1 ? "s" : ""}`}
            </span>
            {redirectCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>

          {!redirectCollapsed && (
            <div className="border-2 border-[#191c1e] border-t-0">
              {/* Search */}
              <div className="px-3 py-2 border-b-2 border-[#eceef0] bg-white">
                <Input
                  placeholder="Buscar avaliador..."
                  value={redirectSearch}
                  onChange={e => setRedirectSearch(e.target.value)}
                  className="h-8 rounded-none border-[#c4c9ac] text-sm focus-visible:ring-0"
                />
              </div>
              {/* List */}
              <div className="max-h-44 overflow-y-auto divide-y-2 divide-[#eceef0]">
                {filteredRedirectEvaluators.length === 0 ? (
                  <p className="px-4 py-3 text-xs italic text-[#747a60]">Nenhum resultado para "{redirectSearch}"</p>
                ) : filteredRedirectEvaluators.map(u => (
                  <label key={u.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${selectedRedirectUsers.has(u.id) ? "bg-[#f5ffe0]" : "hover:bg-[#f2f4f6]"}`}>
                    <input
                      type="checkbox"
                      checked={selectedRedirectUsers.has(u.id)}
                      onChange={() => toggleRedirectUser(u.id)}
                      className="h-4 w-4 accent-[#506600]"
                    />
                    <span className="text-sm font-bold italic uppercase">{u.name}</span>
                    {u.id === defaultEvaluatorId && (
                      <span className="ml-auto text-[9px] font-black uppercase italic bg-[#ccff00] px-1.5 py-0.5 border border-[#506600] text-[#191c1e]">Principal</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
        <button type="button" onClick={onClose} className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors">
          Cancelar
        </button>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={handleSave}
          className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs disabled:opacity-50"
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

  const qKey = getGetCriteriaQueryKey();
  const { data: criteria, isLoading } = useGetCriteria({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: usersList } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });
  const { data: routings } = useAllCriterionRoutings();

  const evaluators = (usersList ?? []).filter(u => u.role === "avaliador" && u.active);
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
  const totalWeight = activeCriteria.reduce((s, c) => s + Number(c.defaultWeight), 0);
  const displayedCriteria = showInactive ? (criteria ?? []) : activeCriteria;

  const routingCriterion = routingDialogId != null ? (criteria ?? []).find(c => c.id === routingDialogId) : null;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <span className="bg-[#ccff00] text-[#161e00] font-bold text-[11px] italic uppercase tracking-wider px-3 py-1 border-2 border-[#191c1e] mb-4 inline-block skew-x-[-8deg]">
              <span className="inline-block skew-x-[8deg]">Configuração de Performance</span>
            </span>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
              Critérios de Avaliação
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2">Configure os quesitos de avaliação, seus respectivos pesos e roteamento de avaliadores.</p>
          </div>

        </section>

        {/* Actions */}
        <section className="flex justify-end gap-3 flex-wrap">
          <button
            type="button"
            disabled={syncLabelsRunning}
            onClick={runSyncAreaLabels}
            className={`bg-[#e0f0ff] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          >
            <Building2 size={16} className={syncLabelsRunning ? "animate-pulse" : ""} />
            {syncLabelsRunning ? "Sincronizando..." : syncLabelsResult != null ? `✓ ${syncLabelsResult} área(s) sync` : "Sincronizar Rótulos de Área"}
          </button>
          <button
            type="button"
            disabled={fixCalibRunning || fixCalibResult != null}
            onClick={runFixCalibrationCriteria}
            className={`bg-[#fff3cd] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          >
            <Zap size={16} className={fixCalibRunning ? "animate-pulse" : ""} />
            {fixCalibRunning ? "Corrigindo..." : fixCalibResult != null ? `✓ ${fixCalibResult.totalUpdated} corrigidas` : "Corrigir Calibrações (prod)"}
          </button>
          <button
            type="button"
            data-testid="button-resync-all-events"
            disabled={resyncAllMutation.isPending}
            onClick={() => resyncAllMutation.mutate()}
            className={`bg-white border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
          >
            <RefreshCw size={16} className={resyncAllMutation.isPending ? "animate-spin" : ""} />
            {resyncAllMutation.isPending ? "Sincronizando..." : "Sincronizar Todos os Eventos"}
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                data-testid="button-create-criterion"
                className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <Plus size={18} /> Novo Critério
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
              <DialogHeader>
                <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Novo Critério de Avaliação</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, defaultWeight: Number(d.defaultWeight) } }))} className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome <span className="text-[#ba1a1a]">*</span></Label>
                  <Input data-testid="input-criterion-name" {...register("name", { required: true })} placeholder="Ex: Pontualidade" className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Descrição do que é avaliado</Label>
                  <Input data-testid="input-criterion-desc" {...register("description")} placeholder="Instruções para o avaliador..." className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Peso Padrão</Label>
                  <Input data-testid="input-criterion-weight" type="number" min="0" step="1" {...register("defaultWeight", { valueAsNumber: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Área Responsável (Opcional)</Label>
                  <Select onValueChange={v => setValue("responsibleAreaId", Number(v))}>
                    <SelectTrigger data-testid="select-criterion-area" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(areas ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                  <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setOpen(false)}>Cancelar</Button>
                  <button
                    data-testid="button-submit-criterion"
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Critério"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 italic uppercase font-bold text-[#747a60]">Carregando critérios...</div>
        ) : (
          <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
            {/* Filter bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b-2 border-[#eceef0] bg-[#f9fafb]">
              <span className="text-xs font-bold italic uppercase text-[#747a60]">
                Exibindo {displayedCriteria.length} de {(criteria ?? []).length} critério{(criteria ?? []).length !== 1 ? "s" : ""}
              </span>
              {inactiveCriteria.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowInactive(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 border-2 text-[11px] font-bold italic uppercase transition-colors ${
                    showInactive
                      ? "border-[#191c1e] bg-[#191c1e] text-white"
                      : "border-[#191c1e] bg-white text-[#747a60] hover:bg-[#f2f4f6]"
                  }`}
                >
                  {showInactive ? "Ocultar Inativos" : `Mostrar Inativos (${inactiveCriteria.length})`}
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#191c1e] text-[#ccff00]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Critério & Descrição</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Área</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-center">Peso</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Avaliador Padrão</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Av. Conformidade</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {displayedCriteria.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(c => {
                    const routing = routingMap.get(c.id);
                    const areaEvaluators = c.responsibleAreaId != null
                      ? evaluators.filter(u => (u as { areaId?: number | null }).areaId === c.responsibleAreaId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                      : evaluators.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
                    return (
                      <tr key={c.id} data-testid={`row-criterion-${c.id}`} className={`hover:bg-[#f2f4f6] transition-all group ${!c.active ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-bold italic uppercase text-[#191c1e] group-hover:text-[#506600] transition-colors">{c.name}</p>
                          {c.description && <p className="text-xs text-[#747a60] mt-1 max-w-md leading-relaxed">{c.description}</p>}
                        </td>
                        <td className="px-6 py-4">
                          {c.responsibleAreaName ? (
                            <span className="bg-[#eceef0] text-[#444933] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 skew-x-[8deg]"><Building2 size={12} /> {c.responsibleAreaName}</span>
                            </span>
                          ) : (
                            <span className="text-[#c4c9ac]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <CriterionWeightCell
                            criterionId={c.id}
                            weight={Number(c.defaultWeight)}
                            isSaving={updateMutation.isPending}
                            onSave={(value) => updateMutation.mutate({ id: c.id, data: { defaultWeight: value } })}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <EvaluatorPickerCell
                              criterionId={c.id}
                              currentRouting={routing}
                              evaluators={areaEvaluators}
                              onSaved={() => qc.invalidateQueries()}
                            />
                            <button
                              type="button"
                              onClick={() => setRoutingDialogId(c.id)}
                              title="Configurar roteamento e redirecionamento"
                              className="p-1 text-[#747a60] hover:text-[#191c1e] transition-colors shrink-0"
                            >
                              <Settings2 size={13} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <ConformityEvaluatorPickerCell
                            criterionId={c.id}
                            currentRouting={routing}
                            evaluators={areaEvaluators}
                            onSaved={() => qc.invalidateQueries()}
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className={`text-xs font-bold uppercase italic ${c.active ? 'text-[#506600]' : 'text-[#747a60]'}`}>
                              {c.active ? 'Ativo' : 'Inativo'}
                            </span>
                            <Switch
                              data-testid={`switch-criterion-${c.id}`}
                              checked={c.active}
                              onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { active: v } })}
                              className="data-[state=checked]:bg-[#506600]"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(!criteria || criteria.length === 0) && (
                    <tr><td colSpan={6} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum critério configurado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Routing config dialog */}
      <Dialog open={routingDialogId !== null} onOpenChange={(v) => { if (!v) setRoutingDialogId(null); }}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-xl italic uppercase font-black tracking-tight flex items-center gap-2">
              <Route size={18} /> Roteamento — {routingCriterion?.name}
            </DialogTitle>
          </DialogHeader>
          {routingDialogId !== null && routingCriterion && (
            <RoutingConfigDialog
              criterionId={routingDialogId}
              criterionName={routingCriterion.name}
              currentRouting={routingMap.get(routingDialogId)}
              areas={areas ?? []}
              evaluators={routingCriterion.responsibleAreaId != null
                ? evaluators.filter(u => (u as { areaId?: number | null }).areaId === routingCriterion.responsibleAreaId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                : evaluators.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))}
              onClose={() => setRoutingDialogId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Resync summary dialog */}
      <Dialog open={resyncSummary != null} onOpenChange={(v) => { if (!v) setResyncSummary(null); }}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Sincronização em Massa</DialogTitle>
          </DialogHeader>
          {resyncSummary && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic">{resyncSummary.processed}</p>
                  <p className="text-[10px] font-bold uppercase italic text-[#747a60]">Atualizados</p>
                </div>
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic">{resyncSummary.totalAdded}</p>
                  <p className="text-[10px] font-bold uppercase italic text-[#747a60]">Adicionados</p>
                </div>
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic">{resyncSummary.totalActivated}</p>
                  <p className="text-[10px] font-bold uppercase italic text-[#747a60]">Reativados</p>
                </div>
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic">{resyncSummary.totalDeactivated}</p>
                  <p className="text-[10px] font-bold uppercase italic text-[#747a60]">Desativados</p>
                </div>
              </div>
              {resyncSummary.skipped > 0 && (
                <p className="text-xs text-[#747a60] italic">
                  {resyncSummary.skipped} evento(s) pulado(s) por erro interno.
                </p>
              )}
              {resyncSummary.processed === 0 && resyncSummary.skipped === 0 && (
                <p className="text-xs text-[#747a60] italic">
                  Todos os eventos já estavam sincronizados com o catálogo ativo.
                </p>
              )}
              {resyncSummary.events.length > 0 && (
                <div className="max-h-64 overflow-y-auto border-2 border-[#191c1e] divide-y-2 divide-[#eceef0]">
                  {resyncSummary.events.map(ev => (
                    <div key={ev.id} className="px-4 py-2 flex items-center justify-between gap-3">
                      <span className="font-bold italic uppercase text-xs text-[#191c1e] truncate">{ev.name}</span>
                      <span className="text-[10px] font-bold uppercase italic text-[#747a60] whitespace-nowrap">
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
              className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
