// Peças visuais da tela Colaboradores. A base — Chip, Eyebrow, botões,
// cabeçalho de diálogo, campos, faixa de indicadores, blocos de vazio/erro —
// vem das telas já redesenhadas (Avaliações, Eventos, Resultados e Ciclos):
// um produto só.
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { initials } from "./utils";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, SearchField, type Tone,
} from "../cycles/cycles-ui";
export { Segmented } from "../results/results-ui";
export { menuItemCls } from "../events/events-ui";

import { btnPrimary } from "../cycles/cycles-ui";

/** Botão vermelho das ações destrutivas (mesma forma dos demais). */
export const btnDanger = cn(btnPrimary, "bg-destructive text-destructive-foreground enabled:hover:opacity-90 disabled:bg-secondary disabled:text-muted-foreground");

/** Rodapé padrão dos diálogos: Cancelar à esquerda (acima no celular), ação à direita. */
export const dialogFooterCls = "flex flex-col-reverse sm:flex-row sm:justify-end gap-2";

// ── Foco devolvido ──────────────────────────────────────────────────────────
// Diálogos abertos por item de menu (ou depois de uma chamada) não têm um
// Trigger do Radix: o foco cairia no <body> ao fechar. Guardamos quem abriu o
// menu e devolvemos o foco a ele.
let lastTrigger: HTMLElement | null = null;

/** Gatilhos de menu chamam isto no pointerdown/keydown (o Radix não foca o gatilho no clique). */
export function rememberTrigger(el: HTMLElement | null) {
  lastTrigger = el;
}
export const triggerMemo = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => rememberTrigger(e.currentTarget),
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => rememberTrigger(e.currentTarget),
};

/**
 * Devolve o foco a quem abriu o diálogo. Usar no `onCloseAutoFocus` do
 * DialogContent/AlertDialogContent.
 */
export function useReturnFocus(open: boolean) {
  const returnTo = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  // Guardado no render (antes de o Radix mover o foco para dentro do diálogo).
  if (open && !wasOpen.current) {
    const active = document.activeElement as HTMLElement | null;
    const fromMenu = !active || active === document.body || !!active.closest("[role='menu']");
    returnTo.current = fromMenu ? lastTrigger : active;
  }
  wasOpen.current = open;
  useEffect(() => {
    if (open) return undefined;
    const t = window.setTimeout(() => { returnTo.current = null; }, 300);
    return () => window.clearTimeout(t);
  }, [open]);
  return useCallback((e: Event) => {
    let el = returnTo.current;
    // A linha pode ter sido redesenhada (lista recarregada, tabela ↔ cartões): acha o mesmo botão de novo.
    if (el && !el.isConnected && el.dataset.testid) el = document.querySelector<HTMLElement>(`[data-testid="${el.dataset.testid}"]`);
    if (el?.isConnected) { e.preventDefault(); el.focus(); }
  }, []);
}

// ── Pessoa ──────────────────────────────────────────────────────────────────

/** Iniciais num quadrado (o canônico da mesclagem fica em destaque). */
export function Avatar({ name, highlight = false, className }: { name: string; highlight?: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn(
      "font-condensed w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-[15px] font-black tracking-[0.02em] transition-colors duration-150",
      highlight ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
      className,
    )}>
      {initials(name)}
    </span>
  );
}

/** Chave para achar nomes repetidos: sem acento, sem caixa e sem espaço duplo. */
export function nameKey(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const BONUS_STATUS_PT: Record<string, string> = { approved: "aprovado", scheduled: "agendado", paid: "pago", blocked: "bloqueado" };
/** Mensagem do servidor com o status do bônus em português ("approved" → "aprovado"). */
export function localizeBonusStatus(msg: string) {
  return msg.replace(/"(approved|scheduled|paid|blocked)"/g, (_, s: string) => `"${BONUS_STATUS_PT[s] ?? s}"`);
}
