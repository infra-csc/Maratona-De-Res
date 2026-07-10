import { useState, useEffect } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useGetEvent, useGetEventResult, useCreateEvaluation, useGetUsers, useGetEventConformity, useSetEventConformity, useRedirectConformityEvaluator, useRedirectConformityEvaluatorFerramentas, useGetUsersByArea, useGetEmployees, useAddEventParticipant, useRemoveEventParticipant, useUpdateEventParticipant, useGetAbsences, useUpdateEventAssignments, useSetConformityEvaluator, useSetConformityEvaluatorFerramentas, getGetEvaluationsQueryKey, getGetEventQueryKey, exportPendingEvaluations, getEventCriteria, getEvent, getEvaluations, createEvaluation, submitEvaluation } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Users, Download, Calendar, MapPin, Building2, Save, Flag, Target, Lock, ChevronsUpDown, Check, Info, ListChecks, User, SlidersHorizontal, ArrowRight, Rocket, CornerDownRight, ShieldAlert, Link2, Copy, CheckCheck, ChevronUp, ChevronDown, Trophy, UserPlus, UserX, UserCheck, Trash2, Loader2, X } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { cn, formatEventSubtitle } from "@/lib/utils";
import { useEventCriterionAssignments, usePatchCriterionAssignment, useRedirectOptions, useCreatePublicToken, usePublicTokens, usePublicLinkEligibleCriteria, useCreateConformityPublicToken, useCreateFerramentasPublicToken, useConformityPublicTokens, useFerramentasPublicTokens, useMyPrincipalAreas, useUsersByArea } from "@/lib/routing-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const HARD_SHADOW_HOVER = "transition-all hover:shadow-[2px_2px_0px_0px_#191c1e] hover:translate-x-[2px] hover:translate-y-[2px]";

// Funções comuns pré-definidas para o seletor de participante (mesma lista de event-detail.tsx).
const PARTICIPANT_FUNCTIONS = [
  "Cenotécnica",
  "Cenotécnica Local",
  "Cenotécnico",
  "Sup Ceno",
  "Sup Ceno Local",
  "Colaborador",
] as const;
const DEFAULT_PARTICIPANT_FUNCTION = "Cenotécnica";

/** Retorna a opção pré-definida que melhor corresponde ao functionName do colaborador. */
function matchParticipantFunction(fn?: string | null): string {
  if (!fn) return DEFAULT_PARTICIPANT_FUNCTION;
  const norm = fn.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exact = PARTICIPANT_FUNCTIONS.find(
    o => o.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === norm
  );
  if (exact) return exact;
  const prefix = PARTICIPANT_FUNCTIONS.find(
    o => norm.startsWith(o.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  );
  return prefix ?? DEFAULT_PARTICIPANT_FUNCTION;
}

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
  event, userId, selected, onSelect,
}: {
  event: { id: number; name: string; clientName?: string | null; city?: string | null; state?: string | null; cycleName?: string };
  userId: number | undefined;
  selected: boolean;
  onSelect: () => void;
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

  // Esta avaliação é por atribuição evento→área→avaliador, não pela área do perfil.
  const myAreaIds = new Set(
    (detail?.areaAssignments ?? []).filter(a => a.evaluatorUserId === userId).map(a => a.areaId),
  );
  const myCriteria = (criteria ?? []).filter(
    c => c.active && c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId),
  );
  // Only events that actually have criteria for this avaliador's area are theirs to do.
  if (myCriteria.length === 0) return null;

  const myEval = (cid: number) => (evals ?? []).find(e => e.criterionId === cid && e.evaluatorUserId === userId);
  const total = myCriteria.length;
  const submitted = myCriteria.filter(c => myEval(c.criterionId)?.status === "submitted").length;
  const drafts = myCriteria.filter(c => myEval(c.criterionId)?.status === "draft").length;
  const allSubmitted = submitted === total;
  // Submeter todos os critérios não basta: só conta como "Concluída" para o
  // avaliador depois que RH/Admin confirmar os resultados do evento (mesma
  // trava usada para colaboradores em resultados/ranking/my-performance).
  const done = allSubmitted && !!detail?.resultsConfirmed;
  const awaitingConfirmation = allSubmitted && !detail?.resultsConfirmed;
  const inProgress = !allSubmitted && (submitted > 0 || drafts > 0);

  const badge = done
    ? { label: "Concluída", cls: "bg-[#506600] text-[#ccff00]", Icon: CheckCircle }
    : awaitingConfirmation
      ? { label: "Aguardando confirmação", cls: "bg-[#fff4c2] text-[#5c4a00]", Icon: Clock }
      : inProgress
        ? { label: "Em andamento", cls: "bg-[#ffdbd1] text-[#862200]", Icon: Clock }
        : { label: "A fazer", cls: "bg-[#f2f4f6] text-[#747a60]", Icon: Clock };
  const Badge = badge.Icon;
  const pct = Math.round((submitted / total) * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`evaluator-event-${event.id}`}
      className={cn(
        "text-left border-2 border-[#191c1e] p-5 transition-all",
        HARD_SHADOW, HARD_SHADOW_HOVER,
        selected ? "bg-[#f7ffd1]" : "bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={cn("px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block", badge.cls)}>
          <span className="inline-flex items-center gap-1.5 skew-x-[8deg]"><Badge size={12} /> {badge.label}</span>
        </span>
        {event.cycleName && <span className="text-[11px] font-bold italic uppercase text-[#747a60] shrink-0">{event.cycleName}</span>}
      </div>
      <h4 className="text-lg italic uppercase font-black tracking-tight leading-tight">{event.name}</h4>
      {formatEventSubtitle(event) && <p className="text-[12px] font-bold italic uppercase text-[#747a60] mt-0.5 truncate">{formatEventSubtitle(event)}</p>}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] font-bold italic uppercase text-[#444933]">{submitted} de {total} critérios submetidos</span>
          <span className="text-xs font-black italic text-[#506600]">{pct}%</span>
        </div>
        <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2">
          <div className="bg-[#ccff00] h-full transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {drafts > 0 && (
          <p className="text-[11px] text-[#862200] italic mt-1.5 font-bold uppercase">{drafts} em rascunho — submeta para concluir</p>
        )}
      </div>
    </button>
  );
}

export default function EvaluationsPage() {
  const { user } = useAuth();
  const isManager = !!user && ["admin", "rh", "diretoria"].includes(user.role);
  const isEvaluator = user?.role === "avaliador";
  // Everyone who is not an evaluator (managers, diretoria, visualizador) is in
  // read-only consultation mode: they inspect evaluation progress, never score.
  const isConsultation = !!user && !isEvaluator;
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [selectedAvaliadorId, setSelectedAvaliadorId] = useState<number | null>(null);
  const [avaliadorPickerOpen, setAvaliadorPickerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "com-nota" | "sem-nota">("all");
  const [expandedCriteria, setExpandedCriteria] = useState<Set<number>>(new Set());
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
    absencesReport: string; standoutResponse: boolean | null; standoutJustification: string;
  }>({
    epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null,
    epiComment: '', estaiamentosComment: '', guardaEquipamentosComment: '', condutaComment: '',
    absencesReport: '', standoutResponse: null, standoutJustification: '',
  });
  const [redirectConformityOpen, setRedirectConformityOpen] = useState(false);
  const [redirectConformityTargetId, setRedirectConformityTargetId] = useState<number | null>(null);
  const [redirectFerramentasOpen, setRedirectFerramentasOpen] = useState(false);
  const [redirectFerramentasTargetId, setRedirectFerramentasTargetId] = useState<number | null>(null);

  // Equipe Alocada — edição do time direto na Central de Avaliações (admin/rh/diretoria).
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [newParticipantEmployeeId, setNewParticipantEmployeeId] = useState<number | null>(null);
  const [newParticipantFunction, setNewParticipantFunction] = useState<string>(DEFAULT_PARTICIPANT_FUNCTION);
  const [pendingRemoveParticipant, setPendingRemoveParticipant] = useState<number | null>(null);

  // Atribuição de avaliadores por área (admin/rh)
  const [assignAreaPickerOpen, setAssignAreaPickerOpen] = useState<number | null>(null);
  const [assignAreaUserIds, setAssignAreaUserIds] = useState<number[]>([]);
  // Atribuição dos avaliadores da matriz de conformidade (admin/rh)
  const [setConformityPickerOpen, setSetConformityPickerOpen] = useState(false);
  const [conformityPickerUserId, setConformityPickerUserId] = useState<number | null>(null);
  const [setFerramentasPickerOpen, setSetFerramentasPickerOpen] = useState(false);
  const [ferramentasPickerUserId, setFerramentasPickerUserId] = useState<number | null>(null);

  const { data: events } = useGetEvents({});

  // Lista global de avaliadores (independe do evento selecionado) para permitir
  // filtrar por Avaliador antes ou sem escolher um Evento.
  const { data: allUsers } = useGetUsers({
    query: { enabled: isConsultation, queryKey: ["users"] as unknown[] },
  });
  const allAvaliadores = (allUsers ?? [])
    .filter(u => u.role === "avaliador" && u.active)
    .map(u => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const { data: participants } = useGetEventParticipants(selectedEventId!, {
    query: { enabled: !!selectedEventId, queryKey: ["event-participants", selectedEventId] as unknown[] },
  });

  // Colaboradores disponíveis para adicionar à equipe (apenas gestores, ao editar o time deste evento).
  const { data: allEmployeesForTeam } = useGetEmployees({ active: true }, {
    query: { enabled: isManager && !!selectedEventId, queryKey: ["employees", "active"] as unknown[] },
  });
  const alreadyAllocatedIds = new Set((participants ?? []).map(p => p.employeeId));
  const availableEmployees = (allEmployeesForTeam ?? []).filter(e => !alreadyAllocatedIds.has(e.id));
  const selectedNewEmployee = availableEmployees.find(e => e.id === newParticipantEmployeeId);

  // Faltas/atrasos estruturados (tabela `absences`) filtrados pelo evento selecionado —
  // a API só filtra por employeeId, então filtramos por eventId no cliente.
  const { data: allAbsencesForEval } = useGetAbsences({}, {
    query: { enabled: isManager && !!selectedEventId, queryKey: ["absences-central-avaliacoes"] as unknown[] },
  });
  const eventAbsences = (allAbsencesForEval ?? []).filter(a => a.eventId === selectedEventId);

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
  // Admin/consultation view also needs conformity data (read-only) to show responses.
  const { data: adminConformityData } = useGetEventConformity(selectedEventId!, {
    query: { enabled: isConsultation && !!selectedEventId, queryKey: ["conformity-admin", selectedEventId] as unknown[] },
  });
  const conformityEvalMutation = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["event-conformity-eval", selectedEventId] });
        qc.invalidateQueries({ queryKey: ["conformity-admin", selectedEventId] });
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
  const setConformityEvaluatorMutation = useSetConformityEvaluator({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setSetConformityPickerOpen(false); toast({ title: "Avaliador da Matriz atribuído" }); },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });
  const setFerramentasEvaluatorMutation = useSetConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setSetFerramentasPickerOpen(false); toast({ title: "Avaliador de Ferramentas atribuído" }); },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });
  const updateAssignmentsMutation = useUpdateEventAssignments({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) }); setAssignAreaPickerOpen(null); toast({ title: "Atribuição salva" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
    },
  });

  // Reset expanded criteria when event changes
  useEffect(() => {
    setExpandedCriteria(new Set());
    setTypeFilter("all");
    setStatusFilter("all");
  }, [selectedEventId]);

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
        absencesReport: myConformityData.absencesReport ?? '',
        standoutResponse: myConformityData.standoutResponse ?? null,
        standoutJustification: myConformityData.standoutJustification ?? '',
      });
    } else {
      setConformityEvalForm({
        epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null,
        epiComment: '', estaiamentosComment: '', guardaEquipamentosComment: '', condutaComment: '',
        absencesReport: '', standoutResponse: null, standoutJustification: '',
      });
    }
  }, [myConformityData?.id, selectedEventId]);

  const evalsQKey = getGetEvaluationsQueryKey({ eventId: selectedEventId ?? undefined });
  const { data: evaluations } = useGetEvaluations(
    { eventId: selectedEventId ?? undefined },
    { query: { enabled: !!selectedEventId, queryKey: evalsQKey } }
  );

  const { data: eventResult } = useGetEventResult(selectedEventId!, {
    query: { enabled: !!selectedEventId && isManager, queryKey: ["event-result-eval", selectedEventId] as unknown[] },
  });

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
  const createConformityPublicToken = useCreateConformityPublicToken(selectedEventId ?? 0);
  const createFerramentasPublicToken = useCreateFerramentasPublicToken(selectedEventId ?? 0);
  const { data: publicTokenHistory, refetch: refetchTokenHistory } = usePublicTokens(
    publicLinkDialogCriteriaIds !== null ? (selectedEventId ?? null) : null,
  );
  const { data: conformityPublicTokenHistory, refetch: refetchConformityTokenHistory } = useConformityPublicTokens(
    conformityPublicLinkType === "cenografia" ? (selectedEventId ?? null) : null,
  );
  const { data: ferramentasPublicTokenHistory, refetch: refetchFerramentasTokenHistory } = useFerramentasPublicTokens(
    conformityPublicLinkType === "ferramentas" ? (selectedEventId ?? null) : null,
  );

  const createMutation = useCreateEvaluation({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: evalsQKey }),
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });

  const invalidateTeamQueries = () => {
    qc.invalidateQueries({ queryKey: ["event-participants", selectedEventId] as unknown[] });
    qc.invalidateQueries({ queryKey: getGetEventQueryKey(selectedEventId ?? 0) });
  };
  const addParticipant = useAddEventParticipant({
    mutation: {
      onSuccess: () => {
        invalidateTeamQueries();
        toast({ title: "Colaborador adicionado à equipe" });
        setAddParticipantOpen(false);
        setNewParticipantEmployeeId(null);
        setNewParticipantFunction(DEFAULT_PARTICIPANT_FUNCTION);
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
    },
  });
  const removeParticipant = useRemoveEventParticipant({
    mutation: {
      onSuccess: () => { invalidateTeamQueries(); toast({ title: "Participante removido" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
    },
  });
  const updateParticipant = useUpdateEventParticipant({
    mutation: {
      onSuccess: () => invalidateTeamQueries(),
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const activeCriteria = (criteria ?? []).filter(c => c.active);
  const activeEvents = (events ?? []).filter(e => e.status === "open" || e.status === "closed");
  // Only events whose criteria the RH has already confirmed can be evaluated.
  const configuredEvents = activeEvents.filter(e => e.criteriaConfirmed);
  // Evaluators may only act on RH-released events; consultation roles may inspect any open event.
  // Ordenado alfabeticamente por nome do evento (pt-BR, ignorando maiúsc./acentos).
  const selectableEvents = [...(isEvaluator ? configuredEvents : activeEvents)].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" })
  );
  const pickedEvent = selectableEvents.find(e => e.id === selectedEventId);

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
  const relevantEvaluatorEvents = isEvaluator
    ? configuredEvents.filter((_, i) => {
        const myAreaIds = new Set(
          (evaluatorEventDetailQueries[i]?.data?.areaAssignments ?? [])
            .filter(a => a.evaluatorUserId === user?.id)
            .map(a => a.areaId),
        );
        const hasCriteria = (evaluatorCriteriaQueries[i]?.data ?? []).some(
          c => c.active && c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId),
        );
        const isConformityEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorUserId === user?.id;
        const isFerramentasEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorFerramentasUserId === user?.id;
        return hasCriteria || isConformityEval || isFerramentasEval;
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
        const myAreaIds = new Set(
          (evaluatorEventDetailQueries[i]?.data?.areaAssignments ?? [])
            .filter(a => a.evaluatorUserId === user?.id)
            .map(a => a.areaId),
        );
        const myCrit = (evaluatorCriteriaQueries[i]?.data ?? []).filter(
          c => c.active && c.responsibleAreaId != null && myAreaIds.has(c.responsibleAreaId),
        );
        const evs = evaluatorEvalQueries[i]?.data ?? [];
        const submitted = myCrit.filter(
          c => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === user?.id)?.status === "submitted",
        ).length;
        const total = myCrit.length;
        // Só conta como concluído para o avaliador depois que os resultados do
        // evento forem confirmados por RH/Admin — enviar tudo não basta.
        const isConformityEval = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorUserId === user?.id;
        const isFerramentasEval2 = evaluatorEventDetailQueries[i]?.data?.conformityEvaluatorFerramentasUserId === user?.id;
        return { event: ev, total, submitted, done: total > 0 && submitted === total && !!ev.resultsConfirmed, relevant: total > 0 || isConformityEval || isFerramentasEval2 };
      }).filter(s => s.relevant)
    : [];
  const todoEvents = evaluatorEventStats.filter(s => !s.done).map(s => s.event);
  const doneEvents = evaluatorEventStats.filter(s => s.done).map(s => s.event);

  // Consultation mode: when a manager picks an Avaliador WITHOUT picking an
  // Evento, the filter must still return something — a cross-event overview
  // of that avaliador's assigned events, instead of the generic empty state.
  // Same query-key pattern as the evaluator overview above (deduped/cached).
  // Also activates with NO avaliador picked as long as Status is narrowed to
  // Pendentes/Avaliadas — otherwise that filter had zero visible effect
  // (the generic "Pronto para consultar" empty state ignored it entirely).
  const crossEventLookupActive = isConsultation && !selectedEventId && (selectedAvaliadorId != null || statusFilter !== "all");
  const crossEventCriteriaQueries = useQueries({
    queries: crossEventLookupActive
      ? activeEvents.map(ev => ({
          queryKey: ["event-criteria", ev.id] as unknown[],
          queryFn: () => getEventCriteria(ev.id),
        }))
      : [],
  });
  const crossEventDetailQueries = useQueries({
    queries: crossEventLookupActive
      ? activeEvents.map(ev => ({
          queryKey: getGetEventQueryKey(ev.id),
          queryFn: () => getEvent(ev.id),
        }))
      : [],
  });
  const crossEventEvalQueries = useQueries({
    queries: crossEventLookupActive
      ? activeEvents.map(ev => ({
          queryKey: getGetEvaluationsQueryKey({ eventId: ev.id }),
          queryFn: () => getEvaluations({ eventId: ev.id }),
        }))
      : [],
  });
  const crossEventAvaliadorStats = crossEventLookupActive
    ? activeEvents.map((ev, i) => {
        const detail = crossEventDetailQueries[i]?.data;
        const evs = crossEventEvalQueries[i]?.data ?? [];
        const critAll = (crossEventCriteriaQueries[i]?.data ?? []).filter(
          c => c.active && c.responsibleAreaId != null,
        );
        if (selectedAvaliadorId != null) {
          const areaIds = new Set(
            (detail?.areaAssignments ?? [])
              .filter(a => a.evaluatorUserId === selectedAvaliadorId)
              .map(a => a.areaId),
          );
          const crit = critAll.filter(c => areaIds.has(c.responsibleAreaId!));
          const submitted = crit.filter(
            c => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === selectedAvaliadorId)?.status === "submitted",
          ).length;
          const total = crit.length;
          // Mesma trava: consulta de RH/gestores também só marca como concluído
          // depois que os resultados do evento forem confirmados.
          return { event: ev, total, submitted, done: total > 0 && submitted === total && !!ev.resultsConfirmed, relevant: total > 0 };
        }
        // Sem avaliador selecionado: agrega TODOS os avaliadores designados —
        // um critério só conta como concluído quando TODOS os avaliadores da
        // área confirmaram (mesma regra de completude usada no evento aberto).
        const evaluatorIdsByArea = new Map<number, number[]>();
        for (const a of (detail?.areaAssignments ?? [])) {
          if (a.evaluatorUserId == null) continue;
          const list = evaluatorIdsByArea.get(a.areaId);
          if (list) list.push(a.evaluatorUserId);
          else evaluatorIdsByArea.set(a.areaId, [a.evaluatorUserId]);
        }
        const crit = critAll.filter(c => (evaluatorIdsByArea.get(c.responsibleAreaId!) ?? []).length > 0);
        const submitted = crit.filter(c => {
          const assignedIds = evaluatorIdsByArea.get(c.responsibleAreaId!) ?? [];
          return assignedIds.every(uid => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === uid)?.status === "submitted");
        }).length;
        const total = crit.length;
        return { event: ev, total, submitted, done: total > 0 && submitted === total && !!ev.resultsConfirmed, relevant: total > 0 };
      }).filter(s => s.relevant)
    : [];
  const crossEventAvaliadorFiltered = statusFilter === "all"
    ? crossEventAvaliadorStats
    : crossEventAvaliadorStats.filter(s => (statusFilter === "done" ? s.done : !s.done));
  const crossEventAvaliadorEntries = [...crossEventAvaliadorFiltered]
    .sort((a, b) => (a.event.name ?? "").localeCompare(b.event.name ?? "", "pt-BR", { sensitivity: "base" }));
  const crossEventAvaliadorEvents = crossEventAvaliadorEntries.map(s => s.event);
  const selectedAvaliadorName = allAvaliadores.find(a => a.id === selectedAvaliadorId)?.name ?? null;

  // If the selected event stops being selectable (closed or criteria unconfirmed
  // server-side), clear the selection so trigger text and loaded data stay in sync.
  useEffect(() => {
    if (selectedEventId == null || !events) return;
    const stillValid = events.some(e => e.id === selectedEventId && (e.status === "open" || e.status === "closed") && (isEvaluator ? e.criteriaConfirmed : true));
    if (!stillValid) { setSelectedEventId(null); setScores({}); setComments({}); setAudioOverrides({}); setSelectedAvaliadorId(null); setStatusFilter("all"); }
  }, [selectedEventId, events, isEvaluator]);
  const canRelease = isManager;
  const eventComplete = eventResult?.isComplete ?? false;
  const feedbackReleased = eventResult?.feedbackReleased ?? false;

  const currentEvent = events?.find(e => e.id === selectedEventId);
  const criteriaLocked = currentEvent ? !currentEvent.criteriaConfirmed : false;

  // Avaliadores only see/evaluate the areas assigned to them FOR THIS EVENT
  // (atribuição evento→área→avaliador), not the fixed profile area.
  const myAssignedAreaIds = new Set(
    (selectedEventDetail?.areaAssignments ?? [])
      .filter(a => a.evaluatorUserId === user?.id)
      .map(a => a.areaId),
  );
  // Also include criteria directly assigned to this user via the routing system
  const myDirectCriterionIds = new Set(
    (criterionAssignments ?? [])
      .filter(a => a.assignedToId === user?.id && (a.status === "confirmed" || a.status === "suggested"))
      .map(a => a.criterionId),
  );
  const myCriteria = activeCriteria.filter(c =>
    (c.responsibleAreaId != null && myAssignedAreaIds.has(c.responsibleAreaId)) ||
    myDirectCriterionIds.has(c.criterionId),
  );

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

  // Avaliadores atribuídos a cada área (evento → área → avaliador[]); pode haver
  // mais de um por área — a nota final é a média entre eles.
  const assignedEvaluatorsByArea = new Map<number, { id: number; name: string }[]>();
  for (const a of (selectedEventDetail?.areaAssignments ?? [])) {
    if (a.evaluatorUserId == null) continue;
    const list = assignedEvaluatorsByArea.get(a.areaId) ?? [];
    list.push({ id: a.evaluatorUserId, name: a.evaluatorName ?? "Sem nome" });
    assignedEvaluatorsByArea.set(a.areaId, list);
  }

  // Áreas únicas com critérios ativos neste evento — usadas na UI de atribuição de avaliadores.
  const eventAreasForAssignment = Array.from(
    new Map(
      activeCriteria
        .filter(c => c.responsibleAreaId != null)
        .map(c => [c.responsibleAreaId!, { id: c.responsibleAreaId!, name: c.responsibleAreaName ?? "Sem área" }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  // Manager-only oversight: per-criterion submission status ("quem preencheu / quem falta").
  // "submitted" só quando TODOS os avaliadores designados para a área enviaram;
  // "partial" cobre o caso de 1 de N já ter enviado.
  type CriterionUiStatus = {
    state: "submitted" | "partial" | "draft" | "pending";
    submittedNames: string[];
    pendingNames: string[];
    requiredCount: number;
    submittedCount: number;
  };
  function criterionStatus(criterionId: number, responsibleAreaId: number | null): CriterionUiStatus {
    const evs = (evaluations ?? []).filter(e => e.criterionId === criterionId);
    const assigned = responsibleAreaId != null ? (assignedEvaluatorsByArea.get(responsibleAreaId) ?? []) : [];
    const evalByEvaluator = new Map(evs.filter(e => e.evaluatorUserId != null).map(e => [e.evaluatorUserId as number, e]));
    if (assigned.length > 0) {
      const submitted = assigned.filter(a => evalByEvaluator.get(a.id)?.status === "submitted");
      const drafted = assigned.filter(a => evalByEvaluator.get(a.id)?.status === "draft");
      const pending = assigned.filter(a => !submitted.includes(a));
      const state: CriterionUiStatus["state"] = submitted.length === assigned.length
        ? "submitted"
        : submitted.length > 0
          ? "partial"
          : drafted.length > 0
            ? "draft"
            : "pending";
      return { state, submittedNames: submitted.map(a => a.name), pendingNames: pending.map(a => a.name), requiredCount: assigned.length, submittedCount: submitted.length };
    }
    // Sem atribuição configurada para a área: cai no fallback "qualquer envio conta" (espelha o backend).
    const submitted = evs.find(e => e.status === "submitted");
    if (submitted) return { state: "submitted", submittedNames: [submitted.evaluatorName ?? "—"], pendingNames: [], requiredCount: 1, submittedCount: 1 };
    const draft = evs.find(e => e.status === "draft");
    if (draft) return { state: "draft", submittedNames: [], pendingNames: [], requiredCount: 1, submittedCount: 0 };
    return { state: "pending", submittedNames: [], pendingNames: [], requiredCount: 1, submittedCount: 0 };
  }

  function groupByArea(list: typeof activeCriteria) {
    return Object.values(
      list.reduce((acc, c) => {
        const key = c.responsibleAreaName ?? "Sem área definida";
        (acc[key] ??= { area: key, criteria: [] as typeof activeCriteria }).criteria.push(c);
        return acc;
      }, {} as Record<string, { area: string; criteria: typeof activeCriteria }>)
    );
  }
  const areaGroups = groupByArea(activeCriteria);

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

  const teamSubmittedCount = activeCriteria.filter(c => criterionStatus(c.criterionId, c.responsibleAreaId ?? null).state === "submitted").length;
  const teamProgressPct = activeCriteria.length ? (teamSubmittedCount / activeCriteria.length) * 100 : 0;

  // Avaliadores atribuídos ao evento (evento → área → avaliador), com status
  // agregado (Pendente/Concluído) para permitir consultar/filtrar por pessoa.
  const avaliadorMap = new Map<number, { id: number; name: string; areaIds: Set<number> }>();
  for (const a of (selectedEventDetail?.areaAssignments ?? [])) {
    if (a.evaluatorUserId == null) continue;
    const existing = avaliadorMap.get(a.evaluatorUserId);
    if (existing) existing.areaIds.add(a.areaId);
    else avaliadorMap.set(a.evaluatorUserId, { id: a.evaluatorUserId, name: a.evaluatorName ?? "Sem nome", areaIds: new Set([a.areaId]) });
  }
  // Progresso POR avaliador: conta apenas as submissões DELE, não a completude
  // agregada do critério (que pode exigir outro avaliador da mesma área).
  const avaliadorStats = Array.from(avaliadorMap.values())
    .map(av => {
      const crit = activeCriteria.filter(c => c.responsibleAreaId != null && av.areaIds.has(c.responsibleAreaId));
      const submitted = crit.filter(c =>
        (evaluations ?? []).some(e => e.criterionId === c.criterionId && e.evaluatorUserId === av.id && e.status === "submitted")
      ).length;
      const total = crit.length;
      return { ...av, total, submitted, done: total > 0 && submitted === total };
    })
    .filter(av => av.total > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

  const selectedAvaliador = avaliadorStats.find(av => av.id === selectedAvaliadorId) ?? null;
  // Com avaliador selecionado, "avaliado" = submissão DELE; sem seleção, usa a
  // completude agregada do critério (todos os designados da área enviaram).
  const isCriterionDone = (c: (typeof activeCriteria)[number]) =>
    selectedAvaliador
      ? (evaluations ?? []).some(e => e.criterionId === c.criterionId && e.evaluatorUserId === selectedAvaliador.id && e.status === "submitted")
      : criterionStatus(c.criterionId, c.responsibleAreaId ?? null).state === "submitted";
  const avaliadorFilteredCriteria = selectedAvaliador
    ? activeCriteria.filter(c => c.responsibleAreaId != null && selectedAvaliador.areaIds.has(c.responsibleAreaId))
    : activeCriteria;
  const statusFilteredCriteria = statusFilter === "all"
    ? avaliadorFilteredCriteria
    : avaliadorFilteredCriteria.filter(c => (statusFilter === "done" ? isCriterionDone(c) : !isCriterionDone(c)));
  const typeFilteredCriteria = typeFilter === "all"
    ? statusFilteredCriteria
    : typeFilter === "com-nota"
      ? statusFilteredCriteria.filter(c => getSubmittedEvals(c.criterionId).length > 0)
      : statusFilteredCriteria.filter(c => getSubmittedEvals(c.criterionId).length === 0);
  const filteredAreaGroups = groupByArea(typeFilteredCriteria);

  function getEval(criterionId: number) {
    return (evaluations ?? []).find(e => e.criterionId === criterionId && e.evaluatorUserId === user?.id);
  }

  function getSubmittedEvals(criterionId: number) {
    return (evaluations ?? []).filter(e => e.criterionId === criterionId && e.status === "submitted");
  }

  function toggleExpand(criterionId: number) {
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      next.has(criterionId) ? next.delete(criterionId) : next.add(criterionId);
      return next;
    });
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
    try {
      for (const c of myCriteria) {
        const ev = getEval(c.criterionId);
        if (ev?.status === "submitted") continue;
        const score = currentScore(c.criterionId);
        if (score == null) continue;
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
      toast({ title: "Erro ao lançar avaliação", description: ((e as { message?: string })?.message ?? "") + " Confira o que ficou pendente e tente novamente.", variant: "destructive" });
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

  const completedCount = myCriteria.filter(c => {
    const ev = getEval(c.criterionId);
    return ev && (ev.status === "submitted" || ev.status === "draft");
  }).length;

  // Beyond the scored criteria, avaliadores da Matriz de Conformidade also
  // answer extra Sim/Não questions (Ferramentas e Case / Cenografia). Those
  // must count toward "Resumo da Avaliação" too, or the sidebar undercounts
  // this evaluator's real workload for the event.
  const extraConformityItemsTotal =
    (isFerramentasEvaluatorForEvent ? 1 : 0) +
    (isConformityEvaluatorForEvent ? 4 : 0);
  const extraConformityItemsCompleted =
    (isFerramentasEvaluatorForEvent && conformityEvalForm.guardaEquipamentos !== null ? 1 : 0) +
    (isConformityEvaluatorForEvent
      ? [conformityEvalForm.epi, conformityEvalForm.estaiamentos, conformityEvalForm.conduta, conformityEvalForm.standoutResponse]
          .filter(v => v !== null).length
      : 0);

  const totalItems = myCriteria.length + extraConformityItemsTotal;
  const totalCompleted = completedCount + extraConformityItemsCompleted;

  const progressPct = totalItems ? (totalCompleted / totalItems) * 100 : 0;

  async function handleExportPending() {
    try {
      const data = await exportPendingEvaluations();
      const blob = new Blob([data.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename;
      a.click();
    } catch {
      toast({ title: "Erro ao exportar", variant: "destructive" });
    }
  }

  const renderEventPicker = (compact: boolean) => (
    <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={eventPickerOpen}
          data-testid="select-event"
          disabled={selectableEvents.length === 0}
          className={`${compact ? "w-full md:w-[20rem] min-h-[3rem] px-3 py-2" : "w-full min-h-[3.25rem] px-4 py-3"} flex items-center justify-between gap-3 text-left border-2 border-[#191c1e] bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#f7f9fb] ${HARD_SHADOW}`}
        >
          {pickedEvent ? (
            <span className="flex flex-col min-w-0">
              <span className="font-black italic uppercase text-sm leading-tight text-[#191c1e]">{pickedEvent.name}</span>
              {formatEventSubtitle(pickedEvent) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] truncate">{formatEventSubtitle(pickedEvent)}</span>}
            </span>
          ) : (
            <span className="font-bold italic uppercase text-xs tracking-wider text-[#747a60] truncate">
              {selectableEvents.length === 0
                ? (isConsultation ? "Nenhum evento disponível" : "Nenhum evento disponível")
                : (isConsultation ? "Selecione um evento para consultar..." : (compact ? "Selecionar evento..." : "Selecione um evento para avaliar..."))}
            </span>
          )}
          <ChevronsUpDown size={compact ? 16 : 18} className="shrink-0 text-[#191c1e]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={compact ? "end" : "start"} className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
        <Command className="rounded-none">
          <CommandInput data-testid="input-event-search" placeholder="Buscar por evento ou cliente..." className="italic" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum evento encontrado.</CommandEmpty>
            <CommandGroup>
              {selectableEvents.map(ev => (
                <CommandItem
                  key={ev.id}
                  value={`${ev.name} ${ev.clientName} ${ev.city} ${ev.state}`}
                  data-testid={`option-event-${ev.id}`}
                  onSelect={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); setEventPickerOpen(false); }}
                  className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3 items-start"
                >
                  <Check size={16} className={cn("mt-0.5 shrink-0", selectedEventId === ev.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex flex-col min-w-0">
                    <span className="font-black italic uppercase text-sm leading-tight whitespace-normal">{ev.name}</span>
                    {formatEventSubtitle(ev) && <span className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-normal">{formatEventSubtitle(ev)}</span>}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const labels: Record<number, string> = {
    0: "Crítico, não atendeu ao básico",
    10: "Perfeição, atendeu completamente e sem erros",
  };

  return (
    <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div className="p-6 md:p-10 space-y-10">
        {/* Page header */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-8 border-[#ccff00] pl-6 py-1">
          <div>
            <h1 data-testid="text-page-title" className="text-4xl md:text-5xl italic uppercase tracking-tighter font-black leading-none">Central de Avaliações</h1>
            <p className="text-base md:text-lg text-[#444933] italic mt-2">{isConsultation ? "Consulte o andamento das avaliações de cada evento em tempo real." : "Mantenha o ritmo. Avalie a sprint e impulsione a equipe."}</p>
          </div>
          {isManager && (
            <button
              data-testid="button-export-pending"
              onClick={handleExportPending}
              className={`bg-[#ccff00] border-2 border-[#191c1e] px-6 py-4 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
            >
              <Download size={18} /> Exportar Pendentes
            </button>
          )}
          {isEvaluator && (
            <div className="flex flex-col gap-1 md:items-end">
              <span className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] px-1">Selecionar evento</span>
              {renderEventPicker(true)}
            </div>
          )}
        </section>

        {/* STEP 01 — Filtros (managers/consultation pick from the full panel) */}
        {!isEvaluator && (
        <section className="bg-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1.5 bg-[#ccff00] border-l-2 border-b-2 border-[#191c1e] text-[10px] font-black italic uppercase tracking-wider">ETAPA 01</div>
          <div className="flex items-start justify-between gap-4 mb-1">
            <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">{isConsultation ? "Filtros" : "Selecionar Evento"}</h3>
            {isConsultation && (selectedEventId != null || selectedAvaliadorId != null || statusFilter !== "all" || typeFilter !== "all") && (
              <button
                type="button"
                data-testid="button-clear-filters"
                onClick={() => { setSelectedEventId(null); setSelectedAvaliadorId(null); setStatusFilter("all"); setTypeFilter("all"); }}
                className="shrink-0 mt-1 flex items-center gap-1.5 text-[11px] font-black italic uppercase tracking-wider text-[#862200] hover:underline"
              >
                <X size={13} /> Limpar filtros
              </button>
            )}
          </div>
          <p className="text-sm text-[#444933] italic mb-5">{isConsultation ? "Selecione o evento e refine a consulta por avaliador ou status." : "Busque pelo nome do evento ou do cliente e selecione para iniciar a avaliação."}</p>

          <div className={cn("grid grid-cols-1 gap-4", isConsultation && "md:grid-cols-3")}>
            <div>
              {isConsultation && (
                <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                  <Calendar size={12} /> Evento
                </p>
              )}
              {renderEventPicker(false)}
            </div>

            {isConsultation && (
              <>
                <div>
                  <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                    <User size={12} /> Avaliador
                  </p>
                  {(() => {
                    const avaliadorOptions = selectedEventId && avaliadorStats.length > 0
                      ? avaliadorStats.map(av => ({ id: av.id, name: av.name, suffix: `${av.submitted}/${av.total}` }))
                      : allAvaliadores.map(av => ({ id: av.id, name: av.name, suffix: null as string | null }));
                    const pickedAvaliador = avaliadorOptions.find(av => av.id === selectedAvaliadorId);
                    return (
                      <Popover open={avaliadorPickerOpen} onOpenChange={setAvaliadorPickerOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            role="combobox"
                            aria-expanded={avaliadorPickerOpen}
                            data-testid="select-avaliador"
                            className="w-full h-[3.25rem] px-4 flex items-center justify-between gap-3 text-left border-2 border-[#191c1e] bg-white italic font-bold text-xs uppercase transition-all hover:bg-[#f7f9fb] disabled:opacity-50"
                          >
                            <span className="truncate text-[#191c1e]">
                              {pickedAvaliador ? `${pickedAvaliador.name}${pickedAvaliador.suffix ? ` (${pickedAvaliador.suffix})` : ""}` : "Todos os avaliadores"}
                            </span>
                            <ChevronsUpDown size={16} className="shrink-0 text-[#191c1e]" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                          <Command className="rounded-none">
                            <CommandInput data-testid="input-avaliador-search" placeholder="Buscar avaliador..." className="italic" />
                            <CommandList className="max-h-[320px]">
                              <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum avaliador encontrado.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="Todos os avaliadores"
                                  data-testid="option-avaliador-all"
                                  onSelect={() => { setSelectedAvaliadorId(null); setAvaliadorPickerOpen(false); }}
                                  className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3"
                                >
                                  <Check size={16} className={cn("shrink-0", selectedAvaliadorId == null ? "opacity-100" : "opacity-0")} />
                                  <span className="font-bold italic uppercase text-xs">Todos os avaliadores</span>
                                </CommandItem>
                                {avaliadorOptions.map(av => (
                                  <CommandItem
                                    key={av.id}
                                    value={av.name}
                                    data-testid={`option-avaliador-${av.id}`}
                                    onSelect={() => { setSelectedAvaliadorId(av.id); setAvaliadorPickerOpen(false); }}
                                    className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2.5 gap-3"
                                  >
                                    <Check size={16} className={cn("shrink-0", selectedAvaliadorId === av.id ? "opacity-100" : "opacity-0")} />
                                    <span className="font-bold italic uppercase text-xs truncate">{av.name}{av.suffix ? ` (${av.suffix})` : ""}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>

                <div>
                  <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                    <ListChecks size={12} /> Status
                  </p>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as "all" | "pending" | "done")}
                  >
                    <SelectTrigger data-testid="select-status-filter" className="h-[3.25rem] rounded-none border-2 border-[#191c1e] bg-white italic font-bold text-xs uppercase focus:ring-0 disabled:opacity-50">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-2 border-[#191c1e]">
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="done">Avaliadas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isConsultation && (
                  <div>
                    <p className="text-[10px] font-black italic uppercase tracking-wider text-[#747a60] mb-1.5 flex items-center gap-1.5">
                      <Target size={12} /> Tipo
                    </p>
                    <Select
                      value={typeFilter}
                      onValueChange={(v) => setTypeFilter(v as "all" | "com-nota" | "sem-nota")}
                    >
                      <SelectTrigger className="h-[3.25rem] rounded-none border-2 border-[#191c1e] bg-white italic font-bold text-xs uppercase focus:ring-0">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-2 border-[#191c1e]">
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="com-nota">Com nota</SelectItem>
                        <SelectItem value="sem-nota">Sem nota (falta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
            <Info size={16} className="shrink-0 mt-0.5 text-[#444933]" />
            <p className="text-[11px] md:text-xs font-bold italic uppercase tracking-wide text-[#444933]">
              {isConsultation
                ? "Modo consulta: acompanhe o status de cada avaliação por evento, sem editar notas."
                : "Apenas eventos já configurados e liberados pelo RH aparecem nesta lista."}
            </p>
          </div>
        </section>
        )}

        {/* Evaluator overview — pending vs completed evaluations at a glance */}
        {isEvaluator && (
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <ListChecks size={22} />
              <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">Minhas Avaliações</h3>
            </div>
            <p className="text-sm text-[#444933] italic px-1 -mt-1">
              Foque no que ainda falta avaliar. As avaliações concluídas ficam na aba ao lado. Clique em um evento para avaliar ou rever.
            </p>
            {configuredEvents.length === 0 ? (
              <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                Nenhum evento liberado para avaliação no momento.
              </div>
            ) : relevantEvaluatorEvents.length === 0 ? (
              <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                Nenhuma avaliação atribuída à sua área nos eventos abertos no momento.
              </div>
            ) : (
              <Tabs defaultValue="todo" className="space-y-4">
                <TabsList className="bg-transparent p-0 h-auto gap-2 justify-start rounded-none">
                  <TabsTrigger
                    value="todo"
                    data-testid="tab-todo"
                    className="rounded-none border-2 border-[#191c1e] bg-white px-4 py-2 font-black italic uppercase text-xs tracking-wider data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none"
                  >
                    A Fazer ({todoEvents.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="done"
                    data-testid="tab-done"
                    className="rounded-none border-2 border-[#191c1e] bg-white px-4 py-2 font-black italic uppercase text-xs tracking-wider data-[state=active]:bg-[#ccff00] data-[state=active]:text-[#161e00] data-[state=active]:shadow-none"
                  >
                    Concluídas ({doneEvents.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="todo" className="mt-0">
                  {todoEvents.length === 0 ? (
                    <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                      Tudo em dia! Nenhuma avaliação pendente no momento.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {todoEvents.map(ev => (
                        <EvaluatorEventCard
                          key={ev.id}
                          event={ev}
                          userId={user?.id}
                          selected={selectedEventId === ev.id}
                          onSelect={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="done" className="mt-0">
                  {doneEvents.length === 0 ? (
                    <div className="text-center py-10 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                      Nenhuma avaliação concluída ainda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {doneEvents.map(ev => (
                        <EvaluatorEventCard
                          key={ev.id}
                          event={ev}
                          userId={user?.id}
                          selected={selectedEventId === ev.id}
                          onSelect={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </section>
        )}

        {isEvaluator && selectedEventId && !!myPrincipalAreas && myPrincipalAreas.length > 0 && (() => {
          const principalAreaIds = new Set(myPrincipalAreas.map(a => a.id));
          const areaCriteria = (criterionAssignments ?? []).filter(a => a.criterionAreaId != null && principalAreaIds.has(a.criterionAreaId));
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
                          <td className="px-4 py-3 text-right">
                            {isSubmitted ? (
                              <span className="text-[11px] italic text-[#747a60]">—</span>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                {!isMine && (
                                  <button
                                    type="button"
                                    data-testid={`button-take-criterion-${a.criterionId}`}
                                    onClick={() => patchCriterionAssignment.mutate(
                                      { criterionId: a.criterionId, assignedToId: user!.id, action: "assign" },
                                      { onError: (e) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }) },
                                    )}
                                    className="text-[11px] font-black italic uppercase border-2 border-[#191c1e] px-2 py-1 hover:bg-[#ccff00]"
                                  >
                                    Pegar para mim
                                  </button>
                                )}
                                <button
                                  type="button"
                                  data-testid={`button-assign-criterion-${a.criterionId}`}
                                  onClick={() => setAreaAssignTarget({ criterionId: a.criterionId, criterionName: a.criterionName ?? "", areaId: a.criterionAreaId! })}
                                  className="text-[11px] font-black italic uppercase border-2 border-[#191c1e] px-2 py-1 hover:bg-[#eceef0]"
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

        {!selectedEventId && crossEventLookupActive ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <User size={22} />
              <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight">
                {selectedAvaliadorName ? `Avaliações de ${selectedAvaliadorName}` : "Avaliações — Todos os Avaliadores"}
              </h3>
            </div>
            <p className="text-sm text-[#444933] italic px-1 -mt-1">
              {selectedAvaliadorName
                ? "Todos os eventos com avaliações atribuídas a este avaliador. Clique em um evento para consultar os critérios em detalhe."
                : "Eventos filtrados pelo status selecionado, considerando todos os avaliadores. Clique em um evento para consultar os critérios em detalhe."}
            </p>
            {crossEventAvaliadorEntries.length === 0 ? (
              <div className="text-center py-24 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60] px-6">
                {statusFilter === "pending"
                  ? `Nenhuma avaliação pendente${selectedAvaliadorName ? ` para ${selectedAvaliadorName}` : ""}.`
                  : statusFilter === "done"
                    ? `Nenhuma avaliação concluída${selectedAvaliadorName ? ` para ${selectedAvaliadorName}` : ""}.`
                    : `Nenhum evento com avaliações atribuídas${selectedAvaliadorName ? ` a ${selectedAvaliadorName}` : ""}.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {crossEventAvaliadorEntries.map(({ event: ev, total, submitted, done }) => (
                  <button
                    key={ev.id}
                    type="button"
                    data-testid={`card-cross-event-${ev.id}`}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`text-left bg-white border-2 border-[#191c1e] p-5 transition-all hover:bg-[#f7f9fb] ${HARD_SHADOW} ${HARD_SHADOW_HOVER}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="font-black italic uppercase text-sm leading-tight">{ev.name}</span>
                      {done ? (
                        <CheckCircle size={16} className="shrink-0 text-[#506600]" />
                      ) : (
                        <span className="shrink-0 text-[9px] font-black italic uppercase text-[#862200] tracking-wide">pendente</span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold italic uppercase text-[#747a60]">{ev.clientName}</p>
                    <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2 mt-3 mb-1.5">
                      <div className="bg-[#ccff00] h-full" style={{ width: `${total ? (submitted / total) * 100 : 0}%` }} />
                    </div>
                    <p className="text-[11px] text-[#747a60] italic">{submitted} de {total} critérios preenchidos.</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : !selectedEventId ? (
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-[#191c1e] bg-white">
            <div className="w-16 h-16 border-2 border-[#191c1e] bg-[#ccff00] flex items-center justify-center mb-4 skew-x-[-6deg]">
              <CheckCircle className="text-[#161e00] skew-x-[6deg]" size={32} />
            </div>
            <h2 className="text-2xl italic uppercase font-black tracking-tight mb-2">{isConsultation ? "Pronto para consultar" : "Pronto para avaliar"}</h2>
            <p className="text-[#444933] italic max-w-md">{isConsultation ? "Selecione um evento no menu acima para consultar o andamento das avaliações da equipe." : "Selecione um evento no menu acima para iniciar ou continuar a avaliação da equipe responsável."}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Header Card */}
            {currentEvent && (
              <section className={`bg-[#191c1e] text-white border-2 border-[#191c1e] p-6 md:p-8 relative overflow-hidden ${HARD_SHADOW}`}>
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Users size={120} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col md:flex-row justify-between gap-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-[#ccff00] text-[#161e00] px-3 py-1 border-2 border-[#ccff00] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                        <span className="inline-block skew-x-[8deg]">Aberto</span>
                      </span>
                      {currentEvent.cycleName && (
                        <span className="bg-transparent text-white px-3 py-1 border-2 border-white/30 font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block">
                          <span className="inline-block skew-x-[8deg]">{currentEvent.cycleName}</span>
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl md:text-4xl italic uppercase font-black tracking-tighter leading-none mb-1">{currentEvent.name}</h2>
                    <p className="text-[#ccff00] font-bold italic uppercase text-lg">{currentEvent.clientName}</p>

                    <div className="flex flex-wrap items-center gap-6 mt-6 text-sm text-white/70 italic">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        <span>{new Date(currentEvent.startDate).toLocaleDateString('pt-BR')} — {new Date(currentEvent.endDate).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {(currentEvent.city || currentEvent.location) && (
                        <div className="flex items-center gap-2">
                          <MapPin size={16} />
                          <span>{currentEvent.city ? `${currentEvent.city}${currentEvent.state ? `, ${currentEvent.state}` : ""}` : currentEvent.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>{currentEvent.participantCount} participantes</span>
                      </div>
                    </div>
                  </div>

                  {isManager && (
                    <div className="flex flex-col justify-end">
                      <div className="bg-black/30 border-2 border-white/20 p-4 w-full md:w-64">
                        <p className="text-xs text-white/80 font-bold italic uppercase mb-2">Progresso Geral (Todo o time)</p>
                        <div className="flex items-center justify-between mb-1 text-xs italic font-bold">
                          <span>{Math.round(teamProgressPct)}% Concluído</span>
                        </div>
                        <div className="w-full bg-black/40 border border-white/20 h-2.5">
                          <div className="bg-[#ccff00] h-full transition-[width]" style={{ width: `${teamProgressPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Criteria Column / Evaluation Form */}
              <div className="space-y-4">
                <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight px-1 flex items-center gap-2">
                  {isConsultation ? (<><ListChecks size={22} /> Status das Avaliações</>) : "Critérios de Avaliação"}
                </h3>

                {isConsultation ? (
                  filteredAreaGroups.length === 0 ? (
                    <div className="text-center py-12 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60]">
                      {statusFilter === "pending"
                        ? "Nenhuma avaliação pendente com os filtros atuais."
                        : statusFilter === "done"
                          ? "Nenhuma avaliação concluída com os filtros atuais."
                          : selectedAvaliador
                            ? "Este avaliador não tem critérios atribuídos neste evento."
                            : "Nenhum critério ativo neste evento."}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {criteriaLocked && (
                        <div className="flex items-start gap-2.5 bg-[#fff4e5] border-2 border-[#191c1e] px-4 py-3">
                          <Lock size={16} className="shrink-0 mt-0.5 text-[#b02f00]" />
                          <p className="text-[11px] md:text-xs font-bold italic uppercase tracking-wide text-[#b02f00]">Critérios ainda não confirmados — as áreas não podem avaliar até a liberação.</p>
                        </div>
                      )}
                      {/* Atribuição de Avaliadores por Área */}
                      {isManager && (
                        <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                          <div className="flex items-center gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                            <span className="inline-flex items-center gap-2 font-black italic uppercase tracking-tight">
                              <Target size={16} className="shrink-0" /> Atribuição de Avaliadores
                            </span>
                          </div>
                          {eventAreasForAssignment.length === 0 ? (
                            <div className="py-8 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhuma área com critérios ativos neste evento.</div>
                          ) : (
                            <ul className="divide-y-2 divide-[#eceef0]">
                              {eventAreasForAssignment.map(area => {
                                const assigned = assignedEvaluatorsByArea.get(area.id) ?? [];
                                const isEditingThis = assignAreaPickerOpen === area.id;
                                return (
                                  <li key={area.id} className="px-5 py-3 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Building2 size={13} className="shrink-0 text-[#747a60]" />
                                        <span className="font-black italic uppercase text-sm text-[#191c1e] truncate">{area.name}</span>
                                      </div>
                                      {!isEditingThis && (
                                        <button
                                          type="button"
                                          onClick={() => { setAssignAreaPickerOpen(area.id); setAssignAreaUserIds(assigned.map(a => a.id)); }}
                                          className="flex items-center gap-1.5 px-2.5 py-1 border-2 border-[#191c1e] bg-white hover:bg-[#f2f4f6] transition-colors text-[11px] font-black uppercase tracking-tight shrink-0"
                                        >
                                          <UserPlus size={13} /> Alterar
                                        </button>
                                      )}
                                    </div>
                                    {!isEditingThis && (
                                      <div className="flex flex-wrap gap-1.5 pl-5">
                                        {assigned.length === 0 ? (
                                          <span className="text-[11px] italic font-bold uppercase text-[#9aa088]">Sem avaliador atribuído</span>
                                        ) : assigned.map(a => (
                                          <span key={a.id} className="inline-flex items-center gap-1 text-[10px] font-black italic uppercase bg-[#f2f4f6] border-2 border-[#191c1e] px-2 py-0.5">
                                            <User size={10} /> {a.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {isEditingThis && (
                                      <div className="pl-5 space-y-2">
                                        <div className="max-h-48 overflow-y-auto space-y-0.5 border-2 border-[#191c1e] p-2 bg-[#f9fafb]">
                                          {allAvaliadores.length === 0 && (
                                            <p className="text-[11px] italic text-[#9aa088] px-2 py-1">Nenhum avaliador cadastrado.</p>
                                          )}
                                          {allAvaliadores.map(av => {
                                            const checked = assignAreaUserIds.includes(av.id);
                                            return (
                                              <label key={av.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-[#f2f4f6] px-2 py-1.5">
                                                <input
                                                  type="checkbox"
                                                  checked={checked}
                                                  onChange={() => setAssignAreaUserIds(prev => checked ? prev.filter(id => id !== av.id) : [...prev, av.id])}
                                                  className="w-3.5 h-3.5 accent-[#506600]"
                                                />
                                                <span className="text-[12px] font-bold italic uppercase text-[#191c1e]">{av.name}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            disabled={updateAssignmentsMutation.isPending}
                                            onClick={() => updateAssignmentsMutation.mutate({ id: selectedEventId!, data: { assignments: [{ areaId: area.id, evaluatorUserIds: assignAreaUserIds }] } })}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#ccff00] bg-[#191c1e] text-[#ccff00] hover:bg-[#ccff00] hover:text-[#191c1e] transition-colors text-[11px] font-black uppercase tracking-tight disabled:opacity-50"
                                          >
                                            <Save size={13} /> Salvar
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setAssignAreaPickerOpen(null)}
                                            className="px-3 py-1.5 border-2 border-[#191c1e] bg-white text-[#191c1e] hover:bg-[#f2f4f6] transition-colors text-[11px] font-black uppercase tracking-tight"
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Matriz de Conformidade + Perguntas de Evento */}
                      {isConsultation && !!selectedEventId && (
                        <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                            <span className="inline-flex items-center gap-2 font-black italic uppercase tracking-tight">
                              <ShieldAlert size={16} className="shrink-0" /> Matriz de Conformidade
                            </span>
                            <span className="text-[10px] font-black italic uppercase text-[#747a60] bg-white border border-[#d8dadc] px-2 py-0.5">4 critérios</span>
                          </div>
                          <div className="divide-y-2 divide-[#eceef0]">

                            {/* Avaliadores designados — atribuição pelo admin/rh */}
                            {isManager && (
                              <div className="px-5 py-4 space-y-4">
                                <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#444933]">Avaliadores Designados</p>

                                {/* Cenografia */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold italic uppercase text-[#191c1e]">Cenografia</span>
                                    <button
                                      type="button"
                                      onClick={() => { setSetConformityPickerOpen(v => !v); setSetFerramentasPickerOpen(false); }}
                                      className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#191c1e] bg-white hover:bg-[#f2f4f6] text-[11px] font-black uppercase shrink-0"
                                    >
                                      <UserPlus size={11} /> Atribuir
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 pl-0.5">
                                    <User size={11} className="shrink-0 text-[#747a60]" />
                                    <span className="text-[11px] italic text-[#444933]">
                                      {selectedEventDetail?.conformityEvaluatorName ?? <span className="text-[#9aa088]">Sem avaliador atribuído</span>}
                                    </span>
                                  </div>
                                  {setConformityPickerOpen && (
                                    <div className="border-2 border-[#191c1e] bg-[#f9fafb] max-h-44 overflow-y-auto">
                                      <button
                                        type="button"
                                        onClick={() => setConformityEvaluatorMutation.mutate({ id: selectedEventId!, data: { userId: null } })}
                                        className="w-full text-left px-3 py-2 text-[11px] font-bold italic uppercase text-[#9aa088] hover:bg-[#f2f4f6] border-b border-[#eceef0]"
                                      >
                                        — Remover atribuição
                                      </button>
                                      {allAvaliadores.map(av => (
                                        <button
                                          key={av.id}
                                          type="button"
                                          onClick={() => setConformityEvaluatorMutation.mutate({ id: selectedEventId!, data: { userId: av.id } })}
                                          className={cn("w-full text-left px-3 py-2 text-[11px] font-bold italic uppercase hover:bg-[#f2f4f6] border-b border-[#eceef0] last:border-b-0 flex items-center justify-between gap-2", av.id === selectedEventDetail?.conformityEvaluatorUserId ? "text-[#506600] bg-[#f7ffe0]" : "text-[#191c1e]")}
                                        >
                                          {av.name}
                                          {av.id === selectedEventDetail?.conformityEvaluatorUserId && <CheckCircle size={11} className="shrink-0 text-[#506600]" />}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Ferramentas e Case */}
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-bold italic uppercase text-[#191c1e]">Ferramentas e Case</span>
                                    <button
                                      type="button"
                                      onClick={() => { setSetFerramentasPickerOpen(v => !v); setSetConformityPickerOpen(false); }}
                                      className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#191c1e] bg-white hover:bg-[#f2f4f6] text-[11px] font-black uppercase shrink-0"
                                    >
                                      <UserPlus size={11} /> Atribuir
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 pl-0.5">
                                    <User size={11} className="shrink-0 text-[#747a60]" />
                                    <span className="text-[11px] italic text-[#444933]">
                                      {selectedEventDetail?.conformityEvaluatorFerramentasName ?? <span className="text-[#9aa088]">Sem avaliador atribuído</span>}
                                    </span>
                                  </div>
                                  {setFerramentasPickerOpen && (
                                    <div className="border-2 border-[#191c1e] bg-[#f9fafb] max-h-44 overflow-y-auto">
                                      <button
                                        type="button"
                                        onClick={() => setFerramentasEvaluatorMutation.mutate({ id: selectedEventId!, data: { userId: null } })}
                                        className="w-full text-left px-3 py-2 text-[11px] font-bold italic uppercase text-[#9aa088] hover:bg-[#f2f4f6] border-b border-[#eceef0]"
                                      >
                                        — Remover atribuição
                                      </button>
                                      {allAvaliadores.map(av => (
                                        <button
                                          key={av.id}
                                          type="button"
                                          onClick={() => setFerramentasEvaluatorMutation.mutate({ id: selectedEventId!, data: { userId: av.id } })}
                                          className={cn("w-full text-left px-3 py-2 text-[11px] font-bold italic uppercase hover:bg-[#f2f4f6] border-b border-[#eceef0] last:border-b-0 flex items-center justify-between gap-2", av.id === selectedEventDetail?.conformityEvaluatorFerramentasUserId ? "text-[#506600] bg-[#f7ffe0]" : "text-[#191c1e]")}
                                        >
                                          {av.name}
                                          {av.id === selectedEventDetail?.conformityEvaluatorFerramentasUserId && <CheckCircle size={11} className="shrink-0 text-[#506600]" />}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Respostas dos 4 critérios de matriz */}
                            <div className="px-5 py-4">
                              <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#444933] mb-3">Respostas da Matriz</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                  { label: "EPI", val: adminConformityData?.epi, comment: adminConformityData?.epiComment },
                                  { label: "Estaiamentos/Aterramento", val: adminConformityData?.estaiamentos, comment: adminConformityData?.estaiamentosComment },
                                  { label: "Conduta", val: adminConformityData?.conduta, comment: adminConformityData?.condutaComment },
                                  { label: "Guarda de Equipamentos", val: adminConformityData?.guardaEquipamentos, comment: adminConformityData?.guardaEquipamentosComment },
                                ].map(item => (
                                  <div key={item.label} className="border-2 border-[#eceef0] p-3">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="text-[11px] font-bold italic uppercase text-[#191c1e]">{item.label}</span>
                                      <span className={`text-[10px] font-black italic uppercase px-2 py-0.5 border shrink-0 ${item.val === null || item.val === undefined ? "bg-[#d8dadc] text-[#444933] border-[#c0c4c8]" : item.val ? "bg-[#ccff00] text-[#161e00] border-[#506600]" : "bg-[#ff5722] text-white border-[#8b1a00]"}`}>
                                        {item.val === null || item.val === undefined ? "—" : item.val ? "SIM" : "NÃO"}
                                      </span>
                                    </div>
                                    {item.comment && item.val === false && (
                                      <p className="text-[11px] italic text-[#444933] leading-snug">{item.comment}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Faltas/Atrasos */}
                            <div className="px-5 py-4">
                              <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#444933] mb-2 flex items-center gap-1.5">
                                <Clock size={12} /> Faltas/Atrasos (+30 min)
                              </p>
                              {eventAbsences.length > 0 && (
                                <ul className="space-y-1.5 mb-2">
                                  {eventAbsences.map(a => (
                                    <li key={a.id} className="flex items-center justify-between gap-2 border-2 border-[#eceef0] px-3 py-1.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <User size={11} className="shrink-0 text-[#747a60]" />
                                        <span className="font-black italic uppercase text-xs text-[#191c1e] truncate">{a.employeeName ?? "—"}</span>
                                        <span className="text-[10px] font-bold italic uppercase text-[#747a60] shrink-0">
                                          {a.penaltyType}{a.quantity && a.quantity > 1 ? ` ×${a.quantity}` : ""}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-black italic text-[#b02f00] shrink-0">-{Number(a.points)} pts</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {adminConformityData?.absencesReport ? (
                                <p className="text-sm italic text-[#191c1e] leading-relaxed whitespace-pre-wrap border-l-2 border-[#b02f00] pl-3">{adminConformityData.absencesReport}</p>
                              ) : eventAbsences.length === 0 ? (
                                <p className="text-[11px] italic text-[#9aa088]">Nenhuma falta ou atraso registrada.</p>
                              ) : null}
                            </div>

                            {/* Destaque de Desempenho */}
                            <div className="px-5 py-4">
                              <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#444933] mb-2 flex items-center gap-1.5">
                                <Trophy size={12} /> Destaque de Desempenho
                              </p>
                              {adminConformityData?.standoutResponse === true && adminConformityData.standoutJustification ? (
                                <div className="border-2 border-[#506600] bg-[#f7ffe0] p-3">
                                  <p className="text-sm italic text-[#191c1e] leading-relaxed whitespace-pre-wrap">{adminConformityData.standoutJustification}</p>
                                </div>
                              ) : adminConformityData?.standoutResponse === false ? (
                                <p className="text-[11px] italic text-[#9aa088]">Nenhum destaque registrado.</p>
                              ) : (
                                <p className="text-[11px] italic text-[#9aa088]">Ainda não respondido.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {filteredAreaGroups.map(g => {
                        const submittedInArea = g.criteria.filter(c => isCriterionDone(c)).length;
                        const areaDone = submittedInArea === g.criteria.length;
                        return (
                          <div key={g.area} data-testid={`status-area-${g.area}`} className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                              <span className="inline-flex items-center gap-2 font-black italic uppercase tracking-tight min-w-0 truncate pr-1.5">
                                <Building2 size={16} className="shrink-0" /> {g.area}
                              </span>
                              <span className={cn("px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block shrink-0", areaDone ? "bg-[#506600] text-[#ccff00]" : "bg-[#ffb5a0] text-[#3b0900]")}>
                                <span className="inline-block skew-x-[8deg]">{submittedInArea}/{g.criteria.length} {areaDone ? "Concluído" : "Pendente"}</span>
                              </span>
                            </div>
                            <ul>
                              {g.criteria.map(c => {
                                const st = criterionStatus(c.criterionId, c.responsibleAreaId ?? null);
                                const assignedNames = c.responsibleAreaId != null ? (assignedEvaluatorsByArea.get(c.responsibleAreaId) ?? []).map(a => a.name) : [];
                                const responsible = assignedNames.length > 0 ? assignedNames.join(", ") : (st.submittedNames[0] ?? null);
                                const submittedEvals = getSubmittedEvals(c.criterionId);
                                const isExpanded = expandedCriteria.has(c.criterionId);
                                const hasContent = submittedEvals.length > 0;
                                return (
                                  <li key={c.criterionId} data-testid={`status-crit-${c.criterionId}`} className="border-t-2 border-[#eceef0] first:border-t-0">
                                    {/* Status row */}
                                    <div className="flex items-center justify-between gap-3 px-5 py-3">
                                      <button
                                        type="button"
                                        onClick={() => hasContent && toggleExpand(c.criterionId)}
                                        className={`flex items-center gap-2 min-w-0 text-left ${hasContent ? "cursor-pointer group" : "cursor-default"}`}
                                      >
                                        {hasContent && (
                                          isExpanded
                                            ? <ChevronUp size={14} className="shrink-0 text-[#747a60] group-hover:text-[#191c1e]" />
                                            : <ChevronDown size={14} className="shrink-0 text-[#747a60] group-hover:text-[#191c1e]" />
                                        )}
                                        <span className="font-bold italic text-[#191c1e] min-w-0 truncate">{c.criterionName}</span>
                                        <span className="text-[11px] font-bold italic uppercase text-[#d8dadc] bg-[#f2f4f6] border border-[#d8dadc] px-1.5 py-0.5 shrink-0">
                                          Peso {c.weightOverride ?? c.originalWeight ?? 0}
                                        </span>
                                        {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && (
                                          <span className="text-[9px] font-black italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-1.5 py-0.5 shrink-0">
                                            Não conta na média
                                          </span>
                                        )}
                                      </button>
                                      <span className="shrink-0 flex items-center gap-2">
                                        <span data-testid={`status-responsible-${c.criterionId}`} className="text-[11px] font-bold italic uppercase text-[#747a60] whitespace-nowrap hidden sm:inline-flex items-center gap-1 pr-0.5">
                                          <User size={11} className="shrink-0" /> {responsible ?? "Sem responsável"}
                                        </span>
                                        {(() => {
                                          const a = criterionAssignments?.find(x => x.criterionId === c.criterionId);
                                          if (!a?.redirectedFromId) return null;
                                          const date = a.updatedAt
                                            ? new Date(a.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                                            : null;
                                          return (
                                            <span
                                              title={`Redirecionado de ${a.redirectedFromName ?? "?"} para ${a.assignedToName ?? "?"}${date ? ` em ${date}` : ""}`}
                                              className="hidden md:inline-flex items-center gap-1 text-[10px] font-bold italic uppercase bg-[#e8f0fe] text-[#3451b2] border border-[#3451b2] px-1.5 py-0.5 shrink-0"
                                            >
                                              <CornerDownRight size={10} /> {a.redirectedFromName?.split(" ")[0] ?? "?"}→{a.assignedToName?.split(" ")[0] ?? "?"}{date ? ` · ${date}` : ""}
                                            </span>
                                          );
                                        })()}
                                        {st.state === "submitted" ? (
                                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ccff00] text-[#161e00] border-2 border-[#191c1e] px-2 py-1"><CheckCircle size={12} /> Preenchido</span>
                                        ) : st.state === "partial" ? (
                                          <span data-testid={`status-partial-${c.criterionId}`} title={`Falta: ${st.pendingNames.join(", ")}`} className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#fff4c2] text-[#5c4a00] border-2 border-[#191c1e] px-2 py-1"><Clock size={12} /> {st.submittedCount}/{st.requiredCount} Parcial</span>
                                        ) : st.state === "draft" ? (
                                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#ffdbd1] text-[#862200] border-2 border-[#191c1e] px-2 py-1"><Clock size={12} /> Rascunho</span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold italic uppercase bg-[#f2f4f6] text-[#747a60] border-2 border-[#191c1e] px-2 py-1"><Clock size={12} /> Falta</span>
                                        )}
                                        {hasContent && (
                                          <Link
                                            href="/calibrations"
                                            title="Ir para Calibração deste critério"
                                            className="inline-flex items-center gap-1 text-[11px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1 hover:bg-[#506600] transition-colors shrink-0"
                                          >
                                            <SlidersHorizontal size={11} /> Cal.
                                          </Link>
                                        )}
                                      </span>
                                    </div>
                                    {/* Expanded: score + comment per evaluator */}
                                    {isExpanded && hasContent && (
                                      <div className="bg-[#f7f9fb] border-t-2 border-[#eceef0] px-5 py-4 space-y-3">
                                        {submittedEvals.map((ev, i) => (
                                          <div key={i} className="border-2 border-[#e0e3e5] bg-white p-3 space-y-2">
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="text-[11px] font-bold italic uppercase text-[#747a60] flex items-center gap-1">
                                                <User size={11} /> {ev.evaluatorName ?? "Avaliador"}
                                              </span>
                                              <div className="flex items-center gap-2">
                                                {ev.score != null && (
                                                  <span className="text-xl font-black italic text-[#506600]">
                                                    {parseFloat(ev.score as unknown as string).toFixed(1)}
                                                    <span className="text-[11px] text-[#747a60]">/10</span>
                                                  </span>
                                                )}
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold italic uppercase bg-[#ccff00] text-[#161e00] border border-[#191c1e] px-1.5 py-0.5">
                                                  <CheckCircle size={10} /> Enviado
                                                </span>
                                              </div>
                                            </div>
                                            {ev.comments && (
                                              <p className="text-xs italic text-[#444933] leading-relaxed border-l-2 border-[#ccff00] pl-3 whitespace-pre-wrap">
                                                {ev.comments}
                                              </p>
                                            )}
                                            {ev.audioUrl && (
                                              <div className="pt-1">
                                                <AudioPlayer objectPath={ev.audioUrl} />
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : criteriaLocked ? (
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
                                      onClick={() => { setPublicLinkDialogCriteriaIds(areaEligible); setPublicLinkDialogAreaName(g.areaName); setPublicLinkRecipientName(""); setGeneratedPublicUrl(null); setLinkCopied(false); refetchTokenHistory(); }}
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
                                  {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && (
                                    <span className="bg-[#ffdbd1] border-2 border-[#862200] text-[#862200] px-2 py-0.5 text-[11px] font-black italic uppercase">Peso 0 — não conta na média</span>
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
                                    onClick={() => handleSaveDraft(c.criterionId)}
                                    disabled={score == null || !comment.trim()}
                                    data-testid={`button-save-draft-${c.criterionId}`}
                                    className="bg-white border-2 border-[#191c1e] px-4 py-2 font-bold text-xs italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                                  >
                                    <Save size={14} />
                                    {isDraft ? "Atualizar Rascunho" : "Salvar Rascunho"}
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
                const canSave = true;
                return (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 px-1">
                      <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                        <ShieldAlert size={22} /> Ferramentas e Case (Cenografia)
                      </h3>
                      <div className="flex items-center gap-2 shrink-0 pt-1">
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
                        <button type="button"
                          onClick={() => { setConformityPublicLinkType("ferramentas"); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); refetchFerramentasTokenHistory(); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors"
                          title="Gerar link único para um freelancer responder o formulário de Ferramentas"
                        >
                          <Link2 size={12} /> Link Freelancer
                        </button>
                      </div>
                    </div>
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
                            <label className="text-[10px] font-bold italic uppercase text-[#747a60]">Comentário <span className="font-normal normal-case">(opcional)</span></label>
                            <Textarea
                              placeholder={isNao ? "Descreva o que aconteceu com os equipamentos/ferramentas..." : "Alguma observação? (opcional)"}
                              value={conformityEvalForm.guardaEquipamentosComment}
                              onChange={e => setConformityEvalForm(f => ({ ...f, guardaEquipamentosComment: e.target.value }))}
                              className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[72px]"
                            />
                          </div>
                        )}
                      </div>
                      {/* Save comment */}
                      {val !== null && (
                        <div className="px-5 py-3 bg-[#f2f4f6] border-t-2 border-[#eceef0] flex items-center justify-between gap-3">
                          <span className="text-[10px] font-bold italic uppercase text-[#747a60]">Salvar observação</span>
                          <button type="button" disabled={!canSave || conformityEvalMutation.isPending}
                            onClick={() => { if (selectedEventId && canSave) conformityEvalMutation.mutate({ id: selectedEventId, data: { guardaEquipamentosComment: conformityEvalForm.guardaEquipamentosComment } }, { onSuccess: () => toast({ title: "Observação salva" }) }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] disabled:opacity-40 hover:bg-[#333] transition-colors"
                          >{conformityEvalMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar</button>
                        </div>
                      )}
                    </div>
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
                const canSaveTexts = !standoutNeedsJustification;
                const filledCount = cenografiaItems.filter(i => conformityEvalForm[i.key] !== null).length;
                return (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3 px-1">
                      <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                        <ShieldAlert size={22} /> Cenografia
                      </h3>
                      <div className="flex items-center gap-2 shrink-0 pt-1">
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
                        <button type="button"
                          onClick={() => { setConformityPublicLinkType("cenografia"); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); refetchConformityTokenHistory(); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors"
                          title="Gerar link único para um freelancer responder o formulário de Cenografia"
                        >
                          <Link2 size={12} /> Link Freelancer
                        </button>
                      </div>
                    </div>
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
                                  <label className="text-[10px] font-bold italic uppercase text-[#747a60]">Comentário <span className="font-normal normal-case">(opcional)</span></label>
                                  <Textarea
                                    placeholder={isNao ? `Descreva o que aconteceu com ${item.label.toLowerCase()}...` : "Alguma observação? (opcional)"}
                                    value={conformityEvalForm[item.commentKey]}
                                    onChange={e => setConformityEvalForm(f => ({ ...f, [item.commentKey]: e.target.value }))}
                                    className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[64px]"
                                  />
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

                    {/* Absences text field */}
                    <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                      <div className="px-5 py-4 space-y-2">
                        <label className="block text-sm font-black italic uppercase text-[#191c1e]">Alguém faltou ou atrasou por mais de 30 minutos?</label>
                        <p className="text-[11px] text-[#747a60] italic">Especifique nomes e motivo. Se ninguém faltou, deixe em branco.</p>
                        <Textarea
                          placeholder="Ex.: João Silva — faltou sem aviso. Maria Souza — 45 min de atraso por trânsito."
                          value={conformityEvalForm.absencesReport}
                          onChange={e => setConformityEvalForm(f => ({ ...f, absencesReport: e.target.value }))}
                          className="rounded-none border-2 border-[#191c1e] text-sm italic resize-none min-h-[72px]"
                        />
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

                    {/* Save text fields button */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-[#747a60] italic">Salva justificativas, ausências e destaque.</span>
                      <button type="button" disabled={!canSaveTexts || conformityEvalMutation.isPending}
                        onClick={() => {
                          if (!selectedEventId || !canSaveTexts) return;
                          const payload: Record<string, unknown> = { absencesReport: conformityEvalForm.absencesReport || null, standoutResponse: conformityEvalForm.standoutResponse, standoutJustification: conformityEvalForm.standoutJustification || null };
                          cenografiaItems.forEach(item => { payload[item.commentKey] = conformityEvalForm[item.commentKey] || null; });
                          conformityEvalMutation.mutate(
                            { id: selectedEventId, data: payload as Parameters<typeof conformityEvalMutation.mutate>[0]["data"] },
                            { onSuccess: () => toast({ title: "Observações salvas" }) },
                          );
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-black italic uppercase bg-[#191c1e] text-[#ccff00] disabled:opacity-40 hover:bg-[#333] transition-colors"
                      ><Save size={14} /> Salvar observações</button>
                    </div>

                  </div>
                );
              })()}

              {/* Right Sticky Panel */}
              <div className="sticky top-6 space-y-6">
                <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                  <div className="bg-[#191c1e] text-[#ccff00] px-5 py-4 italic">
                    <h3 className="text-lg font-black uppercase tracking-tight">{isConsultation ? "Status do Time" : "Resumo da Avaliação"}</h3>
                    <p className="text-[11px] font-bold uppercase text-white/70">{isConsultation ? "Acompanhamento da equipe" : "Sua avaliação para este evento"}</p>
                  </div>

                  <div className="p-5 border-b-2 border-[#eceef0]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold italic uppercase text-[#444933]">Progresso</span>
                      <span className="text-sm font-black italic text-[#506600]">{Math.round(isConsultation ? teamProgressPct : progressPct)}%</span>
                    </div>
                    <div className="w-full bg-[#eceef0] border border-[#191c1e] h-2.5 mb-2">
                      <div className="bg-[#ccff00] h-full transition-[width] duration-500" style={{ width: `${isConsultation ? teamProgressPct : progressPct}%` }} />
                    </div>
                    <p className="text-[11px] text-[#747a60] italic">
                      {isConsultation
                        ? `${teamSubmittedCount} de ${activeCriteria.length} critérios submetidos pelo time.`
                        : extraConformityItemsTotal > 0
                          ? `${totalCompleted} de ${totalItems} itens preenchidos — ${completedCount} de ${myCriteria.length} critérios e ${extraConformityItemsCompleted} de ${extraConformityItemsTotal} perguntas da matriz (rascunho ou submetido).`
                          : `${completedCount} de ${myCriteria.length} critérios preenchidos (rascunho ou submetido).`}
                    </p>
                  </div>

                  {/* Confidential administrative info — managers only */}
                  {isManager && (
                    <div className="p-5 bg-[#f2f4f6] space-y-4 border-b-2 border-[#eceef0]">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold italic uppercase text-[#444933]">Equipe</span>
                        <span className="text-sm font-black italic">{participants?.length || 0} pessoas</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold italic uppercase text-[#444933]">Critérios Pendentes</span>
                        <span className="text-sm font-black italic text-[#b02f00]">{activeCriteria.length - teamSubmittedCount}</span>
                      </div>
                      {eventResult && (
                        <div className="pt-2 border-t-2 border-[#e0e3e5] space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-black italic uppercase">Nota Parcial da Equipe</span>
                            <div className="text-right">
                              <span className="text-xl font-black italic text-[#506600]">{eventResult.eventScore.toFixed(1)}</span>
                              <span className="text-xs text-[#747a60] italic">/100</span>
                            </div>
                          </div>
                          {!eventResult.hasCalibration && (
                            <p className="text-[10px] font-bold italic uppercase tracking-wide text-[#b02f00] leading-tight">
                              Provisória — antes da calibração. O valor final do colaborador sai após a calibração.
                            </p>
                          )}
                        </div>
                      )}
                      {/* Indicadores rápidos de conformidade */}
                      {adminConformityData && (
                        <div className="pt-2 border-t-2 border-[#e0e3e5] space-y-2">
                          {adminConformityData.standoutResponse === true && (
                            <div className="flex items-center gap-2 text-[11px] font-bold italic uppercase text-[#506600] bg-[#f7ffe0] border border-[#506600] px-3 py-2">
                              <Trophy size={13} className="shrink-0" />
                              <span>Destaque de desempenho registrado</span>
                            </div>
                          )}
                          {adminConformityData.absencesReport && (
                            <div className="flex items-center gap-2 text-[11px] font-bold italic uppercase text-[#b02f00] bg-[#fff4e5] border border-[#b02f00] px-3 py-2">
                              <Clock size={13} className="shrink-0" />
                              <span>Faltas/atrasos registrados</span>
                            </div>
                          )}
                          {[adminConformityData.epi, adminConformityData.estaiamentos, adminConformityData.conduta, adminConformityData.guardaEquipamentos].some(v => v === false) && (
                            <div className="flex items-center gap-2 text-[11px] font-bold italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-3 py-2">
                              <ShieldAlert size={13} className="shrink-0" />
                              <span>Não-conformidade na matriz</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Grade summary — evaluators only. Includes both scored
                      criteria AND the extra Sim/Não questions from the
                      Matriz de Conformidade (Ferramentas e Case / Cenografia),
                      so nothing an avaliador has to fill out is left off the
                      summary. */}
                  {isEvaluator && (myCriteria.length > 0 || extraConformityItemsTotal > 0) && (
                    <div className="p-5 border-b-2 border-[#eceef0]">
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
                              {" "}<strong>{pickedEvent?.name}</strong>. Após o lançamento, as notas ficam
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

                {/* Release Feedback Card (Admin only) */}
                {canRelease && eventComplete && (
                  <div className="bg-white border-2 border-dashed border-[#191c1e] p-5">
                    <h4 className="text-xs font-black italic uppercase flex items-center gap-2 mb-2"><Target size={14} /> Ação de Gestão</h4>
                    {feedbackReleased ? (
                      <div className="flex items-center gap-2 text-sm text-[#506600] font-bold italic uppercase">
                        <CheckCircle size={16} /> Feedback liberado para a equipe
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-[#506600] font-bold italic uppercase">
                          <CheckCircle size={16} /> Liberado para calibragem
                        </div>
                        <p className="text-xs text-[#747a60] italic">
                          {eventResult?.hasCalibration
                            ? "Todas as avaliações foram concluídas e a calibragem já está em andamento. Acesse a tela de Calibrações para revisar e finalizar as notas da equipe."
                            : "Todas as avaliações foram concluídas. O evento foi liberado para calibragem — acesse a tela de Calibrações para ajustar as notas antes de liberar o feedback à equipe."}
                        </p>
                        <Link
                          href="/calibrations"
                          data-testid="link-go-to-calibrations"
                          className="w-full bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] py-3 font-bold text-sm italic uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:bg-[#2a2f33]"
                        >
                          <SlidersHorizontal size={15} /> Ir para Calibrações <ArrowRight size={15} />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
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
              const dialogEligible = (publicLinkEligibleCriteria ?? []).filter(c =>
                (publicLinkDialogCriteriaIds ?? []).includes(c.criterionId)
              );
              return dialogEligible.length > 0 ? (
                <div className="bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                  <p className="text-[10px] font-black italic uppercase text-[#747a60] mb-1">
                    Critérios inclusos ({dialogEligible.length})
                  </p>
                  <ul className="space-y-0.5">
                    {dialogEligible.map(c => (
                      <li key={c.criterionId} className="text-sm font-black italic uppercase">{c.criterionName}</li>
                    ))}
                  </ul>
                </div>
              ) : null;
            })()}

            {!generatedPublicUrl ? (
              <>
                <p className="text-sm italic text-[#444933]">
                  Gere um link único para que um freelancer responda este formulário. O link expira após o primeiro uso.
                </p>
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
                    onClick={() => {
                      navigator.clipboard.writeText(generatedPublicUrl ?? "");
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2500);
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
                        <p className="text-xs font-bold italic truncate">{t.recipientName ?? "—"}</p>
                        <p className="text-[10px] italic text-[#747a60]">
                          Enviado {new Date(t.createdAt ?? "").toLocaleDateString("pt-BR")}
                        </p>
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
            <button
              type="button"
              onClick={() => {
                setPublicLinkDialogCriteriaIds(null);
                setPublicLinkDialogAreaName(null);
                setPublicLinkRecipientName("");
                setGeneratedPublicUrl(null);
                setLinkCopied(false);
              }}
              className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
            >
              {generatedPublicUrl ? "Fechar" : "Cancelar"}
            </button>
            {!generatedPublicUrl && (
              <button
                type="button"
                disabled={!publicLinkRecipientName.trim() || createPublicToken.isPending}
                onClick={() => {
                  if (!publicLinkRecipientName.trim()) return;
                  createPublicToken.mutate(
                    { recipientName: publicLinkRecipientName.trim(), criterionIds: publicLinkDialogCriteriaIds ?? undefined },
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
                className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs disabled:opacity-50"
              >
                {createPublicToken.isPending ? "Gerando..." : "Gerar Link"}
              </button>
            )}
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

          <div className="space-y-4 py-2">
            <p className="text-sm italic text-[#444933]">
              {conformityPublicLinkType === "cenografia"
                ? "Gere um link único de uso único para um freelancer preencher o formulário de conformidade de Cenografia (EPI, Estaiamentos, Conduta, Ausências e Destaque)."
                : "Gere um link único de uso único para um freelancer preencher o formulário de Guarda de Equipamentos."}
            </p>

            {!generatedConformityUrl ? (
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
            ) : (
              <>
                <div className="border-2 border-[#506600] bg-[#f0fff0] p-3 flex items-start gap-2">
                  <CheckCircle size={16} className="text-[#506600] shrink-0 mt-0.5" />
                  <p className="text-xs font-bold italic text-[#506600]">Link gerado com sucesso! Copie e envie ao freelancer.</p>
                </div>
                <div className="border-2 border-[#191c1e] bg-[#f2f4f6] px-3 py-2 flex items-center gap-2 min-w-0">
                  <span className="text-xs italic font-bold text-[#444933] truncate flex-1">{generatedConformityUrl}</span>
                  <button type="button"
                    onClick={() => { navigator.clipboard.writeText(generatedConformityUrl); setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2500); }}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black italic uppercase bg-[#ccff00] border-2 border-[#191c1e] hover:bg-[#b8e600] transition-colors"
                  >
                    <Copy size={12} />{conformityLinkCopied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <p className="text-[11px] italic text-[#747a60]">
                  Este link é de uso único e expira após o freelancer submeter o formulário.
                </p>
              </>
            )}

            {/* Histórico de tokens */}
            {(() => {
              const hist = conformityPublicLinkType === "cenografia"
                ? (conformityPublicTokenHistory ?? [])
                : (ferramentasPublicTokenHistory ?? []);
              if (hist.length === 0) return null;
              return (
                <div>
                  <p className="text-[10px] font-black italic uppercase text-[#747a60] mb-2">Histórico de links enviados</p>
                  <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-40 overflow-y-auto">
                    {hist.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-3 py-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold italic truncate">{t.recipientName ?? "—"}</p>
                          <p className="text-[10px] italic text-[#747a60]">
                            Enviado {new Date(t.createdAt ?? "").toLocaleDateString("pt-BR")}
                          </p>
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
              );
            })()}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <button type="button"
              onClick={() => { setConformityPublicLinkType(null); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); }}
              className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
            >
              {generatedConformityUrl ? "Fechar" : "Cancelar"}
            </button>
            {!generatedConformityUrl && (
              <button type="button"
                disabled={!conformityPublicRecipientName.trim() || createConformityPublicToken.isPending || createFerramentasPublicToken.isPending}
                onClick={() => {
                  if (!conformityPublicRecipientName.trim()) return;
                  const mutation = conformityPublicLinkType === "cenografia" ? createConformityPublicToken : createFerramentasPublicToken;
                  mutation.mutate(
                    { recipientName: conformityPublicRecipientName.trim() },
                    {
                      onSuccess: ({ tokenId }) => {
                        const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
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
        </DialogContent>
      </Dialog>

      {/* Remover participante — confirmação */}
      <AlertDialog open={pendingRemoveParticipant !== null} onOpenChange={o => { if (!o) setPendingRemoveParticipant(null); }}>
        <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
          <AlertDialogHeader>
            <AlertDialogTitle className="italic uppercase font-black tracking-tight">Remover participante?</AlertDialogTitle>
            <AlertDialogDescription className="italic text-[#444933]">
              O colaborador <strong>{participants?.find(p => p.id === pendingRemoveParticipant)?.employeeName ?? ""}</strong> será removido da equipe deste evento. Se ele já possuir avaliações enviadas, as notas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoveParticipant !== null && selectedEventId) {
                  removeParticipant.mutate({ id: selectedEventId, participantId: pendingRemoveParticipant });
                }
                setPendingRemoveParticipant(null);
              }}
              className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white italic uppercase font-bold hover:bg-[#9a1414]"
            >
              <Trash2 size={16} className="mr-1.5" /> Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Adicionar participante à equipe */}
      <Dialog open={addParticipantOpen} onOpenChange={(o) => { setAddParticipantOpen(o); if (!o) { setNewParticipantEmployeeId(null); setNewParticipantFunction(DEFAULT_PARTICIPANT_FUNCTION); } }}>
        <DialogContent className="rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="font-black italic uppercase tracking-tight text-[#191c1e]">Adicionar Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Colaborador <span className="text-[#ba1a1a]">*</span></Label>
              <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={employeePickerOpen}
                    className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-none border-2 border-[#191c1e] bg-white text-left"
                  >
                    <span className={cn("truncate text-sm", selectedNewEmployee ? "font-black italic uppercase text-[#191c1e]" : "font-bold italic uppercase text-xs tracking-wider text-[#747a60]")}>
                      {selectedNewEmployee ? selectedNewEmployee.name : "Busque pelo nome..."}
                    </span>
                    <ChevronsUpDown size={16} className="text-[#191c1e] opacity-60 shrink-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-[var(--radix-popover-trigger-width)]">
                  <Command className="rounded-none">
                    <CommandInput placeholder="Buscar pelo nome..." className="italic" />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum colaborador disponível.</CommandEmpty>
                      <CommandGroup>
                        {availableEmployees.map(e => (
                          <CommandItem
                            key={e.id}
                            value={e.name}
                            onSelect={() => {
                              setNewParticipantEmployeeId(e.id);
                              setNewParticipantFunction(matchParticipantFunction(e.functionName));
                              setEmployeePickerOpen(false);
                            }}
                            className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-2"
                          >
                            <Check size={16} className={cn("shrink-0", newParticipantEmployeeId === e.id ? "opacity-100" : "opacity-0")} />
                            <span className="font-black italic uppercase text-sm truncate">{e.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold italic uppercase text-xs tracking-wider text-[#444933]">Função no Evento</Label>
              <Select value={newParticipantFunction} onValueChange={setNewParticipantFunction}>
                <SelectTrigger className="h-11 rounded-none border-2 border-[#191c1e] font-black italic uppercase text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-[#191c1e]">
                  {PARTICIPANT_FUNCTIONS.map(fn => (
                    <SelectItem key={fn} value={fn} className="rounded-none font-bold italic uppercase text-sm cursor-pointer">
                      {fn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              disabled={!newParticipantEmployeeId || addParticipant.isPending || !selectedEventId}
              onClick={() => {
                if (!newParticipantEmployeeId || !selectedEventId) return;
                addParticipant.mutate({ id: selectedEventId, data: { employeeId: newParticipantEmployeeId, functionName: newParticipantFunction || undefined } });
              }}
              className="w-full h-11 bg-[#191c1e] text-[#ccff00] font-black italic uppercase tracking-tight disabled:opacity-40 hover:bg-[#ccff00] hover:text-[#191c1e] border-2 border-[#191c1e] transition-colors"
            >
              {addParticipant.isPending ? "Adicionando..." : "Adicionar à Equipe"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
