import { useState, useEffect } from "react";
import { useGetEvents, useGetEvaluations, useGetEventParticipants, useGetEventCriteria, useGetEvent, useGetEventResult, useCreateEvaluation, useGetUsers, useGetEventConformity, useSetEventConformity, useRedirectConformityEvaluator, useRedirectConformityEvaluatorFerramentas, useGetUsersByArea, useGetEmployees, useAddEventParticipant, useRemoveEventParticipant, useUpdateEventParticipant, useGetAbsences, useUpdateEventAssignments, useSetConformityEvaluator, useSetConformityEvaluatorFerramentas, useGetCurrentCycle, getGetEvaluationsQueryKey, getGetEventQueryKey, exportPendingEvaluations, getEventCriteria, getEvent, getEvaluations, createEvaluation, submitEvaluation } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, Users, Download, Calendar, MapPin, Building2, Save, Flag, Target, Lock, ChevronsUpDown, Check, Info, ListChecks, User, SlidersHorizontal, ArrowRight, Rocket, CornerDownRight, ShieldAlert, Link2, Copy, CheckCheck, ChevronUp, ChevronDown, Trophy, UserPlus, UserX, UserCheck, Trash2, Loader2, X, AlertCircle, Search, Send, BarChart3 } from "lucide-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { AudioRecorder, AudioPlayer } from "@/components/audio-recorder";
import { cn, formatEventSubtitle } from "@/lib/utils";
import { useEventCriterionAssignments, getEventCriterionAssignments, eventCriterionAssignmentsKey, usePatchCriterionAssignment, useRedirectOptions, useCreatePublicToken, usePublicTokens, usePublicLinkEligibleCriteria, useCreateConformityPublicToken, useCreateFerramentasPublicToken, useConformityPublicTokens, useFerramentasPublicTokens, useMyPrincipalAreas, useUsersByArea, useAllPublicTokens, useCreateAdminPublicToken, type PublicToken } from "@/lib/routing-api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AdminEvaluationsConsole } from "./evaluations-admin-console";

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
                  <span><span className="font-bold uppercase">{d.name}</span> — <span className="font-bold">{d.assignee ?? "?"}</span>{d.submittedAt ? ` · ${new Date(d.submittedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}</span>
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
function ConformityLinkHistory({ history }: { history: PublicToken[] }) {
  return (
    <div className="bg-white border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] overflow-hidden">
      {history.map(t => (
        <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold italic truncate">{t.recipientName ?? "—"}</p>
            <p className="text-[10px] italic text-[#747a60]">
              Enviado {new Date(t.createdAt ?? "").toLocaleDateString("pt-BR")}
              {t.usedAt ? ` · Respondido ${new Date(t.usedAt).toLocaleDateString("pt-BR")}` : ""}
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
  );
}

function getCycleWeekends(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return [] as { sat: string; sun: string; label: string }[];
  const result: { sat: string; sun: string; label: string }[] = [];
  const end = new Date(endDate + "T12:00:00");
  const d = new Date(startDate + "T12:00:00");
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d <= end) {
    const sat = d.toISOString().split("T")[0];
    const sunD = new Date(d); sunD.setDate(sunD.getDate() + 1);
    const sun = sunD.toISOString().split("T")[0];
    const label = `${String(d.getDate()).padStart(2,"0")}–${String(sunD.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
    result.push({ sat, sun, label });
    d.setDate(d.getDate() + 7);
  }
  return result;
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
  const [activeEvalTab, setActiveEvalTab] = useState<"todo" | "done">("todo");
  const [eventSearch, setEventSearch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [selectedAvaliadorIds, setSelectedAvaliadorIds] = useState<number[]>([]);
  const [avaliadorPickerOpen, setAvaliadorPickerOpen] = useState(false);
  const [selectedAreaIds, setSelectedAreaIds] = useState<number[]>([]);
  const [selectedCriterionIds, setSelectedCriterionIds] = useState<number[]>([]);
  const [selectedMatrixQuestions, setSelectedMatrixQuestions] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "done">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "com-nota" | "sem-nota">("all");
  const [progressFilter, setProgressFilter] = useState<"all" | "not_started" | "partial" | "done">("all");
  const [publicationFilter, setPublicationFilter] = useState<"all" | "none" | "partial" | "final">("all");
  const [conformityFilter, setConformityFilter] = useState<"all" | "pending" | "done">("all");
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
  const { data: cycle } = useGetCurrentCycle();

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
  const [publicLinkIncludeConformity, setPublicLinkIncludeConformity] = useState(false);
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
  // Habilitado sempre que o avaliador é responsável pela conformidade deste
  // evento (não só quando o dialog de link está aberto) — precisamos saber se
  // já existe link enviado para trocar o formulário por uma view de histórico.
  const { data: conformityPublicTokenHistory, refetch: refetchConformityTokenHistory } = useConformityPublicTokens(
    isConformityEvaluatorForEvent ? (selectedEventId ?? null) : null,
  );
  const { data: ferramentasPublicTokenHistory, refetch: refetchFerramentasTokenHistory } = useFerramentasPublicTokens(
    isFerramentasEvaluatorForEvent ? (selectedEventId ?? null) : null,
  );
  // Admin/RH: histórico consolidado de todos os links públicos do evento,
  // de qualquer avaliador/formulário — dá visibilidade central de quem enviou o quê.
  const { data: allPublicTokens, refetch: refetchAllPublicTokens } = useAllPublicTokens(isManager ? (selectedEventId ?? null) : null);
  // Admin link dialog — gera link para qualquer avaliador designado
  const [adminLinkDialog, setAdminLinkDialog] = useState<{ areaName: string; criterionIds: number[]; assigned: { id: number; name: string }[] } | null>(null);
  const [adminLinkForUserId, setAdminLinkForUserId] = useState<number | null>(null);
  const [adminLinkUrl, setAdminLinkUrl] = useState<string | null>(null);
  const [adminLinkCopied, setAdminLinkCopied] = useState(false);
  const createAdminPublicToken = useCreateAdminPublicToken(selectedEventId ?? 0);

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
  const cycleWeekends = getCycleWeekends(cycle?.startDate, cycle?.endDate);
  // Evaluators may only act on RH-released events; consultation roles may inspect any open event.
  // Ordenado alfabeticamente por nome do evento (pt-BR, ignorando maiúsc./acentos).
  const selectableEvents = [...(isEvaluator ? configuredEvents : activeEvents)]
    .filter(e => {
      const matchDate = (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom) && (!filterDateTo || (e.startDate ?? "") <= filterDateTo);
      return matchDate;
    })
    .sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" })
    );
  const pickedEvent = selectableEvents.find(e => e.id === selectedEventId);

  // Sidebar event list (manager/consultation only): filtered by eventSearch, progressFilter, publicationFilter
  const sidebarEvents = [...(isEvaluator ? configuredEvents : activeEvents)]
    .filter(e => {
      const matchDate = (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom) && (!filterDateTo || (e.startDate ?? "") <= filterDateTo);
      const q = eventSearch.toLowerCase();
      const matchSearch = !q ||
        (e.name ?? "").toLowerCase().includes(q) ||
        (e.clientName ?? "").toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q);
      const prog = e.evaluationProgress ?? 0;
      const matchProgress = progressFilter === "all" || (
        progressFilter === "not_started" ? prog === 0 :
        progressFilter === "partial" ? prog > 0 && prog < 1 :
        prog >= 1
      );
      const matchPub = publicationFilter === "all" || (
        publicationFilter === "none" ? !e.feedbackReleased && !e.partialPublishedAt :
        publicationFilter === "partial" ? !e.feedbackReleased && !!e.partialPublishedAt :
        !!e.feedbackReleased
      );
      const matchConformity = conformityFilter === "all" || (
        conformityFilter === "pending"
          ? ((e as { conformityNeeded?: boolean; conformityComplete?: boolean }).conformityNeeded && !(e as { conformityNeeded?: boolean; conformityComplete?: boolean }).conformityComplete)
          : ((e as { conformityNeeded?: boolean; conformityComplete?: boolean }).conformityNeeded && (e as { conformityNeeded?: boolean; conformityComplete?: boolean }).conformityComplete)
      );
      return matchDate && matchSearch && matchProgress && matchPub && matchConformity;
    })
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "pt-BR", { sensitivity: "base" }));

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
  const todoEvents = evaluatorEventStats.filter(s => !s.done).map(s => s.event);
  const doneEvents = evaluatorEventStats.filter(s => s.done).map(s => s.event);

  // Consultation mode: when a manager picks an Avaliador WITHOUT picking an
  // Evento, the filter must still return something — a cross-event overview
  // of that avaliador's assigned events, instead of the generic empty state.
  // Same query-key pattern as the evaluator overview above (deduped/cached).
  // Also activates with NO avaliador picked as long as Status is narrowed to
  // Pendentes/Avaliadas — otherwise that filter had zero visible effect
  // (the generic "Pronto para consultar" empty state ignored it entirely).
  const crossEventLookupActive = isConsultation && !selectedEventId && (selectedAvaliadorIds.length > 0 || statusFilter !== "all");
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
        if (selectedAvaliadorIds.length > 0) {
          const combinedAreaIds = new Set(
            (detail?.areaAssignments ?? [])
              .filter(a => a.evaluatorUserId != null && selectedAvaliadorIds.includes(a.evaluatorUserId))
              .map(a => a.areaId),
          );
          const crit = critAll.filter(c => combinedAreaIds.has(c.responsibleAreaId!));
          const submitted = crit.filter(c =>
            selectedAvaliadorIds.some(uid => evs.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === uid)?.status === "submitted")
          ).length;
          const total = crit.length;
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
  const selectedAvaliadorName = selectedAvaliadorIds.length === 1
    ? (allAvaliadores.find(a => a.id === selectedAvaliadorIds[0])?.name ?? null)
    : selectedAvaliadorIds.length > 1 ? `${selectedAvaliadorIds.length} avaliadores` : null;

  // If the selected event stops being selectable (closed or criteria unconfirmed
  // server-side), clear the selection so trigger text and loaded data stay in sync.
  useEffect(() => {
    if (selectedEventId == null || !events) return;
    const stillValid = events.some(e => e.id === selectedEventId && (e.status === "open" || e.status === "closed") && (isEvaluator ? e.criteriaConfirmed : true));
    if (!stillValid) { setSelectedEventId(null); setScores({}); setComments({}); setAudioOverrides({}); setSelectedAvaliadorIds([]); setStatusFilter("all"); setSelectedAreaIds([]); setSelectedCriterionIds([]); setSelectedMatrixQuestions([]); }
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

  const selectedAvaliadores = avaliadorStats.filter(av => selectedAvaliadorIds.includes(av.id));
  // Com avaliadores selecionados, "avaliado" = submissão de QUALQUER deles; sem seleção, completude agregada.
  const isCriterionDone = (c: (typeof activeCriteria)[number]) =>
    selectedAvaliadores.length > 0
      ? selectedAvaliadores.some(av => (evaluations ?? []).some(e => e.criterionId === c.criterionId && e.evaluatorUserId === av.id && e.status === "submitted"))
      : criterionStatus(c.criterionId, c.responsibleAreaId ?? null).state === "submitted";
  const avaliadorFilteredCriteria = selectedAvaliadores.length > 0
    ? activeCriteria.filter(c => c.responsibleAreaId != null && selectedAvaliadores.some(av => av.areaIds.has(c.responsibleAreaId!)))
    : activeCriteria;
  const statusFilteredCriteria = statusFilter === "all"
    ? avaliadorFilteredCriteria
    : avaliadorFilteredCriteria.filter(c => (statusFilter === "done" ? isCriterionDone(c) : !isCriterionDone(c)));
  const typeFilteredCriteria = typeFilter === "all"
    ? statusFilteredCriteria
    : typeFilter === "com-nota"
      ? statusFilteredCriteria.filter(c => getSubmittedEvals(c.criterionId).length > 0)
      : statusFilteredCriteria.filter(c => getSubmittedEvals(c.criterionId).length === 0);
  const areaFilteredCriteria = selectedAreaIds.length > 0
    ? typeFilteredCriteria.filter(c => c.responsibleAreaId != null && selectedAreaIds.includes(c.responsibleAreaId))
    : typeFilteredCriteria;
  const criterionFilteredCriteria = selectedCriterionIds.length > 0
    ? areaFilteredCriteria.filter(c => selectedCriterionIds.includes(c.criterionId))
    : areaFilteredCriteria;
  const filteredAreaGroups = groupByArea(criterionFilteredCriteria);

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

  const labels: Record<number, string> = {
    0: "Crítico, não atendeu ao básico",
    10: "Perfeição, atendeu completamente e sem erros",
  };

  // Redesign: admin/rh/diretoria ganham uma central dedicada de atribuição
  // (progresso + quem-falta-avaliar + atribuição de avaliadores), separada do
  // fluxo de lançamento de nota do avaliador que segue abaixo.
  if (isConsultation) {
    return (
      <div className="bg-[#f7f9fb] min-h-full text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
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
        <div className="flex items-center gap-2">
          {isManager && (
            <button
              data-testid="button-export-pending"
              onClick={handleExportPending}
              className="flex items-center gap-1.5 border-2 border-[#ccff00]/40 px-3 py-1.5 text-[11px] font-black italic uppercase text-[#ccff00] hover:border-[#ccff00] hover:bg-[#ccff00]/10 transition-colors"
            >
              <Download size={13} /> Exportar Pendentes
            </button>
          )}
        </div>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside className="w-72 shrink-0 bg-white border-r-2 border-[#191c1e] flex flex-col overflow-hidden">

          {/* Manager/consultation: inline event list + filters */}
          {!isEvaluator && (
            <>
              {/* ── Header: título + chips de filtro rápido + busca ── */}
              <div className="shrink-0 border-b-2 border-[#191c1e]">

                {/* Barra título */}
                <div className="bg-[#191c1e] px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-black italic uppercase tracking-widest text-[#ccff00] flex items-center gap-1.5">
                    <Flag size={11} /> Eventos
                  </span>
                  <span className="text-[10px] font-black italic text-white/60 tabular-nums">
                    {sidebarEvents.length}<span className="text-white/30">/{activeEvents.length}</span>
                  </span>
                </div>

                <div className="px-3 pt-3 pb-3 space-y-3">
                  {/* Busca */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa08a] pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar evento, cliente, cidade..."
                      value={eventSearch}
                      onChange={e => setEventSearch(e.target.value)}
                      className="w-full pl-8 pr-7 h-8 text-[11px] border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white placeholder:text-[#b0b8a0] placeholder:not-italic placeholder:normal-case"
                    />
                    {eventSearch && (
                      <button type="button" onClick={() => setEventSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#747a60] hover:text-[#191c1e]">
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {/* Progresso chips */}
                  <div className="space-y-1">
                    <p className="text-[9px] font-black italic uppercase tracking-wider text-[#9aa08a] flex items-center gap-1"><BarChart3 size={9} /> Progresso</p>
                    <div className="flex gap-1 flex-wrap">
                      {([["all","Todos"],["not_started","Não iniciado"],["partial","Em andamento"],["done","Concluído"]] as const).map(([f, label]) => (
                        <button key={f} onClick={() => setProgressFilter(f)} className={cn("text-[9px] font-black italic uppercase py-1 px-2 border-2 transition-colors leading-tight", progressFilter === f ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6] hover:border-[#191c1e] hover:text-[#191c1e]")}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Matriz + Publicação em linha */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black italic uppercase tracking-wider text-[#9aa08a] flex items-center gap-1"><ListChecks size={9} /> Matriz</p>
                      <div className="flex gap-1 flex-wrap">
                        {([["all","Todas"],["pending","Pend."],["done","Ok"]] as const).map(([f, label]) => (
                          <button key={f} onClick={() => setConformityFilter(f)} className={cn("text-[9px] font-black italic uppercase py-1 px-2 border-2 transition-colors leading-tight", conformityFilter === f ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6] hover:border-[#191c1e] hover:text-[#191c1e]")}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black italic uppercase tracking-wider text-[#9aa08a] flex items-center gap-1"><Send size={9} /> Publicação</p>
                      <div className="flex gap-1 flex-wrap">
                        {([["all","Todos"],["none","—"],["partial","◑"],["final","✓"]] as const).map(([f, label]) => (
                          <button key={f} onClick={() => setPublicationFilter(f)} className={cn("text-[9px] font-black italic uppercase py-1 px-2 border-2 transition-colors leading-tight", publicationFilter === f ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6] hover:border-[#191c1e] hover:text-[#191c1e]")}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Event list (flex-1, scrollável) ── */}
              <div className="overflow-auto flex-1">
                {selectedEventId != null && (
                  <button
                    type="button"
                    onClick={() => { setSelectedEventId(null); setScores({}); setComments({}); setAudioOverrides({}); }}
                    className="w-full text-left px-3 py-1.5 text-[9px] font-black italic uppercase text-[#747a60] border-b border-[#eceef0] hover:bg-[#f7f9fb] flex items-center gap-1"
                  >
                    <X size={9} /> Todos os eventos
                  </button>
                )}
                {sidebarEvents.length === 0 ? (
                  <div className="p-4 text-center text-[10px] italic font-bold uppercase text-[#747a60]">
                    {eventSearch || progressFilter !== "all" || publicationFilter !== "all" || conformityFilter !== "all"
                      ? "Sem resultados para esses filtros."
                      : "Nenhum evento disponível."}
                  </div>
                ) : (
                  sidebarEvents.map(ev => {
                    const isSelected = selectedEventId === ev.id;
                    const prog = ev.evaluationProgress ?? 0;
                    const done = prog >= 1;
                    const partial = prog > 0 && prog < 1;
                    const evC = ev as { conformityNeeded?: boolean; conformityComplete?: boolean };
                    const matrixNeeded = !!evC.conformityNeeded;
                    const matrixDone = !!evC.conformityComplete;
                    const progPct = Math.round(prog * 100);
                    const progBarColor = done ? "#ccff00" : partial ? "#f0c820" : "#d4d8cc";
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        data-testid={`option-event-${ev.id}`}
                        onClick={() => { setSelectedEventId(ev.id); setScores({}); setComments({}); setAudioOverrides({}); }}
                        className={cn(
                          "w-full text-left px-4 py-3 border-b border-[#eceef0] last:border-0 transition-colors border-l-4",
                          isSelected
                            ? "bg-[#eeffaa] border-l-[#ccff00]"
                            : done
                              ? "bg-[#f5ffea] border-l-[#88b800] hover:bg-[#ecffcc]"
                              : partial
                                ? "bg-[#fffdf0] border-l-[#d4b020] hover:bg-[#fff9e0]"
                                : "bg-white border-l-transparent hover:bg-[#f7f9fb]"
                        )}
                      >
                        {/* Nome + status dot */}
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("font-black italic uppercase text-[11px] leading-snug truncate flex-1", done ? "text-[#2e4400]" : "text-[#191c1e]")}>
                            {ev.name}
                          </p>
                          <div className={cn("w-2 h-2 shrink-0 mt-1", done ? "bg-[#88b800]" : partial ? "bg-[#d4b020]" : "bg-[#d4d8cc]")} />
                        </div>
                        {/* Cliente + cidade */}
                        {(ev.clientName || ev.city) && (
                          <p className="text-[10px] text-[#9aa08a] truncate mt-0.5">
                            {[ev.clientName, ev.city].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {/* Barra de progresso + badges */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-2 bg-[#e8ece0] overflow-hidden">
                            <div style={{ width: `${progPct}%`, backgroundColor: progBarColor, transition: "width 0.4s" }} className="h-full" />
                          </div>
                          <span className={cn("text-[10px] font-black tabular-nums shrink-0 w-8 text-right", done ? "text-[#506600]" : partial ? "text-[#8a7000]" : "text-[#9aa08a]")}>
                            {progPct}%
                          </span>
                        </div>
                        {/* Badges linha */}
                        {(ev.feedbackReleased || ev.partialPublishedAt || matrixNeeded) && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {ev.feedbackReleased
                              ? <span title="Feedback final publicado" className="text-[9px] font-black italic uppercase px-1.5 py-0.5 border border-[#88b800] bg-[#f0ffe0] text-[#506600] shrink-0">Final ✓</span>
                              : ev.partialPublishedAt
                                ? <span title="Feedback parcial publicado" className="text-[9px] font-black italic uppercase px-1.5 py-0.5 border border-[#d4b020] bg-[#fffbe0] text-[#8a7000] shrink-0">Parcial ◑</span>
                                : null
                            }
                            {matrixNeeded && (
                              <span
                                title={matrixDone ? "Matriz de conformidade concluída" : "Matriz de conformidade pendente"}
                                className={cn("text-[9px] font-black italic uppercase shrink-0 px-1.5 py-0.5 border", matrixDone ? "text-[#506600] border-[#a0c830] bg-[#f0ffe0]" : "text-[#b02f00] border-[#f08080] bg-[#fff0ee]")}
                              >
                                Matriz {matrixDone ? "✓" : "!"}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* ── Período (compacto, no rodapé) ── */}
              <div className="px-3 py-2 border-t border-[#eceef0] shrink-0">
                <p className="text-[9px] font-black italic uppercase tracking-widest text-[#747a60] mb-1.5 flex items-center gap-1"><Calendar size={9} /> Período</p>
                <div className="space-y-1.5">
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <label className="text-[8px] font-bold italic uppercase tracking-wide text-[#9aa088] block mb-0.5">De</label>
                      <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="w-full h-7 px-2 text-[10px] border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[8px] font-bold italic uppercase tracking-wide text-[#9aa088] block mb-0.5">Até</label>
                      <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="w-full h-7 px-2 text-[10px] border-2 border-[#191c1e] bg-[#f7f9fb] font-bold italic focus:outline-none focus:bg-white" />
                    </div>
                  </div>
                  {cycleWeekends.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cycleWeekends.map(w => {
                        const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                        return (
                          <button
                            key={w.sat}
                            type="button"
                            onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                            className={cn("px-1.5 py-0.5 text-[8px] font-black italic uppercase border-2 transition-colors", active ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d4c8] hover:border-[#191c1e] hover:text-[#191c1e]")}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {(filterDateFrom || filterDateTo) && (
                    <button type="button" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} className="text-[9px] font-bold italic uppercase text-[#747a60] hover:text-[#b02f00]">
                      × Limpar datas
                    </button>
                  )}
                </div>
              </div>

              {/* Limpar filtros */}
              {(progressFilter !== "all" || publicationFilter !== "all" || conformityFilter !== "all" || filterDateFrom || filterDateTo || eventSearch) && (
                <div className="px-3 py-1.5 border-t-2 border-[#191c1e] shrink-0">
                  <button type="button" data-testid="button-clear-filters" onClick={() => { setSelectedEventId(null); setSelectedAvaliadorIds([]); setSelectedAreaIds([]); setSelectedCriterionIds([]); setSelectedMatrixQuestions([]); setStatusFilter("all"); setTypeFilter("all"); setProgressFilter("all"); setPublicationFilter("all"); setConformityFilter("all"); setFilterDateFrom(""); setFilterDateTo(""); setEventSearch(""); }} className="text-[10px] font-black italic uppercase text-[#862200] hover:underline flex items-center gap-1">
                    <X size={11} /> Limpar filtros
                  </button>
                </div>
              )}

              <div className="px-4 py-2.5 border-t-2 border-[#eceef0] shrink-0 bg-[#f7f9fb]">
                <p className="text-[9px] italic text-[#9aa08a] leading-snug flex items-start gap-1.5">
                  <Info size={10} className="shrink-0 mt-0.5" />
                  {isConsultation ? "Modo consulta — visualize o andamento das avaliações sem editar notas." : "Apenas eventos configurados e liberados pelo RH aparecem aqui."}
                </p>
              </div>
            </>
          )}

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
          <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-8">
            <div className="border-2 border-[#191c1e] bg-white p-10 max-w-sm w-full flex flex-col items-center gap-4 relative">
              <div className="w-20 h-20 border-2 border-[#191c1e] bg-[#191c1e] flex items-center justify-center skew-x-[-4deg]">
                {isConsultation
                  ? <BarChart3 className="text-[#ccff00] skew-x-[4deg]" size={36} />
                  : <Rocket className="text-[#ccff00] skew-x-[4deg]" size={36} />
                }
              </div>
              <div>
                <h2 className="text-xl italic uppercase font-black tracking-tight text-[#191c1e] leading-tight">
                  {isConsultation ? "Modo Consulta" : "Pronto para avaliar"}
                </h2>
                <p className="text-[#747a60] italic text-sm mt-1.5 leading-relaxed">
                  {isConsultation
                    ? "Selecione um evento ao lado para acompanhar o andamento das avaliações da equipe."
                    : "Selecione um evento ao lado para iniciar ou continuar sua avaliação."}
                </p>
              </div>
              {isManager && activeEvents.length > 0 && (
                <div className="w-full border-t-2 border-[#eceef0] pt-4 grid grid-cols-2 gap-3 text-left">
                  <div className="bg-[#f7f9fb] border border-[#eceef0] p-3">
                    <p className="text-[20px] font-black italic text-[#191c1e] leading-none">{activeEvents.length}</p>
                    <p className="text-[9px] font-black italic uppercase text-[#9aa08a] mt-0.5">eventos ativos</p>
                  </div>
                  <div className="bg-[#f7f9fb] border border-[#eceef0] p-3">
                    <p className="text-[20px] font-black italic text-[#ccff00] leading-none" style={{WebkitTextStroke: "1px #191c1e"}}>
                      {Math.round((activeEvents.filter(e => (e.evaluationProgress ?? 0) >= 1).length / Math.max(1, activeEvents.length)) * 100)}%
                    </p>
                    <p className="text-[9px] font-black italic uppercase text-[#9aa08a] mt-0.5">concluídos</p>
                  </div>
                </div>
              )}
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
                      <span className="flex items-center gap-1"><Calendar size={9} />{new Date(currentEvent.startDate).toLocaleDateString('pt-BR')} — {new Date(currentEvent.endDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[9px] font-black italic uppercase px-2.5 py-1 bg-[#ccff00] text-[#161e00] border border-[#ccff00]">Aberto</span>
                    <span className="text-[10px] font-black italic text-white/60 flex items-center gap-1"><Users size={11} />{currentEvent.participantCount} part.</span>
                  </div>
                </div>
                {/* Barra progresso da equipe (manager) */}
                {isManager && (
                  <div className="bg-[#f7f9fb] border-t border-[#eceef0] px-5 py-2 flex items-center gap-3">
                    <span className="text-[9px] font-black italic uppercase text-[#747a60] shrink-0 flex items-center gap-1"><BarChart3 size={9} /> Progresso do Time</span>
                    <div className="flex-1 h-2 bg-[#e0e3da] overflow-hidden">
                      <div className="h-full bg-[#ccff00] transition-[width]" style={{ width: `${teamProgressPct}%` }} />
                    </div>
                    <span className="text-[11px] font-black italic text-[#191c1e] shrink-0 tabular-nums w-9 text-right">{Math.round(teamProgressPct)}%</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Barra de filtros de critérios (consultation + evento selecionado) ── */}
            {isConsultation && !!selectedEventId && (
              <div className="bg-white border-2 border-[#191c1e] flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">

                {/* Avaliador */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[9px] font-black italic uppercase text-[#747a60] shrink-0 flex items-center gap-1"><User size={10}/> Avaliador</span>
                  {(() => {
                    const avaliadorOptions = avaliadorStats.length > 0
                      ? avaliadorStats.map(av => ({ id: av.id, name: av.name, suffix: `${av.submitted}/${av.total}` }))
                      : allAvaliadores.map(av => ({ id: av.id, name: av.name, suffix: null as string | null }));
                    const toggleAvaliador = (id: number) =>
                      setSelectedAvaliadorIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                    return (
                      <Popover open={avaliadorPickerOpen} onOpenChange={setAvaliadorPickerOpen}>
                        <PopoverTrigger asChild>
                          <button type="button" data-testid="select-avaliador" className="h-7 px-2.5 flex items-center gap-2 border-2 border-[#191c1e] bg-white italic font-bold text-[10px] uppercase hover:bg-[#f7f9fb] transition-colors max-w-[180px]">
                            <span className="truncate text-[#191c1e]">
                              {selectedAvaliadorIds.length === 0 ? "Todos" : selectedAvaliadorIds.length === 1 ? (avaliadorOptions.find(a => a.id === selectedAvaliadorIds[0])?.name ?? "1 sel.") : `${selectedAvaliadorIds.length} sel.`}
                            </span>
                            <ChevronsUpDown size={11} className="shrink-0 text-[#191c1e]" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" side="bottom" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-64 z-50">
                          <Command className="rounded-none">
                            <CommandInput data-testid="input-avaliador-search" placeholder="Buscar avaliador..." className="italic text-xs" />
                            <CommandList className="max-h-[240px]">
                              <CommandEmpty className="py-4 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhum encontrado.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem value="Todos os avaliadores" data-testid="option-avaliador-all" onSelect={() => { setSelectedAvaliadorIds([]); setAvaliadorPickerOpen(false); }} className="rounded-none cursor-pointer aria-selected:bg-[#ccff00] aria-selected:text-[#161e00] py-2 gap-2">
                                  <Check size={13} className={cn("shrink-0", selectedAvaliadorIds.length === 0 ? "opacity-100" : "opacity-0")} />
                                  <span className="font-bold italic uppercase text-xs">Todos</span>
                                </CommandItem>
                                {avaliadorOptions.map(av => (
                                  <CommandItem key={av.id} value={av.name} data-testid={`option-avaliador-${av.id}`} onSelect={() => toggleAvaliador(av.id)} className="rounded-none cursor-pointer aria-selected:bg-[#eeffaa] aria-selected:text-[#161e00] py-2 gap-2">
                                    <div className={cn("w-3.5 h-3.5 border-2 shrink-0 flex items-center justify-center", selectedAvaliadorIds.includes(av.id) ? "bg-[#191c1e] border-[#191c1e]" : "border-[#aaa] bg-white")}>
                                      {selectedAvaliadorIds.includes(av.id) && <Check size={9} className="text-[#ccff00]" strokeWidth={3} />}
                                    </div>
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

                {/* Área pills */}
                {eventAreasForAssignment.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-black italic uppercase text-[#747a60] shrink-0 flex items-center gap-1"><Building2 size={10}/> Área:</span>
                    {eventAreasForAssignment.map(area => {
                      const active = selectedAreaIds.includes(area.id);
                      return (
                        <button key={area.id} type="button" onClick={() => setSelectedAreaIds(prev => prev.includes(area.id) ? prev.filter(x => x !== area.id) : [...prev, area.id])}
                          className={cn("px-2 py-0.5 text-[9px] font-black italic uppercase border-2 transition-colors", active ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6] hover:border-[#191c1e] hover:text-[#191c1e]")}>
                          {area.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Critério multi-select (Popover) */}
                {activeCriteria.length > 1 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-black italic uppercase text-[#747a60] shrink-0 flex items-center gap-1"><ListChecks size={10}/> Critério</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="h-7 px-2.5 flex items-center gap-2 border-2 border-[#191c1e] bg-white italic font-bold text-[10px] uppercase hover:bg-[#f7f9fb] transition-colors max-w-[160px]">
                          <span className="truncate text-[#191c1e]">
                            {selectedCriterionIds.length === 0 ? "Todos" : `${selectedCriterionIds.length} sel.`}
                          </span>
                          <ChevronsUpDown size={11} className="shrink-0 text-[#191c1e]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" side="bottom" className="p-0 rounded-none border-2 border-[#191c1e] shadow-[4px_4px_0px_0px_#191c1e] w-56 z-50">
                        <div className="max-h-56 overflow-y-auto divide-y divide-[#eceef0]">
                          <button type="button" onClick={() => setSelectedCriterionIds([])} className={cn("w-full text-left px-3 py-2 text-[10px] font-bold italic uppercase flex items-center gap-2 hover:bg-[#f7f9fb]", selectedCriterionIds.length === 0 ? "bg-[#f0ffe0] text-[#191c1e]" : "text-[#747a60]")}>
                            <Check size={11} className={selectedCriterionIds.length === 0 ? "opacity-100" : "opacity-0"} /> Todos
                          </button>
                          {activeCriteria.map(c => {
                            const active = selectedCriterionIds.includes(c.criterionId);
                            return (
                              <button key={c.criterionId} type="button" onClick={() => setSelectedCriterionIds(prev => prev.includes(c.criterionId) ? prev.filter(x => x !== c.criterionId) : [...prev, c.criterionId])}
                                className={cn("w-full text-left px-3 py-2 text-[10px] font-bold italic uppercase flex items-center gap-2 hover:bg-[#f7f9fb]", active ? "bg-[#eeffaa] text-[#191c1e]" : "text-[#747a60]")}>
                                <div className={cn("w-3 h-3 border-2 shrink-0 flex items-center justify-center", active ? "bg-[#191c1e] border-[#191c1e]" : "border-[#aaa] bg-white")}>
                                  {active && <Check size={8} className="text-[#ccff00]" strokeWidth={3} />}
                                </div>
                                {c.criterionName}
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Respostas de Matriz pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] font-black italic uppercase text-[#747a60] shrink-0 flex items-center gap-1"><ShieldAlert size={10}/> Matriz:</span>
                  {([["epi","EPI"],["estaiamentos","Estai."],["guardaEquipamentos","Guarda Eq."],["conduta","Conduta"],["ausencias","Ausências"],["standout","Destaque"]] as const).map(([key, label]) => {
                    const active = selectedMatrixQuestions.includes(key);
                    return (
                      <button key={key} type="button" onClick={() => setSelectedMatrixQuestions(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])}
                        className={cn("px-2 py-0.5 text-[9px] font-black italic uppercase border-2 transition-colors", active ? "bg-[#191c1e] text-[#ccff00] border-[#191c1e]" : "bg-white text-[#747a60] border-[#d0d3d6] hover:border-[#191c1e] hover:text-[#191c1e]")}>
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Limpar filtros de critérios */}
                {(selectedAvaliadorIds.length > 0 || selectedAreaIds.length > 0 || selectedCriterionIds.length > 0 || selectedMatrixQuestions.length > 0) && (
                  <button type="button" onClick={() => { setSelectedAvaliadorIds([]); setSelectedAreaIds([]); setSelectedCriterionIds([]); setSelectedMatrixQuestions([]); }} className="ml-auto text-[9px] font-black italic uppercase text-[#862200] hover:underline flex items-center gap-1 shrink-0">
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

              {/* Criteria Column / Evaluation Form */}
              <div className="space-y-4 order-2 lg:order-none">
                <div className="flex items-center justify-between gap-4 px-1">
                  <h3 className="text-xl md:text-2xl italic uppercase font-black tracking-tight flex items-center gap-2">
                    {isConsultation ? (<><ListChecks size={20} /> Status das Avaliações</>) : (<><Target size={20} /> Critérios de Avaliação</>)}
                  </h3>
                  {isConsultation && filteredAreaGroups.length > 0 && (
                    <span className="text-[10px] font-black italic uppercase text-[#747a60] border border-[#d0d3d6] px-2 py-0.5 shrink-0">
                      {filteredAreaGroups.reduce((sum, g) => sum + g.criteria.length, 0)} quesitos
                    </span>
                  )}
                </div>

                {isConsultation ? (
                  filteredAreaGroups.length === 0 ? (
                    <div className="text-center py-12 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60]">
                      {statusFilter === "pending"
                        ? "Nenhuma avaliação pendente com os filtros atuais."
                        : statusFilter === "done"
                          ? "Nenhuma avaliação concluída com os filtros atuais."
                          : selectedAvaliadores.length > 0
                            ? "Estes avaliadores não têm critérios atribuídos neste evento."
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
                            {(() => {
                              const matrixItems = [
                                { key: "epi" as const, label: "EPI", val: adminConformityData?.epi, comment: adminConformityData?.epiComment },
                                { key: "estaiamentos" as const, label: "Estaiamentos/Aterramento", val: adminConformityData?.estaiamentos, comment: adminConformityData?.estaiamentosComment },
                                { key: "conduta" as const, label: "Conduta", val: adminConformityData?.conduta, comment: adminConformityData?.condutaComment },
                                { key: "guardaEquipamentos" as const, label: "Guarda de Equipamentos", val: adminConformityData?.guardaEquipamentos, comment: adminConformityData?.guardaEquipamentosComment },
                              ].filter(item => selectedMatrixQuestions.length === 0 || selectedMatrixQuestions.includes(item.key));
                              if (matrixItems.length === 0) return null;
                              return (
                                <div className="px-5 py-4">
                                  <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#444933] mb-3">Respostas da Matriz</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {matrixItems.map(item => (
                                      <div key={item.key} className="border-2 border-[#eceef0] p-3">
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
                              );
                            })()}

                            {/* Faltas/Atrasos */}
                            {(selectedMatrixQuestions.length === 0 || selectedMatrixQuestions.includes("ausencias")) && (
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
                                {adminConformityData?.absencesResponse === true ? (
                                  <p className="text-sm italic text-[#191c1e] leading-relaxed whitespace-pre-wrap border-l-2 border-[#b02f00] pl-3">{adminConformityData.absencesReport || "—"}</p>
                                ) : adminConformityData?.absencesResponse === false ? (
                                  <p className="text-[11px] italic text-[#9aa088]">Nenhuma falta ou atraso registrada.</p>
                                ) : eventAbsences.length === 0 ? (
                                  <p className="text-[11px] italic text-[#9aa088]">Ainda não respondido.</p>
                                ) : null}
                              </div>
                            )}

                            {/* Destaque de Desempenho */}
                            {(selectedMatrixQuestions.length === 0 || selectedMatrixQuestions.includes("standout")) && (
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
                            )}
                          </div>
                        </div>
                      )}

                      {filteredAreaGroups.map(g => {
                        const submittedInArea = g.criteria.filter(c => isCriterionDone(c)).length;
                        const areaDone = submittedInArea === g.criteria.length;
                        const areaId = g.criteria[0]?.responsibleAreaId ?? null;
                        const areaAssigned = areaId != null ? (assignedEvaluatorsByArea.get(areaId) ?? []) : [];
                        const isEditingThisArea = isManager && assignAreaPickerOpen === areaId;
                        return (
                          <div key={g.area} data-testid={`status-area-${g.area}`} className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
                            <div className="flex items-center justify-between gap-3 px-5 py-3 border-b-2 border-[#191c1e] bg-[#f2f4f6]">
                              <span className="inline-flex items-center gap-2 font-black italic uppercase tracking-tight min-w-0 truncate pr-1.5">
                                <Building2 size={16} className="shrink-0" /> {g.area}
                              </span>
                              <span className="flex items-center gap-2 shrink-0">
                                {isManager && areaId != null && !isEditingThisArea && (
                                  <>
                                    {areaAssigned.map(a => (
                                      <span key={a.id} className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black italic uppercase bg-white border border-[#d8dadc] px-2 py-0.5">
                                        <User size={10} /> {a.name.split(" ")[0]}
                                      </span>
                                    ))}
                                    {areaAssigned.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdminLinkDialog({ areaName: g.area, criterionIds: g.criteria.map(c => c.criterionId), assigned: areaAssigned });
                                          setAdminLinkForUserId(areaAssigned.length === 1 ? areaAssigned[0].id : null);
                                          setAdminLinkUrl(null);
                                          setAdminLinkCopied(false);
                                          refetchAllPublicTokens();
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#191c1e] bg-white hover:bg-[#f7ffd1] transition-colors text-[10px] font-black uppercase tracking-tight"
                                        title="Gerar link de avaliação para este avaliador"
                                      >
                                        <Link2 size={11} /> Link
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => { setAssignAreaPickerOpen(areaId); setAssignAreaUserIds(areaAssigned.map(a => a.id)); }}
                                      className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#191c1e] bg-white hover:bg-[#f7ffd1] transition-colors text-[10px] font-black uppercase tracking-tight"
                                    >
                                      <UserPlus size={11} /> {areaAssigned.length === 0 ? "Atribuir" : "Alterar"}
                                    </button>
                                  </>
                                )}
                                <span className={cn("px-3 py-1 border-2 border-[#191c1e] font-bold text-[11px] italic uppercase skew-x-[-8deg] inline-block", areaDone ? "bg-[#506600] text-[#ccff00]" : "bg-[#ffb5a0] text-[#3b0900]")}>
                                  <span className="inline-block skew-x-[8deg]">{submittedInArea}/{g.criteria.length} {areaDone ? "Concluído" : "Pendente"}</span>
                                </span>
                              </span>
                            </div>
                            {isEditingThisArea && areaId != null && (
                              <div className="px-5 py-3 border-b-2 border-[#d8dadc] bg-[#fafbf5] space-y-2">
                                <div className="max-h-40 overflow-y-auto space-y-0.5 border-2 border-[#191c1e] p-2 bg-[#f9fafb]">
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
                                    onClick={() => updateAssignmentsMutation.mutate({ id: selectedEventId!, data: { assignments: [{ areaId, evaluatorUserIds: assignAreaUserIds }] } })}
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
                            <ul>
                              {g.criteria.map(c => {
                                const st = criterionStatus(c.criterionId, c.responsibleAreaId ?? null);
                                // Um registro de roteamento por critério (redirecionamento) manda
                                // sobre a atribuição por área — sem isso, "Responsável" continuava
                                // mostrando o avaliador da área mesmo depois de redirecionar.
                                const directAssignment = criterionAssignments?.find(x => x.criterionId === c.criterionId);
                                const assignedNames = c.responsibleAreaId != null ? (assignedEvaluatorsByArea.get(c.responsibleAreaId) ?? []).map(a => a.name) : [];
                                const responsible = directAssignment?.assignedToName ?? (assignedNames.length > 0 ? assignedNames.join(", ") : (st.submittedNames[0] ?? null));
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
                                        {Number(c.weightOverride ?? c.originalWeight ?? 0) === 0 && !c.eventScoped && (
                                          <span className="text-[9px] font-black italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-1.5 py-0.5 shrink-0">
                                            Não conta na média
                                          </span>
                                        )}
                                        {c.eventScoped && (
                                          <span className="text-[9px] font-black italic uppercase text-[#506600] bg-[#f7ffd1] border border-[#506600] px-1.5 py-0.5 shrink-0">
                                            Entra na média
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
                                            href={`/calibrations?eventId=${selectedEventId}`}
                                            title="Ir para Calibração deste evento"
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
                                onClick={() => { navigator.clipboard.writeText(pendingUrl); toast({ title: "Link copiado!", description: `Para: ${pendingFerr.recipientName ?? "freelancer"}` }); }}
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
                                onClick={() => { navigator.clipboard.writeText(pendingUrl); toast({ title: "Link copiado!", description: `Para: ${pendingCeno.recipientName ?? "freelancer"}` }); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-[#f7ffd1] hover:bg-[#eeff99] transition-colors"
                                title="Copiar link já enviado — só existe um link por evento"
                              >
                                <Copy size={12} /> Copiar link ({pendingCeno.recipientName ?? "freelancer"})
                              </button>
                            );
                          }
                          if (answeredCeno) return null;
                          return (
                            <button type="button"
                              onClick={() => { setConformityPublicLinkType("cenografia"); setConformityPublicRecipientName(""); setGeneratedConformityUrl(null); setConformityLinkCopied(false); refetchConformityTokenHistory(); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold italic uppercase border-2 border-[#191c1e] bg-white hover:bg-[#f5f5f5] transition-colors"
                              title="Gerar link único para um freelancer responder o formulário de Cenografia"
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
                          {[adminConformityData.epi, adminConformityData.estaiamentos, adminConformityData.conduta, adminConformityData.guardaEquipamentos].some(v => v === false) && (
                            <div className="flex items-center gap-2 text-[11px] font-bold italic uppercase text-[#862200] bg-[#ffdbd1] border border-[#862200] px-3 py-2">
                              <ShieldAlert size={13} className="shrink-0" />
                              <span>Não-conformidade na matriz</span>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Links públicos enviados — visão consolidada, qualquer avaliador/formulário */}
                      {!!allPublicTokens && allPublicTokens.length > 0 && (
                        <div className="pt-2 border-t-2 border-[#e0e3e5] space-y-2">
                          <p className="text-xs font-bold italic uppercase text-[#444933]">Links Públicos Enviados</p>
                          <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-48 overflow-y-auto bg-white">
                            {allPublicTokens.map(t => (
                              <div key={t.id} className="flex items-center justify-between px-3 py-2 gap-2">
                                <div className="min-w-0">
                                  <p className="text-xs font-bold italic truncate">{t.recipientName ?? "—"}</p>
                                  <p className="text-[10px] italic text-[#747a60] truncate">
                                    {t.tokenType === "conformity_cenografia" ? "Matriz — Cenografia" : t.tokenType === "conformity_ferramentas" ? "Matriz — Ferramentas" : "Critérios"}
                                    {" · "}enviado por {t.createdByName ?? "—"} em {new Date(t.createdAt ?? "").toLocaleDateString("pt-BR")}
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
                  )}

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
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={publicLinkIncludeConformity}
                      onChange={e => setPublicLinkIncludeConformity(e.target.checked)}
                      className="mt-0.5 w-4 h-4 border-2 border-[#191c1e] accent-[#ccff00] cursor-pointer shrink-0"
                    />
                    <span className="text-xs font-bold italic text-[#444933] leading-tight">
                      Incluir matriz de conformidade no questionário<br />
                      <span className="font-normal not-italic text-[#747a60]">EPI · Estaiamentos · Conduta · Faltas/Atrasos · Destaque</span>
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
                        <p className="text-xs font-bold italic truncate">
                          {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
                        </p>
                        {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
                          <p className="text-[10px] italic text-[#747a60] truncate">Para: {t.recipientName}</p>
                        )}
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
                setPublicLinkIncludeConformity(false);
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
                    { recipientName: publicLinkRecipientName.trim(), criterionIds: publicLinkDialogCriteriaIds ?? undefined, includeConformity: publicLinkIncludeConformity || undefined },
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
                        {answered.usedAt ? ` em ${new Date(answered.usedAt).toLocaleDateString("pt-BR")}` : ""}. Não é possível gerar outro link.
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
                          onClick={() => { navigator.clipboard.writeText(shownUrl); setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2500); }}
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
                              <p className="text-xs font-bold italic truncate">{t.recipientName ?? "—"}</p>
                              <p className="text-[10px] italic text-[#747a60]">
                                Enviado {new Date(t.createdAt ?? "").toLocaleDateString("pt-BR")}
                                {t.usedAt ? ` · Respondido ${new Date(t.usedAt).toLocaleDateString("pt-BR")}` : ""}
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

      {/* Admin link dialog — gera link público para qualquer avaliador designado */}
      <Dialog
        open={adminLinkDialog !== null}
        onOpenChange={(v) => {
          if (!v) {
            setAdminLinkDialog(null);
            setAdminLinkForUserId(null);
            setAdminLinkUrl(null);
            setAdminLinkCopied(false);
          }
        }}
      >
        <DialogContent className="max-w-md rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
          <DialogHeader>
            <DialogTitle className="text-xl italic uppercase font-black tracking-tight flex items-center gap-2">
              <Link2 size={18} /> Link de Avaliação
            </DialogTitle>
          </DialogHeader>
          {adminLinkDialog && (
            <div className="space-y-4 pt-2">
              <div className="border-l-4 border-[#ccff00] pl-3">
                <p className="text-[10px] font-bold italic uppercase text-[#747a60]">Formulário</p>
                <p className="text-sm font-black italic uppercase">{adminLinkDialog.areaName}</p>
              </div>

              {adminLinkDialog.assigned.length > 1 && !adminLinkUrl && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-black italic uppercase text-[#747a60]">Gerar link para</p>
                  <div className="space-y-1 border-2 border-[#191c1e] p-2">
                    {adminLinkDialog.assigned.map(a => (
                      <label key={a.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-[#f2f4f6] px-2 py-1.5">
                        <input
                          type="radio"
                          name="adminLinkUser"
                          checked={adminLinkForUserId === a.id}
                          onChange={() => setAdminLinkForUserId(a.id)}
                          className="accent-[#506600]"
                        />
                        <span className="text-sm font-bold italic uppercase">{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {adminLinkDialog.assigned.length === 1 && !adminLinkUrl && (
                <div className="bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3 flex items-center gap-2">
                  <User size={14} />
                  <span className="text-sm font-black italic uppercase">{adminLinkDialog.assigned[0].name}</span>
                </div>
              )}

              {!adminLinkUrl ? (
                <>
                  {(() => {
                    const existingTokens = (allPublicTokens ?? []).filter(t =>
                      t.tokenType === "criteria" &&
                      !t.usedAt &&
                      t.createdByUserId === adminLinkForUserId &&
                      (t.criterionIds ?? []).some(id => adminLinkDialog.criterionIds.includes(id))
                    );
                    return existingTokens.length > 0 ? (
                      <div className="bg-[#fffde7] border-2 border-[#f5c518] px-4 py-3 space-y-2">
                        <p className="text-[10px] font-black italic uppercase text-[#7a6000]">
                          Link pendente existente
                        </p>
                        {existingTokens.map(t => {
                          const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                          const url = `${base}/eval/${t.id}`;
                          return (
                            <div key={t.id} className="flex items-center gap-2">
                              <input readOnly value={url} className="flex-1 min-w-0 bg-white border-2 border-[#191c1e] px-2 py-1.5 text-xs font-mono truncate" />
                              <button
                                type="button"
                                onClick={() => { navigator.clipboard.writeText(url); toast({ title: "Link copiado!" }); }}
                                className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-2 border-[#191c1e] bg-white hover:bg-[#f7ffd1] text-[11px] font-black uppercase"
                              >
                                <Copy size={12} /> Copiar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                  <p className="text-sm italic text-[#444933]">
                    Gere um link único para que o avaliador (ou qualquer pessoa) responda este formulário sem precisar fazer login. O link expira após o primeiro uso.
                  </p>
                  <DialogFooter className="gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setAdminLinkDialog(null); setAdminLinkForUserId(null); }}
                      className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={!adminLinkForUserId || createAdminPublicToken.isPending}
                      onClick={() => {
                        if (!adminLinkForUserId) return;
                        const selectedUser = adminLinkDialog.assigned.find(a => a.id === adminLinkForUserId);
                        createAdminPublicToken.mutate(
                          { assignedToUserId: adminLinkForUserId, criterionIds: adminLinkDialog.criterionIds, recipientName: selectedUser?.name },
                          {
                            onSuccess: ({ tokenId }) => {
                              const base = window.location.origin + (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
                              setAdminLinkUrl(`${base}/eval/${tokenId}`);
                            },
                            onError: (e) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
                          }
                        );
                      }}
                      className="flex items-center gap-2 px-5 py-2.5 border-2 border-[#191c1e] bg-[#191c1e] text-[#ccff00] font-bold italic uppercase text-xs hover:bg-[#ccff00] hover:text-[#191c1e] transition-colors disabled:opacity-50"
                    >
                      {createAdminPublicToken.isPending ? "Gerando..." : <><Link2 size={13} /> Gerar Link</>}
                    </button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <div className="bg-[#f2ffd6] border-2 border-[#506600] px-4 py-4 space-y-3">
                    <p className="text-[10px] font-black italic uppercase text-[#506600]">Link gerado com sucesso</p>
                    <div className="flex items-center gap-2">
                      <input readOnly value={adminLinkUrl} className="flex-1 min-w-0 bg-white border-2 border-[#191c1e] px-2 py-1.5 text-xs font-mono truncate" />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(adminLinkUrl);
                          setAdminLinkCopied(true);
                          setTimeout(() => setAdminLinkCopied(false), 2000);
                        }}
                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-2 border-[#191c1e] bg-white hover:bg-[#f7ffd1] text-[11px] font-black uppercase transition-colors"
                      >
                        <Copy size={12} /> {adminLinkCopied ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                    <p className="text-[10px] italic text-[#506600]">
                      Envie este link para o avaliador ou qualquer pessoa que deva preencher o formulário. Ele expira após o primeiro uso.
                    </p>
                  </div>
                  <DialogFooter className="pt-2">
                    <button
                      type="button"
                      onClick={() => { setAdminLinkDialog(null); setAdminLinkForUserId(null); setAdminLinkUrl(null); setAdminLinkCopied(false); }}
                      className="border-2 border-[#191c1e] px-5 py-2.5 font-bold italic uppercase text-xs hover:bg-[#f2f4f6] transition-colors"
                    >
                      Fechar
                    </button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
