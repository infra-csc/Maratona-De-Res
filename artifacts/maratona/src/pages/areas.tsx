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
import { Plus, Building2 } from "lucide-react";

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
        toast({ title: "Área criada" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <Building2 size={22} className="text-primary" /> Áreas
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie as áreas da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-area" size="sm">
              <Plus size={16} className="mr-1.5" /> Nova Área
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Nova Área</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input data-testid="input-area-name" {...register("name", { required: true })} placeholder="Ex: Cenografia" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Input data-testid="input-area-desc" {...register("description")} placeholder="Opcional..." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button data-testid="button-submit-area" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid gap-3">
          {(areas ?? []).map(a => (
            <div key={a.id} data-testid={`card-area-${a.id}`} className="flex items-center justify-between px-4 py-3 border rounded-lg bg-card hover:shadow-sm transition-shadow">
              <div>
                <p className="font-medium">{a.name}</p>
                {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
              </div>
              <Badge variant={a.active ? "default" : "secondary"}>
                {a.active ? "Ativa" : "Inativa"}
              </Badge>
            </div>
          ))}
          {(!areas || areas.length === 0) && (
            <div className="text-center py-12 text-muted-foreground">Nenhuma área cadastrada</div>
          )}
        </div>
      )}
    </div>
  );
}
