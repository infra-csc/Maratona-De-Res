import { CheckCircle2, Clock } from "lucide-react";
import type { PublicToken } from "@/lib/routing-api";
import { fmtDT } from "./helpers";
import { Chip } from "./ui";

/** Uma linha do registro de links enviados (quem recebeu, quando, respondido ou não). */
export function LinkHistoryRow({ t, trailing }: { t: PublicToken; trailing?: React.ReactNode }) {
  const who = t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—");
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-foreground truncate">{who}</p>
        {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
          <p className="text-[12px] text-muted-foreground truncate">Para: {t.recipientName}</p>
        )}
        <p className="text-[12px] text-muted-foreground">
          Enviado {fmtDT(t.createdAt)}{t.usedAt ? <> · <span className="text-[var(--status-ok-text)] font-semibold">respondido {fmtDT(t.usedAt)}</span></> : null}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {t.usedAt ? <Chip tone="ok" icon={CheckCircle2}>Respondido</Chip> : <Chip tone="warn" icon={Clock}>Aguardando</Chip>}
        {trailing}
      </div>
    </li>
  );
}

// Histórico de links de conformidade já enviados (substitui o formulário).
export function ConformityLinkHistory({ history }: { history: PublicToken[] }) {
  return (
    <ul aria-label="Links enviados" className="rounded-xl border border-border bg-card divide-y divide-border">
      {history.map(t => <LinkHistoryRow key={t.id} t={t} />)}
    </ul>
  );
}
