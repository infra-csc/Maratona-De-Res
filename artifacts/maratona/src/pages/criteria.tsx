import { useState } from "react";
import { useGetCriteria, useCreateCriterion, useUpdateCriterion, useGetAreas, getGetCriteriaQueryKey } from "@workspace/api-client-react";
import type { CriterionInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, AlertCircle, Building2, Zap } from "lucide-react";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

export default function CriteriaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const qKey = getGetCriteriaQueryKey();
  const { data: criteria, isLoading } = useGetCriteria({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();

  const { register, handleSubmit, reset, setValue } = useForm<CriterionInput>({
    defaultValues: { defaultWeight: 1, displayOrder: 0 },
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

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const totalWeight = activeCriteria.reduce((s, c) => s + Number(c.defaultWeight), 0);
  const isWeightValid = totalWeight === 20;

  const weightPct = Math.min((totalWeight / 20) * 100, 100);
  let weightMessage: string;
  let weightMessageClass: string;
  if (totalWeight === 20) {
    weightMessage = "META ATINGIDA! PESO IDEAL";
    weightMessageClass = "text-[#506600]";
  } else if (totalWeight > 20) {
    weightMessage = `LIMITE EXCEDIDO (${totalWeight - 20} pts acima)`;
    weightMessageClass = "text-[#ba1a1a]";
  } else {
    weightMessage = `FALTAM ${20 - totalWeight} PONTOS PARA A META`;
    weightMessageClass = "text-[#b02f00]";
  }

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
            <p className="text-base md:text-lg text-[#444933] italic mt-2">Configure os quesitos de avaliação e seus respectivos pesos.</p>
          </div>

          {/* Metric Card: Soma dos Pesos */}
          <div className={`bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden skew-x-[-3deg] min-w-[260px] ${HARD_SHADOW}`}>
            <div className="absolute top-0 right-0 p-1 bg-[#191c1e] text-[#ccff00]">
              <Zap size={16} />
            </div>
            <div className="skew-x-[3deg]">
              <p className="text-xs font-bold uppercase italic tracking-wider text-[#444933] mb-1 flex items-center gap-1.5">
                {!isWeightValid && <AlertCircle size={14} className="text-[#ba1a1a]" />} Soma dos Pesos
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-[40px] leading-none italic font-black">{totalWeight}</span>
                <span className="text-2xl italic font-bold text-[#747a60]">/ 20</span>
              </div>
              <div className="w-full h-3 bg-[#eceef0] border-2 border-[#191c1e] mt-4 overflow-hidden">
                <div
                  className={`h-full transition-[width] duration-500 ${totalWeight > 20 ? "bg-[#ba1a1a]" : "bg-[#ccff00]"}`}
                  style={{ width: `${weightPct}%` }}
                />
              </div>
              <p className={`text-[10px] font-bold uppercase italic mt-2 ${weightMessageClass}`}>{weightMessage}</p>
            </div>
          </div>
        </section>

        {/* Create criterion dialog */}
        <section className="flex justify-end">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Peso Padrão</Label>
                    <Input data-testid="input-criterion-weight" type="number" min="0" step="1" {...register("defaultWeight", { valueAsNumber: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Ordem de Exibição</Label>
                    <Input type="number" {...register("displayOrder", { valueAsNumber: true })} className="h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
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
                    <th className="px-6 py-4 text-xs font-bold uppercase italic">Área Responsável</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-center">Peso</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-center">Ordem</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {(criteria ?? []).sort((a,b) => a.displayOrder - b.displayOrder).map(c => (
                    <tr key={c.id} data-testid={`row-criterion-${c.id}`} className={`hover:bg-[#f2f4f6] transition-all hover:translate-x-1 group ${!c.active ? 'opacity-60' : ''}`}>
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
                        <div className="bg-[#eceef0] border-2 border-[#191c1e] px-3 py-1.5 inline-flex items-baseline justify-center min-w-[48px]">
                          <span className="text-lg font-black italic">{Number(c.defaultWeight).toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-[#444933] font-bold italic">
                        {c.displayOrder}
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
                  ))}
                  {(!criteria || criteria.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum critério configurado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
