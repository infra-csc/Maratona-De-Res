// Um lançamento: LINHA da tabela (telas largas) ou CARTÃO (celular/tablet).
// O efeito na nota sai dos pontos ÷ eventos com nota do colaborador no ciclo.
import type { Absence } from "@workspace/api-client-react";
import { CalendarDays, Lock, Pencil, Trash2 } from "lucide-react";
import { cn, fmtDate, fmtDateTime, fmtScore, plural } from "@/lib/utils";
import { Avatar, Eyebrow, FOCUS_RING, KindChip, SignedNumber, btnSmall, iconBtn, surfaceCls } from "./absences-ui";
import { DATE_FULL, fmtEffect, scoreEffect, signedPts, totalPoints } from "./helpers";
import type { AbsenceWithAuthor, EmployeeScore } from "./types";

export interface AbsenceRowProps {
  a: Absence;
  canEdit: boolean;
  /** Ciclo fechado: a API recusa editar/excluir este lançamento. */
  locked: boolean;
  score: EmployeeScore | undefined;
  typeLabel: (slug: string) => string;
  onEdit: (a: Absence) => void;
  onDelete: (a: Absence) => void;
  onPickEmployee: (id: number) => void;
  /** Acabou de ser salvo: destaque curto. */
  fresh?: boolean;
}

const LOCK_TEXT = "Ciclo fechado: só consulta";

function author(a: Absence) {
  const by = (a as AbsenceWithAuthor).registeredByUserName;
  const at = a.createdAt ? fmtDateTime(a.createdAt, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;
  if (!by && !at) return null;
  return <>{by && <>por <span className="font-semibold">{by}</span></>}{by && at ? " · " : ""}{at && <span className="tabular-nums" title="Quando foi lançado">{at}</span>}</>;
}

function EmployeeCell({ a, score, onPickEmployee }: Pick<AbsenceRowProps, "a" | "score" | "onPickEmployee">) {
  const name = a.employeeName ?? "Colaborador";
  return (
    <div className="flex items-center gap-3 min-w-0">
      <Avatar name={name} className="w-9 h-9 text-[13px]" />
      <div className="min-w-0">
        <button type="button" onClick={() => onPickEmployee(a.employeeId)} title={`Ver só os lançamentos de ${name}`}
          className={cn("block max-w-full truncate text-left font-semibold text-foreground leading-tight rounded-sm underline-offset-2 hover:underline", FOCUS_RING)}>
          {name}
        </button>
        <span className="block text-[12.5px] text-muted-foreground tabular-nums mt-0.5">
          {score ? <>{plural(score.eventsCount, "evento", "eventos")} · nota {fmtScore(score.finalResult)}</> : "Sem nota no ciclo ainda"}
        </span>
      </div>
    </div>
  );
}

function PointsCell({ a }: { a: Absence }) {
  return (
    <>
      <SignedNumber kind={a.kind} className="text-[20px]">{signedPts(a.kind, totalPoints(a))}</SignedNumber>
      {a.quantity > 1 && <span className="block mt-1 text-[12px] text-muted-foreground tabular-nums">{a.quantity} × {a.points.toLocaleString("pt-BR")} pts</span>}
    </>
  );
}

function EffectCell({ a, score }: { a: Absence; score: EmployeeScore | undefined }) {
  const effect = scoreEffect(totalPoints(a), score?.eventsCount);
  if (effect == null) return <span className="text-[13px] text-muted-foreground" title="O colaborador ainda não tem evento com nota neste ciclo">sem eventos</span>;
  return (
    <span title={`${totalPoints(a)} pts ÷ ${plural(score!.eventsCount, "evento", "eventos")}`}>
      <SignedNumber kind={a.kind} className="text-[17px]">{fmtEffect(a.kind, effect)}</SignedNumber>
      <span className="block mt-1 text-[12px] text-muted-foreground tabular-nums">÷ {plural(score!.eventsCount, "evento", "eventos")}</span>
    </span>
  );
}

function Actions({ a, locked, onEdit, onDelete, layout }: Pick<AbsenceRowProps, "a" | "locked" | "onEdit" | "onDelete"> & { layout: "row" | "card" }) {
  const who = a.employeeName ?? "colaborador";
  if (locked) {
    return layout === "card"
      ? <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground"><Lock size={13} aria-hidden /> {LOCK_TEXT}</span>
      : <span className="flex justify-end"><span className="w-9 h-9 inline-flex items-center justify-center rounded-lg bg-secondary text-muted-foreground" title={LOCK_TEXT}><Lock size={14} aria-hidden /><span className="sr-only">{LOCK_TEXT}</span></span></span>;
  }
  if (layout === "card") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <button type="button" data-testid={`button-edit-absence-${a.id}`} onClick={() => onEdit(a)} aria-label={`Editar lançamento de ${who}`} className={btnSmall}>
          <Pencil size={14} aria-hidden /> Editar
        </button>
        <button type="button" data-testid={`button-delete-absence-${a.id}`} onClick={() => onDelete(a)} aria-label={`Excluir lançamento de ${who}`}
          className={cn(btnSmall, "text-[var(--status-danger-text)] enabled:hover:bg-[var(--status-danger-bg)]")}>
          <Trash2 size={14} aria-hidden /> Excluir
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" data-testid={`button-edit-absence-${a.id}`} onClick={() => onEdit(a)} title="Editar" aria-label={`Editar lançamento de ${who}`} className={iconBtn}>
        <Pencil size={14} aria-hidden />
      </button>
      <button type="button" data-testid={`button-delete-absence-${a.id}`} onClick={() => onDelete(a)} title="Excluir" aria-label={`Excluir lançamento de ${who}`}
        className={cn(iconBtn, "text-muted-foreground hover:text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)] hover:border-[var(--status-danger)]/40")}>
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}

const td = "px-3 py-3.5 align-top";

export function AbsenceRow(p: AbsenceRowProps) {
  const { a } = p;
  const by = author(a);
  return (
    <tr data-testid={`row-absence-${a.id}`} className={cn("border-t border-border transition-colors duration-500 motion-reduce:transition-none", p.fresh ? "bg-[var(--status-ok-bg)]" : "hover:bg-secondary/40")}>
      <td className={cn(td, "pl-5")}><EmployeeCell a={a} score={p.score} onPickEmployee={p.onPickEmployee} /></td>
      <td className={td}>
        <KindChip kind={a.kind}>{p.typeLabel(a.penaltyType)}</KindChip>
        <span className="block mt-1.5 text-[12.5px] leading-snug text-muted-foreground">{a.eventName ?? "No ciclo, sem evento"}</span>
      </td>
      <td className={cn(td, "whitespace-nowrap tabular-nums text-[14px] text-foreground")}>{fmtDate(a.date, DATE_FULL)}</td>
      <td className={cn(td, "text-right")}><PointsCell a={a} /></td>
      <td className={cn(td, "text-right")}><EffectCell a={a} score={p.score} /></td>
      <td className={cn(td, "text-[13.5px]")}>
        {a.reason
          ? <span className="block leading-snug text-foreground line-clamp-2 break-words" title={a.reason}>{a.reason}</span>
          : <span className="block text-muted-foreground">Sem observação</span>}
        {by && <span className="block mt-1 text-[12px] text-muted-foreground">{by}</span>}
      </td>
      {p.canEdit && <td className={cn(td, "pr-4")}><Actions a={a} locked={p.locked} onEdit={p.onEdit} onDelete={p.onDelete} layout="row" /></td>}
    </tr>
  );
}

export function AbsenceCard(p: AbsenceRowProps) {
  const { a } = p;
  const by = author(a);
  return (
    <li data-testid={`row-absence-${a.id}`} className={cn(surfaceCls, "p-4 flex flex-col gap-3.5 transition-colors duration-500 motion-reduce:transition-none", p.fresh && "bg-[var(--status-ok-bg)]")}>
      <div className="flex items-start justify-between gap-3">
        <EmployeeCell a={a} score={p.score} onPickEmployee={p.onPickEmployee} />
        <span className="shrink-0 inline-flex items-center gap-1 text-[12.5px] text-muted-foreground tabular-nums pt-0.5">
          <CalendarDays size={13} aria-hidden />{fmtDate(a.date, DATE_FULL)}
        </span>
      </div>
      <div className="min-w-0">
        <KindChip kind={a.kind}>{p.typeLabel(a.penaltyType)}</KindChip>
        <span className="block mt-1.5 text-[13px] leading-snug text-muted-foreground">{a.eventName ?? "No ciclo, sem evento"}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 border-t border-border pt-3">
        <div><dt><Eyebrow as="span">Pontos</Eyebrow></dt><dd className="mt-2"><PointsCell a={a} /></dd></div>
        <div><dt><Eyebrow as="span">Efeito na nota</Eyebrow></dt><dd className="mt-2"><EffectCell a={a} score={p.score} /></dd></div>
      </dl>
      {(a.reason || by) && (
        <div className="text-[13.5px] leading-snug">
          {a.reason && <p className="text-foreground break-words">{a.reason}</p>}
          {by && <p className="mt-1 text-[12px] text-muted-foreground">{by}</p>}
        </div>
      )}
      {p.canEdit && <Actions a={a} locked={p.locked} onEdit={p.onEdit} onDelete={p.onDelete} layout="card" />}
    </li>
  );
}
