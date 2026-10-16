// Peças visuais da tela Integração. A base — Chip, Eyebrow, botões,
// cabeçalho de diálogo, blocos de vazio/erro, foco devolvido — vem das telas
// já redesenhadas (Critérios, Ciclos, Áreas): um produto só. Aqui ficam as
// peças próprias: a linha de ferramenta, o diálogo de ação (confirmar →
// rodando → resultado) e os blocos de resultado.
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Lock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn, plural } from "@/lib/utils";
import { Chip, DialogHeading, Eyebrow, dialogCls, useReturnFocus, type Tone } from "../criteria/criteria-ui";

export {
  Chip, Eyebrow, DialogHeading, btnPrimary, btnSecondary, btnSmall, btnGhost, inputCls, dialogCls, Bone, FOCUS_RING,
  EmptyBlock, ErrorBlock, Notice, surfaceCls, FieldLabel, FieldErrorText, iconBtn, StatCell, type Tone,
  btnDanger, dialogFooterCls, useReturnFocus, ConsequenceList,
} from "../criteria/criteria-ui";
export { SectionTitle } from "../cycles/cycles-ui";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** Selo curto de como a ferramenta se comporta ("Mostra prévia", "Pode repetir"…). */
export type Trait = { label: string; tone?: Tone; icon?: Icon; title?: string };

/**
 * Uma ferramenta da tela: ícone, o que faz (curto), selos de comportamento
 * e a ação à direita (embaixo no celular).
 */
export function ToolRow({ icon: IconC, title, children, traits = [], columns, action, tone = "neutral", testId }: {
  icon: Icon; title: ReactNode; children?: ReactNode; traits?: Trait[]; columns?: string[]; action: ReactNode; tone?: "neutral" | "danger"; testId?: string;
}) {
  return (
    <li data-testid={testId} className="px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
      <span aria-hidden className={cn("hidden sm:flex w-10 h-10 shrink-0 rounded-lg items-center justify-center",
        tone === "danger" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]" : "bg-secondary text-foreground")}>
        <IconC size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className={cn("text-[15px] font-semibold leading-snug", tone === "danger" ? "text-[var(--status-danger-text)]" : "text-foreground")}>{title}</h3>
        {children && <div className="mt-1 text-[13px] leading-relaxed text-muted-foreground max-w-[78ch]">{children}</div>}
        {columns && columns.length > 0 && (
          <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] text-muted-foreground">
            <span className="mr-0.5">Colunas:</span>
            {columns.map(c => <code key={c} className="rounded-md border border-border bg-secondary/60 px-1.5 py-px font-mono text-[11.5px] text-foreground">{c}</code>)}
          </p>
        )}
        {traits.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {traits.map(t => <Chip key={t.label} tone={t.tone} icon={t.icon} title={t.title} className="h-5 text-[11px]">{t.label}</Chip>)}
          </div>
        )}
      </div>
      <div className="shrink-0 flex md:justify-end">{action}</div>
    </li>
  );
}

/** Diálogo de ação no padrão do app (largura ajustável, rolagem interna, foco devolvido). */
export function ActionDialog({ open, onOpenChange, busy, icon, tone, title, description, children, testId, wide }: {
  open: boolean; onOpenChange: (o: boolean) => void; busy?: boolean;
  icon: Icon; tone?: "neutral" | "danger" | "brand"; title: ReactNode; description?: ReactNode;
  children?: ReactNode; testId?: string; wide?: "md" | "lg" | "xl";
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const w = wide === "xl" ? "max-w-[860px]" : wide === "lg" ? "max-w-[640px]" : "max-w-[520px]";
  return (
    <Dialog open={open} onOpenChange={o => { if (!busy) onOpenChange(o); }}>
      <DialogContent data-testid={testId} onCloseAutoFocus={onCloseAutoFocus}
        onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}
        className={cn(dialogCls, w, "max-h-[92dvh] overflow-y-auto outline-none")}>
        <DialogHeading icon={icon} tone={tone} Title={DialogTitle} Description={DialogDescription} title={title} description={description} />
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Erro do servidor dentro do diálogo. */
export function ErrorBox({ message, title = "Não deu certo" }: { message: string | null | undefined; title?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)] px-3.5 py-3 text-[13px] leading-snug">
      <AlertTriangle size={15} aria-hidden className="mt-[1px] shrink-0 text-[var(--status-danger-text)]" />
      <span className="min-w-0"><span className="block font-semibold text-foreground">{title}</span><span className="block mt-0.5 text-muted-foreground break-words">{message}</span></span>
    </div>
  );
}

/** Resultado concluído (verde) com uma frase. */
export function DoneBox({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <div role="status" className={cn("flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] leading-snug text-foreground",
      warn ? "bg-[var(--status-warn-bg)]" : "bg-[var(--status-ok-bg)]")}>
      {warn
        ? <AlertTriangle size={15} aria-hidden className="mt-[1px] shrink-0 text-[var(--status-warn-text)]" />
        : <CheckCircle2 size={15} aria-hidden className="mt-[1px] shrink-0 text-[var(--status-ok-text)]" />}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Números do resultado/prévia numa faixa só. */
export function NumberStrip({ items }: { items: { label: string; value: number | string; tone?: "ok" | "warn" | "info" | "danger"; testId?: string }[] }) {
  const tone = { ok: "text-[var(--status-ok-text)]", warn: "text-[var(--status-warn-text)]", info: "text-[var(--status-info-text)]", danger: "text-[var(--status-danger-text)]" };
  return (
    <dl className={cn("rounded-xl border border-border overflow-hidden flex flex-wrap gap-px bg-border",
      items.length <= 3 && "flex-nowrap")}>
      {items.map(it => (
        <div key={it.label} className={cn("bg-card px-3.5 py-3 min-w-0 flex-1", items.length > 3 && "basis-[150px]")}>
          <dt><Eyebrow as="span" className="block leading-tight">{it.label}</Eyebrow></dt>
          <dd data-testid={it.testId} className={cn("mt-1.5 font-condensed text-[24px] font-black leading-none tabular-nums", it.tone ? tone[it.tone] : "text-foreground")}>
            {typeof it.value === "number" ? it.value.toLocaleString("pt-BR") : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Eventos de ciclo fechado que a ação deixou como estavam (ciclo fechado só consulta). */
export function ClosedCycleSkipped({ items, count, testId, future }: { items?: { eventId?: number; eventName?: string; reason?: string }[]; count?: number; testId?: string; future?: boolean }) {
  const n = items?.length ?? count ?? 0;
  if (n <= 0) return null;
  return (
    <div data-testid={testId ?? "closed-cycle-skipped"} className="rounded-xl border border-border bg-secondary/50 px-3.5 py-3 text-[13px] leading-snug">
      <p className="flex items-center gap-2 font-semibold text-foreground">
        <Lock size={14} aria-hidden className="text-muted-foreground" />
        {future ? plural(n, "evento de ciclo fechado fica como está", "eventos de ciclo fechado ficam como estão") : plural(n, "evento de ciclo fechado ficou como estava", "eventos de ciclo fechado ficaram como estavam")}
      </p>
      <p className="mt-0.5 text-muted-foreground">Ciclo fechado só consulta: nada nele é alterado.</p>
      {items && items.length > 0 && (
        <ul className="mt-2 max-h-32 overflow-y-auto space-y-0.5 text-[12.5px] text-muted-foreground">
          {items.slice(0, 30).map((s, i) => <li key={`${s.eventId}-${i}`} className="truncate">· {s.eventName ?? `Evento ${s.eventId}`}</li>)}
          {items.length > 30 && <li>· e mais {items.length - 30}</li>}
        </ul>
      )}
    </div>
  );
}

/** Lista de mensagens (erros/avisos) da prévia. */
export function MessageList({ tone, title, items, note, count = true }: { tone: "danger" | "warn" | "info"; title: string; items: string[]; note?: string; count?: boolean }) {
  if (items.length === 0) return null;
  const cls = { danger: "bg-[var(--status-danger-bg)] border-[var(--status-danger)]/35", warn: "bg-[var(--status-warn-bg)] border-transparent", info: "bg-[var(--status-info-bg)] border-transparent" }[tone];
  const txt = { danger: "text-[var(--status-danger-text)]", warn: "text-[var(--status-warn-text)]", info: "text-[var(--status-info-text)]" }[tone];
  return (
    <div className={cn("rounded-xl border px-3.5 py-3", cls)}>
      <p className={cn("flex items-center gap-1.5 text-[13px] font-semibold", txt)}>{tone === "info" ? <Info size={14} aria-hidden /> : <AlertTriangle size={14} aria-hidden />} {title}{count && <span className="tabular-nums">({items.length})</span>}</p>
      {note && <p className="mt-1 text-[12.5px] text-foreground/80">{note}</p>}
      <ul className="mt-1.5 max-h-36 overflow-y-auto space-y-1 text-[12.5px] text-foreground">
        {items.map((m, i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-muted-foreground">·</span><span className="min-w-0 break-words">{m}</span></li>)}
      </ul>
    </div>
  );
}

/** Seletor de arquivo como botão (o input fica escondido e ligado ao rótulo). */
export function FileButton({ id, accept, onFile, disabled, busy, label, busyLabel, testId, inputTestId, className }: {
  id: string; accept: string; onFile: (e: React.ChangeEvent<HTMLInputElement>) => void; disabled?: boolean; busy?: boolean;
  label: string; busyLabel: string; testId?: string; inputTestId?: string; className?: string;
}) {
  return (
    <>
      <input id={id} type="file" accept={accept} className="hidden" aria-label={label} onChange={onFile} data-testid={inputTestId} disabled={disabled || busy} />
      <button type="button" data-testid={testId} disabled={disabled || busy} aria-busy={busy || undefined}
        onClick={() => (document.getElementById(id) as HTMLInputElement | null)?.click()} className={className}>
        {busy ? <span aria-hidden className="w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" /> : null}
        {busy ? busyLabel : label}
      </button>
    </>
  );
}
