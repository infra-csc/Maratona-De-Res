import { useDedupeEvaluations, useFixCalibrationCriteria, useMigrateCriteriaCatalog, useFixOrphanedEvaluations, type DedupeEvaluationsResult, type FixCalibrationCriteria200, type FixOrphanedEvaluations200 } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Eraser, Wrench } from "lucide-react";
import { useState } from "react";
import { CONDENSED } from "@/lib/premium-theme";
import { DIALOG_STYLE } from "./shared";

// Ferramentas de manutenção (só admin): cada card é autocontido, com a sua
// mutação e o diálogo de resultado/confirmação (renderizado em portal).

/** "Limpar Avaliações Duplicadas": prévia (dryRun) e depois a limpeza confirmada. */
export function DedupeEvaluationsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dedupePreview, setDedupePreview] = useState<DedupeEvaluationsResult | null>(null);
  const [dedupeDialogOpen, setDedupeDialogOpen] = useState(false);

  const dedupePreviewMutation = useDedupeEvaluations({
    mutation: {
      onSuccess: (data) => {
        setDedupePreview(data);
        setDedupeDialogOpen(true);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao verificar duplicatas", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const dedupeCommitMutation = useDedupeEvaluations({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Duplicatas removidas",
          description: `${data.duplicatesRemoved} avaliação(ões) duplicada(s) apagada(s) em ${data.eventsAffected} evento(s). Resultados recalculados.`,
        });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Avisos", description: data.warnings.slice(0, 3).join(", "), variant: "destructive" });
        }
        setDedupeDialogOpen(false);
        setDedupePreview(null);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao remover duplicatas", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden">
        <CardHeader className="bg-secondary border-b border-border pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <Eraser size={18} className="text-foreground" /> Limpar Avaliações Duplicadas
          </CardTitle>
          <CardDescription>
            Remove cópias exatas de avaliações (mesmo evento, quesito, avaliador, nota e comentário), mantendo a primeira gravada. Útil após uma importação repetida.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Avaliações com <strong>conteúdo diferente</strong> nunca são tocadas. Após a limpeza, os resultados dos ciclos afetados são <strong>recalculados automaticamente</strong>.
            Sempre mostra uma <strong>pré-visualização</strong> antes de apagar qualquer coisa.
          </p>
          <Button
            data-testid="button-dedupe-evaluations"
            variant="outline"
            className="w-full bg-card border-dashed border-2 border-border hover:border-foreground/40 hover:bg-secondary transition-colors"
            onClick={() => dedupePreviewMutation.mutate({ data: { dryRun: true } })}
            disabled={dedupePreviewMutation.isPending}
          >
            <Eraser size={16} className="mr-2 text-foreground" />
            {dedupePreviewMutation.isPending ? "Verificando..." : "Verificar duplicatas (pré-visualizar)"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dedupeDialogOpen} onOpenChange={(open) => { setDedupeDialogOpen(open); if (!open) setDedupePreview(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl border-border" style={DIALOG_STYLE} data-testid="dialog-dedupe-confirm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eraser size={20} className="text-foreground" />
              Avaliações duplicadas encontradas
            </DialogTitle>
            <DialogDescription>
              Nada foi apagado ainda. Confira os números antes de confirmar a limpeza.
            </DialogDescription>
          </DialogHeader>

          {dedupePreview && (
            dedupePreview.duplicatesFound === 0 ? (
              <div className="py-4 text-center">
                <CheckCircle2 size={32} className="mx-auto text-accent-text mb-2" />
                <p className="text-sm font-medium text-foreground" data-testid="text-dedupe-none">Nenhuma avaliação duplicada encontrada. Está tudo limpo!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 py-2">
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-dedupe-found">{dedupePreview.duplicatesFound}</p>
                  <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Cópias a apagar</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-dedupe-groups">{dedupePreview.groupsAffected}</p>
                  <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Notas afetadas</p>
                </div>
                <div className="bg-secondary rounded-lg p-3 text-center">
                  <p className="text-2xl font-black text-foreground" style={{ fontFamily: CONDENSED }} data-testid="text-dedupe-events">{dedupePreview.eventsAffected}</p>
                  <p className="text-[11px] uppercase font-bold text-muted-foreground mt-1">Eventos</p>
                </div>
              </div>
            )
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {dedupePreview && dedupePreview.duplicatesFound === 0 ? (
              <Button className="w-full" onClick={() => setDedupeDialogOpen(false)} data-testid="button-close-dedupe">
                Entendi
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setDedupeDialogOpen(false)}
                  disabled={dedupeCommitMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  data-testid="button-confirm-dedupe"
                  disabled={dedupeCommitMutation.isPending}
                  onClick={() => dedupeCommitMutation.mutate({ data: { dryRun: false } })}
                >
                  <Eraser size={16} className="mr-2" />
                  {dedupeCommitMutation.isPending ? "Limpando..." : "Confirmar limpeza"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Corrigir Calibrações": remapeia calibrações gravadas com IDs de quesitos antigos. */
export function FixCalibrationCriteriaCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixCalResult, setFixCalResult] = useState<FixCalibrationCriteria200 | null>(null);
  const [fixCalDialogOpen, setFixCalDialogOpen] = useState(false);
  const fixCalMutation = useFixCalibrationCriteria({
    mutation: {
      onSuccess: (data) => {
        setFixCalResult(data);
        setFixCalDialogOpen(true);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha na correção de calibrações", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden border-l-4 border-l-[var(--amber)]">
        <CardHeader className="bg-[var(--amber)]/10 border-b border-[var(--amber)]/30 pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-[var(--amber)]" style={{ fontFamily: CONDENSED }}>
            <Wrench size={18} /> Corrigir Calibrações (Migração de Quesitos)
          </CardTitle>
          <CardDescription className="text-[var(--amber)]/80">
            Recupera calibrações feitas com os quesitos antigos (nomes longos) e remapeia para os equivalentes atuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Quando o catálogo de quesitos foi migrado (nomes longos → curtos), as calibrações gravadas ficaram referenciando os IDs antigos e deixaram de aparecer na tela.
            Este botão corrige os IDs de todas as calibrações afetadas de uma vez. <strong>Operação segura e idempotente</strong> — pode ser executada mais de uma vez sem problema.
          </p>
          <Button
            data-testid="button-fix-calibration-criteria"
            variant="outline"
            className="w-full bg-card border-dashed border-2 border-[var(--amber)]/50 hover:border-[var(--amber)] hover:bg-[var(--amber)]/10 transition-colors"
            onClick={() => fixCalMutation.mutate()}
            disabled={fixCalMutation.isPending}
          >
            <Wrench size={16} className="mr-2 text-[var(--amber)]" />
            {fixCalMutation.isPending ? "Corrigindo..." : "Corrigir calibrações agora"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={fixCalDialogOpen} onOpenChange={(open) => { setFixCalDialogOpen(open); if (!open) setFixCalResult(null); }}>
        <DialogContent className="sm:max-w-lg rounded-xl border-border" style={DIALOG_STYLE} data-testid="dialog-fix-cal-result">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={20} className="text-[var(--amber)]" />
              Calibrações corrigidas
            </DialogTitle>
            <DialogDescription>
              {(fixCalResult?.totalUpdated ?? 0) === 0
                ? "Nenhuma calibração precisou ser atualizada — já estão com os IDs corretos."
                : `${fixCalResult?.totalUpdated} calibração(ões) atualizadas com sucesso.`}
            </DialogDescription>
          </DialogHeader>
          {fixCalResult && (fixCalResult.results?.length ?? 0) > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary text-muted-foreground uppercase text-[11px] font-bold">
                  <tr>
                    <th className="text-left p-2">De (quesito antigo)</th>
                    <th className="text-left p-2">Para (quesito atual)</th>
                    <th className="text-right p-2">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {fixCalResult.results?.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2 text-muted-foreground">{r.from}</td>
                      <td className="p-2 font-medium text-foreground">{r.to}</td>
                      <td className="p-2 text-right font-bold">{r.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-primary hover:opacity-90 text-primary-foreground" onClick={() => setFixCalDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Migrar Catálogo de Quesitos": aplica a migração do catálogo em todos os eventos. */
export function MigrateCriteriaCatalogCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const migrateCriteriaMutation = useMigrateCriteriaCatalog({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Migração concluída",
          description: `${data.catalogActivated} quesito(s) ativado(s), ${data.catalogDeactivated} desativado(s), ${data.catalogCreated} criado(s). ${data.eventCriteriaFixed} evento(s) atualizados. ${(data as { evaluationsRemapped?: number }).evaluationsRemapped ?? 0} avaliação(ões) remapeadas para o catálogo novo.`,
        });
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha na migração", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  return (
    <Card className="bg-card border border-border shadow-none overflow-hidden border-l-4 border-l-border">
      <CardHeader className="bg-secondary border-b border-border pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-foreground" style={{ fontFamily: CONDENSED }}>
          <Wrench size={18} /> Migrar Catálogo de Quesitos
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Relaciona os 5 quesitos ativos da Matriz de Performance com todos os eventos e remapeia avaliações que ainda referenciam quesitos antigos — incluindo históricos e confirmados.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Aplica a migração do catálogo de critérios sem precisar importar uma planilha.
          Desfaz a vinculação com quesitos antigos e ativa os novos em <strong>todos os eventos</strong>.
          <strong> Operação idempotente</strong> — segura de executar mais de uma vez.
        </p>
        <Button
          data-testid="button-migrate-criteria-catalog"
          variant="outline"
          className="w-full bg-card border-dashed border-2 border-border hover:border-foreground/40 hover:bg-secondary transition-colors"
          onClick={() => migrateCriteriaMutation.mutate()}
          disabled={migrateCriteriaMutation.isPending}
        >
          <Wrench size={16} className="mr-2 text-foreground" />
          {migrateCriteriaMutation.isPending ? "Migrando..." : "Executar migração de quesitos"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** "Corrigir Avaliações Órfãs": reativa quesitos desativados que ainda têm avaliações. */
export function FixOrphanedEvaluationsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fixOrphanedResult, setFixOrphanedResult] = useState<FixOrphanedEvaluations200 | null>(null);
  const [fixOrphanedDialogOpen, setFixOrphanedDialogOpen] = useState(false);
  const fixOrphanedMutation = useFixOrphanedEvaluations({
    mutation: {
      onSuccess: (data) => {
        setFixOrphanedResult(data);
        setFixOrphanedDialogOpen(true);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha na correção", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden border-l-4 border-l-border">
        <CardHeader className="bg-secondary border-b border-border pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2 text-foreground" style={{ fontFamily: CONDENSED }}>
            <Wrench size={18} /> Corrigir Avaliações Órfãs
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Reativa quesitos desativados que ainda têm avaliações submetidas — evitando que notas desapareçam do evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Quando o catálogo de quesitos é migrado <strong>depois</strong> que avaliadores já submeteram respostas, as avaliações ficam vinculadas a quesitos inativos e somem da visualização do evento.
            Este botão detecta e reativa automaticamente esses vínculos. <strong>Operação segura e idempotente.</strong>
          </p>
          <Button
            data-testid="button-fix-orphaned-evaluations"
            variant="outline"
            className="w-full bg-card border-dashed border-2 border-border hover:border-foreground/40 hover:bg-secondary transition-colors"
            onClick={() => fixOrphanedMutation.mutate()}
            disabled={fixOrphanedMutation.isPending}
          >
            <Wrench size={16} className="mr-2 text-foreground" />
            {fixOrphanedMutation.isPending ? "Corrigindo..." : "Reativar quesitos com avaliações"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={fixOrphanedDialogOpen} onOpenChange={(open) => { setFixOrphanedDialogOpen(open); if (!open) setFixOrphanedResult(null); }}>
        <DialogContent className="sm:max-w-md rounded-xl border-border" style={DIALOG_STYLE} data-testid="dialog-fix-orphaned-result">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench size={20} className="text-foreground" />
              Avaliações órfãs corrigidas
            </DialogTitle>
            <DialogDescription>
              {(fixOrphanedResult?.fixed ?? 0) === 0
                ? "Nenhum quesito órfão encontrado — tudo já está correto."
                : `${fixOrphanedResult?.fixed} quesito(s) reativados em ${fixOrphanedResult?.eventsAffected} evento(s).`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixOrphanedDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
