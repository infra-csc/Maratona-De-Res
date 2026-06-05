import { useState } from "react";
import { useGetAreas, useCreateArea, useUpdateArea, getGetAreasQueryKey } from "@workspace/api-client-react";
import type { AreaInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Building2, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export default function AreasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const qKey = getGetAreasQueryKey();
  const { data: areas, isLoading } = useGetAreas({ query: { queryKey: qKey } });

  const { register, handleSubmit, reset } = useForm<AreaInput>();

  const createMutation = useCreateArea({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Área criada com sucesso" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateArea({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
    },
  });

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
            <Building2 size={28} className="text-primary" /> Áreas & Departamentos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Cadastre as áreas da empresa para organizar os responsáveis por critérios.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-area" className="shadow-sm">
              <Plus size={16} className="mr-2" /> Nova Área
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="text-xl">Nova Área Organizacional</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="font-semibold">Nome da Área <span className="text-destructive">*</span></Label>
                <Input data-testid="input-area-name" {...register("name", { required: true })} placeholder="Ex: Cenografia, Comercial..." className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">Descrição</Label>
                <Input data-testid="input-area-desc" {...register("description")} placeholder="Opcional..." className="h-11" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button data-testid="button-submit-area" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Área"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-xl border border-slate-200"></div>)}
        </div>
      ) : (!areas || areas.length === 0) ? (
        <div className="text-center py-24 bg-white rounded-2xl border border-dashed text-slate-400 shadow-sm">
          <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold text-slate-700">Nenhuma área cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map(a => (
            <Card key={a.id} data-testid={`card-area-${a.id}`} className={`border-none shadow-sm hover:shadow-md transition-shadow bg-white ${!a.active ? 'opacity-60' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Building2 size={20} />
                  </div>
                  <Badge variant="outline" className={a.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"}>
                    {a.active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                
                <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{a.name}</h3>
                <p className="text-sm text-slate-500 mt-1 line-clamp-2 min-h-[40px]">
                  {a.description || "Nenhuma descrição fornecida."}
                </p>
                
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                  <Switch 
                    checked={a.active}
                    onCheckedChange={v => updateMutation.mutate({ id: a.id, data: { active: v } })}
                    className="data-[state=checked]:bg-green-500"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
