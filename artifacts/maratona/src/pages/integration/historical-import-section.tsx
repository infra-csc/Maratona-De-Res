import { useImportHistoricalResults, type HistoricalImportResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, History } from "lucide-react";
import { useRef, useState } from "react";
import { CONDENSED } from "@/lib/premium-theme";
import { HistoricalPreviewDialog } from "./historical-preview-dialog";

/**
 * Card "Resultados Históricos": lê o CSV, pede a prévia ao servidor (dryRun)
 * e abre o diálogo de pré-visualização; só grava ao confirmar.
 */
export function HistoricalImportSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const historicalFileRef = useRef<HTMLInputElement>(null);
  const [historicalCsvData, setHistoricalCsvData] = useState<string | null>(null);
  const [historicalPreview, setHistoricalPreview] = useState<HistoricalImportResult | null>(null);
  const [historicalDialogOpen, setHistoricalDialogOpen] = useState(false);
  const [linkOverrides, setLinkOverrides] = useState<Record<string, number>>({});

  const historicalPreviewMutation = useImportHistoricalResults({
    mutation: {
      onSuccess: (data) => {
        setHistoricalPreview(data);
        setHistoricalDialogOpen(true);
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao ler arquivo", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  const historicalCommitMutation = useImportHistoricalResults({
    mutation: {
      onSuccess: (data) => {
        const employeesCreatedMsg = data.employeesCreated ? `, ${data.employeesCreated} colaborador(es) novo(s) cadastrado(s)` : "";
        toast({
          title: "Resultados históricos importados",
          description: `${data.eventsCreated ?? 0} evento(s) criado(s), ${data.eventsUpdated ?? 0} atualizado(s), ${data.participantsLinked ?? 0} participação(ões) vinculada(s)${employeesCreatedMsg}.`,
        });
        if (data.warnings && data.warnings.length > 0) {
          toast({ title: "Avisos", description: data.warnings.slice(0, 3).join(", "), variant: "destructive" });
        }
        setHistoricalDialogOpen(false);
        setHistoricalPreview(null);
        setHistoricalCsvData(null);
        qc.invalidateQueries();
      },
      onError: (e: { message?: string }) => {
        toast({ title: "Falha ao importar", description: e.message ?? "Tente novamente.", variant: "destructive" });
      },
    },
  });

  function handleHistoricalFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvData = ev.target?.result as string;
      setHistoricalCsvData(csvData);
      setLinkOverrides({});
      historicalPreviewMutation.mutate({ data: { csvData, dryRun: true } });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleHistoricalConfirm() {
    if (!historicalCsvData) return;
    historicalCommitMutation.mutate({ data: { csvData: historicalCsvData, dryRun: false, linkOverrides } });
  }

  return (
    <>
      <Card className="bg-card border border-border shadow-none overflow-hidden">
        <CardHeader className="bg-secondary border-b border-border pb-4">
          <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
            <History size={18} className="text-[var(--amber)]" /> Resultados Históricos
          </CardTitle>
          <CardDescription>
            Importa provas antigas cuja nota final já veio pronta/calibrada de fora (sem avaliação por critério).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Cria eventos já <strong>fechados</strong> com a nota informada aplicada diretamente ao time.
            Sempre mostra uma <strong>pré-visualização</strong> antes de gravar qualquer coisa.
          </p>

          <div className="bg-secondary border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground mb-6">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-2 font-sans tracking-widest">Colunas (Header opcional)</p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-card px-2 py-1 rounded border border-border">nome</span>
              <span className="bg-card px-2 py-1 rounded border border-border">nota</span>
              <span className="bg-card px-2 py-1 rounded border border-border">evento</span>
              <span className="bg-card px-2 py-1 rounded border border-border">data</span>
            </div>
          </div>

          <input
            ref={historicalFileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={handleHistoricalFileUpload}
            data-testid="input-historical-csv-file"
          />
          <Button
            data-testid="button-import-historical"
            variant="outline"
            className="w-full bg-card border-dashed border-2 border-[var(--amber)]/50 hover:border-[var(--amber)] hover:bg-[var(--amber)]/10 transition-colors"
            onClick={() => historicalFileRef.current?.click()}
            disabled={historicalPreviewMutation.isPending}
          >
            <Upload size={16} className="mr-2 text-[var(--amber)]" />
            {historicalPreviewMutation.isPending ? "Lendo arquivo..." : "Selecionar arquivo (pré-visualizar)"}
          </Button>
        </CardContent>
      </Card>

      <HistoricalPreviewDialog
        open={historicalDialogOpen}
        onOpenChange={(open) => { setHistoricalDialogOpen(open); if (!open) { setHistoricalPreview(null); setHistoricalCsvData(null); } }}
        preview={historicalPreview}
        linkOverrides={linkOverrides}
        setLinkOverrides={setLinkOverrides}
        isCommitting={historicalCommitMutation.isPending}
        onCancel={() => setHistoricalDialogOpen(false)}
        onConfirm={handleHistoricalConfirm}
      />
    </>
  );
}
