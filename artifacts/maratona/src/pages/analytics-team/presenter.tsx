// Modo apresentação: tela cheia, uma parte por vez, no quadro 16:9 do palco.
// ← → (PageUp/PageDown, espaço), Home/End, clique na parte (terço esquerdo
// volta, o resto avança) e Esc sai. Os controles aparecem com o mouse ou o
// teclado e somem sozinhos para não disputar a atenção da equipe.
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slide } from "./stage";
import type { SlideDef } from "./slides";

const IDLE_MS = 2600;

const ctrlBtn = "inline-flex items-center justify-center gap-1.5 h-11 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-35 disabled:pointer-events-none";

export function Presenter({ slides, start, meta, onClose }: { slides: SlideDef[]; start: number; meta: string; onClose: () => void }) {
  const [i, setI] = useState(start);
  const [dir, setDir] = useState<1 | -1>(1);
  const [chrome, setChrome] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const pinned = useRef(false);
  const last = slides.length - 1;

  const go = useCallback((n: number) => {
    setI(cur => {
      const next = Math.max(0, Math.min(last, n));
      if (next !== cur) setDir(next > cur ? 1 : -1);
      return next;
    });
  }, [last]);

  // Controles: aparecem a cada movimento/tecla e somem depois de um tempo parado.
  const poke = useCallback(() => {
    setChrome(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (!pinned.current) setChrome(false); }, IDLE_MS);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const trigger = document.activeElement as HTMLElement | null;
    el?.focus();
    poke();
    // Tela cheia de verdade quando o navegador permite; se não, a camada fixa já cobre a tela.
    el?.requestFullscreen?.().catch(() => undefined);
    const onFsChange = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      // Foco volta para quem abriu (Apresentar / Apresentar a partir daqui).
      trigger?.focus?.({ preventScroll: true });
    };
  }, [onClose, poke]);

  const onKey = (e: React.KeyboardEvent) => {
    poke();
    if (e.target instanceof HTMLButtonElement && (e.key === "Enter" || e.key === " ")) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(i + 1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(last); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left < r.width / 3 ? i - 1 : i + 1);
  };

  const s = slides[i];
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`Apresentação: ${s.title}`}
      tabIndex={-1}
      onKeyDown={onKey}
      onPointerMove={poke}
      onPointerDown={poke}
      className={cn("fixed inset-0 z-[60] flex items-center justify-center bg-background outline-none no-print select-none", !chrome && "cursor-none")}
      data-testid="team-presenter"
    >
      {/* Quadro 16:9 do tamanho máximo que cabe; no celular em pé, a tela toda com rolagem. */}
      <div
        onClick={onStageClick}
        className="relative bg-card overflow-x-hidden overflow-y-auto [scrollbar-width:thin] w-[min(100vw,177.78vh)] h-[min(100vh,56.25vw)] portrait:w-screen portrait:h-dvh portrait:pb-20"
      >
        <div
          key={s.id}
          className={cn("h-full motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200", dir > 0 ? "motion-safe:slide-in-from-right-4" : "motion-safe:slide-in-from-left-4")}
        >
          <Slide stage id={`${s.id}-apresentando`} index={i} total={slides.length} eyebrow={s.eyebrow} title={s.title} tone={s.tone} lead={s.lead} meta={meta}>
            {s.body}
          </Slide>
        </div>
      </div>

      {/* Progresso: sempre visível, discreto. */}
      <div aria-hidden className="fixed left-0 right-0 bottom-0 h-[3px] bg-transparent">
        <div className="h-full bg-[var(--accent)] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
      </div>

      <p className="sr-only" aria-live="polite">Parte {i + 1} de {slides.length}: {s.title}</p>

      {/* Controles flutuantes. */}
      <div
        onPointerEnter={() => { pinned.current = true; setChrome(true); }}
        onPointerLeave={() => { pinned.current = false; poke(); }}
        onFocusCapture={() => { pinned.current = true; setChrome(true); }}
        onBlurCapture={() => { pinned.current = false; poke(); }}
        className={cn(
          "fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-border bg-popover/95 text-popover-foreground shadow-lg p-1 backdrop-blur-sm",
          "transition-[opacity,transform] duration-200 motion-reduce:transition-none",
          chrome ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none",
        )}
      >
        <button type="button" onClick={onClose} className={cn(ctrlBtn, "px-4 font-condensed text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground hover:text-foreground hover:bg-secondary")}
          data-testid="button-presenter-exit">
          <X size={16} aria-hidden /> Sair <kbd className="ml-0.5 rounded border border-border px-1 text-[11px] font-sans font-semibold normal-case tracking-normal">Esc</kbd>
        </button>
        <span aria-hidden className="w-px h-6 bg-border mx-1" />
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Parte anterior" className={cn(ctrlBtn, "w-11 hover:bg-secondary")}>
          <ChevronLeft size={20} aria-hidden />
        </button>
        <span className="min-w-[64px] text-center font-condensed text-[15px] font-bold tabular-nums">{i + 1} / {slides.length}</span>
        {i === last ? (
          <button type="button" onClick={onClose} className={cn(ctrlBtn, "px-5 bg-primary text-primary-foreground font-condensed text-[14px] font-bold uppercase tracking-[0.06em] hover:opacity-90")}>
            Encerrar
          </button>
        ) : (
          <button type="button" onClick={() => go(i + 1)} aria-label="Próxima parte" className={cn(ctrlBtn, "w-11 bg-primary text-primary-foreground hover:opacity-90")}>
            <ChevronRight size={20} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
