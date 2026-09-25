import { recomputeQuarter } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { CONDENSED } from "@/lib/premium-theme";
import { serverErrorMessage } from "./shared";

/** Card "Recalcular Ciclo" (admin e RH): refaz o snapshot de ranking/elegibilidade/bônus. */
export function RecomputeCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [recomputePending, setRecomputePending] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{ totalProcessed: number; warnings: string[] } | null>(null);

  async function handleRecompute() {
    setRecomputePending(true);
    setRecomputeResult(null);
    try {
      const data = await recomputeQuarter();
      const warnings = data.warnings ?? [];
      setRecomputeResult({ totalProcessed: data.totalProcessed, warnings });
      await qc.resetQueries();
      toast({ title: `Ciclo recalculado — ${data.totalProcessed} colaborador(es) processado(s)${warnings.length > 0 ? ` · ${warnings.length} aviso(s)` : ""}` });
    } catch (err: unknown) {
      toast({ title: "Falha ao recalcular", description: serverErrorMessage(err, "Erro desconhecido"), variant: "destructive" });
    } finally {
      setRecomputePending(false);
    }
  }

  return (
    <Card className="bg-card border border-border shadow-none overflow-hidden">
      <CardHeader className="bg-secondary border-b border-border pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
          <RefreshCw size={18} className="text-primary" /> Recalcular Ciclo
        </CardTitle>
        <CardDescription>Refaz o snapshot de ranking, elegibilidade e bônus para o ciclo atual. Use após ajustes de critérios, exclusão de participantes Sup Ceno ou outras correções manuais.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        <Button
          disabled={recomputePending}
          onClick={handleRecompute}
          className="w-full"
        >
          <RefreshCw size={16} className={`mr-2 ${recomputePending ? "animate-spin" : ""}`} />
          {recomputePending ? "Recalculando…" : "Recalcular Resultados do Ciclo"}
        </Button>
        {recomputeResult && (
          <div className={`rounded-lg px-4 py-3 border text-sm font-medium flex items-start gap-2 ${recomputeResult.warnings.length > 0 ? "bg-[var(--amber)]/10 border-[var(--amber)]/30 text-[var(--amber)]" : "bg-accent/10 border-accent/40 text-accent-text"}`}>
            {recomputeResult.warnings.length > 0 ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
            <div>
              <p>{recomputeResult.totalProcessed} colaborador(es) processado(s).</p>
              {recomputeResult.warnings.map((w, i) => (
                <p key={i} className="text-xs mt-1 opacity-80">{w}</p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
