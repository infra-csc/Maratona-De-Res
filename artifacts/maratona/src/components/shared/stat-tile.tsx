import * as React from "react";
import { CONDENSED } from "@/lib/premium-theme";

export interface StatTileProps {
  /** Rótulo curto em caixa alta (o que o número mede). */
  label: string;
  value: React.ReactNode;
  /** Uma linha de contexto: denominador, regra ou "desde quando". */
  detail?: React.ReactNode;
  /** Destaque do número principal da tela (um por tela). */
  hero?: boolean;
  /** Tamanho do número: "lg" para telas com poucos indicadores. */
  size?: "md" | "lg";
  "data-testid"?: string;
}

/**
 * Indicador numérico (KPI). Usado em Análises e Ciclos para os números terem
 * a mesma hierarquia em todo o app. O `hero` usa as cores primárias do tema.
 */
export function StatTile({ label, value, detail, hero, size = "md", ...rest }: StatTileProps) {
  return (
    <div
      data-testid={rest["data-testid"]}
      className="rounded-xl px-4 py-3.5 flex flex-col justify-between min-w-0"
      style={{
        backgroundColor: hero ? "var(--primary)" : "var(--card)",
        border: `1px solid ${hero ? "var(--primary)" : "var(--border)"}`,
        color: hero ? "var(--primary-foreground)" : "var(--foreground)",
      }}
    >
      <span
        className="text-[11px] font-bold uppercase"
        style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", opacity: hero ? 0.85 : 1, color: hero ? undefined : "var(--muted-foreground)" }}
      >
        {label}
      </span>
      <span
        className={`${size === "lg" || hero ? "text-4xl" : "text-[26px]"} font-black leading-none mt-2 tabular-nums`}
        style={{ fontFamily: CONDENSED }}
      >
        {value}
      </span>
      {detail && (
        <span className="text-[12px] mt-1.5 leading-snug" style={{ opacity: hero ? 0.85 : 1, color: hero ? undefined : "var(--muted-foreground)" }}>
          {detail}
        </span>
      )}
    </div>
  );
}
