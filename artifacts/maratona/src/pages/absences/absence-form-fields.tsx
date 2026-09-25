import type { Employee, Event } from "@workspace/api-client-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WARNING, GOOD_TEXT, DANGER_TEXT } from "@/lib/premium-theme";
import type { AbsenceFormState } from "./use-absence-form";
import type { PenaltyTypeLookup } from "./use-penalty-types";

// Campos do diálogo "Registrar/Editar Lançamento" com seletor próprio. O estado
// aberto/fechado dos popovers mora no diálogo (sempre montado), como antes.

type PickerProps = { open: boolean; onOpenChange: (v: boolean) => void };

export function PenaltyTypeField({ form, types }: { form: AbsenceFormState; types: PenaltyTypeLookup }) {
  const { selectedType, setValue, requiresEvent } = form;
  const { activeTypes, defaultType } = types;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="absence-type" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        Tipo de Lançamento <span style={{ color: DANGER_TEXT }}>*</span>
      </Label>
      <Select
        value={selectedType || defaultType}
        onValueChange={v => { setValue("penaltyType", v); setValue("eventId", null); }}
      >
        <SelectTrigger id="absence-type" data-testid="select-penalty-type" className="h-11 rounded-lg" style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
          <SelectValue placeholder="Selecione o tipo..." />
        </SelectTrigger>
        <SelectContent>
          {activeTypes.filter(t => t.kind === "penalty").length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: DANGER_TEXT }}>Penalidades (−)</div>
              {activeTypes.filter(t => t.kind === "penalty").map(t => (
                <SelectItem key={t.slug} value={t.slug}>{t.label} — −{t.points} pts{t.requiresEvent ? " 📍" : ""}</SelectItem>
              ))}
            </>
          )}
          {activeTypes.filter(t => t.kind === "merit").length > 0 && (
            <>
              <div className="px-2 py-1 mt-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: GOOD_TEXT }}>Méritos (+)</div>
              {activeTypes.filter(t => t.kind === "merit").map(t => (
                <SelectItem key={t.slug} value={t.slug}>{t.label} — +{t.points} pts{t.requiresEvent ? " 📍" : ""}</SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
      {requiresEvent && (
        <p className="text-[11px] font-bold uppercase tracking-wide flex items-center gap-1" style={{ color: DANGER_TEXT }}>
          📍 Este tipo exige um evento vinculado
        </p>
      )}
    </div>
  );
}

export function EventPickerField({ form, events, open, onOpenChange }: PickerProps & { form: AbsenceFormState; events: Event[] | undefined }) {
  const { requiresEvent, selectedEvent, watchedEventId, setValue } = form;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="absence-event" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        Evento{" "}
        {requiresEvent
          ? <span style={{ color: DANGER_TEXT }}>*</span>
          : <span className="normal-case font-normal text-xs">(opcional para lançamentos no ciclo)</span>
        }
      </Label>
      <Popover open={open} onOpenChange={onOpenChange}>
        {/* O botão "Remover" fica FORA do gatilho (button dentro de button é inválido e inacessível). */}
        <div className="relative">
          <PopoverTrigger asChild>
            <button
              type="button"
              role="combobox"
              id="absence-event"
              data-testid="select-penalty-event"
              className={cn("h-11 w-full flex items-center justify-between gap-2 pl-3 rounded-lg text-left", selectedEvent ? "pr-14" : "pr-3")}
              style={{
                backgroundColor: "var(--secondary)",
                border: requiresEvent && !watchedEventId ? `1px solid ${WARNING}` : "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              <span className={cn("truncate text-sm", selectedEvent ? "font-bold" : "font-medium text-xs")} style={{ color: selectedEvent ? "var(--foreground)" : "var(--muted-foreground)" }}>
                {selectedEvent ? `${selectedEvent.name}${selectedEvent.cycleName ? ` (${selectedEvent.cycleName})` : ""}` : "Selecione o evento..."}
              </span>
              <ChevronsUpDown size={14} className="shrink-0" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </PopoverTrigger>
          {selectedEvent && (
            <button
              type="button"
              aria-label="Remover evento selecionado"
              title="Remover evento"
              onClick={() => setValue("eventId", null)}
              className="absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <Command>
            <CommandInput placeholder="Buscar por evento..." />
            <CommandList className="max-h-[260px]">
              <CommandEmpty className="py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum evento encontrado.</CommandEmpty>
              <CommandGroup>
                {(events ?? []).map(e => (
                  <CommandItem
                    key={e.id}
                    value={`${e.name} ${e.cycleName ?? ""}`}
                    onSelect={() => { setValue("eventId", e.id); onOpenChange(false); }}
                    className="cursor-pointer py-2 gap-2 items-start"
                  >
                    <Check size={14} className={cn("mt-0.5 shrink-0", Number(watchedEventId) === e.id ? "opacity-100" : "opacity-0")} />
                    <span className="flex flex-col min-w-0">
                      <span className="font-black uppercase text-sm leading-tight whitespace-normal">{e.name}</span>
                      {e.cycleName && <span className="text-[11px] font-medium" style={{ color: "var(--muted-foreground)" }}>{e.cycleName}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {requiresEvent && !watchedEventId && (
        <p className="text-[11px] font-bold" style={{ color: DANGER_TEXT }}>Selecione um evento para continuar.</p>
      )}
    </div>
  );
}

export function EmployeePickerField({ form, employees, open, onOpenChange }: PickerProps & { form: AbsenceFormState; employees: Employee[] | undefined }) {
  const { selectedEmployee, watchedEmployeeId, setValue } = form;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="absence-employee" className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>
        Colaborador <span style={{ color: DANGER_TEXT }}>*</span>
      </Label>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            id="absence-employee"
            data-testid="select-absence-employee"
            className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-lg text-left"
            style={{ backgroundColor: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          >
            <span className={cn("truncate text-sm", selectedEmployee ? "font-black uppercase" : "font-medium text-xs")} style={{ color: selectedEmployee ? "var(--foreground)" : "var(--muted-foreground)" }}>
              {selectedEmployee ? selectedEmployee.name : "Busque pelo nome..."}
            </span>
            <ChevronsUpDown size={14} style={{ color: "var(--muted-foreground)" }} className="shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <Command>
            <CommandInput placeholder="Buscar pelo nome..." />
            <CommandList className="max-h-[260px]">
              <CommandEmpty className="py-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador encontrado.</CommandEmpty>
              <CommandGroup>
                {(employees ?? []).map(e => (
                  <CommandItem
                    key={e.id}
                    value={e.name}
                    onSelect={() => { setValue("employeeId", e.id); onOpenChange(false); }}
                    className="cursor-pointer py-2 gap-2"
                  >
                    <Check size={14} className={cn("shrink-0", Number(watchedEmployeeId) === e.id ? "opacity-100" : "opacity-0")} />
                    <span className="font-black uppercase text-sm truncate">{e.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
