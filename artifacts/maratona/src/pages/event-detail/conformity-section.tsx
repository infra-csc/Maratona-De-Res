// Matriz de Conformidade: avaliadores de Ferramentas/Cenografia, itens
// Sim/Não/Pendente com comentário, respostas extras (faltas e destaque) e o
// desconto na nota. O formulário vive na página (os cards do topo também o
// leem); as mutações e o estado de UI ficam aqui.
import { useState } from "react";
import {
  useGetUsers, useSetEventConformity, useSetConformityEvaluator, useSetConformityEvaluatorFerramentas,
  getGetUsersQueryKey, getGetEventQueryKey, getGetEventResultQueryKey, getGetEventConformityQueryKey, getGetRankingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronsUpDown, Info, Loader2, MessageSquare, ShieldCheck, UserCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn, apiErrorMessage } from "@/lib/utils";
import { conformityItemsFor } from "./helpers";
import { MatrixQuestion, Segmented as SegmentedYesNo, matrixLabelCls, matrixTextareaCls } from "../evaluations/conformity-bits";
import { Chip, Eyebrow, FOCUS_RING, Notice, Section, btnGhost, btnSmall, fieldCls, iconBtn } from "./detail-ui";
import type { ConformityForm, EventConformity, EventDetail, ImportedConformityRatio, SetState } from "./types";

export type ConformitySectionProps = {
  id: number;
  event: EventDetail;
  canManage: boolean;
  canManageConformity: boolean;
  conformityData: EventConformity | null | undefined;
  conformityForm: ConformityForm;
  setConformityForm: SetState<ConformityForm>;
  importedConformityRatio: ImportedConformityRatio | null;
  importedConformityAllValue: boolean | null;
  conformityPenalty: number | undefined;
  /**
   * Evento de ciclo fechado (só consulta): o que ficou sem resposta é só
   * "Não respondida", em tom neutro — não há mais nada a cobrar.
   */
  readOnly?: boolean;
  /**
   * Evento do PRÓXIMO ciclo: respostas da Matriz só quando o ciclo novo for
   * criado (a API responde 409 EVENT_NEXT_CYCLE) — só leitura, com a frase
   * única. O responsável continua podendo ser escolhido (preparação).
   */
  nextCycle?: boolean;
};

export function ConformitySection({
  id, event, canManage, canManageConformity, conformityData, conformityForm, setConformityForm,
  importedConformityRatio, importedConformityAllValue, conformityPenalty, readOnly = false, nextCycle = false,
}: ConformitySectionProps) {
  // Sem cobrança (tom neutro) quando não há o que responder agora.
  const neutral = readOnly || nextCycle;
  const { toast } = useToast();
  const qc = useQueryClient();

  // Lista de avaliadores só serve para os seletores, que só admin/RH veem.
  const { data: usersList } = useGetUsers({ query: { enabled: canManage, queryKey: getGetUsersQueryKey() } });
  const evaluators = (usersList ?? []).filter(u => u.role === "avaliador" && u.active);

  const [conformityEvaluatorPickerOpen, setConformityEvaluatorPickerOpen] = useState(false);
  const setConformityEvaluatorMutation = useSetConformityEvaluator({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        setConformityEvaluatorPickerOpen(false);
        toast({ title: "Avaliador de Cenografia atualizado" });
      },
      onError: (e: unknown) => toast({ title: "Erro ao atribuir avaliador", description: apiErrorMessage(e, "Não foi possível salvar. Tente de novo."), variant: "destructive" }),
    },
  });

  const [conformityEvaluatorFerramentasPickerOpen, setConformityEvaluatorFerramentasPickerOpen] = useState(false);
  const setConformityEvaluatorFerramentasMutation = useSetConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        setConformityEvaluatorFerramentasPickerOpen(false);
        toast({ title: "Avaliador de Ferramentas e Case atualizado" });
      },
      onError: (e: unknown) => toast({ title: "Erro ao atribuir avaliador", description: apiErrorMessage(e, "Não foi possível salvar. Tente de novo."), variant: "destructive" }),
    },
  });

  const setConformity = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventConformityQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetEventResultQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: getGetRankingQueryKey() });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
        toast({ title: "Matriz de conformidade atualizada", variant: "default" });
      },
      // Qualquer erro: a marcação otimista é desfeita (save → revert) e a
      // Matriz é relida do servidor; o toast traz a mensagem do servidor.
      onError: (e: unknown) => {
        qc.invalidateQueries({ queryKey: getGetEventConformityQueryKey(id) });
        toast({ title: "Matriz não foi salva", description: apiErrorMessage(e, "Não foi possível salvar. Tente de novo."), variant: "destructive" });
      },
    },
  });
  type ConformityPatch = Parameters<typeof setConformity.mutate>[0]["data"];
  /** Salva um pedaço da Matriz; em erro, `revert` desfaz o que a tela marcou antes da resposta. */
  const save = (data: ConformityPatch, revert?: () => void) =>
    setConformity.mutate({ id, data }, { onError: () => revert?.() });
  /** Marca um item (Sim/Não/Pendente) na hora e desfaz se o servidor recusar. */
  const markItem = (key: "epi" | "estaiamentos" | "guardaEquipamentos" | "conduta" | "standoutResponse", value: boolean | null) => {
    const prev = conformityForm[key];
    setConformityForm(f => ({ ...f, [key]: value }));
    save({ [key]: value } as ConformityPatch, () => setConformityForm(f => ({ ...f, [key]: prev })));
  };

  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const toggleComment = (key: string, force?: boolean) => setExpandedComments(prev => {
    const next = new Set(prev);
    if (force ?? !next.has(key)) next.add(key); else next.delete(key);
    return next;
  });

  const allItems = conformityItemsFor(event);
  const answered = allItems.filter(i => conformityForm[i.key] !== null).length;
  const pickers = [
    { key: "ferramentas", label: "Ferramentas e case", open: conformityEvaluatorFerramentasPickerOpen, setOpen: setConformityEvaluatorFerramentasPickerOpen, current: event.conformityEvaluatorFerramentasUserId, currentName: event.conformityEvaluatorFerramentasName, mut: setConformityEvaluatorFerramentasMutation },
    { key: "cenografia", label: "Cenografia", open: conformityEvaluatorPickerOpen, setOpen: setConformityEvaluatorPickerOpen, current: event.conformityEvaluatorUserId, currentName: event.conformityEvaluatorName, mut: setConformityEvaluatorMutation },
  ];

  return (
    <Section
      id="event-matrix"
      testId="section-event-matrix"
      title="Matriz de Conformidade"
      icon={ShieldCheck}
      count={`${answered}/${allItems.length}`}
      description="Cenografia e Ferramentas e case. Cada “Não” desconta 10 pts da nota do evento."
    >
      {/* Próximo ciclo: a frase única fica no topo da página; aqui só "Ainda não abre" em cada item. */}
      {canManage ? (
        <div className="grid sm:grid-cols-2 gap-px bg-border border-b border-border">
          {pickers.map(g => (
            <div key={g.key} className="bg-card px-4 sm:px-5 py-3">
              <Eyebrow as="p" id={`matrix-resp-${g.key}`} className="mb-1.5">Responsável · {g.label}</Eyebrow>
              <Popover open={g.open} onOpenChange={g.setOpen}>
                <PopoverTrigger asChild>
                  <button type="button" aria-labelledby={`matrix-resp-${g.key} matrix-resp-${g.key}-value`} title={g.currentName ?? "Sem avaliador"}
                    disabled={g.mut.isPending}
                    className={cn(fieldCls, "w-full h-11 md:h-9 px-3 flex items-center gap-2 text-left text-[14px] hover:bg-secondary/50 disabled:opacity-60", FOCUS_RING)}>
                    {g.mut.isPending ? <Loader2 size={14} aria-hidden className="shrink-0 motion-safe:animate-spin text-muted-foreground" /> : <UserCheck size={14} aria-hidden className="shrink-0 text-muted-foreground" />}
                    <span id={`matrix-resp-${g.key}-value`} className={cn("truncate flex-1", g.currentName ? "font-semibold text-foreground" : "text-muted-foreground")}>{g.currentName ?? "Sem avaliador"}</span>
                    <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={6} className="font-body p-0 rounded-xl border-border bg-popover text-popover-foreground shadow-lg w-[min(300px,calc(100vw-32px))]">
                  <Command>
                    <CommandInput placeholder="Buscar avaliador…" />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty className="py-5 text-center text-[14px] text-muted-foreground">Nenhum avaliador encontrado.</CommandEmpty>
                      <CommandGroup>
                        {g.current == null && (
                          <CommandItem value="Sem avaliador" onSelect={() => g.mut.mutate({ id, data: { userId: null } })} className="cursor-pointer py-2 gap-2.5 rounded-lg">
                            <Check size={14} aria-hidden className="shrink-0 opacity-100" />
                            <span className="text-[14px] text-muted-foreground">Sem avaliador</span>
                          </CommandItem>
                        )}
                        {evaluators.map(u => (
                          <CommandItem key={u.id} value={u.name} onSelect={() => g.mut.mutate({ id, data: { userId: u.id } })} className="cursor-pointer py-2 gap-2.5 rounded-lg">
                            <Check size={14} aria-hidden className={cn("shrink-0", g.current === u.id ? "opacity-100" : "opacity-0")} />
                            <span className="text-[14px] font-semibold truncate">{u.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          ))}
        </div>
      ) : (event.conformityEvaluatorName || event.conformityEvaluatorFerramentasName) ? (
        <div className="grid sm:grid-cols-2 gap-px bg-border border-b border-border">
          {pickers.map(g => (
            <div key={g.key} className="bg-card px-4 sm:px-5 py-3">
              <Eyebrow as="p" className="mb-1">Responsável · {g.label}</Eyebrow>
              <p className={cn("text-[14px] truncate", g.currentName ? "font-semibold text-foreground" : "text-muted-foreground")}>{g.currentName ?? "—"}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!conformityData && importedConformityRatio && (
        <div className="px-4 sm:px-5 pt-3.5">
          <Notice icon={Info} tone="neutral">
            {importedConformityAllValue !== null
              ? `Inferido das observações importadas (${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim").`
              : `Observações importadas indicam ${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim" — não é possível identificar qual item pelo texto.`}
          </Notice>
        </div>
      )}

      {(["cenografia", "ferramentas"] as const).map(group => {
        const groupItems = allItems.filter(i => i.group === group);
        if (groupItems.length === 0) return null;
        const groupLabel = group === "cenografia" ? "Cenografia" : "Ferramentas e Case";
        const evaluatorName = group === "cenografia" ? (event.conformityEvaluatorName ?? null) : (event.conformityEvaluatorFerramentasName ?? null);
        return (
          <div key={group} className="border-t border-border first:border-t-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 sm:px-5 py-2.5 bg-secondary/45">
              <Eyebrow as="h3" className="text-foreground">{groupLabel}</Eyebrow>
              {evaluatorName
                ? <span className="text-[13px] text-muted-foreground">{evaluatorName}</span>
                : neutral
                  ? <span className="text-[13px] text-muted-foreground">{nextCycle ? "sem responsável ainda" : "sem avaliador"}</span>
                  : <Chip tone="danger">Sem avaliador atribuído</Chip>}
            </div>
            <div className="divide-y divide-border">
              {groupItems.map(item => {
                const value = conformityForm[item.key];
                const comment = conformityForm[item.commentKey];
                const isNonConforming = value === false;
                const isPending = value === null;
                const needsComment = (isNonConforming || isPending) && !comment.trim();
                const isExpanded = expandedComments.has(item.key);
                const qid = `matrix-q-${item.key}`;
                return (
                  <div key={item.key} className={cn(isNonConforming && "bg-[var(--status-danger-bg)]/50")}>
                    <MatrixQuestion
                      id={qid}
                      question={item.label}
                      penalty={isNonConforming}
                      unanswered={isPending && !neutral}
                      control={canManageConformity ? (
                        <>
                          <SegmentedYesNo<boolean | null>
                            labelledBy={qid}
                            value={value}
                            onChange={v => markItem(item.key, v)}
                            options={[{ value: true, label: "Sim" }, { value: false, label: "Não", tone: "no" }, { value: null, label: "Pendente", tone: "warn" }]}
                          />
                          <button
                            type="button"
                            title={comment ? "Ver / editar comentário" : "Adicionar comentário"}
                            aria-label={`${comment ? "Ver / editar comentário" : "Adicionar comentário"}: ${item.label}`}
                            aria-expanded={isExpanded}
                            onClick={() => toggleComment(item.key)}
                            className={cn(iconBtn,
                              needsComment ? "text-[var(--status-danger-text)] border-[var(--status-danger)]/40 bg-[var(--status-danger-bg)]"
                                : comment ? "bg-primary text-primary-foreground border-primary hover:bg-primary hover:opacity-90" : "text-muted-foreground")}
                          >
                            <MessageSquare size={15} aria-hidden />
                          </button>
                        </>
                      ) : neutral && value === null ? (
                        <Chip>{nextCycle ? "Ainda não abre" : "Não respondida"}</Chip>
                      ) : (
                        <Chip tone={value === true ? "ok" : value === false ? "danger" : "warn"}>{value === true ? "Sim" : value === false ? "Não" : "Pendente"}</Chip>
                      )}
                    >
                      {isExpanded && canManageConformity ? (
                        <div className="space-y-2">
                          <label htmlFor={`${qid}-comment`} className={matrixLabelCls}>Comentário</label>
                          <Textarea
                            id={`${qid}-comment`}
                            value={comment}
                            onChange={e => setConformityForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                            placeholder={value === false ? "Justifique a não conformidade…" : value === null ? "Descreva o status pendente…" : "Observação adicional (opcional)…"}
                            className={cn(matrixTextareaCls, "min-h-[72px]")}
                          />
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => toggleComment(item.key, false)} className={btnGhost}>Fechar</button>
                            <button
                              type="button"
                              disabled={setConformity.isPending}
                              onClick={() => save({ [item.commentKey]: comment || null } as ConformityPatch)}
                              className={cn(btnSmall, "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary enabled:hover:opacity-90")}
                            >
                              {setConformity.isPending && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
                              {setConformity.isPending ? "Salvando…" : "Salvar comentário"}
                            </button>
                          </div>
                        </div>
                      ) : comment ? (
                        canManageConformity ? (
                          <button type="button" onClick={() => toggleComment(item.key, true)}
                            className={cn("w-full text-left flex items-start gap-2 rounded-lg px-3 py-2 bg-secondary/50 hover:bg-secondary text-[13.5px] text-muted-foreground transition-colors", FOCUS_RING)}>
                            <MessageSquare size={13} aria-hidden className="shrink-0 mt-[3px]" />
                            <span className="line-clamp-2">{comment}</span>
                          </button>
                        ) : (
                          <p className="flex items-start gap-2 rounded-lg px-3 py-2 bg-secondary/50 text-[13.5px] text-muted-foreground">
                            <MessageSquare size={13} aria-hidden className="shrink-0 mt-[3px]" />
                            <span className="whitespace-pre-wrap">{comment}</span>
                          </p>
                        )
                      ) : null}
                    </MatrixQuestion>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Respostas Extras — Cenografia */}
      {(conformityData || canManageConformity) && (
        <div className="border-t border-border">
          <div className="flex items-center gap-2.5 px-4 sm:px-5 py-2.5 bg-secondary/45">
            <Eyebrow as="h3" className="text-foreground">Cenografia</Eyebrow>
            <span className="text-[13px] text-muted-foreground">Respostas extras</span>
          </div>
          <div className="divide-y divide-border">
            <div className="px-4 sm:px-5 py-4 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <p id="matrix-absences" className="text-[15px] font-semibold text-foreground">Faltou / atrasou?</p>
                {conformityForm.absencesResponse !== null
                  ? <Chip tone="ok">Respondido</Chip>
                  : <Chip tone={neutral ? "neutral" : "warn"}>Não respondido</Chip>}
              </div>
              {canManageConformity ? (
                <div className="space-y-2">
                  <Textarea
                    aria-labelledby="matrix-absences"
                    value={conformityForm.absencesReport}
                    onChange={e => setConformityForm(f => ({ ...f, absencesReport: e.target.value }))}
                    placeholder='Ex.: "João Silva — faltou sem aviso." Se ninguém faltou/atrasou, escreva "Ninguém faltou ou atrasou".'
                    className={cn(matrixTextareaCls, "min-h-[72px]")}
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={setConformity.isPending}
                      onClick={() => save({ absencesResponse: conformityForm.absencesReport.trim() ? true : null, absencesReport: conformityForm.absencesReport || null })}
                      className={cn(btnSmall, "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary enabled:hover:opacity-90")}
                    >
                      {setConformity.isPending && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
                      {setConformity.isPending ? "Salvando…" : "Salvar"}
                    </button>
                  </div>
                </div>
              ) : conformityForm.absencesReport ? (
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-foreground">{conformityForm.absencesReport}</p>
              ) : (
                <p className="text-[13.5px] text-muted-foreground">—</p>
              )}
            </div>
            <div className="px-4 sm:px-5 py-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p id="matrix-standout" className="text-[15px] font-semibold text-foreground">Desempenho fora da curva?</p>
                {canManageConformity ? (
                  <SegmentedYesNo<boolean | null>
                    labelledBy="matrix-standout"
                    value={conformityForm.standoutResponse}
                    onChange={v => {
                      if (v === false) {
                        const prev = { standoutResponse: conformityForm.standoutResponse, standoutJustification: conformityForm.standoutJustification };
                        setConformityForm(f => ({ ...f, standoutResponse: false, standoutJustification: "" }));
                        save({ standoutResponse: false, standoutJustification: null }, () => setConformityForm(f => ({ ...f, ...prev })));
                      } else if (v === true) {
                        markItem("standoutResponse", true);
                      }
                    }}
                    options={[{ value: false, label: "Não" }, { value: true, label: "Sim", tone: "yes" }]}
                  />
                ) : neutral && conformityForm.standoutResponse === null ? (
                  <Chip>{nextCycle ? "Ainda não abre" : "Não respondida"}</Chip>
                ) : (
                  <Chip tone={conformityForm.standoutResponse === true ? "ok" : conformityForm.standoutResponse === false ? "neutral" : "warn"}>
                    {conformityForm.standoutResponse === true ? "Sim" : conformityForm.standoutResponse === false ? "Não" : "Pendente"}
                  </Chip>
                )}
              </div>
              {conformityForm.standoutResponse === true && (
                canManageConformity ? (
                  <div className="space-y-2">
                    <Textarea
                      aria-label="Quem se destacou e por quê"
                      value={conformityForm.standoutJustification}
                      onChange={e => setConformityForm(f => ({ ...f, standoutJustification: e.target.value }))}
                      placeholder="Nome do profissional e por que se destacou…"
                      className={cn(matrixTextareaCls, "min-h-[72px]")}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={setConformity.isPending}
                        onClick={() => save({ standoutJustification: conformityForm.standoutJustification || null })}
                        className={cn(btnSmall, "bg-primary text-primary-foreground border-primary enabled:hover:bg-primary enabled:hover:opacity-90")}
                      >
                        {setConformity.isPending && <Loader2 size={14} aria-hidden className="motion-safe:animate-spin" />}
                        {setConformity.isPending ? "Salvando…" : "Salvar destaque"}
                      </button>
                    </div>
                  </div>
                ) : conformityForm.standoutJustification ? (
                  <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-foreground">{conformityForm.standoutJustification}</p>
                ) : (
                  <p className="text-[13.5px] text-muted-foreground">—</p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {(conformityPenalty ?? 0) > 0 && (
        <div className="px-4 sm:px-5 py-3.5 border-t border-border">
          <Notice icon={AlertTriangle} tone="danger">
            <b className="font-semibold">Desconto na nota final do evento: −{conformityPenalty} pts</b>
          </Notice>
        </div>
      )}
    </Section>
  );
}
