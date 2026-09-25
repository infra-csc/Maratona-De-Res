import type { Absence } from "@workspace/api-client-react";
import { Trash2, Pencil, AlertTriangle, Award } from "lucide-react";
import { cn, fmtDate } from "@/lib/utils";
import { CONDENSED, WARNING, GOOD, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { DATE_FULL } from "./helpers";
import type { AbsenceWithAuthor } from "./types";

/** Uma linha da grade de lançamentos (com ações quando o usuário pode editar). */
export function AbsenceRow({ a, canEdit, typeLabel, onEdit, onDelete }: {
  a: Absence;
  canEdit: boolean | null;
  typeLabel: (slug: string) => string;
  onEdit: (a: Absence) => void;
  onDelete: (id: number) => void;
}) {
  const isMerit = a.kind === "merit";
  return (
    <tr
      data-testid={`row-absence-${a.id}`}
      className="transition-colors group"
      style={{ borderTop: "1px solid var(--border)", borderLeft: `3px solid ${isMerit ? GOOD : "#e84000"}` }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--secondary)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "transparent"; }}
    >
      <td className="px-5 py-3.5 font-black uppercase text-[13px]" style={{ fontFamily: CONDENSED, color: "var(--foreground)" }}>
        {a.employeeName}
      </td>
      <td className="px-5 py-3.5">
        <span className={cn(
          "inline-flex items-center gap-1 font-black px-2.5 py-1 rounded text-[11px] uppercase",
          isMerit ? "bg-[rgba(154,176,0,0.15)] text-[#9ab000]" : "bg-[rgba(229,72,77,0.15)] text-[#e5484d]",
        )}>
          {isMerit ? <Award size={11} /> : <AlertTriangle size={11} />}
          {typeLabel(a.penaltyType)}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {a.eventName || <span className="text-xs opacity-50">Ciclo</span>}
      </td>
      <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
        {fmtDate(a.date, DATE_FULL)}
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className="inline-block font-black px-2.5 py-1 rounded text-xs" style={{ backgroundColor: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}>
          {String(a.quantity).padStart(2, "0")}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className="inline-block font-black px-2.5 py-1 rounded text-xs" style={{ backgroundColor: isMerit ? "rgba(154,176,0,0.15)" : "rgba(229,72,77,0.15)", color: isMerit ? GOOD_TEXT : DANGER_TEXT }}>
          {isMerit ? "+" : "−"}{a.points * a.quantity}
        </span>
      </td>
      <td className="px-5 py-3.5 text-sm" style={{ color: "var(--muted-foreground)", maxWidth: "22rem" }}>
        <span className="block leading-snug" style={{ wordBreak: "break-word", whiteSpace: "normal" }}>
          {a.reason || <span className="text-xs opacity-50">Sem justificativa</span>}
        </span>
        {((a as AbsenceWithAuthor).registeredByUserName || a.createdAt) && (
          <span className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] opacity-60">
            {(a as AbsenceWithAuthor).registeredByUserName && (
              <>
                <span className="font-bold uppercase tracking-wide">por</span>
                <span>{(a as AbsenceWithAuthor).registeredByUserName}</span>
              </>
            )}
            {a.createdAt && (
              <span className="font-mono" title="Data/hora do lançamento">
                {(a as AbsenceWithAuthor).registeredByUserName ? "·" : ""} {new Date(a.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </span>
        )}
      </td>
      {canEdit && (
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              data-testid={`button-edit-absence-${a.id}`}
              className="p-1.5 rounded transition-opacity hover:opacity-60"
              style={{ color: "var(--muted-foreground)" }}
              onClick={() => onEdit(a)}
              title="Editar"
              aria-label={`Editar lançamento de ${a.employeeName ?? "colaborador"}`}
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              data-testid={`button-delete-absence-${a.id}`}
              className="p-1.5 rounded transition-colors"
              style={{ color: "var(--muted-foreground)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = WARNING; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-foreground)"; }}
              onClick={() => onDelete(a.id)}
              title="Excluir"
              aria-label={`Excluir lançamento de ${a.employeeName ?? "colaborador"}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
