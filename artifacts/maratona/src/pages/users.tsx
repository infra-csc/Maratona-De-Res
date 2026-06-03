import { useState } from "react";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword, useGetAreas, getGetUsersQueryKey } from "@workspace/api-client-react";
import type { UserInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "rh", label: "RH" },
  { value: "avaliador", label: "Avaliador" },
  { value: "diretoria", label: "Diretoria" },
  { value: "visualizador", label: "Visualizador" },
];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const qKey = getGetUsersQueryKey();
  const { data: users, isLoading } = useGetUsers({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();

  const { register, handleSubmit, reset, setValue } = useForm<UserInput & { role: string }>({
    defaultValues: { role: "avaliador" },
  });

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário criado" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
      onError: (e: { message?: string }) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
    },
  });

  const resetPwMutation = useResetUserPassword({
    mutation: {
      onSuccess: () => {
        setResetOpen(null);
        setNewPassword("");
        toast({ title: "Senha redefinida com sucesso" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  function roleLabel(role: string) {
    return ROLES.find(r => r.value === role)?.label ?? role;
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck size={22} className="text-primary" /> Usuários
          </h1>
          <p className="text-muted-foreground text-sm">Gerencie os usuários da plataforma</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user" size="sm">
              <Plus size={16} className="mr-1.5" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label>Nome Completo *</Label>
                <Input data-testid="input-user-name" {...register("name", { required: true })} placeholder="Nome do usuário" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input data-testid="input-user-email" type="email" {...register("email", { required: true })} placeholder="email@cenografica.com.br" />
              </div>
              <div className="space-y-1.5">
                <Label>Senha *</Label>
                <Input data-testid="input-user-password" type="password" {...register("password", { required: true })} placeholder="Senha inicial" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Perfil *</Label>
                  <Select defaultValue="avaliador" onValueChange={v => setValue("role", v)}>
                    <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Área</Label>
                  <Select onValueChange={v => setValue("areaId", Number(v))}>
                    <SelectTrigger data-testid="select-user-area"><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {(areas ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button data-testid="button-submit-user" type="submit" disabled={createMutation.isPending}>
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
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">E-mail</th>
                <th className="px-4 py-3 text-left font-medium">Perfil</th>
                <th className="px-4 py-3 text-left font-medium">Área</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(users ?? []).map(u => (
                <tr key={u.id} data-testid={`row-user-${u.id}`} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{roleLabel(u.role)}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{u.areaName ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={u.active ? "default" : "secondary"}>
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        data-testid={`button-reset-pw-${u.id}`}
                        size="sm" variant="ghost"
                        onClick={() => setResetOpen(u.id)}
                        title="Redefinir senha"
                      >
                        <KeyRound size={14} />
                      </Button>
                      {u.id !== currentUser?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              data-testid={`button-delete-user-${u.id}`}
                              size="sm" variant="ghost"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover {u.name}?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate({ id: u.id })}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={resetOpen !== null} onOpenChange={v => !v && setResetOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Nova Senha</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nova senha..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetOpen(null)}>Cancelar</Button>
              <Button
                data-testid="button-confirm-reset-pw"
                disabled={!newPassword || resetPwMutation.isPending}
                onClick={() => resetOpen && resetPwMutation.mutate({ id: resetOpen, data: { newPassword } })}
              >
                Redefinir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
