import { useState } from "react";
import type { AuditLog, AuditRefs } from "@workspace/api-client-react";
import { ChevronDown, Code2, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip, FOCUS_RING, btnGhost } from "../criteria/criteria-ui";
import { actionDef, entityLabel, entityObject } from "./labels";
import { changeLines, countChanged, subjectOf, parseJson } from "./describe";
import { fmtTime } from "./dates";

/** Faixa de cor à esquerda pelo tom da ação (a cor nunca é o único sinal: o selo diz o tipo). */
const RAIL: Record<string, string> = {
  danger: "bg-[var(--status-danger)]", warn: "bg-[var(--status-warn)]", ok: "bg-[var(--status-ok)]", info: "bg-[var(--status-info)]", neutral: "bg-border",
};

/**
 * Uma ação da trilha, escrita como frase ("Renata RH confirmou os resultados ·
 * Feira X"). Clicar abre o "O que mudou" com antes → depois campo a campo.
 */
export function AuditEntry({ log, refs }: { log: AuditLog; refs: AuditRefs | undefined }) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const def = actionDef(log.action);
  // O nome da própria pessoa não se repete ("Renata entrou … · Renata").
  const rawSubject = subjectOf(log, refs);
  const subject = rawSubject && rawSubject !== log.userName ? rawSubject : null;
  const changed = countChanged(log);
  const hasDetails = log.beforeJson != null || log.afterJson != null;
  const detailsId = `audit-details-${log.id}`;
  const tone = (def.tone ?? "neutral") as "neutral" | "ok" | "warn" | "danger" | "info";

  return (
    <li data-testid={`row-audit-${log.id}`} className={cn("relative border-t border-border first:border-t-0 transition-colors duration-150", open && "bg-secondary/30")}>
      <span aria-hidden className={cn("absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full", RAIL[tone] ?? RAIL.neutral)} />
      <button
        type="button"
        onClick={() => hasDetails && setOpen(o => !o)}
        aria-expanded={hasDetails ? open : undefined}
        aria-controls={hasDetails ? detailsId : undefined}
        disabled={!hasDetails}
        className={cn("w-full text-left pl-4 sm:pl-5 pr-3 sm:pr-4 py-3.5 flex items-start gap-3 sm:gap-4 transition-colors duration-150 enabled:hover:bg-secondary/40 disabled:cursor-default",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
      >
        <time dateTime={log.createdAt} className="font-condensed shrink-0 w-11 pt-[3px] text-[13px] font-bold tabular-nums text-muted-foreground">
          {fmtTime(log.createdAt)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug text-foreground">
            <strong className="font-semibold">{log.userName ?? "Sistema"}</strong>{" "}
            {def.label}
            {def.generic ? <> {entityObject(log.entity)}</> : null}
            {subject ? (def.generic || def.direct ? " " : " · ") : null}
            {subject ? <span className="font-semibold">{subject}</span> : null}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <Chip tone={tone} className="h-5 text-[11px]">{entityLabel(log.entity)}</Chip>
            {changed > 0 && <span className="text-[12.5px] text-muted-foreground tabular-nums">{changed} {changed === 1 ? "campo alterado" : "campos alterados"}</span>}
            {log.impersonatorName && (
              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--status-warn-text)]">
                <UserCog size={13} aria-hidden /> feito por {log.impersonatorName} em Modo Dev
              </span>
            )}
          </div>
        </div>
        {hasDetails && (
          <span className="shrink-0 mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-muted-foreground">
            <span className="hidden sm:inline">{open ? "Fechar" : "O que mudou"}</span>
            <ChevronDown size={16} aria-hidden className={cn("transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} />
          </span>
        )}
      </button>

      {open && hasDetails ? (
        <div id={detailsId} className="pl-4 sm:pl-[80px] pr-3 sm:pr-5 pb-4 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
          <ChangeTable log={log} refs={refs} all={showAll} />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            {log.beforeJson != null && log.afterJson != null ? (
              <button type="button" onClick={() => setShowAll(s => !s)} aria-pressed={showAll} className={cn(btnGhost, "px-2.5 lg:min-h-8 text-[12px]")}>
                {showAll ? "Mostrar só o que mudou" : "Mostrar todos os campos"}
              </button>
            ) : null}
            <details className="group text-[12.5px] text-muted-foreground">
              <summary className={cn("cursor-pointer select-none inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 hover:text-foreground list-none [&::-webkit-details-marker]:hidden", FOCUS_RING)}>
                <Code2 size={13} aria-hidden /> Dados técnicos
              </summary>
              <div className="mt-2 space-y-1.5 font-mono text-[11.5px] break-all">
                <p>registro {log.id} · ação <code>{log.action}</code> · tipo <code>{log.entity}</code>{log.entityId ? <> · id {log.entityId}</> : null}</p>
                {log.beforeJson != null ? <pre className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/50 p-2.5 max-h-64 overflow-auto">antes: {JSON.stringify(parseJson(log.beforeJson), null, 2)}</pre> : null}
                {log.afterJson != null ? <pre className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/50 p-2.5 max-h-64 overflow-auto">depois: {JSON.stringify(parseJson(log.afterJson), null, 2)}</pre> : null}
              </div>
            </details>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ChangeTable({ log, refs, all }: { log: AuditLog; refs: AuditRefs | undefined; all: boolean }) {
  const lines = changeLines(log, refs, all);
  const both = log.beforeJson != null && log.afterJson != null;
  const onlyAfter = log.beforeJson == null;
  if (lines.length === 0) {
    return (
      <p className="rounded-lg bg-secondary/50 px-3.5 py-2.5 text-[13px] text-muted-foreground">
        {both ? "Nenhum campo mudou de valor (a ação foi registrada mesmo assim)." : "Sem detalhes além da própria ação."}
      </p>
    );
  }
  const head = (text: string, cls?: string) => (
    <th scope="col" className={cn("font-condensed px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground", cls)}>{text}</th>
  );
  return (
    <div className="rounded-xl border border-border bg-card overflow-x-auto">
      <table className="w-full text-[13.5px] border-collapse">
        <caption className="sr-only">{both ? "Campos alterados: valor antes e depois" : onlyAfter ? "Dados registrados" : "Dados que foram apagados"}</caption>
        <thead className="bg-secondary/50">
          <tr>
            {head("Campo", "w-[34%]")}
            {both ? <>{head("Antes")}{head("Depois")}</> : head(onlyAfter ? "Registrado" : "Apagado")}
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.key} className={cn("border-t border-border align-top", both && l.changed && "bg-[var(--status-warn-bg)]/25")}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-muted-foreground">{l.label}</th>
              {both ? (
                <>
                  <td className={cn("px-3 py-2 break-words", l.changed ? "text-muted-foreground line-through decoration-muted-foreground/60" : "text-foreground")}>{l.before}</td>
                  <td className={cn("px-3 py-2 break-words text-foreground", l.changed && "font-semibold")}>{l.after}</td>
                </>
              ) : (
                <td className="px-3 py-2 break-words text-foreground">{onlyAfter ? l.after : l.before}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
