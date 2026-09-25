// Eventos históricos: seção "Observações Importadas" com a edição da nota e
// das observações vindas da planilha (só admin/RH).
import { useState, useEffect } from "react";
import { useUpdateHistoricalResult, getGetEventQueryKey, getGetEventResultQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CONDENSED, AMBER_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { fieldStyle } from "./helpers";

type HistoricalResultPanelProps = {
  eventId: number; currentScore: number | null | undefined; currentNotes: string | null | undefined; canManage: boolean;
};

function HistoricalResultPanel({
  eventId, currentScore, currentNotes, canManage,
}: HistoricalResultPanelProps) {
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
          className="px-3 py-1.5 rounded-lg font-black uppercase text-[11px] transition-colors hover:opacity-80"
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
      <p className="text-[11px] font-black uppercase" style={{ color: AMBER_TEXT }}>Evento Histórico — editar nota e observações importadas</p>
      <div>
        <Label className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nota (0-100)</Label>
        <Input data-testid="input-historical-score" type="text" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} className="text-sm rounded-lg mt-1" style={fieldStyle} />
      </div>
      <div>
        <Label className="text-[11px] font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Observações</Label>
        <Textarea data-testid="textarea-historical-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Comentários de conformidade/performance da planilha..." className="text-xs rounded-lg min-h-[80px] mt-1" style={fieldStyle} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          data-testid="button-save-historical-result"
          disabled={!scoreValid || updateHistorical.isPending}
          onClick={() => updateHistorical.mutate({ id: eventId, data: { importedScore: parsedScore, importedNotes: notes.trim() || null } })}
          className="px-3 py-1 rounded-lg font-black uppercase text-[11px] transition-opacity disabled:opacity-50 hover:opacity-90"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          {updateHistorical.isPending ? "Salvando..." : "Salvar"}
        </button>
        <button
          type="button"
          data-testid="button-cancel-historical-result"
          disabled={updateHistorical.isPending}
          onClick={() => setEditing(false)}
          className="px-3 py-1 rounded-lg font-black uppercase text-[11px] transition-colors disabled:opacity-50 hover:opacity-80"
          style={{ border: "1px solid var(--border)" }}
        >
          Cancelar
        </button>
      </div>
      {!scoreValid && score.trim() !== "" && (
        <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Nota deve ser um número entre 0 e 100</p>
      )}
    </div>
  );
}

export type ImportedNotesSectionProps = HistoricalResultPanelProps;

/** Seção inteira (cabeçalho + painel). O pai só a renderiza quando o evento é histórico. */
export function ImportedNotesSection(props: ImportedNotesSectionProps) {
  return (
    <section className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <MessageSquare size={16} style={{ color: "var(--accent-text)" }} />
        <span className="font-black uppercase tracking-tight text-xs" style={{ fontFamily: CONDENSED, color: "var(--accent-text)" }}>Observações Importadas</span>
      </div>
      <div className="p-5">
        <HistoricalResultPanel {...props} />
      </div>
    </section>
  );
}
