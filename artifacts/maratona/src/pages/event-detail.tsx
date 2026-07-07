import { useRoute, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { useGetEvent, useGetEventResult, useGetEvaluations, useUpdateEventCriteria, useConfirmEventCriteria, useResyncEventCriteria, useUpdateEventAssignments, useDuplicateEventCriterion, useDeleteEventCriterion, useUpdateCriterion, useGetUsers, useRemoveEventParticipant, useAddEventParticipant, useUpdateEventParticipant, useGetEmployees, useGetEventConformity, useSetEventConformity, useConfirmEventResults, useUnconfirmEventResults, useUpdateHistoricalResult, useGetEventComments, useCreateEventComment, useDeleteEventComment, getGetEventQueryKey, getGetEventCommentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, Users, BarChart3, TrendingUp, CheckCircle2, ShieldAlert, SlidersHorizontal, Lock, Unlock, AlertCircle, AlertTriangle, Save, Trash2, RotateCcw, UserCheck, UserX, UserPlus, ClipboardList, Copy, Check, ChevronsUpDown, MessageSquare, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlatoonBadge } from "@/components/ui/platoon-badge";
import { AudioPlayer } from "@/components/audio-recorder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const HARD_SHADOW = "shadow-[4px_4px_0px_0px_#191c1e]";

function eventDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatDiariaDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', '');
}

function splitImportedNoteLines(note: string): string[] {
  return note
    .split(/(?<=[.;])\s+|\s*\|\s*|\n+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function parseImportedConformityRatio(notes: string): { sim: number; total: number } | null {
  const m = notes.match(/Conformidade:\s*(\d+)\s*\/\s*(\d+)\s*itens/i);
  if (!m) return null;
  return { sim: parseInt(m[1], 10), total: parseInt(m[2], 10) };
}

function parseImportedCriteriaScores(notes: string): { rawName: string; score: number; scale: number; excluded: boolean; comment?: string }[] {
  const marker = notes.match(/Performance\s*\(peso\/nota\):\s*([\s\S]*?)(?:\.\s*Performance\s*=|\.\s*Pontua[çc][ãa]o|$)/i);
  const segment = marker ? marker[1] : "";
  if (!segment) return [];
  return segment
    .split(";")
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const m = entry.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)\s*(?:-\s*(.*))?$/);
      if (!m) return null;
      // Formato das notas importadas: "<nome> <peso>/<nota>" — m[2]=peso, m[3]=nota
      const peso = parseFloat(m[2].replace(",", "."));
      const nota = parseFloat(m[3].replace(",", "."));
      return { rawName: m[1].trim(), score: nota, scale: 10, excluded: peso === 0, comment: m[4]?.trim() || undefined };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}

function normalizeForMatch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MATCH_STOP_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "ou", "no", "na", "em", "a", "o", "as", "os"]);

function significantWords(norm: string): string[] {
  return norm.split(/\s+/).filter(w => w.length >= 3 && !MATCH_STOP_WORDS.has(w));
}

function matchCriterionByName(rawName: string, criteria: { criterionId: number; criterionName: string }[]): number | null {
  const norm = normalizeForMatch(rawName);
  if (!norm) return null;

  // 1. Exact match
  for (const c of criteria) {
    if (normalizeForMatch(c.criterionName) === norm) return c.criterionId;
  }

  // 2. Substring / prefix match
  let substringBest: { id: number; score: number } | null = null;
  for (const c of criteria) {
    const cn = normalizeForMatch(c.criterionName);
    if (cn.includes(norm) || norm.includes(cn)) {
      const score = Math.min(cn.length, norm.length);
      if (!substringBest || score > substringBest.score) substringBest = { id: c.criterionId, score };
    }
  }
  if (substringBest) return substringBest.id;

  // 3. Word-overlap fallback — counts significant shared words
  const rawWords = significantWords(norm);
  if (rawWords.length === 0) return null;
  let overlapBest: { id: number; score: number } | null = null;
  for (const c of criteria) {
    const cnWords = significantWords(normalizeForMatch(c.criterionName));
    const overlap = rawWords.filter(w => cnWords.includes(w)).length;
    if (overlap > 0) {
      const score = overlap / Math.max(rawWords.length, cnWords.length);
      if (!overlapBest || score > overlapBest.score) overlapBest = { id: c.criterionId, score };
    }
  }
  return overlapBest?.id ?? null;
}

function ImportedNotesList({ notes }: { notes: string }) {
  const lines = splitImportedNoteLines(notes);
  if (lines.length <= 1) {
    return <p className="text-xs font-semibold italic text-[#191c1e] whitespace-pre-wrap">{notes}</p>;
  }
  return (
    <ul className="space-y-1">
      {lines.map((line, i) => (
        <li key={i} className="text-xs font-semibold italic text-[#191c1e] flex items-start gap-1.5">
          <span className="text-[#862200] mt-[1px]">•</span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function ParticipantDiariaDialog({
  employeeId, employeeName, candidateDates, scheduledStart, scheduledEnd, scheduledCount,
  currentDates, isSaving, onSave,
}: {
  employeeId: number; employeeName: string; candidateDates: string[];
  scheduledStart: string | null | undefined; scheduledEnd: string | null | undefined; scheduledCount: number | null | undefined;
  currentDates: string[]; isSaving: boolean; onSave: (dates: string[], onDone: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(currentDates));
  useEffect(() => { if (open) setSelected(new Set(currentDates)); }, [open, currentDates]);

  const scheduledDates = scheduledStart && scheduledEnd
    ? candidateDates.filter(d => d >= scheduledStart && d <= scheduledEnd)
    : [];
  const scheduledSet = new Set(scheduledDates);

  const toggle = (d: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d); else next.add(d);
      return next;
    });
  };

  const sortedCurrent = [...currentDates].sort();
  const sortedSelected = Array.from(selected).sort();
  const dirty = JSON.stringify(sortedSelected) !== JSON.stringify(sortedCurrent);

  const actionBtn = "flex items-center gap-1.5 px-3 py-2 border-2 border-[#191c1e] font-black italic uppercase text-[11px] tracking-tight transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid={`button-diaria-dates-${employeeId}`}
          className="self-center flex items-center gap-1.5 px-2 py-1 border-2 border-[#191c1e] bg-white hover:bg-[#f2f4f6] transition-colors whitespace-nowrap"
        >
          <Calendar size={11} className="text-[#444933] shrink-0" />
          <span className="text-[10px] font-bold italic uppercase text-[#191c1e]">
            Realizadas: {currentDates.length}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-none border-2 border-[#191c1e] shadow-[6px_6px_0px_0px_#191c1e]">
        <DialogHeader>
          <DialogTitle className="font-black italic uppercase tracking-tight text-[#191c1e]">
            Diárias Realizadas — {employeeName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
            <span className="text-xs font-bold italic uppercase text-[#444933]">
              Previstas: {scheduledCount ?? "—"}
              {scheduledStart && scheduledEnd && (
                <span className="text-[#747a60] normal-case font-semibold not-italic"> ({formatDiariaDate(scheduledStart)} – {formatDiariaDate(scheduledEnd)})</span>
              )}
            </span>
            <span data-testid={`text-diaria-selected-count-${employeeId}`} className="text-sm font-black italic uppercase text-[#506600]">
              Selecionadas: {selected.size}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid={`button-confirm-previstas-${employeeId}`}
              onClick={() => setSelected(new Set(scheduledSet))}
              disabled={scheduledSet.size === 0}
              className={cn(actionBtn, "bg-[#ccff00] text-[#161e00] enabled:hover:translate-y-[1px]")}
            >
              <CheckCircle2 size={14} /> Confirmar Diárias Previstas
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set(candidateDates))}
              className={cn(actionBtn, "bg-white text-[#191c1e] hover:bg-[#eceef0]")}
            >
              Marcar Todos
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={selected.size === 0}
              className={cn(actionBtn, "bg-white text-[#191c1e] hover:bg-[#eceef0]")}
            >
              Limpar
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
            {candidateDates.map(dateStr => {
              const checked = selected.has(dateStr);
              const isScheduled = scheduledSet.has(dateStr);
              return (
                <button
                  key={dateStr}
                  type="button"
                  data-testid={`checkbox-diaria-${employeeId}-${dateStr}`}
                  onClick={() => toggle(dateStr)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 px-2 py-3 border-2 border-[#191c1e] font-bold italic uppercase text-[11px] transition-colors",
                    checked ? "bg-[#ccff00] text-[#161e00]" : "bg-white text-[#444933] hover:bg-[#f2f4f6]"
                  )}
                >
                  <span>{formatDiariaDate(dateStr)}</span>
                  {isScheduled && (
                    <span className="text-[8px] normal-case font-semibold text-[#747a60]">prevista</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border-2 border-[#191c1e] bg-white font-black italic uppercase text-xs hover:bg-[#eceef0] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-testid={`button-save-diaria-${employeeId}`}
            disabled={!dirty || isSaving}
            onClick={() => onSave(sortedSelected, () => setOpen(false))}
            className="px-4 py-2 border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] font-black italic uppercase text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:translate-y-[1px] transition-all"
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantCommentBox({
  participantId, employeeId, initialComment, canManage, reason, onSave, isSaving,
}: {
  participantId: number; employeeId: number; initialComment: string | null | undefined;
  canManage: boolean; reason: string; onSave: (value: string) => void; isSaving: boolean;
}) {
  const [value, setValue] = useState(initialComment ?? "");
  useEffect(() => { setValue(initialComment ?? ""); }, [initialComment, participantId]);
  const dirty = value.trim() !== (initialComment ?? "").trim();

  if (!canManage) {
    if (!initialComment) return null;
    return (
      <div className="mt-1 p-2 border-2 border-[#191c1e] bg-[#fff8e1] flex items-start gap-1.5">
        <MessageSquare size={12} className="text-[#444933] shrink-0 mt-[2px]" />
        <p className="text-[11px] font-semibold italic text-[#191c1e] whitespace-pre-wrap">{initialComment}</p>
      </div>
    );
  }

  return (
    <div className="mt-1 p-2 border-2 border-[#191c1e] bg-[#fff8e1] space-y-1.5">
      <p className="text-[10px] font-black italic uppercase text-[#862200] flex items-center gap-1.5">
        <MessageSquare size={12} /> {reason}
      </p>
      <Textarea
        data-testid={`textarea-participant-comment-${employeeId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Comentário / justificativa..."
        className="text-xs rounded-none border-2 border-[#191c1e] bg-white min-h-[60px]"
      />
      <button
        type="button"
        data-testid={`button-save-participant-comment-${employeeId}`}
        disabled={isSaving || !dirty}
        onClick={() => onSave(value.trim())}
        className="px-3 py-1 border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] font-black italic uppercase text-[10px] hover:bg-[#b3e600] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSaving ? "Salvando..." : "Salvar comentário"}
      </button>
    </div>
  );
}

const COMMENT_ROLE_LABELS: Record<string, string> = {
  admin: "Admin", rh: "RH", diretoria: "Diretoria", gestor: "Gestor", avaliador: "Avaliador", visualizador: "Visualizador",
};

function formatCommentTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function EventCommentsPanel({ eventId }: { eventId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");

  const { data: comments, isLoading } = useGetEventComments(eventId, {
    query: { enabled: !!eventId, queryKey: getGetEventCommentsQueryKey(eventId) },
  });

  const createComment = useCreateEventComment({
    mutation: {
      onSuccess: () => {
        setMessage("");
        qc.invalidateQueries({ queryKey: getGetEventCommentsQueryKey(eventId) });
      },
      onError: () => toast({ title: "Erro ao enviar comentário", variant: "destructive" }),
    },
  });

  const deleteComment = useDeleteEventComment({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetEventCommentsQueryKey(eventId) }),
      onError: () => toast({ title: "Erro ao excluir comentário", variant: "destructive" }),
    },
  });

  const canManage = !!user && ["admin", "rh"].includes(user.role);
  const trimmed = message.trim();

  const submit = () => {
    if (!trimmed || createComment.isPending) return;
    createComment.mutate({ id: eventId, data: { message: trimmed } });
  };

  return (
    <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
      <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
        <MessageSquare size={18} />
        <span className="font-black uppercase tracking-tight">Comentários do Evento</span>
      </div>
      <div className="p-6 space-y-4">
        <div data-testid="list-event-comments" className="max-h-96 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <p className="text-xs italic font-bold uppercase text-[#747a60] text-center py-4">Carregando...</p>
          ) : !comments || comments.length === 0 ? (
            <p className="text-xs italic font-bold uppercase text-[#747a60] text-center py-4">Nenhum comentário ainda. Seja o primeiro a comentar.</p>
          ) : (
            comments.map(c => {
              const isOwner = !!user && user.id === c.userId;
              const canDelete = isOwner || canManage;
              return (
                <div key={c.id} data-testid={`comment-${c.id}`} className="border-2 border-[#eceef0] p-3 flex items-start gap-3 group">
                  <div className="w-8 h-8 shrink-0 bg-[#eceef0] border-2 border-[#191c1e] flex items-center justify-center font-black italic text-[10px] text-[#191c1e]">
                    {c.userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black italic uppercase text-xs text-[#191c1e]">{c.userName}</span>
                      {c.userRole && (
                        <span className="px-1.5 py-0.5 border border-[#191c1e] font-bold text-[9px] italic uppercase text-[#444933]">
                          {COMMENT_ROLE_LABELS[c.userRole] ?? c.userRole}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-[#9aa088]">{formatCommentTimestamp(c.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[#191c1e] whitespace-pre-wrap mt-1 break-words">{c.message}</p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      data-testid={`button-delete-comment-${c.id}`}
                      onClick={() => deleteComment.mutate({ id: eventId, commentId: c.id })}
                      disabled={deleteComment.isPending}
                      className="p-1 text-[#9aa088] hover:text-[#862200] transition-colors opacity-0 group-hover:opacity-100 shrink-0 disabled:opacity-40"
                      title="Excluir comentário"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-start gap-2 pt-3 border-t-2 border-[#eceef0]">
          <Textarea
            data-testid="textarea-new-comment"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Escreva um comentário para toda a equipe..."
            className="text-sm rounded-none border-2 border-[#191c1e] min-h-[44px]"
          />
          <button
            type="button"
            data-testid="button-send-comment"
            disabled={!trimmed || createComment.isPending}
            onClick={submit}
            className="h-11 px-4 shrink-0 bg-[#191c1e] text-[#ccff00] font-black italic uppercase tracking-tight text-xs disabled:opacity-40 hover:bg-[#ccff00] hover:text-[#191c1e] border-2 border-[#191c1e] transition-colors"
          >
            {createComment.isPending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </div>
    </section>
  );
}

function HistoricalResultPanel({
  eventId, currentScore, currentNotes, canManage,
}: {
  eventId: number; currentScore: number | null | undefined; currentNotes: string | null | undefined; canManage: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [score, setScore] = useState(currentScore != null ? String(currentScore) : "");
  const [notes, setNotes] = useState(currentNotes ?? "");
  useEffect(() => {
    setScore(currentScore != null ? String(currentScore) : "");
    setNotes(currentNotes ?? "");
  }, [currentScore, currentNotes, eventId, editing]);

  const updateHistorical = useUpdateHistoricalResult({
    mutation: {
      onSuccess: () => {
        toast({ title: "Resultado importado atualizado" });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(eventId) });
        qc.invalidateQueries({ queryKey: ["event-result", eventId] });
        setEditing(false);
      },
      onError: (err: unknown) => {
        const message = (err as { message?: string })?.message ?? "Erro ao atualizar resultado";
        toast({ title: message, variant: "destructive" });
      },
    },
  });

  if (!canManage) {
    return null;
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-col items-start gap-2">
        <button
          type="button"
          data-testid="button-edit-historical-result"
          onClick={() => setEditing(true)}
          className="px-3 py-1.5 border-2 border-[#191c1e] bg-white text-[#191c1e] font-black italic uppercase text-[10px] hover:bg-[#eceef0] transition-colors"
        >
          Editar nota/observações importadas
        </button>
      </div>
    );
  }

  const parsedScore = parseFloat(score.replace(",", "."));
  const scoreValid = score.trim() !== "" && !Number.isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100;

  return (
    <div data-testid="panel-historical-result-edit" className="mt-4 p-3 border-2 border-[#191c1e] bg-[#fff8e1] space-y-2 w-full max-w-md">
      <p className="text-[10px] font-black italic uppercase text-[#862200]">Evento Histórico — editar nota e observações importadas</p>
      <div>
        <Label className="text-[10px] font-bold italic uppercase text-[#444933]">Nota (0-100)</Label>
        <Input
          data-testid="input-historical-score"
          type="text"
          inputMode="decimal"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          className="text-sm rounded-none border-2 border-[#191c1e] bg-white mt-1"
        />
      </div>
      <div>
        <Label className="text-[10px] font-bold italic uppercase text-[#444933]">Observações</Label>
        <Textarea
          data-testid="textarea-historical-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Comentários de conformidade/performance da planilha..."
          className="text-xs rounded-none border-2 border-[#191c1e] bg-white min-h-[80px] mt-1"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="button-save-historical-result"
          disabled={!scoreValid || updateHistorical.isPending}
          onClick={() => updateHistorical.mutate({ id: eventId, data: { importedScore: parsedScore, importedNotes: notes.trim() || null } })}
          className="px-3 py-1 border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] font-black italic uppercase text-[10px] hover:bg-[#b3e600] transition-colors disabled:opacity-50"
        >
          {updateHistorical.isPending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          data-testid="button-cancel-historical-result"
          disabled={updateHistorical.isPending}
          onClick={() => setEditing(false)}
          className="px-3 py-1 border-2 border-[#191c1e] bg-white text-[#191c1e] font-black italic uppercase text-[10px] hover:bg-[#eceef0] transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
      {!scoreValid && score.trim() !== "" && (
        <p className="text-[10px] font-bold italic text-[#862200]">Nota deve ser um número entre 0 e 100</p>
      )}
    </div>
  );
}

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:id");
  const id = params ? parseInt(params.id) : 0;

  const { user } = useAuth();
  const canViewResult = !!user && ["admin", "rh", "diretoria"].includes(user.role);

  const { data: event, isLoading } = useGetEvent(id, {
    query: { enabled: !!id, queryKey: getGetEventQueryKey(id) },
  });

  const { data: result } = useGetEventResult(id, {
    query: { enabled: !!id && canViewResult, queryKey: ["event-result", id] as unknown[] },
  });
  const participantResults = result?.participants ?? [];
  const hasPerformanceTable = !!result && result.eventScore > 0 && participantResults.length > 0;

  const { data: evaluations } = useGetEvaluations(
    { eventId: id },
    { query: { enabled: !!id && canViewResult, queryKey: ["evals", id] as unknown[] } }
  );
  const justificationsFor = (critId: number) =>
    (evaluations ?? [])
      .filter(e => e.criterionId === critId && e.status === "submitted")
      .map(e => ({ name: e.evaluatorName ?? "Avaliador", score: parseFloat(e.score as unknown as string), comment: (e.comments ?? "").trim(), audioUrl: e.audioUrl ?? null }));

  const { toast } = useToast();
  const qc = useQueryClient();
  const canManage = !!user && ["admin", "rh"].includes(user.role);

  const { data: conformityData } = useGetEventConformity(id, {
    query: { enabled: !!id, queryKey: ["event-conformity", id] as unknown[] },
  });
  const setConformity = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["event-conformity", id] });
        qc.invalidateQueries({ queryKey: ["event-result", id] });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        toast({ title: "Matriz de conformidade atualizada", variant: "default" });
      },
      onError: () => toast({ title: "Erro ao salvar conformidade", variant: "destructive" }),
    },
  });
  const [conformityForm, setConformityForm] = useState<{ epi: boolean; estaiamentos: boolean; guardaEquipamentos: boolean; conduta: boolean }>({ epi: true, estaiamentos: true, guardaEquipamentos: true, conduta: true });
  const conformityItems = [
    { key: "epi" as const, label: "Uso de EPI" },
    { key: "estaiamentos" as const, label: "Estaiamentos / Aterramentos" },
    { key: "guardaEquipamentos" as const, label: "Guarda de Equipamentos" },
    { key: "conduta" as const, label: "Conduta" },
  ];
  const importedConformityRatio = useMemo(
    () => (event?.isHistorical && event.importedNotes ? parseImportedConformityRatio(event.importedNotes) : null),
    [event?.isHistorical, event?.importedNotes]
  );
  const importedConformityAllValue = importedConformityRatio
    ? importedConformityRatio.sim === importedConformityRatio.total
      ? true
      : importedConformityRatio.sim === 0
        ? false
        : null
    : null;

  useEffect(() => {
    if (conformityData) {
      setConformityForm({
        epi: conformityData.epi,
        estaiamentos: conformityData.estaiamentos,
        guardaEquipamentos: conformityData.guardaEquipamentos,
        conduta: conformityData.conduta,
      });
    } else if (importedConformityAllValue !== null) {
      setConformityForm({
        epi: importedConformityAllValue,
        estaiamentos: importedConformityAllValue,
        guardaEquipamentos: importedConformityAllValue,
        conduta: importedConformityAllValue,
      });
    }
  }, [conformityData?.id, importedConformityAllValue]);

  const importedCriteriaScores = useMemo(
    () => (event?.isHistorical && event.importedNotes ? parseImportedCriteriaScores(event.importedNotes) : []),
    [event?.isHistorical, event?.importedNotes]
  );
  const importedCriteriaMap = useMemo(() => {
    const map = new Map<number, { rawName: string; score: number; scale: number; excluded: boolean; comment?: string }>();
    if (importedCriteriaScores.length === 0 || !result?.criteriaDetails) return map;
    const catalog = result.criteriaDetails.map(c => ({ criterionId: c.criterionId, criterionName: c.criterionName }));
    for (const p of importedCriteriaScores) {
      const id = matchCriterionByName(p.rawName, catalog);
      if (id != null && !map.has(id)) map.set(id, p);
    }
    return map;
  }, [importedCriteriaScores, result?.criteriaDetails]);

  const [config, setConfig] = useState<{ id: number; criterionId: number; active: boolean; weight: number; name: string; eventScoped: boolean }[]>([]);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const [pendingRemoveParticipant, setPendingRemoveParticipant] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<Record<number, string>>({});
  useEffect(() => {
    if (event?.criteria) {
      setConfig(event.criteria.map(c => ({
        id: c.id,
        criterionId: c.criterionId,
        active: c.active,
        weight: c.weightOverride ?? c.originalWeight ?? 0,
        name: c.criterionName ?? `Critério ${c.criterionId}`,
        eventScoped: c.eventScoped ?? false,
      })));
    }
  }, [event?.criteria]);

  const updateCriteria = useUpdateEventCriteria({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Pesos salvos", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Pesos salvos" });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    },
  });
  const confirmCriteria = useConfirmEventCriteria({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); },
      onError: (e: { message?: string }) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
    },
  });
  const resyncCriteria = useResyncEventCriteria({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        const removed = data.removedStale ?? 0;
        const added = data.addedNew ?? 0;
        if (removed === 0 && added === 0) {
          toast({ title: "Já está sincronizado", description: "Este evento já usa somente os critérios ativos." });
        } else {
          toast({ title: "Critérios sincronizados", description: `${added} critério(s) ativo(s) adicionado(s), ${removed} critério(s) desativado(s) (não fazem mais parte do catálogo ativo).` });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" }),
    },
  });

  const confirmResults = useConfirmEventResults({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Resultados confirmados", description: data.warnings.join(" "), variant: "destructive" });
        } else {
          toast({ title: "Resultados confirmados", description: "O evento agora conta na elegibilidade e na nota dos colaboradores." });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao confirmar resultados", description: e.message, variant: "destructive" }),
    },
  });
  const unconfirmResults = useUnconfirmEventResults({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        toast({ title: "Confirmação revertida", description: "O evento deixou de contar na elegibilidade e na nota dos colaboradores." });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao reverter confirmação", description: e.message, variant: "destructive" }),
    },
  });
  const resultsConfirmBusy = confirmResults.isPending || unconfirmResults.isPending;

  const duplicateCriterion = useDuplicateEventCriterion({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Quesito duplicado" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao duplicar", description: e.message, variant: "destructive" }),
    },
  });
  const deleteCriterion = useDeleteEventCriterion({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Quesito excluído" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
    },
  });
  const renameCriterion = useUpdateCriterion({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Nome atualizado" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao renomear", description: e.message, variant: "destructive" }),
    },
  });

  const removeParticipant = useRemoveEventParticipant({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Participante removido" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
    },
  });

  const updateParticipant = useUpdateEventParticipant({
    mutation: {
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        if (vars.data.confirmed !== undefined) {
          toast({ title: vars.data.confirmed ? "Colaborador reativado" : "Colaborador marcado como inativo" });
        } else if (vars.data.actualDiariaDates !== undefined) {
          toast({ title: "Diárias realizadas atualizadas" });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [newParticipantEmployeeId, setNewParticipantEmployeeId] = useState<number | null>(null);
  const [newParticipantFunction, setNewParticipantFunction] = useState("");
  const { data: allEmployees } = useGetEmployees({ active: true }, { query: { enabled: canManage, queryKey: ["employees", "active"] as unknown[] } });
  const alreadyAllocatedIds = new Set((event?.participants ?? []).map(p => p.employeeId));
  const availableEmployees = (allEmployees ?? []).filter(e => !alreadyAllocatedIds.has(e.id));
  const selectedNewEmployee = availableEmployees.find(e => e.id === newParticipantEmployeeId);

  const addParticipant = useAddEventParticipant({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        toast({ title: "Colaborador adicionado à equipe" });
        setAddParticipantOpen(false);
        setNewParticipantEmployeeId(null);
        setNewParticipantFunction("");
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
    },
  });

  const { data: usersList } = useGetUsers({ query: { enabled: canManage, queryKey: ["users"] as unknown[] } });
  const evaluators = (usersList ?? []).filter(u => u.role === "avaliador" && u.active);
  // Apenas avaliadores RELACIONADOS à área aparecem no seletor daquela área.
  const evaluatorsForArea = (areaId: number) => evaluators.filter(u => u.areaId === areaId);

  const [assignments, setAssignments] = useState<Record<number, number[]>>({});
  useEffect(() => {
    if (event?.areaAssignments) {
      const map: Record<number, number[]> = {};
      for (const a of event.areaAssignments) {
        if (!map[a.areaId]) map[a.areaId] = [];
        map[a.areaId].push(a.evaluatorUserId);
      }
      setAssignments(map);
    }
  }, [event?.areaAssignments]);

  const updateAssignments = useUpdateEventAssignments({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Avaliadores atribuídos" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atribuir", description: e.message, variant: "destructive" }),
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
  const targetWeightSum = (event.criteria ?? []).reduce((s, c) => s + (Number(c.originalWeight) || 0), 0);
  const sumValid = Math.abs(activeSum - targetWeightSum) <= 0.01;
  const criteriaConfirmed = event.criteriaConfirmed ?? false;
  const hasEvaluations = event.hasEvaluations ?? false;
  // A estrutura do evento (ativar/desativar, duplicar, excluir, renomear
  // quesito, trocar avaliador) trava após confirmação/avaliações. Os PESOS,
  // porém, podem sempre ser editados — inclusive durante calibração ou com o
  // evento fechado — e o resultado é recalculado ao salvar.
  const editLocked = criteriaConfirmed || hasEvaluations;
  const weightsDirty = config.some(item => {
    const meta = critMeta.get(item.criterionId);
    const original = meta ? (meta.weightOverride ?? meta.originalWeight ?? 0) : item.weight;
    return item.active !== meta?.active || Number(item.weight) !== Number(original);
  });

  const setCriterionActive = (criterionId: number, active: boolean) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, active } : c)));
  const setCriterionWeight = (criterionId: number, weight: number) =>
    setConfig(cfg => cfg.map(c => (c.criterionId === criterionId ? { ...c, weight } : c)));
  const handleSaveCriteria = () =>
    updateCriteria.mutate({ id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
  const handleConfirmCriteria = (value: boolean) => confirmCriteria.mutate({ id, data: { confirmed: value } });
  const handleDuplicate = (criterionId: number, baseName: string) =>
    duplicateCriterion.mutate({ id, data: { sourceCriterionId: criterionId, name: `${baseName} (cópia)` } });
  const handleRename = (criterionId: number) => {
    const name = (editingName[criterionId] ?? "").trim();
    if (!name) return;
    renameCriterion.mutate({ id: criterionId, data: { name } });
    setEditingName(prev => { const n = { ...prev }; delete n[criterionId]; return n; });
  };
  const evaluationProgress = Math.round((event.evaluationProgress ?? 0) * 100);

  // Áreas que precisam de um avaliador atribuído: toda área responsável por um
  // critério ativo (espelha a regra do backend em areasNeedingAssignment).
  const assignAreas = Array.from(
    new Map(
      (event.criteria ?? [])
        .filter(c => c.active && c.responsibleAreaId != null)
        .map(c => [c.responsibleAreaId as number, c.responsibleAreaName ?? `Área ${c.responsibleAreaId}`] as [number, string])
    ).entries()
  ).map(([areaId, areaName]) => ({ areaId, areaName }));
  const allAssigned = assignAreas.every(a => (assignments[a.areaId] ?? []).length > 0);
  const sameEvaluatorSet = (a: number[], b: number[]) => {
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  };
  const assignmentsDirty = assignAreas.some(a => {
    const current = (event.areaAssignments ?? []).filter(x => x.areaId === a.areaId).map(x => x.evaluatorUserId);
    return !sameEvaluatorSet(assignments[a.areaId] ?? [], current);
  });
  const toggleAreaEvaluator = (areaId: number, userId: number, checked: boolean) =>
    setAssignments(prev => {
      const current = prev[areaId] ?? [];
      const next = checked ? [...current, userId] : current.filter(v => v !== userId);
      return { ...prev, [areaId]: next };
    });
  const buildAssignmentsPayload = () => assignAreas.map(a => ({ areaId: a.areaId, evaluatorUserIds: assignments[a.areaId] ?? [] }));
  const handleSaveAssignments = () =>
    updateAssignments.mutate({ id, data: { assignments: buildAssignmentsPayload() } });
  const handleSaveAll = () => {
    if (sumValid) handleSaveCriteria();
    if (assignmentsDirty) handleSaveAssignments();
  };
  // Salva quaisquer pesos/avaliadores pendentes e SÓ ENTÃO confirma, em um clique.
  // Evita o estado em que tudo está preenchido mas o botão fica travado por não ter salvo.
  const handleConfirmAndRelease = async () => {
    try {
      if (sumValid) {
        await updateCriteria.mutateAsync({ id, data: { criteria: config.map(c => ({ criterionId: c.criterionId, active: c.active, weight: Number(c.weight) || 0 })) } });
      }
      if (assignmentsDirty) {
        await updateAssignments.mutateAsync({ id, data: { assignments: buildAssignmentsPayload() } });
      }
      await confirmCriteria.mutateAsync({ id, data: { confirmed: true } });
    } catch {
      // erros já são exibidos via toasts de onError de cada mutation
    }
  };
  const confirmBusy = updateCriteria.isPending || updateAssignments.isPending || confirmCriteria.isPending;

  const overview: { label: string; value: string }[] = [
    { label: "Status", value: event.status },
    { label: "Período", value: `${new Date(event.startDate).toLocaleDateString('pt-BR')} — ${new Date(event.endDate).toLocaleDateString('pt-BR')}` },
    { label: "Local", value: event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : (event.location ?? "—") },
    { label: "Cliente", value: event.clientName ?? "—" },
    { label: "Participantes", value: String(event.participants?.length ?? 0) },
    { label: "Progresso", value: `${evaluationProgress}% avaliado` },
  ];

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
                  {event.isHistorical && (
                    <span data-testid="badge-historical" className="bg-[#ffb300] text-[#3b2900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                      <span className="inline-block skew-x-[8deg]">Histórico</span>
                    </span>
                  )}
                  {event.cycleName && (
                    <span className="bg-[#191c1e] text-[#ccff00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block">
                      <span className="inline-block skew-x-[8deg]">{event.cycleName}</span>
                    </span>
                  )}
                  {event.forcedClosed && (
                    <span className="bg-[#ff5722] text-[#3b0900] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><ShieldAlert size={10} /> Fechamento Forçado</span>
                    </span>
                  )}
                  {event.resultsConfirmed ? (
                    <span data-testid="badge-results-confirmed" className="bg-[#ccff00] text-[#161e00] px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><CheckCircle2 size={10} /> Resultados Confirmados</span>
                    </span>
                  ) : (
                    <span data-testid="badge-results-pending" className="bg-[#ff5722] text-white px-2 py-1 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 skew-x-[8deg]"><AlertCircle size={10} /> Resultados Não Confirmados</span>
                    </span>
                  )}
                </div>
                <h1 data-testid="text-event-name" className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none mb-2 pr-1.5">{event.name}</h1>
                {event.clientName && <p className="text-base md:text-lg font-bold italic uppercase text-[#506600] mb-6">{event.clientName}</p>}

                <div className="flex flex-wrap items-center gap-5 text-sm font-bold italic text-[#444933]">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-[#506600]" />
                    <span>{new Date(event.startDate).toLocaleDateString('pt-BR')} — {new Date(event.endDate).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {(event.city || event.location) && (
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#506600]" />
                      <span>{event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#506600]" />
                    <span className={evaluationProgress === 100 ? "text-[#506600] font-black" : ""}>{evaluationProgress}% Avaliado</span>
                  </div>
                </div>
              </div>

              {result && result.eventScore > 0 && (() => {
                const concluded = !!event.feedbackReleased;
                const calibrated = (result.criteriaDetails ?? []).some(c => c.calibratedScore != null);
                const displayScore = (result.conformityScore != null ? result.conformityScore : result.eventScore) as number;
                const hasPenalty = (result.conformityPenalty ?? 0) > 0;
                return (
                <div className={`shrink-0 border-2 border-[#191c1e] p-6 flex flex-col items-center justify-center min-w-[160px] -skew-x-6 ${hasPenalty ? "bg-[#ffb300]" : "bg-[#ccff00]"}`}>
                  <div className="skew-x-6 flex flex-col items-center">
                    <span className="text-[10px] font-black italic uppercase tracking-widest text-[#161e00] mb-1">{concluded ? "Avaliação Final" : "Avaliação Parcial"}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black italic text-[#161e00] leading-none">{fmt(displayScore)}</span>
                      <span className="text-sm font-black italic text-[#506600]">/100</span>
                    </div>
                    {hasPenalty && (
                      <span className="mt-1 text-[9px] font-black italic uppercase text-[#862200] bg-white border border-[#862200] px-1.5 py-0.5">
                        -{result.conformityPenalty} pts conformidade
                      </span>
                    )}
                    {!concluded && !event.isHistorical && (
                      <span className="mt-2 inline-flex items-center gap-1 bg-[#191c1e] text-[#ffb300] text-[9px] font-black italic uppercase tracking-wider px-2 py-1" data-testid="badge-calibration-pending">
                        <AlertCircle size={11} />
                        {calibrated ? "Calibragem parcial" : "Aguardando calibragem"}
                      </span>
                    )}
                    {result.projectedPlatoon && (
                      <div className="mt-3">
                        <PlatoonBadge platoon={result.projectedPlatoon} colorHex={result.projectedPlatoonColor} />
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}
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

        {/* Visão Geral */}
        <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
          <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
            <ClipboardList size={18} />
            <span className="font-black uppercase tracking-tight">Visão Geral</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 divide-x-2 divide-y-2 divide-[#eceef0] border-t-0">
            {overview.map(item => (
              <div key={item.label} data-testid={`overview-${item.label.toLowerCase()}`} className="p-5">
                <p className="text-[10px] font-bold italic uppercase tracking-wider text-[#747a60] mb-1">{item.label}</p>
                <p className="font-black italic uppercase text-sm text-[#191c1e] break-words">{item.value}</p>
              </div>
            ))}
            {canViewResult && (
              <div data-testid="overview-score" className="p-5 bg-[#ccff00]/20">
                <p className="text-[10px] font-bold italic uppercase tracking-wider text-[#506600] mb-1">Score da Equipe</p>
                <p className="font-black italic uppercase text-sm text-[#161e00]">
                  {result && result.eventScore > 0 ? `${fmt(result.eventScore)} / 100` : "Sem nota ainda"}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Detalhamento por Critério — notas e calibrações */}
        {canViewResult && result && result.criteriaDetails && result.criteriaDetails.length > 0 && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <TrendingUp size={18} />
              <span className="font-black uppercase tracking-tight">Notas e Calibrações por Critério</span>
            </div>
            <div className="px-6 py-3 border-b-2 border-[#eceef0]">
              <p className="text-xs italic text-[#444933]">
                <strong>Nota Avaliador</strong> é a nota dada pela área avaliadora. <strong>Nota Calibrada</strong> é o valor ajustado na calibração. <strong>Nota Final</strong> é a que entra no cálculo do score da equipe.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                    <th className="px-6 py-4 text-xs font-bold uppercase italic text-[#444933]">Critério</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Peso</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Avaliador</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Calibrada</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Nota Final</th>
                    <th className="px-4 py-4 text-xs font-bold uppercase italic text-[#444933] text-center">Contribuição</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#eceef0]">
                  {result.criteriaDetails.map(c => {
                    const calibrated = c.calibratedScore != null;
                    const justifications = justificationsFor(c.criterionId);
                    return (
                      <tr key={c.criterionId} data-testid={`row-criterion-detail-${c.criterionId}`} className="hover:bg-[#f2f4f6] transition-all align-top">
                        <td className="px-6 py-4">
                          <p className="font-black italic uppercase text-sm text-[#191c1e]">{c.criterionName}</p>
                          {c.responsibleAreaLabel && (
                            <p className="text-[10px] font-bold italic uppercase text-[#747a60]">{c.responsibleAreaLabel}</p>
                          )}
                          {justifications.length > 0 && (
                            <div className="mt-3 space-y-1.5" data-testid={`justifications-${c.criterionId}`}>
                              <p className="text-[10px] font-bold uppercase italic tracking-wider text-[#747a60]">Justificativas dos Avaliadores</p>
                              {justifications.map((j, i) => (
                                <div key={i} className="border-l-2 border-[#191c1e] bg-[#f7f9fb] px-2.5 py-1.5">
                                  <p className="text-[10px] font-bold italic uppercase text-[#444933]">{j.name} <span className="text-[#747a60]">— {j.score.toFixed(1)}</span></p>
                                  {j.comment ? (
                                    <p className="text-[11px] italic text-[#444933] leading-snug whitespace-pre-wrap break-words mt-0.5">{j.comment}</p>
                                  ) : (
                                    <p className="text-[10px] italic text-[#9aa088] mt-0.5">Sem justificativa</p>
                                  )}
                                  {j.audioUrl && <div className="mt-1.5"><AudioPlayer objectPath={j.audioUrl} /></div>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center font-bold italic text-sm text-[#444933]">{fmt(c.weight)}</td>
                        <td className="px-4 py-4 text-center font-bold italic text-sm text-[#444933]">
                          {c.averageScore != null ? fmt(c.averageScore) : "—"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {(() => {
                            if (calibrated) {
                              return (
                                <div className="flex flex-col items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-xs uppercase font-black italic bg-[#191c1e] text-[#ccff00] border-2 border-[#191c1e] px-2 py-1">
                                    <Check size={10} /> {fmt(c.calibratedScore as number)}
                                  </span>
                                  {c.calibrationReason && (
                                    <p className="text-[11px] italic text-[#444933] leading-snug whitespace-pre-wrap break-words text-left max-w-[220px] border-l-2 border-[#191c1e] bg-[#f7f9fb] px-2 py-1">
                                      {c.calibrationReason}
                                    </p>
                                  )}
                                </div>
                              );
                            }
                            const imp = importedCriteriaMap.get(c.criterionId);
                            if (!imp) return <span className="text-[10px] uppercase font-bold italic text-[#747a60]">Sem calibração</span>;
                            if (imp.excluded) {
                              return (
                                <span className="text-[10px] uppercase font-bold italic text-[#9aa088]" title={imp.comment}>
                                  Não avaliado
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex flex-col items-center gap-0.5">
                                <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-2 py-0.5 border-2 border-[#191c1e]">
                                  {fmt(imp.score)}
                                  <span className="text-[10px] font-normal not-italic text-[#444933]">/10</span>
                                </span>
                                <span className="text-[9px] uppercase font-black italic text-[#9aa088]">importado</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {(() => {
                            if (c.scoreUsed != null) {
                              return (
                                <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-3 py-1 border-2 border-[#191c1e]">
                                  {fmt(c.scoreUsed)}
                                </span>
                              );
                            }
                            const imp = importedCriteriaMap.get(c.criterionId);
                            if (imp && !imp.excluded) {
                              return (
                                <span className="inline-block bg-[#ccff00] text-[#161e00] font-black italic px-3 py-1 border-2 border-[#191c1e]">
                                  {fmt(imp.score)}
                                </span>
                              );
                            }
                            return "—";
                          })()}
                        </td>
                        <td className="px-4 py-4 text-center font-bold italic text-sm text-[#444933]">
                          {c.criterionTotal != null ? fmt(c.criterionTotal) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* HR criteria configuration + evaluator assignment (merged) — não se aplica a eventos históricos/importados */}
        {canManage && !event.isHistorical && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex flex-wrap items-center justify-between gap-3 italic">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} />
                <span className="font-black uppercase tracking-tight">Critérios e Avaliadores (RH)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {allAssigned ? (
                  <span data-testid="badge-assignments-complete" className="inline-flex items-center gap-1.5 bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-3 py-1 text-[11px] font-black uppercase">
                    <UserCheck size={12} /> Avaliadores Atribuídos
                  </span>
                ) : (
                  <span data-testid="badge-assignments-pending" className="inline-flex items-center gap-1.5 bg-[#ff5722] text-white border-2 border-[#ff5722] px-3 py-1 text-[11px] font-black uppercase">
                    <AlertCircle size={12} /> Atribuição Pendente
                  </span>
                )}
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
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm italic text-[#444933]">
                Para cada critério deste evento defina o <strong>peso</strong> e o <strong>avaliador</strong> que dará a nota daquela área. Desative os que não se aplicam — a soma dos pesos ativos deve ser <strong>{fmt(targetWeightSum)}</strong>. As áreas só podem avaliar após a confirmação do RH.
              </p>

              {hasEvaluations && (
                <div data-testid="notice-criteria-locked" className="flex items-center gap-2 bg-[#fff4e5] border-2 border-[#ff5722] text-[#7a2e00] px-4 py-3 text-xs font-bold italic uppercase">
                  <Lock size={14} className="shrink-0" /> Este evento já possui avaliações. Critérios e avaliadores estão bloqueados, mas os pesos continuam editáveis — ao salvar, o resultado é recalculado.
                </div>
              )}

              <div className="flex items-center justify-between bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                <span className="text-xs font-bold italic uppercase text-[#444933]">Soma dos Pesos Ativos</span>
                <span data-testid="text-criteria-sum" className={`text-2xl font-black italic ${sumValid ? "text-[#506600]" : "text-[#ba1a1a]"}`}>
                  {Math.round(activeSum * 100) / 100} <span className="text-base text-[#747a60]">/ {fmt(targetWeightSum)}</span>
                </span>
              </div>

              <div className="overflow-x-auto border-2 border-[#191c1e]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#191c1e] bg-[#eceef0]">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933]">Critério</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933]">Área</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933] text-center">Peso</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933]">Avaliador</th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase italic text-[#444933] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-[#eceef0]">
                    {config.map(item => {
                      const meta = critMeta.get(item.criterionId);
                      const isEditingName = editingName[item.criterionId] !== undefined;
                      const areaId = meta?.responsibleAreaId ?? null;
                      const areaEvaluators = areaId != null ? evaluatorsForArea(areaId) : [];
                      return (
                        <tr key={item.criterionId} data-testid={`row-event-criterion-${item.criterionId}`} className={`align-top ${!item.active ? "opacity-60 bg-[#f7f9fb]" : "bg-white"}`}>
                          <td className="px-4 py-3 min-w-[180px]">
                            {isEditingName ? (
                              <div className="flex items-center gap-1.5">
                                <Input
                                  data-testid={`input-event-criterion-name-${item.criterionId}`}
                                  value={editingName[item.criterionId]}
                                  autoFocus
                                  onChange={e => setEditingName(prev => ({ ...prev, [item.criterionId]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === "Enter") handleRename(item.criterionId); if (e.key === "Escape") setEditingName(prev => { const n = { ...prev }; delete n[item.criterionId]; return n; }); }}
                                  className="h-9 rounded-none border-2 border-[#191c1e] font-black italic text-sm"
                                />
                                <button
                                  type="button"
                                  data-testid={`button-save-name-${item.criterionId}`}
                                  onClick={() => handleRename(item.criterionId)}
                                  title="Salvar nome"
                                  className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-[#ccff00] text-[#161e00] hover:translate-y-[1px] transition-all"
                                >
                                  <Check size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-black italic uppercase text-sm text-[#191c1e]">{meta?.criterionName ?? item.name}</span>
                                {item.eventScoped && (
                                  <span className="bg-[#191c1e] text-[#ccff00] px-1.5 py-0.5 text-[9px] font-black italic uppercase">Cópia</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[11px] font-bold italic uppercase text-[#747a60]">{meta?.responsibleAreaName ?? "—"}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Input
                              data-testid={`input-event-criterion-weight-${item.criterionId}`}
                              type="number"
                              min="0"
                              step="1"
                              value={item.active ? item.weight : 0}
                              disabled={!item.active}
                              onChange={e => setCriterionWeight(item.criterionId, Number(e.target.value))}
                              className="w-20 h-10 rounded-none border-2 border-[#191c1e] text-center font-black italic disabled:opacity-50 inline-block"
                            />
                          </td>
                          <td className="px-4 py-3 min-w-[200px]">
                            {!item.active || areaId == null ? (
                              <span className="text-[11px] font-bold italic uppercase text-[#747a60]">—</span>
                            ) : (
                              <>
                                {areaEvaluators.length === 0 ? (
                                  <p className="text-[10px] font-bold italic uppercase text-[#ba1a1a]">Nenhum avaliador vinculado a esta área</p>
                                ) : (
                                  <div data-testid={`select-assignment-${item.criterionId}`} className="flex flex-col gap-1 max-w-[220px]">
                                    {areaEvaluators.map(u => {
                                      const checked = (assignments[areaId] ?? []).includes(u.id);
                                      return (
                                        <label key={u.id} className="flex items-center gap-2 text-xs font-bold italic uppercase text-[#191c1e] cursor-pointer">
                                          <input
                                            type="checkbox"
                                            data-testid={`checkbox-evaluator-${item.criterionId}-${u.id}`}
                                            checked={checked}
                                            disabled={hasEvaluations}
                                            onChange={e => toggleAreaEvaluator(areaId, u.id, e.target.checked)}
                                            className="h-4 w-4 accent-[#191c1e] disabled:opacity-50"
                                          />
                                          {u.name}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                                {areaEvaluators.length > 0 && (assignments[areaId] ?? []).length === 0 ? (
                                  <p className="mt-1 text-[10px] font-bold italic uppercase text-[#ba1a1a]">Sem avaliador</p>
                                ) : (assignments[areaId] ?? []).length > 1 ? (
                                  <p className="mt-1 text-[10px] font-bold italic uppercase text-[#506600]">{(assignments[areaId] ?? []).length} avaliadores — nota final é a média</p>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 justify-end">
                              {!editLocked && item.eventScoped && !isEditingName && (
                                <button
                                  type="button"
                                  data-testid={`button-rename-event-criterion-${item.criterionId}`}
                                  onClick={() => setEditingName(prev => ({ ...prev, [item.criterionId]: item.name }))}
                                  title="Renomear cópia"
                                  className="h-9 px-3 flex items-center gap-1.5 border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-[11px] font-bold italic uppercase transition-all"
                                >
                                  Renomear
                                </button>
                              )}
                              <button
                                type="button"
                                data-testid={`button-duplicate-event-criterion-${item.criterionId}`}
                                disabled={editLocked || duplicateCriterion.isPending}
                                onClick={() => handleDuplicate(item.criterionId, item.name)}
                                title="Duplicar quesito"
                                className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                              >
                                <Copy size={16} />
                              </button>
                              {item.eventScoped ? (
                                <button
                                  type="button"
                                  data-testid={`button-delete-event-criterion-${item.criterionId}`}
                                  disabled={editLocked || deleteCriterion.isPending}
                                  onClick={() => setPendingDelete(item.id)}
                                  title="Excluir cópia"
                                  className="h-9 w-9 flex items-center justify-center border-2 border-[#191c1e] bg-white text-[#ba1a1a] hover:bg-[#ffe5e0] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ) : item.active ? (
                                <button
                                  type="button"
                                  data-testid={`button-remove-event-criterion-${item.criterionId}`}
                                  disabled={editLocked}
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
                                  disabled={editLocked}
                                  onClick={() => setCriterionActive(item.criterionId, true)}
                                  className="h-9 px-3 flex items-center gap-1.5 border-2 border-[#191c1e] bg-white text-[#444933] hover:bg-[#eceef0] text-[11px] font-bold italic uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                >
                                  <RotateCcw size={14} /> Reativar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {config.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center italic uppercase font-bold text-[#747a60]">Nenhum critério vinculado a este evento.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {config.some(item => item.active && (critMeta.get(item.criterionId)?.responsibleAreaId != null) && evaluatorsForArea(critMeta.get(item.criterionId)!.responsibleAreaId!).length === 0) && (
                <p className="text-xs font-bold italic uppercase text-[#ba1a1a]">Há áreas sem nenhum avaliador vinculado. Cadastre avaliadores nessas áreas (em Usuários) para poder atribuí-los.</p>
              )}

              {!sumValid && !criteriaConfirmed && (
                <p className="text-xs font-bold italic uppercase text-[#ba1a1a] text-right">Ajuste os pesos para somar exatamente {fmt(targetWeightSum)} antes de salvar ou confirmar.</p>
              )}

              <AlertDialog open={pendingRemoval !== null} onOpenChange={o => { if (!o) setPendingRemoval(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Remover critério?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      O critério <strong>{critMeta.get(pendingRemoval ?? -1)?.criterionName ?? ""}</strong> deixará de ser avaliado neste evento. Você precisará redistribuir o peso dele entre os critérios restantes para que a soma volte a ser <strong>{fmt(targetWeightSum)}</strong> antes de salvar ou confirmar.
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

              <AlertDialog open={pendingDelete !== null} onOpenChange={o => { if (!o) setPendingDelete(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Excluir cópia?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      Esta cópia será <strong>removida permanentemente</strong> deste evento. Caso ela esteja ativa, lembre-se de redistribuir o peso entre os critérios restantes para que a soma volte a <strong>{fmt(targetWeightSum)}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-delete-criterion" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-delete-criterion"
                      onClick={() => { if (pendingDelete !== null) deleteCriterion.mutate({ id, eventCriterionId: pendingDelete }); setPendingDelete(null); }}
                      className="rounded-none border-2 border-[#191c1e] bg-[#ba1a1a] text-white italic uppercase font-bold hover:bg-[#9a1414]"
                    >
                      <Trash2 size={16} className="mr-1.5" /> Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={pendingRemoveParticipant !== null} onOpenChange={o => { if (!o) setPendingRemoveParticipant(null); }}>
                <AlertDialogContent className="rounded-none border-2 border-[#191c1e]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="italic uppercase font-black tracking-tight">Remover participante?</AlertDialogTitle>
                    <AlertDialogDescription className="italic text-[#444933]">
                      O colaborador <strong>{event?.participants?.find(p => p.id === pendingRemoveParticipant)?.employeeName ?? ""}</strong> será removido da equipe deste evento. Se ele já possuir avaliações enviadas, as notas serão perdidas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-remove-participant" className="rounded-none border-2 border-[#191c1e] italic uppercase font-bold">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      data-testid="button-confirm-remove-participant"
                      onClick={() => {
                        if (pendingRemoveParticipant !== null) {
                          removeParticipant.mutate({ id, participantId: pendingRemoveParticipant });
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

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                {hasEvaluations && (
                  <span data-testid="text-criteria-locked" className="flex items-center gap-2 text-xs font-bold italic uppercase text-[#747a60] bg-[#f2f4f6] border-2 border-[#191c1e] px-4 py-3">
                    <Lock size={14} /> Critérios bloqueados — pesos continuam editáveis
                  </span>
                )}
                {!criteriaConfirmed ? (
                  <>
                    {!hasEvaluations && (
                      <button
                        data-testid="button-resync-criteria"
                        onClick={() => resyncCriteria.mutate({ id })}
                        disabled={resyncCriteria.isPending}
                        title="Remove critérios que não fazem mais parte do catálogo ativo e adiciona os que faltam"
                        className="bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                      >
                        <RefreshCw size={16} /> {resyncCriteria.isPending ? "Sincronizando..." : "Sincronizar Critérios Ativos"}
                      </button>
                    )}
                    <button
                      data-testid="button-save-criteria"
                      onClick={handleSaveAll}
                      disabled={!sumValid || updateCriteria.isPending || updateAssignments.isPending}
                      className="bg-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#eceef0] transition-all"
                    >
                      <Save size={16} /> {(updateCriteria.isPending || updateAssignments.isPending) ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      data-testid="button-confirm-criteria"
                      onClick={handleConfirmAndRelease}
                      disabled={!sumValid || !allAssigned || confirmBusy}
                      title={!sumValid ? `A soma dos pesos ativos precisa ser ${fmt(targetWeightSum)}` : !allAssigned ? "Atribua um avaliador para todas as áreas antes de liberar" : undefined}
                      className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${HARD_SHADOW}`}
                    >
                      <CheckCircle2 size={16} /> {confirmBusy ? "Confirmando..." : "Confirmar e Liberar Avaliação"}
                    </button>
                  </>
                ) : (
                  <>
                    {!hasEvaluations && assignmentsDirty && (
                      <button
                        data-testid="button-save-assignments"
                        onClick={handleSaveAssignments}
                        disabled={updateAssignments.isPending}
                        className="bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:translate-y-[1px] transition-all"
                      >
                        <Save size={16} /> {updateAssignments.isPending ? "Salvando..." : "Salvar Avaliadores"}
                      </button>
                    )}
                    {weightsDirty && (
                      <button
                        data-testid="button-save-weights"
                        onClick={handleSaveCriteria}
                        disabled={!sumValid || updateCriteria.isPending}
                        title={!sumValid ? `A soma dos pesos ativos precisa ser ${fmt(targetWeightSum)}` : undefined}
                        className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${HARD_SHADOW}`}
                      >
                        <Save size={16} /> {updateCriteria.isPending ? "Salvando..." : "Salvar Pesos"}
                      </button>
                    )}
                    {!hasEvaluations && (
                      <button
                        data-testid="button-reopen-criteria"
                        onClick={() => handleConfirmCriteria(false)}
                        disabled={confirmCriteria.isPending}
                        className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                      >
                        <Unlock size={16} /> Reabrir Edição dos Critérios
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Eventos históricos/importados: sem atribuição de avaliadores — só observações importadas + mural de comentários */}
        {event.isHistorical && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
              <MessageSquare size={18} />
              <span className="font-black uppercase tracking-tight">Observações Importadas e Comentários</span>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm italic text-[#444933]">
                Este é um evento histórico com resultado importado — não é necessário atribuir avaliadores. Use as observações e o mural de comentários abaixo para registrar contexto adicional.
              </p>
              <HistoricalResultPanel
                eventId={event.id}
                currentScore={event.importedScore}
                currentNotes={event.importedNotes}
                canManage={canManage}
              />
              <EventCommentsPanel eventId={id} />
            </div>
          </section>
        )}

        {canManage && (
          <section className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
            <div className={`px-6 py-3 flex flex-wrap items-center justify-between gap-3 italic ${event.resultsConfirmed ? "bg-[#191c1e] text-[#ccff00]" : "bg-[#ff5722] text-white"}`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span className="font-black uppercase tracking-tight">Confirmação de Resultados</span>
              </div>
              {event.resultsConfirmed ? (
                <span data-testid="badge-results-confirmed-section" className="inline-flex items-center gap-1.5 bg-[#ccff00] text-[#161e00] border-2 border-[#ccff00] px-3 py-1 text-[11px] font-black uppercase">
                  <Lock size={12} /> Confirmado
                </span>
              ) : (
                <span data-testid="badge-results-pending-section" className="inline-flex items-center gap-1.5 bg-white text-[#ba1a1a] border-2 border-white px-3 py-1 text-[11px] font-black uppercase">
                  <AlertCircle size={12} /> Não Confirmado
                </span>
              )}
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm italic text-[#444933]">
                Enquanto os resultados não forem confirmados, este evento <strong>não conta</strong> na elegibilidade nem na nota final dos colaboradores — mesmo que já esteja fechado. Confirme após revisar as notas e a calibragem. Admin/RH pode confirmar ou reverter a qualquer momento.
              </p>
              {event.status !== "closed" && !event.resultsConfirmed && (
                <p data-testid="text-confirm-requires-closed" className="text-sm italic text-[#ba1a1a] bg-[#ffedea] border-2 border-[#ba1a1a] px-3 py-2 flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  Este evento ainda está <strong>aberto</strong>. A confirmação só tem efeito depois que o evento for fechado (na tela de Calibração, em "Fechar Evento e Liberar Notas") — confirmar agora não muda nada nos resultados.
                </p>
              )}
              {event.resultsConfirmed && event.resultsConfirmedAt && (
                <p className="text-xs italic text-[#747a60]">
                  Confirmado em {new Date(event.resultsConfirmedAt).toLocaleString('pt-BR')}
                </p>
              )}
              <div className="flex justify-end">
                {event.resultsConfirmed ? (
                  <button
                    data-testid="button-unconfirm-results"
                    onClick={() => unconfirmResults.mutate({ id })}
                    disabled={resultsConfirmBusy}
                    className="bg-[#ff5722] text-white border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50"
                  >
                    <Unlock size={16} /> {resultsConfirmBusy ? "Revertendo..." : "Desconfirmar Resultados"}
                  </button>
                ) : (
                  <button
                    data-testid="button-confirm-results"
                    onClick={() => confirmResults.mutate({ id })}
                    disabled={resultsConfirmBusy || event.status !== "closed"}
                    title={event.status !== "closed" ? "Feche o evento antes de confirmar os resultados" : undefined}
                    className={`bg-[#ccff00] border-2 border-[#191c1e] px-5 py-3 font-bold text-sm italic uppercase tracking-wider flex items-center gap-2 disabled:opacity-50 ${HARD_SHADOW}`}
                  >
                    <CheckCircle2 size={16} /> {resultsConfirmBusy ? "Confirmando..." : "Confirmar Resultados"}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        <div className={`grid grid-cols-1 gap-6 ${hasPerformanceTable ? "lg:grid-cols-3" : ""}`}>
          {hasPerformanceTable && (
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
          )}

          <div className={hasPerformanceTable ? "" : "lg:max-w-xl"}>
            {/* Matriz de Conformidade */}
            <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
              <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center gap-2 italic">
                <ShieldAlert size={18} />
                <span className="font-black uppercase tracking-tight">Matriz de Conformidade</span>
              </div>
              {!conformityData && importedConformityRatio && (
                <p className="px-4 pt-3 text-[10px] font-bold italic uppercase text-[#9aa088]">
                  {importedConformityAllValue !== null
                    ? `Inferido das observações importadas (${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim")`
                    : `Observações importadas indicam ${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim" — não é possível identificar qual item pelo texto`}
                </p>
              )}
              <div className="p-4 space-y-3">
                {conformityItems.map(item => {
                  const value = conformityForm[item.key];
                  return (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between gap-3 -mx-4 px-4 py-1.5 ${!value ? "bg-[#fdece6] border-l-4 border-[#862200]" : ""}`}
                    >
                      <span className="text-sm font-bold italic text-[#191c1e]">{item.label}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {!value && (
                          <span className="text-[10px] font-black italic uppercase text-[#862200] whitespace-nowrap">-10 pts</span>
                        )}
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...conformityForm, [item.key]: !value };
                              setConformityForm(next);
                              setConformity.mutate({ id, data: { [item.key]: !value } });
                            }}
                            className={`text-[11px] font-black italic uppercase px-3 py-1 border-2 border-[#191c1e] transition-all ${value ? "bg-[#ccff00] text-[#161e00]" : "bg-[#862200] text-white"}`}
                          >
                            {value ? "Sim" : "Não"}
                          </button>
                        ) : (
                          <span className={`text-[11px] font-black italic uppercase px-2 py-1 border border-[#191c1e] ${value ? "bg-[#ccff00] text-[#161e00]" : "bg-[#862200] text-white"}`}>
                            {value ? "Sim" : "Não"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(result?.conformityPenalty ?? 0) > 0 && (
                  <div className="pt-3 border-t-2 border-[#eceef0]">
                    <p className="text-xs font-bold italic uppercase text-[#862200] flex items-center gap-1.5">
                      <AlertTriangle size={13} /> Desconto na nota final do evento: -{result?.conformityPenalty} pts
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {((event.participants && event.participants.length > 0) || canManage) && (
              <div className={`bg-white border-2 border-[#191c1e] overflow-hidden ${HARD_SHADOW}`}>
                <div className="bg-[#191c1e] text-[#ccff00] px-6 py-3 flex items-center justify-between gap-2 italic">
                  <div className="flex items-center gap-2">
                    <Users size={18} />
                    <span className="font-black uppercase tracking-tight">Equipe Alocada</span>
                  </div>
                  {canManage && (
                    <button
                      data-testid="button-add-participant"
                      onClick={() => setAddParticipantOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 border-2 border-[#ccff00] bg-[#191c1e] text-[#ccff00] hover:bg-[#ccff00] hover:text-[#191c1e] transition-colors text-[11px] font-black uppercase tracking-tight"
                    >
                      <UserPlus size={14} /> Adicionar
                    </button>
                  )}
                </div>
                {(!event.participants || event.participants.length === 0) ? (
                  <div className="py-8 text-center text-xs italic font-bold uppercase text-[#747a60]">Nenhum colaborador alocado.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                    {event.participants.map(p => {
                      const isInactive = p.confirmed === false;
                      const isInformational = p.countsForScore === false;
                      const selectedDates = p.actualDiariaDates ?? [];
                      const realizadasCount = p.actualDiariaDates != null ? p.actualDiariaDates.length : p.actualDiariaCount;
                      const candidateDates = eventDateRange(event.startDate, event.endDate);
                      const daysMismatch = !isInformational && p.scheduledDiariaCount != null && realizadasCount != null && realizadasCount < p.scheduledDiariaCount;
                      const showCommentBox = isInactive || daysMismatch;
                      const commentReason = isInactive
                        ? "Colaborador inativo — justifique"
                        : "Diárias previstas não cumpridas — justifique";
                      return (
                        <div
                          key={p.id}
                          data-testid={`chip-participant-${p.employeeId}`}
                          className={cn(
                            "flex items-start gap-4 p-4 border-2 border-[#eceef0] transition-colors",
                            isInformational ? "bg-[#862200]/[0.06] border-l-4 border-l-[#862200]" : "hover:bg-[#f2f4f6] hover:border-[#191c1e]",
                            isInactive && "opacity-50"
                          )}
                        >
                          <div className="w-9 h-9 bg-[#eceef0] border-2 border-[#191c1e] flex items-center justify-center font-black italic text-xs text-[#191c1e] shrink-0">
                            {p.employeeName.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black italic uppercase text-sm text-[#191c1e] break-words">{p.employeeName}</p>
                              <span className={`px-2 py-0.5 border-2 border-[#191c1e] font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block shrink-0 ${p.employmentType === "freela" ? "bg-[#e0e3e5] text-[#444933]" : "bg-white text-[#191c1e]"}`}>
                                <span className="inline-block skew-x-[8deg]">{p.employmentType === "freela" ? "Freela" : "Casa"}</span>
                              </span>
                              {isInformational && (
                                <span
                                  data-testid={`badge-no-score-${p.employeeId}`}
                                  className="px-2 py-0.5 border-2 border-[#862200] bg-[#862200] text-white font-bold text-[10px] italic uppercase skew-x-[-8deg] inline-block shrink-0"
                                  title="Participação apenas histórica/informativa — não entra na nota nem na elegibilidade."
                                >
                                  <span className="inline-block skew-x-[8deg]">Não conta p/ nota</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold italic uppercase text-[#747a60] truncate">
                              {p.functionName}{isInactive && <span className="text-[#862200]"> · Inativo</span>}
                            </p>
                            {isInformational ? (
                              <p className="text-[10px] font-bold italic uppercase text-[#862200]/80">
                                Participação informativa — sem controle de diárias.
                              </p>
                            ) : (p.scheduledDiariaCount != null || realizadasCount != null || canManage) && (
                              <div className="flex items-start gap-2 flex-wrap pt-1">
                                <div
                                  data-testid={`text-scheduled-diaria-${p.employeeId}`}
                                  className="flex items-start gap-1.5 px-2 py-1 border-2 border-[#191c1e] bg-white text-[10px] font-bold italic uppercase text-[#444933] leading-tight"
                                  title="Diárias previstas vêm da escalação (logística interna)."
                                >
                                  <Calendar size={11} className="text-[#444933] shrink-0 mt-[1px]" />
                                  <div>
                                    <div>Previstas: {p.scheduledDiariaCount ?? "—"}</div>
                                    {p.scheduledDiariaStart && p.scheduledDiariaEnd && (
                                      <div className="text-[#747a60] normal-case font-semibold not-italic">
                                        {formatDiariaDate(p.scheduledDiariaStart)} – {formatDiariaDate(p.scheduledDiariaEnd)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {canManage ? (
                                  <ParticipantDiariaDialog
                                    employeeId={p.employeeId}
                                    employeeName={p.employeeName}
                                    candidateDates={candidateDates}
                                    scheduledStart={p.scheduledDiariaStart}
                                    scheduledEnd={p.scheduledDiariaEnd}
                                    scheduledCount={p.scheduledDiariaCount}
                                    currentDates={selectedDates}
                                    isSaving={updateParticipant.isPending}
                                    onSave={(dates, onDone) => {
                                      updateParticipant.mutate(
                                        { id, participantId: p.id, data: { actualDiariaDates: dates } },
                                        { onSuccess: onDone },
                                      );
                                    }}
                                  />
                                ) : realizadasCount != null ? (
                                  <span className="self-center text-[10px] font-bold italic uppercase text-[#747a60] whitespace-nowrap">
                                    Diárias realizadas: {realizadasCount}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {showCommentBox && (
                              <ParticipantCommentBox
                                participantId={p.id}
                                employeeId={p.employeeId}
                                initialComment={p.comment}
                                canManage={canManage}
                                reason={commentReason}
                                isSaving={updateParticipant.isPending}
                                onSave={(value) => updateParticipant.mutate({ id, participantId: p.id, data: { comment: value || null } })}
                              />
                            )}
                          </div>
                          {canManage && (
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                data-testid={`button-toggle-participant-${p.employeeId}`}
                                onClick={() => updateParticipant.mutate({ id, participantId: p.id, data: { confirmed: isInactive } })}
                                className={cn(
                                  "p-1.5 border-2 border-[#191c1e] bg-white transition-colors shrink-0",
                                  isInactive ? "text-[#191c1e] hover:bg-[#ccff00]" : "text-[#862200] hover:bg-[#862200] hover:text-white"
                                )}
                                title={isInactive ? "Reativar colaborador" : "Marcar como inativo (não compareceu)"}
                              >
                                {isInactive ? <UserCheck size={14} /> : <UserX size={14} />}
                              </button>
                              <button
                                data-testid={`button-remove-participant-${p.employeeId}`}
                                onClick={() => setPendingRemoveParticipant(p.id)}
                                className="p-1.5 border-2 border-[#191c1e] bg-white text-[#862200] hover:bg-[#862200] hover:text-white transition-colors shrink-0"
                                title="Remover do evento"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Dialog open={addParticipantOpen} onOpenChange={(o) => { setAddParticipantOpen(o); if (!o) { setNewParticipantEmployeeId(null); setNewParticipantFunction(""); } }}>
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
                          data-testid="select-new-participant-employee"
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
                          <CommandInput data-testid="input-new-participant-search" placeholder="Buscar pelo nome..." className="italic" />
                          <CommandList className="max-h-[280px]">
                            <CommandEmpty className="py-6 text-center text-sm italic font-bold uppercase text-[#747a60]">Nenhum colaborador disponível.</CommandEmpty>
                            <CommandGroup>
                              {availableEmployees.map(e => (
                                <CommandItem
                                  key={e.id}
                                  value={e.name}
                                  data-testid={`option-new-participant-${e.id}`}
                                  onSelect={() => {
                                    setNewParticipantEmployeeId(e.id);
                                    setNewParticipantFunction(e.functionName ?? "");
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
                    <Input
                      data-testid="input-new-participant-function"
                      value={newParticipantFunction}
                      onChange={(e) => setNewParticipantFunction(e.target.value)}
                      placeholder="Ex: Operador, Auxiliar..."
                      className="h-11 rounded-none border-2 border-[#191c1e]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    data-testid="button-confirm-add-participant"
                    disabled={!newParticipantEmployeeId || addParticipant.isPending}
                    onClick={() => {
                      if (!newParticipantEmployeeId) return;
                      addParticipant.mutate({ id, data: { employeeId: newParticipantEmployeeId, functionName: newParticipantFunction || undefined } });
                    }}
                    className="w-full h-11 bg-[#191c1e] text-[#ccff00] font-black italic uppercase tracking-tight disabled:opacity-40 hover:bg-[#ccff00] hover:text-[#191c1e] border-2 border-[#191c1e] transition-colors"
                  >
                    {addParticipant.isPending ? "Adicionando..." : "Adicionar à Equipe"}
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

        {!event.isHistorical && <EventCommentsPanel eventId={id} />}
      </div>
    </div>
  );
}
