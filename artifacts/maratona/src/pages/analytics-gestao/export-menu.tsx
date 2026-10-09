// Exportar (topo das Análises): relatório para imprimir/salvar em PDF ou
// planilhas Excel. Mesmas quatro saídas de antes; só o desenho mudou.
import { useState } from "react";
import { useLocation } from "wouter";
import { getAnalyticsEventsReport, type AnalyticsOverview } from "@workspace/api-client-react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { exportAnalyticsXlsx, exportEventsReportXlsx } from "@/lib/analytics-export";
import type { CycleScopeState } from "@/components/cycle-select";
import { cn } from "@/lib/utils";
import { btnPrimary } from "../events/events-ui";

const itemCls = "gap-3 items-start min-h-11 px-2.5 py-2 rounded-md cursor-pointer focus:bg-secondary data-[highlighted]:bg-secondary";

function Item({ icon: Icon, title, hint, onSelect, testId }: { icon: typeof FileText; title: string; hint: string; onSelect: () => void; testId: string }) {
  return (
    <DropdownMenuItem onSelect={onSelect} data-testid={testId} className={itemCls}>
      <Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <span className="flex flex-col min-w-0">
        <span className="text-[14px] font-semibold text-foreground leading-snug">{title}</span>
        <span className="text-[12.5px] text-muted-foreground leading-snug">{hint}</span>
      </span>
    </DropdownMenuItem>
  );
}

export function ExportMenu({ data, scope }: { data: AnalyticsOverview; scope: CycleScopeState }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (job: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await job();
      toast({ title: ok, description: "O arquivo foi salvo na pasta de downloads." });
    } catch (e) {
      toast({ title: "Não foi possível gerar a planilha", description: (e as Error)?.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={busy} aria-busy={busy || undefined} data-testid="button-export-analytics"
          className={cn(btnPrimary, "min-h-11 lg:min-h-9 px-3 lg:px-3.5 text-[13px] gap-1.5")}>
          {busy ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <Download size={15} aria-hidden />}
          <span className="hidden sm:inline">{busy ? "Gerando…" : "Exportar"}</span>
          <span className="sr-only sm:hidden">{busy ? "Gerando…" : "Exportar"}</span>
          <ChevronDown size={14} aria-hidden className="hidden sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-[min(300px,calc(100vw-24px))] p-1.5 rounded-xl">
        <DropdownMenuLabel className="px-2.5 pt-1.5 pb-1 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Para imprimir ou salvar em PDF</DropdownMenuLabel>
        <Item icon={FileText} testId="menu-export-pdf" title="Relatório do ciclo"
          hint={scope.isAll ? "Análise de todos os ciclos + regras" : "Análise do ciclo + regras de negócio"}
          onSelect={() => navigate(scope.withCycle("/analytics/relatorio?imprimir=1"))} />
        <Item icon={FileText} testId="menu-export-events-pdf" title="Relatório por evento"
          hint="Nota final calibrada, critérios e equipe"
          onSelect={() => navigate(scope.withCycle("/analytics/eventos?imprimir=1"))} />
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuLabel className="px-2.5 pt-1 pb-1 font-condensed text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Planilhas Excel</DropdownMenuLabel>
        <Item icon={FileSpreadsheet} testId="menu-export-xlsx" title="Painel de gestão"
          hint="Uma aba por tabela da tela"
          onSelect={() => void run(() => exportAnalyticsXlsx(data), "Planilha exportada")} />
        <Item icon={FileSpreadsheet} testId="menu-export-events-xlsx" title="Por evento"
          hint="Eventos, critérios e equipes"
          onSelect={() => void run(async () => exportEventsReportXlsx(await getAnalyticsEventsReport(scope.params)), "Planilha por evento exportada")} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
