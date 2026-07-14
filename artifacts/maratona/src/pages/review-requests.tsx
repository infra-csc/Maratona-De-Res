import { useState } from "react";
import { useGetReviewRequests, useResolveReviewRequest, getGetReviewRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Flag, Search, CheckCircle2, Calendar } from "lucide-react";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewRequestsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "resolved">("all");
  const [resolving, setResolving] = useState<{ id: number; comment: string } | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const qKey = getGetReviewRequestsQueryKey();
  const { data: requests, isLoading } = useGetReviewRequests({ query: { queryKey: qKey } });

  const resolveMutation = useResolveReviewRequest({
    mutation: {
      onSuccess: (updated) => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: updated.status === "approved" ? "Revisão aprovada" : "Revisão negada" });
        setResolving(null);
        setResolutionNotes("");
      },
      onError: () => toast({ title: "Erro ao resolver revisão", variant: "destructive" }),
    },
  });

  const filtered = (requests ?? []).filter(r => {
    const matchesSearch = search === "" ||
      (r.employeeName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (r.eventName ?? "").toLowerCase().includes(search.toLowerCase());
    // "resolved" no filtro abrange qualquer desfecho (aprovado/negado/legado).
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "pending" && r.status === "pending")
      || (statusFilter === "resolved" && r.status !== "pending");
    return matchesSearch && matchesStatus;
  });

  const pendingCount = (requests ?? []).filter(r => r.status === "pending").length;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8">
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 bg-[#862200] border-2 border-[#191c1e] flex items-center justify-center shrink-0 ${HARD_SHADOW}`}>
              <Flag size={32} className="text-white" />
            </div>
            <div>
              <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">
                Revisões <span className="text-[#ccff00] bg-[#191c1e] px-3 inline-block -rotate-1">Sinalizadas</span>
              </h1>
              <p className="text-base text-[#444933] italic mt-2">Pedidos de revisão de eventos feitos pelos colaboradores.</p>
            </div>
          </div>
          <div className={`bg-[#ccff00] text-[#191c1e] px-5 py-3 border-2 border-[#191c1e] font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 shrink-0 ${HARD_SHADOW}`}>
            <Flag size={16} /> Pendentes: <span className="text-base not-italic">{pendingCount}</span>
          </div>
        </section>

        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
          <div className="relative flex-1 w-full max-w-sm">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747a60]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-none border-2 border-[#191c1e] bg-white font-bold italic uppercase text-xs tracking-wider"
              placeholder="Buscar colaborador ou evento..."
            />
          </div>
          <div className="flex bg-white border-2 border-[#191c1e]">
            {[
              { key: "all", label: "Todos" },
              { key: "pending", label: "Pendentes" },
              { key: "resolved", label: "Resolvidos" },
            ].map(btn => (
              <button
                key={btn.key}
                onClick={() => setStatusFilter(btn.key as typeof statusFilter)}
                className={`px-3 py-2 text-[10px] font-bold uppercase italic transition-colors ${
                  statusFilter === btn.key ? "bg-[#ccff00] text-[#191c1e]" : "bg-white text-[#747a60] hover:bg-[#f2f4f6]"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-[#747a60] italic uppercase font-bold">Carregando registros...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-[#747a60] text-[#747a60] font-medium">
            Nenhum pedido de revisão encontrado.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => (
              <div key={r.id} data-testid={`row-review-request-${r.id}`} className="bg-white border-2 border-[#191c1e] p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className={`text-[10px] font-black uppercase italic px-2 py-0.5 border-2 border-[#191c1e] ${
                      r.status === "approved" ? "bg-[#506600] text-white"
                      : r.status === "denied" ? "bg-[#862200] text-white"
                      : r.status === "resolved" ? "bg-[#506600] text-white"
                      : "bg-[#fff3cd] text-[#862200]"
                    }`}>
                      {r.status === "approved" ? "Aprovado" : r.status === "denied" ? "Negado" : r.status === "resolved" ? "Resolvido" : "Pendente"}
                    </span>
                    <span className="text-[10px] font-medium italic text-[#747a60]">
                      {formatDateTime(r.createdAt)}
                      {r.status !== "pending" && r.resolvedAt ? ` · resolvido em ${formatDateTime(r.resolvedAt)}` : ""}
                    </span>
                  </div>
                  <p className="font-black italic uppercase text-sm text-[#191c1e]">{r.employeeName || "—"}</p>
                  <p className="flex items-center gap-1 text-xs font-bold italic text-[#747a60] mt-1">
                    <Calendar size={12} /> {r.eventName || "—"}
                  </p>
                  <p className="text-xs text-[#444933] italic mt-2">"{r.comment}"</p>
                  {r.status !== "pending" && r.resolutionNotes && (
                    <p className="text-xs text-[#506600] font-bold mt-2">Resposta: {r.resolutionNotes}</p>
                  )}
                </div>
                {r.status === "pending" && (
                  <button
                    data-testid={`button-resolve-${r.id}`}
                    onClick={() => { setResolving({ id: r.id, comment: r.comment }); setResolutionNotes(""); }}
                    className={`bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] px-4 py-2.5 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 shrink-0 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <CheckCircle2 size={14} /> Resolver
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!resolving} onOpenChange={(v) => !v && setResolving(null)}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2 text-[#191c1e]">
              <CheckCircle2 size={22} /> Resolver Revisão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-[#444933] italic bg-[#f2f4f6] p-3 border-l-2 border-[#191c1e]">"{resolving?.comment}"</p>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Descreva o que foi verificado/decidido (opcional)..."
              className="rounded-none border-2 border-[#191c1e]"
              rows={4}
            />
            <div className="flex flex-wrap justify-end gap-3 pt-2 border-t-2 border-[#eceef0]">
              <button
                type="button"
                onClick={() => setResolving(null)}
                className="border-2 border-[#191c1e] bg-white px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider hover:bg-[#eceef0] transition-colors"
              >
                Cancelar
              </button>
              <button
                data-testid="button-deny-review"
                disabled={resolveMutation.isPending}
                onClick={() => resolving && resolveMutation.mutate({ id: resolving.id, data: { resolution: "denied", resolutionNotes: resolutionNotes || null } })}
                className={`bg-[#862200] text-white border-2 border-[#191c1e] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider ${HARD_SHADOW} ${HARD_SHADOW_HOVER} disabled:opacity-50`}
              >
                {resolveMutation.isPending ? "Salvando..." : "Negar"}
              </button>
              <button
                data-testid="button-approve-review"
                disabled={resolveMutation.isPending}
                onClick={() => resolving && resolveMutation.mutate({ id: resolving.id, data: { resolution: "approved", resolutionNotes: resolutionNotes || null } })}
                className={`bg-[#506600] text-white border-2 border-[#191c1e] px-5 py-2.5 font-bold text-xs italic uppercase tracking-wider ${HARD_SHADOW} ${HARD_SHADOW_HOVER} disabled:opacity-50`}
              >
                {resolveMutation.isPending ? "Salvando..." : "Aprovar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
