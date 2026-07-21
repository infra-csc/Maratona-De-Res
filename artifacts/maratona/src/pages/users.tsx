import { useState } from "react";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser, useResetUserPassword, useGetAreas, useGetEmployees, useImpersonate, useMergeUser, getGetUsersQueryKey } from "@workspace/api-client-react";
import type { UserInput, User, MergeUserResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { CONDENSED, BODY, WARNING, PremiumCard } from "@/lib/premium-theme";

const GOOD = "#9ab000";
const AMBER = "#e8a23d";
const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

const ROLES: { value: string; label: string; bg: string; fg: string }[] = [
  { value: "admin", label: "Administrador", bg: "var(--primary)", fg: "var(--primary-foreground)" },
  { value: "rh", label: "RH", bg: "rgba(154,176,0,0.14)", fg: GOOD },
  { value: "avaliador", label: "Avaliador", bg: "var(--secondary)", fg: "var(--muted-foreground)" },
  { value: "diretoria", label: "Diretoria", bg: "rgba(229,72,77,0.12)", fg: WARNING },
  { value: "visualizador", label: "Visualizador", bg: "rgba(232,162,61,0.14)", fg: AMBER },
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

  const [emailMigOpen, setEmailMigOpen] = useState(false);
  const [emailMigPreview, setEmailMigPreview] = useState<{ id: number; name?: string; emailFrom?: string | null; emailTo?: string; email?: string; status: string }[] | null>(null);
  const [emailMigLoading, setEmailMigLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

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
    return ROLES.find(r => r.value === role) ?? { label: role, bg: "var(--secondary)", fg: "var(--muted-foreground)" };
  }

  async function runEmailMigration(dryRun: boolean) {
    setEmailMigLoading(true);
    try {
      const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const token = localStorage.getItem("maratona_token");
      const res = await fetch(`${base}/api/users/bulk-update-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao migrar emails");
      if (!dryRun) {
        toast({ title: `${data.updated} email(s) atualizados com sucesso` });
        qc.invalidateQueries({ queryKey: qKey });
        setEmailMigOpen(false);
        setEmailMigPreview(null);
      } else {
        setEmailMigPreview(data.preview);
      }
    } catch (e: unknown) {
      toast({ title: "Erro", description: (e as Error).message, variant: "destructive" });
    } finally {
      setEmailMigLoading(false);
    }
  }

  const sortedUsers = [...(users ?? [])]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .filter(u => {
      const q = userSearch.trim().toLowerCase();
      if (!q) return true;
      const haystack = [u.name, u.email, u.cpfLogin, u.employeeName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });

  const stats = {
    total: users?.length ?? 0,
    ativos: users?.filter(u => u.active).length ?? 0,
    admins: users?.filter(u => u.role === "admin").length ?? 0,
  };
  const pct = (n: number) => (stats.total > 0 ? Math.round((n / stats.total) * 100) : 0);

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none flex items-center gap-2.5" style={{ fontFamily: CONDENSED }}>
              <ShieldCheck size={26} style={{ color: "var(--accent)" }} /> Acessos &amp; Permissões
            </h1>
            <p className="text-sm mt-1.5 max-w-xl" style={{ color: "var(--muted-foreground)" }}>Controle quem pode acessar a plataforma e o que podem fazer.</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && (
              <>
                <button
                  onClick={() => { setEmailMigOpen(true); setEmailMigPreview(null); }}
                  className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-colors hover:opacity-80"
                  style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}
                >
                  <Mail size={16} /> Migrar Emails
                </button>
                <Dialog open={emailMigOpen} onOpenChange={o => { setEmailMigOpen(o); if (!o) setEmailMigPreview(null); }}>
                  <DialogContent className="max-w-2xl rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Migrar Emails Office 365</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Atualiza os emails dos avaliadores identificados no Office 365. Clique em <em>Prévia</em> para ver o que será alterado antes de confirmar.</p>
                      {!emailMigPreview && (
                        <button
                          onClick={() => runEmailMigration(true)}
                          disabled={emailMigLoading}
                          className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide disabled:opacity-50 transition-colors hover:opacity-80"
                          style={{ border: "1px solid var(--border)" }}
                        >
                          {emailMigLoading ? "Carregando..." : "Ver Prévia"}
                        </button>
                      )}
                      {emailMigPreview && (
                        <div className="space-y-3">
                          <div className="flex gap-4 text-xs font-bold uppercase tracking-wide">
                            <span style={{ color: GOOD }}>{emailMigPreview.filter(p => p.status === "will_update").length} para atualizar</span>
                            <span style={{ color: "var(--muted-foreground)" }}>{emailMigPreview.filter(p => p.status === "no_change").length} sem mudança</span>
                            {emailMigPreview.filter(p => p.status === "not_found").length > 0 && (
                              <span style={{ color: WARNING }}>{emailMigPreview.filter(p => p.status === "not_found").length} não encontrado</span>
                            )}
                          </div>
                          <div className="max-h-72 overflow-y-auto rounded-lg" style={{ border: "1px solid var(--border)" }}>
                            {emailMigPreview.filter(p => p.status === "will_update").map((p, i) => (
                              <div key={p.id} className="px-3 py-2 text-xs" style={{ backgroundColor: "rgba(154,176,0,0.08)", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                                <span className="font-bold">{p.name}</span>
                                <div className="line-through" style={{ color: "var(--muted-foreground)" }}>{p.emailFrom ?? <em>sem email</em>}</div>
                                <div className="font-mono" style={{ color: GOOD }}>{p.emailTo}</div>
                              </div>
                            ))}
                            {emailMigPreview.filter(p => p.status === "no_change").map((p, i) => (
                              <div key={p.id} className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                                <span className="font-bold">{p.name}</span> — já atualizado
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => runEmailMigration(false)}
                              disabled={emailMigLoading || emailMigPreview.filter(p => p.status === "will_update").length === 0}
                              className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide disabled:opacity-50 transition-opacity hover:opacity-90"
                              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                            >
                              {emailMigLoading ? "Aplicando..." : "Confirmar e Aplicar"}
                            </button>
                            <button
                              onClick={() => { setEmailMigOpen(false); setEmailMigPreview(null); }}
                              className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide transition-colors hover:opacity-80"
                              style={{ border: "1px solid var(--border)" }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {isAdmin && (
              <button
                data-testid="button-merge-mode"
                onClick={() => { setMergeMode(v => !v); setSelectedIds(new Set()); setCanonicalId(null); }}
                className="h-10 px-4 rounded-lg font-bold text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-colors hover:opacity-85"
                style={mergeMode ? { backgroundColor: WARNING, color: "#fff" } : { border: "1px solid var(--border)" }}
              >
                <GitMerge size={16} /> {mergeMode ? "Cancelar Mescla" : "Mesclar Avaliadores"}
              </button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  data-testid="button-create-user"
                  className="h-10 px-4 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <Plus size={16} /> Novo Usuário
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Adicionar Acesso</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: WARNING }}>*</span></Label>
                    <div className="relative">
                      <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                      <Input data-testid="input-user-name" {...register("name", { required: true })} placeholder="Nome do usuário" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail Corporativo <span style={{ color: WARNING }}>*</span></Label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                      <Input data-testid="input-user-email" type="email" {...register("email", { required: true })} placeholder="email@cenografica.com.br" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Senha Inicial <span style={{ color: WARNING }}>*</span></Label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                      <Input data-testid="input-user-password" type="password" {...register("password", { required: true })} placeholder="••••••••" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nível de Permissão <span style={{ color: WARNING }}>*</span></Label>
                      <Select defaultValue="avaliador" onValueChange={v => setValue("role", v)}>
                        <SelectTrigger data-testid="select-user-role" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
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
                      <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área Responsável (Opcional)</Label>
                      <Select onValueChange={v => setValue("areaId", Number(v))}>
                        <SelectTrigger data-testid="select-user-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
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
                    <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vincular a Colaborador (Opcional)</Label>
                    <Select onValueChange={v => setValue("employeeId", v === "__none" ? null : Number(v))}>
                      <SelectTrigger data-testid="select-user-employee" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Nenhum</SelectItem>
                        {sortedEmployees.map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Necessário para o usuário ver a página "Meu Desempenho" com os próprios resultados.</p>
                  </div>
                  <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                    <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                    <button
                      data-testid="button-submit-user"
                      type="submit"
                      disabled={createMutation.isPending}
                      className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
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
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Total de Usuários</span>
            <p data-testid="stat-total" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{stats.total}</p>
            <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: "100%", backgroundColor: "var(--foreground)" }} /></div>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Ativos Agora</span>
            <p data-testid="stat-ativos" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{stats.ativos}</p>
            <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(stats.ativos)}%`, backgroundColor: "var(--primary)" }} /></div>
          </div>
          <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nível Admin</span>
            <p data-testid="stat-admins" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: WARNING }}>{stats.admins}</p>
            <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(stats.admins)}%`, backgroundColor: WARNING }} /></div>
          </div>
        </section>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Carregando usuários...</div>
        ) : (
          <PremiumCard className="overflow-hidden">
            <div className="px-5 py-3 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Grade de Acessos</h3>
              {mergeMode ? (
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
                  Modo Mescla — selecione avaliadores duplicados
                </span>
              ) : <Filter size={16} style={{ color: "var(--muted-foreground)" }} />}
            </div>
            {mergeMode && (
              <div className="px-5 py-3 text-xs font-semibold" style={{ backgroundColor: "rgba(232,162,61,0.10)", borderBottom: "1px solid var(--border)" }}>
                Selecione todos os usuários duplicados e o <strong>canônico</strong> (conta que será mantida). Avaliações e calibrações serão transferidas para o canônico e os duplicados serão desativados.
              </div>
            )}
            <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="relative max-w-sm">
                <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
                <input
                  type="text"
                  data-testid="input-search-users"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  placeholder="Buscar por nome, CPF ou e-mail..."
                  className="w-full pl-8 pr-8 py-2 rounded-lg text-sm outline-none"
                  style={fieldStyle}
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors hover:opacity-70"
                    style={{ color: "var(--muted-foreground)" }}
                    aria-label="Limpar busca"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {userSearch && (
                <p className="text-[11px] mt-1" style={{ color: "var(--muted-foreground)" }}>{sortedUsers.length} resultado(s)</p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    {mergeMode && <th className="px-4 py-3 w-10" />}
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Usuário</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Perfil</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Área</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Status</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-right" style={{ color: "var(--muted-foreground)" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((u, i) => {
                    const roleInfo = getRoleInfo(u.role);
                    const isAvaliador = u.role === "avaliador";
                    const isSelected = selectedIds.has(u.id);
                    const isCanonical = canonicalId === u.id;
                    return (
                      <tr
                        key={u.id}
                        data-testid={`row-user-${u.id}`}
                        className="transition-colors group"
                        style={{
                          borderTop: i > 0 ? "1px solid var(--border)" : "none",
                          cursor: mergeMode && isAvaliador ? "pointer" : "default",
                          backgroundColor: isCanonical ? "rgba(154,176,0,0.12)" : isSelected ? "rgba(232,162,61,0.10)" : "transparent",
                        }}
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
                          <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                            {isAvaliador ? (
                              <input
                                type="checkbox"
                                className="w-4 h-4 cursor-pointer"
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
                            ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                          </td>
                        )}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {isCanonical && <span className="text-[10px] rounded px-1.5 py-0.5 font-black uppercase shrink-0" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Canônico</span>}
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                              <span className="text-sm font-black">{initials(u.name)}</span>
                            </div>
                            <div>
                              <p className="font-bold">{u.name}</p>
                              {u.email && <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>{u.email}</p>}
                              {u.cpfLogin && (
                                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>CPF: {u.cpfLogin}</p>
                              )}
                              {u.employeeName && (
                                <p className="text-[11px] font-bold uppercase mt-0.5" style={{ color: "var(--accent)" }}>↳ {u.employeeName}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase inline-block" style={{ backgroundColor: roleInfo.bg, color: roleInfo.fg }}>
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.areaName ? (
                            <span className="flex items-center gap-2 font-bold uppercase text-xs rounded-lg px-2 py-1 w-max" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                              <Building2 size={12} /> {u.areaName}
                            </span>
                          ) : <span style={{ color: "var(--muted-foreground)" }}>—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {u.active ? (
                              <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Ativo</span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>Inativo</span>
                            )}
                            {u.mustChangePassword && (
                              <span className="text-[10px] font-bold uppercase" style={{ color: WARNING }}>Troca de senha pendente</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {mergeMode && isAvaliador && isSelected && (
                              <button
                                onClick={e => { e.stopPropagation(); setCanonicalId(u.id); }}
                                title={isCanonical ? "Conta canônica selecionada" : "Definir como conta canônica (mantida)"}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-85"
                                style={isCanonical ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
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
                                className="p-2 rounded-lg transition-colors disabled:opacity-50 hover:opacity-80"
                                style={{ border: "1px solid var(--border)" }}
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
                                className="p-2 rounded-lg transition-colors disabled:opacity-50 hover:opacity-80"
                                style={{ border: "1px solid var(--border)" }}
                              >
                                <Eye size={14} />
                              </button>
                            )}
                            {!mergeMode && <button
                              data-testid={`button-edit-user-${u.id}`}
                              onClick={() => setEditUser(u)}
                              title="Editar usuário"
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ border: "1px solid var(--border)" }}
                            >
                              <Pencil size={14} />
                            </button>}
                            {!mergeMode && <button
                              data-testid={`button-reset-pw-${u.id}`}
                              onClick={() => { setNewPassword(""); setResetOpen(u.id); }}
                              title="Redefinir senha"
                              className="p-2 rounded-lg transition-colors hover:opacity-80"
                              style={{ border: "1px solid var(--border)" }}
                            >
                              <KeyRound size={14} />
                            </button>}
                            {!mergeMode && u.id !== currentUser?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    data-testid={`button-delete-user-${u.id}`}
                                    title="Remover acesso"
                                    className="p-2 rounded-lg transition-colors hover:opacity-80"
                                    style={{ border: "1px solid var(--border)", color: WARNING }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Remover acesso?</AlertDialogTitle>
                                    <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
                                      O usuário <strong style={{ color: "var(--foreground)" }}>{u.name}</strong> perderá o acesso imediatamente. Esta ação não afeta o histórico de avaliações já feitas.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="rounded-lg font-bold uppercase text-xs"
                                      style={{ backgroundColor: WARNING, color: "#fff" }}
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
                  {sortedUsers.length === 0 && (
                    <tr><td colSpan={mergeMode ? 6 : 5} className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{userSearch ? "Nenhum usuário encontrado." : "Nenhum usuário cadastrado."}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5" style={{ borderTop: "1px solid var(--border)" }}>
              <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Mostrando {sortedUsers.length} de {stats.total} usuários</span>
            </div>
          </PremiumCard>
        )}
      </div>

      {/* Merge action bar */}
      {mergeMode && selectedIds.size >= 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-4 flex items-center gap-6 min-w-[500px]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--primary)" }}>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>Mescla de Avaliadores</p>
            <p className="text-sm font-bold mt-0.5">
              {selectedIds.size} selecionados
              {canonicalId ? ` — canônico: ${sortedUsers.find(u => u.id === canonicalId)?.name ?? canonicalId}` : " — defina o canônico nas ações"}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={!canonicalId || mergeMutation.isPending}
                className="px-4 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wide flex items-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <GitMerge size={16} /> Mesclar Agora
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Confirmar Mescla?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2" style={{ color: "var(--muted-foreground)" }}>
                  <span className="block">O usuário canônico <strong style={{ color: "var(--foreground)" }}>{sortedUsers.find(u => u.id === canonicalId)?.name}</strong> receberá todas as avaliações e calibrações dos {selectedIds.size - 1} usuário(s) duplicado(s):</span>
                  <ul className="list-disc pl-4 text-xs">
                    {[...selectedIds].filter(id => id !== canonicalId).map(id => (
                      <li key={id}>{sortedUsers.find(u => u.id === id)?.name ?? id}</li>
                    ))}
                  </ul>
                  <span className="block font-bold" style={{ color: WARNING }}>Os duplicados serão desativados. Esta ação não pode ser desfeita.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="rounded-lg font-bold uppercase text-xs"
                  style={{ backgroundColor: GOOD, color: "#fff" }}
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
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            title="Cancelar"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Merge result dialog */}
      <Dialog open={mergeResult !== null} onOpenChange={v => !v && setMergeResult(null)}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <GitMerge size={22} style={{ color: "var(--accent)" }} /> Mescla Concluída
            </DialogTitle>
          </DialogHeader>
          {mergeResult && (
            <div className="pt-4 space-y-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: "rgba(154,176,0,0.10)", border: `1px solid ${GOOD}` }}>
                <p className="text-sm font-bold">
                  {mergeResult.merged.length} usuário(s) mesclado(s) no canônico
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                {[
                  { val: mergeResult.movedEvaluations ?? 0, label: "Avaliações transferidas" },
                  { val: mergeResult.movedCalibrations ?? 0, label: "Calibrações transferidas" },
                  { val: mergeResult.movedAssignments ?? 0, label: "Atribuições transferidas" },
                  { val: mergeResult.movedConformities ?? 0, label: "Conformidades transferidas" },
                ].map((s, i) => (
                  <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "var(--secondary)" }}>
                    <p className="text-2xl font-black" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{s.val}</p>
                    <p className="text-[11px] font-bold uppercase mt-1" style={{ color: "var(--muted-foreground)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setMergeResult(null)}
                className="w-full h-11 rounded-lg font-bold text-sm uppercase tracking-wide transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Fechar
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen !== null} onOpenChange={v => { if (!v) { setResetOpen(null); setNewPassword(""); } }}>
        <DialogContent className="max-w-sm rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nova Senha Segura</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres..."
                className="h-11 rounded-lg"
                style={fieldStyle}
              />
              {newPassword.length > 0 && newPassword.length < 6 && (
                <p className="text-[11px] font-bold" style={{ color: WARNING }}>A senha precisa ter pelo menos 6 caracteres.</p>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button onClick={() => { setResetOpen(null); setNewPassword(""); }} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
              <button
                data-testid="button-confirm-reset-pw"
                disabled={newPassword.length < 6 || resetPwMutation.isPending}
                onClick={() => resetOpen && resetPwMutation.mutate({ id: resetOpen, data: { newPassword } })}
                className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                Atualizar Senha
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editUser !== null} onOpenChange={v => !v && setEditUser(null)}>
        <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Editar Usuário</DialogTitle>
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
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome Completo <span style={{ color: WARNING }}>*</span></Label>
        <div className="relative">
          <UserCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <Input data-testid="input-edit-user-name" {...register("name", { required: true })} placeholder="Nome do usuário" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>E-mail Corporativo <span style={{ color: WARNING }}>*</span></Label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
          <Input data-testid="input-edit-user-email" type="email" {...register("email", { required: true })} placeholder="email@cenografica.com.br" className="pl-9 h-11 rounded-lg" style={fieldStyle} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nível de Permissão <span style={{ color: WARNING }}>*</span></Label>
          <Select defaultValue={user.role} onValueChange={v => setValue("role", v)} disabled={isSelf}>
            <SelectTrigger data-testid="select-edit-user-role" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSelf && <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Você não pode alterar seu próprio nível de permissão.</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Área Responsável (Opcional)</Label>
          <Select defaultValue={user.areaId != null ? String(user.areaId) : "__none"} onValueChange={v => setValue("areaId", v === "__none" ? null : Number(v))}>
            <SelectTrigger data-testid="select-edit-user-area" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
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
        <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Vincular a Colaborador (Opcional)</Label>
        <Select defaultValue={user.employeeId != null ? String(user.employeeId) : "__none"} onValueChange={v => setValue("employeeId", v === "__none" ? null : Number(v))}>
          <SelectTrigger data-testid="select-edit-user-employee" className="h-11 rounded-lg font-bold uppercase text-xs" style={fieldStyle}>
            <SelectValue placeholder="Nenhum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Nenhum</SelectItem>
            {employees.map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>Necessário para o usuário ver a página "Meu Desempenho" com os próprios resultados.</p>
      </div>
      <div className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: "var(--secondary)" }}>
        <div>
          <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Acesso Ativo</Label>
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{active ? "Usuário pode acessar a plataforma normalmente." : "Usuário fica bloqueado, sem excluir seu histórico."}</p>
        </div>
        <Switch
          data-testid="switch-edit-user-active"
          checked={active}
          disabled={isSelf}
          onCheckedChange={v => setValue("active", v)}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
        <button
          data-testid="button-submit-edit-user"
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {isPending ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>
    </form>
  );
}
