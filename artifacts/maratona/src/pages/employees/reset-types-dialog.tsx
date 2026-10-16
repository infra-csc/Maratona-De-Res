// Redefinir tipos em massa: marca quem é "Casa" (conta no ranking); os demais
// ativos viram "Freela". A seleção, a busca e a chamada à API ficam no pai.
import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, Check, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Chip, DialogHeading, Notice, SearchField, btnSecondary, btnPrimary, dialogCls, dialogFooterCls, useReturnFocus } from "./ui";
import { onKeyToggle, toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

export function ResetTypesDialog({
  open,
  onOpenChange,
  pending,
  employees,
  casaSelection,
  onCasaSelectionChange,
  search,
  onSearchChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  employees: EmployeeWithCycle[] | undefined;
  casaSelection: Set<number>;
  onCasaSelectionChange: Dispatch<SetStateAction<Set<number>>>;
  search: string;
  onSearchChange: (v: string) => void;
  onConfirm: () => void;
}) {
  const onCloseAutoFocus = useReturnFocus(open);
  const active = (employees ?? []).filter(e => e.active !== false);
  const term = search.trim().toLowerCase();
  const visible = active.filter(e => !term || e.name.toLowerCase().includes(term));
  const freela = active.length - casaSelection.size;
  return (
    <Dialog open={open} onOpenChange={v => { if (!pending) onOpenChange(v); }}>
      <DialogContent className={cn(dialogCls, "max-w-[540px] max-h-[92dvh] flex flex-col")} data-testid="reset-types-dialog" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeading icon={RefreshCw} Title={DialogTitle} Description={DialogDescription} title="Redefinir tipos — casa ou freela"
          description="Marque quem é casa: entra no ranking e no bônus. Todos os demais ativos viram freela e não pontuam." />
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <Chip tone="ok">{casaSelection.size} casa</Chip>
          <Chip className="bg-transparent border border-border">{freela} freela</Chip>
          <span className="text-[12.5px] text-muted-foreground">de {active.length} ativos</span>
        </div>
        <SearchField value={search} onChange={onSearchChange} label="Buscar colaborador para definir o tipo" placeholder="Buscar colaborador" />
        <div role="group" aria-label="Colaboradores marcados como Casa" className="min-h-[120px] flex-1 overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {visible.map(emp => {
            const isCasa = casaSelection.has(emp.id);
            const toggle = () => onCasaSelectionChange(prev => {
              const next = new Set(prev);
              if (next.has(emp.id)) next.delete(emp.id); else next.add(emp.id);
              return next;
            });
            return (
              <div
                key={emp.id}
                role="checkbox"
                aria-checked={isCasa}
                aria-label={`${toTitleCase(emp.name)} — ${isCasa ? "Casa" : "Freela"}`}
                tabIndex={0}
                onClick={toggle}
                onKeyDown={onKeyToggle(toggle)}
                className={cn("flex items-center gap-3 px-3.5 min-h-11 py-2 cursor-pointer transition-colors duration-150 hover:bg-secondary/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", isCasa && "bg-[var(--status-ok-bg)]/50")}
              >
                <span aria-hidden className={cn("w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors duration-150",
                  isCasa ? "bg-foreground border-foreground text-background" : "border-border bg-card")}>
                  {isCasa && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="text-[14px] flex-1 min-w-0 break-words" title={emp.name}>{toTitleCase(emp.name)}</span>
                <Chip tone={isCasa ? "ok" : "neutral"} className="h-5 px-1.5 text-[11px]">{isCasa ? "Casa" : "Freela"}</Chip>
              </div>
            );
          })}
          {visible.length === 0 && <p className="px-4 py-6 text-[14px] text-center text-muted-foreground">Ninguém com “{search.trim()}”.</p>}
        </div>
        {casaSelection.size === 0 && (
          <Notice icon={AlertTriangle} tone="danger">Ninguém marcado como casa — todos ficariam como freela e o ranking ficaria vazio. Marque ao menos um.</Notice>
        )}
        <div className={dialogFooterCls}>
          <button type="button" disabled={pending} onClick={() => onOpenChange(false)} className={btnSecondary}>Cancelar</button>
          <button type="button" disabled={pending || casaSelection.size === 0} aria-busy={pending || undefined} onClick={onConfirm} className={btnPrimary} data-testid="button-confirm-reset-types">
            {pending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <RefreshCw size={15} aria-hidden />}
            {pending ? "Aplicando…" : "Aplicar e recalcular"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
