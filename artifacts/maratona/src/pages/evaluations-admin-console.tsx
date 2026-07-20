import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  useGetEvents, useGetEvent, useGetUsers, useConfirmEventResults,
  useSetConformityEvaluator, useSetConformityEvaluatorFerramentas,
  getEventCriteria, getEvaluations, getGetEvaluationsQueryKey, getGetEventsQueryKey, getGetEventQueryKey,
} from "@workspace/api-client-react";
import {
  getEventCriterionAssignments, eventCriterionAssignmentsKey,
  usePatchCriterionAssignment, useUsersByArea,
  useCreateAdminPublicToken, useAllPublicTokens,
  useCreateConformityPublicToken, useCreateFerramentasPublicToken,
  type PublicToken,
} from "@/lib/routing-api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Search, MapPin, CheckCircle2, ClipboardCheck, Table2, Users, Clock, Link2, Copy, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";
const CENOGRAFIA_AREA_ID = 13;
const FERRAMENTAS_AREA_ID = 16;

type CritState = "unassigned" | "pending" | "partial" | "done";

const STATE_CFG: Record<CritState, { label: string; bg: string; color: string; accent: string }> = {
  done: { label: "Completo", bg: "#ecffb0", color: "#3f5200", accent: "#506600" },
  partial: { label: "Parcial", bg: "#ffdbd1", color: "#862200", accent: "#f28b6a" },
  pending: { label: "Aguardando", bg: "#eef0f2", color: "#747a60", accent: "#c8cbd0" },
  unassigned: { label: "Sem avaliador", bg: "#ffe0e0", color: "#ba1a1a", accent: "#ba1a1a" },
};

interface CritRow {
  criterionId: number;
  criterionName: string;
  areaId: number | null;
  areaName: string;
  assignedToId: number | null;
  assignedToName: string | null;
  state: CritState;
  submittedAt: string | null;
}

interface EnrichedEvent {
  id: number;
  name: string;
  clientName: string | null;
  city: string | null;
  state: string | null;
  status: string;
  criteria: CritRow[];
  total: number;
  done: number;
  unassigned: number;
  pct: number;
  areaNames: string[];
  evaluatorNames: string[];
  isDone: boolean;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

/** Picker inline de avaliadores de uma área — usado para atribuir critérios e a matriz de conformidade. */
function InlinePicker({ areaId, excludeId, onPick }: { areaId: number; excludeId?: number | null; onPick: (userId: number, name: string) => void }) {
  const { data: users, isLoading } = useUsersByArea(areaId);
  const candidates = (users ?? []).filter(u => u.id !== excludeId);
  if (isLoading) return <p className="text-[10px] italic text-[#747a60]">Carregando avaliadores...</p>;
  if (candidates.length === 0) return <p className="text-[10px] italic text-[#747a60]">Nenhum avaliador ativo nesta área.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidates.map(u => (
        <button
          key={u.id}
          type="button"
          onClick={() => onPick(u.id, u.name)}
          className="border-2 border-[#191c1e] bg-white px-2.5 py-1.5 text-[11px] font-bold italic hover:bg-[#ccff00] transition-colors"
        >
          + {u.name}
        </button>
      ))}
    </div>
  );
}

export function AdminEvaluationsConsole() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = !!user && ["admin", "rh"].includes(user.role);

  const [view, setView] = useState<"assign" | "table" | "people">("assign");
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [evaluatorFilter, setEvaluatorFilter] = useState("");
  const [sort, setSort] = useState<"name" | "pct" | "pending">("name");
  const [critFilter, setCritFilter] = useState<"all" | "unassigned" | "pending" | "partial" | "done">("all");
  const [openPickerCriterionId, setOpenPickerCriterionId] = useState<number | null>(null);
  const [openConformityPicker, setOpenConformityPicker] = useState<"cenografia" | "ferramentas" | null>(null);

  // --- Link Freelancer dialog (critério) ---
  const [linkDialog, setLinkDialog] = useState<{ criterionIds: number[]; criterionNames: string[]; assignedToId: number; assignedToName: string; includeConformity: boolean } | null>(null);
  const [linkRecipientName, setLinkRecipientName] = useState("");
  const [generatedLinkUrl, setGeneratedLinkUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // --- Link dialog para Matriz de Conformidade ---
  const [conformityLinkDialog, setConformityLinkDialog] = useState<{ key: "cenografia" | "ferramentas"; label: string; evaluatorId: number | null; evaluatorName: string | null } | null>(null);
  const [conformityLinkRecipientName, setConformityLinkRecipientName] = useState("");
  const [conformityLinkUrl, setConformityLinkUrl] = useState<string | null>(null);
  const [conformityLinkCopied, setConformityLinkCopied] = useState(false);

  const { data: events } = useGetEvents(undefined, { query: { queryKey: getGetEventsQueryKey() } });
  const { data: allUsers } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });

  const configuredEvents = (events ?? []).filter(e => e.status === "open" || e.status === "closed");

  const criteriaQueries = useQueries({
    queries: configuredEvents.map(ev => ({
      queryKey: ["event-criteria", ev.id] as unknown[],
      queryFn: () => getEventCriteria(ev.id),
    })),
  });
  const assignQueries = useQueries({
    queries: configuredEvents.map(ev => ({
      queryKey: eventCriterionAssignmentsKey(ev.id),
      queryFn: () => getEventCriterionAssignments(ev.id),
    })),
  });
  const evalQueries = useQueries({
    queries: configuredEvents.map(ev => ({
      queryKey: getGetEvaluationsQueryKey({ eventId: ev.id }),
      queryFn: () => getEvaluations({ eventId: ev.id }),
    })),
  });

  // Enriquece cada evento com o status real de cada critério (atribuído +
  // enviado), combinando roteamento (quem está designado) com o envio de
  // fato (evaluations). A tabela de atribuições NUNCA marca "submitted" —
  // isso só existe na avaliação em si.
  const enrichedEvents: EnrichedEvent[] = useMemo(() => {
    return configuredEvents.map((ev, i) => {
      const criteria = (criteriaQueries[i]?.data ?? []).filter(c => c.active);
      const assignments = assignQueries[i]?.data ?? [];
      const assignByCrit = new Map(assignments.map(a => [a.criterionId, a]));
      const evalsForEvent = evalQueries[i]?.data ?? [];
      const rows: CritRow[] = criteria.map(c => {
        const a = assignByCrit.get(c.criterionId);
        const assignedToId = a?.assignedToId ?? null;
        const assignedToName = a?.assignedToName ?? null;
        const evalRow = assignedToId != null
          ? evalsForEvent.find(e => e.criterionId === c.criterionId && e.evaluatorUserId === assignedToId)
          : undefined;
        let state: CritState;
        if (assignedToId == null) state = "unassigned";
        else if (evalRow?.status === "submitted") state = "done";
        else if (evalRow?.status === "draft") state = "partial";
        else state = "pending";
        return {
          criterionId: c.criterionId,
          criterionName: c.criterionName,
          areaId: c.responsibleAreaId ?? null,
          areaName: c.responsibleAreaName ?? "Sem área",
          assignedToId, assignedToName, state,
          submittedAt: evalRow?.submittedAt ?? null,
        };
      });
      const total = rows.length;
      const done = rows.filter(r => r.state === "done").length;
      const unassigned = rows.filter(r => r.state === "unassigned").length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        id: ev.id, name: ev.name, clientName: ev.clientName ?? null, city: ev.city ?? null, state: ev.state ?? null,
        status: ev.status, criteria: rows, total, done, unassigned, pct,
        areaNames: [...new Set(rows.map(r => r.areaName))],
        evaluatorNames: [...new Set(rows.map(r => r.assignedToName).filter((n): n is string => !!n))],
        isDone: total > 0 && done === total,
      };
    });
  }, [configuredEvents, criteriaQueries, assignQueries, evalQueries]);

  const selected = enrichedEvents.find(e => e.id === selectedEventId) ?? enrichedEvents[0] ?? null;

  const todoEvents = enrichedEvents.filter(e => !e.isDone);
  const doneEvents = enrichedEvents.filter(e => e.isDone);
  const baseTab = tab === "done" ? doneEvents : todoEvents;

  const areaOptions = [...new Set(enrichedEvents.flatMap(e => e.areaNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const evaluatorOptions = [...new Set(enrichedEvents.flatMap(e => e.evaluatorNames))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const hasFilters = !!(q || areaFilter || evaluatorFilter);

  const qNorm = q.trim().toLowerCase();
  const queueEvents = baseTab
    .filter(e =>
      (!qNorm || e.name.toLowerCase().includes(qNorm))
      && (!areaFilter || e.areaNames.includes(areaFilter))
      && (!evaluatorFilter || e.evaluatorNames.includes(evaluatorFilter)),
    )
    .slice()
    .sort((a, b) => {
      if (sort === "pct") return a.pct - b.pct;
      if (sort === "pending") return (b.total - b.done) - (a.total - a.done);
      return a.name.localeCompare(b.name, "pt-BR");
    });

  // ---- Selected event detail (matriz de conformidade + confirmar resultados) ----
  const { data: selectedDetail } = useGetEvent(selected?.id ?? 0, {
    query: { enabled: !!selected, queryKey: getGetEventQueryKey(selected?.id ?? 0) },
  });
  const patchAssignment = usePatchCriterionAssignment(selected?.id ?? 0);
  const setConformityEvaluatorMutation = useSetConformityEvaluator({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selected!.id) }); setOpenConformityPicker(null); toast({ title: "Avaliador de Cenografia atualizado" }); },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });
  const setConformityEvaluatorFerramentasMutation = useSetConformityEvaluatorFerramentas({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(selected!.id) }); setOpenConformityPicker(null); toast({ title: "Avaliador de Ferramentas atualizado" }); },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });
  const confirmResults = useConfirmEventResults({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(selected!.id) });
        toast({
          title: "Resultados confirmados",
          description: data.warnings && data.warnings.length > 0 ? data.warnings.join(" ") : "O evento agora conta na elegibilidade dos colaboradores.",
        });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao confirmar", description: e.message, variant: "destructive" }),
    },
  });

  const createAdminToken = useCreateAdminPublicToken(selected?.id ?? 0);
  const { data: allTokens, refetch: refetchAllTokens } = useAllPublicTokens(linkDialog != null ? (selected?.id ?? null) : null);
  const createConformityToken = useCreateConformityPublicToken(selected?.id ?? 0);
  const createFerramentasToken = useCreateFerramentasPublicToken(selected?.id ?? 0);

  function openLinkDialog(c: CritRow) {
    if (!c.assignedToId || !c.assignedToName) return;
    // Bundle all criteria from the same area+evaluator into a single questionnaire
    const siblings = (selected?.criteria ?? []).filter(
      r => r.areaId === c.areaId && r.assignedToId === c.assignedToId,
    );
    const criterionIds = siblings.length > 1 ? siblings.map(r => r.criterionId) : [c.criterionId];
    const criterionNames = siblings.length > 1 ? siblings.map(r => r.criterionName) : [c.criterionName];
    const includeConformity = c.areaId === CENOGRAFIA_AREA_ID;
    setLinkDialog({ criterionIds, criterionNames, assignedToId: c.assignedToId, assignedToName: c.assignedToName, includeConformity });
    setLinkRecipientName("");
    setGeneratedLinkUrl(null);
    setLinkCopied(false);
    refetchAllTokens();
  }

  function handleGenerateLink() {
    if (!linkDialog || !selected) return;
    createAdminToken.mutate(
      { assignedToUserId: linkDialog.assignedToId, criterionIds: linkDialog.criterionIds, recipientName: linkRecipientName.trim() || undefined, includeConformity: linkDialog.includeConformity },
      {
        onSuccess: (data) => {
          const url = `${window.location.origin}/eval/${data.tokenId}`;
          setGeneratedLinkUrl(url);
          refetchAllTokens();
        },
        onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
      },
    );
  }

  function handleGenerateConformityLink() {
    if (!conformityLinkDialog || !selected) return;
    const recipientName = conformityLinkRecipientName.trim();
    if (!recipientName) { toast({ title: "Informe o nome do destinatário", variant: "destructive" }); return; }
    const mut = conformityLinkDialog.key === "cenografia" ? createConformityToken : createFerramentasToken;
    mut.mutate(
      { recipientName },
      {
        onSuccess: (data) => {
          const url = `${window.location.origin}/eval/${data.tokenId}`;
          setConformityLinkUrl(url);
        },
        onError: (e: Error) => toast({ title: "Erro ao gerar link", description: e.message, variant: "destructive" }),
      },
    );
  }

  function handleAssign(criterionId: number, userId: number) {
    if (!selected) return;
    patchAssignment.mutate(
      { criterionId, assignedToId: userId, action: "assign" },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetEventsQueryKey() });
          setOpenPickerCriterionId(null);
          toast({ title: "Avaliador atribuído" });
        },
        onError: (e: Error) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
      },
    );
  }

  const critFilterLabelMap: Record<string, CritState> = { unassigned: "unassigned", pending: "pending", partial: "partial", done: "done" };
  const filteredCriteria = selected
    ? (critFilter === "all" ? selected.criteria : selected.criteria.filter(c => c.state === critFilterLabelMap[critFilter]))
    : [];
  const critPillCounts = selected
    ? {
        all: selected.total,
        unassigned: selected.criteria.filter(c => c.state === "unassigned").length,
        pending: selected.criteria.filter(c => c.state === "pending").length,
        partial: selected.criteria.filter(c => c.state === "partial").length,
        done: selected.done,
      }
    : { all: 0, unassigned: 0, pending: 0, partial: 0, done: 0 };

  // ---- Matriz de conformidade (Cenografia + Ferramentas) ----
  const conformity = selectedDetail?.conformity ?? null;
  const cenografiaFilled = conformity
    ? [conformity.epi, conformity.estaiamentos, conformity.conduta, conformity.standoutResponse].filter(v => v != null).length
      + (conformity.absencesReport?.trim() ? 1 : 0)
    : 0;
  const ferramentasFilled = conformity?.guardaEquipamentos != null ? 1 : 0;
  const conformityRows = [
    {
      key: "cenografia" as const,
      name: "Matriz de Conformidade",
      scope: "Cenografia · 5 itens",
      evaluatorId: selectedDetail?.conformityEvaluatorUserId ?? null,
      evaluatorName: selectedDetail?.conformityEvaluatorName ?? null,
      filled: cenografiaFilled, total: 5,
      areaId: CENOGRAFIA_AREA_ID,
    },
    {
      key: "ferramentas" as const,
      name: "Guarda de Ferramentas",
      scope: "Ferramentas e Case · 1 item",
      evaluatorId: selectedDetail?.conformityEvaluatorFerramentasUserId ?? null,
      evaluatorName: selectedDetail?.conformityEvaluatorFerramentasName ?? null,
      filled: ferramentasFilled, total: 1,
      areaId: FERRAMENTAS_AREA_ID,
    },
  ];

  // ---- KPIs ----
  const pendingEvaluatorNames = useMemo(() => {
    const map = new Map<number, { name: string; assigned: number; submitted: number }>();
    for (const ev of enrichedEvents) {
      for (const c of ev.criteria) {
        if (c.assignedToId == null || !c.assignedToName) continue;
        const cur = map.get(c.assignedToId) ?? { name: c.assignedToName, assigned: 0, submitted: 0 };
        cur.assigned++;
        if (c.state === "done") cur.submitted++;
        map.set(c.assignedToId, cur);
      }
    }
    return map;
  }, [enrichedEvents]);
  const pendingEvaluatorsCount = [...pendingEvaluatorNames.values()].filter(v => v.submitted < v.assigned).length;

  // ---- Aba Avaliadores: agregação cross-evento por pessoa ----
  const evaluatorCards = useMemo(() => {
    const evaluatorUsers = (allUsers ?? []).filter(u => u.role === "avaliador" && u.active);
    return evaluatorUsers
      .map(u => {
        const stats = pendingEvaluatorNames.get(u.id);
        if (!stats) return null;
        const pct = stats.assigned > 0 ? Math.round((stats.submitted / stats.assigned) * 100) : 0;
        let st: "ok" | "pending" | "late";
        if (stats.submitted === stats.assigned) st = "ok";
        else if (stats.submitted === 0) st = "late";
        else st = "pending";
        const cfg = {
          ok: { label: "Em dia", bg: "#ecffb0", color: "#3f5200", accent: "#506600", bar: "#a8e000" },
          pending: { label: "Pendente", bg: "#ffdbd1", color: "#862200", accent: "#f28b6a", bar: "#f28b6a" },
          late: { label: "Atrasado", bg: "#ffe0e0", color: "#ba1a1a", accent: "#ba1a1a", bar: "#ba1a1a" },
        }[st];
        return { id: u.id, name: u.name, area: u.areaName ?? "—", assigned: stats.assigned, submitted: stats.submitted, pct, ...cfg };
      })
      .filter((v): v is NonNullable<typeof v> => v != null)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [allUsers, pendingEvaluatorNames]);

  return (
    <div className="space-y-5">
      {/* Header: título + switcher de abas */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black italic uppercase tracking-tight">Central de Avaliações</h1>
          <p className="text-[11px] font-bold italic uppercase text-[#747a60] mt-0.5">Acompanhe o progresso e atribua avaliadores</p>
        </div>
        <div className="flex border-2 border-[#191c1e] shrink-0">
          {([
            { key: "assign", label: "Atribuição", Icon: ClipboardCheck },
            { key: "table", label: "Tabela", Icon: Table2 },
            { key: "people", label: "Avaliadores", Icon: Users },
          ] as const).map((v, idx) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "px-3.5 py-2 text-[11px] font-black italic uppercase flex items-center gap-1.5 transition-colors",
                idx < 2 && "border-r-2 border-[#191c1e]",
                view === v.key ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#191c1e] hover:bg-[#f2f4f6]",
              )}
            >
              <v.Icon size={13} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border-2 border-[#191c1e] p-3.5 shadow-[3px_3px_0px_0px_#191c1e]">
          <div className="text-3xl font-black italic leading-none">{todoEvents.length}</div>
          <div className="text-[10px] font-bold italic uppercase text-[#747a60] mt-1">Eventos abertos</div>
        </div>
        <div className="bg-white border-2 border-[#191c1e] p-3.5 shadow-[3px_3px_0px_0px_#191c1e]">
          <div className="text-3xl font-black italic leading-none text-[#506600]">{selected ? `${selected.pct}%` : "—"}</div>
          <div className="text-[10px] font-bold italic uppercase text-[#747a60] mt-1">Concluído no evento</div>
        </div>
        <div className="bg-white border-2 border-[#191c1e] p-3.5 shadow-[3px_3px_0px_0px_#191c1e]">
          <div className="text-3xl font-black italic leading-none text-[#862200]">{pendingEvaluatorsCount}</div>
          <div className="text-[10px] font-bold italic uppercase text-[#747a60] mt-1">Avaliadores pendentes</div>
        </div>
        <div className="bg-white border-2 border-[#191c1e] p-3.5 shadow-[3px_3px_0px_0px_#191c1e]">
          <div className={cn("text-3xl font-black italic leading-none", (selected?.unassigned ?? 0) > 0 ? "text-[#ba1a1a]" : "text-[#191c1e]")}>{selected?.unassigned ?? 0}</div>
          <div className="text-[10px] font-bold italic uppercase text-[#747a60] mt-1">Critérios sem avaliador</div>
        </div>
      </div>

      {enrichedEvents.length === 0 ? (
        <div className="text-center py-20 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60]">
          Nenhum evento liberado para avaliação no momento.
        </div>
      ) : view === "assign" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Coluna esquerda — fila de eventos */}
          <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
            <div className="p-3.5 pb-0">
              <p className="text-[11px] font-black italic uppercase tracking-wide text-[#747a60] mb-2.5">Eventos do ciclo</p>
              <div className="flex border-2 border-[#191c1e]">
                <button type="button" onClick={() => setTab("todo")} className={cn("flex-1 border-r-2 border-[#191c1e] py-2 text-[10.5px] font-black italic uppercase", tab === "todo" ? "bg-[#ccff00]" : "bg-white")}>
                  Em aberto · {todoEvents.length}
                </button>
                <button type="button" onClick={() => setTab("done")} className={cn("flex-1 py-2 text-[10.5px] font-black italic uppercase", tab === "done" ? "bg-[#ccff00]" : "bg-white")}>
                  Concluídos · {doneEvents.length}
                </button>
              </div>

              <div className="mt-2.5 flex flex-col gap-2 pb-3 border-b-2 border-[#191c1e]">
                <div className="flex items-center gap-1.5 border-2 border-[#191c1e] px-2.5 py-1.5">
                  <Search size={14} className="text-[#747a60] shrink-0" />
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Buscar evento..."
                    className="border-0 outline-none flex-1 min-w-0 text-xs font-semibold italic bg-transparent"
                  />
                </div>
                <div className="flex gap-2">
                  <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="flex-1 min-w-0 border-2 border-[#191c1e] bg-white px-2 py-1.5 text-[10px] font-black italic uppercase">
                    <option value="">Todas as áreas</option>
                    {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={evaluatorFilter} onChange={e => setEvaluatorFilter(e.target.value)} className="flex-1 min-w-0 border-2 border-[#191c1e] bg-white px-2 py-1.5 text-[10px] font-black italic uppercase">
                    <option value="">Todos avaliadores</option>
                    {evaluatorOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="border-2 border-[#191c1e] bg-white px-2 py-1.5 text-[10px] font-black italic uppercase">
                  <option value="name">Ordenar · Nome</option>
                  <option value="pct">Ordenar · Menor progresso</option>
                  <option value="pending">Ordenar · Mais pendências</option>
                </select>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black italic uppercase text-[#747a60]">{queueEvents.length} evento(s)</span>
                  {hasFilters && (
                    <button type="button" onClick={() => { setQ(""); setAreaFilter(""); setEvaluatorFilter(""); }} className="border-2 border-[#191c1e] bg-white px-2.5 py-1 text-[9.5px] font-black italic uppercase hover:bg-[#ccff00]">
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-3 flex flex-col gap-2.5 max-h-[600px] overflow-y-auto">
              {queueEvents.length === 0 ? (
                <div className="border-2 border-dashed border-[#c8cbd0] bg-[#fafbfc] py-5 px-3.5 text-center text-[11px] font-bold italic uppercase text-[#747a60]">
                  Nenhum evento encontrado
                </div>
              ) : queueEvents.map(ev => {
                const st: CritState = ev.total === 0 ? "unassigned" : ev.isDone ? "done" : ev.done > 0 ? "partial" : "pending";
                const cfg = STATE_CFG[st];
                const isSel = selected?.id === ev.id;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEventId(ev.id)}
                    style={{ borderLeftColor: cfg.accent }}
                    className={cn("block w-full text-left border-2 border-[#191c1e] border-l-[5px] px-3 py-2.5", isSel ? "bg-[#f7ffd1]" : "bg-white")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black italic uppercase text-[13.5px] leading-tight">{ev.name}</span>
                      <span className="font-black italic text-xs shrink-0" style={{ color: cfg.accent }}>{ev.pct}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 my-1.5">
                      <MapPin size={11} className="text-[#747a60] shrink-0" />
                      <span className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">{[ev.city, ev.clientName].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#eceef0] border border-[#c8cbd0] overflow-hidden">
                        <div className="h-full" style={{ width: `${ev.pct}%`, background: cfg.accent }} />
                      </div>
                      <span className="text-[10px] font-black italic text-[#444933] shrink-0">{ev.done}/{ev.total}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna direita — matriz de atribuição do evento selecionado */}
          {selected && (
            <div className={`bg-white border-2 border-[#191c1e] ${HARD_SHADOW}`}>
              <div className="px-[18px] py-4 border-b-2 border-[#191c1e]">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black italic uppercase px-2 py-0.5" style={{ background: STATE_CFG[selected.isDone ? "done" : selected.done > 0 ? "partial" : "pending"].bg, color: STATE_CFG[selected.isDone ? "done" : selected.done > 0 ? "partial" : "pending"].color }}>
                        {selected.isDone ? "Concluído" : selected.done > 0 ? "Em andamento" : "A fazer"}
                      </span>
                      <span className="text-[10px] font-bold italic uppercase text-[#747a60]">{[selected.clientName, selected.city].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                    <h2 className="text-xl font-black italic uppercase tracking-tight mt-1.5">{selected.name}</h2>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      disabled={!selected.isDone || confirmResults.isPending}
                      onClick={() => confirmResults.mutate({ id: selected.id })}
                      className={cn(
                        "shrink-0 flex items-center gap-2 border-2 px-[18px] py-[11px] text-xs font-black italic uppercase tracking-wide transition-all",
                        selected.isDone ? `bg-[#ccff00] text-[#161e00] border-[#191c1e] ${HARD_SHADOW}` : "bg-[#eef0f2] text-[#9aa0a6] border-[#c8cbd0] cursor-not-allowed",
                      )}
                    >
                      <CheckCircle2 size={15} /> {confirmResults.isPending ? "Confirmando..." : "Confirmar Resultados"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3.5">
                  <div className="flex-1 h-2.5 bg-[#eceef0] border-2 border-[#191c1e] overflow-hidden">
                    <div className="h-full bg-[#a8e000]" style={{ width: `${selected.pct}%` }} />
                  </div>
                  <span className="text-[13px] font-black italic">{selected.pct}%</span>
                  <span className="text-[10.5px] font-bold italic uppercase text-[#747a60] whitespace-nowrap">{selected.done} de {selected.total} critérios completos</span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-2.5 mb-3 flex-wrap">
                  <p className="text-[10px] font-black italic uppercase tracking-wide text-[#747a60]">Critérios por área</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { key: "all", label: "Todos" },
                      { key: "unassigned", label: "Sem avaliador" },
                      { key: "pending", label: "Aguardando" },
                      { key: "partial", label: "Parcial" },
                      { key: "done", label: "Completo" },
                    ] as const).map(p => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setCritFilter(p.key)}
                        className={cn(
                          "border-2 border-[#191c1e] px-2.5 py-1 text-[9.5px] font-black italic uppercase",
                          critFilter === p.key ? "bg-[#191c1e] text-[#ccff00]" : "bg-white text-[#191c1e]",
                        )}
                      >
                        {p.label} · {critPillCounts[p.key]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {filteredCriteria.length === 0 ? (
                    <div className="border-2 border-dashed border-[#c8cbd0] bg-[#fafbfc] py-4 px-3.5 text-center text-[11px] font-bold italic uppercase text-[#747a60]">
                      Nenhum critério neste filtro
                    </div>
                  ) : filteredCriteria.map(c => {
                    const cfg = STATE_CFG[c.state];
                    const pickerOpen = openPickerCriterionId === c.criterionId;
                    return (
                      <div key={c.criterionId} className="border-2 border-[#191c1e] border-l-[5px] bg-white px-3.5 py-3" style={{ borderLeftColor: cfg.accent }}>
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] font-bold italic uppercase text-[#747a60] border-[1.5px] border-[#c8cbd0] px-1.5 py-0.5 whitespace-nowrap">{c.areaName}</span>
                            <span className="font-black italic uppercase text-[14.5px] tracking-tight truncate">{c.criterionName}</span>
                          </div>
                          <span className="whitespace-nowrap text-[9px] font-black italic uppercase px-2.5 py-1" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2.5 mt-2.5 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.assignedToId != null ? (
                              <span className="inline-flex items-center gap-1.5 border-2 border-[#191c1e] bg-[#f7f9fb] px-2.5 py-1 text-[11.5px] font-bold italic">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.state === "done" ? "#a8e000" : "#c8cbd0" }} />
                                {c.assignedToName}
                              </span>
                            ) : (
                              <span className="font-black italic uppercase text-[11px] text-[#ba1a1a]">Nenhum avaliador atribuído</span>
                            )}
                            {c.submittedAt && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold italic text-[#3f5200]">
                                <Clock size={10} /> {fmtDT(c.submittedAt)}
                              </span>
                            )}
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              {c.assignedToId != null && (
                                <button
                                  type="button"
                                  onClick={() => openLinkDialog(c)}
                                  className="border-2 border-[#191c1e] px-2.5 py-1.5 text-[10.5px] font-black italic uppercase bg-white hover:bg-[#f7ffd1] flex items-center gap-1"
                                  title="Gerar link de avaliação para o freelancer"
                                >
                                  <Link2 size={11} /> Link
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                                className={cn(
                                  "border-2 border-[#191c1e] px-3 py-1.5 text-[10.5px] font-black italic uppercase",
                                  c.assignedToId == null ? "bg-[#ccff00] text-[#191c1e]" : "bg-white text-[#191c1e]",
                                )}
                              >
                                {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                              </button>
                            </div>
                          )}
                        </div>
                        {pickerOpen && c.areaId != null && (
                          <div className="mt-2.5 border-t-2 border-dashed border-[#dde0e3] pt-2.5">
                            <p className="text-[9.5px] font-black italic uppercase text-[#747a60] tracking-wide mb-2">Avaliadores disponíveis · {c.areaName}</p>
                            <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] font-black italic uppercase tracking-wide text-[#747a60] mt-[18px] mb-2.5">Matriz de conformidade</p>
                <div className="flex flex-col gap-2.5">
                  {conformityRows.map(cf => {
                    const complete = cf.total > 0 && cf.filled === cf.total;
                    const cfg = cf.evaluatorId == null ? STATE_CFG.unassigned : complete ? STATE_CFG.done : STATE_CFG.partial;
                    const pickerOpen = openConformityPicker === cf.key;
                    return (
                      <div key={cf.key} className="border-2 border-[#191c1e] border-l-[5px] bg-white px-3.5 py-3" style={{ borderLeftColor: cfg.accent }}>
                        <div className="flex items-center justify-between gap-2.5">
                          <div>
                            <div className="font-black italic uppercase text-sm">{cf.name}</div>
                            <div className="text-[9.5px] font-bold italic uppercase text-[#747a60] mt-0.5">{cf.scope} · {cf.evaluatorName ?? "Sem avaliador"}</div>
                          </div>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-[9px] font-black italic uppercase px-2.5 py-1" style={{ background: cfg.bg, color: cfg.color }}>{cf.filled}/{cf.total}</span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => { setConformityLinkDialog({ key: cf.key, label: cf.name, evaluatorId: cf.evaluatorId, evaluatorName: cf.evaluatorName }); setConformityLinkRecipientName(""); setConformityLinkUrl(null); setConformityLinkCopied(false); }}
                                className="border-2 border-[#191c1e] bg-white px-2.5 py-1.5 text-[10.5px] font-black italic uppercase hover:bg-[#f7ffd1] flex items-center gap-1"
                                title="Gerar link de conformidade para freelancer"
                              >
                                <Link2 size={11} /> Link
                              </button>
                            )}
                            {canManage && (
                              <button type="button" onClick={() => setOpenConformityPicker(pickerOpen ? null : cf.key)} className="border-2 border-[#191c1e] bg-white px-3 py-1.5 text-[10.5px] font-black italic uppercase hover:bg-[#ccff00]">
                                {cf.evaluatorId == null ? "Atribuir" : "Trocar"}
                              </button>
                            )}
                          </div>
                        </div>
                        {pickerOpen && (
                          <div className="mt-2.5 border-t-2 border-dashed border-[#dde0e3] pt-2.5">
                            <InlinePicker
                              areaId={cf.areaId}
                              excludeId={cf.evaluatorId}
                              onPick={(uid) => {
                                if (cf.key === "cenografia") setConformityEvaluatorMutation.mutate({ id: selected.id, data: { userId: uid } });
                                else setConformityEvaluatorFerramentasMutation.mutate({ id: selected.id, data: { userId: uid } });
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : view === "table" ? (
        selected && (
          <div>
            <p className="text-[11px] font-bold italic uppercase text-[#747a60] mb-3">
              Acompanhamento — {selected.name} · {selected.done} de {selected.total} critérios completos
            </p>
            <div className={`border-2 border-[#191c1e] bg-white overflow-hidden overflow-x-auto ${HARD_SHADOW}`}>
              <div className="grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] bg-[#191c1e] text-white min-w-[820px]">
                {["Critério", "Área", "Avaliador", "Enviado em", "Status", "Ação"].map((h, i) => (
                  <div key={h} className={cn("px-3.5 py-2.5 text-[10px] font-black italic uppercase tracking-wide", i === 5 && "text-right")}>{h}</div>
                ))}
              </div>
              {selected.criteria.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold italic uppercase text-[#747a60]">Nenhum critério ativo neste evento.</div>
              ) : selected.criteria.map(c => {
                const cfg = STATE_CFG[c.state];
                const pickerOpen = openPickerCriterionId === c.criterionId;
                return (
                  <div key={c.criterionId} className={cn("grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] border-t-2 border-[#eceef0] items-center min-w-[820px]", c.assignedToId == null && "bg-[#fff6f6]")}>
                    <div className="px-3.5 py-3 font-black italic uppercase text-[13px]">{c.criterionName}</div>
                    <div className="px-3.5 py-3 font-bold italic uppercase text-[11px] text-[#747a60]">{c.areaName}</div>
                    <div className="px-3.5 py-3 font-semibold italic text-xs" style={{ color: c.assignedToId == null ? "#ba1a1a" : "#191c1e" }}>{c.assignedToName ?? "Sem avaliador"}</div>
                    <div className="px-3.5 py-3 font-bold italic text-[11px] text-[#444933]">
                      {c.submittedAt ? (
                        <span className="flex items-center gap-1 text-[#3f5200]"><Clock size={10} /> {fmtDT(c.submittedAt)}</span>
                      ) : (
                        <span className="text-[#747a60]">—</span>
                      )}
                    </div>
                    <div className="px-3.5 py-3">
                      <span className="text-[9px] font-black italic uppercase px-2.5 py-1 whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div className="px-3.5 py-3 text-right relative flex items-center justify-end gap-2">
                      {canManage && c.assignedToId != null && (
                        <button
                          type="button"
                          onClick={() => openLinkDialog(c)}
                          className="border-2 border-[#191c1e] px-2 py-1.5 text-[10px] font-black italic uppercase bg-white hover:bg-[#f7ffd1] flex items-center gap-1 whitespace-nowrap"
                          title="Gerar link para freelancer"
                        >
                          <Link2 size={10} /> Link
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                          className={cn("border-2 border-[#191c1e] px-2.5 py-1.5 text-[10px] font-black italic uppercase whitespace-nowrap", c.assignedToId == null ? "bg-[#ccff00]" : "bg-white")}
                        >
                          {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                        </button>
                      )}
                      {pickerOpen && c.areaId != null && (
                        <div className="absolute right-3.5 top-full mt-1 z-10 w-64 border-2 border-[#191c1e] bg-white p-2.5 shadow-[4px_4px_0px_0px_#191c1e] text-left">
                          <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] italic text-[#747a60] mt-3">
              Clique em <b className="text-[#191c1e] not-italic">Atribuir</b> numa linha sem avaliador para escolher quem responde. Troque o evento na aba Atribuição.
            </p>
          </div>
        )
      ) : (
        <div>
          <p className="text-[11px] font-bold italic uppercase text-[#747a60] mb-3.5">Quem está em dia e quem precisa de cobrança neste ciclo</p>
          {evaluatorCards.length === 0 ? (
            <div className="text-center py-16 bg-white border-2 border-[#191c1e] italic uppercase font-bold text-[#747a60]">
              Nenhum avaliador com critérios atribuídos neste ciclo.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {evaluatorCards.map(av => (
                <div key={av.id} className={`bg-white border-2 border-[#191c1e] border-l-[5px] p-4 ${HARD_SHADOW}`} style={{ borderLeftColor: av.accent }}>
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-10 h-10 border-2 border-[#191c1e] bg-[#ccff00] inline-flex items-center justify-center shrink-0 -skew-x-[8deg]">
                      <span className="font-black italic text-[13px] text-[#161e00] skew-x-[8deg]">{initials(av.name)}</span>
                    </span>
                    <div className="min-w-0">
                      <div className="font-black italic uppercase text-[14.5px] leading-tight truncate">{av.name}</div>
                      <div className="text-[9.5px] font-bold italic uppercase text-[#747a60] mt-0.5">{av.area}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-black italic uppercase px-2.5 py-1" style={{ background: av.bg, color: av.color }}>{av.label}</span>
                    <span className="font-black italic text-xs" style={{ color: av.color }}>{av.submitted}/{av.assigned}</span>
                  </div>
                  <div className="h-2.5 bg-[#eceef0] border border-[#c8cbd0] overflow-hidden mb-3.5">
                    <div className="h-full" style={{ width: `${av.pct}%`, background: av.bar }} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toast({ title: `${av.assigned - av.submitted} pendência(s)`, description: `${av.name} ainda não enviou ${av.assigned - av.submitted} de ${av.assigned} critério(s) atribuído(s).` })}
                      className="flex-1 border-2 border-[#191c1e] bg-white py-2 text-[10px] font-black italic uppercase hover:bg-[#ccff00] transition-colors"
                    >
                      Cobrar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEvaluatorFilter(av.name); setView("assign"); }}
                      className="flex-1 border-2 border-[#191c1e] bg-white py-2 text-[10px] font-black italic uppercase hover:bg-[#ccff00] transition-colors"
                    >
                      Reatribuir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Link Freelancer dialog ─────────────────────────────────── */}
      {linkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`bg-white border-2 border-[#191c1e] w-full max-w-md ${HARD_SHADOW}`}>
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#191c1e] bg-[#f7ffd1]">
              <div className="min-w-0">
                <p className="text-[10px] font-black italic uppercase text-[#747a60] tracking-wide">
                  Link Freelancer{linkDialog.criterionIds.length > 1 ? ` · ${linkDialog.criterionIds.length} critérios` : ""}
                </p>
                {linkDialog.criterionNames.length === 1 ? (
                  <h3 className="font-black italic uppercase text-sm truncate">{linkDialog.criterionNames[0]}</h3>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {linkDialog.criterionNames.map((n, i) => (
                      <li key={i} className="font-black italic uppercase text-[12.5px] truncate leading-tight">{n}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] italic text-[#747a60] mt-0.5">Avaliador: <span className="font-bold text-[#191c1e]">{linkDialog.assignedToName}</span></p>
              </div>
              <button
                type="button"
                onClick={() => { setLinkDialog(null); setGeneratedLinkUrl(null); }}
                className="shrink-0 border-2 border-[#191c1e] bg-white p-1.5 hover:bg-[#f2f4f6]"
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* nota de conformidade bundled */}
              {linkDialog?.includeConformity && (
                <div className="border-2 border-[#ccff00] bg-[#f7ffd1] px-3 py-2 text-[10px] italic text-[#3f5200] flex items-start gap-2">
                  <CheckCircle size={13} className="shrink-0 mt-0.5 text-[#506600]" />
                  <span>Este link incluirá o critério <strong>e</strong> a Matriz de Conformidade de Cenografia no mesmo questionário.</span>
                </div>
              )}
              {/* recipient + generate */}
              <div>
                <label className="block text-[10px] font-black italic uppercase text-[#747a60] tracking-wide mb-1.5">
                  Para quem é o link? <span className="font-normal normal-case">(opcional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={linkRecipientName}
                    onChange={e => setLinkRecipientName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleGenerateLink(); }}
                    placeholder="Nome do freelancer"
                    className="flex-1 border-2 border-[#191c1e] px-3 py-2 text-sm font-bold italic focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateLink}
                    disabled={createAdminToken.isPending}
                    className="border-2 border-[#191c1e] bg-[#ccff00] px-3 py-2 text-[10.5px] font-black italic uppercase flex items-center gap-1.5 hover:bg-[#b8e600] disabled:opacity-50"
                  >
                    <Link2 size={12} /> {createAdminToken.isPending ? "Gerando…" : "Gerar Link"}
                  </button>
                </div>
              </div>

              {/* generated URL */}
              {generatedLinkUrl && (
                <div className="border-2 border-[#191c1e] bg-[#f7ffd1] p-3 space-y-2">
                  <p className="text-[10px] font-black italic uppercase text-[#3f5200] tracking-wide">Link gerado — copie e envie</p>
                  <div className="flex gap-2 items-start">
                    <input
                      readOnly
                      value={generatedLinkUrl}
                      className="flex-1 border-2 border-[#191c1e] bg-white px-2 py-1.5 text-xs font-mono truncate focus:outline-none"
                      onFocus={e => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(generatedLinkUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                      className="border-2 border-[#191c1e] bg-white px-3 py-1.5 text-[10px] font-black italic uppercase flex items-center gap-1 hover:bg-[#ccff00] shrink-0"
                    >
                      {linkCopied ? <><CheckCircle size={11} className="text-[#3f5200]" /> Copiado!</> : <><Copy size={11} /> Copiar</>}
                    </button>
                  </div>
                </div>
              )}

              {/* history */}
              {(() => {
                const relevantTokens: (PublicToken & { tokenType: string })[] = (allTokens ?? []).filter(t =>
                  t.tokenType === "criteria" && (t.criterionIds ?? []).includes(linkDialog.criterionId),
                );
                if (relevantTokens.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] font-black italic uppercase text-[#747a60] tracking-wide mb-2">Histórico de links enviados</p>
                    <div className="border-2 border-[#191c1e] divide-y-2 divide-[#eceef0] max-h-48 overflow-y-auto">
                      {relevantTokens.map(t => (
                        <div key={t.id} className="flex items-start justify-between px-3 py-2.5 gap-3 bg-white">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[11px] font-bold italic truncate">
                              {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
                            </p>
                            {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
                              <p className="text-[10px] italic text-[#747a60] truncate">Para: {t.recipientName}</p>
                            )}
                            <p className="text-[10px] italic text-[#9aa08a]">Enviado: {fmtDT(t.createdAt)}</p>
                            {t.usedAt && (
                              <p className="text-[10px] font-bold italic text-[#3f5200]">Respondido: {fmtDT(t.usedAt)}</p>
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
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Conformity Link dialog ─────────────────────────────────── */}
      {conformityLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`bg-white border-2 border-[#191c1e] w-full max-w-md ${HARD_SHADOW}`}>
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#191c1e] bg-[#f7ffd1]">
              <div className="min-w-0">
                <p className="text-[10px] font-black italic uppercase text-[#747a60] tracking-wide">Link Freelancer · Conformidade</p>
                <h3 className="font-black italic uppercase text-sm truncate">{conformityLinkDialog.label}</h3>
                {conformityLinkDialog.evaluatorName && (
                  <p className="text-[10px] italic text-[#747a60] mt-0.5">Avaliador: <span className="font-bold text-[#191c1e]">{conformityLinkDialog.evaluatorName}</span></p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConformityLinkDialog(null)}
                className="shrink-0 ml-3 text-[#747a60] hover:text-[#191c1e]"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {!conformityLinkUrl ? (
                <div>
                  <label className="block text-[10px] font-black italic uppercase text-[#747a60] tracking-wide mb-1.5">
                    Para quem é o link?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={conformityLinkRecipientName}
                      onChange={e => setConformityLinkRecipientName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleGenerateConformityLink(); }}
                      placeholder="Nome do freelancer"
                      className="flex-1 border-2 border-[#191c1e] px-3 py-2 text-sm font-bold italic focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateConformityLink}
                      disabled={createConformityToken.isPending || createFerramentasToken.isPending}
                      className="border-2 border-[#191c1e] bg-[#ccff00] px-3 py-2 text-[10.5px] font-black italic uppercase flex items-center gap-1.5 hover:bg-[#b8e600] disabled:opacity-50"
                    >
                      <Link2 size={12} /> Gerar Link
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-[#191c1e] bg-[#f7ffd1] p-3 space-y-2">
                  <p className="text-[10px] font-black italic uppercase text-[#3f5200] tracking-wide">Link gerado — copie e envie</p>
                  <div className="flex gap-2 items-start">
                    <input
                      readOnly
                      value={conformityLinkUrl}
                      className="flex-1 border-2 border-[#191c1e] bg-white px-2 py-1.5 text-xs font-mono truncate focus:outline-none"
                      onFocus={e => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(conformityLinkUrl); setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2000); }}
                      className="shrink-0 border-2 border-[#191c1e] bg-white px-2.5 py-2 hover:bg-[#ccff00] flex items-center gap-1 text-[10px] font-black italic uppercase"
                    >
                      {conformityLinkCopied ? <><CheckCircle size={12} className="text-green-600" /> Copiado</> : <><Copy size={12} /> Copiar</>}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setConformityLinkUrl(null); setConformityLinkRecipientName(""); }}
                    className="text-[9.5px] font-bold italic uppercase text-[#747a60] underline hover:text-[#191c1e]"
                  >
                    Gerar outro link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
