import { useImportEmployeesCSV, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useRef } from "react";
import { CONDENSED } from "@/lib/premium-theme";

/** Card "Importação Manual": carga em lote de colaboradores via CSV. */
export function EmployeesImportCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const importMutation = useImportEmployeesCSV({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetEmployeesQueryKey() });
        toast({ title: `${data.inserted} colaborador(es) importado(s)` });
        if (data.errors.length > 0) {
          toast({
            title: `${data.errors.length} linha(s) com problema`,
            description: data.errors.slice(0, 5).join(" · ") + (data.errors.length > 5 ? ` · e mais ${data.errors.length - 5}` : ""),
            variant: "destructive",
          });
        }
      },
      onError: (e: { message?: string }) => toast({ title: "Falha na importação", description: e.message ?? "Nenhuma linha foi gravada.", variant: "destructive" }),
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const csvData = ev.target?.result as string;
      importMutation.mutate({ data: { csvData } });
    };
    reader.readAsText(file);
  }

  return (
    <Card className="bg-card border border-border shadow-none overflow-hidden">
      <CardHeader className="bg-secondary border-b border-border pb-4">
        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}>
          <FileSpreadsheet size={18} className="text-accent-text" /> Importação Manual
        </CardTitle>
        <CardDescription>Carga em lote via arquivo CSV.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex-1">
          <h4 className="font-bold text-foreground mb-2">Colaboradores</h4>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Faça upload de uma planilha contendo a base de funcionários para popular o sistema rapidamente.
          </p>

          <div className="bg-secondary border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground mb-6">
            <p className="text-[11px] uppercase font-bold text-muted-foreground mb-2 font-sans tracking-widest">Colunas Obrigatórias (Header)</p>
            <div className="flex flex-wrap gap-2">
              <span className="bg-card px-2 py-1 rounded border border-border">nome</span>
              <span className="bg-card px-2 py-1 rounded border border-border">departamento</span>
              <span className="bg-card px-2 py-1 rounded border border-border">funcao</span>
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
            data-testid="input-csv-file"
          />
          <Button
            data-testid="button-import-employees"
            variant="outline"
            className="w-full bg-card border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload size={16} className="mr-2 text-primary" />
            {importMutation.isPending ? "Processando arquivo..." : "Selecionar arquivo CSV"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
