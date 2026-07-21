import { useState } from "react";
import {
  useGetAreas,
  useCreateArea,
  useUpdateArea,
  useGetCriteria,
  useUpdateCriterion,
  useGetUsers,
  useUpdateUser,
  getGetAreasQueryKey,
  getGetCriteriaQueryKey,
  getGetUsersQueryKey,
} from "@workspace/api-client-react";
import type { AreaInput, Area } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Plus, Search, Building2, LayoutGrid, Settings, ListChecks, Users, ArrowRightLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CONDENSED, BODY, WARNING, PremiumCard } from "@/lib/premium-theme";

const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

export default function AreasPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "true" | "false">("all");
  const [manageArea, setManageArea] = useState<Area | null>(null);

  const qKey = getGetAreasQueryKey();
  const criteriaKey = getGetCriteriaQueryKey();
  const usersKey = getGetUsersQueryKey();

  const { data: areas, isLoading } = useGetAreas({ query: { queryKey: qKey } });
  const { data: criteria } = useGetCriteria({ query: { queryKey: criteriaKey } });
  const { data: users } = useGetUsers({ query: { queryKey: usersKey } });

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

  const updateCriterionMutation = useUpdateCriterion({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: criteriaKey }),
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const updateUserMutation = useUpdateUser({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: usersKey }),
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  const filtered = (areas ?? []).filter(a => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchActive = filterActive === "all" || (filterActive === "true" ? a.active : !a.active);
    return matchSearch && matchActive;
  });

  const criteriaFor = (areaId: number) => (criteria ?? []).filter(c => c.responsibleAreaId === areaId);
  const usersFor = (areaId: number) => (users ?? []).filter(u => u.areaId === areaId);

  function toggleCriterion(criterionId: number, belongs: boolean, areaId: number) {
    updateCriterionMutation.mutate({ id: criterionId, data: { responsibleAreaId: belongs ? null : areaId } });
  }

  function toggleUser(userId: number, belongs: boolean, areaId: number) {
    updateUserMutation.mutate({ id: userId, data: { areaId: belongs ? null : areaId } });
  }

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-7">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <h1 data-testid="text-page-title" className="text-2xl md:text-3xl font-black uppercase tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>
              Áreas &amp; Departamentos
            </h1>
            <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--muted-foreground)" }}>
              Gerencie as unidades organizacionais e relacione os critérios e usuários de cada área.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                data-testid="button-create-area"
                className="h-10 px-5 rounded-lg font-black text-xs uppercase tracking-wide flex items-center gap-2 whitespace-nowrap transition-opacity hover:opacity-90 shrink-0"
                style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Plus size={16} /> Nova Área
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Nova Área Organizacional</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nome da Área <span style={{ color: WARNING }}>*</span></Label>
                  <Input data-testid="input-area-name" {...register("name", { required: true })} placeholder="Ex: Cenografia, Comercial..." className="h-11 rounded-lg" style={fieldStyle} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Descrição</Label>
                  <Input data-testid="input-area-desc" {...register("description")} placeholder="Opcional..." className="h-11 rounded-lg" style={fieldStyle} />
                </div>
                <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <button type="button" onClick={() => setOpen(false)} className="h-10 px-4 rounded-lg font-bold uppercase text-xs" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Cancelar</button>
                  <button
                    data-testid="button-submit-area"
                    type="submit"
                    disabled={createMutation.isPending}
                    className="h-10 px-5 rounded-lg font-bold text-sm uppercase disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Área"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </section>

        {/* Filters + search */}
        <section className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex rounded-lg overflow-hidden w-full md:w-auto" style={{ border: "1px solid var(--border)" }}>
            {(["all", "true", "false"] as const).map(v => {
              const active = filterActive === v;
              return (
                <button
                  key={v}
                  data-testid={`filter-active-${v}`}
                  onClick={() => setFilterActive(v)}
                  className="flex-1 md:flex-none px-5 py-2 text-xs font-bold uppercase tracking-wide transition-colors"
                  style={{ fontFamily: CONDENSED, backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)" }}
                >
                  {v === "all" ? "Todos" : v === "true" ? "Ativos" : "Inativos"}
                </button>
              );
            })}
          </div>
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              data-testid="input-search-areas"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 h-11 rounded-lg text-sm outline-none"
              style={fieldStyle}
              placeholder="Buscar departamento..."
            />
          </div>
        </section>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-56 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 rounded-xl" style={{ border: "1px dashed var(--border)" }}>
            <LayoutGrid size={44} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Nenhuma área cadastrada</h3>
            <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>Tente ajustar os filtros ou criar uma nova área.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(a => {
              const critCount = criteriaFor(a.id).length;
              const userCount = usersFor(a.id).length;
              return (
                <PremiumCard key={a.id} className="flex flex-col" style={{ opacity: a.active ? 1 : 0.65 }}>
                  <div data-testid={`card-area-${a.id}`} className="p-5 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-5">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                        <Building2 size={22} style={{ color: "var(--primary-foreground)" }} />
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Status</span>
                        <Switch checked={a.active} onCheckedChange={v => updateMutation.mutate({ id: a.id, data: { active: v } })} />
                      </div>
                    </div>

                    <h3 className="text-lg font-black uppercase tracking-tight mb-1.5 line-clamp-1" style={{ fontFamily: CONDENSED }}>{a.name}</h3>
                    <p className="text-sm mb-4 flex-grow min-h-[44px] line-clamp-3" style={{ color: "var(--muted-foreground)" }}>
                      {a.description || "Nenhuma descrição fornecida."}
                    </p>

                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span data-testid={`count-criteria-${a.id}`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                        <ListChecks size={12} /> {critCount} {critCount === 1 ? "Critério" : "Critérios"}
                      </span>
                      <span data-testid={`count-users-${a.id}`} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold text-[11px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
                        <Users size={12} /> {userCount} {userCount === 1 ? "Usuário" : "Usuários"}
                      </span>
                    </div>

                    <div className="pt-4 mt-auto flex items-center justify-between" style={{ borderTop: "1px solid var(--border)" }}>
                      {a.active ? (
                        <span className="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Ativa</span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full font-bold text-[10px] uppercase" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>Inativa</span>
                      )}
                      <button
                        data-testid={`button-manage-area-${a.id}`}
                        onClick={() => setManageArea(a)}
                        title="Relacionar critérios e usuários"
                        className="p-2 rounded-lg transition-colors hover:opacity-80"
                        style={{ border: "1px solid var(--border)" }}
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Manage area relationships */}
      <Dialog open={manageArea !== null} onOpenChange={v => !v && setManageArea(null)}>
        <DialogContent className="max-w-xl rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
              <Building2 size={22} style={{ color: "var(--accent)" }} /> {manageArea?.name}
            </DialogTitle>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Relacione os critérios e usuários que pertencem a esta área.</p>
          </DialogHeader>

          {manageArea && (
            <Tabs defaultValue="criteria" className="pt-2">
              <TabsList className="grid grid-cols-2 w-full rounded-lg p-1 h-auto" style={{ backgroundColor: "var(--secondary)" }}>
                <TabsTrigger value="criteria" data-testid="tab-area-criteria" className="rounded-md font-bold uppercase text-xs py-2 flex items-center gap-1.5">
                  <ListChecks size={13} /> Critérios
                </TabsTrigger>
                <TabsTrigger value="users" data-testid="tab-area-users" className="rounded-md font-bold uppercase text-xs py-2 flex items-center gap-1.5">
                  <Users size={13} /> Usuários
                </TabsTrigger>
              </TabsList>

              {/* Criteria tab */}
              <TabsContent value="criteria" className="mt-4">
                <ScrollArea className="h-[360px] rounded-xl" style={{ border: "1px solid var(--border)" }}>
                  <div>
                    {(criteria ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((c, i) => {
                      const belongs = c.responsibleAreaId === manageArea.id;
                      const elsewhere = c.responsibleAreaId != null && !belongs;
                      return (
                        <label
                          key={c.id}
                          data-testid={`manage-criterion-${c.id}`}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:opacity-90"
                          style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: belongs ? "rgba(154,176,0,0.10)" : "transparent" }}
                        >
                          <Checkbox
                            checked={belongs}
                            disabled={updateCriterionMutation.isPending}
                            onCheckedChange={() => toggleCriterion(c.id, belongs, manageArea.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold uppercase text-sm truncate">{c.name}</p>
                            {elsewhere && (
                              <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: WARNING }}>
                                <ArrowRightLeft size={11} /> Atualmente em: {c.responsibleAreaName}
                              </p>
                            )}
                          </div>
                          {!c.active && <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Inativo</span>}
                        </label>
                      );
                    })}
                    {(criteria ?? []).length === 0 && (
                      <p className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum critério cadastrado.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Users tab */}
              <TabsContent value="users" className="mt-4">
                <ScrollArea className="h-[360px] rounded-xl" style={{ border: "1px solid var(--border)" }}>
                  <div>
                    {(users ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((u, i) => {
                      const belongs = u.areaId === manageArea.id;
                      const elsewhere = u.areaId != null && !belongs;
                      return (
                        <label
                          key={u.id}
                          data-testid={`manage-user-${u.id}`}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:opacity-90"
                          style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none", backgroundColor: belongs ? "rgba(154,176,0,0.10)" : "transparent" }}
                        >
                          <Checkbox
                            checked={belongs}
                            disabled={updateUserMutation.isPending}
                            onCheckedChange={() => toggleUser(u.id, belongs, manageArea.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-sm break-words">{u.name}</p>
                            <p className="text-[11px] truncate" style={{ color: "var(--muted-foreground)" }}>{u.email}</p>
                            {elsewhere && (
                              <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: WARNING }}>
                                <ArrowRightLeft size={11} /> Atualmente em: {u.areaName}
                              </p>
                            )}
                          </div>
                          {!u.active && <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Inativo</span>}
                        </label>
                      );
                    })}
                    {(users ?? []).length === 0 && (
                      <p className="text-center py-16 font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum usuário cadastrado.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              data-testid="button-close-manage"
              onClick={() => setManageArea(null)}
              className="px-5 py-2.5 rounded-lg font-bold text-sm uppercase transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              Concluir
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
