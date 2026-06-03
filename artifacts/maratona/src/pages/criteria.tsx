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
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Star } from "lucide-react";

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

  const totalWeight = (criteria ?? []).filter(c => c.active).reduce((s, c) => s + Number(c.defaultWeight), 0);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <Star size={22} className="text-yellow-500" /> Critérios de Avaliação
          </h1>
          <p className="text-muted-foreground text-sm">Configure os critérios e pesos</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Soma dos pesos ativos: <span className={`font-bold ${totalWeight !== 20 ? "text-destructive" : "text-green-600"}`}>{totalWeight}</span>
            {totalWeight !== 20 && <span className="text-destructive text-xs ml-1">(esperado: 20)</span>}
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-criterion" size="sm">
                <Plus size={16} className="mr-1.5" /> Novo Critério
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Novo Critério</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: { ...d, defaultWeight: Number(d.defaultWeight) } }))} className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input data-testid="input-criterion-name" {...register("name", { required: true })} placeholder="Ex: Pontualidade" />
                </div>
                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Input data-testid="input-criterion-desc" {...register("description")} placeholder="Descrição do critério..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Peso Padrão</Label>
                    <Input data-testid="input-criterion-weight" type="number" min="0" step="0.5" {...register("defaultWeight", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ordem de Exibição</Label>
                    <Input type="number" {...register("displayOrder", { valueAsNumber: true })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Área Responsável</Label>
                  <Select onValueChange={v => setValue("responsibleAreaId", Number(v))}>
                    <SelectTrigger data-testid="select-criterion-area"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(areas ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button data-testid="button-submit-criterion" type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Área Responsável</th>
                <th className="px-4 py-3 text-center font-medium">Peso</th>
                <th className="px-4 py-3 text-center font-medium">Ordem</th>
                <th className="px-4 py-3 text-center font-medium">Ativo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(criteria ?? []).map(c => (
                <tr key={c.id} data-testid={`row-criterion-${c.id}`} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.responsibleAreaName ?? "—"}</td>
                  <td className="px-4 py-3 text-center font-bold">{Number(c.defaultWeight).toFixed(1)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{c.displayOrder}</td>
                  <td className="px-4 py-3 text-center">
                    <Switch
                      data-testid={`switch-criterion-${c.id}`}
                      checked={c.active}
                      onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { active: v } })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
