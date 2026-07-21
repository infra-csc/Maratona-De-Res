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
import { CONDENSED, BODY, WARNING } from "@/lib/premium-theme";

const GOOD = "#9ab000";
const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary)" }}>
              <Settings2 size={24} style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>
                Tipos de Lançamento
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>Configure os tipos de penalidade e mérito e seus valores em pontos.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {isAdmin && (
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                title="Insere os 6 tipos padrão (falta, atraso, conformidade, rei do galpão, estrela, colega top) que ainda não existem"
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 disabled:opacity-50 transition-colors hover:opacity-80"
                style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
              >
                <RefreshCw size={14} className={seedMutation.isPending ? "animate-spin" : ""} /> Restaurar Padrões
              </button>
            )}
            {canEdit && (
              <button
                onClick={openCreate}
                className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 transition-opacity hover:opacity-90"
                style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Plus size={16} /> Novo Tipo
              </button>
            )}
          </div>
        </section>

        {isLoading ? (
          <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando tipos...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {/* Penalidades */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <AlertTriangle size={16} style={{ color: WARNING }} />
                <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED }}>Penalidades (−)</span>
                <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>{penaltyTypes.length} tipo{penaltyTypes.length !== 1 ? "s" : ""}</span>
              </div>
              <div>
                {penaltyTypes.map((t, i) => (
                  <TypeRow key={t.id} type={t} canEdit={!!canEdit} onEdit={openEdit} onDelete={setDeleteTargetId} isFirst={i === 0} />
                ))}
                {penaltyTypes.length === 0 && (
                  <p className="text-center py-10 font-bold uppercase text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhuma penalidade cadastrada.</p>
                )}
              </div>
            </div>

            {/* Méritos */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <Award size={16} style={{ color: "var(--accent)" }} />
                <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED }}>Méritos (+)</span>
                <span className="ml-auto text-xs" style={{ color: "var(--muted-foreground)" }}>{meritTypes.length} tipo{meritTypes.length !== 1 ? "s" : ""}</span>
              </div>
              <div>
                {meritTypes.map((t, i) => (
                  <TypeRow key={t.id} type={t} canEdit={!!canEdit} onEdit={openEdit} onDelete={setDeleteTargetId} isFirst={i === 0} />
                ))}
                {meritTypes.length === 0 && (
                  <p className="text-center py-10 font-bold uppercase text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum mérito cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="rounded-xl px-5 py-4 text-sm font-semibold flex items-start gap-3" style={{ backgroundColor: "rgba(154,176,0,0.10)", border: "1px solid rgba(154,176,0,0.3)" }}>
          <Award size={18} className="shrink-0 mt-0.5" style={{ color: GOOD }} />
          <div>
            <strong className="uppercase">Como funciona:</strong> Os tipos cadastrados aqui aparecem automaticamente no modal de "Novo Lançamento".
            Tipos marcados com <strong>📍 Exige Evento</strong> obrigam a seleção de um evento específico ao registrar.
            Tipos inativos ficam ocultos no modal mas seus registros históricos são preservados.
          </div>
        </div>
      </div>

      {/* Create / Edit modal */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditingType(null); }}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <Settings2 size={22} /> {editingType ? "Editar Tipo" : "Novo Tipo"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome <span style={{ color: WARNING }}>*</span></Label>
                <Input {...register("label", { required: true })} placeholder="Ex: Atraso Injustificado" className="h-11 rounded-lg" style={fieldStyle} />
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Slug <span style={{ color: WARNING }}>*</span></Label>
                <Input
                  {...register("slug", { required: !editingType })}
                  placeholder="ex: atraso"
                  className="h-11 rounded-lg font-mono text-sm"
                  style={fieldStyle}
                  disabled={!!editingType}
                />
                {editingType && <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Slug não pode ser alterado.</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Pontos <span style={{ color: WARNING }}>*</span></Label>
                <Input type="number" min="0" {...register("points", { valueAsNumber: true, required: true })} className="h-11 rounded-lg" style={fieldStyle} />
              </div>
            </div>

            {editingType && Number(watch("points")) !== editingType.points && (
              <div className="space-y-2 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(232,162,61,0.10)", border: "1px solid rgba(232,162,61,0.3)" }}>
                <p className="font-bold uppercase text-xs tracking-wider">Aplicar mudança de pontos a partir de:</p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setApplyScope("future")}
                    className="w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-colors"
                    style={applyScope === "future" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
                  >
                    <span className="mt-0.5 h-3 w-3 rounded-full border-2 shrink-0" style={{ backgroundColor: applyScope === "future" ? "var(--primary-foreground)" : "transparent", borderColor: "currentColor" }} />
                    <span>
                      <span className="block font-black uppercase text-xs">Só a partir de agora</span>
                      <span className="block text-[11px] opacity-80">Lançamentos já feitos neste ciclo mantêm o valor antigo. Só os novos usam o valor atualizado.</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplyScope("cycle")}
                    className="w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-colors"
                    style={applyScope === "cycle" ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
                  >
                    <span className="mt-0.5 h-3 w-3 rounded-full border-2 shrink-0" style={{ backgroundColor: applyScope === "cycle" ? "var(--primary-foreground)" : "transparent", borderColor: "currentColor" }} />
                    <span>
                      <span className="block font-black uppercase text-xs">Todo o ciclo atual</span>
                      <span className="block text-[11px] opacity-80">Atualiza também os lançamentos já registrados deste tipo no ciclo em andamento, e recalcula os resultados.</span>
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Tipo <span style={{ color: WARNING }}>*</span></Label>
              <Select value={watchedKind} onValueChange={v => setValue("kind", v as "penalty" | "merit")} disabled={!!editingType}>
                <SelectTrigger className="h-11 rounded-lg" style={fieldStyle}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="penalty">Penalidade (−)</SelectItem>
                  <SelectItem value="merit">Mérito (+)</SelectItem>
                </SelectContent>
              </Select>
              {editingType && <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Tipo não pode ser alterado.</p>}
            </div>

            <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border)" }}>
              <div>
                <p className="font-bold uppercase text-xs tracking-wider">📍 Exige evento vinculado</p>
                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Obriga seleção de evento ao lançar.</p>
              </div>
              <Switch checked={watchedRequiresEvent} onCheckedChange={v => setValue("requiresEvent", v)} />
            </div>

            <div className="flex items-center justify-between py-2" style={{ borderTop: "1px solid var(--border)" }}>
              <div>
                <p className="font-bold uppercase text-xs tracking-wider">Ativo</p>
                <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Aparece no modal de novo lançamento.</p>
              </div>
              <Switch checked={watchedActive} onCheckedChange={v => setValue("active", v)} />
            </div>

            {/* Preview */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-lg font-black uppercase tracking-tight"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              <span className="text-xs">Preview:</span>
              <span className="text-xl leading-none" style={{ fontFamily: CONDENSED }}>{watchedKind === "merit" ? "+" : "-"}{watch("points") || 0} pts por lançamento</span>
            </div>

            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => { setOpen(false); setEditingType(null); }}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {isPending ? "Salvando..." : (editingType ? "Salvar Alterações" : "Criar Tipo")}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTargetId !== null} onOpenChange={v => { if (!v) setDeleteTargetId(null); }}>
        <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <Trash2 size={20} /> Remover tipo
            </AlertDialogTitle>
            <AlertDialogDescription className="font-bold" style={{ color: "var(--muted-foreground)" }}>
              O tipo será removido. Registros históricos que usam este tipo <strong>não serão afetados</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate({ id: deleteTargetId })}
              className="rounded-lg font-bold uppercase text-xs"
              style={{ backgroundColor: WARNING, color: "#fff" }}
            >
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TypeRow({ type, canEdit, onEdit, onDelete, isFirst }: {
  type: PenaltyType;
  canEdit: boolean;
  onEdit: (t: PenaltyType) => void;
  onDelete: (id: number) => void;
  isFirst: boolean;
}) {
  const isMerit = type.kind === "merit";
  return (
    <div
      className="px-5 py-3.5 flex items-center gap-4 group transition-colors relative"
      style={{ opacity: type.active ? 1 : 0.5, borderTop: isFirst ? "none" : "1px solid var(--border)" }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: isMerit ? GOOD : WARNING }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black uppercase text-sm">{type.label}</span>
          {!type.active && (
            <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Inativo</span>
          )}
          {type.requiresEvent && (
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>📍 Evento</span>
          )}
        </div>
        <div className="text-xs font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>{type.slug}</div>
      </div>
      <div className="font-black text-lg shrink-0" style={{ fontFamily: CONDENSED, color: isMerit ? GOOD : WARNING }}>
        {isMerit ? "+" : "-"}{type.points} pts
      </div>
      {canEdit && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--muted-foreground)" }}
            onClick={() => onEdit(type)}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            className="p-2 rounded-lg transition-colors hover:opacity-80"
            style={{ color: WARNING }}
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
