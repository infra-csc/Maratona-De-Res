// Resultados históricos (CSV): lê o arquivo, pede a prévia ao servidor
// (dryRun) e abre o diálogo de prévia; só grava ao confirmar, e o resultado
// aparece no mesmo diálogo. Mesmas chamadas de antes.
import { useState } from "react";
import { useImportHistoricalResults, type HistoricalImportResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { serverMessage } from "../criteria/helpers";
import { FileButton, ToolRow, btnSmall } from "./integration-ui";
import { HistoricalPreviewDialog } from "./historical-preview-dialog";

export function HistoricalImportSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [csvData, setCsvData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<HistoricalImportResult | null>(null);
  const [committed, setCommitted] = useState<HistoricalImportResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [linkOverrides, setLinkOverrides] = useState<Record<string, number>>({});

  const previewMutation = useImportHistoricalResults({
    mutation: {
      onSuccess: (data) => { setPreview(data); setCommitted(null); setCommitError(null); setOpen(true); },
      onError: (e: unknown) => toast({ title: "Não foi possível ler o arquivo", description: serverMessage(e), variant: "destructive" }),
    },
  });
  const commitMutation = useImportHistoricalResults({
    mutation: {
      onSuccess: (data) => { setCommitted(data); setCsvData(null); qc.invalidateQueries(); },
      onError: (e: unknown) => setCommitError(serverMessage(e)),
    },
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target?.result as string;
      setCsvData(data);
      setFileName(file.name);
      setLinkOverrides({});
      previewMutation.mutate({ data: { csvData: data, dryRun: true } });
    };
    reader.readAsText(file);
  }

  return (
    <>
      <ToolRow icon={History} title="Resultados históricos (CSV)" testId="tool-import-historical"
        columns={["nome", "nota", "evento", "data"]} traits={[{ label: "Mostra prévia antes", tone: "ok" }]}
        action={<FileButton id="input-historical-csv" accept=".csv,.tsv,.txt" onFile={onFile} inputTestId="input-historical-csv-file" testId="button-import-historical"
          label="Escolher arquivo" busyLabel="Lendo arquivo…" busy={previewMutation.isPending} className={btnSmall} />}>
        Provas antigas com a nota final já pronta (sem avaliação por critério): cria eventos <span className="font-semibold text-foreground">fechados</span> com a nota aplicada ao time.
      </ToolRow>

      <HistoricalPreviewDialog
        open={open}
        onOpenChange={o => { setOpen(o); if (!o) { setPreview(null); setCsvData(null); setCommitted(null); setCommitError(null); } }}
        fileName={fileName}
        preview={preview}
        committed={committed}
        commitError={commitError}
        linkOverrides={linkOverrides}
        setLinkOverrides={setLinkOverrides}
        isCommitting={commitMutation.isPending}
        onConfirm={() => { if (csvData) { setCommitError(null); commitMutation.mutate({ data: { csvData, dryRun: false, linkOverrides } }); } }}
      />
    </>
  );
}
