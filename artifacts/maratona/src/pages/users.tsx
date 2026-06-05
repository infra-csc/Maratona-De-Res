import { useState } from "react";
import { useGetUsers, useCreateUser, useDeleteUser, useResetUserPassword, useGetAreas, getGetUsersQueryKey } from "@workspace/api-client-react";
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
import { Plus, Trash2, KeyRound, ShieldCheck, Mail, Building2, UserCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";

const ROLES = [
  { value: "admin", label: "Administrador", color: "bg-red-50 text-red-700 border-red-200" },
  { value: "rh", label: "RH", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "avaliador", label: "Avaliador", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "diretoria", label: "Diretoria", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "visualizador", label: "Visualizador", color: "bg-slate-100 text-slate-600 border-slate-200" },
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
        toast({ title: "Usuário criado com sucesso" });
        setOpen(false);
        reset();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário removido" });
      },
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

  function getRoleInfo(role: string) {
    return ROLES.find(r => r.value === role) ?? { label: role, color: "bg-slate-100 text-slate-700" };
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto bg-slate-50/30 min-h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 data-testid="text-page-title" className="text-3xl font-bold flex items-center gap-3 tracking-tight text-foreground">
            <ShieldCheck size={28} className="text-primary" /> Acessos & Permissões
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Controle quem pode acessar a plataforma e o que podem fazer.</p>
        </div>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-user" className="shadow-sm">
              <Plus size={16} className="mr-2" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-xl">Adicionar Acesso</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="font-semibold">Nome Completo <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <UserCircle size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input data-testid="input-user-name" {...register("name", { required: true })} placeholder="Nome do usuário" className="pl-10 h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">E-mail Corporativo <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input data-testid="input-user-email" type="email" {...register("email", { required: true })} placeholder="email@cenografica.com.br" className="pl-10 h-11" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold">Senha Inicial <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input data-testid="input-user-password" type="password" {...register("password", { required: true })} placeholder="••••••••" className="pl-10 h-11" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold">Nível de Permissão <span className="text-destructive">*</span></Label>
                  <Select defaultValue="avaliador" onValueChange={v => setValue("role", v)}>
                    <SelectTrigger data-testid="select-user-role" className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold">Área Responsável (Opcional)</Label>
                  <Select onValueChange={v => setValue("areaId", Number(v))}>
                    <SelectTrigger data-testid="select-user-area" className="h-11">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(areas ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button data-testid="button-submit-user" type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Carregando usuários...</div>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Usuário</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Perfil</th>
                  <th className="px-6 py-4 text-left font-semibold text-slate-500 uppercase tracking-wider text-xs">Área</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                  <th className="px-6 py-4 text-right font-semibold text-slate-500 uppercase tracking-wider text-xs">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(users ?? []).map(u => {
                  const roleInfo = getRoleInfo(u.role);
                  return (
                    <tr key={u.id} data-testid={`row-user-${u.id}`} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                            {u.name.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={`font-semibold border ${roleInfo.color}`}>
                          {roleInfo.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {u.areaName ? (
                          <div className="flex items-center gap-2 text-slate-600 font-medium text-xs bg-slate-100 px-2 py-1 rounded-md w-max">
                            <Building2 size={12} /> {u.areaName}
                          </div>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant="outline" className={u.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}>
                          {u.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            data-testid={`button-reset-pw-${u.id}`}
                            size="sm" variant="outline"
                            className="bg-white shadow-sm"
                            onClick={() => setResetOpen(u.id)}
                            title="Redefinir senha"
                          >
                            <KeyRound size={14} className="text-slate-600" />
                          </Button>
                          {u.id !== currentUser?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  data-testid={`button-delete-user-${u.id}`}
                                  size="sm" variant="outline"
                                  className="bg-white border-red-200 text-red-600 hover:bg-red-50 shadow-sm"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="max-w-md">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    O usuário <strong>{u.name}</strong> perderá o acesso imediatamente. Esta ação não afeta o histórico de avaliações já feitas.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate({ id: u.id })}
                                  >
                                    Remover Acesso
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={resetOpen !== null} onOpenChange={v => !v && setResetOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-xl">Redefinir Senha</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Nova Senha Segura</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres..."
                className="h-11"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setResetOpen(null)}>Cancelar</Button>
              <Button
                data-testid="button-confirm-reset-pw"
                disabled={!newPassword || resetPwMutation.isPending}
                onClick={() => resetOpen && resetPwMutation.mutate({ id: resetOpen, data: { newPassword } })}
              >
                Atualizar Senha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
