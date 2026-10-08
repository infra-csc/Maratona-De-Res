// Bloco "Matriz de Conformidade" da coluna de contexto — editável para gestores.
// Cada S/N/? grava na hora (mesma chamada de antes); comentários, faltas e a
// justificativa do destaque gravam no "Salvar" de cada um.
import { Check, Loader2, MessageSquare, AlertCircle, Trophy, UserRound } from "lucide-react";
import type { EventDetail } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Chip, Eyebrow, btnSmall } from "../evaluations/ui";
import { Segmented, fieldCls } from "./cal-ui";
import type { ConformityState } from "./use-conformity";

export type ConformityPanelProps = {
  selectedEventId: number | null;
  fullEvent: EventDetail | undefined;
  conformityState: ConformityState;
};

type Tri = "yes" | "no" | "na";
const toTri = (v: boolean | null): Tri => (v === true ? "yes" : v === false ? "no" : "na");
const fromTri = (t: Tri): boolean | null => (t === "yes" ? true : t === "no" ? false : null);

export function ConformityPanel({ selectedEventId, fullEvent, conformityState }: ConformityPanelProps) {
  const {
    conformity, setConformityMutation, conformityForm, setConformityForm,
    conformityExpandedComments, setConformityExpandedComments, canManageConformity,
  } = conformityState;
  const m = setConformityMutation;
  const save = (data: Record<string, unknown>) => m.mutate({ id: selectedEventId!, data });
  const toggleComment = (key: string) => setConformityExpandedComments(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const absencesDirty = conformityForm.absencesReport !== (conformity?.absencesReport ?? "");
  const standoutDirty = conformityForm.standoutJustification !== (conformity?.standoutJustification ?? "");

  const items = ([
    { label: "EPI", key: "epi" as const, commentKey: "epiComment" as const },
    { label: "Estaiamento", key: "estaiamentos" as const, commentKey: "estaiamentosComment" as const },
    { label: "Conduta", key: "conduta" as const, commentKey: "condutaComment" as const },
    { label: "Guarda de equipamentos", key: "guardaEquipamentos" as const, commentKey: "guardaEquipamentosComment" as const },
  // Ciclo novo: a Conduta sai da matriz (avaliada no critério Proatividade/Conduta).
  ]).filter(item => !(item.key === "conduta" && fullEvent?.conformityWithoutConduta));

  return (
    <section className="px-4 py-4" aria-labelledby="cal-conformity-title">
      <div className="flex items-center gap-2 mb-1">
        <Eyebrow as="h3" id="cal-conformity-title" className="text-foreground">Matriz de Conformidade</Eyebrow>
        <span className="ml-auto text-[12px] font-semibold" aria-live="polite">
          {m.isPending ? <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 size={12} className="animate-spin" aria-hidden /> Salvando…</span>
            : m.isError ? <span className="inline-flex items-center gap-1 text-[var(--status-danger-text)]"><AlertCircle size={12} aria-hidden /> Não salvou</span>
            : m.isSuccess ? <span className="inline-flex items-center gap-1 text-[var(--status-ok-text)]"><Check size={12} aria-hidden /> Salvo</span>
            : null}
        </span>
      </div>
      {m.isError && (
        <p className="text-[12.5px] text-[var(--status-danger-text)] mb-2">{(m.error as { message?: string } | null)?.message ?? "Tente de novo."}</p>
      )}
      {(fullEvent?.conformityEvaluatorName || fullEvent?.conformityEvaluatorFerramentasName) && (
        <div className="mb-3 space-y-0.5 text-[12.5px] text-muted-foreground">
          {fullEvent?.conformityEvaluatorName && <p>Cenografia: <span className="font-semibold text-foreground">{fullEvent.conformityEvaluatorName}</span></p>}
          {fullEvent?.conformityEvaluatorFerramentasName && <p>Ferramentas: <span className="font-semibold text-foreground">{fullEvent.conformityEvaluatorFerramentasName}</span></p>}
        </div>
      )}

      <ul className="space-y-1.5">
        {items.map(item => {
          const value = conformityForm[item.key];
          const comment = conformityForm[item.commentKey];
          const savedComment = (conformity?.[item.commentKey] as string | null | undefined) ?? "";
          const commentDirty = comment !== savedComment;
          const isExpanded = conformityExpandedComments.has(item.key);
          // Quem preencheu cada seção (gravado no save). "Guarda" = Ferramentas; demais = Cenografia.
          const answeredByName = item.key === "guardaEquipamentos"
            ? conformity?.ferramentasSubmittedByName ?? null
            : conformity?.cenografiaSubmittedByName ?? null;
          return (
            <li key={item.key} className="relative rounded-lg bg-secondary/50 pl-3.5 pr-2 py-2">
              <span aria-hidden className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full",
                value === true ? "bg-[var(--status-ok)]" : value === false ? "bg-[var(--status-danger)]" : "bg-border")} />
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-foreground leading-tight">{item.label}</p>
                  {value !== null && answeredByName && (
                    <p className="text-[12px] text-muted-foreground leading-tight mt-0.5 truncate">por {answeredByName}</p>
                  )}
                </div>
                {canManageConformity ? (
                  <Segmented<Tri>
                    label={`${item.label}: conformidade`}
                    size="sm"
                    className="shrink-0 w-[112px]"
                    value={toTri(value)}
                    onChange={t => { const v = fromTri(t); setConformityForm({ ...conformityForm, [item.key]: v }); save({ [item.key]: v }); }}
                    options={[
                      { value: "yes", label: "S", ariaLabel: "Sim", title: "Sim", activeCls: "bg-primary text-primary-foreground shadow-sm" },
                      { value: "no", label: "N", ariaLabel: "Não", title: "Não", activeCls: "bg-[var(--destructive)] text-[var(--destructive-foreground)] shadow-sm" },
                      { value: "na", label: "?", ariaLabel: "Não se aplica", title: "Não se aplica / sem resposta" },
                    ]}
                  />
                ) : (
                  <Chip tone={value === null ? "neutral" : value ? "ok" : "danger"}>{value === null ? "—" : value ? "OK" : "Não"}</Chip>
                )}
                {canManageConformity && (
                  <button
                    type="button"
                    onClick={() => toggleComment(item.key)}
                    aria-expanded={isExpanded}
                    aria-label={comment ? `Ver ou editar o comentário de ${item.label}` : `Adicionar comentário em ${item.label}`}
                    title={comment ? "Ver/editar comentário" : "Adicionar comentário"}
                    className={cn("shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      comment ? "text-foreground bg-card shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-card")}
                  >
                    <MessageSquare size={14} aria-hidden />
                  </button>
                )}
              </div>
              {isExpanded && canManageConformity && (
                <div className="mt-2 space-y-2 motion-safe:animate-in motion-safe:fade-in-0 duration-150">
                  <label htmlFor={`conf-comment-${item.key}`} className="sr-only">Comentário de {item.label}</label>
                  <textarea id={`conf-comment-${item.key}`} value={comment} rows={2}
                    onChange={e => setConformityForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                    placeholder="Observação…" className={cn(fieldCls, "w-full px-3 py-2 text-[13.5px] leading-snug resize-y min-h-[64px] bg-card")} />
                  <div className="flex items-center gap-2">
                    {commentDirty && <span className="text-[12px] font-semibold text-[var(--status-warn-text)]">Não salvo</span>}
                    <button type="button" disabled={m.isPending || !commentDirty} onClick={() => save({ [item.commentKey]: comment || null })} className={cn(btnSmall, "ml-auto")}>
                      Salvar comentário
                    </button>
                  </div>
                </div>
              )}
              {!isExpanded && comment && (
                <button type="button" onClick={() => toggleComment(item.key)}
                  className="mt-1 block w-full text-left text-[12.5px] text-muted-foreground line-clamp-2 hover:text-foreground">
                  “{comment}”
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* Faltas e atrasos */}
      <div className="mt-4">
        <label htmlFor="conf-absences" className="font-condensed flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5">
          <UserRound size={13} aria-hidden /> Faltas e atrasos
        </label>
        {canManageConformity ? (
          <>
            <textarea id="conf-absences" value={conformityForm.absencesReport} rows={2}
              onChange={e => setConformityForm(f => ({ ...f, absencesReport: e.target.value }))}
              placeholder="Sem registro" className={cn(fieldCls, "w-full px-3 py-2 text-[13.5px] leading-snug resize-y min-h-[64px]", absencesDirty && "border-[var(--status-warn)]")} />
            {absencesDirty && (
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[var(--status-warn-text)]">Não salvo</span>
                <button type="button" disabled={m.isPending} onClick={() => save({ absencesReport: conformityForm.absencesReport || null })} className={cn(btnSmall, "ml-auto")}>
                  Salvar faltas
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-[13.5px] leading-snug">{conformityForm.absencesReport || <span className="text-muted-foreground">Sem registro</span>}</p>
        )}
      </div>

      {/* Destaque */}
      <div className="mt-4">
        <p className="font-condensed flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-1.5" id="conf-standout-label">
          <Trophy size={13} aria-hidden /> Destaque no evento
        </p>
        {canManageConformity ? (
          <div className="space-y-2">
            <Segmented<"no" | "yes">
              label="Destaque no evento"
              value={conformityForm.standoutResponse === true ? "yes" : conformityForm.standoutResponse === false ? "no" : null}
              onChange={v => {
                if (v === "no") { setConformityForm(f => ({ ...f, standoutResponse: false, standoutJustification: "" })); save({ standoutResponse: false }); }
                else { setConformityForm(f => ({ ...f, standoutResponse: true })); save({ standoutResponse: true }); }
              }}
              options={[
                { value: "no", label: "Não" },
                { value: "yes", label: "Sim", activeCls: "bg-primary text-primary-foreground shadow-sm" },
              ]}
            />
            {conformityForm.standoutResponse === null && <p className="text-[12.5px] text-muted-foreground">Ainda sem resposta.</p>}
            {conformityForm.standoutResponse === true && (
              <div className="motion-safe:animate-in motion-safe:fade-in-0 duration-150">
                <label htmlFor="conf-standout" className="sr-only">Justificativa do destaque</label>
                <textarea id="conf-standout" value={conformityForm.standoutJustification} rows={2}
                  onChange={e => setConformityForm(f => ({ ...f, standoutJustification: e.target.value }))}
                  placeholder="Quem se destacou e por quê…" className={cn(fieldCls, "w-full px-3 py-2 text-[13.5px] leading-snug resize-y min-h-[64px]", standoutDirty && "border-[var(--status-warn)]")} />
                {standoutDirty && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[var(--status-warn-text)]">Não salvo</span>
                    <button type="button" disabled={m.isPending} onClick={() => save({ standoutJustification: conformityForm.standoutJustification || null })} className={cn(btnSmall, "ml-auto")}>
                      Salvar justificativa
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[13.5px] leading-snug">
            {conformityForm.standoutResponse === null ? <span className="text-muted-foreground">Pendente</span> : conformityForm.standoutResponse ? (conformityForm.standoutJustification || "Sim") : "Não"}
          </p>
        )}
      </div>
    </section>
  );
}
