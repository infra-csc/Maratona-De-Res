// Peças da casca do app (menu, cabeçalho móvel, faixa do modo dev, login,
// troca de senha, 404): a marca e os rótulos de papel, iguais em todo lugar.
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  rh: "RH",
  diretoria: "Diretoria",
  operador: "Operador",
  avaliador: "Avaliador",
  visualizador: "Visualizador",
};

/** Papel por extenso (o valor cru, ex. "admin", nunca aparece na tela). */
export function roleLabel(role: string | null | undefined): string {
  const key = (role ?? "").trim().toLowerCase();
  return ROLE_LABELS[key] ?? (role ?? "");
}

/** Iniciais para o avatar (no máximo duas letras). */
export function initials(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/).filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}

/** Selo da marca: quadrado tinta com "M" lima (no escuro, invertido). Decorativo. */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-condensed inline-flex shrink-0 items-center justify-center rounded-[9px] font-black leading-none select-none",
        "bg-[#111111] text-[#d4ff00] dark:bg-[#d4ff00] dark:text-[#0c0c0c]",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.62), letterSpacing: "-0.04em" }}
    >
      M
    </span>
  );
}

/** Nome do produto em duas linhas: "Maratona" e "de Resultados". */
export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex min-w-0 flex-col leading-none", className)}>
      <span className={cn("font-condensed font-black uppercase tracking-[-0.01em] text-foreground truncate", compact ? "text-[15px]" : "text-[17px]")}>
        Maratona
      </span>
      <span className="font-condensed mt-[3px] text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--accent-text)] truncate">
        de Resultados
      </span>
    </span>
  );
}
