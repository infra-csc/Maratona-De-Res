import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { focusPending } from "./helpers";
import type { PendingItem } from "./types";

/** Erro de envio, lista "Falta preencher", botão de envio e aviso de uso único. */
export function SubmitSection({ submitError, pending, isSubmitting, canSubmit, onSubmit }: {
  submitError: string | null;
  pending: PendingItem[];
  isSubmitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {submitError && (
        <div className="rounded-lg px-4 py-3 text-sm font-semibold" style={{ backgroundColor: "rgba(229,72,77,0.1)", border: `1px solid ${WARNING}`, color: DANGER_TEXT }}>
          {submitError}
        </div>
      )}
      {pending.length > 0 && (
        <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }} aria-live="polite">
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase mb-1.5" style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>
            Falta preencher ({pending.length})
          </p>
          <ul className="space-y-1">
            {pending.map((p) => (
              <li key={p.targetId}>
                <button
                  type="button"
                  onClick={() => focusPending(p.targetId)}
                  className="text-left text-xs underline underline-offset-2 hover:opacity-80"
                  style={{ color: "var(--foreground)" }}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        disabled={isSubmitting}
        aria-disabled={!canSubmit}
        onClick={() => {
          // "Desabilitado" só visualmente: o clique leva ao primeiro campo
          // pendente (os handlers já recusam envio incompleto por conta própria).
          if (!canSubmit) { if (pending[0]) focusPending(pending[0].targetId); return; }
          onSubmit();
        }}
        className="w-full rounded-xl py-4 font-black text-sm tracking-[0.2em] uppercase transition-all active:scale-[0.98]"
        style={{
          fontFamily: CONDENSED,
          backgroundColor: canSubmit ? "var(--primary)" : "var(--secondary)",
          color: canSubmit ? "var(--primary-foreground)" : "var(--muted-foreground)",
          opacity: canSubmit ? 1 : 0.5,
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {isSubmitting ? "Enviando..." : canSubmit ? "Enviar Respostas" : `Enviar Respostas — ${pending.length} ${pending.length === 1 ? "pendência" : "pendências"}`}
      </button>
      <p className="text-center text-xs italic pb-4" style={{ color: "var(--muted-foreground)" }}>
        Este formulário é de uso único e expira após o envio.
      </p>
    </>
  );
}
