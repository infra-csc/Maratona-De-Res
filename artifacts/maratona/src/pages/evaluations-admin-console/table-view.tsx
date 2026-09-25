import type { Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { Clock, Link2, Lock, UserCheck } from "lucide-react";
import { CONDENSED, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { STATE_CFG, fmtDT } from "./helpers";
import { EventCombobox, InlinePicker } from "./pickers";
import type { ConformityKey, ConformityLinkDialogState, ConformityRow, CritRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

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
}) {
  const {
    selected, enrichedEvents, setSelectedEventId, conformityRows, canManage, openPickerCriterionId, setOpenPickerCriterionId,
    handleAssign, openLinkDialog, setConformityLinkDialog, setOpenConformityPicker,
  } = props;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] font-bold uppercase shrink-0" style={{ color: "var(--muted-foreground)" }}>Acompanhamento —</span>
        <EventCombobox events={enrichedEvents} value={selected.id} onChange={setSelectedEventId} />
        <span className="text-[11px] font-bold uppercase shrink-0" style={{ color: "var(--muted-foreground)" }}>
          · {selected.done} de {selected.total} critérios completos
        </span>
      </div>
      <div className="rounded-xl overflow-hidden overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
        <div className="grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] min-w-[820px]" style={{ backgroundColor: "var(--secondary)" }}>
          {["Critério", "Área", "Avaliador", "Enviado em", "Status", "Ação"].map((h, i) => (
            <div key={h} className={cn("px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wide", i === 5 && "text-right")} style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{h}</div>
          ))}
        </div>
        {selected.criteria.length === 0 ? (
          <div className="p-6 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum critério ativo neste evento.</div>
        ) : selected.criteria.map(c => {
          const cfg = STATE_CFG[c.state];
          const pickerOpen = openPickerCriterionId === c.criterionId;
          return (
            <div key={c.criterionId} className="grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] items-center min-w-[820px]" style={{ borderTop: "1px solid var(--border)", backgroundColor: c.assignedToId == null ? "rgba(229,72,77,0.05)" : "transparent" }}>
              <div className="px-3.5 py-3 font-black uppercase text-[13px]" style={{ fontFamily: CONDENSED }}>{c.criterionName}</div>
              <div className="px-3.5 py-3 font-bold uppercase text-[11px]" style={{ color: "var(--muted-foreground)" }}>{c.areaName}</div>
              <div className="px-3.5 py-3">
                <div className="font-semibold text-xs" style={{ color: c.assignedToId == null ? DANGER_TEXT : "var(--foreground)" }}>{c.assignedToName ?? "Sem avaliador"}</div>
                {c.formSubmitterName && c.formSubmitterName !== c.assignedToName && (
                  <div className="flex items-center gap-1 mt-0.5 text-[11px] font-bold" style={{ color: "var(--muted-foreground)" }}>
                    <UserCheck size={8} /> {c.formSubmitterName}
                  </div>
                )}
              </div>
              <div className="px-3.5 py-3 font-bold text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {c.submittedAt ? (
                  <span className="flex items-center gap-1" style={{ color: GOOD_TEXT }}><Clock size={10} /> {fmtDT(c.submittedAt)}</span>
                ) : (
                  <span>—</span>
                )}
              </div>
              <div className="px-3.5 py-3">
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
              </div>
              <div className="px-3.5 py-3 text-right relative flex items-center justify-end gap-2">
                {canManage && c.assignedToId != null && (
                  <button
                    type="button"
                    onClick={() => openLinkDialog(c)}
                    className="rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 whitespace-nowrap transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                    title="Gerar link para freelancer"
                  >
                    <Link2 size={10} /> Link
                  </button>
                )}
                {canManage && (
                  c.state === "done" ? (
                    <span
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 whitespace-nowrap"
                      style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)", opacity: 0.55 }}
                      title="Resposta enviada — reatribuição bloqueada"
                    >
                      <Lock size={9} /> Bloqueado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase whitespace-nowrap transition-opacity hover:opacity-80"
                      style={{
                        border: c.assignedToId == null ? "1px solid var(--primary)" : "1px solid var(--border)",
                        backgroundColor: c.assignedToId == null ? "var(--primary)" : "transparent",
                        color: c.assignedToId == null ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                    </button>
                  )
                )}
                {pickerOpen && c.areaId != null && (
                  <div className="absolute right-3.5 top-full mt-1 z-10 w-64 rounded-xl p-2.5 text-left" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                    <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {/* ── Linhas da Matriz de Conformidade ── */}
        {conformityRows.map(cf => {
          const isDone = cf.filled >= cf.total;
          const hasEvaluator = cf.evaluatorId != null;
          const cfgState = isDone
            ? STATE_CFG.done
            : hasEvaluator ? STATE_CFG.pending : STATE_CFG.unassigned;
          return (
            <div key={cf.key} className="grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] items-center min-w-[820px]" style={{ borderTop: "1px solid var(--border)", backgroundColor: !hasEvaluator ? "rgba(229,72,77,0.05)" : "rgba(154,176,0,0.04)" }}>
              <div className="px-3.5 py-3">
                <div className="font-black uppercase text-[13px]" style={{ fontFamily: CONDENSED }}>{cf.name}</div>
                <div className="text-[11px] font-bold mt-0.5" style={{ color: "var(--muted-foreground)" }}>{cf.scope}</div>
              </div>
              <div className="px-3.5 py-3 font-bold uppercase text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {cf.key === "cenografia" ? "Cenografia" : "Ferramentas"}
              </div>
              <div className="px-3.5 py-3 font-semibold text-xs" style={{ color: !hasEvaluator ? DANGER_TEXT : "var(--foreground)" }}>
                {cf.evaluatorName ?? "Sem avaliador"}
              </div>
              <div className="px-3.5 py-3 font-bold text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {isDone ? <span className="flex items-center gap-1" style={{ color: GOOD_TEXT }}><Clock size={10} /> Preenchido</span> : <span>—</span>}
              </div>
              <div className="px-3.5 py-3">
                <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: cfgState.bg, color: cfgState.color }}>
                  {isDone ? "Completo" : hasEvaluator ? "Aguardando" : "Sem avaliador"}
                </span>
              </div>
              <div className="px-3.5 py-3 text-right flex items-center justify-end gap-2">
                {canManage && hasEvaluator && (
                  <button
                    type="button"
                    onClick={() => setConformityLinkDialog({ key: cf.key, label: cf.name, evaluatorId: cf.evaluatorId, evaluatorName: cf.evaluatorName })}
                    className="rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 whitespace-nowrap transition-colors hover:opacity-80"
                    style={{ border: "1px solid var(--border)" }}
                    title="Gerar link para preenchimento"
                  >
                    <Link2 size={10} /> Link
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setOpenConformityPicker(cf.key)}
                    className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase whitespace-nowrap transition-opacity hover:opacity-80"
                    style={{
                      border: !hasEvaluator ? "1px solid var(--primary)" : "1px solid var(--border)",
                      backgroundColor: !hasEvaluator ? "var(--primary)" : "transparent",
                      color: !hasEvaluator ? "var(--primary-foreground)" : "var(--foreground)",
                    }}
                  >
                    {!hasEvaluator ? "Atribuir" : "Gerenciar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11.5px] mt-3" style={{ color: "var(--muted-foreground)" }}>
        Clique em <b style={{ color: "var(--foreground)" }}>Atribuir</b> numa linha sem avaliador para escolher quem responde. Use o seletor acima para trocar de evento.
      </p>
    </div>
  );
}
