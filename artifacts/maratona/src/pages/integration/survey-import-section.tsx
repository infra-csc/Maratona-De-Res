import { useImportSurvey, useGetEvents, getGetEventsQueryKey, type SurveyImportResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, ClipboardList, KeyRound } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { CONDENSED } from "@/lib/premium-theme";
import { DIALOG_STYLE } from "./shared";
import { extractSurveyRows, type SurveyRow } from "./survey-parser";
import { SurveyPreviewDialog } from "./survey-preview-dialog";

/**
 * Card "Pesquisa de Avaliadores": lê o .xlsx do Forms, pede a prévia ao
 * servidor (dryRun), exige o vínculo de cada evento e, depois de gravar,
 * mostra uma única vez as senhas provisórias dos avaliadores criados.
 */
export function SurveyImportSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const surveyFileRef = useRef<HTMLInputElement>(null);
  const [surveyRows, setSurveyRows] = useState<SurveyRow[] | null>(null);
  const [surveyPreview, setSurveyPreview] = useState<SurveyImportResult | null>(null);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [surveyLinkOverrides, setSurveyLinkOverrides] = useState<Record<string, number>>({});
  const [surveyCommitResult, setSurveyCommitResult] = useState<SurveyImportResult | null>(null);

  const eventsQueryKey = getGetEventsQueryKey();
  const { data: allEventsForLink } = useGetEvents(undefined, { query: { queryKey: eventsQueryKey, enabled: surveyDialogOpen } });
  const eventLinkOptions = useMemo(
    () => [...(allEventsForLink ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [allEventsForLink],
  );

  const surveyPreviewMutation = useImportSurvey({
    mutation: {
      onSuccess: (data) => {
        setSurveyPreview(data);
        setSurveyDialogOpen(true);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao ler arquivo", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const surveyCommitMutation = useImportSurvey({
    mutation: {
      onSuccess: (data) => {
        toast({
          title: "Pesquisa de avaliadores importada",
          description: `${data.usersCreated ?? 0} avaliador(es) criado(s), ${data.evaluationsCreated ?? 0} avaliação(ões) gravada(s), ${data.conformitiesUpserted ?? 0} conformidade(s) atualizada(s), ${data.eventsUpdated ?? 0} evento(s) atualizado(s).`,
        });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Avisos", description: data.warnings.slice(0, 3).join(", "), variant: "destructive" });
        }
        setSurveyDialogOpen(false);
        setSurveyPreview(null);
        setSurveyRows(null);
        setSurveyLinkOverrides({});
        if (data.createdAvaliadores && data.createdAvaliadores.length > 0) {
          setSurveyCommitResult(data);
        }
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao importar", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  async function handleSurveyFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const rows = extractSurveyRows(workbook);
      if (!rows || rows.length === 0) {
        toast({
          title: "Planilha não reconhecida",
          description: 'Não encontrei a aba de respostas do Forms (cabeçalho "Evento que está avaliando..."). Verifique se o arquivo é o export correto.',
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setSurveyRows(rows);
      setSurveyLinkOverrides({});
      surveyPreviewMutation.mutate({ data: { rows, dryRun: true } });
    } catch {
      toast({ title: "Falha ao ler arquivo", description: "Verifique se o arquivo é uma planilha .xlsx válida.", variant: "destructive" });
    }
    e.target.value = "";
  }

  function handleSurveyConfirm() {
    if (!surveyRows) return;
    surveyCommitMutation.mutate({ data: { rows: surveyRows, dryRun: false, linkOverrides: surveyLinkOverrides } });
  }

  const surveyAllResolved = !!surveyPreview && surveyPreview.groups.every((g) => !!surveyLinkOverrides[g.groupKey]);

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden">
        <CardHeader className="bg-secondary border-b border-border pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <ClipboardList size={18} className="text-[var(--info)]" /> Pesquisa de Avaliadores
          </CardTitle>
          <CardDescription>
            Importa a planilha de respostas da pesquisa (uma linha por avaliador/evento) — cria avaliadores, vincula a eventos já cadastrados e grava notas por critério e conformidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Cada evento da planilha precisa ser <strong>vinculado manualmente</strong> a um evento já existente no sistema — esta importação nunca cria eventos novos.
            Também atualiza o catálogo de critérios (ativa "Carga na Saída do Galpão" e desativa 3 critérios antigos). Sempre mostra uma <strong>pré-visualização</strong> antes de gravar qualquer coisa.
          </p>

          <input
            ref={surveyFileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleSurveyFileUpload}
            data-testid="input-survey-xlsx-file"
          />
          <Button
            data-testid="button-import-survey"
            variant="outline"
            className="w-full bg-card border-dashed border-2 border-[var(--info)]/50 hover:border-[var(--info)] hover:bg-[var(--info)]/10 transition-colors"
            onClick={() => surveyFileRef.current?.click()}
            disabled={surveyPreviewMutation.isPending}
          >
            <Upload size={16} className="mr-2 text-[var(--info)]" />
            {surveyPreviewMutation.isPending ? "Lendo planilha..." : "Selecionar planilha (pré-visualizar)"}
          </Button>
        </CardContent>
      </Card>

      <SurveyPreviewDialog
        open={surveyDialogOpen}
        onOpenChange={(open) => { setSurveyDialogOpen(open); if (!open) { setSurveyPreview(null); setSurveyRows(null); setSurveyLinkOverrides({}); } }}
        preview={surveyPreview}
        linkOverrides={surveyLinkOverrides}
        setLinkOverrides={setSurveyLinkOverrides}
        eventLinkOptions={eventLinkOptions}
        allResolved={surveyAllResolved}
        isCommitting={surveyCommitMutation.isPending}
        onCancel={() => setSurveyDialogOpen(false)}
        onConfirm={handleSurveyConfirm}
      />

      <Dialog open={!!surveyCommitResult} onOpenChange={(open) => { if (!open) setSurveyCommitResult(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border-border" style={DIALOG_STYLE}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound size={20} className="text-[var(--info)]" />
              Credenciais dos avaliadores criados
            </DialogTitle>
            <DialogDescription>
              Estas senhas provisórias são exibidas <strong>apenas uma vez</strong>. Copie e distribua para cada avaliador antes de fechar esta janela.
            </DialogDescription>
          </DialogHeader>
          {surveyCommitResult?.createdAvaliadores && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary text-muted-foreground uppercase text-[11px] font-bold">
                  <tr>
                    <th className="text-left p-2">Nome</th>
                    <th className="text-left p-2">E-mail</th>
                    <th className="text-left p-2">Senha provisória</th>
                  </tr>
                </thead>
                <tbody>
                  {surveyCommitResult.createdAvaliadores.map((a, i) => (
                    <tr key={i} className="border-t border-border" data-testid={`row-created-avaliador-${i}`}>
                      <td className="p-2 font-medium text-foreground">{a.name}</td>
                      <td className="p-2 text-muted-foreground font-mono">{a.email}</td>
                      <td className="p-2 text-muted-foreground font-mono">{a.tempPassword}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DialogFooter>
            <Button className="bg-primary hover:opacity-90 text-primary-foreground" onClick={() => setSurveyCommitResult(null)}>
              Já distribuí as senhas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
