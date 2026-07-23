import { useState } from "react";
import { useGetReviewRequests, useResolveReviewRequest, getGetReviewRequestsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Flag, Search, CheckCircle2, Calendar } from "lucide-react";
import { usePremiumTheme, CONDENSED, BODY } from "@/lib/premium-theme";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewRequestsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  usePremiumTheme();
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
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
      <div className="p-6 md:p-10 space-y-8">

        {/* ── Header ── */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#862200" }}>
              <Flag size={26} className="text-white" />
            </div>
            <div>
              <h1 data-testid="text-page-title" className="font-black uppercase leading-none" style={{ fontFamily: CONDENSED, fontSize: "clamp(2rem,5vw,3.2rem)", letterSpacing: "-0.02em" }}>
                Revisões <span style={{ color: "var(--accent)" }}>Sinalizadas</span>
              </h1>
              <p className="text-sm mt-1.5" style={{ color: "var(--muted-foreground)" }}>
                Pedidos de revisão de eventos feitos pelos colaboradores.
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2 shrink-0" style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}>
              <Flag size={14} /> Pendentes: <span className="text-sm font-black">{pendingCount}</span>
            </div>
          )}
        </section>

        {/* ── Filters ── */}
        <div className="flex flex-col md:flex-row gap-3 items-center flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 w-full rounded-lg text-sm font-medium outline-none"
              style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              placeholder="Buscar colaborador ou evento..."
            />
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {([
              { key: "all", label: "Todos" },
              { key: "pending", label: "Pendentes" },
              { key: "resolved", label: "Resolvidos" },
            ] as const).map(btn => (
              <button
                key={btn.key}
                onClick={() => setStatusFilter(btn.key)}
                className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: statusFilter === btn.key ? "var(--accent)" : "transparent",
                  color: statusFilter === btn.key ? "var(--accent-foreground)" : "var(--muted-foreground)",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── List ── */}
        {isLoading ? (
          <div className="text-center py-20 text-sm font-bold uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
            Carregando registros...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-xl text-sm font-medium" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            Nenhum pedido de revisão encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <div
                key={r.id}
                data-testid={`row-review-request-${r.id}`}
                className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span
                      className="text-[10px] font-black uppercase px-2 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          r.status === "approved" || r.status === "resolved" ? "rgba(154,176,0,0.15)"
                          : r.status === "denied" ? "rgba(229,72,77,0.15)"
                          : "rgba(232,162,61,0.18)",
                        color:
                          r.status === "approved" || r.status === "resolved" ? "#9ab000"
                          : r.status === "denied" ? "#e5484d"
                          : "#e8a23d",
                      }}
                    >
                      {r.status === "approved" ? "Aprovado" : r.status === "denied" ? "Negado" : r.status === "resolved" ? "Resolvido" : "Pendente"}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {formatDateTime(r.createdAt)}
                      {r.status !== "pending" && r.resolvedAt ? ` · resolvido em ${formatDateTime(r.resolvedAt)}` : ""}
                    </span>
                  </div>
                  <p className="font-black uppercase text-[14px]" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
                    {r.employeeName || "—"}
                  </p>
                  <p className="flex items-center gap-1 text-xs font-medium mt-1" style={{ color: "var(--muted-foreground)" }}>
                    <Calendar size={12} /> {r.eventName || "—"}
                  </p>
                  <p className="text-xs italic mt-2" style={{ color: "var(--muted-foreground)" }}>"{r.comment}"</p>
                  {r.status !== "pending" && r.resolutionNotes && (
                    <p className="text-xs font-bold mt-2" style={{ color: "var(--accent)" }}>
                      Resposta: {r.resolutionNotes}
                    </p>
                  )}
                </div>
                {r.status === "pending" && (
                  <button
                    data-testid={`button-resolve-${r.id}`}
                    onClick={() => { setResolving({ id: r.id, comment: r.comment }); setResolutionNotes(""); }}
                    className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0 transition-opacity hover:opacity-80"
                    style={{ backgroundColor: "var(--foreground)", color: "var(--background)" }}
                  >
                    <CheckCircle2 size={14} /> Resolver
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Resolve Dialog ── */}
      <Dialog open={!!resolving} onOpenChange={(v) => !v && setResolving(null)}>
        <DialogContent className="max-w-md rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
              <CheckCircle2 size={20} /> Resolver Revisão
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs italic p-3 rounded-lg" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", borderLeft: "3px solid var(--accent)" }}>
              "{resolving?.comment}"
            </p>
            <Textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Descreva o que foi verificado/decidido (opcional)..."
              className="rounded-lg text-sm resize-none"
              style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              rows={4}
            />
            <div className="flex flex-wrap justify-end gap-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setResolving(null)}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-70"
                style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <button
                data-testid="button-deny-review"
                disabled={resolveMutation.isPending}
                onClick={() => resolving && resolveMutation.mutate({ id: resolving.id, data: { resolution: "denied", resolutionNotes: resolutionNotes || null } })}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "rgba(229,72,77,0.15)", color: "#e5484d", border: "1px solid rgba(229,72,77,0.3)" }}
              >
                {resolveMutation.isPending ? "Salvando..." : "Negar"}
              </button>
              <button
                data-testid="button-approve-review"
                disabled={resolveMutation.isPending}
                onClick={() => resolving && resolveMutation.mutate({ id: resolving.id, data: { resolution: "approved", resolutionNotes: resolutionNotes || null } })}
                className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
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
