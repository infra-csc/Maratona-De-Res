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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Building2, Zap, Pencil, Check, X, RefreshCw, Route, UserCheck } from "lucide-react";
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

  const toggleRedirectUser = (userId: number) => {
    setSelectedRedirectUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

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
      <div className="space-y-2">
        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Avaliador Padrão</Label>
        <p className="text-[11px] text-[#747a60] italic">Avaliador pré-selecionado quando atribuições forem geradas para este critério.</p>
        <Select
          value={defaultEvaluatorId != null ? String(defaultEvaluatorId) : "__none"}
          onValueChange={v => setDefaultEvaluatorId(v === "__none" ? null : parseInt(v))}
        >
          <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
            <SelectValue placeholder="Selecione o avaliador padrão..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">— Sem padrão</SelectItem>
            {evaluators.map(u => (
              <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Modo de Redirecionamento</Label>
        <p className="text-[11px] text-[#747a60] italic">Quando o avaliador atribuído não pode avaliar, para onde pode redirecionar?</p>
        <Select value={redirectMode} onValueChange={v => setRedirectMode(v as "none" | "area" | "specific")}>
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
          <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Usuários Permitidos para Redirect</Label>
          <div className="border-2 border-[#191c1e] max-h-48 overflow-y-auto divide-y-2 divide-[#eceef0]">
            {evaluators.map(u => (
              <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f2f4f6] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedRedirectUsers.has(u.id)}
                  onChange={() => toggleRedirectUser(u.id)}
                  className="h-4 w-4 accent-[#191c1e]"
                />
                <span className="text-sm font-bold italic uppercase">{u.name}</span>
              </label>
            ))}
          </div>
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
  const totalWeight = activeCriteria.reduce((s, c) => s + Number(c.defaultWeight), 0);

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

          {/* Metric Card: Soma dos Pesos */}
          <div className={`bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden skew-x-[-3deg] min-w-[260px] ${HARD_SHADOW}`}>
            <div className="absolute top-0 right-0 p-1 bg-[#191c1e] text-[#ccff00]">
              <Zap size={16} />
            </div>
            <div className="skew-x-[3deg]">
              <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933] mb-1 flex items-center gap-1.5">
                Soma dos Pesos Ativos
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] leading-none italic font-black">{totalWeight}</span>
                <span className="text-2xl italic font-bold text-[#747a60]">pts</span>
              </div>
              <p className="text-[10px] font-bold uppercase italic mt-2 text-[#747a60]">
                Vira o alvo de peso dos próximos eventos criados
              </p>
            </div>
          </div>
        </section>

        {/* Actions */}
        <section className="flex justify-end gap-3">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#191c1e] text-[#ccff00]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Critério & Descrição</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Área</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-center">Peso</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Avaliador Padrão</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {(criteria ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(c => {
                    const routing = routingMap.get(c.id);
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
                          <button
                            type="button"
                            onClick={() => setRoutingDialogId(c.id)}
                            className="flex items-center gap-2 group/routing"
                            title="Configurar roteamento de avaliador"
                          >
                            {routing?.defaultEvaluatorName ? (
                              <span className="flex items-center gap-1.5 text-sm font-bold italic text-[#191c1e] group-hover/routing:text-[#506600] transition-colors">
                                <UserCheck size={13} className="text-[#506600]" />
                                {routing.defaultEvaluatorName}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[11px] font-bold italic uppercase text-[#c4c9ac] group-hover/routing:text-[#506600] transition-colors">
                                <Route size={12} /> Configurar
                              </span>
                            )}
                          </button>
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
                    <tr><td colSpan={5} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum critério configurado.</td></tr>
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
              evaluators={evaluators}
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
