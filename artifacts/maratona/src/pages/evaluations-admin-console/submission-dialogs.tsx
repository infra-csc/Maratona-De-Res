import type { Dispatch, SetStateAction } from "react";
import type { EventConformity, EventDetail } from "@workspace/api-client-react";
import { Clock, X } from "lucide-react";
import { CONDENSED, GOOD, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { fmtDT } from "./helpers";
import type { ConformityKey, CritRow } from "./types";
import { fmtNum } from "@/lib/utils";

/** Ver avaliação (modal de leitura) */
export function ViewEvaluationDialog({ viewEvalCrit, setViewEvalCrit }: {
  viewEvalCrit: CritRow;
  setViewEvalCrit: Dispatch<SetStateAction<CritRow | null>>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewEvalCrit(null)}>
      <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--muted-foreground)" }}>{viewEvalCrit.areaName}</p>
            <h3 className="font-black uppercase text-[16px] leading-tight truncate" style={{ fontFamily: CONDENSED }}>{viewEvalCrit.criterionName}</h3>
          </div>
          <button type="button" onClick={() => setViewEvalCrit(null)} aria-label="Fechar avaliação" title="Fechar" className="ml-3 shrink-0 rounded-lg p-1.5 hover:opacity-70 transition-opacity" style={{ border: "1px solid var(--border)" }}><X size={14} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Avaliador + data */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: GOOD }} />
              {viewEvalCrit.formSubmitterName ?? viewEvalCrit.assignedToName ?? "—"}
            </span>
            {viewEvalCrit.submittedAt && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: GOOD_TEXT }}>
                <Clock size={10} /> {fmtDT(viewEvalCrit.submittedAt)}
              </span>
            )}
          </div>
          {/* Nota */}
          {viewEvalCrit.score != null && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Nota atribuída</p>
              <div className="flex items-center gap-1 flex-wrap">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <div
                    key={n}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-black"
                    style={{
                      fontFamily: CONDENSED,
                      backgroundColor: n === Math.round(viewEvalCrit.score!) ? "var(--primary)" : "var(--secondary)",
                      color: n === Math.round(viewEvalCrit.score!) ? "var(--primary-foreground)" : "var(--muted-foreground)",
                      border: n === Math.round(viewEvalCrit.score!) ? "2px solid var(--primary)" : "1px solid var(--border)",
                      transform: n === Math.round(viewEvalCrit.score!) ? "scale(1.15)" : "scale(1)",
                    }}
                  >{n}</div>
                ))}
                <span className="ml-2 text-2xl font-black" style={{ fontFamily: CONDENSED, color: "var(--primary)" }}>{fmtNum(viewEvalCrit.score, 1)}</span>
              </div>
            </div>
          )}
          {/* Comentário */}
          {viewEvalCrit.comments ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>Comentário</p>
              <div className="rounded-lg px-3.5 py-3 text-[12px] leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                {viewEvalCrit.comments}
              </div>
            </div>
          ) : (
            <p className="text-[11px] italic" style={{ color: "var(--muted-foreground)" }}>Sem comentário registrado.</p>
          )}
          {/* Áudio */}
          {viewEvalCrit.audioUrl && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>Áudio</p>
              <audio controls src={viewEvalCrit.audioUrl} className="w-full h-9" style={{ borderRadius: 8 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Ver Matriz de Conformidade (modal de leitura) */
export function ViewConformityDialog({ viewConformity, setViewConformity, conformity, selectedDetail }: {
  viewConformity: ConformityKey;
  setViewConformity: Dispatch<SetStateAction<ConformityKey | null>>;
  conformity: EventConformity;
  selectedDetail: EventDetail | undefined;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setViewConformity(null)}>
      <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: "var(--muted-foreground)" }}>
              {viewConformity === "cenografia" ? "Cenografia · 5 itens" : "Ferramentas e Case · 1 item"}
            </p>
            <h3 className="font-black uppercase text-[16px] leading-tight" style={{ fontFamily: CONDENSED }}>
              {viewConformity === "cenografia" ? "Matriz de Conformidade" : "Guarda de Ferramentas"}
            </h3>
          </div>
          <button type="button" onClick={() => setViewConformity(null)} aria-label="Fechar matriz de conformidade" title="Fechar" className="ml-3 shrink-0 rounded-lg p-1.5 hover:opacity-70 transition-opacity" style={{ border: "1px solid var(--border)" }}><X size={14} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Avaliador */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-bold" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: GOOD }} />
              {viewConformity === "cenografia"
                ? (selectedDetail?.conformityEvaluatorName ?? "—")
                : (selectedDetail?.conformityEvaluatorFerramentasName ?? "—")}
            </span>
          </div>

          {viewConformity === "cenografia" ? (
            <>
              {([
                { label: "Uso de EPI", val: conformity.epi, comment: conformity.epiComment },
                { label: "Estaiamentos", val: conformity.estaiamentos, comment: conformity.estaiamentosComment },
                { label: "Conduta", val: conformity.conduta, comment: conformity.condutaComment },
              ] as { label: string; val: boolean | null | undefined; comment: string | null | undefined }[]).map(item => (
                <div key={item.label} className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase">{item.label}</span>
                    {item.val == null
                      ? <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--border)", color: "var(--muted-foreground)" }}>Pendente</span>
                      : item.val
                        ? <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.18)", color: GOOD_TEXT }}>Sim</span>
                        : <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>Não</span>
                    }
                  </div>
                  {item.comment && <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>{item.comment}</p>}
                </div>
              ))}
              {/* Ausências */}
              {(() => {
                const absRep = conformity?.absencesReport;
                const standout = conformity?.standoutResponse;
                const standoutJust = conformity?.standoutJustification;
                return (
                  <>
                    <div className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                      <p className="text-[11px] font-bold uppercase mb-1">Ausências / Registro</p>
                      <p className="text-[11px] leading-snug whitespace-pre-wrap" style={{ color: "var(--muted-foreground)" }}>
                        {absRep || "Sem registro"}
                      </p>
                    </div>
                    {standout != null && (
                      <div className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase">Destaque</span>
                          {standout
                            ? <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.18)", color: GOOD_TEXT }}>Sim</span>
                            : <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>Não</span>}
                        </div>
                        {standoutJust && <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>{standoutJust}</p>}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase">Guarda de Equipamentos</span>
                {conformity.guardaEquipamentos == null
                  ? <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "var(--border)", color: "var(--muted-foreground)" }}>Pendente</span>
                  : conformity.guardaEquipamentos
                    ? <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(154,176,0,0.18)", color: GOOD_TEXT }}>Sim</span>
                    : <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}>Não</span>}
              </div>
              {conformity.guardaEquipamentosComment && (
                <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--muted-foreground)" }}>{conformity.guardaEquipamentosComment}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
