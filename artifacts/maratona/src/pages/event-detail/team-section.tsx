// Equipe Alocada: cartões dos participantes com ativar/inativar, remover,
// troca de cargo no evento e comentário obrigatório de inativo.
// As mutações e o estado dos diálogos ficam na página.
import { useState, useEffect } from "react";
import type { useUpdateEventParticipant } from "@workspace/api-client-react";
import { Check, ChevronDown, Loader2, MessageSquare, Trash2, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { cn, plural } from "@/lib/utils";
import { functionOptionsFor, matchParticipantFunction } from "./helpers";
import { Avatar, Chip, EmptyBlock, FOCUS_RING, Section, btnSmall, fieldCls, iconBtn } from "./detail-ui";
import type { EventDetail } from "./types";

function ParticipantCommentBox({
  participantId, employeeId, employeeName, initialComment, canManage, reason, onSave, isSaving,
}: {
  participantId: number; employeeId: number; employeeName: string; initialComment: string | null | undefined;
  canManage: boolean; reason: string; onSave: (value: string) => void; isSaving: boolean;
}) {
  const [value, setValue] = useState(initialComment ?? "");
  useEffect(() => { setValue(initialComment ?? ""); }, [initialComment, participantId]);
  const dirty = value.trim() !== (initialComment ?? "").trim();
  const id = `participant-comment-${employeeId}`;

  if (!canManage) {
    if (!initialComment) return null;
    return (
      <div className="rounded-lg bg-[var(--status-warn-bg)] px-3 py-2.5 flex items-start gap-2">
        <MessageSquare size={14} aria-hidden className="shrink-0 mt-[3px] text-[var(--status-warn-text)]" />
        <p className="text-[13.5px] leading-snug whitespace-pre-wrap text-foreground">{initialComment}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[var(--status-warn-bg)] p-3 space-y-2">
      <label htmlFor={id} className="font-condensed flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-[var(--status-warn-text)]">
        <MessageSquare size={13} aria-hidden /> {reason}
      </label>
      <textarea
        id={id}
        data-testid={`textarea-participant-comment-${employeeId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex.: não compareceu, avisou no dia."
        rows={2}
        className={cn(fieldCls, "w-full px-3 py-2 text-[14px] leading-snug min-h-[64px] max-h-[120px] resize-y")}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] text-muted-foreground" aria-live="polite">
          {isSaving ? "Salvando…" : dirty ? "Não salvo" : initialComment ? <span className="inline-flex items-center gap-1 text-[var(--status-ok-text)]"><Check size={13} aria-hidden /> Salvo</span> : ""}
        </span>
        <button
          type="button"
          data-testid={`button-save-participant-comment-${employeeId}`}
          disabled={isSaving || !dirty}
          onClick={() => onSave(value.trim())}
          className={cn(btnSmall, "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary enabled:hover:opacity-90 disabled:bg-card disabled:text-muted-foreground disabled:border-border")}
        >
          {isSaving && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
          {isSaving ? "Salvando…" : "Salvar comentário"}
        </button>
      </div>
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
  const participants = event.participants ?? [];
  const counted = participants.filter(p => p.countsForScore !== false).length;
  const inactive = participants.filter(p => p.confirmed === false).length;
  return (
    <Section
      id="event-team"
      testId="section-event-team"
      title="Equipe alocada"
      icon={Users}
      count={counted}
      description={inactive > 0
        ? `${plural(inactive, "colaborador inativo", "colaboradores inativos")}: justifique para o RH.`
        : "Os participantes avaliados neste evento."}
      action={canManageTeam ? (
        <button type="button" data-testid="button-add-participant" onClick={onAddParticipant} className={btnSmall}>
          <UserPlus size={15} aria-hidden /> Adicionar
        </button>
      ) : undefined}
    >
      {participants.length === 0 ? (
        <EmptyBlock icon={Users} title="Nenhum colaborador alocado" className="py-10">
          {canManageTeam ? "Adicione quem trabalhou no evento, ou aguarde a sincronização da Logística Interna." : "A equipe aparece aqui quando for sincronizada."}
        </EmptyBlock>
      ) : (
        // Colunas pela largura real (com o menu aberto a 768 sobravam ~200px por
        // cartão e o nome quebrava no meio: "PEREIR A").
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,272px),1fr))] gap-3 p-4 sm:p-5">
          {participants.slice().sort((a, b) => {
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
            const fnValue = matchParticipantFunction(p.functionName);
            return (
              <li
                key={p.id}
                data-testid={`chip-participant-${p.employeeId}`}
                className={cn("relative flex flex-col gap-3 rounded-xl border p-3.5 transition-colors duration-150",
                  isInactive ? "border-[var(--status-warn)]/50 bg-card" : "border-border bg-card")}
              >
                {(isInactive || isInformational) && <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[var(--status-warn)]" />}
                <div className="flex items-start gap-3">
                  <Avatar name={p.employeeName} className={cn(isInactive && "opacity-60")} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-condensed text-[16.5px] font-black uppercase leading-tight break-words", isInactive ? "text-muted-foreground" : "text-foreground")}>{p.employeeName}</p>
                    {canManageTeam ? (
                      <div className="relative mt-1.5 w-fit max-w-full">
                        <select
                          value={fnValue}
                          aria-label={`Cargo de ${p.employeeName} neste evento`}
                          title="Cargo/função deste colaborador neste evento"
                          onChange={(e) => {
                            if (e.target.value !== fnValue) {
                              updateParticipant.mutate({ id, participantId: p.id, data: { functionName: e.target.value } });
                            }
                          }}
                          className={cn("font-condensed appearance-none max-w-full h-11 md:h-8 pl-2.5 pr-7 rounded-md border border-border bg-card text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer transition-colors", FOCUS_RING)}
                        >
                          {functionOptionsFor(p.functionName).map(fn => (
                            <option key={fn} value={fn}>{fn}</option>
                          ))}
                        </select>
                        <ChevronDown size={13} aria-hidden className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                      </div>
                    ) : (
                      <p className="font-condensed mt-1 text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{p.functionName}</p>
                    )}
                  </div>
                  {canManageTeam && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid={`button-toggle-participant-${p.employeeId}`}
                        onClick={() => updateParticipant.mutate({ id, participantId: p.id, data: { confirmed: isInactive } })}
                        className={cn(iconBtn, isInactive ? "" : "text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]")}
                        title={isInactive ? "Reativar colaborador" : "Marcar como inativo (não compareceu)"}
                        aria-label={isInactive ? `Reativar ${p.employeeName}` : `Marcar ${p.employeeName} como inativo (não compareceu)`}
                      >
                        {isInactive ? <UserCheck size={15} aria-hidden="true" /> : <UserX size={15} aria-hidden="true" />}
                      </button>
                      <button
                        type="button"
                        data-testid={`button-remove-participant-${p.employeeId}`}
                        onClick={() => onRequestRemoveParticipant(p.id)}
                        className={cn(iconBtn, "text-muted-foreground hover:text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]")}
                        title="Remover do evento"
                        aria-label={`Remover ${p.employeeName} do evento`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pl-12">
                  <Chip>{p.employmentType === "freela" ? "Freela" : "Casa"}</Chip>
                  {isInactive && <Chip tone="danger">Inativo</Chip>}
                  {isInformational && (
                    <span data-testid={`badge-no-score-${p.employeeId}`} className="inline-flex" title="Participação apenas histórica/informativa — não entra na nota nem na elegibilidade.">
                      <Chip tone="warn">Não conta p/ nota</Chip>
                    </span>
                  )}
                </div>

                {isInactive && (
                  <ParticipantCommentBox
                    participantId={p.id}
                    employeeId={p.employeeId}
                    employeeName={p.employeeName}
                    initialComment={p.comment}
                    canManage={canManageTeam}
                    reason="Inativo — justifique"
                    isSaving={updateParticipant.isPending}
                    onSave={(value) => updateParticipant.mutate({ id, participantId: p.id, data: { comment: value || null } })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
