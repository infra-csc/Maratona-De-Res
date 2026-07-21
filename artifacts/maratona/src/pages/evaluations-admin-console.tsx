import { useMemo, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  useGetEvents, useGetEvent, useGetUsers, useConfirmEventResults, useGetCurrentCycle,
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
import { CONDENSED, WARNING } from "@/lib/premium-theme";

function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
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

const CENOGRAFIA_AREA_ID = 13;
const FERRAMENTAS_AREA_ID = 16;
const AMBER = "#e8a23d";
const GOOD = "#9ab000";

type CritState = "unassigned" | "pending" | "partial" | "done";

const STATE_CFG: Record<CritState, { label: string; bg: string; color: string; accent: string }> = {
  done: { label: "Completo", bg: "rgba(154,176,0,0.14)", color: GOOD, accent: GOOD },
  partial: { label: "Parcial", bg: "rgba(232,162,61,0.14)", color: AMBER, accent: AMBER },
  pending: { label: "Aguardando", bg: "var(--secondary)", color: "var(--muted-foreground)", accent: "var(--border)" },
  unassigned: { label: "Sem avaliador", bg: "rgba(229,72,77,0.12)", color: WARNING, accent: WARNING },
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
  startDate: string | null;
  endDate: string | null;
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

const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

/** Picker inline de avaliadores de uma área — usado para atribuir critérios e a matriz de conformidade. */
function InlinePicker({ areaId, excludeId, onPick }: { areaId: number; excludeId?: number | null; onPick: (userId: number, name: string) => void }) {
  const { data: users, isLoading } = useUsersByArea(areaId);
  const candidates = (users ?? []).filter(u => u.id !== excludeId);
  if (isLoading) return <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Carregando avaliadores...</p>;
  if (candidates.length === 0) return <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Nenhum avaliador ativo nesta área.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidates.map(u => (
        <button
          key={u.id}
          type="button"
          onClick={() => onPick(u.id, u.name)}
          className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors hover:opacity-80"
          style={{ border: "1px solid var(--border)", backgroundColor: "var(--card)" }}
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
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
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
  const { data: cycle } = useGetCurrentCycle();
  const cycleWeekends = getCycleWeekends(cycle?.startDate, cycle?.endDate);

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
        status: ev.status, startDate: ev.startDate ?? null, endDate: ev.endDate ?? null,
        criteria: rows, total, done, unassigned, pct,
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
  const hasFilters = !!(q || areaFilter || evaluatorFilter || filterDateFrom || filterDateTo);

  const qNorm = q.trim().toLowerCase();
  const queueEvents = baseTab
    .filter(e =>
      (!qNorm || e.name.toLowerCase().includes(qNorm))
      && (!areaFilter || e.areaNames.includes(areaFilter))
      && (!evaluatorFilter || e.evaluatorNames.includes(evaluatorFilter))
      && (!filterDateFrom || (e.endDate ?? "") >= filterDateFrom)
      && (!filterDateTo || (e.startDate ?? "") <= filterDateTo),
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
          ok: { label: "Em dia", bg: "rgba(154,176,0,0.14)", color: GOOD, accent: GOOD },
          pending: { label: "Pendente", bg: "rgba(232,162,61,0.14)", color: AMBER, accent: AMBER },
          late: { label: "Atrasado", bg: "rgba(229,72,77,0.12)", color: WARNING, accent: WARNING },
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
          <h1 className="text-2xl font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Central de Avaliações</h1>
          <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: "var(--muted-foreground)" }}>Acompanhe o progresso e atribua avaliadores</p>
        </div>
        <div className="flex rounded-lg overflow-hidden shrink-0" style={{ border: "1px solid var(--border)" }}>
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
                "px-3.5 py-2 text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors",
                idx < 2 && "border-r",
              )}
              style={{
                fontFamily: CONDENSED,
                borderColor: "var(--border)",
                backgroundColor: view === v.key ? "var(--primary)" : "transparent",
                color: view === v.key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              <v.Icon size={13} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED }}>{todoEvents.length}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Eventos abertos</div>
        </div>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{selected ? `${selected.pct}%` : "—"}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Concluído no evento</div>
        </div>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: AMBER }}>{pendingEvaluatorsCount}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Avaliadores pendentes</div>
        </div>
        <div className="rounded-xl p-3.5" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="text-3xl font-black leading-none" style={{ fontFamily: CONDENSED, color: (selected?.unassigned ?? 0) > 0 ? WARNING : "var(--foreground)" }}>{selected?.unassigned ?? 0}</div>
          <div className="text-[10px] font-bold uppercase tracking-wide mt-1" style={{ color: "var(--muted-foreground)" }}>Critérios sem avaliador</div>
        </div>
      </div>

      {enrichedEvents.length === 0 ? (
        <div className="text-center py-20 rounded-xl font-bold uppercase" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
          Nenhum evento liberado para avaliação no momento.
        </div>
      ) : view === "assign" ? (
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
          {/* Coluna esquerda — fila de eventos */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="p-3.5 pb-0">
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2.5" style={{ color: "var(--muted-foreground)" }}>Eventos do ciclo</p>
              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button type="button" onClick={() => setTab("todo")} className="flex-1 py-2 text-[10.5px] font-bold uppercase" style={{ fontFamily: CONDENSED, borderRight: "1px solid var(--border)", backgroundColor: tab === "todo" ? "var(--primary)" : "transparent", color: tab === "todo" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                  Em aberto · {todoEvents.length}
                </button>
                <button type="button" onClick={() => setTab("done")} className="flex-1 py-2 text-[10.5px] font-bold uppercase" style={{ fontFamily: CONDENSED, backgroundColor: tab === "done" ? "var(--primary)" : "transparent", color: tab === "done" ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                  Concluídos · {doneEvents.length}
                </button>
              </div>

              <div className="mt-2.5 flex flex-col gap-2 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5" style={fieldStyle}>
                  <Search size={14} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
                  <input
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    placeholder="Buscar evento..."
                    className="border-0 outline-none flex-1 min-w-0 text-xs font-semibold bg-transparent"
                    style={{ color: "var(--foreground)" }}
                  />
                </div>
                <div className="flex gap-2">
                  <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase" style={fieldStyle}>
                    <option value="">Todas as áreas</option>
                    {areaOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={evaluatorFilter} onChange={e => setEvaluatorFilter(e.target.value)} className="flex-1 min-w-0 rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase" style={fieldStyle}>
                    <option value="">Todos avaliadores</option>
                    {evaluatorOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase" style={fieldStyle}>
                  <option value="name">Ordenar · Nome</option>
                  <option value="pct">Ordenar · Menor progresso</option>
                  <option value="pending">Ordenar · Mais pendências</option>
                </select>
                {cycleWeekends.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Fim de semana:</span>
                    {cycleWeekends.map(w => {
                      const active = filterDateFrom === w.sat && filterDateTo === w.sun;
                      return (
                        <button key={w.sat} type="button"
                          data-testid={`button-filter-weekend-${w.sat}`}
                          onClick={() => { if (active) { setFilterDateFrom(""); setFilterDateTo(""); } else { setFilterDateFrom(w.sat); setFilterDateTo(w.sun); } }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase transition-colors"
                          style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)", border: active ? "1px solid var(--primary)" : "1px solid var(--border)" }}
                        >{w.label}</button>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{queueEvents.length} evento(s)</span>
                  {hasFilters && (
                    <button type="button" onClick={() => { setQ(""); setAreaFilter(""); setEvaluatorFilter(""); setFilterDateFrom(""); setFilterDateTo(""); }} className="rounded-lg px-2.5 py-1 text-[9.5px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
                      Limpar filtros
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-3 flex flex-col gap-2.5 max-h-[600px] overflow-y-auto">
              {queueEvents.length === 0 ? (
                <div className="rounded-lg py-5 px-3.5 text-center text-[11px] font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
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
                    className="block w-full text-left rounded-lg px-3 py-2.5 relative overflow-hidden"
                    style={{ border: "1px solid var(--border)", backgroundColor: isSel ? "var(--secondary)" : "var(--card)" }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold uppercase text-[13.5px] leading-tight min-w-0 break-words">{ev.name}</span>
                      <span className="font-black text-xs shrink-0" style={{ fontFamily: CONDENSED, color: cfg.accent }}>{ev.pct}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 my-1.5">
                      <MapPin size={11} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
                      <span className="text-[10px] font-bold uppercase truncate" style={{ color: "var(--muted-foreground)" }}>{[ev.city, ev.clientName].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                        <div className="h-full rounded-full" style={{ width: `${ev.pct}%`, background: cfg.accent }} />
                      </div>
                      <span className="text-[10px] font-bold shrink-0" style={{ color: "var(--muted-foreground)" }}>{ev.done}/{ev.total}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coluna direita — matriz de atribuição do evento selecionado */}
          {selected && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="px-[18px] py-4" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: STATE_CFG[selected.isDone ? "done" : selected.done > 0 ? "partial" : "pending"].bg, color: STATE_CFG[selected.isDone ? "done" : selected.done > 0 ? "partial" : "pending"].color }}>
                        {selected.isDone ? "Concluído" : selected.done > 0 ? "Em andamento" : "A fazer"}
                      </span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{[selected.clientName, selected.city].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tight mt-1.5" style={{ fontFamily: CONDENSED }}>{selected.name}</h2>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      disabled={!selected.isDone || confirmResults.isPending}
                      onClick={() => confirmResults.mutate({ id: selected.id })}
                      className="shrink-0 flex items-center gap-2 rounded-lg px-[18px] py-[11px] text-xs font-black uppercase tracking-wide transition-opacity disabled:cursor-not-allowed"
                      style={{
                        fontFamily: CONDENSED,
                        backgroundColor: selected.isDone ? "var(--primary)" : "var(--secondary)",
                        color: selected.isDone ? "var(--primary-foreground)" : "var(--muted-foreground)",
                        border: selected.isDone ? "1px solid var(--primary)" : "1px solid var(--border)",
                      }}
                    >
                      <CheckCircle2 size={15} /> {confirmResults.isPending ? "Confirmando..." : "Confirmar Resultados"}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-3.5">
                  <div className="flex-1 h-[7px] rounded-full overflow-hidden" style={{ backgroundColor: "var(--secondary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${selected.pct}%`, backgroundColor: "var(--accent)" }} />
                  </div>
                  <span className="text-[13px] font-black" style={{ fontFamily: CONDENSED }}>{selected.pct}%</span>
                  <span className="text-[10.5px] font-bold uppercase whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>{selected.done} de {selected.total} critérios completos</span>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between gap-2.5 mb-3 flex-wrap">
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Critérios por área</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { key: "all", label: "Todos" },
                      { key: "unassigned", label: "Sem avaliador" },
                      { key: "pending", label: "Aguardando" },
                      { key: "partial", label: "Parcial" },
                      { key: "done", label: "Completo" },
                    ] as const).map(p => {
                      const active = critFilter === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setCritFilter(p.key)}
                          className="rounded-lg px-2.5 py-1 text-[9.5px] font-bold uppercase transition-colors"
                          style={{ backgroundColor: active ? "var(--primary)" : "transparent", color: active ? "var(--primary-foreground)" : "var(--muted-foreground)", border: active ? "1px solid var(--primary)" : "1px solid var(--border)" }}
                        >
                          {p.label} · {critPillCounts[p.key]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {filteredCriteria.length === 0 ? (
                    <div className="rounded-lg py-4 px-3.5 text-center text-[11px] font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
                      Nenhum critério neste filtro
                    </div>
                  ) : filteredCriteria.map(c => {
                    const cfg = STATE_CFG[c.state];
                    const pickerOpen = openPickerCriterionId === c.criterionId;
                    return (
                      <div key={c.criterionId} className="rounded-lg px-3.5 py-3 relative overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] font-bold uppercase rounded px-1.5 py-0.5 whitespace-nowrap" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{c.areaName}</span>
                            <span className="font-black uppercase text-[14.5px] tracking-tight truncate" style={{ fontFamily: CONDENSED }}>{c.criterionName}</span>
                          </div>
                          <span className="whitespace-nowrap text-[9px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2.5 mt-2.5 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {c.assignedToId != null ? (
                              <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-bold" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                                <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.state === "done" ? GOOD : "var(--border)" }} />
                                {c.assignedToName}
                              </span>
                            ) : (
                              <span className="font-bold uppercase text-[11px]" style={{ color: WARNING }}>Nenhum avaliador atribuído</span>
                            )}
                            {c.submittedAt && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: GOOD }}>
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
                                  className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold uppercase flex items-center gap-1 transition-colors hover:opacity-80"
                                  style={{ border: "1px solid var(--border)" }}
                                  title="Gerar link de avaliação para o freelancer"
                                >
                                  <Link2 size={11} /> Link
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                                className="rounded-lg px-3 py-1.5 text-[10.5px] font-bold uppercase transition-opacity hover:opacity-80"
                                style={{
                                  border: c.assignedToId == null ? "1px solid var(--primary)" : "1px solid var(--border)",
                                  backgroundColor: c.assignedToId == null ? "var(--primary)" : "transparent",
                                  color: c.assignedToId == null ? "var(--primary-foreground)" : "var(--foreground)",
                                }}
                              >
                                {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                              </button>
                            </div>
                          )}
                        </div>
                        {pickerOpen && c.areaId != null && (
                          <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed var(--border)" }}>
                            <p className="text-[9.5px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Avaliadores disponíveis · {c.areaName}</p>
                            <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] font-bold uppercase tracking-wide mt-[18px] mb-2.5" style={{ color: "var(--muted-foreground)" }}>Matriz de conformidade</p>
                <div className="flex flex-col gap-2.5">
                  {conformityRows.map(cf => {
                    const complete = cf.total > 0 && cf.filled === cf.total;
                    const cfg = cf.evaluatorId == null ? STATE_CFG.unassigned : complete ? STATE_CFG.done : STATE_CFG.partial;
                    const pickerOpen = openConformityPicker === cf.key;
                    return (
                      <div key={cf.key} className="rounded-lg px-3.5 py-3 relative overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                        <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: cfg.accent }} />
                        <div className="flex items-center justify-between gap-2.5">
                          <div>
                            <div className="font-black uppercase text-sm" style={{ fontFamily: CONDENSED }}>{cf.name}</div>
                            <div className="text-[9.5px] font-bold uppercase mt-0.5" style={{ color: "var(--muted-foreground)" }}>{cf.scope} · {cf.evaluatorName ?? "Sem avaliador"}</div>
                          </div>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{cf.filled}/{cf.total}</span>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => { setConformityLinkDialog({ key: cf.key, label: cf.name, evaluatorId: cf.evaluatorId, evaluatorName: cf.evaluatorName }); setConformityLinkRecipientName(""); setConformityLinkUrl(null); setConformityLinkCopied(false); }}
                                className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold uppercase flex items-center gap-1 transition-colors hover:opacity-80"
                                style={{ border: "1px solid var(--border)" }}
                                title="Gerar link de conformidade para freelancer"
                              >
                                <Link2 size={11} /> Link
                              </button>
                            )}
                            {canManage && (
                              <button type="button" onClick={() => setOpenConformityPicker(pickerOpen ? null : cf.key)} className="rounded-lg px-3 py-1.5 text-[10.5px] font-bold uppercase transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
                                {cf.evaluatorId == null ? "Atribuir" : "Trocar"}
                              </button>
                            )}
                          </div>
                        </div>
                        {pickerOpen && (
                          <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px dashed var(--border)" }}>
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
            <p className="text-[11px] font-bold uppercase mb-3" style={{ color: "var(--muted-foreground)" }}>
              Acompanhamento — {selected.name} · {selected.done} de {selected.total} critérios completos
            </p>
            <div className="rounded-xl overflow-hidden overflow-x-auto" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] min-w-[820px]" style={{ backgroundColor: "var(--secondary)" }}>
                {["Critério", "Área", "Avaliador", "Enviado em", "Status", "Ação"].map((h, i) => (
                  <div key={h} className={cn("px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wide", i === 5 && "text-right")} style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)" }}>{h}</div>
                ))}
              </div>
              {selected.criteria.length === 0 ? (
                <div className="p-6 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum critério ativo neste evento.</div>
              ) : selected.criteria.map(c => {
                const cfg = STATE_CFG[c.state];
                const pickerOpen = openPickerCriterionId === c.criterionId;
                return (
                  <div key={c.criterionId} className="grid grid-cols-[1.6fr_1fr_1.5fr_0.8fr_1fr_1fr] items-center min-w-[820px]" style={{ borderTop: "1px solid var(--border)", backgroundColor: c.assignedToId == null ? "rgba(229,72,77,0.05)" : "transparent" }}>
                    <div className="px-3.5 py-3 font-black uppercase text-[13px]" style={{ fontFamily: CONDENSED }}>{c.criterionName}</div>
                    <div className="px-3.5 py-3 font-bold uppercase text-[11px]" style={{ color: "var(--muted-foreground)" }}>{c.areaName}</div>
                    <div className="px-3.5 py-3 font-semibold text-xs" style={{ color: c.assignedToId == null ? WARNING : "var(--foreground)" }}>{c.assignedToName ?? "Sem avaliador"}</div>
                    <div className="px-3.5 py-3 font-bold text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      {c.submittedAt ? (
                        <span className="flex items-center gap-1" style={{ color: GOOD }}><Clock size={10} /> {fmtDT(c.submittedAt)}</span>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className="px-3.5 py-3">
                      <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div className="px-3.5 py-3 text-right relative flex items-center justify-end gap-2">
                      {canManage && c.assignedToId != null && (
                        <button
                          type="button"
                          onClick={() => openLinkDialog(c)}
                          className="rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase flex items-center gap-1 whitespace-nowrap transition-colors hover:opacity-80"
                          style={{ border: "1px solid var(--border)" }}
                          title="Gerar link para freelancer"
                        >
                          <Link2 size={10} /> Link
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setOpenPickerCriterionId(pickerOpen ? null : c.criterionId)}
                          className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase whitespace-nowrap transition-opacity hover:opacity-80"
                          style={{
                            border: c.assignedToId == null ? "1px solid var(--primary)" : "1px solid var(--border)",
                            backgroundColor: c.assignedToId == null ? "var(--primary)" : "transparent",
                            color: c.assignedToId == null ? "var(--primary-foreground)" : "var(--foreground)",
                          }}
                        >
                          {c.assignedToId == null ? "Atribuir" : "Gerenciar"}
                        </button>
                      )}
                      {pickerOpen && c.areaId != null && (
                        <div className="absolute right-3.5 top-full mt-1 z-10 w-64 rounded-xl p-2.5 text-left" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                          <InlinePicker areaId={c.areaId} excludeId={c.assignedToId} onPick={(uid) => handleAssign(c.criterionId, uid)} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] mt-3" style={{ color: "var(--muted-foreground)" }}>
              Clique em <b style={{ color: "var(--foreground)" }}>Atribuir</b> numa linha sem avaliador para escolher quem responde. Troque o evento na aba Atribuição.
            </p>
          </div>
        )
      ) : (
        <div>
          <p className="text-[11px] font-bold uppercase mb-3.5" style={{ color: "var(--muted-foreground)" }}>Quem está em dia e quem precisa de cobrança neste ciclo</p>
          {evaluatorCards.length === 0 ? (
            <div className="text-center py-16 rounded-xl font-bold uppercase" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
              Nenhum avaliador com critérios atribuídos neste ciclo.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {evaluatorCards.map(av => (
                <div key={av.id} className="rounded-xl p-4 relative overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: av.accent }} />
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-10 h-10 rounded-lg inline-flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                      <span className="font-black text-[13px]" style={{ fontFamily: CONDENSED, color: "var(--primary-foreground)" }}>{initials(av.name)}</span>
                    </span>
                    <div className="min-w-0">
                      <div className="font-black uppercase text-[14.5px] leading-tight truncate" style={{ fontFamily: CONDENSED }}>{av.name}</div>
                      <div className="text-[9.5px] font-bold uppercase mt-0.5" style={{ color: "var(--muted-foreground)" }}>{av.area}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-full" style={{ background: av.bg, color: av.color }}>{av.label}</span>
                    <span className="font-black text-xs" style={{ fontFamily: CONDENSED, color: av.color }}>{av.submitted}/{av.assigned}</span>
                  </div>
                  <div className="h-[6px] rounded-full overflow-hidden mb-3.5" style={{ backgroundColor: "var(--secondary)" }}>
                    <div className="h-full rounded-full" style={{ width: `${av.pct}%`, background: av.accent }} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toast({ title: `${av.assigned - av.submitted} pendência(s)`, description: `${av.name} ainda não enviou ${av.assigned - av.submitted} de ${av.assigned} critério(s) atribuído(s).` })}
                      className="flex-1 rounded-lg py-2 text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      Cobrar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEvaluatorFilter(av.name); setView("assign"); }}
                      className="flex-1 rounded-lg py-2 text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
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
          <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Link Freelancer{linkDialog.criterionIds.length > 1 ? ` · ${linkDialog.criterionIds.length} critérios` : ""}
                </p>
                {linkDialog.criterionNames.length === 1 ? (
                  <h3 className="font-black uppercase text-sm truncate" style={{ fontFamily: CONDENSED }}>{linkDialog.criterionNames[0]}</h3>
                ) : (
                  <ul className="mt-0.5 space-y-0.5">
                    {linkDialog.criterionNames.map((n, i) => (
                      <li key={i} className="font-black uppercase text-[12.5px] truncate leading-tight" style={{ fontFamily: CONDENSED }}>{n}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Avaliador: <span className="font-bold" style={{ color: "var(--foreground)" }}>{linkDialog.assignedToName}</span></p>
              </div>
              <button
                type="button"
                onClick={() => { setLinkDialog(null); setGeneratedLinkUrl(null); }}
                className="shrink-0 rounded-lg p-1.5 transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--border)" }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* nota de conformidade bundled */}
              {linkDialog?.includeConformity && (
                <div className="rounded-lg px-3 py-2 text-[10px] flex items-start gap-2" style={{ border: "1px solid var(--primary)", backgroundColor: "var(--secondary)" }}>
                  <CheckCircle size={13} className="shrink-0 mt-0.5" style={{ color: GOOD }} />
                  <span>Este link incluirá o critério <strong>e</strong> a Matriz de Conformidade de Cenografia no mesmo questionário.</span>
                </div>
              )}
              {/* recipient + generate */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                  Para quem é o link? <span className="font-normal normal-case">(opcional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={linkRecipientName}
                    onChange={e => setLinkRecipientName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleGenerateLink(); }}
                    placeholder="Nome do freelancer"
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                    style={fieldStyle}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateLink}
                    disabled={createAdminToken.isPending}
                    className="rounded-lg px-3 py-2 text-[10.5px] font-bold uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                    style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                  >
                    <Link2 size={12} /> {createAdminToken.isPending ? "Gerando…" : "Gerar Link"}
                  </button>
                </div>
              </div>

              {/* generated URL */}
              {generatedLinkUrl && (
                <div className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: GOOD }}>Link gerado — copie e envie</p>
                  <div className="flex gap-2 items-start">
                    <input
                      readOnly
                      value={generatedLinkUrl}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs font-mono truncate focus:outline-none"
                      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                      onFocus={e => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(generatedLinkUrl); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }}
                      className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase flex items-center gap-1 shrink-0 transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      {linkCopied ? <><CheckCircle size={11} style={{ color: GOOD }} /> Copiado!</> : <><Copy size={11} /> Copiar</>}
                    </button>
                  </div>
                </div>
              )}

              {/* history */}
              {(() => {
                const relevantTokens: (PublicToken & { tokenType: string })[] = (allTokens ?? []).filter(t =>
                  (t.tokenType === "criteria" || t.tokenType === "criteria_with_conformity")
                  && (t.criterionIds ?? []).some(id => linkDialog.criterionIds.includes(id)),
                );
                if (relevantTokens.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--muted-foreground)" }}>Histórico de links enviados</p>
                    <div className="rounded-lg max-h-48 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
                      {relevantTokens.map((t, i) => (
                        <div key={t.id} className="flex items-start justify-between px-3 py-2.5 gap-3" style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[11px] font-bold truncate">
                              {t.usedAt && t.submitterName ? t.submitterName : (t.recipientName ?? "—")}
                            </p>
                            {t.usedAt && t.submitterName && t.recipientName && t.submitterName !== t.recipientName && (
                              <p className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>Para: {t.recipientName}</p>
                            )}
                            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Enviado: {fmtDT(t.createdAt)}</p>
                            {t.usedAt && (
                              <p className="text-[10px] font-bold" style={{ color: GOOD }}>Respondido: {fmtDT(t.usedAt)}</p>
                            )}
                          </div>
                          {t.usedAt ? (
                            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 mt-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>
                              <CheckCircle size={10} /> Respondido
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full mt-0.5" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
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
          <div className="rounded-xl w-full max-w-md overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Link Freelancer · Conformidade</p>
                <h3 className="font-black uppercase text-sm truncate" style={{ fontFamily: CONDENSED }}>{conformityLinkDialog.label}</h3>
                {conformityLinkDialog.evaluatorName && (
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Avaliador: <span className="font-bold" style={{ color: "var(--foreground)" }}>{conformityLinkDialog.evaluatorName}</span></p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setConformityLinkDialog(null)}
                className="shrink-0 ml-3 transition-colors hover:opacity-70"
                style={{ color: "var(--muted-foreground)" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {!conformityLinkUrl ? (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--muted-foreground)" }}>
                    Para quem é o link?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={conformityLinkRecipientName}
                      onChange={e => setConformityLinkRecipientName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleGenerateConformityLink(); }}
                      placeholder="Nome do freelancer"
                      className="flex-1 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none"
                      style={fieldStyle}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateConformityLink}
                      disabled={createConformityToken.isPending || createFerramentasToken.isPending}
                      className="rounded-lg px-3 py-2 text-[10.5px] font-bold uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                    >
                      <Link2 size={12} /> Gerar Link
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg p-3 space-y-2" style={{ border: "1px solid var(--border)", backgroundColor: "var(--secondary)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: GOOD }}>Link gerado — copie e envie</p>
                  <div className="flex gap-2 items-start">
                    <input
                      readOnly
                      value={conformityLinkUrl}
                      className="flex-1 rounded-lg px-2 py-1.5 text-xs font-mono truncate focus:outline-none"
                      style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                      onFocus={e => e.target.select()}
                    />
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(conformityLinkUrl); setConformityLinkCopied(true); setTimeout(() => setConformityLinkCopied(false), 2000); }}
                      className="shrink-0 rounded-lg px-2.5 py-2 flex items-center gap-1 text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      {conformityLinkCopied ? <><CheckCircle size={12} style={{ color: GOOD }} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setConformityLinkUrl(null); setConformityLinkRecipientName(""); }}
                    className="text-[9.5px] font-bold uppercase underline transition-colors hover:opacity-70"
                    style={{ color: "var(--muted-foreground)" }}
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
