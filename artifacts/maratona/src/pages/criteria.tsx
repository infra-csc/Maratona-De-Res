import { useState } from "react";
import { useGetCriteria, useCreateCriterion, useUpdateCriterion, useGetAreas, getGetCriteriaQueryKey } from "@workspace/api-client-react";
import type { CriterionInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Star, AlertCircle, Building2 } from "lucide-react";

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

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
            <Star size={28} className="text-yellow-500 fill-yellow-500" /> Critérios de Avaliação
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure os quesitos de avaliação e seus respectivos pesos.</p>
        </div>
        
        <div className="flex items-center gap-4 flex-wrap">
          <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 shadow-sm ${isWeightValid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {!isWeightValid && <AlertCircle size={16} className="text-red-500 shrink-0" />}
            <div>
              <p className="text-xs uppercase font-bold opacity-70 leading-none mb-0.5">Soma dos Pesos</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black">{totalWeight}</span>
                {!isWeightValid && <span className="text-xs font-semibold">/ Esperado: 20</span>}
              </div>
            </div>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-criterion" className="shadow-sm">
                <Plus size={16} className="mr-2" /> Novo Critério
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle className="text-xl">Novo Critério de Avaliação</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, defaultWeight: Number(d.defaultWeight) } }))} className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold">Nome <span className="text-destructive">*</span></Label>
                  <Input data-testid="input-criterion-name" {...register("name", { required: true })} placeholder="Ex: Pontualidade" className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold">Descrição do que é avaliado</Label>
                  <Input data-testid="input-criterion-desc" {...register("description")} placeholder="Instruções para o avaliador..." className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-semibold">Peso Padrão</Label>
                    <Input data-testid="input-criterion-weight" type="number" min="0" step="1" {...register("defaultWeight", { valueAsNumber: true })} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold">Ordem de Exibição</Label>
                    <Input type="number" {...register("displayOrder", { valueAsNumber: true })} className="h-11" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold">Área Responsável (Opcional)</Label>
                  <Select onValueChange={v => setValue("responsibleAreaId", Number(v))}>
                    <SelectTrigger data-testid="select-criterion-area" className="h-11">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(areas ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-criterion" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar Critério"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Carregando critérios...</div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Critério & Descrição</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Área Responsável</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Peso</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Ordem</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(criteria ?? []).sort((a,b) => a.displayOrder - b.displayOrder).map(c => (
                  <tr key={c.id} data-testid={`row-criterion-${c.id}`} className={`hover:bg-slate-50/50 transition-colors ${!c.active ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800 text-base">{c.name}</p>
                      {c.description && <p className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">{c.description}</p>}
                    </td>
                    <td className="px-6 py-4">
                      {c.responsibleAreaName ? (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-semibold border-none">
                          <Building2 size={12} className="mr-1.5" /> {c.responsibleAreaName}
                        </Badge>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="bg-slate-100 px-3 py-1.5 rounded-lg inline-flex items-baseline gap-1">
                        <span className="font-black text-slate-700">{Number(c.defaultWeight).toFixed(0)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500 font-medium">
                      {c.displayOrder}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`text-xs font-bold uppercase ${c.active ? 'text-green-600' : 'text-slate-400'}`}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                        <Switch
                          data-testid={`switch-criterion-${c.id}`}
                          checked={c.active}
                          onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { active: v } })}
                          className="data-[state=checked]:bg-green-500"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {(!criteria || criteria.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-16 text-slate-500 text-base">Nenhum critério configurado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
