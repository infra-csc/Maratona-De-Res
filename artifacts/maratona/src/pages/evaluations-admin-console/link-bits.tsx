// Peças comuns dos diálogos de link da Central: o evento do link, a URL
// pronta para copiar e o histórico de links enviados.
import type { ReactNode } from "react";
import { CalendarDays, Check, CheckCheck, Copy, ShieldCheck } from "lucide-react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { cn } from "@/lib/utils";
import { fmtDT } from "./helpers";
import { Chip, Eyebrow, btnPrimary, inputCls } from "./console-ui";

/** "Evento" no topo dos diálogos de link (e o formulário/área, quando há). */
export function LinkEventCard({ header, formLine }: { header: string; formLine?: ReactNode }) {
  if (!header) return null;
  const [name, ...rest] = header.split(" · ");
  return (
    <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 flex items-start gap-3" data-testid="link-event">
      <CalendarDays size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <Eyebrow>Evento</Eyebrow>
        <p className="font-condensed mt-1 text-[17px] font-black uppercase leading-tight break-words text-foreground">{name}</p>
        {rest.length > 0 && <p className="text-[13px] text-muted-foreground mt-0.5 tabular-nums">{rest.join(" · ")}</p>}
        {formLine && <p className="text-[13px] text-foreground mt-1.5">{formLine}</p>}
      </div>
    </div>
  );
}

/** Critérios (e Matriz) que vão no link. */
export function LinkItems({ names, withMatrix }: { names: string[]; withMatrix?: boolean }) {
  return (
    <div>
      <Eyebrow className="mb-2">No link · {names.length + (withMatrix ? 1 : 0)}</Eyebrow>
      <ul className="flex flex-wrap gap-1.5">
        {names.map((n, i) => (
          <li key={i} className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8 text-[13px] font-semibold text-foreground">
            <Check size={13} aria-hidden className="text-[var(--status-ok-text)]" /> {n}
          </li>
        ))}
        {withMatrix && (
          <li className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 h-8 text-[13px] font-semibold text-foreground">
            <ShieldCheck size={13} aria-hidden className="text-[var(--status-ok-text)]" /> Matriz de Conformidade
          </li>
        )}
      </ul>
    </div>
  );
}

/** URL gerada, pronta para copiar (campo só leitura + botão com retorno). */
export function LinkUrlBox({ url, copied, onCopy, id }: { url: string; copied: boolean; onCopy: () => void; id: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <label className="sr-only" htmlFor={id}>Link gerado</label>
      <input id={id} readOnly value={url} onFocus={e => e.currentTarget.select()} className={cn(inputCls, "font-mono text-[13px] bg-secondary/60")} />
      <button type="button" onClick={onCopy} className={cn(btnPrimary, "sm:shrink-0 min-w-[124px]")} aria-live="polite">
        {copied ? <><CheckCheck size={15} aria-hidden /> Copiado</> : <><Copy size={15} aria-hidden /> Copiar</>}
      </button>
    </div>
  );
}

/** Histórico de links enviados (quem recebeu, quando, se já respondeu). */
export function LinkHistory({ tokens }: { tokens: AdminPublicToken[] }) {
  if (tokens.length === 0) return null;
  return (
    <div>
      <Eyebrow className="mb-2">Links já enviados · {tokens.length}</Eyebrow>
      <ul className="rounded-xl border border-border divide-y divide-border max-h-44 overflow-y-auto">
        {tokens.map(t => {
          const who = t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "Sem nome");
          return (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground truncate">{who}</p>
                <p className="text-[12.5px] text-muted-foreground tabular-nums">
                  {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName ? `Para ${t.recipientName} · ` : ""}
                  Enviado {fmtDT(t.createdAt)}{t.usedAt ? ` · respondido ${fmtDT(t.usedAt)}` : ""}
                  {t.createdByName ? ` · em nome de ${t.createdByName}` : ""}
                </p>
              </div>
              {t.usedAt ? <Chip tone="ok">Respondido</Chip> : <Chip>Pendente</Chip>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
