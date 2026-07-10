import { useState } from "react";
import {
  useGetPenaltyTypes, useCreatePenaltyType, useUpdatePenaltyType, useDeletePenaltyType,
  useSeedDefaultPenaltyTypes,
  getGetPenaltyTypesQueryKey,
} from "@workspace/api-client-react";
import type { PenaltyType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, Pencil, AlertTriangle, Award, Settings2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

interface TypeFormData {
  slug: string;
  label: string;
  points: number;
  kind: "penalty" | "merit";
  requiresEvent: boolean;
  active: boolean;
  displayOrder: number;
}

type ApplyScope = "future" | "cycle";

export default function PenaltyTypesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editingType, setEditingType] = useState<PenaltyType | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [applyScope, setApplyScope] = useState<ApplyScope>("future");

  const qKey = getGetPenaltyTypesQueryKey();
  const { data: types, isLoading } = useGetPenaltyTypes({ query: { queryKey: qKey } });

  const { register, handleSubmit, reset, setValue, watch } = useForm<TypeFormData>({
    defaultValues: { slug: "", label: "", points: 10, kind: "penalty", requiresEvent: false, active: true, displayOrder: 0 },
  });

  const watchedKind = watch("kind");
  const watchedRequiresEvent = watch("requiresEvent");
  const watchedActive = watch("active");

  const createMutation = useCreatePenaltyType({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast({ title: "Tipo criado com sucesso" }); setOpen(false); },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdatePenaltyType({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        const retro = (data as PenaltyType & { retroactiveUpdated?: number }).retroactiveUpdated ?? 0;
        toast({
          title: "Tipo atualizado",
          description: retro > 0
            ? `${retro} lançamento(s) já registrados neste ciclo foram atualizados com o novo valor. Os resultados foram recalculados.`
            : undefined,
        });
        setOpen(false);
        setEditingType(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeletePenaltyType({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); setDeleteTargetId(null); toast({ title: "Tipo removido" }); },
      onError: () => toast({ title: "Erro ao remover tipo", variant: "destructive" }),
    },
  });

  const seedMutation = useSeedDefaultPenaltyTypes({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        if (data.inserted === 0) {
          toast({ title: "Tipos padrão já existem", description: "Nenhum tipo novo foi inserido." });
        } else {
          toast({ title: `${data.inserted} tipo(s) padrão restaurado(s) com sucesso` });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao restaurar padrões", description: e.message, variant: "destructive" }),
    },
  });

  const canEdit = user && ["admin", "rh"].includes(user.role);
  const isAdmin = user?.role === "admin";

  function openCreate() {
    setEditingType(null);
    reset({ slug: "", label: "", points: 10, kind: "penalty", requiresEvent: false, active: true, displayOrder: (types?.length ?? 0) + 1 });
    setOpen(true);
  }

  function openEdit(t: PenaltyType) {
    setEditingType(t);
    setApplyScope("future");
    reset({
      slug: t.slug,
      label: t.label,
      points: t.points,
      kind: t.kind as "penalty" | "merit",
      requiresEvent: t.requiresEvent,
      active: t.active,
      displayOrder: t.displayOrder,
    });
    setOpen(true);
  }

  function onSubmit(d: TypeFormData) {
    const pointsChanged = !!editingType && Number(d.points) !== editingType.points;
    const payload = {
      slug: d.slug.trim().toLowerCase().replace(/\s+/g, "_"),
      label: d.label.trim(),
      points: Number(d.points),
      kind: d.kind,
      requiresEvent: d.requiresEvent,
      active: d.active,
      displayOrder: Number(d.displayOrder),
      ...(pointsChanged ? { applyScope } : {}),
    };
    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: payload });
    } else {
      createMutation.mutate({ data: payload });
    }
  }

  const penaltyTypes = (types ?? []).filter(t => t.kind === "penalty");
  const meritTypes = (types ?? []).filter(t => t.kind === "merit");
  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8">
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 bg-[#191c1e] border-2 border-[#191c1e] flex items-center justify-center shrink-0 ${HARD_SHADOW}`}>
              <Settings2 size={32} className="text-[#ccff00]" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
                Tipos de <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Lançamento</span>
              </h1>
              <p className="text-base text-[#444933] italic mt-2">Configure os tipos de penalidade e mérito e seus valores em pontos.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                title="Insere os 6 tipos padrão (falta, atraso, conformidade, rei do galpão, estrela, colega top) que ainda não existem"
                className={`bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <RefreshCw size={14} className={seedMutation.isPending ? "animate-spin" : ""} /> Restaurar Padrões
              </button>
            )}
            {canEdit && (
              <button
                onClick={openCreate}
                className={`bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <Plus size={16} /> Novo Tipo
              </button>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando tipos...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Penalidades */}
            <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                <AlertTriangle size={18} className="text-[#ff5722]" />
                <span className="font-black uppercase tracking-tight">Penalidades (−)</span>
                <span className="ml-auto text-xs text-[#ccff00]/60">{penaltyTypes.length} tipo{penaltyTypes.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y-2 divide-[#eceef0]">
                {penaltyTypes.map(t => (
                  <TypeRow key={t.id} type={t} canEdit={!!canEdit} onEdit={openEdit} onDelete={setDeleteTargetId} />
                ))}
                {penaltyTypes.length === 0 && (
                  <p className="text-center py-10 italic uppercase font-bold text-[#747a60] text-sm">Nenhuma penalidade cadastrada.</p>
                )}
              </div>
            </div>

            {/* Méritos */}
            <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                <Award size={18} className="text-[#ccff00]" />
                <span className="font-black uppercase tracking-tight">Méritos (+)</span>
                <span className="ml-auto text-xs text-[#ccff00]/60">{meritTypes.length} tipo{meritTypes.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="divide-y-2 divide-[#eceef0]">
                {meritTypes.map(t => (
                  <TypeRow key={t.id} type={t} canEdit={!!canEdit} onEdit={openEdit} onDelete={setDeleteTargetId} />
                ))}
                {meritTypes.length === 0 && (
                  <p className="text-center py-10 italic uppercase font-bold text-[#747a60] text-sm">Nenhum mérito cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="bg-[#f0f7e6] border-2 border-[#84cc16] px-6 py-4 text-sm font-bold italic text-[#444933] flex items-start gap-3">
          <Award size={18} className="text-[#84cc16] shrink-0 mt-0.5" />
          <div>
            <strong className="uppercase">Como funciona:</strong> Os tipos cadastrados aqui aparecem automaticamente no modal de "Novo Lançamento". 
            Tipos marcados com <strong>📍 Exige Evento</strong> obrigam a seleção de um evento específico ao registrar. 
            Tipos inativos ficam ocultos no modal mas seus registros históricos são preservados.
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingType(null); }}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2 text-[#191c1e]">
              <Settings2 size={22} /> {editingType ? "Editar Tipo" : "Novo Tipo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome <span className="text-[#ba1a1a]">*</span></Label>
                <Input {...register("label", { required: true })} placeholder="Ex: Atraso Injustificado" className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Slug <span className="text-[#ba1a1a]">*</span></Label>
                <Input
                  {...register("slug", { required: !editingType })}
                  placeholder="ex: atraso"
                  className="h-11 rounded-none border-2 border-[#191c1e] font-mono text-sm"
                  disabled={!!editingType}
                />
                {editingType && <p className="text-[11px] text-[#747a60] italic">Slug não pode ser alterado.</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Pontos <span className="text-[#ba1a1a]">*</span></Label>
                <Input type="number" min="0" {...register("points", { valueAsNumber: true, required: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
              </div>
            </div>

            {editingType && Number(watch("points")) !== editingType.points && (
              <div className="space-y-2 border-2 border-[#191c1e] bg-[#fff8e1] px-4 py-3">
                <p className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Aplicar mudança de pontos a partir de:</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setApplyScope("future")}
                    className={cn(
                      "w-full text-left px-3 py-2 border-2 border-[#191c1e] flex items-start gap-2",
                      applyScope === "future" ? "bg-[#191c1e] text-[#ccff00]" : "bg-white hover:bg-[#eceef0]",
                    )}
                  >
                    <span className={cn("mt-0.5 h-3 w-3 rounded-full border-2 shrink-0", applyScope === "future" ? "bg-[#ccff00] border-[#ccff00]" : "border-[#191c1e]")} />
                    <span>
                      <span className="block font-black italic uppercase text-xs">Só a partir de agora</span>
                      <span className="block text-[11px] italic opacity-80">Lançamentos já feitos neste ciclo mantêm o valor antigo. Só os novos usam o valor atualizado.</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyScope("cycle")}
                    className={cn(
                      "w-full text-left px-3 py-2 border-2 border-[#191c1e] flex items-start gap-2",
                      applyScope === "cycle" ? "bg-[#191c1e] text-[#ccff00]" : "bg-white hover:bg-[#eceef0]",
                    )}
                  >
                    <span className={cn("mt-0.5 h-3 w-3 rounded-full border-2 shrink-0", applyScope === "cycle" ? "bg-[#ccff00] border-[#ccff00]" : "border-[#191c1e]")} />
                    <span>
                      <span className="block font-black italic uppercase text-xs">Todo o ciclo atual</span>
                      <span className="block text-[11px] italic opacity-80">Atualiza também os lançamentos já registrados deste tipo no ciclo em andamento, e recalcula os resultados.</span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Tipo <span className="text-[#ba1a1a]">*</span></Label>
              <Select value={watchedKind} onValueChange={v => setValue("kind", v as "penalty" | "merit")} disabled={!!editingType}>
                <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="penalty">Penalidade (−)</SelectItem>
                  <SelectItem value="merit">Mérito (+)</SelectItem>
                </SelectContent>
              </Select>
              {editingType && <p className="text-[11px] text-[#747a60] italic">Tipo não pode ser alterado.</p>}
            </div>

            <div className="flex items-center justify-between py-2 border-t border-[#eceef0]">
              <div>
                <p className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">📍 Exige evento vinculado</p>
                <p className="text-[11px] text-[#747a60] italic">Obriga seleção de evento ao lançar.</p>
              </div>
              <Switch
                checked={watchedRequiresEvent}
                onCheckedChange={v => setValue("requiresEvent", v)}
              />
            </div>

            <div className="flex items-center justify-between py-2 border-t border-[#eceef0]">
              <div>
                <p className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Ativo</p>
                <p className="text-[11px] text-[#747a60] italic">Aparece no modal de novo lançamento.</p>
              </div>
              <Switch
                checked={watchedActive}
                onCheckedChange={v => setValue("active", v)}
              />
            </div>

            {/* Preview */}
            <div className={cn(
              "flex items-center justify-between px-4 py-3 border-2 border-[#191c1e] font-black italic uppercase tracking-tight",
              watchedKind === "merit" ? "bg-[#ccff00] text-[#191c1e]" : "bg-[#191c1e] text-[#ccff00]",
            )}>
              <span className="text-xs">Preview:</span>
              <span className="text-xl leading-none">{watchedKind === "merit" ? "+" : "-"}{watch("points") || 0} pts por lançamento</span>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#eceef0]">
              <button
                type="button"
                onClick={() => { setOpen(false); setEditingType(null); }}
                className="border-2 border-[#191c1e] bg-white px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider hover:bg-[#eceef0] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={`bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider ${HARD_SHADOW} ${HARD_SHADOW_HOVER} disabled:opacity-50`}
              >
                {isPending ? "Salvando..." : (editingType ? "Salvar Alterações" : "Criar Tipo")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl italic uppercase font-black text-[#191c1e] flex items-center gap-2">
              <Trash2 size={20} /> Remover tipo
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#444933] font-bold italic">
              O tipo será removido. Registros históricos que usam este tipo <strong>não serão afetados</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate({ id: deleteTargetId })}
              className="rounded-none bg-[#ba1a1a] text-white border-2 border-[#191c1e] font-bold italic uppercase text-xs hover:bg-[#93000a]"
            >
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TypeRow({ type, canEdit, onEdit, onDelete }: {
  type: PenaltyType;
  canEdit: boolean;
  onEdit: (t: PenaltyType) => void;
  onDelete: (id: number) => void;
}) {
  const isMerit = type.kind === "merit";
  return (
    <div className={cn(
      "px-6 py-4 flex items-center gap-4 group transition-colors",
      !type.active && "opacity-50 bg-[#f9fafb]",
      isMerit ? "border-l-4 border-l-[#84cc16]" : "border-l-4 border-l-[#ff5722]",
    )}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black italic uppercase text-sm text-[#191c1e]">{type.label}</span>
          {!type.active && (
            <span className="text-[10px] font-bold uppercase italic border border-[#747a60] text-[#747a60] px-1.5 py-0.5">Inativo</span>
          )}
          {type.requiresEvent && (
            <span className="text-[10px] font-bold uppercase italic text-[#747a60]">📍 Evento</span>
          )}
        </div>
        <div className="text-xs text-[#747a60] font-mono mt-0.5">{type.slug}</div>
      </div>
      <div className={cn(
        "font-black text-lg italic shrink-0",
        isMerit ? "text-[#506600]" : "text-[#ba1a1a]",
      )}>
        {isMerit ? "+" : "-"}{type.points} pts
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#191c1e] hover:bg-[#eceef0] transition-all"
            onClick={() => onEdit(type)}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            className="p-2 border-2 border-transparent text-[#747a60] hover:border-[#191c1e] hover:text-[#ba1a1a] hover:bg-[#ffdad6] transition-all"
            onClick={() => onDelete(type.id)}
            title="Remover"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
