import type { PublicEvalInfo } from "@workspace/api-client-react";
import { ClipboardCheck, ShieldAlert, Sun, Moon } from "lucide-react";
import { CONDENSED, DANGER_TEXT } from "@/lib/premium-theme";
import { Card } from "./ui";

/** Topo do formulário: alternância de tema, cartão do evento e campo de nome. */
export function FormHeader({
  info, isDark, onToggleTheme, submitterName, onSubmitterNameChange,
  isConformity, isCombined, isConformityCenografia, isConformityFerramentas,
}: {
  info: PublicEvalInfo;
  isDark: boolean;
  onToggleTheme: () => void;
  submitterName: string;
  onSubmitterNameChange: (v: string) => void;
  isConformity: boolean;
  isCombined: boolean;
  isConformityCenografia: boolean;
  isConformityFerramentas: boolean;
}) {
  return (
    <>
      {/* Toggle de tema */}
      <div className="flex justify-end">
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
          style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
        >
          {isDark ? <Sun size={13} strokeWidth={2} /> : <Moon size={13} strokeWidth={2} />}
          {isDark ? "Light" : "Dark"}
        </button>
      </div>

      {/* Hero header */}
      <Card className="px-6 pt-6 pb-7">
        <div className="flex items-center gap-2 mb-4">
          {(isConformity || isCombined) ? <ShieldAlert size={14} strokeWidth={2.5} style={{ color: "var(--accent-text)" }} /> : <ClipboardCheck size={14} strokeWidth={2.5} style={{ color: "var(--accent-text)" }} />}
          <span className="text-[11px] font-bold tracking-[0.18em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>
            {isConformityCenografia ? "Conformidade — Cenografia" : isConformityFerramentas ? "Conformidade — Ferramentas" : isCombined ? "Avaliação + Conformidade" : "Avaliação de Desempenho"}
          </span>
        </div>
        <h1 className="font-black uppercase leading-[0.95] text-[2.2rem]" style={{ fontFamily: CONDENSED }}>
          {info.eventName ?? "Evento"}
        </h1>
        {info.recipientName && (
          <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Preparado para: <span className="font-semibold" style={{ color: "var(--foreground)" }}>{info.recipientName}</span>
          </p>
        )}
      </Card>

      {/* Nome */}
      <Card className="px-5 py-5 space-y-3">
        <label className="block text-[11px] font-bold tracking-[0.15em] uppercase" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
          Seu nome completo <span style={{ color: DANGER_TEXT }}>*</span>
        </label>
        <input
          id="field-submitter-name"
          type="text"
          value={submitterName}
          onChange={(e) => onSubmitterNameChange(e.target.value)}
          placeholder="Confirme seu nome antes de responder"
          className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
          style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        />
      </Card>
    </>
  );
}
