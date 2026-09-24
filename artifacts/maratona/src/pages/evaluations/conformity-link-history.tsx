import { CheckCircle } from "lucide-react";
import type { PublicToken } from "@/lib/routing-api";
import { fmtDT } from "./helpers";

// Histórico de links de conformidade já enviados (substitui o formulário).
export function ConformityLinkHistory({ history }: { history: PublicToken[] }) {
  return (
    <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
      {history.map(t => (
        <div key={t.id} className="flex items-start justify-between px-4 py-3 gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-bold truncate">
              {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
            </p>
            {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
              <p className="text-[11px] text-muted-foreground truncate">Para: {t.recipientName}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Enviado: {fmtDT(t.createdAt)}
            </p>
            {t.usedAt && (
              <p className="text-[11px] font-bold text-accent-text">
                Respondido: {fmtDT(t.usedAt)}
              </p>
            )}
          </div>
          {t.usedAt ? (
            <span className="shrink-0 text-[11px] font-bold uppercase bg-primary text-primary-foreground border border-primary rounded-lg px-2 py-0.5 flex items-center gap-1 mt-0.5">
              <CheckCircle size={10} /> Respondido
            </span>
          ) : (
            <span className="shrink-0 text-[11px] font-bold uppercase bg-secondary text-muted-foreground border border-border rounded-lg px-2 py-0.5 mt-0.5">
              Pendente
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
