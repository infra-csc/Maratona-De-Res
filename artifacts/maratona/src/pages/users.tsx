import { useState } from "react";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword, useGetAreas, useGetEmployees, useImpersonate, useMergeUser, getGetUsersQueryKey } from "@workspace/api-client-react";
import type { UserInput, User, MergeUserResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Trash2, KeyRound, ShieldCheck, Mail, Building2, UserCircle, Users, Zap, Filter, Eye, Pencil, LineChart, GitMerge, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

const ROLES = [
  { value: "admin", label: "Administrador", chip: "bg-[#191c1e] text-[#ccff00]" },
  { value: "rh", label: "RH", chip: "bg-[#ccff00] text-[#161e00]" },
  { value: "avaliador", label: "Avaliador", chip: "bg-[#e0e3e5] text-[#191c1e]" },
  { value: "diretoria", label: "Diretoria", chip: "bg-[#ff5722] text-white" },
  { value: "visualizador", label: "Visualizador", chip: "bg-[#f2f4f6] text-[#444933]" },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

export default function UsersPage() {
  const { user: currentUser, impersonate } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<string>("/");

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [canonicalId, setCanonicalId] = useState<number | null>(null);
  const [mergeResult, setMergeResult] = useState<MergeUserResult | null>(null);

  const qKey = getGetUsersQueryKey();
  const { data: users, isLoading } = useGetUsers({ query: { queryKey: qKey } });
  const { data: areas } = useGetAreas();
  const { data: employees } = useGetEmployees({ active: true });
  const sortedEmployees = [...(employees ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

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

  const impersonateMutation = useImpersonate({
    mutation: {
      onSuccess: (res) => {
        impersonate(res.token, res.user);
        const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
        window.location.assign(`${base}${impersonateTarget}`);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao entrar no modo dev", description: e.message, variant: "destructive" }),
    },
  });

  const updateUserMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Usuário atualizado com sucesso" });
        setEditUser(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const mergeMutation = useMergeUser({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: qKey });
        setMergeResult(data);
        setMergeMode(false);
        setSelectedIds(new Set());
        setCanonicalId(null);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao mesclar", description: e.message, variant: "destructive" }),
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
    return ROLES.find(r => r.value === role) ?? { label: role, chip: "bg-[#f2f4f6] text-[#444933]" };
  }

  const sortedUsers = [...(users ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const stats = {
    total: users?.length ?? 0,
    ativos: users?.filter(u => u.active).length ?? 0,
    admins: users?.filter(u => u.role === "admin").length ?? 0,
  };
  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none flex items-center gap-3">
              <ShieldCheck size={40} className="text-[#506600]" /> Acessos &amp;{" "}
              <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Permissões</span>
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-xl">Controle quem pode acessar a plataforma e o que podem fazer.</p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                data-testid="button-merge-mode"
                onClick={() => { setMergeMode(v => !v); setSelectedIds(new Set()); setCanonicalId(null); }}
                className={`border-2 border-[#191c1e] px-5 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${HARD_SHADOW} ${HARD_SHADOW_HOVER} ${mergeMode ? "bg-[#191c1e] text-[#ccff00]" : "bg-white text-[#191c1e]"}`}
              >
                <GitMerge size={18} /> {mergeMode ? "Cancelar Mescla" : "Mesclar Avaliadores"}
              </button>
            )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                data-testid="button-create-user"
                className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <Plus size={18} /> Novo Usuário
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
              <DialogHeader>
                <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Adicionar Acesso</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome Completo <span className="text-[#ba1a1a]">*</span></Label>
                  <div className="relative">
                    <UserCircle size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
                    <Input data-testid="input-user-name" {...register("name", { required: true })} placeholder="Nome do usuário" className="pl-10 h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">E-mail Corporativo <span className="text-[#ba1a1a]">*</span></Label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
                    <Input data-testid="input-user-email" type="email" {...register("email", { required: true })} placeholder="email@cenografica.com.br" className="pl-10 h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Senha Inicial <span className="text-[#ba1a1a]">*</span></Label>
                  <div className="relative">
                    <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
                    <Input data-testid="input-user-password" type="password" {...register("password", { required: true })} placeholder="••••••••" className="pl-10 h-11 rounded-none border-2 border-[#191c1e]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nível de Permissão <span className="text-[#ba1a1a]">*</span></Label>
                    <Select defaultValue="avaliador" onValueChange={v => setValue("role", v)}>
                      <SelectTrigger data-testid="select-user-role" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
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
                    <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Área Responsável (Opcional)</Label>
                    <Select onValueChange={v => setValue("areaId", Number(v))}>
                      <SelectTrigger data-testid="select-user-area" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
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
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Vincular a Colaborador (Opcional)</Label>
                  <Select onValueChange={v => setValue("employeeId", v === "__none" ? null : Number(v))}>
                    <SelectTrigger data-testid="select-user-employee" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Nenhum</SelectItem>
                      {sortedEmployees.map(e => (
                        <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-[#747a60] italic">Necessário para o usuário ver a página "Meu Desempenho" com os próprios resultados.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                  <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setOpen(false)}>Cancelar</Button>
                  <button
                    data-testid="button-submit-user"
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Usuário"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </section>

        {/* Stats bar */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total de Usuários */}
          <div className="bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
              <Users size={120} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Total de Usuários</span>
            <p data-testid="stat-total" className="text-[40px] leading-none italic font-black mt-2">{stats.total}</p>
            <div className="w-full h-1.5 bg-[#eceef0] mt-4"><div className="h-full bg-[#191c1e]" style={{ width: "100%" }} /></div>
          </div>
          {/* Ativos Agora */}
          <div className={`bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden group ${HARD_SHADOW}`}>
            <div className="absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
              <Zap size={120} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Ativos Agora</span>
            <p data-testid="stat-ativos" className="text-[40px] leading-none italic font-black mt-2 text-[#506600]">{stats.ativos}</p>
            <div className="w-full h-1.5 bg-[#eceef0] mt-4"><div className="h-full bg-[#ccff00]" style={{ width: `${pct(stats.ativos)}%` }} /></div>
          </div>
          {/* Nível Admin */}
          <div className="bg-white border-2 border-[#191c1e] p-6 relative overflow-hidden group">
            <div className="absolute -right-4 -bottom-4 opacity-[0.07] group-hover:opacity-15 transition-opacity">
              <ShieldCheck size={120} strokeWidth={1.5} />
            </div>
            <span className="text-xs font-bold uppercase italic tracking-wider text-[#444933]">Nível Admin</span>
            <p data-testid="stat-admins" className="text-[40px] leading-none italic font-black mt-2 text-[#b02f00]">{stats.admins}</p>
            <div className="w-full h-1.5 bg-[#eceef0] mt-4"><div className="h-full bg-[#ff5722]" style={{ width: `${pct(stats.admins)}%` }} /></div>
          </div>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 italic uppercase font-bold text-[#747a60]">Carregando usuários...</div>
        ) : (
          <section className="bg-white border-2 border-[#191c1e] overflow-hidden">
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex justify-between items-center italic">
              <h3 className="text-xs font-bold uppercase tracking-widest">Grade de Acessos</h3>
              {mergeMode ? (
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#ccff00] animate-pulse">
                  Modo Mescla — selecione avaliadores duplicados
                </span>
              ) : <Filter size={18} />}
            </div>
            {mergeMode && (
              <div className="bg-[#fffde7] border-b-2 border-[#191c1e] px-6 py-3 text-xs font-bold italic text-[#444933]">
                Selecione todos os usuários duplicados e o <strong>canônico</strong> (conta que será mantida). Avaliações e calibrações serão transferidas para o canônico e os duplicados serão desativados.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                    {mergeMode && <th className="px-4 py-4 w-10" />}
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Usuário</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Perfil</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Área</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {sortedUsers.map(u => {
                    const roleInfo = getRoleInfo(u.role);
                    const isAvaliador = u.role === "avaliador";
                    const isSelected = selectedIds.has(u.id);
                    const isCanonical = canonicalId === u.id;
                    return (
                      <tr
                        key={u.id}
                        data-testid={`row-user-${u.id}`}
                        className={`transition-all group ${mergeMode && isAvaliador ? "cursor-pointer" : ""} ${isCanonical ? "bg-[#f0ffe0] hover:bg-[#e8ffcc]" : isSelected ? "bg-[#fffde7] hover:bg-[#fff9c4]" : "hover:bg-[#f2f4f6] hover:translate-x-1"}`}
                        onClick={mergeMode && isAvaliador ? () => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (next.has(u.id)) {
                              next.delete(u.id);
                              if (canonicalId === u.id) setCanonicalId(null);
                            } else {
                              next.add(u.id);
                            }
                            return next;
                          });
                        } : undefined}
                      >
                        {mergeMode && (
                          <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                            {isAvaliador ? (
                              <input
                                type="checkbox"
                                className="w-4 h-4 border-2 border-[#191c1e] cursor-pointer accent-[#ccff00]"
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedIds(prev => {
                                    const next = new Set(prev);
                                    if (next.has(u.id)) {
                                      next.delete(u.id);
                                      if (canonicalId === u.id) setCanonicalId(null);
                                    } else {
                                      next.add(u.id);
                                    }
                                    return next;
                                  });
                                }}
                              />
                            ) : <span className="text-[#c4c9ac]">—</span>}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            {isCanonical && <span className="text-[10px] bg-[#ccff00] border border-[#191c1e] px-2 py-0.5 font-black italic uppercase shrink-0">Canônico</span>}
                            <div className="w-11 h-11 border-2 border-[#191c1e] skew-x-[-4deg] bg-[#e0e3e5] flex items-center justify-center shrink-0">
                              <span className="skew-x-[4deg] text-sm font-black italic">{initials(u.name)}</span>
                            </div>
                            <div>
                              <p className="font-bold italic text-[#191c1e]">{u.name}</p>
                              {u.email && <p className="text-xs text-[#747a60] mt-0.5">{u.email}</p>}
                              {u.cpfLogin && (
                                <p className="text-xs text-[#747a60] mt-0.5">CPF: {u.cpfLogin}</p>
                              )}
                              {u.employeeName && (
                                <p className="text-[11px] text-[#506600] font-bold italic uppercase mt-0.5">↳ {u.employeeName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`${roleInfo.chip} px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block`}>
                            <span className="inline-block skew-x-[8deg]">{roleInfo.label}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {u.areaName ? (
                            <span className="flex items-center gap-2 text-[#444933] font-bold italic uppercase text-xs bg-[#eceef0] border-2 border-[#191c1e] px-2 py-1 w-max">
                              <Building2 size={12} /> {u.areaName}
                            </span>
                          ) : <span className="text-[#c4c9ac]">—</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {u.active ? (
                              <span className="bg-[#ccff00] text-[#161e00] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                                <span className="inline-block skew-x-[8deg]">Ativo</span>
                              </span>
                            ) : (
                              <span className="bg-[#d8dadc] text-[#444933] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block opacity-70">
                                <span className="inline-block skew-x-[8deg]">Inativo</span>
                              </span>
                            )}
                            {u.mustChangePassword && (
                              <span className="text-[10px] text-[#ba1a1a] font-bold italic uppercase">Troca de senha pendente</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {mergeMode && isAvaliador && isSelected && (
                              <button
                                onClick={e => { e.stopPropagation(); setCanonicalId(u.id); }}
                                title={isCanonical ? "Conta canônica selecionada" : "Definir como conta canônica (mantida)"}
                                className={`px-3 py-1.5 border-2 border-[#191c1e] text-[11px] font-bold italic uppercase transition-all ${isCanonical ? "bg-[#ccff00] text-[#191c1e]" : "bg-white hover:bg-[#ccff00]"}`}
                              >
                                {isCanonical ? "✓ Canônico" : "Definir Canônico"}
                              </button>
                            )}
                            {!mergeMode && isAdmin && u.employeeId != null && u.active && (
                              <button
                                data-testid={`button-view-performance-${u.id}`}
                                onClick={() => {
                                  setImpersonateTarget("/meu-desempenho");
                                  impersonateMutation.mutate({ data: { userId: u.id } });
                                }}
                                disabled={impersonateMutation.isPending}
                                title={`Ver perfil de desempenho de ${u.employeeName}`}
                                className="p-2 border-2 border-[#191c1e] bg-white hover:bg-[#ccff00] transition-all disabled:opacity-50"
                              >
                                <LineChart size={14} />
                              </button>
                            )}
                            {!mergeMode && isAdmin && u.id !== currentUser?.id && u.active && (
                              <button
                                data-testid={`button-impersonate-${u.id}`}
                                onClick={() => {
                                  setImpersonateTarget("/");
                                  impersonateMutation.mutate({ data: { userId: u.id } });
                                }}
                                disabled={impersonateMutation.isPending}
                                title="Visualizar como este usuário (modo dev)"
                                className="p-2 border-2 border-[#191c1e] bg-white hover:bg-[#ccff00] transition-all disabled:opacity-50"
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            {!mergeMode && <button
                              data-testid={`button-edit-user-${u.id}`}
                              onClick={() => setEditUser(u)}
                              title="Editar usuário"
                              className="p-2 border-2 border-[#191c1e] bg-white hover:bg-[#eceef0] transition-all"
                            >
                              <Pencil size={14} />
                            </button>}
                            {!mergeMode && <button
                              data-testid={`button-reset-pw-${u.id}`}
                              onClick={() => setResetOpen(u.id)}
                              title="Redefinir senha"
                              className="p-2 border-2 border-[#191c1e] bg-white hover:bg-[#ff5722] hover:text-white transition-all"
                            >
                              <KeyRound size={14} />
                            </button>}
                            {!mergeMode && u.id !== currentUser?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    data-testid={`button-delete-user-${u.id}`}
                                    title="Remover acesso"
                                    className="p-2 border-2 border-[#191c1e] bg-white text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl italic uppercase font-black tracking-tight">Remover acesso?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      O usuário <strong>{u.name}</strong> perderá o acesso imediatamente. Esta ação não afeta o histórico de avaliações já feitas.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white hover:bg-[#ba1a1a]/90 italic uppercase font-bold"
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
                  {(users ?? []).length === 0 && (
                    <tr><td colSpan={mergeMode ? 6 : 5} className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum usuário cadastrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t-2 border-[#eceef0] flex justify-between items-center">
              <span className="text-xs font-bold italic uppercase text-[#747a60]">Mostrando {(users ?? []).length} de {stats.total} usuários</span>
            </div>
          </section>
        )}
      </div>

      {/* Merge action bar */}
      {mergeMode && selectedIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#191c1e] text-white border-2 border-[#ccff00] shadow-[6px_6px_0px_0px_#ccff00] px-6 py-4 flex items-center gap-6 min-w-[500px]">
          <div className="flex-1">
            <p className="text-xs font-bold italic uppercase tracking-wider text-[#ccff00]">Mescla de Avaliadores</p>
            <p className="text-sm font-bold mt-0.5">
              {selectedIds.size} selecionados
              {canonicalId ? ` — canônico: ${sortedUsers.find(u => u.id === canonicalId)?.name ?? canonicalId}` : " — defina o canônico nas ações"}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={!canonicalId || mergeMutation.isPending}
                className="bg-[#ccff00] text-[#191c1e] border-2 border-[#ccff00] px-5 py-2.5 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-40"
              >
                <GitMerge size={16} /> Mesclar Agora
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl italic uppercase font-black tracking-tight">Confirmar Mescla?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">O usuário canônico <strong>{sortedUsers.find(u => u.id === canonicalId)?.name}</strong> receberá todas as avaliações e calibrações dos {selectedIds.size - 1} usuário(s) duplicado(s):</span>
                  <ul className="list-disc pl-4 text-xs">
                    {[...selectedIds].filter(id => id !== canonicalId).map(id => (
                      <li key={id}>{sortedUsers.find(u => u.id === id)?.name ?? id}</li>
                    ))}
                  </ul>
                  <span className="block text-[#ba1a1a] font-bold">Os duplicados serão desativados. Esta ação não pode ser desfeita.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-none border-2 border-[#191c1e] bg-[#506600] text-white hover:bg-[#506600]/90 italic uppercase font-bold"
                  onClick={() => {
                    if (!canonicalId) return;
                    const dups = [...selectedIds].filter(id => id !== canonicalId);
                    mergeMutation.mutate({ id: canonicalId, data: { duplicateIds: dups } });
                  }}
                >
                  <GitMerge size={14} className="mr-2" /> Confirmar Mescla
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button
            onClick={() => { setMergeMode(false); setSelectedIds(new Set()); setCanonicalId(null); }}
            className="p-2 hover:bg-white/10 transition-all"
            title="Cancelar"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Merge result dialog */}
      <Dialog open={mergeResult !== null} onOpenChange={v => !v && setMergeResult(null)}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
              <GitMerge size={22} className="text-[#506600]" /> Mescla Concluída
            </DialogTitle>
          </DialogHeader>
          {mergeResult && (
            <div className="pt-4 space-y-4">
              <div className="bg-[#f0ffe0] border-2 border-[#506600] p-4 space-y-1">
                <p className="text-sm font-bold italic text-[#191c1e]">
                  {mergeResult.merged.length} usuário(s) mesclado(s) no canônico
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic text-[#506600]">{mergeResult.movedEvaluations ?? 0}</p>
                  <p className="text-[11px] font-bold italic uppercase text-[#747a60] mt-1">Avaliações transferidas</p>
                </div>
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic text-[#506600]">{mergeResult.movedCalibrations ?? 0}</p>
                  <p className="text-[11px] font-bold italic uppercase text-[#747a60] mt-1">Calibrações transferidas</p>
                </div>
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic text-[#506600]">{mergeResult.movedAssignments ?? 0}</p>
                  <p className="text-[11px] font-bold italic uppercase text-[#747a60] mt-1">Atribuições transferidas</p>
                </div>
                <div className="bg-[#eceef0] border-2 border-[#191c1e] p-3">
                  <p className="text-2xl font-black italic text-[#506600]">{mergeResult.movedConformities ?? 0}</p>
                  <p className="text-[11px] font-bold italic uppercase text-[#747a60] mt-1">Conformidades transferidas</p>
                </div>
              </div>
              <button
                onClick={() => setMergeResult(null)}
                className="w-full bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider"
              >
                Fechar
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen !== null} onOpenChange={v => !v && setResetOpen(null)}>
        <DialogContent className="max-w-sm rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nova Senha Segura</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres..."
                className="h-11 rounded-none border-2 border-[#191c1e]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
              <Button variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setResetOpen(null)}>Cancelar</Button>
              <button
                data-testid="button-confirm-reset-pw"
                disabled={!newPassword || resetPwMutation.isPending}
                onClick={() => resetOpen && resetPwMutation.mutate({ id: resetOpen, data: { newPassword } })}
                className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
              >
                Atualizar Senha
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editUser !== null} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent className="max-w-lg rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Editar Usuário</DialogTitle>
          </DialogHeader>
          {editUser && (
            <EditUserForm
              key={editUser.id}
              user={editUser}
              areas={areas ?? []}
              employees={sortedEmployees}
              isSelf={editUser.id === currentUser?.id}
              isPending={updateUserMutation.isPending}
              onCancel={() => setEditUser(null)}
              onSubmit={data => updateUserMutation.mutate({ id: editUser.id, data })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EditUserFormValues {
  name: string;
  email: string;
  role: string;
  areaId: number | null;
  employeeId: number | null;
  active: boolean;
}

function EditUserForm({
  user,
  areas,
  employees,
  isSelf,
  isPending,
  onCancel,
  onSubmit,
}: {
  user: User;
  areas: { id: number; name: string }[];
  employees: { id: number; name: string }[];
  isSelf: boolean;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (data: EditUserFormValues) => void;
}) {
  const { register, handleSubmit, setValue, watch } = useForm<EditUserFormValues>({
    defaultValues: {
      name: user.name,
      email: user.email ?? "",
      role: user.role,
      areaId: user.areaId ?? null,
      employeeId: user.employeeId ?? null,
      active: user.active,
    },
  });
  const active = watch("active");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 pt-4">
      <div className="space-y-1.5">
        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome Completo <span className="text-[#ba1a1a]">*</span></Label>
        <div className="relative">
          <UserCircle size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
          <Input data-testid="input-edit-user-name" {...register("name", { required: true })} placeholder="Nome do usuário" className="pl-10 h-11 rounded-none border-2 border-[#191c1e]" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">E-mail Corporativo <span className="text-[#ba1a1a]">*</span></Label>
        <div className="relative">
          <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
          <Input data-testid="input-edit-user-email" type="email" {...register("email", { required: true })} placeholder="email@cenografica.com.br" className="pl-10 h-11 rounded-none border-2 border-[#191c1e]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nível de Permissão <span className="text-[#ba1a1a]">*</span></Label>
          <Select defaultValue={user.role} onValueChange={v => setValue("role", v)} disabled={isSelf}>
            <SelectTrigger data-testid="select-edit-user-role" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf && <p className="text-[11px] text-[#747a60] italic">Você não pode alterar seu próprio nível de permissão.</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Área Responsável (Opcional)</Label>
          <Select defaultValue={user.areaId != null ? String(user.areaId) : "__none"} onValueChange={v => setValue("areaId", v === "__none" ? null : Number(v))}>
            <SelectTrigger data-testid="select-edit-user-area" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Nenhuma</SelectItem>
              {areas.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Vincular a Colaborador (Opcional)</Label>
        <Select defaultValue={user.employeeId != null ? String(user.employeeId) : "__none"} onValueChange={v => setValue("employeeId", v === "__none" ? null : Number(v))}>
          <SelectTrigger data-testid="select-edit-user-employee" className="h-11 rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs focus:ring-0">
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Nenhum</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-[#747a60] italic">Necessário para o usuário ver a página "Meu Desempenho" com os próprios resultados.</p>
      </div>
      <div className="flex items-center justify-between border-2 border-[#191c1e] px-4 py-3 bg-[#f7f9fb]">
        <div>
          <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Acesso Ativo</Label>
          <p className="text-[11px] text-[#747a60] italic">{active ? "Usuário pode acessar a plataforma normalmente." : "Usuário fica bloqueado, sem excluir seu histórico."}</p>
        </div>
        <Switch
          data-testid="switch-edit-user-active"
          checked={active}
          disabled={isSelf}
          onCheckedChange={v => setValue("active", v)}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
        <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={onCancel}>Cancelar</Button>
        <button
          data-testid="button-submit-edit-user"
          type="submit"
          disabled={isPending}
          className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
        >
          {isPending ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
