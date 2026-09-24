// Bloco "Matriz de Conformidade" da barra lateral — editável para gestores.
import { Textarea } from "@/components/ui/textarea";
import { Check, Save, Trophy, ShieldCheck, MessageSquare, User } from "lucide-react";
import type { EventDetail } from "@workspace/api-client-react";
import { WARNING, GOOD, AMBER, GOOD_TEXT } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";
import type { ConformityState } from "./use-conformity";

export type ConformityPanelProps = {
  selectedEventId: number | null;
  fullEvent: EventDetail | undefined;
  conformityState: ConformityState;
};

export function ConformityPanel({ selectedEventId, fullEvent, conformityState }: ConformityPanelProps) {
  const {
    conformity,
    setConformityMutation,
    conformityForm,
    setConformityForm,
    conformityExpandedComments,
    setConformityExpandedComments,
    canManageConformity,
  } = conformityState;
  return (
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <p className="text-[11px] font-black uppercase mb-2 flex items-center gap-1.5"><ShieldCheck size={13} /> Matriz de Conformidade</p>
                {(fullEvent?.conformityEvaluatorName || fullEvent?.conformityEvaluatorFerramentasName) && (
                  <div className="mb-2 space-y-0.5">
                    {fullEvent?.conformityEvaluatorName && (
                      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><User size={9} /> Responsável Cenografia: <span className="font-bold ml-0.5" style={{ color: "var(--foreground)" }}>{fullEvent.conformityEvaluatorName}</span></p>
                    )}
                    {fullEvent?.conformityEvaluatorFerramentasName && (
                      <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><User size={9} /> Responsável Ferramentas: <span className="font-bold ml-0.5" style={{ color: "var(--foreground)" }}>{fullEvent.conformityEvaluatorFerramentasName}</span></p>
                    )}
                  </div>
                )}
                <div className="space-y-1 mb-2">
                  {([
                    { label: "EPI", key: "epi" as const, commentKey: "epiComment" as const },
                    { label: "Estaiamento", key: "estaiamentos" as const, commentKey: "estaiamentosComment" as const },
                    { label: "Conduta", key: "conduta" as const, commentKey: "condutaComment" as const },
                    { label: "Guarda Equip.", key: "guardaEquipamentos" as const, commentKey: "guardaEquipamentosComment" as const },
                  ]).map(item => {
                    const value = conformityForm[item.key];
                    const comment = conformityForm[item.commentKey];
                    const isExpanded = conformityExpandedComments.has(item.key);
                    // Mostra quem realmente preencheu cada seção (gravado no momento do save).
                    // "Guarda Equip." = Ferramentas; demais = Cenografia.
                    // TODO contrato: ferramentasSubmittedByName/cenografiaSubmittedByName ainda
                    // não existem em EventConformity (api.schemas.ts) — cast mantido até o codegen.
                    const answeredByName = item.key === "guardaEquipamentos"
                      ? ((conformity as unknown as Record<string, unknown>)?.ferramentasSubmittedByName as string | null | undefined) ?? null
                      : ((conformity as unknown as Record<string, unknown>)?.cenografiaSubmittedByName as string | null | undefined) ?? null;
                    return (
                      <div key={item.key} className="rounded-lg overflow-hidden" style={{ border: value === null ? "1px solid var(--border)" : value ? `1px solid ${GOOD}` : `1px solid ${WARNING}`, backgroundColor: value === null ? "var(--secondary)" : value ? "rgba(154,176,0,0.10)" : "rgba(229,72,77,0.08)" }}>
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] font-bold uppercase truncate block">{item.label}</span>
                            {value !== null && answeredByName && (
                              <span className="text-[11px] flex items-center gap-0.5 mt-0.5" style={{ color: GOOD_TEXT }}>
                                <Check size={8} /> {answeredByName}
                              </span>
                            )}
                          </div>
                          {canManageConformity ? (
                            <div role="group" aria-label={`${item.label}: conformidade`} className="flex items-center rounded overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
                              {/* Alvo mínimo de toque 28×28 px (WCAG 2.5.8) */}
                              <button type="button" aria-label="Sim" aria-pressed={value === true} onClick={() => { const next = { ...conformityForm, [item.key]: true }; setConformityForm(next); setConformityMutation.mutate({ id: selectedEventId!, data: { [item.key]: true } }); }} className="min-w-[28px] min-h-[28px] px-1.5 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === true ? "var(--primary)" : "transparent", color: value === true ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>S</button>
                              <button type="button" aria-label="Não" aria-pressed={value === false} onClick={() => { const next = { ...conformityForm, [item.key]: false }; setConformityForm(next); setConformityMutation.mutate({ id: selectedEventId!, data: { [item.key]: false } }); }} className="min-w-[28px] min-h-[28px] px-1.5 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === false ? WARNING : "transparent", color: value === false ? "#fff" : "var(--muted-foreground)" }}>N</button>
                              <button type="button" aria-label="Não se aplica" aria-pressed={value === null} onClick={() => { const next = { ...conformityForm, [item.key]: null }; setConformityForm(next); setConformityMutation.mutate({ id: selectedEventId!, data: { [item.key]: null } }); }} className="min-w-[28px] min-h-[28px] px-1.5 text-[11px] font-black uppercase transition-all" style={{ backgroundColor: value === null ? "rgba(232,162,61,0.24)" : "transparent", color: value === null ? AMBER : "var(--muted-foreground)" }}>?</button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-black uppercase px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: value === null ? "var(--secondary)" : value ? "var(--primary)" : WARNING, color: value === null ? "var(--muted-foreground)" : value ? "var(--primary-foreground)" : "#fff" }}>
                              {value === null ? "—" : value ? "OK" : "Não"}
                            </span>
                          )}
                          {canManageConformity && (
                            <button type="button" title={comment ? "Ver/editar comentário" : "Adicionar comentário"} onClick={() => setConformityExpandedComments(prev => { const next = new Set(prev); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })} className="p-0.5 rounded transition-all ml-0.5" style={{ border: comment ? "1px solid var(--primary)" : "1px solid var(--border)", backgroundColor: comment ? "var(--primary)" : "transparent", color: comment ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                              <MessageSquare size={9} />
                            </button>
                          )}
                        </div>
                        {isExpanded && canManageConformity && (
                          <div className="px-2 pb-2 space-y-1">
                            <Textarea value={comment} onChange={e => setConformityForm(f => ({ ...f, [item.commentKey]: e.target.value }))} placeholder="Observação..." className="text-[11px] resize-none min-h-[48px] p-1.5 rounded" style={fieldStyle} />
                            <button type="button" disabled={setConformityMutation.isPending} onClick={() => setConformityMutation.mutate({ id: selectedEventId!, data: { [item.commentKey]: comment || null } })} className="px-2 py-0.5 rounded font-black uppercase text-[11px] disabled:opacity-50 transition-colors hover:opacity-90" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                              Salvar
                            </button>
                          </div>
                        )}
                        {!isExpanded && comment && (
                          <p className="px-2 pb-1 text-[11px] line-clamp-1 cursor-pointer" style={{ color: "var(--muted-foreground)" }} onClick={() => setConformityExpandedComments(prev => { const next = new Set(prev); next.add(item.key); return next; })}>💬 {comment}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-1.5">
                  {/* Faltas/Atrasos */}
                  <div className="rounded-lg px-2 py-1.5" style={{ border: conformityForm.absencesReport ? `1px solid ${AMBER}` : "1px solid var(--border)", backgroundColor: conformityForm.absencesReport ? "rgba(232,162,61,0.10)" : "var(--secondary)" }}>
                    <p className="text-[11px] font-bold uppercase mb-1 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><User size={9} /> Faltas/Atrasos</p>
                    {canManageConformity ? (
                      <div className="flex gap-1">
                        <Textarea value={conformityForm.absencesReport} onChange={e => setConformityForm(f => ({ ...f, absencesReport: e.target.value }))} placeholder="Sem registro" className="text-[11px] resize-none min-h-[36px] p-1 flex-1 rounded" style={fieldStyle} />
                        <button type="button" disabled={setConformityMutation.isPending} onClick={() => setConformityMutation.mutate({ id: selectedEventId!, data: { absencesReport: conformityForm.absencesReport || null } })} className="px-1.5 rounded font-black text-[11px] disabled:opacity-50 transition-colors hover:opacity-90 shrink-0 self-start" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                          <Save size={9} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-[11px] leading-snug">{conformityForm.absencesReport || <span style={{ color: "var(--muted-foreground)" }}>Sem registro</span>}</p>
                    )}
                  </div>
                  {/* Destaque */}
                  <div className="rounded-lg px-2 py-1.5" style={{ border: conformityForm.standoutResponse === true ? `1px solid ${GOOD}` : "1px solid var(--border)", backgroundColor: conformityForm.standoutResponse === true ? "rgba(154,176,0,0.10)" : "var(--secondary)" }}>
                    <p className="text-[11px] font-bold uppercase mb-1 flex items-center gap-1" style={{ color: GOOD_TEXT }}><Trophy size={9} /> Destaque</p>
                    {canManageConformity ? (
                      <div className="space-y-1">
                        <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          <button type="button" aria-pressed={conformityForm.standoutResponse === false} onClick={() => { setConformityForm(f => ({ ...f, standoutResponse: false, standoutJustification: "" })); setConformityMutation.mutate({ id: selectedEventId!, data: { standoutResponse: false } }); }} className="flex-1 min-h-[28px] px-2 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: conformityForm.standoutResponse === false ? "var(--primary)" : "transparent", color: conformityForm.standoutResponse === false ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>Não</button>
                          <button type="button" aria-pressed={conformityForm.standoutResponse === true} onClick={() => { setConformityForm(f => ({ ...f, standoutResponse: true })); setConformityMutation.mutate({ id: selectedEventId!, data: { standoutResponse: true } }); }} className="flex-1 min-h-[28px] px-2 text-[11px] font-black uppercase transition-all" style={{ backgroundColor: conformityForm.standoutResponse === true ? GOOD : "transparent", color: conformityForm.standoutResponse === true ? "#fff" : "var(--muted-foreground)" }}>Sim</button>
                        </div>
                        {conformityForm.standoutResponse === true && (
                          <div className="flex gap-1">
                            <Textarea value={conformityForm.standoutJustification} onChange={e => setConformityForm(f => ({ ...f, standoutJustification: e.target.value }))} placeholder="Justificativa do destaque..." className="text-[11px] resize-none min-h-[36px] p-1 flex-1 rounded" style={fieldStyle} />
                            <button type="button" disabled={setConformityMutation.isPending} onClick={() => setConformityMutation.mutate({ id: selectedEventId!, data: { standoutJustification: conformityForm.standoutJustification || null } })} className="px-1.5 rounded font-black text-[11px] disabled:opacity-50 transition-colors hover:opacity-90 shrink-0 self-start" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                              <Save size={9} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] leading-snug">
                        {conformityForm.standoutResponse === null ? <span style={{ color: "var(--muted-foreground)" }}>Pendente</span> : conformityForm.standoutResponse ? (conformityForm.standoutJustification || "Sim") : "Não"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
  );
}
