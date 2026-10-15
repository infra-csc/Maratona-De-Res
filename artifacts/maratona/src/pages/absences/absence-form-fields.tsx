// Campos do diálogo "Registrar/Editar lançamento" com seletor próprio
// (colaborador, tipo e evento). O estado aberto/fechado dos popovers mora no
// diálogo (sempre montado).
import type { Employee, Event } from "@workspace/api-client-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Lock, MapPin, X } from "lucide-react";
import { cn, fmtDate, fmtScore, plural } from "@/lib/utils";
import { Avatar, FOCUS_RING, FieldErrorText, FieldLabel, inputCls, invalidCls } from "./absences-ui";
import { eventLockedByClosedCycle } from "./helpers";
import type { AbsenceFormState } from "./use-absence-form";
import type { PenaltyTypeLookup } from "./use-penalty-types";
import type { EmployeeScore } from "./types";

type PickerProps = { open: boolean; onOpenChange: (v: boolean) => void };

const triggerCls = cn(inputCls, "flex items-center justify-between gap-2 text-left", FOCUS_RING);
const popCls = "p-0 rounded-xl border-border w-[var(--radix-popover-trigger-width)] min-w-[min(320px,calc(100vw-24px))]";

function eventDates(e: Pick<Event, "startDate" | "endDate">) {
  return `${fmtDate(e.startDate)}${e.endDate && e.endDate !== e.startDate ? ` a ${fmtDate(e.endDate)}` : ""}`;
}

export function EmployeePickerField({ form, employees, scores, open, onOpenChange }: PickerProps & {
  form: AbsenceFormState; employees: Employee[] | undefined; scores: Map<number, EmployeeScore>;
}) {
  const { selectedEmployee, watchedEmployeeId, setValue, errors } = form;
  const err = errors.employeeId?.message;
  const sorted = (employees ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <div>
      <FieldLabel htmlFor="absence-employee" required>Colaborador</FieldLabel>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button type="button" role="combobox" aria-expanded={open} id="absence-employee" data-testid="select-absence-employee"
            aria-invalid={!!err} aria-describedby={err ? "absence-employee-error" : undefined}
            className={cn(triggerCls, err && invalidCls)}>
            {selectedEmployee ? (
              <span className="flex items-center gap-2.5 min-w-0">
                <Avatar name={selectedEmployee.name} className="w-7 h-7 text-[11px] rounded-md" />
                <span className="truncate font-semibold">{selectedEmployee.name}</span>
              </span>
            ) : <span className="truncate text-muted-foreground">Busque pelo nome</span>}
            <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={popCls}>
          <Command>
            <CommandInput placeholder="Buscar pelo nome..." />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">Nenhum colaborador ativo com esse nome.</CommandEmpty>
              <CommandGroup>
                {sorted.map(e => {
                  const s = scores.get(e.id);
                  return (
                    <CommandItem key={e.id} value={`${e.name} ${e.id}`} onSelect={() => { setValue("employeeId", e.id, { shouldValidate: true }); onOpenChange(false); }}
                      className="data-[selected=true]:bg-secondary data-[selected=true]:text-foreground gap-2.5 min-h-11 lg:min-h-10 py-1.5">
                      <Check size={14} aria-hidden className={cn("shrink-0", Number(watchedEmployeeId) === e.id ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.name}</span>
                        <span className="block text-[12px] text-muted-foreground tabular-nums">
                          {s ? `${plural(s.eventsCount, "evento", "eventos")} · nota ${fmtScore(s.finalResult)}` : "sem nota no ciclo ainda"}
                        </span>
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldErrorText id="absence-employee-error" message={err} />
    </div>
  );
}

export function PenaltyTypeField({ form, types }: { form: AbsenceFormState; types: PenaltyTypeLookup }) {
  const { selectedType, setValue, errors } = form;
  const { activeTypes, defaultType, typeLabel } = types;
  const groups = [
    { kind: "penalty", title: "Penalidades · descontam", sign: "−", list: activeTypes.filter(t => t.kind === "penalty") },
    { kind: "merit", title: "Méritos · somam", sign: "+", list: activeTypes.filter(t => t.kind === "merit") },
  ].filter(g => g.list.length > 0);
  // O tipo do lançamento pode ter sido desativado depois: continua aparecendo no campo.
  const inactiveCurrent = selectedType && !activeTypes.some(t => t.slug === selectedType) ? selectedType : null;
  return (
    <div>
      <FieldLabel htmlFor="absence-type" required>Tipo de lançamento</FieldLabel>
      <Select
        value={selectedType || defaultType}
        onValueChange={v => { setValue("penaltyType", v); setValue("eventId", null, { shouldValidate: !!errors.eventId }); }}
      >
        <SelectTrigger id="absence-type" data-testid="select-penalty-type" className={cn(inputCls, "justify-between")}>
          <SelectValue placeholder="Selecione o tipo…" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(380px,60dvh)]">
          {inactiveCurrent && <SelectItem value={inactiveCurrent} disabled>{typeLabel(inactiveCurrent)} — inativo</SelectItem>}
          {groups.map((g, i) => (
            <SelectGroup key={g.kind}>
              {i > 0 && <SelectSeparator />}
              <SelectLabel className={cn("font-condensed text-[12px] font-bold uppercase tracking-[0.08em]", g.kind === "merit" ? "text-[var(--status-ok-text)]" : "text-[var(--status-danger-text)]")}>{g.title}</SelectLabel>
              {g.list.map(t => (
                <SelectItem key={t.slug} value={t.slug} className="min-h-11 lg:min-h-9">
                  {t.label} — {g.sign}{t.points} pts{t.requiresEvent ? " · exige evento" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function EventPickerField({ form, events, open, onOpenChange }: PickerProps & { form: AbsenceFormState; events: Event[] | undefined }) {
  const { requiresEvent, selectedEvent, watchedEventId, setValue, errors, cycleClosed } = form;
  const err = errors.eventId?.message;
  const pick = (id: number | null) => { setValue("eventId", id, { shouldValidate: true }); onOpenChange(false); };
  return (
    <div>
      <FieldLabel htmlFor="absence-event" required={requiresEvent} hint={requiresEvent ? "este tipo exige" : "opcional"}>Evento</FieldLabel>
      <Popover open={open} onOpenChange={onOpenChange}>
        {/* O botão "Tirar evento" fica FORA do gatilho (button dentro de button é inválido e inacessível). */}
        <div className="relative">
          <PopoverTrigger asChild>
            <button type="button" role="combobox" aria-expanded={open} id="absence-event" data-testid="select-penalty-event"
              aria-invalid={!!err} aria-describedby={err ? "absence-event-error" : undefined}
              className={cn(triggerCls, selectedEvent && "pr-[4.5rem]", err && invalidCls)}>
              {selectedEvent ? (
                <span className="min-w-0 flex items-center gap-2">
                  <MapPin size={14} aria-hidden className="shrink-0 text-muted-foreground" />
                  <span className="truncate font-semibold">{selectedEvent.name}</span>
                  <span className="hidden sm:inline shrink-0 text-[12.5px] text-muted-foreground tabular-nums">{eventDates(selectedEvent)}</span>
                </span>
              ) : <span className="truncate text-muted-foreground">{requiresEvent ? "Escolha o evento" : "Sem evento — vale para o ciclo"}</span>}
              <ChevronsUpDown size={14} aria-hidden className="shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          {selectedEvent && (
            <button type="button" aria-label="Tirar o evento" title="Tirar o evento" onClick={() => setValue("eventId", null, { shouldValidate: true })}
              className={cn("absolute right-8 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150", FOCUS_RING)}>
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
        <PopoverContent align="start" className={popCls}>
          <Command>
            <CommandInput placeholder="Buscar por evento..." />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-6 text-center text-[13px] text-muted-foreground">Nenhum evento do ciclo com esse nome.</CommandEmpty>
              {!requiresEvent && (
                <CommandGroup>
                  <CommandItem value="sem evento ciclo" onSelect={() => pick(null)} className="data-[selected=true]:bg-secondary data-[selected=true]:text-foreground gap-2 min-h-11 lg:min-h-9">
                    <Check size={14} aria-hidden className={cn("shrink-0", !watchedEventId ? "opacity-100" : "opacity-0")} />
                    <span className="text-muted-foreground">Sem evento — vale para o ciclo</span>
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup heading="Eventos do ciclo">
                {(events ?? []).map(e => {
                  const locked = eventLockedByClosedCycle(e, cycleClosed);
                  return (
                    <CommandItem key={e.id} value={`${e.name} ${e.cycleName ?? ""} ${e.id}`} disabled={locked} onSelect={() => pick(e.id)}
                      className="data-[selected=true]:bg-secondary data-[selected=true]:text-foreground gap-2 min-h-11 lg:min-h-10 items-start py-2">
                      <Check size={14} aria-hidden className={cn("mt-0.5 shrink-0", Number(watchedEventId) === e.id ? "opacity-100" : "opacity-0")} />
                      <span className="min-w-0 flex-1">
                        <span className="block leading-snug font-semibold whitespace-normal">{e.name}</span>
                        <span className="block text-[12px] text-muted-foreground tabular-nums">{eventDates(e)}</span>
                      </span>
                      {locked && <span className="shrink-0 inline-flex items-center gap-1 text-[12px] text-muted-foreground"><Lock size={12} aria-hidden />Ciclo fechado</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <FieldErrorText id="absence-event-error" message={err} />
    </div>
  );
}
