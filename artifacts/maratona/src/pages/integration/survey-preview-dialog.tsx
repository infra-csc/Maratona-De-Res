import type { SurveyImportResult, Event as ApiEvent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Users, Briefcase, AlertTriangle, ClipboardList } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import { DIALOG_STYLE } from "./shared";

type SurveyPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: SurveyImportResult | null;
  /** groupKey do evento da planilha → id do evento existente (-1 = ignorar as respostas). */
  linkOverrides: Record<string, number>;
  setLinkOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  /** Todos os eventos cadastrados, já ordenados por nome. */
  eventLinkOptions: ApiEvent[];
  allResolved: boolean;
  isCommitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Pré-visualização (dryRun) da pesquisa de avaliadores, com o vínculo obrigatório de cada evento. */
export function SurveyPreviewDialog({
  open,
  onOpenChange,
  preview: surveyPreview,
  linkOverrides: surveyLinkOverrides,
  setLinkOverrides: setSurveyLinkOverrides,
  eventLinkOptions,
  allResolved: surveyAllResolved,
  isCommitting,
  onCancel,
  onConfirm,
}: SurveyPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-xl border-border" style={DIALOG_STYLE}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={20} className="text-[var(--info)]" />
            Pré-visualização da pesquisa de avaliadores
          </DialogTitle>
          <DialogDescription>
            Nada foi gravado no banco ainda. Vincule <strong>cada evento</strong> da planilha a um evento já existente no sistema antes de confirmar. Nenhum evento novo será criado.
          </DialogDescription>
        </DialogHeader>

        {surveyPreview && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-secondary rounded-xl border border-border">
                <p className="text-xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-survey-total-rows">{surveyPreview.totalRows}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Linhas na planilha</p>
              </div>
              <div className="text-center p-3 bg-secondary rounded-xl border border-border">
                <p className="text-xl font-black text-foreground" style={{ fontFamily: CONDENSED }}>{surveyPreview.groups.length}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Eventos na planilha</p>
              </div>
              <div className="text-center p-3 bg-[var(--info)]/10 rounded-xl border border-[var(--info)]/30">
                <p className="text-xl font-black text-[var(--info)]" style={{ fontFamily: CONDENSED }}>{surveyPreview.avaliadoresToCreate.length}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Avaliadores novos</p>
              </div>
            </div>

            {surveyPreview.errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-xs font-bold text-destructive uppercase mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Erros ({surveyPreview.errors.length}) — bloqueiam a importação
                </p>
                <ul className="text-xs text-destructive space-y-1 max-h-40 overflow-y-auto">
                  {surveyPreview.errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              </div>
            )}

            {(surveyPreview.catalogChanges.toDeactivate.length > 0 || surveyPreview.catalogChanges.toCreateOrActivate.length > 0) && (
              <div className="bg-secondary border border-border rounded-lg p-3">
                <p className="text-xs font-bold text-foreground uppercase mb-1 flex items-center gap-1.5">
                  <Briefcase size={14} /> Mudanças no catálogo de critérios
                </p>
                {surveyPreview.catalogChanges.toCreateOrActivate.length > 0 && (
                  <p className="text-[11px] text-foreground mb-1">
                    <strong>Ativar/criar:</strong> {surveyPreview.catalogChanges.toCreateOrActivate.join(", ")}
                  </p>
                )}
                {surveyPreview.catalogChanges.toDeactivate.length > 0 && (
                  <p className="text-[11px] text-foreground">
                    <strong>Desativar:</strong> {surveyPreview.catalogChanges.toDeactivate.join(", ")}
                  </p>
                )}
              </div>
            )}

            {surveyPreview.avaliadoresToCreate.length > 0 && (
              <div className="bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg p-3">
                <p className="text-xs font-bold text-[var(--info)] uppercase mb-1 flex items-center gap-1.5">
                  <Users size={14} /> {surveyPreview.avaliadoresToCreate.length} avaliador(es) novo(s) serão cadastrados
                </p>
                <p className="text-[11px] text-[var(--info)] mb-2">Ao confirmar, cada um recebe um usuário com senha provisória (mostrada uma única vez logo após a importação).</p>
                <ul className="text-xs text-[var(--info)] space-y-1 max-h-32 overflow-y-auto">
                  {surveyPreview.avaliadoresToCreate.map((name, i) => <li key={i}>• {name}</li>)}
                </ul>
              </div>
            )}

            {surveyPreview.warnings.length > 0 && (
              <div className="bg-[var(--amber)]/10 border border-[var(--amber)]/30 rounded-lg p-3">
                <p className="text-xs font-bold text-[var(--amber)] uppercase mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Avisos ({surveyPreview.warnings.length})
                </p>
                <ul className="text-xs text-[var(--amber)] space-y-1 max-h-32 overflow-y-auto">
                  {surveyPreview.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Vincular cada evento da planilha</p>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-secondary text-muted-foreground uppercase text-[11px] font-bold">
                    <tr>
                      <th className="text-left p-2">Evento (planilha)</th>
                      <th className="text-left p-2">Linhas</th>
                      <th className="text-left p-2">Avaliadores</th>
                      <th className="text-left p-2 min-w-[240px]">Vincular a evento existente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveyPreview.groups.map((g, i) => {
                      const selectedId = surveyLinkOverrides[g.groupKey];
                      const isIgnored = selectedId === -1;
                      const selectedEvent = selectedId && !isIgnored
                        ? (g.suggestions.find(s => s.id === selectedId) ?? eventLinkOptions.find(e => e.id === selectedId))
                        : undefined;
                      return (
                        <tr key={g.groupKey} className="border-t border-border align-top" data-testid={`row-survey-group-${i}`}>
                          <td className="p-2 font-medium text-foreground">{g.eventLabel}</td>
                          <td className="p-2 text-muted-foreground">{g.rowCount}</td>
                          <td className="p-2 text-muted-foreground">{g.distinctEvaluators}</td>
                          <td className="p-2">
                            <Select
                              value={selectedId ? String(selectedId) : "none"}
                              onValueChange={(val) => {
                                setSurveyLinkOverrides(prev => {
                                  const next = { ...prev };
                                  if (val === "none") delete next[g.groupKey];
                                  else next[g.groupKey] = Number(val);
                                  return next;
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px] w-full" data-testid={`select-survey-link-${i}`}>
                                <SelectValue placeholder="Selecione um evento..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                <SelectItem value="none">— nenhum vínculo —</SelectItem>
                                <SelectItem value="-1">✕ Ignorar estas respostas (não importar)</SelectItem>
                                {g.suggestions.length > 0 && g.suggestions.map(s => (
                                  <SelectItem key={`sug-${s.id}`} value={String(s.id)}>
                                    ★ {s.name}{s.isHistorical ? " (histórico)" : ""}
                                  </SelectItem>
                                ))}
                                {eventLinkOptions.filter(e => !g.suggestions.some(s => s.id === e.id)).map(e => (
                                  <SelectItem key={e.id} value={String(e.id)}>
                                    {e.name}{e.isHistorical ? " (histórico)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!selectedId && (
                              <p className="text-[11px] text-destructive mt-1">Obrigatório — selecione um evento ou "Ignorar".</p>
                            )}
                            {isIgnored && (
                              <p className="text-[11px] text-muted-foreground mt-1">Estas respostas serão ignoradas na importação.</p>
                            )}
                            {selectedEvent?.isHistorical && (
                              <p className="text-[11px] text-[var(--amber)] mt-1">Evento histórico: só os comentários serão salvos como referência, sem notas.</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">★ = sugestão por semelhança de nome/cidade/data.</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isCommitting}>
            Cancelar
          </Button>
          <Button
            data-testid="button-confirm-survey-import"
            className="bg-primary hover:opacity-90 text-primary-foreground"
            disabled={!surveyPreview?.success || surveyPreview.errors.length > 0 || !surveyAllResolved || isCommitting}
            onClick={onConfirm}
          >
            <CheckCircle2 size={16} className="mr-2" />
            {isCommitting ? "Importando..." : "Confirmar e importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
