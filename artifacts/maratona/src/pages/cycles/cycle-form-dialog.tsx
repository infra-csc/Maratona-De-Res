// Criar e editar ciclo. Mostra ANTES de salvar o que é consequência (o ciclo
// vira o atual, eventos que mudam de ciclo, regras que travam) e, depois de
// criar, o resultado: eventos e faltas que vieram, os de fora do período e os
// avisos do servidor.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateCycle, useUpdateCycle, type Cycle, type CycleSummary } from "@workspace/api-client-react";
import { AlertTriangle, CalendarPlus, Loader2, Lock, Pencil, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiErrorCode, apiErrorMessage, cn, plural } from "@/lib/utils";
import {
  Chip, DialogHeading, Eyebrow, FieldErrorText, FieldLabel, Notice, SwitchRow, btnPrimary, btnSecondary, dialogCls, fmtFull, inputCls, periodDays,
} from "./cycles-ui";
import { CreateConsequences, CreateResult } from "./cycle-form-parts";

type FormState = { name: string; startDate: string; endDate: string; minEvents: string; paymentDate: string; conformityWithoutConduta: boolean; areaEvaluation: boolean };
type FieldErrors = Partial<Record<"name" | "dates" | "minEvents", string>>;

/** Mesmas checagens do servidor (nome repetido, período sobreposto), antes de enviar. */
function checkAgainstOthers(form: FormState, others: CycleSummary[]): FieldErrors {
  const errs: FieldErrors = {};
  const name = form.name.trim().toLocaleLowerCase("pt-BR");
  const same = name ? others.find(o => o.name.trim().toLocaleLowerCase("pt-BR") === name) : undefined;
  if (same) errs.name = `Já existe um ciclo chamado "${same.name}". Use outro nome para não confundir o histórico.`;
  if (form.startDate && form.endDate && form.startDate <= form.endDate) {
    const overlap = others.find(o => o.startDate && o.endDate && form.startDate <= o.endDate && form.endDate >= o.startDate);
    if (overlap) errs.dates = `O período se sobrepõe ao ciclo "${overlap.name}" (${fmtFull(overlap.startDate)} a ${fmtFull(overlap.endDate)}). Cada dia pertence a um ciclo só.`;
  }
  return errs;
}

export function CycleFormDialog({ mode, cycle, suggestedStart: suggestedLive, previous: previousLive, others, open, onOpenChange }: {
  mode: "create" | "edit";
  cycle?: CycleSummary;
  suggestedStart?: string;
  /** Na criação: o ciclo que hoje é o atual (de onde os eventos vêm). */
  previous?: CycleSummary | null;
  /** Os outros ciclos (nome e período não podem repetir/sobrepor). */
  others: CycleSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const locked = mode === "edit" && cycle?.status === "closed";
  // Congela o ciclo anterior e o início sugerido na abertura: depois de criar,
  // a lista recarrega e o "atual" já é o ciclo novo.
  const [previous] = useState(previousLive);
  const [suggestedStart] = useState(suggestedLive);
  // Diálogo aberto sem Trigger do Radix: o foco volta à mão para quem abriu.
  const [returnTo] = useState(() => (typeof document !== "undefined" ? document.activeElement as HTMLElement | null : null));
  const initial = useMemo<FormState>(() => ({
    name: cycle?.name ?? "",
    startDate: cycle?.startDate ?? suggestedStart ?? "",
    endDate: cycle?.endDate ?? "",
    minEvents: cycle?.minEvents != null ? String(cycle.minEvents) : "",
    paymentDate: cycle?.paymentDate ?? "",
    conformityWithoutConduta: cycle?.conformityWithoutConduta ?? false,
    // Ciclo NOVO já nasce com a avaliação por área (decisão do dono, 06/10/2026).
    areaEvaluation: cycle ? (cycle.areaEvaluation ?? false) : true,
  }), [cycle, suggestedStart]);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Cycle | null>(null);
  // 409 CYCLE_HAS_EVALUATIONS: o ciclo já tem avaliação enviada — a forma de
  // avaliação volta ao que estava e o switch trava, com a explicação embaixo.
  // Já trava ao abrir quando o servidor informa avaliação enviada no ciclo.
  const [areaLocked, setAreaLocked] = useState((cycle?.stats?.evaluationsSubmitted ?? 0) > 0);
  const nameRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const minRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  // Erro do servidor fica no fim do formulário: rola até ele (e até o switch travado).
  useEffect(() => {
    if (!error) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    errorRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [error]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (error) setError(null);
    const key = k === "startDate" || k === "endDate" ? "dates" : k;
    if (key in errors) setErrors(e => { const n = { ...e }; delete n[key as keyof FieldErrors]; return n; });
  };

  const create = useCreateCycle({ mutation: {
    // Trocar o ciclo atual muda o que todas as telas mostram: recarrega tudo.
    onSuccess: c => { void qc.invalidateQueries(); setCreated(c); },
    onError: e => setError(apiErrorMessage(e, "Não foi possível criar o ciclo. Tente de novo.")),
  } });
  const update = useUpdateCycle({ mutation: {
    onSuccess: c => { void qc.invalidateQueries(); toast({ title: `Ciclo "${c.name}" atualizado` }); onOpenChange(false); },
    onError: e => {
      setError(apiErrorMessage(e, "Não foi possível salvar o ciclo. Tente de novo."));
      if (apiErrorCode(e) === "CYCLE_HAS_EVALUATIONS") {
        setAreaLocked(true);
        setForm(f => ({ ...f, areaEvaluation: cycle?.areaEvaluation ?? f.areaEvaluation }));
      }
    },
  } });
  const pending = create.isPending || update.isPending;

  const days = periodDays(form.startDate, form.endDate);
  const moving = previous?.endDate ? (previous.stats.eventsAfterEnd ?? 0) : null;
  // Mudar mínimo, matriz ou forma de avaliação recalcula o ciclo na hora.
  const rulesChanged = mode === "edit" && !locked && (
    form.minEvents.trim() !== initial.minEvents || form.conformityWithoutConduta !== initial.conformityWithoutConduta || form.areaEvaluation !== initial.areaEvaluation
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs: FieldErrors = {};
    const name = form.name.trim();
    if (!name) errs.name = "Informe o nome do ciclo.";
    if (!locked) {
      if (!form.startDate || !form.endDate) errs.dates = "Informe as datas de início e de término.";
      else if (form.startDate > form.endDate) errs.dates = "A data de início deve ser anterior ou igual à data de término.";
    }
    const minEvents = form.minEvents.trim() === "" ? null : Number(form.minEvents);
    if (!locked && minEvents != null && (!Number.isInteger(minEvents) || minEvents < 1 || minEvents > 50)) errs.minEvents = "Um número de 1 a 50 (ou vazio para a regra geral).";
    const pre = checkAgainstOthers(form, others);
    if (!errs.name && pre.name) errs.name = pre.name;
    if (!locked && !errs.dates && pre.dates) errs.dates = pre.dates;
    setErrors(errs);
    if (errs.name) { nameRef.current?.focus(); return; }
    if (errs.dates) { startRef.current?.focus(); return; }
    if (errs.minEvents) { minRef.current?.focus(); return; }
    const rules = { minEvents, paymentDate: form.paymentDate || null, conformityWithoutConduta: form.conformityWithoutConduta, areaEvaluation: form.areaEvaluation };
    if (mode === "create") create.mutate({ data: { name, startDate: form.startDate, endDate: form.endDate, ...rules } });
    // Ciclo fechado: o resultado oficial já saiu — só o nome e a data de pagamento mudam.
    else if (cycle) update.mutate({ id: cycle.id, data: locked ? { name, paymentDate: rules.paymentDate } : { name, startDate: form.startDate, endDate: form.endDate, ...rules } });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!pending) onOpenChange(v); }}>
      <DialogContent className={cn(dialogCls, "max-w-[620px] max-h-[92dvh] p-0 sm:p-0 gap-0 overflow-hidden flex flex-col")} data-testid="cycle-form-dialog"
        onCloseAutoFocus={e => { if (returnTo?.isConnected) { e.preventDefault(); returnTo.focus(); } }}>
        {created ? (
          <CreateResult cycle={created} previousName={previous?.name} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
              <DialogHeading
                icon={mode === "create" ? CalendarPlus : Pencil}
                tone="brand"
                Title={DialogTitle}
                Description={DialogDescription}
                title={mode === "create" ? "Novo ciclo" : `Editar ${cycle?.name ?? "ciclo"}`}
                description={mode === "create"
                  ? "O ciclo novo vira o atual na hora. O anterior fica guardado no histórico, só para consulta."
                  : locked
                    ? "Ciclo fechado: o período e as regras geraram o resultado oficial. Só o nome e a data de pagamento mudam."
                    : "O período define a janela de eventos trazidos pela sincronização."}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 space-y-6 border-t border-border pt-5">
              <fieldset className="space-y-4">
                <legend className="sr-only">Nome e período</legend>
                <Eyebrow as="div">Nome e período</Eyebrow>
                <div>
                  <FieldLabel htmlFor="cycle-name" required hint={<span className="tabular-nums">{form.name.length}/80</span>}>Nome</FieldLabel>
                  <input id="cycle-name" ref={nameRef} value={form.name} maxLength={80} autoFocus placeholder="Ex.: Ciclo 4º trimestre · 2026"
                    onChange={e => set("name", e.target.value)} data-testid="input-cycle-name"
                    aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "cycle-name-error" : undefined}
                    className={cn(inputCls, errors.name && "border-[var(--status-danger)]")} />
                  <FieldErrorText id="cycle-name-error" message={errors.name} />
                </div>
                <div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <FieldLabel htmlFor="cycle-start" required={!locked}>Início</FieldLabel>
                      <input id="cycle-start" ref={startRef} type="date" value={form.startDate} disabled={locked}
                        onChange={e => set("startDate", e.target.value)} data-testid="input-cycle-start"
                        aria-invalid={errors.dates ? true : undefined} aria-describedby={errors.dates ? "cycle-dates-error" : "cycle-dates-help"}
                        className={cn(inputCls, "tabular-nums disabled:opacity-60 disabled:cursor-not-allowed", errors.dates && "border-[var(--status-danger)]")} />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel htmlFor="cycle-end" required={!locked}>Término</FieldLabel>
                      <input id="cycle-end" type="date" value={form.endDate} min={form.startDate || undefined} disabled={locked}
                        onChange={e => set("endDate", e.target.value)} data-testid="input-cycle-end"
                        aria-invalid={errors.dates ? true : undefined} aria-describedby={errors.dates ? "cycle-dates-error" : "cycle-dates-help"}
                        className={cn(inputCls, "tabular-nums disabled:opacity-60 disabled:cursor-not-allowed", errors.dates && "border-[var(--status-danger)]")} />
                    </div>
                  </div>
                  {errors.dates
                    ? <FieldErrorText id="cycle-dates-error" message={errors.dates} />
                    : (
                      <p id="cycle-dates-help" className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">
                        {locked
                          ? <><Lock size={12} aria-hidden className="inline -mt-0.5 mr-1" />Período travado no fechamento.</>
                          : <>
                              {days != null ? <b className="font-semibold text-foreground tabular-nums">{plural(days, "dia", "dias")}</b> : "Escolha as duas datas."}
                              {mode === "create" && suggestedStart && form.startDate === suggestedStart && previous?.endDate
                                ? ` · começa no dia seguinte ao fim de "${previous.name}" (${fmtFull(previous.endDate)}).`
                                : days != null ? " no período." : ""}
                            </>}
                      </p>
                    )}
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="sr-only">Regras deste ciclo</legend>
                <div className="flex items-center gap-2">
                  <Eyebrow as="div">Regras deste ciclo</Eyebrow>
                  {locked && <Chip icon={Lock} className="h-5 text-[11px]">Travadas no fechamento</Chip>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <FieldLabel htmlFor="cycle-min-events">Mínimo de eventos</FieldLabel>
                    <input id="cycle-min-events" ref={minRef} type="number" inputMode="numeric" min={1} max={50} value={form.minEvents} disabled={locked}
                      placeholder={cycle?.effectiveMinEvents != null && cycle.minEvents == null ? `Regra geral: ${cycle.effectiveMinEvents}` : "Regra geral"}
                      onChange={e => set("minEvents", e.target.value)} data-testid="input-cycle-min-events"
                      aria-invalid={errors.minEvents ? true : undefined}
                      aria-describedby={errors.minEvents ? "cycle-min-events-error" : "cycle-min-events-help"}
                      className={cn(inputCls, "tabular-nums disabled:opacity-60 disabled:cursor-not-allowed", errors.minEvents && "border-[var(--status-danger)]")} />
                    {errors.minEvents
                      ? <FieldErrorText id="cycle-min-events-error" message={errors.minEvents} />
                      : <p id="cycle-min-events-help" className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">Eventos participados para ter bônus. Vazio = regra geral.</p>}
                  </div>
                  <div className="min-w-0">
                    <FieldLabel htmlFor="cycle-payment">Pagamento do bônus</FieldLabel>
                    <input id="cycle-payment" type="date" value={form.paymentDate}
                      onChange={e => set("paymentDate", e.target.value)} data-testid="input-cycle-payment" aria-describedby="cycle-payment-help"
                      className={cn(inputCls, "tabular-nums")} />
                    <p id="cycle-payment-help" className="mt-1.5 text-[12.5px] leading-snug text-muted-foreground">Data prevista. Pode mudar mesmo depois do fechamento.</p>
                  </div>
                </div>

                <SwitchRow
                  id="cycle-no-conduta"
                  testId="row-cycle-no-conduta"
                  title="Tirar a Conduta da Matriz de Conformidade"
                  locked={locked}
                  control={<Switch id="cycle-no-conduta" checked={form.conformityWithoutConduta} disabled={locked}
                    onCheckedChange={v => set("conformityWithoutConduta", v)} data-testid="switch-cycle-no-conduta" />}
                >
                  A pergunta some da Matriz e não desconta; EPI, Estaiamento e Guarda de equipamentos seguem valendo. Use quando a conduta for avaliada no critério Proatividade/Conduta.
                </SwitchRow>
                <SwitchRow
                  id="cycle-area-evaluation"
                  testId="row-cycle-area-evaluation"
                  title="Avaliação por área"
                  locked={locked || areaLocked}
                  lockedNoteId="cycle-area-locked"
                  lockedNote={areaLocked ? "Este ciclo já tem avaliação enviada: a forma de avaliação não muda mais. Os outros campos podem ser salvos." : undefined}
                  control={<Switch id="cycle-area-evaluation" checked={form.areaEvaluation} disabled={locked || areaLocked}
                    aria-describedby={areaLocked ? "cycle-area-locked" : undefined}
                    onCheckedChange={v => set("areaEvaluation", v)} data-testid="switch-cycle-area-evaluation" />}
                >
                  Qualquer avaliador da área do critério responde; a primeira resposta enviada da área fecha o critério para todos. Desligado = só quem foi designado em cada evento.
                  {!locked && !areaLocked && <span className="mt-1 block font-semibold text-foreground">Fica fixa depois da primeira avaliação enviada no ciclo.</span>}
                </SwitchRow>
              </fieldset>

              {mode === "create" && <CreateConsequences previous={previous ?? null} form={form} />}
              {rulesChanged && (
                <Notice icon={RefreshCw} tone="warn" testId="cycle-recompute-notice">
                  <b className="font-semibold">Salvar recalcula as notas e o bônus deste ciclo na hora</b> — você mudou o mínimo de eventos, a Matriz ou a forma de avaliação.
                </Notice>
              )}
              {error && (
                <div role="alert" ref={errorRef}>
                  <Notice icon={AlertTriangle} tone="danger" testId="cycle-form-error">{error}</Notice>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-border bg-card px-5 py-4 sm:px-6">
              {mode === "create" && (
                // O essencial do "Ao criar" sempre à vista, junto do botão.
                <p className="hidden sm:block mr-auto min-w-0 text-[12.5px] leading-snug text-muted-foreground" data-testid="cycle-create-summary">
                  <b className="font-semibold text-foreground">Vira o atual na hora</b>
                  {moving != null && moving > 0 && <> · <span className="font-semibold text-[var(--status-warn-text)]">{plural(moving, "evento muda", "eventos mudam")} de ciclo</span></>}
                </p>
              )}
              <button type="button" onClick={() => onOpenChange(false)} disabled={pending} className={btnSecondary}>Cancelar</button>
              <button type="submit" disabled={pending} aria-busy={pending || undefined} data-testid="button-save-cycle" className={btnPrimary}>
                {pending
                  ? <><Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> {mode === "create" ? "Criando…" : "Salvando…"}</>
                  : mode === "create" ? <><CalendarPlus size={15} aria-hidden /> Criar e tornar atual</> : "Salvar alterações"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
