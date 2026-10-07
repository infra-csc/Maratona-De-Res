import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { useGenerateCriterionAssignments } from "@/lib/routing-api";
import { CheckCircle2, Clock, Link2, CheckCircle, Lock, RefreshCw, UserCheck, Calendar, AlertTriangle, CalendarClock, Info } from "lucide-react";
import { plural } from "@/lib/utils";
import { CONDENSED, WARNING, AMBER, GOOD, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { STATE_CFG, computeCriteriaFilter, fmtDT } from "./helpers";
import { InlinePicker } from "./pickers";
import { AreaModeOldDesignation, AreaModeResponder } from "./area-mode-bits";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import type { ConfirmResultsMutation, ToastFn } from "./use-event-mutations";
import type { CriteriaManagement } from "./use-criteria-management";
import type { CritFilter, CritRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Coluna direita da aba Atribuição — matriz de atribuição do evento selecionado. */
export function EventAssignmentPanel(props: {
  selected: EnrichedEvent;
  canManage: boolean;
  canViewSubmissions: boolean;
  todayStr: string;
  toast: ToastFn;
  confirmResults: ConfirmResultsMutation;
  resyncCriteria: CriteriaManagement["resyncCriteria"];
  generateAssignments: ReturnType<typeof useGenerateCriterionAssignments>;
  batchRunning: boolean;
  handleGenerateAllLinks: () => void;
  critFilter: CritFilter;
  setCritFilter: SetState<CritFilter>;
  bulkAssignAreaId: number | null;
  setBulkAssignAreaId: SetState<number | null>;
  bulkBusy: boolean;
  handleBulkAssign: (areaId: number, userId: number) => void;
  openPickerCriterionId: number | null;
  setOpenPickerCriterionId: SetState<number | null>;
  handleAssign: (criterionId: number, userId: number) => void;
  openLinkDialog: (c: CritRow) => void;
  setViewEvalCrit: SetState<CritRow | null>;
  /** Bloco "Matriz de conformidade" (renderizado ao final do corpo). */
  conformitySection: ReactNode;
}) {
  const {
    selected, canManage, canViewSubmissions, todayStr, toast, confirmResults, resyncCriteria, generateAssignments,
    batchRunning, handleGenerateAllLinks, critFilter, setCritFilter, bulkAssignAreaId, setBulkAssignAreaId, bulkBusy, handleBulkAssign,
    openPickerCriterionId, setOpenPickerCriterionId, handleAssign, openLinkDialog, setViewEvalCrit, conformitySection,
  } = props;
  const { filteredCriteria, critPillCounts } = computeCriteriaFilter(selected, critFilter);
  // Ainda não aceita avaliação: do próximo ciclo ou o evento não terminou — não é "A fazer".
  const waiting = selected.queueTab === "waiting" && !!selected.opensLabel;
  // Avaliação por área: ninguém precisa ser designado — sem "Sem avaliador",
  // sem "Atribuir"; designação antiga aparece só como informação.
  const areaMode = selected.areaMode;
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-[18px] py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {waiting ? (
                <>
                  {/* Um selo só: "Próximo ciclo" (frase única no título e no aviso abaixo) ou "Abre em DD/MM". */}
                  <span data-testid="panel-opens" title={selected.nextCycle ? NEXT_CYCLE_NOTICE : "A avaliação abre sozinha no dia seguinte ao fim do evento."} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
                    <CalendarClock size={10} aria-hidden /> {selected.opensLabel}
                  </span>
                </>
              ) : (
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: STATE_CFG[selected.isDone ? "done" : selected.done > 0 ? "partial" : "pending"].bg, color: STATE_CFG[selected.isDone ? "done" : selected.done > 0 ? "partial" : "pending"].color }}>
                  {selected.isDone ? "Concluído" : selected.done > 0 ? "Em andamento" : "A fazer"}
                </span>
              )}
              {(selected.finalCalibratedCriteria > 0 || selected.partialPublishedCount > 0) && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}
                  title={selected.finalCalibratedCriteria > 0
                    ? `${selected.finalCalibratedCriteria} de ${plural(selected.total, "critério")} com publicação final`
                    : `${selected.partialPublishedCount} de ${plural(selected.total, "critério")} com publicação parcial`}
                >
                  <CheckCircle size={9} /> {selected.finalCalibratedCriteria > 0 ? "Publicação final" : "Publicação parcial"}
                </span>
              )}
              {selected.isDone && selected.unassigned > 0 && !!selected.endDate && selected.endDate < todayStr && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: `rgba(232,162,61,0.16)`, color: AMBER_TEXT }}>
                  <AlertTriangle size={9} /> Sem avaliador
                </span>
              )}
              <span className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{[selected.clientName, selected.city].filter(Boolean).join(" · ") || "—"}</span>
              {(selected.startDate || selected.endDate) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                  <Calendar size={10} />
                  {selected.startDate ? new Date(selected.startDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                  {selected.startDate && selected.endDate ? " – " : ""}
                  {selected.endDate ? new Date(selected.endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                </span>
              )}
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight mt-1.5 break-words" style={{ fontFamily: CONDENSED }}>{selected.name}</h2>
            {waiting && (
              <p className="text-[12px] mt-1" style={{ color: "var(--muted-foreground)" }} data-testid="panel-opens-help">
                {selected.nextCycle
                  ? NEXT_CYCLE_NOTICE
                  : areaMode
                    ? "A avaliação abre sozinha no dia seguinte ao fim do evento. Dá para preparar critérios e o responsável da Matriz."
                    : "A avaliação abre sozinha no dia seguinte ao fim do evento. Dá para preparar critérios e avaliadores."}
              </p>
            )}
          </div>
          {canManage && (
            <button
              type="button"
              disabled={!selected.isDone || confirmResults.isPending}
              onClick={() => confirmResults.mutate({ id: selected.id })}
              className="shrink-0 flex items-center gap-2 rounded-lg px-[18px] py-[11px] text-xs font-black uppercase tracking-wide transition-opacity disabled:cursor-not-allowed"
              style={{
                fontFamily: CONDENSED,
                backgroundColor: selected.isDone ? "var(--primary)" : "var(--secondary)",
                color: selected.isDone ? "var(--primary-foreground)" : "var(--muted-foreground)",
                border: selected.isDone ? "1px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              <CheckCircle2 size={15} /> {confirmResults.isPending ? "Confirmando..." : "Confirmar Resultados"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 mt-3.5">
          <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
            <div className="h-full rounded-full" style={{ width: `${selected.pct}%`, backgroundColor: "var(--accent)" }} />
          </div>
          <span className="text-[13px] font-black" style={{ fontFamily: CONDENSED }}>{selected.pct}%</span>
          <span className="text-[11px] font-bold uppercase whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{selected.done} de {plural(selected.total, "critério completo", "critérios completos")}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between gap-2.5 mb-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Critérios por área</p>
            {canManage && (
              <button
                type="button"
                data-testid="button-sync-criteria-assign"
                disabled={resyncCriteria.isPending}
                onClick={() => resyncCriteria.mutate({ id: selected.id })}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--foreground)" }}
                title="Adiciona a este evento os critérios do catálogo que estão faltando (ex.: Carga na Saída do Galpão). É aditivo — não remove critérios já avaliados. Só afeta ESTE evento."
              >
                <RefreshCw size={12} className={resyncCriteria.isPending ? "animate-spin" : ""} /> {resyncCriteria.isPending ? "Sincronizando..." : "Sincronizar Critérios"}
              </button>
            )}
            {canManage && critPillCounts.unassigned > 0 && (
              <button
                type="button"
                data-testid="button-apply-default-evaluators"
                disabled={generateAssignments.isPending}
                onClick={() => generateAssignments.mutate(undefined, {
                  onSuccess: (r) => toast({ title: r.generated > 0 ? `Avaliadores padrão aplicados a ${plural(r.generated, "critério")}` : "Nenhum critério pendente para aplicar" }),
                  onError: (e) => toast({ title: "Erro ao aplicar avaliadores", description: e.message, variant: "destructive" }),
                })}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: CONDENSED, backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                title="Preenche cada critério sem avaliador com o Avaliador Padrão cadastrado nos Critérios"
              >
                <UserCheck size={12} /> {generateAssignments.isPending ? "Aplicando..." : "Aplicar Avaliadores Padrão"}
              </button>
            )}
            {/* Evento do próximo ciclo: a API recusa link público (409 EVENT_NEXT_CYCLE) — sem o botão. */}
            {canManage && !selected.nextCycle && (selected.total - critPillCounts.unassigned) > 0 && (
              <button
                type="button"
                data-testid="button-generate-all-links"
                disabled={batchRunning}
                onClick={handleGenerateAllLinks}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--foreground)" }}
                title="Gera um link por avaliador (Cenografia já vem com a Matriz de Conformidade no mesmo questionário)"
              >
                <Link2 size={12} /> {batchRunning ? "Gerando..." : "Gerar Todos os Links"}
              </button>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {([
              { key: "all", label: "Todos" },
              { key: "unassigned", label: "Sem avaliador" },
              { key: "pending", label: "Aguardando" },
              { key: "partial", label: "Parcial" },
              { key: "done", label: "Completo" },
            ] as const).filter(p => !(areaMode && p.key === "unassigned")).map(p => {
              const active = critFilter === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setCritFilter(p.key)}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition-colors"
                  style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)", border: active ? "1px solid var(--primary)" : "1px solid var(--border)" }}
                >
                  {p.label} · {critPillCounts[p.key]}
                </button>
              );
            })}
          </div>
        </div>

        {areaMode && (
          <p data-testid="notice-area-mode-admin" className="mb-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
            <Info size={13} className="shrink-0 mt-[2px]" aria-hidden />
            <span><strong style={{ color: "var(--foreground)" }}>No ciclo por área, só o avaliador da área responde.</strong> Ajustes na Calibração.</span>
          </p>
        )}

        {/* Bulk-assign: áreas com critérios sem avaliador */}
        {canManage && selected.unassigned > 0 && (critFilter === "all" || critFilter === "unassigned") && (() => {
          const unassignedByArea = new Map<number, { areaId: number; areaName: string; count: number }>();
          for (const c of selected.criteria.filter(cr => cr.state === "unassigned" && cr.areaId != null)) {
            const key = c.areaId!;
            if (!unassignedByArea.has(key)) unassignedByArea.set(key, { areaId: key, areaName: c.areaName, count: 0 });
            unassignedByArea.get(key)!.count++;
          }
          const areas = Array.from(unassignedByArea.values());
          if (areas.length === 0) return null;
          return (
            <div className="rounded-lg p-3 space-y-2" style={{ border: `1px solid ${WARNING}44`, backgroundColor: `rgba(229,72,77,0.05)` }}>
              <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: DANGER_TEXT }}><AlertTriangle size={10} /> {plural(selected.unassigned, "critério")} sem avaliador — atribuição rápida por área</p>
              <div className="flex flex-col gap-1.5">
                {areas.map(a => {
                  const open = bulkAssignAreaId === a.areaId;
                  return (
                    <div key={a.areaId} className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ backgroundColor: "var(--secondary)" }}>
                        <span className="text-[11px] font-black uppercase">{a.areaName} <span className="font-normal text-[11px]" style={{ color: "var(--muted-foreground)" }}>({a.count} sem avaliador)</span></span>
                        <button
                          type="button"
                          onClick={() => setBulkAssignAreaId(open ? null : a.areaId)}
                          className="rounded px-2.5 py-1 text-[11px] font-bold uppercase transition-colors hover:opacity-80"
                          style={{ backgroundColor: open ? "var(--primary)" : "transparent", color: open ? "var(--primary-foreground)" : "var(--foreground)", border: "1px solid var(--border)" }}
                        >
                          {open ? "Fechar" : "Atribuir área"}
                        </button>
                      </div>
                      {open && (
                        <div className="px-3 py-2.5">
                          <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>
                            {bulkBusy ? "Atribuindo..." : a.count === 1 ? `Escolha o avaliador para o critério sem atribuição em ${a.areaName}:` : `Escolha o avaliador para os ${a.count} critérios sem atribuição em ${a.areaName}:`}
                          </p>
                          <InlinePicker areaId={a.areaId} disabled={bulkBusy} onPick={(uid) => handleBulkAssign(a.areaId, uid)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col gap-2.5">
          {filteredCriteria.length === 0 ? (
            <div className="rounded-lg py-4 px-3.5 text-center text-[11px] font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
              Nenhum critério neste filtro
            </div>
          ) : filteredCriteria.map(c => {
            const cfg = STATE_CFG[c.state];
            const pickerOpen = openPickerCriterionId === c.criterionId;
            return (
              <div key={c.criterionId} className="rounded-lg px-3.5 py-3 relative overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{c.areaName}</span>
                    <span className="font-black uppercase text-[14.5px] tracking-tight min-w-0 break-words" style={{ fontFamily: CONDENSED }}>{c.criterionName}</span>
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                </div>
                <div className="flex items-center justify-between gap-2.5 mt-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {c.areaMode ? (
                      // Avaliação por área: ninguém designado é o normal — a
                      // primeira resposta de qualquer avaliador da área vale.
                      // Designação antiga só aparece como informação.
                      <div className="flex flex-col gap-0.5">
                        <AreaModeResponder c={c} />
                        <AreaModeOldDesignation c={c} />
                      </div>
                    ) : c.assignedToId != null ? (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                            <span
                              role="img"
                              aria-label={`Status: ${STATE_CFG[c.state].label}`}
                              title={STATE_CFG[c.state].label}
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ background: c.state === "done" ? GOOD : c.state === "partial" ? AMBER : "var(--border)" }}
                            />
                            {c.assignedToName}
                          </span>
                          <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: STATE_CFG[c.state].bg, color: STATE_CFG[c.state].color }}>
                            {STATE_CFG[c.state].label}
                          </span>
                        </div>
                        {c.formSubmitterName && c.formSubmitterName !== c.assignedToName && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5" style={{ color: "var(--muted-foreground)" }}>
                            <UserCheck size={9} /> Preenchido por: <span style={{ color: "var(--foreground)" }}>{c.formSubmitterName}</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-bold uppercase text-[11px]" style={{ color: DANGER_TEXT }}>Nenhum avaliador atribuído</span>
                    )}
                    {c.submittedAt && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: GOOD_TEXT }}>
                        <Clock size={10} /> {fmtDT(c.submittedAt)}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      {/* Evento do próximo ciclo: a API recusa link público (409 EVENT_NEXT_CYCLE). */}
                      {c.assignedToId != null && !selected.nextCycle && (
                        <button
                          type="button"
                          onClick={() => openLinkDialog(c)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 transition-colors hover:opacity-80"
                          style={{ border: "1px solid var(--border)" }}
                          title="Gerar link para freela"
                        >
                          <Link2 size={11} /> Link
                        </button>
                      )}
                      {c.score != null && canViewSubmissions && (
                        <button
                          type="button"
                          onClick={() => setViewEvalCrit(c)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 transition-colors hover:opacity-80"
                          style={{ border: `1px solid ${GOOD}55`, color: GOOD_TEXT, backgroundColor: `rgba(154,176,0,0.08)` }}
                          title="Ver resposta enviada"
                        >
                          <CheckCircle2 size={11} /> Ver
                        </button>
                      )}
                      {c.state === "done" ? (
                        <span
                          className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1"
                          style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", opacity: 0.6 }}
                          title="Resposta enviada — reatribuição bloqueada"
                        >
                          <Lock size={10} /> Bloqueado
                        </span>
                      ) : c.areaMode ? null : (
                        // Avaliação por área: ninguém é designado — sem "Atribuir" nem
                        // "Gerenciar" (o texto ao lado diz que qualquer avaliador da área responde).
                        <button
                          type="button"
                          onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                          className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase transition-opacity hover:opacity-80"
                          style={{
                            border: c.assignedToId == null ? "1px solid var(--primary)" : "1px solid var(--border)",
                            backgroundColor: c.assignedToId == null ? "var(--primary)" : "transparent",
                            color: c.assignedToId == null ? "var(--primary-foreground)" : "var(--foreground)",
                          }}
                        >
                          {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {pickerOpen && c.areaId != null && (
                  <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed var(--border)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Avaliadores disponíveis · {c.areaName}</p>
                    <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {conformitySection}
      </div>
    </div>
  );
}
