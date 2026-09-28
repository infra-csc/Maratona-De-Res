import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HScrollerProps {
  children: ReactNode;
  /** Nome do grupo para leitores de tela e dos botões ("fins de semana"). */
  label: string;
  /** Ref do trilho rolável, para o pai centralizar um item (ex.: fim de semana atual). */
  viewportRef?: RefObject<HTMLDivElement | null>;
  className?: string;
}

/**
 * Faixa horizontal que não cabe na largura: setas nas pontas + esmaecimento
 * mostram que há mais itens. Antes a barra de rolagem ficava escondida e os
 * chips simplesmente apareciam cortados, sem jeito de chegar ao fim com o mouse.
 */
export function HScroller({ children, label, viewportRef, className }: HScrollerProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const setRef = useCallback((el: HTMLDivElement | null) => {
    innerRef.current = el;
    if (viewportRef) (viewportRef as { current: HTMLDivElement | null }).current = el;
  }, [viewportRef]);

  const update = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
  }, []);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => { el.removeEventListener("scroll", update); ro?.disconnect(); };
  }, [update]);

  const scrollBy = (dir: -1 | 1) => {
    const el = innerRef.current;
    if (el) el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const arrow = (dir: -1 | 1) => {
    const visible = dir < 0 ? edges.left : edges.right;
    const Icon = dir < 0 ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        onClick={() => scrollBy(dir)}
        aria-label={dir < 0 ? `Ver ${label} anteriores` : `Ver mais ${label}`}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-10 h-7 w-7 inline-flex items-center justify-center rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          dir < 0 ? "left-0" : "right-0",
          visible ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
      >
        <Icon size={15} aria-hidden />
      </button>
    );
  };

  return (
    <div role="group" aria-label={label} className={cn("relative min-w-0", className)}>
      {arrow(-1)}
      <div
        ref={setRef}
        className="flex items-center gap-1.5 overflow-x-auto"
        style={{
          scrollbarWidth: "none",
          // Esmaece só a ponta que tem mais conteúdo.
          maskImage: `linear-gradient(to right, ${edges.left ? "transparent 0, #000 40px" : "#000 0"}, ${edges.right ? "#000 calc(100% - 40px), transparent 100%" : "#000 100%"})`,
          WebkitMaskImage: `linear-gradient(to right, ${edges.left ? "transparent 0, #000 40px" : "#000 0"}, ${edges.right ? "#000 calc(100% - 40px), transparent 100%" : "#000 100%"})`,
        }}
      >
        {children}
      </div>
      {arrow(1)}
    </div>
  );
}
