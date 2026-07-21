import { useRoute, Link } from "wouter";
import { useState, useEffect, useMemo } from "react";
import { useGetEvent, useGetEventResult, useGetEvaluations, useGetUsers, useRemoveEventParticipant, useAddEventParticipant, useUpdateEventParticipant, useGetEmployees, useGetEventConformity, useSetEventConformity, useSetConformityEvaluator, useSetConformityEvaluatorFerramentas, useConfirmEventResults, useUnconfirmEventResults, useUpdateHistoricalResult, useGetEventComments, useCreateEventComment, useDeleteEventComment, getGetEventQueryKey, getGetEventCommentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, BarChart3, CheckCircle2, ShieldAlert, Unlock, AlertTriangle, Trash2, UserCheck, UserX, UserPlus, Check, ChevronsUpDown, MessageSquare, Zap } from "lucide-react";
import { AudioPlayer } from "@/components/audio-recorder";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CONDENSED, BODY, WARNING } from "@/lib/premium-theme";

const GOOD = "#9ab000";
const AMBER = "#e8a23d";
const fieldStyle: React.CSSProperties = { backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" };

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

function ExpandableComment({ comment }: { comment: string }) {
  const [expanded, setExpanded] = useState(false);
  const MAX = 120;
  if (comment.length <= MAX) {
    return <p className="text-[11px] leading-snug whitespace-pre-wrap break-words mt-0.5">{comment}</p>;
  }
  return (
    <div className="mt-0.5">
      <p className="text-[11px] leading-snug whitespace-pre-wrap break-words">
        {expanded ? comment : comment.slice(0, MAX) + "…"}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="text-[10px] font-bold uppercase mt-0.5 hover:underline"
        style={{ color: "var(--accent)" }}
      >
        {expanded ? "Ver menos" : "Ver mais"}
      </button>
    </div>
  );
}

function ParticipantDiariaDialog({
  employeeId, employeeName, candidateDates, scheduledStart, scheduledEnd, scheduledCount,
  currentDates, quickConfirmed, isSaving, onSave, onQuickConfirm,
}: {
  employeeId: number; employeeName: string; candidateDates: string[];
  scheduledStart: string | null | undefined; scheduledEnd: string | null | undefined; scheduledCount: number | null | undefined;
  currentDates: string[]; quickConfirmed: boolean; isSaving: boolean;
  onSave: (dates: string[], onDone: () => void) => void;
  onQuickConfirm: (onDone: () => void) => void;
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

  const actionBtn = "flex items-center gap-1.5 px-3 py-2 rounded-lg font-black uppercase text-[11px] tracking-tight transition-opacity disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-testid={`button-diaria-dates-${employeeId}`}
          className="self-center flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
          style={
            quickConfirmed ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }
            : currentDates.length === 0 ? { backgroundColor: "rgba(232,162,61,0.14)", color: AMBER }
            : { border: "1px solid var(--border)" }
          }
        >
          {quickConfirmed ? <Zap size={11} className="shrink-0" /> : <Calendar size={11} className="shrink-0" />}
          <span className="text-[10px] font-bold uppercase">
            {quickConfirmed ? "Modo Rápido" : `Realizadas: ${currentDates.length}`}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>
            Diárias Realizadas — {employeeName}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">

          {/* ── MODO RÁPIDO ─────────────────────────────────────────────── */}
          <div className="rounded-xl p-4 space-y-3" style={{ border: quickConfirmed ? `1px solid ${GOOD}` : "1px solid var(--border)", backgroundColor: quickConfirmed ? "rgba(154,176,0,0.08)" : "var(--secondary)" }}>
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: quickConfirmed ? GOOD : "var(--muted-foreground)" }} />
              <span className="text-xs font-black uppercase tracking-tight">
                Modo Rápido — Confirmar Sem Comparar Datas
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Use quando a presença foi confirmada verbalmente ou via documento externo.
              O sistema trata como <strong>Realizadas = Previstas</strong> para fins de nota e elegibilidade.
            </p>
            {quickConfirmed ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase" style={{ color: GOOD }}>
                  <CheckCircle2 size={13} /> Presença confirmada em modo rápido
                </span>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onQuickConfirm(() => setOpen(false))}
                  className="text-[10px] font-bold uppercase underline underline-offset-2 disabled:opacity-40 hover:opacity-70"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  Desfazer
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid={`button-quick-confirm-${employeeId}`}
                disabled={isSaving}
                onClick={() => onQuickConfirm(() => setOpen(false))}
                className={actionBtn}
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                <Zap size={14} /> Confirmar Sem Comparar Datas
              </button>
            )}
          </div>

          {/* ── MODO DETALHADO ───────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar size={13} />
              <span className="text-xs font-black uppercase tracking-tight">
                Modo Detalhado — Selecione data a data
              </span>
            </div>
            {quickConfirmed && (
              <p className="text-[11px]" style={{ color: AMBER }}>
                Salvar datas específicas abaixo cancela o modo rápido automaticamente.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--secondary)" }}>
              <span className="text-xs font-bold uppercase">
                Previstas: {scheduledCount ?? "—"}
                {scheduledStart && scheduledEnd && (
                  <span className="normal-case font-semibold" style={{ color: "var(--muted-foreground)" }}> ({formatDiariaDate(scheduledStart)} – {formatDiariaDate(scheduledEnd)})</span>
                )}
              </span>
              <span data-testid={`text-diaria-selected-count-${employeeId}`} className="text-sm font-black uppercase" style={{ color: "var(--accent)" }}>
                Selecionadas: {selected.size}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" data-testid={`button-confirm-previstas-${employeeId}`} onClick={() => setSelected(new Set(scheduledSet))} disabled={scheduledSet.size === 0} className={actionBtn} style={{ border: "1px solid var(--border)" }}>
                <CheckCircle2 size={14} /> Marcar Previstas
              </button>
              <button type="button" onClick={() => setSelected(new Set(candidateDates))} className={actionBtn} style={{ border: "1px solid var(--border)" }}>
                Marcar Todos
              </button>
              <button type="button" onClick={() => setSelected(new Set())} disabled={selected.size === 0} className={actionBtn} style={{ border: "1px solid var(--border)" }}>
                Limpar
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
              {candidateDates.map(dateStr => {
                const checked = selected.has(dateStr);
                const isScheduled = scheduledSet.has(dateStr);
                return (
                  <button
                    key={dateStr}
                    type="button"
                    data-testid={`checkbox-diaria-${employeeId}-${dateStr}`}
                    onClick={() => toggle(dateStr)}
                    className="flex flex-col items-center justify-center gap-0.5 px-2 py-3 rounded-lg font-bold uppercase text-[11px] transition-colors"
                    style={checked ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)" }}
                  >
                    <span>{formatDiariaDate(dateStr)}</span>
                    {isScheduled && (
                      <span className="text-[8px] normal-case font-semibold" style={{ color: "var(--muted-foreground)" }}>prevista</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg font-black uppercase text-xs transition-colors hover:opacity-80" style={{ border: "1px solid var(--border)" }}>
            Cancelar
          </button>
          <button
            type="button"
            data-testid={`button-save-diaria-${employeeId}`}
            disabled={!dirty || isSaving}
            onClick={() => onSave(sortedSelected, () => setOpen(false))}
            className="px-4 py-2 rounded-lg font-black uppercase text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {isSaving ? "Salvando..." : "Salvar Datas"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParticipantCommentBox({
  participantId, employeeId, initialComment, canManage, reason, onSave, isSaving, isInactive,
}: {
  participantId: number; employeeId: number; initialComment: string | null | undefined;
  canManage: boolean; reason: string; onSave: (value: string) => void; isSaving: boolean; isInactive?: boolean;
}) {
  const [value, setValue] = useState(initialComment ?? "");
  useEffect(() => { setValue(initialComment ?? ""); }, [initialComment, participantId]);
  const dirty = value.trim() !== (initialComment ?? "").trim();

  if (!canManage) {
    if (!initialComment) return null;
    return (
      <div className="mt-1 p-2 flex items-start gap-1.5 rounded-lg" style={{ backgroundColor: "rgba(232,162,61,0.08)", border: "1px solid rgba(232,162,61,0.3)" }}>
        <MessageSquare size={12} className="shrink-0 mt-[2px]" style={{ color: AMBER }} />
        <p className="text-[11px] font-semibold whitespace-pre-wrap">{initialComment}</p>
      </div>
    );
  }

  return (
    <div className="mt-1 p-2 space-y-1.5 rounded-lg" style={{ backgroundColor: "rgba(232,162,61,0.08)", border: "1px solid rgba(232,162,61,0.3)" }}>
      <p className="text-[10px] font-black uppercase flex items-center gap-1.5" style={{ color: AMBER }}>
        <MessageSquare size={12} /> {reason}
      </p>
      <Textarea
        data-testid={`textarea-participant-comment-${employeeId}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Comentário / justificativa..."
        className="text-xs rounded-lg min-h-[56px] max-h-[80px] resize-none"
        style={fieldStyle}
      />
      <button
        type="button"
        data-testid={`button-save-participant-comment-${employeeId}`}
        disabled={isSaving || !dirty}
        onClick={() => onSave(value.trim())}
        className="px-3 py-1 rounded-lg font-black uppercase text-[10px] transition-opacity disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
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
    <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <MessageSquare size={16} style={{ color: "var(--accent)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Comentários do Evento</span>
      </div>
      <div className="p-5 space-y-4">
        <div data-testid="list-event-comments" className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
          {isLoading ? (
            <p className="text-xs font-bold uppercase text-center py-4" style={{ color: "var(--muted-foreground)" }}>Carregando...</p>
          ) : !comments || comments.length === 0 ? (
            <p className="text-xs font-bold uppercase text-center py-4" style={{ color: "var(--muted-foreground)" }}>Nenhum comentário ainda. Seja o primeiro a comentar.</p>
          ) : (
            comments.map(c => {
              const isOwner = !!user && user.id === c.userId;
              const canDelete = isOwner || canManage;
              return (
                <div key={c.id} data-testid={`comment-${c.id}`} className="rounded-lg p-3 flex items-start gap-3 group" style={{ backgroundColor: "var(--secondary)" }}>
                  <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center font-black text-[10px]" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>
                    {c.userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black uppercase text-xs">{c.userName}</span>
                      {c.userRole && (
                        <span className="px-1.5 py-0.5 rounded font-bold text-[9px] uppercase" style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
                          {COMMENT_ROLE_LABELS[c.userRole] ?? c.userRole}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold" style={{ color: "var(--muted-foreground)" }}>{formatCommentTimestamp(c.createdAt)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap mt-1 break-words">{c.message}</p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      data-testid={`button-delete-comment-${c.id}`}
                      onClick={() => deleteComment.mutate({ id: eventId, commentId: c.id })}
                      disabled={deleteComment.isPending}
                      className="p-1 transition-colors opacity-0 group-hover:opacity-100 shrink-0 disabled:opacity-40 hover:opacity-70"
                      style={{ color: WARNING }}
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
        <div className="flex items-start gap-2 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <Textarea
            data-testid="textarea-new-comment"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Escreva um comentário para toda a equipe..."
            className="text-sm rounded-lg min-h-[44px]"
            style={fieldStyle}
          />
          <button
            type="button"
            data-testid="button-send-comment"
            disabled={!trimmed || createComment.isPending}
            onClick={submit}
            className="h-11 px-4 shrink-0 rounded-lg font-black uppercase tracking-tight text-xs disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
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
          className="px-3 py-1.5 rounded-lg font-black uppercase text-[10px] transition-colors hover:opacity-80"
          style={{ border: "1px solid var(--border)" }}
        >
          Editar nota/observações importadas
        </button>
      </div>
    );
  }

  const parsedScore = parseFloat(score.replace(",", "."));
  const scoreValid = score.trim() !== "" && !Number.isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100;

  return (
    <div data-testid="panel-historical-result-edit" className="mt-4 p-3 rounded-lg space-y-2 w-full max-w-md" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-black uppercase" style={{ color: AMBER }}>Evento Histórico — editar nota e observações importadas</p>
      <div>
        <Label className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nota (0-100)</Label>
        <Input data-testid="input-historical-score" type="text" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} className="text-sm rounded-lg mt-1" style={fieldStyle} />
      </div>
      <div>
        <Label className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Observações</Label>
        <Textarea data-testid="textarea-historical-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Comentários de conformidade/performance da planilha..." className="text-xs rounded-lg min-h-[80px] mt-1" style={fieldStyle} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="button-save-historical-result"
          disabled={!scoreValid || updateHistorical.isPending}
          onClick={() => updateHistorical.mutate({ id: eventId, data: { importedScore: parsedScore, importedNotes: notes.trim() || null } })}
          className="px-3 py-1 rounded-lg font-black uppercase text-[10px] transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {updateHistorical.isPending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          data-testid="button-cancel-historical-result"
          disabled={updateHistorical.isPending}
          onClick={() => setEditing(false)}
          className="px-3 py-1 rounded-lg font-black uppercase text-[10px] transition-colors disabled:opacity-50 hover:opacity-80"
          style={{ border: "1px solid var(--border)" }}
        >
          Cancelar
        </button>
      </div>
      {!scoreValid && score.trim() !== "" && (
        <p className="text-[10px] font-bold" style={{ color: WARNING }}>Nota deve ser um número entre 0 e 100</p>
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
  const canManageConformity = canManage || (!!user && user.id === event?.conformityEvaluatorUserId);

  const [conformityEvaluatorPickerOpen, setConformityEvaluatorPickerOpen] = useState(false);
  const setConformityEvaluatorMutation = useSetConformityEvaluator({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        setConformityEvaluatorPickerOpen(false);
        toast({ title: "Avaliador de Cenografia atualizado" });
      },
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
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
      onError: () => toast({ title: "Erro ao atribuir avaliador", variant: "destructive" }),
    },
  });

  const { data: conformityData } = useGetEventConformity(id, {
    query: { enabled: !!id, queryKey: ["event-conformity", id] as unknown[] },
  });
  const setConformity = useSetEventConformity({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["event-conformity", id] });
        qc.invalidateQueries({ queryKey: ["event-result", id] });
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["/ranking"] as unknown[] });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
        toast({ title: "Matriz de conformidade atualizada", variant: "default" });
      },
      onError: () => toast({ title: "Erro ao salvar conformidade", variant: "destructive" }),
    },
  });
  type ConformityKey = "epi" | "estaiamentos" | "guardaEquipamentos" | "conduta";
  type ConformityCommentKey = "epiComment" | "estaiamentosComment" | "guardaEquipamentosComment" | "condutaComment";
  const [conformityForm, setConformityForm] = useState<{
    epi: boolean | null; estaiamentos: boolean | null; guardaEquipamentos: boolean | null; conduta: boolean | null;
    epiComment: string; estaiamentosComment: string; guardaEquipamentosComment: string; condutaComment: string;
    absencesResponse: boolean | null; absencesReport: string;
    standoutResponse: boolean | null; standoutJustification: string;
  }>({ epi: null, estaiamentos: null, guardaEquipamentos: null, conduta: null, epiComment: "", estaiamentosComment: "", guardaEquipamentosComment: "", condutaComment: "", absencesResponse: null, absencesReport: "", standoutResponse: null, standoutJustification: "" });
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const conformityItems: { key: ConformityKey; label: string; commentKey: ConformityCommentKey; group: "cenografia" | "ferramentas" }[] = [
    { key: "epi", label: "Uso de EPI", commentKey: "epiComment", group: "cenografia" },
    { key: "estaiamentos", label: "Estaiamentos / Aterramentos", commentKey: "estaiamentosComment", group: "cenografia" },
    { key: "guardaEquipamentos", label: "Guarda de Equipamentos", commentKey: "guardaEquipamentosComment", group: "ferramentas" },
    { key: "conduta", label: "Conduta", commentKey: "condutaComment", group: "cenografia" },
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
        epi: conformityData.epi ?? null,
        estaiamentos: conformityData.estaiamentos ?? null,
        guardaEquipamentos: conformityData.guardaEquipamentos ?? null,
        conduta: conformityData.conduta ?? null,
        epiComment: conformityData.epiComment ?? "",
        estaiamentosComment: conformityData.estaiamentosComment ?? "",
        guardaEquipamentosComment: conformityData.guardaEquipamentosComment ?? "",
        condutaComment: conformityData.condutaComment ?? "",
        absencesResponse: conformityData.absencesResponse ?? null,
        absencesReport: conformityData.absencesReport ?? "",
        standoutResponse: conformityData.standoutResponse ?? null,
        standoutJustification: conformityData.standoutJustification ?? "",
      });
    } else if (importedConformityAllValue !== null) {
      setConformityForm(f => ({
        ...f,
        epi: importedConformityAllValue,
        estaiamentos: importedConformityAllValue,
        guardaEquipamentos: importedConformityAllValue,
        conduta: importedConformityAllValue,
      }));
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
      const cid = matchCriterionByName(p.rawName, catalog);
      if (cid != null && !map.has(cid)) map.set(cid, p);
    }
    return map;
  }, [importedCriteriaScores, result?.criteriaDetails]);

  const [pendingRemoveParticipant, setPendingRemoveParticipant] = useState<number | null>(null);

  const confirmResults = useConfirmEventResults({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        qc.invalidateQueries({ queryKey: ["/ranking"] as unknown[] });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
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
        qc.invalidateQueries({ queryKey: ["/ranking"] as unknown[] });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
        toast({ title: "Confirmação revertida", description: "O evento deixou de contar na elegibilidade e na nota dos colaboradores." });
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao reverter confirmação", description: e.message, variant: "destructive" }),
    },
  });
  const resultsConfirmBusy = confirmResults.isPending || unconfirmResults.isPending;

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
        qc.invalidateQueries({ queryKey: ["event-result", id] as unknown[] });
        qc.invalidateQueries({ queryKey: ["results"] as unknown[] });
        qc.invalidateQueries({ queryKey: ["/ranking"] as unknown[] });
        qc.invalidateQueries({ queryKey: ["/ranking-detail"] as unknown[] });
        if (vars.data.confirmed !== undefined) {
          toast({ title: vars.data.confirmed ? "Colaborador reativado" : "Colaborador marcado como inativo" });
        } else if (vars.data.actualDiariaDates !== undefined) {
          toast({ title: "Diárias realizadas atualizadas" });
        } else if (vars.data.functionName !== undefined) {
          toast({ title: "Cargo no evento atualizado" });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
    },
  });

  // Funções comuns pré-definidas para o seletor de participante.
  const PARTICIPANT_FUNCTIONS = [
    "Cenotécnica",
    "Cenotécnica Local",
    "Cenotécnico",
    "Sup Ceno",
    "Sup Ceno Local",
    "Colaborador",
  ] as const;
  const DEFAULT_FUNCTION = "Cenotécnica";

  /** Retorna a opção pré-definida que melhor corresponde ao functionName do colaborador. */
  function matchParticipantFunction(fn?: string | null): string {
    if (!fn) return DEFAULT_FUNCTION;
    const norm = fn.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const exact = PARTICIPANT_FUNCTIONS.find(
      o => o.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === norm
    );
    if (exact) return exact;
    const prefix = PARTICIPANT_FUNCTIONS.find(
      o => norm.startsWith(o.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
    );
    return prefix ?? DEFAULT_FUNCTION;
  }

  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [newParticipantEmployeeId, setNewParticipantEmployeeId] = useState<number | null>(null);
  const [newParticipantFunction, setNewParticipantFunction] = useState<string>(DEFAULT_FUNCTION);
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

  if (isLoading) {
    return (
      <div className="min-h-full p-6 md:p-10 max-w-6xl mx-auto space-y-6" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
        <div className="h-8 w-32 rounded-lg animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
        <div className="h-40 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
          <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: "var(--secondary)" }} />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-full p-6 md:p-10 max-w-4xl mx-auto text-center" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>
        <div className="py-24 rounded-xl font-bold uppercase" style={{ border: "1px dashed var(--border)", color: "var(--muted-foreground)" }}>
          Evento não encontrado ou indisponível.
        </div>
      </div>
    );
  }

  const fmt = (v: number) => `${v.toFixed(1)}`;
  const evaluationProgress = Math.round((event.evaluationProgress ?? 0) * 100);
  const activeCriteriaCount = (event.criteria ?? []).filter(c => c.active).length;

  return (
    <div className="min-h-full" style={{ backgroundColor: "var(--background)", color: "var(--foreground)", fontFamily: BODY }}>

      {/* ── Header ── */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/events" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase mb-2.5 transition-colors hover:opacity-70" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={12} /> Eventos
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 data-testid="text-event-name" className="font-black uppercase text-2xl tracking-tight leading-none" style={{ fontFamily: CONDENSED }}>{event.name}</h1>
              {event.isHistorical && (
                <span data-testid="badge-historical" className="px-2.5 py-1 rounded-full font-bold text-[9px] uppercase" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER }}>Histórico</span>
              )}
              {event.forcedClosed && (
                <span className="px-2.5 py-1 rounded-full font-bold text-[9px] uppercase inline-flex items-center gap-1" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}>
                  <ShieldAlert size={8} /> Fechamento Forçado
                </span>
              )}
              {event.resultsConfirmed ? (
                <span data-testid="badge-results-confirmed" className="px-2.5 py-1 rounded-full font-bold text-[9px] uppercase" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>Resultados Confirmados</span>
              ) : (
                <span data-testid="badge-results-pending" className="px-2.5 py-1 rounded-full font-bold text-[9px] uppercase" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}>Não Confirmado</span>
              )}
            </div>
            <p className="text-[12px] font-semibold mt-1.5" style={{ color: "var(--muted-foreground)" }}>
              {[event.clientName, event.city ? `${event.city}${event.state ? `, ${event.state}` : ""}` : event.location].filter(Boolean).join(" · ")}
              {" · "}
              {new Date(event.startDate).toLocaleDateString('pt-BR')} — {new Date(event.endDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            <Link href={`/calibrations?eventId=${event.id}`} className="h-9 px-4 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1.5 transition-colors hover:opacity-80" style={{ fontFamily: CONDENSED, border: "1px solid var(--border)" }}>
              Calibração
            </Link>
            {canManage && (
              event.resultsConfirmed ? (
                <button
                  data-testid="button-unconfirm-results"
                  onClick={() => unconfirmResults.mutate({ id })}
                  disabled={resultsConfirmBusy}
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: WARNING, color: "#fff" }}
                >
                  <Unlock size={13} /> {resultsConfirmBusy ? "Revertendo..." : "Desconfirmar Resultados"}
                </button>
              ) : (
                <button
                  data-testid="button-confirm-results"
                  onClick={() => confirmResults.mutate({ id })}
                  disabled={resultsConfirmBusy}
                  className="h-9 px-4 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
                >
                  <CheckCircle2 size={13} /> {resultsConfirmBusy ? "Confirmando..." : "Confirmar Resultados"}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">

        {/* ── Summary cards ── */}
        {(() => {
          const displayScore = result && result.eventScore > 0
            ? (result.conformityScore != null ? result.conformityScore : result.eventScore) as number
            : null;
          const nonConformCount = conformityItems.filter(i => conformityForm[i.key] === false).length;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED, color: displayScore != null ? "var(--accent)" : "var(--muted-foreground)" }}>{displayScore != null ? fmt(displayScore) : "—"}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Nota do Evento</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{event.participants?.filter(p => p.countsForScore !== false).length ?? 0}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Participantes</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED }}>{result?.evaluatedCriteria ?? 0}/{result?.totalCriteria ?? activeCriteriaCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Critérios Avaliados</div>
              </div>
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="font-black text-2xl leading-none" style={{ fontFamily: CONDENSED, color: nonConformCount > 0 ? WARNING : "var(--foreground)" }}>{nonConformCount}</div>
                <div className="text-[10px] font-bold uppercase tracking-wide mt-1.5" style={{ color: "var(--muted-foreground)" }}>Itens Não Conformes</div>
              </div>
            </div>
          );
        })()}

        {/* ── Critérios de Avaliação (leitura — gestão de critérios agora em Avaliações) ── */}
        {canViewResult && result && result.criteriaDetails && result.criteriaDetails.length > 0 && (
          <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Critérios de Avaliação</span>
            </div>
            <div className="flex flex-col">
              {result.criteriaDetails.map(c => {
                const calibrated = c.calibratedScore != null;
                const justifications = justificationsFor(c.criterionId);
                const imp = !calibrated ? importedCriteriaMap.get(c.criterionId) : undefined;
                return (
                  <div key={c.criterionId} data-testid={`row-criterion-detail-${c.criterionId}`} className="px-5 py-3.5 flex justify-between items-start gap-4 flex-wrap" style={{ borderBottom: "1px solid var(--border)" }}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold uppercase text-sm">{c.criterionName}</span>
                        {c.responsibleAreaLabel && (
                          <span className="text-[9px] font-bold uppercase rounded px-2 py-0.5" style={{ color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>{c.responsibleAreaLabel}</span>
                        )}
                        <span className="text-[9px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Peso {fmt(c.weight)}</span>
                      </div>
                      {justifications.length > 0 && (
                        <div className="mt-2 space-y-1.5" data-testid={`justifications-${c.criterionId}`}>
                          {justifications.map((j, i) => (
                            <div key={i} className="rounded-lg px-3 py-2" style={{ backgroundColor: "var(--secondary)" }}>
                              <p className="text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliado por <span style={{ color: "var(--foreground)" }}>{j.name}</span> — {j.score.toFixed(1)}</p>
                              {j.comment ? <ExpandableComment comment={j.comment} /> : null}
                              {j.audioUrl && <div className="mt-1.5"><AudioPlayer objectPath={j.audioUrl} /></div>}
                            </div>
                          ))}
                        </div>
                      )}
                      {calibrated && c.calibrationReason && (
                        <>
                          <p className="mt-2 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Calibração</p>
                          <div className="mt-1 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "rgba(154,176,0,0.10)", border: "1px solid rgba(154,176,0,0.25)" }}>{c.calibrationReason}</div>
                        </>
                      )}
                      {imp?.comment && (
                        <div className="mt-1 rounded-lg px-3 py-2 text-[12px]" style={{ backgroundColor: "var(--secondary)" }}>{imp.comment}</div>
                      )}
                    </div>
                    <div className="flex gap-6 items-center shrink-0">
                      <div className="text-center">
                        <span className="block text-[9px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Avaliador</span>
                        <span className="font-black text-base" style={{ fontFamily: CONDENSED }}>{c.averageScore != null ? fmt(c.averageScore) : "—"}</span>
                      </div>
                      <div className="text-center">
                        <span className="block text-[9px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Calibrada</span>
                        {calibrated ? (
                          <span className="font-black text-lg" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>{fmt(c.calibratedScore as number)}</span>
                        ) : imp && !imp.excluded ? (
                          <span className="font-black text-lg" style={{ fontFamily: CONDENSED, color: AMBER }}>{fmt(imp.score)}</span>
                        ) : (
                          <span className="text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>{imp?.excluded ? "Não avaliado" : "—"}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Eventos históricos: observações importadas */}
        {event.isHistorical && (
          <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <MessageSquare size={16} style={{ color: "var(--accent)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Observações Importadas</span>
            </div>
            <div className="p-5">
              <HistoricalResultPanel eventId={event.id} currentScore={event.importedScore} currentNotes={event.importedNotes} canManage={canManage} />
            </div>
          </section>
        )}

        {/* ── Equipe Alocada ── */}
        {((event.participants && event.participants.length > 0) || canManage) && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Equipe Alocada ({event.participants?.filter(p => p.countsForScore !== false).length ?? 0})</span>
              {canManage && (
                <button
                  data-testid="button-add-participant"
                  onClick={() => setAddParticipantOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors hover:opacity-80"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <UserPlus size={12} /> Adicionar
                </button>
              )}
            </div>
            {(!event.participants || event.participants.length === 0) ? (
              <div className="py-8 text-center text-xs font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador alocado.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 items-stretch">
                {event.participants.slice().sort((a, b) => {
                  const aScores = a.countsForScore !== false ? 0 : 1;
                  const bScores = b.countsForScore !== false ? 0 : 1;
                  if (aScores !== bScores) return aScores - bScores;
                  return a.employeeName.localeCompare(b.employeeName, "pt-BR");
                }).map(p => {
                  const isInactive = p.confirmed === false;
                  const isConfirmed = p.confirmed === true;
                  const isInformational = p.countsForScore === false;
                  const selectedDates = p.actualDiariaDates ?? [];
                  const realizadasCount = p.actualDiariaDates != null ? p.actualDiariaDates.length : p.actualDiariaCount;
                  const candidateDates = eventDateRange(event.startDate, event.endDate);
                  const isQuickConfirmed = p.diariaQuickConfirmed === true;
                  const hasZeroDiarias = !isConfirmed && (realizadasCount == null || realizadasCount === 0);
                  const showCommentBox = isInactive || hasZeroDiarias;
                  const commentReason = isInactive ? "Colaborador inativo — justifique" : "Nenhuma diária realizada — justifique";
                  return (
                    <div
                      key={p.id}
                      data-testid={`chip-participant-${p.employeeId}`}
                      className="flex flex-col h-full rounded-lg overflow-hidden relative"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      {(isInactive || isInformational) && <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: WARNING }} />}
                      <div className="flex flex-col flex-1 p-4 gap-2" style={{ opacity: isInactive ? 0.55 : 1 }}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs shrink-0" style={{ backgroundColor: "var(--secondary)" }}>
                            {p.employeeName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                          <p className="flex-1 font-bold uppercase text-sm leading-tight min-w-0 break-words">{p.employeeName}</p>
                          {canManage && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                data-testid={`button-toggle-participant-${p.employeeId}`}
                                onClick={() => updateParticipant.mutate({ id, participantId: p.id, data: { confirmed: isInactive } })}
                                className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                                style={isInactive ? { border: "1px solid var(--border)" } : { backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}
                                title={isInactive ? "Reativar colaborador" : "Marcar como inativo (não compareceu)"}
                              >
                                {isInactive ? <UserCheck size={13} /> : <UserX size={13} />}
                              </button>
                              <button
                                data-testid={`button-remove-participant-${p.employeeId}`}
                                onClick={() => setPendingRemoveParticipant(p.id)}
                                className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                                style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}
                                title="Remover do evento"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </div>

                        {canManage ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={matchParticipantFunction(p.functionName)}
                              onChange={(e) => {
                                if (e.target.value !== matchParticipantFunction(p.functionName)) {
                                  updateParticipant.mutate({ id, participantId: p.id, data: { functionName: e.target.value } });
                                }
                              }}
                              className="text-[10px] font-bold uppercase bg-transparent border-0 border-b border-dashed focus:outline-none cursor-pointer px-0 py-0 leading-tight appearance-none pr-3"
                              style={{ color: "var(--muted-foreground)", borderBottomColor: "var(--border)" }}
                              title="Cargo/função deste colaborador neste evento"
                            >
                              {PARTICIPANT_FUNCTIONS.map(fn => (
                                <option key={fn} value={fn}>{fn}</option>
                              ))}
                            </select>
                            {isInactive && <span className="text-[10px] font-bold uppercase" style={{ color: WARNING }}>· Inativo</span>}
                          </div>
                        ) : (
                          <p className="text-[10px] font-bold uppercase leading-tight" style={{ color: "var(--muted-foreground)" }}>
                            {p.functionName}{isInactive && <span style={{ color: WARNING }}> · Inativo</span>}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase" style={{ backgroundColor: p.employmentType === "freela" ? "var(--secondary)" : "transparent", border: "1px solid var(--border)" }}>
                            {p.employmentType === "freela" ? "Freela" : "Casa"}
                          </span>
                          {isInformational && (
                            <span
                              data-testid={`badge-no-score-${p.employeeId}`}
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                              style={{ backgroundColor: WARNING, color: "#fff" }}
                              title="Participação apenas histórica/informativa — não entra na nota nem na elegibilidade."
                            >
                              Não conta p/ nota
                            </span>
                          )}
                        </div>

                        {isInformational ? (
                          <p className="text-[10px] font-bold uppercase" style={{ color: WARNING, opacity: 0.8 }}>
                            Participação informativa — sem controle de diárias.
                          </p>
                        ) : (p.scheduledDiariaCount != null || realizadasCount != null || canManage) ? (
                          <div className="flex items-start gap-2 flex-wrap">
                            <div
                              data-testid={`text-scheduled-diaria-${p.employeeId}`}
                              className="flex items-start gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase leading-tight"
                              style={{ border: "1px solid var(--border)" }}
                              title="Diárias previstas vêm da escalação (logística interna)."
                            >
                              <Calendar size={11} className="shrink-0 mt-[1px]" />
                              <div>
                                <div>
                                  Previstas:{" "}
                                  {p.scheduledDiariaCount != null ? p.scheduledDiariaCount : (
                                    <span className="normal-case not-italic font-semibold" style={{ color: "var(--muted-foreground)" }} title="Sem diárias previstas cadastradas na Logística Interna">Não cadastrado</span>
                                  )}
                                </div>
                                {p.scheduledDiariaStart && p.scheduledDiariaEnd && (
                                  <div className="normal-case font-semibold" style={{ color: "var(--muted-foreground)" }}>
                                    {formatDiariaDate(p.scheduledDiariaStart)} – {formatDiariaDate(p.scheduledDiariaEnd)}
                                  </div>
                                )}
                              </div>
                            </div>
                            {canManage ? (
                              <>
                                {!isQuickConfirmed && (
                                  <button
                                    type="button"
                                    data-testid={`button-quick-ok-${p.employeeId}`}
                                    disabled={updateParticipant.isPending}
                                    onClick={() => {
                                      updateParticipant.mutate(
                                        { id, participantId: p.id, data: { diariaQuickConfirmed: true } },
                                        { onSuccess: () => toast({ title: `Confirmado ✓ — ${p.employeeName}`, description: "Diária tratada como cumprida." }) },
                                      );
                                    }}
                                    title="Confirmar diárias como cumpridas sem abrir o calendário detalhado"
                                    className="self-center flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors whitespace-nowrap disabled:opacity-40 hover:opacity-80"
                                    style={{ border: `1px solid ${GOOD}`, color: GOOD }}
                                  >
                                    <CheckCircle2 size={11} className="shrink-0" />
                                    <span className="text-[10px] font-bold uppercase">Confirmar/OK</span>
                                  </button>
                                )}
                                <ParticipantDiariaDialog
                                  employeeId={p.employeeId}
                                  employeeName={p.employeeName}
                                  candidateDates={candidateDates}
                                  scheduledStart={p.scheduledDiariaStart}
                                  scheduledEnd={p.scheduledDiariaEnd}
                                  scheduledCount={p.scheduledDiariaCount}
                                  currentDates={selectedDates}
                                  quickConfirmed={isQuickConfirmed}
                                  isSaving={updateParticipant.isPending}
                                  onSave={(dates, onDone) => {
                                    updateParticipant.mutate({ id, participantId: p.id, data: { actualDiariaDates: dates } }, { onSuccess: onDone });
                                  }}
                                  onQuickConfirm={(onDone) => {
                                    updateParticipant.mutate({ id, participantId: p.id, data: { diariaQuickConfirmed: !isQuickConfirmed } }, { onSuccess: onDone });
                                  }}
                                />
                              </>
                            ) : realizadasCount != null ? (
                              <span className="self-center text-[10px] font-bold uppercase whitespace-nowrap" style={{ color: "var(--muted-foreground)" }}>
                                Realizadas: {realizadasCount}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {showCommentBox && (
                        <div className="px-4 pb-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                          <ParticipantCommentBox
                            participantId={p.id}
                            employeeId={p.employeeId}
                            initialComment={p.comment}
                            canManage={canManage}
                            reason={commentReason}
                            isInactive={isInactive}
                            isSaving={updateParticipant.isPending}
                            onSave={(value) => updateParticipant.mutate({ id, participantId: p.id, data: { comment: value || null } })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <AlertDialog open={pendingRemoveParticipant !== null} onOpenChange={o => { if (!o) setPendingRemoveParticipant(null); }}>
          <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <AlertDialogHeader>
              <AlertDialogTitle className="uppercase font-black tracking-tight">Remover participante?</AlertDialogTitle>
              <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
                O colaborador <strong>{event?.participants?.find(p => p.id === pendingRemoveParticipant)?.employeeName ?? ""}</strong> será removido da equipe deste evento. Se ele já possuir avaliações enviadas, as notas serão perdidas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-remove-participant" className="rounded-lg uppercase font-bold" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                data-testid="button-confirm-remove-participant"
                onClick={() => {
                  if (pendingRemoveParticipant !== null) removeParticipant.mutate({ id, participantId: pendingRemoveParticipant });
                  setPendingRemoveParticipant(null);
                }}
                className="rounded-lg uppercase font-bold"
                style={{ backgroundColor: WARNING, color: "#fff" }}
              >
                <Trash2 size={16} className="mr-1.5" /> Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={addParticipantOpen} onOpenChange={(o) => { setAddParticipantOpen(o); if (!o) { setNewParticipantEmployeeId(null); setNewParticipantFunction(DEFAULT_FUNCTION); } }}>
          <DialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <DialogHeader>
              <DialogTitle className="font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Adicionar Colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Colaborador <span style={{ color: WARNING }}>*</span></Label>
                <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={employeePickerOpen}
                      data-testid="select-new-participant-employee"
                      className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-lg text-left"
                      style={fieldStyle}
                    >
                      <span className={cn("truncate text-sm", selectedNewEmployee ? "font-bold uppercase" : "font-bold uppercase text-xs tracking-wider")} style={!selectedNewEmployee ? { color: "var(--muted-foreground)" } : undefined}>
                        {selectedNewEmployee ? selectedNewEmployee.name : "Busque pelo nome..."}
                      </span>
                      <ChevronsUpDown size={16} className="shrink-0 opacity-60" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                    <Command>
                      <CommandInput data-testid="input-new-participant-search" placeholder="Buscar pelo nome..." />
                      <CommandList className="max-h-[280px]">
                        <CommandEmpty className="py-6 text-center text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador disponível.</CommandEmpty>
                        <CommandGroup>
                          {availableEmployees.map(e => (
                            <CommandItem
                              key={e.id}
                              value={e.name}
                              data-testid={`option-new-participant-${e.id}`}
                              onSelect={() => {
                                setNewParticipantEmployeeId(e.id);
                                setNewParticipantFunction(matchParticipantFunction(e.functionName));
                                setEmployeePickerOpen(false);
                              }}
                              className="cursor-pointer py-2 gap-2"
                            >
                              <Check size={16} className={cn("shrink-0", newParticipantEmployeeId === e.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-black uppercase text-sm truncate">{e.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Função no Evento</Label>
                <Select value={newParticipantFunction} onValueChange={setNewParticipantFunction}>
                  <SelectTrigger data-testid="select-new-participant-function" className="h-11 rounded-lg font-black uppercase text-sm" style={fieldStyle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTICIPANT_FUNCTIONS.map(fn => (
                      <SelectItem key={fn} value={fn} className="font-bold uppercase text-sm cursor-pointer">{fn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                className="w-full h-11 rounded-lg font-black uppercase tracking-tight disabled:opacity-40 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
              >
                {addParticipant.isPending ? "Adicionando..." : "Adicionar à Equipe"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Matriz de Conformidade ── */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <ShieldAlert size={16} style={{ color: "var(--accent)" }} />
            <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Matriz de Conformidade</span>
          </div>
          {canManage ? (
            <div className="flex flex-col min-[480px]:flex-row" style={{ borderBottom: "1px solid var(--border)" }}>
              {[
                { label: "Ferramentas", open: conformityEvaluatorFerramentasPickerOpen, setOpen: setConformityEvaluatorFerramentasPickerOpen, current: event?.conformityEvaluatorFerramentasUserId, currentName: event?.conformityEvaluatorFerramentasName, mut: setConformityEvaluatorFerramentasMutation },
                { label: "Cenografia", open: conformityEvaluatorPickerOpen, setOpen: setConformityEvaluatorPickerOpen, current: event?.conformityEvaluatorUserId, currentName: event?.conformityEvaluatorName, mut: setConformityEvaluatorMutation },
              ].map(g => (
                <div key={g.label} className="flex-1 px-4 py-2.5 flex items-center gap-2 min-w-0">
                  <span className="text-[9px] font-black uppercase shrink-0" style={{ color: "var(--muted-foreground)" }}>{g.label}:</span>
                  <Popover open={g.open} onOpenChange={g.setOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" title={g.currentName ?? "Sem avaliador"} className="flex items-center gap-1 text-[10px] font-bold uppercase rounded-lg px-2 py-1 transition-colors flex-1 min-w-0 hover:opacity-80" style={fieldStyle}>
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
          ) : (event?.conformityEvaluatorName || event?.conformityEvaluatorFerramentasName) ? (
            <div className="flex flex-col min-[480px]:flex-row text-[10px] font-bold" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
              <div className="flex-1 px-4 py-2.5 flex items-center gap-1.5 min-w-0"><span className="uppercase shrink-0">Ferramentas:</span><span className="truncate" style={{ color: "var(--foreground)" }}>{event.conformityEvaluatorFerramentasName ?? "—"}</span></div>
              <div className="flex-1 px-4 py-2.5 flex items-center gap-1.5 min-w-0"><span className="uppercase shrink-0">Cenografia:</span><span className="truncate" style={{ color: "var(--foreground)" }}>{event.conformityEvaluatorName ?? "—"}</span></div>
            </div>
          ) : null}

          {!conformityData && importedConformityRatio && (
            <p className="px-5 pt-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>
              {importedConformityAllValue !== null
                ? `Inferido das observações importadas (${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim")`
                : `Observações importadas indicam ${importedConformityRatio.sim}/${importedConformityRatio.total} itens "Sim" — não é possível identificar qual item pelo texto`}
            </p>
          )}

          {(["cenografia", "ferramentas"] as const).map(group => {
            const groupItems = conformityItems.filter(i => i.group === group);
            if (groupItems.length === 0) return null;
            const groupLabel = group === "cenografia" ? "Cenografia" : "Ferramentas e Case";
            const evaluatorName = group === "cenografia" ? (event?.conformityEvaluatorName ?? null) : (event?.conformityEvaluatorFerramentasName ?? null);
            return (
              <div key={group}>
                <div className="flex items-center gap-2 px-5 py-2" style={{ backgroundColor: "var(--secondary)", borderTop: "1px solid var(--border)" }}>
                  <span className="text-[10px] font-black uppercase">{groupLabel}</span>
                  {evaluatorName ? <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>— {evaluatorName}</span> : <span className="text-[10px]" style={{ color: WARNING }}>— sem avaliador atribuído</span>}
                </div>
                {groupItems.map(item => {
                  const value = conformityForm[item.key];
                  const comment = conformityForm[item.commentKey];
                  const isNonConforming = value === false;
                  const isPending = value === null;
                  const needsComment = (isNonConforming || isPending) && !comment.trim();
                  const isExpanded = expandedComments.has(item.key);
                  return (
                    <div key={item.key} className="px-5" style={{ borderTop: "1px solid var(--border)", backgroundColor: isNonConforming ? "rgba(229,72,77,0.06)" : isPending ? "rgba(232,162,61,0.06)" : "transparent" }}>
                      <div className="grid items-center min-h-[52px]" style={{ gridTemplateColumns: "1fr auto auto" }}>
                        <div className="pr-4 py-3 leading-snug" style={{ maxWidth: 280 }}>
                          <span className="text-sm font-bold">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 py-2">
                          {isNonConforming && <span className="text-[10px] font-black uppercase whitespace-nowrap mr-1" style={{ color: WARNING }}>-10 pts</span>}
                          {canManageConformity ? (
                            <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                              <button type="button" onClick={() => { setConformityForm({ ...conformityForm, [item.key]: true }); setConformity.mutate({ id, data: { [item.key]: true } }); }} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === true ? "var(--primary)" : "transparent", color: value === true ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>Sim</button>
                              <button type="button" onClick={() => { setConformityForm({ ...conformityForm, [item.key]: false }); setConformity.mutate({ id, data: { [item.key]: false } }); }} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: value === false ? WARNING : "transparent", color: value === false ? "#fff" : "var(--muted-foreground)" }}>Não</button>
                              <button type="button" onClick={() => { setConformityForm({ ...conformityForm, [item.key]: null }); setConformity.mutate({ id, data: { [item.key]: null } }); }} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ backgroundColor: value === null ? "rgba(232,162,61,0.24)" : "transparent", color: value === null ? AMBER : "var(--muted-foreground)" }}>Pendente</button>
                            </div>
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
                              onClick={() => setExpandedComments(prev => { const next = new Set(prev); if (next.has(item.key)) next.delete(item.key); else next.add(item.key); return next; })}
                              className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                              style={needsComment ? { color: WARNING, backgroundColor: "rgba(229,72,77,0.10)" } : comment ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
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
                            onClick={() => setConformity.mutate({ id, data: { [item.commentKey]: comment || null } })}
                            className="px-3 py-1 rounded-lg font-black uppercase text-[10px] disabled:opacity-50 transition-opacity hover:opacity-90"
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
                <span className="text-[10px] font-black uppercase">Cenografia</span>
                <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>— Respostas Extras</span>
              </div>
              <div className="px-5 py-3.5 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">Faltou / Atrasou?</span>
                  {conformityForm.absencesResponse !== null
                    ? <span className="text-[10px] font-black uppercase rounded px-2 py-0.5" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>Respondido</span>
                    : <span className="text-[10px] font-black uppercase rounded px-2 py-0.5" style={{ backgroundColor: "rgba(232,162,61,0.14)", color: AMBER }}>Não respondido</span>}
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
                      onClick={() => setConformity.mutate({ id, data: { absencesResponse: conformityForm.absencesReport.trim() ? true : null, absencesReport: conformityForm.absencesReport || null } })}
                      className="px-3 py-1 rounded-lg font-black uppercase text-[10px] disabled:opacity-50 transition-opacity hover:opacity-90"
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
                      <button type="button" onClick={() => { setConformityForm(f => ({ ...f, standoutResponse: false, standoutJustification: "" })); setConformity.mutate({ id, data: { standoutResponse: false, standoutJustification: null } }); }} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ borderRight: "1px solid var(--border)", backgroundColor: conformityForm.standoutResponse === false ? "var(--primary)" : "transparent", color: conformityForm.standoutResponse === false ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>Não</button>
                      <button type="button" onClick={() => { setConformityForm(f => ({ ...f, standoutResponse: true })); setConformity.mutate({ id, data: { standoutResponse: true } }); }} className="px-2.5 py-1 text-[11px] font-black uppercase transition-all" style={{ backgroundColor: conformityForm.standoutResponse === true ? GOOD : "transparent", color: conformityForm.standoutResponse === true ? "#fff" : "var(--muted-foreground)" }}>Sim</button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded shrink-0" style={{ backgroundColor: conformityForm.standoutResponse === true ? GOOD : conformityForm.standoutResponse === false ? "var(--primary)" : "rgba(232,162,61,0.24)", color: conformityForm.standoutResponse === true ? "#fff" : conformityForm.standoutResponse === false ? "var(--primary-foreground)" : AMBER }}>
                      {conformityForm.standoutResponse === true ? "Sim" : conformityForm.standoutResponse === false ? "Não" : "Pendente"}
                    </span>
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
                        onClick={() => setConformity.mutate({ id, data: { standoutJustification: conformityForm.standoutJustification || null } })}
                        className="px-3 py-1 rounded-lg font-black uppercase text-[10px] disabled:opacity-50 transition-opacity hover:opacity-90"
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

          {(result?.conformityPenalty ?? 0) > 0 && (
            <div className="px-5 pt-3 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-bold uppercase flex items-center gap-1.5" style={{ color: WARNING }}>
                <AlertTriangle size={13} /> Desconto na nota final do evento: -{result?.conformityPenalty} pts
              </p>
            </div>
          )}
        </div>

        {/* ── Performance Individual ── */}
        {hasPerformanceTable && result && result.eventScore > 0 && participantResults.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <BarChart3 size={16} style={{ color: "var(--accent)" }} />
              <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent)" }}>Performance Individual (Equipe)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Colaborador</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Score Equivalente</th>
                    <th className="px-5 py-3 text-[10px] font-bold uppercase text-center" style={{ color: "var(--muted-foreground)" }}>Elegibilidade</th>
                  </tr>
                </thead>
                <tbody>
                  {participantResults.map(p => (
                    <tr key={p.employeeId} data-testid={`row-event-result-${p.employeeId}`} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-5 py-3.5 font-bold uppercase text-sm">{p.employeeName}</td>
                      <td className="px-5 py-3.5 text-center">
                        <span className="inline-block font-black px-3 py-1 rounded-lg" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>{fmt(p.eventScore)}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {p.eligible === false ? (
                          <span className="inline-block text-[10px] uppercase font-black rounded-full px-2 py-1" style={{ backgroundColor: "rgba(229,72,77,0.12)", color: WARNING }}>Inativo/Inelegível</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black rounded-full px-2 py-1" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD }}>
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

        {!event.isHistorical && <EventCommentsPanel eventId={id} />}
      </div>
    </div>
  );
}
