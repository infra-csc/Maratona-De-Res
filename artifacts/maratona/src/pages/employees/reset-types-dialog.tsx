import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Check } from "lucide-react";
import { CONDENSED, WARNING, GOOD, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import { onKeyToggle, toTitleCase } from "./utils";
import type { EmployeeWithCycle } from "./types";

/**
 * Redefinir Tipos em Massa — seleção dinâmica. Marca quem é "Casa"; os demais ativos viram "Freela".
 * A seleção, a busca e a chamada à API ficam no pai.
 */
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
  return (
    <Dialog open={open} onOpenChange={v => { if (!pending) onOpenChange(v); }}>
      <DialogContent className="max-w-lg rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: CONDENSED }}><RefreshCw size={18} /> Redefinir Tipos — Casa vs Freela</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            Marque os colaboradores que devem aparecer no ranking como <strong>Casa</strong>. Todos os demais serão marcados como <strong>Freela</strong> e não contarão no ranking.
          </p>
          <div className="flex gap-3 text-xs font-bold">
            <span className="px-2 py-1 rounded" style={{ backgroundColor: "rgba(154,176,0,0.14)", color: GOOD_TEXT }}>{casaSelection.size} Casa</span>
            <span className="px-2 py-1 rounded" style={{ backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" }}>
              {(employees?.filter(e => e.active !== false).length ?? 0) - casaSelection.size} Freela
            </span>
          </div>
          <Input
            placeholder="Buscar colaborador..."
            aria-label="Buscar colaborador para definir o tipo"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)" }}
          />
          <div role="group" aria-label="Colaboradores marcados como Casa" className="rounded-lg max-h-64 overflow-y-auto" style={{ border: "1px solid var(--border)" }}>
            {(employees ?? [])
              .filter(e => e.active !== false)
              .filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()))
              .map((emp, i) => {
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
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                    style={{
                      borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                      backgroundColor: isCasa ? "rgba(154,176,0,0.07)" : undefined,
                    }}
                  >
                    <div
                      aria-hidden="true"
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                      style={{ backgroundColor: isCasa ? GOOD : "transparent", borderColor: isCasa ? GOOD : "var(--border)" }}
                    >
                      {isCasa && <Check size={10} color="#fff" />}
                    </div>
                    <span className="text-sm flex-1">{emp.name}</span>
                    <span
                      className="text-[11px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: isCasa ? "rgba(154,176,0,0.14)" : "var(--secondary)", color: isCasa ? GOOD : "var(--muted-foreground)" }}
                    >
                      {isCasa ? "Casa" : "Freela"}
                    </span>
                  </div>
                );
              })}
            {(employees ?? []).filter(e => e.active !== false).filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <div className="px-3 py-4 text-sm text-center" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador encontrado</div>
            )}
          </div>
          {casaSelection.size === 0 && (
            <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.25)", color: DANGER_TEXT }}>
              ⚠ Nenhum selecionado como Casa — todos ficarão como Freela e o ranking ficará vazio.
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onOpenChange(false)}
              className="h-10 px-4 rounded-lg font-bold uppercase text-xs"
              style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending || casaSelection.size === 0}
              onClick={onConfirm}
              className="h-10 px-5 rounded-lg font-black text-xs uppercase flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: casaSelection.size === 0 ? "var(--secondary)" : WARNING, color: casaSelection.size === 0 ? "var(--muted-foreground)" : "#fff" }}
            >
              <RefreshCw size={14} className={pending ? "animate-spin" : ""} />
              {pending ? "Atualizando..." : "Confirmar e Aplicar"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
