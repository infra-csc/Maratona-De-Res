import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";

/** Três cartões do topo: total, ativos e administradores (barra = % do total). */
export function UsersStats({ total, ativos, admins }: { total: number; ativos: number; admins: number }) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Total de Usuários</span>
        <p data-testid="stat-total" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED }}>{total}</p>
        <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: "100%", backgroundColor: "var(--foreground)" }} /></div>
      </div>
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Ativos Agora</span>
        <p data-testid="stat-ativos" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>{ativos}</p>
        <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(ativos)}%`, backgroundColor: "var(--primary)" }} /></div>
      </div>
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>Nível Admin</span>
        <p data-testid="stat-admins" className="text-4xl leading-none font-black mt-2" style={{ fontFamily: CONDENSED, color: DANGER_TEXT }}>{admins}</p>
        <div className="w-full h-1.5 rounded-full mt-4 overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}><div className="h-full rounded-full" style={{ width: `${pct(admins)}%`, backgroundColor: WARNING }} /></div>
      </div>
    </section>
  );
}
