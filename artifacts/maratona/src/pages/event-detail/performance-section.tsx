// Performance Individual (Equipe): score equivalente e elegibilidade de cada
// participante no evento.
import { BarChart3, CheckCircle2 } from "lucide-react";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { fmt } from "./helpers";
import type { EventTeamParticipant } from "./types";

export function PerformanceSection({ participants }: { participants: EventTeamParticipant[] }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <BarChart3 size={16} style={{ color: "var(--accent-text)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Performance Individual (Equipe)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
              <th className="px-5 py-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Colaborador</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Score Equivalente</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Elegibilidade</th>
            </tr>
          </thead>
          <tbody>
            {participants.map(p => (
              <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="px-5 py-3.5 font-bold uppercase text-sm">{p.employeeName}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className="inline-block font-black px-3 py-1 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{fmt(p.eventScore)}</span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {p.eligible === false ? (
                    <span className="inline-block text-[11px] uppercase font-black rounded-full px-2 py-1" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>Inativo/Inelegível</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase font-black rounded-full px-2 py-1" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>
                      <CheckCircle2 size={10} /> Elegível
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
