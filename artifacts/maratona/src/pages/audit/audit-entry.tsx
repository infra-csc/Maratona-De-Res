import { useState } from "react";
import type { AuditLog, AuditRefs } from "@workspace/api-client-react";
import { ChevronDown, UserCog } from "lucide-react";
import { StatusBadge } from "@/components/shared";
import { CONDENSED, BODY, AMBER_TEXT } from "@/lib/premium-theme";
import { actionDef, entityLabel, entityObject } from "./labels";
import { changeLines, countChanged, subjectOf, parseJson } from "./describe";
import { fmtTime } from "./dates";

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

  return (
    <li data-testid={`row-audit-${log.id}`} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={() => hasDetails && setOpen(o => !o)}
        aria-expanded={hasDetails ? open : undefined}
        aria-controls={hasDetails ? detailsId : undefined}
        disabled={!hasDetails}
        className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--muted)] disabled:hover:bg-transparent disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-inset"
      >
        <time
          dateTime={log.createdAt}
          className="shrink-0 w-11 pt-0.5 text-[12px] font-bold tabular-nums"
          style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}
        >
          {fmtTime(log.createdAt)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug" style={{ fontFamily: BODY, color: "var(--foreground)" }}>
            <strong className="font-semibold">{log.userName ?? "Sistema"}</strong>{" "}
            {def.label}
            {def.generic ? <> {entityObject(log.entity)}</> : null}
            {subject
              ? (def.generic || def.direct ? " " : " · ")
              : null}
            {subject ? <span className="font-semibold">{subject}</span> : null}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge variant={def.tone} size="sm" label={entityLabel(log.entity)} />
            {changed > 0 ? (
              <span className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
                {changed} {changed === 1 ? "campo alterado" : "campos alterados"}
              </span>
            ) : null}
            {log.impersonatorName ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: AMBER_TEXT }}>
                <UserCog size={13} aria-hidden="true" /> feito por {log.impersonatorName} em Modo Dev
              </span>
            ) : null}
          </div>
        </div>
        {hasDetails ? (
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="shrink-0 mt-1 transition-transform"
            style={{ color: "var(--muted-foreground)", transform: open ? "rotate(180deg)" : undefined }}
          />
        ) : null}
      </button>

      {open && hasDetails ? (
        <div id={detailsId} className="px-4 pb-4 sm:pl-[68px]">
          <ChangeTable log={log} refs={refs} all={showAll} />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {log.beforeJson != null && log.afterJson != null ? (
              <button
                type="button"
                onClick={() => setShowAll(s => !s)}
                className="text-[12px] font-semibold underline underline-offset-2"
                style={{ color: "var(--accent-text)" }}
              >
                {showAll ? "Mostrar só o que mudou" : "Mostrar todos os campos"}
              </button>
            ) : null}
            <details className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>
              <summary className="cursor-pointer select-none">Dados técnicos</summary>
              <div className="mt-2 space-y-1 font-mono text-[11px] break-all">
                <p>registro {log.id} · ação <code>{log.action}</code> · tipo <code>{log.entity}</code>{log.entityId ? <> · id {log.entityId}</> : null}</p>
                {log.beforeJson != null ? <pre className="whitespace-pre-wrap rounded-md p-2" style={{ backgroundColor: "var(--muted)" }}>antes: {JSON.stringify(parseJson(log.beforeJson), null, 2)}</pre> : null}
                {log.afterJson != null ? <pre className="whitespace-pre-wrap rounded-md p-2" style={{ backgroundColor: "var(--muted)" }}>depois: {JSON.stringify(parseJson(log.afterJson), null, 2)}</pre> : null}
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
      <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>
        {both ? "Nenhum campo mudou de valor (a ação foi registrada mesmo assim)." : "Sem detalhes além da própria ação."}
      </p>
    );
  }
  const head = (text: string) => (
    <th scope="col" className="px-3 py-2 text-left text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{text}</th>
  );
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-[13px]">
        <caption className="sr-only">{both ? "Campos alterados: valor antes e depois" : onlyAfter ? "Dados registrados" : "Dados que foram apagados"}</caption>
        <thead style={{ backgroundColor: "var(--muted)" }}>
          <tr>
            {head("Campo")}
            {both ? <>{head("Antes")}{head("Depois")}</> : head(onlyAfter ? "Registrado" : "Apagado")}
          </tr>
        </thead>
        <tbody>
          {lines.map(l => (
            <tr key={l.key} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
              <th scope="row" className="px-3 py-2 text-left font-medium w-[34%]" style={{ color: "var(--muted-foreground)" }}>{l.label}</th>
              {both ? (
                <>
                  <td className="px-3 py-2 break-words" style={{ color: l.changed ? "var(--muted-foreground)" : "var(--foreground)", textDecoration: l.changed ? "line-through" : undefined }}>{l.before}</td>
                  <td className="px-3 py-2 break-words" style={{ color: "var(--foreground)", fontWeight: l.changed ? 600 : undefined }}>{l.after}</td>
                </>
              ) : (
                <td className="px-3 py-2 break-words" style={{ color: "var(--foreground)" }}>{onlyAfter ? l.after : l.before}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
