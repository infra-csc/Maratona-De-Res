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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth, hasRole } from "@/lib/auth-context";
import { CONDENSED, BODY } from "@/lib/premium-theme";
import { cn, fmtDate, plural, apiErrorCode } from "@/lib/utils";

const FULL_DATE: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" };
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
// Nota sempre com 1 casa ("79,0"), como em todo o app.
export const n1 = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function cyclePeriod(c: { startDate?: string | null; endDate?: string | null }): string {
  if (c.startDate && c.endDate) return `${fmtDate(c.startDate, FULL_DATE)} a ${fmtDate(c.endDate, FULL_DATE)}`;
  if (c.startDate) return `A partir de ${fmtDate(c.startDate, FULL_DATE)}`;
  if (c.endDate) return `Até ${fmtDate(c.endDate, FULL_DATE)}`;
  return "Período não definido";
}

/** O bônus de um ciclo é OFICIAL quando ele está fechado e PROJETADO enquanto aberto. */
function bonusKind(c: Pick<CycleSummary, "status">): string {
  return c.status === "closed" ? "Oficial" : "Projetado";
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

/**
 * Depois de criar o ciclo: quantos eventos vieram do anterior e, desses,
 * quantos ficaram FORA do período do ciclo novo (conferir a data ou o período).
 */
function movedEventsMessage(c: { movedEvents?: { name: string; outsidePeriod?: boolean }[]; movedAbsences?: number }): string | undefined {
  const moved = c.movedEvents ?? [];
  if (moved.length === 0) return undefined;
  const outside = moved.filter(e => e.outsidePeriod);
  const parts = [
    `${moved.length === 1 ? "1 evento veio" : `${moved.length} eventos vieram`} do ciclo anterior: ${moved.map(e => e.name).join(", ")}${c.movedAbsences ? ` (com ${plural(c.movedAbsences, "falta/mérito ligado", "faltas/méritos ligados")})` : ""}.`,
    outside.length > 0
      ? `${outside.length === 1 ? "1 ficou fora do período do ciclo novo" : `${outside.length} ficaram fora do período do ciclo novo`} (${outside.map(e => e.name).join(", ")}) — confira a data do evento ou o período do ciclo.`
      : `Todos dentro do período do ciclo novo.`,
  ];
  return parts.join(" ");
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

export function Stat({ label, value, detail, hero, className }: { label: string; value: React.ReactNode; detail?: React.ReactNode; hero?: boolean; className?: string }) {
  return (
    <div
      className={cn("rounded-xl px-4 py-3.5 flex flex-col justify-between min-w-0", className)}
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
  // "Abertos" = abertos para avaliação, a regra única do app (o servidor conta
  // igual a Event.openForEvaluation — a mesma do cabeçalho de Eventos e da Central).
  const openCount = s.eventsOpen;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Stat hero label="Nota final média" value={n1(s.avgFinalResult)} detail={`${plural(s.collaborators, "colaborador", "colaboradores")} no ranking`} />
      {/* Mesma contagem da lista de Eventos: total guardado no ciclo, e à parte
          os "fora do período" (não contam aqui; vão para o próximo ciclo). */}
      <Stat label="Eventos confirmados" value={`${s.eventsConfirmed}/${s.eventsTotal}`}
        detail={[
          (s.eventsAfterEnd ?? 0) > 0
            ? `${plural(s.eventsStored ?? s.eventsTotal + (s.eventsAfterEnd ?? 0), "evento", "eventos")} na lista · ${plural(s.eventsAfterEnd ?? 0, "fora do período", "fora do período")} (${s.eventsAfterEnd === 1 ? "vai" : "vão"} para o próximo ciclo)`
            : null,
          openCount > 0 ? `${plural(openCount, "evento aberto", "eventos abertos")}` : "Nenhum evento aberto",
        ].filter(Boolean).join(" · ")} />
      <Stat label="Elegíveis ao bônus" value={`${s.eligible}/${s.collaborators}`} detail={`${s.withBonus} com bônus`} />
      <Stat label={cycle.status === "closed" ? "Bônus oficial" : "Bônus projetado"} value={brl(s.bonusTotal)} detail={cycle.status === "closed" ? "Apurado no fechamento · soma dos elegíveis" : "Muda até o fechamento · soma dos elegíveis"} />
      {/* No celular (2 colunas) o 5º cartão ocupa a linha toda — sem buraco. */}
      <Stat className="col-span-2 lg:col-span-1" label="Bônus pago" value={brl(s.bonusPaid)} detail={s.bonusTotal > 0 ? `${Math.round((s.bonusPaid / s.bonusTotal) * 100)}% do total` : "Nada a pagar"} />
    </div>
  );
}

type FormState = { name: string; startDate: string; endDate: string; minEvents: string; paymentDate: string; conformityWithoutConduta: boolean; areaEvaluation: boolean };

/** Regras do ciclo em poucas palavras (tabela "Todos os ciclos"). */
function CycleRulesCell({ cycle, testId = true }: { cycle: CycleSummary; testId?: boolean }) {
  const min = cycle.effectiveMinEvents ?? cycle.minEvents;
  return (
    <span className="flex flex-col gap-0.5 text-[12px] leading-snug" data-testid={testId ? `cycle-rules-cell-${cycle.id}` : undefined}>
      <span className="font-semibold whitespace-nowrap" style={{ color: "var(--foreground)" }}>
        {min != null ? `Mínimo ${min} eventos` : "Mínimo: regra geral"}{cycle.minEvents == null && min != null ? " (geral)" : ""}
      </span>
      <span style={{ color: "var(--muted-foreground)" }}>
        {cycle.conformityWithoutConduta ? "Matriz sem Conduta" : "Matriz com Conduta"} · {cycle.areaEvaluation ? "por área" : "por designação"}
      </span>
    </span>
  );
}

/** Regras do ciclo em uma linha (mínimo de eventos, pagamento, matriz). */
export function CycleRulesLine({ cycle }: { cycle: CycleSummary }) {
  const min = cycle.effectiveMinEvents ?? cycle.minEvents;
  const parts = [
    min != null ? `Mínimo de ${min} eventos para o bônus${cycle.minEvents == null ? " (regra geral)" : ""}` : null,
    cycle.paymentDate ? `Pagamento em ${fmtDate(cycle.paymentDate, FULL_DATE)}` : "Data de pagamento não definida",
    cycle.conformityWithoutConduta ? "Matriz de conformidade sem Conduta" : "Matriz de conformidade com Conduta",
    cycle.areaEvaluation ? "Avaliação por área" : "Avaliação por designação",
  ].filter(Boolean);
  return <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }} data-testid={`cycle-rules-${cycle.id}`}>{parts.join(" · ")}</p>;
}

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
    minEvents: cycle?.minEvents != null ? String(cycle.minEvents) : "",
    paymentDate: cycle?.paymentDate ?? "",
    conformityWithoutConduta: cycle?.conformityWithoutConduta ?? false,
    // Ciclo NOVO já nasce com a avaliação por área (decisão do dono, 06/10/2026).
    areaEvaluation: cycle ? (cycle.areaEvaluation ?? false) : true,
  }));
  const [error, setError] = useState<string | null>(null);

  const onSuccess = (title: string, description?: string) => {
    // Trocar o ciclo atual muda o que todas as telas mostram: recarrega tudo.
    void qc.invalidateQueries();
    toast({ title, description });
    onOpenChange(false);
  };
  const create = useCreateCycle({ mutation: { onSuccess: c => onSuccess(`Ciclo "${c.name}" criado e marcado como atual`, movedEventsMessage(c)),
    onError: e => setError(apiErrorMessage(e)) } });
  // 409 CYCLE_HAS_EVALUATIONS: o ciclo já tem avaliação enviada — a forma de
  // avaliação volta ao que estava e o switch trava, com a explicação embaixo.
  const [areaLocked, setAreaLocked] = useState(false);
  const update = useUpdateCycle({ mutation: { onSuccess: c => onSuccess(`Ciclo "${c.name}" atualizado`), onError: e => {
    setError(apiErrorMessage(e));
    if (apiErrorCode(e) === "CYCLE_HAS_EVALUATIONS") {
      setAreaLocked(true);
      setForm(f => ({ ...f, areaEvaluation: cycle?.areaEvaluation ?? f.areaEvaluation }));
    }
  } } });
  const pending = create.isPending || update.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = form.name.trim();
    if (!name) { setError("Informe o nome do ciclo."); return; }
    if (!form.startDate || !form.endDate) { setError("Informe as datas de início e de término."); return; }
    if (form.startDate > form.endDate) { setError("A data de início deve ser anterior ou igual à data de término."); return; }
    const minEvents = form.minEvents.trim() === "" ? null : Number(form.minEvents);
    if (minEvents != null && (!Number.isInteger(minEvents) || minEvents < 1 || minEvents > 50)) { setError("Mínimo de eventos: um número de 1 a 50 (ou vazio para a regra geral)."); return; }
    const rules = { minEvents, paymentDate: form.paymentDate || null, conformityWithoutConduta: form.conformityWithoutConduta, areaEvaluation: form.areaEvaluation };
    if (mode === "create") create.mutate({ data: { name, startDate: form.startDate, endDate: form.endDate, ...rules } });
    // Ciclo fechado: o resultado oficial já saiu — só o nome e a data de pagamento mudam.
    else if (cycle) update.mutate({ id: cycle.id, data: locked ? { name, paymentDate: rules.paymentDate } : { name, startDate: form.startDate, endDate: form.endDate, ...rules } });
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
                  ? "Este ciclo já foi fechado. O período e as regras dele geraram os resultados oficiais: só o nome e a data de pagamento podem mudar."
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

          <fieldset className="space-y-3 rounded-lg p-3" style={{ border: "1px solid var(--border)" }}>
            <legend className="px-1 text-[11px] font-bold uppercase" style={{ fontFamily: CONDENSED, letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>Regras deste ciclo</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cycle-min-events">Mínimo de eventos</Label>
                <Input id="cycle-min-events" type="number" inputMode="numeric" min={1} max={50} value={form.minEvents} disabled={locked}
                  placeholder={cycle?.effectiveMinEvents != null && cycle.minEvents == null ? `Regra geral: ${cycle.effectiveMinEvents}` : "Regra geral"}
                  onChange={e => setForm(f => ({ ...f, minEvents: e.target.value }))} data-testid="input-cycle-min-events" aria-describedby="cycle-min-events-help" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cycle-payment">Pagamento do bônus</Label>
                <Input id="cycle-payment" type="date" value={form.paymentDate}
                  onChange={e => setForm(f => ({ ...f, paymentDate: e.target.value }))} data-testid="input-cycle-payment" />
              </div>
            </div>
            <p id="cycle-min-events-help" className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Eventos participados para ter direito ao bônus. Vazio = regra geral (Regras do Sistema).</p>
            <label htmlFor="cycle-no-conduta" className="flex items-start gap-3 cursor-pointer">
              <Switch id="cycle-no-conduta" checked={form.conformityWithoutConduta} disabled={locked}
                onCheckedChange={v => setForm(f => ({ ...f, conformityWithoutConduta: v }))} data-testid="switch-cycle-no-conduta" />
              <span className="text-[13px] leading-snug">
                <strong>Tirar a Conduta da Matriz de Conformidade</strong>
                <span className="block text-[12px]" style={{ color: "var(--muted-foreground)" }}>A pergunta some da matriz e não desconta; EPI, Estaiamento e Guarda de equipamentos seguem valendo o mesmo. Use quando a conduta for avaliada em critério (Proatividade/Conduta).</span>
              </span>
            </label>
            <label htmlFor="cycle-area-evaluation" className="flex items-start gap-3 cursor-pointer">
              <Switch id="cycle-area-evaluation" checked={form.areaEvaluation} disabled={locked || areaLocked} aria-describedby={areaLocked ? "cycle-area-locked" : undefined}
                onCheckedChange={v => setForm(f => ({ ...f, areaEvaluation: v }))} data-testid="switch-cycle-area-evaluation" />
              <span className="text-[13px] leading-snug">
                <strong>Avaliação por área</strong>
                <span className="block text-[12px]" style={{ color: "var(--muted-foreground)" }}>Qualquer avaliador da área do critério responde; a primeira resposta da área fecha o critério para todos. Desligado = só quem foi designado em cada evento.</span>
                {areaLocked && (
                  <span id="cycle-area-locked" className="block text-[12px] font-semibold mt-1" style={{ color: "var(--status-warn-text)" }} data-testid="cycle-area-locked">
                    Este ciclo já tem avaliação enviada: a forma de avaliação não muda mais. Os outros campos podem ser salvos.
                  </span>
                )}
              </span>
            </label>
            {mode === "edit" && !locked && (
              <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>Mudar o mínimo de eventos, a matriz ou a forma de avaliação recalcula as notas e o bônus deste ciclo na hora.</p>
            )}
          </fieldset>

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
          // Ciclo atual aberto com eventos: o servidor recusa o ciclo novo até
          // ele ser fechado — o botão já nasce desligado, com o motivo ao lado.
          <div className="flex flex-col items-start sm:items-end gap-1.5 max-w-xs">
            <Button onClick={() => setCreating(true)} disabled={currentNeedsClose} aria-describedby={currentNeedsClose ? "new-cycle-blocked" : undefined} data-testid="button-new-cycle">
              <CalendarPlus size={16} aria-hidden /> Novo ciclo
            </Button>
            {currentNeedsClose && (
              <p id="new-cycle-blocked" className="text-[12px] leading-snug sm:text-right" style={{ color: "var(--muted-foreground)" }} data-testid="new-cycle-blocked">
                Feche o ciclo atual antes, em <Link href="/results" className="font-semibold underline underline-offset-2" style={{ color: "var(--foreground)" }}>Resultados &amp; Ranking</Link>.
              </p>
            )}
          </div>
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
                  <CycleRulesLine cycle={current} />
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
            {/* Celular: um cartão por ciclo (a tabela larga rolava a página de lado). */}
            <ul className="md:hidden divide-y" style={{ borderTop: "1px solid var(--border)", borderColor: "var(--border)" }} data-testid="list-cycles-mobile">
              {data.map(c => (
                <li key={c.id} className="px-5 py-4 space-y-2.5" data-testid={`card-cycle-${c.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/cycles/${c.id}`} className="font-black uppercase text-[15px] leading-tight hover:underline underline-offset-2 min-w-0 break-words" style={{ fontFamily: CONDENSED }}>{c.name}</Link>
                    <span className="shrink-0"><CycleStatus cycle={c} /></span>
                  </div>
                  <p className="text-[13px]" style={{ color: "var(--muted-foreground)" }}>{cyclePeriod(c)}</p>
                  <CycleRulesCell cycle={c} testId={false} />
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                    <div className="col-span-2 flex justify-between gap-2"><dt style={{ color: "var(--muted-foreground)" }}>Pagamento</dt><dd className="font-semibold tabular-nums" style={{ color: c.paymentDate ? "var(--foreground)" : "var(--muted-foreground)" }}>{c.paymentDate ? fmtDate(c.paymentDate, FULL_DATE) : "Não definida"}</dd></div>
                    <div className="flex justify-between gap-2"><dt style={{ color: "var(--muted-foreground)" }}>Eventos</dt><dd className="font-semibold tabular-nums text-right">{c.stats.eventsConfirmed}/{c.stats.eventsTotal}<span className="sr-only"> confirmados</span>{(c.stats.eventsAfterEnd ?? 0) > 0 && <span className="block text-[11px] font-normal" style={{ color: "var(--muted-foreground)" }}>+{c.stats.eventsAfterEnd} fora do período</span>}</dd></div>
                    <div className="flex justify-between gap-2"><dt style={{ color: "var(--muted-foreground)" }}>Ranking</dt><dd className="font-semibold tabular-nums">{c.stats.collaborators}</dd></div>
                    <div className="flex justify-between gap-2"><dt style={{ color: "var(--muted-foreground)" }}>Bônus {bonusKind(c).toLowerCase()}</dt><dd className="font-semibold tabular-nums">{brl(c.stats.bonusTotal)}</dd></div>
                    <div className="flex justify-between gap-2"><dt style={{ color: "var(--muted-foreground)" }}>Nota média</dt><dd className="font-semibold tabular-nums">{n1(c.stats.avgFinalResult)}</dd></div>
                  </dl>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" variant="outline" asChild><Link href={`/cycles/${c.id}`} aria-label={`Histórico de ${c.name}`}><History size={14} aria-hidden /> Histórico</Link></Button>
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`}><Pencil size={14} aria-hidden /> Editar</Button>
                    )}
                    {isAdmin && !c.isCurrent && c.status !== "closed" && (
                      <Button size="sm" variant="outline" onClick={() => setMakeCurrent(c)}><Star size={14} aria-hidden /> Tornar atual</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {/* "relative": os textos sr-only (position absolute) ficam presos aqui
                dentro e não alargam a página. */}
            <div className="hidden md:block overflow-x-auto relative">
              {/* 8 colunas compactas (situação embaixo do nome; pagamento junto
                  das regras): cabe a 1366 sem cortar "Histórico" nem quebrar o
                  nome do ciclo em 3 linhas. */}
              <table className="w-full min-w-[860px] text-[13px]" data-testid="table-cycles">
                <thead>
                  <tr>
                    {["Ciclo", "Período", "Regras e pagamento", "Eventos", "Ranking", "Bônus", "Nota média", ""].map((h, i) => (
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
                      <td className="py-2.5 px-3 min-w-[150px]" style={{ borderBottom: "1px solid var(--border)" }}>
                        <Link href={`/cycles/${c.id}`} className="font-semibold hover:underline underline-offset-2 break-words">{c.name}</Link>
                        <span className="mt-1 block"><CycleStatus cycle={c} /></span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{cyclePeriod(c)}</td>
                      <td className="py-2.5 px-3 min-w-[190px]" style={{ borderBottom: "1px solid var(--border)" }}>
                        <CycleRulesCell cycle={c} />
                        <span className="block text-[12px] leading-snug" style={{ color: c.paymentDate ? "var(--foreground)" : "var(--muted-foreground)" }} data-testid={`cycle-payment-${c.id}`}>
                          {c.paymentDate ? `Pagamento em ${fmtDate(c.paymentDate, FULL_DATE)}` : "Pagamento: data não definida"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)" }}>
                        {c.stats.eventsConfirmed}/{c.stats.eventsTotal}<span className="sr-only"> confirmados</span>
                        {(c.stats.eventsAfterEnd ?? 0) > 0 && (
                          <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }} data-testid={`cycle-after-end-${c.id}`}>+{c.stats.eventsAfterEnd} fora do período</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{c.stats.collaborators}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap" style={{ borderBottom: "1px solid var(--border)" }} data-testid={`cycle-bonus-${c.id}`}>
                        {brl(c.stats.bonusTotal)}
                        <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>{bonusKind(c)}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums" style={{ borderBottom: "1px solid var(--border)" }}>{n1(c.stats.avgFinalResult)}</td>
                      <td className="py-2.5 pl-3 pr-4" style={{ borderBottom: "1px solid var(--border)" }}>
                        <div className="flex justify-end gap-1">
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
