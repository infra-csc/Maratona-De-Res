import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCycles, useCreateCycle, useUpdateCycle, useSetCurrentCycle,
  getListCyclesQueryKey, type CycleSummary,
} from "@workspace/api-client-react";
import { AlertTriangle, CalendarPlus, CalendarRange, History, Lock, Pencil, Star } from "lucide-react";
import { PageHeader, EmptyState, LoadingState, StatusBadge, ConfirmDialog } from "@/components/shared";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasRole } from "@/lib/auth-context";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { fmtDate } from "@/lib/utils";

const FULL_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const n1 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

export function cyclePeriod(c: { startDate?: string | null; endDate?: string | null }): string {
  if (c.startDate && c.endDate) return `${fmtDate(c.startDate, FULL_DATE)} a ${fmtDate(c.endDate, FULL_DATE)}`;
  if (c.startDate) return `A partir de ${fmtDate(c.startDate, FULL_DATE)}`;
  if (c.endDate) return `Até ${fmtDate(c.endDate, FULL_DATE)}`;
  return "Período não definido";
}

/** Situação do ciclo em texto + cor (a cor nunca é o único sinal). */
export function CycleStatus({ cycle }: { cycle: Pick<CycleSummary, "isCurrent" | "status" | "closedAt"> }) {
  const closed = cycle.status === "closed";
  const closedOn = cycle.closedAt ? ` em ${new Date(cycle.closedAt).toLocaleDateString("pt-BR")}` : "";
  if (cycle.isCurrent && !closed) return <StatusBadge variant="ok" size="sm" icon={Star} label="Atual" />;
  if (cycle.isCurrent && closed) return <StatusBadge variant="info" size="sm" icon={Lock} label={`Atual · fechado${closedOn}`} />;
  if (closed) return <StatusBadge variant="neutral" size="sm" icon={Lock} label={`Fechado${closedOn}`} />;
  return <StatusBadge variant="warn" size="sm" label="Aberto, fora do atual" srLabel="Ciclo aberto que não é o atual: ainda não foi fechado" />;
}

/** Mensagem do servidor sem o prefixo "HTTP 409 ...". */
export function apiErrorMessage(e: unknown, fallback = "Tente novamente."): string {
  const data = (e as { data?: { error?: unknown } } | null)?.data;
  if (data && typeof data.error === "string") return data.error;
  return (e as { message?: string } | null)?.message ?? fallback;
}

function addDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function Stat({ label, value, detail, hero }: { label: string; value: React.ReactNode; detail?: React.ReactNode; hero?: boolean }) {
  return (
    <div
      className="rounded-xl px-4 py-3.5 flex flex-col justify-between min-w-0"
      style={{ backgroundColor: hero ? "var(--primary)" : "var(--card)", border: `1px solid ${hero ? "var(--primary)" : "var(--border)"}`, color: hero ? "var(--primary-foreground)" : "var(--foreground)" }}
    >
      <span className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.06em", opacity: hero ? 0.8 : 1, color: hero ? undefined : "var(--muted-foreground)" }}>{label}</span>
      <span className={`${hero ? "text-4xl" : "text-[26px]"} font-black leading-none mt-2 tabular-nums`} style={{ fontFamily: CONDENSED }}>{value}</span>
      {detail && <span className="text-[12px] mt-1.5" style={{ opacity: hero ? 0.85 : 1, color: hero ? undefined : "var(--muted-foreground)" }}>{detail}</span>}
    </div>
  );
}

export function CycleStatTiles({ cycle }: { cycle: CycleSummary }) {
  const s = cycle.stats;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Stat hero label="Nota final média" value={n1(s.avgFinalResult)} detail={`${s.collaborators} colaborador(es) no ranking`} />
      <Stat label="Eventos confirmados" value={`${s.eventsConfirmed}/${s.eventsTotal}`} detail={s.eventsOpen > 0 ? `${s.eventsOpen} ainda aberto(s)` : "Nenhum evento aberto"} />
      <Stat label="Elegíveis ao bônus" value={`${s.eligible}/${s.collaborators}`} detail={`${s.withBonus} com bônus`} />
      <Stat label={cycle.status === "closed" ? "Bônus do ciclo" : "Bônus projetado"} value={brl(s.bonusTotal)} detail="Soma dos elegíveis" />
      <Stat label="Bônus pago" value={brl(s.bonusPaid)} detail={s.bonusTotal > 0 ? `${Math.round((s.bonusPaid / s.bonusTotal) * 100)}% do total` : "Nada a pagar"} />
    </div>
  );
}

type FormState = { name: string; startDate: string; endDate: string };

function CycleFormDialog({ mode, cycle, suggestedStart, open, onOpenChange }: {
  mode: "create" | "edit";
  cycle?: CycleSummary;
  suggestedStart?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const locked = mode === "edit" && cycle?.status === "closed";
  const [form, setForm] = useState<FormState>(() => ({
    name: cycle?.name ?? "",
    startDate: cycle?.startDate ?? suggestedStart ?? "",
    endDate: cycle?.endDate ?? "",
  }));
  const [error, setError] = useState<string | null>(null);

  const onSuccess = (title: string) => {
    // Trocar o ciclo atual muda o que todas as telas mostram: recarrega tudo.
    void qc.invalidateQueries();
    toast({ title });
    onOpenChange(false);
  };
  const create = useCreateCycle({ mutation: { onSuccess: c => onSuccess(`Ciclo "${c.name}" criado e marcado como atual`), onError: e => setError(apiErrorMessage(e)) } });
  const update = useUpdateCycle({ mutation: { onSuccess: c => onSuccess(`Ciclo "${c.name}" atualizado`), onError: e => setError(apiErrorMessage(e)) } });
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    if (!name) { setError("Informe o nome do ciclo."); return; }
    if (!form.startDate || !form.endDate) { setError("Informe as datas de início e de término."); return; }
    if (form.startDate > form.endDate) { setError("A data de início deve ser anterior ou igual à data de término."); return; }
    if (mode === "create") create.mutate({ data: { name, startDate: form.startDate, endDate: form.endDate } });
    else if (cycle) update.mutate({ id: cycle.id, data: locked ? { name } : { name, startDate: form.startDate, endDate: form.endDate } });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!pending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md" style={{ fontFamily: BODY }}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle className="uppercase font-black" style={{ fontFamily: CONDENSED }}>
              {mode === "create" ? "Novo ciclo" : "Editar ciclo"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "O novo ciclo vira o atual: eventos, avaliações e sincronização passam a entrar nele. O ciclo anterior fica guardado no histórico."
                : locked
                  ? "Este ciclo já foi fechado. O período dele gerou os resultados oficiais, então só o nome pode mudar."
                  : "Ajuste o nome e o período. O período define a janela de eventos trazidos pela sincronização."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="cycle-name">Nome</Label>
            <Input id="cycle-name" value={form.name} maxLength={80} autoFocus placeholder="Ex.: Ciclo 2 · 2026"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-cycle-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cycle-start">Início</Label>
              <Input id="cycle-start" type="date" value={form.startDate} disabled={locked}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} data-testid="input-cycle-start" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cycle-end">Término</Label>
              <Input id="cycle-end" type="date" value={form.endDate} min={form.startDate || undefined} disabled={locked}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} data-testid="input-cycle-end" />
            </div>
          </div>

          {error && (
            <p role="alert" className="flex gap-2 rounded-lg px-3 py-2 text-[13px]" style={{ color: "var(--status-danger-text)", backgroundColor: "var(--status-danger-bg)" }}>
              <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden /> <span>{error}</span>
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending} data-testid="button-save-cycle">
              {pending ? "Salvando…" : mode === "create" ? "Criar ciclo" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function CyclesPage() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useListCycles({ query: { queryKey: getListCyclesQueryKey(), staleTime: 30_000 } });

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CycleSummary | null>(null);
  const [makeCurrent, setMakeCurrent] = useState<CycleSummary | null>(null);

  const setCurrent = useSetCurrentCycle({
    mutation: {
      onSuccess: c => { void qc.invalidateQueries(); toast({ title: `"${c.name}" agora é o ciclo atual` }); setMakeCurrent(null); },
      onError: e => toast({ title: "Não foi possível trocar o ciclo atual", description: apiErrorMessage(e), variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="px-6 py-6"><LoadingState lines={6} withHeader label="Carregando ciclos" /></div>;
  if (isError || !data) {
    return (
      <div className="px-6 py-10">
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar os ciclos" description={apiErrorMessage(error, "Tente novamente em instantes.")} />
      </div>
    );
  }

  const current = data.find(c => c.isCurrent) ?? null;
  const latestEnd = data.map(c => c.endDate).filter((d): d is string => !!d).sort().at(-1);
  const suggestedStart = latestEnd ? addDay(latestEnd) : undefined;
  const currentNeedsClose = !!current && current.status !== "closed" && current.stats.eventsTotal > 0;

  return (
    <div className="px-6 py-6 space-y-6" style={{ fontFamily: BODY }}>
      <PageHeader
        eyebrow="Cadastros"
        title="Ciclos"
        description="Cada ciclo guarda seus eventos, notas, ranking e bônus. Ciclos nunca são excluídos: o histórico de todos fica sempre disponível para consulta."
        actions={isAdmin && (
          <Button onClick={() => setCreating(true)} data-testid="button-new-cycle">
            <CalendarPlus size={16} aria-hidden /> Novo ciclo
          </Button>
        )}
      />

      {data.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhum ciclo cadastrado"
          description={isAdmin ? "Crie o primeiro ciclo para poder cadastrar eventos e avaliações." : "Peça a um administrador para criar o primeiro ciclo."}
          action={isAdmin ? <Button onClick={() => setCreating(true)}>Criar ciclo</Button> : undefined}
        />
      ) : (
        <>
          {current && (
            <section aria-labelledby="current-cycle-title" className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Ciclo atual</p>
                  <h2 id="current-cycle-title" className="text-xl font-black uppercase leading-tight flex flex-wrap items-center gap-2" style={{ fontFamily: CONDENSED }}>
                    {current.name} <CycleStatus cycle={current} />
                  </h2>
                  <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>{cyclePeriod(current)}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" asChild><Link href={`/cycles/${current.id}`}><History size={15} aria-hidden /> Ver histórico</Link></Button>
                  {isAdmin && <Button variant="outline" onClick={() => setEditing(current)}><Pencil size={15} aria-hidden /> Editar</Button>}
                </div>
              </div>
              <CycleStatTiles cycle={current} />
              {isAdmin && currentNeedsClose && (
                <p className="text-[13px] rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "var(--secondary)" }}>
                  Para começar o próximo ciclo, feche este primeiro em{" "}
                  <Link href="/results" className="font-semibold underline underline-offset-2">Resultados & Ranking</Link>{" "}
                  (botão "Fechar Ciclo"). Assim os resultados oficiais dele ficam guardados no histórico.
                </p>
              )}
            </section>
          )}

          <section aria-labelledby="all-cycles-title" className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <header className="px-5 pt-4 pb-2">
              <h2 id="all-cycles-title" className="text-[15px] font-black uppercase" style={{ fontFamily: CONDENSED }}>Todos os ciclos</h2>
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Do mais recente ao mais antigo. Abra um ciclo para ver o ranking final, o bônus de cada colaborador e os eventos.</p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]" data-testid="table-cycles">
                <thead>
                  <tr>
                    {["Ciclo", "Período", "Situação", "Eventos", "Ranking", "Bônus", "Nota média", ""].map((h, i) => (
                      <th key={i} scope="col" className={`py-2 px-3 font-bold uppercase text-[11px] whitespace-nowrap ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}
                        style={{ fontFamily: CONDENSED, color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
                        {h || <span className="sr-only">Ações</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map(c => (
                    <tr key={c.id} data-testid={`row-cycle-${c.id}`} className="align-middle">
                      <td className="py-2.5 px-3 font-semibold" style={{ borderBottom: "1px solid var(--border)" }}>
                        <Link href={`/cycles/${c.id}`} className="hover:underline underline-offset-2">{c.name}</Link>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{cyclePeriod(c)}</td>
                      <td className="py-2.5 px-3" style={{ borderBottom: "1px solid var(--border)" }}><CycleStatus cycle={c} /></td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)" }}>
                        {c.stats.eventsConfirmed}/{c.stats.eventsTotal}<span className="sr-only"> confirmados</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{c.stats.collaborators}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)" }}>{brl(c.stats.bonusTotal)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{n1(c.stats.avgFinalResult)}</td>
                      <td className="py-2.5 px-3" style={{ borderBottom: "1px solid var(--border)" }}>
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" asChild><Link href={`/cycles/${c.id}`} aria-label={`Histórico de ${c.name}`}><History size={14} aria-hidden /> Histórico</Link></Button>
                          {isAdmin && (
                            <Button size="sm" variant="ghost" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}><Pencil size={14} aria-hidden /></Button>
                          )}
                          {isAdmin && !c.isCurrent && c.status !== "closed" && (
                            <Button size="sm" variant="ghost" onClick={() => setMakeCurrent(c)}><Star size={14} aria-hidden /> Tornar atual</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {creating && <CycleFormDialog mode="create" suggestedStart={suggestedStart} open onOpenChange={v => { if (!v) setCreating(false); }} />}
      {editing && <CycleFormDialog key={editing.id} mode="edit" cycle={editing} open onOpenChange={v => { if (!v) setEditing(null); }} />}
      <ConfirmDialog
        open={!!makeCurrent}
        onOpenChange={v => { if (!v) setMakeCurrent(null); }}
        title={makeCurrent ? `Tornar "${makeCurrent.name}" o ciclo atual?` : ""}
        description={`Todas as telas (eventos, avaliações, resultados, ranking e análises) passam a mostrar este ciclo, e os eventos novos e a sincronização entram nele.${current ? ` "${current.name}" continua guardado no histórico.` : ""}`}
        confirmLabel="Tornar atual"
        isPending={setCurrent.isPending}
        onConfirm={() => { if (makeCurrent) setCurrent.mutate({ id: makeCurrent.id }); }}
      />
    </div>
  );
}
