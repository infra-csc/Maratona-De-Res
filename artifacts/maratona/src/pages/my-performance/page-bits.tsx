import type { MyPerformanceSummary } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Usuário sem colaborador vinculado: o painel é exclusivo de participantes. */
export function RestrictedAccessNotice() {
  return (
    <div className="p-8 max-w-2xl mx-auto mt-12 rounded-xl text-center space-y-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-[var(--status-danger-text)] mb-2" style={{ backgroundColor: "var(--muted)" }}>
        <AlertTriangle size={28} />
      </div>
      <h1 className="text-2xl font-bold text-foreground">Meu Desempenho: acesso restrito</h1>
      <p className="text-muted-foreground text-sm">
        Seu perfil de usuário não está vinculado a um colaborador no sistema. O painel Meu Desempenho é exclusivo para participantes da Maratona de Resultados.
      </p>
      <p className="text-sm font-bold pt-4 text-muted-foreground" style={{ borderTop: "1px solid var(--border)" }}>Contate o RH ou o administrador do sistema para realizar a vinculação.</p>
    </div>
  );
}

/** Faixa "Ciclo fechado" / "Ciclo em andamento" acima dos cartões. */
export function CycleStatusBanner({ summary }: { summary: MyPerformanceSummary }) {
  return (
    <div className={cn(
      "rounded-xl px-4 py-3 text-[12px] font-bold uppercase flex items-center gap-2",
      summary.isQuarterClosed
        ? "bg-[rgba(154,176,0,0.12)] text-[var(--status-ok-text)]"
        : "bg-[rgba(232,162,61,0.14)] text-[var(--status-warn-text)]"
    )} style={{ border: `1px solid ${summary.isQuarterClosed ? "rgba(154,176,0,0.3)" : "rgba(232,162,61,0.35)"}` }}>
      {summary.isQuarterClosed ? <CheckCircle2 size={15} /> : <Clock size={15} />}
      {summary.isQuarterClosed
        ? "Ciclo fechado — resultado oficial"
        : "Ciclo em andamento — nota e bônus são projeções parciais e podem mudar até o fechamento oficial"}
    </div>
  );
}

/** Nota de sigilo no rodapé. */
export function PrivacyNote() {
  return (
    <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Sigilo de Avaliação</p>
      <p className="text-[11px] text-muted-foreground mt-1 italic">
        Para garantir imparcialidade, as notas e comentários exibidos são consolidados. A identidade dos avaliadores é estritamente confidencial.
      </p>
    </div>
  );
}
