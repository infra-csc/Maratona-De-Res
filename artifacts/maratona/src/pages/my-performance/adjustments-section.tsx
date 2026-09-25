import type { MyPerformanceAdjustment } from "@workspace/api-client-react";
import { AlertTriangle, Calendar } from "lucide-react";
import { fmtDate } from "@/lib/utils";

/** "Penalidades e Méritos": totais, lista de lançamentos e nota de rodapé. */
export function AdjustmentsSection({ adjustments }: { adjustments: MyPerformanceAdjustment[] }) {
  return (
    <div>
      <h3 className="font-black text-[16px] uppercase mb-3 flex items-center gap-2" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent-text)" }}>
        <AlertTriangle size={18} /> Penalidades e Méritos
      </h3>
      {(adjustments?.length ?? 0) === 0 ? (
        <div className="rounded-xl py-9 text-center text-[13px] text-muted-foreground" style={{ border: "1px dashed var(--border)" }}>
          Nenhuma penalidade ou mérito registrado neste ciclo.
        </div>
      ) : (
        <>
          <AdjustmentTotals adjustments={adjustments} />
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            {adjustments.map((adj, idx) => (
              <div key={adj.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={idx > 0 ? { borderTop: "1px solid var(--border)" } : {}}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      adj.kind === "merit" ? "bg-[#16a34a]/15 text-[var(--status-ok-text)]" : "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
                    }`}>
                      {adj.kind === "merit" ? "Mérito" : "Penalidade"}
                    </span>
                    <span className="text-[12px] font-bold text-foreground">{adj.penaltyType}</span>
                    {adj.quantity > 1 && (
                      <span className="text-[11px] font-bold text-muted-foreground px-1.5 py-0.5 rounded" style={{ backgroundColor: "var(--muted)" }}>×{adj.quantity}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    {adj.date && <span>{fmtDate(adj.date, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>}
                    {adj.eventName && <span className="flex items-center gap-1"><Calendar size={11} /> {adj.eventName}</span>}
                  </div>
                  {adj.reason && <p className="text-[11px] text-muted-foreground italic mt-1">"{adj.reason}"</p>}
                </div>
                <span className={`font-black text-[18px] shrink-0 ${adj.kind === "merit" ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]"}`} style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {adj.kind === "merit" ? "+" : "−"}{adj.totalPoints} pts
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-bold uppercase text-muted-foreground mt-2">
            Méritos somam e penalidades descontam pontos na sua nota final do ciclo (limitada entre 0 e 100).
          </p>
        </>
      )}
    </div>
  );
}

function AdjustmentTotals({ adjustments }: { adjustments: MyPerformanceAdjustment[] }) {
  const pen = adjustments.filter(a => a.kind === "penalty").reduce((s, a) => s + a.totalPoints, 0);
  const mer = adjustments.filter(a => a.kind === "merit").reduce((s, a) => s + a.totalPoints, 0);
  const net = mer - pen;
  return (
    <div className="flex items-center gap-3 flex-wrap mb-3">
      {mer > 0 && <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-[#ccff00] text-[#161e00]">+{mer} pts méritos</span>}
      {pen > 0 && <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]">−{pen} pts penalidades</span>}
      <span className="text-[11px] font-black uppercase px-3 py-1 rounded-full text-foreground" style={{ backgroundColor: "var(--muted)" }}>
        Líquido: {net >= 0 ? `+${net}` : net} pts
      </span>
    </div>
  );
}
