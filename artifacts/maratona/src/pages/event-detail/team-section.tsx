// Equipe Alocada: cards dos participantes com ativar/inativar, remover,
// troca de cargo no evento e comentário obrigatório de inativo.
// As mutações e o estado dos diálogos ficam na página.
import { useState, useEffect } from "react";
import type { useUpdateEventParticipant } from "@workspace/api-client-react";
import { Trash2, UserCheck, UserX, UserPlus, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { CONDENSED, WARNING, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle, functionOptionsFor, matchParticipantFunction } from "./helpers";
import type { EventDetail } from "./types";

function ParticipantCommentBox({
  participantId, employeeId, initialComment, canManage, reason, onSave, isSaving, isInactive,
}: {
  participantId: number; employeeId: number; initialComment: string | null | undefined;
  canManage: boolean; reason: string; onSave: (value: string) => void; isSaving: boolean; isInactive?: boolean;
}) {
  const [value, setValue] = useState(initialComment ?? "");
  useEffect(() => { setValue(initialComment ?? ""); }, [initialComment, participantId]);
  const dirty = value.trim() !== (initialComment ?? "").trim();

  if (!canManage) {
    if (!initialComment) return null;
    return (
      <div className="mt-1 p-2 flex items-start gap-1.5 rounded-lg" style={{ backgroundColor: "rgba(232,162,61,0.08)", border: "1px solid rgba(232,162,61,0.3)" }}>
        <MessageSquare size={12} className="shrink-0 mt-[2px]" style={{ color: AMBER_TEXT }} />
        <p className="text-[11px] font-semibold whitespace-pre-wrap">{initialComment}</p>
      </div>
    );
  }

  return (
    <div className="mt-1 p-2 space-y-1.5 rounded-lg" style={{ backgroundColor: "rgba(232,162,61,0.08)", border: "1px solid rgba(232,162,61,0.3)" }}>
      <p className="text-[11px] font-black uppercase flex items-center gap-1.5" style={{ color: AMBER_TEXT }}>
        <MessageSquare size={12} /> {reason}
      </p>
      <Textarea
        data-testid={`textarea-participant-comment-${employeeId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Comentário / justificativa..."
        className="text-xs rounded-lg min-h-[56px] max-h-[80px] resize-none"
        style={fieldStyle}
      />
      <button
        type="button"
        data-testid={`button-save-participant-comment-${employeeId}`}
        disabled={isSaving || !dirty}
        onClick={() => onSave(value.trim())}
        className="px-3 py-1 rounded-lg font-black uppercase text-[11px] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        {isSaving ? "Salvando..." : "Salvar comentário"}
      </button>
    </div>
  );
}

export type TeamSectionProps = {
  id: number;
  event: EventDetail;
  canManageTeam: boolean;
  updateParticipant: ReturnType<typeof useUpdateEventParticipant>;
  onAddParticipant: () => void;
  onRequestRemoveParticipant: (participantId: number) => void;
};

export function TeamSection({ id, event, canManageTeam, updateParticipant, onAddParticipant, onRequestRemoveParticipant }: TeamSectionProps) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Equipe Alocada ({event.participants?.filter(p => p.countsForScore !== false).length ?? 0})</span>
        {canManageTeam && (
          <button
            data-testid="button-add-participant"
            onClick={onAddParticipant}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors hover:opacity-80"
            style={{ border: "1px solid var(--border)" }}
          >
            <UserPlus size={12} /> Adicionar
          </button>
        )}
      </div>
      {(!event.participants || event.participants.length === 0) ? (
        <div className="py-8 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador alocado.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 items-stretch">
          {event.participants.slice().sort((a, b) => {
            const aScores = a.countsForScore !== false ? 0 : 1;
            const bScores = b.countsForScore !== false ? 0 : 1;
            if (aScores !== bScores) return aScores - bScores;
            return a.employeeName.localeCompare(b.employeeName, "pt-BR");
          }).map(p => {
            const isInactive = p.confirmed === false;
            const isInformational = p.countsForScore === false;
            // Sem validação/controle de diárias: a sincronização com a Logística
            // Interna decide quem participou. Se a pessoa não foi, marca-se
            // inativo aqui; se foi e não veio na sincronização, adiciona-se
            // manualmente — sem exigir diárias registradas para confirmar resultados.
            const showCommentBox = isInactive;
            const commentReason = "Colaborador inativo — justifique";
            return (
              <div
                key={p.id}
                data-testid={`chip-participant-${p.employeeId}`}
                className="flex flex-col h-full rounded-lg overflow-hidden relative"
                style={{ border: "1px solid var(--border)" }}
              >
                {(isInactive || isInformational) && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: WARNING }} />}
                <div className="flex flex-col flex-1 p-4 gap-2" style={{ opacity: isInactive ? 0.55 : 1 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                      {p.employeeName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <p className="flex-1 font-bold uppercase text-sm leading-tight min-w-0 break-words">{p.employeeName}</p>
                    {canManageTeam && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          data-testid={`button-toggle-participant-${p.employeeId}`}
                          onClick={() => updateParticipant.mutate({ id, participantId: p.id, data: { confirmed: isInactive } })}
                          className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                          style={isInactive ? { border: "1px solid var(--border)" } : { backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}
                          title={isInactive ? "Reativar colaborador" : "Marcar como inativo (não compareceu)"}
                          aria-label={isInactive ? `Reativar ${p.employeeName}` : `Marcar ${p.employeeName} como inativo (não compareceu)`}
                        >
                          {isInactive ? <UserCheck size={13} aria-hidden="true" /> : <UserX size={13} aria-hidden="true" />}
                        </button>
                        <button
                          data-testid={`button-remove-participant-${p.employeeId}`}
                          onClick={() => onRequestRemoveParticipant(p.id)}
                          className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                          style={{ backgroundColor: "rgba(229,72,77,0.12)", color: DANGER_TEXT }}
                          title="Remover do evento"
                          aria-label={`Remover ${p.employeeName} do evento`}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  {canManageTeam ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={matchParticipantFunction(p.functionName)}
                        onChange={(e) => {
                          if (e.target.value !== matchParticipantFunction(p.functionName)) {
                            updateParticipant.mutate({ id, participantId: p.id, data: { functionName: e.target.value } });
                          }
                        }}
                        className="text-[11px] font-bold uppercase bg-transparent border-0 border-b border-dashed focus:outline-none cursor-pointer px-0 py-0 leading-tight appearance-none pr-3"
                        style={{ color: "var(--muted-foreground)", borderBottomColor: "var(--border)" }}
                        title="Cargo/função deste colaborador neste evento"
                      >
                        {functionOptionsFor(p.functionName).map(fn => (
                          <option key={fn} value={fn}>{fn}</option>
                        ))}
                      </select>
                      {isInactive && <span className="text-[11px] font-bold uppercase" style={{ color: DANGER_TEXT }}>· Inativo</span>}
                    </div>
                  ) : (
                    <p className="text-[11px] font-bold uppercase leading-tight" style={{ color: "var(--muted-foreground)" }}>
                      {p.functionName}{isInactive && <span style={{ color: DANGER_TEXT }}> · Inativo</span>}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase" style={{ backgroundColor: p.employmentType === "freela" ? "var(--secondary)" : "transparent", border: "1px solid var(--border)" }}>
                      {p.employmentType === "freela" ? "Freela" : "Casa"}
                    </span>
                    {isInformational && (
                      <span
                        data-testid={`badge-no-score-${p.employeeId}`}
                        className="px-2 py-0.5 rounded text-[11px] font-bold uppercase"
                        style={{ backgroundColor: WARNING, color: "#fff" }}
                        title="Participação apenas histórica/informativa — não entra na nota nem na elegibilidade."
                      >
                        Não conta p/ nota
                      </span>
                    )}
                  </div>
                </div>
                {showCommentBox && (
                  <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                    <ParticipantCommentBox
                      participantId={p.id}
                      employeeId={p.employeeId}
                      initialComment={p.comment}
                      canManage={canManageTeam}
                      reason={commentReason}
                      isInactive={isInactive}
                      isSaving={updateParticipant.isPending}
                      onSave={(value) => updateParticipant.mutate({ id, participantId: p.id, data: { comment: value || null } })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
