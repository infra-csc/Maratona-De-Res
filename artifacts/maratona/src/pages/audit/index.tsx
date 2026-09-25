import { useEffect, useMemo, useState } from "react";
import { useGetAuditLogs, useGetUsers, getGetAuditLogsQueryKey, type AuditLog } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, SearchX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, EmptyState, LoadingState } from "@/components/shared";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { ACTIONS, CATEGORIES, type CategoryKey } from "./labels";
import { AuditEntry } from "./audit-entry";
import { dayHeading, dayKey } from "./dates";

const PAGE_SIZE = 50;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── Filtros na URL (?cat=&action=&user=&from=&to=&page=) ───────────────────
// Recarregar ou mandar o link para alguém abre a mesma consulta.
interface Filters { cat: CategoryKey | ""; action: string; user: string; from: string; to: string; page: number }

function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const cat = p.get("cat") ?? "";
  const action = p.get("action") ?? "";
  const from = p.get("from") ?? "";
  const to = p.get("to") ?? "";
  const user = p.get("user") ?? "";
  return {
    cat: CATEGORIES.some(c => c.key === cat) ? (cat as CategoryKey) : "",
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

// Ações em ordem alfabética do rótulo, para o seletor.
const ACTION_OPTIONS = Object.entries(ACTIONS)
  .map(([code, d]) => ({ code, label: d.label.charAt(0).toUpperCase() + d.label.slice(1) }))
  .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

export default function AuditPage() {
  const [f, setF] = useState<Filters>(readFilters);
  useEffect(() => writeFilters(f), [f]);
  const update = (patch: Partial<Filters>) => setF(prev => ({ ...prev, page: 1, ...patch }));
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
  const { data, isLoading, isError, refetch } = useGetAuditLogs(params, { query: { queryKey: getGetAuditLogsQueryKey(params) } });
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

  const label = (text: string, htmlFor: string) => (
    <label htmlFor={htmlFor} className="block mb-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{text}</label>
  );

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-5xl mx-auto" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow="Segurança"
        title="Auditoria"
        description="Quem fez o quê, e quando. Cada linha é uma ação registrada automaticamente pelo sistema e não pode ser editada nem apagada. Clique numa linha para ver o que mudou, campo a campo."
      />

      <section aria-label="Filtros" className="rounded-xl border p-4" style={{ backgroundColor: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_1.2fr_0.9fr_0.9fr]">
          <div>
            {label("O quê", "audit-cat")}
            <Select value={f.cat || "all"} onValueChange={v => update({ cat: v === "all" ? "" : (v as CategoryKey) })}>
              <SelectTrigger id="audit-cat" data-testid="select-audit-entity" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tudo</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            {label("Ação", "audit-action")}
            <Select value={f.action || "all"} onValueChange={v => update({ action: v === "all" ? "" : v })}>
              <SelectTrigger id="audit-action" data-testid="select-audit-action" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                {ACTION_OPTIONS.map(a => <SelectItem key={a.code} value={a.code}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            {label("Quem", "audit-user")}
            <Select value={f.user || "all"} onValueChange={v => update({ user: v === "all" ? "" : v })}>
              <SelectTrigger id="audit-user" data-testid="select-audit-user" className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as pessoas</SelectItem>
                {people.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            {label("De", "audit-from")}
            <Input id="audit-from" type="date" value={f.from} max={f.to || undefined} onChange={e => update({ from: e.target.value })} className="h-10" />
          </div>
          <div>
            {label("Até", "audit-to")}
            <Input id="audit-to" type="date" value={f.to} min={f.from || undefined} onChange={e => update({ to: e.target.value })} className="h-10" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }} aria-live="polite">
            {data ? <><strong style={{ color: "var(--foreground)" }}>{total.toLocaleString("pt-BR")}</strong> {total === 1 ? "ação registrada" : "ações registradas"}{hasFilters ? " com estes filtros" : ""}</> : " "}
          </p>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => setF({ cat: "", action: "", user: "", from: "", to: "", page: 1 })}>
              <X size={14} className="mr-1" aria-hidden="true" /> Limpar filtros
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          Cor do rótulo: <b>verde</b> conclui (confirmar, publicar, enviar) · <b>amarelo</b> mexe em nota, resultado ou acesso sensível · <b>vermelho</b> apaga ou desfaz · <b>azul</b> entrada no sistema · cinza cadastro comum.
        </p>
      </section>

      {isLoading ? (
        <LoadingState lines={8} />
      ) : isError ? (
        <EmptyState
          icon={SearchX}
          title="Não foi possível carregar a auditoria"
          description="Verifique a conexão e tente de novo."
          action={<Button variant="outline" onClick={() => refetch()}>Tentar de novo</Button>}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Nenhuma ação encontrada"
          description={hasFilters ? "Nenhuma ação combina com estes filtros. Amplie o período ou limpe os filtros." : "Ainda não há ações registradas."}
          action={hasFilters ? <Button variant="outline" onClick={() => setF({ cat: "", action: "", user: "", from: "", to: "", page: 1 })}>Limpar filtros</Button> : undefined}
        />
      ) : (
        <div className="space-y-4">
          {groups.map(g => (
            <section key={g.key} aria-labelledby={`audit-day-${g.key}`} className="rounded-xl border overflow-hidden" style={{ backgroundColor: "var(--card)", borderColor: "var(--card-border)" }}>
              <h2
                id={`audit-day-${g.key}`}
                className="px-4 py-2 text-[12px] font-bold uppercase flex items-center justify-between"
                style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)", backgroundColor: "var(--muted)" }}
              >
                <span>{dayHeading(g.key)}</span>
                <span>{g.logs.length} {g.logs.length === 1 ? "ação" : "ações"}</span>
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
          <Button data-testid="button-prev-page" variant="outline" disabled={f.page === 1} onClick={() => setF(p => ({ ...p, page: p.page - 1 }))}>
            <ChevronLeft size={16} className="mr-1" aria-hidden="true" /> Mais recentes
          </Button>
          <span className="text-[13px] text-center" style={{ color: "var(--muted-foreground)" }}>
            {firstShown}–{lastShown} de {total.toLocaleString("pt-BR")}
          </span>
          <Button data-testid="button-next-page" variant="outline" disabled={f.page >= totalPages} onClick={() => setF(p => ({ ...p, page: p.page + 1 }))}>
            Mais antigas <ChevronRight size={16} className="ml-1" aria-hidden="true" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
