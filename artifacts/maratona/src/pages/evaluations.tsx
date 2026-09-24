import { useState, useEffect } from "react";
import { useGetEvents, useGetEvaluations, useGetEventCriteria, useGetEvent, useCreateEvaluation, useGetEventConformity, useSetEventConformity, useRedirectConformityEvaluator, useRedirectConformityEvaluatorFerramentas, useGetUsersByArea, useGetCurrentCycle, getGetEvaluationsQueryKey, getGetEventQueryKey, getEventCriteria, getEvent, getEvaluations, createEvaluation, submitEvaluation } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { copyToClipboard, COPY_FAILED_TOAST } from "@/lib/clipboard";
import { CheckCircle, Clock, Users, Calendar, MapPin, Building2, Save, Flag, Target, Lock, Check, ArrowRight, Rocket, CornerDownRight, ShieldAlert, Link2, Copy, CheckCheck, Trash2, Loader2, AlertCircle, Send } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { cn, formatEventSubtitle, fmtDate } from "@/lib/utils";
import { useEventCriterionAssignments, getEventCriterionAssignments, eventCriterionAssignmentsKey, usePatchCriterionAssignment, useRedirectOptions, useCreatePublicToken, usePublicTokens, usePublicLinkEligibleCriteria, useCreateConformityPublicToken, useCreateFerramentasPublicToken, useConformityPublicTokens, useFerramentasPublicTokens, useMyPrincipalAreas, useUsersByArea, useDeletePublicToken, type PublicToken } from "@/lib/routing-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AdminEvaluationsConsole } from "./evaluations-admin-console";
import { BODY } from "@/lib/premium-theme";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

function ScoreButton({ score, current, onClick, disabled, label }: { score: number, current: number | null, onClick: () => void, disabled: boolean, label?: string }) {
  const isSelected = current === score;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      className={cn(
        "border-2 border-[#191c1e] py-3 flex items-center justify-center transition-all w-full",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-1 active:translate-y-0",
        isSelected
          ? "bg-[#ccff00] text-[#161e00] border-[3px]"
          : "bg-white text-[#191c1e]"
      )}
    >
      <span className="text-lg md:text-xl italic font-black">{score}</span>
    </button>
  );
}

function EvaluatorEventCard({
  event, userId, selected, onSelect, principalAreaIds,
}: {
  event: { id: number; name: string; clientName?: string | null; city?: string | null; state?: string | null; cycleName?: string };
  userId: number | undefined;
  selected: boolean;
  onSelect: () => void;
  principalAreaIds?: Set<number>;
}) {
  const { data: criteria } = useGetEventCriteria(event.id, {
    query: { queryKey: ["event-criteria", event.id] as unknown[] },
  });
  const { data: detail } = useGetEvent(event.id, {
    query: { queryKey: getGetEventQueryKey(event.id) },
  });
  const { data: evals } = useGetEvaluations(
    { eventId: event.id },
    { query: { queryKey: getGetEvaluationsQueryKey({ eventId: event.id }) } },
  );
  const { data: criterionAssignments } = useEventCriterionAssignments(event.id);

  const myAreaIds = new Set(
    (detail?.areaAssignments ?? []).filter(a => a.evaluatorUserId === userId).map(a => a.areaId),
  );
  const assignmentByCriterionId = new Map((criterionAssignments ?? []).map(a => [a.criterionId, a]));
  const myCriteria = (criteria ?? []).filter(c => {
    if (!c.active) return false;
    const assignment = assignmentByCriterionId.get(c.criterionId);
    if (assignment?.assignedToId != null) return assignment.assignedToId === userId;
    return c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId);
  });
  const myCriterionIds = new Set(myCriteria.map(c => c.criterionId));
  const delegatedCriteria = (criteria ?? []).filter(c => {
    if (!c.active || c.responsibleAreaId == null || !principalAreaIds?.has(c.responsibleAreaId)) return false;
    return !myCriterionIds.has(c.criterionId);
  }).map(c => {
    const assignment = assignmentByCriterionId.get(c.criterionId);
    const submittedEval = (evals ?? []).find(e => e.criterionId === c.criterionId && e.status === "submitted");
    return {
      name: c.criterionName,
      assignee: submittedEval?.evaluatorName ?? assignment?.assignedToName ?? null,
      submitted: !!submittedEval,
      submittedAt: submittedEval?.submittedAt ?? null,
    };
  });

  const isConformityEval = detail?.conformityEvaluatorUserId === userId;
  const isFerramentasEval = detail?.conformityEvaluatorFerramentasUserId === userId;
  const conf = detail?.conformity;
  const conformityTotal = (isConformityEval ? 5 : 0) + (isFerramentasEval ? 1 : 0);
  const conformityDoneCount =
    (isConformityEval
      ? [conf?.epi, conf?.estaiamentos, conf?.conduta, conf?.standoutResponse].filter(v => v != null).length
        + (conf?.absencesReport?.trim() ? 1 : 0)
      : 0)
    + (isFerramentasEval && conf?.guardaEquipamentos != null ? 1 : 0);
  const conformityComplete = conformityTotal > 0 && conformityDoneCount === conformityTotal;

  if (myCriteria.length === 0 && delegatedCriteria.length === 0 && conformityTotal === 0) return null;

  const myEval = (cid: number) => (evals ?? []).find(e => e.criterionId === cid && e.evaluatorUserId === userId);
  const total = myCriteria.length;
  const submitted = myCriteria.filter(c => myEval(c.criterionId)?.status === "submitted").length;
  const drafts = myCriteria.filter(c => myEval(c.criterionId)?.status === "draft").length;
  const delegatedPending = delegatedCriteria.filter(d => !d.submitted).length;
  const done = (total > 0 || conformityTotal > 0 || delegatedCriteria.length > 0)
    && submitted === total
    && delegatedPending === 0
    && (conformityTotal === 0 || conformityComplete);
  const inProgress = !done && (submitted > 0 || drafts > 0 || conformityDoneCount > 0 || delegatedCriteria.some(d => d.submitted));

  const statusConfig = done
    ? { label: "Concluída", badgeCls: "bg-[#ccff00] text-[#161e00] border-[#506600]", borderCls: "border-l-[#506600]", Icon: CheckCircle, iconCls: "text-[#506600]" }
    : inProgress
      ? { label: "Em andamento", badgeCls: "bg-[#ffdbd1] text-[#862200] border-[#f0a090]", borderCls: "border-l-[#f28b6a]", Icon: Clock, iconCls: "text-[#862200]" }
      : { label: "A fazer", badgeCls: "bg-[#f2f4f6] text-[#444933] border-[#c8cbd0]", borderCls: "border-l-[#191c1e]", Icon: ArrowRight, iconCls: "text-[#747a60]" };
  const StatusIcon = statusConfig.Icon;
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const subtitle = formatEventSubtitle(event);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`evaluator-event-${event.id}`}
      className={cn(
        "group text-left border-2 border-[#191c1e] border-l-4 transition-all w-full",
        statusConfig.borderCls,
        HARD_SHADOW, HARD_SHADOW_HOVER,
        selected ? "bg-[#f7ffd1]" : "bg-white hover:bg-[#fafbfc]",
      )}
    >
      <div className="p-4 md:p-5 flex flex-col gap-3">
        {/* Top row: badge + cycle tag */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 border font-bold text-[11px] italic uppercase tracking-wide rounded-sm", statusConfig.badgeCls)}>
            <StatusIcon size={11} /> {statusConfig.label}
          </span>
          {event.cycleName && (
            <span className="text-[10px] font-black italic uppercase text-[#747a60] tracking-wider shrink-0">{event.cycleName}</span>
          )}
        </div>

        {/* Event name + subtitle */}
        <div className="min-w-0">
          <h4 className="text-base md:text-lg italic uppercase font-black tracking-tight leading-tight text-[#191c1e]">{event.name}</h4>
          {subtitle && (
            <p className="text-[11px] font-bold italic uppercase text-[#747a60] mt-0.5 truncate flex items-center gap-1">
              <MapPin size={10} className="shrink-0" />{subtitle}
            </p>
          )}
        </div>

        {/* Progress bar (criteria) */}
        {total > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-bold italic uppercase text-[#444933]">
                {submitted} de {total} {total === 1 ? "critério" : "critérios"} submetidos
              </span>
              <span className={cn("text-xs font-black italic", done ? "text-[#506600]" : "text-[#191c1e]")}>{pct}%</span>
            </div>
            <div className="w-full bg-[#eceef0] border border-[#c8cbd0] h-2.5 rounded-sm overflow-hidden">
              <div
                className={cn("h-full transition-[width] rounded-sm", done ? "bg-[#ccff00]" : inProgress ? "bg-[#f28b6a]" : "bg-[#c8cbd0]")}
                style={{ width: `${pct}%` }}
              />
            </div>
            {drafts > 0 && (
              <p className="text-[11px] text-[#862200] italic mt-1.5 font-bold uppercase flex items-center gap-1">
                <AlertCircle size={11} /> {drafts} em rascunho — submeta para concluir
              </p>
            )}
          </div>
        )}

        {/* Conformity */}
        {conformityTotal > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#eceef0] border border-[#c8cbd0] h-2.5 rounded-sm overflow-hidden">
              <div
                className={cn("h-full transition-[width] rounded-sm", conformityComplete ? "bg-[#ccff00]" : "bg-[#f28b6a]")}
                style={{ width: `${Math.round((conformityDoneCount / conformityTotal) * 100)}%` }}
              />
            </div>
            <span className={cn("text-[11px] italic font-bold uppercase shrink-0", conformityComplete ? "text-[#506600]" : "text-[#862200]")}>
              Conformidade {conformityDoneCount}/{conformityTotal}
            </span>
          </div>
        )}

        {/* Delegated criteria */}
        {delegatedCriteria.length > 0 && (
          <div className="pt-2 border-t border-dashed border-[#dde0e3] space-y-0.5">
            {delegatedCriteria.map((d, i) => (
              d.submitted ? (
                <p key={i} className="text-[11px] italic text-[#506600] flex items-start gap-1">
                  <CheckCircle size={11} className="mt-0.5 shrink-0" />
                  <span><span className="font-bold uppercase">{d.name}</span> — <span className="font-bold">{d.assignee ?? "?"}</span>{d.submittedAt ? ` · ${fmtDT(d.submittedAt)}` : ""}</span>
                </p>
              ) : (
                <p key={i} className="text-[11px] italic text-[#747a60] flex items-start gap-1">
                  <Clock size={11} className="mt-0.5 shrink-0" />
                  <span><span className="font-bold uppercase">{d.name}</span> — {d.assignee ? <span className="font-bold">{d.assignee}</span> : <span className="text-[#b02f00] font-bold">sem avaliador</span>}</span>
                </p>
              )
            ))}
          </div>
        )}
      </div>

      {/* CTA footer */}
      <div className={cn(
        "px-4 md:px-5 py-2.5 border-t-2 border-[#191c1e] flex items-center justify-between text-[11px] font-black italic uppercase tracking-wide transition-colors",
        selected ? "bg-[#ccff00] text-[#161e00]" : "bg-[#f2f4f6] text-[#747a60] group-hover:bg-[#e8f0cc] group-hover:text-[#444933]",
      )}>
        <span>{selected ? "Avaliando este evento" : "Clique para avaliar"}</span>
        <ArrowRight size={14} className={cn("transition-transform", selected ? "" : "group-hover:translate-x-0.5")} />
      </div>
    </button>
  );
}

// Uma vez que um link foi enviado para um freelancer preencher um formulário
// de conformidade, o avaliador titular deixa de ver o formulário interativo
// (evita sobrescrever a resposta do freelancer) e passa a ver só este
// histórico de envios — respondido ou não, e quando.
function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

function ConformityLinkHistory({ history }: { history: PublicToken[] }) {
  return (
    <div className="bg-white border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] overflow-hidden">
      {history.map(t => (
        <div key={t.id} className="flex items-start justify-between px-4 py-3 gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-bold italic truncate">
              {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
            </p>
            {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
              <p className="text-[10px] italic text-[#747a60] truncate">Para: {t.recipientName}</p>
            )}
            <p className="text-[10px] italic text-[#9aa08a]">
              Enviado: {fmtDT(t.createdAt)}
            </p>
            {t.usedAt && (
              <p className="text-[10px] font-bold italic text-[#3f5200]">
                Respondido: {fmtDT(t.usedAt)}
              </p>
            )}
          </div>
          {t.usedAt ? (
            <span className="shrink-0 text-[10px] font-bold italic uppercase bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-0.5 flex items-center gap-1 mt-0.5">
              <CheckCircle size={10} /> Respondido
            </span>
          ) : (
            <span className="shrink-0 text-[10px] font-bold italic uppercase bg-[#f2f4f6] text-[#747a60] border-2 border-[#191c1e] px-2 py-0.5 mt-0.5">
              Pendente
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function EvaluationsPage() {
  const { user } = useAuth();
  const isEvaluator = user?.role === "avaliador";
  // Everyone who is not an evaluator (managers, diretoria, visualizador) is in
  // read-only consultation mode: they inspect evaluation progress, never score.
  const isConsultation = !!user && !isEvaluator;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [activeEvalTab, setActiveEvalTab] = useState<"todo" | "done">("todo");
  const [scores, setScores] = useState<Record<number, number>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  // Per-criterion audio override (objectPath). "" means the user cleared a
  // previously saved audio (re-recording). undefined => fall back to saved eval.
  const [audioOverrides, setAudioOverrides] = useState<Record<number, string>>({});
  // Confirmation modal + in-flight state for the one-click "Lançar Avaliação" flow.
  const [confirmLaunchOpen, setConfirmLaunchOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [conformityEvalForm, setConformityEvalForm] = useState<{
    epi: boolean | null; estaiamentos: boolean | null; guardaEquipamentos: boolean | null; conduta: boolean | null;
    epiComment: string; estaiamentosComment: string; guardaEquipamentosComment: string; condutaComment: string;
    absencesResponse: boolean | null; absencesReport: string; standoutResponse: boolean | null; standoutJustification: string;
  }>({
    epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null,
    epiComment: '', estaiamentosComment: '', guardaEquipamentosComment: '', condutaComment: '',
    absencesResponse: null, absencesReport: '', standoutResponse: null, standoutJustification: '',
  });
  const [redirectConformityOpen, setRedirectConformityOpen] = useState(false);
  const [redirectConformityTargetId, setRedirectConformityTargetId] = useState<number | null>(null);
  const [redirectFerramentasOpen, setRedirectFerramentasOpen] = useState(false);
  const [redirectFerramentasTargetId, setRedirectFerramentasTargetId] = useState<number | null>(null);

  const { data: events } = useGetEvents({});
  const { data: cycle } = useGetCurrentCycle();

  const { data: criteria } = useGetEventCriteria(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-criteria", selectedEventId] as unknown[] },
  });

  const { data: selectedEventDetail } = useGetEvent(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: getGetEventQueryKey(selectedEventId ?? 0) },
  });

  const isConformityEvaluatorForEvent = !!selectedEventId && !!user && selectedEventDetail?.conformityEvaluatorUserId === user.id;
  const isFerramentasEvaluatorForEvent = !!selectedEventId && !!user && selectedEventDetail?.conformityEvaluatorFerramentasUserId === user.id;
  const isAnyConformityEvaluator = isConformityEvaluatorForEvent || isFerramentasEvaluatorForEvent;
  const { data: myConformityData } = useGetEventConformity(selectedEventId!, {
    query: { enabled: isAnyConformityEvaluator, queryKey: ["event-conformity-eval", selectedEventId] as unknown[] },
  });
  const conformityEvalMutation = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["event-conformity-eval", selectedEventId] });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e?.message ?? "Não foi possível salvar. Tente novamente.", variant: "destructive" }),
    },
  });
  // Users for redirect popups (loaded lazily)
  const CENOGRAFIA_AREA_ID = 13;
  const FERRAMENTAS_AREA_ID = 16;
  const { data: cenografiaUsers } = useGetUsersByArea(CENOGRAFIA_AREA_ID, {
    query: { enabled: isConformityEvaluatorForEvent, queryKey: ["users-by-area", CENOGRAFIA_AREA_ID] as unknown[] },
  });
  const { data: ferramentasUsers } = useGetUsersByArea(FERRAMENTAS_AREA_ID, {
    query: { enabled: isFerramentasEvaluatorForEvent, queryKey: ["users-by-area", FERRAMENTAS_AREA_ID] as unknown[] },
  });
  const redirectConformityMutation = useRedirectConformityEvaluator({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setRedirectConformityOpen(false); toast({ title: "Avaliação redirecionada" }); },
      onError: () => toast({ title: "Erro ao redirecionar", variant: "destructive" }),
    },
  });
  const redirectFerramentasMutation = useRedirectConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setRedirectFerramentasOpen(false); toast({ title: "Avaliação redirecionada" }); },
      onError: () => toast({ title: "Erro ao redirecionar", variant: "destructive" }),
    },
  });
  useEffect(() => {
    if (myConformityData) {
      setConformityEvalForm({
        epi: myConformityData.epi ?? null,
        estaiamentos: myConformityData.estaiamentos ?? null,
        guardaEquipamentos: myConformityData.guardaEquipamentos ?? null,
        conduta: myConformityData.conduta ?? null,
        epiComment: myConformityData.epiComment ?? '',
        estaiamentosComment: myConformityData.estaiamentosComment ?? '',
        guardaEquipamentosComment: myConformityData.guardaEquipamentosComment ?? '',
        condutaComment: myConformityData.condutaComment ?? '',
        absencesResponse: myConformityData.absencesResponse ?? null,
        absencesReport: myConformityData.absencesReport ?? '',
        standoutResponse: myConformityData.standoutResponse ?? null,
        standoutJustification: myConformityData.standoutJustification ?? '',
      });
    } else {
      setConformityEvalForm({
        epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null,
        epiComment: '', estaiamentosComment: '', guardaEquipamentosComment: '', condutaComment: '',
        absencesResponse: null, absencesReport: '', standoutResponse: null, standoutJustification: '',
      });
    }
  }, [myConformityData?.id, selectedEventId]);

  const evalsQKey = getGetEvaluationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: evalsQKey } }
  );

  // Criterion assignments for the selected event (new routing system)
  const { data: criterionAssignments } = useEventCriterionAssignments(selectedEventId ?? 0);
  const patchCriterionAssignment = usePatchCriterionAssignment(selectedEventId ?? 0);
  // Áreas em que o usuário logado é avaliador principal — dá visibilidade
  // completa dos quesitos da área e permite atribuir/tomar/mover entre colegas.
  const { data: myPrincipalAreas } = useMyPrincipalAreas();
  const [areaAssignTarget, setAreaAssignTarget] = useState<{ criterionId: number; criterionName: string; areaId: number } | null>(null);
  const { data: areaAssignUsers } = useUsersByArea(areaAssignTarget?.areaId ?? null);
  const [redirectDialogArea, setRedirectDialogArea] = useState<{ areaId: number; areaName: string; criteriaIds: number[]; firstCriterionId: number } | null>(null);
  const [redirectTargetId, setRedirectTargetId] = useState<number | null>(null);
  const [publicLinkDialogCriteriaIds, setPublicLinkDialogCriteriaIds] = useState<number[] | null>(null);
  const [publicLinkDialogAreaName, setPublicLinkDialogAreaName] = useState<string | null>(null);
  const [publicLinkRecipientName, setPublicLinkRecipientName] = useState("");
  const [publicLinkIncludeConformity, setPublicLinkIncludeConformity] = useState(false);
  // Trava: quando o link é da área Cenografia, a matriz de conformidade é obrigatória
  // no mesmo questionário (não pode gerar link só do critério e deixar a conformidade
  // separada/sem resposta). Nesse caso a opção fica marcada e desabilitada.
  const [publicLinkForceConformity, setPublicLinkForceConformity] = useState(false);
  const [generatedPublicUrl, setGeneratedPublicUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Conformity public link dialog state (shared for cenografia + ferramentas)
  const [conformityPublicLinkType, setConformityPublicLinkType] = useState<"cenografia" | "ferramentas" | null>(null);
  const [conformityPublicRecipientName, setConformityPublicRecipientName] = useState("");
  const [generatedConformityUrl, setGeneratedConformityUrl] = useState<string | null>(null);
  const [conformityLinkCopied, setConformityLinkCopied] = useState(false);
  const { data: redirectOptionsData } = useRedirectOptions(
    selectedEventId ?? 0,
    redirectDialogArea?.firstCriterionId ?? 0,
  );
  const { data: publicLinkEligibleCriteria } = usePublicLinkEligibleCriteria(selectedEventId ?? null);
  const createPublicToken = useCreatePublicToken(selectedEventId ?? 0);
  const deletePublicToken = useDeletePublicToken(selectedEventId ?? 0);
  const createConformityPublicToken = useCreateConformityPublicToken(selectedEventId ?? 0);
  const createFerramentasPublicToken = useCreateFerramentasPublicToken(selectedEventId ?? 0);
  const { data: publicTokenHistory, refetch: refetchTokenHistory } = usePublicTokens(
    publicLinkDialogCriteriaIds !== null ? (selectedEventId ?? null) : null,
  );
  // Habilitado sempre que o avaliador é responsável pela conformidade deste
  // evento (não só quando o dialog de link está aberto) — precisamos saber se
  // já existe link enviado para trocar o formulário por uma view de histórico.
  const { data: conformityPublicTokenHistory, refetch: refetchConformityTokenHistory } = useConformityPublicTokens(
    isConformityEvaluatorForEvent ? (selectedEventId ?? null) : null,
  );
  const { data: ferramentasPublicTokenHistory, refetch: refetchFerramentasTokenHistory } = useFerramentasPublicTokens(
    isFerramentasEvaluatorForEvent ? (selectedEventId ?? null) : null,
  );

  const createMutation = useCreateEvaluation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: evalsQKey });
        toast({ title: "Rascunho salvo" });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const activeEvents = (events ?? []).filter(e => e.status === "open" || e.status === "closed");
  // Only events whose criteria the RH has already confirmed can be evaluated.
  const configuredEvents = activeEvents.filter(e => e.criteriaConfirmed);

  // For evaluators: fetch criteria for every selectable event so the overview
  // only lists events that actually have work for their area (and so the empty
  // state is accurate). Same query key as the per-event fetch → deduped/cached.
  const evaluatorCriteriaQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: ["event-criteria", ev.id] as unknown[],
          queryFn: () => getEventCriteria(ev.id),
        }))
      : [],
  });
  const evaluatorEventDetailQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: getGetEventQueryKey(ev.id),
          queryFn: () => getEvent(ev.id),
        }))
      : [],
  });
  // Atribuição por critério (redirecionamento) manda sobre a atribuição por
  // área — sem isso, um critério redirecionado para outra pessoa da área
  // continuava marcando o evento como "a fazer" pra quem redirecionou.
  const evaluatorCriterionAssignmentQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: eventCriterionAssignmentsKey(ev.id),
          queryFn: () => getEventCriterionAssignments(ev.id),
        }))
      : [],
  });
  function myCriteriaForEvent(i: number) {
    const myAreaIds = new Set(
      (evaluatorEventDetailQueries[i]?.data?.areaAssignments ?? [])
        .filter(a => a.evaluatorUserId === user?.id)
        .map(a => a.areaId),
    );
    const assignmentByCriterionId = new Map(
      (evaluatorCriterionAssignmentQueries[i]?.data ?? []).map(a => [a.criterionId, a]),
    );
    return (evaluatorCriteriaQueries[i]?.data ?? []).filter(c => {
      if (!c.active) return false;
      const assignment = assignmentByCriterionId.get(c.criterionId);
      // Linha pending sem assignedToId não corta o fallback por área (mesma
      // regra do backend em isAssignedForCriterion).
      if (assignment?.assignedToId != null) return assignment.assignedToId === user?.id;
      return c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId);
    });
  }
  const principalAreaIds = new Set((myPrincipalAreas ?? []).map(a => a.id));
  // Quesitos da(s) área(s) em que o usuário é avaliador PRINCIPAL mas que
  // estão com outra pessoa (delegados/redirecionados). O principal acompanha
  // esses quesitos: o evento só vai para "Concluídas" quando a área inteira
  // respondeu, e ele vê quem respondeu e quando.
  function delegatedAreaCriteriaForEvent(i: number) {
    if (principalAreaIds.size === 0) return [];
    const mineIds = new Set(myCriteriaForEvent(i).map(c => c.criterionId));
    return (evaluatorCriteriaQueries[i]?.data ?? []).filter(c =>
      c.active && c.responsibleAreaId != null && principalAreaIds.has(c.responsibleAreaId) && !mineIds.has(c.criterionId),
    );
  }
  const relevantEvaluatorEvents = isEvaluator
    ? configuredEvents.filter((_, i) => {
        const hasCriteria = myCriteriaForEvent(i).length > 0;
        const isConformityEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorUserId === user?.id;
        const isFerramentasEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorFerramentasUserId === user?.id;
        return hasCriteria || isConformityEval || isFerramentasEval || delegatedAreaCriteriaForEvent(i).length > 0;
      })
    : [];

  // Fetch this avaliador's evaluations for every configured event so the
  // overview can split events into "A Fazer" vs "Concluídas". Same query key as
  // the per-event/card fetch → deduped/cached, no extra network.
  const evaluatorEvalQueries = useQueries({
    queries: isEvaluator
      ? configuredEvents.map(ev => ({
          queryKey: getGetEvaluationsQueryKey({ eventId: ev.id }),
          queryFn: () => getEvaluations({ eventId: ev.id }),
        }))
      : [],
  });
  // Per-event completion stats for the avaliador (only events that actually
  // have criteria assigned to their area count as theirs).
  const evaluatorEventStats = isEvaluator
    ? configuredEvents.map((ev, i) => {
        const myCrit = myCriteriaForEvent(i);
        const evs = evaluatorEvalQueries[i]?.data ?? [];
        const submitted = myCrit.filter(
          c => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === user?.id)?.status === "submitted",
        ).length;
        const total = myCrit.length;
        // Só conta como concluído para o avaliador depois que os resultados do
        // evento forem confirmados por RH/Admin — enviar tudo não basta.
        const detail = evaluatorEventDetailQueries[i]?.data;
        const isConformityEval = detail?.conformityEvaluatorUserId === user?.id;
        const isFerramentasEval2 = detail?.conformityEvaluatorFerramentasUserId === user?.id;
        // Quesitos da área principal com outra pessoa: contam para o "concluído"
        // do principal — respondidos por QUALQUER avaliador designado.
        const delegated = delegatedAreaCriteriaForEvent(i);
        const delegatedPending = delegated.filter(
          c => !evs.some(e => e.criterionId === c.criterionId && e.status === "submitted"),
        ).length;
        // Matriz de Conformidade conta como trabalho deste avaliador — mesma
        // contagem do card e do "Resumo da Avaliação" (Cenografia 5, Ferramentas 1).
        const conf = detail?.conformity;
        const confTotal = (isConformityEval ? 5 : 0) + (isFerramentasEval2 ? 1 : 0);
        const confDone =
          (isConformityEval
            ? [conf?.epi, conf?.estaiamentos, conf?.conduta, conf?.standoutResponse].filter(v => v != null).length
              + (conf?.absencesReport?.trim() ? 1 : 0)
            : 0)
          + (isFerramentasEval2 && conf?.guardaEquipamentos != null ? 1 : 0);
        // Respondido = concluído (não depende da confirmação de resultados do RH).
        const allWorkDone = (total > 0 || confTotal > 0 || delegated.length > 0)
          && submitted === total
          && delegatedPending === 0
          && confDone === confTotal;
        return { event: ev, total, submitted, done: allWorkDone, relevant: total > 0 || isConformityEval || isFerramentasEval2 || delegated.length > 0 };
      }).filter(s => s.relevant)
    : [];
  // Eventos com qualquer publicação (parcial ou final) mas onde o avaliador
  // ainda não concluiu — ficam numa seção própria "Publicado" e NÃO aparecem
  // mais em "A Fazer" para não pressionar o avaliador após a publicação.
  const publishedNotDoneEvents = evaluatorEventStats.filter(
    s => !s.done && ((s.event as { partialPublishedAt?: string | null; feedbackReleased?: boolean }).partialPublishedAt || (s.event as { feedbackReleased?: boolean }).feedbackReleased),
  ).map(s => s.event);
  const publishedNotDoneIds = new Set(publishedNotDoneEvents.map(e => e.id));
  const todoEvents = evaluatorEventStats.filter(s => !s.done && !publishedNotDoneIds.has(s.event.id)).map(s => s.event);
  const doneEvents = evaluatorEventStats.filter(s => s.done).map(s => s.event);

  // If the selected event stops being selectable (closed or criteria unconfirmed
  // server-side), clear the selection so trigger text and loaded data stay in sync.
  useEffect(() => {
    if (selectedEventId == null || !events) return;
    const stillValid = events.some(e => e.id === selectedEventId && (e.status === "open" || e.status === "closed") && (isEvaluator ? e.criteriaConfirmed : true));
    if (!stillValid) { setSelectedEventId(null); setScores({}); setComments({}); setAudioOverrides({}); }
  }, [selectedEventId, events, isEvaluator]);

  const currentEvent = events?.find(e => e.id === selectedEventId);
  const criteriaLocked = currentEvent ? !currentEvent.criteriaConfirmed : false;

  // Avaliadores only see/evaluate the areas assigned to them FOR THIS EVENT
  // (atribuição evento→área→avaliador), not the fixed profile area.
  const myAssignedAreaIds = new Set(
    (selectedEventDetail?.areaAssignments ?? [])
      .filter(a => a.evaluatorUserId === user?.id)
      .map(a => a.areaId),
  );
  // Quando um critério já tem um registro de roteamento (foi atribuído/
  // redirecionado individualmente), ele manda: só quem está atualmente
  // designado enxerga o critério, mesmo que outra pessoa também pertença à
  // área responsável — é isso que faz um redirecionamento remover de vez o
  // critério da lista de quem redirecionou. Sem registro de roteamento
  // (evento legado / nunca atribuído individualmente), cai na área.
  const criterionAssignmentByCriterionId = new Map(
    (criterionAssignments ?? []).map(a => [a.criterionId, a]),
  );
  const myCriteria = activeCriteria.filter(c => {
    const assignment = criterionAssignmentByCriterionId.get(c.criterionId);
    if (assignment) return assignment.assignedToId === user?.id;
    return c.responsibleAreaId != null && myAssignedAreaIds.has(c.responsibleAreaId);
  });

  // For primary-area evaluators: fallback redirect options from the criterion's responsible area.
  // Placed after myCriteria because it references myCriteria.find() to look up the area.
  const redirectCriterionAreaId = redirectDialogArea?.areaId ?? null;
  const { data: redirectAreaUsersRaw } = useGetUsersByArea(redirectCriterionAreaId!, {
    query: {
      enabled: redirectCriterionAreaId != null,
      queryKey: ["users-by-area-redirect", redirectCriterionAreaId] as unknown[],
    },
  });
  // Routing-configured list takes priority; falls back to area members (excluding self).
  const effectiveRedirectOptions: { id: number; name: string }[] =
    (redirectOptionsData?.length ?? 0) > 0
      ? (redirectOptionsData ?? []).map(u => ({ id: u.id, name: u.name }))
      : (redirectAreaUsersRaw ?? [])
          .filter(u => u.id !== user?.id)
          .map(u => ({ id: u.id, name: u.name }));

  // Agrupa os critérios do avaliador logado por área — inclui areaId para
  // suportar botões de redirecionar/link-público por formulário (grupo de área).
  const myAreaGroups = (() => {
    const map = new Map<number, { areaId: number; areaName: string; criteria: typeof myCriteria }>();
    for (const c of myCriteria) {
      const key = c.responsibleAreaId ?? -1;
      const existing = map.get(key);
      if (existing) {
        existing.criteria.push(c);
      } else {
        map.set(key, { areaId: key, areaName: c.responsibleAreaName ?? "Sem área definida", criteria: [c] });
      }
    }
    return Array.from(map.values());
  })();

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function formatEvalDate(v: string | null | undefined) {
    if (!v) return "";
    return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function currentScore(criterionId: number): number | null {
    if (scores[criterionId] != null) return scores[criterionId];
    const ev = getEval(criterionId);
    return ev ? parseFloat(ev.score as unknown as string) : null;
  }

  function currentAudio(criterionId: number): string | null {
    const override = audioOverrides[criterionId];
    if (override !== undefined) return override === "" ? null : override;
    return getEval(criterionId)?.audioUrl ?? null;
  }

  function handleSaveDraft(criterionId: number) {
    if (!selectedEventId) return;
    const score = currentScore(criterionId);
    if (score == null) return;

    const comment = comments[criterionId] ?? getEval(criterionId)?.comments ?? "";
    if (!comment.trim()) {
      toast({ title: "Comentário obrigatório", description: "Preencha o comentário antes de salvar.", variant: "destructive" });
      return;
    }
    // Áudio é opcional — complemento ao comentário, não trava salvar/submeter.
    const audioUrl = currentAudio(criterionId);
    createMutation.mutate({ data: { eventId: selectedEventId, criterionId, score, comments: comment, audioUrl: audioUrl ?? undefined } });
  }

  function handleScoreClick(criterionId: number, score: number) {
    setScores(s => ({ ...s, [criterionId]: score }));
  }

  // A criterion is "ready to launch" if it's already submitted, OR fully filled
  // in-screen: score escolhido, comentário preenchido e áudio gravado.
  function criterionReady(criterionId: number): boolean {
    const ev = getEval(criterionId);
    if (ev?.status === "submitted") return true;
    const score = currentScore(criterionId);
    if (score == null) return false;
    const comment = comments[criterionId] ?? ev?.comments ?? "";
    if (!comment.trim()) return false;
    return true;
  }

  // One-click submit: create/update each pending criterion as draft then submit
  // it, with no requirement to have saved a rascunho first. On success we leave
  // the evaluation screen so the avaliador sees the event as concluded.
  async function handleLaunchAll() {
    if (!selectedEventId) return;
    setLaunching(true);
    // Rastreia o progresso para que, em caso de falha, o toast diga qual
    // critério quebrou e quantos já haviam sido enviados antes dele.
    let sentCount = 0;
    let failingCriterionName: string | null = null;
    try {
      for (const c of myCriteria) {
        const ev = getEval(c.criterionId);
        if (ev?.status === "submitted") continue;
        const score = currentScore(c.criterionId);
        if (score == null) continue;
        failingCriterionName = c.criterionName ?? `critério #${c.criterionId}`;
        const comment = comments[c.criterionId] ?? ev?.comments ?? "";
        const audioUrl = currentAudio(c.criterionId);
        const created = await createEvaluation({
          eventId: selectedEventId,
          criterionId: c.criterionId,
          score,
          comments: comment || undefined,
          audioUrl: audioUrl ?? undefined,
        });
        await submitEvaluation(created.id);
        sentCount += 1;
        failingCriterionName = null;
      }
      await qc.invalidateQueries({ queryKey: evalsQKey });
      toast({ title: "Avaliação lançada com sucesso", description: "Você não tem pendências para este evento." });
      setConfirmLaunchOpen(false);
      setSelectedEventId(null);
      setScores({}); setComments({}); setAudioOverrides({});
    } catch (e) {
      // A criterion may already be submitted (e.g. a retry after a partial
      // failure). Refetch so getEval() reflects the real server state and the
      // next attempt skips what's already done instead of erroring again.
      await qc.invalidateQueries({ queryKey: evalsQKey });
      const reason = (e as { message?: string })?.message?.trim();
      const sentMsg = sentCount === 0
        ? "Nenhum critério foi enviado antes da falha."
        : sentCount === 1
          ? "1 critério foi enviado antes da falha."
          : `${sentCount} critérios foram enviados antes da falha.`;
      toast({
        title: failingCriterionName ? `Erro ao lançar "${failingCriterionName}"` : "Erro ao lançar avaliação",
        description: `${sentMsg}${reason ? ` Motivo: ${reason}.` : ""} Confira o que ficou pendente e tente novamente.`,
        variant: "destructive",
      });
    } finally {
      setLaunching(false);
    }
  }

  const allEvaled = myCriteria.length > 0 && myCriteria.every(c => {
    const ev = getEval(c.criterionId);
    return ev && ev.status === "submitted";
  });
  // Ready to launch when every criterion is filled in-screen (or already done),
  // and there is at least one not-yet-submitted criterion to send.
  const allReady = myCriteria.length > 0 && myCriteria.every(c => criterionReady(c.criterionId));
  const pendingToFill = myCriteria.filter(c => !criterionReady(c.criterionId)).length;
  const toSubmitCount = myCriteria.filter(c => getEval(c.criterionId)?.status !== "submitted").length;

  // Só "submitted" conta como concluído — mesma régua do card do evento
  // (EvaluatorEventCard); rascunho é trabalho em andamento, não entregue.
  const completedCount = myCriteria.filter(c => getEval(c.criterionId)?.status === "submitted").length;

  // Beyond the scored criteria, avaliadores da Matriz de Conformidade also
  // answer extra Sim/Não questions (Ferramentas e Case / Cenografia). Those
  // must count toward "Resumo da Avaliação" too, or the sidebar undercounts
  // this evaluator's real workload for the event.
  const extraConformityItemsTotal =
    (isFerramentasEvaluatorForEvent ? 1 : 0) +
    (isConformityEvaluatorForEvent ? 5 : 0);
  const extraConformityItemsCompleted =
    (isFerramentasEvaluatorForEvent && conformityEvalForm.guardaEquipamentos !== null ? 1 : 0) +
    (isConformityEvaluatorForEvent
      ? [conformityEvalForm.epi, conformityEvalForm.estaiamentos, conformityEvalForm.conduta, conformityEvalForm.standoutResponse]
          .filter(v => v !== null).length
        + (conformityEvalForm.absencesReport.trim() ? 1 : 0)
      : 0);

  const totalItems = myCriteria.length + extraConformityItemsTotal;
  const totalCompleted = completedCount + extraConformityItemsCompleted;

  const progressPct = totalItems ? (totalCompleted / totalItems) * 100 : 0;

  const labels: Record<number, string> = {
    0: "Crítico, não atendeu ao básico",
    10: "Perfeição, atendeu completamente e sem erros",
  };

  // Redesign: admin/rh/diretoria ganham uma central dedicada de atribuição
  // (progresso + quem-falta-avaliar + atribuição de avaliadores), separada do
  // fluxo de lançamento de nota do avaliador que segue abaixo.
  if (isConsultation) {
    return (
      <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
        <div className="p-6 md:p-10">
          <AdminEvaluationsConsole />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f7f9fb] min-h-screen flex flex-col text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="bg-[#191c1e] px-5 py-3 flex items-center justify-between gap-4 shrink-0 border-b-2 border-[#ccff00]/20">
        <div className="flex items-center gap-3">
          <h1 data-testid="text-page-title" className="text-lg italic uppercase tracking-tighter font-black leading-none text-white">
            Central de <span className="text-[#ccff00]">Avaliações</span>
          </h1>
          {cycle && (
            <span className="text-[9px] font-black italic uppercase px-2 py-0.5 border border-white/10 text-white/40 hidden sm:inline-block">
              {cycle.name}
            </span>
          )}
        </div>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside className="w-72 shrink-0 bg-white border-r-2 border-[#191c1e] flex flex-col overflow-hidden">

          {/* Evaluator: lista compacta A Fazer / Concluídas */}
          {isEvaluator && (
            <div className="flex-1 overflow-y-auto">
              {/* Cabeçalho da sidebar do avaliador */}
              <div className="bg-[#191c1e] px-4 py-2.5 flex items-center justify-between border-b-2 border-[#191c1e]">
                <span className="text-[11px] font-black italic uppercase tracking-widest text-[#ccff00] flex items-center gap-1.5">
                  <Target size={11} /> Minhas Avaliações
                </span>
                {evaluatorEventStats.length > 0 && (
                  <span className="text-[10px] font-black italic text-white/60 tabular-nums">
                    {doneEvents.length}<span className="text-white/30">/{evaluatorEventStats.length}</span>
                  </span>
                )}
              </div>
              {configuredEvents.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-10 h-10 bg-[#f2f4f6] border-2 border-[#191c1e] flex items-center justify-center mx-auto">
                    <Clock size={18} className="text-[#9aa08a]" />
                  </div>
                  <p className="text-[10px] italic font-bold uppercase text-[#747a60]">Nenhum evento liberado no momento.</p>
                </div>
              ) : relevantEvaluatorEvents.length === 0 ? (
                <div className="p-6 text-center space-y-2">
                  <div className="w-10 h-10 bg-[#f2f4f6] border-2 border-[#191c1e] flex items-center justify-center mx-auto">
                    <Building2 size={18} className="text-[#9aa08a]" />
                  </div>
                  <p className="text-[10px] italic font-bold uppercase text-[#747a60]">Nenhuma avaliação atribuída à sua área.</p>
                </div>
              ) : (
                <>
                  {todoEvents.length > 0 && (
                    <>
                      <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                        <span className="text-[9px] font-black italic uppercase tracking-widest text-[#b02f00] flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-[#f28b6a]" /> A Fazer
                        </span>
                        <span className="text-[9px] font-black italic text-[#9aa08a]">{todoEvents.length}</span>
                      </div>
                      {todoEvents.map(ev => {
                        const stats = evaluatorEventStats.find(s => s.event.id === ev.id);
                        const pct = stats && stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
                        const active = selectedEventId === ev.id;
                        return (
                          <button key={ev.id} type="button" data-testid={`evaluator-event-${ev.id}`}
                            onClick={() => { setActiveEvalTab("todo"); setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                            className={cn("w-full text-left px-4 py-3 border-l-4 border-l-[#f28b6a] border-b border-[#eceef0] flex flex-col gap-1.5 transition-colors", active ? "bg-[#fff8f5] border-l-[#e05020]" : "hover:bg-[#fff8f5]")}
                          >
                            <span className={cn("text-[11px] font-black italic uppercase leading-snug truncate", active ? "text-[#191c1e]" : "text-[#2e3228]")}>{ev.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[#f0e8e4] overflow-hidden">
                                <div className="h-full bg-[#f28b6a]" style={{ width: `${pct}%`, transition: "width 0.3s" }} />
                              </div>
                              <span className="text-[9px] font-black italic text-[#9aa08a] shrink-0 tabular-nums">{stats?.submitted ?? 0}/{stats?.total ?? 0}</span>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {publishedNotDoneEvents.length > 0 && (
                    <>
                      <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                        <span className="text-[9px] font-black italic uppercase tracking-widest text-[#006a80] flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-[#00b8d9]" /> Publicado
                        </span>
                        <span className="text-[9px] font-black italic text-[#9aa08a]">{publishedNotDoneEvents.length}</span>
                      </div>
                      {publishedNotDoneEvents.map(ev => {
                        const isFinal = (ev as { feedbackReleased?: boolean }).feedbackReleased;
                        const active = selectedEventId === ev.id;
                        return (
                          <button key={ev.id} type="button" data-testid={`evaluator-event-published-${ev.id}`}
                            onClick={() => { setActiveEvalTab("todo"); setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                            className={cn("w-full text-left px-4 py-3 border-l-4 border-l-[#00b8d9] border-b border-[#eceef0] flex flex-col gap-1.5 transition-colors", active ? "bg-[#e6f8fc]" : "opacity-80 hover:opacity-100 hover:bg-[#e6f8fc]")}
                          >
                            <span className="text-[11px] font-black italic uppercase leading-snug truncate text-[#004a5a]">{ev.name}</span>
                            <span className="text-[9px] font-black italic uppercase text-[#006a80] flex items-center gap-1">
                              {isFinal ? <><CheckCircle size={9} /> Feedback final publicado</> : <><Send size={9} /> Publicação parcial</>}
                            </span>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {doneEvents.length > 0 && (
                    <>
                      <div className="px-4 pt-4 pb-1.5 flex items-center justify-between">
                        <span className="text-[9px] font-black italic uppercase tracking-widest text-[#506600] flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-[#ccff00]" /> Concluídas
                        </span>
                        <span className="text-[9px] font-black italic text-[#9aa08a]">{doneEvents.length}</span>
                      </div>
                      {doneEvents.map(ev => {
                        const active = selectedEventId === ev.id;
                        return (
                          <button key={ev.id} type="button" data-testid={`evaluator-event-done-${ev.id}`}
                            onClick={() => { setActiveEvalTab("done"); setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                            className={cn("w-full text-left px-4 py-3 border-l-4 border-l-[#88b800] border-b border-[#eceef0] flex flex-col gap-1.5 transition-colors", active ? "bg-[#f5ffea]" : "opacity-75 hover:opacity-100 hover:bg-[#f5ffea]")}
                          >
                            <span className="text-[11px] font-black italic uppercase leading-snug truncate text-[#2e4400]">{ev.name}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-[#d8eebc] overflow-hidden">
                                <div className="h-full bg-[#ccff00]" style={{ width: "100%" }} />
                              </div>
                              <span className="text-[9px] font-black italic text-[#506600] shrink-0">100%</span>
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                  {todoEvents.length === 0 && doneEvents.length === 0 && (
                    <div className="p-6 text-center text-[10px] italic font-bold uppercase text-[#747a60]">Nenhuma avaliação.</div>
                  )}
                </>
              )}
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-auto p-5 space-y-5">

        {isEvaluator && selectedEventId && activeEvalTab === "todo" && !!myPrincipalAreas && myPrincipalAreas.length > 0 && (() => {
          const principalAreaIds = new Set(myPrincipalAreas.map(a => a.id));
          // Deriva a partir dos critérios ATIVOS do evento (não das atribuições já
          // geradas) — assim a área principal enxerga e gerencia seus quesitos desde
          // o primeiro momento, mesmo que ninguém tenha rodado "Gerar Sugestões"
          // ainda para este evento (a linha de atribuição é criada na hora, no
          // primeiro "Pegar para mim"/"Atribuir a...", como já acontece no backend).
          const assignmentByCriterionId = new Map((criterionAssignments ?? []).map(a => [a.criterionId, a]));
          const areaCriteria = activeCriteria
            .filter(c => c.responsibleAreaId != null && principalAreaIds.has(c.responsibleAreaId))
            .map(c => {
              const a = assignmentByCriterionId.get(c.criterionId);
              return {
                criterionId: c.criterionId,
                criterionName: c.criterionName,
                criterionAreaId: c.responsibleAreaId as number,
                assignedToId: a?.assignedToId ?? null,
                assignedToName: a?.assignedToName ?? null,
                status: a?.status ?? "pending",
              };
            });
          if (areaCriteria.length === 0) return null;
          const areaNameById = new Map(myPrincipalAreas.map(a => [a.id, a.name]));
          return (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Users size={22} />
                <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">Quesitos da Minha Área</h3>
              </div>
              <p className="text-sm text-[#444933] italic px-1 -mt-1">
                Como avaliador principal, você vê todos os quesitos da sua área neste evento e pode atribuir, tomar para si ou passar para outro colega.
              </p>
              <div className="bg-white border-2 border-[#191c1e] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                      <th className="px-4 py-3 text-xs font-bold uppercase italic text-[#444933]">Critério</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase italic text-[#444933]">Área</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase italic text-[#444933]">Avaliador Atual</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase italic text-[#444933] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#eceef0]">
                    {areaCriteria.map(a => {
                      const isMine = a.assignedToId === user?.id;
                      const isSubmitted = a.status === "submitted";
                      return (
                        <tr key={a.criterionId} className={isMine ? "bg-[#f0ffe0]" : ""}>
                          <td className="px-4 py-3 font-bold italic text-sm">{a.criterionName}</td>
                          <td className="px-4 py-3 text-xs italic text-[#747a60]">{areaNameById.get(a.criterionAreaId!)}</td>
                          <td className="px-4 py-3 text-sm italic">
                            {a.assignedToName ?? <span className="text-[#c4c9ac]">Sem avaliador</span>}
                            {isSubmitted && <span className="ml-2 text-[10px] font-black uppercase text-[#506600]">Enviada</span>}
                          </td>
                          <td className="px-4 py-3 text-right w-px">
                            {isSubmitted ? (
                              <span className="text-[11px] italic text-[#747a60]">—</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                {!isMine && (
                                  <button
                                    type="button"
                                    data-testid={`button-take-criterion-${a.criterionId}`}
                                    onClick={() => patchCriterionAssignment.mutate(
                                      { criterionId: a.criterionId, assignedToId: user!.id, action: "assign" },
                                      { onError: (e) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }) },
                                    )}
                                    className="text-[11px] font-black italic uppercase border-2 border-[#191c1e] px-2 py-1 hover:bg-[#ccff00] whitespace-nowrap"
                                  >
                                    Pegar para mim
                                  </button>
                                )}
                                <button
                                  type="button"
                                  data-testid={`button-assign-criterion-${a.criterionId}`}
                                  onClick={() => setAreaAssignTarget({ criterionId: a.criterionId, criterionName: a.criterionName ?? "", areaId: a.criterionAreaId! })}
                                  className="text-[11px] font-black italic uppercase border-2 border-[#191c1e] px-2 py-1 hover:bg-[#eceef0] whitespace-nowrap"
                                >
                                  Atribuir a...
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}

        <Dialog open={!!areaAssignTarget} onOpenChange={(open) => { if (!open) setAreaAssignTarget(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="italic uppercase font-black">Atribuir "{areaAssignTarget?.criterionName}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label className="text-xs italic uppercase text-[#747a60]">Escolha o avaliador da área</Label>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(areaAssignUsers ?? []).map(u => (
                  <button
                    key={u.id}
                    type="button"
                    data-testid={`option-assign-user-${u.id}`}
                    onClick={() => {
                      if (!areaAssignTarget) return;
                      patchCriterionAssignment.mutate(
                        { criterionId: areaAssignTarget.criterionId, assignedToId: u.id, action: "assign" },
                        {
                          onError: (e) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
                          onSuccess: () => setAreaAssignTarget(null),
                        },
                      );
                    }}
                    className={`w-full text-left px-3 py-2 border-2 border-[#191c1e] italic text-sm hover:bg-[#ccff00] ${u.id === user?.id ? "font-bold" : ""}`}
                  >
                    {u.name}{u.id === user?.id ? " (você)" : ""}
                  </button>
                ))}
                {areaAssignUsers?.length === 0 && (
                  <p className="text-xs italic text-[#747a60]">Nenhum usuário ativo encontrado nesta área.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {!selectedEventId ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
            <div className="border-2 border-[#191c1e] bg-white p-10 max-w-sm w-full flex flex-col items-center gap-4 relative">
              <div className="w-20 h-20 border-2 border-[#191c1e] bg-[#191c1e] flex items-center justify-center skew-x-[-4deg]">
                <Rocket className="text-[#ccff00] skew-x-[4deg]" size={36} />
              </div>
              <div>
                <h2 className="text-xl italic uppercase font-black tracking-tight text-[#191c1e] leading-tight">
                  Pronto para avaliar
                </h2>
                <p className="text-[#747a60] italic text-sm mt-1.5 leading-relaxed">
                  Selecione um evento ao lado para iniciar ou continuar sua avaliação.
                </p>
              </div>
              <div className="absolute -bottom-[3px] -right-[3px] w-full h-full border-2 border-[#191c1e] -z-10" />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header strip compacto */}
            {currentEvent && (
              <div className="border-2 border-[#191c1e] overflow-hidden">
                {/* Banda título escura */}
                <div className="bg-[#191c1e] px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-black italic uppercase tracking-tight text-white leading-tight">{currentEvent.name}</h2>
                      {currentEvent.cycleName && (
                        <span className="text-[9px] font-black italic uppercase px-2 py-0.5 border border-white/20 text-white/50 bg-white/5">{currentEvent.cycleName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] italic text-white/50 flex-wrap">
                      {currentEvent.clientName && <span className="text-white/70 font-bold">{currentEvent.clientName}</span>}
                      {(currentEvent.city || currentEvent.location) && (
                        <span className="flex items-center gap-1"><MapPin size={9} />{currentEvent.city ? `${currentEvent.city}${currentEvent.state ? `, ${currentEvent.state}` : ""}` : currentEvent.location}</span>
                      )}
                      <span className="flex items-center gap-1"><Calendar size={9} />{fmtDate(currentEvent.startDate, { day: "2-digit", month: "2-digit", year: "numeric" })} — {fmtDate(currentEvent.endDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] font-black italic uppercase px-2.5 py-1 bg-[#ccff00] text-[#161e00] border border-[#ccff00]">Aberto</span>
                    <span className="text-[10px] font-black italic text-white/60 flex items-center gap-1"><Users size={11} />{currentEvent.participantCount} part.</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Criteria Column / Evaluation Form */}
              <div className="space-y-4 order-2 lg:order-none">
                <div className="flex items-center justify-between gap-4 px-1">
                  <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                    <Target size={20} /> Critérios de Avaliação
                  </h3>
                </div>

                {criteriaLocked ? (
                  <div data-testid="notice-criteria-locked" className="text-center py-14 bg-[#fff4e5] border-2 border-[#191c1e] px-6">
                    <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#ff5722] text-white flex items-center justify-center mx-auto mb-4">
                      <Lock size={26} />
                    </div>
                    <h2 className="text-2xl italic uppercase font-black tracking-tight text-[#b02f00] mb-1">Avaliação bloqueada</h2>
                    <p className="text-sm md:text-base italic text-[#444933] max-w-md mx-auto">Os critérios deste evento ainda não foram confirmados pelo RH. Aguarde a liberação para iniciar a avaliação da equipe.</p>
                  </div>
                ) : myCriteria.length === 0 ? (
                  <div data-testid="notice-no-area-criteria" className="text-center py-12 bg-white border-2 border-[#191c1e] px-6">
                    <div className="w-14 h-14 border-2 border-[#191c1e] bg-[#f2f4f6] text-[#747a60] flex items-center justify-center mx-auto mb-4">
                      <Building2 size={24} />
                    </div>
                    <p className="italic uppercase font-bold text-[#747a60] max-w-md mx-auto">Nenhum critério atribuído à sua área neste evento.</p>
                  </div>
                ) : (
                  <div className={`bg-white border-2 border-[#191c1e] p-6 md:p-8 ${HARD_SHADOW}`}>
                    <div className="space-y-12">
                      {myAreaGroups.map(g => {
                        const eligibleIds = new Set((publicLinkEligibleCriteria ?? []).map(ec => ec.criterionId));
                        const areaEligible = g.criteria.filter(c => eligibleIds.has(c.criterionId)).map(c => c.criterionId);
                        const allGroupDone = g.criteria.every(c => getEval(c.criterionId)?.status === "submitted");
                        return (
                          <div key={g.areaId} className="space-y-10">
                            {/* Header do formulário com botões de redirecionar e link público por grupo/área */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-4 border-[#ccff00] pl-4">
                              <div>
                                <p className="text-[10px] font-bold italic uppercase text-[#747a60] tracking-wider">Formulário</p>
                                <h3 className="text-lg italic uppercase font-black tracking-tight">{g.areaName}</h3>
                              </div>
                              {!allGroupDone && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => { setRedirectDialogArea({ areaId: g.areaId, areaName: g.areaName, criteriaIds: g.criteria.map(c => c.criterionId), firstCriterionId: g.criteria[0]?.criterionId ?? 0 }); setRedirectTargetId(null); }}
                                    className="border-2 border-[#191c1e] bg-white px-3 py-2 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 hover:bg-[#f2f4f6] transition-all"
                                  >
                                    <CornerDownRight size={13} /> Redirecionar Formulário
                                  </button>
                                  {areaEligible.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => { const isCeno = g.areaId === CENOGRAFIA_AREA_ID; setPublicLinkDialogCriteriaIds(areaEligible); setPublicLinkDialogAreaName(g.areaName); setPublicLinkRecipientName(""); setGeneratedPublicUrl(null); setLinkCopied(false); setPublicLinkIncludeConformity(isCeno); setPublicLinkForceConformity(isCeno); refetchTokenHistory(); }}
                                      className="border-2 border-[#191c1e] bg-white px-3 py-2 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 hover:bg-[#f2f4f6] transition-all"
                                    >
                                      <Link2 size={13} /> Link Freelancer
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            {g.criteria.map((c, index) => {
                        const ev = getEval(c.criterionId);
                        const submitted = ev?.status === "submitted";
                        const isDraft = ev?.status === "draft";
                        const score = currentScore(c.criterionId);
                        const comment = comments[c.criterionId] ?? ev?.comments ?? "";
                        const audio = currentAudio(c.criterionId);

                        return (
                          <div key={c.criterionId} className={cn("criterion-row border-l-4 pl-6 py-2", submitted ? "border-[#506600]" : isDraft ? "border-[#ff5722]" : score != null ? "border-[#ccff00]" : "border-[#191c1e]/20")}>
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <span className="bg-[#e6e8ea] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-black italic uppercase">Peso {c.weightOverride ?? c.originalWeight ?? 0}</span>
                                  {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && !c.eventScoped && (
                                    <span className="bg-[#ffdbd1] border-2 border-[#862200] text-[#862200] px-2 py-0.5 text-[11px] font-black italic uppercase">Peso 0 — não conta na média</span>
                                  )}
                                  {c.eventScoped && (
                                    <span className="bg-[#f7ffd1] border-2 border-[#506600] text-[#344300] px-2 py-0.5 text-[11px] font-black italic uppercase">Entra na média do critério pai</span>
                                  )}
                                  {c.responsibleAreaName && (
                                    <span className="bg-[#e6e8ea] text-[#191c1e] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <Building2 size={11} /> {c.responsibleAreaName}
                                    </span>
                                  )}
                                  {submitted && (
                                    <span className="bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <CheckCircle size={12} /> Submetido
                                    </span>
                                  )}
                                  {isDraft && (
                                    <span className="bg-[#ffdbd1] text-[#862200] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1">
                                      <Clock size={12} /> Rascunho
                                    </span>
                                  )}
                                  {(() => {
                                    const a = criterionAssignments?.find(x => x.criterionId === c.criterionId);
                                    if (!a?.redirectedFromId) return null;
                                    const date = a.updatedAt
                                      ? new Date(a.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                                      : null;
                                    const fromFirst = a.redirectedFromName?.split(" ")[0] ?? "?";
                                    return (
                                      <span
                                        title={`Redirecionado de ${a.redirectedFromName ?? "?"}${date ? ` em ${date}` : ""}`}
                                        className="bg-[#e8f0fe] text-[#3451b2] border-2 border-[#191c1e] px-2 py-0.5 text-[11px] font-bold italic uppercase flex items-center gap-1"
                                      >
                                        <CornerDownRight size={11} /> De {fromFirst}{date ? <span className="opacity-70">· {date}</span> : null}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="text-[10px] font-black italic uppercase text-[#747a60] tracking-wider mb-0.5">
                                  Critério {index + 1} de {g.criteria.length}
                                </p>
                                <h4 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">{index + 1}. {c.criterionName}</h4>
                                <p className="text-sm text-[#444933] italic mt-1 leading-relaxed">
                                  {c.criterionDescription && c.criterionDescription.trim().length > 0
                                    ? c.criterionDescription
                                    : "Avalie o desempenho da equipe considerando este critério específico para o evento atual."}
                                </p>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-bold italic uppercase text-[#747a60]">Ritmo Atual</p>
                                <p className="text-[40px] leading-none italic font-black">{score != null ? score : "-"}</p>
                              </div>
                            </div>

                            <div className="mb-4">
                              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-11 gap-1">
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                                  <ScoreButton
                                    key={val}
                                    score={val}
                                    current={score}
                                    label={labels[val]}
                                    onClick={() => handleScoreClick(c.criterionId, val)}
                                    disabled={submitted}
                                  />
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                <div className="flex items-start gap-1.5 text-[11px] italic text-[#862200]">
                                  <span className="font-black shrink-0">0 —</span>
                                  <span className="font-bold leading-tight">{labels[0]}</span>
                                </div>
                                <div className="flex items-start gap-1.5 text-[11px] italic text-[#506600] justify-self-end text-right">
                                  <span className="font-bold leading-tight">{labels[10]}</span>
                                  <span className="font-black shrink-0">— 10</span>
                                </div>
                              </div>
                            </div>

                            {!submitted && (
                              <div className="mt-4 border-2 p-4 border-[#191c1e] bg-[#f2f4f6]">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <label className="text-xs font-black italic uppercase flex items-center gap-2">
                                    Justificativa / Feedback
                                    <span className="text-[10px] text-white bg-[#ba1a1a] px-2 py-0.5 font-bold italic uppercase">Obrigatório</span>
                                  </label>
                                  <span className="text-[10px] font-bold italic text-[#747a60] tabular-nums shrink-0">{comment.length}/300</span>
                                </div>
                                <Textarea
                                  placeholder="Descreva o desempenho da equipe para este critério (será compartilhado anonimamente)..."
                                  value={comment}
                                  maxLength={300}
                                  onChange={e => setComments(s => ({ ...s, [c.criterionId]: e.target.value }))}
                                  className="bg-white rounded-none border-2 resize-y min-h-24 italic focus-visible:ring-0 border-[#191c1e]"
                                />

                                <div className="mt-4 border-2 p-4 border-[#191c1e] bg-white">
                                  <label className="text-xs font-black italic uppercase flex items-center gap-2 mb-2">
                                    Áudio da avaliação
                                    <span className="text-[10px] text-[#444933] bg-[#e6e8ea] px-2 py-0.5 font-bold italic uppercase">Opcional</span>
                                  </label>
                                  <p className="text-[11px] text-[#444933] italic mb-3 leading-relaxed">
                                    Grave um áudio explicando a nota, se quiser complementar o comentário escrito.
                                  </p>
                                  <AudioRecorder
                                    value={audio}
                                    onChange={path => setAudioOverrides(s => ({ ...s, [c.criterionId]: path ?? "" }))}
                                  />
                                </div>

                                <div className="flex items-center justify-end pt-3 gap-3 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveDraft(c.criterionId)}
                                    disabled={score == null || !comment.trim() || createMutation.isPending}
                                    data-testid={`button-save-draft-${c.criterionId}`}
                                    className="bg-white border-2 border-[#191c1e] px-4 py-2 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                                  >
                                    {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    {createMutation.isPending ? "Salvando..." : isDraft ? "Atualizar Rascunho" : "Salvar Rascunho"}
                                  </button>
                                </div>
                              </div>
                            )}

                            {submitted && comment && (
                              <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 mt-4">
                                <p className="text-xs font-black italic uppercase mb-1">Seu Feedback:</p>
                                <p className="text-sm text-[#444933] italic">"{comment}"</p>
                              </div>
                            )}

                            {submitted && audio && (
                              <div className="bg-[#f2f4f6] border-2 border-[#191c1e] p-4 mt-4">
                                <p className="text-xs font-black italic uppercase mb-2">Áudio da avaliação</p>
                                <AudioPlayer objectPath={audio} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                          </div>
                        );
                      })}
                    </div>

                    {/* Sprint goal footer */}
                    <div className="mt-12 pt-8 border-t-4 border-dashed border-[#191c1e] flex flex-col md:flex-row justify-between items-center gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#ccff00] border-2 border-[#191c1e] flex items-center justify-center">
                          <Flag size={20} className="text-[#161e00]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold italic uppercase">Meta da Avaliação</p>
                          <div className="w-48 h-2 bg-[#eceef0] mt-1 border border-[#191c1e] overflow-hidden">
                            <div className="h-full bg-[#ccff00]" style={{ width: `${progressPct}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── GRUPO 1: Ferramentas e Case (Cenografia) ─── */}
              {isFerramentasEvaluatorForEvent && (() => {
                const val = conformityEvalForm.guardaEquipamentos;
                const isNao = val === false;
                const commentMissing = isNao && !conformityEvalForm.guardaEquipamentosComment.trim();
                // O comentário na tela difere do que está salvo no servidor?
                const commentDirty = conformityEvalForm.guardaEquipamentosComment !== (myConformityData?.guardaEquipamentosComment ?? "");
                const canSave = !commentMissing && commentDirty;
                const hasSentLink = (ferramentasPublicTokenHistory?.length ?? 0) > 0;
                return (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 px-1">
                      <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                        <ShieldAlert size={22} /> Ferramentas e Case (Cenografia)
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Popover open={redirectFerramentasOpen} onOpenChange={setRedirectFerramentasOpen}>
                          <PopoverTrigger asChild>
                            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors">
                              <ArrowRight size={12} /> Redirecionar
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-64">
                            <Command className="rounded-none">
                              <CommandInput placeholder="Buscar avaliador..." className="italic" />
                              <CommandList className="max-h-[240px]">
                                <CommandEmpty className="py-4 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhum encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {(ferramentasUsers ?? []).map(u => (
                                    <CommandItem key={u.id} value={u.name}
                                      onSelect={() => { setRedirectFerramentasTargetId(u.id); redirectFerramentasMutation.mutate({ id: selectedEventId!, data: { userId: u.id } }); }}
                                      className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-3"
                                    >
                                      <Check size={14} className={cn("shrink-0", redirectFerramentasTargetId === u.id ? "opacity-100" : "opacity-0")} />
                                      <span className="text-xs font-bold italic uppercase truncate">{u.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {(() => {
                          const pendingFerr = (ferramentasPublicTokenHistory ?? []).find(t => !t.usedAt);
                          const answeredFerr = (ferramentasPublicTokenHistory ?? []).find(t => t.usedAt);
                          const ferrBase = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                          if (pendingFerr) {
                            const pendingUrl = `${ferrBase}/eval/${pendingFerr.id}`;
                            return (
                              <button type="button"
                                onClick={async () => { if (await copyToClipboard(pendingUrl)) toast({ title: "Link copiado!", description: `Para: ${pendingFerr.recipientName ?? "freelancer"}` }); else toast(COPY_FAILED_TOAST); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-[#f7ffd1] hover:bg-[#eeff99] transition-colors"
                                title="Copiar link já enviado — só existe um link por evento"
                              >
                                <Copy size={12} /> Copiar link ({pendingFerr.recipientName ?? "freelancer"})
                              </button>
                            );
                          }
                          if (answeredFerr) return null;
                          return (
                            <button type="button"
                              onClick={() => { setConformityPublicLinkType("ferramentas"); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); refetchFerramentasTokenHistory(); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors"
                              title="Gerar link único para um freelancer responder o formulário de Ferramentas"
                            >
                              <Link2 size={12} /> Link Freelancer
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    {hasSentLink ? (
                      <>
                        <p className="text-sm text-[#444933] italic px-1 -mt-1">
                          Link enviado para um freelancer preencher este formulário. Acompanhe abaixo.
                        </p>
                        <ConformityLinkHistory history={ferramentasPublicTokenHistory ?? []} />
                      </>
                    ) : null}
                    {!hasSentLink && (
                      <>
                        <p className="text-sm text-[#444933] italic px-1 -mt-1">
                          Você foi designado para avaliar o retorno de equipamentos e ferramentas.
                        </p>
                        <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                          <div className={`px-5 transition-colors ${isNao ? "bg-[#fdece6] border-l-4 border-[#862200]" : val === null ? "bg-[#fffbf0] border-l-4 border-[#d4a800]" : ""}`}>
                            <div className="flex flex-wrap items-center justify-between gap-3 min-h-[56px]">
                              <span className="text-sm font-bold italic text-[#191c1e] leading-snug flex-1 min-w-[200px]">Todos os equipamentos e ferramentas retornaram?</span>
                              <div className="flex items-center gap-2 shrink-0">
                                {isNao && <span className="text-[10px] font-black italic uppercase text-[#862200] whitespace-nowrap">-10 pts</span>}
                                <div className="flex items-center border-2 border-[#191c1e] overflow-hidden">
                                  <button type="button"
                                    onClick={() => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: null })); if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data: { guardaEquipamentos: null } }, { onSuccess: () => toast({ title: "Resposta salva" }) }); }}
                                    className={`px-3 py-1.5 text-[11px] font-black italic uppercase border-r-2 border-[#191c1e] transition-all ${val === null ? "bg-[#d4a800] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                                  >Pendente</button>
                                  <button type="button"
                                    onClick={() => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: true })); if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data: { guardaEquipamentos: true } }, { onSuccess: () => toast({ title: "Resposta salva" }) }); }}
                                    className={`px-3 py-1.5 text-[11px] font-black italic uppercase border-r-2 border-[#191c1e] transition-all ${val === true ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                                  >Sim</button>
                                  <button type="button"
                                    onClick={() => { setConformityEvalForm(f => ({ ...f, guardaEquipamentos: false })); if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data: { guardaEquipamentos: false } }, { onSuccess: () => toast({ title: "Resposta salva" }) }); }}
                                    className={`px-3 py-1.5 text-[11px] font-black italic uppercase transition-all ${val === false ? "bg-[#862200] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                                  >Não</button>
                                </div>
                              </div>
                            </div>
                            {val !== null && (
                              <div className="pb-3 space-y-1">
                                <label className="text-[10px] font-bold italic uppercase text-[#747a60] flex items-center gap-1.5">
                                  Comentário {isNao ? <span className="text-[#b02f00] normal-case font-bold">* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                                  {!commentDirty && conformityEvalForm.guardaEquipamentosComment && (
                                    <span className="text-[#506600] flex items-center gap-0.5 font-bold"><CheckCircle size={9} /> salvo</span>
                                  )}
                                </label>
                                <Textarea
                                  placeholder={isNao ? "Descreva o que aconteceu com os equipamentos/ferramentas..." : "Alguma observação? (opcional)"}
                                  value={conformityEvalForm.guardaEquipamentosComment}
                                  onChange={e => setConformityEvalForm(f => ({ ...f, guardaEquipamentosComment: e.target.value }))}
                                  className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[72px]"
                                />
                                {commentMissing && <p className="text-[10px] font-bold italic text-[#862200]">Comentário obrigatório quando a resposta é Não.</p>}
                              </div>
                            )}
                          </div>
                          {/* Save comment — só aparece quando há alterações */}
                          {val !== null && commentDirty && (
                            <div className="px-5 py-3 bg-[#fffbf0] border-t-2 border-[#d4a800] flex items-center justify-between gap-3">
                              <span className="text-[10px] font-bold italic uppercase text-[#b02f00] flex items-center gap-1"><AlertCircle size={11} /> Alterações não salvas</span>
                              <button type="button" disabled={!canSave || conformityEvalMutation.isPending}
                                onClick={() => { if (selectedEventId && canSave) conformityEvalMutation.mutate({ id: selectedEventId, data: { guardaEquipamentosComment: conformityEvalForm.guardaEquipamentosComment } }, { onSuccess: () => toast({ title: "Observação salva" }) }); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] disabled:opacity-40 hover:bg-[#333] transition-colors"
                              >{conformityEvalMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar</button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ─── GRUPO 2: Cenografia ─── */}
              {isConformityEvaluatorForEvent && (() => {
                type CKey = "epi" | "estaiamentos" | "conduta";
                type CCommentKey = "epiComment" | "estaiamentosComment" | "condutaComment";
                const cenografiaItems: { key: CKey; commentKey: CCommentKey; label: string; question: string }[] = [
                  { key: "epi", commentKey: "epiComment", label: "Uso de EPI", question: "Todos usaram EPI na arena?" },
                  { key: "estaiamentos", commentKey: "estaiamentosComment", label: "Estaiamentos / Aterramentos", question: "Estaiamento e Aterramento foram feitos de maneira correta?" },
                  { key: "conduta", commentKey: "condutaComment", label: "Conduta", question: "Conduta e comportamento foram adequados? (horários, ordens e regras)" },
                ];
                const standoutNeedsJustification = conformityEvalForm.standoutResponse === true && !conformityEvalForm.standoutJustification.trim();
                const absencesNeedsReport = !conformityEvalForm.absencesReport.trim();
                const missingRequiredComments = cenografiaItems.some(i => conformityEvalForm[i.key] === false && !conformityEvalForm[i.commentKey].trim());
                // Algum campo de texto na tela difere do que está salvo no servidor?
                const textsDirty =
                  cenografiaItems.some(i => conformityEvalForm[i.commentKey] !== (myConformityData?.[i.commentKey] ?? "")) ||
                  conformityEvalForm.absencesReport !== (myConformityData?.absencesReport ?? "") ||
                  conformityEvalForm.standoutJustification !== (myConformityData?.standoutJustification ?? "");
                const canSaveTexts = !standoutNeedsJustification && !absencesNeedsReport && !missingRequiredComments && textsDirty;
                const filledCount = cenografiaItems.filter(i => conformityEvalForm[i.key] !== null).length;
                const hasSentLink = (conformityPublicTokenHistory?.length ?? 0) > 0;
                return (
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3 px-1">
                      <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                        <ShieldAlert size={22} /> Cenografia
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Popover open={redirectConformityOpen} onOpenChange={setRedirectConformityOpen}>
                          <PopoverTrigger asChild>
                            <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors">
                              <ArrowRight size={12} /> Redirecionar
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-64">
                            <Command className="rounded-none">
                              <CommandInput placeholder="Buscar avaliador..." className="italic" />
                              <CommandList className="max-h-[240px]">
                                <CommandEmpty className="py-4 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhum encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {(cenografiaUsers ?? []).map(u => (
                                    <CommandItem key={u.id} value={u.name}
                                      onSelect={() => { setRedirectConformityTargetId(u.id); redirectConformityMutation.mutate({ id: selectedEventId!, data: { userId: u.id } }); }}
                                      className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-3"
                                    >
                                      <Check size={14} className={cn("shrink-0", redirectConformityTargetId === u.id ? "opacity-100" : "opacity-0")} />
                                      <span className="text-xs font-bold italic uppercase truncate">{u.name}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {(() => {
                          const pendingCeno = (conformityPublicTokenHistory ?? []).find(t => !t.usedAt);
                          const answeredCeno = (conformityPublicTokenHistory ?? []).find(t => t.usedAt);
                          const cenoBase = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                          if (pendingCeno) {
                            const pendingUrl = `${cenoBase}/eval/${pendingCeno.id}`;
                            return (
                              <button type="button"
                                onClick={async () => { if (await copyToClipboard(pendingUrl)) toast({ title: "Link copiado!", description: `Para: ${pendingCeno.recipientName ?? "freelancer"}` }); else toast(COPY_FAILED_TOAST); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-[#f7ffd1] hover:bg-[#eeff99] transition-colors"
                                title="Copiar link já enviado — só existe um link por evento"
                              >
                                <Copy size={12} /> Copiar link ({pendingCeno.recipientName ?? "freelancer"})
                              </button>
                            );
                          }
                          // Só esconde o botão se um link já foi usado E a conformidade
                          // realmente foi preenchida. Se o link foi usado mas a matriz
                          // seguiu vazia (0 itens), ainda é preciso poder reenviar — senão
                          // fica "sem como" responder a conformidade.
                          if (answeredCeno && filledCount > 0) return null;
                          return (
                            <button type="button"
                              onClick={() => { setConformityPublicLinkType("cenografia"); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); refetchConformityTokenHistory(); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors"
                              title="Gerar link único para um freelancer responder o formulário de Cenografia"
                            >
                              <Link2 size={12} /> {answeredCeno ? "Reenviar Link" : "Link Freelancer"}
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    {hasSentLink ? (
                      <>
                        <p className="text-sm text-[#444933] italic px-1 -mt-1">
                          Link enviado para um freelancer preencher este formulário. Acompanhe abaixo.
                        </p>
                        <ConformityLinkHistory history={conformityPublicTokenHistory ?? []} />
                      </>
                    ) : (
                      <>
                    <p className="text-sm text-[#444933] italic px-1 -mt-1">
                      Você foi designado para avaliar a conformidade da equipe de Cenografia neste evento.
                    </p>

                    {/* 3 conformity items */}
                    <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                      <div className="divide-y-2 divide-[#eceef0]">
                        {cenografiaItems.map(item => {
                          const val = conformityEvalForm[item.key];
                          const isNao = val === false;
                          return (
                            <div key={item.key} className={`px-5 transition-colors ${isNao ? "bg-[#fdece6] border-l-4 border-[#862200]" : val === null ? "bg-[#fffbf0] border-l-4 border-[#d4a800]" : ""}`}>
                              <div className="flex flex-wrap items-center justify-between gap-3 min-h-[56px]">
                                <span className="text-sm font-bold italic text-[#191c1e] leading-snug flex-1 min-w-[200px]">{item.question}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {isNao && <span className="text-[10px] font-black italic uppercase text-[#862200] whitespace-nowrap">-10 pts</span>}
                                  <div className="flex items-center border-2 border-[#191c1e] overflow-hidden">
                                    <button type="button"
                                      onClick={() => { setConformityEvalForm(f => ({ ...f, [item.key]: true })); if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data: { [item.key]: true } }, { onSuccess: () => toast({ title: "Resposta salva" }) }); }}
                                      className={`px-3 py-1.5 text-[11px] font-black italic uppercase border-r-2 border-[#191c1e] transition-all ${val === true ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                                    >Sim</button>
                                    <button type="button"
                                      onClick={() => { setConformityEvalForm(f => ({ ...f, [item.key]: false })); if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data: { [item.key]: false } }, { onSuccess: () => toast({ title: "Resposta salva" }) }); }}
                                      className={`px-3 py-1.5 text-[11px] font-black italic uppercase transition-all ${val === false ? "bg-[#862200] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                                    >Não</button>
                                  </div>
                                </div>
                              </div>
                              {val !== null && (
                                <div className="pb-3 space-y-1">
                                  <label className="text-[10px] font-bold italic uppercase text-[#747a60]">
                                    Comentário {isNao ? <span className="text-[#b02f00] normal-case">* obrigatório</span> : <span className="font-normal normal-case">(opcional)</span>}
                                  </label>
                                  <Textarea
                                    placeholder={isNao ? `Descreva o que aconteceu com ${item.label.toLowerCase()}...` : "Alguma observação? (opcional)"}
                                    value={conformityEvalForm[item.commentKey]}
                                    onChange={e => setConformityEvalForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                                    className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[64px]"
                                  />
                                  {isNao && !conformityEvalForm[item.commentKey].trim() && (
                                    <p className="text-[10px] font-bold italic text-[#862200]">Comentário obrigatório quando a resposta é Não.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {filledCount === cenografiaItems.length && (
                        <div className="px-5 py-3 bg-[#f2f4f6] border-t-2 border-[#eceef0] flex items-center gap-2">
                          <CheckCircle size={14} className="text-[#506600]" />
                          <span className="text-xs font-bold italic uppercase text-[#506600]">Itens preenchidos — {cenografiaItems.filter(i => conformityEvalForm[i.key] === true).length}/{cenografiaItems.length} conformes</span>
                        </div>
                      )}
                    </div>

                    {/* Absences question — texto livre sempre obrigatório */}
                    <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                      <div className="px-5 py-4 space-y-1">
                        <label className="block text-sm font-black italic uppercase text-[#191c1e]">
                          Alguém faltou ou atrasou por mais de 30 minutos? Especifique. <span className="text-[#b02f00]">*</span> obrigatório
                        </label>
                        <Textarea
                          placeholder="Ex.: João Silva — faltou sem aviso. Maria Souza — 45 min de atraso por trânsito. Se ninguém faltou/atrasou, escreva &quot;Ninguém faltou ou atrasou&quot;."
                          value={conformityEvalForm.absencesReport}
                          onChange={e => setConformityEvalForm(f => ({ ...f, absencesReport: e.target.value }))}
                          className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[72px]"
                        />
                        {absencesNeedsReport && <p className="text-[10px] font-bold italic text-[#862200]">Especifique antes de salvar.</p>}
                      </div>
                    </div>

                    {/* Standout question */}
                    <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                      <div className="px-5 py-4 space-y-3">
                        <label className="block text-sm font-black italic uppercase text-[#191c1e]">Algum profissional teve um desempenho fora da curva?</label>
                        <div className="flex gap-2">
                          <button type="button"
                            onClick={() => { setConformityEvalForm(f => ({ ...f, standoutResponse: false, standoutJustification: '' })); if (selectedEventId) conformityEvalMutation.mutate({ id: selectedEventId, data: { standoutResponse: false, standoutJustification: null } }, { onSuccess: () => toast({ title: "Resposta salva" }) }); }}
                            className={`flex-1 px-4 py-2.5 text-xs font-black italic uppercase border-2 border-[#191c1e] transition-all ${conformityEvalForm.standoutResponse === false ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                          >Não, dentro do padrão esperado</button>
                          <button type="button"
                            onClick={() => setConformityEvalForm(f => ({ ...f, standoutResponse: true }))}
                            className={`flex-1 px-4 py-2.5 text-xs font-black italic uppercase border-2 border-[#191c1e] transition-all ${conformityEvalForm.standoutResponse === true ? "bg-[#506600] text-white" : "bg-white text-[#9aa088] hover:bg-[#f5f5f5]"}`}
                          >Sim, houve um grande destaque</button>
                        </div>
                        {conformityEvalForm.standoutResponse === true && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black italic uppercase text-[#506600]">Detalhe o destaque <span>*</span> obrigatório</label>
                            <Textarea
                              placeholder="Nome do profissional e por que se destacou..."
                              value={conformityEvalForm.standoutJustification}
                              onChange={e => setConformityEvalForm(f => ({ ...f, standoutJustification: e.target.value }))}
                              className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[72px]"
                            />
                            {standoutNeedsJustification && <p className="text-[10px] font-bold italic text-[#862200]">Descreva o destaque antes de salvar.</p>}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Save text fields — só aparece quando há alterações */}
                    {textsDirty && (
                      <div className="flex items-center justify-between gap-3 bg-[#fffbf0] border-2 border-[#d4a800] px-4 py-3">
                        <span className="text-[11px] font-bold italic uppercase text-[#b02f00] flex items-center gap-1"><AlertCircle size={12} /> Alterações não salvas</span>
                        <button type="button" disabled={!canSaveTexts || conformityEvalMutation.isPending}
                          onClick={() => {
                            if (!selectedEventId || !canSaveTexts) return;
                            const payload: Record<string, unknown> = { absencesResponse: true, absencesReport: conformityEvalForm.absencesReport, standoutResponse: conformityEvalForm.standoutResponse, standoutJustification: conformityEvalForm.standoutJustification || null };
                            cenografiaItems.forEach(item => { payload[item.commentKey] = conformityEvalForm[item.commentKey] || null; });
                            conformityEvalMutation.mutate(
                              { id: selectedEventId, data: payload as Parameters<typeof conformityEvalMutation.mutate>[0]["data"] },
                              { onSuccess: () => toast({ title: "Observações salvas" }) },
                            );
                          }}
                          className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] disabled:opacity-40 hover:bg-[#333] transition-colors"
                        ><Save size={14} /> Salvar observações</button>
                      </div>
                    )}
                      </>
                    )}

                  </div>
                );
              })()}

              {/* Right Sticky Panel */}
              <div className="order-1 lg:order-none sticky top-16 md:top-2 lg:top-6 space-y-6 z-10">
                <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                  <div className="bg-[#191c1e] text-[#ccff00] px-5 py-4 italic">
                    <h3 className="text-lg font-black uppercase tracking-tight">Resumo da Avaliação</h3>
                    <p className="text-[11px] font-bold uppercase text-white/70">Sua avaliação para este evento</p>
                  </div>

                  <div className="p-5 border-b-2 border-[#eceef0]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold italic uppercase text-[#444933]">Progresso</span>
                      <span className="text-sm font-black italic text-[#506600]">{Math.round(progressPct)}%</span>
                    </div>
                    <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2.5 mb-2">
                      <div className="bg-[#ccff00] h-full transition-[width] duration-500" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#747a60] italic">
                      {extraConformityItemsTotal > 0
                        ? `${totalCompleted} de ${totalItems} itens concluídos — ${completedCount} de ${myCriteria.length} critérios submetidos e ${extraConformityItemsCompleted} de ${extraConformityItemsTotal} perguntas da matriz respondidas.`
                        : `${completedCount} de ${myCriteria.length} critérios submetidos.`}
                    </p>
                  </div>

                  {/* Grade summary — evaluators only. Includes both scored
                      criteria AND the extra Sim/Não questions from the
                      Matriz de Conformidade (Ferramentas e Case / Cenografia),
                      so nothing an avaliador has to fill out is left off the
                      summary. */}
                  {isEvaluator && (myCriteria.length > 0 || extraConformityItemsTotal > 0) && (
                    <div className="p-5 border-b-2 border-[#eceef0]">
                      <p className="text-xs font-bold italic uppercase text-[#444933] mb-3">Resumo das Notas</p>
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {myCriteria.map(c => {
                          const ev = getEval(c.criterionId);
                          const score = currentScore(c.criterionId);
                          const hasScore = score != null;
                          const isSubmitted = ev?.status === "submitted";
                          const isDraft = ev?.status === "draft";
                          const commentText = comments[c.criterionId] ?? ev?.comments ?? "";
                          const missingComment = !isSubmitted && hasScore && !commentText.trim();
                          return (
                            <div key={c.criterionId} className="space-y-0.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">{c.criterionName}</span>
                                  {isSubmitted && <Lock size={11} className="shrink-0 text-[#506600]" />}
                                  {isDraft && !isSubmitted && <span className="shrink-0 text-[9px] font-black italic uppercase text-[#862200] tracking-wide">rascunho</span>}
                                </div>
                                {hasScore ? (
                                  <span className="shrink-0 text-sm font-black italic text-[#506600]">{score}<span className="text-[10px] text-[#747a60]">/10</span></span>
                                ) : (
                                  <span className="shrink-0 text-sm font-black italic text-[#c2c6c9]">—</span>
                                )}
                              </div>
                              {missingComment && (
                                <p className="text-[10px] font-bold italic uppercase text-[#b02f00]">Falta preencher o comentário</p>
                              )}
                            </div>
                          );
                        })}
                        {isFerramentasEvaluatorForEvent && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">Guarda de Equipamentos</span>
                            {conformityEvalForm.guardaEquipamentos === null ? (
                              <span className="shrink-0 text-[10px] font-black italic uppercase text-[#862200] tracking-wide">pendente</span>
                            ) : (
                              <span className={`shrink-0 text-sm font-black italic ${conformityEvalForm.guardaEquipamentos ? "text-[#506600]" : "text-[#b02f00]"}`}>{conformityEvalForm.guardaEquipamentos ? "Sim" : "Não"}</span>
                            )}
                          </div>
                        )}
                        {isConformityEvaluatorForEvent && [
                          { label: "EPI", val: conformityEvalForm.epi },
                          { label: "Estaiamentos / Aterramentos", val: conformityEvalForm.estaiamentos },
                          { label: "Conduta", val: conformityEvalForm.conduta },
                          { label: "Desempenho fora da curva", val: conformityEvalForm.standoutResponse },
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">{item.label}</span>
                            {item.val === null ? (
                              <span className="shrink-0 text-[10px] font-black italic uppercase text-[#862200] tracking-wide">pendente</span>
                            ) : (
                              <span className={`shrink-0 text-sm font-black italic ${item.val ? "text-[#506600]" : "text-[#b02f00]"}`}>{item.val ? "Sim" : "Não"}</span>
                            )}
                          </div>
                        ))}
                        {isConformityEvaluatorForEvent && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">Faltas/Atrasos</span>
                            {conformityEvalForm.absencesReport.trim() ? (
                              <span className="shrink-0 text-sm font-black italic text-[#506600]">Respondido</span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-black italic uppercase text-[#862200] tracking-wide">pendente</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Link Freelancer — movido para o cabeçalho de cada formulário/área */}

                  {/* Submission — evaluators only */}
                  {isEvaluator && myCriteria.length > 0 && (
                    <div className="p-5">
                      {allEvaled ? (
                        <div className="flex items-center justify-center gap-2 text-[#506600] bg-[#ccff00]/30 border-2 border-[#506600] p-3 font-bold italic uppercase text-sm">
                          <CheckCircle size={16} /> Você já concluiu sua avaliação
                        </div>
                      ) : allReady ? (
                        <button
                          data-testid="button-submit-eval"
                          onClick={() => setConfirmLaunchOpen(true)}
                          disabled={launching}
                          className={`w-full bg-[#ccff00] border-2 border-[#191c1e] py-4 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                        >
                          <Rocket size={16} /> Lançar Avaliação
                        </button>
                      ) : (
                        <button disabled className="w-full bg-[#eceef0] border-2 border-[#191c1e] py-4 font-bold text-sm italic uppercase tracking-wider opacity-60 cursor-not-allowed">
                          {pendingToFill} {pendingToFill === 1 ? "critério pendente" : "critérios pendentes"}
                        </button>
                      )}

                      {!allEvaled && (
                        <p className="text-[11px] text-center text-[#747a60] italic mt-3 leading-relaxed">
                          {allReady
                            ? <>Ao lançar, suas notas são <strong>submetidas e bloqueadas</strong>. Salvar rascunho é opcional.</>
                            : <>Dê nota, preencha o comentário e grave o áudio de cada critério. <strong>Salvar rascunho é opcional</strong> — você pode lançar direto.</>}
                        </p>
                      )}

                      <AlertDialog open={confirmLaunchOpen} onOpenChange={(o) => { if (!launching) setConfirmLaunchOpen(o); }}>
                        <AlertDialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]" data-testid="dialog-confirm-launch">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                              <Rocket size={22} className="text-[#506600]" /> Confirmar lançamento
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm text-[#444933] italic leading-relaxed">
                              Você está prestes a submeter {toSubmitCount} {toSubmitCount === 1 ? "avaliação" : "avaliações"} para
                              {" "}<strong>{currentEvent?.name}</strong>. Após o lançamento, as notas ficam
                              {" "}<strong>bloqueadas para edição</strong> e compõem a nota final da equipe. Deseja continuar?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          {isEvaluator && myCriteria.length > 0 && (
                            <div className="border-2 border-[#191c1e] bg-[#f2f4f6] p-4 max-h-60 overflow-y-auto">
                              <p className="text-xs font-bold italic uppercase text-[#444933] mb-3">Resumo das Notas</p>
                              <div className="space-y-2">
                                {myCriteria.map(c => {
                                  const ev = getEval(c.criterionId);
                                  const score = currentScore(c.criterionId);
                                  const hasScore = score != null;
                                  const isSubmitted = ev?.status === "submitted";
                                  const isDraft = ev?.status === "draft";
                                  return (
                                    <div key={c.criterionId} className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[11px] font-bold italic uppercase text-[#191c1e] truncate">{c.criterionName}</span>
                                        {isSubmitted && <Lock size={11} className="shrink-0 text-[#506600]" />}
                                        {isDraft && !isSubmitted && <span className="shrink-0 text-[9px] font-black italic uppercase text-[#862200] tracking-wide">rascunho</span>}
                                      </div>
                                      {hasScore ? (
                                        <span className="shrink-0 text-sm font-black italic text-[#506600]">{score}<span className="text-[10px] text-[#747a60]">/10</span></span>
                                      ) : (
                                        <span className="shrink-0 text-sm font-black italic text-[#c2c6c9]">—</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              disabled={launching}
                              data-testid="button-cancel-launch"
                              className="rounded-none border-2 border-[#191c1e] font-bold italic uppercase text-xs tracking-wider"
                            >
                              Voltar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => { e.preventDefault(); handleLaunchAll(); }}
                              disabled={launching}
                              data-testid="button-confirm-launch"
                              className="rounded-none border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] font-bold italic uppercase text-xs tracking-wider hover:bg-[#bdf000] disabled:opacity-60"
                            >
                              {launching ? "Lançando..." : "Lançar agora"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Redirect dialog — avaliador redireciona o formulário inteiro (todos os critérios da área) */}
      <Dialog open={redirectDialogArea !== null} onOpenChange={(v) => { if (!v) { setRedirectDialogArea(null); setRedirectTargetId(null); } }}>
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-xl italic uppercase font-black tracking-tight flex items-center gap-2">
              <CornerDownRight size={18} /> Redirecionar Formulário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {redirectDialogArea != null && (
              <div className="bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                <p className="text-[10px] font-black italic uppercase text-[#747a60] mb-0.5">Formulário</p>
                <p className="text-sm font-black italic uppercase">{redirectDialogArea.areaName}</p>
                {redirectDialogArea.criteriaIds.length > 1 && (
                  <p className="text-[10px] italic text-[#747a60] mt-1">
                    {redirectDialogArea.criteriaIds.length} critérios serão transferidos juntos.
                  </p>
                )}
              </div>
            )}
            <p className="text-sm italic text-[#444933]">
              Selecione quem assumirá a responsabilidade por este formulário. Após a confirmação, todos os critérios saem da sua lista e passam para o usuário escolhido.
            </p>
            {effectiveRedirectOptions.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-[#eceef0] italic font-bold text-[#747a60] text-xs uppercase">
                Nenhuma opção de redirecionamento disponível para este critério.
              </div>
            ) : (
              <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-56 overflow-y-auto">
                {effectiveRedirectOptions.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[#f2f4f6] cursor-pointer">
                    <input
                      type="radio"
                      name="redirect-target"
                      checked={redirectTargetId === opt.id}
                      onChange={() => setRedirectTargetId(opt.id)}
                      className="h-4 w-4 accent-[#191c1e]"
                    />
                    <span className="text-sm font-bold italic uppercase">{opt.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {redirectTargetId != null && (
            <div className="bg-[#f9ffe0] border-2 border-[#ccff00] px-4 py-3 text-xs font-bold italic text-[#506600]">
              ↳ Confirmar: transferir para <strong>{effectiveRedirectOptions.find(o => o.id === redirectTargetId)?.name ?? "?"}</strong>. Esta ação é imediata.
            </div>
          )}
          <DialogFooter className="gap-2 pt-4">
            <button
              type="button"
              onClick={() => { setRedirectDialogArea(null); setRedirectTargetId(null); }}
              className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={redirectTargetId === null || patchCriterionAssignment.isPending}
              onClick={async () => {
                if (!redirectDialogArea || !redirectTargetId) return;
                try {
                  for (const criterionId of redirectDialogArea.criteriaIds) {
                    await patchCriterionAssignment.mutateAsync({ criterionId, assignedToId: redirectTargetId, action: "redirect" });
                  }
                  toast({ title: "Formulário redirecionado com sucesso" });
                  setRedirectDialogArea(null);
                  setRedirectTargetId(null);
                } catch (e) {
                  toast({ title: "Erro ao redirecionar", description: (e as Error).message, variant: "destructive" });
                }
              }}
              className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs disabled:opacity-50"
            >
              {patchCriterionAssignment.isPending ? "Redirecionando..." : "Confirmar Transferência"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Public link dialog — link único por formulário/área para freelancers */}
      <Dialog
        open={publicLinkDialogCriteriaIds !== null}
        onOpenChange={(v) => {
          if (!v) {
            setPublicLinkDialogCriteriaIds(null);
            setPublicLinkDialogAreaName(null);
            setPublicLinkRecipientName("");
            setPublicLinkIncludeConformity(false);
            setPublicLinkForceConformity(false);
            setGeneratedPublicUrl(null);
            setLinkCopied(false);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-xl italic uppercase font-black tracking-tight flex items-center gap-2">
              <Link2 size={18} /> Link para Freelancer
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {publicLinkDialogAreaName && (
              <div className="border-l-4 border-[#ccff00] pl-3">
                <p className="text-[10px] font-bold italic uppercase text-[#747a60]">Formulário</p>
                <p className="text-sm font-black italic uppercase">{publicLinkDialogAreaName}</p>
              </div>
            )}
            {(() => {
              // Critérios do formulário que o backend aceita num link público
              // (interseção entre os critérios da área e os elegíveis). Os que
              // ficaram de fora precisam ser respondidos pelo próprio avaliador.
              const requestedIds = publicLinkDialogCriteriaIds ?? [];
              const eligibleById = new Map((publicLinkEligibleCriteria ?? []).map(c => [c.criterionId, c]));
              const dialogEligible = requestedIds.flatMap(id => { const c = eligibleById.get(id); return c ? [c] : []; });
              const excluded = requestedIds
                .filter(id => !eligibleById.has(id))
                .map(id => activeCriteria.find(c => c.criterionId === id)?.criterionName ?? `critério #${id}`);
              if (publicLinkEligibleCriteria === undefined) return null;
              if (dialogEligible.length === 0) {
                return (
                  <div data-testid="notice-public-link-no-criteria" className="bg-[#ffdbd1] border-2 border-[#862200] px-4 py-3 flex items-start gap-2.5">
                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-[#862200]" />
                    <div className="space-y-1">
                      <p className="text-xs font-black italic uppercase text-[#862200]">Nenhum critério disponível para link</p>
                      <p className="text-xs italic text-[#5a1800] leading-snug">
                        Nenhum dos critérios deste formulário pode ser respondido por link público para este avaliador/área — em geral porque já foram submetidos ou estão atribuídos a outra pessoa. Responda os critérios diretamente nesta tela ou use "Redirecionar Formulário" para passá-los a um colega.
                      </p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3 space-y-2">
                  <div>
                    <p className="text-[10px] font-black italic uppercase text-[#747a60] mb-1">
                      Critérios inclusos ({dialogEligible.length})
                    </p>
                    <ul className="space-y-0.5">
                      {dialogEligible.map(c => (
                        <li key={c.criterionId} className="text-sm font-black italic uppercase">{c.criterionName}</li>
                      ))}
                    </ul>
                  </div>
                  {excluded.length > 0 && (
                    <div data-testid="notice-public-link-partial" className="border-t-2 border-dashed border-[#d0d3d6] pt-2">
                      <p className="text-[10px] font-black italic uppercase text-[#862200] mb-1 flex items-center gap-1">
                        <AlertCircle size={11} /> Fora do link ({excluded.length})
                      </p>
                      <ul className="space-y-0.5">
                        {excluded.map((name, i) => (
                          <li key={i} className="text-xs italic text-[#5a1800]">{name}</li>
                        ))}
                      </ul>
                      <p className="text-[10px] italic text-[#747a60] mt-1 leading-snug">
                        Estes critérios não podem ir no link (já submetidos ou atribuídos a outra pessoa) e continuam sob sua responsabilidade nesta tela.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {!generatedPublicUrl ? (
              <>
                <p className="text-sm italic text-[#444933]">
                  Gere um link único para que um freelancer responda este formulário. O link expira após o primeiro uso.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black italic uppercase mb-2">
                      Nome de quem vai receber o link
                      <span className="text-[#ba1a1a] text-[10px] ml-2 bg-[#ffdad6] px-2 py-0.5 border border-[#191c1e]">Obrigatório</span>
                    </label>
                    <input
                      type="text"
                      value={publicLinkRecipientName}
                      onChange={e => setPublicLinkRecipientName(e.target.value)}
                      placeholder="Ex: João Freelancer"
                      className="w-full border-2 border-[#191c1e] bg-white px-4 py-3 text-sm italic font-bold focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                    />
                  </div>
                  <label className={cn("flex items-start gap-2.5 select-none", publicLinkForceConformity ? "cursor-not-allowed opacity-90" : "cursor-pointer")}>
                    <input
                      type="checkbox"
                      checked={publicLinkIncludeConformity}
                      disabled={publicLinkForceConformity}
                      onChange={e => setPublicLinkIncludeConformity(e.target.checked)}
                      className="mt-0.5 w-4 h-4 border-2 border-[#191c1e] accent-[#ccff00] cursor-pointer shrink-0 disabled:cursor-not-allowed"
                    />
                    <span className="text-xs font-bold italic text-[#444933] leading-tight">
                      Incluir matriz de conformidade no questionário<br />
                      <span className="font-normal not-italic text-[#747a60]">EPI · Estaiamentos · Conduta · Faltas/Atrasos · Destaque</span>
                      {publicLinkForceConformity && (
                        <><br /><span className="font-bold not-italic text-[#506600]">Obrigatório para Cenografia — o avaliador responde critério e conformidade no mesmo formulário.</span></>
                      )}
                    </span>
                  </label>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm italic text-[#506600] font-bold">
                  Link gerado! Copie e envie para <strong>{publicLinkRecipientName}</strong>.
                </p>
                <div className="border-2 border-[#191c1e] bg-[#f2f4f6] p-3 flex items-center gap-2">
                  <span className="text-xs font-bold italic break-all flex-1 select-all">{generatedPublicUrl}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await copyToClipboard(generatedPublicUrl ?? "")) { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2500); }
                      else toast(COPY_FAILED_TOAST);
                    }}
                    className="shrink-0 bg-[#ccff00] border-2 border-[#191c1e] px-3 py-2 flex items-center gap-1.5 font-bold text-xs italic uppercase hover:bg-[#b8e800] transition-colors"
                  >
                    {linkCopied ? <><CheckCheck size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                  </button>
                </div>
                <p className="text-[11px] italic text-[#747a60]">
                  Este link é de uso único e expira após o freelancer submeter a avaliação.
                </p>
              </>
            )}

            {/* Token history */}
            {(publicTokenHistory ?? []).length > 0 && (
              <div>
                <p className="text-[10px] font-black italic uppercase text-[#747a60] mb-2">Histórico de links enviados</p>
                <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-40 overflow-y-auto">
                  {(publicTokenHistory ?? []).map(t => (
                    <div key={t.id} className="flex items-center justify-between px-3 py-2 gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold italic truncate">
                          {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
                        </p>
                        {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
                          <p className="text-[10px] italic text-[#747a60] truncate">Para: {t.recipientName}</p>
                        )}
                        <p className="text-[10px] italic text-[#9aa08a]">
                          Enviado: {fmtDT(t.createdAt)}
                        </p>
                        {t.usedAt && (
                          <p className="text-[10px] font-bold italic text-[#3f5200]">
                            Respondido: {fmtDT(t.usedAt)}
                          </p>
                        )}
                      </div>
                      {t.usedAt ? (
                        <span className="shrink-0 text-[10px] font-bold italic uppercase bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-0.5 flex items-center gap-1 mt-0.5">
                          <CheckCircle size={10} /> Respondido
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold italic uppercase bg-[#f2f4f6] text-[#747a60] border-2 border-[#191c1e] px-2 py-0.5 mt-0.5">
                            Pendente
                          </span>
                          <button
                            type="button"
                            title="Excluir link"
                            aria-label={`Excluir link enviado para ${t.recipientName ?? "destinatário sem nome"}`}
                            disabled={deletePublicToken.isPending}
                            onClick={() => deletePublicToken.mutate(
                              { tokenId: t.id },
                              { onSuccess: () => refetchTokenHistory() },
                            )}
                            className="mt-0.5 border-2 border-[#191c1e] p-0.5 hover:bg-red-100 hover:border-red-400 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={12} className="text-red-500" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setPublicLinkDialogCriteriaIds(null);
                setPublicLinkDialogAreaName(null);
                setPublicLinkRecipientName("");
                setPublicLinkIncludeConformity(false);
            setPublicLinkForceConformity(false);
                setGeneratedPublicUrl(null);
                setLinkCopied(false);
              }}
              className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
            >
              {generatedPublicUrl ? "Fechar" : "Cancelar"}
            </button>
            {!generatedPublicUrl && (() => {
              const eligibleIds = new Set((publicLinkEligibleCriteria ?? []).map(c => c.criterionId));
              const linkCriterionIds = (publicLinkDialogCriteriaIds ?? []).filter(id => eligibleIds.has(id));
              const noEligible = linkCriterionIds.length === 0;
              return (
              <button
                type="button"
                data-testid="button-generate-public-link"
                disabled={!publicLinkRecipientName.trim() || createPublicToken.isPending || noEligible}
                title={noEligible ? "Nenhum critério disponível para gerar link" : undefined}
                onClick={() => {
                  if (!publicLinkRecipientName.trim() || noEligible) return;
                  createPublicToken.mutate(
                    { recipientName: publicLinkRecipientName.trim(), criterionIds: linkCriterionIds, includeConformity: publicLinkIncludeConformity || undefined },
                    {
                      onSuccess: ({ tokenId }) => {
                        const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                        setGeneratedPublicUrl(`${base}/eval/${tokenId}`);
                        refetchTokenHistory();
                      },
                      onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
                    },
                  );
                }}
                className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createPublicToken.isPending ? "Gerando..." : "Gerar Link"}
              </button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Link Público de Conformidade (Cenografia / Ferramentas) ── */}
      <Dialog open={conformityPublicLinkType !== null} onOpenChange={o => { if (!o) { setConformityPublicLinkType(null); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); } }}>
        <DialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e] max-w-md">
          <DialogHeader>
            <DialogTitle className="italic uppercase font-black tracking-tight flex items-center gap-2">
              <Link2 size={18} />
              {conformityPublicLinkType === "cenografia" ? "Link Freelancer — Cenografia" : "Link Freelancer — Ferramentas"}
            </DialogTitle>
          </DialogHeader>

          {(() => {
            // Um link só por formulário: se já existe um pendente, mostramos o
            // MESMO link pra reenviar; se já foi respondido, não há o que gerar.
            const hist = conformityPublicLinkType === "cenografia"
              ? (conformityPublicTokenHistory ?? [])
              : (ferramentasPublicTokenHistory ?? []);
            const answered = hist.find(t => t.usedAt != null);
            const pending = hist.find(t => t.usedAt == null);
            const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
            const existingUrl = pending ? `${base}/eval/${pending.id}` : null;
            const shownUrl = generatedConformityUrl ?? existingUrl;
            return (
              <>
                <div className="space-y-4 py-2">
                  {answered ? (
                    <div className="border-2 border-[#506600] bg-[#f0fff0] p-3 flex items-start gap-2">
                      <CheckCircle size={16} className="text-[#506600] shrink-0 mt-0.5" />
                      <p className="text-xs font-bold italic text-[#506600]">
                        Formulário já respondido por <span className="uppercase">{answered.submitterName ?? answered.recipientName ?? "freelancer"}</span>
                        {answered.usedAt ? ` em ${fmtDT(answered.usedAt)}` : ""}. Não é possível gerar outro link.
                      </p>
                    </div>
                  ) : shownUrl ? (
                    <>
                      <p className="text-sm italic text-[#444933]">
                        {pending && !generatedConformityUrl
                          ? <>Já existe um link enviado para <strong>{pending.recipientName ?? "—"}</strong> aguardando resposta. Se a pessoa perdeu, copie e reenvie o mesmo link.</>
                          : "Link gerado com sucesso! Copie e envie ao freelancer."}
                      </p>
                      <div className="border-2 border-[#191c1e] bg-[#f2f4f6] px-3 py-2 flex items-center gap-2 min-w-0">
                        <span className="text-xs italic font-bold text-[#444933] truncate flex-1">{shownUrl}</span>
                        <button type="button"
                          onClick={async () => { if (await copyToClipboard(shownUrl)) { setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2500); } else toast(COPY_FAILED_TOAST); }}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black italic uppercase bg-[#ccff00] border-2 border-[#191c1e] hover:bg-[#b8e600] transition-colors"
                        >
                          <Copy size={12} />{conformityLinkCopied ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                      <p className="text-[11px] italic text-[#747a60]">
                        Este link é de uso único e expira após o freelancer submeter o formulário.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm italic text-[#444933]">
                        {conformityPublicLinkType === "cenografia"
                          ? "Gere um link único para um freelancer preencher o formulário de conformidade de Cenografia (EPI, Estaiamentos, Conduta, Ausências e Destaque). Só pode existir um link por evento."
                          : "Gere um link único para um freelancer preencher o formulário de Guarda de Equipamentos. Só pode existir um link por evento."}
                      </p>
                      <div className="space-y-2">
                        <Label className="text-xs font-black italic uppercase">Nome do destinatário</Label>
                        <input
                          type="text"
                          value={conformityPublicRecipientName}
                          onChange={e => setConformityPublicRecipientName(e.target.value)}
                          placeholder="Ex.: Fred Ribeiro"
                          className="w-full border-2 border-[#191c1e] px-4 py-2.5 text-sm italic font-bold focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                        />
                      </div>
                    </>
                  )}

                  {/* Registro do envio */}
                  {hist.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black italic uppercase text-[#747a60] mb-2">Registro</p>
                      <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-40 overflow-y-auto">
                        {hist.map(t => (
                          <div key={t.id} className="flex items-center justify-between px-3 py-2 gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold italic truncate">
                                {t.usedAt ? (t.submitterName ?? t.recipientName ?? "—") : (t.recipientName ?? "—")}
                              </p>
                              <p className="text-[10px] italic text-[#9aa08a]">
                                Enviado: {fmtDT(t.createdAt)}
                              </p>
                              {t.usedAt && (
                                <p className="text-[10px] font-bold italic text-[#3f5200]">
                                  Respondido: {fmtDT(t.usedAt)}
                                </p>
                              )}
                            </div>
                            {t.usedAt ? (
                              <span className="shrink-0 text-[10px] font-bold italic uppercase bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-0.5 flex items-center gap-1">
                                <CheckCircle size={10} /> Respondido
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-bold italic uppercase bg-[#f2f4f6] text-[#747a60] border-2 border-[#191c1e] px-2 py-0.5">
                                Pendente
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="gap-2 pt-4">
                  <button type="button"
                    onClick={() => { setConformityPublicLinkType(null); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); }}
                    className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
                  >
                    {shownUrl || answered ? "Fechar" : "Cancelar"}
                  </button>
                  {!shownUrl && !answered && (
                    <button type="button"
                      disabled={!conformityPublicRecipientName.trim() || createConformityPublicToken.isPending || createFerramentasPublicToken.isPending}
                      onClick={() => {
                        if (!conformityPublicRecipientName.trim()) return;
                        const mutation = conformityPublicLinkType === "cenografia" ? createConformityPublicToken : createFerramentasPublicToken;
                        mutation.mutate(
                          { recipientName: conformityPublicRecipientName.trim() },
                          {
                            onSuccess: ({ tokenId }) => {
                              setGeneratedConformityUrl(`${base}/eval/${tokenId}`);
                              if (conformityPublicLinkType === "cenografia") refetchConformityTokenHistory();
                              else refetchFerramentasTokenHistory();
                            },
                            onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
                          },
                        );
                      }}
                      className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs disabled:opacity-50"
                    >
                      {(createConformityPublicToken.isPending || createFerramentasPublicToken.isPending) ? "Gerando..." : "Gerar Link"}
                    </button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}
