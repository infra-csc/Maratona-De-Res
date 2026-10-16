import { useEffect, useState } from "react";
import { ArrowDown, Check, ShieldCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow } from "../evaluations/ui";
import { scrollToSection, focusPending } from "./helpers";
import { FOCUS_RING } from "./ui";
import type { PendingItem } from "./types";

/** Uma etapa do formulário (nome, cada critério, a matriz) e se já está pronta. */
export type Step = { key: string; label: string; done: boolean; target: string; value?: string; /** Valor em texto corrido (ex.: o nome), mostrado na revisão. */ text?: string; /** Número do critério (o mesmo do cartão). */ mark?: number };

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden>
      <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

function countText(done: number, total: number) {
  return <><span className="font-condensed text-[18px] font-black tabular-nums text-foreground">{done}</span> de {total} {total === 1 ? "etapa pronta" : "etapas prontas"}</>;
}

/** Índice lateral (notebook/desktop): o que já está pronto e atalho para cada parte. */
export function ProgressAside({ steps }: { steps: Step[] }) {
  const done = steps.filter(s => s.done).length;
  return (
    <nav aria-label="Etapas do formulário" className="rounded-2xl border border-border bg-card p-5">
      <Eyebrow>Seu progresso</Eyebrow>
      <p className="mt-2 text-[14px] text-muted-foreground">{countText(done, steps.length)}</p>
      <div className="mt-3"><Bar done={done} total={steps.length} /></div>
      <ol className="mt-4 space-y-0.5">
        {steps.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => scrollToSection(s.target)}
              className={cn("group flex min-h-10 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors duration-150 hover:bg-secondary", FOCUS_RING)}
            >
              <span aria-hidden className={cn(
                "font-condensed flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-black transition-colors duration-200",
                s.done ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
              )}>
                {s.done ? <Check size={13} strokeWidth={3} /> : s.mark ?? (s.key === "nome" ? <User size={12} /> : <ShieldCheck size={12} />)}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-[14px]", s.done ? "text-muted-foreground" : "font-semibold text-foreground")}>{s.label}</span>
              {s.value && <span className="font-condensed shrink-0 text-[15px] font-black tabular-nums text-foreground">{s.value}</span>}
              <span className="sr-only">{s.done ? " — pronto" : " — falta"}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Barra fixa no celular/tablet: quanto falta e um atalho (para o primeiro
 * pendente ou para o envio). Some quando o envio já está na tela e enquanto
 * o teclado está aberto (não cobre o campo que a pessoa está digitando).
 */
export function MobileProgressBar({ steps, pending, submitSectionId }: { steps: Step[]; pending: PendingItem[]; submitSectionId: string }) {
  const done = steps.filter(s => s.done).length;
  const [submitVisible, setSubmitVisible] = useState(false);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const el = document.getElementById(submitSectionId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setSubmitVisible(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [submitSectionId]);

  useEffect(() => {
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && (t as HTMLInputElement).type === "text"));
    // Volta com atraso: o toque que tirou o foco do campo termina antes de a
    // barra reaparecer (senão ela podia "roubar" o toque perto do rodapé).
    let timer: number | undefined;
    const onIn = (e: FocusEvent) => { if (isField(e.target)) { window.clearTimeout(timer); setTyping(true); } };
    const onOut = (e: FocusEvent) => { if (isField(e.target)) { window.clearTimeout(timer); timer = window.setTimeout(() => setTyping(false), 350); } };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { window.clearTimeout(timer); document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); };
  }, []);

  const hidden = submitVisible || typing;
  const complete = pending.length === 0;
  return (
    <div
      aria-hidden={hidden || undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm transition-[transform,opacity] duration-200 lg:hidden",
        "pb-[env(safe-area-inset-bottom)]",
        hidden ? "pointer-events-none translate-y-full opacity-0" : "translate-y-0 opacity-100",
      )}
      data-testid="public-progress-bar"
    >
      <div className="mx-auto flex max-w-[680px] items-center gap-4 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-none text-muted-foreground" aria-live="polite">{countText(done, steps.length)}</p>
          <div className="mt-2"><Bar done={done} total={steps.length} /></div>
        </div>
        <button
          type="button"
          tabIndex={hidden ? -1 : undefined}
          onClick={() => complete ? scrollToSection(submitSectionId) : focusPending(pending[0].targetId)}
          className={cn(
            "font-condensed inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-4 text-[14px] font-bold uppercase tracking-[0.06em] transition-[background-color,transform] duration-150 motion-safe:active:scale-[0.97]",
            complete ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground",
            FOCUS_RING,
          )}
        >
          {complete ? "Revisar e enviar" : "Ir ao que falta"}
          <ArrowDown size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
