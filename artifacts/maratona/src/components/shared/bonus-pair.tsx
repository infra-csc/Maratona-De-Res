import { CONDENSED } from "@/lib/premium-theme";

/**
 * Bônus oficial e projetado LADO A LADO, cada um com o seu rótulo — nunca a
 * soma dos dois como número principal (regra do dono). Usado no Dashboard e
 * em Análises quando o recorte tem ciclo fechado e ciclo aberto.
 */
export function BonusPair({ official, projected, format, className, "data-testid": testId }: {
  official: number;
  projected: number;
  format: (v: number) => string;
  className?: string;
  "data-testid"?: string;
}) {
  const item = (label: string, hint: string, value: number, id: string) => (
    <span className="flex flex-col min-w-0" data-testid={testId ? `${testId}-${id}` : undefined}>
      <span className="text-[10px] font-bold uppercase leading-tight" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", color: "var(--muted-foreground)" }}>
        {label}
      </span>
      <span className="text-[22px] font-black leading-none mt-1 tabular-nums break-words" style={{ fontFamily: CONDENSED }}>{format(value)}</span>
      <span className="text-[11px] font-medium leading-tight mt-1" style={{ color: "var(--muted-foreground)" }}>{hint}</span>
    </span>
  );
  return (
    <span className={`grid grid-cols-2 gap-3 w-full${className ? ` ${className}` : ""}`} data-testid={testId}>
      {item("Oficial", "ciclos fechados", official, "official")}
      {item("Projetado", "ciclo aberto · muda até fechar", projected, "projected")}
    </span>
  );
}
