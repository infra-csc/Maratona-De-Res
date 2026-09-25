// Diálogos da Equipe Alocada: confirmar remoção de participante e adicionar
// colaborador (busca por nome + função no evento). Cada diálogo cuida da
// própria mutação; a página só controla qual está aberto.
import { useState } from "react";
import { useAddEventParticipant, useRemoveEventParticipant, useGetEmployees, getGetEventQueryKey, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CONDENSED, WARNING, DANGER_TEXT } from "@/lib/premium-theme";
import { DEFAULT_FUNCTION, PARTICIPANT_FUNCTIONS, fieldStyle, matchParticipantFunction } from "./helpers";
import type { EventDetail } from "./types";

export type RemoveParticipantDialogProps = {
  id: number;
  event: EventDetail;
  /** Participante aguardando confirmação de remoção (null = fechado). */
  pendingParticipantId: number | null;
  onClose: () => void;
};

export function RemoveParticipantDialog({ id, event, pendingParticipantId, onClose }: RemoveParticipantDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const removeParticipant = useRemoveEventParticipant({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) }); toast({ title: "Participante removido" }); },
      onError: (e: { message?: string }) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <AlertDialog open={pendingParticipantId !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <AlertDialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="uppercase font-black tracking-tight">Remover participante?</AlertDialogTitle>
          <AlertDialogDescription style={{ color: "var(--muted-foreground)" }}>
            O colaborador <strong>{event.participants?.find(p => p.id === pendingParticipantId)?.employeeName ?? ""}</strong> será removido da equipe deste evento. Se ele já possuir avaliações enviadas, as notas serão perdidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-remove-participant" className="rounded-lg uppercase font-bold" style={{ border: "1px solid var(--border)" }}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-remove-participant"
            onClick={() => {
              if (pendingParticipantId !== null) removeParticipant.mutate({ id, participantId: pendingParticipantId });
              onClose();
            }}
            className="rounded-lg uppercase font-bold"
            style={{ backgroundColor: WARNING, color: "#fff" }}
          >
            <Trash2 size={16} className="mr-1.5" /> Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type AddParticipantDialogProps = {
  id: number;
  event: EventDetail;
  canManageTeam: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddParticipantDialog({ id, event, canManageTeam, open, onOpenChange }: AddParticipantDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [newParticipantEmployeeId, setNewParticipantEmployeeId] = useState<number | null>(null);
  const [newParticipantFunction, setNewParticipantFunction] = useState<string>(DEFAULT_FUNCTION);
  const { data: allEmployees } = useGetEmployees({ active: true }, { query: { enabled: canManageTeam, queryKey: getGetEmployeesQueryKey({ active: true }) } });
  const alreadyAllocatedIds = new Set((event.participants ?? []).map(p => p.employeeId));
  const availableEmployees = (allEmployees ?? []).filter(e => !alreadyAllocatedIds.has(e.id));
  const selectedNewEmployee = availableEmployees.find(e => e.id === newParticipantEmployeeId);

  const resetForm = () => { setNewParticipantEmployeeId(null); setNewParticipantFunction(DEFAULT_FUNCTION); };

  const addParticipant = useAddEventParticipant({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetEventQueryKey(id) });
        toast({ title: "Colaborador adicionado à equipe" });
        onOpenChange(false);
        // Antes zerava a função (""): a próxima abertura mostrava o select vazio.
        resetForm();
      },
      onError: (e: { message?: string }) => toast({ title: "Erro ao adicionar", description: e.message, variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight" style={{ fontFamily: CONDENSED }}>Adicionar Colaborador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Colaborador <span style={{ color: DANGER_TEXT }}>*</span></Label>
            <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={employeePickerOpen}
                  data-testid="select-new-participant-employee"
                  className="h-11 w-full flex items-center justify-between gap-2 px-3 rounded-lg text-left"
                  style={fieldStyle}
                >
                  <span className={cn("truncate text-sm", selectedNewEmployee ? "font-bold uppercase" : "font-bold uppercase text-xs tracking-wider")} style={!selectedNewEmployee ? { color: "var(--muted-foreground)" } : undefined}>
                    {selectedNewEmployee ? selectedNewEmployee.name : "Busque pelo nome..."}
                  </span>
                  <ChevronsUpDown size={16} className="shrink-0 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0 rounded-xl w-[var(--radix-popover-trigger-width)]" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                <Command>
                  <CommandInput data-testid="input-new-participant-search" placeholder="Buscar pelo nome..." />
                  <CommandList className="max-h-[280px]">
                    <CommandEmpty className="py-6 text-center text-sm font-bold uppercase" style={{ color: "var(--muted-foreground)" }}>Nenhum colaborador disponível.</CommandEmpty>
                    <CommandGroup>
                      {availableEmployees.map(e => (
                        <CommandItem
                          key={e.id}
                          value={e.name}
                          data-testid={`option-new-participant-${e.id}`}
                          onSelect={() => {
                            setNewParticipantEmployeeId(e.id);
                            setNewParticipantFunction(matchParticipantFunction(e.functionName));
                            setEmployeePickerOpen(false);
                          }}
                          className="cursor-pointer py-2 gap-2"
                        >
                          <Check size={16} className={cn("shrink-0", newParticipantEmployeeId === e.id ? "opacity-100" : "opacity-0")} />
                          <span className="font-black uppercase text-sm truncate">{e.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold uppercase text-xs tracking-wider" style={{ color: "var(--muted-foreground)" }}>Função no Evento</Label>
            <Select value={newParticipantFunction} onValueChange={setNewParticipantFunction}>
              <SelectTrigger data-testid="select-new-participant-function" className="h-11 rounded-lg font-black uppercase text-sm" style={fieldStyle}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPANT_FUNCTIONS.map(fn => (
                  <SelectItem key={fn} value={fn} className="font-bold uppercase text-sm cursor-pointer">{fn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            data-testid="button-confirm-add-participant"
            disabled={!newParticipantEmployeeId || addParticipant.isPending}
            onClick={() => {
              if (!newParticipantEmployeeId) return;
              addParticipant.mutate({ id, data: { employeeId: newParticipantEmployeeId, functionName: newParticipantFunction || undefined } });
            }}
            className="w-full h-11 rounded-lg font-black uppercase tracking-tight disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {addParticipant.isPending ? "Adicionando..." : "Adicionar à Equipe"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
