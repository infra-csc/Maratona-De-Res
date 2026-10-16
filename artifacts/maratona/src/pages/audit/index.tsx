// Tela "Auditoria": quem fez o quê, e quando. Filtros na URL, ações em
// grupos por dia (cabeçalho do dia fica preso ao rolar), cada linha abre o
// "O que mudou". Peças: ./audit-filters (filtros), ./audit-entry (linha).
import { useEffect, useMemo, useState } from "react";
import { useGetAuditLogs, useGetUsers, getGetAuditLogsQueryKey, type AuditLog } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, FolderLock, Lock, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bone, Chip, EmptyBlock, ErrorBlock, btnSecondary, surfaceCls } from "../criteria/criteria-ui";
import { ACTIONS, CATEGORIES } from "./labels";
import { AuditEntry } from "./audit-entry";
import { AuditFilters, EMPTY_FILTERS, type Filters } from "./audit-filters";
import { dayHeading, dayKey } from "./dates";

const PAGE_SIZE = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Filtros na URL (?cat=&action=&user=&from=&to=&page=) ───────────────────
// Recarregar ou mandar o link para alguém abre a mesma consulta.
function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const cat = p.get("cat") ?? "";
  const action = p.get("action") ?? "";
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  const user = p.get("user") ?? "";
  return {
    cat: CATEGORIES.some(c => c.key === cat) ? (cat as Filters["cat"]) : "",
    action: action in ACTIONS ? action : "",
    user: /^\d+$/.test(user) ? user : "",
    from: DATE_RE.test(from) ? from : "",
    to: DATE_RE.test(to) ? to : "",
    page: Math.max(1, parseInt(p.get("page") ?? "1") || 1),
  };
}

function writeFilters(f: Filters) {
  const url = new URL(window.location.href);
  const set = (k: string, v: string) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
  set("cat", f.cat); set("action", f.action); set("user", f.user); set("from", f.from); set("to", f.to);
  set("page", f.page > 1 ? String(f.page) : "");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const LEGEND = [
  { tone: "bg-[var(--status-ok)]", label: "conclui (confirmar, publicar, enviar)" },
  { tone: "bg-[var(--status-warn)]", label: "mexe em nota, resultado ou acesso" },
  { tone: "bg-[var(--status-danger)]", label: "apaga ou desfaz" },
  { tone: "bg-[var(--status-info)]", label: "entrada no sistema" },
  { tone: "bg-border", label: "cadastro comum" },
];

function AuditSkeleton() {
  return (
    <div role="status" aria-label="Carregando auditoria" className={cn(surfaceCls, "overflow-hidden")}>
      <div className="px-5 py-2.5 bg-secondary/50 border-b border-border"><Bone className="h-3 w-40" /></div>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4 border-t border-border first:border-t-0">
          <Bone className="h-4 w-10" />
          <div className="flex-1 space-y-2"><Bone className="h-4 w-[420px] max-w-full" /><Bone className="h-4 w-28" /></div>
        </div>
      ))}
    </div>
  );
}

export default function AuditPage() {
  const [f, setF] = useState<Filters>(readFilters);
  useEffect(() => writeFilters(f), [f]);
  const update = (patch: Partial<Filters>) => setF(prev => ({ ...prev, page: 1, ...patch }));
  const clear = () => setF(EMPTY_FILTERS);
  const hasFilters = !!(f.cat || f.action || f.user || f.from || f.to);

  const params = {
    page: f.page,
    limit: PAGE_SIZE,
    entity: f.cat ? CATEGORIES.find(c => c.key === f.cat)!.entities.join(",") : undefined,
    action: f.action || undefined,
    userId: f.user ? Number(f.user) : undefined,
    from: f.from || undefined,
    to: f.to || undefined,
  };
  const { data, isLoading, isError, isFetching, refetch } = useGetAuditLogs(params, { query: { queryKey: getGetAuditLogsQueryKey(params) } });
  const { data: users } = useGetUsers({ query: { queryKey: ["users"] as unknown[] } });

  // Quem pode aparecer como autor: equipe interna (colaboradores só entram,
  // e o filtro de "O quê → Pessoas e acessos" já cobre isso).
  const people = useMemo(
    () => (users ?? []).filter(u => u.role !== "visualizador").sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [users],
  );

  const groups = useMemo(() => {
    const out: Array<{ key: string; logs: AuditLog[] }> = [];
    for (const log of data?.data ?? []) {
      const key = dayKey(log.createdAt);
      const last = out[out.length - 1];
      if (last && last.key === key) last.logs.push(log); else out.push({ key, logs: [log] });
    }
    return out;
  }, [data]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstShown = total === 0 ? 0 : (f.page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(f.page * PAGE_SIZE, total);
  const goPage = (page: number) => { setF(p => ({ ...p, page })); window.scrollTo({ top: 0, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };

  return (
    <div className="min-h-full flex flex-col min-w-0 font-body">
      <div className="md:sticky md:top-0 z-30 bg-card border-b border-border px-4 md:px-6 py-3 lg:py-0 lg:h-16 flex items-center gap-3 lg:gap-5">
        <h1 data-testid="text-page-title" className="min-w-0 font-condensed text-[24px] sm:text-[26px] uppercase tracking-[-0.01em] font-black leading-none text-foreground truncate">Auditoria</h1>
        <p className="hidden xl:block min-w-0 truncate text-[13px] text-muted-foreground">Quem fez o quê, e quando. Abra uma linha para ver o que mudou, campo a campo.</p>
        <Chip icon={Lock} className="ml-auto shrink-0" title="Cada ação é gravada pelo próprio sistema e não pode ser editada nem apagada">Somente leitura</Chip>
      </div>

      <div className="flex-1 px-4 md:px-6 py-5 space-y-5 max-w-[1100px] w-full mx-auto">
        <AuditFilters f={f} update={update} clear={clear} people={people} total={total} loaded={!!data} />

        <ul aria-label="Legenda das cores" className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted-foreground">
          {LEGEND.map(l => (
            <li key={l.label} className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("w-[3px] h-3.5 rounded-full", l.tone)} />{l.label}</li>
          ))}
        </ul>

        {isLoading ? <AuditSkeleton /> : isError ? (
          <ErrorBlock title="Não foi possível carregar a auditoria" onRetry={() => { void refetch(); }} />
        ) : groups.length === 0 ? (
          <div className={surfaceCls}>
            <EmptyBlock icon={hasFilters ? SearchX : FolderLock} title="Nenhuma ação encontrada" testId="audit-empty"
              action={hasFilters ? <button type="button" onClick={clear} className={btnSecondary}>Limpar filtros</button> : undefined}>
              {hasFilters ? "Nada combina com estes filtros. Amplie o período ou limpe os filtros." : "Ainda não há ações registradas."}
            </EmptyBlock>
          </div>
        ) : (
          <div className={cn("space-y-4 transition-opacity duration-150", isFetching && "opacity-70")}>
            {groups.map(g => (
              <section key={g.key} aria-labelledby={`audit-day-${g.key}`} className={cn(surfaceCls, "overflow-clip")}>
                <h2 id={`audit-day-${g.key}`}
                  className="md:sticky md:top-16 z-10 px-4 sm:px-5 py-2.5 flex items-center justify-between gap-3 bg-secondary/80 backdrop-blur-sm border-b border-border font-condensed text-[13px] font-bold uppercase tracking-[0.08em] text-foreground">
                  <span>{dayHeading(g.key)}</span>
                  <span className="text-muted-foreground tabular-nums">{g.logs.length} {g.logs.length === 1 ? "ação" : "ações"}</span>
                </h2>
                <ul>
                  {g.logs.map(log => <AuditEntry key={log.id} log={log} refs={data?.refs} />)}
                </ul>
              </section>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
            <button type="button" data-testid="button-prev-page" aria-label="Mais recentes" disabled={f.page === 1} onClick={() => goPage(f.page - 1)} className={btnSecondary}>
              <ChevronLeft size={16} aria-hidden /> <span className="hidden sm:inline">Mais recentes</span>
            </button>
            <span className="text-[13px] text-center text-muted-foreground tabular-nums">
              {firstShown}–{lastShown} de {total.toLocaleString("pt-BR")}<span className="hidden sm:inline"> · página {f.page} de {totalPages}</span>
            </span>
            <button type="button" data-testid="button-next-page" aria-label="Mais antigas" disabled={f.page >= totalPages} onClick={() => goPage(f.page + 1)} className={btnSecondary}>
              <span className="hidden sm:inline">Mais antigas</span> <ChevronRight size={16} aria-hidden />
            </button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
