import { useState } from "react";
import { AlertTriangle, ArrowUpRight, Check, ChevronDown, Loader2, Lock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "../evaluations/ui";
import { focusPending } from "./helpers";
import { FOCUS_RING } from "./ui";
import type { PendingItem } from "./types";
import type { Step } from "./progress";

/**
 * Fim do formulário: o que falta (cada item leva ao campo) ou o resumo do que
 * vai ser enviado, o aviso de envio único, o erro do envio e o botão.
 */
export function SubmitSection({ id, steps, submitError, pending, isSubmitting, canSubmit, onSubmit, onAttempt, attempted = false }: {
  id: string;
  steps: Step[];
  submitError: string | null;
  pending: PendingItem[];
  isSubmitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  /** Clique com algo faltando: a tela passa a apontar os campos vazios. */
  onAttempt?: () => void;
  /** Já tentou enviar com algo faltando: a lista abre e fica em destaque. */
  attempted?: boolean;
}) {
  const complete = pending.length === 0;
  // Lista longa começa fechada (não assusta quem acabou de abrir o link); abre ao tentar enviar.
  const [open, setOpen] = useState(false);
  const collapsible = !attempted && pending.length > 3;
  const showList = !collapsible || open;
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="px-4 py-6 sm:px-7 sm:py-7 scroll-mt-4">
      <h2 id={`${id}-titulo`} className="font-condensed text-[22px] md:text-[24px] font-black uppercase leading-[1.05] tracking-[-0.01em] text-foreground">
        {complete ? "Tudo pronto — revise e envie" : "Antes de enviar"}
      </h2>

      {complete ? (
        <div className="mt-4 rounded-xl border border-border bg-background/60 motion-safe:animate-in motion-safe:fade-in-0 duration-200" data-testid="public-review">
          <Eyebrow className="px-4 pt-3.5">O que vai ser enviado</Eyebrow>
          <ul className="mt-1.5 divide-y divide-border">
            {steps.map(s => (
              <li key={s.key} className="flex items-center gap-3 px-4 py-2.5">
                <Check size={15} strokeWidth={3} aria-hidden className="shrink-0 text-accent-text" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-foreground">{s.label}{s.text && <span className="text-muted-foreground"> · {s.text}</span>}</span>
                {s.value && <span className="font-condensed shrink-0 text-[17px] font-black tabular-nums text-foreground">{s.value}</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={cn("mt-4 rounded-xl px-4 py-3.5 transition-colors duration-200", attempted ? "bg-[var(--status-warn-bg)]" : "bg-secondary/70")} aria-live="polite" data-testid="public-pending">
          <div className="flex items-center justify-between gap-3">
            <p className={cn("font-condensed text-[13px] font-bold uppercase tracking-[0.08em]", attempted ? "text-[var(--status-warn-text)]" : "text-muted-foreground")}>
              Falta preencher ({pending.length})
            </p>
            {collapsible && (
              <button
                type="button"
                aria-expanded={showList}
                aria-controls={`${id}-lista`}
                onClick={() => setOpen(o => !o)}
                className={cn("-my-2 -mr-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-[14px] font-semibold text-foreground hover:bg-card/70", FOCUS_RING)}
              >
                {showList ? "Ocultar" : "Ver lista"}
                <ChevronDown size={15} aria-hidden className={cn("transition-transform duration-150", showList && "rotate-180")} />
              </button>
            )}
          </div>
          {showList && (
            <ul id={`${id}-lista`} className="mt-1.5 -mx-2 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
              {pending.map((p) => (
                <li key={p.targetId}>
                  <button
                    type="button"
                    onClick={() => focusPending(p.targetId)}
                    className={cn("group flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-[15px] text-foreground transition-colors duration-150 hover:bg-card/70", FOCUS_RING)}
                  >
                    <span className="min-w-0">{p.label}</span>
                    <ArrowUpRight size={16} aria-hidden className="shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {submitError && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--status-danger)] bg-[var(--status-danger-bg)] px-4 py-3.5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 duration-200" data-testid="public-submit-error">
          <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0 text-[var(--status-danger-text)]" />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground">O envio não foi concluído</p>
            <p className="mt-0.5 text-[14px] leading-relaxed text-[var(--status-danger-text)]">{submitError}</p>
          </div>
        </div>
      )}

      <p className="mt-5 flex items-start gap-2.5 text-[14px] leading-snug text-muted-foreground">
        <Lock size={15} aria-hidden className="mt-0.5 shrink-0 text-foreground" />
        <span><span className="font-semibold text-foreground">Envio único.</span> Este formulário é de uso único e expira após o envio — confira antes.</span>
      </p>

      <button
        type="button"
        disabled={isSubmitting}
        aria-disabled={!canSubmit || undefined}
        aria-describedby={!complete ? `${id}-falta` : undefined}
        aria-busy={isSubmitting || undefined}
        onClick={() => {
          // "Desabilitado" só visualmente: o clique leva ao primeiro campo
          // pendente (os handlers já recusam envio incompleto por conta própria).
          if (!canSubmit) { onAttempt?.(); if (pending[0]) focusPending(pending[0].targetId); return; }
          onSubmit();
        }}
        className={cn(
          "font-condensed mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl px-6 text-[17px] font-black uppercase tracking-[0.1em] transition-[background-color,opacity,transform,border-color] duration-150",
          FOCUS_RING,
          canSubmit || isSubmitting
            ? "bg-primary text-primary-foreground hover:opacity-90 motion-safe:active:scale-[0.99]"
            : "cursor-not-allowed border border-dashed border-muted-foreground/60 bg-secondary text-foreground",
          isSubmitting && "cursor-progress opacity-90",
        )}
      >
        {isSubmitting
          ? <><Loader2 size={18} className="animate-spin" aria-hidden /> Enviando…</>
          : <><Send size={17} aria-hidden /> Enviar Respostas</>}
      </button>
      {!complete && (
        <p id={`${id}-falta`} className="mt-2 text-center text-[13px] text-muted-foreground">
          {pending.length === 1 ? "Falta 1 item" : `Faltam ${pending.length} itens`} — toque no botão para ir ao primeiro.
        </p>
      )}
      {isSubmitting && <p className="mt-2 text-center text-[13px] text-muted-foreground" role="status">Não feche esta página até aparecer a confirmação.</p>}
    </section>
  );
}
