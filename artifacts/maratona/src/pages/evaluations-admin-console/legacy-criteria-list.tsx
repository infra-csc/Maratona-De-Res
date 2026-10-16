// Fluxo antigo (ciclo sem avaliação por área): lista de critérios do evento
// com o avaliador designado, a situação e a atribuição — mais a atribuição
// rápida por área para os critérios ainda sem ninguém.
import type { Dispatch, SetStateAction } from "react";
import { Clock, Eye, Link2, ListX, Lock, UserCheck, UserX } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { STATE_CFG, fmtDT } from "./helpers";
import { InlinePicker } from "./pickers";
import { AreaModeOldDesignation, AreaModeResponder } from "./area-mode-bits";
import { Chip, EmptyBlock, Eyebrow, btnSmall, STATE_BAR, STATE_TONE } from "./console-ui";
import type { CritRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;
const small = cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12.5px]");

/** Áreas com critérios sem avaliador: atribuição de todos de uma vez. */
export function BulkAssign({ selected, bulkAssignAreaId, setBulkAssignAreaId, bulkBusy, handleBulkAssign }: {
  selected: EnrichedEvent;
  bulkAssignAreaId: number | null;
  setBulkAssignAreaId: SetState<number | null>;
  bulkBusy: boolean;
  handleBulkAssign: (areaId: number, userId: number) => void;
}) {
  const byArea = new Map<number, { areaId: number; areaName: string; count: number }>();
  for (const c of selected.criteria.filter(cr => cr.state === "unassigned" && cr.areaId != null)) {
    const cur = byArea.get(c.areaId!) ?? { areaId: c.areaId!, areaName: c.areaName, count: 0 };
    cur.count++;
    byArea.set(c.areaId!, cur);
  }
  const areas = [...byArea.values()];
  if (areas.length === 0) return null;
  return (
    <section aria-label="Atribuição rápida por área" className="mb-4 rounded-xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-bg)]/60 p-3.5">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-foreground">
        <UserX size={15} aria-hidden className="text-[var(--status-danger-text)]" />
        {plural(selected.unassigned, "critério", "critérios")} sem avaliador — atribua por área
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {areas.map(a => {
          const open = bulkAssignAreaId === a.areaId;
          return (
            <li key={a.areaId} className="rounded-lg bg-card border border-border overflow-hidden">
              <div className="flex items-center justify-between gap-2 pl-3 pr-1.5 py-1.5">
                <span className="text-[13.5px] min-w-0 truncate"><b className="font-condensed font-black uppercase text-[14.5px]">{a.areaName}</b> <span className="text-muted-foreground">· {plural(a.count, "sem avaliador", "sem avaliador")}</span></span>
                <button type="button" aria-expanded={open} onClick={() => setBulkAssignAreaId(open ? null : a.areaId)}
                  className={cn(small, !open && "bg-primary text-primary-foreground border-transparent enabled:hover:bg-primary enabled:hover:opacity-90")}>
                  {open ? "Fechar" : "Atribuir área"}
                </button>
              </div>
              {open && (
                <div className="px-3 pb-3 pt-1 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
                  <Eyebrow className="mb-2">
                    {bulkBusy ? "Atribuindo…" : a.count === 1 ? `Quem avalia o critério de ${a.areaName}` : `Quem avalia os ${a.count} critérios de ${a.areaName}`}
                  </Eyebrow>
                  <InlinePicker areaId={a.areaId} disabled={bulkBusy} onPick={(uid) => handleBulkAssign(a.areaId, uid)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Lista de critérios do fluxo antigo (por designação). */
export function LegacyCriteriaList({ criteria, canManage, canViewSubmissions, canLink, openPickerCriterionId, setOpenPickerCriterionId, handleAssign, openLinkDialog, setViewEvalCrit }: {
  criteria: CritRow[];
  canManage: boolean;
  canViewSubmissions: boolean;
  canLink: (c: CritRow) => boolean;
  openPickerCriterionId: number | null;
  setOpenPickerCriterionId: SetState<number | null>;
  handleAssign: (criterionId: number, userId: number) => void;
  openLinkDialog: (c: CritRow) => void;
  setViewEvalCrit: SetState<CritRow | null>;
}) {
  if (criteria.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border">
        <EmptyBlock icon={ListX} className="py-8" title="Nenhum critério neste filtro">Troque o filtro acima para ver os demais.</EmptyBlock>
      </div>
    );
  }
  return (
    <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden" aria-label="Critérios do evento">
      {criteria.map(c => {
        const cfg = STATE_CFG[c.state];
        const pickerOpen = openPickerCriterionId === c.criterionId;
        return (
          <li key={c.criterionId} className="relative pl-4 pr-3 py-3" data-testid={`legacy-row-${c.criterionId}`}>
            <span aria-hidden className={cn("absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full", STATE_BAR[c.state])} />
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1 basis-56">
                <Eyebrow>{c.areaName}</Eyebrow>
                <p className="font-condensed mt-1 text-[16px] font-black uppercase leading-tight text-foreground break-words">{displayCriterionName(c.criterionName)}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                  {c.areaMode ? (
                    <span className="flex flex-col"><AreaModeResponder c={c} /><AreaModeOldDesignation c={c} /></span>
                  ) : c.assignedToId != null ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-foreground"><UserCheck size={14} aria-hidden className="text-muted-foreground" />{c.assignedToName}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--status-danger-text)]"><UserX size={14} aria-hidden />Nenhum avaliador atribuído</span>
                  )}
                  {c.formSubmitterName && c.formSubmitterName !== c.assignedToName && !c.areaMode && (
                    <span className="text-muted-foreground">Preenchido por <b className="font-semibold text-foreground">{c.formSubmitterName}</b></span>
                  )}
                  {c.submittedAt && (
                    <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground"><Clock size={13} aria-hidden /> {fmtDT(c.submittedAt)}</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 justify-end">
                <Chip tone={STATE_TONE[c.state]}>{cfg.label}</Chip>
                {canManage && canLink(c) && (
                  <button type="button" onClick={() => openLinkDialog(c)} className={small} title="Gerar link para freela" aria-label={`Link para freela: ${displayCriterionName(c.criterionName)}`}>
                    <Link2 size={13} aria-hidden /> Link
                  </button>
                )}
                {canManage && c.score != null && canViewSubmissions && (
                  <button type="button" onClick={() => setViewEvalCrit(c)} className={small} title="Ver resposta enviada">
                    <Eye size={13} aria-hidden /> Ver
                  </button>
                )}
                {canManage && (c.state === "done" ? (
                  <span className="inline-flex items-center gap-1 px-2 text-[12.5px] text-muted-foreground" title="Resposta enviada — reatribuição bloqueada">
                    <Lock size={13} aria-hidden /> Bloqueado
                  </span>
                ) : c.areaMode ? null : (
                  <button type="button" aria-expanded={pickerOpen} onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                    className={cn(small, c.assignedToId == null && "bg-primary text-primary-foreground border-transparent enabled:hover:bg-primary enabled:hover:opacity-90", pickerOpen && c.assignedToId != null && "bg-secondary")}>
                    {c.assignedToId == null ? "Atribuir" : pickerOpen ? "Fechar" : "Gerenciar"}
                  </button>
                ))}
              </div>
            </div>
            {pickerOpen && c.areaId != null && (
              <div className="mt-3 rounded-lg bg-secondary/50 p-3 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
                <Eyebrow className="mb-2">Avaliadores disponíveis · {c.areaName}</Eyebrow>
                <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
