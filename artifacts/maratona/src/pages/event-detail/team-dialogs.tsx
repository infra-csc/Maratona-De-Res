// Diálogos da Equipe Alocada: confirmar remoção de participante e adicionar
// colaborador (busca por nome + função no evento). Cada diálogo cuida da
// própria mutação; a página só controla qual está aberto.
import { useState } from "react";
import { useAddEventParticipant, useRemoveEventParticipant, useGetEmployees, getGetEventQueryKey, getGetEmployeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DEFAULT_FUNCTION, PARTICIPANT_FUNCTIONS, matchParticipantFunction } from "./helpers";
import { Avatar, DialogHeading, FieldLabel, btnPrimary, btnSecondary, dialogCls, inputCls } from "./detail-ui";
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
  const name = event.participants?.find(p => p.id === pendingParticipantId)?.employeeName ?? "";

  return (
    <AlertDialog open={pendingParticipantId !== null} onOpenChange={o => { if (!o) onClose(); }}>
      <AlertDialogContent className={dialogCls}>
        <DialogHeading icon={Trash2} tone="danger" Title={AlertDialogTitle} Description={AlertDialogDescription}
          title="Remover participante?"
          description={<><b className="font-semibold text-foreground">{name}</b> sai da equipe deste evento. Se já tiver avaliações enviadas, as notas dele neste evento se perdem.</>} />
        <AlertDialogFooter className="gap-2 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel data-testid="button-cancel-remove-participant" className={cn(btnSecondary, "mt-0")}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-remove-participant"
            onClick={() => {
              if (pendingParticipantId !== null) removeParticipant.mutate({ id, participantId: pendingParticipantId });
              onClose();
            }}
            className={cn(btnPrimary, "bg-destructive text-destructive-foreground enabled:hover:opacity-90")}
          >
            <Trash2 size={15} aria-hidden /> Remover
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
  const { data: allEmployees, isLoading: loadingEmployees } = useGetEmployees({ active: true }, { query: { enabled: canManageTeam, queryKey: getGetEmployeesQueryKey({ active: true }) } });
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
    <Dialog open={open} onOpenChange={(o) => { if (addParticipant.isPending) return; onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className={cn(dialogCls, "max-w-[500px]")}>
        <DialogHeading icon={UserPlus} Title={DialogTitle} Description={DialogDescription} title="Adicionar colaborador"
          description="Para quem trabalhou no evento e não veio na sincronização com a Logística Interna." />
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="new-participant-employee" required>Colaborador</FieldLabel>
            <Popover open={employeePickerOpen} onOpenChange={setEmployeePickerOpen}>
              <PopoverTrigger asChild>
                <button
                  id="new-participant-employee"
                  type="button"
                  role="combobox"
                  aria-expanded={employeePickerOpen}
                  data-testid="select-new-participant-employee"
                  className={cn(inputCls, "h-auto min-h-11 py-1.5 flex items-center justify-between gap-2 text-left")}
                >
                  {selectedNewEmployee ? (
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Avatar name={selectedNewEmployee.name} className="w-7 h-7 text-[11px]" />
                      <span className="font-condensed truncate text-[16px] font-bold uppercase">{selectedNewEmployee.name}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{loadingEmployees ? "Carregando colaboradores…" : "Busque pelo nome…"}</span>
                  )}
                  <ChevronsUpDown size={16} aria-hidden className="shrink-0 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={6} className="font-body p-0 rounded-xl border-border bg-popover text-popover-foreground shadow-lg w-[var(--radix-popover-trigger-width)]">
                <Command>
                  <CommandInput data-testid="input-new-participant-search" placeholder="Buscar pelo nome…" />
                  <CommandList className="max-h-[280px]">
                    <CommandEmpty className="py-6 text-center text-[14px] text-muted-foreground">Nenhum colaborador disponível.</CommandEmpty>
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
                          className="cursor-pointer py-2 gap-2.5 rounded-lg"
                        >
                          <Check size={15} aria-hidden className={cn("shrink-0", newParticipantEmployeeId === e.id ? "opacity-100" : "opacity-0")} />
                          <span className="font-condensed text-[15px] font-bold uppercase truncate">{e.name}</span>
                          {e.functionName && <span className="ml-auto text-[12px] text-muted-foreground truncate">{e.functionName}</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <FieldLabel htmlFor="new-participant-function">Função no evento</FieldLabel>
            <Select value={newParticipantFunction} onValueChange={setNewParticipantFunction}>
              <SelectTrigger id="new-participant-function" data-testid="select-new-participant-function" className={cn(inputCls, "font-condensed text-[15px] font-bold uppercase")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTICIPANT_FUNCTIONS.map(fn => (
                  <SelectItem key={fn} value={fn} className="font-condensed text-[15px] font-bold uppercase cursor-pointer">{fn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={() => { onOpenChange(false); resetForm(); }} disabled={addParticipant.isPending} className={btnSecondary}>Cancelar</button>
          <button
            type="button"
            data-testid="button-confirm-add-participant"
            disabled={!newParticipantEmployeeId || addParticipant.isPending}
            aria-busy={addParticipant.isPending || undefined}
            onClick={() => {
              if (!newParticipantEmployeeId) return;
              addParticipant.mutate({ id, data: { employeeId: newParticipantEmployeeId, functionName: newParticipantFunction || undefined } });
            }}
            className={btnPrimary}
          >
            {addParticipant.isPending ? <Loader2 size={15} aria-hidden className="motion-safe:animate-spin" /> : <UserPlus size={15} aria-hidden />}
            {addParticipant.isPending ? "Adicionando…" : "Adicionar à equipe"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
