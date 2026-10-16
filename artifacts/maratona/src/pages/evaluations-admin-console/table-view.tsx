import { Fragment, useState, type Dispatch, type SetStateAction } from "react";
import type { AdminPublicToken } from "@/lib/routing-api";
import { Clock, Info, Link2, Lock, UserCheck } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { displayCriterionName } from "@/lib/criterion-name";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { AreaBoard, boardGroups, type AreaBoardMode } from "./area-board";
import { STATE_CFG, fmtDT } from "./helpers";
import { EventCombobox, InlinePicker } from "./pickers";
import { AreaModeOldDesignation, AreaModeResponder } from "./area-mode-bits";
import { Chip, Eyebrow, Segmented, btnSmall, surfaceCls, STATE_TONE } from "./console-ui";
import type { ConformityKey, ConformityLinkDialogState, ConformityRow, CritRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;
const small = cn(btnSmall, "min-h-11 lg:min-h-8 px-2.5 text-[12.5px]");
const th = "font-condensed px-4 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap";
const td = "px-4 py-3 align-middle";

/** Aba Tabela — acompanhamento critério a critério do evento selecionado. */
export function TableView(props: {
  selected: EnrichedEvent;
  enrichedEvents: EnrichedEvent[];
  setSelectedEventId: SetState<number | null>;
  conformityRows: ConformityRow[];
  canManage: boolean;
  openPickerCriterionId: number | null;
  setOpenPickerCriterionId: SetState<number | null>;
  handleAssign: (criterionId: number, userId: number) => void;
  openLinkDialog: (c: CritRow) => void;
  setConformityLinkDialog: SetState<ConformityLinkDialogState | null>;
  setOpenConformityPicker: SetState<ConformityKey | null>;
  allTokens: AdminPublicToken[] | undefined;
  canViewSubmissions: boolean;
  setViewEvalCrit: SetState<CritRow | null>;
}) {
  const {
    selected, enrichedEvents, setSelectedEventId, conformityRows, canManage, openPickerCriterionId, setOpenPickerCriterionId,
    handleAssign, openLinkDialog, setConformityLinkDialog, setOpenConformityPicker, allTokens, canViewSubmissions, setViewEvalCrit,
  } = props;
  // Ciclo por área: o mesmo quadro por área/critério da aba Eventos (a tabela
  // de um critério por linha virava 20 linhas com as cópias multiárea).
  const [boardMode, setBoardMode] = useState<AreaBoardMode>("area");
  const areaMode = selected.areaMode;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <EventCombobox events={enrichedEvents} value={selected.id} onChange={setSelectedEventId} />
        <p className="text-[13.5px] text-muted-foreground">
          <b className="font-condensed text-[18px] font-black tabular-nums text-foreground">{selected.done}/{selected.total}</b>{" "}
          {areaMode ? (selected.total === 1 ? "resposta das áreas" : "respostas das áreas") : (selected.total === 1 ? "critério completo" : "critérios completos")}
        </p>
      </div>

      {areaMode && (
        <section className={cn(surfaceCls, "@container p-4 sm:p-5 space-y-3")} aria-label="Critérios do evento">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Segmented<AreaBoardMode> label="Agrupar" value={boardMode} onChange={setBoardMode}
              options={[{ value: "area", label: "Por área" }, { value: "criterion", label: "Por critério" }]} />
            <p className="flex items-start gap-2 text-[13px] leading-snug text-muted-foreground" data-testid="table-area-mode-note">
              <Info size={14} className="shrink-0 mt-[2px]" aria-hidden />
              <span><b className="font-semibold text-foreground">No ciclo por área, só o avaliador da área responde</b> — ninguém precisa ser designado. Ajustes na Calibração.</span>
            </p>
          </div>
          <AreaBoard
            selected={selected}
            groups={boardGroups(selected, boardMode)}
            mode={boardMode}
            canManage={canManage}
            canViewSubmissions={canViewSubmissions}
            tokens={allTokens}
            openLinkDialog={openLinkDialog}
            setViewEvalCrit={c => setViewEvalCrit(c)}
          />
        </section>
      )}

      <section className={cn(surfaceCls, "overflow-hidden")} aria-labelledby="table-title">
        <div className="px-4 sm:px-5 py-3 border-b border-border flex items-baseline justify-between gap-3">
          <Eyebrow as="h2" id="table-title">{areaMode ? "Matriz de conformidade" : "Critérios e Matriz"}</Eyebrow>
          {!areaMode && <span className="text-[12.5px] text-muted-foreground">{plural(selected.criteria.length + conformityRows.length, "linha", "linhas")}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
            <thead className="bg-secondary/50">
              <tr>
                <th className={th}>{areaMode ? "Matriz" : "Critério"}</th>
                <th className={th}>Área</th>
                <th className={th}>{areaMode ? "Responsável" : "Avaliador"}</th>
                <th className={th}>Enviado em</th>
                <th className={th}>Situação</th>
                <th className={cn(th, "text-right")}><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!areaMode && selected.criteria.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum critério ativo neste evento.</td></tr>
              )}
              {!areaMode && selected.criteria.map(c => {
                const cfg = STATE_CFG[c.state];
                const pickerOpen = openPickerCriterionId === c.criterionId;
                // Por área, ficar sem designado é o normal: sem linha rosada nem "Sem avaliador" vermelho.
                const missing = c.assignedToId == null && !c.areaMode;
                return (
                  <Fragment key={c.criterionId}>
                  <tr className={cn("transition-colors duration-150 hover:bg-secondary/40", missing && "bg-[var(--status-danger-bg)]/40")}>
                    <td className={cn(td, "font-condensed text-[15px] font-black uppercase leading-tight text-foreground")}>{displayCriterionName(c.criterionName)}</td>
                    <td className={cn(td, "text-muted-foreground")}>{c.areaName}</td>
                    <td className={td}>
                      {c.areaMode ? (<><AreaModeResponder c={c} /><AreaModeOldDesignation c={c} /></>) : (
                        <>
                          <span className={cn("font-semibold", missing ? "text-[var(--status-danger-text)]" : "text-foreground")}>{c.assignedToName ?? "Sem avaliador"}</span>
                          {c.formSubmitterName && c.formSubmitterName !== c.assignedToName && (
                            <span className="flex items-center gap-1 mt-0.5 text-[12.5px] text-muted-foreground"><UserCheck size={12} aria-hidden /> {c.formSubmitterName}</span>
                          )}
                        </>
                      )}
                    </td>
                    <td className={cn(td, "tabular-nums text-muted-foreground whitespace-nowrap")}>
                      {c.submittedAt ? <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden /> {fmtDT(c.submittedAt)}</span> : "—"}
                    </td>
                    <td className={td}><Chip tone={STATE_TONE[c.state]}>{cfg.label}</Chip></td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && !selected.nextCycle && (c.areaMode ? c.state !== "done" && c.areaId != null : c.assignedToId != null) && (
                          <button type="button" onClick={() => openLinkDialog(c)} className={small} title="Gerar link para freela"><Link2 size={13} aria-hidden /> Link</button>
                        )}
                        {canManage && (c.state === "done" ? (
                          <span className="inline-flex items-center gap-1 px-2 text-[12.5px] text-muted-foreground whitespace-nowrap" title="Resposta enviada — reatribuição bloqueada"><Lock size={13} aria-hidden /> Bloqueado</span>
                        ) : c.areaMode ? (
                          c.assignedToId == null || selected.nextCycle ? <span className="text-muted-foreground">—</span> : null
                        ) : (
                          <button type="button" aria-expanded={pickerOpen} onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                            className={cn(small, c.assignedToId == null && "bg-primary text-primary-foreground border-transparent enabled:hover:bg-primary enabled:hover:opacity-90")}>
                            {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {pickerOpen && c.areaId != null && (
                    <tr className="bg-secondary/40">
                      <td colSpan={6} className="px-4 py-3">
                        <Eyebrow className="mb-2">Avaliadores disponíveis · {c.areaName}</Eyebrow>
                        <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {/* ── Linhas da Matriz de Conformidade ── */}
              {conformityRows.map(cf => {
                const isDone = cf.filled >= cf.total;
                const hasEvaluator = cf.evaluatorId != null;
                return (
                  <tr key={cf.key} className={cn("transition-colors duration-150 hover:bg-secondary/40", !hasEvaluator && "bg-[var(--status-danger-bg)]/40")}>
                    <td className={td}>
                      <span className="block font-condensed text-[15px] font-black uppercase leading-tight text-foreground">{cf.name}</span>
                      <span className="block text-[12.5px] text-muted-foreground mt-0.5">{cf.scope}</span>
                    </td>
                    <td className={cn(td, "text-muted-foreground")}>{cf.key === "cenografia" ? "Cenografia" : "Ferramentas"}</td>
                    <td className={cn(td, "font-semibold", hasEvaluator ? "text-foreground" : "text-[var(--status-danger-text)]")}>{cf.evaluatorName ?? "Sem responsável"}</td>
                    <td className={cn(td, "text-muted-foreground")}>{isDone ? <span className="inline-flex items-center gap-1.5 text-[var(--status-ok-text)]"><Clock size={13} aria-hidden /> Preenchido</span> : "—"}</td>
                    <td className={td}><Chip tone={isDone ? "ok" : hasEvaluator ? "neutral" : "danger"}>{isDone ? "Completo" : hasEvaluator ? "Aguardando" : "Sem responsável"}</Chip></td>
                    <td className={td}>
                      <div className="flex items-center justify-end gap-1.5">
                        {canManage && hasEvaluator && !selected.nextCycle && (
                          <button type="button" onClick={() => setConformityLinkDialog({ key: cf.key, label: cf.name, evaluatorId: cf.evaluatorId, evaluatorName: cf.evaluatorName })} className={small} title="Gerar link para preenchimento">
                            <Link2 size={13} aria-hidden /> Link
                          </button>
                        )}
                        {/* Responsável da Matriz: dá para escolher também no evento do próximo ciclo (preparação). */}
                        {canManage && (
                          <button type="button" onClick={() => setOpenConformityPicker(cf.key)}
                            className={cn(small, !hasEvaluator && "bg-primary text-primary-foreground border-transparent enabled:hover:bg-primary enabled:hover:opacity-90")}>
                            {!hasEvaluator ? "Definir" : "Trocar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <p className="text-[13px] text-muted-foreground">
        {selected.nextCycle
          ? <>{NEXT_CYCLE_NOTICE} Use o seletor acima para trocar de evento.</>
          : areaMode
          ? <>Nos critérios, qualquer avaliador da área responde — não há o que atribuir. Na Matriz, <b className="font-semibold text-foreground">Trocar</b> leva à aba Eventos para escolher quem responde.</>
          : <>Clique em <b className="font-semibold text-foreground">Atribuir</b> numa linha sem avaliador para escolher quem responde. Use o seletor acima para trocar de evento.</>}
      </p>
    </div>
  );
}
