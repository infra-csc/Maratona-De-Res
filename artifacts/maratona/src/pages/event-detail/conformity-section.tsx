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
import { ShieldAlert, AlertTriangle, UserCheck, Check, MessageSquare, Info } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { cn, apiErrorMessage } from "@/lib/utils";
import { NEXT_CYCLE_NOTICE } from "../events/rules";
import { CONDENSED, WARNING, GOOD, AMBER, GOOD_TEXT, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { conformityItemsFor, fieldStyle } from "./helpers";
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

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <ShieldAlert size={16} style={{ color: "var(--accent-text)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Matriz de Conformidade</span>
      </div>
      {nextCycle && (
        <p role="status" data-testid="conformity-next-cycle" className="mx-4 my-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "var(--status-info-bg)", color: "var(--status-info-text)" }}>
          <Info size={13} aria-hidden className="mt-[2px] shrink-0" />
          <span>{NEXT_CYCLE_NOTICE}</span>
        </p>
      )}
      {canManage ? (
        <div className="flex flex-col min-[480px]:flex-row" style={{ borderBottom: "1px solid var(--border)" }}>
          {[
            { label: "Ferramentas", open: conformityEvaluatorFerramentasPickerOpen, setOpen: setConformityEvaluatorFerramentasPickerOpen, current: event.conformityEvaluatorFerramentasUserId, currentName: event.conformityEvaluatorFerramentasName, mut: setConformityEvaluatorFerramentasMutation },
            { label: "Cenografia", open: conformityEvaluatorPickerOpen, setOpen: setConformityEvaluatorPickerOpen, current: event.conformityEvaluatorUserId, currentName: event.conformityEvaluatorName, mut: setConformityEvaluatorMutation },
          ].map(g => (
            <div key={g.label} className="flex-1 px-4 py-2.5 flex items-center gap-2 min-w-0">
              <span className="text-[11px] font-black uppercase shrink-0" style={{ color: "var(--muted-foreground)" }}>{g.label}:</span>
              <Popover open={g.open} onOpenChange={g.setOpen}>
                <PopoverTrigger asChild>
                  <button type="button" title={g.currentName ?? "Sem avaliador"} className="flex items-center gap-1 text-[11px] font-bold uppercase rounded-lg px-2 py-1 transition-colors flex-1 min-w-0 hover:opacity-80" style={fieldStyle}>
                    <UserCheck size={10} className="shrink-0" />
                    <span className="truncate">{g.currentName ?? "Sem avaliador"}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 rounded-xl w-64" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                  <Command>
                    <CommandInput placeholder="Buscar avaliador..." />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty className="py-4 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum encontrado.</CommandEmpty>
                      <CommandGroup>
                        {g.current == null && (
                          <CommandItem value="Sem avaliador" onSelect={() => g.mut.mutate({ id, data: { userId: null } })} className="cursor-pointer py-2 gap-3">
                            <Check size={14} className="shrink-0 opacity-100" />
                            <span className="text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Sem avaliador</span>
                          </CommandItem>
                        )}
                        {evaluators.map(u => (
                          <CommandItem key={u.id} value={u.name} onSelect={() => g.mut.mutate({ id, data: { userId: u.id } })} className="cursor-pointer py-2 gap-3">
                            <Check size={14} className={cn("shrink-0", g.current === u.id ? "opacity-100" : "opacity-0")} />
                            <span className="text-xs font-bold uppercase truncate">{u.name}</span>
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
        <div className="flex flex-col min-[480px]:flex-row text-[11px] font-bold" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          <div className="flex-1 px-4 py-2.5 flex items-center gap-1.5 min-w-0"><span className="uppercase shrink-0">Ferramentas:</span><span className="truncate" style={{ color: "var(--foreground)" }}>{event.conformityEvaluatorFerramentasName ?? "—"}</span></div>
          <div className="flex-1 px-4 py-2.5 flex items-center gap-1.5 min-w-0"><span className="uppercase shrink-0">Cenografia:</span><span className="truncate" style={{ color: "var(--foreground)" }}>{event.conformityEvaluatorName ?? "—"}</span></div>
        </div>
      ) : null}

      {!conformityData && importedConformityRatio && (
        <p className="px-5 pt-3 text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
          {importedConformityAllValue !== null
            ? `Inferido das observações importadas (${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim")`
            : `Observações importadas indicam ${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim" — não é possível identificar qual item pelo texto`}
        </p>
      )}

      {(["cenografia", "ferramentas"] as const).map(group => {
        const groupItems = conformityItemsFor(event).filter(i => i.group === group);
        if (groupItems.length === 0) return null;
        const groupLabel = group === "cenografia" ? "Cenografia" : "Ferramentas e Case";
        const evaluatorName = group === "cenografia" ? (event.conformityEvaluatorName ?? null) : (event.conformityEvaluatorFerramentasName ?? null);
        return (
          <div key={group}>
            <div className="flex items-center gap-2 px-5 py-2" style={{ backgroundColor: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
              <span className="text-[11px] font-black uppercase">{groupLabel}</span>
              {evaluatorName
                ? <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>— {evaluatorName}</span>
                : neutral
                  ? <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>— {nextCycle ? "sem responsável ainda" : "sem avaliador"}</span>
                  : <span className="text-[11px]" style={{ color: DANGER_TEXT }}>— sem avaliador atribuído</span>}
            </div>
            {groupItems.map(item => {
              const value = conformityForm[item.key];
              const comment = conformityForm[item.commentKey];
              const isNonConforming = value === false;
              const isPending = value === null;
              const needsComment = (isNonConforming || isPending) && !comment.trim();
              const isExpanded = expandedComments.has(item.key);
              return (
                <div key={item.key} className="px-5" style={{ borderTop: "1px solid var(--border)", backgroundColor: isNonConforming ? "rgba(229,72,77,0.06)" : isPending && !neutral ? "rgba(232,162,61,0.06)" : "transparent" }}>
                  <div className="grid items-center min-h-[52px]" style={{ gridTemplateColumns: "1fr auto auto" }}>
                    <div className="pr-4 py-3 leading-snug" style={{ maxWidth: 280 }}>
                      <span className="text-sm font-bold">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 py-2">
                      {isNonConforming && <span className="text-[11px] font-black uppercase whitespace-nowrap mr-1" style={{ color: DANGER_TEXT }}>-10 pts</span>}
                      {canManageConformity ? (
                        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                          <button type="button" onClick={() => markItem(item.key, true)} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === true ? "var(--primary)" : "transparent", color: value === true ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>Sim</button>
                          <button type="button" onClick={() => markItem(item.key, false)} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === false ? WARNING : "transparent", color: value === false ? "#fff" : "var(--muted-foreground)" }}>Não</button>
                          <button type="button" onClick={() => markItem(item.key, null)} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ backgroundColor: value === null ? "rgba(232,162,61,0.24)" : "transparent", color: value === null ? AMBER : "var(--muted-foreground)" }}>Pendente</button>
                        </div>
                      ) : neutral && value === null ? (
                        <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                          {nextCycle ? "Ainda não abre" : "Não respondida"}
                        </span>
                      ) : (
                        <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded" style={{ backgroundColor: value === true ? "var(--primary)" : value === false ? WARNING : "rgba(232,162,61,0.24)", color: value === true ? "var(--primary-foreground)" : value === false ? "#fff" : AMBER }}>
                          {value === true ? "Sim" : value === false ? "Não" : "Pendente"}
                        </span>
                      )}
                    </div>
                    {canManageConformity ? (
                      <div className="pl-2 py-2 flex items-center justify-end">
                        <button
                          type="button"
                          title={comment ? "Ver / editar comentário" : "Adicionar comentário"}
                          aria-label={`${comment ? "Ver / editar comentário" : "Adicionar comentário"}: ${item.label}`}
                          aria-expanded={expandedComments.has(item.key)}
                          onClick={() => setExpandedComments(prev => { const next = new Set(prev); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })}
                          className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                          style={needsComment ? { color: DANGER_TEXT, backgroundColor: "rgba(229,72,77,0.10)" } : comment ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
                        >
                          <MessageSquare size={13} />
                        </button>
                      </div>
                    ) : <div />}
                  </div>
                  {isExpanded && canManageConformity && (
                    <div className="mt-1 mb-3 p-3 rounded-lg space-y-2" style={{ backgroundColor: "var(--secondary)" }}>
                      <Textarea
                        value={comment}
                        onChange={e => setConformityForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                        placeholder={value === false ? "Justifique a não conformidade..." : value === null ? "Descreva o status pendente..." : "Observação adicional (opcional)..."}
                        className="text-xs rounded-lg resize-none min-h-[60px]"
                        style={fieldStyle}
                      />
                      <button
                        type="button"
                        disabled={setConformity.isPending}
                        onClick={() => save({ [item.commentKey]: comment || null } as ConformityPatch)}
                        className="px-3 py-1 rounded-lg font-black uppercase text-[11px] disabled:opacity-50 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                      >
                        {setConformity.isPending ? "Salvando..." : "Salvar Comentário"}
                      </button>
                    </div>
                  )}
                  {!isExpanded && comment && (
                    <p className="pb-2 text-[11px] line-clamp-1 cursor-pointer hover:line-clamp-none" style={{ color: "var(--muted-foreground)" }} onClick={() => setExpandedComments(prev => { const next = new Set(prev); next.add(item.key); return next; })}>
                      💬 {comment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Respostas Extras — Cenografia */}
      {(conformityData || canManageConformity) && (
        <div>
          <div className="flex items-center gap-2 px-5 py-2" style={{ backgroundColor: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
            <span className="text-[11px] font-black uppercase">Cenografia</span>
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>— Respostas Extras</span>
          </div>
          <div className="px-5 py-3.5 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Faltou / Atrasou?</span>
              {conformityForm.absencesResponse !== null
                ? <span className="text-[11px] font-black uppercase rounded px-2 py-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>Respondido</span>
                : <span className="text-[11px] font-black uppercase rounded px-2 py-0.5" style={neutral ? { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" } : { backgroundColor: "rgba(232,162,61,0.14)", color: AMBER_TEXT }}>Não respondido</span>}
            </div>
            {canManageConformity ? (
              <div className="space-y-1.5">
                <Textarea
                  value={conformityForm.absencesReport}
                  onChange={e => setConformityForm(f => ({ ...f, absencesReport: e.target.value }))}
                  placeholder='Ex.: "João Silva — faltou sem aviso." Se ninguém faltou/atrasou, escreva "Ninguém faltou ou atrasou".'
                  className="text-xs rounded-lg resize-none min-h-[60px]"
                  style={fieldStyle}
                />
                <button
                  type="button"
                  disabled={setConformity.isPending}
                  onClick={() => save({ absencesResponse: conformityForm.absencesReport.trim() ? true : null, absencesReport: conformityForm.absencesReport || null })}
                  className="px-3 py-1 rounded-lg font-black uppercase text-[11px] disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  {setConformity.isPending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            ) : conformityForm.absencesReport ? (
              <p className="text-sm whitespace-pre-wrap">{conformityForm.absencesReport}</p>
            ) : (
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</p>
            )}
          </div>
          <div className="px-5 py-3.5 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold">Desempenho Fora da Curva?</span>
              {canManageConformity ? (
                <div className="flex items-center rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
                  <button type="button" onClick={() => { const prev = { standoutResponse: conformityForm.standoutResponse, standoutJustification: conformityForm.standoutJustification }; setConformityForm(f => ({ ...f, standoutResponse: false, standoutJustification: "" })); save({ standoutResponse: false, standoutJustification: null }, () => setConformityForm(f => ({ ...f, ...prev }))); }} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: conformityForm.standoutResponse === false ? "var(--primary)" : "transparent", color: conformityForm.standoutResponse === false ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>Não</button>
                  <button type="button" onClick={() => markItem("standoutResponse", true)} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ backgroundColor: conformityForm.standoutResponse === true ? GOOD : "transparent", color: conformityForm.standoutResponse === true ? "#fff" : "var(--muted-foreground)" }}>Sim</button>
                </div>
              ) : (
                neutral && conformityForm.standoutResponse === null ? (
                  <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded shrink-0" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{nextCycle ? "Ainda não abre" : "Não respondida"}</span>
                ) : (
                <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded shrink-0" style={{ backgroundColor: conformityForm.standoutResponse === true ? GOOD : conformityForm.standoutResponse === false ? "var(--primary)" : "rgba(232,162,61,0.24)", color: conformityForm.standoutResponse === true ? "#fff" : conformityForm.standoutResponse === false ? "var(--primary-foreground)" : AMBER }}>
                  {conformityForm.standoutResponse === true ? "Sim" : conformityForm.standoutResponse === false ? "Não" : "Pendente"}
                </span>
                )
              )}
            </div>
            {conformityForm.standoutResponse === true && (
              canManageConformity ? (
                <div className="space-y-1.5">
                  <Textarea
                    value={conformityForm.standoutJustification}
                    onChange={e => setConformityForm(f => ({ ...f, standoutJustification: e.target.value }))}
                    placeholder="Nome do profissional e por que se destacou..."
                    className="text-xs rounded-lg resize-none min-h-[60px]"
                    style={fieldStyle}
                  />
                  <button
                    type="button"
                    disabled={setConformity.isPending}
                    onClick={() => save({ standoutJustification: conformityForm.standoutJustification || null })}
                    className="px-3 py-1 rounded-lg font-black uppercase text-[11px] disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    {setConformity.isPending ? "Salvando..." : "Salvar Destaque"}
                  </button>
                </div>
              ) : conformityForm.standoutJustification ? (
                <p className="text-sm whitespace-pre-wrap">{conformityForm.standoutJustification}</p>
              ) : (
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>—</p>
              )
            )}
          </div>
        </div>
      )}

      {(conformityPenalty ?? 0) > 0 && (
        <div className="px-5 pt-3 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ color: DANGER_TEXT }}>
            <AlertTriangle size={13} /> Desconto na nota final do evento: -{conformityPenalty} pts
          </p>
        </div>
      )}
    </div>
  );
}
