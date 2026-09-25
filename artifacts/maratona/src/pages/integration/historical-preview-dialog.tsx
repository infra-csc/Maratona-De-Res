import type { HistoricalImportResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Calendar, Users, AlertTriangle, History } from "lucide-react";
import { CONDENSED } from "@/lib/premium-theme";
import { DIALOG_STYLE } from "./shared";

type HistoricalPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: HistoricalImportResult | null;
  /** groupKey do evento da planilha → id do evento existente ao qual vincular. */
  linkOverrides: Record<string, number>;
  setLinkOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  isCommitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Pré-visualização (dryRun) da importação de resultados históricos, evento por evento. */
export function HistoricalPreviewDialog({
  open,
  onOpenChange,
  preview: historicalPreview,
  linkOverrides,
  setLinkOverrides,
  isCommitting,
  onCancel,
  onConfirm,
}: HistoricalPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border-border" style={DIALOG_STYLE} data-testid="dialog-historical-preview">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={20} className="text-[var(--amber)]" />
            Pré-visualização da importação
          </DialogTitle>
          <DialogDescription>
            Nada foi gravado no banco ainda. Confira com atenção tudo o que vai acontecer — evento por evento — antes de confirmar. Depois de confirmar, os eventos entram como resultados históricos (nota já fechada, sem avaliação por critério).
          </DialogDescription>
        </DialogHeader>

        {historicalPreview && (() => {
          const eventsToCreate = historicalPreview.events.filter(ev => ev.action === "create").length;
          const eventsToUpdate = historicalPreview.events.filter(ev => ev.action === "update").length;
          const eventsBlocked = historicalPreview.events.filter(ev => ev.action === "conflict").length;
          const participantsToLink = historicalPreview.events.reduce((sum, ev) => sum + ev.matchedCount, 0);
          return (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-secondary rounded-xl border border-border">
                <p className="text-xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-preview-total-rows">{historicalPreview.totalRows}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Linhas na planilha</p>
              </div>
              <div className="text-center p-3 bg-secondary rounded-xl border border-border">
                <p className="text-xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-preview-matched">{historicalPreview.matched}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Colaboradores já cadastrados</p>
              </div>
              <div className="text-center p-3 bg-secondary rounded-xl border border-border">
                <p className="text-xl font-black text-[var(--info)]" style={{ fontFamily: CONDENSED }}>{historicalPreview.employeesToCreate?.length ?? 0}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Colaboradores novos</p>
              </div>
              <div className="text-center p-3 bg-accent/10 rounded-xl border border-accent/40">
                <p className="text-xl font-black text-accent-text" style={{ fontFamily: CONDENSED }}>{eventsToCreate}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Eventos a criar</p>
              </div>
              <div className="text-center p-3 bg-[var(--amber)]/10 rounded-xl border border-[var(--amber)]/30">
                <p className="text-xl font-black text-[var(--amber)]" style={{ fontFamily: CONDENSED }}>{eventsToUpdate}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Eventos a atualizar</p>
              </div>
              <div className="text-center p-3 bg-secondary rounded-xl border border-border">
                <p className="text-xl font-black text-foreground" style={{ fontFamily: CONDENSED }}>{participantsToLink}</p>
                <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Participações a vincular</p>
              </div>
            </div>

            {eventsBlocked > 0 && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                <strong>{eventsBlocked} evento(s) não serão importados</strong> por causa dos erros listados abaixo — corrija a planilha e reenvie.
              </p>
            )}

            {historicalPreview.errors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                <p className="text-xs font-bold text-destructive uppercase mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Erros ({historicalPreview.errors.length}) — bloqueiam a importação
                </p>
                <p className="text-[11px] text-destructive mb-2">Enquanto houver erros abaixo, o botão de confirmar fica desabilitado. Corrija a planilha (ou os cadastros) e envie novamente.</p>
                <ul className="text-xs text-destructive space-y-1 max-h-40 overflow-y-auto">
                  {historicalPreview.errors.map((err, i) => <li key={i}>• {err}</li>)}
                </ul>
              </div>
            )}

            {historicalPreview.employeesToCreate && historicalPreview.employeesToCreate.length > 0 && (
              <div className="bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg p-3">
                <p className="text-xs font-bold text-[var(--info)] uppercase mb-1 flex items-center gap-1.5">
                  <Users size={14} /> {historicalPreview.employeesToCreate.length} colaborador(es) novo(s) serão cadastrados
                </p>
                <p className="text-[11px] text-[var(--info)] mb-2">Esses nomes não bateram com nenhum colaborador já cadastrado. Ao confirmar, eles serão criados automaticamente (cadastro básico, sem área/função definida) e já entram participando do evento correspondente na tabela abaixo. Se algum nome estiver digitado errado, cancele e corrija a planilha antes de confirmar.</p>
                <ul className="text-xs text-[var(--info)] space-y-1 max-h-32 overflow-y-auto">
                  {historicalPreview.employeesToCreate.map((name, i) => <li key={i}>• {name}</li>)}
                </ul>
              </div>
            )}

            {historicalPreview.cycleFallback && historicalPreview.cycleFallback.length > 0 && (
              <div className="bg-[var(--info)]/10 border border-[var(--info)]/30 rounded-lg p-3">
                <p className="text-xs font-bold text-[var(--info)] uppercase mb-1 flex items-center gap-1.5">
                  <Calendar size={14} /> {historicalPreview.cycleFallback.length} evento(s) fora do período do ciclo cadastrado
                </p>
                <p className="text-[11px] text-[var(--info)] mb-2">A data desses eventos não cai dentro do período de nenhum ciclo configurado. Em vez de bloquear, eles serão vinculados ao ciclo atual (indicado na tabela abaixo) para que os resultados entrem normalmente nos relatórios.</p>
                <ul className="text-xs text-[var(--info)] space-y-1 max-h-32 overflow-y-auto">
                  {historicalPreview.cycleFallback.map((msg, i) => <li key={i}>• {msg}</li>)}
                </ul>
              </div>
            )}

            {historicalPreview.events.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Detalhe evento por evento</p>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary text-muted-foreground uppercase text-[11px] font-bold">
                      <tr>
                        <th className="text-left p-2">Evento</th>
                        <th className="text-left p-2">Data</th>
                        <th className="text-left p-2">Nota</th>
                        <th className="text-left p-2">Participantes</th>
                        <th className="text-left p-2">Ciclo</th>
                        <th className="text-left p-2">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicalPreview.events.map((ev, i) => (
                        <tr key={i} className="border-t border-border align-top" data-testid={`row-preview-event-${i}`}>
                          <td className="p-2 font-medium text-foreground">{ev.eventName}</td>
                          <td className="p-2 text-muted-foreground">{ev.date}</td>
                          <td className="p-2 text-muted-foreground">{ev.score ?? "—"}</td>
                          <td className="p-2 text-muted-foreground">
                            {ev.matchedCount}/{ev.participantsCount}
                            {ev.newEmployeeNames && ev.newEmployeeNames.length > 0 && (
                              <div className="text-[11px] text-[var(--info)] mt-0.5">
                                {ev.newEmployeeNames.length} novo(s): {ev.newEmployeeNames.join(", ")}
                              </div>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {ev.cycleName ?? "—"}
                            {ev.cycleFallback && (
                              <div className="text-[11px] text-[var(--info)] mt-0.5">fora do período (ciclo atual)</div>
                            )}
                          </td>
                          <td className="p-2">
                            {ev.action === "create" && !linkOverrides[ev.groupKey] && <Badge className="bg-accent/15 text-accent-text hover:bg-accent/15">Criar</Badge>}
                            {ev.action === "create" && linkOverrides[ev.groupKey] && <Badge className="bg-[var(--amber)]/15 text-[var(--amber)] hover:bg-[var(--amber)]/15">Vincular</Badge>}
                            {ev.action === "update" && <Badge className="bg-[var(--amber)]/15 text-[var(--amber)] hover:bg-[var(--amber)]/15">Atualizar</Badge>}
                            {ev.action === "conflict" && <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">Conflito</Badge>}
                            {ev.action === "create" && ev.overlapCandidates && ev.overlapCandidates.length > 0 && (
                              <div className="mt-1.5 min-w-[220px]" data-testid={`select-link-override-${i}`}>
                                <p className="text-[11px] text-[var(--amber)] bg-[var(--amber)]/10 border border-[var(--amber)]/30 rounded px-1.5 py-1 mb-1 flex items-start gap-1">
                                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                                  Já existe {ev.overlapCandidates.length === 1 ? "1 evento" : `${ev.overlapCandidates.length} eventos`} nessa data — pode ser a mesma corrida com nome diferente.
                                </p>
                                <Select
                                  value={linkOverrides[ev.groupKey] ? String(linkOverrides[ev.groupKey]) : "none"}
                                  onValueChange={(val) => {
                                    setLinkOverrides(prev => {
                                      const next = { ...prev };
                                      if (val === "none") delete next[ev.groupKey];
                                      else next[ev.groupKey] = Number(val);
                                      return next;
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-7 text-[11px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Criar evento novo</SelectItem>
                                    {ev.overlapCandidates.map(c => (
                                      <SelectItem key={c.id} value={String(c.id)}>
                                        Vincular a "{c.name}" ({c.isHistorical ? "histórico" : "manual"})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
                  <span className="block"><Badge className="bg-accent/15 text-accent-text hover:bg-accent/15 mr-1">Criar</Badge>evento novo, ainda não existe no sistema.</span>
                  <span className="block"><Badge className="bg-[var(--amber)]/15 text-[var(--amber)] hover:bg-[var(--amber)]/15 mr-1">Atualizar</Badge>já existe um evento histórico com este nome/data — a nota será substituída pela da planilha.</span>
                  <span className="block"><Badge className="bg-[var(--amber)]/15 text-[var(--amber)] hover:bg-[var(--amber)]/15 mr-1">Vincular</Badge>você escolheu ligar esse evento a um já existente (veja o alerta laranja e o seletor na linha) em vez de criar um novo.</span>
                  <span className="block"><Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10 mr-1">Conflito</Badge>não será importado (veja o motivo nos erros acima).</span>
                </p>
              </div>
            )}
          </div>
          );
        })()}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isCommitting}>
            Cancelar
          </Button>
          <Button
            data-testid="button-confirm-historical-import"
            className="bg-primary hover:opacity-90 text-primary-foreground"
            disabled={!historicalPreview?.success || historicalPreview.errors.length > 0 || isCommitting}
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
