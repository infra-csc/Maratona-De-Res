import type { UserSummary } from "@workspace/api-client-react";
import { ArrowRight, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { btnSmall } from "./ui";

interface ConformityRedirectPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserSummary[] | undefined;
  selectedUserId: number | null;
  onSelectUser: (userId: number) => void;
}

// Botão "Redirecionar" da Matriz de Conformidade (Cenografia / Ferramentas):
// busca um avaliador da área e transfere a responsabilidade na hora.
export function ConformityRedirectPopover({ open, onOpenChange, users, selectedUserId, onSelectUser }: ConformityRedirectPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" className={btnSmall} aria-haspopup="dialog">
          <ArrowRight size={14} aria-hidden /> Redirecionar
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="font-body p-0 rounded-xl border-border w-72 max-w-[calc(100vw-24px)] overflow-hidden bg-popover text-popover-foreground shadow-lg">
        <div className="px-3.5 pt-3 pb-2 border-b border-border">
          <p className="font-condensed text-[15px] font-black uppercase leading-tight">Passar a matriz para</p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">A pessoa escolhida passa a responder; a transferência é imediata.</p>
        </div>
        <Command className="rounded-none bg-transparent">
          <CommandInput placeholder="Buscar avaliador..." />
          <CommandList className="max-h-[240px]">
            <CommandEmpty className="py-5 text-center text-[13px] text-muted-foreground">Ninguém com esse nome na área.</CommandEmpty>
            <CommandGroup>
              {(users ?? []).map(u => (
                <CommandItem key={u.id} value={u.name}
                  onSelect={() => onSelectUser(u.id)}
                  className="min-h-11 rounded-lg cursor-pointer gap-3 text-[14px] data-[selected=true]:bg-secondary data-[selected=true]:text-foreground aria-selected:bg-secondary aria-selected:text-foreground"
                >
                  <Check size={15} aria-hidden className={cn("shrink-0", selectedUserId === u.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate font-semibold">{u.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
