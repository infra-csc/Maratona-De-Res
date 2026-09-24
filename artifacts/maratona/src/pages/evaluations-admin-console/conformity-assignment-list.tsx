import type { Dispatch, SetStateAction } from "react";
import { CheckCircle2, Link2 } from "lucide-react";
import { CONDENSED, GOOD, GOOD_TEXT } from "@/lib/premium-theme";
import { STATE_CFG } from "./helpers";
import { InlinePicker } from "./pickers";
import type { SelectedEventDetail } from "./use-event-mutations";
import type { ConformityKey, ConformityLinkDialogState, ConformityRow, EnrichedEvent } from "./types";

type SetState<T> = Dispatch<SetStateAction<T>>;

/** Aba Atribuição — bloco "Matriz de conformidade" do evento selecionado. */
export function ConformityAssignmentList(props: {
  selected: EnrichedEvent;
  conformityRows: ConformityRow[];
  canManage: boolean;
  canViewSubmissions: boolean;
  openConformityPicker: ConformityKey | null;
  setOpenConformityPicker: SetState<ConformityKey | null>;
  setViewConformity: SetState<ConformityKey | null>;
  setConformityLinkDialog: SetState<ConformityLinkDialogState | null>;
  setConformityLinkRecipientName: SetState<string>;
  setConformityLinkUrl: SetState<string | null>;
  setConformityLinkCopied: SetState<boolean>;
  setConformityEvaluatorMutation: SelectedEventDetail["setConformityEvaluatorMutation"];
  setConformityEvaluatorFerramentasMutation: SelectedEventDetail["setConformityEvaluatorFerramentasMutation"];
}) {
  const {
    selected, conformityRows, canManage, canViewSubmissions, openConformityPicker, setOpenConformityPicker, setViewConformity,
    setConformityLinkDialog, setConformityLinkRecipientName, setConformityLinkUrl, setConformityLinkCopied,
    setConformityEvaluatorMutation, setConformityEvaluatorFerramentasMutation,
  } = props;
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wide mt-[18px] mb-2.5" style={{ color: "var(--muted-foreground)" }}>Matriz de conformidade</p>
      <div className="flex flex-col gap-2.5">
        {conformityRows.map(cf => {
          const complete = cf.total > 0 && cf.filled === cf.total;
          const cfg = cf.evaluatorId == null ? STATE_CFG.unassigned : complete ? STATE_CFG.done : STATE_CFG.partial;
          const pickerOpen = openConformityPicker === cf.key;
          return (
            <div key={cf.key} className="rounded-lg px-3.5 py-3 relative overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
              <div className="flex items-center justify-between gap-2.5">
                <div>
                  <div className="font-black uppercase text-sm" style={{ fontFamily: CONDENSED }}>{cf.name}</div>
                  <div className="text-[11px] font-bold uppercase mt-0.5" style={{ color: "var(--muted-foreground)" }}>{cf.scope} · {cf.evaluatorName ?? "Sem avaliador"}</div>
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cf.filled}/{cf.total}</span>
                  {cf.filled > 0 && canViewSubmissions && (
                    <button
                      type="button"
                      onClick={() => setViewConformity(cf.key)}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 transition-colors hover:opacity-80"
                      style={{ border: `1px solid ${GOOD}`, color: GOOD_TEXT }}
                    >
                      <CheckCircle2 size={11} /> Ver
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => { setConformityLinkDialog({ key: cf.key, label: cf.name, evaluatorId: cf.evaluatorId, evaluatorName: cf.evaluatorName }); setConformityLinkRecipientName(""); setConformityLinkUrl(null); setConformityLinkCopied(false); }}
                      className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase flex items-center gap-1 transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                      title="Gerar link de conformidade para freelancer"
                    >
                      <Link2 size={11} /> Link
                    </button>
                  )}
                  {canManage && (
                    <button type="button" onClick={() => setOpenConformityPicker(pickerOpen ? null : cf.key)} className="rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
                      {cf.evaluatorId == null ? "Atribuir" : "Trocar"}
                    </button>
                  )}
                </div>
              </div>
              {pickerOpen && (
                <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed var(--border)" }}>
                  <InlinePicker
                    areaId={cf.areaId}
                    excludeId={cf.evaluatorId}
                    onPick={(uid) => {
                      if (cf.key === "cenografia") setConformityEvaluatorMutation.mutate({ id: selected.id, data: { userId: uid } });
                      else setConformityEvaluatorFerramentasMutation.mutate({ id: selected.id, data: { userId: uid } });
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
