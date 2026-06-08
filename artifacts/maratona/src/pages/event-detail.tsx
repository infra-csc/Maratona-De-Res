import { useRoute, Link } from "wouter";
import { useState, useEffect } from "react";
import { useGetEvent, useGetEventResult, useUpdateEventCriteria, useConfirmEventCriteria, getGetEventQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Users, BarChart3, TrendingUp, CheckCircle2, ShieldAlert, SlidersHorizontal, Lock, Unlock, AlertCircle, Save, Trash2, RotateCcw } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const id = params ? parseInt(params.id) : 0;

  const { data: event, isLoading } = useGetEvent(id, {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id) },
  });

  const { data: result } = useGetEventResult(id, {
    query: { enabled: !!id, queryKey: ["event-result", id] as unknown[] },
  });
  const participantResults = result?.participants ?? [];

  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = !!user && ["admin", "rh"].includes(user.role);

  const [config, setConfig] = useState<{ criterionId: number; active: boolean; weight: number }[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  useEffect(() => {
    if (event?.criteria) {
      setConfig(event.criteria.map(c => ({
        criterionId: c.criterionId,
        active: c.active,
        weight: c.weightOverride ?? c.originalWeight ?? 0,
      })));
    }
  }, [event?.criteria]);

  const updateCriteria = useUpdateEventCriteria({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Pesos salvos" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });
  const confirmCriteria = useConfirmEventCriteria({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });

  if (isLoading) {
    return (
      <div className="bg-[#f7f9fb] min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="h-8 w-32 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        <div className="h-40 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
          <div className="h-24 bg-[#eceef0] border-2 border-[#191c1e] animate-pulse" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-[#f7f9fb] min-h-full p-6 md:p-10 max-w-4xl mx-auto text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="py-24 bg-white border-2 border-dashed border-[#191c1e] text-[#747a60] italic uppercase font-bold">
          Evento não encontrado ou indisponível.
        </div>
      </div>
    );
  }

  const fmt = (v: number) => `${v.toFixed(1)}`;
  const activeCriteriaCount = (event.criteria ?? []).filter(c => c.active).length;
  const critMeta = new Map((event.criteria ?? []).map(c => [c.criterionId, c]));
  const activeSum = config.filter(c => c.active).reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const sumValid = Math.abs(activeSum - 20) <= 0.01;
  const criteriaConfirmed = event.criteriaConfirmed ?? false;

  const setCriterionActive = (criterionId: number, active: boolean) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, active } : c)));
  const setCriterionWeight = (criterionId: number, weight: number) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, weight } : c)));
  const handleSaveCriteria = () =>
    updateCriteria.mutate({ id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
  const handleConfirmCriteria = (value: boolean) => confirmCriteria.mutate({ id, data: { confirmed: value } });
  const matrixCells = (event.evaluationMatrix ?? []).flatMap(row => row.criteria ?? []);
  const filledCells = matrixCells.filter(c => c.averageScore != null || (c.status && c.status !== "pendente")).length;
  const evaluationProgress = matrixCells.length > 0 ? Math.round((filledCells / matrixCells.length) * 100) : 0;

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-8 max-w-6xl mx-auto">
        <Link href="/events" className="inline-flex items-center gap-2 text-sm font-bold italic uppercase tracking-wider text-[#444933] hover:text-[#506600] transition-colors group">
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" /> Voltar para Eventos
        </Link>

        {/* Hero */}
        <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="h-2 bg-[#ccff00] border-b-2 border-[#191c1e]" />
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <StatusBadge status={event.status} />
                  <span className="bg-[#191c1e] text-[#ccff00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                    <span className="inline-block skew-x-[8deg]">T{event.quarter}/{event.year}</span>
                  </span>
                  {event.forcedClosed && (
                    <span className="bg-[#ff5722] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><ShieldAlert size={10} /> Fechamento Forçado</span>
                    </span>
                  )}
                </div>
                <h1 data-testid="text-event-name" className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none mb-2 pr-1.5">{event.name}</h1>
                {event.clientName && <p className="text-base md:text-lg font-bold italic uppercase text-[#506600] mb-6">{event.clientName}</p>}

                <div className="flex flex-wrap items-center gap-5 text-sm font-bold italic text-[#444933]">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white border-2 border-[#191c1e] text-[#506600]"><Calendar size={14} /></div>
                    <span>{new Date(event.startDate).toLocaleDateString('pt-BR')} — {new Date(event.endDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {(event.city || event.location) && (
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-white border-2 border-[#191c1e] text-[#506600]"><MapPin size={14} /></div>
                      <span>{event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white border-2 border-[#191c1e] text-[#506600]"><CheckCircle2 size={14} /></div>
                    <span className={evaluationProgress === 100 ? "text-[#506600] font-black" : ""}>{evaluationProgress}% Avaliado</span>
                  </div>
                </div>
              </div>

              {result && result.eventScore > 0 && (
                <div className="shrink-0 bg-[#ccff00] border-2 border-[#191c1e] p-6 flex flex-col items-center justify-center min-w-[160px] -skew-x-6">
                  <div className="skew-x-6 flex flex-col items-center">
                    <span className="text-[10px] font-black italic uppercase tracking-widest text-[#161e00] mb-1">Score Equipe</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black italic text-[#161e00] leading-none">{fmt(result.eventScore)}</span>
                      <span className="text-sm font-black italic text-[#506600]">/100</span>
                    </div>
                    {result.projectedPlatoon && (
                      <div className="mt-3">
                        <PlatoonBadge platoon={result.projectedPlatoon} colorHex={result.projectedPlatoonColor} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Participantes</p>
              <p data-testid="text-participant-count" className="text-2xl font-black italic text-[#191c1e]">{event.participants?.length ?? 0}</p>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Critérios Ativos</p>
              <p className="text-2xl font-black italic text-[#191c1e]">{activeCriteriaCount}</p>
            </div>
          </div>

          <div className={`bg-white border-2 border-[#191c1e] p-5 flex items-center gap-4 ${HARD_SHADOW}`}>
            <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center text-[#161e00] shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold italic text-[#747a60] uppercase tracking-wider mb-0.5">Quesitos Avaliados</p>
              <p className="text-2xl font-black italic text-[#191c1e]">{result?.evaluatedCriteria ?? 0} / {result?.totalCriteria ?? activeCriteriaCount}</p>
            </div>
          </div>
        </div>

        {/* HR criteria configuration + confirmation gate */}
        {canManage && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex flex-wrap items-center justify-between gap-3 italic">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                <span className="font-black uppercase tracking-tight">Configuração de Critérios (RH)</span>
              </div>
              {criteriaConfirmed ? (
                <span data-testid="badge-criteria-confirmed" className="inline-flex items-center gap-1.5 bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-3 py-1 text-[11px] font-black uppercase">
                  <Lock size={12} /> Critérios Confirmados
                </span>
              ) : (
                <span data-testid="badge-criteria-pending" className="inline-flex items-center gap-1.5 bg-[#ff5722] text-white border-2 border-[#ff5722] px-3 py-1 text-[11px] font-black uppercase">
                  <AlertCircle size={12} /> Aguardando Confirmação
                </span>
              )}
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm italic text-[#444933]">
                Revise os critérios deste evento. Desative os que não se aplicam e redistribua os pesos — a soma dos ativos deve ser <strong>20</strong>. As áreas só podem avaliar após a confirmação do RH.
              </p>

              <div className="flex items-center justify-between bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                <span className="text-xs font-bold italic uppercase text-[#444933]">Soma dos Pesos Ativos</span>
                <span data-testid="text-criteria-sum" className={`text-2xl font-black italic ${sumValid ? "text-[#506600]" : "text-[#ba1a1a]"}`}>
                  {Math.round(activeSum * 100) / 100} <span className="text-base text-[#747a60]">/ 20</span>
                </span>
              </div>

              <div className="divide-y-2 divide-[#eceef0] border-2 border-[#191c1e]">
                {config.map(item => {
                  const meta = critMeta.get(item.criterionId);
                  return (
                    <div key={item.criterionId} data-testid={`row-event-criterion-${item.criterionId}`} className={`flex flex-wrap items-center gap-4 p-4 ${!item.active ? "opacity-60 bg-[#f7f9fb]" : "bg-white"}`}>
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-black italic uppercase text-sm text-[#191c1e]">{meta?.criterionName ?? `Critério ${item.criterionId}`}</p>
                        {meta?.responsibleAreaName && <p className="text-[10px] font-bold italic uppercase text-[#747a60]">{meta.responsibleAreaName}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold italic uppercase text-[#747a60]">Peso</span>
                        <Input
                          data-testid={`input-event-criterion-weight-${item.criterionId}`}
                          type="number"
                          min="0"
                          step="1"
                          value={item.active ? item.weight : 0}
                          disabled={!item.active || criteriaConfirmed}
                          onChange={e => setCriterionWeight(item.criterionId, Number(e.target.value))}
                          className="w-20 h-10 rounded-none border-2 border-[#191c1e] text-center font-black italic disabled:opacity-50"
                        />
                      </div>
                      <div className="flex items-center gap-2 min-w-[110px] justify-end">
                        {item.active ? (
                          <button
                            type="button"
                            data-testid={`button-remove-event-criterion-${item.criterionId}`}
                            disabled={criteriaConfirmed}
                            onClick={() => setPendingRemoval(item.criterionId)}
                            title="Remover critério"
                            className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-white text-[#ba1a1a] hover:bg-[#ffe5e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            data-testid={`button-restore-event-criterion-${item.criterionId}`}
                            disabled={criteriaConfirmed}
                            onClick={() => setCriterionActive(item.criterionId, true)}
                            className="h-9 px-3 flex items-center gap-1.5 border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-[11px] font-bold italic uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            <RotateCcw size={14} /> Reativar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {config.length === 0 && (
                  <div className="p-6 text-center italic uppercase font-bold text-[#747a60]">Nenhum critério vinculado a este evento.</div>
                )}
              </div>

              {!sumValid && !criteriaConfirmed && (
                <p className="text-xs font-bold italic uppercase text-[#ba1a1a] text-right">Ajuste os pesos para somar exatamente 20 antes de salvar ou confirmar.</p>
              )}

              <AlertDialog open={pendingRemoval !== null} onOpenChange={o => { if (!o) setPendingRemoval(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Remover critério?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      O critério <strong>{critMeta.get(pendingRemoval ?? -1)?.criterionName ?? ""}</strong> deixará de ser avaliado neste evento. Você precisará redistribuir o peso dele entre os critérios restantes para que a soma volte a ser <strong>20</strong> antes de salvar ou confirmar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-remove-criterion" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-remove-criterion"
                      onClick={() => { if (pendingRemoval !== null) setCriterionActive(pendingRemoval, false); setPendingRemoval(null); }}
                      className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white italic uppercase font-bold hover:bg-[#9a1414]"
                    >
                      <Trash2 size={16} className="mr-1.5" /> Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                {!criteriaConfirmed ? (
                  <>
                    <button
                      data-testid="button-save-criteria"
                      onClick={handleSaveCriteria}
                      disabled={!sumValid || updateCriteria.isPending}
                      className="bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                    >
                      <Save size={16} /> {updateCriteria.isPending ? "Salvando..." : "Salvar Pesos"}
                    </button>
                    <button
                      data-testid="button-confirm-criteria"
                      onClick={() => handleConfirmCriteria(true)}
                      disabled={!sumValid || confirmCriteria.isPending}
                      className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${HARD_SHADOW}`}
                    >
                      <CheckCircle2 size={16} /> Confirmar e Liberar Avaliação
                    </button>
                  </>
                ) : (
                  <button
                    data-testid="button-reopen-criteria"
                    onClick={() => handleConfirmCriteria(false)}
                    disabled={confirmCriteria.isPending}
                    className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                  >
                    <Unlock size={16} /> Reabrir Edição dos Critérios
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {result && result.eventScore > 0 && participantResults.length > 0 && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                  <BarChart3 size={18} />
                  <span className="font-black uppercase tracking-tight">Performance Individual (Equipe)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Colaborador</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Score Equivalente</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Elegibilidade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-[#eceef0]">
                      {participantResults.map(p => (
                        <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} className="hover:bg-[#f2f4f6] transition-all">
                          <td className="px-6 py-4 font-black italic uppercase text-sm text-[#191c1e]">{p.employeeName}</td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-3 py-1 border-2 border-[#191c1e]">
                              {fmt(p.eventScore)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {p.eligible === false ? (
                              <span className="inline-block text-[10px] uppercase font-black italic bg-[#ff5722] text-white border-2 border-[#191c1e] px-2 py-1">Inativo/Inelegível</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black italic bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-1">
                                <CheckCircle2 size={10} /> Elegível
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {event.participants && event.participants.length > 0 && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                  <Users size={18} />
                  <span className="font-black uppercase tracking-tight">Equipe Alocada</span>
                </div>
                <div className="divide-y-2 divide-[#eceef0]">
                  {event.participants.map(p => (
                    <div key={p.id} data-testid={`chip-participant-${p.employeeId}`} className="flex items-center gap-3 p-4 hover:bg-[#f2f4f6] transition-colors">
                      <div className="w-9 h-9 bg-[#eceef0] border-2 border-[#191c1e] flex items-center justify-center font-black italic text-xs text-[#191c1e] shrink-0">
                        {p.employeeName.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black italic uppercase text-sm text-[#191c1e] truncate">{p.employeeName}</p>
                        <p className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">{p.functionName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
