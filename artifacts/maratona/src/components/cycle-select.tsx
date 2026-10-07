// Seletor de ciclo das telas de leitura (Resultados & Ranking, Análises,
// Dashboard e Eventos). Abre SEMPRE no ciclo atual; dá para escolher um ciclo
// anterior (só consulta) ou o "Total geral" (todos os ciclos, só consulta).
// A escolha vive na URL — `?ciclo=ID` ou `?ciclo=todos`; sem parâmetro = atual
// — para o link poder ser compartilhado.
import { useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import * as SelectPrimitive from "@radix-ui/react-select";
import { useListCycleOptions, getListCycleOptionsQueryKey, type Cycle } from "@workspace/api-client-react";
import { CalendarRange, Check, ChevronDown, Layers, Lock } from "lucide-react";
import { formatCyclePeriod } from "@/components/cycle-badge";
import { CONDENSED } from "@/lib/premium-theme";
import { cn } from "@/lib/utils";

export const CYCLE_URL_PARAM = "ciclo";
const ALL_URL_VALUE = "todos";

export type CycleSelection = { kind: "current" } | { kind: "cycle"; id: number } | { kind: "all" };

export interface CycleScopeState {
  selection: CycleSelection;
  /** Parâmetro para a API: undefined = atual (mesma chave de cache de sempre), "12" ou "all". */
  cycleId: string | undefined;
  /** `{ cycleId }` pronto para os hooks gerados; undefined no ciclo atual. */
  params: { cycleId: string } | undefined;
  isCurrent: boolean;
  isAll: boolean;
  /** Ciclo anterior ou Total geral: esconder/desabilitar toda ação de escrita. */
  readOnly: boolean;
  /** O ciclo escolhido (o atual quando nada foi escolhido); null no Total geral. */
  cycle: Cycle | null;
  current: Cycle | null;
  options: Cycle[];
  /** Nome para títulos: nome do ciclo ou "Total geral". */
  label: string;
  select: (value: "atual" | "todos" | number) => void;
  /** Acrescenta `?ciclo=` a um link interno quando a tela não está no ciclo atual. */
  withCycle: (href: string) => string;
}

function parseSelection(raw: string | null): CycleSelection {
  if (!raw) return { kind: "current" };
  if (raw === ALL_URL_VALUE) return { kind: "all" };
  if (/^\d+$/.test(raw) && Number(raw) > 0) return { kind: "cycle", id: Number(raw) };
  return { kind: "current" };
}

/** Lê e troca o ciclo escolhido (na URL). Use um por tela; o CycleSelect usa o mesmo estado. */
export function useCycleScope(): CycleScopeState {
  const search = useSearch();
  const [location, navigate] = useLocation();
  const { data } = useListCycleOptions({ query: { queryKey: getListCycleOptionsQueryKey(), staleTime: 5 * 60_000 } });
  const raw = useMemo(() => new URLSearchParams(search).get(CYCLE_URL_PARAM), [search]);

  return useMemo(() => {
    const options = data ?? [];
    const current = options.find(c => c.isCurrent) ?? null;
    let selection = parseSelection(raw);
    // O id do próprio ciclo atual é o ciclo atual (mesmo cache, sem modo consulta).
    if (selection.kind === "cycle" && current && selection.id === current.id) selection = { kind: "current" };
    // Link com ciclo que não existe mais: volta ao atual.
    if (selection.kind === "cycle" && data && !options.some(c => c.id === (selection as { id: number }).id)) selection = { kind: "current" };

    const cycle = selection.kind === "cycle" ? (options.find(c => c.id === selection.id) ?? null)
      : selection.kind === "current" ? current : null;
    const cycleId = selection.kind === "all" ? "all" : selection.kind === "cycle" ? String(selection.id) : undefined;
    const urlValue = selection.kind === "all" ? ALL_URL_VALUE : selection.kind === "cycle" ? String(selection.id) : null;

    const select = (value: "atual" | "todos" | number) => {
      const p = new URLSearchParams(window.location.search);
      if (value === "atual") p.delete(CYCLE_URL_PARAM);
      else p.set(CYCLE_URL_PARAM, value === "todos" ? ALL_URL_VALUE : String(value));
      const qs = p.toString();
      navigate(`${location}${qs ? `?${qs}` : ""}`);
    };
    const withCycle = (href: string) => {
      if (!urlValue) return href;
      const [path, hash = ""] = href.split("#");
      return `${path}${path.includes("?") ? "&" : "?"}${CYCLE_URL_PARAM}=${urlValue}${hash ? `#${hash}` : ""}`;
    };

    return {
      selection,
      cycleId,
      params: cycleId ? { cycleId } : undefined,
      isCurrent: selection.kind === "current",
      isAll: selection.kind === "all",
      readOnly: selection.kind !== "current",
      cycle,
      current,
      options,
      label: selection.kind === "all" ? "Total geral" : (cycle?.name ?? "Ciclo"),
      select,
      withCycle,
    };
  }, [data, raw, location, navigate]);
}

/** Situação do ciclo para o selo: atual, fechado ou anterior (aberto, mas não é o atual). */
function cycleTag(c: Cycle | null, isAll: boolean): { label: string; bg: string; fg: string } {
  if (isAll) return { label: "Todos os ciclos", bg: "var(--status-info-bg)", fg: "var(--status-info-text)" };
  if (!c) return { label: "", bg: "transparent", fg: "var(--muted-foreground)" };
  if (c.isCurrent) return { label: "Atual", bg: "var(--status-ok-bg)", fg: "var(--status-ok-text)" };
  if (c.status === "closed") return { label: "Fechado", bg: "var(--secondary)", fg: "var(--muted-foreground)" };
  return { label: "Anterior", bg: "var(--status-warn-bg)", fg: "var(--status-warn-text)" };
}

const itemClass = cn(
  "relative flex w-full cursor-default select-none items-start gap-2 rounded-md py-2 pl-2.5 pr-8 text-sm outline-none",
  "data-[highlighted]:bg-[var(--secondary)] data-[state=checked]:font-semibold data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

function OptionItem({ value, title, detail, tag, testId }: { value: string; title: string; detail: string | null; tag: ReturnType<typeof cycleTag>; testId: string }) {
  return (
    <SelectPrimitive.Item value={value} className={itemClass} data-testid={testId}>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2">
          <SelectPrimitive.ItemText>{title}</SelectPrimitive.ItemText>
          {tag.label && (
            <span className="shrink-0 rounded-full px-1.5 py-px text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: tag.bg, color: tag.fg }}>
              {tag.label}
            </span>
          )}
        </span>
        {detail && <span className="text-[11.5px] font-normal" style={{ color: "var(--muted-foreground)" }}>{detail}</span>}
      </span>
      <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator><Check className="h-4 w-4" aria-hidden /></SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

/**
 * O seletor. Recebe o estado de `useCycleScope()` da própria tela (assim a
 * tela e o seletor leem a mesma escolha). Teclado: Enter/Espaço/↓ abre, setas
 * escolhem, Enter confirma, Esc fecha (Radix Select).
 */
export function CycleSelect({ scope, className, id = "cycle-select" }: { scope: CycleScopeState; className?: string; id?: string }) {
  const { options, selection, cycle, isAll } = scope;
  const value = selection.kind === "all" ? "todos" : selection.kind === "cycle" ? String(selection.id) : "atual";
  const current = scope.current;
  const previous = options.filter(c => !c.isCurrent);
  const tag = cycleTag(cycle, isAll);
  const period = isAll
    ? `${options.length} ${options.length === 1 ? "ciclo" : "ciclos"} somados`
    : cycle ? (formatCyclePeriod(cycle.startDate, cycle.endDate) ?? "Período não definido") : "Carregando…";
  // Nome acessível sem repetir "Ciclo" ("Ciclo Ciclo E2E"): o rótulo só entra
  // quando o nome do ciclo não começa com a palavra.
  const accessibleName = [
    isAll || /^ciclo\b/i.test(scope.label) ? scope.label : `Ciclo ${scope.label}`,
    !isAll && tag.label ? tag.label : null,
    period,
  ].filter(Boolean).join(", ");

  return (
    <div className={cn("flex w-full flex-col gap-1 sm:w-auto", className)}>
      <SelectPrimitive.Root
        value={value}
        onValueChange={v => scope.select(v === "atual" || v === "todos" ? v : Number(v))}
        disabled={options.length === 0}
      >
        <SelectPrimitive.Trigger
          id={id}
          aria-label={accessibleName}
          data-testid="cycle-select"
          className={cn(
            "group inline-flex w-full min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left sm:w-auto sm:min-w-[240px] sm:max-w-[360px]",
            "transition-colors hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60",
          )}
          style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          {isAll ? <Layers size={16} className="shrink-0" aria-hidden style={{ color: "var(--accent-text)" }} />
            : <CalendarRange size={16} className="shrink-0" aria-hidden style={{ color: "var(--accent-text)" }} />}
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="flex min-w-0 items-center gap-1.5">
              <span id={`${id}-value`} className="truncate text-xs font-black uppercase tracking-wider" style={{ fontFamily: CONDENSED }} data-testid="cycle-select-value">
                {scope.label}
              </span>
              {tag.label && !isAll && (
                <span className="shrink-0 rounded-full px-1.5 py-px text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", backgroundColor: tag.bg, color: tag.fg }}>
                  {tag.label}
                </span>
              )}
            </span>
            <span className="truncate text-[11px] font-semibold" style={{ color: "var(--muted-foreground)" }}>{period}</span>
          </span>
          <ChevronDown size={16} aria-hidden className="shrink-0 transition-transform group-data-[state=open]:rotate-180" style={{ color: "var(--muted-foreground)" }} />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={6}
            align="end"
            className="z-50 max-h-[min(420px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-[260px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg shadow-lg"
            style={{ backgroundColor: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)" }}
            data-testid="cycle-select-content"
          >
            <SelectPrimitive.Viewport className="p-1">
              {current && (
                <SelectPrimitive.Group>
                  <SelectPrimitive.Label className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
                    Ciclo atual
                  </SelectPrimitive.Label>
                  <OptionItem value="atual" title={current.name} detail={formatCyclePeriod(current.startDate, current.endDate)} tag={cycleTag(current, false)} testId="cycle-option-atual" />
                </SelectPrimitive.Group>
              )}
              {previous.length > 0 && (
                <SelectPrimitive.Group>
                  <SelectPrimitive.Separator className="my-1 h-px" style={{ backgroundColor: "var(--border)" }} />
                  <SelectPrimitive.Label className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
                    Anteriores · só consulta
                  </SelectPrimitive.Label>
                  {previous.map(c => (
                    <OptionItem key={c.id} value={String(c.id)} title={c.name} detail={formatCyclePeriod(c.startDate, c.endDate)} tag={cycleTag(c, false)} testId={`cycle-option-${c.id}`} />
                  ))}
                </SelectPrimitive.Group>
              )}
              <SelectPrimitive.Separator className="my-1 h-px" style={{ backgroundColor: "var(--border)" }} />
              <OptionItem value="todos" title="Total geral" detail="Todos os ciclos somados · só consulta" tag={{ label: "", bg: "transparent", fg: "" }} testId="cycle-option-todos" />
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

/**
 * Aviso discreto de "só consulta" (ciclo anterior ou Total geral), com a
 * linha de ajuda da tela explicando o que o Total geral soma. Nada no ciclo atual.
 */
export function CycleScopeNotice({ scope, allHelp, className, paymentNote = false }: {
  scope: CycleScopeState;
  allHelp?: React.ReactNode;
  className?: string;
  /** Só em Resultados (onde o pagamento acontece): "o pagamento do bônus deste ciclo continua liberado". */
  paymentNote?: boolean;
}) {
  if (scope.isCurrent) return null;
  const closed = scope.cycle?.status === "closed";
  const title = scope.isAll ? "Total geral — só consulta" : closed ? "Ciclo fechado — só consulta" : "Ciclo anterior — só consulta";
  const text = scope.isAll
    ? allHelp
    : <>Você está vendo <strong style={{ color: "var(--foreground)" }}>{scope.cycle?.name ?? "um ciclo anterior"}</strong>. Edições e fechamento ficam no ciclo atual{paymentNote ? "; o pagamento do bônus deste ciclo continua liberado" : ""}.</>;
  return (
    <div
      role="status"
      data-testid="cycle-readonly-notice"
      className={cn("flex flex-col gap-2 rounded-lg px-3.5 py-2.5 text-[12.5px] sm:flex-row sm:items-center sm:gap-3", className)}
      style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
    >
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <Lock size={14} aria-hidden className="mt-[2px] shrink-0" style={{ color: "var(--foreground)" }} />
        <span className="min-w-0">
          <strong className="mr-1.5 font-bold uppercase text-[11.5px]" style={{ fontFamily: CONDENSED, letterSpacing: "0.04em", color: "var(--foreground)" }}>{title}</strong>
          {text && <span>{text}</span>}
        </span>
      </span>
      {scope.current && (
        <button
          type="button"
          onClick={() => scope.select("atual")}
          className="shrink-0 self-start rounded-md px-2.5 py-1 text-[11px] font-bold uppercase transition-colors hover:bg-[var(--card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:self-auto"
          style={{ fontFamily: CONDENSED, border: "1px solid var(--border)", color: "var(--foreground)" }}
          data-testid="button-back-to-current-cycle"
        >
          Voltar ao ciclo atual
        </button>
      )}
    </div>
  );
}
