// Eventos históricos: seção "Observações Importadas" — a nota e as observações
// vindas da planilha, com a edição (só admin/RH).
import { useState, useEffect } from "react";
import { useUpdateHistoricalResult, getGetEventQueryKey, getGetEventResultQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Pencil } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn, fmtNum } from "@/lib/utils";
import { matrixTextareaCls } from "../evaluations/conformity-bits";
import { Eyebrow, FieldLabel, Section, btnPrimary, btnSecondary, btnSmall, inputCls } from "./detail-ui";

type HistoricalResultPanelProps = {
  eventId: number; currentScore: number | null | undefined; currentNotes: string | null | undefined; canManage: boolean;
};

export type ImportedNotesSectionProps = HistoricalResultPanelProps & {
  /** Admin/RH/diretoria leem a nota e as observações (o operador não vê nota). */
  canView?: boolean;
};

/** Seção inteira (cabeçalho + leitura/edição). O pai só a renderiza quando o evento é histórico. */
export function ImportedNotesSection({ eventId, currentScore, currentNotes, canManage, canView = false }: ImportedNotesSectionProps) {
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
        qc.invalidateQueries({ queryKey: getGetEventResultQueryKey(eventId) });
        setEditing(false);
      },
      onError: (err: unknown) => {
        const message = (err as { message?: string })?.message ?? "Erro ao atualizar resultado";
        toast({ title: message, variant: "destructive" });
      },
    },
  });

  const parsedScore = parseFloat(score.replace(",", "."));
  const scoreValid = score.trim() !== "" && !Number.isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100;
  const scoreInvalid = !scoreValid && score.trim() !== "";
  if (!canManage && !canView) return null;

  return (
    <Section
      id="event-imported"
      title="Observações importadas"
      icon={FileText}
      description="Evento histórico: a nota e as observações vieram da planilha."
      action={canManage && !editing ? (
        <button type="button" data-testid="button-edit-historical-result" onClick={() => setEditing(true)} className={btnSmall}>
          <Pencil size={14} aria-hidden /> Editar
        </button>
      ) : undefined}
    >
      {!editing ? (
        <div className="px-4 sm:px-5 py-4 grid sm:grid-cols-[160px_minmax(0,1fr)] gap-4">
          <div>
            <Eyebrow as="p">Nota importada</Eyebrow>
            <p className="mt-1.5 font-condensed text-[30px] font-black leading-none tabular-nums text-foreground">
              {currentScore != null ? fmtNum(currentScore, 1) : <span className="text-muted-foreground/60">—</span>}
              {currentScore != null && <span className="ml-1 text-[15px] font-bold text-muted-foreground">/100</span>}
            </p>
          </div>
          <div className="min-w-0">
            <Eyebrow as="p">Observações</Eyebrow>
            <p className="mt-1.5 text-[14px] leading-relaxed whitespace-pre-wrap break-words text-foreground">{currentNotes?.trim() ? currentNotes : <span className="text-muted-foreground">Sem observações.</span>}</p>
          </div>
        </div>
      ) : (
        <div data-testid="panel-historical-result-edit" className="px-4 sm:px-5 py-4 space-y-4 max-w-2xl">
          <div className="max-w-[200px]">
            <FieldLabel htmlFor="input-historical-score" hint="0 a 100">Nota</FieldLabel>
            <input id="input-historical-score" data-testid="input-historical-score" type="text" inputMode="decimal" value={score}
              onChange={(e) => setScore(e.target.value)} aria-invalid={scoreInvalid || undefined}
              aria-describedby={scoreInvalid ? "historical-score-error" : undefined}
              className={cn(inputCls, "font-condensed text-[18px] font-bold tabular-nums", scoreInvalid && "border-[var(--status-danger)]")} />
            {scoreInvalid && <p id="historical-score-error" role="alert" className="mt-1.5 text-[13px] font-semibold text-[var(--status-danger-text)]">Nota deve ser um número entre 0 e 100</p>}
          </div>
          <div>
            <FieldLabel htmlFor="textarea-historical-notes">Observações</FieldLabel>
            <Textarea id="textarea-historical-notes" data-testid="textarea-historical-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Comentários de conformidade/performance da planilha…" className={cn(matrixTextareaCls, "min-h-[120px]")} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button type="button" data-testid="button-cancel-historical-result" disabled={updateHistorical.isPending} onClick={() => setEditing(false)} className={btnSecondary}>
              Cancelar
            </button>
            <button
              type="button"
              data-testid="button-save-historical-result"
              disabled={!scoreValid || updateHistorical.isPending}
              aria-busy={updateHistorical.isPending || undefined}
              onClick={() => updateHistorical.mutate({ id: eventId, data: { importedScore: parsedScore, importedNotes: notes.trim() || null } })}
              className={btnPrimary}
            >
              {updateHistorical.isPending && <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" />}
              {updateHistorical.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}
