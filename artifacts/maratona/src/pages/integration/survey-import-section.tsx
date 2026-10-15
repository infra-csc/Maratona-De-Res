// Pesquisa de avaliadores (.xlsx do Forms): lê a planilha, pede a prévia ao
// servidor (dryRun), exige o vínculo de cada evento e, depois de gravar,
// mostra o resultado e — uma única vez, como antes — as senhas provisórias
// dos avaliadores criados. Mesmas chamadas de antes.
import { useMemo, useState } from "react";
import { useImportSurvey, useGetEvents, getGetEventsQueryKey, type SurveyImportResult } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { ClipboardList, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { serverMessage } from "../criteria/helpers";
import { ActionDialog, Notice, FileButton, ToolRow, btnPrimary, btnSmall, dialogFooterCls } from "./integration-ui";
import { extractSurveyRows, type SurveyRow } from "./survey-parser";
import { SurveyPreviewDialog } from "./survey-preview-dialog";

export function SurveyImportSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState<SurveyRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<SurveyImportResult | null>(null);
  const [committed, setCommitted] = useState<SurveyImportResult | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [linkOverrides, setLinkOverrides] = useState<Record<string, number>>({});
  const [credentials, setCredentials] = useState<SurveyImportResult | null>(null);

  const eventsQueryKey = getGetEventsQueryKey();
  const { data: allEvents } = useGetEvents(undefined, { query: { queryKey: eventsQueryKey, enabled: open } });
  const eventLinkOptions = useMemo(() => [...(allEvents ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [allEvents]);

  const previewMutation = useImportSurvey({
    mutation: {
      onSuccess: (data) => { setPreview(data); setCommitted(null); setCommitError(null); setOpen(true); },
      onError: (e: unknown) => toast({ title: "Não foi possível ler a planilha", description: serverMessage(e), variant: "destructive" }),
    },
  });
  const commitMutation = useImportSurvey({
    mutation: {
      onSuccess: (data) => {
        setCommitted(data);
        setRows(null);
        if (data.createdAvaliadores && data.createdAvaliadores.length > 0) setCredentials(data);
        qc.invalidateQueries();
      },
      onError: (e: unknown) => setCommitError(serverMessage(e)),
    },
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = extractSurveyRows(workbook);
      if (!parsed || parsed.length === 0) {
        toast({ title: "Planilha não reconhecida", description: "Não achei a aba de respostas do Forms (cabeçalho “Evento que está avaliando…”). Confira se é o arquivo exportado certo.", variant: "destructive" });
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setLinkOverrides({});
      previewMutation.mutate({ data: { rows: parsed, dryRun: true } });
    } catch {
      toast({ title: "Não foi possível ler a planilha", description: "Confira se o arquivo é um .xlsx válido.", variant: "destructive" });
    }
  }

  const allResolved = !!preview && preview.groups.every(g => !!linkOverrides[g.groupKey]);
  const closePreview = (o: boolean) => {
    setOpen(o);
    if (!o) { setPreview(null); setRows(null); setLinkOverrides({}); setCommitted(null); setCommitError(null); }
  };

  return (
    <>
      <ToolRow icon={ClipboardList} title="Pesquisa de avaliadores (Forms, .xlsx)" testId="tool-import-survey"
        traits={[{ label: "Vincula a eventos existentes" }, { label: "Mostra prévia antes", tone: "ok" }, { label: "Cria avaliadores", tone: "warn" }]}
        action={<FileButton id="input-survey-xlsx" accept=".xlsx,.xls" onFile={onFile} inputTestId="input-survey-xlsx-file" testId="button-import-survey"
          label="Escolher planilha" busyLabel="Lendo planilha…" busy={previewMutation.isPending} className={btnSmall} />}>
        Uma linha por avaliador e evento: cria os avaliadores que faltam, liga cada evento da planilha a um evento <span className="font-semibold text-foreground">já cadastrado</span> (nunca cria evento) e grava as notas e a conformidade. Também ajusta o catálogo de critérios.
      </ToolRow>

      <SurveyPreviewDialog
        open={open}
        onOpenChange={closePreview}
        fileName={fileName}
        preview={preview}
        committed={committed}
        commitError={commitError}
        linkOverrides={linkOverrides}
        setLinkOverrides={setLinkOverrides}
        eventLinkOptions={eventLinkOptions}
        allResolved={allResolved}
        isCommitting={commitMutation.isPending}
        onConfirm={() => { if (rows) { setCommitError(null); commitMutation.mutate({ data: { rows, dryRun: false, linkOverrides } }); } }}
      />

      <ActionDialog open={!!credentials && !open} onOpenChange={o => { if (!o) setCredentials(null); }} icon={KeyRound} wide="lg" testId="dialog-survey-credentials"
        title="Senhas dos avaliadores criados"
        description="Estas senhas provisórias aparecem só agora. Copie e entregue a cada avaliador antes de fechar.">
        <Notice icon={KeyRound} tone="warn">Depois de fechar esta janela, não dá para ver as senhas de novo — só redefinir em Usuários.</Notice>
        {credentials?.createdAvaliadores && (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[13px]" aria-label="Avaliadores criados">
              <thead>
                <tr className="bg-secondary/50">
                  {["Nome", "E-mail", "Senha provisória"].map(h => <th key={h} className="font-condensed px-3 py-2 text-left text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {credentials.createdAvaliadores.map((a, i) => (
                  <tr key={i} className="border-t border-border" data-testid={`row-created-avaliador-${i}`}>
                    <td className="px-3 py-2 font-semibold text-foreground">{a.name}</td>
                    <td className="px-3 py-2 font-mono text-[12.5px] text-muted-foreground break-all">{a.email}</td>
                    <td className="px-3 py-2 font-mono text-[12.5px] text-foreground select-all">{a.tempPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={dialogFooterCls}>
          <button type="button" onClick={() => setCredentials(null)} className={btnPrimary}>Já entreguei as senhas</button>
        </div>
      </ActionDialog>
    </>
  );
}
