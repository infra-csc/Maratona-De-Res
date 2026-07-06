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
import { Button } from "@/components/ui/button";
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

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

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
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
              Áreas &amp; <span className="text-[#506600]">Departamentos</span>
            </h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2 max-w-2xl">
              Gerencie as unidades organizacionais e relacione os critérios e usuários de cada área.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <button
                data-testid="button-create-area"
                className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 whitespace-nowrap ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
              >
                <Plus size={18} /> Nova Área
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
              <DialogHeader>
                <DialogTitle className="text-2xl italic uppercase font-black tracking-tight">Nova Área Organizacional</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(d => createMutation.mutate({ data: d }))} className="space-y-5 pt-4">
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Nome da Área <span className="text-[#ba1a1a]">*</span></Label>
                  <Input data-testid="input-area-name" {...register("name", { required: true })} placeholder="Ex: Cenografia, Comercial..." className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Descrição</Label>
                  <Input data-testid="input-area-desc" {...register("description")} placeholder="Opcional..." className="h-11 rounded-none border-2 border-[#191c1e]" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#e0e3e5]">
                  <Button type="button" variant="outline" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold" onClick={() => setOpen(false)}>Cancelar</Button>
                  <button
                    data-testid="button-submit-area"
                    type="submit"
                    disabled={createMutation.isPending}
                    className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Criando..." : "Criar Área"}
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </section>

        {/* Filters + search */}
        <section className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex border-2 border-[#191c1e] bg-white w-full md:w-auto">
            {(["all", "true", "false"] as const).map(v => (
              <button
                key={v}
                data-testid={`filter-active-${v}`}
                onClick={() => setFilterActive(v)}
                className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-bold italic uppercase tracking-wider transition-all ${filterActive === v ? "bg-[#191c1e] text-[#ccff00]" : "text-[#444933] hover:bg-[#eceef0]"}`}
              >
                {v === "all" ? "Todos" : v === "true" ? "Ativos" : "Inativos"}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
            <Input
              data-testid="input-search-areas"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-12 rounded-none border-2 border-[#191c1e] bg-white italic font-medium focus-visible:ring-0"
              placeholder="Buscar departamento..."
            />
          </div>
        </section>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-56 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 bg-white border-2 border-dashed border-[#191c1e]">
            <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-black italic uppercase tracking-tight text-[#191c1e]">Nenhuma área cadastrada</h3>
            <p className="text-[#747a60] italic mt-1">Tente ajustar os filtros ou criar uma nova área.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(a => {
              const critCount = criteriaFor(a.id).length;
              const userCount = usersFor(a.id).length;
              return (
              <article
                key={a.id}
                data-testid={`card-area-${a.id}`}
                className={`bg-white border-2 border-[#191c1e] flex flex-col ${HARD_SHADOW} ${HARD_SHADOW_HOVER} ${!a.active ? "opacity-70" : ""}`}
              >
                <div className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center skew-x-[-6deg] shrink-0">
                      <Building2 size={28} className="text-[#191c1e] skew-x-[6deg]" />
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[11px] font-bold italic uppercase tracking-wider text-[#506600]">Status</span>
                      <Switch
                        checked={a.active}
                        onCheckedChange={v => updateMutation.mutate({ id: a.id, data: { active: v } })}
                        className="data-[state=checked]:bg-[#ccff00]"
                      />
                    </div>
                  </div>

                  <h3 className="text-2xl italic font-black uppercase tracking-tight mb-2 line-clamp-1">{a.name}</h3>
                  <p className="text-[#444933] italic mb-5 flex-grow min-h-[48px] line-clamp-3">
                    {a.description || "Nenhuma descrição fornecida."}
                  </p>

                  {/* Relationship counts */}
                  <div className="flex items-center gap-2 mb-4">
                    <span data-testid={`count-criteria-${a.id}`} className="flex items-center gap-1.5 bg-[#eceef0] border-2 border-[#191c1e] px-2.5 py-1 font-bold text-[11px] italic uppercase text-[#444933]">
                      <ListChecks size={13} /> {critCount} {critCount === 1 ? "Critério" : "Critérios"}
                    </span>
                    <span data-testid={`count-users-${a.id}`} className="flex items-center gap-1.5 bg-[#eceef0] border-2 border-[#191c1e] px-2.5 py-1 font-bold text-[11px] italic uppercase text-[#444933]">
                      <Users size={13} /> {userCount} {userCount === 1 ? "Usuário" : "Usuários"}
                    </span>
                  </div>

                  <div className="border-t-2 border-[#191c1e] pt-4 mt-auto flex items-center justify-between">
                    {a.active ? (
                      <span className="bg-[#ccff00] text-[#161e00] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                        <span className="inline-block skew-x-[8deg]">Ativa</span>
                      </span>
                    ) : (
                      <span className="bg-[#d8dadc] text-[#444933] px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block opacity-80">
                        <span className="inline-block skew-x-[8deg]">Inativa</span>
                      </span>
                    )}
                    <button
                      data-testid={`button-manage-area-${a.id}`}
                      onClick={() => setManageArea(a)}
                      title="Relacionar critérios e usuários"
                      className="p-2 border-2 border-[#191c1e] bg-white hover:bg-[#ccff00] transition-all"
                    >
                      <Settings size={18} className="text-[#191c1e]" />
                    </button>
                  </div>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Manage area relationships */}
      <Dialog open={manageArea !== null} onOpenChange={v => !v && setManageArea(null)}>
        <DialogContent className="max-w-xl rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
              <Building2 size={24} className="text-[#506600]" /> {manageArea?.name}
            </DialogTitle>
            <p className="text-sm text-[#747a60] italic">Relacione os critérios e usuários que pertencem a esta área.</p>
          </DialogHeader>

          {manageArea && (
            <Tabs defaultValue="criteria" className="pt-2">
              <TabsList className="grid grid-cols-2 w-full rounded-none border-2 border-[#191c1e] bg-[#eceef0] p-0 h-auto">
                <TabsTrigger
                  value="criteria"
                  data-testid="tab-area-criteria"
                  className="rounded-none data-[state=active]:bg-[#191c1e] data-[state=active]:text-[#ccff00] font-bold italic uppercase text-xs py-2.5 flex items-center gap-1.5"
                >
                  <ListChecks size={14} /> Critérios
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  data-testid="tab-area-users"
                  className="rounded-none data-[state=active]:bg-[#191c1e] data-[state=active]:text-[#ccff00] font-bold italic uppercase text-xs py-2.5 flex items-center gap-1.5"
                >
                  <Users size={14} /> Usuários
                </TabsTrigger>
              </TabsList>

              {/* Criteria tab */}
              <TabsContent value="criteria" className="mt-4">
                <ScrollArea className="h-[360px] border-2 border-[#191c1e]">
                  <div className="divide-y-2 divide-[#eceef0]">
                    {(criteria ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(c => {
                      const belongs = c.responsibleAreaId === manageArea.id;
                      const elsewhere = c.responsibleAreaId != null && !belongs;
                      return (
                        <label
                          key={c.id}
                          data-testid={`manage-criterion-${c.id}`}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f2f4f6] transition-colors ${belongs ? "bg-[#f6ffd9]" : ""}`}
                        >
                          <Checkbox
                            checked={belongs}
                            disabled={updateCriterionMutation.isPending}
                            onCheckedChange={() => toggleCriterion(c.id, belongs, manageArea.id)}
                            className="rounded-none border-2 border-[#191c1e] data-[state=checked]:bg-[#ccff00] data-[state=checked]:text-[#191c1e]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold italic uppercase text-sm text-[#191c1e] truncate">{c.name}</p>
                            {elsewhere && (
                              <p className="text-[11px] text-[#b02f00] italic flex items-center gap-1 mt-0.5">
                                <ArrowRightLeft size={11} /> Atualmente em: {c.responsibleAreaName}
                              </p>
                            )}
                          </div>
                          {!c.active && <span className="text-[10px] font-bold uppercase italic text-[#747a60]">Inativo</span>}
                        </label>
                      );
                    })}
                    {(criteria ?? []).length === 0 && (
                      <p className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum critério cadastrado.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Users tab */}
              <TabsContent value="users" className="mt-4">
                <ScrollArea className="h-[360px] border-2 border-[#191c1e]">
                  <div className="divide-y-2 divide-[#eceef0]">
                    {(users ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map(u => {
                      const belongs = u.areaId === manageArea.id;
                      const elsewhere = u.areaId != null && !belongs;
                      return (
                        <label
                          key={u.id}
                          data-testid={`manage-user-${u.id}`}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#f2f4f6] transition-colors ${belongs ? "bg-[#f6ffd9]" : ""}`}
                        >
                          <Checkbox
                            checked={belongs}
                            disabled={updateUserMutation.isPending}
                            onCheckedChange={() => toggleUser(u.id, belongs, manageArea.id)}
                            className="rounded-none border-2 border-[#191c1e] data-[state=checked]:bg-[#ccff00] data-[state=checked]:text-[#191c1e]"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold italic text-sm text-[#191c1e] break-words">{u.name}</p>
                            <p className="text-[11px] text-[#747a60] truncate">{u.email}</p>
                            {elsewhere && (
                              <p className="text-[11px] text-[#b02f00] italic flex items-center gap-1 mt-0.5">
                                <ArrowRightLeft size={11} /> Atualmente em: {u.areaName}
                              </p>
                            )}
                          </div>
                          {!u.active && <span className="text-[10px] font-bold uppercase italic text-[#747a60]">Inativo</span>}
                        </label>
                      );
                    })}
                    {(users ?? []).length === 0 && (
                      <p className="text-center py-16 italic uppercase font-bold text-[#747a60]">Nenhum usuário cadastrado.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end pt-4 border-t-2 border-[#e0e3e5]">
            <button
              data-testid="button-close-manage"
              onClick={() => setManageArea(null)}
              className="bg-[#191c1e] text-white border-2 border-[#191c1e] px-5 py-2 font-bold text-sm italic uppercase"
            >
              Concluir
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
