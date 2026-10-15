// Importar colaboradores por CSV: escolher o arquivo → confirmar (quantas
// linhas, de que arquivo) → resultado no mesmo diálogo (inseridos e linhas
// com problema). Mesma chamada de antes.
import { useState } from "react";
import { useImportEmployeesCSV, getGetEmployeesQueryKey, type ImportResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { plural } from "@/lib/utils";
import { serverMessage } from "../criteria/helpers";
import { ActionDialog, ConsequenceList, DoneBox, ErrorBox, FileButton, MessageList, NumberStrip, ToolRow, btnPrimary, btnSecondary, btnSmall, dialogFooterCls } from "./integration-ui";

const dataLines = (csv: string) => csv.split(/\r?\n/).filter(l => l.trim()).length;

export function EmployeesImportCard() {
  const qc = useQueryClient();
  const [file, setFile] = useState<{ name: string; csv: string; lines: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importMutation = useImportEmployeesCSV({
    mutation: {
      onSuccess: (data) => { qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() }); setResult(data); },
      onError: (e: unknown) => setError(serverMessage(e) || "Nenhuma linha foi gravada."),
    },
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const csv = String(ev.target?.result ?? "");
      setResult(null); setError(null);
      setFile({ name: f.name, csv, lines: Math.max(0, dataLines(csv) - 1) });
    };
    reader.readAsText(f);
  }
  const close = () => { if (!importMutation.isPending) { setFile(null); setResult(null); setError(null); } };

  return (
    <>
      <ToolRow icon={FileSpreadsheet} title="Colaboradores (CSV)" testId="tool-import-employees"
        columns={["nome", "departamento", "funcao"]} traits={[{ label: "Grava ao confirmar", tone: "warn" }]}
        action={<FileButton id="input-employees-csv" accept=".csv" onFile={onFile} inputTestId="input-csv-file" testId="button-import-employees"
          label="Escolher CSV" busyLabel="Importando…" busy={importMutation.isPending} className={btnSmall} />}>
        Cadastra em lote a base de colaboradores a partir de uma planilha CSV com cabeçalho.
      </ToolRow>

      <ActionDialog open={!!file} onOpenChange={o => { if (!o) close(); }} busy={importMutation.isPending}
        icon={result ? FileSpreadsheet : Upload} tone={result ? "brand" : "neutral"} testId="dialog-import-employees"
        title={result ? "Importação concluída" : "Importar colaboradores?"}
        description={file ? <><span className="font-semibold text-foreground break-all">{file.name}</span> · {plural(file.lines, "linha de dados", "linhas de dados")}</> : undefined}>
        {!result && (
          <ConsequenceList items={[
            <>Cada linha vira um colaborador (colunas <span className="font-semibold text-foreground">nome, departamento, funcao</span>).</>,
            <>Linhas com problema são puladas e listadas no fim; as boas são gravadas.</>,
          ]} />
        )}
        <ErrorBox message={error} title="Falha na importação" />
        {result && (
          <>
            <NumberStrip items={[{ label: "Importados", value: result.inserted, tone: "ok" }, { label: "Com problema", value: result.errors.length, tone: result.errors.length ? "warn" : undefined }]} />
            {result.errors.length === 0
              ? <DoneBox>Todas as linhas foram gravadas.</DoneBox>
              : <MessageList tone="warn" title="Linhas com problema" items={result.errors} />}
          </>
        )}
        <div className={dialogFooterCls}>
          {result ? (
            <button type="button" onClick={close} className={btnPrimary}>Fechar</button>
          ) : (
            <>
              <button type="button" onClick={close} disabled={importMutation.isPending} className={btnSecondary}>Cancelar</button>
              <button type="button" data-testid="button-confirm-import-employees" disabled={importMutation.isPending || !file} aria-busy={importMutation.isPending || undefined}
                onClick={() => { if (file) { setError(null); importMutation.mutate({ data: { csvData: file.csv } }); } }} className={btnPrimary}>
                {importMutation.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Upload size={15} aria-hidden />}
                {importMutation.isPending ? "Importando…" : "Importar"}
              </button>
            </>
          )}
        </div>
      </ActionDialog>
    </>
  );
}
